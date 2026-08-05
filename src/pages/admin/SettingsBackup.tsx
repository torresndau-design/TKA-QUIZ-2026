import React, { useEffect, useState } from 'react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { showToast } from '../../components/common/Toast';
import { AppSettings } from '../../types';
import { getAppSettings, saveAppSettings } from '../../services/db';
import { exportDatabaseBackup, restoreDatabaseBackup } from '../../utils/backup';
import { Download, Upload, Save, School } from 'lucide-react';

export const SettingsBackup: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    schoolName: '',
    schoolLogoUrl: '',
    academicYear: '2025/2026',
    examInstructions: '',
  });

  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    async function load() {
      const data = await getAppSettings();
      setSettings(data);
    }
    load();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveAppSettings(settings);
    showToast('Pengaturan sekolah berhasil disimpan!');
  };

  const handleBackup = async () => {
    await exportDatabaseBackup();
    showToast('Backup database JSON berhasil diunduh!');
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoring(true);
    try {
      await restoreDatabaseBackup(file);
      showToast('Restore data berhasil diselesaikan! Halaman akan dimuat ulang.');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      showToast('Gagal memulihkan database. Pastikan format file JSON valid.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
          Pengaturan & Pemulihan Data
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Atur identitas sekolah, petunjuk umum ujian, serta fasilitas backup & restore database.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Identitas Sekolah Settings */}
        <div className="lg:col-span-2">
          <Card title="Identitas Sekolah & Ujian" subtitle="Pengaturan ini akan ditampilkan pada kop lembar pengerjaan siswa">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Sekolah / Instansi
                </label>
                <input
                  type="text"
                  required
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL Logo Sekolah (Opsional)
                </label>
                <input
                  type="text"
                  value={settings.schoolLogoUrl || ''}
                  onChange={(e) => setSettings({ ...settings, schoolLogoUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tahun Ajaran
                </label>
                <input
                  type="text"
                  value={settings.academicYear}
                  onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Petunjuk Umum Ujian Siswa
                </label>
                <textarea
                  rows={4}
                  value={settings.examInstructions}
                  onChange={(e) => setSettings({ ...settings, examInstructions: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" icon={<Save className="w-4 h-4" />}>
                  Simpan Pengaturan
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Auto Backup & Restore Data */}
        <div className="space-y-4">
          <Card title="Cadangan Data (Backup)" subtitle="Unduh seluruh data Firestore / Local ke file JSON">
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Disarankan untuk melakukan backup berkala secara rutin guna mencegah kehilangan data penting.
            </p>
            <Button onClick={handleBackup} variant="secondary" className="w-full" icon={<Download className="w-4 h-4" />}>
              Unduh Backup JSON
            </Button>
          </Card>

          <Card title="Pemulihan Data (Restore)" subtitle="Unggah file cadangan JSON untuk mengembalikan data">
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Proses restore akan memperbarui seluruh entitas pengguna, mapel, quiz, dan soal secara otomatis.
            </p>
            <label className="block">
              <span className="sr-only">Pilih File Backup JSON</span>
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                disabled={restoring}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
            </label>
          </Card>
        </div>
      </div>
    </div>
  );
};
