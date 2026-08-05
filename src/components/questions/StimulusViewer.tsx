import React from 'react';
import { Stimulus } from '../../types';
import { FileText, Image as ImageIcon, Music, Video, Table, File } from 'lucide-react';

export const StimulusViewer: React.FC<{ stimulus?: Stimulus }> = ({ stimulus }) => {
  if (!stimulus || !stimulus.content) return null;

  return (
    <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700/80">
      {stimulus.title && (
        <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-blue-100 dark:border-slate-700">
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{stimulus.title}</h4>
        </div>
      )}

      {stimulus.type === 'text' && (
        <div className="prose dark:prose-invert max-w-none text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {stimulus.content}
        </div>
      )}

      {stimulus.type === 'image' && (
        <div className="flex justify-center my-2">
          <img
            src={stimulus.content}
            alt={stimulus.title || 'Stimulus Gambar'}
            className="max-h-80 rounded-xl object-contain shadow-sm border border-slate-200 dark:border-slate-700"
          />
        </div>
      )}

      {stimulus.type === 'audio' && (
        <div className="my-2 p-3 bg-white dark:bg-slate-700 rounded-xl flex items-center space-x-3">
          <Music className="w-5 h-5 text-sky-500" />
          <audio controls className="w-full">
            <source src={stimulus.content} />
            Browser Anda tidak mendukung pemutar audio.
          </audio>
        </div>
      )}

      {stimulus.type === 'video' && (
        <div className="my-2 aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
          <iframe
            src={stimulus.content}
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
