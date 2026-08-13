import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Quiz, Question, UserAnswer } from '../../types';
import { getQuizById, saveStudentExamResult } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/ui/Toast';
import QuestionItemViewer from '../../components/questions/QuestionItemViewer';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  Grid,
  AlertTriangle,
  Flag,
  CheckCircle2,
} from 'lucide-react';

export default function StudentExam() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, UserAnswer>>({});
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchQuiz = async () => {
      try {
        const q = await getQuizById(id);
        if (!q) {
          showToast('Quiz tidak ditemukan.', 'error');
          navigate('/siswa/quizzes');
          return;
        }
        setQuiz(q);
        setQuestions(q.questions || []);
        setTimeLeft(q.durationMinutes * 60);

        // Load saved session if available in localStorage
        const savedSessionKey = `exam_session_${id}_${currentUser?.uid}`;
        const saved = localStorage.getItem(savedSessionKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.userAnswers) setUserAnswers(parsed.userAnswers);
            if (parsed.flaggedMap) setFlaggedMap(parsed.flaggedMap);
            if (typeof parsed.timeLeft === 'number' && parsed.timeLeft > 0) {
              setTimeLeft(parsed.timeLeft);
            }
          } catch (e) {
            console.error('Error loading exam state:', e);
          }
        }
      } catch (err) {
        showToast('Gagal memuat data quiz.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [id, currentUser?.uid, navigate]);

  // Timer countdown
  useEffect(() => {
    if (isLoading || !quiz) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLoading, quiz]);

  // Auto save to localStorage
  useEffect(() => {
    if (!id || !currentUser?.uid || isLoading) return;
    const savedSessionKey = `exam_session_${id}_${currentUser?.uid}`;
    localStorage.setItem(
      savedSessionKey,
      JSON.stringify({ userAnswers, flaggedMap, timeLeft })
    );
  }, [userAnswers, flaggedMap, timeLeft, id, currentUser?.uid, isLoading]);

  const handleAnswerChange = (questionId: string, answer: UserAnswer) => {
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedMap((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleAutoSubmit = async () => {
    showToast('Waktu habis! Ujian otomatis dikirim.', 'warning');
    await processSubmit();
  };

  const handleFinalSubmit = async () => {
    setIsSubmitModalOpen(false);
    await processSubmit();
  };

  const processSubmit = async () => {
    if (!quiz || !currentUser) return;
    setIsSubmitting(true);

    try {
      // Calculate Score
      let totalScore = 0;
      let maxScore = 0;

      questions.forEach((q) => {
        const weight = q.weight || 10;
        maxScore += weight;
        const uAns = userAnswers[q.id];

        if (!uAns) return;

        if (q.type === 'pilihan_ganda' || q.type === 'uraian_pendek' || q.type === 'isian_angka') {
          const correctKey = (q.options?.find((o) => o.isCorrect)?.text || '').trim().toLowerCase();
          const userKey = (String(uAns) || '').trim().toLowerCase();
          if (userKey && correctKey && userKey === correctKey) {
            totalScore += weight;
          }
        } else if (q.type === 'pg_kompleks') {
          const correctOpts = q.options?.filter((o) => o.isCorrect).map((o) => o.id) || [];
          const userOpts = Array.isArray(uAns) ? (uAns as string[]) : [];
          const isMatch =
            correctOpts.length === userOpts.length &&
            correctOpts.every((id) => userOpts.includes(id));
          if (isMatch) {
            totalScore += weight;
          }
        } else if (q.type === 'benar_salah') {
          const uObj = uAns as Record<string, string>;
          let correctCount = 0;
          const opts = q.options || [];
          opts.forEach((o) => {
            const expected = o.isCorrect ? 'BENAR' : 'SALAH';
            if (uObj && uObj[o.id] === expected) {
              correctCount++;
            }
          });
          if (opts.length > 0) {
            totalScore += (correctCount / opts.length) * weight;
          }
        } else if (q.type === 'menjodohkan') {
          const uObj = uAns as Record<string, string>;
          let correctCount = 0;
          const opts = q.options || [];
          opts.forEach((o) => {
            if (uObj && uObj[o.id] === o.text) {
              correctCount++;
            }
          });
          if (opts.length > 0) {
            totalScore += (correctCount / opts.length) * weight;
          }
        }
      });

      const finalGrade = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      await saveStudentExamResult({
        quizId: quiz.id,
        studentId: currentUser.uid,
        studentName: currentUser.displayName || 'Siswa',
        score: finalGrade,
        answers: userAnswers,
        submittedAt: new Date().toISOString(),
      });

      // Clear local storage
      const savedSessionKey = `exam_session_${quiz.id}_${currentUser.uid}`;
      localStorage.removeItem(savedSessionKey);

      showToast('Ujian berhasil dikirim!', 'success');
      navigate(`/siswa/quiz-result/${quiz.id}`);
    } catch (err) {
      console.error(err);
      showToast('Gagal mengirim jawaban. Coba lagi.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
        <h2 className="text-xl font-bold mb-2">Soal Ujian Kosong</h2>
        <p className="text-slate-400 mb-4">Quiz ini belum memiliki soal.</p>
        <Button onClick={() => navigate('/siswa/quizzes')}>Kembali ke Daftar Quiz</Button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];

  const checkIsAnswered = (val: any): boolean => {
    if (val === undefined || val === null || val === '') return false;
    if (Array.isArray(val)) return val.length > 0;
    if (typeof val === 'object') {
      const keys = Object.keys(val);
      if (keys.length === 0) return false;
      return keys.some((k) => val[k] !== undefined && val[k] !== null && val[k] !== '');
    }
    return true;
  };

  const answeredCount = questions.filter((q) => checkIsAnswered(userAnswers[q.id])).length;
  const progressPercent = Math.round((answeredCount / (questions.length || 1)) * 100);

  const unansweredIndices = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !checkIsAnswered(userAnswers[q.id]))
    .map(({ idx }) => idx);

  const flaggedIndices = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !!flaggedMap[q.id])
    .map(({ idx }) => idx);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDrawerOpen(!isDrawerOpen)}
              className="lg:hidden"
            >
              <Grid className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-slate-800 dark:text-slate-100 text-sm sm:text-base line-clamp-1">
                {quiz.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Soal {currentIndex + 1} dari {questions.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold shadow-inner ${
                timeLeft < 300
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <Button
              variant="success"
              size="sm"
              onClick={() => setIsSubmitModalOpen(true)}
              className="font-bold"
            >
              <Send className="w-4 h-4 mr-1.5" />
              <span>Selesai</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex gap-6">
        {/* Left Side: Question Viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 sm:p-6 shadow-sm flex-1 flex flex-col">
            <div className="flex-1">
              <QuestionItemViewer
                question={currentQ}
                index={currentIndex}
                userAnswer={userAnswers[currentQ.id]}
                onAnswerChange={(ans) => handleAnswerChange(currentQ.id, ans)}
              />
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                <span>Sebelumnya</span>
              </Button>

              <Button
                variant={flaggedMap[currentQ.id] ? 'warning' : 'outline'}
                onClick={() => handleToggleFlag(currentQ.id)}
                size="sm"
              >
                <Flag className="w-4 h-4 mr-1.5" />
                <span>Ragu-ragu</span>
              </Button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                >
                  <span>Selanjutnya</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button variant="success" onClick={() => setIsSubmitModalOpen(true)}>
                  <span>Kirim Jawaban</span>
                  <Send className="w-4 h-4 ml-1.5" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Question Navigation Grid (Desktop) */}
        <aside className="hidden lg:block w-72 shrink-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm sticky top-20">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-3">
              Navigasi Soal
            </h3>

            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Kemajuan</span>
                <span className="font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = checkIsAnswered(userAnswers[q.id]);
                const isFlagged = flaggedMap[q.id];
                const isCurrent = idx === currentIndex;

                let btnClass = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
                if (isCurrent) {
                  btnClass = 'bg-blue-600 text-white font-bold ring-2 ring-blue-400';
                } else if (isFlagged) {
                  btnClass = 'bg-amber-500 text-white font-bold';
                } else if (isAnswered) {
                  btnClass = 'bg-emerald-600 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 text-xs space-y-2 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-emerald-600" />
                <span>Sudah Dijawab</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Ragu-ragu</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700" />
                <span>Belum Dijawab</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Konfirmasi Selesai Ujian"
      >
        <div className="text-center space-y-4 py-2">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Apakah Anda yakin ingin menyelesaikan ujian ini?
          </h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Anda telah menjawab <span className="font-bold text-slate-800 dark:text-slate-100">{answeredCount}</span> dari{' '}
            <span className="font-bold text-slate-800 dark:text-slate-100">{questions.length}</span> soal. Setelah dikirim, Anda tidak dapat mengubah jawaban lagi.
          </p>

          {/* Peringatan Soal Belum Terjawab */}
          {unansweredIndices.length > 0 ? (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl p-3.5 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Peringatan: {unansweredIndices.length} Soal BELUM Dijawab!</span>
              </div>
              <p className="text-amber-800 dark:text-amber-300 text-[11px]">
                Berikut adalah nomor soal yang masih kosong:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {unansweredIndices.map((qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => {
                      setCurrentIndex(qIdx);
                      setIsSubmitModalOpen(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 dark:bg-amber-900 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-black text-xs transition-colors cursor-pointer shadow-sm flex items-center gap-1"
                    title={`Klik untuk menjawab Soal No. ${qIdx + 1}`}
                  >
                    <span>No. {qIdx + 1}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-amber-700 dark:text-amber-400 italic pt-1">
                *Klik nomor soal di atas untuk langsung berpindah dan menjawabnya.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Semua {questions.length} soal telah dijawab!</span>
            </div>
          )}

          {/* Catatan Soal Ragu-Ragu */}
          {flaggedIndices.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-left text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold">
                <Flag className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Catatan: {flaggedIndices.length} Soal Berstatus Ragu-Ragu</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {flaggedIndices.map((qIdx) => (
                  <button
                    key={qIdx}
                    onClick={() => {
                      setCurrentIndex(qIdx);
                      setIsSubmitModalOpen(false);
                    }}
                    className="px-2.5 py-0.5 rounded-md bg-amber-400/30 hover:bg-amber-400/50 text-amber-900 dark:text-amber-200 font-bold text-xs transition-colors cursor-pointer"
                  >
                    No. {qIdx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsSubmitModalOpen(false)}>
              Batal
            </Button>
            <Button variant="success" onClick={handleFinalSubmit} isLoading={isSubmitting}>
              Ya, Kirim Sekarang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}