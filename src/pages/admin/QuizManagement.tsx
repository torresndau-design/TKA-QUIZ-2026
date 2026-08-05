import React, { useEffect, useState, useMemo } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { QRModal } from '../../components/common/QRModal';
import { Quiz } from '../../types';
import { getQuizzes, saveQuiz, deleteQuiz, deleteMultipleQuizzes } from '../../services/db';
import { QrCode, Trash2, Search, Folder, FolderOpen, ChevronDown, ChevronRight, LayoutGrid, List } from 'lucide-react';

export const QuizManagement: React.FC = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [search, setSearch] = useState('');
  const [selectedQrQuiz, setSelectedQrQuiz] = useState<Quiz | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'FOLDER' | 'TABLE'>('FOLDER');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    const list = await getQuizzes();
    setQuizzes(list);
    setSelectedIds([]);

    // Auto open all folders by default
    const folderKeys: Record<string, boolean> = {};
    list.forEach((q) => {
      const folderName = q.subjectName || 'Umum / Tanpa Mapel';
      folderKeys[folderName] = true;
    });
    setOpenFolders(folderKeys);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleStatus = async (q: Quiz) => {
    const newStatus = q.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    const updated = { ...q, status: newStatus as any };
    await saveQuiz(updated);
    showToast(`Status Quiz ${q.title} diubah ke ${newStatus}`);
    loadData();
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = await showConfirmDialog(
      'Hapus Quiz TKA?',
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

  const filtered = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.teacherName.toLowerCase().includes(search.toLowerCase()) ||
      q.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  // Group quizzes by Subject Folder
  const groupedFolders = useMemo(() => {
    const groups: Record<string, Quiz[]> = {};
    filtered.forEach((q) => {
      const folderName = q.subjectName ? `Folder ${q.subjectName}` : 'Folder Umum / Tanpa Mapel';
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(q);
    });
    return groups;
  }, [filtered]);

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  };

  const toggleAllFolders = (open: boolean) => {
    const updated: Record<string, boolean> = {};
    Object.keys(groupedFolders).forEach((key) => {
      updated[key] = open;
    });
    setOpenFolders(updated);
  };

  const isAllSelected = filtered.length > 0 && filtered.every((q) => selectedIds.includes(q.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((q) => q.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const renderTableRows = (quizList: Quiz[]) => {
    return quizList.map((q) => {
      const isChecked = selectedIds.includes(q.id);
      return (
        <tr
          key={q.id}
          className={`transition-colors ${
            isChecked
              ? 'bg-blue-50/60 dark:bg-blue-950/40'
              : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
          }`}
        >
          <td className="py-3 px-2 text-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggleSelect(q.id)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          </td>
          <td className="py-3 px-2">
            <div className="font-bold text-slate-800 dark:text-slate-100">{q.title}</div>
            <div className="text-[11px] text-slate-400">{q.subjectName}</div>
          </td>
          <td className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-300">
            {q.teacherName}
          </td>
          <td className="py-3 px-2">
            <div>{q.duration} Menit</div>
            <div className="text-[11px] text-slate-400">{q.targetClass}</div>
          </td>
          <td className="py-3 px-2">
            {q.token ? (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 font-mono font-bold rounded">
                {q.token}
              </span>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </td>
          <td className="py-3 px-2">
            <button onClick={() => handleToggleStatus(q)} className="cursor-pointer">
              <Badge variant={q.status === 'PUBLISHED' ? 'success' : 'warning'}>
                {q.status === 'PUBLISHED' ? 'Publik' : 'Draft'}
              </Badge>
            </button>
          </td>
          <td className="py-3 px-2 text-right">
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedQrQuiz(q)}
                title="Lihat Link & QR Code"
              >
                <QrCode className="w-3.5 h-3.5 text-sky-500" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(q.id, q.title)}
                title="Hapus Quiz"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </Button>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Folder className="w-7 h-7 text-[#2563EB]" />
            Manajemen Seluruh Quiz (Folder Mapel)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Admin dapat melihat, memantau, dan mengatur quiz yang telah dikelompokkan ke dalam folder mata pelajaran.
          </p>
        </div>

        {/* View mode toggle & expand controls */}
        <div className="flex items-center gap-2">
          {viewMode === 'FOLDER' && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => toggleAllFolders(true)}>
                Buka Semua Folder
              </Button>
              <Button size="sm" variant="outline" onClick={() => toggleAllFolders(false)}>
                Tutup Semua Folder
              </Button>
            </div>
          )}
          <div className="flex items-center bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
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
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'TABLE'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Tabel
            </button>
          </div>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari quiz, nama guru, atau folder mapel..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              Pilih Semua ({filtered.length})
            </label>

            {selectedIds.length > 0 && (
              <Button
                size="sm"
                variant="danger"
                onClick={handleBatchDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Hapus Massal ({selectedIds.length})
              </Button>
            )}
          </div>
        </div>

        {/* FOLDER VIEW MODE */}
        {viewMode === 'FOLDER' ? (
          <div className="space-y-4">
            {Object.keys(groupedFolders).length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                Tidak ada folder quiz yang ditemukan.
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

                    {/* Folder Content Table */}
                    {isOpen && (
                      <div className="overflow-x-auto p-2">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase">
                              <th className="py-2.5 px-2 w-10 text-center">Pilih</th>
                              <th className="py-2.5 px-2">Judul Quiz</th>
                              <th className="py-2.5 px-2">Guru Pengampu</th>
                              <th className="py-2.5 px-2">Durasi & Kelas</th>
                              <th className="py-2.5 px-2">Token</th>
                              <th className="py-2.5 px-2">Status</th>
                              <th className="py-2.5 px-2 text-right">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                            {renderTableRows(items)}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* TABLE VIEW MODE */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase">
                  <th className="py-3 px-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-2">Judul Quiz & Mapel</th>
                  <th className="py-3 px-2">Guru Pengampu</th>
                  <th className="py-3 px-2">Durasi & Kelas</th>
                  <th className="py-3 px-2">Token</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                {renderTableRows(filtered)}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Tidak ditemukan quiz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

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

