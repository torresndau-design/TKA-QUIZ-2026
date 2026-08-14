import mammoth from 'mammoth';
import JSZip from 'jszip';
import { Question, QuestionType } from '../types';
import { normalizeMatchingPairs, splitMatchingPairText } from './questionUtils';
import { cleanHtmlContent, getCleanImageSrc, getCleanMediaSrc, isValidImageSrc, isLocalWordImagePath } from '../components/common/RichText';

interface DocxArchiveData {
  mediaMap: Map<string, string>;
  relMap: Map<string, string>;
  cellImages: Map<string, string>;
  orderedImages: string[];
}

/**
 * Extracts embedded media files and XML relationships directly from .docx (ZIP) archive
 */
async function extractDocxArchive(arrayBuffer: ArrayBuffer): Promise<DocxArchiveData> {
  const mediaMap = new Map<string, string>();
  const relMap = new Map<string, string>();
  const cellImages = new Map<string, string>();
  const orderedImages: string[] = [];

  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 1. Extract all media files from word/media/* or any media/ directory
    const mediaFiles = Object.keys(zip.files).filter(
      (path) =>
        !zip.files[path].dir &&
        (path.startsWith('word/media/') || path.includes('/media/') || path.includes('_files/'))
    );

    for (const filePath of mediaFiles) {
      try {
        const fileObj = zip.files[filePath];
        const base64Data = await fileObj.async('base64');
        if (!base64Data) continue;

        let mime = 'image/png';
        const lower = filePath.toLowerCase();
        if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
        else if (lower.endsWith('.png')) mime = 'image/png';
        else if (lower.endsWith('.gif')) mime = 'image/gif';
        else if (lower.endsWith('.webp')) mime = 'image/webp';
        else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
        else if (lower.endsWith('.bmp')) mime = 'image/bmp';
        else if (lower.endsWith('.emf') || lower.endsWith('.wmf')) mime = 'image/png';
        else {
          if (base64Data.startsWith('iVBORw0KGgo')) mime = 'image/png';
          else if (base64Data.startsWith('/9j/')) mime = 'image/jpeg';
          else if (base64Data.startsWith('R0lGOD')) mime = 'image/gif';
          else if (base64Data.startsWith('UklGR')) mime = 'image/webp';
        }

        const dataUrl = `data:${mime};base64,${base64Data}`;
        const fileName = filePath.split('/').pop() || filePath;

        // Store multiple key variants for robust lookup
        mediaMap.set(filePath, dataUrl);
        mediaMap.set(filePath.toLowerCase(), dataUrl);
        mediaMap.set(fileName, dataUrl);
        mediaMap.set(fileName.toLowerCase(), dataUrl);
        if (filePath.startsWith('word/')) {
          const subPath = filePath.substring(5); // media/image1.png
          mediaMap.set(subPath, dataUrl);
          mediaMap.set(subPath.toLowerCase(), dataUrl);
        }

        orderedImages.push(dataUrl);
      } catch (e) {
        console.warn('Error reading media file from docx zip:', filePath, e);
      }
    }

    // 2. Parse word/_rels/document.xml.rels to map rId to media data
    const relsFile = zip.files['word/_rels/document.xml.rels'];
    if (relsFile) {
      try {
        const relsXml = await relsFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(relsXml, 'text/xml');
        const relElements = Array.from(doc.querySelectorAll('Relationship'));

        relElements.forEach((rel) => {
          const id = rel.getAttribute('Id') || '';
          const target = rel.getAttribute('Target') || '';
          if (!id || !target) return;

          // Target might be "media/image1.png" or "media/image004.png"
          const directMatch =
            mediaMap.get(target) ||
            mediaMap.get(target.toLowerCase()) ||
            mediaMap.get(target.split('/').pop() || '') ||
            mediaMap.get((target.split('/').pop() || '').toLowerCase()) ||
            mediaMap.get(`word/${target}`) ||
            mediaMap.get(`word/${target.toLowerCase()}`);

          if (directMatch) {
            relMap.set(id, directMatch);
            relMap.set(id.toLowerCase(), directMatch);
          }
        });
      } catch (e) {
        console.warn('Error parsing document.xml.rels:', e);
      }
    }

    // 3. Parse word/document.xml to map table cells to embedded images
    const docXmlFile = zip.files['word/document.xml'];
    if (docXmlFile) {
      try {
        const docXml = await docXmlFile.async('text');
        const parser = new DOMParser();
        const doc = parser.parseFromString(docXml, 'text/xml');
        const tables = Array.from(doc.querySelectorAll('tbl'));

        tables.forEach((tbl, tIdx) => {
          const rows = Array.from(tbl.querySelectorAll('tr'));
          rows.forEach((tr, rIdx) => {
            const cells = Array.from(tr.querySelectorAll('tc'));
            cells.forEach((tc, cIdx) => {
              // Check drawing blip r:embed or r:link
              const blips = Array.from(tc.querySelectorAll('blip, a\\:blip'));
              for (const blip of blips) {
                const embedId =
                  blip.getAttribute('r:embed') ||
                  blip.getAttribute('embed') ||
                  blip.getAttribute('r:link') ||
                  blip.getAttribute('link') ||
                  '';
                if (embedId && relMap.has(embedId)) {
                  const imgData = relMap.get(embedId)!;
                  cellImages.set(`${tIdx}_${rIdx}_${cIdx}`, imgData);
                  cellImages.set(`r_${rIdx}_c_${cIdx}`, imgData);
                  cellImages.set(`row_${rIdx}`, imgData);
                  break;
                }
              }

              // Check VML shape imagedata r:id
              const vmlImgs = Array.from(tc.querySelectorAll('imagedata, v\\:imagedata'));
              for (const vml of vmlImgs) {
                const rid =
                  vml.getAttribute('r:id') ||
                  vml.getAttribute('id') ||
                  vml.getAttribute('r:href') ||
                  vml.getAttribute('src') ||
                  '';
                if (rid) {
                  const imgData = relMap.get(rid) || mediaMap.get(rid) || mediaMap.get(rid.toLowerCase());
                  if (imgData) {
                    cellImages.set(`${tIdx}_${rIdx}_${cIdx}`, imgData);
                    cellImages.set(`r_${rIdx}_c_${cIdx}`, imgData);
                    cellImages.set(`row_${rIdx}`, imgData);
                    break;
                  }
                }
              }
            });
          });
        });
      } catch (e) {
        console.warn('Error mapping cells from document.xml:', e);
      }
    }
  } catch (err) {
    console.warn('File is not a valid docx ZIP or JSZip failed:', err);
  }

  return { mediaMap, relMap, cellImages, orderedImages };
}

/**
 * Extract image source from cell DOM node or fallback string, resolving via docx media maps
 */
function extractImageSrcFromCell(
  cellNode: Element | null,
  fallbackRaw: string,
  docxData?: DocxArchiveData
): string {
  if (cellNode) {
    const imgEl = cellNode.querySelector('img');
    if (imgEl && imgEl.getAttribute('src')) {
      const src = imgEl.getAttribute('src')!;
      if (isValidImageSrc(src)) return src;
      // If src is a filename, try lookup in mediaMap
      if (docxData) {
        const resolved =
          docxData.mediaMap.get(src) ||
          docxData.mediaMap.get(src.toLowerCase()) ||
          docxData.mediaMap.get(src.split('/').pop() || '') ||
          docxData.mediaMap.get((src.split('/').pop() || '').toLowerCase()) ||
          docxData.relMap.get(src);
        if (resolved) return resolved;
      }
      return src;
    }

    const vmlImg = cellNode.querySelector('v\\:imagedata, imagedata');
    if (vmlImg) {
      const src = vmlImg.getAttribute('src') || vmlImg.getAttribute('r:id') || '';
      if (src) {
        if (isValidImageSrc(src)) return src;
        if (docxData) {
          const resolved =
            docxData.mediaMap.get(src) ||
            docxData.mediaMap.get(src.toLowerCase()) ||
            docxData.relMap.get(src);
          if (resolved) return resolved;
        }
        return src;
      }
    }
  }

  if (docxData && fallbackRaw) {
    const trimmed = fallbackRaw.trim();
    const resolved =
      docxData.mediaMap.get(trimmed) ||
      docxData.mediaMap.get(trimmed.toLowerCase()) ||
      docxData.mediaMap.get(trimmed.split('/').pop() || '') ||
      docxData.mediaMap.get((trimmed.split('/').pop() || '').toLowerCase());
    if (resolved) return resolved;
  }

  return fallbackRaw;
}

/**
 * Extract audio source from cell DOM node or fallback string
 */
function extractAudioSrcFromCell(cellNode: Element | null, fallbackRaw: string): string {
  if (cellNode) {
    const audioEl = cellNode.querySelector('audio source, audio');
    if (audioEl && audioEl.getAttribute('src')) {
      return audioEl.getAttribute('src')!;
    }
  }
  return fallbackRaw;
}

/**
 * Helper to process and format a question based on its specified type or auto-detected type from KUNCI / options.
 */
function processFinalQuestion(
  q: Partial<Question>,
  rawOptions: { letter: string; text: string; isCorrect: boolean }[],
  kunciText: string
): Partial<Question> {
  const cleanKunci = (kunciText || '').trim();
  const upperKunci = cleanKunci.toUpperCase();

  // Clean HTML formatting and remove Word bloat from all question fields
  if (q.questionText) {
    q.questionText = cleanHtmlContent(q.questionText);
  }
  if (q.discussion) {
    q.discussion = cleanHtmlContent(q.discussion);
  }
  if (q.stimulus?.content) {
    if (q.stimulus.type === 'image') {
      q.stimulus.content = getCleanImageSrc(q.stimulus.content);
    } else if (q.stimulus.type === 'audio') {
      q.stimulus.content = getCleanMediaSrc(q.stimulus.content);
    } else if (q.stimulus.type === 'text') {
      q.stimulus.content = cleanHtmlContent(q.stimulus.content);
    }
  }
  rawOptions = rawOptions.map((opt) => ({
    ...opt,
    text: cleanHtmlContent(opt.text),
  }));

  // Auto-detect type if not explicitly set by user tag
  if (!(q as any).isTypeExplicit) {
    if (
      upperKunci.includes('BENAR') ||
      upperKunci.includes('SALAH') ||
      /^(?:B|S)(?:\s*[\,\;\s]\s*(?:B|S))+$/i.test(cleanKunci)
    ) {
      q.type = 'benar_salah';
    } else if (
      upperKunci.includes('SETUJU') ||
      upperKunci.includes('TIDAK SETUJU') ||
      /^(?:S|TS)(?:\s*[\,\;\s]\s*(?:S|TS))+$/i.test(cleanKunci)
    ) {
      q.type = 'setuju_tidak_setuju';
    } else if (
      /^(?:[A-E1-9]\s*(?:=>|->|[\-\:\=])\s*[A-E1-9])(?:\s*[\,\;\s]\s*[A-E1-9]\s*(?:=>|->|[\-\:\=])\s*[A-E1-9])*$/i.test(cleanKunci)
    ) {
      q.type = 'menjodohkan';
    } else if (cleanKunci.split(/[\,\;\s\+]+/).filter((x) => /^[A-E]$/i.test(x)).length > 1) {
      q.type = 'pg_kompleks';
    } else if (rawOptions.length === 0 && cleanKunci.length > 0) {
      q.type = 'isian_singkat';
    } else {
      q.type = q.type || 'pilihan_ganda';
    }
  }

  // 1. BENAR_SALAH / SETUJU_TIDAK_SETUJU
  if (q.type === 'benar_salah' || q.type === 'setuju_tidak_setuju') {
    const tokens = cleanKunci.split(/[\,\;\/\s\+]+/).filter(Boolean);
    const keyBooleans: boolean[] = [];

    tokens.forEach((t) => {
      const ut = t.toUpperCase();
      if (ut === 'BENAR' || ut === 'B' || ut === 'SETUJU' || ut === 'TRUE' || ut === '1' || ut === 'Y') {
        keyBooleans.push(true);
      } else if (
        ut === 'SALAH' ||
        ut === 'S' ||
        ut === 'TIDAK SETUJU' ||
        ut === 'TS' ||
        ut === 'FALSE' ||
        ut === '0' ||
        ut === 'N'
      ) {
        keyBooleans.push(false);
      }
    });

    const tfItems = rawOptions.map((opt, idx) => {
      let statementText = opt.text;
      let boolAns = keyBooleans[idx] !== undefined ? keyBooleans[idx] : true;

      if (/\[(?:BENAR|B|TRUE|SETUJU)\]|\((?:BENAR|B|TRUE|SETUJU)\)/i.test(statementText)) {
        boolAns = true;
        statementText = statementText.replace(/\[(?:BENAR|B|TRUE|SETUJU)\]|\((?:BENAR|B|TRUE|SETUJU)\)/gi, '').trim();
      } else if (/\[(?:SALAH|S|FALSE|TIDAK SETUJU|TS)\]|\((?:SALAH|S|FALSE|TIDAK SETUJU|TS)\)/i.test(statementText)) {
        boolAns = false;
        statementText = statementText.replace(/\[(?:SALAH|S|FALSE|TIDAK SETUJU|TS)\]|\((?:SALAH|S|FALSE|TIDAK SETUJU|TS)\)/gi, '').trim();
      }

      return {
        id: `tf_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        statement: statementText,
        correctAnswer: boolAns,
      };
    });

    q.trueFalseItems =
      tfItems.length > 0
        ? tfItems
        : [
            {
              id: `tf_${Date.now()}`,
              statement: q.questionText || 'Pernyataan 1',
              correctAnswer: keyBooleans[0] ?? true,
            },
          ];
    delete q.options;
  }

  // 2. MENJODOHKAN / DRAG AND DROP
  else if (q.type === 'menjodohkan' || q.type === 'drag_drop') {
    const pairs: { id: string; leftItem: string; rightItem: string }[] = [];

    rawOptions.forEach((opt, idx) => {
      const split = splitMatchingPairText(opt.text);
      if (split) {
        pairs.push({
          id: `pair_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          leftItem: split.left,
          rightItem: split.right,
        });
      } else {
        pairs.push({
          id: `pair_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          leftItem: opt.text.trim() || `Pernyataan ${idx + 1}`,
          rightItem: `Pasangan ${idx + 1}`,
        });
      }
    });

    // Parse explicit key pairs from KUNCI if present e.g. "A-1, B-2, C-3" or "1-D, 2-C, 3-B"
    if (pairs.length > 0 && cleanKunci) {
      const keyPairMatches = cleanKunci.split(/[\,\;\s]+/);
      keyPairMatches.forEach((kp) => {
        const m = kp.match(/([A-Ea-e1-9])\s*(?:=>|->|[\-\:\=])\s*([A-Ea-e1-9]|.+)/);
        if (m) {
          const first = m[1];
          const second = m[2].trim();

          // Case 1: "1-D" or "1-A"
          if (/^\d+$/.test(first)) {
            const leftIdx = parseInt(first, 10) - 1;
            if (pairs[leftIdx]) {
              if (/^[A-Za-z]$/.test(second)) {
                const rightIdx = second.toUpperCase().charCodeAt(0) - 65;
                if (rawOptions[rightIdx]) {
                  const splitR = splitMatchingPairText(rawOptions[rightIdx].text);
                  pairs[leftIdx].rightItem = splitR ? splitR.right : rawOptions[rightIdx].text.trim();
                } else {
                  pairs[leftIdx].rightItem = second.toUpperCase();
                }
              } else {
                pairs[leftIdx].rightItem = second;
              }
            }
          }
          // Case 2: "A-1" or "A-D"
          else if (/^[A-Za-z]$/.test(first)) {
            const leftIdx = first.toUpperCase().charCodeAt(0) - 65;
            if (pairs[leftIdx]) {
              if (/^\d+$/.test(second)) {
                const rightIdx = parseInt(second, 10) - 1;
                if (rawOptions[rightIdx]) {
                  const splitR = splitMatchingPairText(rawOptions[rightIdx].text);
                  pairs[leftIdx].rightItem = splitR ? splitR.right : rawOptions[rightIdx].text.trim();
                } else {
                  pairs[leftIdx].rightItem = `Pasangan ${second}`;
                }
              } else if (/^[A-Za-z]$/.test(second)) {
                const rightIdx = second.toUpperCase().charCodeAt(0) - 65;
                if (rawOptions[rightIdx]) {
                  const splitR = splitMatchingPairText(rawOptions[rightIdx].text);
                  pairs[leftIdx].rightItem = splitR ? splitR.right : rawOptions[rightIdx].text.trim();
                } else {
                  pairs[leftIdx].rightItem = second.toUpperCase();
                }
              } else {
                pairs[leftIdx].rightItem = second;
              }
            }
          }
        }
      });
    }

    const normalized = normalizeMatchingPairs(pairs);
    q.matchingPairs =
      normalized.length > 0
        ? normalized
        : [
            {
              id: `pair_${Date.now()}`,
              leftItem: 'Pernyataan 1',
              rightItem: 'Pasangan 1',
            },
          ];
    delete q.options;
  }

  // 3. ISIAN SINGKAT / ISIAN ANGKA / URAIAN
  else if (
    q.type === 'isian_singkat' ||
    q.type === 'uraian_pendek' ||
    q.type === 'uraian_panjang' ||
    q.type === 'melengkapi_kalimat'
  ) {
    q.correctAnswerText = cleanKunci || 'Jawaban Isian';
    delete q.options;
  } else if (q.type === 'isian_angka') {
    const num = parseFloat(cleanKunci);
    q.numericAnswer = !isNaN(num) ? num : 0;
    delete q.options;
  }

  // 4. PILIHAN GANDA & PILIHAN GANDA KOMPLEKS & CHECKLIST
  else {
    const keyLetters = new Set<string>();
    cleanKunci
      .toUpperCase()
      .split(/[\,\;\s\+]+/)
      .forEach((token) => {
        const m = token.match(/([A-E])/);
        if (m) keyLetters.add(m[1]);
      });

    const options = rawOptions.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const isCorrect = opt.isCorrect || keyLetters.has(letter) || keyLetters.has(opt.letter);
      return {
        id: `opt_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
        text: opt.text || `Pilihan ${letter}`,
        isCorrect,
      };
    });

    if (options.length > 0 && !options.some((o) => o.isCorrect)) {
      options[0].isCorrect = true;
    }

    q.options = options;
  }

  return q;
}

/**
 * Parses questions from Microsoft Word (.docx, .doc, HTML Word templates, or text files).
 * Supports Word CBT Macro tables, multi-column tables, and paragraph text formats.
 */
export async function parseQuestionsFromWord(file: File): Promise<Partial<Question>[]> {
  let html = '';
  let rawText = '';
  let docxData: DocxArchiveData = {
    mediaMap: new Map(),
    relMap: new Map(),
    cellImages: new Map(),
    orderedImages: [],
  };

  try {
    const arrayBuffer = await file.arrayBuffer();

    // 1. Extract embedded media, relationships, and cell drawings via JSZip
    docxData = await extractDocxArchive(arrayBuffer);

    // 2. Convert standard .docx via Mammoth
    try {
      const htmlResult = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement((image) => {
            return image.read('base64').then((imageBuffer) => {
              let mime = image.contentType || 'image/png';
              if (imageBuffer.startsWith('iVBORw0KGgo')) mime = 'image/png';
              else if (imageBuffer.startsWith('/9j/')) mime = 'image/jpeg';
              else if (imageBuffer.startsWith('R0lGOD')) mime = 'image/gif';
              else if (imageBuffer.startsWith('UklGR')) mime = 'image/webp';
              else if (imageBuffer.startsWith('PHN2Zw') || imageBuffer.startsWith('PD94bWw')) mime = 'image/svg+xml';
              return {
                src: `data:${mime};base64,${imageBuffer}`,
              };
            });
          }),
        }
      );
      const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
      html = htmlResult.value || '';
      rawText = rawTextResult.value || '';
    } catch (mammothErr) {
      console.warn('Mammoth conversion note:', mammothErr);
    }
  } catch (e) {
    console.warn('ArrayBuffer error:', e);
  }

  // 3. Fallback: Read file as text if Mammoth returned empty (e.g. .doc, .html, or plain text template)
  if (!html && !rawText) {
    try {
      const fileText = await file.text();
      if (/<table|<tr|<p|<html/i.test(fileText)) {
        html = fileText;
      }
      rawText = cleanRawText(fileText);
    } catch (textErr) {
      console.error('File text read error:', textErr);
    }
  }

  // 4. Parse HTML content if available
  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Resolve any relative or filename img sources using extracted mediaMap
    const allImgs = Array.from(doc.querySelectorAll('img'));
    allImgs.forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src && !src.startsWith('data:')) {
        const resolved =
          docxData.mediaMap.get(src) ||
          docxData.mediaMap.get(src.toLowerCase()) ||
          docxData.mediaMap.get(src.split('/').pop() || '') ||
          docxData.mediaMap.get((src.split('/').pop() || '').toLowerCase()) ||
          docxData.relMap.get(src);
        if (resolved) {
          img.setAttribute('src', resolved);
        }
      }
    });

    // 4a. Try parsing HTML tables first
    const tables = Array.from(doc.querySelectorAll('table'));
    if (tables.length > 0) {
      const tableQuestions = parseFromHtmlTables(tables, docxData);
      if (tableQuestions.length > 0) {
        return tableQuestions;
      }
    }

    // 4b. Try parsing HTML paragraphs/elements
    const htmlQuestions = parseFromHtmlElements(doc, docxData);
    if (htmlQuestions.length > 0) {
      return htmlQuestions;
    }
  }

  // 5. Fallback to raw text line parsing
  if (rawText) {
    const textLines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const textQuestions = parseFromLines(textLines);
    if (textQuestions.length > 0) {
      return textQuestions;
    }
  }

  return [];
}

