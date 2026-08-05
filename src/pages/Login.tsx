import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { showToast } from '../components/common/Toast';
import { BookOpen, ShieldCheck, Lock, Mail, UserCheck } from 'lucide-react';

import { SchoolLogo } from '../components/common/SchoolLogo';

export const Login: React.FC = () => {
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const result = await login(email, password);
    if (result.success) {
      showToast('Login Berhasil! Selamat datang.');
      if (result.userRole === 'GURU') {
        navigate('/guru/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      setErrorMsg(result.error || 'Login gagal');
    }
  };

  const fillDemoAdmin = () => {
    setEmail('admintka@guru.com');
    setPassword('tka123*#');
  };

  const fillDemoGuru = () => {
    setEmail('guru@akmquiz.com');
    setPassword('guru123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 space-y-6">
        <div className="text-center space-y-2">
          <SchoolLogo className="w-16 h-16 mx-auto object-contain drop-shadow" />
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Login Portal <span className="text-[#2563EB]">AKM Quiz</span>
          </h2>
          <p className="text-xs font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-widest">
            SMKS SANJAYA BAJAWA
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Masuk sebagai Administrator atau Guru Mata Pelajaran
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@sekolah.sch.id"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:border-[#2563EB] focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:border-[#2563EB] focus:outline-none text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <Button type="submit" isLoading={loading} className="w-full py-3 text-base">
            Masuk Sekarang
          </Button>
        </form>

        {/* Demo Fast Fill Buttons */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
          <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
            Akun Demo
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={fillDemoAdmin}
              className="px-3 py-2 text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Demo Admin
            </button>
            <button
              type="button"
              onClick={fillDemoGuru}
              className="px-3 py-2 text-xs font-semibold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 rounded-xl border border-sky-200 dark:border-sky-800 hover:bg-sky-100 transition-colors flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" /> Demo Guru
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
