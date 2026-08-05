import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Copy, ExternalLink, Check } from 'lucide-react';
import { showToast } from './Toast';

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  quizId: string;
  quizTitle: string;
}

export const QRModal: React.FC<QRModalProps> = ({ isOpen, onClose, quizId, quizTitle }) => {
  const [copied, setCopied] = React.useState(false);
  const examUrl = `${window.location.origin}/exam/${quizId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(examUrl);
    setCopied(true);
    showToast('Link Quiz berhasil disalin!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Link & QR Code Quiz" maxWidth="md">
      <div className="flex flex-col items-center space-y-5 text-center">
        <h4 className="font-bold text-slate-800 dark:text-slate-100">{quizTitle}</h4>
        
        <div className="p-4 bg-white rounded-2xl border-2 border-slate-100 shadow-md">
          <QRCodeSVG value={examUrl} size={180} level="H" includeMargin={true} />
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Siswa dapat memindai QR Code di atas menggunakan kamera HP atau membuka tautan berikut.
        </p>

        <div className="w-full bg-slate-100 dark:bg-slate-700/60 p-3 rounded-xl flex items-center justify-between text-xs font-mono text-slate-700 dark:text-slate-200 overflow-x-auto border border-slate-200 dark:border-slate-600">
          <span className="truncate mr-2">{examUrl}</span>
          <Button size="sm" variant={copied ? 'success' : 'primary'} onClick={handleCopy} icon={copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}>
            {copied ? 'Tersalin' : 'Salin'}
          </Button>
        </div>

        <div className="flex w-full gap-3 pt-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(examUrl, '_blank')}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            Buka Link Ujian
          </Button>
        </div>
      </div>
    </Modal>
  );
};