/**
 * Cleans binary or messy raw text into readable text lines
 */
function cleanRawText(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ').replace(/<[^>]+>/g, '\n');
}

/**
 * Extracts content from an HTML cell, preserving <img> tags and rich formatting
 */
function extractCellContent(cell: Element, docxData?: DocxArchiveData): string {
  if (!cell) return '';

  // Check if cell has images and resolve them
  if (docxData) {
    const imgs = Array.from(cell.querySelectorAll('img'));
    imgs.forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (src && !src.startsWith('data:')) {
        const resolved =
          docxData.mediaMap.get(src) ||
          docxData.mediaMap.get(src.toLowerCase()) ||
          docxData.mediaMap.get(src.split('/').pop() || '') ||
          docxData.mediaMap.get((src.split('/').pop() || '').toLowerCase()) ||
          docxData.relMap.get(src);
        if (resolved) {
          img.setAttribute('src', resolved);
        }
      }
    });
  }

  const hasImg = cell.querySelector('img') !== null;
  const hasRich = cell.querySelector('p, table, ul, ol, li, b, i, u, sub, sup') !== null;

  if (hasImg || hasRich) {
    return cleanHtmlContent(cell.innerHTML);
  }
  return cleanHtmlContent(cell.textContent || '');
}

/**
 * Parses questions from HTML tables (both Multi-column horizontal and CBT vertical tables)
 */
