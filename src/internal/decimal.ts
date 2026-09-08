import { normalizeDecimalString as normalizeCgDecimalValue } from './decimalValue';
import type { CgDecimalValue } from '../components/RangeSelector';

export type DecimalRounding = 'awayFromZero' | 'toEven' | 'toZero' | 'floor' | 'ceiling';
export interface Decimal { coefficient: bigint; scale: number }
const MAX = (1n << 96n) - 1n;
const abs = (value: bigint) => value < 0n ? -value : value;
const pow = (scale: number) => 10n ** BigInt(scale);
export function decimalText({ coefficient, scale }: Decimal): CgDecimalValue {
  const digits = abs(coefficient).toString().padStart(scale + 1, '0');
  return normalizeCgDecimalValue(`${coefficient < 0n ? '-' : ''}${scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits}`);
}
export function decimalParts(text: string): Decimal {
  if (text.length > 128) throw new RangeError('Decimal is too long.');
  const normalized = normalizeCgDecimalValue(text);
  const [integer, fraction = ''] = normalized.split('.');
  const coefficient = BigInt(`${integer}${fraction}`);
  if (fraction.length > 28 || abs(coefficient) > MAX) throw new RangeError('Decimal overflow.');
  return { coefficient, scale: fraction.length };
}
function quotient(numerator: bigint, denominator: bigint, mode: DecimalRounding): bigint {
  if (denominator === 0n) throw new RangeError('Division by zero.');
  if (denominator < 0n) { numerator = -numerator; denominator = -denominator; }
  const whole = numerator / denominator; const remainder = numerator % denominator;
  if (remainder === 0n) return whole;
  const sign = numerator < 0n ? -1n : 1n;
  if (mode === 'toZero') return whole;
  if (mode === 'floor') return whole + (sign < 0n ? -1n : 0n);
  if (mode === 'ceiling') return whole + (sign > 0n ? 1n : 0n);
  const twice = abs(remainder) * 2n;
  return whole + (twice > denominator || twice === denominator && (mode === 'awayFromZero' || abs(whole) % 2n === 1n) ? sign : 0n);
}
function fit(numerator: bigint, denominator: bigint, scale: number, mode: DecimalRounding): Decimal {
  for (let target = Math.min(28, scale); target >= 0; target--) {
    const coefficient = quotient(numerator * pow(target), denominator, mode);
    if (abs(coefficient) <= MAX) return decimalParts(decimalText({ coefficient, scale: target }));
  }
  throw new RangeError('Decimal overflow.');
}
export function roundDecimal(value: Decimal, scale: number, mode: DecimalRounding = 'awayFromZero'): Decimal {
  if (!Number.isInteger(scale) || scale < 0 || scale > 28) throw new RangeError('Decimal precision must be 0–28.');
  if (scale >= value.scale) return value;
  return { coefficient: quotient(value.coefficient, pow(value.scale - scale), mode), scale };
}
export function compareDecimal(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale);
  const difference = a.coefficient * pow(scale - a.scale) - b.coefficient * pow(scale - b.scale);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}
