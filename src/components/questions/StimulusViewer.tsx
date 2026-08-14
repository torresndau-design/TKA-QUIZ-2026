import React, { useState, useRef } from 'react';
import { Stimulus } from '../../types';
import { FileText, ZoomIn, AlertTriangle, Upload, CheckCircle2 } from 'lucide-react';
import { ImageZoomModal } from '../common/ImageZoomModal';
import { AudioPlayer } from '../common/AudioPlayerRecorder';
import { RichText, getCleanImageSrc, getCleanMediaSrc, isValidImageSrc, isLocalWordImagePath, cleanHtmlContent } from '../common/RichText';

interface StimulusViewerProps {
  stimulus?: Stimulus;
  onReplaceImage?: (newBase64: string) => void;
  onReplaceAudio?: (newAudioData: string) => void;
}

export const StimulusViewer: React.FC<StimulusViewerProps> = ({ stimulus, onReplaceImage, onReplaceAudio }) => {
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [hasImgError, setHasImgError] = useState(false);
  const [isUploaded, setIsUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!stimulus || !stimulus.content || !stimulus.content.trim()) return null;

  // If text stimulus, ensure there is actual readable text after stripping empty HTML
  if (stimulus.type === 'text') {
    const cleaned = cleanHtmlContent(stimulus.content);
    if (!cleaned || !cleaned.trim()) return null;
  }

  const cleanImgSrc = stimulus.type === 'image' ? getCleanImageSrc(stimulus.content) : '';
  const isImgValid = stimulus.type === 'image' && isValidImageSrc(cleanImgSrc);
  const isLocalPath = stimulus.type === 'image' && (isLocalWordImagePath(cleanImgSrc) || isLocalWordImagePath(stimulus.content));
  const cleanVideoSrc = stimulus.type === 'video' ? getCleanMediaSrc(stimulus.content) : '';

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target?.result as string;
      if (base64) {
        setIsUploaded(true);
        setHasImgError(false);
        if (onReplaceImage) {
          onReplaceImage(base64);
        } else {
          // Mutate local stimulus content for live view
          stimulus.content = base64;
          stimulus.type = 'image';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAudioReplace = (newAudioData: string) => {
    if (onReplaceAudio) {
      onReplaceAudio(newAudioData);
    } else {
      stimulus.content = newAudioData;
      stimulus.type = 'audio';
    }
  };

  return (
    <div className="mb-6 p-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-100 dark:border-slate-700/80">
      {stimulus.title && (
        <div className="flex items-center space-x-2 mb-3 pb-2 border-b border-blue-100 dark:border-slate-700">
          <FileText className="w-4 h-4 text-[#2563EB]" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">{stimulus.title}</h4>
        </div>
      )}

      {/* Hidden file input for quick image attachment */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleManualUpload}
        className="hidden"
      />

      {stimulus.type === 'text' && (
        <RichText content={stimulus.content} className="text-sm text-slate-700 dark:text-slate-300" />
      )}

      {stimulus.type === 'image' && (
        <>
          <div className="flex flex-col items-center my-2">
            {isImgValid && !hasImgError ? (
              <>
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
                <div className="flex items-center gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(true)}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                  >
                    <ZoomIn className="w-3.5 h-3.5" /> Perbesar Gambar
                  </button>
                  {onReplaceImage && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <Upload className="w-3.5 h-3.5" /> Ganti Gambar
                    </button>
                  )}
                </div>
              </>
            ) : isLocalPath || hasImgError ? (
              <div className="w-full p-4 bg-amber-50/95 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 rounded-xl space-y-3 text-left shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 flex-1">
                    <p className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                      Gambar Soal Perlu Dilampirkan
                    </p>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      Dokumen Word merujuk gambar ke file komputer lokal:{' '}
                      <code className="bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded font-mono text-[11px] text-amber-900 dark:text-amber-200 break-all">
                        {cleanImgSrc || stimulus.content}
                      </code>
                      . Karena disimpan di folder lokal terpisah pada komputer Anda, browser web membutuhkan gambar langsung.
                    </p>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <Upload className="w-4 h-4" />
                        Pilih &amp; Pasang Gambar dari Komputer
                      </button>
                      {isUploaded && (
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Gambar berhasil dipasang!
                        </span>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-amber-200/80 dark:border-amber-800/80 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">💡 Tips untuk Import Word Berikutnya:</p>
                      <ul className="list-disc list-inside space-y-0.5 pl-1">
                        <li>Simpan dokumen sebagai <strong>Word Document (*.docx)</strong>.</li>
                        <li>Gunakan menu <strong>Insert &gt; Picture</strong> di MS Word (bukan copy-paste tautan folder).</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2">
                <RichText content={stimulus.content} className="text-sm text-slate-800 dark:text-slate-200 font-medium" />
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                    💡 Gambar stimulus belum terpasang.
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700"
                  >
                    <Upload className="w-3.5 h-3.5" /> Pasang Gambar
                  </button>
                </div>
              </div>
            )}
          </div>
          {isImgValid && !hasImgError && (
            <ImageZoomModal
              src={cleanImgSrc}
              alt={stimulus.title || 'Stimulus Gambar'}
              isOpen={isZoomOpen}
              onClose={() => setIsZoomOpen(false)}
            />
          )}
        </>
      )}

      {stimulus.type === 'audio' && (
        <div className="my-2">
          <AudioPlayer
            src={stimulus.content}
            title={stimulus.title || 'Audio Stimulus Soal'}
            onReplaceAudio={handleAudioReplace}
            allowEdit={!!onReplaceAudio}
          />
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
    </div>
  );
};

export default StimulusViewer;
