import React, { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

interface ImageZoomModalProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({
  src,
  alt = 'Gambar Zoom',
  isOpen,
  onClose,
}) => {
  const [scale, setScale] = useState(1);

  if (!isOpen) return null;

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.75));
  const handleReset = () => setScale(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4"
      onClick={onClose}
    >
      {/* Top Controls */}
      <div
        className="w-full flex items-center justify-between max-w-xl text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-bold bg-white/10 px-3 py-1.5 rounded-full">
          Zoom: {Math.round(scale * 100)}%
        </span>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors active:scale-95"
            title="Perkecil (Zoom Out)"
          >
            <ZoomOut className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors active:scale-95"
            title="Perbesar (Zoom In)"
          >
            <ZoomIn className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleReset}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors active:scale-95"
            title="Reset Zoom"
          >
            <RotateCcw className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 bg-red-600/80 hover:bg-red-600 rounded-xl transition-colors active:scale-95 ml-2"
            title="Tutup"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Main Image View Area */}
      <div
        className="flex-1 w-full flex items-center justify-center overflow-auto p-4 cursor-grab"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      <p className="text-xs text-slate-400 text-center z-10 mb-2">
        Gunakan tombol di atas atau cubit layar (pinch) untuk memperbesar/memperkecil gambar.
      </p>
    </div>
  );
};