function parseFromHtmlTables(tables: HTMLTableElement[], docxData?: DocxArchiveData): Partial<Question>[] {
  const allQuestions: Partial<Question>[] = [];

  // 1. Check if any table is multi-column horizontal layout
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr')) as HTMLElement[];
    if (rows.length === 0) continue;

    const multiColQuestions = parseMultiColumnTable(rows);
    if (multiColQuestions.length > 0) {
      allQuestions.push(...multiColQuestions);
    }
  }
  if (allQuestions.length > 0) return allQuestions;

  // 2. Flatten ALL table rows sequentially to handle Word page breaks or table splits seamlessly
  const allRows: HTMLElement[] = [];
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr')) as HTMLElement[];
    allRows.push(...rows);
  }

  const verticalQuestions = parseVerticalCbtTable(allRows, docxData);
  if (verticalQuestions.length > 0) {
    return verticalQuestions;
  }

  return [];
}

/**
 * Parses multi-column table where each row represents 1 question
 */
function parseMultiColumnTable(rows: HTMLElement[]): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  if (rows.length < 2) return questions;

  const sampleCells = Array.from(rows[0].querySelectorAll('td, th'));
  if (sampleCells.length < 3) return [];

  const hasCbtTags = rows.some((row) => {
    const cells = Array.from(row.querySelectorAll('td, th')).map((c) => (c.textContent || '').trim().toUpperCase());
    if (cells.length < 1) return false;
    const col0 = cells[0].replace(/[\.\:\s\(\)\[\]]/g, '');
    return (
      col0.includes('KATEGORI') ||
      col0.includes('BOBOT') ||
      col0.includes('KUNCI') ||
      col0.includes('PEMBAHASAN') ||
      col0.includes('TIPE') ||
      col0.includes('STIMULUS') ||
      col0.includes('AKM') ||
      /^OPSI[A-E]$/.test(col0) ||
      /^[A-E]$/.test(col0)
    );
  });
  if (hasCbtTags) return [];

  let headerRowIdx = -1;
  let colSoalIdx = -1;
  let colKunciIdx = -1;
  let colBobotIdx = -1;
  const colOptIndices: { [key: string]: number } = {};

  for (let r = 0; r < Math.min(rows.length, 3); r++) {
    const cells = Array.from(rows[r].querySelectorAll('td, th')).map((c) =>
      (c.textContent || '').trim().toUpperCase()
    );

    cells.forEach((text, cIdx) => {
      if (text.length < 30 && (text.includes('SOAL') || text.includes('PERTANYAAN') || text.includes('QUESTION'))) {
        colSoalIdx = cIdx;
        headerRowIdx = r;
      } else if (text.length < 30 && (text.includes('KUNCI') || text.includes('JAWABAN') || text.includes('ANS'))) {
        colKunciIdx = cIdx;
      } else if (text.length < 30 && (text.includes('BOBOT') || text.includes('NILAI'))) {
        colBobotIdx = cIdx;
      } else {
        const optMatch = text.match(/^(?:PIL|PILIHAN|OPSI)?\s*([A-E])$/i);
        if (optMatch) {
          colOptIndices[optMatch[1].toUpperCase()] = cIdx;
        }
      }
    });

    if (colSoalIdx !== -1) break;
  }

  if (colSoalIdx === -1 && rows.length > 0) {
    const sampleCells = Array.from(rows[0].querySelectorAll('td, th'));
    if (sampleCells.length >= 4) {
      colSoalIdx = 1;
      const numCells = sampleCells.length;
      colKunciIdx = numCells - 1;
      let optLetter = 'A';
      for (let c = 2; c < numCells - 1; c++) {
        colOptIndices[optLetter] = c;
        optLetter = String.fromCharCode(optLetter.charCodeAt(0) + 1);
      }
      headerRowIdx = -1;
    } else {
      return [];
    }
  }

  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  for (let r = startRow; r < rows.length; r++) {
    const cells = Array.from(rows[r].querySelectorAll('td, th')).map((c) => (c.textContent || '').trim());
    if (cells.length <= colSoalIdx) continue;

    const questionText = cells[colSoalIdx];
    if (!questionText || questionText.toUpperCase().startsWith('SOAL')) continue;

    const kunciVal = colKunciIdx >= 0 && cells[colKunciIdx] ? cells[colKunciIdx].trim() : '';

    const rawOptions: { letter: string; text: string; isCorrect: boolean }[] = [];

    Object.keys(colOptIndices)
      .sort()
      .forEach((letter) => {
        const cIdx = colOptIndices[letter];
        if (cIdx < cells.length && cells[cIdx]) {
          const text = cells[cIdx];
          rawOptions.push({
            letter,
            text,
            isCorrect: kunciVal.toUpperCase().includes(letter),
          });
        }
      });

    let weight = 10;
    if (colBobotIdx >= 0 && cells[colBobotIdx]) {
      const parsedW = parseInt(cells[colBobotIdx], 10);
      if (!isNaN(parsedW)) weight = parsedW;
    }

    if (questionText) {
      const qObj: Partial<Question> = {
        type: 'pilihan_ganda',
        category: 'Literasi',
        cognitiveLevel: 'Aplikasi (L2)',
        difficulty: 'Sedang',
        weight,
        questionText,
        createdAt: new Date().toISOString(),
      };
      questions.push(processFinalQuestion(qObj, rawOptions, kunciVal));
    }
  }

  return questions;
}

