import type { CgDayOfWeek } from './CgDateEdit.types';
import type { CivilDate } from './dateMath';
import { isCivilDate } from './dateMath';

type DateToken = 'yyyy' | 'M' | 'MM' | 'MMM' | 'MMMM' | 'd' | 'dd';

interface TokenPart { kind: 'token'; value: DateToken }
interface LiteralPart { kind: 'literal'; value: string }
type PatternPart = TokenPart | LiteralPart;

const TOKENS: ReadonlyArray<DateToken> = ['MMMM', 'yyyy', 'MMM', 'MM', 'dd', 'M', 'd'];
const DIRECTION_MARKS = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const DAY_NAMES: ReadonlyArray<CgDayOfWeek> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function stripDirectionMarks(value: string): string {
  return value.replace(DIRECTION_MARKS, '');
}

export function parseDatePattern(pattern: string): ReadonlyArray<PatternPart> {
  if (!pattern) throw new Error('CgDateEdit date formats cannot be empty.');
  const parts: PatternPart[] = [];
  let literal = '';
  let quoted = false;
  const flush = () => {
    if (!literal) return;
    parts.push({ kind: 'literal', value: literal });
    literal = '';
  };
  for (let index = 0; index < pattern.length;) {
    const character = pattern[index]!;
    if (character === "'") {
      if (pattern[index + 1] === "'") {
        literal += "'";
        index += 2;
        continue;
      }
      quoted = !quoted;
      index += 1;
      continue;
    }
    if (quoted) {
      literal += character;
      index += 1;
      continue;
    }
    const token = TOKENS.find((candidate) => pattern.startsWith(candidate, index));
    if (token) {
      flush();
      parts.push({ kind: 'token', value: token });
      index += token.length;
      continue;
    }
    if (/\p{Letter}/u.test(character)) {
      throw new Error(`CgDateEdit date format contains unsupported token near "${pattern.slice(index)}". Quote alphabetic literals.`);
    }
    literal += character;
    index += 1;
  }
  if (quoted) throw new Error('CgDateEdit date format contains an unterminated quoted literal.');
  flush();

  const fields = parts.filter((part): part is TokenPart => part.kind === 'token');
  const years = fields.filter((part) => part.value === 'yyyy').length;
  const months = fields.filter((part) => part.value.startsWith('M')).length;
  const days = fields.filter((part) => part.value.startsWith('d')).length;
  if (years !== 1 || months !== 1 || days !== 1) {
    throw new Error('CgDateEdit date formats must contain exactly one year, month, and day token.');
  }
  return parts;
}

function intlDate(value: CivilDate): Date {
  const date = new Date(0);
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCFullYear(value.year, value.month - 1, value.day);
  return date;
}

function numberFormatter(locale: string | undefined, minimumIntegerDigits: number) {
  return new Intl.NumberFormat(locale, {
    numberingSystem: undefined,
    useGrouping: false,
    minimumIntegerDigits,
    maximumFractionDigits: 0,
  });
}

function localeMonthNames(locale: string | undefined, width: 'short' | 'long'): ReadonlyArray<string> {
  const formatter = new Intl.DateTimeFormat(locale, { calendar: 'gregory', month: width, timeZone: 'UTC' });
  return Array.from({ length: 12 }, (_, index) => stripDirectionMarks(formatter.format(intlDate({ year: 2024, month: index + 1, day: 1 }))));
}

