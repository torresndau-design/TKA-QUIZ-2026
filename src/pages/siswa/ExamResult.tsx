import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { QuestionItemViewer } from '../../components/questions/QuestionItemViewer';
import { Quiz, Participant, Question, Answer } from '../../types';
import {
  getQuizById,
  getParticipantById,
  getQuestionsByQuiz,
  getAnswersByParticipant,
} from '../../services/db';
import { CheckCircle2, Award, FileText, Home, ArrowLeft, LogOut } from 'lucide-react';

export const ExamResult: React.FC = () => {
  const { participantId } = useParams<{ participantId: string }>();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!participantId) return;
      setLoading(true);
      const pData = await getParticipantById(participantId);
      if (pData) {
        setParticipant(pData);
        const [qData, qstList, ansList] = await Promise.all([
          getQuizById(pData.quizId),
          getQuestionsByQuiz(pData.quizId),
          getAnswersByParticipant(participantId),
        ]);
        setQuiz(qData);
        setQuestions(qstList);
        setAnswers(ansList);
      }
      setLoading(false);
    }
    load();
  }, [participantId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Memuat hasil pengerjaan...</div>;
  }

  if (!participant || !quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md text-center p-8 space-y-3">
          <h2 className="text-xl font-bold text-slate-800">Data Hasil Tidak Ditemukan</h2>
        </Card>
      </div>
    );
  }

  const isPassed = (participant.score || 0) >= quiz.minPassingGrade;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-12 px-4 flex justify-center">
      <div className="w-full max-w-3xl space-y-6">
        {/* Main Result Header */}
        <Card className="text-center p-8 space-y-4 border-2 border-blue-100 dark:border-slate-700 shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">
            Jawaban Berhasil Dikirim!
          </h1>
          <p className="text-xs text-slate-500">
            Terima kasih, <span className="font-bold text-slate-800 dark:text-slate-100">{participant.fullName}</span> ({participant.studentClass}). Hasil ujian Anda telah tersimpan secara permanen.
          </p>

          {/* If teacher allowed showing grade */}
          {quiz.showGrade ? (
            <div className="pt-4 border-t space-y-4">
              <div className="inline-block p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400 block mb-1">
                  Nilai Akhir Ujian
                </span>
                <span className="text-5xl font-black text-[#2563EB]">{participant.score}</span>
                <span className="text-sm text-slate-400"> / 100</span>

                <div className="mt-3">
                  <Badge variant={isPassed ? 'success' : 'danger'}>
                    {isPassed ? 'LULUS KKM' : 'REMIDI'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto text-center">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 font-bold uppercase block">Jumlah Benar</span>
                  <span className="text-lg font-black text-emerald-700">{participant.correctCount} Soal</span>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200">
                  <span className="text-[10px] text-red-600 font-bold uppercase block">Jumlah Salah</span>
                  <span className="text-lg font-black text-red-700">{participant.wrongCount} Soal</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 text-xs text-blue-800 dark:text-blue-200 font-semibold">
              Nilai dan pembahasan ujian disembunyikan oleh guru pengampu. Silakan tanyakan hasil kepada guru Anda.
            </div>
          )}

          {/* Exit / Return Navigation */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3 border-t">
            <Link to={`/exam/${quiz.id}`}>
              <Button variant="outline" icon={<Home className="w-4 h-4" />}>
                Selesai & Keluar Ke Halaman Utama
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary" icon={<LogOut className="w-4 h-4" />}>
                Login Guru / Admin
              </Button>
            </Link>
          </div>
        </Card>

        {/* Detailed Discussion Review if permitted */}
        {quiz.showGrade && quiz.showDiscussion && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#2563EB]" /> Pembahasan Soal
            </h3>
            {questions.map((q, i) => {
              const ansObj = answers.find((a) => a.questionId === q.id);
              return (
                <Card key={q.id}>
                  <QuestionItemViewer
                    question={q}
                    number={i + 1}
                    value={ansObj?.userAnswer}
                    onChange={() => {}}
                    showDiscussion={true}
                  />
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
