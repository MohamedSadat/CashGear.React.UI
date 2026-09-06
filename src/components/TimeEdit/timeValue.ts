import { stripDirectionMarks } from '../../internal/date/dateFormat';
import type { CgTimeValue } from './CgTimeEdit.types';

export interface ClockTimeParts {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

type TimeToken = 'HH' | 'hh' | 'mm' | 'ss' | 'tt' | 'H' | 'h' | 'm' | 's' | 't';
interface TokenPart { readonly kind: 'token'; readonly value: TimeToken }
interface LiteralPart { readonly kind: 'literal'; readonly value: string }
export type TimePatternPart = TokenPart | LiteralPart;

const CANONICAL_TIME = /^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/u;
const FLEXIBLE_TIME = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/u;
const TOKENS: ReadonlyArray<TimeToken> = ['HH', 'hh', 'mm', 'ss', 'tt', 'H', 'h', 'm', 's', 't'];

function valid(parts: ClockTimeParts): boolean {
  return Number.isInteger(parts.hour) && parts.hour >= 0 && parts.hour <= 23
    && Number.isInteger(parts.minute) && parts.minute >= 0 && parts.minute <= 59
    && Number.isInteger(parts.second) && parts.second >= 0 && parts.second <= 59
    && Number.isInteger(parts.millisecond) && parts.millisecond >= 0 && parts.millisecond <= 999;
}

export function clockTimeText(parts: ClockTimeParts): CgTimeValue {
  if (!valid(parts)) throw new RangeError('CgTimeEdit time is outside the supported clock range.');
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}.${String(parts.millisecond).padStart(3, '0')}`;
}

export function parseCanonicalTime(value: string): ClockTimeParts | null {
  const match = CANONICAL_TIME.exec(value);
  if (!match) return null;
  const parts = { hour: Number(match[1]), minute: Number(match[2]), second: Number(match[3]), millisecond: Number(match[4]) };
  return valid(parts) ? parts : null;
}

export function normalizeCgTimeValue(input: string): CgTimeValue {
  const match = FLEXIBLE_TIME.exec(input.trim());
  if (!match) throw new RangeError('CgTimeEdit values must use HH:mm with optional seconds and milliseconds.');
  const parts = {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: Number(match[3] ?? 0),
    millisecond: Number((match[4] ?? '').padEnd(3, '0') || 0),
  };
  if (!valid(parts)) throw new RangeError('CgTimeEdit value is outside 00:00:00.000 through 23:59:59.999.');
  return clockTimeText(parts);
}

export function compareClockTimes(left: ClockTimeParts, right: ClockTimeParts): number {
  return clockMilliseconds(left) - clockMilliseconds(right);
}

export function clockMilliseconds(parts: ClockTimeParts): number {
  return ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 + parts.millisecond;
}

export function parseTimePattern(pattern: string): ReadonlyArray<TimePatternPart> {
  if (!pattern) throw new Error('CgTimeEdit formats cannot be empty.');
  const parts: TimePatternPart[] = [];
  let literal = '';
  let quoted = false;
  const flush = () => { if (literal) { parts.push({ kind: 'literal', value: literal }); literal = ''; } };
  for (let index = 0; index < pattern.length;) {
    const character = pattern[index]!;
    if (character === "'") {
      if (pattern[index + 1] === "'") { literal += "'"; index += 2; continue; }
      quoted = !quoted; index += 1; continue;
    }
    if (quoted) { literal += character; index += 1; continue; }
    const token = TOKENS.find((candidate) => pattern.startsWith(candidate, index));
    if (token) { flush(); parts.push({ kind: 'token', value: token }); index += token.length; continue; }
    if (/\p{Letter}/u.test(character)) throw new Error(`CgTimeEdit format contains an unsupported token near "${pattern.slice(index)}". Quote alphabetic literals.`);
    literal += character; index += 1;
  }
  if (quoted) throw new Error('CgTimeEdit format contains an unterminated quoted literal.');
  flush();
  const tokens = parts.filter((part): part is TokenPart => part.kind === 'token').map((part) => part.value);
  const hours = tokens.filter((token) => token.toLowerCase().startsWith('h'));
  const minutes = tokens.filter((token) => token.toLowerCase().startsWith('m'));
  const seconds = tokens.filter((token) => token.toLowerCase().startsWith('s'));
  const periods = tokens.filter((token) => token.toLowerCase().startsWith('t'));
  if (hours.length !== 1 || minutes.length !== 1 || seconds.length > 1 || periods.length > 1) {
    throw new Error('CgTimeEdit formats require exactly one hour and minute token, with at most one second and period token.');
  }
  const twelveHour = hours[0]?.startsWith('h') ?? false;
  if (twelveHour !== (periods.length === 1)) throw new Error('CgTimeEdit twelve-hour formats require a period token, and twenty-four-hour formats forbid it.');
  return parts;
}

function numberFormatter(locale: string | undefined, digits: number) {
  return new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: digits, maximumFractionDigits: 0 });
}

function digitMap(locale: string | undefined): ReadonlyArray<readonly [string, string]> {
  const formatter = numberFormatter(locale, 1);
  return Array.from({ length: 10 }, (_, digit) => [stripDirectionMarks(formatter.format(digit)), String(digit)] as const)
    .sort((left, right) => right[0].length - left[0].length);
}

function normalizeDigits(value: string, locale: string | undefined): string {
  let result = stripDirectionMarks(value);
  for (const [localized, ascii] of digitMap(locale)) result = result.replaceAll(localized, ascii);
  return result;
}

export function localizedPeriodNames(locale: string | undefined): readonly [string, string] {
  const formatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' });
  const name = (hour: number) => stripDirectionMarks(formatter.formatToParts(hour * 3_600_000).find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM'));
  return [name(1), name(13)];
}

function periodToken(value: string, short: boolean): string {
  return short ? Array.from(value)[0] ?? value : value;
}

export function formatClockTime(value: ClockTimeParts, pattern: string, locale?: string): string {
  const parts = parseTimePattern(pattern);
  const one = numberFormatter(locale, 1);
  const two = numberFormatter(locale, 2);
  const [am, pm] = localizedPeriodNames(locale);
  return parts.map((part) => {
    if (part.kind === 'literal') return part.value;
    const hour12 = value.hour % 12 || 12;
    switch (part.value) {
      case 'H': return one.format(value.hour);
      case 'HH': return two.format(value.hour);
      case 'h': return one.format(hour12);
      case 'hh': return two.format(hour12);
      case 'm': return one.format(value.minute);
      case 'mm': return two.format(value.minute);
      case 's': return one.format(value.second);
      case 'ss': return two.format(value.second);
      case 't': return periodToken(value.hour < 12 ? am : pm, true);
      case 'tt': return value.hour < 12 ? am : pm;
    }
  }).join('');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

export function parseFormattedTime(
  text: string,
  pattern: string,
  locale: string | undefined,
  base: ClockTimeParts = { hour: 0, minute: 0, second: 0, millisecond: 0 },
): ClockTimeParts | null {
  const parts = parseTimePattern(pattern);
  const [am, pm] = localizedPeriodNames(locale);
  const captures: TimeToken[] = [];
  const expression = parts.map((part) => {
    if (part.kind === 'literal') return escapeRegex(stripDirectionMarks(part.value));
    captures.push(part.value);
    if (part.value === 'tt') return `(${[am, pm].map(escapeRegex).sort((left, right) => right.length - left.length).join('|')})`;
    if (part.value === 't') return `(${[periodToken(am, true), periodToken(pm, true)].map(escapeRegex).join('|')})`;
    return part.value.length === 2 ? '(\\d{2})' : '(\\d{1,2})';
  }).join('');
  const match = new RegExp(`^${expression}$`, 'iu').exec(normalizeDigits(text, locale));
  if (!match) return null;
  let hour = 0;
  let minute = 0;
  let second = base.second;
  let period: 'am' | 'pm' | undefined;
  captures.forEach((token, index) => {
    const captured = match[index + 1]!;
    if (token.startsWith('H') || token.startsWith('h')) hour = Number(captured);
    else if (token.startsWith('m')) minute = Number(captured);
    else if (token.startsWith('s')) second = Number(captured);
    else period = captured.localeCompare(token === 't' ? periodToken(pm, true) : pm, locale, { sensitivity: 'base' }) === 0 ? 'pm' : 'am';
  });
  const twelveHour = captures.some((token) => token.startsWith('h'));
  if (twelveHour) {
    if (hour < 1 || hour > 12 || !period) return null;
    hour = hour % 12 + (period === 'pm' ? 12 : 0);
  }
  const result = { hour, minute, second, millisecond: base.millisecond };
  return valid(result) ? result : null;
}

export function defaultTimePattern(locale: string | undefined, showSeconds: boolean): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', ...(showSeconds ? { second: '2-digit' as const } : {}), timeZone: 'UTC',
  });
  const pattern = formatter.formatToParts(13 * 3_600_000 + 5 * 60_000 + 7_000).map((part) => {
    if (part.type === 'hour') return part.value.length > 1 ? (formatter.resolvedOptions().hour12 ? 'hh' : 'HH') : (formatter.resolvedOptions().hour12 ? 'h' : 'H');
    if (part.type === 'minute') return part.value.length > 1 ? 'mm' : 'm';
    if (part.type === 'second') return part.value.length > 1 ? 'ss' : 's';
    if (part.type === 'dayPeriod') return 'tt';
    const literal = stripDirectionMarks(part.value);
    return /[\p{Letter}']/u.test(literal) ? `'${literal.replaceAll("'", "''")}'` : literal;
  }).join('');
  parseTimePattern(pattern);
  return pattern;
}

export function patternUsesSeconds(pattern: string): boolean {
  return parseTimePattern(pattern).some((part) => part.kind === 'token' && part.value.startsWith('s'));
}

export function patternUsesTwelveHour(pattern: string): boolean {
  return parseTimePattern(pattern).some((part) => part.kind === 'token' && part.value.startsWith('h'));
}
