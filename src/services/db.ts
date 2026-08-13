import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  User,
  Subject,
  Quiz,
  Question,
  Participant,
  Answer,
  AppSettings,
} from '../types';

// Helper for localStorage fallback / memory caching for offline robustness
const LOCAL_STORAGE_PREFIX = 'akm_db_';

function getLocalData<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalData<T>(key: string, value: T): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage save error:', e);
  }
}

// ==================== SEED / INITIALIZATION ====================

export const DEFAULT_USERS: User[] = [
  {
    uid: 'admin_1',
    email: 'admintka@guru.com',
    password: 'tka123*',
    name: 'Administrator Utama',
    role: 'ADMIN',
    nip: '198501012010011001',
    isActive: true,
    createdAt: new Date().toISOString(),
  }
];

export const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'subj_1',
    code: 'LIT-IND',
    name: 'Bahasa Indonesia (Literasi)',
    description: 'Literasi Membaca dan Memahami Teks Informasi',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'subj_2',
    code: 'NUM-MAT',
    name: 'Matematika (Numerasi)',
    description: 'Penalaran Matematika dan Logika Angka',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'subj_3',
    code: 'SAINS',
    name: 'Ilmu Pengetahuan Alam',
    description: 'Literasi Sains dan Fenomena Alam',
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: 'SMKS SANJAYA BAJAWA',
  schoolLogoUrl: '',
  academicYear: '2025/2026',
  examInstructions: '1. Kerjakan soal dengan teliti.\n2. Anda dapat menggunakan tombol Ragu-ragu jika belum yakin.\n3. Dilarang berpindah halaman/tab selama ujian berlangsung.\n4. Pastikan jawaban terisi sebelum waktu habis.',
};

export const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: 'quiz_1',
    title: 'Simulasi TKA Literasi Membaca 2026',
    description: 'Uji kompetensi literasi membaca teks informasi dan fiksi tingkat SMA/SMK.',
    subjectId: 'subj_1',
    subjectName: 'Bahasa Indonesia (Literasi)',
    targetClass: 'Kelas X & XI',
    teacherId: 'admin_1',
    teacherName: 'Administrator Utama',
    duration: 45,
    minPassingGrade: 75,
    randomizeQuestions: true,
    randomizeAnswers: true,
    showGrade: true,
    showDiscussion: true,
    status: 'PUBLISHED',
    token: 'TKA2026',
    questionCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'quiz_2',
    title: 'Asesmen TKA Numerasi Data & Ketidakpastian',
    description: 'Soal penalaran grafik, tabel statistik, dan peluang kejadian sederhana.',
    subjectId: 'subj_2',
    subjectName: 'Matematika (Numerasi)',
    targetClass: 'Kelas XI RPL',
    teacherId: 'admin_1',
    teacherName: 'Administrator Utama',
    duration: 60,
    minPassingGrade: 70,
    randomizeQuestions: false,
    randomizeAnswers: true,
    showGrade: true,
    showDiscussion: true,
    status: 'PUBLISHED',
    token: 'NUM123',
    questionCount: 0,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_QUESTIONS: Question[] = [];

