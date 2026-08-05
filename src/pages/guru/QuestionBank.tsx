import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Question, Quiz, User, Subject } from '../../types';
import {
  getAllQuestions,
  saveQuestion,
  deleteQuestion,
  deleteMultipleQuestions,
  getQuizzes,
  getUsers,
  getSubjects,
} from '../../services/db';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import {
  Search,
  CopyPlus,
  Trash2,
  UserCheck,
  BookOpen,
  HelpCircle,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';

export const QuestionBank: React.FC = () => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // View mode and Folder states
  const [viewMode, setViewMode] = useState<'FOLDER' | 'LIST'>('FOLDER');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');

  // Batch Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allQuestions, allQuizzes, allUsers, allSubjects] = await Promise.all([
        getAllQuestions(),
        getQuizzes(),
        getUsers(),
        getSubjects(),
      ]);

      setQuestions(allQuestions);
      setQuizzes(allQuizzes);
      setTeachers(allUsers.filter((u) => u.role === 'GURU' || u.role === 'ADMIN'));
      setSubjects(allSubjects);

      // If logged in as GURU, default filter to their own account
      if (user && user.role === 'GURU') {
        setSelectedTeacherId(user.uid);
      }

      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      showToast('Gagal memuat bank soal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Quiz lookup map
  const quizMap = useMemo(() => {
    const map = new Map<string, Quiz>();
    quizzes.forEach((q) => map.set(q.id, q));
    return map;
  }, [quizzes]);

  // Subject lookup map
  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const handleDuplicateQuestion = async (q: Question) => {
    const duplicated: Question = {
      ...q,
      id: `q_dup_${Date.now()}`,
      questionText: `${q.questionText} (Duplikat)`,
      createdAt: new Date().toISOString(),
    };
    await saveQuestion(duplicated);
    showToast('Soal berhasil diduplikasi ke Bank Soal!');
    loadData();
  };

  const handleDeleteSingle = async (q: Question) => {
    const confirmed = await showConfirmDialog(
      'Hapus Soal?',
      'Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?'
    );
    if (confirmed) {
      await deleteQuestion(q.id, q.quizId);
      showToast('Soal berhasil dihapus', 'info');
      loadData();
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = await showConfirmDialog(
      'Hapus Massal Soal?',
      `Apakah Anda yakin ingin menghapus ${selectedIds.length} soal yang dipilih dari Bank Soal?`
    );
    if (confirmed) {
      const itemsToDelete = questions
        .filter((q) => selectedIds.includes(q.id))
        .map((q) => ({ id: q.id, quizId: q.quizId }));
      await deleteMultipleQuestions(itemsToDelete);
      showToast(`${selectedIds.length} soal berhasil dihapus dari Bank Soal!`, 'info');
      loadData();
    }
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const quiz = quizMap.get(q.quizId);

      // Filter by Teacher
      if (selectedTeacherId !== 'ALL') {
        const teacherMatch = quiz ? quiz.teacherId === selectedTeacherId : false;
        if (!teacherMatch) return false;
      }

      // Filter by Subject
      if (selectedSubjectId !== 'ALL') {
        const subjectMatch = quiz ? quiz.subjectId === selectedSubjectId : false;
        if (!subjectMatch) return false;
      }

      // Filter by Search Query
      if (search.trim()) {
        const s = search.toLowerCase();
        const textMatch = q.questionText.toLowerCase().includes(s);
        const chapterMatch = q.chapter ? q.chapter.toLowerCase().includes(s) : false;
        const quizTitleMatch = quiz ? quiz.title.toLowerCase().includes(s) : false;
        const teacherNameMatch = quiz ? quiz.teacherName.toLowerCase().includes(s) : false;
        const subjectNameMatch = quiz ? quiz.subjectName.toLowerCase().includes(s) : false;

        if (!textMatch && !chapterMatch && !quizTitleMatch && !teacherNameMatch && !subjectNameMatch) {
          return false;
        }
      }

      // Filter by Category
      if (selectedCategory !== 'ALL' && q.category !== selectedCategory) {
        return false;
      }

      // Filter by Level
      if (selectedLevel !== 'ALL' && q.cognitiveLevel !== selectedLevel) {
        return false;
      }

      return true;
    });
  }, [questions, quizMap, selectedTeacherId, selectedSubjectId, search, selectedCategory, selectedLevel]);

  // Group questions by Subject Folder (e.g. "Folder Matematika")
  const groupedFolders = useMemo(() => {
    const groups: Record<string, Question[]> = {};
    filteredQuestions.forEach((q) => {
      const quiz = quizMap.get(q.quizId);
      const subjName = quiz?.subjectName || 'Umum / Lainnya';
      const folderName = `Folder ${subjName}`;
      if (!groups[folderName]) groups[folderName] = [];
      groups[folderName].push(q);
    });
    return groups;
  }, [filteredQuestions, quizMap]);

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

  const isAllSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedIds.includes(q.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map((q) => q.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedTeacher = teachers.find((t) => t.uid === selectedTeacherId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const renderQuestionCard = (q: Question) => {
    const isChecked = selectedIds.includes(q.id);
    const quiz = quizMap.get(q.quizId);

    return (
      <div
        key={q.id}
        className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
          isChecked
            ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 shadow-sm'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5 items-center">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggleSelect(q.id)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer mr-1"
            />
            {quiz?.subjectName && (
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800/50">
                Mapel: {quiz.subjectName}
              </span>
            )}
            {quiz?.teacherName && (
              <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-200 dark:border-blue-800/50">
                Guru: {quiz.teacherName}
              </span>
            )}
            <Badge variant="primary">{q.category}</Badge>
            <Badge variant="secondary">{q.cognitiveLevel}</Badge>
            <Badge variant="warning">{q.difficulty}</Badge>
            {q.chapter && (
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Bab: {q.chapter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleDuplicateQuestion(q)}
              icon={<CopyPlus className="w-3.5 h-3.5" />}
            >
              Duplikasi
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleDeleteSingle(q)}
              title="Hapus Soal"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </Button>
          </div>
        </div>

        <div className="pl-7 space-y-1.5">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
            {q.questionText}
          </p>

          {quiz && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
              Dari Quiz: <span className="font-semibold text-slate-600 dark:text-slate-300">{quiz.title}</span> (Kelas {quiz.targetClass})
            </div>
          )}

          {q.discussion && (
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
              💡 <b>Pembahasan:</b> {q.discussion}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Folder className="w-7 h-7 text-[#2563EB]" />
            Bank Soal AKM (Folder Per Mapel)
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Bank soal Asesmen Kompetensi Minimum tersimpan secara rapi dalam folder per mata pelajaran.
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
              Folder Mapel
            </button>
            <button
              onClick={() => setViewMode('LIST')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Semua List
            </button>
          </div>
        </div>
      </div>

      <Card>
        {/* Dropdown Filters Panel */}
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filter Guru Pengampu */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                Guru Pengampu
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
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
                Mata Pelajaran (Mapel)
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">Semua Mata Pelajaran ({subjects.length})</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kategori AKM
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">Semua Kategori AKM</option>
                <option value="Literasi">Literasi Membaca</option>
                <option value="Numerasi">Numerasi</option>
                <option value="Sains">Literasi Sains</option>
                <option value="Sosial Budaya">Sosial Budaya</option>
              </select>
            </div>

            {/* Filter Cognitive Level */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Level Kognitif
              </label>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl font-semibold text-slate-800 dark:text-slate-100 focus:outline-none"
              >
                <option value="ALL">Semua Level Kognitif</option>
                <option value="Pemahaman (L1)">Pemahaman (L1)</option>
                <option value="Aplikasi (L2)">Aplikasi (L2)</option>
                <option value="Penalaran (L3)">Penalaran (L3)</option>
              </select>
            </div>
          </div>

          {/* Search bar and Active Filter info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
            <div className="relative max-w-sm w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari kata kunci, topik, atau bab..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none"
              />
            </div>

            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600">
              Menampilkan <b className="text-blue-600 dark:text-blue-400">{filteredQuestions.length}</b> Soal
              {selectedTeacher ? ` • Guru: ${selectedTeacher.name}` : ' • Semua Guru'}
              {selectedSubject ? ` • Mapel: ${selectedSubject.name}` : ''}
            </div>
          </div>

          {/* Batch Actions Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200 select-none">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleSelectAll}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              Pilih Semua Soal Terfilter ({filteredQuestions.length})
            </label>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {selectedIds.length} soal dipilih
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
            )}
          </div>
        </div>

        {/* FOLDER VIEW MODE */}
        {viewMode === 'FOLDER' ? (
          <div className="space-y-4">
            {Object.keys(groupedFolders).length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                Tidak ada folder soal yang sesuai dengan kriteria filter.
              </div>
            ) : (
              (Object.entries(groupedFolders) as [string, Question[]][]).map(([folderName, items]) => {
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
                          {items.length} Soal
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
                      <div className="p-3 space-y-3 bg-slate-50/50 dark:bg-slate-900/30">
                        {items.map(renderQuestionCard)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* LIST VIEW MODE */
          <div className="space-y-3">
            {filteredQuestions.map(renderQuestionCard)}

            {filteredQuestions.length === 0 && !loading && (
              <div className="text-center py-12 text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                Tidak ada soal yang sesuai dengan kriteria Guru Pengampu atau Mata Pelajaran terpilih.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};


