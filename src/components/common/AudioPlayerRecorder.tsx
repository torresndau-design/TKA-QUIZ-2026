import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Music,
  Radio,
  Square,
  RefreshCw,
  Sparkles,
  X,
  FileAudio,
} from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { getCleanMediaSrc, isValidAudioSrc } from './RichText';

// Helper to format seconds to mm:ss
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  src?: string;
  title?: string;
  className?: string;
  onReplaceAudio?: (newAudioData: string) => void;
  allowEdit?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  title,
  className = '',
  onReplaceAudio,
  allowEdit = true,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const cleanSrc = getCleanMediaSrc(src);
  const isSourceValid = isValidAudioSrc(cleanSrc);

  // Sync state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.load();
    }
  }, [cleanSrc]);

  const togglePlay = () => {
    if (!audioRef.current || !cleanSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio playback error:', err);
          setHasError(true);
          setIsPlaying(false);
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setHasError(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleRewind = (seconds: number = 5) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seconds);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      audioRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        audioRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const handleSpeedCycle = () => {
    const speeds = [1, 1.25, 1.5, 0.75];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSaveAudio = (newAudioData: string) => {
    if (onReplaceAudio) {
      onReplaceAudio(newAudioData);
    }
    setIsModalOpen(false);
    setHasError(false);
  };

  // If audio is missing, invalid or failed to load
  if (!isSourceValid || hasError) {
    return (
      <div
        className={`p-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700/80 bg-amber-50/70 dark:bg-amber-950/30 text-slate-800 dark:text-slate-100 ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Music className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {title ? `Audio: ${title}` : 'Pemutar Audio Soal Listening'}
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                {hasError
                  ? 'Berkas audio tidak dapat diputar atau format tidak didukung.'
                  : 'Berkas audio belum diunggah atau belum direkam oleh guru.'}
              </p>
            </div>
          </div>

          {(allowEdit || onReplaceAudio) && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => setIsModalOpen(true)}
                icon={<Mic className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto text-xs font-bold"
              >
                Unggah / Rekam Suara
              </Button>
            </div>
          )}
        </div>

        {isModalOpen && (
          <AudioUploadRecorderModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveAudio}
            initialAudio={cleanSrc}
          />
        )}
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-md border border-slate-700/80 ${className}`}
    >
      <audio
        ref={audioRef}
        src={cleanSrc}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
        preload="metadata"
      />

      <div className="flex flex-col gap-2.5">
        {/* Header row with Title & Edit button */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Music className="w-4 h-4" />
            </span>
            <span className="font-semibold text-slate-200 truncate">
              {title || 'Audio Soal Listening'}
            </span>
          </div>

          {(allowEdit || onReplaceAudio) && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 hover:underline shrink-0 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/30"
              title="Ganti atau rekam ulang audio"
            >
              <Mic className="w-3 h-3" /> Ganti / Rekam
            </button>
          )}
        </div>

        {/* Timeline Slider */}
        <div className="space-y-1">
          <div className="relative flex items-center group">
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 focus:outline-none"
              style={{
                background: `linear-gradient(to right, #3b82f6 ${progressPercent}%, #334155 ${progressPercent}%)`,
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/60">
          <div className="flex items-center gap-2">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-[#2563EB] hover:bg-blue-600 active:scale-95 text-white flex items-center justify-center shadow transition-all cursor-pointer"
              title={isPlaying ? 'Jeda Audio' : 'Putar Audio'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
            </button>

            {/* Rewind 5s */}
            <button
              type="button"
              onClick={() => handleRewind(5)}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors"
              title="Mundur 5 detik"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed selector */}
            <button
              type="button"
              onClick={handleSpeedCycle}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors font-mono"
              title="Ubah Kecepatan Putar"
            >
              {playbackRate}x
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/60"
              title={isMuted ? 'Nyalakan Suara' : 'Bisukan'}
            >
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hidden sm:block"
            />
          </div>
        </div>
      </div>

      {isModalOpen && (
        <AudioUploadRecorderModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveAudio}
          initialAudio={cleanSrc}
        />
      )}
    </div>
  );
};

// ==========================================
// AUDIO UPLOAD & VOICE RECORDER MODAL
// ==========================================
interface AudioUploadRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (audioData: string) => void;
  initialAudio?: string;
}

export const AudioUploadRecorderModal: React.FC<AudioUploadRecorderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAudio = '',
}) => {
  const [activeTab, setActiveTab] = useState<'RECORD' | 'UPLOAD' | 'URL'>('RECORD');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string>(initialAudio);
  const [micError, setMicError] = useState<string | null>(null);

  // Upload file states
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileSize, setUploadedFileSize] = useState<string>('');

  // URL state
  const [urlInput, setUrlInput] = useState<string>(initialAudio.startsWith('http') ? initialAudio : '');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up recording object url
  useEffect(() => {
    return () => {
      if (audioBlobUrl) {
        URL.revokeObjectURL(audioBlobUrl);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // START RECORDING
  const startRecording = async () => {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let options = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        options = { mimeType: 'audio/ogg;codecs=opus' };
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(audioBlob);
        setAudioBlobUrl(blobUrl);

        // Convert blob to base64 Data URL for persistent storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          if (base64Data) {
            setAudioBase64(base64Data);
          }
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250); // collect 250ms chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordSeconds(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      setMicError(
        'Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan di browser Anda.'
      );
    }
  };

  // PAUSE / RESUME RECORDING
  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // STOP RECORDING
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  // RESET RECORDING
  const resetRecording = () => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
    }
    setAudioBlobUrl(null);
    setAudioBase64('');
    setRecordSeconds(0);
    audioChunksRef.current = [];
  };

  // HANDLE FILE UPLOAD
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setUploadedFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const base64 = loadEvt.target?.result as string;
      if (base64) {
        setAudioBase64(base64);
        setAudioBlobUrl(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (activeTab === 'URL' && urlInput.trim()) {
      onSave(urlInput.trim());
    } else if (audioBase64) {
      onSave(audioBase64);
    }
    onClose();
  };

  const isSaveReady =
    (activeTab === 'RECORD' && !!audioBase64 && !isRecording) ||
    (activeTab === 'UPLOAD' && !!audioBase64) ||
    (activeTab === 'URL' && !!urlInput.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lampirkan Suara / Audio Soal" maxWidth="lg">
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-700/60 p-1 border border-slate-200 dark:border-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('RECORD')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'RECORD'
                ? 'bg-white dark:bg-slate-800 text-[#2563EB] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Mic className="w-3.5 h-3.5" /> Rekam Suara Langsung
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('UPLOAD')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'UPLOAD'
                ? 'bg-white dark:bg-slate-800 text-[#2563EB] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Unggah Berkas File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('URL')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'URL'
                ? 'bg-white dark:bg-slate-800 text-[#2563EB] shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" /> Tautan URL
          </button>
        </div>

        {/* TAB 1: RECORD VOICE */}
        {activeTab === 'RECORD' && (
          <div className="space-y-4 text-center py-2">
            {micError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300 flex items-center gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{micError}</span>
              </div>
            )}

            {!isRecording && !audioBlobUrl && (
              <div className="py-6 flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#2563EB] flex items-center justify-center shadow-inner border border-blue-200 dark:border-blue-800">
                  <Mic className="w-9 h-9" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Rekam Suara dari Mikrofon
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Klik tombol di bawah untuk mulai merekam suara penjelasan atau listening soal.
                  </p>
                </div>
                <Button
                  type="button"
                  size="md"
                  variant="primary"
                  onClick={startRecording}
                  icon={<Mic className="w-4 h-4" />}
                  className="font-bold px-6"
                >
                  Mulai Merekam Suara
                </Button>
              </div>
            )}

            {isRecording && (
              <div className="py-6 flex flex-col items-center space-y-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg animate-pulse">
                    <Radio className="w-10 h-10" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600"></span>
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-2xl font-mono font-bold text-red-600 dark:text-red-400">
                    {formatTime(recordSeconds)}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {isPaused ? '⏸️ Rekaman Dijeda' : '🔴 Sedang Merekam Suara...'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={togglePauseRecording}
                    icon={isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  >
                    {isPaused ? 'Lanjutkan' : 'Jeda'}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={stopRecording}
                    icon={<Square className="w-3.5 h-3.5 fill-white" />}
                    className="font-bold"
                  >
                    Selesai Merekam
                  </Button>
                </div>
              </div>
            )}

            {!isRecording && audioBlobUrl && (
              <div className="py-4 space-y-4 text-left bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Hasil Rekaman Siap Digunakan ({formatTime(recordSeconds)})
                  </span>
                  <button
                    type="button"
                    onClick={resetRecording}
                    className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Rekam Ulang
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    Pratinjau Hasil Rekaman:
                  </label>
                  <audio controls src={audioBlobUrl} className="w-full rounded-lg" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD FILE */}
        {activeTab === 'UPLOAD' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm,.flac"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 border-2 border-dashed border-blue-300 dark:border-slate-600 hover:border-blue-500 rounded-2xl bg-blue-50/40 dark:bg-slate-800/40 text-center cursor-pointer transition-all hover:bg-blue-50/70 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-[#2563EB] flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <FileAudio className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Pilih atau Tarik Berkas Audio ke Sini
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Mendukung format MP3, WAV, M4A, OGG, AAC, WEBM (Maks 10 MB)
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 pointer-events-none text-xs font-bold"
                icon={<Upload className="w-3.5 h-3.5" />}
              >
                Jelajahi File Komputer
              </Button>
            </div>

            {uploadedFileName && audioBlobUrl && (
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {uploadedFileName}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">({uploadedFileSize})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Ganti File
                  </button>
                </div>
                <audio controls src={audioBlobUrl} className="w-full rounded-lg" />
              </div>
            )}
          </div>
        )}

        {/* TAB 3: URL LINK */}
        {activeTab === 'URL' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tautan / URL Berkas Audio Langsung (.mp3 / .ogg / .wav)
              </label>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://contoh-domain.com/audio/listening_01.mp3"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Pastikan tautan dapat diakses publik langsung tanpa otentikasi login.
              </p>
            </div>

            {urlInput.trim() && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tes Putar Tautan Audio:
                </span>
                <audio controls src={urlInput.trim()} className="w-full" />
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Button type="button" variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!isSaveReady}
            onClick={handleSave}
            icon={<CheckCircle2 className="w-4 h-4" />}
            className="font-bold"
          >
            Pasang &amp; Simpan Audio
          </Button>
        </div>
      </div>
    </Modal>
  );
};
