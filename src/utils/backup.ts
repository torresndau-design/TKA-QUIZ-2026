import {
  getUsers,
  getSubjects,
  getQuizzes,
  getAllQuestions,
  getAppSettings,
  saveUser,
  saveSubject,
  saveQuiz,
  saveQuestion,
  saveAppSettings,
} from '../services/db';

export async function exportDatabaseBackup(): Promise<void> {
  const users = await getUsers();
  const subjects = await getSubjects();
  const quizzes = await getQuizzes();
  const questions = await getAllQuestions();
  const settings = await getAppSettings();

  const backupData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    users,
    subjects,
    quizzes,
    questions,
    settings,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `TKA_Quiz_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function restoreDatabaseBackup(file: File): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        if (Array.isArray(data.users)) {
          for (const u of data.users) await saveUser(u);
        }
        if (Array.isArray(data.subjects)) {
          for (const s of data.subjects) await saveSubject(s);
        }
        if (Array.isArray(data.quizzes)) {
          for (const q of data.quizzes) await saveQuiz(q);
        }
        if (Array.isArray(data.questions)) {
          for (const question of data.questions) await saveQuestion(question);
        }
        if (data.settings) {
          await saveAppSettings(data.settings);
        }

        resolve(true);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}
