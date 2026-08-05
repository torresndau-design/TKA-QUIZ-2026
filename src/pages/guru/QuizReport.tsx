import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { showToast } from '../../components/common/Toast';
import { Quiz, Participant, Question, Answer } from '../../types';
import {
  getQuizById,
  getParticipantsByQuiz,
  getQuestionsByQuiz,
  getAnswersByParticipant,
  saveAnswer,
  saveParticipant,
  getAppSettings,
} from '../../services/db';
import { exportResultsToExcel } from '../../utils/excel';
import { exportResultsToPDF } from '../../utils/pdf';
import { evaluateAnswer } from '../../utils/grading';
import {
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  Award,
  Users,
  CheckCircle,
  XCircle,
  Edit3,
  BarChart3,
  Eye,
  Check,
  HelpCircle,
} from 'lucide-react';

export const QuizReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [schoolName, setSchoolName] = useState('SMKS SANJAYA BAJAWA');

  // Essay Grading Modal state
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<Answer[]>([]);
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);

  const loadData = async () => {
    if (!id) return;
    const [qData, pList, qstList, settings] = await Promise.all([
      getQuizById(id),
      getParticipantsByQuiz(id),
      getQuestionsByQuiz(id),
      getAppSettings(),
    ]);
    setQuiz(qData);
    setParticipants(pList.sort((a, b) => (b.score || 0) - (a.score || 0)));
    setQuestions(qstList);
    setSchoolName(settings.schoolName);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  if (!quiz) {
    return <div className="p-8 text-center text-slate-400">Memuat laporan quiz...</div>;
  }

  const total = participants.length;
  const passed = participants.filter((p) => (p.score || 0) >= quiz.minPassingGrade).length;
  const avgScore =
    total > 0
      ? (participants.reduce((acc, curr) => acc + (curr.score || 0), 0) / total).toFixed(1)
      : '0';

  const handleOpenGrading = async (p: Participant) => {
    setSelectedParticipant(p);
    const ansList = await getAnswersByParticipant(p.id);
    setStudentAnswers(ansList);
    setIsGradingModalOpen(true);
  };

  const handleSaveQuestionScore = async (questionId: string, score: number) => {
    if (!selectedParticipant || !quiz) return;
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;

    const maxWeight = q.weight || 20;
    const validScore = Math.max(0, Math.min(maxWeight, score));

    const existingAns = studentAnswers.find((a) => a.questionId === questionId);
    let updatedAns: Answer;

    if (existingAns) {
      updatedAns = {
        ...existingAns,
        scoreGiven: validScore,
        isCorrect: validScore > 0,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updatedAns = {
        id: `${selectedParticipant.id}_${questionId}`,
        participantId: selectedParticipant.id,
        quizId: quiz.id,
        questionId,
        userAnswer: null,
        isCorrect: validScore > 0,
        scoreGiven: validScore,
        updatedAt: new Date().toISOString(),
      };
    }

    await saveAnswer(updatedAns);

    // Refresh student answers list
    const updatedAnswersList = await getAnswersByParticipant(selectedParticipant.id);
    setStudentAnswers(updatedAnswersList);

    // Recalculate participant final score
    const totalWeight = questions.reduce((acc, item) => acc + item.weight, 0) || 1;
    let totalEarned = 0;
    let correctCount = 0;
    let wrongCount = 0;

    questions.forEach((item) => {
      const a = updatedAnswersList.find((ans) => ans.questionId === item.id);
      const evalRes = evaluateAnswer(item, a?.userAnswer);
      const scoreG = a?.scoreGiven !== undefined ? a.scoreGiven : evalRes.scoreGiven;
      totalEarned += scoreG;
      if (scoreG > 0 || evalRes.isCorrect) correctCount++;
      else wrongCount++;
    });

    const finalScore = Math.min(100, Math.round((totalEarned / totalWeight) * 100));

    const updatedPart: Participant = {
      ...selectedParticipant,
      score: finalScore,
      correctCount,
      wrongCount,
      essayGraded: true,
    };

    await saveParticipant(updatedPart);
    setSelectedParticipant(updatedPart);
    showToast('Nilai berhasil disimpan & diperbarui!');
    loadData();
  };

  const handleExportExcel = () => {
    exportResultsToExcel(participants, quiz.title);
    showToast('Laporan nilai berhasil diexport ke Excel!');
  };

  const handleExportPDF = () => {
    exportResultsToPDF(quiz, participants, schoolName);
    showToast('Laporan nilai PDF berhasil dicetak!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/guru/quizzes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              Laporan & Analisis Nilai TKA
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {quiz.title} • {quiz.subjectName} ({quiz.targetClass})
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} icon={<FileSpreadsheet className="w-4 h-4" />}>
            Export Excel
          </Button>
          <Button variant="primary" size="sm" onClick={handleExportPDF} icon={<Printer className="w-4 h-4" />}>
            Cetak PDF
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-[#2563EB] rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{total} Siswa</div>
            <div className="text-xs text-slate-500">Jumlah Peserta</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{passed} Siswa</div>
            <div className="text-xs text-slate-500">Lulus KKM (&ge; {quiz.minPassingGrade})</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-sky-100 dark:bg-sky-950 text-[#0EA5E9] rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{avgScore}</div>
            <div className="text-xs text-slate-500">Rata-Rata Nilai</div>
          </div>
        </Card>

        <Card className="flex items-center space-x-4">
          <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{questions.length}</div>
            <div className="text-xs text-slate-500">Butir Soal</div>
          </div>
        </Card>
      </div>

      {/* Student Leaderboard & Grades Table */}
      <Card title="Daftar Nilai & Peringkat Siswa" subtitle="Hasil pengerjaan siswa terurut dari nilai tertinggi">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase">
                <th className="py-3 px-2">Rank</th>
                <th className="py-3 px-2">Nama Siswa</th>
                <th className="py-3 px-2">NIS / Kelas</th>
                <th className="py-3 px-2">Nilai Akhir</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Pelanggaran</th>
                <th className="py-3 px-2 text-right">Detail & Koreksi Jawaban</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {participants.map((p, idx) => {
                const isPassed = (p.score || 0) >= quiz.minPassingGrade;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-2 font-black text-slate-400">#{idx + 1}</td>
                    <td className="py-3 px-2 font-bold text-slate-800 dark:text-slate-100">
                      {p.fullName}
                    </td>
                    <td className="py-3 px-2 text-slate-500">
                      {p.nis} ({p.studentClass})
                    </td>
                    <td className="py-3 px-2 font-black text-sm text-slate-800 dark:text-slate-100">
                      {p.score ?? 0}
                    </td>
                    <td className="py-3 px-2">
                      <Badge variant={isPassed ? 'success' : 'danger'}>
                        {isPassed ? 'LULUS' : 'REMIDI'}
                      </Badge>
                    </td>
                    <td className="py-3 px-2">
                      {p.antiCheatViolations ? (
                        <span className="text-red-500 font-bold">{p.antiCheatViolations}x Keluar</span>
                      ) : (
                        <span className="text-slate-400">Tertib</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenGrading(p)}
                        icon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Detail Jawaban
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Belum ada siswa yang menyelesaikan quiz ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Student Answer Detail & Grading Modal */}
      {selectedParticipant && (
        <Modal
          isOpen={isGradingModalOpen}
          onClose={() => setIsGradingModalOpen(false)}
          title={`Hasil & Detail Jawaban: ${selectedParticipant.fullName}`}
          maxWidth="3xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Nama Siswa / Kelas</div>
                <div className="text-sm font-black text-slate-800 dark:text-slate-100">
                  {selectedParticipant.fullName} ({selectedParticipant.studentClass})
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Nilai Akhir Siswa</div>
                <div className="text-2xl font-black text-[#2563EB] dark:text-blue-400">
                  {selectedParticipant.score ?? 0} / 100
                </div>
              </div>
            </div>

            {questions.map((q, qIdx) => {
              const ans = studentAnswers.find((a) => a.questionId === q.id);
              const evalRes = evaluateAnswer(q, ans?.userAnswer);
              const currentScore =
                ans?.scoreGiven !== undefined ? ans.scoreGiven : evalRes.scoreGiven;

              let studentAnsText = 'Siswa tidak menjawab';
              if (ans?.userAnswer !== undefined && ans?.userAnswer !== null && ans?.userAnswer !== '') {
                if (['pilihan_ganda', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(q.type)) {
                  const opt = q.options?.find((o) => o.id === ans.userAnswer || o.text === ans.userAnswer);
                  studentAnsText = opt ? opt.text : String(ans.userAnswer);
                } else if (['pg_kompleks', 'checklist'].includes(q.type) && Array.isArray(ans.userAnswer)) {
                  const texts = ans.userAnswer.map((id) => {
                    const opt = q.options?.find((o) => o.id === id || o.text === id);
                    return opt ? opt.text : id;
                  });
                  studentAnsText = texts.length > 0 ? texts.join(', ') : 'Siswa tidak memilih';
                } else if (typeof ans.userAnswer === 'object') {
                  studentAnsText = JSON.stringify(ans.userAnswer);
                } else {
                  studentAnsText = String(ans.userAnswer);
                }
              }

              let keyAnsText = 'Lihat kunci pembahasan';
              if (['pilihan_ganda', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(q.type)) {
                const correctOpt = q.options?.find((o) => o.isCorrect === true || String(o.isCorrect) === 'true');
                keyAnsText = correctOpt ? correctOpt.text : q.correctAnswerText || 'Kunci belum diatur';
              } else if (['pg_kompleks', 'checklist'].includes(q.type)) {
                const correctOpts = q.options?.filter((o) => o.isCorrect === true || String(o.isCorrect) === 'true');
                keyAnsText = correctOpts && correctOpts.length > 0 ? correctOpts.map((o) => o.text).join(', ') : q.correctAnswerText || 'Kunci belum diatur';
              } else if (['isian_singkat', 'melengkapi_kalimat'].includes(q.type)) {
                keyAnsText = q.correctAnswerText || 'Kunci belum diatur';
              } else if (q.type === 'isian_angka') {
                keyAnsText = q.numericAnswer !== undefined ? String(q.numericAnswer) : 'Kunci belum diatur';
              } else if (q.discussion) {
                keyAnsText = q.discussion;
              }

              const isCorrectFlag = currentScore > 0 || evalRes.isCorrect;
              const isEssay = ['uraian_pendek', 'uraian_panjang'].includes(q.type);

              return (
                <div
                  key={q.id}
                  className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center">
                        {qIdx + 1}
                      </span>
                      <Badge variant="primary">{q.category}</Badge>
                      <span className="text-xs font-semibold text-slate-500 capitalize">
                        {q.type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div>
                      {isCorrectFlag ? (
                        <Badge variant="success">BENAR (+{currentScore} Poin)</Badge>
                      ) : isEssay ? (
                        <Badge variant="primary">EVALUASI ESSAY ({currentScore}/{q.weight} Poin)</Badge>
                      ) : (
                        <Badge variant="danger">SALAH (0 Poin)</Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
                    {q.questionText}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Jawaban Siswa:
                      </span>
                      <p
                        className={`text-xs font-semibold ${
                          ans?.userAnswer ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 italic'
                        }`}
                      >
                        {studentAnsText}
                      </p>
                    </div>

                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                        Kunci Jawaban Benar:
                      </span>
                      <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                        {keyAnsText}
                      </p>
                    </div>
                  </div>

                  {q.discussion && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg">
                      <b>Pembahasan:</b> {q.discussion}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t text-xs">
                    <span className="text-slate-500 font-medium">
                      Atur / Koreksi Nilai Soal Ini (Max {q.weight} Point):
                    </span>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min={0}
                        max={q.weight}
                        defaultValue={currentScore}
                        key={`${q.id}_${currentScore}`}
                        onBlur={(e) =>
                          handleSaveQuestionScore(q.id, Number(e.target.value))
                        }
                        className="w-20 p-1.5 text-center text-xs font-bold bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
                      />
                      <span className="font-bold text-slate-400">/ {q.weight}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {questions.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                Quiz ini belum memiliki daftar soal.
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
