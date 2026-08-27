import type { CgFilterFieldKind, CgFilterValue } from './types';

const CANONICAL_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u;
const CANONICAL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CANONICAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?$/u;
const CANONICAL_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const VALUE_KINDS: ReadonlyArray<CgFilterValue['kind']> = ['null', 'text', 'number', 'boolean', 'date', 'dateTime', 'time', 'guid', 'relativePeriod'];

export const CG_FILTER_NULL_VALUE: CgFilterValue = Object.freeze({ kind: 'null' });

export function hasFilterValue(value: CgFilterValue | undefined): boolean {
  return Boolean(value && value.kind !== 'null' && value.text?.trim());
}

function numberText(value: number | bigint): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return '';
  return String(value);
}

export function filterValueFromUnknown(value: unknown): CgFilterValue {
  if (value === null || value === undefined || value === '') return CG_FILTER_NULL_VALUE;
  if (typeof value === 'object' && 'kind' in value) {
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.kind === 'string' && VALUE_KINDS.includes(candidate.kind as CgFilterValue['kind']) && (candidate.text === undefined || typeof candidate.text === 'string')) {
      return Object.freeze(candidate.text === undefined ? { kind: candidate.kind as CgFilterValue['kind'] } : { kind: candidate.kind as CgFilterValue['kind'], text: candidate.text });
    }
  }
  if (typeof value === 'boolean') return Object.freeze({ kind: 'boolean', text: value ? 'true' : 'false' });
  if (typeof value === 'number' || typeof value === 'bigint') {
    const text = numberText(value);
    return text ? Object.freeze({ kind: 'number', text }) : CG_FILTER_NULL_VALUE;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return CG_FILTER_NULL_VALUE;
    const iso = value.toISOString();
    return iso.endsWith('T00:00:00.000Z')
      ? Object.freeze({ kind: 'date', text: iso.slice(0, 10) })
      : Object.freeze({ kind: 'dateTime', text: iso });
  }
  if (typeof value === 'string') return Object.freeze({ kind: 'text', text: value });
  return CG_FILTER_NULL_VALUE;
}

export function createFilterValue(kind: CgFilterValue['kind'], text?: string): CgFilterValue {
  if (kind === 'null' || text === undefined || !text.trim()) return CG_FILTER_NULL_VALUE;
  return Object.freeze({ kind, text });
}

export function isValidFilterValue(value: CgFilterValue, fieldKind: CgFilterFieldKind): boolean {
  if (!hasFilterValue(value)) return false;
  const text = value.text?.trim() ?? '';
  if (value.kind === 'relativePeriod') return true;
  switch (fieldKind) {
    case 'number': return value.kind === 'number' && CANONICAL_NUMBER.test(text) || value.kind === 'text' && CANONICAL_NUMBER.test(text);
    case 'boolean': return /^(?:true|false)$/iu.test(text);
    case 'date': return CANONICAL_DATE.test(text) && isCivilDate(text);
    case 'dateTime': return CANONICAL_DATE.test(text) && isCivilDate(text) || !Number.isNaN(Date.parse(text));
    case 'time': return CANONICAL_TIME.test(text);
    case 'guid': return CANONICAL_GUID.test(text);
    case 'collection': return false;
    default: return true;
  }
}

export function parseFilterValue(value: CgFilterValue, fieldKind: CgFilterFieldKind): unknown {
  if (!hasFilterValue(value)) return null;
  const text = value.text?.trim() ?? '';
  switch (fieldKind) {
    case 'number': return CANONICAL_NUMBER.test(text) ? text : null;
    case 'boolean': return /^true$/iu.test(text) ? true : /^false$/iu.test(text) ? false : null;
    case 'date': return isCivilDate(text) ? text : null;
    case 'dateTime': return CANONICAL_DATE.test(text) && isCivilDate(text) ? text : Number.isNaN(Date.parse(text)) ? null : new Date(text);
    case 'time': return CANONICAL_TIME.test(text) ? text : null;
    case 'guid': return CANONICAL_GUID.test(text) ? text.toLocaleLowerCase() : null;
    default: return text;
  }
}

export function compareDecimalText(leftInput: string, rightInput: string): number | null {
  if (!CANONICAL_NUMBER.test(leftInput) || !CANONICAL_NUMBER.test(rightInput)) return null;
  const left = expandDecimal(leftInput);
  const right = expandDecimal(rightInput);
  if (!left || !right) return null;
  if (left.negative !== right.negative) return left.negative ? -1 : 1;
  const sign = left.negative ? -1 : 1;
  if (left.integer.length !== right.integer.length) return Math.sign(left.integer.length - right.integer.length) * sign;
  const integer = left.integer.localeCompare(right.integer);
  if (integer) return integer * sign;
  const length = Math.max(left.fraction.length, right.fraction.length);
  const fraction = left.fraction.padEnd(length, '0').localeCompare(right.fraction.padEnd(length, '0'));
  return fraction * sign;
}

function expandDecimal(input: string): { readonly negative: boolean; readonly integer: string; readonly fraction: string } | null {
  const match = /^([+-]?)(\d*\.?\d*)(?:[eE]([+-]?\d+))?$/u.exec(input.trim());
  if (!match) return null;
  const digits = (match[2] ?? '').replace('.', '') || '0';
  const dot = (match[2] ?? '').indexOf('.');
  const originalScale = dot < 0 ? 0 : (match[2]?.length ?? 0) - dot - 1;
  const exponent = Number(match[3] ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 10000) return null;
  const scale = originalScale - exponent;
  let integer: string;
  let fraction: string;
  if (scale <= 0) {
    integer = digits + '0'.repeat(-scale);
    fraction = '';
  } else if (scale >= digits.length) {
    integer = '0';
    fraction = '0'.repeat(scale - digits.length) + digits;
  } else {
    integer = digits.slice(0, digits.length - scale);
    fraction = digits.slice(digits.length - scale);
  }
  integer = integer.replace(/^0+(?=\d)/u, '') || '0';
  fraction = fraction.replace(/0+$/u, '');
  const zero = integer === '0' && !fraction;
  return { negative: !zero && match[1] === '-', integer, fraction };
}

export function isCivilDate(value: string): boolean {
  if (!CANONICAL_DATE.test(value)) return false;
  const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