// Initialize Local/Firestore Defaults
export async function seedInitialData() {
  const users = getLocalData<User[]>('users', []);
  if (users.length === 0) {
    setLocalData('users', DEFAULT_USERS);
    setLocalData('subjects', DEFAULT_SUBJECTS);
    setLocalData('quizzes', DEFAULT_QUIZZES);
    setLocalData('questions', DEFAULT_QUESTIONS);
    setLocalData('settings', DEFAULT_SETTINGS);
    setLocalData('participants', DEFAULT_PARTICIPANTS);
    setLocalData('answers', []);
  }

  // Clean up legacy sample questions q_1..q_7 from local storage and Firestore if existing
  const legacyIds = ['q_1', 'q_2', 'q_3', 'q_4', 'q_5', 'q_6', 'q_7'];
  const currentLocalQuestions = getLocalData<Question[]>('questions', []);
  const filteredLocalQuestions = currentLocalQuestions.filter((q) => !legacyIds.includes(q.id));
  if (filteredLocalQuestions.length !== currentLocalQuestions.length) {
    setLocalData('questions', filteredLocalQuestions);
  }

  for (const id of legacyIds) {
    deleteDoc(doc(db, 'questions', id)).catch(() => {});
  }

  // Seed default users, quizzes, subjects, questions, settings into Firestore
  try {
    const currentUsers = getLocalData<User[]>('users', DEFAULT_USERS);
    for (const u of currentUsers) {
      await setDoc(doc(db, 'users', u.uid), u, { merge: true });
    }

    const currentSubjects = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
    for (const s of currentSubjects) {
      await setDoc(doc(db, 'subjects', s.id), s, { merge: true });
    }

    const currentQuizzes = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
    for (const q of currentQuizzes) {
      await setDoc(doc(db, 'quizzes', q.id), q, { merge: true });
    }

    const currentQuestions = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
    for (const qst of currentQuestions) {
      await setDoc(doc(db, 'questions', qst.id), qst, { merge: true });
    }

    const currentParticipants = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS);
    for (const p of currentParticipants) {
      await setDoc(doc(db, 'participants', p.id), p, { merge: true });
    }

    const currentSettings = getLocalData<AppSettings>('settings', DEFAULT_SETTINGS);
    await setDoc(doc(db, 'settings', 'global'), currentSettings, { merge: true });
  } catch (e) {
    console.warn('Firestore initial seed notice:', e);
  }
}

// Force Sync All Local Data directly into Firestore
export async function forceSyncToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const users = getLocalData<User[]>('users', DEFAULT_USERS);
    const subjects = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
    const quizzes = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
    const questions = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
    const participants = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS);
    const settings = getLocalData<AppSettings>('settings', DEFAULT_SETTINGS);

    let count = 0;
    for (const u of users) { await setDoc(doc(db, 'users', u.uid), u, { merge: true }); count++; }
    for (const s of subjects) { await setDoc(doc(db, 'subjects', s.id), s, { merge: true }); count++; }
    for (const q of quizzes) { await setDoc(doc(db, 'quizzes', q.id), q, { merge: true }); count++; }
    for (const qst of questions) { await setDoc(doc(db, 'questions', qst.id), qst, { merge: true }); count++; }
    for (const p of participants) { await setDoc(doc(db, 'participants', p.id), p, { merge: true }); count++; }
    await setDoc(doc(db, 'settings', 'global'), settings, { merge: true }); count++;

    return { success: true, count };
  } catch (err: any) {
    console.error('Failed to sync to Firestore:', err);
    return { success: false, count: 0, error: err.message || 'Gagal tersambung ke Firestore' };
  }
}

// Ensure seeded on module load
seedInitialData();

// ==================== USERS CRUD ====================
export async function getUsers(): Promise<User[]> {
  let list: User[] = [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (!snap.empty) {
      snap.forEach((docSnap) => list.push(docSnap.data() as User));
    }
  } catch (e) {
    console.warn('Firestore fallback to local storage:', e);
  }

  if (list.length === 0) {
    list = getLocalData<User[]>('users', DEFAULT_USERS);
  }

  // Ensure DEFAULT_USERS are always present so demo logins always work
  for (const defUser of DEFAULT_USERS) {
    const existingIdx = list.findIndex((u) => u.uid === defUser.uid || u.email.toLowerCase() === defUser.email.toLowerCase());
    if (existingIdx >= 0) {
      // Update email/password if it was old admin email or uid
      if (list[existingIdx].uid === 'admin_1') {
        list[existingIdx].email = defUser.email;
        list[existingIdx].password = defUser.password;
      }
    } else {
      list.push(defUser);
    }
  }

  setLocalData('users', list);
  return list;
}

