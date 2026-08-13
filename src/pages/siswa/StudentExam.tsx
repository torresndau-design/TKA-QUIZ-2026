import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { QuestionItemViewer } from '../../components/questions/QuestionItemViewer';
import { ZoomControls } from '../../components/common/ZoomControls';
import { Quiz, Question, Participant, Answer } from '../../types';
import {
  getQuizById,
  getQuestionsByQuiz,
  getParticipantById,
  saveAnswer,
  getAnswersByParticipant,
  saveParticipant,
} from '../../services/db';
import { evaluateAnswer } from '../../utils/grading';
import {
  Clock,
  Maximize2,
  Minimize2,
  Flag,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const StudentExam: React.FC = () => {
  const { quizId, participantId } = useParams<{ quizId: string; participantId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // User responses state: Record<questionId, any>
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [flaggedMap, setFlaggedMap] = useState<Record<string, boolean>>({});

  // Countdown timer state in seconds
  const [timeLeft, setTimeLeft] = useState<number>(3600);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [violations, setViolations] = useState<number>(0);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Accessibility font scaling (100 = default)
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(100);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Refs for tracking active intervals and state across renders
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // Load initial exam data
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!quizId || !participantId) {
        setError('Parameter URL tidak lengkap.');
        setLoading(false);
        return;
      }

      try {
        const [fetchedQuiz, fetchedQuestions, fetchedParticipant, fetchedAnswers] =
          await Promise.all([
            getQuizById(quizId),
            getQuestionsByQuiz(quizId),
            getParticipantById(participantId),
            getAnswersByParticipant(participantId),
          ]);

        if (!isMounted) return;

        if (!fetchedQuiz) {
          setError('Kuis tidak ditemukan.');
          setLoading(false);
          return;
        }

        if (!fetchedParticipant) {
          setError('Data peserta tidak ditemukan.');
          setLoading(false);
          return;
        }

        // If participant already completed the exam, redirect to result
        if (fetchedParticipant.status === 'completed') {
          navigate(`/siswa/hasil/${participantId}`);
          return;
        }

        setQuiz(fetchedQuiz);
        setQuestions(fetchedQuestions);
        setParticipant(fetchedParticipant);

        // Prepopulate existing answers if student reloaded
        const answersMap: Record<string, any> = {};
        const flagged: Record<string, boolean> = {};

        fetchedAnswers.forEach((ans) => {
          answersMap[ans.questionId] = ans.answer;
          if (ans.isFlagged) {
            flagged[ans.questionId] = true;
          }
        });

        setUserAnswers(answersMap);
        setFlaggedMap(flagged);

        // Initialize Timer
        const now = Date.now();
        const startTime = new Date(fetchedParticipant.startedAt).getTime();
        const durationSeconds = (fetchedQuiz.durationMinutes || 60) * 60;
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsedSeconds);

        setTimeLeft(remaining);
      } catch (err) {
        console.error('Error loading exam:', err);
        setError('Gagal memuat data ujian.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [quizId, participantId, navigate]);

  // Handle countdown timer tick
  useEffect(() => {
    if (loading || error || !participant) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, error, participant]);

  // Auto-save answer to database when changed
  const handleAnswerChange = async (val: any) => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !participantId) return;

    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: val }));

    const answerRecord: Answer = {
      participantId,
      questionId: currentQ.id,
      answer: val,
      isFlagged: !!flaggedMap[currentQ.id],
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveAnswer(answerRecord);
    } catch (e) {
      console.error('Gagal menyimpan jawaban:', e);
    }
  };

  const toggleFlag = async () => {
    const currentQ = questions[currentIndex];
    if (!currentQ || !participantId) return;

    const newFlag = !flaggedMap[currentQ.id];
    setFlaggedMap((prev) => ({ ...prev, [currentQ.id]: newFlag }));

    const answerRecord: Answer = {
      participantId,
      questionId: currentQ.id,
      answer: userAnswers[currentQ.id] || null,
      isFlagged: newFlag,
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveAnswer(answerRecord);
    } catch (e) {
      console.error('Gagal memperbarui status ragu-ragu:', e);
    }
  };

  const handleFinalSubmit = async () => {
    if (isSubmittingRef.current || !participant || !quiz) return;
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      // Calculate final score
      let totalScore = 0;
      let maxScore = 0;

      questions.forEach((q) => {
        const weight = q.weight || 10;
        maxScore += weight;
        const uAns = userAnswers[q.id];
        if (uAns !== undefined && uAns !== null) {
          const isCorrect = evaluateAnswer(q, uAns);
          if (isCorrect) totalScore += weight;
        }
      });

      const finalGrade = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      const updatedParticipant: Participant = {
        ...participant,
        status: 'completed',
        completedAt: new Date().toISOString(),
        score: finalGrade,
      };

      await saveParticipant(updatedParticipant);

      try {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } catch (e) {
        // Ignore if confetti fails
      }

      showToast('Ujian telah selesai dikirim!', 'success');
      navigate(`/siswa/hasil/${participantId}`);
    } catch (err) {
      console.error('Error submitting exam:', err);
      showToast('Gagal mengirim jawaban, coba lagi.', 'error');
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-400">Memuat Lembar Ujian...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
        <Card className="max-w-md w-full p-6 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Gagal Memuat Ujian</h3>
          <p className="text-xs text-slate-500">{error || 'Data kuis atau soal kosong.'}</p>
          <Button onClick={() => navigate('/')}>Kembali ke Beranda</Button>
        </Card>
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

  const unansweredIndices = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !checkIsAnswered(userAnswers[q.id]))
    .map(({ idx }) => idx);

  const flaggedIndices = questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !!flaggedMap[q.id])
    .map(({ idx }) => idx);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex flex-col font-sans select-none">
      {/* Header Bar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 px-4 py-2.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-bold text-sm sm:text-base text-slate-800 dark:text-slate-100 line-clamp-1">
                {quiz.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Peserta: <span className="font-bold text-slate-700 dark:text-slate-300">{participant?.studentName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ZoomControls
              fontSizeLevel={fontSizeLevel}
              onZoomIn={() => setFontSizeLevel((prev) => Math.min(prev + 10, 150))}
              onZoomOut={() => setFontSizeLevel((prev) => Math.max(prev - 10, 80))}
              onReset={() => setFontSizeLevel(100)}
            />

            {/* Timer Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold ${
                timeLeft < 300
                  ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="hidden sm:flex"
              title="Layar Penuh"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

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

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col lg:flex-row gap-6">
        {/* Left Side: Question Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Card className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-6">
            <QuestionItemViewer
              question={currentQ}
              number={currentIndex + 1}
              value={userAnswers[currentQ.id]}
              onChange={handleAnswerChange}
              fontSizeLevel={fontSizeLevel}
            />

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                <span>Sebelumnya</span>
              </Button>

              <Button
                variant={flaggedMap[currentQ.id] ? 'warning' : 'outline'}
                onClick={toggleFlag}
                size="sm"
              >
                <Flag className="w-4 h-4 mr-1.5" />
                <span>Ragu-Ragu</span>
              </Button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                >
                  <span>Selanjutnya</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button variant="success" onClick={() => setIsSubmitModalOpen(true)}>
                  <span>Kirim Jawaban</span>
                  <Send className="w-4 h-4 ml-1.5" />
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right Side: Question Navigation Grid */}
        <div className="w-full lg:w-72 shrink-0">
          <Card className="p-4 sticky top-20">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Navigasi Soal
            </h3>

            <div className="grid grid-cols-5 gap-2 max-h-80 overflow-y-auto p-0.5">
              {questions.map((q, idx) => {
                const isAnswered = checkIsAnswered(userAnswers[q.id]);
                const isFlagged = flaggedMap[q.id];
                const isCurrent = idx === currentIndex;

                let btnStyle = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
                if (isCurrent) {
                  btnStyle = 'bg-blue-600 text-white font-bold ring-2 ring-blue-400';
                } else if (isFlagged) {
                  btnStyle = 'bg-amber-400 text-slate-900 font-bold';
                } else if (isAnswered) {
                  btnStyle = 'bg-emerald-500 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs space-y-2 text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" /> Sudah Dijawab
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" /> Ragu-Ragu
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700" /> Belum Dijawab
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Submit Modal */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Konfirmasi Selesai Ujian"
      >
        <div className="space-y-4 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">
            Apakah Anda yakin ingin menyelesaikan ujian ini?
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
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
            <Button variant="success" isLoading={submitting} onClick={handleFinalSubmit}>
              Ya, Kirim Sekarang
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};