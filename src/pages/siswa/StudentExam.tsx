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
  const [fontSizeLevel, setFontSizeLevel] = useState(100);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (!quizId || !participantId) {
        setError('Parameter ujian tidak valid.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [qData, qstList, pData, existingAns] = await Promise.all([
          getQuizById(quizId),
          getQuestionsByQuiz(quizId),
          getParticipantById(participantId),
          getAnswersByParticipant(participantId),
        ]);

        if (!qData) {
          setError('Quiz tidak ditemukan atau telah dihapus oleh guru.');
          setLoading(false);
          return;
        }

        let currentParticipant = pData;
        if (!currentParticipant) {
          const stored = localStorage.getItem(`akm_active_participant_${quizId}`);
          if (stored) {
            try {
              currentParticipant = JSON.parse(stored);
            } catch (e) {
              console.warn(e);
            }
          }
        }

        if (!currentParticipant) {
          setError('Data peserta ujian tidak ditemukan. Silakan masuk kembali melalui halaman pendaftaran.');
          setLoading(false);
          return;
        }

        setQuiz(qData);
        setQuestions(qData.randomizeQuestions ? [...qstList].sort(() => Math.random() - 0.5) : qstList);
        setParticipant(currentParticipant);

        // Restore time left or set default duration
        const durationSeconds = (qData.duration || 45) * 60;
        const elapsedSeconds = Math.floor((Date.now() - new Date(currentParticipant.startedAt).getTime()) / 1000);
        const remaining = Math.max(0, durationSeconds - elapsedSeconds);
        setTimeLeft(remaining);

        // Restore saved answers
        const ansMap: Record<string, any> = {};
        const flagMap: Record<string, boolean> = {};
        existingAns.forEach((a) => {
          ansMap[a.questionId] = a.userAnswer;
          flagMap[a.questionId] = !!a.isFlagged;
        });
        setUserAnswers(ansMap);
        setFlaggedMap(flagMap);
      } catch (err) {
        console.error('StudentExam init error:', err);
        setError('Gagal memuat ujian. Silakan periksa koneksi internet Anda dan coba lagi.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [quizId, participantId]);

  // Timer Tick Effect
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Anti-cheat tab switch detector
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations((prev) => {
          const nextVal = prev + 1;
          showToast(`Peringatan: Dilarang membuka tab/aplikasi lain! (${nextVal}x)`, 'warning');
          return nextVal;
        });
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const currentQuestion = questions[currentIndex];

  const handleAnswerChange = async (val: any) => {
    if (!currentQuestion || !participantId || !quizId) return;
    const updatedAnswers = { ...userAnswers, [currentQuestion.id]: val };
    setUserAnswers(updatedAnswers);

    // Auto Save to Firestore & Local Storage
    const ansObj: Answer = {
      id: `${participantId}_${currentQuestion.id}`,
      participantId,
      quizId,
      questionId: currentQuestion.id,
      userAnswer: val,
      isFlagged: flaggedMap[currentQuestion.id] || false,
      updatedAt: new Date().toISOString(),
    };
    await saveAnswer(ansObj);
  };

  const handleToggleFlag = async () => {
    if (!currentQuestion || !participantId || !quizId) return;
    const nextFlagState = !flaggedMap[currentQuestion.id];
    setFlaggedMap({ ...flaggedMap, [currentQuestion.id]: nextFlagState });

    const ansObj: Answer = {
      id: `${participantId}_${currentQuestion.id}`,
      participantId,
      quizId,
      questionId: currentQuestion.id,
      userAnswer: userAnswers[currentQuestion.id] ?? null,
      isFlagged: nextFlagState,
      updatedAt: new Date().toISOString(),
    };
    await saveAnswer(ansObj);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleFinalSubmit = async () => {
    if (!participant || !quiz) return;
    setSubmitting(true);

    let totalWeight = 0;
    let earnedWeight = 0;
    let correctCount = 0;
    let wrongCount = 0;

    for (const q of questions) {
      totalWeight += q.weight;
      const userVal = userAnswers[q.id];
      const result = evaluateAnswer(q, userVal);

      if (result.isCorrect) {
        correctCount++;
        earnedWeight += result.scoreGiven;
      } else {
        wrongCount++;
      }

      // Save complete evaluated answer record to database
      const ansObj: Answer = {
        id: `${participant.id}_${q.id}`,
        participantId: participant.id,
        quizId: quiz.id,
        questionId: q.id,
        userAnswer: userVal ?? null,
        isCorrect: result.isCorrect,
        scoreGiven: result.scoreGiven,
        isFlagged: !!flaggedMap[q.id],
        updatedAt: new Date().toISOString(),
      };
      await saveAnswer(ansObj);
    }

    const finalScorePercentage = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    const updatedParticipant: Participant = {
      ...participant,
      submittedAt: new Date().toISOString(),
      isFinished: true,
      score: finalScorePercentage,
      correctCount,
      wrongCount,
      antiCheatViolations: violations,
    };

    await saveParticipant(updatedParticipant);
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    showToast('Jawaban berhasil dikirim!');
    navigate(`/exam/result/${participant.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-300 font-bold text-sm">Memuat lembar ujian...</p>
      </div>
    );
  }

  if (error || !quiz || !participant) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 bg-slate-800 border-slate-700">
          <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Gagal Memuat Ujian</h2>
            <p className="text-xs text-slate-400">{error || 'Data ujian tidak dapat ditemukan.'}</p>
          </div>
          <Button onClick={() => navigate(quizId ? `/exam/${quizId}` : '/')} className="w-full">
            Kembali ke Halaman Masuk
          </Button>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 bg-slate-800 border-slate-700">
          <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Soal Belum Tersedia</h2>
            <p className="text-xs text-slate-400">
              Pengampu ujian ({quiz.teacherName || 'Guru'}) belum mengunggah soal untuk quiz "<b>{quiz.title}</b>".
            </p>
          </div>
          <Button onClick={() => navigate(`/exam/${quizId}`)} className="w-full">
            Kembali
          </Button>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 space-y-6 bg-slate-800 border-slate-700">
          <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100">Soal Tidak Ditemukan</h2>
            <p className="text-xs text-slate-400">Indeks soal tidak valid.</p>
          </div>
          <Button onClick={() => setCurrentIndex(0)} className="w-full">
            Kembali ke Soal Pertama
          </Button>
        </Card>
      </div>
    );
  }

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
      {/* Top Header Bar */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2 sm:space-x-3 overflow-hidden">
          <div className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate max-w-[160px] sm:max-w-xs">{quiz.title}</div>
          <span className="text-xs text-slate-400 hidden sm:inline">• {participant.fullName} ({participant.studentClass})</span>
        </div>

        {/* Timer & Zoom & Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <ZoomControls fontSizeLevel={fontSizeLevel} setFontSizeLevel={setFontSizeLevel} />

          <div className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-xl flex items-center space-x-1.5 sm:space-x-2 font-mono font-black text-xs sm:text-base shadow-sm ${
            timeLeft < 300 ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-50 dark:bg-blue-950 text-[#2563EB]'
          }`}>
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          <Button variant="success" size="sm" onClick={() => setIsSubmitModalOpen(true)} icon={<Send className="w-4 h-4" />}>
            <span className="hidden sm:inline">Selesai Ujian</span>
            <span className="sm:hidden">Kirim</span>
          </Button>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Left 3 Cols: Question Area */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-4 sm:p-6">
            <QuestionItemViewer
              question={currentQuestion}
              number={currentIndex + 1}
              value={userAnswers[currentQuestion.id]}
              onChange={handleAnswerChange}
              fontSizeLevel={fontSizeLevel}
            />

            {/* Bottom Controls */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => prev - 1)}
                icon={<ArrowLeft className="w-4 h-4" />}
              >
                Sebelumnya
              </Button>

              <button
                type="button"
                onClick={handleToggleFlag}
                className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  flaggedMap[currentQuestion.id]
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <Flag className="w-4 h-4" />
                <span>{flaggedMap[currentQuestion.id] ? 'Ragu-ragu (Ditandai)' : 'Ragu-ragu'}</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <Button
                  variant="primary"
                  onClick={() => setCurrentIndex((prev) => prev + 1)}
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Selanjutnya
                </Button>
              ) : (
                <Button
                  variant="success"
                  onClick={() => setIsSubmitModalOpen(true)}
                  icon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Kirim Jawaban
                </Button>
              )}
            </div>
          </Card>
        </div>

        {/* Right 1 Col: Question Number Grid Navigator */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Navigasi Soal" subtitle={`Terjawab: ${answeredCount} dari ${questions.length} Soal`}>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
              <div
                className="bg-[#2563EB] h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = checkIsAnswered(userAnswers[q.id]);
                const isFlagged = flaggedMap[q.id];
                const isCurrent = idx === currentIndex;

                let btnBg = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                if (isFlagged) {
                  btnBg = 'bg-amber-400 text-white font-bold';
                } else if (isAnswered) {
                  btnBg = 'bg-emerald-500 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl text-xs font-bold transition-all relative ${btnBg} ${
                      isCurrent ? 'ring-2 ring-offset-2 ring-blue-600 scale-105 z-10' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t space-y-2 text-[11px] font-semibold text-slate-500">
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
