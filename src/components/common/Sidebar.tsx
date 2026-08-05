import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  BookOpenCheck,
  FileQuestion,
  GraduationCap,
  Settings,
  User,
  Database,
  BarChart3,
  HelpCircle,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { showToast } from './Toast';
import { Modal } from './Modal';
import { Button } from './Button';
import { X } from 'lucide-react';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard Admin', icon: LayoutDashboard },
    { to: '/admin/teachers', label: 'Manajemen Guru', icon: Users },
    { to: '/admin/subjects', label: 'Manajemen Mapel', icon: BookOpenCheck },
    { to: '/admin/quizzes', label: 'Manajemen Quiz', icon: FileQuestion },
    { to: '/admin/question-bank', label: 'Bank Soal TKA', icon: HelpCircle },
    { to: '/admin/student-scores', label: 'Monitoring Nilai', icon: GraduationCap },
    { to: '/admin/settings', label: 'Backup & Pengaturan', icon: Database },
  ];

  const guruLinks = [
    { to: '/guru/dashboard', label: 'Dashboard Guru', icon: LayoutDashboard },
    { to: '/guru/quizzes', label: 'Daftar Quiz Saya', icon: FileQuestion },
    { to: '/guru/question-bank', label: 'Bank Soal TKA', icon: HelpCircle },
    { to: '/guru/student-scores', label: 'Monitoring Nilai', icon: GraduationCap },
  ];

  const links = isAdmin ? adminLinks : guruLinks;

  const handleLogoutConfirm = async () => {
    setIsLogoutModalOpen(false);
    await logout();
    showToast('Anda telah keluar dari akun.');
    navigate('/login');
  };

  const navContent = (
    <div className="h-full flex flex-col justify-between p-4">
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              {isAdmin ? 'Menu Administrator' : 'Menu Guru Pengampu'}
            </span>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 md:hidden"
                title="Tutup Menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <nav className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => onCloseMobile && onCloseMobile()}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
        <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-[#2563EB]/10 text-[#2563EB] dark:bg-blue-900/50 dark:text-blue-300 font-black text-xs flex items-center justify-center flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsLogoutModalOpen(true)}
          className="w-full flex items-center justify-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200/60 dark:border-red-800/40 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Keluar (Logout)</span>
        </button>

        <div className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-semibold">
          TKA Quiz App v2.5
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 min-h-[calc(100vh-4rem)] flex-col justify-between shrink-0 no-print">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex no-print">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onCloseMobile} />
          <aside className="relative w-72 max-w-[80vw] bg-white dark:bg-slate-800 h-full shadow-2xl z-10 flex flex-col">
            {navContent}
          </aside>
        </div>
      )}

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
              Apakah Anda yakin ingin keluar dari akun <b>{user.name}</b>?
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
    </>
  );
};