/**
 * Parses vertical CBT table format (Word Macro layout)
 */
function parseVerticalCbtTable(rows: HTMLElement[], docxData?: DocxArchiveData): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  let currentQ: Partial<Question> | null = null;
  let rawOptions: { letter: string; text: string; isCorrect: boolean }[] = [];
  let kunciText = '';
  let consumedImageIndex = 0;

  const finalizeCurrentQ = () => {
    if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
      const processed = processFinalQuestion(currentQ, rawOptions, kunciText);
      questions.push(processed);
    }
    currentQ = null;
    rawOptions = [];
    kunciText = '';
  };

  const ensureCurrentQ = () => {
    if (!currentQ) {
      currentQ = {
        type: 'pilihan_ganda',
        category: 'Literasi',
        cognitiveLevel: 'Aplikasi (L2)',
        difficulty: 'Sedang',
        weight: 10,
        questionText: '',
        createdAt: new Date().toISOString(),
      };
    }
  };

  rows.forEach((row, rIdx) => {
    const rawCells = Array.from(row.querySelectorAll('td, th'));
    if (rawCells.length < 1) return;

    const col1Raw = (rawCells[0].textContent || '').trim();
    const col2Raw = rawCells.length > 1 ? extractCellContent(rawCells[1], docxData) : extractCellContent(rawCells[0], docxData);
    const col1Clean = col1Raw.toUpperCase().replace(/[\.\:\)\s]+$/, '').trim();

    const numMatch =
      col1Clean.match(/^(?:SOAL|NO|NOMOR|QUESTION|PERTANYAAN)?\s*(?:NO|NOMOR|\.)?\s*(\d+)$/i) ||
      col1Raw.trim().match(/^(?:SOAL|NO|NOMOR|QUESTION|PERTANYAAN)?\s*(\d+)[\.\:\)]?$/i);

    const isSoalHeader =
      numMatch ||
      col1Clean === 'SOAL' ||
      col1Clean === 'PERTANYAAN' ||
      col1Clean === 'QUESTION' ||
      col1Clean === 'NO' ||
      col1Clean === 'NOMOR';

    const optMatch = col1Clean.match(/^[\*\(\[\>]*\s*(?:PIL|PILIHAN|OPSI)?\s*([A-Ea-e])[\.\:\)\]]*$/i);

    const isKunci =
      col1Clean.includes('KUNCI') ||
      col1Clean.includes('JAWABAN') ||
      col1Clean.includes('ANS') ||
      col1Clean.includes('KEY');
    const isPembahasan =
      col1Clean.includes('PEMBAHASAN') ||
      col1Clean.includes('DISCUSSION') ||
      col1Clean.includes('PENJELASAN');
    const isStimulus =
      col1Clean.includes('STIMULUS') || col1Clean.includes('TEKS') || col1Clean.includes('BACAAN');
    const isStimulusGambar =
      col1Clean.includes('STIMULUS_GAMBAR') ||
      col1Clean.includes('GAMBAR_STIMULUS') ||
      col1Clean.includes('IMAGE_STIMULUS') ||
      col1Clean.includes('STIMULUS_FOTO');
    const isStimulusAudio =
      col1Clean.includes('STIMULUS_AUDIO') ||
      col1Clean.includes('AUDIO_STIMULUS') ||
      col1Clean.includes('SOUND_STIMULUS');
    const isAudio =
      col1Clean.includes('AUDIO') || col1Clean.includes('SUARA') || col1Clean.includes('SOUND');
    const isGambar =
      col1Clean.includes('GAMBAR') || col1Clean.includes('FOTO') || col1Clean.includes('IMAGE');
    const isTipe = col1Clean.includes('TIPE') || col1Clean.includes('JENIS');
    const isKategori = col1Clean.includes('KATEGORI') || col1Clean.includes('AKM');
    const isBobot = col1Clean.includes('BOBOT') || col1Clean.includes('NILAI');

    if (isSoalHeader) {
      if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
        finalizeCurrentQ();
      }
      ensureCurrentQ();
      const col2PlainText = rawCells.length > 1 ? rawCells[1].textContent || '' : col1Raw;
      if (col2Raw && col2PlainText.trim().toUpperCase() !== 'SOAL') {
        currentQ.questionText = col2Raw;
      }
    } else if (optMatch) {
      ensureCurrentQ();
      let optText = rawCells.length > 1 ? extractCellContent(rawCells[1], docxData) : col2Raw;
      let isCorrect = false;

      if (col1Raw.startsWith('*') || optText.startsWith('*')) {
        optText = optText.replace(/^\*/, '').trim();
        isCorrect = true;
      } else if (/\(kunci\)/i.test(optText) || /\[v\]/i.test(optText) || /\[kunci\]/i.test(optText)) {
        optText = optText
          .replace(/\(kunci\)/gi, '')
          .replace(/\[v\]/gi, '')
          .replace(/\[kunci\]/gi, '')
          .trim();
        isCorrect = true;
      }

      rawOptions.push({
        letter: optMatch[1].toUpperCase(),
        text: optText,
        isCorrect,
      });
    } else if (isKunci) {
      ensureCurrentQ();
      kunciText = (rawCells.length > 1 ? rawCells[1].textContent : col2Raw) || '';
    } else if (isPembahasan) {
      ensureCurrentQ();
      currentQ.discussion = col2Raw;
    } else if (isStimulusGambar || (isGambar && !isSoalHeader)) {
      ensureCurrentQ();
      const cellNode = rawCells.length > 1 ? rawCells[1] : rawCells[0];
      let imgSrc = getCleanImageSrc(extractImageSrcFromCell(cellNode, col2Raw, docxData));

      // If not valid yet, check if cell has an XML mapped drawing image
      if (!isValidImageSrc(imgSrc) && docxData) {
        const cellXmlImg = docxData.cellImages.get(`row_${rIdx}`) || docxData.cellImages.get(`r_${rIdx}_c_1`);
        if (cellXmlImg) {
          imgSrc = cellXmlImg;
        } else if (docxData.orderedImages.length > consumedImageIndex) {
          imgSrc = docxData.orderedImages[consumedImageIndex];
          consumedImageIndex++;
        }
      }

      if (isValidImageSrc(imgSrc)) {
        currentQ.stimulus = { type: 'image', content: imgSrc };
      } else if (isLocalWordImagePath(imgSrc) || isLocalWordImagePath(col2Raw)) {
        currentQ.stimulus = { type: 'image', content: imgSrc || col2Raw };
      } else if (col2Raw && col2Raw.trim()) {
        currentQ.stimulus = { type: 'text', content: col2Raw };
      }
    } else if (isStimulusAudio || (isAudio && !isSoalHeader)) {
      ensureCurrentQ();
      const cellNode = rawCells.length > 1 ? rawCells[1] : rawCells[0];
      const audioSrc = getCleanMediaSrc(extractAudioSrcFromCell(cellNode, col2Raw));
      if (audioSrc) {
        currentQ.stimulus = { type: 'audio', content: audioSrc };
        if (isAudio) currentQ.type = 'pilihan_audio';
      }
    } else if (isStimulus) {
      ensureCurrentQ();
      const cellNode = rawCells.length > 1 ? rawCells[1] : rawCells[0];
      let imgSrc = getCleanImageSrc(extractImageSrcFromCell(cellNode, '', docxData));

      if (!isValidImageSrc(imgSrc) && docxData) {
        const cellXmlImg = docxData.cellImages.get(`row_${rIdx}`) || docxData.cellImages.get(`r_${rIdx}_c_1`);
        if (cellXmlImg) {
          imgSrc = cellXmlImg;
        }
      }

      if (isValidImageSrc(imgSrc)) {
        currentQ.stimulus = { type: 'image', content: imgSrc };
      } else if (col2Raw && col2Raw.trim()) {
        currentQ.stimulus = { type: 'text', content: col2Raw };
      }
    } else if (isTipe) {
      ensureCurrentQ();
      const typeStr = col2Raw.toLowerCase();
      if (typeStr.includes('kompleks')) currentQ.type = 'pg_kompleks';
      else if (typeStr.includes('benar') || typeStr.includes('salah')) currentQ.type = 'benar_salah';
      else if (typeStr.includes('setuju')) currentQ.type = 'setuju_tidak_setuju';
      else if (typeStr.includes('jodoh') || typeStr.includes('pasang')) currentQ.type = 'menjodohkan';
      else if (typeStr.includes('drag') || typeStr.includes('drop')) currentQ.type = 'drag_drop';
      else if (typeStr.includes('urut')) currentQ.type = 'mengurutkan';
      else if (typeStr.includes('check') || typeStr.includes('centang')) currentQ.type = 'checklist';
      else if (typeStr.includes('lengkapi') || typeStr.includes('kalimat')) currentQ.type = 'melengkapi_kalimat';
      else if (typeStr.includes('angka')) currentQ.type = 'isian_angka';
      else if (typeStr.includes('isian')) currentQ.type = 'isian_singkat';
      else if (typeStr.includes('uraian') && typeStr.includes('panjang')) currentQ.type = 'uraian_panjang';
      else if (typeStr.includes('uraian') || typeStr.includes('esai') || typeStr.includes('essay')) currentQ.type = 'uraian_pendek';
      else if (typeStr.includes('audio')) currentQ.type = 'pilihan_audio';
      else if (typeStr.includes('video')) currentQ.type = 'pilihan_video';
      else if (typeStr.includes('gambar')) currentQ.type = 'pilihan_gambar';
      (currentQ as any).isTypeExplicit = true;
    } else if (isKategori) {
      ensureCurrentQ();
      const catStr = col2Raw.toLowerCase();
      if (catStr.includes('num')) currentQ.category = 'Numerasi';
      else if (catStr.includes('sain')) currentQ.category = 'Sains';
      else if (catStr.includes('sosial') || catStr.includes('budaya')) currentQ.category = 'Sosial Budaya';
      else currentQ.category = 'Literasi';
    } else if (isBobot) {
      ensureCurrentQ();
      const parsedW = parseInt(col2Raw, 10);
      if (!isNaN(parsedW)) currentQ.weight = parsedW;
    } else if (currentQ) {
      // Append text to question text if not already populated
      if (col2Raw && !currentQ.questionText) {
        currentQ.questionText = col2Raw;
      }
    }
  });

  finalizeCurrentQ();
  return questions;
}

