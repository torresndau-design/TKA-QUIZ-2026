import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { getQuizzes, getAllQuestions } from '../../services/db';
import { Quiz, Question } from '../../types';
import { Link } from 'react-router-dom';
import { Plus, FileQuestion, HelpCircle, GraduationCap, ArrowRight, CheckCircle2 } from 'lucide-react';

export const GuruDashboard: React.FC = () => {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const [allQ, allQst] = await Promise.all([getQuizzes(), getAllQuestions()]);
      const myQuizzes = allQ.filter((q) => q.teacherId === user.uid);
      setQuizzes(myQuizzes);
      setQuestions(allQst);
    }
    load();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Welcome Hero Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#2563EB] to-[#0EA5E9] text-white shadow-lg shadow-blue-500/20">
        <h1 className="text-2xl font-black tracking-tight mb-1">
          Selamat Datang, {user?.name}! 👋
        </h1>
        <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
          Kelola asesmen kompetensi minimum (AKM), susun bank soal interaktif 16 tipe, dan pantau hasil analisis pengerjaan siswa secara mudah.
        </p>
        <div className="mt-4 flex gap-3">
          <Link to="/guru/quizzes/new">
            <Button variant="success" size="sm" icon={<Plus className="w-4 h-4" />}>
              Buat Quiz Baru
            </Button>
          </Link>
          <Link to="/guru/question-bank">
            <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 border-white/30 text-white">
              Bank Soal AKM
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-[#2563EB] rounded-2xl">
            <FileQuestion className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{quizzes.length}</div>
            <div className="text-xs text-slate-500 font-medium">Quiz Saya</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {quizzes.filter((q) => q.status === 'PUBLISHED').length}
            </div>
            <div className="text-xs text-slate-500 font-medium">Quiz Diterbitkan</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 dark:bg-sky-950 text-[#0EA5E9] rounded-2xl">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{questions.length}</div>
            <div className="text-xs text-slate-500 font-medium">Soal dalam Bank</div>
          </div>
        </Card>
      </div>

      {/* Recent Quizzes List */}
      <Card
        title="Daftar Quiz Terbaru Saya"
        subtitle="Kelola dan pantau pengerjaan quiz terbaru"
        action={
          <Link to="/guru/quizzes" className="text-xs text-[#2563EB] font-bold hover:underline flex items-center gap-1">
            Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        <div className="space-y-3">
          {quizzes.slice(0, 5).map((q) => (
            <div
              key={q.id}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{q.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {q.subjectName} • {q.targetClass} • {q.duration} Menit
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={q.status === 'PUBLISHED' ? 'success' : 'warning'}>
                  {q.status === 'PUBLISHED' ? 'Publik' : 'Draft'}
                </Badge>
                <Link to={`/guru/report/${q.id}`}>
                  <Button size="sm" variant="outline">
                    Laporan Nilai
                  </Button>
                </Link>
              </div>
            </div>
          ))}
          {quizzes.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs">
              Belum ada quiz yang dibuat. Klik "Buat Quiz Baru" untuk membuat quiz pertama Anda.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
