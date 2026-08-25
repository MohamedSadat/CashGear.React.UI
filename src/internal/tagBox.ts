export function tagBoxKeyToken(key: string | number): string {
  if (typeof key === 'number' && !Number.isFinite(key)) {
    throw new RangeError('CgTagBox option keys must be finite strings or numbers.');
  }
  return `${typeof key}:${String(key)}`;
}

export function normalizeTagBoxSearch(
  value: string,
  locale?: string,
  ignoreDiacritics = true,
): string {
  let result = value.trim().replace(/\s+/gu, ' ');
  if (ignoreDiacritics) {
    result = result.normalize('NFD').replace(/\p{M}/gu, '').replace(/\u0640/gu, '');
  }
  return locale ? result.toLocaleLowerCase(locale) : result.toLocaleLowerCase();
}

export function tagBoxTextMatches(
  text: string,
  query: string,
  mode: 'contains' | 'startsWith',
  locale?: string,
  ignoreDiacritics = true,
): boolean {
  const candidate = normalizeTagBoxSearch(text, locale, ignoreDiacritics);
  return mode === 'startsWith' ? candidate.startsWith(query) : candidate.includes(query);
}