export async function saveUser(user: User): Promise<void> {
  try {
    await setDoc(doc(db, 'users', user.uid), user, { merge: true });
  } catch (e) {
    console.warn('Firestore setDoc error:', e);
  }
  const list = getLocalData<User[]>('users', DEFAULT_USERS);
  const idx = list.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) list[idx] = user;
  else list.push(user);
  setLocalData('users', list);
}

export async function deleteUser(uid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (e) {
    console.warn('Firestore delete error:', e);
  }
  const list = getLocalData<User[]>('users', DEFAULT_USERS).filter((u) => u.uid !== uid);
  setLocalData('users', list);
}

// ==================== SUBJECTS CRUD ====================
export async function getSubjects(): Promise<Subject[]> {
  try {
    const snap = await getDocs(collection(db, 'subjects'));
    if (!snap.empty) {
      const list: Subject[] = [];
      snap.forEach((d) => list.push(d.data() as Subject));
      setLocalData('subjects', list);
      return list;
    }
  } catch (e) {
    console.warn('Firestore fallback:', e);
  }
  return getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
}

export async function saveSubject(subject: Subject): Promise<void> {
  try {
    await setDoc(doc(db, 'subjects', subject.id), subject, { merge: true });
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
  const idx = list.findIndex((s) => s.id === subject.id);
  if (idx >= 0) list[idx] = subject;
  else list.push(subject);
  setLocalData('subjects', list);
}

export async function deleteSubject(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'subjects', id));
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS).filter((s) => s.id !== id);
  setLocalData('subjects', list);
}

// ==================== QUIZZES CRUD ====================
export async function getQuizzes(): Promise<Quiz[]> {
  let list: Quiz[] = [];
  try {
    const snap = await getDocs(collection(db, 'quizzes'));
    if (!snap.empty) {
      snap.forEach((d) => list.push(d.data() as Quiz));
    }
  } catch (e) {
    console.warn('Firestore getQuizzes error:', e);
  }

  const localList = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);

  if (list.length === 0) {
    list = localList;
  } else {
    // Merge any locally stored quizzes that aren't yet in Firestore and attempt sync
    for (const localQ of localList) {
      if (!list.some((q) => q.id === localQ.id)) {
        list.push(localQ);
        setDoc(doc(db, 'quizzes', localQ.id), localQ, { merge: true }).catch((err) =>
          console.warn('Background sync quiz error:', err)
        );
      }
    }
  }

  // Ensure default quizzes are always present
  for (const defQ of DEFAULT_QUIZZES) {
    if (!list.some((q) => q.id === defQ.id)) {
      list.push(defQ);
    }
  }

  setLocalData('quizzes', list);
  return list;
}

export async function getQuizById(id: string): Promise<Quiz | null> {
  if (!id) return null;
  const cleanId = id.trim();

  // 1. Try Firestore direct lookup
  try {
    const docSnap = await getDoc(doc(db, 'quizzes', cleanId));
    if (docSnap.exists()) {
      return docSnap.data() as Quiz;
    }
  } catch (e) {
    console.warn('Firestore getQuizById error:', e);
  }

  // 2. Fallback: query all quizzes (Firestore + local storage sync)
  const allQuizzes = await getQuizzes();
  const found =
    allQuizzes.find((q) => q.id === cleanId || q.id.toLowerCase() === cleanId.toLowerCase()) ||
    DEFAULT_QUIZZES.find((q) => q.id === cleanId || q.id.toLowerCase() === cleanId.toLowerCase());

  return found || null;
}

export async function saveQuiz(quiz: Quiz): Promise<void> {
  // Update local storage immediately for fast local responsiveness
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
  const idx = list.findIndex((q) => q.id === quiz.id);
  if (idx >= 0) list[idx] = quiz;
  else list.push(quiz);
  setLocalData('quizzes', list);

  // Sync to Cloud Firestore so link works on all student devices
  try {
    await setDoc(doc(db, 'quizzes', quiz.id), quiz, { merge: true });
  } catch (e) {
    console.warn('saveQuiz firestore sync warning:', e);
  }
}

