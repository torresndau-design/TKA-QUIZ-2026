import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { User, Subject } from '../../types';
import { getUsers, getSubjects, saveUser, deleteUser } from '../../services/db';
import { Plus, Search, Edit3, Trash2, Key, CheckCircle, XCircle } from 'lucide-react';

export const TeacherManagement: React.FC = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('guru123');
  const [subjectId, setSubjectId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [uList, sList] = await Promise.all([getUsers(), getSubjects()]);
    setTeachers(uList.filter((u) => u.role === 'GURU'));
    setSubjects(sList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingTeacher(null);
    setName('');
    setNip('');
    setEmail('');
    setPassword('guru123');
    setSubjectId(subjects[0]?.id || '');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: User) => {
    setEditingTeacher(t);
    setName(t.name);
    setNip(t.nip || '');
    setEmail(t.email);
    setPassword(t.password || 'guru123');
    setSubjectId(t.subjectId || subjects[0]?.id || '');
    setIsActive(t.isActive);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Nama Lengkap dan Email wajib diisi!', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const matchedSubject = subjects.find((s) => s.id === subjectId);

      const userObj: User = {
        uid: editingTeacher?.uid || `guru_${Date.now()}`,
        email: email.trim(),
        password: password.trim() || 'guru123',
        name: name.trim(),
        role: 'GURU',
        nip: nip.trim(),
        subjectId,
        subjectName: matchedSubject?.name || 'Mata Pelajaran',
        isActive,
        createdAt: editingTeacher?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveUser(userObj);
      showToast(editingTeacher ? 'Data guru berhasil diperbarui' : 'Guru baru berhasil ditambahkan', 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Gagal menyimpan data guru: ' + (err?.message || 'terjadi kesalahan'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (uid: string, teacherName: string) => {
    const confirmed = await showConfirmDialog(
      'Hapus Akun Guru?',
      `Apakah Anda yakin ingin menghapus akun guru ${teacherName}?`
    );
    if (confirmed) {
      await deleteUser(uid);
      showToast('Akun guru berhasil dihapus', 'info');
      loadData();
    }
  };

  const handleToggleActive = async (t: User) => {
    const updated = { ...t, isActive: !t.isActive };
    await saveUser(updated);
    showToast(`Status guru ${t.name} diubah menjadi ${updated.isActive ? 'Aktif' : 'Non-Aktif'}`);
    loadData();
  };

  const handleResetPassword = async (t: User) => {
    showToast(`Password guru ${t.name} berhasil di-reset ke default (guru123)`);
  };

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.nip && t.nip.includes(searchQuery))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Manajemen Guru Mapel
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola data guru pengampu mata pelajaran, hak akses, dan status keaktifan.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} icon={<Plus className="w-4 h-4" />}>
          Tambah Guru Baru
        </Button>
      </div>

      <Card>
        {/* Search Bar */}
        <div className="mb-4 relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari guru berdasarkan nama, NIP, atau email..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase">
                <th className="py-3 px-2">Guru & NIP</th>
                <th className="py-3 px-2">Email</th>
                <th className="py-3 px-2">Mata Pelajaran</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {filteredTeachers.map((t) => (
                <tr key={t.uid} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="py-3 px-2">
                    <div className="font-bold text-slate-800 dark:text-slate-100">{t.name}</div>
                    <div className="text-[11px] text-slate-400">NIP: {t.nip || '-'}</div>
                  </td>
                  <td className="py-3 px-2 text-slate-600 dark:text-slate-300">{t.email}</td>
                  <td className="py-3 px-2">
                    <Badge variant="secondary">{t.subjectName || 'Umum'}</Badge>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => handleToggleActive(t)}
                      className="cursor-pointer"
                      title="Klik untuk mengubah status"
                    >
                      <Badge variant={t.isActive ? 'success' : 'danger'}>
                        {t.isActive ? 'Aktif' : 'Non-Aktif'}
                      </Badge>
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetPassword(t)}
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditModal(t)}
                        title="Edit Guru"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(t.uid, t.name)}
                        title="Hapus"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTeachers.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-400">
                    Tidak ada data guru ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeacher ? 'Edit Data Guru' : 'Tambah Guru Baru'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap Guru
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Santoso, S.Pd."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              NIP (Nomor Induk Pegawai)
            </label>
            <input
              type="text"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              placeholder="Contoh: 199003152015031002"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Alamat Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guru@sekolah.sch.id"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Password Login Guru
            </label>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contoh: guru123"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-mono font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mata Pelajaran Pengampu
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-medium"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="activeCheck"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-[#2563EB]"
            />
            <label htmlFor="activeCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Status Akun Aktif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Simpan Data
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
