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

// Deep sanitize object for Firestore (removes undefined keys to prevent Firestore write crashes)
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      result[key] = sanitizeForFirestore(val);
    }
  }
  return result as T;
}

// Helper to query Firestore with a robust fallback timeout (default 6000ms) so mobile & remote devices load reliably
async function fetchWithFastTimeout<T>(
  firestorePromise: Promise<T>,
  timeoutMs = 6000
): Promise<T | null> {
  try {
    const result = await Promise.race([
      firestorePromise,
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs)
      ),
    ]);
    return result;
  } catch (e) {
    console.warn('Firestore fetch warning (falling back to cache):', e);
    return null;
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

  // Clean up legacy sample questions q_1..q_7 from local storage
  const legacyIds = ['q_1', 'q_2', 'q_3', 'q_4', 'q_5', 'q_6', 'q_7'];
  const currentLocalQuestions = getLocalData<Question[]>('questions', []);
  const filteredLocalQuestions = currentLocalQuestions.filter((q) => !legacyIds.includes(q.id));
  if (filteredLocalQuestions.length !== currentLocalQuestions.length) {
    setLocalData('questions', filteredLocalQuestions);
  }

  // Seed default items into Firestore asynchronously in background once
  if (!localStorage.getItem('akm_db_seeded_v3')) {
    localStorage.setItem('akm_db_seeded_v3', 'true');
    setTimeout(() => {
      forceSyncToFirestore().catch(() => {});
    }, 1000);
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
    const promises: Promise<any>[] = [];
    for (const u of users) { promises.push(setDoc(doc(db, 'users', u.uid), u, { merge: true })); count++; }
    for (const s of subjects) { promises.push(setDoc(doc(db, 'subjects', s.id), s, { merge: true })); count++; }
    for (const q of quizzes) { promises.push(setDoc(doc(db, 'quizzes', q.id), q, { merge: true })); count++; }
    for (const qst of questions) { promises.push(setDoc(doc(db, 'questions', qst.id), qst, { merge: true })); count++; }
    for (const p of participants) { promises.push(setDoc(doc(db, 'participants', p.id), p, { merge: true })); count++; }
    promises.push(setDoc(doc(db, 'settings', 'global'), settings, { merge: true })); count++;

    await Promise.allSettled(promises);
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
  const localList = getLocalData<User[]>('users', DEFAULT_USERS);

  // Ensure DEFAULT_USERS are always present
  for (const defUser of DEFAULT_USERS) {
    const existingIdx = localList.findIndex((u) => u.uid === defUser.uid || u.email.toLowerCase() === defUser.email.toLowerCase());
    if (existingIdx >= 0) {
      if (localList[existingIdx].uid === 'admin_1') {
        localList[existingIdx].email = defUser.email;
        localList[existingIdx].password = defUser.password;
      }
    } else {
      localList.push(defUser);
    }
  }

  // Fast 500ms Firestore fetch
  const snap = await fetchWithFastTimeout(getDocs(collection(db, 'users')), 500);
  if (snap && !snap.empty) {
    const list: User[] = [];
    snap.forEach((docSnap) => list.push(docSnap.data() as User));
    if (list.length > 0) {
      // Ensure admin_1 is present
      for (const defUser of DEFAULT_USERS) {
        if (!list.some((u) => u.uid === defUser.uid)) list.push(defUser);
      }
      setLocalData('users', list);
      return list;
    }
  }

  setLocalData('users', localList);
  return localList;
}

// Helper to prevent Firestore network calls from hanging local UI updates
async function syncToFirestore(fn: () => Promise<void>): Promise<void> {
  const timeoutMs = 6000;
  try {
    await Promise.race([
      fn(),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch (e) {
    console.warn('Firestore sync warning:', e);
  }
}

export async function saveUser(user: User): Promise<void> {
  const cleanUser = sanitizeForFirestore(user);
  const list = getLocalData<User[]>('users', DEFAULT_USERS);
  const idx = list.findIndex((u) => u.uid === user.uid);
  if (idx >= 0) list[idx] = cleanUser;
  else list.push(cleanUser);
  setLocalData('users', list);

  await syncToFirestore(async () => {
    await setDoc(doc(db, 'users', user.uid), cleanUser, { merge: true });
  });
}

export async function deleteUser(uid: string): Promise<void> {
  const list = getLocalData<User[]>('users', DEFAULT_USERS).filter((u) => u.uid !== uid);
  setLocalData('users', list);

  await syncToFirestore(async () => {
    await deleteDoc(doc(db, 'users', uid));
  });
}

// ==================== SUBJECTS CRUD ====================
export async function getSubjects(): Promise<Subject[]> {
  const localList = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
  const snap = await fetchWithFastTimeout(getDocs(collection(db, 'subjects')), 4000);
  if (snap && !snap.empty) {
    const list: Subject[] = [];
    snap.forEach((d) => list.push(d.data() as Subject));
    if (list.length > 0) {
      setLocalData('subjects', list);
      return list;
    }
  }
  return localList;
}

export async function saveSubject(subject: Subject): Promise<void> {
  const cleanSubj = sanitizeForFirestore(subject);
  const list = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS);
  const idx = list.findIndex((s) => s.id === subject.id);
  if (idx >= 0) list[idx] = cleanSubj;
  else list.push(cleanSubj);
  setLocalData('subjects', list);

  await syncToFirestore(async () => {
    await setDoc(doc(db, 'subjects', subject.id), cleanSubj, { merge: true });
  });
}

export async function deleteSubject(id: string): Promise<void> {
  const list = getLocalData<Subject[]>('subjects', DEFAULT_SUBJECTS).filter((s) => s.id !== id);
  setLocalData('subjects', list);

  await syncToFirestore(async () => {
    await deleteDoc(doc(db, 'subjects', id));
  });
}

// ==================== QUIZZES CRUD ====================
export async function getQuizzes(): Promise<Quiz[]> {
  const localList = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
  const snap = await fetchWithFastTimeout(getDocs(collection(db, 'quizzes')), 5000);

  let list: Quiz[] = [];
  if (snap && !snap.empty) {
    snap.forEach((d) => list.push(d.data() as Quiz));
  }

  if (list.length === 0) {
    list = localList;
  } else {
    // Merge any locally stored quizzes that aren't yet in Firestore
    for (const localQ of localList) {
      if (!list.some((q) => q.id === localQ.id)) {
        list.push(localQ);
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

  // Fast direct local lookup
  const localList = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
  const localFound = localList.find((q) => q.id === cleanId || q.id.toLowerCase() === cleanId.toLowerCase());

  try {
    const docSnap = await fetchWithFastTimeout(getDoc(doc(db, 'quizzes', cleanId)), 5000);
    if (docSnap && docSnap.exists()) {
      const qz = docSnap.data() as Quiz;
      // Sync with local store
      const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
      const idx = list.findIndex((x) => x.id === qz.id);
      if (idx >= 0) list[idx] = qz;
      else list.push(qz);
      setLocalData('quizzes', list);
      return qz;
    }
  } catch (e) {
    console.warn('getQuizById error:', e);
  }

  return (
    localFound ||
    DEFAULT_QUIZZES.find((q) => q.id === cleanId || q.id.toLowerCase() === cleanId.toLowerCase()) ||
    null
  );
}

export async function saveQuiz(quiz: Quiz): Promise<void> {
  const cleanQuiz = sanitizeForFirestore(quiz);

  // Update local storage immediately for fast local responsiveness
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES);
  const idx = list.findIndex((q) => q.id === quiz.id);
  if (idx >= 0) list[idx] = cleanQuiz;
  else list.push(cleanQuiz);
  setLocalData('quizzes', list);

  // Sync to Cloud Firestore in background
  await syncToFirestore(async () => {
    await setDoc(doc(db, 'quizzes', quiz.id), cleanQuiz, { merge: true });
  });
}

export async function deleteQuiz(id: string): Promise<void> {
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES).filter((q) => q.id !== id);
  setLocalData('quizzes', list);

  await syncToFirestore(async () => {
    await deleteDoc(doc(db, 'quizzes', id));
  });
}

export async function deleteMultipleQuizzes(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const list = getLocalData<Quiz[]>('quizzes', DEFAULT_QUIZZES).filter((q) => !idSet.has(q.id));
  setLocalData('quizzes', list);

  await syncToFirestore(async () => {
    await Promise.all(ids.map((id) => deleteDoc(doc(db, 'quizzes', id))));
  });
}

// ==================== QUESTIONS CRUD ====================
export async function getQuestionsByQuiz(quizId: string): Promise<Question[]> {
  if (!quizId) return [];
  const cleanId = quizId.trim();

  const localList = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const localRes = localList.filter(
    (q) => q.quizId === cleanId || (q.quizId && q.quizId.toLowerCase() === cleanId.toLowerCase())
  );

  try {
    const qQuery = query(collection(db, 'questions'), where('quizId', '==', cleanId));
    const snap = await fetchWithFastTimeout(getDocs(qQuery), 6000);

    let firestoreList: Question[] = [];
    if (snap && !snap.empty) {
      snap.forEach((d) => firestoreList.push(d.data() as Question));
    }

    const combinedMap = new Map<string, Question>();
    localRes.forEach((q) => combinedMap.set(q.id, q));
    firestoreList.forEach((q) => combinedMap.set(q.id, q));

    const resultList = Array.from(combinedMap.values());
    if (resultList.length > 0) {
      // Sync back to local storage cache
      const currentAll = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
      const mergedAllMap = new Map<string, Question>();
      currentAll.forEach((q) => mergedAllMap.set(q.id, q));
      firestoreList.forEach((q) => mergedAllMap.set(q.id, q));
      setLocalData('questions', Array.from(mergedAllMap.values()));
      return resultList;
    }
  } catch (err) {
    console.warn('getQuestionsByQuiz error:', err);
  }

  if (localRes.length > 0) return localRes;

  return DEFAULT_QUESTIONS.filter(
    (q) => q.quizId === cleanId || (q.quizId && q.quizId.toLowerCase() === cleanId.toLowerCase())
  );
}

export async function getAllQuestions(): Promise<Question[]> {
  const localList = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const snap = await fetchWithFastTimeout(getDocs(collection(db, 'questions')), 6000);
  if (snap && !snap.empty) {
    const list: Question[] = [];
    snap.forEach((d) => list.push(d.data() as Question));
    if (list.length > 0) {
      setLocalData('questions', list);
      return list;
    }
  }
  return localList;
}

export async function saveQuestion(question: Question): Promise<void> {
  const cleanQuestion = sanitizeForFirestore(question);

  // Save locally first
  const list = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const idx = list.findIndex((q) => q.id === question.id);
  if (idx >= 0) list[idx] = cleanQuestion;
  else list.push(cleanQuestion);
  setLocalData('questions', list);

  // Sync to Firestore
  await syncToFirestore(async () => {
    await setDoc(doc(db, 'questions', question.id), cleanQuestion, { merge: true });
  });

  // Update quiz question count
  const quiz = await getQuizById(question.quizId);
  if (quiz) {
    const quizQuestions = list.filter((q) => q.quizId === question.quizId);
    quiz.questionCount = quizQuestions.length;
    await saveQuiz(quiz);
  }
}

export async function saveMultipleQuestions(questions: Question[]): Promise<void> {
  if (questions.length === 0) return;
  const cleanQuestions = questions.map((q) => sanitizeForFirestore(q));

  // Save to local storage
  const list = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS);
  const map = new Map<string, Question>();
  list.forEach((q) => map.set(q.id, q));
  cleanQuestions.forEach((q) => map.set(q.id, q));
  setLocalData('questions', Array.from(map.values()));

  // Batch sync to Firestore
  await syncToFirestore(async () => {
    await Promise.all(cleanQuestions.map((q) => setDoc(doc(db, 'questions', q.id), q, { merge: true })));
  });

  // Update question count for affected quiz
  const qId = questions[0]?.quizId;
  if (qId) {
    const quiz = await getQuizById(qId);
    if (quiz) {
      const quizQuestions = Array.from(map.values()).filter((q) => q.quizId === qId);
      quiz.questionCount = quizQuestions.length;
      await saveQuiz(quiz);
    }
  }
}

export async function deleteQuestion(id: string, quizId: string): Promise<void> {
  await deleteMultipleQuestions([{ id, quizId }]);
}

export async function deleteMultipleQuestions(items: { id: string; quizId: string }[]): Promise<void> {
  const idSet = new Set(items.map((i) => i.id));
  const list = getLocalData<Question[]>('questions', DEFAULT_QUESTIONS).filter((q) => !idSet.has(q.id));
  setLocalData('questions', list);

  await syncToFirestore(async () => {
    await Promise.all(items.map((item) => deleteDoc(doc(db, 'questions', item.id))));
  });

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

  await syncToFirestore(async () => {
    await setDoc(doc(db, 'participants', p.id), p, { merge: true });
  });
}

export async function getParticipantById(id: string): Promise<Participant | null> {
  if (!id) return null;
  const cleanId = id.trim();

  // Local lookup
  const list = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS);
  const localFound = list.find((p) => p.id === cleanId);

  const dSnap = await fetchWithFastTimeout(getDoc(doc(db, 'participants', cleanId)), 500);
  if (dSnap && dSnap.exists()) return dSnap.data() as Participant;

  return localFound || null;
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
  const localList = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS);
  const snap = await fetchWithFastTimeout(getDocs(collection(db, 'participants')), 500);
  if (snap && !snap.empty) {
    const list: Participant[] = [];
    snap.forEach((d) => list.push(d.data() as Participant));
    if (list.length > 0) {
      setLocalData('participants', list);
      return list;
    }
  }
  return localList;
}

export async function getParticipantsByQuiz(quizId: string): Promise<Participant[]> {
  const localList = getLocalData<Participant[]>('participants', []);
  const localRes = localList.filter((p) => p.quizId === quizId);

  const qQuery = query(collection(db, 'participants'), where('quizId', '==', quizId));
  const snap = await fetchWithFastTimeout(getDocs(qQuery), 500);
  if (snap && !snap.empty) {
    const list: Participant[] = [];
    snap.forEach((d) => list.push(d.data() as Participant));
    if (list.length > 0) return list;
  }
  return localRes;
}

export async function deleteParticipant(id: string): Promise<void> {
  const list = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS).filter((p) => p.id !== id);
  setLocalData('participants', list);

  await syncToFirestore(async () => {
    await deleteDoc(doc(db, 'participants', id));
  });
}

