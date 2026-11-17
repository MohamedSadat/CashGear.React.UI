// The timeline's calendar, pure: the scales and the pixels a day takes at each, the units of its
// two-tier header (days, weeks from the first day of the week, months, quarters, years) as day
// numbers (days since 1970-01-01), and the names it writes, from `Intl` in the locale on the
// Gregorian calendar. Reading and moving an item's dates is the month calendar's
// (`monthCalendarDates`), so the two views of the same rows agree to the day.
import { civilToDayNumber, dayNumberToCivil } from '../../internal/date/dateMath';
import { DAY_MS, weekdayOf } from '../MonthCalendar/monthCalendarDates';
import type { CgTimelineScale } from './CgTimeline.types';

export const TIMELINE_SCALES: ReadonlyArray<CgTimelineScale> = Object.freeze(['day', 'week', 'month', 'quarter']);

/** Pixels a day takes at each scale, unless the caller says otherwise. */
export const DEFAULT_DAY_WIDTHS: Readonly<Record<CgTimelineScale, number>> = Object.freeze({ day: 48, week: 20, month: 5, quarter: 2 });

/** Days the timeline reaches on each side of where it is first shown; it grows by as many when scrolled near an end. */
export const REACH_DAYS: Readonly<Record<CgTimelineScale, number>> = Object.freeze({ day: 366, week: 731, month: 1827, quarter: 3653 });

export type AxisUnitKind = 'day' | 'week' | 'month' | 'quarter' | 'year';

/** The header's two tiers at each scale: the upper one, then the lower one whose units the grid lines follow. */
export const SCALE_TIERS: Readonly<Record<CgTimelineScale, readonly [AxisUnitKind, AxisUnitKind]>> = Object.freeze({
  day: ['month', 'day'],
  week: ['month', 'week'],
  month: ['year', 'month'],
  quarter: ['year', 'quarter'],
});

export interface AxisUnit {
  readonly kind: AxisUnitKind;
  /** Its first and last day. */
  readonly start: number;
  readonly end: number;
}

const monthIndex = (day: number): number => {
  const { year, month } = dayNumberToCivil(day);
  return year * 12 + month - 1;
};
const firstOfMonthIndex = (index: number): number => civilToDayNumber({ year: Math.floor(index / 12), month: (index % 12) + 1, day: 1 });

/** The first day of the unit holding `day`; weeks start on `firstDayOfWeek` (0 Sunday to 6 Saturday). */
export function unitStart(kind: AxisUnitKind, day: number, firstDayOfWeek: number): number {
  switch (kind) {
    case 'day': return day;
    case 'week': return day - ((weekdayOf(day) - firstDayOfWeek + 7) % 7);
    case 'month': return firstOfMonthIndex(monthIndex(day));
    case 'quarter': {
      const index = monthIndex(day);
      return firstOfMonthIndex(index - ((index % 12) % 3));
    }
    case 'year': {
      const index = monthIndex(day);
      return firstOfMonthIndex(index - (index % 12));
    }
  }
}

/** The first day of the unit after the one starting on `start`. */
export function unitAfter(kind: AxisUnitKind, start: number): number {
  switch (kind) {
    case 'day': return start + 1;
    case 'week': return start + 7;
    case 'month': return firstOfMonthIndex(monthIndex(start) + 1);
    case 'quarter': return firstOfMonthIndex(monthIndex(start) + 3);
    case 'year': return firstOfMonthIndex(monthIndex(start) + 12);
  }
}

/** The units of a kind that touch the days `from` to `to`, the first one starting on or before `from`. */
export function axisUnits(kind: AxisUnitKind, from: number, to: number, firstDayOfWeek: number): AxisUnit[] {
  const units: AxisUnit[] = [];
  for (let start = unitStart(kind, from, firstDayOfWeek); start <= to;) {
    const next = unitAfter(kind, start);
    units.push({ kind, start, end: next - 1 });
    start = next;
  }
  return units;
}

/** The days a viewport shows: the first and last day any part of which is in it. */
export function shownDays(scroll: number, viewport: number, dayWidth: number, from: number): { first: number; last: number } {
  const first = from + Math.floor(Math.max(0, scroll) / dayWidth);
  const last = from + Math.floor((Math.max(0, scroll) + Math.max(1, viewport) - 1) / dayWidth);
  return { first, last: Math.max(first, last) };
}

// ---- Names --------------------------------------------------------------------------------------

export interface TimelineFormats {
  /** A header unit's text: a month in the upper tier is written with its year, as "November 2026". */
  unit: (unit: AxisUnit, tier: 'upper' | 'lower') => string;
  /** A day's weekday, narrow, under its number at the day scale. */
  weekday: (day: number) => string;
  /** A day in full, as "Monday 16 November 2026". */
  longDate: (day: number) => string;
  /** The days an item covers, as "16 – 18 November 2026", for its default name. */
  span: (start: number, end: number) => string;
  /** The days shown, as "2 Nov – 14 Dec 2026". */
  range: (start: number, end: number) => string;
}

/** The timeline's names in `locale`; `quarter` writes a quarter's header (default: its months, as "Jan – Mar"). */
export function timelineFormats(locale: string | undefined, quarter?: (quarter: number, year: string) => string): TimelineFormats {
  const base = { calendar: 'gregory', timeZone: 'UTC' } as const;
  const monthYear = new Intl.DateTimeFormat(locale, { ...base, month: 'long', year: 'numeric' });
  const year = new Intl.DateTimeFormat(locale, { ...base, year: 'numeric' });
  const dayNumber = new Intl.DateTimeFormat(locale, { ...base, day: 'numeric' });
  const weekStart = new Intl.DateTimeFormat(locale, { ...base, day: 'numeric', month: 'short' });
  const month = new Intl.DateTimeFormat(locale, { ...base, month: 'short' });
  const weekday = new Intl.DateTimeFormat(locale, { ...base, weekday: 'narrow' });
  const long = new Intl.DateTimeFormat(locale, { ...base, dateStyle: 'full' });
  const spanFormat = new Intl.DateTimeFormat(locale, { ...base, dateStyle: 'long' });
  const rangeFormat = new Intl.DateTimeFormat(locale, { ...base, dateStyle: 'medium' });
  const at = (day: number) => new Date(day * DAY_MS);
  const between = (format: Intl.DateTimeFormat, start: number, end: number) => (end > start ? format.formatRange(at(start), at(end)) : format.format(at(start)));
  return {
    unit: (unit, tier) => {
      switch (unit.kind) {
        case 'day': return dayNumber.format(at(unit.start));
        case 'week': return weekStart.format(at(unit.start));
        case 'month': return (tier === 'upper' ? monthYear : month).format(at(unit.start));
        case 'year': return year.format(at(unit.start));
        case 'quarter': {
          if (quarter) return quarter(Math.floor((monthIndex(unit.start) % 12) / 3) + 1, year.format(at(unit.start)));
          return between(month, unit.start, firstOfMonthIndex(monthIndex(unit.start) + 2));
        }
      }
    },
    weekday: (day) => weekday.format(at(day)),
    longDate: (day) => long.format(at(day)),
    span: (start, end) => between(spanFormat, start, end),
    range: (start, end) => between(rangeFormat, start, end),
  };
}