export async function deleteQuiz(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'quizzes', id));
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES).filter((q) => q.id !== id);
  setLocalData('quizzes', list);
}

export async function deleteMultipleQuizzes(ids: string[]): Promise<void> {
  try {
    await Promise.all(ids.map((id) => deleteDoc(doc(db, 'quizzes', id))));
  } catch (e) {
    console.warn(e);
  }
  const idSet = new Set(ids);
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES).filter((q) => !idSet.has(q.id));
  setLocalData('quizzes', list);
}

// ==================== QUESTIONS CRUD ====================
export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  if (!quizId) return [];
  const cleanId = quizId.trim();

  let firestoreList: Question[] = [];
  try {
    const qQuery = query(collection(db, 'questions'), where('quizId', '==', cleanId));
    const snap = await getDocs(qQuery);
    if (!snap.empty) {
      snap.forEach((d) => firestoreList.push(d.data() as Question));
    }
  } catch (e) {
    console.warn('Firestore getQuestionsByQuiz error:', e);
  }

  const localList = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const localRes = localList.filter(
    (q) => q.quizId === cleanId || (q.quizId && q.quizId.toLowerCase() === cleanId.toLowerCase())
  );

  const combinedMap = new Map<string, Question>();
  localRes.forEach((q) => combinedMap.set(q.id, q));
  firestoreList.forEach((q) => combinedMap.set(q.id, q));

  const resultList = Array.from(combinedMap.values());

  // Background sync any local questions to Firestore
  for (const lq of localRes) {
    if (!firestoreList.some((fq) => fq.id === lq.id)) {
      setDoc(doc(db, 'questions', lq.id), lq, { merge: true }).catch((err) =>
        console.warn('Background sync question warning:', err)
      );
    }
  }

  if (resultList.length > 0) return resultList;

  return DEFAULT_QUESTIONS.filter(
    (q) => q.quizId === cleanId || (q.quizId && q.quizId.toLowerCase() === cleanId.toLowerCase())
  );
}

export async function getAllQuestions(): Promise<Question[]> {
  try {
    const snap = await getDocs(collection(db, 'questions'));
    if (!snap.empty) {
      const list: Question[] = [];
      snap.forEach((d) => list.push(d.data() as Question));
      setLocalData('questions', list);
      return list;
    }
  } catch (e) {
    console.warn(e);
  }
  return getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
}

export async function saveQuestion(question: Question): Promise<void> {
  // Save locally first
  const list = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const idx = list.findIndex((q) => q.id === question.id);
  if (idx >= 0) list[idx] = question;
  else list.push(question);
  setLocalData('questions', list);

  // Sync to Firestore
  try {
    await setDoc(doc(db, 'questions', question.id), question, { merge: true });
  } catch (e) {
    console.warn('saveQuestion firestore sync warning:', e);
  }

  // Update quiz question count
  const quiz = await getQuizById(question.quizId);
  if (quiz) {
    const quizQuestions = list.filter((q) => q.quizId === question.quizId);
    quiz.questionCount = quizQuestions.length;
    await saveQuiz(quiz);
  }
}

export async function deleteQuestion(id: string, quizId: string): Promise<void> {
  await deleteMultipleQuestions([{ id, quizId }]);
}

export async function deleteMultipleQuestions(items: { id: string; quizId: string }[]): Promise<void> {
  try {
    await Promise.all(items.map((item) => deleteDoc(doc(db, 'questions', item.id))));
  } catch (e) {
    console.warn(e);
  }
  const idSet = new Set(items.map((i) => i.id));
  const list = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS).filter((q) => !idSet.has(q.id));
  setLocalData('questions', list);

  // Update question counts for affected quizzes
  const quizIds = Array.from(new Set(items.map((i) => i.quizId)));
  for (const qId of quizIds) {
    const quiz = await getQuizById(qId);
    if (quiz) {
      const quizQuestions = list.filter((q) => q.quizId === qId);
      quiz.questionCount = quizQuestions.length;
      await saveQuiz(quiz);
    }
  }
}