/**
 * Parses questions from HTML elements (paragraphs, headers, lists)
 */
function parseFromHtmlElements(doc: Document, docxData?: DocxArchiveData): Partial<Question>[] {
  const container = doc.body;
  const elements = Array.from(container.children);
  const questions: Partial<Question>[] = [];
  let currentQ: Partial<Question> | null = null;
  let rawOptions: { letter: string; text: string; isCorrect: boolean }[] = [];
  let kunciText = '';
  let pendingStimulus = '';

  const finalizeCurrentQ = () => {
    if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
      const processed = processFinalQuestion(currentQ, rawOptions, kunciText);
      questions.push(processed);
    }
    currentQ = null;
    rawOptions = [];
    kunciText = '';
  };

  const ensureCurrentQ = () => {
    if (!currentQ) {
      currentQ = {
        type: 'pilihan_ganda',
        category: 'Literasi',
        cognitiveLevel: 'Aplikasi (L2)',
        difficulty: 'Sedang',
        weight: 10,
        questionText: '',
        stimulus: pendingStimulus ? { type: 'text', content: pendingStimulus } : undefined,
        createdAt: new Date().toISOString(),
      };
      pendingStimulus = '';
    }
  };

  elements.forEach((el) => {
    const text = (el.textContent || '').trim();
    if (!text && !el.querySelector('img')) return;

    const qNumMatch = text.match(/^(?:Soal|No|Nomor|Pertanyaan)?\s*(\d+)[\.\:\)]\s*(.*)/i);
    const optMatch = text.match(/^([\*\#\>])?\s*([A-Ea-e])[\.\:\)]\s*(.*)/i);
    const kunciMatch = text.match(/^(?:KUNCI JAWABAN|KUNCI|JAWABAN|ANS|KEY)\s*[\:\=\-]?\s*(.*)/i);
    const tipeMatch = text.match(/^(?:TIPE|JENIS SOAL|TIPE SOAL)\s*[\:\=\-]?\s*(.*)/i);
    const pembahasanMatch = text.match(/^(?:PEMBAHASAN|ALASAN|DISCUSSION|PENJELASAN)\s*[\:\=\-]?\s*(.*)/i);
    const stimulusMatch = text.match(/^(?:STIMULUS|TEKS BACAAN|BACAAN)\s*[\:\=\-]?\s*(.*)/i);

    if (stimulusMatch) {
      pendingStimulus = stimulusMatch[1] || text;
      if (currentQ) {
        currentQ.stimulus = { type: 'text', content: pendingStimulus };
      }
    } else if (qNumMatch) {
      finalizeCurrentQ();
      ensureCurrentQ();
      currentQ!.questionText = qNumMatch[2] || extractCellContent(el, docxData);
    } else if (tipeMatch && currentQ) {
      const typeStr = (tipeMatch[1] || '').toLowerCase();
      if (typeStr.includes('kompleks')) currentQ.type = 'pg_kompleks';
      else if (typeStr.includes('benar') || typeStr.includes('salah')) currentQ.type = 'benar_salah';
      else if (typeStr.includes('setuju')) currentQ.type = 'setuju_tidak_setuju';
      else if (typeStr.includes('jodoh')) currentQ.type = 'menjodohkan';
      else if (typeStr.includes('isian')) currentQ.type = 'isian_singkat';
      else if (typeStr.includes('uraian')) currentQ.type = 'uraian_pendek';
    } else if (optMatch && currentQ) {
      let optionText = optMatch[3] || extractCellContent(el, docxData);
      let isCorrect = false;

      if (optMatch[1] || optionText.startsWith('*')) {
        if (optionText.startsWith('*')) optionText = optionText.substring(1).trim();
        isCorrect = true;
      }

      rawOptions.push({
        letter: optMatch[2].toUpperCase(),
        text: optionText,
        isCorrect,
      });
    } else if (kunciMatch && currentQ) {
      kunciText = kunciMatch[1] || '';
    } else if (pembahasanMatch && currentQ) {
      currentQ.discussion = pembahasanMatch[1] || extractCellContent(el, docxData);
    } else if (currentQ) {
      if (rawOptions.length === 0) {
        currentQ.questionText = (currentQ.questionText ? currentQ.questionText + '\n' : '') + extractCellContent(el, docxData);
      }
    }
  });

  finalizeCurrentQ();
  return questions;
}

/**
 * Parses questions from plain text lines
 */
function parseFromLines(lines: string[]): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  let currentQ: Partial<Question> | null = null;
  let rawOptions: { letter: string; text: string; isCorrect: boolean }[] = [];
  let kunciText = '';
  let pendingStimulus = '';

  const finalizeCurrentQ = () => {
    if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
      const processed = processFinalQuestion(currentQ, rawOptions, kunciText);
      questions.push(processed);
    }
    currentQ = null;
    rawOptions = [];
    kunciText = '';
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const qNumMatch = trimmed.match(/^(?:Soal|No|Nomor|Pertanyaan)?\s*(\d+)[\.\:\)]\s*(.*)/i);
    const optMatch = trimmed.match(/^([\*\#\>])?\s*([A-Ea-e])[\.\:\)]\s*(.*)/i);
    const kunciMatch = trimmed.match(
      /^(?:KUNCI JAWABAN|KUNCI|JAWABAN|ANS|KEY)\s*[\:\=\-]?\s*(.*)/i
    );
    const tipeMatch = trimmed.match(/^(?:TIPE|JENIS SOAL|TIPE SOAL)\s*[\:\=\-]?\s*(.*)/i);
    const pembahasanMatch = trimmed.match(
      /^(?:PEMBAHASAN|ALASAN|DISCUSSION|PENJELASAN)\s*[\:\=\-]?\s*(.*)/i
    );
    const stimulusMatch = trimmed.match(/^(?:STIMULUS|TEKS BACAAN|BACAAN)\s*[\:\=\-]?\s*(.*)/i);
    const kategoriMatch = trimmed.match(/^(?:KATEGORI|AKM)\s*[\:\=\-]?\s*(.*)/i);

    if (stimulusMatch) {
      pendingStimulus = stimulusMatch[1] || trimmed;
      if (currentQ) {
        currentQ.stimulus = { type: 'text', content: pendingStimulus };
      }
    } else if (qNumMatch) {
      finalizeCurrentQ();
      currentQ = {
        type: 'pilihan_ganda',
        category: 'Literasi',
        cognitiveLevel: 'Aplikasi (L2)',
        difficulty: 'Sedang',
        weight: 10,
        questionText: qNumMatch[2] || '',
        stimulus: pendingStimulus ? { type: 'text', content: pendingStimulus } : undefined,
        createdAt: new Date().toISOString(),
      };
      pendingStimulus = '';
    } else if (tipeMatch && currentQ) {
      const typeStr = (tipeMatch[1] || '').toLowerCase();
      if (typeStr.includes('kompleks')) currentQ.type = 'pg_kompleks';
      else if (typeStr.includes('benar') || typeStr.includes('salah')) currentQ.type = 'benar_salah';
      else if (typeStr.includes('setuju')) currentQ.type = 'setuju_tidak_setuju';
      else if (typeStr.includes('jodoh')) currentQ.type = 'menjodohkan';
      else if (typeStr.includes('isian')) currentQ.type = 'isian_singkat';
      else if (typeStr.includes('uraian')) currentQ.type = 'uraian_pendek';
    } else if (optMatch && currentQ) {
      let optionText = optMatch[3] || '';
      let isCorrect = false;

      if (optMatch[1] || optionText.startsWith('*')) {
        if (optionText.startsWith('*')) optionText = optionText.substring(1).trim();
        isCorrect = true;
      } else if (/\(kunci\)/i.test(optionText) || /\[v\]/i.test(optionText)) {
        optionText = optionText.replace(/\(kunci\)/gi, '').replace(/\[v\]/gi, '').trim();
        isCorrect = true;
      }

      rawOptions.push({
        letter: optMatch[2].toUpperCase(),
        text: optionText,
        isCorrect,
      });
    } else if (kunciMatch && currentQ) {
      kunciText = kunciMatch[1] || '';
    } else if (pembahasanMatch && currentQ) {
      currentQ.discussion = pembahasanMatch[1] || '';
    } else if (kategoriMatch && currentQ) {
      const catVal = kategoriMatch[1].toLowerCase();
      if (catVal.includes('num')) currentQ.category = 'Numerasi';
      else if (catVal.includes('sain')) currentQ.category = 'Sains';
      else if (catVal.includes('sosial')) currentQ.category = 'Sosial Budaya';
      else currentQ.category = 'Literasi';
    } else if (currentQ) {
      if (rawOptions.length === 0) {
        currentQ.questionText = (currentQ.questionText ? currentQ.questionText + '\n' : '') + trimmed;
      } else {
        const lastOpt = rawOptions[rawOptions.length - 1];
        if (lastOpt) {
          lastOpt.text += ' ' + trimmed;
        }
      }
    }
  });

  finalizeCurrentQ();
  return questions;
}

