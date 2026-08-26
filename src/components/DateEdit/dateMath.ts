export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface CalendarCell {
  date: CivilDate;
  isCurrentMonth: boolean;
}

const CANONICAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

export function isCivilDate(value: CivilDate): boolean {
  return Number.isInteger(value.year)
    && value.year >= 1
    && value.year <= 9999
    && Number.isInteger(value.month)
    && value.month >= 1
    && value.month <= 12
    && Number.isInteger(value.day)
    && value.day >= 1
    && value.day <= daysInMonth(value.year, value.month);
}

export function parseCanonicalDate(value: string): CivilDate | null {
  const match = CANONICAL_DATE.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  return isCivilDate(date) ? date : null;
}

export function toCanonicalDate(value: CivilDate): string {
  if (!isCivilDate(value)) throw new RangeError('Civil date must be between 0001-01-01 and 9999-12-31.');
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
}

export function compareCivilDates(left: CivilDate, right: CivilDate): number {
  return left.year - right.year || left.month - right.month || left.day - right.day;
}

export function sameCivilDate(left: CivilDate | null, right: CivilDate | null): boolean {
  return left === null ? right === null : right !== null && compareCivilDates(left, right) === 0;
}

// Proleptic Gregorian conversion adapted from the public-domain civil calendar
// algorithms by Howard Hinnant. Day zero is 1970-01-01.
export function civilToDayNumber(value: CivilDate): number {
  let year = value.year;
  const month = value.month;
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthPrime = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * monthPrime + 2) / 5) + value.day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function dayNumberToCivil(dayNumber: number): CivilDate {
  const shifted = dayNumber + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365);
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPrime = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPrime + 2) / 5) + 1;
  const month = monthPrime + (monthPrime < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;
  return { year, month, day };
}

const MIN_DAY_NUMBER = civilToDayNumber({ year: 1, month: 1, day: 1 });
const MAX_DAY_NUMBER = civilToDayNumber({ year: 9999, month: 12, day: 31 });

export function addDays(value: CivilDate, amount: number): CivilDate {
  const target = Math.min(MAX_DAY_NUMBER, Math.max(MIN_DAY_NUMBER, civilToDayNumber(value) + amount));
  return dayNumberToCivil(target);
}

export function addMonths(value: CivilDate, amount: number): CivilDate {
  const absoluteMonth = value.year * 12 + value.month - 1 + amount;
  const clamped = Math.min(9999 * 12 + 11, Math.max(12, absoluteMonth));
  const year = Math.floor(clamped / 12);
  const month = clamped % 12 + 1;
  return { year, month, day: Math.min(value.day, daysInMonth(year, month)) };
}

export function addYears(value: CivilDate, amount: number): CivilDate {
  const year = Math.min(9999, Math.max(1, value.year + amount));
  return { year, month: value.month, day: Math.min(value.day, daysInMonth(year, value.month)) };
}

export function startOfMonth(value: CivilDate): CivilDate {
  return { year: value.year, month: value.month, day: 1 };
}

export function dayOfWeek(value: CivilDate): number {
  const result = (civilToDayNumber(value) + 4) % 7;
  return result < 0 ? result + 7 : result;
}

export function daysFromWeekStart(value: CivilDate, firstDayOfWeek: number): number {
  return (dayOfWeek(value) - firstDayOfWeek + 7) % 7;
}

export function createMonthCells(month: CivilDate, firstDayOfWeek: number): ReadonlyArray<CalendarCell> {
  const first = startOfMonth(month);
  const firstCell = addDays(first, -daysFromWeekStart(first, firstDayOfWeek));
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCell, index);
    return { date, isCurrentMonth: date.year === first.year && date.month === first.month };
  });
}

export function clampCivilDate(value: CivilDate, minimum: CivilDate | null, maximum: CivilDate | null): CivilDate {
  if (minimum && compareCivilDates(value, minimum) < 0) return minimum;
  if (maximum && compareCivilDates(value, maximum) > 0) return maximum;
  return value;
}

export function todayCivilDate(): CivilDate {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export function decadeGridStart(year: number): number {
  return Math.min(9988, Math.max(1, Math.floor(year / 10) * 10 - 1));
}
