import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { Participant, Quiz, User, Subject } from '../../types';
import {
  getAllParticipants,
  getQuizzes,
  getUsers,
  getSubjects,
  getAppSettings,
  deleteParticipant,
  deleteMultipleParticipants,
} from '../../services/db';
import { exportResultsToExcel } from '../../utils/excel';
import {
  GraduationCap,
  Users,
  Award,
  Search,
  FileSpreadsheet,
  Printer,
  CheckCircle,
  AlertTriangle,
  Eye,
  TrendingUp,
  Trash2,
  UserCheck,
  BookOpen,
} from 'lucide-react';

export const StudentScoreMonitoring: React.FC = () => {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schoolName, setSchoolName] = useState('SMKS SANJAYA BAJAWA');
  const [loading, setLoading] = useState(true);

  // Filters & Batch selection
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedQuizId, setSelectedQuizId] = useState<string>('ALL');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'SCORE_DESC' | 'SCORE_ASC' | 'NAME_ASC' | 'NIS_ASC' | 'DATE_DESC'>('SCORE_DESC');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Detail Modal
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pList, qList, uList, sList, settings] = await Promise.all([
        getAllParticipants(),
        getQuizzes(),
        getUsers(),
        getSubjects(),
        getAppSettings(),
      ]);

      setQuizzes(qList);
      setParticipants(pList);
      setTeachers(uList.filter((u) => u.role === 'GURU' || u.role === 'ADMIN'));
      setSubjects(sList);
      setSchoolName(settings.schoolName);

      // Default filter for Guru role
      if (user && user.role === 'GURU') {
        setSelectedTeacherId(user.uid);
      }

      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat data monitoring nilai', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Map Quiz by ID for quick lookup
  const quizMap = useMemo(() => {
    const map = new Map<string, Quiz>();
    quizzes.forEach((q) => map.set(q.id, q));
    return map;
  }, [quizzes]);

  // Available Quizzes constrained by selected Teacher and Subject
  const filteredQuizOptions = useMemo(() => {
    return quizzes.filter((q) => {
      if (selectedTeacherId !== 'ALL' && q.teacherId !== selectedTeacherId) {
        return false;
      }
      if (selectedSubjectId !== 'ALL' && q.subjectId !== selectedSubjectId) {
        return false;
      }
      return true;
    });
  }, [quizzes, selectedTeacherId, selectedSubjectId]);

  // Extract unique classes dynamically from participants
  const uniqueClasses = useMemo(() => {
    const classes = new Set<string>();
    participants.forEach((p) => {
      if (p.studentClass) classes.add(p.studentClass.trim());
    });
    return Array.from(classes).sort();
  }, [participants]);

  // Filtered and Sorted Participants
  const filteredParticipants = useMemo(() => {
    return participants
      .filter((p) => {
        const quiz = quizMap.get(p.quizId);

        // Filter by Teacher
        if (selectedTeacherId !== 'ALL') {
          if (!quiz || quiz.teacherId !== selectedTeacherId) return false;
        }

        // Filter by Subject
        if (selectedSubjectId !== 'ALL') {
          if (!quiz || quiz.subjectId !== selectedSubjectId) return false;
        }

        // Filter by Quiz
        if (selectedQuizId !== 'ALL' && p.quizId !== selectedQuizId) {
          return false;
        }

        // Filter by Class
        if (selectedClass !== 'ALL' && p.studentClass !== selectedClass) {
          return false;
        }

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = p.fullName.toLowerCase().includes(q);
          const nisMatch = p.nis.toLowerCase().includes(q);
          const quizTitleMatch = quiz?.title.toLowerCase().includes(q);
          const teacherMatch = quiz?.teacherName.toLowerCase().includes(q);
          const subjectMatch = quiz?.subjectName.toLowerCase().includes(q);
          if (!nameMatch && !nisMatch && !quizTitleMatch && !teacherMatch && !subjectMatch) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'SCORE_DESC') {
          return (b.score ?? 0) - (a.score ?? 0);
        } else if (sortBy === 'SCORE_ASC') {
          return (a.score ?? 0) - (b.score ?? 0);
        } else if (sortBy === 'NAME_ASC') {
          return a.fullName.localeCompare(b.fullName);
        } else if (sortBy === 'NIS_ASC') {
          return a.nis.localeCompare(b.nis, undefined, { numeric: true });
        } else if (sortBy === 'DATE_DESC') {
          return new Date(b.submittedAt || b.startedAt).getTime() - new Date(a.submittedAt || a.startedAt).getTime();
        }
        return 0;
      });
  }, [participants, selectedTeacherId, selectedSubjectId, selectedQuizId, selectedClass, searchQuery, sortBy, quizMap]);

  // Select All logic
  const isAllSelected = filteredParticipants.length > 0 && filteredParticipants.every((p) => selectedIds.includes(p.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParticipants.map((p) => p.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Deletion Handlers
  const handleDeleteSingle = async (id: string, name: string) => {
    const confirmed = await showConfirmDialog(
      'Hapus Hasil Ujian Siswa?',
      `Apakah Anda yakin ingin menghapus data nilai "${name}"?`
    );
    if (confirmed) {
      await deleteParticipant(id);
      showToast('Data nilai siswa berhasil dihapus', 'info');
      loadData();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showConfirmDialog(
      'Hapus Massal Data Nilai?',
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} data nilai siswa yang dipilih?`
    );
    if (confirmed) {
      await deleteMultipleParticipants(selectedIds);
      showToast(`${selectedIds.length} data nilai berhasil dihapus!`, 'info');
      loadData();
    }
  };

  // Statistics Metrics
  const totalCount = filteredParticipants.length;
  const avgScore = totalCount > 0
    ? (filteredParticipants.reduce((acc, p) => acc + (p.score ?? 0), 0) / totalCount).toFixed(1)
    : '0';

  const passedCount = filteredParticipants.filter((p) => {
    const minGrade = quizMap.get(p.quizId)?.minPassingGrade ?? 75;
    return (p.score ?? 0) >= minGrade;
  }).length;

  const passPercentage = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const handleExportExcel = () => {
    if (filteredParticipants.length === 0) {
      showToast('Tidak ada data nilai untuk diexport', 'error');
      return;
    }
    const classLabel = selectedClass === 'ALL' ? 'Semua_Kelas' : selectedClass;
    exportResultsToExcel(filteredParticipants, `Monitoring_Nilai_${classLabel}`);
    showToast('Laporan nilai per kelas berhasil diexport ke Excel!');
  };

  const handlePrint = () => {
    window.print();
  };

  const activeTeacher = teachers.find((t) => t.uid === selectedTeacherId);
  const activeSubject = subjects.find((s) => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-[#2563EB]" />
            Monitoring Nilai Ujian Siswa
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Pantau laporan nilai pengerjaan siswa terfilter secara spesifik berdasarkan Guru Pengampu, Mata Pelajaran, dan Kelas.
          </p>
        </div>

        <div className="flex gap-2 shrink-0 no-print">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
          >
            Export Excel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            Cetak Laporan
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-[#2563EB] rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalCount}</div>
            <div className="text-xs text-slate-500">Siswa Terdata</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 dark:bg-sky-950 text-[#0EA5E9] rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{avgScore}</div>
            <div className="text-xs text-slate-500">Rata-Rata Nilai</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{passedCount} Siswa</div>
            <div className="text-xs text-slate-500">Lulus KKM ({passPercentage}%)</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">
              {uniqueClasses.length} Kelas
            </div>
            <div className="text-xs text-slate-500">Kelas Terdaftar</div>
          </div>
        </Card>
      </div>

      {/* Filters & Control Panel */}
      <Card className="no-print">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter Guru Pengampu */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Filter Guru Pengampu
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => {
                  setSelectedTeacherId(e.target.value);
                  setSelectedQuizId('ALL'); // reset quiz selection
                }}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">Semua Guru ({teachers.length})</option>
                {teachers.map((t) => (
                  <option key={t.uid} value={t.uid}>
                    {t.name} ({t.nip ? `NIP: ${t.nip}` : t.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Mata Pelajaran */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                Filter Mata Pelajaran (Mapel)
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedQuizId('ALL'); // reset quiz selection
                }}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">Semua Mata Pelajaran ({subjects.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quiz Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Quiz / Ujian
              </label>
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">Semua Ujian ({filteredQuizOptions.length})</option>
                {filteredQuizOptions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.subjectName})
                  </option>
                ))}
              </select>
            </div>

            {/* Class Filter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pilih Kelas Siswa
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">Semua Kelas ({uniqueClasses.length})</option>
                {uniqueClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    Kelas {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            {/* Sort By */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Urutkan Berdasarkan
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="SCORE_DESC">Nilai Tertinggi ke Terendah (Peringkat)</option>
                <option value="SCORE_ASC">Nilai Terendah ke Tertinggi</option>
                <option value="NAME_ASC">Nama Siswa (A - Z)</option>
                <option value="NIS_ASC">NIS Siswa (Urut Nomor Absen)</option>
                <option value="DATE_DESC">Waktu Ujian Terbaru</option>
              </select>
            </div>

            {/* Search Bar */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cari Siswa, NIS, atau Mapel
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama siswa, NIS, atau mapel..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl font-semibold focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Filter Status Tag */}
          <div className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-600">
            Filter Aktif: {activeTeacher ? <b>Guru: {activeTeacher.name}</b> : <b>Semua Guru</b>}
            {activeSubject ? ` • Mapel: ${activeSubject.name}` : ''}
            {selectedClass !== 'ALL' ? ` • Kelas: ${selectedClass}` : ''}
            {selectedQuizId !== 'ALL' ? ` • Ujian: ${quizMap.get(selectedQuizId)?.title}` : ''}
          </div>
        </div>
      </Card>

      {/* PRINT-ONLY OFFICIAL HEADER */}
      <div className="hidden print:block mb-6 p-4 border-b-2 border-slate-900 bg-white text-slate-900">
        <div className="flex items-center justify-between pb-3 border-b border-slate-300 mb-3">
          <div>
            <h1 className="text-xl font-black tracking-wider uppercase text-slate-900">
              {schoolName || 'SMKS SANJAYA BAJAWA'}
            </h1>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">
              LAPORAN REKAPITULASI MONITORING NILAI UJIAN SISWA
            </h2>
          </div>
          <div className="text-right text-xs text-slate-700 font-semibold">
            <p>Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p>Total Peserta: {totalCount} Siswa</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-800 font-medium">
          <p><strong>Guru Pengampu:</strong> {activeTeacher ? `${activeTeacher.name} ${activeTeacher.nip ? `(NIP: ${activeTeacher.nip})` : ''}` : 'Semua Guru'}</p>
          <p><strong>Mata Pelajaran:</strong> {activeSubject ? `[${activeSubject.code}] ${activeSubject.name}` : 'Semua Mata Pelajaran'}</p>
          <p><strong>Quiz / Ujian:</strong> {selectedQuizId !== 'ALL' ? (quizMap.get(selectedQuizId)?.title || 'Selected Quiz') : 'Semua Ujian'}</p>
          <p><strong>Filter Kelas:</strong> {selectedClass !== 'ALL' ? `Kelas ${selectedClass}` : 'Semua Kelas'}</p>
          <p><strong>Rata-Rata Nilai:</strong> <span className="font-bold text-blue-800">{avgScore}</span></p>
          <p><strong>Tingkat Kelulusan KKM:</strong> <span className="font-bold text-emerald-800">{passedCount} Siswa ({passPercentage}%)</span></p>
        </div>
      </div>

      {/* Main Score List Table */}
      <Card
        title={`Daftar Nilai Siswa (${filteredParticipants.length} Data)`}
        subtitle={`Monitoring pengerjaan siswa terurut secara realtime.`}
        action={
          selectedIds.length > 0 ? (
            <div className="flex items-center gap-2 no-print">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {selectedIds.length} dipilih
              </span>
              <Button
                size="sm"
                variant="danger"
                onClick={handleBatchDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Hapus Massal ({selectedIds.length})
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase">
                <th className="py-3.5 px-3 w-10 text-center no-print">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-3">No</th>
                <th className="py-3.5 px-3">Nama Siswa & NIS</th>
                <th className="py-3.5 px-3">Kelas</th>
                <th className="py-3.5 px-3">Mata Pelajaran & Quiz</th>
                <th className="py-3.5 px-3">Guru Pengampu</th>
                <th className="py-3.5 px-3 text-center">Nilai Akhir</th>
                <th className="py-3.5 px-3 text-center">Status KKM</th>
                <th className="py-3.5 px-3 text-center">Detail Pengerjaan</th>
                <th className="py-3.5 px-3 text-right no-print">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredParticipants.map((p, idx) => {
                const quiz = quizMap.get(p.quizId);
                const minGrade = quiz?.minPassingGrade ?? 75;
                const score = p.score ?? 0;
                const isPassed = score >= minGrade;
                const isChecked = selectedIds.includes(p.id);

                return (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      isChecked
                        ? 'bg-blue-50/60 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                    }`}
                  >
                    <td className="py-3.5 px-3 text-center no-print">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelect(p.id)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-3.5 px-3 font-black text-slate-400">#{idx + 1}</td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{p.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-400">NIS: {p.nis}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-blue-400 font-bold text-[11px]">
                        {p.studentClass}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 max-w-xs">
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">
                        {quiz?.subjectName || 'Mata Pelajaran'}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate" title={quiz?.title}>
                        {quiz?.title || 'Quiz TKA'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {quiz?.teacherName || 'Guru Pengampu'}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`text-base font-black ${isPassed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {score}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">/ 100</span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <Badge variant={isPassed ? 'success' : 'danger'}>
                        {isPassed ? `LULUS (≥${minGrade})` : `REMIDI (<${minGrade})`}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-500">
                      <div className="text-[11px]">
                        <span className="text-emerald-600 font-bold">{p.correctCount ?? 0} Benar</span> •{' '}
                        <span className="text-red-500 font-bold">{p.wrongCount ?? 0} Salah</span>
                      </div>
                      {p.antiCheatViolations ? (
                        <div className="text-[10px] text-amber-500 font-bold flex items-center justify-center gap-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" /> {p.antiCheatViolations}x Keluar Tab
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400">Ujian Tertib</div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right no-print">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedParticipant(p);
                            setIsDetailModalOpen(true);
                          }}
                          icon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Detail
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteSingle(p.id, p.fullName)}
                          title="Hapus Nilai Siswa"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredParticipants.length === 0 && !loading && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Tidak ada data nilai siswa yang sesuai dengan filter Guru Pengampu, Mapel, atau pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* PRINT-ONLY SIGNATURE FOOTER */}
      <div className="hidden print:block mt-12 pt-6 text-xs text-slate-900 font-medium">
        <div className="grid grid-cols-2 gap-12 text-center">
          <div>
            <p className="mb-14">Mengetahui,<br /><strong>Kepala Sekolah SMKS SANJAYA BAJAWA</strong></p>
            <p className="font-bold underline uppercase">(........................................................)</p>
            <p className="text-[10px] text-slate-600 mt-1">NIP: .................................................</p>
          </div>
          <div>
            <p className="mb-14">
              Bajawa, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
              <strong>Guru Pengampu / Wali Kelas</strong>
            </p>
            <p className="font-bold underline uppercase">
              ({activeTeacher ? activeTeacher.name : '........................................................'})
            </p>
            <p className="text-[10px] text-slate-600 mt-1">
              NIP: {activeTeacher?.nip || '.................................................'}
            </p>
          </div>
        </div>
      </div>

      {/* Participant Detail Modal */}
      {selectedParticipant && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Detail Hasil Ujian: ${selectedParticipant.fullName}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 block">Nama Lengkap</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {selectedParticipant.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">NIS & Kelas</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {selectedParticipant.nis} ({selectedParticipant.studentClass})
                  </span>
                </div>
              </div>

              <div className="border-t pt-3 grid grid-cols-3 gap-2">
                <div>
                  <span className="text-slate-400 block">Mata Pelajaran</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {quizMap.get(selectedParticipant.quizId)?.subjectName || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Guru Pengampu</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {quizMap.get(selectedParticipant.quizId)?.teacherName || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Ujian / Quiz</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {quizMap.get(selectedParticipant.quizId)?.title || '-'}
                  </span>
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <div>
                  <span className="text-slate-400 block">Nilai Akhir</span>
                  <span className="text-2xl font-black text-[#2563EB]">
                    {selectedParticipant.score ?? 0}
                  </span>
                </div>
                <div>
                  <Badge
                    variant={
                      (selectedParticipant.score ?? 0) >=
                      (quizMap.get(selectedParticipant.quizId)?.minPassingGrade ?? 75)
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {(selectedParticipant.score ?? 0) >=
                    (quizMap.get(selectedParticipant.quizId)?.minPassingGrade ?? 75)
                      ? 'LULUS KKM'
                      : 'BELUM LULUS'}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-800 dark:text-blue-300 space-y-1">
              <div className="font-bold">Informasi Pengerjaan:</div>
              <div>• Waktu Mulai: {new Date(selectedParticipant.startedAt).toLocaleString('id-ID')}</div>
              {selectedParticipant.submittedAt && (
                <div>• Waktu Selesai: {new Date(selectedParticipant.submittedAt).toLocaleString('id-ID')}</div>
              )}
              <div>• Jawaban Benar: {selectedParticipant.correctCount ?? 0} Soal</div>
              <div>• Jawaban Salah: {selectedParticipant.wrongCount ?? 0} Soal</div>
              <div>• Catatan Anti-Cheat: {selectedParticipant.antiCheatViolations || 0}x Keluar Tab</div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

