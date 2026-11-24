// A recurrence rule's arithmetic, shared by CgScheduler and the exported functions: the dates a
// rule falls on from its first date, the instant each keeps its wall-clock time at in an IANA zone,
// validation, and a summary in the caller's words. Days are `YYYY-MM-DD` on the series' clock.
import { localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import type { CgDayOfWeek } from '../../types/date';
import { addDays, civil, dayIndex, instant, iso, localParts, MINUTE, WEEKDAYS, zonedInstant } from '../Scheduler/schedulerDate';
import type { CgRecurrenceProblem, CgRecurrenceRule, CgRecurrenceSeries, CgRecurrenceSummaryOptions, CgRecurrenceSummaryParts, CgRecurrenceSummaryWords } from './CgRecurrenceFields.types';

export const RECURRENCE_LIMIT = 500_000;
const FREQUENCIES = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const RANGES = ['noEndDate', 'occurrenceCount', 'endByDate'];
const WEEKS = ['none', 'first', 'second', 'third', 'fourth', 'last'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const limitError = () => new Error('Scheduler recurrence generated more than 500,000 candidates. Add an end date or reduce its range.');
const yearError = () => new Error('Scheduler recurrence exceeds the supported year range.');
const isDay = (value: string) => { try { civil(value); return true; } catch { return false; } };

/** What is wrong with a rule, or null. With `start` (and its zone), also whether it can ever fall on a day. */
export function cgValidateRecurrence(rule: CgRecurrenceRule, start?: string, timeZone = 'UTC'): CgRecurrenceProblem | null {
  if (!FREQUENCIES.includes(rule.frequency) || !RANGES.includes(rule.range ?? 'noEndDate') || !WEEKS.includes(rule.weekOfMonth ?? 'none')) return 'rule';
  const interval = rule.interval ?? 1;
  if (!Number.isSafeInteger(interval) || interval <= 0) return 'interval';
  const count = rule.occurrenceCount ?? 10;
  if (rule.range === 'occurrenceCount' && (!Number.isSafeInteger(count) || count <= 0)) return 'occurrenceCount';
  if (rule.range === 'endByDate' && !(rule.endDate && isDay(rule.endDate))) return 'endDate';
  if (rule.dayOfMonth != null && (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) return 'dayOfMonth';
  if (rule.month != null && (!Number.isInteger(rule.month) || rule.month < 1 || rule.month > 12)) return 'month';
  if (rule.weekDays?.some((day) => !WEEKDAYS.includes(day))) return 'weekDays';
  const first = start === undefined ? undefined : firstDate(start, timeZone);
  if (first && rule.frequency === 'daily' && interval % 7 === 0 && rule.weekDays?.length && !rule.weekDays.includes(WEEKDAYS[dayIndex(first)]!)) return 'unreachable';
  return null;
}

function monthDates(year: number, month: number, anchor: string, rule: CgRecurrenceRule): string[] {
  if (year < 1 || year > 9999) return [];
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const date = new Date(civil(first)); date.setUTCMonth(month); date.setUTCDate(0);
  const last = date.getUTCDate();
  if (!rule.weekOfMonth || rule.weekOfMonth === 'none') return [addDays(first, Math.min(rule.dayOfMonth ?? Number(anchor.slice(8)), last) - 1)];
  const weekdays = rule.weekDays?.length ? rule.weekDays : [WEEKDAYS[dayIndex(anchor)]!];
  return [...new Set(weekdays)].map((weekday) => {
    const day = WEEKDAYS.indexOf(weekday);
    const offset = rule.weekOfMonth === 'last' ? last - 1 - (dayIndex(addDays(first, last - 1)) - day + 7) % 7 : (day - dayIndex(first) + 7) % 7 + ['first', 'second', 'third', 'fourth'].indexOf(rule.weekOfMonth!) * 7;
    return addDays(first, offset);
  }).sort();
}

/**
 * The days a rule falls on from `anchor` (its first date) on, in order, before its end is applied.
 * Past the year 9999 it throws, or with `open` just ends.
 */
export function* recurrenceDates(anchor: string, rule: CgRecurrenceRule, open = false): Generator<string> {
  const interval = rule.interval ?? 1;
  const weekday = dayIndex(anchor);
  const days = [...new Set(rule.weekDays?.length ? rule.weekDays.map((day) => WEEKDAYS.indexOf(day)) : [weekday])].sort();
  if (rule.frequency === 'daily' && interval % 7 === 0 && !days.includes(weekday)) throw new Error('Scheduler recurrence has no reachable weekdays.');
  for (let period = 0; ; period++) {
    if (period >= RECURRENCE_LIMIT) throw limitError(); // Also bounds impossible weekday/interval combinations.
    let dates: string[];
    if (rule.frequency === 'daily') {
      const date = addDays(anchor, period * interval);
      if (!DAY.test(date)) { if (open) return; throw yearError(); }
      dates = !rule.weekDays?.length || days.includes(dayIndex(date)) ? [date] : [];
    } else if (rule.frequency === 'weekly') dates = days.map((day) => addDays(anchor, -weekday + period * interval * 7 + day));
    else {
      const monthIndex = Number(anchor.slice(0, 4)) * 12 + Number(anchor.slice(5, 7)) - 1 + (rule.frequency === 'monthly' ? period * interval : period * interval * 12);
      const year = Math.floor(monthIndex / 12); if (year > 9999) { if (open) return; throw yearError(); }
      dates = monthDates(year, rule.frequency === 'yearly' ? rule.month ?? Number(anchor.slice(5, 7)) : monthIndex % 12 + 1, anchor, rule);
    }
    for (const date of dates) { if (!DAY.test(date)) { if (open) return; throw yearError(); } if (date >= anchor) yield date; }
  }
}

/**
 * The first date of a series starting at `startMs` in `zone`, and the instant an occurrence on
 * another day starts at: the same wall-clock time, at the first's offset when that still reads as
 * that time, otherwise the earlier of a repeated time or the first valid minute after a skipped one.
 */
export function instantClock(startMs: number, zone: string) {
  const anchor = localParts(startMs, zone);
  const fraction = ((startMs % 1000) + 1000) % 1000;
  const offset = civil(anchor.date) + anchor.minutes * MINUTE + anchor.seconds * 1000 + fraction - startMs;
  return {
    date: anchor.date,
    at(date: string): number {
      const preferred = civil(date) + anchor.minutes * MINUTE - offset;
      const parts = localParts(preferred, zone);
      return (parts.date === date && parts.minutes === anchor.minutes ? preferred : zonedInstant(date, anchor.minutes, zone)) + anchor.seconds * 1000 + fraction;
    },
  };
}

/** A start's day on the series' clock, or undefined when it cannot be read. */
function firstDate(start: string, zone: string): string | undefined {
  try { return DAY.test(start) ? (civil(start), start) : localParts(instant(start), zone).date; } catch { return undefined; }
}

function series(value: CgRecurrenceSeries) {
  const zone = value.timeZone ?? 'UTC';
  const problem = cgValidateRecurrence(value.rule, value.start, zone);
  if (problem && problem !== 'unreachable') throw new RangeError(`Invalid recurrence rule: ${problem}.`);
  let startMs: number | undefined;
  try { if (DAY.test(value.start)) civil(value.start); else startMs = instant(value.start); } catch {
    throw new RangeError('A recurrence series starts on a YYYY-MM-DD day or an ISO instant with an offset.');
  }
  return { zone, startMs, clock: startMs === undefined ? undefined : instantClock(startMs, zone), first: firstDate(value.start, zone)!, unreachable: problem === 'unreachable' };
}

/**
 * The occurrences from `from` (inclusive, or exclusive with `after`) until `to` (exclusive), at most
 * `limit`. A day series compares days, reading an instant bound as its day in the zone; an instant
 * series compares instants, reading a day bound as that day's midnight in the zone.
 */
function occurrences(value: CgRecurrenceSeries, from: string, to: string | undefined, limit: number, after: boolean): string[] {
  const { rule } = value;
  const { zone, clock, first, unreachable } = series(value);
  const result: string[] = [];
  if (unreachable || limit <= 0) return result;
  // Keys are numbers: a day's midnight in UTC for a day series, the instant for an instant series.
  const bound = (text: string): number => {
    try {
      if (!clock) return civil(DAY.test(text) ? text : localParts(instant(text), zone).date);
      return DAY.test(text) ? zonedInstant(text, 0, zone) : instant(text);
    } catch { throw new RangeError('A recurrence bound is a YYYY-MM-DD day or an ISO instant with an offset.'); }
  };
  const low = bound(from), high = to === undefined ? Infinity : bound(to);
  const fits = (key: number) => (after ? key > low : key >= low) && key < high;
  // A day well before the low bound cannot hold an occurrence after it, so its instant is not worked out.
  const lowDay = clock ? addDays(localParts(low, zone).date, -2) : '';
  const highDay = clock && high !== Infinity ? addDays(localParts(high, zone).date, 2) : undefined;
  if (rule.frequency === 'none') {
    const key = clock ? clock.at(first) : civil(first);
    if (fits(key)) result.push(clock ? iso(key) : first);
    return result;
  }
  let count = 0;
  for (const date of recurrenceDates(first, rule, true)) {
    if (rule.range === 'endByDate' && date > rule.endDate!) break;
    if (rule.range === 'occurrenceCount' && count >= (rule.occurrenceCount ?? 10)) break;
    if (++count > RECURRENCE_LIMIT) throw limitError();
    if (!clock) {
      const key = civil(date);
      if (key >= high) break;
      if (fits(key)) result.push(date);
    } else {
      if (highDay !== undefined && date > highDay) break;
      if (date < lowDay) continue;
      const ms = clock.at(date);
      if (ms >= high) break;
      if (fits(ms)) result.push(iso(ms));
    }
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * The series' first occurrence after `after` (a day, or an instant: see the series' forms), or null
 * when it has ended. Occurrences are counted from the series' start, which is the first when the rule
 * falls on it.
 */
export function cgNextOccurrence(value: CgRecurrenceSeries, after: string): string | null {
  return occurrences(value, after, undefined, 1, true)[0] ?? null;
}

/** The series' occurrences from `from` (inclusive) to `to` (exclusive), in order, at most `limit` (default 1,000). */
export function cgOccurrencesBetween(value: CgRecurrenceSeries, from: string, to: string, limit = 1000): string[] {
  return occurrences(value, from, to, limit, false);
}

const defaultSentence = ({ every, on, month, end }: CgRecurrenceSummaryParts) => [every, on, month].filter(Boolean).join(' ') + (end ? `, ${end}` : '');

/** A rule in a short sentence of the caller's words: "Every 2 weeks on Monday and Wednesday, 5 times". */
export function cgSummarizeRecurrence(rule: CgRecurrenceRule, words: CgRecurrenceSummaryWords, options: CgRecurrenceSummaryOptions = {}): string {
  if (rule.frequency === 'none') return words.none;
  const locale = options.locale ?? 'en-US';
  const anchor = options.start === undefined ? undefined : firstDate(options.start, options.timeZone ?? 'UTC');
  const first = options.firstDayOfWeek ? WEEKDAYS.indexOf(options.firstDayOfWeek) : localeFirstDayOfWeek(locale);
  const names = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  const monthName = (month: number) => new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(Date.UTC(2026, month - 1, 1));
  const days = () => {
    const chosen: CgDayOfWeek[] = rule.weekDays?.length ? [...new Set(rule.weekDays)].filter((day) => WEEKDAYS.includes(day)) : anchor ? [WEEKDAYS[dayIndex(anchor)]!] : [];
    const place = (day: CgDayOfWeek) => (WEEKDAYS.indexOf(day) - first + 7) % 7;
    // 6 September 2026 is a Sunday.
    return chosen.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(chosen.sort((a, b) => place(a) - place(b)).map((day) => names.format(Date.UTC(2026, 8, 6 + WEEKDAYS.indexOf(day))))) : undefined;
  };
  let on: string | undefined, month: string | undefined;
  if (rule.frequency === 'daily' || rule.frequency === 'weekly') {
    const list = rule.frequency === 'weekly' || rule.weekDays?.length ? days() : undefined;
    if (list) on = words.onWeekDays(list);
  } else {
    const monthNumber = rule.month ?? (anchor ? Number(anchor.slice(5, 7)) : undefined);
    if (!rule.weekOfMonth || rule.weekOfMonth === 'none') {
      const day = rule.dayOfMonth ?? (anchor ? Number(anchor.slice(8)) : undefined);
      if (day && rule.frequency === 'monthly') on = words.onDayOfMonth(day);
      else if (day && monthNumber) on = words.onDate(monthName(monthNumber), day);
    } else {
      const list = days();
      if (list) on = words.onWeekOfMonth(rule.weekOfMonth, list);
      if (rule.frequency === 'yearly' && monthNumber) month = words.ofMonth(monthName(monthNumber));
    }
  }
  let end: string | undefined;
  if (rule.range === 'occurrenceCount') end = words.times(rule.occurrenceCount ?? 10);
  else if (rule.range === 'endByDate' && rule.endDate) {
    let date = rule.endDate;
    try { date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(civil(rule.endDate)); } catch { /* Written as it is. */ }
    end = words.until(date);
  }
  return (words.sentence ?? defaultSentence)({ every: words.every(rule.frequency, rule.interval ?? 1), ...(on ? { on } : {}), ...(month ? { month } : {}), ...(end ? { end } : {}) });
}