/**
 * Downloads Word template matching Word Macro CBT Standard with full support for all AKM question types
 */
export function downloadWordTemplate() {
  const htmlContent = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>TEMPLATE SOAL TKA &amp; CBT WORD MACRO</title>
<style>
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }
  .title-header { font-size: 16pt; font-weight: bold; margin-bottom: 12px; color: #1e3a8a; text-transform: uppercase; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 25px; font-size: 11pt; }
  td, th { border: 1px solid #000000; padding: 6px 10px; vertical-align: top; }
  .col-no { width: 110px; font-weight: bold; background-color: #f1f5f9; text-align: left; }
  .col-text { vertical-align: top; }
  .info-box { background-color: #f8fafc; border: 2px solid #2563eb; padding: 12px; margin-bottom: 20px; font-size: 10pt; border-radius: 6px; }
  .section-tag { font-weight: bold; color: #2563eb; margin-top: 15px; margin-bottom: 5px; font-size: 12pt; }
</style>
</head>
<body>

<div class="title-header">TEMPLATE SOAL TKA &amp; CBT WORD MACRO STANDARD</div>

<div class="info-box">
  <b style="font-size: 11pt; color: #1e3a8a;">PETUNJUK FORMAT TEMPLATE SOAL TKA WORD (SUPPORT GAMBAR &amp; AUDIO):</b><br/><br/>
  1. <b>Format Tabel</b>: Setiap soal ditulis dalam bentuk <b>Tabel 2 Kolom Continuous</b>.<br/>
  2. <b>Kolom Kiri</b>: Berisi Nomor Soal (<code>1.</code>, <code>2.</code>, dst), Huruf Pilihan (<code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, <code>E</code>), atau Tag Metadata (<code>TIPE</code>, <code>KATEGORI</code>, <code>BOBOT</code>, <code>STIMULUS</code>, <code>STIMULUS_GAMBAR</code>, <code>STIMULUS_AUDIO</code>, <code>KUNCI</code>, <code>PEMBAHASAN</code>).<br/>
  3. <b>Dukungan Media Gambar &amp; Audio</b>:<br/>
     - <b>Gambar pada Soal / Opsi</b>: Sisipkan/Insert gambar langsung ke dalam sel tabel Word (Gunakan menu <b>Insert &gt; Picture</b>) <i>ATAU</i> tulis tag <code>STIMULUS_GAMBAR</code> dengan isi URL/Link gambar.<br/>
     - <b>Penting</b>: Setelah mengedit, simpan file sebagai <b>Word Document (*.docx)</b> agar gambar tersimpan secara permanen di dalam file dokumen.<br/>
     - <b>Audio Listening / MP3</b>: Tulis tag <code>STIMULUS_AUDIO</code> dengan isi URL audio (contoh: <code>https://example.com/audio.mp3</code>) <i>ATAU</i> set <code>TIPE</code> = <code>Pilihan Audio</code>.<br/>
  4. <b>Dukungan Tipe Soal AKM</b>:<br/>
     - <b>Pilihan Ganda</b>: <code>KUNCI</code> diisi 1 huruf (contoh: <code>B</code>).<br/>
     - <b>Pilihan Ganda Kompleks</b>: <code>TIPE</code> diisi <code>Pilihan Ganda Kompleks</code>, <code>KUNCI</code> diisi huruf terpisah koma (contoh: <code>A, C, D</code>).<br/>
     - <b>Benar Salah</b>: <code>TIPE</code> diisi <code>Benar Salah</code>, <code>KUNCI</code> diisi status per baris (contoh: <code>BENAR, SALAH, BENAR</code> atau <code>B, S, B</code>).<br/>
     - <b>Menjodohkan</b>: <code>TIPE</code> diisi <code>Menjodohkan</code>, baris pilihan berisi <code>Teks Kiri = Teks Kanan</code>.<br/>
     - <b>Isian Singkat</b>: <code>TIPE</code> diisi <code>Isian Singkat</code>, <code>KUNCI</code> diisi teks jawaban singkat.<br/>
</div>

<div class="section-tag">CONTOH 1: PILIHAN GANDA (SINGLE CHOICE)</div>
<table>
  <tr>
    <td class="col-no">1.</td>
    <td class="col-text">
      <b>UNTUK SOAL 1 - 5</b><br/>
      <b>Literasi Digital bagi Pelajar</b><br/>
      Perkembangan teknologi digital memberikan kemudahan bagi pelajar dalam memperoleh informasi. Melalui internet, siswa dapat mengakses buku elektronik, video pembelajaran, dan berbagai sumber pengetahuan lainnya. Namun, kemudahan tersebut harus diimbangi dengan kemampuan memilih informasi yang benar. Tidak semua informasi di internet dapat dipercaya. Oleh karena itu, pelajar perlu memeriksa sumber, membandingkan informasi, dan memastikan kebenaran berita sebelum menyebarkannya. Sikap kritis dalam menggunakan teknologi dapat membantu pelajar terhindar dari informasi palsu.<br/><br/>
      <i>Apa gagasan utama paragraf tersebut?</i>
    </td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Internet merupakan sumber informasi yang paling lengkap.</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Pelajar harus menggunakan teknologi digital secara kritis dan bijak.</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Buku elektronik lebih bermanfaat daripada buku cetak.</td>
  </tr>
  <tr>
    <td class="col-no">D</td>
    <td class="col-text">Semua informasi yang ada di internet dapat digunakan oleh pelajar.</td>
  </tr>
  <tr>
    <td class="col-no">E</td>
    <td class="col-text">Teknologi digital membuat pelajar lebih mudah menyebarkan berita.</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">B</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">Gagasan utama adalah ide pokok yang menjadi dasar pembahasan dalam teks. Teks membahas manfaat teknologi digital sekaligus pentingnya menggunakan teknologi secara bijak. Pelajar tidak boleh langsung percaya terhadap semua informasi di internet, tetapi harus memeriksa dan membandingkan informasi terlebih dahulu. Jadi, jawaban yang tepat adalah B.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 2: PILIHAN GANDA KOMPLEKS (MULTIPLE CHOICE)</div>
<table>
  <tr>
    <td class="col-no">2.</td>
    <td class="col-text">Pilihlah semua pernyataan yang sesuai dengan isi teks!</td>
  </tr>
  <tr>
    <td class="col-no">TIPE</td>
    <td class="col-text">Pilihan Ganda Kompleks</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Internet memberikan kemudahan bagi pelajar dalam memperoleh informasi.</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Semua informasi di internet dapat dipercaya.</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Pelajar perlu memeriksa sumber informasi sebelum menyebarkannya.</td>
  </tr>
  <tr>
    <td class="col-no">D</td>
    <td class="col-text">Membandingkan informasi dapat membantu memastikan kebenaran berita.</td>
  </tr>
  <tr>
    <td class="col-no">E</td>
    <td class="col-text">Sikap kritis tidak diperlukan dalam menggunakan teknologi digital.</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">A, C, D</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">A benar: Pada kalimat pertama disebutkan bahwa teknologi digital memberikan kemudahan bagi pelajar dalam memperoleh informasi.<br/>B salah: Teks secara jelas menyatakan bahwa tidak semua informasi di internet dapat dipercaya.<br/>C benar: Pelajar dianjurkan memeriksa sumber sebelum menyebarkan informasi.<br/>D benar: Teks menyebutkan bahwa pelajar perlu membandingkan informasi untuk memastikan kebenarannya.<br/>E salah: Justru sikap kritis diperlukan agar pelajar dapat terhindar dari informasi palsu.<br/>Jadi, jawaban yang benar adalah A, C, dan D.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 3: BENAR SALAH</div>
<table>
  <tr>
    <td class="col-no">3.</td>
    <td class="col-text">Tentukan apakah pernyataan berikut benar atau salah berdasarkan teks!</td>
  </tr>
  <tr>
    <td class="col-no">TIPE</td>
    <td class="col-text">Benar Salah</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Perkembangan teknologi digital memudahkan pelajar memperoleh informasi.</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Semua informasi yang terdapat di internet dapat dipercaya.</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Pelajar perlu membandingkan informasi sebelum menyebarkannya.</td>
  </tr>
  <tr>
    <td class="col-no">D</td>
    <td class="col-text">Sikap kritis dapat membantu pelajar terhindar dari informasi palsu.</td>
  </tr>
  <tr>
    <td class="col-no">E</td>
    <td class="col-text">Pelajar tidak perlu memeriksa sumber berita yang diperoleh dari internet.</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">BENAR, SALAH, BENAR, BENAR, SALAH</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">1. Benar: Sesuai dengan kalimat awal teks bahwa teknologi digital memberikan kemudahan dalam memperoleh informasi.<br/>2. Salah: Teks menyatakan bahwa tidak semua informasi di internet dapat dipercaya.<br/>3. Benar: Pelajar perlu membandingkan informasi sebelum memastikan dan menyebarkannya.<br/>4. Benar: Sikap kritis membantu pelajar terhindar dari informasi palsu.<br/>5. Salah: Justru pelajar perlu memeriksa sumber sebelum menyebarkan berita.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 4: MENJODOHKAN (PENJODOHAN DENGAN GARIS)</div>
<table>
  <tr>
    <td class="col-no">4.</td>
    <td class="col-text">Jodohkan pernyataan pada kolom A dengan jawaban yang tepat pada kolom B!</td>
  </tr>
  <tr>
    <td class="col-no">TIPE</td>
    <td class="col-text">Menjodohkan</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Membimbing siswa memilih informasi = Manfaat teknologi digital bagi siswa</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Mengakses sumber belajar dengan cepat = Dampak positif akses internet</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Ketergantungan pada internet = Hal yang perlu dikontrol dalam penggunaan</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">1-D, 2-C, 3-B, 4-E, 5-A</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">Pasangan pernyataan dan jawabannya sudah tepat sesuai isi teks bacaan.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 5: ISIAN SINGKAT</div>
<table>
  <tr>
    <td class="col-no">5.</td>
    <td class="col-text">Lengkapilah kalimat berikut berdasarkan teks!<br/>Pelajar perlu memeriksa sumber, membandingkan informasi, dan memastikan ________ berita sebelum menyebarkannya.</td>
  </tr>
  <tr>
    <td class="col-no">TIPE</td>
    <td class="col-text">Isian Singkat</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">kebenaran</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">Kalimat tersebut terdapat dalam teks: "Pelajar perlu memeriksa sumber, membandingkan informasi, dan memastikan kebenaran berita sebelum menyebarkannya." Kata yang tepat untuk melengkapi kalimat adalah kebenaran, karena pelajar harus memastikan bahwa berita yang akan disebarkan benar dan dapat dipercaya.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 6: SOAL DENGAN STIMULUS GAMBAR</div>
<table>
  <tr>
    <td class="col-no">6.</td>
    <td class="col-text">Berdasarkan diagram/gambar di bawah, komponen utama yang berfungsi mengolah data adalah?</td>
  </tr>
  <tr>
    <td class="col-no">STIMULUS_GAMBAR</td>
    <td class="col-text">https://images.unsplash.com/photo-1518770660439-4636190af475?w=500</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Sains</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Central Processing Unit (CPU)</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Random Access Memory (RAM)</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Hard Disk Drive (HDD)</td>
  </tr>
  <tr>
    <td class="col-no">D</td>
    <td class="col-text">Power Supply Unit (PSU)</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">A</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">CPU adalah pemroses utama dalam sistem komputer. Catatan: Gambar juga dapat langsung di-Insert ke dalam sel Word.</td>
  </tr>
</table>

<div class="section-tag">CONTOH 7: SOAL LISTENING (STIMULUS AUDIO)</div>
<table>
  <tr>
    <td class="col-no">7.</td>
    <td class="col-text">Dengarkan petikan percakapan audio di bawah ini. Apakah topik utama percakapan tersebut?</td>
  </tr>
  <tr>
    <td class="col-no">STIMULUS_AUDIO</td>
    <td class="col-text">https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg</td>
  </tr>
  <tr>
    <td class="col-no">TIPE</td>
    <td class="col-text">Pilihan Audio</td>
  </tr>
  <tr>
    <td class="col-no">KATEGORI</td>
    <td class="col-text">Literasi</td>
  </tr>
  <tr>
    <td class="col-no">BOBOT</td>
    <td class="col-text">20</td>
  </tr>
  <tr>
    <td class="col-no">A</td>
    <td class="col-text">Kondisi cuaca hujan deras</td>
  </tr>
  <tr>
    <td class="col-no">B</td>
    <td class="col-text">Suara lalu lintas di kota</td>
  </tr>
  <tr>
    <td class="col-no">C</td>
    <td class="col-text">Suara ombak di pantai</td>
  </tr>
  <tr>
    <td class="col-no">D</td>
    <td class="col-text">Persiapan kegiatan outdoor</td>
  </tr>
  <tr>
    <td class="col-no">KUNCI</td>
    <td class="col-text">A</td>
  </tr>
  <tr>
    <td class="col-no">PEMBAHASAN</td>
    <td class="col-text">Audio di atas berisi rekaman suara suasana hujan deras. Jawaban yang tepat adalah A.</td>
  </tr>
</table>

</body>
</html>
  `.trim();

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Soal_TKA_CBT_Word_Macro.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
