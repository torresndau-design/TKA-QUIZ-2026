import React from 'react';
import { Question } from '../../types';
import { StimulusViewer } from './StimulusViewer';
import { Badge } from '../common/Badge';
import { Volume2, Play } from 'lucide-react';

interface QuestionItemViewerProps {
  question: Question;
  number: number;
  value: any;
  onChange: (val: any) => void;
  showDiscussion?: boolean;
}

export const QuestionItemViewer: React.FC<QuestionItemViewerProps> = ({
  question,
  number,
  value,
  onChange,
  showDiscussion,
}) => {
  return (
    <div className="space-y-5">
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
      <div className="text-base font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
        {question.questionText}
      </div>

      {/* Interactive Answer Input based on 16 Question Types */}
      <div className="pt-2">
        {/* 1. Pilihan Ganda / 14. Gambar / 15. Audio / 16. Video */}
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
                    value={opt.id}
                    checked={isSelected}
                    onChange={() => onChange(opt.id)}
                    className="mt-1 w-4 h-4 text-[#2563EB] focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <span className="text-sm font-medium">{opt.text}</span>
                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt="Pilihan" className="mt-2 max-h-40 rounded-lg border" />
                    )}
                    {opt.audioUrl && (
                      <audio controls src={opt.audioUrl} className="mt-2 w-full max-w-sm" />
                    )}
                    {opt.videoUrl && (
                      <video controls src={opt.videoUrl} className="mt-2 max-h-48 rounded-lg" />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 2. PG Kompleks & 12. Checklist */}
        {['pg_kompleks', 'checklist'].includes(question.type) && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Pilih satu atau lebih jawaban yang sesuai.
            </p>
            {question.options?.map((opt) => {
              const currentArr: string[] = Array.isArray(value) ? value : [];
              const isChecked = currentArr.includes(opt.id);

              const handleCheck = () => {
                if (isChecked) {
                  onChange(currentArr.filter((id) => id !== opt.id));
                } else {
                  onChange([...currentArr, opt.id]);
                }
              };

              return (
                <label
                  key={opt.id}
                  className={`flex items-start p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                    isChecked
                      ? 'border-[#2563EB] bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={handleCheck}
                    className="mt-1 w-4 h-4 text-[#2563EB] rounded focus:ring-blue-500"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {opt.text}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {/* 3. Menjodohkan & 11. Drag and Drop */}
        {['menjodohkan', 'drag_drop'].includes(question.type) && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilih / jodohkan setiap item di kolom kiri dengan pasangan di kolom kanan.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {(() => {
                const pairs =
                  question.matchingPairs && question.matchingPairs.length > 0
                    ? question.matchingPairs
                    : question.options && question.options.length > 0
                    ? question.options.map((opt, idx) => {
                        const match = opt.text.match(/^(.*?)\s*(?:[\=\>]|\=\>|\-\>|\||\:)\s*(.*)$/);
                        if (match && match[1] && match[2]) {
                          return {
                            id: opt.id || `pair_${idx}`,
                            leftItem: match[1].trim(),
                            rightItem: match[2].trim(),
                          };
                        }
                        return {
                          id: opt.id || `pair_${idx}`,
                          leftItem: opt.text,
                          rightItem: `Pasangan ${idx + 1}`,
                        };
                      })
                    : [];

                const availableRights = pairs.map((p) => p.rightItem);

                return pairs.map((pair) => {
                  const currentMap = typeof value === 'object' && value ? value : {};
                  const selectedVal = currentMap[pair.id] || '';

                  return (
                    <div
                      key={pair.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 md:w-1/2">
                        {pair.leftItem}
                      </span>
                      <select
                        value={selectedVal}
                        onChange={(e) =>
                          onChange({
                            ...currentMap,
                            [pair.id]: e.target.value,
                          })
                        }
                        className="md:w-1/2 p-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Pasangan --</option>
                        {availableRights.map((rt, idx) => (
                          <option key={idx} value={rt}>
                            {rt}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* 4. Benar Salah & 5. Setuju Tidak Setuju */}
        {['benar_salah', 'setuju_tidak_setuju'].includes(question.type) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse border border-slate-200 dark:border-slate-700 rounded-xl">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <th className="p-3 border border-slate-200 dark:border-slate-700">Pernyataan</th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center w-28">
                    {question.type === 'benar_salah' ? 'Benar' : 'Setuju'}
                  </th>
                  <th className="p-3 border border-slate-200 dark:border-slate-700 text-center w-28">
                    {question.type === 'benar_salah' ? 'Salah' : 'Tidak Setuju'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const tfItems =
                    question.trueFalseItems && question.trueFalseItems.length > 0
                      ? question.trueFalseItems
                      : question.options && question.options.length > 0
                      ? question.options.map((opt, idx) => ({
                          id: opt.id || `tf_${idx}`,
                          statement: opt.text,
                          correctAnswer: opt.isCorrect ?? true,
                        }))
                      : [];

                  return tfItems.map((item) => {
                    const currentMap = typeof value === 'object' && value ? value : {};
                    const currentChoice = currentMap[item.id];

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200">
                          {item.statement}
                        </td>
                        <td className="p-3 border border-slate-200 dark:border-slate-700 text-center">
                          <input
                            type="radio"
                            name={`tf_${item.id}`}
                            checked={currentChoice === true}
                            onChange={() => onChange({ ...currentMap, [item.id]: true })}
                            className="w-4 h-4 text-[#2563EB]"
                          />
                        </td>
                        <td className="p-3 border border-slate-200 dark:border-slate-700 text-center">
                          <input
                            type="radio"
                            name={`tf_${item.id}`}
                            checked={currentChoice === false}
                            onChange={() => onChange({ ...currentMap, [item.id]: false })}
                            className="w-4 h-4 text-[#2563EB]"
                          />
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. Isian Singkat & 13. Melengkapi Kalimat */}
        {['isian_singkat', 'melengkapi_kalimat'].includes(question.type) && (
          <div>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ketik jawaban singkat Anda di sini..."
              className="w-full p-3 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
            />
          </div>
        )}

        {/* 7. Isian Angka */}
        {question.type === 'isian_angka' && (
          <div>
            <input
              type="number"
              step="any"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Masukkan angka (contoh: 85)"
              className="w-full max-w-xs p-3 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
            />
          </div>
        )}

        {/* 8. Uraian Pendek & 9. Uraian Panjang */}
        {['uraian_pendek', 'uraian_panjang'].includes(question.type) && (
          <div>
            <textarea
              rows={question.type === 'uraian_panjang' ? 6 : 3}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Ketik uraian jawaban secara rinci di sini..."
              className="w-full p-3 text-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:border-[#2563EB] focus:outline-none"
            />
          </div>
        )}

        {/* 10. Mengurutkan */}
        {question.type === 'mengurutkan' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gunakan tombol panah Naik / Turun untuk mengurutkan item dari yang paling awal/terkecil.
            </p>
            {(() => {
              const currentSeq: string[] =
                Array.isArray(value) && value.length > 0 ? value : question.sequenceItems || [];

              const moveUp = (idx: number) => {
                if (idx === 0) return;
                const copy = [...currentSeq];
                const temp = copy[idx - 1];
                copy[idx - 1] = copy[idx];
                copy[idx] = temp;
                onChange(copy);
              };

              const moveDown = (idx: number) => {
                if (idx === currentSeq.length - 1) return;
                const copy = [...currentSeq];
                const temp = copy[idx + 1];
                copy[idx + 1] = copy[idx];
                copy[idx] = temp;
                onChange(copy);
              };

              return (
                <div className="space-y-2">
                  {currentSeq.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {idx + 1}. {item}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moveUp(idx)}
                          disabled={idx === 0}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded disabled:opacity-40"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveDown(idx)}
                          disabled={idx === currentSeq.length - 1}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded disabled:opacity-40"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Discussion / Pembahasan display if permitted */}
      {showDiscussion && question.discussion && (
        <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <div className="font-bold text-xs text-emerald-800 dark:text-emerald-300 mb-1">
            💡 Pembahasan Soal:
          </div>
          <div className="text-sm text-emerald-900 dark:text-emerald-200">{question.discussion}</div>
        </div>
      )}
    </div>
  );
};
