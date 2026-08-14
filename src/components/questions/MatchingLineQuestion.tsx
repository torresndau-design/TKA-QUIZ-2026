import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MatchingPair } from '../../types';
import { Button } from '../common/Button';
import { RichText } from '../common/RichText';
import { RefreshCw, Unlink, Sparkles, CheckCircle2 } from 'lucide-react';

interface MatchingLineQuestionProps {
  questionId: string;
  pairs: MatchingPair[];
  value: Record<string, string>; // pairId -> selected rightItem
  onChange: (val: Record<string, string>) => void;
  readOnly?: boolean;
}

// Preset vibrant line colors so intersecting lines are easy to distinguish
const LINE_COLORS = [
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#7C3AED', // Purple
  '#E11D48', // Rose
  '#0891B2', // Cyan
  '#4F46E5', // Indigo
  '#0D9488', // Teal
];

export const MatchingLineQuestion: React.FC<MatchingLineQuestionProps> = ({
  questionId,
  pairs,
  value = {},
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftNodesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const rightNodesRef = useRef<Record<string, HTMLDivElement | null>>({});

  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [selectedRightText, setSelectedRightText] = useState<string | null>(null);
  const [lineCoords, setLineCoords] = useState<
    { pairId: string; leftId: string; rightItem: string; x1: number; y1: number; x2: number; y2: number; color: string }[]
  >([]);

  // Unique list of right items
  const rightItems = React.useMemo(() => {
    const rights = Array.from(new Set(pairs.map((p) => p.rightItem)));
    return rights;
  }, [pairs]);

  // If in readOnly mode (e.g. pembahasan) and value is empty, display the correct pair keys
  const effectiveValue = React.useMemo(() => {
    if (readOnly && Object.keys(value || {}).length === 0) {
      const defaultMap: Record<string, string> = {};
      pairs.forEach((p) => {
        defaultMap[p.id] = p.rightItem;
      });
      return defaultMap;
    }
    return value || {};
  }, [readOnly, value, pairs]);

  // Recalculate line coordinates whenever value, pairs, or window dimensions change
  const updateLines = React.useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const newCoords: {
      pairId: string;
      leftId: string;
      rightItem: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }[] = [];

    pairs.forEach((pair, index) => {
      const matchedRight = effectiveValue[pair.id];
      if (!matchedRight) return;

      const leftNode = leftNodesRef.current[pair.id];
      const rightNode = rightNodesRef.current[matchedRight];

      if (leftNode && rightNode) {
        const leftRect = leftNode.getBoundingClientRect();
        const rightRect = rightNode.getBoundingClientRect();

        const x1 = leftRect.left + leftRect.width / 2 - containerRect.left;
        const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
        const x2 = rightRect.left + rightRect.width / 2 - containerRect.left;
        const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

        const color = LINE_COLORS[index % LINE_COLORS.length];

        newCoords.push({
          pairId: pair.id,
          leftId: pair.id,
          rightItem: matchedRight,
          x1,
          y1,
          x2,
          y2,
          color,
        });
      }
    });

    setLineCoords(newCoords);
  }, [pairs, effectiveValue]);

  useLayoutEffect(() => {
    updateLines();
  }, [updateLines]);

  useEffect(() => {
    const handleResize = () => updateLines();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => updateLines());
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [updateLines]);

  // Handle clicking left item
  const handleLeftClick = (pairId: string) => {
    if (readOnly) return;

    if (selectedRightText) {
      // Connect right to left
      const updated = { ...value, [pairId]: selectedRightText };
      onChange(updated);
      setSelectedRightText(null);
      setSelectedLeftId(null);
    } else if (selectedLeftId === pairId) {
      setSelectedLeftId(null);
    } else {
      setSelectedLeftId(pairId);
      setSelectedRightText(null);
    }
  };

  // Handle clicking right item
  const handleRightClick = (rightItem: string) => {
    if (readOnly) return;

    if (selectedLeftId) {
      // Connect selectedLeftId to rightItem
      const updated = { ...value, [selectedLeftId]: rightItem };
      onChange(updated);
      setSelectedLeftId(null);
      setSelectedRightText(null);
    } else if (selectedRightText === rightItem) {
      setSelectedRightText(null);
    } else {
      setSelectedRightText(rightItem);
      setSelectedLeftId(null);
    }
  };

  // Disconnect line for a pair
  const handleDisconnect = (pairId: string) => {
    if (readOnly) return;
    const updated = { ...value };
    delete updated[pairId];
    onChange(updated);
    setSelectedLeftId(null);
    setSelectedRightText(null);
  };

  // Reset all
  const handleReset = () => {
    if (readOnly) return;
    onChange({});
    setSelectedLeftId(null);
    setSelectedRightText(null);
  };

  const connectedCount = Object.keys(effectiveValue).length;

  return (
    <div className="space-y-4">
      {/* Header Info & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60">
        <div className="flex items-center space-x-2 text-xs font-semibold text-blue-900 dark:text-blue-200">
          <Sparkles className="w-4 h-4 text-[#2563EB]" />
          <span>
            {readOnly
              ? 'Tampilan Garis Penjodohan'
              : selectedLeftId
              ? '👉 Klik pilihan di Kolom Kanan untuk menghubungkan garis!'
              : selectedRightText
              ? '👉 Klik pernyataan di Kolom Kiri untuk menghubungkan garis!'
              : 'Klik poin di Kolom Kiri lalu Kolom Kanan (atau sebaliknya) untuk menarik garis hubungan.'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Terhubung: <span className="text-[#2563EB] font-black">{connectedCount}</span> / {pairs.length}
          </span>
          {!readOnly && connectedCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/50 rounded-lg transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Reset Garis
            </button>
          )}
        </div>
      </div>

      {/* Main Table-like Dual Column Canvas Container */}
      <div
        ref={containerRef}
        className="relative min-h-[300px] p-4 bg-white dark:bg-slate-800/90 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-sm"
      >
        {/* SVG Canvas overlay for drawing connecting lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
          <defs>
            {/* Arrow marker definitions */}
            {LINE_COLORS.map((col, idx) => (
              <React.Fragment key={idx}>
                <marker
                  id={`arrow-end-${idx}`}
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill={col} />
                </marker>
                <marker
                  id={`arrow-start-${idx}`}
                  viewBox="0 0 10 10"
                  refX="4"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 10 1 L 0 5 L 10 9 z" fill={col} />
                </marker>
              </React.Fragment>
            ))}
          </defs>

          {lineCoords.map((line, idx) => {
            const colorIdx = idx % LINE_COLORS.length;
            // Draw smooth cubic bezier or straight line
            const dx = Math.abs(line.x2 - line.x1) * 0.4;
            const pathD = `M ${line.x1} ${line.y1} C ${line.x1 + dx} ${line.y1}, ${line.x2 - dx} ${line.y2}, ${line.x2} ${line.y2}`;

            return (
              <g key={line.pairId} className="transition-all duration-300">
                {/* Background glow line */}
                <path
                  d={pathD}
                  stroke={line.color}
                  strokeWidth="6"
                  strokeOpacity="0.25"
                  fill="none"
                />
                {/* Main line with arrow markers */}
                <path
                  d={pathD}
                  stroke={line.color}
                  strokeWidth="3"
                  fill="none"
                  markerStart={`url(#arrow-start-${colorIdx})`}
                  markerEnd={`url(#arrow-end-${colorIdx})`}
                  className="drop-shadow-sm"
                />
              </g>
            );
          })}
        </svg>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 relative z-20">
          {/* Column Left: SOAL / PERNYATAAN */}
          <div className="space-y-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-700/80 rounded-xl text-center border border-slate-200 dark:border-slate-600">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                SOAL / PERNYATAAN (KOLOM KIRI)
              </h4>
            </div>

            <div className="space-y-3">
              {pairs.map((pair, idx) => {
                const isSelected = selectedLeftId === pair.id;
                const connectedRight = effectiveValue[pair.id];
                const rightLetterIdx = connectedRight ? rightItems.indexOf(connectedRight) : -1;
                const rightLetter = rightLetterIdx >= 0 ? String.fromCharCode(65 + rightLetterIdx) : null;

                return (
                  <div
                    key={pair.id}
                    onClick={() => handleLeftClick(pair.id)}
                    className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#2563EB] bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-400 shadow-md scale-[1.01]'
                        : selectedRightText
                        ? 'hover:border-blue-400 hover:bg-blue-50/40 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        : connectedRight
                        ? 'border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-800 dark:text-slate-100'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start space-x-2.5 flex-1 pr-2">
                      <span className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug flex-1">
                        <RichText content={pair.leftItem} />
                      </div>
                    </div>

                    {/* Connected Badge / Disconnect Button */}
                    <div className="flex items-center space-x-1 shrink-0">
                      {connectedRight ? (
                        <div className="flex items-center space-x-1">
                          <span className="px-2 py-0.5 text-[11px] font-black bg-emerald-600 text-white rounded-md flex items-center gap-1 shadow-sm">
                            <CheckCircle2 className="w-3 h-3" />
                            {rightLetter ? `[${rightLetter}]` : ''}
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDisconnect(pair.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                              title="Lepas Garis"
                            >
                              <Unlink className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : isSelected ? (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 animate-pulse">
                          PILIH PASANGAN ▶
                        </span>
                      ) : selectedRightText ? (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 animate-pulse">
                          ◀ HUBUNGKAN
                        </span>
                      ) : null}

                      {/* Anchor Node Dot on Right side of Left Item */}
                      <div
                        ref={(el) => (leftNodesRef.current[pair.id] = el)}
                        className={`w-4 h-4 rounded-full border-2 transition-transform ${
                          isSelected
                            ? 'bg-[#2563EB] border-white scale-125 ring-4 ring-blue-300'
                            : connectedRight
                            ? 'bg-emerald-500 border-white ring-2 ring-emerald-300'
                            : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-800'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column Right: JAWABAN / PASANGAN */}
          <div className="space-y-3">
            <div className="p-2.5 bg-slate-100 dark:bg-slate-700/80 rounded-xl text-center border border-slate-200 dark:border-slate-600">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                JAWABAN / PASANGAN (KOLOM KANAN)
              </h4>
            </div>

            <div className="space-y-3">
              {rightItems.map((rightText, rIdx) => {
                const letter = String.fromCharCode(65 + rIdx);
                const isSelected = selectedRightText === rightText;
                // Check if any left item is connected to this right item
                const isMatchedToAny = Object.values(effectiveValue).includes(rightText);

                return (
                  <div
                    key={rIdx}
                    onClick={() => handleRightClick(rightText)}
                    className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-[#2563EB] bg-blue-50 dark:bg-blue-950/60 ring-2 ring-blue-400 shadow-md scale-[1.01]'
                        : selectedLeftId
                        ? 'hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/20'
                        : isMatchedToAny
                        ? 'border-emerald-500/80 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {/* Anchor Node Dot on Left side of Right Item */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div
                        ref={(el) => (rightNodesRef.current[rightText] = el)}
                        className={`w-4 h-4 rounded-full border-2 transition-transform ${
                          isSelected
                            ? 'bg-[#2563EB] border-white scale-125 ring-4 ring-blue-300'
                            : isMatchedToAny
                            ? 'bg-emerald-500 border-white ring-2 ring-emerald-300'
                            : 'bg-slate-300 dark:bg-slate-600 border-white dark:border-slate-800'
                        }`}
                      />
                      <span className="w-6 h-6 rounded-lg bg-[#2563EB] text-white text-xs font-black flex items-center justify-center shrink-0">
                        {letter}
                      </span>
                    </div>

                    <div className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 pl-1">
                      <RichText content={rightText} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

