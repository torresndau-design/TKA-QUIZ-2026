import { MatchingPair, QuestionOption } from '../types';
import { cleanHtmlContent } from '../components/common/RichText';

/**
 * Strips dangling HTML artifacts like ""&gt;, &gt;, &lt;, or unclosed empty tag snippets
 */
function cleanArtifacts(text: string): string {
  if (!text) return '';
  let str = text.trim();
  // Remove standalone quotes and escaped bracket remnants (e.g. '""&gt;', '""', '&gt;')
  str = str.replace(/^["'\s]*(?:&gt;|>|&lt;|<)+["'\s]*$/gi, '');
  str = str.replace(/^(?:&quot;|&apos;|"|')+(?:&gt;|>)+/gi, '');
  str = str.replace(/^(?:&lt;|<)\/?(?:p|span|div)[^>]*$/gi, '');
  return str.trim();
}

/**
 * Finds the index of a delimiter that is OUTSIDE of HTML tags / attributes
 */
function findDelimiterOutsideTags(str: string): { index: number; length: number } | null {
  let inTag = false;
  let inQuote = false;
  let quoteChar = '';

  const delimiterPatterns = [
    /^\s*=>\s*/,
    /^\s*==>\s*/,
    /^\s*->\s*/,
    /^\s*-->\s*/,
    /^\s*=\s*/,
    /^\s*\|\s*/,
    /^\s+:\s+/,
    /^\s+--\s+/,
    /^\t+/,
  ];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '<' && !inQuote) {
      inTag = true;
      continue;
    }
    if (char === '>' && inTag && !inQuote) {
      inTag = false;
      continue;
    }
    if (inTag && (char === '"' || char === "'")) {
      if (!inQuote) {
        inQuote = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        inQuote = false;
      }
      continue;
    }

    if (!inTag) {
      const rest = str.slice(i);
      for (const pattern of delimiterPatterns) {
        const m = rest.match(pattern);
        if (m && m.index === 0) {
          return { index: i, length: m[0].length };
        }
      }
    }
  }

  return null;
}

/**
 * Splits a raw text/HTML string into Left and Right items for a matching pair
 */
export function splitMatchingPairText(rawText: string): { left: string; right: string } | null {
  if (!rawText) return null;

  let text = cleanHtmlContent(rawText).trim();
  if (!text) return null;

  // Strip leading option letters/numbers like "A. ", "1. ", "A) ", "1) ", "*A. "
  text = text.replace(/^[\*\#\>]?\s*(?:[A-Za-z0-9]+[\.\:\)]|\([A-Za-z0-9]+\))\s+/, '');

  // Check if string contains HTML entity &equals; or &gt;
  const decodedForCheck = text.replace(/&equals;/gi, '=').replace(/&amp;/gi, '&');

  const match = findDelimiterOutsideTags(decodedForCheck);
  if (match) {
    const leftPart = decodedForCheck.slice(0, match.index).trim();
    const rightPart = decodedForCheck.slice(match.index + match.length).trim();

    const left = cleanArtifacts(cleanHtmlContent(leftPart));
    const right = cleanArtifacts(cleanHtmlContent(rightPart));

    if (left || right) {
      return {
        left: left || 'Pernyataan',
        right: right || 'Pasangan',
      };
    }
  }

  return null;
}

/**
 * Normalizes matching pairs so that leftItem and rightItem are cleanly separated,
 * stripping out duplicated raw strings (e.g. "A. Text = Pair") on either side
 * and repairing corrupted imports from Word documents.
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

  const result: MatchingPair[] = [];

  rawPairs.forEach((pair, idx) => {
    let left = pair.leftItem ? cleanHtmlContent(pair.leftItem).trim() : '';
    let right = pair.rightItem ? cleanHtmlContent(pair.rightItem).trim() : '';

    left = cleanArtifacts(left);
    right = cleanArtifacts(right);

    // 1. Check if left item contains the delimiter (e.g. "Mengakses... = Dampak...")
    const leftSplit = splitMatchingPairText(left);
    if (leftSplit) {
      left = leftSplit.left;
      // If right was a generic default (like "Pasangan 2" or "Jawaban Kanan 2"), empty, identical, or corrupted
      const isRightGenericOrCorrupt =
        !right ||
        right === pair.leftItem ||
        /^Pasangan\s*\d+$/i.test(right) ||
        /^Jawaban\s*(?:Kanan)?\s*\d+$/i.test(right) ||
        /^Item\s*(?:Kanan)?\s*\d+$/i.test(right) ||
        /^["'\s]*(?:&gt;|>)+/i.test(right);

      if (isRightGenericOrCorrupt) {
        right = leftSplit.right;
      }
    }

    // 2. Check if right item contains the delimiter
    const rightSplit = splitMatchingPairText(right);
    if (rightSplit) {
      if (!left || /^Pernyataan\s*\d+$/i.test(left) || /^Item\s*Kiri\s*\d+$/i.test(left)) {
        left = rightSplit.left;
      }
      right = rightSplit.right;
    }

    // 3. Remove artifacts again after splitting
    left = cleanArtifacts(left);
    right = cleanArtifacts(right);

    // If both left and right became empty junk (e.g. phantom row from bad HTML parse), skip it
    if (!left && !right) {
      return;
    }

    result.push({
      id: pair.id || `pair_${idx}_${Date.now()}`,
      leftItem: left || `Pernyataan ${result.length + 1}`,
      rightItem: right || `Pasangan ${result.length + 1}`,
    });
  });

  return result.length > 0
    ? result
    : [
        {
          id: `pair_${Date.now()}`,
          leftItem: 'Pernyataan 1',
          rightItem: 'Pasangan 1',
        },
      ];
}

