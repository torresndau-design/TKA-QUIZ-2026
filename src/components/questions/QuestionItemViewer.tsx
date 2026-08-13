import React from 'react';
import { Question, UserAnswer, MatchingAnswer } from '../../types';
import { CheckCircle, XCircle, Flag, HelpCircle, Check, X } from 'lucide-react';
import { Button } from '../ui/Button';
import RichText from '../common/RichText';

interface QuestionItemViewerProps {
  question: Question;
  index?: number;
  userAnswer?: UserAnswer;
  onAnswerChange?: (answer: UserAnswer) => void;
  showExplanation?: boolean;
}

export default function QuestionItemViewer({
  question,
  index,
  userAnswer,
  onAnswerChange,
  showExplanation = false,
}: QuestionItemViewerProps) {
  // Pilihan Ganda (Single Choice)
  const handleSingleChoice = (optionText: string) => {
    if (onAnswerChange) onAnswerChange(optionText);
  };

  // PG Kompleks (Multiple Choice)
  const handleMultipleChoice = (optionId: string) => {
    if (!onAnswerChange) return;
    const current = Array.isArray(userAnswer) ? (userAnswer as string[]) : [];
    if (current.includes(optionId)) {
      onAnswerChange(current.filter((id) => id !== optionId));
    } else {
      onAnswerChange([...current, optionId]);
    }
  };

  // Benar / Salah
  const handleTrueFalse = (optionId: string, val: 'BENAR' | 'SALAH') => {
    if (!onAnswerChange) return;
    const current = typeof userAnswer === 'object' && !Array.isArray(userAnswer)
      ? (userAnswer as Record<string, string>)
      : {};
    onAnswerChange({
      ...current,
      [optionId]: val,
    });
  };

  // Menjodohkan
  const handleMatching = (leftId: string, rightText: string) => {
    if (!onAnswerChange) return;
    const current = typeof userAnswer === 'object' && !Array.isArray(userAnswer)
      ? (userAnswer as Record<string, string>)
      : {};
    onAnswerChange({
      ...current,
      [leftId]: rightText,
    });
  };

  return (
    <div className="space-y-4">
      {/* Stimulus */}
      {question.stimulus && (
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 mb-4">
          {question.stimulus.type === 'text' && (
            <RichText content={question.stimulus.content} className="text-slate-800 dark:text-slate-200 text-sm" />
          )}
          {question.stimulus.type === 'image' && (
            <img src={question.stimulus.content} alt="Stimulus" className="max-h-60 rounded object-contain" />
          )}
        </div>
      )}

      {/* Pertanyaan */}
      <RichText content={question.questionText} className="font-semibold text-slate-800 dark:text-slate-100 mb-4 text-base" />

      {/* Sub-label untuk Tipe Soal Kompleks */}
      {question.type === 'pg_kompleks' && (
        <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-3">
          *Pilih satu atau lebih jawaban yang sesuai.
        </p>
      )}

      {/* RENDER PILIHAN GANDA (SINGLE CHOICE) */}
      {question.type === 'pilihan_ganda' && (
        <div className="space-y-2.5">
          {question.options?.map((opt, idx) => {
            const isSelected = userAnswer === opt.text;
            const isCorrectOpt = showExplanation && opt.isCorrect;
            const isWrongOpt = showExplanation && isSelected && !opt.isCorrect;

            let borderClass = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750';
            if (isSelected) {
              borderClass = 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 font-bold';
            }
            if (isCorrectOpt) {
              borderClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200';
            } else if (isWrongOpt) {
              borderClass = 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-900 dark:text-red-200';
            }

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSingleChoice(opt.text)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${borderClass}`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 dark:text-slate-500 min-w-[20px]">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <RichText content={opt.text} className="text-slate-800 dark:text-slate-100 font-medium inline-block" />
                </div>
                {isCorrectOpt && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
                {isWrongOpt && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {/* RENDER PILIHAN GANDA KOMPLEKS (MULTIPLE CHOICE) */}
      {question.type === 'pg_kompleks' && (
        <div className="space-y-2.5">
          {question.options?.map((opt, idx) => {
            const currentSelected = Array.isArray(userAnswer) ? (userAnswer as string[]) : [];
            const isChecked = currentSelected.includes(opt.id);

            return (
              <label
                key={opt.id}
                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isChecked
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleMultipleChoice(opt.id)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="font-bold text-slate-400 dark:text-slate-500 min-w-[20px]">
                  {String.fromCharCode(65 + idx)}.
                </span>
                <RichText content={opt.text} className="text-slate-800 dark:text-slate-100 font-medium inline-block" />
              </label>
            );
          })}
        </div>
      )}

      {/* RENDER BENAR / SALAH */}
      {question.type === 'benar_salah' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
                <th className="p-3 border border-slate-200 dark:border-slate-700 w-12 text-center">No</th>
                <th className="p-3 border border-slate-200 dark:border-slate-700">Pernyataan</th>
                <th className="p-3 border border-slate-200 dark:border-slate-700 w-24 text-center">Benar</th>
                <th className="p-3 border border-slate-200 dark:border-slate-700 w-24 text-center">Salah</th>
              </tr>
            </thead>
            <tbody>
              {question.options?.map((opt, idx) => {
                const currentObj = typeof userAnswer === 'object' && !Array.isArray(userAnswer)
                  ? (userAnswer as Record<string, string>)
                  : {};
                const val = currentObj[opt.id];

                return (
                  <tr key={opt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700">
                      <RichText content={opt.text} className="text-slate-800 dark:text-slate-200 text-sm inline-block" />
                    </td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-center">
                      <input
                        type="radio"
                        name={`bs_${question.id}_${opt.id}`}
                        checked={val === 'BENAR'}
                        onChange={() => handleTrueFalse(opt.id, 'BENAR')}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="p-3 border border-slate-200 dark:border-slate-700 text-center">
                      <input
                        type="radio"
                        name={`bs_${question.id}_${opt.id}`}
                        checked={val === 'SALAH'}
                        onChange={() => handleTrueFalse(opt.id, 'SALAH')}
                        className="w-4 h-4 text-blue-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RENDER MENJODOHKAN */}
      {question.type === 'menjodohkan' && (
        <div className="space-y-3">
          {question.options?.map((opt, idx) => {
            const currentObj = typeof userAnswer === 'object' && !Array.isArray(userAnswer)
              ? (userAnswer as Record<string, string>)
              : {};
            const selectedVal = currentObj[opt.id] || '';

            return (
              <div key={opt.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex-1 flex items-center gap-2">
                  <span className="font-bold text-slate-400">{idx + 1}.</span>
                  <RichText content={opt.text} className="text-slate-800 dark:text-slate-200 font-medium inline-block" />
                </div>
                <span className="text-slate-400 font-bold hidden sm:inline">=</span>
                <div className="w-full sm:w-64">
                  <select
                    value={selectedVal}
                    onChange={(e) => handleMatching(opt.id, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="">-- Pilih Pasangan --</option>
                    {question.options?.map((oTarget) => (
                      <option key={oTarget.id} value={oTarget.text}>
                        {oTarget.text}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* RENDER ISIAN SINGKAT / URAIAN */}
      {(question.type === 'uraian_pendek' || question.type === 'isian_angka') && (
        <div className="pt-2">
          <input
            type={question.type === 'isian_angka' ? 'number' : 'text'}
            value={typeof userAnswer === 'string' ? userAnswer : ''}
            onChange={(e) => onAnswerChange && onAnswerChange(e.target.value)}
            placeholder="Ketikkan jawaban singkat Anda di sini..."
            className="w-full px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>
      )}

      {/* Pembahasan */}
      {showExplanation && question.discussion && (
        <div className="mt-5 p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2 font-bold text-blue-900 dark:text-blue-300 text-sm">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Pembahasan:</span>
          </div>
          <RichText content={question.discussion} className="text-slate-700 dark:text-slate-300 text-sm" />
        </div>
      )}
    </div>
  );
}