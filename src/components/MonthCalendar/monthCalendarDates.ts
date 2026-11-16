// Calendar arithmetic for CgMonthCalendar, pure: day numbers (days since 1970-01-01), months, the
// three forms an item's date takes (a date, a date and time with no zone, an instant), where each
// falls on the calendar, and moving one by whole days. A date and a zoneless date-time move by their
// date; an instant moves on the calendar's clock in its time zone, so it keeps its time of day even
// across a change to summer time.
import { civilToDayNumber, dayNumberToCivil, parseCanonicalDate } from '../../internal/date/dateMath';
import { getWeekdayNames } from '../../internal/date/dateFormat';

export const DAY_MS = 86_400_000;

const MONTH = /^(\d{4})-(\d{2})$/u;
const POINT = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}(?::?\d{2})?)?)?$/iu;

const pad = (value: number, width = 2) => String(value).padStart(width, '0');

export interface CalendarMonth {
  readonly year: number;
  readonly month: number;
}

/** A `YYYY-MM` month, or null when it is not one. */
export function parseMonth(value: string): CalendarMonth | null {
  const match = MONTH.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && month >= 1 && month <= 12 ? { year, month } : null;
}

export const monthText = (month: CalendarMonth): string => `${pad(month.year, 4)}-${pad(month.month)}`;

