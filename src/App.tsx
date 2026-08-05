import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Layouts & Nav
import { Navbar } from './components/common/Navbar';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { TeacherManagement } from './pages/admin/TeacherManagement';
import { SubjectManagement } from './pages/admin/SubjectManagement';
import { QuizManagement } from './pages/admin/QuizManagement';
import { StudentScoreMonitoring } from './pages/admin/StudentScoreMonitoring';
import { SettingsBackup } from './pages/admin/SettingsBackup';

import { GuruDashboard } from './pages/guru/GuruDashboard';
import { Profile } from './pages/guru/Profile';
import { QuizList } from './pages/guru/QuizList';
import { QuizEditor } from './pages/guru/QuizEditor';
import { QuestionBank } from './pages/guru/QuestionBank';
import { QuizReport } from './pages/guru/QuizReport';

import { StudentEntrance } from './pages/siswa/StudentEntrance';
import { StudentExam } from './pages/siswa/StudentExam';
import { ExamResult } from './pages/siswa/ExamResult';

// Protected Dashboard Layout Component
const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors">
      <Navbar />
      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Student Exam Routes */}
            <Route path="/exam/:quizId" element={<StudentEntrance />} />
            <Route path="/exam/:quizId/live/:participantId" element={<StudentExam />} />
            <Route path="/exam/result/:participantId" element={<ExamResult />} />

            {/* Login Route */}
            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<DashboardLayout />}>
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="teachers" element={<TeacherManagement />} />
              <Route path="subjects" element={<SubjectManagement />} />
              <Route path="quizzes" element={<QuizManagement />} />
              <Route path="question-bank" element={<QuestionBank />} />
              <Route path="student-scores" element={<StudentScoreMonitoring />} />
              <Route path="settings" element={<SettingsBackup />} />
            </Route>

            {/* Guru Routes */}
            <Route path="/guru" element={<DashboardLayout />}>
              <Route path="dashboard" element={<GuruDashboard />} />
              <Route path="quizzes" element={<QuizList />} />
              <Route path="quizzes/new" element={<QuizEditor />} />
              <Route path="quizzes/edit/:id" element={<QuizEditor />} />
              <Route path="question-bank" element={<QuestionBank />} />
              <Route path="student-scores" element={<StudentScoreMonitoring />} />
              <Route path="report/:id" element={<QuizReport />} />
              <Route path="profile" element={<Navigate to="/guru/dashboard" replace />} />
            </Route>

            {/* Root Default Redirect */}
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