export function formatCivilDate(value: CivilDate, pattern: string, locale?: string): string {
  const parts = parseDatePattern(pattern);
  const plain = numberFormatter(locale, 1);
  const two = numberFormatter(locale, 2);
  const four = numberFormatter(locale, 4);
  const shortMonths = localeMonthNames(locale, 'short');
  const longMonths = localeMonthNames(locale, 'long');
  return parts.map((part) => {
    if (part.kind === 'literal') return part.value;
    switch (part.value) {
      case 'yyyy': return four.format(value.year);
      case 'M': return plain.format(value.month);
      case 'MM': return two.format(value.month);
      case 'MMM': return shortMonths[value.month - 1]!;
      case 'MMMM': return longMonths[value.month - 1]!;
      case 'd': return plain.format(value.day);
      case 'dd': return two.format(value.day);
    }
  }).join('');
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function localizedDigitMap(locale: string | undefined): ReadonlyArray<readonly [string, string]> {
  const formatter = numberFormatter(locale, 1);
  return Array.from({ length: 10 }, (_, digit) => [stripDirectionMarks(formatter.format(digit)), String(digit)] as const)
    .sort((left, right) => right[0].length - left[0].length);
}

function normalizeDigits(value: string, locale: string | undefined): string {
  let normalized = stripDirectionMarks(value);
  for (const [localized, ascii] of localizedDigitMap(locale)) normalized = normalized.replaceAll(localized, ascii);
  return normalized;
}

export function parseFormattedDate(text: string, pattern: string, locale?: string): CivilDate | null {
  const parts = parseDatePattern(pattern);
  const shortMonths = localeMonthNames(locale, 'short');
  const longMonths = localeMonthNames(locale, 'long');
  const captures: DateToken[] = [];
  const expression = parts.map((part) => {
    if (part.kind === 'literal') return regexEscape(stripDirectionMarks(part.value));
    captures.push(part.value);
    switch (part.value) {
      case 'yyyy': return '(\\d{4})';
      case 'M': return '(\\d{1,2})';
      case 'MM': return '(\\d{2})';
      case 'd': return '(\\d{1,2})';
      case 'dd': return '(\\d{2})';
      case 'MMM': return `(${shortMonths.map(regexEscape).sort((left, right) => right.length - left.length).join('|')})`;
      case 'MMMM': return `(${longMonths.map(regexEscape).sort((left, right) => right.length - left.length).join('|')})`;
    }
  }).join('');
  const match = new RegExp(`^${expression}$`, 'iu').exec(normalizeDigits(text, locale));
  if (!match) return null;
  let year = 0;
  let month = 0;
  let day = 0;
  captures.forEach((token, index) => {
    const captured = match[index + 1]!;
    if (token === 'yyyy') year = Number(captured);
    else if (token.startsWith('d')) day = Number(captured);
    else if (token === 'MMM') month = shortMonths.findIndex((name) => name.localeCompare(captured, locale, { sensitivity: 'base' }) === 0) + 1;
    else if (token === 'MMMM') month = longMonths.findIndex((name) => name.localeCompare(captured, locale, { sensitivity: 'base' }) === 0) + 1;
    else month = Number(captured);
  });
  const value = { year, month, day };
  return isCivilDate(value) ? value : null;
}

export function defaultDatePattern(locale?: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    calendar: 'gregory',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const pattern = formatter.formatToParts(intlDate({ year: 2026, month: 8, day: 21 })).map((part) => {
    if (part.type === 'year') return 'yyyy';
    if (part.type === 'month') return 'M';
    if (part.type === 'day') return 'd';
    const literal = stripDirectionMarks(part.value);
    return /[\p{Letter}']/u.test(literal) ? `'${literal.replaceAll("'", "''")}'` : literal;
  }).join('');
  parseDatePattern(pattern);
  return pattern;
}

export function formatMonthHeading(value: CivilDate, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { calendar: 'gregory', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(intlDate(value));
}

export function formatLongDate(value: CivilDate, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { calendar: 'gregory', dateStyle: 'full', timeZone: 'UTC' }).format(intlDate(value));
}

export function getMonthNames(locale?: string): ReadonlyArray<string> {
  return localeMonthNames(locale, 'long');
}

export function getWeekdayNames(locale: string | undefined, firstDay: number): ReadonlyArray<{ short: string; long: string }> {
  const short = new Intl.DateTimeFormat(locale, { calendar: 'gregory', weekday: 'short', timeZone: 'UTC' });
  const long = new Intl.DateTimeFormat(locale, { calendar: 'gregory', weekday: 'long', timeZone: 'UTC' });
  const sunday = { year: 2026, month: 8, day: 23 };
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(intlDate(sunday).getTime() + ((firstDay + index) % 7) * 86400000);
    return { short: short.format(date), long: long.format(date) };
  });
}

const SATURDAY_FIRST = new Set(['AE', 'AF', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'IR', 'JO', 'KW', 'LY', 'OM', 'QA', 'SD', 'SY']);
const SUNDAY_FIRST = new Set(['AG', 'AS', 'BD', 'BR', 'BS', 'BT', 'BW', 'BZ', 'CA', 'CN', 'CO', 'DM', 'DO', 'ET', 'GT', 'GU', 'HK', 'HN', 'ID', 'IL', 'IN', 'JM', 'JP', 'KE', 'KH', 'KR', 'LA', 'MH', 'MM', 'MO', 'MT', 'MX', 'MZ', 'NI', 'NP', 'PA', 'PE', 'PH', 'PK', 'PR', 'PT', 'PY', 'SA', 'SG', 'SV', 'TH', 'TT', 'TW', 'UM', 'US', 'VE', 'VI', 'WS', 'YE', 'ZA', 'ZW']);

export function localeFirstDayOfWeek(locale?: string): number {
  const resolved = new Intl.DateTimeFormat(locale).resolvedOptions().locale;
  const localeObject = new Intl.Locale(resolved).maximize();
  const getWeekInfo = (localeObject as Intl.Locale & { getWeekInfo?: () => { firstDay: number } }).getWeekInfo;
  if (getWeekInfo) return getWeekInfo.call(localeObject).firstDay % 7;
  const region = localeObject.region ?? '';
  if (SATURDAY_FIRST.has(region)) return 6;
  if (SUNDAY_FIRST.has(region)) return 0;
  return 1;
}

export function dayOfWeekIndex(value: CgDayOfWeek): number {
  return DAY_NAMES.indexOf(value);
}