export async function clearAllQuestions(): Promise<void> {
  try {
    const all = await getAllQuestions();
    await Promise.all(all.map((q) => deleteDoc(doc(db, 'questions', q.id)).catch(() => {})));
  } catch (e) {
    console.warn('clearAllQuestions error:', e);
  }
  setLocalData('questions', []);

  const quizzes = await getQuizzes();
  for (const q of quizzes) {
    q.questionCount = 0;
    await saveQuiz(q);
  }
}

// ==================== PARTICIPANTS & ANSWERS ====================
export async function saveParticipant(p: Participant): Promise<void> {
  const list = getLocalData<Participant[]>('participants', []);
  const idx = list.findIndex((item) => item.id === p.id);
  if (idx >= 0) list[idx] = p;
  else list.push(p);
  setLocalData('participants', list);

  try {
    await setDoc(doc(db, 'participants', p.id), p, { merge: true });
  } catch (e) {
    console.warn('saveParticipant firestore sync warning:', e);
  }
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (!id) return null;
  const cleanId = id.trim();

  // Try Firestore first
  try {
    const dSnap = await getDoc(doc(db, 'participants', cleanId));
    if (dSnap.exists()) return dSnap.data() as Participant;
  } catch (e) {
    console.warn('getParticipantById firestore error:', e);
  }

  // Fallback to local storage
  const list = getLocalData<Participant[]>('participants', []);
  return list.find((p) => p.id === cleanId) || null;
}

export const DEFAULT_PARTICIPANTS: Participant[] = [
  {
    id: 'part_1',
    quizId: 'quiz_1',
    fullName: 'Ahmad Fauzi',
    nis: '20261001',
    studentClass: 'X RPL 1',
    startedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    isFinished: true,
    score: 90,
    correctCount: 4,
    wrongCount: 1,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_2',
    quizId: 'quiz_1',
    fullName: 'Anisa Putri',
    nis: '20261002',
    studentClass: 'X RPL 1',
    startedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 2.2).toISOString(),
    isFinished: true,
    score: 85,
    correctCount: 4,
    wrongCount: 1,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_3',
    quizId: 'quiz_1',
    fullName: 'Bagas Wijaya',
    nis: '20261003',
    studentClass: 'X RPL 1',
    startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 3.1).toISOString(),
    isFinished: true,
    score: 65,
    correctCount: 2,
    wrongCount: 3,
    essayGraded: true,
    antiCheatViolations: 1,
  },
  {
    id: 'part_4',
    quizId: 'quiz_1',
    fullName: 'Citra Dewi',
    nis: '20261004',
    studentClass: 'X RPL 2',
    startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 4.3).toISOString(),
    isFinished: true,
    score: 95,
    correctCount: 5,
    wrongCount: 0,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_5',
    quizId: 'quiz_1',
    fullName: 'Diki Hermawan',
    nis: '20261005',
    studentClass: 'X RPL 2',
    startedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 5.2).toISOString(),
    isFinished: true,
    score: 70,
    correctCount: 3,
    wrongCount: 2,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_6',
    quizId: 'quiz_2',
    fullName: 'Eka Lestari',
    nis: '20261006',
    studentClass: 'XI RPL',
    startedAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 1.8).toISOString(),
    isFinished: true,
    score: 100,
    correctCount: 2,
    wrongCount: 0,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_7',
    quizId: 'quiz_2',
    fullName: 'Faisal Akbar',
    nis: '20261007',
    studentClass: 'XI RPL',
    startedAt: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 2.7).toISOString(),
    isFinished: true,
    score: 80,
    correctCount: 1,
    wrongCount: 1,
    essayGraded: true,
    antiCheatViolations: 0,
  },
  {
    id: 'part_8',
    quizId: 'quiz_2',
    fullName: 'Gita Prasetyo',
    nis: '20261008',
    studentClass: 'XI RPL',
    startedAt: new Date(Date.now() - 3600000 * 4.5).toISOString(),
    submittedAt: new Date(Date.now() - 3600000 * 3.8).toISOString(),
    isFinished: true,
    score: 50,
    correctCount: 0,
    wrongCount: 2,
    essayGraded: true,
    antiCheatViolations: 2,
  },
];

