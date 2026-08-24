const ARABIC_ZERO = '٠'.charCodeAt(0);
const EASTERN_ZERO = '۰'.charCodeAt(0);

function normalizeDigits(value: string): string {
  return [...value].map((character) => {
    const code = character.charCodeAt(0);
    if (code >= ARABIC_ZERO && code <= ARABIC_ZERO + 9) return String(code - ARABIC_ZERO);
    if (code >= EASTERN_ZERO && code <= EASTERN_ZERO + 9) return String(code - EASTERN_ZERO);
    return character;
  }).join('');
}

export interface NumericFormatOptions {
  locale?: string;
  style?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  precision?: number;
  useGrouping?: boolean;
}

export function createNumberFormatter(options: NumericFormatOptions): Intl.NumberFormat {
  if (options.style === 'currency' && !options.currency?.trim()) {
    throw new TypeError('currency is required when formatStyle is "currency".');
  }
  return new Intl.NumberFormat(options.locale, {
    style: options.style ?? 'decimal',
    currency: options.currency,
    useGrouping: options.useGrouping,
    minimumFractionDigits: options.precision,
    maximumFractionDigits: options.precision,
  });
}

export function parseLocalizedNumber(text: string, formatter: Intl.NumberFormat, style: NumericFormatOptions['style']): number | null | undefined {
  let normalized = normalizeDigits(text.trim()).replace(/[\s\u00a0\u202f\u061c\u200e\u200f]/g, '');
  if (normalized === '') return null;

  const resolved = formatter.resolvedOptions();
  const separatorFormatter = new Intl.NumberFormat(resolved.locale, {
    numberingSystem: resolved.numberingSystem,
    useGrouping: true,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const parts = [
    ...formatter.formatToParts(-12345.6),
    ...formatter.formatToParts(12345.6),
    ...separatorFormatter.formatToParts(-12345.6),
  ];
  const values = (type: Intl.NumberFormatPartTypes) =>
    [...new Set(parts.filter((part) => part.type === type).map((part) =>
      normalizeDigits(part.value).replace(/[\s\u00a0\u202f\u061c\u200e\u200f]/g, ''),
    ).filter(Boolean))].sort((left, right) => right.length - left.length);
  const replaceTokens = (tokens: ReadonlyArray<string>, replacement: string) => {
    for (const token of tokens) normalized = normalized.split(token).join(replacement);
  };

  replaceTokens(values('currency'), '');
  replaceTokens(values('percentSign'), '');
  replaceTokens(values('literal'), '');
  replaceTokens(values('group'), 'G');
  replaceTokens(values('decimal'), 'D');
  replaceTokens(values('minusSign'), '-');
  replaceTokens(values('plusSign'), '+');

  if (!/^[+-]?(?:\d+(?:G\d+)*(?:D\d*)?|D\d+)$/.test(normalized)) return undefined;
  const canonical = normalized.split('G').join('').replace('D', '.');
  const parsed = Number(canonical);
  if (!Number.isFinite(parsed)) return undefined;
  return style === 'percent' ? parsed / 100 : parsed;
}

export function normalizeNumericValue(value: number, min?: number, max?: number, precision?: number): number {
  let next = value;
  if (precision !== undefined) {
    const scale = 10 ** Math.max(0, precision);
    next = Math.round((next + Number.EPSILON) * scale) / scale;
  }
  if (min !== undefined) next = Math.max(min, next);
  if (max !== undefined) next = Math.min(max, next);
  return next;
}
