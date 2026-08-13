import React from 'react';
import { Question } from '../../types';
import { StimulusViewer } from './StimulusViewer';
import { MatchingLineQuestion } from './MatchingLineQuestion';
import { Badge } from '../common/Badge';
import { Volume2, Play } from 'lucide-react';
import { normalizeMatchingPairs } from '../../utils/questionUtils';
import { RichText } from '../common/RichText';

interface QuestionItemViewerProps {
  question: Question;
  number: number;
  value: any;
  onChange: (val: any) => void;
  showDiscussion?: boolean;
  fontSizeLevel?: number;
}

export const QuestionItemViewer: React.FC<QuestionItemViewerProps> = ({
  question,
  number,
  value,
  onChange,
  showDiscussion,
  fontSizeLevel = 100,
}) => {
  return (
    <div className="space-y-5" style={{ fontSize: `${fontSizeLevel}%` }}>
      {/* Question Header & Meta Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center space-x-2">
          <span className="w-8 h-8 rounded-xl bg-[#2563EB] text-white font-extrabold text-sm flex items-center justify-center">
            {number}
          </span>
          <Badge variant="primary">{question.category}</Badge>
          <Badge variant="secondary">{question.cognitiveLevel}</Badge>
          <Badge variant="slate">Bobot: {question.weight}</Badge>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 font-medium capitalize">
          Tipe: {question.type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Stimulus */}
      <StimulusViewer stimulus={question.stimulus} />

      {/* Question Text */}
      <RichText content={question.questionText} className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed" />

      {/* Interactive Answer Input */}
      <div className="pt-2">
        {['pilihan_ganda', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(question.type) && (
          <div className="grid grid-cols-1 gap-3">
            {question.options?.map((opt) => {
              const isSelected = value === opt.id;
              return (
                <label
                  key={opt.id}
                  className={`flex items-start p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q_${question.id}`}
                    checked={isSelected}
                    onChange={() => onChange(opt.id)}
                    className="sr-only"
                  />
                  <div className="flex items-start gap-3 w-full">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-[#2563EB] text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {opt.label || opt.id.toUpperCase()}
                    </span>
                    <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                      <RichText content={opt.text} />
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Discussion / Pembahasan display if permitted */}
      {showDiscussion && question.discussion && (
        <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="font-bold text-xs text-emerald-800 dark:text-emerald-300 mb-1">
            💡 Pembahasan Soal:
          </div>
          <RichText content={question.discussion} className="text-sm text-emerald-900 dark:text-emerald-200" />
        </div>
      )}
    </div>
  );
};