export async function getAllParticipants(): Promise<Participant[]> {
  try {
    const snap = await getDocs(collection(db, 'participants'));
    if (!snap.empty) {
      const list: Participant[] = [];
      snap.forEach((d) => list.push(d.data() as Participant));
      setLocalData('participants', list);
      return list;
    }
  } catch (e) {
    console.warn(e);
  }
  return getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS);
}

export async function getParticipantsByQuiz(quizId: string): Promise<Participant[]> {
  try {
    const qQuery = query(collection(db, 'participants'), where('quizId', '==', quizId));
    const snap = await getDocs(qQuery);
    if (!snap.empty) {
      const list: Participant[] = [];
      snap.forEach((d) => list.push(d.data() as Participant));
      return list;
    }
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Participant[]>('participants', []);
  return list.filter((p) => p.quizId === quizId);
}

export async function deleteParticipant(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'participants', id));
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS).filter((p) => p.id !== id);
  setLocalData('participants', list);
}

export async function deleteMultipleParticipants(ids: string[]): Promise<void> {
  try {
    await Promise.all(ids.map((id) => deleteDoc(doc(db, 'participants', id))));
  } catch (e) {
    console.warn(e);
  }
  const idSet = new Set(ids);
  const list = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS).filter((p) => !idSet.has(p.id));
  setLocalData('participants', list);
}

export async function saveAnswer(ans: Answer): Promise<void> {
  try {
    await setDoc(doc(db, 'answers', ans.id), ans, { merge: true });
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Answer[]>('answers', []);
  const idx = list.findIndex((a) => a.id === ans.id);
  if (idx >= 0) list[idx] = ans;
  else list.push(ans);
  setLocalData('answers', list);
}

export async function getAnswersByParticipant(participantId: string): Promise<Answer[]> {
  try {
    const qQuery = query(collection(db, 'answers'), where('participantId', '==', participantId));
    const snap = await getDocs(qQuery);
    if (!snap.empty) {
      const list: Answer[] = [];
      snap.forEach((d) => list.push(d.data() as Answer));
      return list;
    }
  } catch (e) {
    console.warn(e);
  }
  const list = getLocalData<Answer[]>('answers', []);
  return list.filter((a) => a.participantId === participantId);
}

// ==================== SETTINGS ====================
export async function getAppSettings(): Promise<AppSettings> {
  let settings: AppSettings = DEFAULT_SETTINGS;
  try {
    const dSnap = await getDoc(doc(db, 'settings', 'global'));
    if (dSnap.exists()) {
      settings = dSnap.data() as AppSettings;
    } else {
      settings = getLocalData<AppSettings>('settings', DEFAULT_SETTINGS);
    }
  } catch (e) {
    console.warn(e);
    settings = getLocalData<AppSettings>('settings', DEFAULT_SETTINGS);
  }

  // Update default placeholder if present
  if (!settings.schoolName || settings.schoolName === 'SMA Negeri 1 Indonesia') {
    settings.schoolName = 'SMKS SANJAYA BAJAWA';
  }
  if (!settings.schoolLogoUrl || settings.schoolLogoUrl.includes('unsplash') || settings.schoolLogoUrl === '/logo.jpg' || settings.schoolLogoUrl.includes('logo_sanjaya')) {
    settings.schoolLogoUrl = '';
  }

  return settings;
}

export async function saveAppSettings(s: AppSettings): Promise<void> {
  try {
    await setDoc(doc(db, 'settings', 'global'), s, { merge: true });
  } catch (e) {
    console.warn(e);
  }
  setLocalData('settings', s);
}
