import { Question, Answer } from '../types';
import { normalizeMatchingPairs } from './questionUtils';

export interface EvaluationResult {
  isCorrect: boolean;
  scoreGiven: number; // 0 to question.weight
  requiresTeacherGrading: boolean;
}

export function evaluateAnswer(question: Question, answerVal: any): EvaluationResult {
  if (answerVal === undefined || answerVal === null || answerVal === '') {
    return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
  }

  const weight = question.weight || 1;

  switch (question.type) {
    case 'pilihan_ganda':
    case 'pilihan_gambar':
    case 'pilihan_audio':
    case 'pilihan_video': {
      if (!question.options || question.options.length === 0) {
        return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
      }

      const rawUserVal = Array.isArray(answerVal) ? answerVal[0] : answerVal;
      const userValStr = String(rawUserVal ?? '').trim().toLowerCase();

      if (!userValStr) {
        return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
      }

      // 1. Find correct option in question.options
      let correctOption = question.options.find(
        (opt) => opt.isCorrect === true || String(opt.isCorrect) === 'true'
      );

      // Fallback: check question.correctOptionId or question.correctAnswerText
      if (!correctOption) {
        if (question.correctOptionId) {
          correctOption = question.options.find((opt) => opt.id === question.correctOptionId);
        } else if (question.correctAnswerText) {
          const cat = question.correctAnswerText.trim().toLowerCase();
          if (['a', 'b', 'c', 'd', 'e'].includes(cat)) {
            const idx = ['a', 'b', 'c', 'd', 'e'].indexOf(cat);
            if (question.options[idx]) correctOption = question.options[idx];
          } else {
            correctOption = question.options.find(
              (opt) => opt.id.toLowerCase() === cat || opt.text.trim().toLowerCase() === cat
            );
          }
        }
      }

      let isCorrect = false;

      if (correctOption) {
        const correctId = String(correctOption.id).trim().toLowerCase();
        const correctText = String(correctOption.text).trim().toLowerCase();
        const correctIdx = question.options.findIndex((o) => o.id === correctOption?.id);
        const letter = correctIdx >= 0 ? ['a', 'b', 'c', 'd', 'e'][correctIdx] : '';

        isCorrect =
          userValStr === correctId ||
          userValStr === correctText ||
          (letter !== '' && userValStr === letter);
      } else if (question.correctAnswerText) {
        isCorrect = userValStr === question.correctAnswerText.trim().toLowerCase();
      }

      return {
        isCorrect,
        scoreGiven: isCorrect ? weight : 0,
        requiresTeacherGrading: false,
      };
    }

    case 'pg_kompleks':
    case 'checklist': {
      // answerVal is array of optionIds string[]
      const userSelected: string[] = Array.isArray(answerVal) ? answerVal : [];
      const correctOptionIds =
        question.options?.filter((opt) => opt.isCorrect).map((opt) => opt.id) || [];

      if (userSelected.length === 0 && correctOptionIds.length === 0) {
        return { isCorrect: true, scoreGiven: weight, requiresTeacherGrading: false };
      }

      const isExactMatch =
        userSelected.length === correctOptionIds.length &&
        userSelected.every((id) => correctOptionIds.includes(id));

      return {
        isCorrect: isExactMatch,
        scoreGiven: isExactMatch ? weight : 0,
        requiresTeacherGrading: false,
      };
    }

    case 'menjodohkan':
    case 'drag_drop': {
      // answerVal is Record<pairId/leftId, rightText>
      const pairs = normalizeMatchingPairs(question.matchingPairs, question.options);
      if (pairs.length === 0) {
        return { isCorrect: true, scoreGiven: weight, requiresTeacherGrading: false };
      }

      let correctCount = 0;
      pairs.forEach((pair) => {
        const userChoice = answerVal[pair.id] || answerVal[pair.leftItem];
        if (
          userChoice &&
          String(userChoice).trim().toLowerCase() === String(pair.rightItem).trim().toLowerCase()
        ) {
          correctCount++;
        }
      });

      const isAllCorrect = correctCount === pairs.length;
      const partialScore = (correctCount / pairs.length) * weight;

      return {
        isCorrect: isAllCorrect,
        scoreGiven: partialScore,
        requiresTeacherGrading: false,
      };
    }

    case 'benar_salah':
    case 'setuju_tidak_setuju': {
      // answerVal is Record<itemId, boolean>
      const items = question.trueFalseItems || [];
      if (items.length === 0) {
        return { isCorrect: true, scoreGiven: weight, requiresTeacherGrading: false };
      }

      let correctCount = 0;
      items.forEach((item) => {
        const userVal = answerVal[item.id];
        if (typeof userVal === 'boolean' && userVal === item.correctAnswer) {
          correctCount++;
        }
      });

      const isAllCorrect = correctCount === items.length;
      const partialScore = (correctCount / items.length) * weight;

      return {
        isCorrect: isAllCorrect,
        scoreGiven: partialScore,
        requiresTeacherGrading: false,
      };
    }

    case 'isian_singkat':
    case 'melengkapi_kalimat': {
      // answerVal is text string
      const userText = String(answerVal).trim().toLowerCase();
      const expectedText = (question.correctAnswerText || '').trim().toLowerCase();

      // Check exact text or keywords list
      let isCorrect = userText === expectedText;

      if (!isCorrect && question.keywords && question.keywords.length > 0) {
        isCorrect = question.keywords.some((kw) =>
          userText.includes(kw.trim().toLowerCase())
        );
      }

      return {
        isCorrect,
        scoreGiven: isCorrect ? weight : 0,
        requiresTeacherGrading: false,
      };
    }

    case 'isian_angka': {
      // answerVal is string or number
      const userNum = parseFloat(String(answerVal).replace(',', '.'));
      const expectedNum = question.numericAnswer ?? 0;
      const tolerance = question.numericTolerance ?? 0;

      if (isNaN(userNum)) {
        return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
      }

      const isCorrect = Math.abs(userNum - expectedNum) <= tolerance;
      return {
        isCorrect,
        scoreGiven: isCorrect ? weight : 0,
        requiresTeacherGrading: false,
      };
    }

    case 'mengurutkan': {
      // answerVal is array of string sequence items
      const userSeq: string[] = Array.isArray(answerVal) ? answerVal : [];
      const correctSeq = question.sequenceItems || [];

      if (userSeq.length !== correctSeq.length) {
        return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
      }

      const isExactMatch = userSeq.every((item, idx) => item === correctSeq[idx]);
      return {
        isCorrect: isExactMatch,
        scoreGiven: isExactMatch ? weight : 0,
        requiresTeacherGrading: false,
      };
    }

    case 'uraian_pendek':
    case 'uraian_panjang': {
      // Requires teacher manual grading in reports screen
      return {
        isCorrect: false,
        scoreGiven: 0,
        requiresTeacherGrading: true,
      };
    }

    default:
      return { isCorrect: false, scoreGiven: 0, requiresTeacherGrading: false };
  }
}