export function addMonthsTo(month: CalendarMonth, count: number): CalendarMonth {
  const total = month.year * 12 + month.month - 1 + count;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

export const sameMonth = (left: CalendarMonth, right: CalendarMonth): boolean => left.year === right.year && left.month === right.month;

export function monthOfDay(day: number): CalendarMonth {
  const { year, month } = dayNumberToCivil(day);
  return { year, month };
}

/** The day number of a `YYYY-MM-DD` date, or null when it is not one. */
export function dayOfDate(date: string): number | null {
  const civil = parseCanonicalDate(date);
  return civil ? civilToDayNumber(civil) : null;
}

export function dateOfDay(day: number): string {
  const { year, month, day: date } = dayNumberToCivil(day);
  return `${pad(year, 4)}-${pad(month)}-${pad(date)}`;
}

/** 0 Sunday to 6 Saturday (1970-01-01 was a Thursday). */
export const weekdayOf = (day: number): number => (((day + 4) % 7) + 7) % 7;

// ---- Time zones ---------------------------------------------------------------------------------

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

function zoneFormat(timeZone: string): Intl.DateTimeFormat {
  let format = zoneFormats.get(timeZone);
  if (!format) {
    try {
      // Read back as numbers only, never shown: the locale only fixes the digits and field order.
      format = new Intl.DateTimeFormat('en-US', {
        timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
        year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
      });
    } catch {
      throw new RangeError(`CgMonthCalendar timeZone '${timeZone}' is not a time zone this browser knows.`);
    }
    zoneFormats.set(timeZone, format);
  }
  return format;
}

/** Fails early on a time zone the browser does not know. */
export function assertTimeZone(timeZone: string | undefined): void {
  if (timeZone !== undefined) zoneFormat(timeZone);
}

/** An instant on the clock of `timeZone` (the browser's own when undefined): its day and the milliseconds after midnight. */
export function wallOf(instant: number, timeZone: string | undefined): { day: number; ms: number } {
  const millisecond = ((instant % 1000) + 1000) % 1000;
  if (timeZone === undefined) {
    const date = new Date(instant);
    return {
      day: civilToDayNumber({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }),
      ms: ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000 + millisecond,
    };
  }
  const parts = zoneFormat(timeZone).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
  return {
    day: civilToDayNumber({ year: part('year'), month: part('month'), day: part('day') }),
    ms: (((part('hour') % 24) * 60 + part('minute')) * 60 + part('second')) * 1000 + millisecond,
  };
}

/** The instant at a day and time on the clock of `timeZone`. */
export function instantOf(day: number, ms: number, timeZone: string | undefined): number {
  const wall = day * DAY_MS + ms;
  const offsetAt = (instant: number) => {
    const local = wallOf(instant, timeZone);
    return local.day * DAY_MS + local.ms - instant;
  };
  const guess = wall - offsetAt(wall);
  return wall - offsetAt(guess);
}

/** Today's date in `timeZone`. */
export function todayIn(timeZone: string | undefined): number {
  return wallOf(Date.now(), timeZone).day;
}

// ---- An item's dates ----------------------------------------------------------------------------

interface ParsedPoint {
  readonly day: number;
  /** Milliseconds after midnight as written, or null for a date. */
  readonly ms: number | null;
  /** `Z` or the offset as written, or null for a date or a zoneless date-time. */
  readonly zone: string | null;
  readonly seconds: boolean;
  readonly fraction: boolean;
}

function offsetMinutes(zone: string): number {
  if (zone.toUpperCase() === 'Z') return 0;
  const sign = zone.startsWith('-') ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  return sign * (Number(digits.slice(0, 2)) * 60 + (digits.length > 2 ? Number(digits.slice(2, 4)) : 0));
}

function parsePoint(value: string): ParsedPoint | null {
  const match = POINT.exec(value.trim());
  if (!match) return null;
  const day = dayOfDate(match[1]!);
  if (day === null) return null;
  if (match[2] === undefined) return { day, ms: null, zone: null, seconds: false, fraction: false };
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = Number(match[4] ?? 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  const fraction = match[5] ?? '';
  const millisecond = fraction ? Math.floor(Number(`0.${fraction}`) * 1000) : 0;
  return {
    day,
    ms: ((hour * 60 + minute) * 60 + second) * 1000 + millisecond,
    zone: match[6] ?? null,
    seconds: match[4] !== undefined,
    fraction: fraction !== '',
  };
}

/** Where a date falls on the calendar: its day, and its time in minutes after midnight (null for a date). */
export interface CalendarPoint {
  readonly day: number;
  readonly minutes: number | null;
}

/** Where a start or end falls in `timeZone`, or null when it cannot be read. */
export function readPoint(value: string, timeZone: string | undefined): CalendarPoint | null {
  const point = parsePoint(value);
  if (!point) return null;
  if (point.ms === null) return { day: point.day, minutes: null };
  if (point.zone === null) return { day: point.day, minutes: Math.floor(point.ms / 60_000) };
  const wall = wallOf(point.day * DAY_MS + point.ms - offsetMinutes(point.zone) * 60_000, timeZone);
  return { day: wall.day, minutes: Math.floor(wall.ms / 60_000) };
}

function instantText(instant: number, point: ParsedPoint, zone: string): string {
  const shifted = instant + offsetMinutes(zone) * 60_000;
  const day = Math.floor(shifted / DAY_MS);
  const ms = shifted - day * DAY_MS;
  let text = `${dateOfDay(day)}T${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}`;
  if (point.seconds || point.fraction) text += `:${pad(Math.floor(ms / 1000) % 60)}`;
  if (point.fraction) text += `.${pad(ms % 1000, 3)}`;
  return text + zone;
}

/**
 * A start or end moved by whole days, in the form it was written: a date or a zoneless date-time by
 * its date, an instant on the clock of `timeZone` (written back in its own offset). Null when it
 * cannot be read.
 */
export function shiftPoint(value: string, days: number, timeZone: string | undefined): string | null {
  const point = parsePoint(value);
  if (!point) return null;
  if (days === 0) return value;
  const trimmed = value.trim();
  if (point.ms === null || point.zone === null) return dateOfDay(point.day + days) + trimmed.slice(10);
  const wall = wallOf(point.day * DAY_MS + point.ms - offsetMinutes(point.zone) * 60_000, timeZone);
  return instantText(instantOf(wall.day + days, wall.ms, timeZone), point, point.zone);
}

// ---- Names --------------------------------------------------------------------------------------

export interface MonthCalendarFormats {
  monthHeading: (month: CalendarMonth) => string;
  /** A day in full, as "Monday 16 November 2026". */
  longDate: (day: number) => string;
  dayNumber: (day: number) => string;
  /** A time of day from minutes after midnight. */
  time: (minutes: number) => string;
  /** From the week's first day. */
  weekdays: ReadonlyArray<{ short: string; long: string }>;
}

/** The calendar's names, from `Intl` in `locale` on the Gregorian calendar. */
export function monthCalendarFormats(locale: string | undefined, firstDayOfWeek: number): MonthCalendarFormats {
  const base = { calendar: 'gregory', timeZone: 'UTC' } as const;
  const heading = new Intl.DateTimeFormat(locale, { ...base, month: 'long', year: 'numeric' });
  const long = new Intl.DateTimeFormat(locale, { ...base, dateStyle: 'full' });
  const number = new Intl.DateTimeFormat(locale, { ...base, day: 'numeric' });
  const time = new Intl.DateTimeFormat(locale, { ...base, hour: 'numeric', minute: '2-digit' });
  const at = (day: number) => new Date(day * DAY_MS);
  return {
    monthHeading: (month) => heading.format(at(civilToDayNumber({ year: month.year, month: month.month, day: 1 }))),
    longDate: (day) => long.format(at(day)),
    dayNumber: (day) => number.format(at(day)),
    time: (minutes) => time.format(new Date(minutes * 60_000)),
    weekdays: getWeekdayNames(locale, firstDayOfWeek),
  };
}