export function calculateDecimal(a: Decimal, b: Decimal, operator: string, mode: DecimalRounding = 'awayFromZero'): Decimal {
  const scale = Math.max(a.scale, b.scale);
  if (operator === '+' || operator === '-') return fit(a.coefficient * pow(scale - a.scale) + (operator === '+' ? 1n : -1n) * b.coefficient * pow(scale - b.scale), pow(scale), scale, mode);
  if (operator === '*') return fit(a.coefficient * b.coefficient, pow(a.scale + b.scale), a.scale + b.scale, mode);
  return fit(a.coefficient * pow(b.scale), b.coefficient * pow(a.scale), 28, mode);
}
export function normalizeDecimalInput(text: string, locale?: string, currency?: string): string {
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, ...(currency ? { style: 'currency', currency } : {}) });
  const parts = formatter.formatToParts(-12345.6);
  let value = text.replace(/[٠-٩۰-۹]/gu, (digit) => String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632))).replace(/[\s\u061c\u200e\u200f]/gu, '');
  for (const part of parts) {
    if (part.type === 'group' || part.type === 'currency') value = value.split(part.value).join('');
    if (part.type === 'decimal') value = value.split(part.value).join('.');
    if (part.type === 'minusSign') value = value.split(part.value).join('-');
  }
  return value.replace(/[٪%]/gu, '');
}
export function parseDecimalExpression(text: string, expressions: boolean, mode: DecimalRounding): Decimal | null {
  if (!text) return null;
  if (text.length > 256) throw new RangeError('Expression is too long.');
  if (!expressions) return decimalParts(text.startsWith('.') ? `0${text}` : text.replace(/^([+-])\./u, '$10.'));
  let index = 0;
  const factor = (depth: number): Decimal => {
    if (depth > 32) throw new RangeError('Expression is too deep.');
    const token = text[index];
    if (token === undefined) throw new Error('Incomplete expression.');
    if (token === '+' || token === '-') { index++; const value = factor(depth + 1); return { ...value, coefficient: token === '-' ? -value.coefficient : value.coefficient }; }
    if (token === '(') { index++; const value = expression(depth + 1); if (text[index++] !== ')') throw new Error('Incomplete expression.'); return value; }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/u.exec(text.slice(index));
    if (!match) throw new Error('Invalid number or incomplete expression.');
    index += match[0].length;
    return decimalParts(match[0].startsWith('.') ? `0${match[0]}` : match[0].replace(/\.$/u, ''));
  };
  const term = (depth: number): Decimal => {
    let value = factor(depth);
    while (text[index] === '*' || text[index] === '/') { const operator = text[index++]!; value = calculateDecimal(value, factor(depth), operator, mode); }
    return value;
  };
  const expression = (depth: number): Decimal => {
    let value = term(depth);
    while (text[index] === '+' || text[index] === '-') { const operator = text[index++]!; value = calculateDecimal(value, term(depth), operator, mode); }
    return value;
  };
  const value = expression(0);
  if (index !== text.length) throw new Error('Invalid expression.');
  return value;
}

export function formatDecimal(value: Decimal, options: { locale?: string; currency?: string; style?: 'decimal' | 'currency' | 'percent'; precision?: number; grouping?: boolean; rounding?: DecimalRounding }): string {
  let display = options.style === 'percent' ? { coefficient: value.coefficient * 100n, scale: value.scale } : value;
  if (options.precision !== undefined) display = roundDecimal(display, options.precision, options.rounding);
  const scale = Math.max(display.scale, options.precision ?? 0);
  const digits = abs(display.coefficient * pow(scale - display.scale)).toString().padStart(scale + 1, '0');
  const integer = scale ? digits.slice(0, -scale) : digits;
  const fraction = scale ? digits.slice(-scale) : '';
  const number = new Intl.NumberFormat(options.locale, { useGrouping: options.grouping ?? true, maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(options.locale).formatToParts(1.1).find((part) => part.type === 'decimal')?.value ?? '.';
  const localDigits = Array.from({ length: 10 }, (_, digit) => new Intl.NumberFormat(options.locale, { useGrouping: false }).format(digit));
  const body = number.format(BigInt(integer)) + (fraction ? decimal + [...fraction].map((digit) => localDigits[Number(digit)]).join('') : '');
  const template = new Intl.NumberFormat(options.locale, { style: options.style ?? 'decimal', currency: options.currency }).formatToParts(display.coefficient < 0n ? -1 : 1);
  const first = template.findIndex((part) => part.type === 'integer');
  let last = first;
  template.forEach((part, index) => { if (['integer', 'group', 'decimal', 'fraction'].includes(part.type)) last = index; });
  return template.slice(0, first).map((part) => part.value).join('') + body + template.slice(last + 1).map((part) => part.value).join('');
}
