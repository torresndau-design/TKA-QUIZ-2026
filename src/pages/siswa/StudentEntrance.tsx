import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { showToast } from '../../components/common/Toast';
import { Quiz, AppSettings, Participant } from '../../types';
import { getQuizById, getQuizzes, getAppSettings, saveParticipant } from '../../services/db';
import { BookOpen, Clock, FileText, UserCheck, ShieldAlert, ArrowRight, LogIn } from 'lucide-react';

import { SchoolLogo } from '../../components/common/SchoolLogo';

export const StudentEntrance: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [nis, setNis] = useState('');
  const [studentClass, setStudentClass] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [qList, appSet] = await Promise.all([getQuizzes(), getAppSettings()]);
      setAvailableQuizzes(qList.filter((q) => q.status === 'PUBLISHED'));
      setSettings(appSet);

      if (quizId) {
        const qData = await getQuizById(quizId);
        setQuiz(qData);
      } else if (qList.length > 0) {
        setQuiz(qList[0]);
      }
      setLoading(false);
    }
    load();
  }, [quizId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 font-semibold text-sm">Memuat halaman ujian...</div>;
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center p-8 space-y-6 bg-slate-800 border-slate-700">
          <ShieldAlert className="w-14 h-14 text-red-500 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Quiz Tidak Ditemukan</h2>
            <p className="text-xs text-slate-400">Tautan quiz ini tidak valid atau telah dihapus oleh pengampu.</p>
          </div>

          {availableQuizzes.length > 0 && (
            <div className="text-left space-y-3 pt-4 border-t border-slate-700/80">
              <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">Ujian Aktif yang Tersedia:</p>
              <div className="space-y-2">
                {availableQuizzes.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/exam/${item.id}`)}
                    className="p-3 bg-slate-700/60 hover:bg-slate-700 rounded-xl cursor-pointer transition-all border border-slate-600/50 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-white">{item.title}</h4>
                      <p className="text-[11px] text-slate-400">{item.subjectName} • {item.duration} Menit</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/login')} className="text-xs gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> Login Guru / Admin
            </Button>
            <Button onClick={() => navigate('/exam/quiz_1')} className="text-xs gap-1.5">
              Simulasi Quiz 1
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const handleStartExam = async (e: React.FormEvent) => {
    e.preventDefault();

    const participantObj: Participant = {
      id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      quizId: quiz.id,
      fullName,
      nis,
      studentClass,
      startedAt: new Date().toISOString(),
      isFinished: false,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      antiCheatViolations: 0,
    };

    await saveParticipant(participantObj);
    localStorage.setItem(`akm_active_participant_${quiz.id}`, JSON.stringify(participantObj));
    showToast('Selamat mengerjakan ujian!');
    navigate(`/exam/${quiz.id}/live/${participantObj.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* School Kop */}
        <div className="text-center space-y-2">
          <SchoolLogo
            src={settings?.schoolLogoUrl}
            className="w-20 h-20 mx-auto object-contain drop-shadow-sm"
          />
          <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
            {settings?.schoolName || 'SMKS SANJAYA BAJAWA'}
          </h2>
          <p className="text-xs text-slate-500 font-semibold">Tahun Ajaran {settings?.academicYear || '2025/2026'}</p>
        </div>

        {/* Quiz Information Card */}
        <Card className="border-2 border-blue-100 dark:border-slate-700 shadow-xl space-y-4">
          <div className="border-b pb-3">
            <h1 className="text-xl font-black text-slate-800 dark:text-slate-100">{quiz.title}</h1>
            <p className="text-xs text-slate-500 mt-1">{quiz.description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2.5 bg-blue-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Mata Pelajaran</span>
              <span className="text-xs font-bold text-[#2563EB]">{quiz.subjectName}</span>
            </div>
            <div className="p-2.5 bg-sky-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Guru Pengampu</span>
              <span className="text-xs font-bold text-[#0EA5E9]">{quiz.teacherName}</span>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Durasi Ujian</span>
              <span className="text-xs font-bold text-emerald-600">{quiz.duration} Menit</span>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-slate-800 rounded-xl">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Jumlah Soal</span>
              <span className="text-xs font-bold text-amber-600">{quiz.questionCount || 0} Soal</span>
            </div>
          </div>

          {settings?.examInstructions && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <span className="font-bold block text-slate-800 dark:text-slate-100">📌 Petunjuk Ujian:</span>
              <p className="whitespace-pre-line leading-relaxed">{settings.examInstructions}</p>
            </div>
          )}

          {/* Student Form */}
          <form onSubmit={handleStartExam} className="space-y-4 pt-2 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Identitas Peserta Ujian</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap Siswa</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Masukkan nama lengkap Anda..."
                className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">NIS / NISN</label>
                <input
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="Contoh: 12345"
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kelas</label>
                <input
                  type="text"
                  required
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  placeholder="Contoh: X RPL 1"
                  className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>
            </div>

            <Button type="submit" className="w-full py-3 text-base shadow-lg shadow-blue-500/20">
              Mulai Mengerjakan Quiz
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
