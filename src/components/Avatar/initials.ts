const ARABIC = /\p{Script=Arabic}/u;
let segmenter: Intl.Segmenter | null | undefined;

/** The first character of a word as drawn (a letter with its marks), upper-cased. */
function firstOf(word: string): string {
  if (segmenter === undefined) segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const first = segmenter ? (segmenter.segment(word)[Symbol.iterator]().next().value?.segment ?? '') : (Array.from(word)[0] ?? '');
  return first.toLocaleUpperCase();
}

/**
 * The letters of a name: the first of its first and last words ("Ada Lovelace" gives "AL"). A
 * name in Arabic script gives one letter, since two Arabic letters side by side join as a word.
 */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return '';
  const first = firstOf(words[0]!);
  if (words.length === 1 || ARABIC.test(name)) return first;
  return first + firstOf(words[words.length - 1]!);
}
