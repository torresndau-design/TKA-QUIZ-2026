import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, LogOut, User as UserIcon, BookOpen, ShieldCheck, AlertTriangle, Menu } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from './Badge';
import { Modal } from './Modal';
import { Button } from './Button';
import { showToast } from './Toast';

import { SchoolLogo } from './SchoolLogo';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    showToast('Anda telah keluar dari akun.');
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Brand */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {user && onToggleMobileMenu && (
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="p-2 md:hidden text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Buka Menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            )}
            <Link to="/" className="flex items-center space-x-3 group">
              <SchoolLogo className="w-10 h-10 object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
              <div>
                <span className="font-extrabold text-lg text-slate-800 dark:text-white tracking-tight block leading-tight">
                  AKM <span className="text-[#2563EB]">Quiz</span>
                </span>
                <span className="text-[11px] font-bold text-[#2563EB] dark:text-blue-400 uppercase tracking-wider block">
                  SMKS SANJAYA BAJAWA
                </span>
              </div>
            </Link>
          </div>

          {/* User & Actions */}
          <div className="flex items-center space-x-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>

            {user ? (
              <div className="flex items-center space-x-3 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none mb-1">
                    {user.name}
                  </div>
                  <Badge variant={user.role === 'ADMIN' ? 'primary' : 'secondary'}>
                    {user.role === 'ADMIN' ? 'ADMIN' : 'GURU MAPEL'}
                  </Badge>
                </div>

                <div
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300"
                  title={user.name}
                >
                  <UserIcon className="w-5 h-5" />
                </div>

                <button
                  onClick={() => setIsLogoutModalOpen(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200/60 dark:border-red-800/40 transition-colors cursor-pointer"
                  title="Keluar dari Akun"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="hidden sm:inline">Keluar</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                Login Guru / Admin
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Logout */}
      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Konfirmasi Keluar / Logout"
        maxWidth="md"
      >
        <div className="space-y-4 py-2">
          <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60">
            <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Apakah Anda yakin ingin keluar dari akun <b>{user?.name}</b>? Sesi Anda akan diakhiri.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button variant="ghost" onClick={() => setIsLogoutModalOpen(false)}>
              Batal
            </Button>
            <Button variant="danger" icon={<LogOut className="w-4 h-4" />} onClick={handleLogoutConfirm}>
              Ya, Keluar Sekarang
            </Button>
          </div>
        </div>
      </Modal>
    </header>
  );
};
