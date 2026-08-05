import jsPDF from 'jspdf';
import { Participant, Quiz } from '../types';

export function exportResultsToPDF(quiz: Quiz, participants: Participant[], schoolName: string) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(16);
  doc.setTextColor(37, 99, 235); // Primary #2563EB
  doc.text(schoolName.toUpperCase(), 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`LAPORAN HASIL QUIZ AKM: ${quiz.title.toUpperCase()}`, 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Mata Pelajaran: ${quiz.subjectName} | Kelas: ${quiz.targetClass}`, 14, 35);
  doc.text(`Guru Pengampu: ${quiz.teacherName} | Min Passing (KKM): ${quiz.minPassingGrade}`, 14, 41);
  doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 47);

  doc.line(14, 51, 196, 51);

  // Table Headers
  let y = 60;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');

  doc.text('No', 14, y);
  doc.text('Nama Peserta', 25, y);
  doc.text('NIS', 80, y);
  doc.text('Kelas', 115, y);
  doc.text('Nilai', 150, y);
  doc.text('Status', 170, y);

  doc.setFont('helvetica', 'normal');
  y += 6;

  participants.forEach((p, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const isPassed = (p.score ?? 0) >= quiz.minPassingGrade;

    doc.text(String(index + 1), 14, y);
    doc.text(p.fullName.substring(0, 26), 25, y);
    doc.text(p.nis, 80, y);
    doc.text(p.studentClass, 115, y);
    doc.text(String(p.score ?? 0), 150, y);
    doc.text(isPassed ? 'LULUS' : 'REMIDI', 170, y);

    y += 7;
  });

  // Footer summary
  y += 5;
  if (y < 270) {
    const total = participants.length;
    const avg = total > 0 ? (participants.reduce((acc, curr) => acc + (curr.score || 0), 0) / total).toFixed(1) : 0;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Peserta: ${total} Siswa  |  Rata-Rata Nilai: ${avg}`, 14, y);
  }

  doc.save(`Laporan_AKM_${quiz.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}