export async function deleteMultipleParticipants(ids: string[]): Promise<void> {
  const idSet = new Set(ids);
  const list = getLocalData<Participant[]>('participants', DEFAULT_PARTICIPANTS).filter((p) => !idSet.has(p.id));
  setLocalData('participants', list);

  await syncToFirestore(async () => {
    await Promise.all(ids.map((id) => deleteDoc(doc(db, 'participants', id))));
  });
}

export async function saveAnswer(ans: Answer): Promise<void> {
  const list = getLocalData<Answer[]>('answers', []);
  const idx = list.findIndex((a) => a.id === ans.id);
  if (idx >= 0) list[idx] = ans;
  else list.push(ans);
  setLocalData('answers', list);

  await syncToFirestore(async () => {
    await setDoc(doc(db, 'answers', ans.id), ans, { merge: true });
  });
}

export async function getAnswersByParticipant(participantId: string): Promise<Answer[]> {
  const localList = getLocalData<Answer[]>('answers', []);
  const localRes = localList.filter((a) => a.participantId === participantId);

  const qQuery = query(collection(db, 'answers'), where('participantId', '==', participantId));
  const snap = await fetchWithFastTimeout(getDocs(qQuery), 500);
  if (snap && !snap.empty) {
    const list: Answer[] = [];
    snap.forEach((d) => list.push(d.data() as Answer));
    if (list.length > 0) return list;
  }
  return localRes;
}

// ==================== SETTINGS ====================
export async function getAppSettings(): Promise<AppSettings> {
  let settings: AppSettings = getLocalData<AppSettings>('settings', DEFAULT_SETTINGS);

  const dSnap = await fetchWithFastTimeout(getDoc(doc(db, 'settings', 'global')), 500);
  if (dSnap && dSnap.exists()) {
    settings = dSnap.data() as AppSettings;
    setLocalData('settings', settings);
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
  setLocalData('settings', s);

  await syncToFirestore(async () => {
    await setDoc(doc(db, 'settings', 'global'), s, { merge: true });
  });
}
