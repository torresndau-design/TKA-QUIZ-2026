import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  fontSizeLevel: number; // e.g. 100
  setFontSizeLevel: React.Dispatch<React.SetStateAction<number>>;
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  fontSizeLevel,
  setFontSizeLevel,
  className = '',
}) => {
  const handleZoomIn = () => setFontSizeLevel((prev) => Math.min(prev + 10, 160));
  const handleZoomOut = () => setFontSizeLevel((prev) => Math.max(prev - 10, 80));
  const handleReset = () => setFontSizeLevel(100);

  return (
    <div className={`flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 ${className}`}>
      <button
        type="button"
        onClick={handleZoomOut}
        disabled={fontSizeLevel <= 80}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
        title="Perkecil Ukuran Teks (Zoom Out)"
      >
        <ZoomOut className="w-4 h-4" />
      </button>

      <span
        onClick={handleReset}
        className="text-[11px] font-bold font-mono text-slate-700 dark:text-slate-200 px-1.5 cursor-pointer hover:underline"
        title="Klik untuk reset zoom ke 100%"
      >
        {fontSizeLevel}%
      </span>

      <button
        type="button"
        onClick={handleZoomIn}
        disabled={fontSizeLevel >= 160}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
        title="Perbesar Ukuran Teks (Zoom In)"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
    </div>
  );
};
