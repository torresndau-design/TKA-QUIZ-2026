import mammoth from 'mammoth';
import { Question } from '../types';

export function downloadWordTemplate() {
  const blob = new Blob(
    [
      `TEMPLATE SOAL CBT MACRO\n======================\nFormat Tabel 2 Kolom:\n- Kolom 1: SOAL / PILIHAN (A-E) / KUNCI / PEMBAHASAN / STIMULUS / TIPE / KATEGORI / BOBOT\n- Kolom 2: Isi Teks atau Gambar\n`,
    ],
    { type: 'text/plain;charset=utf-8' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Soal_Word.txt';
  a.click();
  URL.revokeObjectURL(url);
}

function extractCellHtmlOrText(cell: HTMLElement): string {
  if (!cell) return '';

  const hasImages = cell.querySelector('img') !== null;
  if (hasImages) {
    const clone = cell.cloneNode(true) as HTMLElement;
    const paragraphs = Array.from(clone.querySelectorAll('p, div'));
    paragraphs.forEach((p) => {
      p.insertAdjacentHTML('beforeend', '<br/>');
    });

    const imgs = Array.from(clone.querySelectorAll('img'));
    imgs.forEach((img) => {
      img.removeAttribute('style');
      img.setAttribute(
        'class',
        'max-h-80 my-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm inline-block object-contain'
      );
    });

    let html = clone.innerHTML.trim();
    html = html.replace(/(<br\s*\/?>\s*){3,}/gi, '<br/><br/>');
    return html;
  }

  return (cell.textContent || '').trim();
}

export async function parseQuestionsFromWord(file: File): Promise<Question[]> {
  const arrayBuffer = await file.arrayBuffer();
  try {
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

    const htmlString = htmlResult.value;
    const rawText = rawTextResult.value;

    return parseHtmlOrText(htmlString, rawText);
  } catch (mammothErr) {
    const text = await file.text();
    return parseHtmlOrText(text, text);
  }
}

function parseHtmlOrText(htmlString: string, rawText: string): Question[] {
  if (htmlString && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlString, 'text/html');
      const tables = Array.from(doc.querySelectorAll('table')) as HTMLTableElement[];

      if (tables.length > 0) {
        const tableQuestions = parseFromHtmlTables(tables);
        if (tableQuestions.length > 0) {
          return tableQuestions.map((q, idx) => formatQuestion(q, idx + 1));
        }
      }
    } catch (e) {
      console.warn('DOMParser fallback', e);
    }
  }

  return parseFromRawText(rawText);
}

function parseFromHtmlTables(tables: HTMLTableElement[]): Partial<Question>[] {
  const allRows: HTMLElement[] = [];
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr')) as HTMLElement[];
    allRows.push(...rows);
  }

  return parseVerticalCbtTable(allRows);
}

