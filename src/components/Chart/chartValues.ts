import {
  civilToDayNumber,
  parseCanonicalDate,
  toCanonicalDate,
} from '../../internal/date/dateMath';
import {
  normalizeCgDecimalValue,
  normalizeCgInstantValue,
  normalizeCgLocalDateTimeValue,
} from '../RangeSelector';
import type {
  CgChartArgumentValue,
  CgChartAxisValueType,
  CgChartNumericValue,
} from './CgChart.types';

const DECIMAL = /^([+-]?)(\d+)(?:\.(\d+))?$/u;
const DECIMAL_WITH_EXPONENT = /^([+-]?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u;
const LOCAL_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/u;
const INSTANT = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|[+-]\d{2}:\d{2})$/u;
const DAY_MILLISECONDS = 86_400_000n;
const RATIO_SCALE = 1_000_000_000_000n;

export interface ExactValue {
  readonly coefficient: bigint;
  readonly scale: number;
}

export type TemporalKind = 'civilDate' | 'localDateTime' | 'instant';
export type ArgumentKind = 'category' | 'numeric' | 'date';

export interface NormalizedArgument {
  readonly kind: ArgumentKind;
  readonly key: string;
  readonly original: CgChartArgumentValue;
  readonly categoryText?: string;
  readonly exact?: ExactValue;
  readonly epochMilliseconds?: bigint;
  readonly temporalKind?: TemporalKind;
}

function decimalFromPlain(value: string): ExactValue {
  const match = DECIMAL.exec(value);
  if (!match) throw new RangeError(`CgChart numeric value "${value}" is not a normalized decimal.`);
  const fraction = match[3] ?? '';
  const coefficient = BigInt(`${match[2]}${fraction}`) * (match[1] === '-' ? -1n : 1n);
  return normalizeExact({ coefficient, scale: fraction.length });
}

function decimalFromNumber(value: number): ExactValue {
  if (!Number.isFinite(value)) throw new RangeError('CgChart numeric arguments must be finite.');
  const text = value.toString();
  if (!/[eE]/u.test(text)) return decimalFromPlain(text);
  const match = DECIMAL_WITH_EXPONENT.exec(text);
  if (!match) throw new RangeError(`CgChart could not normalize numeric value ${text}.`);
  const fraction = match[3] ?? '';
  const exponent = Number(match[4]);
  const digits = `${match[2]}${fraction}`;
  const raw = BigInt(digits) * (match[1] === '-' ? -1n : 1n);
  const scale = fraction.length - exponent;
  return scale < 0
    ? normalizeExact({ coefficient: raw * 10n ** BigInt(-scale), scale: 0 })
    : normalizeExact({ coefficient: raw, scale });
}

export function normalizeExact(value: ExactValue): ExactValue {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale--;
  }
  return Object.freeze({ coefficient, scale });
}

export function exactFromNumeric(value: CgChartNumericValue): ExactValue {
  if (typeof value === 'number') return decimalFromNumber(value);
  if (typeof value === 'bigint') return Object.freeze({ coefficient: value, scale: 0 });
  const normalized = normalizeCgDecimalValue(value);
  if (normalized !== value) {
    throw new RangeError(`CgChart decimal values must be normalized as "${normalized}".`);
  }
  return decimalFromPlain(normalized);
}

function align(left: ExactValue, right: ExactValue): readonly [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * 10n ** BigInt(scale - left.scale),
    right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  ];
}

export function exactCompare(left: ExactValue, right: ExactValue): number {
  const [a, b] = align(left, right);
  return a < b ? -1 : a > b ? 1 : 0;
}

export function exactAdd(left: ExactValue, right: ExactValue): ExactValue {
  const [a, b, scale] = align(left, right);
  return normalizeExact({ coefficient: a + b, scale });
}

export function exactSubtract(left: ExactValue, right: ExactValue): ExactValue {
  const [a, b, scale] = align(left, right);
  return normalizeExact({ coefficient: a - b, scale });
}

export function exactAbs(value: ExactValue): ExactValue {
  return value.coefficient < 0n
    ? Object.freeze({ coefficient: -value.coefficient, scale: value.scale })
    : value;
}

export function exactNegate(value: ExactValue): ExactValue {
  return Object.freeze({ coefficient: -value.coefficient, scale: value.scale });
}

export function exactMultiplyInteger(value: ExactValue, multiplier: bigint): ExactValue {
  return normalizeExact({ coefficient: value.coefficient * multiplier, scale: value.scale });
}

export function exactIsZero(value: ExactValue): boolean {
  return value.coefficient === 0n;
}

export function exactRatio(value: ExactValue, minimum: ExactValue, maximum: ExactValue): number {
  const [valueWire, minimumWire, firstScale] = align(value, minimum);
  const alignedValue = { coefficient: valueWire, scale: firstScale };
  const alignedMinimum = { coefficient: minimumWire, scale: firstScale };
  const [maxWire, minWire, scale] = align(maximum, alignedMinimum);
  const valueAtScale = alignedValue.coefficient * 10n ** BigInt(scale - alignedValue.scale);
  const denominator = maxWire - minWire;
  if (denominator === 0n) return 0.5;
  const numerator = valueAtScale - minWire;
  return Number((numerator * RATIO_SCALE) / denominator) / Number(RATIO_SCALE);
}

export function exactDivide(numerator: ExactValue, denominator: ExactValue): number {
  const [a, b] = align(numerator, denominator);
  if (b === 0n) return 0;
  return Number((a * RATIO_SCALE) / b) / Number(RATIO_SCALE);
}

