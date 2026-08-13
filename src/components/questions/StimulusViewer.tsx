import React, { useState } from 'react';
import { Stimulus } from '../../types';
import { FileText, Image as ImageIcon, Music, Video, Table, File, ZoomIn } from 'lucide-react';
import { ImageZoomModal } from '../common/ImageZoomModal';
import { RichText, getCleanImageSrc, getCleanMediaSrc } from '../common/RichText';

export const StimulusViewer: React.FC<{ stimulus?: Stimulus }> = ({ stimulus }) => {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [hasImgError, setHasImgError] = useState(false);

  if (!stimulus || !stimulus.content) return null;

  const cleanImgSrc = stimulus.type === 'image' ? getCleanImageSrc(stimulus.content) : '';
  const cleanAudioSrc = stimulus.type === 'audio' ? getCleanMediaSrc(stimulus.content) : '';
  const cleanVideoSrc = stimulus.type === 'video' ? getCleanMediaSrc(stimulus.content) : '';

  return (
    <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700/80">
      {stimulus.title && (
        <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-blue-100 dark:border-slate-700">
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{stimulus.title}</h4>
        </div>
      )}

      {stimulus.type === 'text' && (
        <RichText content={stimulus.content} className="text-sm text-slate-700 dark:text-slate-300" />
      )}

      {stimulus.type === 'image' && cleanImgSrc && (
        <>
          <div className="flex flex-col items-center my-2">
            {!hasImgError ? (
              <div className="relative group cursor-pointer" onClick={() => setIsZoomOpen(true)}>
                <img
                  src={cleanImgSrc}
                  alt={stimulus.title || 'Stimulus Gambar'}
                  onError={() => setHasImgError(true)}
                  className="max-h-80 rounded-xl object-contain shadow-sm border border-slate-200 dark:border-slate-700 transition-transform group-hover:scale-[1.01]"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center text-white font-bold text-xs gap-1.5">
                  <ZoomIn className="w-5 h-5" /> Klik untuk Memperbesar Gambar
                </div>
              </div>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-center space-y-1 my-2">
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                  Gambar tidak dapat dimuat. Pastikan URL/link gambar valid atau gambar telah di-insert langsung ke dokumen Word.
                </p>
              </div>
            )}
            {!hasImgError && (
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 hover:underline"
              >
                <ZoomIn className="w-3.5 h-3.5" /> Perbesar / Zoom Gambar
              </button>
            )}
          </div>
          <ImageZoomModal
            src={cleanImgSrc}
            alt={stimulus.title || 'Stimulus Gambar'}
            isOpen={isZoomOpen}
            onClose={() => setIsZoomOpen(false)}
          />
        </>
      )}

      {stimulus.type === 'audio' && cleanAudioSrc && (
        <div className="my-2 p-3 bg-white dark:bg-slate-700 rounded-xl flex items-center space-x-3">
          <Music className="w-5 h-5 text-sky-500" />
          <audio controls className="w-full">
            <source src={cleanAudioSrc} />
            Browser Anda tidak mendukung pemutar audio.
          </audio>
        </div>
      )}

      {stimulus.type === 'video' && cleanVideoSrc && (
        <div className="my-2 aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
          <iframe
            src={cleanVideoSrc}
            title={stimulus.title || 'Stimulus Video'}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      )}

      {stimulus.type === 'table' && (
        <div className="overflow-x-auto my-2" dangerouslySetInnerHTML={{ __html: stimulus.content }} />
      )}

      {stimulus.type === 'pdf' && (
        <div className="my-2 p-3 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <File className="w-5 h-5 text-red-500" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Dokumen Lampiran PDF</span>
          </div>
          <a
            href={stimulus.content}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 font-bold hover:underline"
          >
            Buka Dokumen
          </a>
        </div>
      )}
    </div>
  );
};