function parseVerticalCbtTable(rows: HTMLElement[]): Partial<Question>[] {
  const questions: Partial<Question>[] = [];
  let currentQ: Partial<Question> | null = null;
  let rawOptions: { label: string; text: string; isCorrect: boolean }[] = [];
  let kunciText = '';

  const finalizeCurrentQ = () => {
    if (!currentQ) return;

    if (rawOptions.length > 0) {
      if (kunciText) {
        const correctKeys = kunciText.split(/[\,\;]/).map((s) => s.trim().toUpperCase());
        rawOptions.forEach((opt) => {
          if (correctKeys.includes(opt.label.toUpperCase())) {
            opt.isCorrect = true;
          }
        });
      }
      currentQ.options = rawOptions.map((o, idx) => ({
        id: `opt_${idx}`,
        text: o.text,
        isCorrect: o.isCorrect,
      }));
    }

    if (currentQ.questionText || (currentQ.options && currentQ.options.length > 0)) {
      questions.push({ ...currentQ });
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
    const tdList = Array.from(row.querySelectorAll('td, th')) as HTMLElement[];
    if (tdList.length < 1) return;

    const col1Raw = (tdList[0].textContent || '').trim();
    const col2Raw =
      tdList.length > 1
        ? tdList.slice(1).map((c) => extractCellHtmlOrText(c)).join(' ').trim()
        : '';

    const col1Clean = col1Raw.replace(/[\.\:\s\(\)\[\]]/g, '').toUpperCase();

    const numMatch =
      col1Raw.trim().match(/^(?:SOAL|NO|NOMOR|QUESTION|PERTANYAAN)\s*(?:NO|NOMOR|\.)?\s*(\d+)[\.\:\)]?$/i) ||
      col1Raw.trim().match(/^(\d+)[\.\:\)]$/);

    const isSoalHeader =
      numMatch ||
      col1Clean === 'SOAL' ||
      col1Clean === 'PERTANYAAN' ||
      col1Clean === 'QUESTION' ||
      col1Clean === 'NO' ||
      col1Clean === 'NOMOR';

    const optMatch = col1Clean.match(/^[\*\(\[\>]*\s*(?:PIL|PILIHAN|OPSI)?\s*([A-Ea-e])[\.\:\)\]]*$/i);

    const isKunci = col1Clean.includes('KUNCI') || col1Clean.includes('JAWABAN');
    const isPembahasan = col1Clean.includes('PEMBAHASAN') || col1Clean.includes('EXPLANATION');
    const isStimulus = col1Clean.includes('STIMULUS') || col1Clean.includes('BACAAN');
    const isTipe = col1Clean.includes('TIPE') || col1Clean.includes('JENIS');
    const isKategori = col1Clean.includes('KATEGORI') || col1Clean.includes('AKM');
    const isBobot = col1Clean.includes('BOBOT') || col1Clean.includes('NILAI');

    if (isSoalHeader) {
      if (currentQ && (currentQ.questionText || rawOptions.length > 0)) {
        finalizeCurrentQ();
      }
      ensureCurrentQ();
      if (col2Raw && col2Raw.toUpperCase() !== 'SOAL') {
        currentQ.questionText = col2Raw;
      }
    } else if (optMatch) {
      ensureCurrentQ();
      rawOptions.push({
        label: optMatch[1].toUpperCase(),
        text: col2Raw,
        isCorrect: false,
      });
    } else if (isKunci) {
      ensureCurrentQ();
      kunciText = col2Raw;
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
      else if (typeStr.includes('jodoh')) currentQ.type = 'menjodohkan';
      else if (typeStr.includes('is') || typeStr.includes('singkat')) currentQ.type = 'uraian_pendek';
    } else if (isKategori) {
      ensureCurrentQ();
      const catStr = col2Raw.toLowerCase();
      if (catStr.includes('num')) currentQ.category = 'Numerasi';
      else if (catStr.includes('sain')) currentQ.category = 'Sains';
      else currentQ.category = 'Literasi';
    } else if (isBobot) {
      ensureCurrentQ();
      const weightVal = parseInt(col2Raw, 10);
      if (!isNaN(weightVal)) currentQ.weight = weightVal;
    } else if (col2Raw.trim() && !optMatch && !isKunci && !isPembahasan && !isStimulus) {
      ensureCurrentQ();
      if (!currentQ.questionText) {
        currentQ.questionText = col2Raw;
      } else if (rawOptions.length === 0) {
        currentQ.questionText += '\n' + col2Raw;
      }
    }
  });

  finalizeCurrentQ();
  return questions;
}

function parseFromRawText(text: string): Question[] {
  const questions: Partial<Question>[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let currentQ: Partial<Question> | null = null;

  lines.forEach((line) => {
    const numMatch =
      line.match(/^(?:SOAL|NO|NOMOR|QUESTION|PERTANYAAN)\s*(?:NO|NOMOR|\.)?\s*(\d+)[\.\:\)]?$/i) ||
      line.match(/^(\d+)[\.\:\)]$/);

    if (numMatch) {
      if (currentQ) questions.push(currentQ);
      currentQ = {
        type: 'pilihan_ganda',
        category: 'Literasi',
        cognitiveLevel: 'Aplikasi (L2)',
        difficulty: 'Sedang',
        weight: 10,
        questionText: '',
        options: [],
        createdAt: new Date().toISOString(),
      };
    } else if (currentQ) {
      if (!currentQ.questionText) {
        currentQ.questionText = line;
      } else {
        currentQ.questionText += '\n' + line;
      }
    }
  });

  if (currentQ) questions.push(currentQ);

  return questions.map((q, idx) => formatQuestion(q, idx + 1));
}

function formatQuestion(q: Partial<Question>, index: number): Question {
  return {
    id: `q_word_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 4)}`,
    type: q.type || 'pilihan_ganda',
    category: q.category || 'Literasi',
    cognitiveLevel: q.cognitiveLevel || 'Aplikasi (L2)',
    difficulty: q.difficulty || 'Sedang',
    weight: q.weight || 10,
    stimulus: q.stimulus,
    questionText: q.questionText || `Soal ${index}`,
    options: q.options || [],
    discussion: q.discussion || '',
    createdAt: q.createdAt || new Date().toISOString(),
  };
}