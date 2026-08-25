import type { CgListBoxSearchCondition, CgListBoxTextFragment } from '../components/ListBox/CgListBox.types';

export function listBoxKeyToken(key: string | number): string {
  if (typeof key === 'number' && !Number.isFinite(key)) {
    throw new RangeError('CgListBox item keys must be finite strings or numbers.');
  }
  return `${typeof key}:${String(key)}`;
}

interface FoldedText {
  value: string;
  starts: number[];
  ends: number[];
}

function foldText(value: string, locale: string | undefined, ignoreDiacritics: boolean): FoldedText {
  let folded = '';
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of value) {
    const start = offset;
    offset += character.length;
    let normalized = ignoreDiacritics
      ? character.normalize('NFD').replace(/\p{M}/gu, '').replace(/\u0640/gu, '')
      : character;
    normalized = locale ? normalized.toLocaleLowerCase(locale) : normalized.toLocaleLowerCase();
    folded += normalized;
    for (let index = 0; index < normalized.length; index += 1) {
      starts.push(start);
      ends.push(offset);
    }
  }
  return { value: folded, starts, ends };
}

export function normalizeListBoxSearch(value: string, locale?: string, ignoreDiacritics = true): string {
  const collapsed = value.trim().replace(/\s+/gu, ' ');
  return foldText(collapsed, locale, ignoreDiacritics).value;
}

export function listBoxTextMatches(
  text: string,
  term: string,
  condition: CgListBoxSearchCondition,
  locale?: string,
  ignoreDiacritics = true,
): boolean {
  const candidate = foldText(text, locale, ignoreDiacritics).value;
  if (condition === 'startsWith') return candidate.startsWith(term);
  if (condition === 'equals') return candidate === term;
  return candidate.includes(term);
}

export function createListBoxTextFragments(
  text: string,
  terms: ReadonlyArray<string>,
  condition: CgListBoxSearchCondition,
  locale?: string,
  ignoreDiacritics = true,
): ReadonlyArray<CgListBoxTextFragment> {
  if (!text || terms.length === 0) return [{ text, isMatch: false }];
  const folded = foldText(text, locale, ignoreDiacritics);
  const matched = Array.from({ length: text.length }, () => false);
  for (const term of terms.filter(Boolean)) {
    const positions: number[] = [];
    if (condition === 'equals') {
      if (folded.value === term) positions.push(0);
    } else if (condition === 'startsWith') {
      if (folded.value.startsWith(term)) positions.push(0);
    } else {
      let offset = 0;
      while (offset <= folded.value.length - term.length) {
        const index = folded.value.indexOf(term, offset);
        if (index < 0) break;
        positions.push(index);
        offset = index + Math.max(1, term.length);
      }
    }
    for (const position of positions) {
      const start = folded.starts[position];
      const end = folded.ends[position + term.length - 1];
      if (start === undefined || end === undefined) continue;
      for (let index = start; index < end; index += 1) matched[index] = true;
    }
  }
  if (!matched.some(Boolean)) return [{ text, isMatch: false }];
  const fragments: CgListBoxTextFragment[] = [];
  let start = 0;
  for (let index = 1; index <= text.length; index += 1) {
    if (index === text.length || matched[index] !== matched[start]) {
      fragments.push({ text: text.slice(start, index), isMatch: Boolean(matched[start]) });
      start = index;
    }
  }
  return fragments;
}

export function toCssLength(value: string | number | undefined, fallback: string): string {
  if (typeof value === 'number') return `${value}px`;
  return value?.trim() || fallback;
}
