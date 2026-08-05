import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { User, UserRole } from '../types';
import { getUsers, DEFAULT_USERS, saveUser } from '../services/db';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; userRole?: UserRole; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetUserPassword: (uid: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('akm_active_user');
    if (!saved || saved === 'none' || saved === 'null') {
      return null;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.uid === 'admin_1' || parsed.email === 'admin@akmquiz.com')) {
        const updatedAdmin = { ...DEFAULT_USERS[0], ...parsed, email: 'admintka@guru.com', password: 'tka123*' };
        localStorage.setItem('akm_active_user', JSON.stringify(updatedAdmin));
        return updatedAdmin;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && fbUser.email) {
        const allUsers = await getUsers();
        const matched = allUsers.find((u) => u.email.toLowerCase() === fbUser.email?.toLowerCase());
        if (matched) {
          setUser(matched);
          localStorage.setItem('akm_active_user', JSON.stringify(matched));
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; userRole?: UserRole; error?: string }> => {
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      // First check local/firestore user records
      const allUsers = await getUsers();
      let matched = allUsers.find((u) => u.email.trim().toLowerCase() === cleanEmail);

      // Direct fallback to DEFAULT_USERS if not found in db query
      if (!matched) {
        matched = DEFAULT_USERS.find((u) => u.email.trim().toLowerCase() === cleanEmail);
      }

      if (matched) {
        if (!matched.isActive) {
          setLoading(false);
          return { success: false, error: 'Akun Anda sedang tidak aktif. Hubungi Admin.' };
        }

        if (matched.password && matched.password !== pass) {
          setLoading(false);
          return { success: false, error: 'Email atau password salah.' };
        }

        // Try Firebase Auth login if possible, else approve local demo match
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, pass);
        } catch {
          // Demo fallback pass check
          console.info('Using local auth validation for demo');
        }

        setUser(matched);
        localStorage.setItem('akm_active_user', JSON.stringify(matched));
        setLoading(false);
        return { success: true, userRole: matched.role };
      }

      setLoading(false);
      return { success: false, error: 'Email atau password salah.' };
    } catch (e: any) {
      setLoading(false);
      return { success: false, error: e.message || 'Gagal melakukan login.' };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setUser(null);
    localStorage.setItem('akm_active_user', 'none');
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...data, updatedAt: new Date().toISOString() };
    setUser(updated);
    localStorage.setItem('akm_active_user', JSON.stringify(updated));
    await saveUser(updated);
  };

  const resetUserPassword = async (uid: string) => {
    const allUsers = await getUsers();
    const target = allUsers.find((u) => u.uid === uid);
    if (target) {
      // Reset logic flag/notification
      console.info(`Reset password for user ${target.name}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        login,
        logout,
        updateProfile,
        resetUserPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
