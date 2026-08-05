import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { QuestionItemEditor } from '../../components/questions/QuestionItemEditor';
import { QuestionItemViewer } from '../../components/questions/QuestionItemViewer';
import { Quiz, Question, Subject, QuizStatus } from '../../types';
import {
  getQuizById,
  saveQuiz,
  getSubjects,
  getQuestionsByQuiz,
  saveQuestion,
  deleteQuestion,
} from '../../services/db';
import { exportQuestionsToExcel } from '../../utils/excel';
import { parseQuestionsFromWord, downloadWordTemplate } from '../../utils/wordParser';
import {
  Plus,
  Save,
  ArrowLeft,
  FileText,
  Upload,
  Download,
  Trash2,
  Edit3,
  Eye,
  HelpCircle,
  Shuffle,
  EyeOff,
} from 'lucide-react';

export const QuizEditor: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Quiz Form Fields
  const [quizId] = useState<string>(id || `quiz_${Date.now()}`);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [targetClass, setTargetClass] = useState('Semua Kelas');
  const [duration, setDuration] = useState(45);
  const [minPassingGrade, setMinPassingGrade] = useState(75);
  const [randomizeQuestions, setRandomizeQuestions] = useState(true);
  const [randomizeAnswers, setRandomizeAnswers] = useState(true);
  const [showGrade, setShowGrade] = useState(true);
  const [showDiscussion, setShowDiscussion] = useState(true);
  const [status, setStatus] = useState<QuizStatus>('PUBLISHED');
  const [token, setToken] = useState('');

  // Question Modals
  const wordFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | undefined>(undefined);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const sList = await getSubjects();
      setSubjects(sList);

      if (id) {
        const q = await getQuizById(id);
        if (q) {
          setTitle(q.title);
          setDescription(q.description);
          setSubjectId(q.subjectId);
          setTargetClass(q.targetClass);
          setDuration(q.duration);
          setMinPassingGrade(q.minPassingGrade);
          setRandomizeQuestions(q.randomizeQuestions);
          setRandomizeAnswers(q.randomizeAnswers);
          setShowGrade(q.showGrade);
          setShowDiscussion(q.showDiscussion);
          setStatus(q.status);
          setToken(q.token || '');

          const qstList = await getQuestionsByQuiz(id);
          setQuestions(qstList);
        }
      } else {
        setSubjectId(sList[0]?.id || '');
      }
    }
    load();
  }, [id]);

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const matchedSubject = subjects.find((s) => s.id === subjectId);

    const quizObj: Quiz = {
      id: quizId,
      title,
      description,
      subjectId,
      subjectName: matchedSubject?.name || 'Mata Pelajaran',
      targetClass,
      teacherId: user.uid,
      teacherName: user.name,
      duration: Number(duration),
      minPassingGrade: Number(minPassingGrade),
      randomizeQuestions,
      randomizeAnswers,
      showGrade,
      showDiscussion,
      status,
      token,
      questionCount: questions.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveQuiz(quizObj);

    // Save/Sync all questions associated with this quizId
    for (const q of questions) {
      await saveQuestion({ ...q, quizId });
    }

    showToast('Quiz dan soal berhasil disimpan!');
    navigate('/guru/quizzes');
  };

  const handleSaveQuestionItem = async (q: Question) => {
    await saveQuestion(q);
    const updated = await getQuestionsByQuiz(quizId);
    setQuestions(updated);
    setIsQuestionModalOpen(false);
    showToast('Soal berhasil disimpan!');
  };

  const handleDeleteQuestionItem = async (qId: string) => {
    const confirmed = await showConfirmDialog('Hapus Soal?', 'Apakah Anda yakin ingin menghapus soal ini?');
    if (confirmed) {
      await deleteQuestion(qId, quizId);
      const updated = await getQuestionsByQuiz(quizId);
      setQuestions(updated);
      showToast('Soal berhasil dihapus', 'info');
    }
  };

  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('Memproses file Word...');
      const parsed = await parseQuestionsFromWord(file);
      if (parsed.length === 0) {
        showToast('Tidak ditemukan format soal dalam file. Silakan unduh dan gunakan Template Word.', 'error');
        if (e.target) e.target.value = '';
        return;
      }

      const importedList: Question[] = [];
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        const newQ: Question = {
          id: `q_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
          quizId,
          type: item.type || 'pilihan_ganda',
          category: item.category || 'Literasi',
          chapter: item.chapter || 'Umum',
          subChapter: item.subChapter || '',
          difficulty: item.difficulty || 'Sedang',
          cognitiveLevel: item.cognitiveLevel || 'Aplikasi (L2)',
          questionText: item.questionText || 'Pertanyaan',
          stimulus: item.stimulus,
          options: ['pilihan_ganda', 'pg_kompleks', 'checklist', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(item.type || '')
            ? (item.options || [
                { id: 'opt_1', text: 'Pilihan A', isCorrect: true },
                { id: 'opt_2', text: 'Pilihan B', isCorrect: false },
              ])
            : item.options,
          matchingPairs: item.matchingPairs,
          trueFalseItems: item.trueFalseItems,
          correctAnswerText: item.correctAnswerText,
          numericAnswer: item.numericAnswer,
          sequenceItems: item.sequenceItems,
          weight: item.weight || 10,
          discussion: item.discussion || '',
          createdAt: new Date().toISOString(),
        };
        await saveQuestion(newQ);
        importedList.push(newQ);
      }

      setQuestions((prev) => [...prev, ...importedList]);
      showToast(`${importedList.length} soal berhasil di-import dari Word!`);
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses file Word', 'error');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guru/quizzes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {id ? 'Edit Quiz & Kelola Soal' : 'Buat Quiz TKA Baru'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Atur parameter quiz dan susun soal-soal kompetensi akademik.
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsPreviewOpen(true)} icon={<Eye className="w-4 h-4" />}>
            Preview Exam
          </Button>
          <Button onClick={handleSaveQuiz} icon={<Save className="w-4 h-4" />}>
            Simpan Quiz
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveQuiz} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Quiz Parameters */}
        <div className="lg:col-span-1 space-y-6">
          <Card title="Konfigurasi Quiz" subtitle="Parameter pelaksanaan dan tata tertib ujian">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Judul Quiz</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Asesmen Numerasi Grafik 2026"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Mata Pelajaran</label>
                <select
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-medium"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Kelas</label>
                  <input
                    type="text"
                    value={targetClass}
                    onChange={(e) => setTargetClass(e.target.value)}
                    placeholder="X RPL 1"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Durasi (Menit)</label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nilai Min (KKM)</label>
                <input
                  type="number"
                  value={minPassingGrade}
                  onChange={(e) => setMinPassingGrade(Number(e.target.value))}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Deskripsi Ujian</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Isi petunjuk tambahan atau ruang lingkup quiz..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              {/* Toggles */}
              <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-700">
                <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                  <span>Acak Urutan Soal</span>
                  <input
                    type="checkbox"
                    checked={randomizeQuestions}
                    onChange={(e) => setRandomizeQuestions(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB]"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                  <span>Acak Pilihan Jawaban</span>
                  <input
                    type="checkbox"
                    checked={randomizeAnswers}
                    onChange={(e) => setRandomizeAnswers(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB]"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                  <span>Tampilkan Nilai ke Siswa</span>
                  <input
                    type="checkbox"
                    checked={showGrade}
                    onChange={(e) => setShowGrade(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB]"
                  />
                </label>
                <label className="flex items-center justify-between text-xs font-semibold cursor-pointer">
                  <span>Tampilkan Pembahasan Soal</span>
                  <input
                    type="checkbox"
                    checked={showDiscussion}
                    onChange={(e) => setShowDiscussion(e.target.checked)}
                    className="w-4 h-4 text-[#2563EB]"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Status Publikasi</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as QuizStatus)}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-bold"
                >
                  <option value="PUBLISHED">PUBLISHED (Dapat Diakses Siswa)</option>
                  <option value="DRAFT">DRAFT (Disimpan Sementara)</option>
                  <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Question Item Management */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            title={`Daftar Soal TKA (${questions.length} Soal)`}
            subtitle="Tambahkan, edit, atau import bank soal TKA"
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={downloadWordTemplate}
                  icon={<Download className="w-3.5 h-3.5" />}
                  title="Unduh Format Template Soal Word (.doc)"
                >
                  Template Word
                </Button>
                <input
                  ref={wordFileInputRef}
                  type="file"
                  accept=".docx,.doc,.html,.txt"
                  onChange={handleImportWord}
                  className="hidden"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => wordFileInputRef.current?.click()}
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  Import Word
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setEditingQuestion(undefined);
                    setIsQuestionModalOpen(true);
                  }}
                  icon={<Plus className="w-3.5 h-3.5" />}
                >
                  Tambah Soal
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/50 dark:bg-slate-800/50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-[#2563EB] text-white text-xs font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <Badge variant="primary">{q.category}</Badge>
                      <Badge variant="slate">{q.cognitiveLevel}</Badge>
                      <Badge variant="secondary">Bobot: {q.weight}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingQuestion(q);
                          setIsQuestionModalOpen(true);
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteQuestionItem(q.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                    {q.questionText}
                  </p>
                </div>
              ))}

              {questions.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Belum ada soal dalam quiz ini. Klik "Tambah Soal" atau "Import Word" di atas.
                </div>
              )}
            </div>
          </Card>
        </div>
      </form>

      {/* Question Editor Modal */}
      <Modal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
        title={editingQuestion ? 'Edit Soal TKA' : 'Tambah Soal Baru'}
        maxWidth="2xl"
      >
        <QuestionItemEditor
          question={editingQuestion}
          quizId={quizId}
          onSave={handleSaveQuestionItem}
          onCancel={() => setIsQuestionModalOpen(false)}
        />
      </Modal>

      {/* Preview Exam Modal */}
      <Modal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} title="Preview Soal Ujian" maxWidth="3xl">
        <div className="space-y-6">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 rounded-xl text-xs font-semibold text-blue-800 dark:text-blue-200">
            📌 Tampilan simulasi berikut sesuai dengan yang akan dikerjakan oleh siswa di halaman ujian.
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 border rounded-2xl bg-white dark:bg-slate-800">
              <QuestionItemViewer question={q} number={i + 1} value={null} onChange={() => {}} showDiscussion={true} />
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
};
