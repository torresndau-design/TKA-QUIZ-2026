import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { QRModal } from '../../components/common/QRModal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { Quiz } from '../../types';
import { getQuizzes, saveQuiz, deleteQuiz, deleteMultipleQuizzes } from '../../services/db';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  QrCode,
  Copy,
  Edit3,
  Trash2,
  BarChart2,
  CopyPlus,
  Check,
  Search,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';

export const QuizList: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQrQuiz, setSelectedQrQuiz] = useState<Quiz | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // View Mode & Folder States
  const [viewMode, setViewMode] = useState<'FOLDER' | 'GRID'>('FOLDER');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // Batch selection and Search
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    if (!user) return;
    const all = await getQuizzes();
    const userQuizzes = all.filter((q) => q.teacherId === user.uid);
    setQuizzes(userQuizzes);
    setSelectedIds([]);

    // Open all folders by default
    const folderKeys: Record<string, boolean> = {};
    userQuizzes.forEach((q) => {
      const folderName = q.subjectName ? `Folder ${q.subjectName}` : 'Folder Umum / Lainnya';
      folderKeys[folderName] = true;
    });
    setOpenFolders(folderKeys);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleCopyLink = (quizId: string) => {
    const url = `${window.location.origin}/exam/${quizId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(quizId);
    showToast('Link Quiz berhasil disalin!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = async (q: Quiz) => {
    const duplicated: Quiz = {
      ...q,
      id: `quiz_${Date.now()}`,
      title: `${q.title} (Salinan)`,
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    await saveQuiz(duplicated);
    showToast(`Quiz "${q.title}" berhasil diduplikasi!`);
    loadData();
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await showConfirmDialog(
      'Hapus Quiz?',
      `Apakah Anda yakin ingin menghapus quiz "${title}"?`
    );
    if (confirmed) {
      await deleteQuiz(id);
      showToast('Quiz berhasil dihapus', 'info');
      loadData();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showConfirmDialog(
      'Hapus Massal Quiz?',
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} quiz yang dipilih secara permanen?`
    );
    if (confirmed) {
      await deleteMultipleQuizzes(selectedIds);
      showToast(`${selectedIds.length} quiz berhasil dihapus!`, 'info');
      loadData();
    }
  };

  const handleTogglePublish = async (q: Quiz) => {
    const updatedStatus = q.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const updated = { ...q, status: updatedStatus as any };
    await saveQuiz(updated);
    showToast(`Status Quiz ${q.title} diubah menjadi ${updatedStatus}`);
    loadData();
  };

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.targetClass && q.targetClass.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Group Quizzes by Folder (Subject)
  const groupedFolders = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    filteredQuizzes.forEach((q) => {
      const folderName = q.subjectName ? `Folder ${q.subjectName}` : 'Folder Umum / Lainnya';
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(q);
    });
    return groups;
  }, [filteredQuizzes]);

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderName]: prev[folderName] === undefined ? false : !prev[folderName],
    }));
  };

  const toggleAllFolders = (open: boolean) => {
    const updated: Record<string, boolean> = {};
    Object.keys(groupedFolders).forEach((key) => {
      updated[key] = open;
    });
    setOpenFolders(updated);
  };

  const isAllSelected = filteredQuizzes.length > 0 && filteredQuizzes.every((q) => selectedIds.includes(q.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuizzes.map((q) => q.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderQuizCard = (q: Quiz) => {
    const isChecked = selectedIds.includes(q.id);
    return (
      <Card
        key={q.id}
        className={`flex flex-col justify-between space-y-4 transition-colors ${
          isChecked ? 'ring-2 ring-blue-500 bg-blue-50/20 dark:bg-blue-950/20' : ''
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggleSelect(q.id)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <Badge variant={q.status === 'PUBLISHED' ? 'success' : 'warning'}>
                {q.status === 'PUBLISHED' ? 'Publik' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => handleTogglePublish(q)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
              >
                Ubah Status
              </button>
            </div>
          </div>

          <h3 className="text-base font-black text-slate-800 dark:text-slate-100">{q.title}</h3>
          <p className="text-xs text-slate-500 line-clamp-2">{q.description}</p>

          <div className="pt-2 flex flex-wrap gap-2 text-[11px] text-slate-500 font-semibold">
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
              {q.subjectName}
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
              Kelas: {q.targetClass}
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
              Durasi: {q.duration} Menit
            </span>
            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
              Soal: {q.questionCount || 0} Butir
            </span>
          </div>
        </div>

        {/* Actions Toolbar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyLink(q.id)}
              icon={
                copiedId === q.id ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )
              }
              title="Salin Link Quiz"
            >
              {copiedId === q.id ? 'Tersalin' : 'Link'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedQrQuiz(q)}
              icon={<QrCode className="w-3.5 h-3.5" />}
              title="QR Code"
            >
              QR Code
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Link to={`/guru/report/${q.id}`}>
              <Button size="sm" variant="success" icon={<BarChart2 className="w-3.5 h-3.5" />}>
                Laporan
              </Button>
            </Link>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDuplicate(q)}
              title="Duplikasi Quiz"
            >
              <CopyPlus className="w-3.5 h-3.5 text-slate-500" />
            </Button>

            <Link to={`/guru/quizzes/edit/${q.id}`}>
              <Button size="sm" variant="ghost" title="Edit Quiz & Soal">
                <Edit3 className="w-3.5 h-3.5 text-blue-500" />
              </Button>
            </Link>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDelete(q.id, q.title)}
              title="Hapus Quiz"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Folder className="w-7 h-7 text-[#2563EB]" />
            Daftar Quiz Saya (Folder Per Mapel)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola quiz TKA yang Anda ampu secara terorganisir di dalam folder mata pelajaran.
          </p>
        </div>
        <Link to="/guru/quizzes/new">
          <Button icon={<Plus className="w-4 h-4" />}>Buat Quiz Baru</Button>
        </Link>
      </div>

      {/* Control Bar: View Toggle, Search & Select All / Batch Delete */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 select-none shrink-0">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              Pilih Semua ({filteredQuizzes.length})
            </label>

            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul atau folder mapel..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {viewMode === 'FOLDER' && (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => toggleAllFolders(true)}>
                  Buka
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleAllFolders(false)}>
                  Tutup
                </Button>
              </div>
            )}

            <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setViewMode('FOLDER')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'FOLDER'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Folder
              </button>
              <button
                onClick={() => setViewMode('GRID')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'GRID'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Grid
              </button>
            </div>

            {selectedIds.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={handleBatchDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Hapus ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* FOLDER VIEW MODE */}
      {viewMode === 'FOLDER' ? (
        <div className="space-y-4">
          {Object.keys(groupedFolders).length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-500">
                {quizzes.length === 0
                  ? 'Belum ada quiz yang dibuat.'
                  : 'Tidak ada quiz yang sesuai dengan pencarian.'}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Klik tombol di bawah untuk membuat quiz TKA pertama Anda.
              </p>
              <Link to="/guru/quizzes/new">
                <Button icon={<Plus className="w-4 h-4" />}>Buat Quiz Sekarang</Button>
              </Link>
            </div>
          ) : (
            (Object.entries(groupedFolders) as [string, Quiz[]][]).map(([folderName, items]) => {
              const isOpen = openFolders[folderName] !== false; // default true
              const allFolderSelected = items.every((item) => selectedIds.includes(item.id));

              const handleSelectFolderItems = (e: React.ChangeEvent<HTMLInputElement>) => {
                e.stopPropagation();
                if (allFolderSelected) {
                  const itemIds = items.map((i) => i.id);
                  setSelectedIds((prev) => prev.filter((id) => !itemIds.includes(id)));
                } else {
                  const itemIds = items.map((i) => i.id);
                  setSelectedIds((prev) => Array.from(new Set([...prev, ...itemIds])));
                }
              };

              return (
                <div
                  key={folderName}
                  className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm"
                >
                  {/* Folder Header */}
                  <div
                    onClick={() => toggleFolder(folderName)}
                    className="p-3.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer transition-colors border-b border-slate-200 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={allFolderSelected}
                        onChange={handleSelectFolderItems}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />

                      {isOpen ? (
                        <FolderOpen className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="w-5 h-5 text-amber-500 shrink-0" />
                      )}

                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                        {folderName}
                      </span>

                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                        {items.length} Quiz
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold hidden sm:inline">
                        {isOpen ? 'Sembunyikan' : 'Buka Folder'}
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Folder Content Cards */}
                  {isOpen && (
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 dark:bg-slate-900/30">
                      {items.map(renderQuizCard)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* GRID VIEW MODE */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuizzes.map(renderQuizCard)}

          {filteredQuizzes.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-500">
                {quizzes.length === 0
                  ? 'Belum ada quiz yang dibuat.'
                  : 'Tidak ada quiz yang sesuai dengan pencarian.'}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Klik tombol di bawah untuk membuat quiz TKA pertama Anda.
              </p>
              <Link to="/guru/quizzes/new">
                <Button icon={<Plus className="w-4 h-4" />}>Buat Quiz Sekarang</Button>
              </Link>
            </div>
          )}
        </div>
      )}

      {selectedQrQuiz && (
        <QRModal
          isOpen={!!selectedQrQuiz}
          onClose={() => setSelectedQrQuiz(null)}
          quizId={selectedQrQuiz.id}
          quizTitle={selectedQrQuiz.title}
        />
      )}
    </div>
  );
};

