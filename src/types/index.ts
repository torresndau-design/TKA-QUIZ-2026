// Types for AKM Quiz Application

export type UserRole = 'ADMIN' | 'GURU';

export interface User {
  uid: string;
  email: string;
  password?: string;
  name: string;
  role: UserRole;
  nip?: string;
  subjectId?: string;
  subjectName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  createdAt: string;
}

export type QuizStatus = 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

export interface Quiz {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  subjectName: string;
  targetClass: string; // e.g., "X RPL 1", "Semua Kelas"
  teacherId: string;
  teacherName: string;
  duration: number; // in minutes
  startTime?: string;
  endTime?: string;
  minPassingGrade: number; // KKM (e.g., 75)
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  showGrade: boolean;
  showDiscussion: boolean;
  status: QuizStatus;
  token?: string; // Optional token/PIN required to enter exam
  questionCount?: number;
  createdAt: string;
  updatedAt?: string;
}

// 16 AKM Question Types
export type QuestionType =
  | 'pilihan_ganda' // 1. Pilihan Ganda
  | 'pg_kompleks' // 2. Pilihan Ganda Kompleks
  | 'menjodohkan' // 3. Menjodohkan
  | 'benar_salah' // 4. Benar Salah
  | 'setuju_tidak_setuju' // 5. Setuju Tidak Setuju
  | 'isian_singkat' // 6. Isian Singkat
  | 'isian_angka' // 7. Isian Angka
  | 'uraian_pendek' // 8. Uraian Pendek
  | 'uraian_panjang' // 9. Uraian Panjang
  | 'mengurutkan' // 10. Mengurutkan
  | 'drag_drop' // 11. Drag and Drop
  | 'checklist' // 12. Checklist
  | 'melengkapi_kalimat' // 13. Melengkapi Kalimat
  | 'pilihan_gambar' // 14. Pilihan Berdasarkan Gambar
  | 'pilihan_audio' // 15. Pilihan Berdasarkan Audio
  | 'pilihan_video'; // 16. Pilihan Berdasarkan Video

export type AkmCategory = 'Literasi' | 'Numerasi' | 'Sains' | 'Sosial Budaya';
export type CognitiveLevel = 'Pemahaman (L1)' | 'Aplikasi (L2)' | 'Penalaran (L3)';
export type DifficultyLevel = 'Mudah' | 'Sedang' | 'Sukar';

export interface Stimulus {
  type: 'text' | 'image' | 'audio' | 'video' | 'table' | 'chart' | 'pdf';
  content: string; // Text string, Image/Audio/Video URL, HTML table, or JSON chart data
  title?: string;
}

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  isCorrect?: boolean;
}

export interface MatchingPair {
  id: string;
  leftItem: string;
  rightItem: string; // Correct pair
}

export interface TrueFalseItem {
  id: string;
  statement: string;
  correctAnswer: boolean; // true = Benar / Setuju, false = Salah / Tidak Setuju
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  category: AkmCategory;
  chapter?: string;
  subChapter?: string;
  difficulty: DifficultyLevel;
  cognitiveLevel: CognitiveLevel;
  tags?: string[];
  questionText: string;
  stimulus?: Stimulus;
  options?: QuestionOption[]; // For PG, PG Kompleks, Checklist, Gambar, Audio, Video
  matchingPairs?: MatchingPair[]; // For Menjodohkan, Drag and Drop
  trueFalseItems?: TrueFalseItem[]; // For Benar Salah, Setuju Tidak Setuju
  sequenceItems?: string[]; // Correct sequence order for Mengurutkan
  correctAnswerText?: string; // For Isian Singkat, Melengkapi Kalimat
  correctOptionId?: string; // Optional direct option id reference for PG
  keywords?: string[]; // Keywords for Isian Singkat grading
  numericAnswer?: number; // For Isian Angka
  numericTolerance?: number; // E.g., +/- 0.5
  discussion?: string; // Pembahasan
  weight: number; // Bobot nilai
  createdAt: string;
}

export interface Participant {
  id: string;
  quizId: string;
  fullName: string;
  nis: string;
  studentClass: string;
  startedAt: string;
  submittedAt?: string;
  isFinished: boolean;
  score?: number; // Final percentage 0-100
  correctCount?: number;
  wrongCount?: number;
  essayGraded?: boolean; // Whether teacher completed essay grading
  antiCheatViolations?: number; // Page leave count
}

export interface Answer {
  id: string; // participantId_questionId
  participantId: string;
  quizId: string;
  questionId: string;
  userAnswer: any; // Dynamic response object depending on question type
  isFlagged?: boolean; // Ragu-ragu
  isCorrect?: boolean;
  scoreGiven?: number; // Partial or full score
  teacherComment?: string;
  updatedAt: string;
}

export interface AppSettings {
  schoolName: string;
  schoolLogoUrl?: string;
  academicYear: string;
  examInstructions: string;
  updatedAt?: string;
}
