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
    title: 'Simulasi AKM Literasi Membaca 2026',
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
    token: 'AKM2026',
    questionCount: 5,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'quiz_2',
    title: 'Asesmen AKM Numerasi Data & Ketidakpastian',
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
    questionCount: 4,
    createdAt: new Date().toISOString(),
  },
];

export const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q_1',
    quizId: 'quiz_1',
    type: 'pilihan_ganda',
    category: 'Literasi',
    chapter: 'Teks Informasi',
    subChapter: 'Penghematan Energi & Kelestarian Lingkungan',
    difficulty: 'Sedang',
    cognitiveLevel: 'Aplikasi (L2)',
    tags: ['Energi', 'Literasi', 'Lingkungan'],
    questionText: 'Berdasarkan artikel stimulus di atas, apakah langkah utama yang paling efektif dilakukan oleh masyarakat dalam mengurangi limbah plastik harian?',
    stimulus: {
      type: 'text',
      title: 'Stimulus: Krisis Sampah Plastik Global',
      content: 'Penggunaan plastik sekali pakai meningkat signifikan setiap tahunnya. Berdasarkan data Kemitraan Sampah Plastik, lebih dari 8 juta ton sampah plastik bermuara di lautan setiap tahun. Upaya pengurangan dapat dimulai dari pemilahan sampah organik dan anorganik di tingkat rumah tangga serta membiasakan penggunaan wadah reusable.',
    },
    options: [
      { id: 'opt_1', text: 'Membakar sampah plastik di pekarangan rumah', isCorrect: false },
      { id: 'opt_2', text: 'Membawa wadah dan kantong belanja sendiri yang reusable', isCorrect: true },
      { id: 'opt_3', text: 'Menimbun sampah di dalam tanah agar terurai', isCorrect: false },
      { id: 'opt_4', text: 'Menunggu petugas kebersihan mengangkut seluruh limbah', isCorrect: false },
    ],
    discussion: 'Membawa kantong belanja reusable secara signifikan mengurangi produksi plastik sekali pakai.',
    weight: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_2',
    quizId: 'quiz_1',
    type: 'pg_kompleks',
    category: 'Literasi',
    chapter: 'Teks Informasi',
    subChapter: 'Gaya Hidup Sehat',
    difficulty: 'Sedang',
    cognitiveLevel: 'Penalaran (L3)',
    tags: ['Kesehatan', 'Nutrisi'],
    questionText: 'Manakah di antara pernyataan berikut yang sesuai dengan upaya menjaga kesehatan pencernaan menurut stimulus? (Pilih semua yang benar)',
    stimulus: {
      type: 'text',
      title: 'Stimulus: Menjaga Keseimbangan Mikrobioma Usus',
      content: 'Pencernaan yang sehat dipengaruhi oleh kecukupan asupan serat pangan dari buah dan sayur, konsumsi air putih yang cukup (minimal 2 liter sehari), serta pembatasan gula berlebih. Olahraga teratur juga memperlancar motilitas usus.',
    },
    options: [
      { id: 'opt_21', text: 'Mengonsumsi air putih minimal 2 liter sehari', isCorrect: true },
      { id: 'opt_22', text: 'Menghindari buah dan sayur berkadar air tinggi', isCorrect: false },
      { id: 'opt_23', text: 'Memenuhi asupan serat pangan dari sayuran', isCorrect: true },
      { id: 'opt_24', text: 'Meningkatkan konsumsi minuman manis kemasan', isCorrect: false },
    ],
    discussion: 'Minum air putih secukupnya dan makan makanan berserat tinggi adalah fakta kesehatan usus.',
    weight: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_3',
    quizId: 'quiz_1',
    type: 'benar_salah',
    category: 'Literasi',
    chapter: 'Teks Fiksi',
    subChapter: 'Analisis Karakter Tokoh',
    difficulty: 'Mudah',
    cognitiveLevel: 'Pemahaman (L1)',
    tags: ['Fiksi', 'Sastra'],
    questionText: 'Tentukan Benar atau Salah untuk setiap pernyataan mengenai watak tokoh Pak Aris berikut!',
    stimulus: {
      type: 'text',
      title: 'Kutipan Cerpen: Pelita di Desa Sejahtera',
      content: 'Pak Aris selalu menyempatkan diri mengajar anak-anak di kolong jembatan selepas melaut. Meski fisiknya lelah, senyumnya tak pernah pudar ketika melihat anak-anak antusias membaca buku cerita bekas yang ia kumpulkan.',
    },
    trueFalseItems: [
      { id: 'tf_1', statement: 'Pak Aris memiliki sifat dermawan dan berjiwa sosial tinggi.', correctAnswer: true },
      { id: 'tf_2', statement: 'Pak Aris adalah seorang guru profesional di sekolah favorit kota.', correctAnswer: false },
      { id: 'tf_3', statement: 'Pak Aris mengumpulkan buku cerita bekas untuk anak-anak.', correctAnswer: true },
    ],
    discussion: 'Pak Aris adalah nelayan yang berjiwa sosial dan mengajar anak-anak dengan buku bekas.',
    weight: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_4',
    quizId: 'quiz_1',
    type: 'menjodohkan',
    category: 'Literasi',
    chapter: 'Teks Prosedur',
    subChapter: 'Peralatan Digital',
    difficulty: 'Sedang',
    cognitiveLevel: 'Aplikasi (L2)',
    tags: ['Teknologi', 'Prosedur'],
    questionText: 'Jodohkan istilah istilah teknologi berikut dengan fungsinya yang tepat!',
    matchingPairs: [
      { id: 'pair_1', leftItem: 'Firewall', rightItem: 'Sistem keamanan jaringan pembatas akses tak dikenal' },
      { id: 'pair_2', leftItem: 'Backup Data', rightItem: 'Proses pencadangan dokumen untuk mencegah kehilangan' },
      { id: 'pair_3', leftItem: 'Enkripsi', rightItem: 'Pengodean informasi rahasia agar aman saat dikirim' },
    ],
    discussion: 'Firewall untuk keamanan, Backup untuk cadangan, Enkripsi untuk penyandian data.',
    weight: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_5',
    quizId: 'quiz_1',
    type: 'uraian_pendek',
    category: 'Literasi',
    chapter: 'Teks Argumentasi',
    subChapter: 'Kritik Sosial',
    difficulty: 'Sukar',
    cognitiveLevel: 'Penalaran (L3)',
    tags: ['Opini', 'Uraian'],
    questionText: 'Jelaskan pendapat Anda dalam 2-3 kalimat mengenai pengaruh kecerdasan buatan (AI) terhadap masa depan dunia kerja!',
    discussion: 'Jawaban dinilai berdasarkan kejelasan argumentasi, struktur kalimat, dan relevansi pemikiran.',
    weight: 20,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_6',
    quizId: 'quiz_2',
    type: 'isian_angka',
    category: 'Numerasi',
    chapter: 'Statistika',
    subChapter: 'Rata-rata Hitung',
    difficulty: 'Sedang',
    cognitiveLevel: 'Aplikasi (L2)',
    tags: ['Numerasi', 'Statistika'],
    questionText: 'Data nilai ujian matematika 5 siswa adalah: 80, 85, 90, 75, dan 95. Berapakah nilai rata-rata (mean) dari kelima siswa tersebut?',
    numericAnswer: 85,
    numericTolerance: 0,
    discussion: 'Rata-rata = (80 + 85 + 90 + 75 + 95) / 5 = 425 / 5 = 85.',
    weight: 25,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'q_7',
    quizId: 'quiz_2',
    type: 'mengurutkan',
    category: 'Numerasi',
    chapter: 'Bilangan Pecahan',
    subChapter: 'Pengurutan Nilai',
    difficulty: 'Sedang',
    cognitiveLevel: 'Aplikasi (L2)',
    tags: ['Numerasi', 'Pecahan'],
    questionText: 'Urutkan pecahan berikut dari nilai TERKECIL hingga TERBESAR!',
    sequenceItems: ['1/4 (0.25)', '1/2 (0.50)', '3/4 (0.75)', '5/4 (1.25)'],
    discussion: '1/4 = 0.25 < 1/2 = 0.50 < 3/4 = 0.75 < 5/4 = 1.25.',
    weight: 25,
    createdAt: new Date().toISOString(),
  }
];

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

  // Seed default users, quizzes, subjects, questions, settings into Firestore if not present
  try {
    for (const u of DEFAULT_USERS) {
      const uRef = doc(db, 'users', u.uid);
      const uSnap = await getDoc(uRef);
      if (!uSnap.exists()) {
        await setDoc(uRef, u);
      }
    }
    for (const q of DEFAULT_QUIZZES) {
      const qRef = doc(db, 'quizzes', q.id);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists()) {
        await setDoc(qRef, q);
      }
    }
    for (const s of DEFAULT_SUBJECTS) {
      const sRef = doc(db, 'subjects', s.id);
      const sSnap = await getDoc(sRef);
      if (!sSnap.exists()) {
        await setDoc(sRef, s);
      }
    }
    for (const qst of DEFAULT_QUESTIONS) {
      const qstRef = doc(db, 'questions', qst.id);
      const qstSnap = await getDoc(qstRef);
      if (!qstSnap.exists()) {
        await setDoc(qstRef, qst);
      }
    }
    for (const p of DEFAULT_PARTICIPANTS) {
      const pRef = doc(db, 'participants', p.id);
      const pSnap = await getDoc(pRef);
      if (!pSnap.exists()) {
        await setDoc(pRef, p);
      }
    }
    const setRef = doc(db, 'settings', 'global');
    const setSnap = await getDoc(setRef);
    if (!setSnap.exists()) {
      await setDoc(setRef, DEFAULT_SETTINGS);
    }
  } catch (e) {
    console.warn('Firestore initial seed notice:', e);
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
