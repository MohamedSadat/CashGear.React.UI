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
  return new Intl.NumberFormat(options.locale, {
    style: options.style ?? 'decimal',
    currency: options.currency,
    useGrouping: options.useGrouping,
    minimumFractionDigits: options.precision,
    maximumFractionDigits: options.precision,
  });
}

export function parseLocalizedNumber(text: string, formatter: Intl.NumberFormat, style: NumericFormatOptions['style']): number | null | undefined {
  const trimmed = normalizeDigits(text.trim());
  if (trimmed === '') return null;
  const parts = formatter.formatToParts(-12345.6);
  const group = parts.find((part) => part.type === 'group')?.value;
  const decimal = parts.find((part) => part.type === 'decimal')?.value;
  const minus = parts.find((part) => part.type === 'minusSign')?.value;
  let normalized = trimmed.replace(/[\s\u00a0\u202f]/g, '');
  if (group) normalized = normalized.split(group).join('');
  if (decimal && decimal !== '.') normalized = normalized.split(decimal).join('.');
  if (minus && minus !== '-') normalized = normalized.split(minus).join('-');
  normalized = normalized.replace(/[^0-9+\-.]/g, '');
  if (/^[+-]?$/.test(normalized) || /^[+-]?\.$/.test(normalized) || /^[+-]?\d+\.$/.test(normalized)) return undefined;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
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
