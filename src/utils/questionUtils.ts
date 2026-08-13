import { MatchingPair, QuestionOption } from '../types';

/**
 * Normalizes matching pairs so that leftItem and rightItem are cleanly separated,
 * stripping out duplicated raw strings (e.g. "A. Text = Pair") on either side.
 */
export function normalizeMatchingPairs(
  pairs?: MatchingPair[],
  options?: QuestionOption[]
): MatchingPair[] {
  let rawPairs: MatchingPair[] = [];

  if (pairs && pairs.length > 0) {
    rawPairs = pairs;
  } else if (options && options.length > 0) {
    rawPairs = options.map((opt, idx) => ({
      id: opt.id || `pair_${idx}`,
      leftItem: opt.text,
      rightItem: `Pasangan ${idx + 1}`,
    }));
  }

  if (rawPairs.length === 0) return [];

  const delimiterRegex = /^(.*?)\s*(?:[\=\>]|\=\>|\-\>|\||\:)\s*(.*)$/;

  return rawPairs.map((pair, idx) => {
    let left = pair.leftItem ? pair.leftItem.trim() : '';
    let right = pair.rightItem ? pair.rightItem.trim() : '';

    // If left contains a delimiter (e.g. "A. Item = Jawaban")
    const leftMatch = left.match(delimiterRegex);
    if (leftMatch && leftMatch[1] && leftMatch[2]) {
      left = leftMatch[1].trim();
      // If right wasn't set, or equals unparsed leftItem, or contains delimiter, use right side of leftMatch
      if (!right || right === pair.leftItem || delimiterRegex.test(right)) {
        right = leftMatch[2].trim();
      }
    }

    // If right contains a delimiter (e.g. "A. Item = Jawaban")
    const rightMatch = right.match(delimiterRegex);
    if (rightMatch && rightMatch[1] && rightMatch[2]) {
      right = rightMatch[2].trim();
    }

    return {
      id: pair.id || `pair_${idx}_${Date.now()}`,
      leftItem: left || `Pernyataan ${idx + 1}`,
      rightItem: right || `Pasangan ${idx + 1}`,
    };
  });
}
