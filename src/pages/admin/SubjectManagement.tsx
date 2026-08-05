import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { showToast, showConfirmDialog } from '../../components/common/Toast';
import { Subject } from '../../types';
import { getSubjects, saveSubject, deleteSubject } from '../../services/db';
import { Plus, Edit3, Trash2, BookOpen } from 'lucide-react';

export const SubjectManagement: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const loadData = async () => {
    const list = await getSubjects();
    setSubjects(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenAdd = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Subject) => {
    setEditingSubject(s);
    setCode(s.code);
    setName(s.name);
    setDescription(s.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newObj: Subject = {
      id: editingSubject?.id || `subj_${Date.now()}`,
      code,
      name,
      description,
      createdAt: editingSubject?.createdAt || new Date().toISOString(),
    };
    await saveSubject(newObj);
    showToast(editingSubject ? 'Mata Pelajaran berhasil diperbarui' : 'Mata Pelajaran baru ditambahkan');
    setIsModalOpen(false);
    loadData();
  };

  const handleDelete = async (id: string, nameStr: string) => {
    const confirmed = await showConfirmDialog(
      'Hapus Mata Pelajaran?',
      `Apakah Anda yakin ingin menghapus ${nameStr}?`
    );
    if (confirmed) {
      await deleteSubject(id);
      showToast('Mata Pelajaran berhasil dihapus', 'info');
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Manajemen Mata Pelajaran
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar mata pelajaran yang diujikan dalam sistem AKM Quiz.
          </p>
        </div>
        <Button onClick={handleOpenAdd} icon={<Plus className="w-4 h-4" />}>
          Tambah Mapel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subjects.map((s) => (
          <Card key={s.id} className="flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-black text-xs rounded-lg border border-blue-200">
                  {s.code}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenEdit(s)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">{s.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {s.description || 'Tidak ada deskripsi.'}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kode Mapel
            </label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Contoh: NUM-MAT"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl font-mono uppercase"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nama Mata Pelajaran
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Matematika (Numerasi)"
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Deskripsi Singkat
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan ruang lingkup mata pelajaran ini..."
              className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary">
              Simpan Mapel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
