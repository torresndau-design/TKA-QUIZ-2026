import * as XLSX from 'xlsx';
import { Question, QuestionType, CognitiveLevel, DifficultyLevel, Participant } from '../types';

export function exportQuestionsToExcel(questions: Question[], quizTitle: string) {
  const data = questions.map((q, i) => ({
    No: i + 1,
    'Tipe Soal': q.type,
    'Kategori AKM': q.category,
    Bab: q.chapter || '',
    'Sub Bab': q.subChapter || '',
    'Tingkat Kesulitan': q.difficulty,
    'Level Kognitif': q.cognitiveLevel,
    'Teks Soal': q.questionText,
    'Judul Stimulus': q.stimulus?.title || '',
    'Teks Stimulus': q.stimulus?.type === 'text' ? q.stimulus.content : '',
    'Bobot Nilai': q.weight,
    Pembahasan: q.discussion || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Bank Soal');

  XLSX.writeFile(workbook, `Soal_AKM_${quizTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export function exportResultsToExcel(participants: Participant[], quizTitle: string) {
  const data = participants.map((p, i) => ({
    Peringkat: i + 1,
    'Nama Lengkap': p.fullName,
    NIS: p.nis,
    Kelas: p.studentClass,
    'Nilai Akhir': p.score ?? 0,
    'Jumlah Benar': p.correctCount ?? 0,
    'Jumlah Salah': p.wrongCount ?? 0,
    'Status Koreksi Essay': p.essayGraded ? 'Selesai' : 'Perlu Diperiksa',
    'Waktu Mulai': p.startedAt ? new Date(p.startedAt).toLocaleString('id-ID') : '-',
    'Waktu Selesai': p.submittedAt ? new Date(p.submittedAt).toLocaleString('id-ID') : '-',
    'Pelanggaran Anti-Cheat': p.antiCheatViolations ?? 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Nilai');

  XLSX.writeFile(workbook, `Nilai_${quizTitle.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

export function parseQuestionsFromExcel(file: File): Promise<Partial<Question>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(firstSheet);

        const parsedQuestions: Partial<Question>[] = rawJson.map((row) => {
          const qType: QuestionType = row['Tipe Soal'] || 'pilihan_ganda';
          const cogLevel: CognitiveLevel = row['Level Kognitif'] || 'Aplikasi (L2)';
          const diff: DifficultyLevel = row['Tingkat Kesulitan'] || 'Sedang';

          return {
            type: qType,
            category: row['Kategori AKM'] || 'Literasi',
            chapter: row['Bab'] || 'Umum',
            subChapter: row['Sub Bab'] || 'Umum',
            difficulty: diff,
            cognitiveLevel: cogLevel,
            questionText: row['Teks Soal'] || 'Pertanyaan baru',
            stimulus: row['Teks Stimulus']
              ? {
                  type: 'text',
                  title: row['Judul Stimulus'] || 'Stimulus',
                  content: row['Teks Stimulus'],
                }
              : undefined,
            weight: Number(row['Bobot Nilai']) || 10,
            discussion: row['Pembahasan'] || '',
            createdAt: new Date().toISOString(),
          };
        });

        resolve(parsedQuestions);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}
