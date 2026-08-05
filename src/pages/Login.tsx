import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase'; // Diperbaiki dari '../firebase' menjadi '../../firebase' jika di dalam pages/
import { Mail, Lock, LogIn as LogInIcon } from 'lucide-react';
import { Button } from '../components/common/Button';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (error: any) {
      console.error('Gagal login:', error);
      setErrorMsg('Email atau kata sandi salah. Silakan periksa kembali.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 space-y-6">
        
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            Login Portal <span className="text-[#2563EB]">TKA Quiz</span>
          </h2>
          <p className="text-xs font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider mt-1">
            SMKS SANJAYA BAJAWA
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Masuk sebagai Administrator atau Guru Mata Pelajaran
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400">
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
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kata Sandi (Password)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full py-3 flex items-center justify-center gap-2 font-bold"
            disabled={loading}
          >
            <LogInIcon className="w-4 h-4" />
            {loading ? 'Sedang Masuk...' : 'Masuk ke Aplikasi'}
          </Button>
        </form>

      </div>
    </div>
  );
};