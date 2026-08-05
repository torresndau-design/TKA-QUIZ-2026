import { ... } from '../../services/db';
import { Question, QuestionType, AkmCategory, CognitiveLevel, DifficultyLevel } from '../../types';
import { Button } from '../common/Button';
import { Plus, Trash2, Check } from 'lucide-react';
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase'; // Sesuaikan path ini jika file firebase.ts Anda berada di folder lain

interface QuestionItemEditorProps {
  question?: Question;
  quizId: string;
  onSave: (q: Question) => void;
  onCancel: () => void;
}

export const QuestionItemEditor: React.FC<QuestionItemEditorProps> = ({
  question,
  quizId,
  onSave,
  onCancel,
}) => {
  const [type, setType] = useState<QuestionType>(question?.type || 'pilihan_ganda');
  const [category, setCategory] = useState<AkmCategory>(question?.category || 'Literasi');
  const [chapter, setChapter] = useState(question?.chapter || '');
  const [subChapter, setSubChapter] = useState(question?.subChapter || '');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(question?.difficulty || 'Sedang');
  const [cognitiveLevel, setCognitiveLevel] = useState<CognitiveLevel>(question?.cognitiveLevel || 'Aplikasi (L2)');
  const [questionText, setQuestionText] = useState(question?.questionText || '');
  const [weight, setWeight] = useState(question?.weight || 20);
  const [discussion, setDiscussion] = useState(question?.discussion || '');

  // Stimulus
  const [stimulusType, setStimulusType] = useState<'text' | 'image' | 'audio' | 'video' | 'table' | 'pdf'>(
    question?.stimulus?.type || 'text'
  );
  const [stimulusTitle, setStimulusTitle] = useState(question?.stimulus?.title || '');
  const [stimulusContent, setStimulusContent] = useState(question?.stimulus?.content || '');

  // Options for Multiple Choice / Checklist
  const [options, setOptions] = useState(
    question?.options || [
      { id: 'opt_1', text: 'Pilihan A', isCorrect: true },
      { id: 'opt_2', text: 'Pilihan B', isCorrect: false },
      { id: 'opt_3', text: 'Pilihan C', isCorrect: false },
      { id: 'opt_4', text: 'Pilihan D', isCorrect: false },
    ]
  );

  // Matching Pairs
  const [matchingPairs, setMatchingPairs] = useState(
    question?.matchingPairs || [
      { id: 'pair_1', leftItem: 'Item Kiri A', rightItem: 'Pasangan Kanan A' },
      { id: 'pair_2', leftItem: 'Item Kiri B', rightItem: 'Pasangan Kanan B' },
    ]
  );

  // True/False Items
  const [trueFalseItems, setTrueFalseItems] = useState(
    question?.trueFalseItems || [
      { id: 'tf_1', statement: 'Pernyataan 1', correctAnswer: true },
      { id: 'tf_2', statement: 'Pernyataan 2', correctAnswer: false },
    ]
  );

  // Short Answer / Keywords / Numeric
  const [correctAnswerText, setCorrectAnswerText] = useState(question?.correctAnswerText || '');
  const [numericAnswer, setNumericAnswer] = useState<number>(question?.numericAnswer || 0);
  const [sequenceItems, setSequenceItems] = useState<string[]>(
    question?.sequenceItems || ['Langkah 1', 'Langkah 2', 'Langkah 3']
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedQuestion: Question = {
      id: question?.id || `q_${Date.now()}`,
      quizId,
      type,
      category,
      chapter,
      subChapter,
      difficulty,
      cognitiveLevel,
      questionText,
      weight: Number(weight),
      discussion,
      stimulus: stimulusContent
        ? {
            type: stimulusType,
            title: stimulusTitle,
            content: stimulusContent,
          }
        : undefined,
      options: ['pilihan_ganda', 'pg_kompleks', 'checklist', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(type)
        ? options
        : undefined,
      matchingPairs: ['menjodohkan', 'drag_drop'].includes(type) ? matchingPairs : undefined,
      trueFalseItems: ['benar_salah', 'setuju_tidak_setuju'].includes(type) ? trueFalseItems : undefined,
      correctAnswerText: ['isian_singkat', 'melengkapi_kalimat'].includes(type) ? correctAnswerText : undefined,
      numericAnswer: type === 'isian_angka' ? Number(numericAnswer) : undefined,
      sequenceItems: type === 'mengurutkan' ? sequenceItems : undefined,
      createdAt: question?.createdAt || new Date().toISOString(),
    };

    try {
      // Simpan langsung ke Cloud Firestore
      if (question?.id) {
        await setDoc(doc(db, 'questions', question.id), updatedQuestion);
      } else {
        await addDoc(collection(db, 'questions'), updatedQuestion);
      }
      console.log('Soal berhasil disimpan ke Firestore!');
    } catch (error) {
      console.error('Gagal menyimpan soal ke Firestore:', error);
    }

    onSave(updatedQuestion);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 border-b pb-3">
        {question ? 'Edit Soal TKA' : 'Tambah Soal Baru'}
      </h3>

      {/* Meta Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipe Soal (16 Tipe)</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-medium"
          >
            <option value="pilihan_ganda">1. Pilihan Ganda</option>
            <option value="pg_kompleks">2. Pilihan Ganda Kompleks</option>
            <option value="menjodohkan">3. Menjodohkan</option>
            <option value="benar_salah">4. Benar Salah</option>
            <option value="setuju_tidak_setuju">5. Setuju Tidak Setuju</option>
            <option value="isian_singkat">6. Isian Singkat</option>
            <option value="isian_angka">7. Isian Angka</option>
            <option value="uraian_pendek">8. Uraian Pendek</option>
            <option value="uraian_panjang">9. Uraian Panjang</option>
            <option value="mengurutkan">10. Mengurutkan</option>
            <option value="drag_drop">11. Drag and Drop</option>
            <option value="checklist">12. Checklist</option>
            <option value="melengkapi_kalimat">13. Melengkapi Kalimat</option>
            <option value="pilihan_gambar">14. Pilihan Gambar</option>
            <option value="pilihan_audio">15. Pilihan Audio</option>
            <option value="pilihan_video">16. Pilihan Video</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Kategori TKA</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AkmCategory)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
          >
            <option value="Literasi">Literasi Membaca</option>
            <option value="Numerasi">Numerasi</option>
            <option value="Sains">Literasi Sains</option>
            <option value="Sosial Budaya">Sosial Budaya</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Level Kognitif</label>
          <select
            value={cognitiveLevel}
            onChange={(e) => setCognitiveLevel(e.target.value as CognitiveLevel)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
          >
            <option value="Pemahaman (L1)">Pemahaman (L1)</option>
            <option value="Aplikasi (L2)">Aplikasi (L2)</option>
            <option value="Penalaran (L3)">Penalaran (L3)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tingkat Kesulitan</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
          >
            <option value="Mudah">Mudah</option>
            <option value="Sedang">Sedang</option>
            <option value="Sukar">Sukar</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bobot Soal</label>
          <input
            type="number"
            value={weight}
            onChange={(e) => setWeight(Number(e.target.value))}
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Bab / Topik</label>
          <input
            type="text"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Contoh: Teks Informasi"
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
          />
        </div>
      </div>

      {/* Stimulus Section */}
      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Stimulus Soal (Opsional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipe Stimulus</label>
            <select
              value={stimulusType}
              onChange={(e) => setStimulusType(e.target.value as any)}
              className="w-full p-2 text-xs bg-white dark:bg-slate-800 border rounded-lg"
            >
              <option value="text">Teks Panjang</option>
              <option value="image">Gambar (URL)</option>
              <option value="audio">Audio (URL)</option>
              <option value="video">Video Embed (URL)</option>
              <option value="table">Tabel HTML</option>
              <option value="pdf">Dokumen PDF</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Judul Stimulus</label>
            <input
              type="text"
              value={stimulusTitle}
              onChange={(e) => setStimulusTitle(e.target.value)}
              placeholder="Contoh: Kutipan Cerpen"
              className="w-full p-2 text-xs bg-white dark:bg-slate-800 border rounded-lg"
            />
          </div>
        </div>
        <textarea
          rows={3}
          value={stimulusContent}
          onChange={(e) => setStimulusContent(e.target.value)}
          placeholder="Isikan teks stimulus, link gambar, atau URL audio/video..."
          className="w-full p-2.5 text-xs bg-white dark:bg-slate-800 border rounded-xl"
        />
      </div>

      {/* Question Text */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teks Pertanyaan / Instraksi</label>
        <textarea
          rows={3}
          required
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          placeholder="Tuliskan pertanyaan secara lengkap dan jelas..."
          className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl"
        />
      </div>

      {/* Dynamic Answer Fields */}
      {['pilihan_ganda', 'pg_kompleks', 'checklist', 'pilihan_gambar', 'pilihan_audio', 'pilihan_video'].includes(type) && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilihan Jawaban</label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() =>
                setOptions([
                  ...options,
                  { id: `opt_${Date.now()}`, text: `Pilihan Baru`, isCorrect: false },
                ])
              }
            >
              Tambah Pilihan
            </Button>
          </div>
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              <input
                type={type === 'pilihan_ganda' ? 'radio' : 'checkbox'}
                checked={opt.isCorrect}
                onChange={() => {
                  if (type === 'pilihan_ganda') {
                    setOptions(options.map((o) => ({ ...o, isCorrect: o.id === opt.id })));
                  } else {
                    setOptions(
                      options.map((o) => (o.id === opt.id ? { ...o, isCorrect: !o.isCorrect } : o))
                    );
                  }
                }}
                className="w-4 h-4 text-[#2563EB]"
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) =>
                  setOptions(options.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o)))
                }
                className="flex-1 p-2 text-xs bg-slate-50 dark:bg-slate-700 border rounded-lg"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((o) => o.id !== opt.id))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {['isian_singkat', 'melengkapi_kalimat'].includes(type) && (
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Jawaban Benar Teks</label>
          <input
            type="text"
            value={correctAnswerText}
            onChange={(e) => setCorrectAnswerText(e.target.value)}
            placeholder="Tuliskan kata/kalimat kunci jawaban benar..."
            className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
          />
        </div>
      )}

      {type === 'isian_angka' && (
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nilai Angka Benar</label>
          <input
            type="number"
            step="any"
            value={numericAnswer}
            onChange={(e) => setNumericAnswer(Number(e.target.value))}
            className="w-full max-w-xs p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
          />
        </div>
      )}

      {/* Pembahasan */}
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pembahasan Soal</label>
        <textarea
          rows={2}
          value={discussion}
          onChange={(e) => setDiscussion(e.target.value)}
          placeholder="Tuliskan alasan / kunci jawaban lengkap..."
          className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-700 border rounded-xl"
        />
      </div>

      <div className="flex justify-end gap-3 pt-3 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" variant="primary">
          Simpan Soal
        </Button>
      </div>
    </form>
  );
};