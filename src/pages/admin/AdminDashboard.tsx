import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Skeleton } from '../../components/common/Skeleton';
import { Users, BookOpenCheck, FileQuestion, HelpCircle, GraduationCap, TrendingUp, Award, AlertCircle } from 'lucide-react';
import { getUsers, getSubjects, getQuizzes, getAllQuestions } from '../../services/db';
import { User, Subject, Quiz, Question } from '../../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export const AdminDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [uList, sList, qList, qstList] = await Promise.all([
        getUsers(),
        getSubjects(),
        getQuizzes(),
        getAllQuestions(),
      ]);
      setTeachers(uList.filter((u) => u.role === 'GURU'));
      setSubjects(sList);
      setQuizzes(qList);
      setQuestions(qstList);
      setLoading(false);
    }
    loadData();
  }, []);

  const totalParticipants = 48; // Simulated aggregate from exam records
  const highestScore = 100;
  const lowestScore = 45;

  const chartData = {
    labels: ['Simulasi Literasi', 'AKM Numerasi', 'Sains Dasar', 'Sosial Budaya', 'Tryout 1'],
    datasets: [
      {
        label: 'Jumlah Peserta Pengerjaan',
        data: [42, 38, 29, 18, 45],
        backgroundColor: '#2563EB',
        borderRadius: 8,
      },
      {
        label: 'Rata-Rata Nilai (%)',
        data: [82, 76, 88, 71, 79],
        backgroundColor: '#0EA5E9',
        borderRadius: 8,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
          Dashboard Administrator
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Ikhtisar sistem asesmen AKM, data statistik guru, mapel, dan hasil ujian.
        </p>
      </div>

      {/* Top Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950/60 rounded-2xl text-[#2563EB]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{teachers.length}</div>
            <div className="text-xs text-slate-500 font-medium">Jumlah Guru</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 dark:bg-sky-950/60 rounded-2xl text-[#0EA5E9]">
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{subjects.length}</div>
            <div className="text-xs text-slate-500 font-medium">Mata Pelajaran</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-2xl text-[#22C55E]">
            <FileQuestion className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{quizzes.length}</div>
            <div className="text-xs text-slate-500 font-medium">Total Quiz AKM</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-950/60 rounded-2xl text-[#F59E0B]">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{questions.length}</div>
            <div className="text-xs text-slate-500 font-medium">Jumlah Soal Bank</div>
          </div>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Total Peserta Ujian</span>
          </div>
          <span className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{totalParticipants} Siswa</span>
        </Card>

        <Card className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Award className="w-5 h-5 text-emerald-500" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Nilai Tertinggi</span>
          </div>
          <span className="text-lg font-extrabold text-emerald-600">{highestScore} / 100</span>
        </Card>

        <Card className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Nilai Terendah</span>
          </div>
          <span className="text-lg font-extrabold text-red-500">{lowestScore} / 100</span>
        </Card>
      </div>

      {/* Analytics Chart */}
      <Card title="Grafik Pengerjaan & Performa Quiz AKM" subtitle="Statistik perbandingan jumlah peserta dan rata-rata nilai">
        <div className="h-72 w-full pt-2">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </Card>
    </div>
  );
};
