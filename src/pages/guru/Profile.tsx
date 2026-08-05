import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { showToast } from '../../components/common/Toast';
import { User, Lock, Mail, Shield, CheckCircle } from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [nip, setNip] = useState(user?.nip || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({ name, nip });
    showToast('Profil berhasil diperbarui!');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi password tidak cocok', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password minimal 6 karakter', 'error');
      return;
    }
    showToast('Password berhasil diperbarui!');
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
          Profil Saya & Keamanan
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Atur informasi diri dan kata sandi akun Anda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <Card title="Informasi Diri" subtitle="Perbarui nama dan NIP Anda">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Lengkap
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                NIP
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Email (Read-only)
              </label>
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full p-2.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 border rounded-xl cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mata Pelajaran Utama
              </label>
              <input
                type="text"
                disabled
                value={user.subjectName || 'Umum'}
                className="w-full p-2.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 border rounded-xl cursor-not-allowed"
              />
            </div>

            <Button type="submit" className="w-full">
              Simpan Profil
            </Button>
          </form>
        </Card>

        {/* Change Password Card */}
        <Card title="Ganti Password" subtitle="Perbarui kata sandi secara berkala">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password Lama
              </label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Password Baru
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
              />
            </div>

            <Button type="submit" variant="secondary" className="w-full">
              Perbarui Password
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
