import mammoth from 'mammoth';
import { Question, QuestionType } from '../types';
import { normalizeMatchingPairs } from './questionUtils';

/**
 * Helper to process and format a question based on its specified type or auto-detected type from KUNCI / options.
 * Handles: pilihan_ganda, pg_kompleks, menjodohkan, benar_salah, setuju_tidak_setuju, isian_singkat, uraian_pendek, etc.
 */
function processFinalQuestion(
  q: Partial<Question>,
  rawOptions: { letter: string; text: string; isCorrect: boolean }[],
  kunciText: string
): Partial<Question> {
  const cleanKunci = (kunciText || '').trim();
  const upperKunci = cleanKunci.toUpperCase();

  // Auto-detect type if not explicitly set or if still default pilihan_ganda
  if (!q.type || q.type === 'pilihan_ganda') {
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
      /^(?:[A-E1-5]\s*[\-\:\=\>]\s*[A-E1-5]|(?:[A-E]\-[1-5]))/i.test(cleanKunci) ||
      rawOptions.some((o) => /[\=\-\>\|\:]/.test(o.text))
    ) {
      q.type = 'menjodohkan';
    } else if (cleanKunci.split(/[\,\;\s\+]+/).filter((x) => /^[A-E]$/i.test(x)).length > 1) {
      q.type = 'pg_kompleks';
    } else if (rawOptions.length === 0 && cleanKunci.length > 0) {
      q.type = 'isian_singkat';
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
      const matchDelimiter = opt.text.match(/^(.*?)\s*(?:[\=\>]|\=\>|\-\>|\||\:)\s*(.*)$/);
      if (matchDelimiter && matchDelimiter[1] && matchDelimiter[2]) {
        pairs.push({
          id: `pair_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          leftItem: matchDelimiter[1].trim(),
          rightItem: matchDelimiter[2].trim(),
        });
      } else {
        pairs.push({
          id: `pair_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
          leftItem: opt.text.trim(),
          rightItem: `Pasangan ${idx + 1}`,
        });
      }
    });

    // Parse explicit key pairs from KUNCI if present e.g. "A-1, B-2, C-3"
    if (pairs.length > 0 && cleanKunci) {
      const keyPairMatches = cleanKunci.split(/[\,\;\s]+/);
      keyPairMatches.forEach((kp) => {
        const m = kp.match(/([A-Ea-e])\s*[\-\:\=\>]\s*([A-Ea-e1-9]|.+)/);
        if (m) {
          const leftLetter = m[1].toUpperCase();
          const rightVal = m[2].trim();
          const leftIndex = leftLetter.charCodeAt(0) - 65;
          if (pairs[leftIndex]) {
            if (/^\d+$/.test(rightVal)) {
              const rightIdx = parseInt(rightVal, 10) - 1;
              if (rawOptions[rightIdx]) {
                const rightOptText = rawOptions[rightIdx].text;
                const rMatch = rightOptText.match(/^(.*?)\s*(?:[\=\>]|\=\>|\-\>|\||\:)\s*(.*)$/);
                pairs[leftIndex].rightItem = rMatch && rMatch[2] ? rMatch[2].trim() : rightOptText.trim();
              }
            } else {
              pairs[leftIndex].rightItem = rightVal;
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
              leftItem: 'Item Kiri 1',
              rightItem: 'Pasangan Kanan 1',
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
        text: opt.text,
        isCorrect,
      };
    });

    if (!options.some((o) => o.isCorrect) && options.length > 0) {
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

  // 1. Try Mammoth conversion for standard .docx files
  try {
    const arrayBuffer = await file.arrayBuffer();
    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: mammoth.images.imgElement((image) => {
          return image.read('base64').then((imageBuffer) => ({
            src: `data:${image.contentType};base64,${imageBuffer}`,
          }));
        }),
      }
    );
    const rawTextResult = await mammoth.extractRawText({ arrayBuffer });
    html = htmlResult.value || '';
    rawText = rawTextResult.value || '';
  } catch (mammothErr) {
    console.warn('Mammoth parsing note (file might be HTML/DOC text):', mammothErr);
  }

  // 2. Fallback: Read file as text if Mammoth returned empty (e.g. .doc, .html, or plain text template)
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

  // 3. Parse HTML content if available
  if (html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 3a. Try parsing HTML tables first
    const tables = Array.from(doc.querySelectorAll('table'));
    if (tables.length > 0) {
      const tableQuestions = parseFromHtmlTables(tables);
      if (tableQuestions.length > 0) {
        return tableQuestions;
      }
    }

    // 3b. Try parsing HTML paragraphs/elements
    const htmlQuestions = parseFromHtmlElements(doc);
    if (htmlQuestions.length > 0) {
      return htmlQuestions;
    }
  }

  // 4. Fallback to raw text line parsing
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
function extractCellContent(cell: Element): string {
  if (!cell) return '';
  const hasImg = cell.querySelector('img') !== null;
  const hasRich = cell.querySelector('p, table, ul, ol, li, b, i, u, sub, sup') !== null;

  if (hasImg || hasRich) {
    return cell.innerHTML.trim();
  }
  return (cell.textContent || '').trim();
}

/**
 * Parses questions from HTML tables (both Multi-column horizontal and CBT vertical tables)
 */
function parseFromHtmlTables(tables: HTMLTableElement[]): Partial<Question>[] {
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

  const verticalQuestions = parseVerticalCbtTable(allRows);
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

  // 1. A multi-column horizontal table MUST have at least 3 columns!
  const sampleCells = Array.from(rows[0].querySelectorAll('td, th'));
  if (sampleCells.length < 3) return [];

  // 2. Check if table contains CBT macro keys in Column 0
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
function parseVerticalCbtTable(rows: HTMLElement[]): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  let currentQ: Partial<Question> | null = null;
  let rawOptions: { letter: string; text: string; isCorrect: boolean }[] = [];
  let kunciText = '';

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

  rows.forEach((row) => {
    const rawCells = Array.from(row.querySelectorAll('td, th'));
    if (rawCells.length < 1) return;

    const col1Raw = (rawCells[0].textContent || '').trim();
    const col2Raw = rawCells.length > 1 ? extractCellContent(rawCells[1]) : extractCellContent(rawCells[0]);
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
    const isTipe = col1Clean.includes('TIPE') || col1Clean.includes('JENIS');
    const isKategori = col1Clean.includes('KATEGORI') || col1Clean.includes('AKM');
    const isBobot = col1Clean.includes('BOBOT') || col1Clean.includes('NILAI');

    if (isSoalHeader) {
      // If currentQ already has question text or options, this is a NEW question
      if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
        finalizeCurrentQ();
      }
      ensureCurrentQ();
      const col2PlainText = rawCells.length > 1 ? (rawCells[1].textContent || '') : col1Raw;
      if (col2Raw && col2PlainText.trim().toUpperCase() !== 'SOAL') {
        currentQ.questionText = col2Raw;
      }
    } else if (optMatch) {
      ensureCurrentQ();
      let optText = rawCells.length > 1 ? extractCellContent(rawCells[1]) : col2Raw;
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
    } else if (isStimulus) {
      ensureCurrentQ();
      currentQ.stimulus = { type: 'text', content: col2Raw };
    } else if (isTipe) {
      ensureCurrentQ();
      const typeStr = col2Raw.toLowerCase();
      if (typeStr.includes('kompleks')) currentQ.type = 'pg_kompleks';
      else if (typeStr.includes('benar') || typeStr.includes('salah')) currentQ.type = 'benar_salah';
      else if (typeStr.includes('setuju')) currentQ.type = 'setuju_tidak_setuju';
      else if (typeStr.includes('jodoh')) currentQ.type = 'menjodohkan';
      else if (typeStr.includes('isian')) currentQ.type = 'isian_singkat';
      else if (typeStr.includes('uraian')) currentQ.type = 'uraian_pendek';
      else if (typeStr.includes('angka')) currentQ.type = 'isian_angka';
      else if (typeStr.includes('urut')) currentQ.type = 'mengurutkan';
    } else if (isKategori) {
      ensureCurrentQ();
      const catStr = col2Raw.toLowerCase();
      if (catStr.includes('num')) currentQ.category = 'Numerasi';
      else if (catStr.includes('sain')) currentQ.category = 'Sains';
      else if (catStr.includes('sosial')) currentQ.category = 'Sosial Budaya';
      else currentQ.category = 'Literasi';
    } else if (isBobot) {
      ensureCurrentQ();
      const weightVal = parseInt((rawCells.length > 1 ? rawCells[1].textContent : col2Raw) || '10', 10);
      if (!isNaN(weightVal)) currentQ.weight = weightVal;
    } else if (col2Raw.trim() && !optMatch && !isKunci && !isPembahasan && !isStimulus) {
      ensureCurrentQ();
      if (!currentQ.questionText) {
        currentQ.questionText = col2Raw;
      } else if (rawOptions.length === 0) {
        currentQ.questionText += '<br/>' + col2Raw;
      }
    }
  });

  finalizeCurrentQ();
  return questions;
}

/**
 * Extract lines from HTML DOM nodes (p, div, li, tr)
 */
function parseFromHtmlElements(doc: Document): Partial<Question>[] {
  const lines: string[] = [];
  const nodes = doc.querySelectorAll('p, div, li, tr, h1, h2, h3, h4');

  nodes.forEach((node) => {
    const txt = (node.textContent || '').trim();
    if (txt) {
      lines.push(txt);
    }
  });

  return parseFromLines(lines);
}

/**
 * Universal line-by-line parser for standard text / paragraph formatted questions
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
  <b style="font-size: 11pt; color: #1e3a8a;">PETUNJUK FORMAT TEMPLATE SOAL TKA WORD:</b><br/><br/>
  1. <b>Format Tabel</b>: Setiap soal ditulis dalam bentuk <b>Tabel 2 Kolom Continuous</b>.<br/>
  2. <b>Kolom Kiri</b>: Berisi Nomor Soal (<code>1.</code>, <code>2.</code>, dst), Huruf Pilihan (<code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, <code>E</code>), atau Tag Metadata (<code>TIPE</code>, <code>KATEGORI</code>, <code>BOBOT</code>, <code>STIMULUS</code>, <code>KUNCI</code>, <code>PEMBAHASAN</code>).<br/>
  3. <b>Kolom Kanan</b>: Berisi Teks Pertanyaan, Teks Pilihan/Pernyataan, Nilai Kunci Jawaban, dan Pembahasan.<br/>
  4. <b>Dukungan Tipe Soal</b>:<br/>
     - <b>Pilihan Ganda</b>: <code>KUNCI</code> diisi 1 huruf pilihan (contoh: <code>B</code>).<br/>
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

</body>
</html>
  `.trim();

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Soal_BAHASA_INDONESIA_1_Word_Macro_CBT.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