export function exactText(value: ExactValue): string {
  if (value.coefficient === 0n) return '0';
  const negative = value.coefficient < 0n;
  let digits = (negative ? -value.coefficient : value.coefficient).toString();
  if (value.scale > 0) {
    digits = digits.padStart(value.scale + 1, '0');
    const split = digits.length - value.scale;
    digits = `${digits.slice(0, split)}.${digits.slice(split)}`;
  }
  return `${negative ? '-' : ''}${digits}`;
}

export function exactFromScaledInteger(value: bigint, scale: number): ExactValue {
  return normalizeExact({ coefficient: value, scale });
}

function parseCivilMilliseconds(
  dateText: string,
  hourText: string,
  minuteText: string,
  secondText: string,
  millisecondText: string,
): bigint {
  const date = parseCanonicalDate(dateText);
  if (!date) throw new RangeError(`CgChart date "${dateText}" is outside the supported calendar.`);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new RangeError('CgChart temporal arguments contain an invalid clock time.');
  }
  return BigInt(civilToDayNumber(date)) * DAY_MILLISECONDS
    + BigInt(hour * 3_600_000 + minute * 60_000 + second * 1_000 + millisecond);
}

function parseTemporal(value: string): Omit<NormalizedArgument, 'original' | 'kind'> {
  const civil = parseCanonicalDate(value);
  if (civil && toCanonicalDate(civil) === value) {
    const epochMilliseconds = BigInt(civilToDayNumber(civil)) * DAY_MILLISECONDS;
    return { key: `d:${epochMilliseconds}`, epochMilliseconds, temporalKind: 'civilDate' };
  }

  try {
    const normalizedLocal = normalizeCgLocalDateTimeValue(value);
    if (normalizedLocal === value) {
      const match = LOCAL_DATE_TIME.exec(value);
      if (!match) throw new RangeError('CgChart local date-time could not be parsed.');
      const epochMilliseconds = parseCivilMilliseconds(
        match[1] ?? '', match[2] ?? '', match[3] ?? '', match[4] ?? '', match[5] ?? '',
      );
      return { key: `l:${epochMilliseconds}`, epochMilliseconds, temporalKind: 'localDateTime' };
    }
  } catch {
    // Try the instant form next.
  }

  const normalizedInstant = normalizeCgInstantValue(value);
  if (normalizedInstant !== value) {
    throw new RangeError(`CgChart instant arguments must be normalized as "${normalizedInstant}".`);
  }
  const match = INSTANT.exec(value);
  if (!match) throw new RangeError('CgChart instant could not be parsed.');
  const local = parseCivilMilliseconds(
    match[1] ?? '', match[2] ?? '', match[3] ?? '', match[4] ?? '', match[5] ?? '',
  );
  const token = match[6] ?? 'Z';
  let offsetMinutes = 0;
  if (token !== 'Z') {
    const sign = token.startsWith('-') ? -1 : 1;
    offsetMinutes = sign * (Number(token.slice(1, 3)) * 60 + Number(token.slice(4, 6)));
  }
  const epochMilliseconds = local - BigInt(offsetMinutes) * 60_000n;
  return { key: `i:${epochMilliseconds}`, epochMilliseconds, temporalKind: 'instant' };
}

export function normalizeArgument(
  value: CgChartArgumentValue,
  valueType: CgChartAxisValueType,
): NormalizedArgument {
  const inferred = valueType === 'auto'
    ? (typeof value === 'number' || typeof value === 'bigint' ? 'numeric' : 'category')
    : valueType;

  if (inferred === 'date') {
    if (typeof value !== 'string') throw new RangeError('CgChart date arguments must use canonical string values.');
    return Object.freeze({ kind: 'date', original: value, ...parseTemporal(value) });
  }

  if (inferred === 'numeric') {
    if (typeof value === 'boolean') throw new RangeError('CgChart numeric arguments cannot be boolean.');
    const exact = exactFromNumeric(value as CgChartNumericValue);
    return Object.freeze({ kind: 'numeric', key: `n:${exactText(exact)}`, original: value, exact });
  }

  if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') {
    throw new RangeError('CgChart category arguments must be strings, booleans, or finite numeric enum values.');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError('CgChart category numeric values must be finite.');
  }
  const categoryText = String(value);
  return Object.freeze({
    kind: 'category',
    key: `${typeof value}:${categoryText}`,
    original: value,
    categoryText,
  });
}

export function compareArguments(left: NormalizedArgument, right: NormalizedArgument): number {
  if (left.kind === 'numeric' && right.kind === 'numeric') return exactCompare(left.exact!, right.exact!);
  if (left.kind === 'date' && right.kind === 'date') {
    const a = left.epochMilliseconds!;
    const b = right.epochMilliseconds!;
    return a < b ? -1 : a > b ? 1 : 0;
  }
  return 0;
}

export function temporalParts(value: NormalizedArgument): Readonly<{
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}> {
  if (typeof value.original !== 'string') throw new RangeError('CgChart temporal argument is invalid.');
  const instant = INSTANT.exec(value.original);
  const local = LOCAL_DATE_TIME.exec(value.original);
  const date = parseCanonicalDate(value.original);
  if (date) return Object.freeze({ ...date, hour: 0, minute: 0, second: 0, millisecond: 0 });
  const match = instant ?? local;
  if (!match) throw new RangeError('CgChart temporal argument is invalid.');
  const civil = parseCanonicalDate(match[1] ?? '');
  if (!civil) throw new RangeError('CgChart temporal argument is invalid.');
  return Object.freeze({
    ...civil,
    hour: Number(match[2]),
    minute: Number(match[3]),
    second: Number(match[4]),
    millisecond: Number(match[5]),
  });
}
