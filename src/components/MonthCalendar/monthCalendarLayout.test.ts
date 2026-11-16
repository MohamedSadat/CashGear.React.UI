import { describe, expect, it } from 'vitest';
import type { CgMonthCalendarItem } from './CgMonthCalendar.types';
import { assertTimeZone, dateOfDay, dayOfDate, monthCalendarFormats, readPoint, shiftPoint } from './monthCalendarDates';
import { hiddenPerDay, itemsOnDay, layoutMonthCalendar, layoutWeeks, monthGrid, moveDay, moveStep, placeItems, shiftItemDates } from './monthCalendarLayout';

const november = { year: 2026, month: 11 };
const SUNDAY = 0;
const MONDAY = 1;
const SATURDAY = 6;
const day = (date: string) => dayOfDate(date)!;
const item = (key: string, start: string, end?: string | null): CgMonthCalendarItem => ({ key, title: key, start, end });

describe('the month grid', () => {
  it('starts on the week day given, the 1st in its first row', () => {
    // November 2026 starts on a Sunday and has 30 days.
    const sunday = monthGrid(november, SUNDAY);
    expect(dateOfDay(sunday.start)).toBe('2026-11-01');
    expect(sunday.weeks).toBe(5);
    const saturday = monthGrid(november, SATURDAY);
    expect(dateOfDay(saturday.start)).toBe('2026-10-31');
    expect(saturday.weeks).toBe(5);
    const monday = monthGrid(november, MONDAY);
    expect(dateOfDay(monday.start)).toBe('2026-10-26');
    expect(monday.weeks).toBe(6);
    expect([dateOfDay(monday.first), dateOfDay(monday.last)]).toEqual(['2026-11-01', '2026-11-30']);
    // February 2026 starts on a Sunday and fits four weeks exactly.
    expect(monthGrid({ year: 2026, month: 2 }, SUNDAY).weeks).toBe(4);
    expect(monthGrid({ year: 2026, month: 2 }, SATURDAY).weeks).toBe(5);
  });
});

describe('placing items', () => {
  it('takes one day for no end, an end on the start (zero length) or before it, and an inclusive end otherwise', () => {
    const placed = placeItems([
      item('single', '2026-11-03'),
      item('zero', '2026-11-20', '2026-11-20'),
      item('backwards', '2026-11-10', '2026-11-08'),
      item('span', '2026-11-12', '2026-11-18'),
      item('bad-end', '2026-11-04', 'soon'),
      item('empty-end', '2026-11-05', ''),
      item('unreadable', 'tomorrow'),
      item('impossible', '2026-02-30'),
    ], 'UTC');
    expect(placed.map((entry) => [entry.item.key, dateOfDay(entry.start), dateOfDay(entry.end)])).toEqual([
      ['single', '2026-11-03', '2026-11-03'],
      ['zero', '2026-11-20', '2026-11-20'],
      ['backwards', '2026-11-10', '2026-11-10'],
      ['span', '2026-11-12', '2026-11-18'],
      ['bad-end', '2026-11-04', '2026-11-04'],
      ['empty-end', '2026-11-05', '2026-11-05'],
    ]);
    expect(placed.map((entry) => entry.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('places instants on their day in the time zone, a date and time with no zone on its own date', () => {
    const late = '2026-11-03T22:30:00Z';
    expect(readPoint(late, 'Asia/Riyadh')).toEqual({ day: day('2026-11-04'), minutes: 90 });
    expect(readPoint(late, 'America/New_York')).toEqual({ day: day('2026-11-03'), minutes: 17 * 60 + 30 });
    expect(readPoint('2026-11-03T23:30:00+03:00', 'Asia/Tokyo')).toEqual({ day: day('2026-11-04'), minutes: 5 * 60 + 30 });
    expect(readPoint('2026-11-03T10:15', 'Asia/Tokyo')).toEqual({ day: day('2026-11-03'), minutes: 615 });
    expect(readPoint('2026-11-03', 'Asia/Tokyo')).toEqual({ day: day('2026-11-03'), minutes: null });
    expect(readPoint('2026-11-03T25:00', 'UTC')).toBeNull();
    const [span] = placeItems([item('meeting', '2026-11-03T09:00:00Z', '2026-11-05T10:00:00Z')], 'UTC');
    expect([dateOfDay(span!.start), dateOfDay(span!.end), span!.minutes]).toEqual(['2026-11-03', '2026-11-05', 540]);
  });

  it('needs unique, nonempty keys and a time zone the browser knows', () => {
    expect(() => placeItems([item('a', '2026-11-01'), item('a', '2026-11-02')], 'UTC')).toThrow(/duplicate key 'a'/u);
    expect(() => placeItems([item('', '2026-11-01')], 'UTC')).toThrow(/nonempty key/u);
    expect(() => assertTimeZone('Not/AZone')).toThrow(RangeError);
    expect(() => assertTimeZone(undefined)).not.toThrow();
  });
});

describe('lanes and weeks', () => {
  it('cuts spans into weeks and lays the pieces in lanes, longer ones first, then in the order given', () => {
    const grid = monthGrid(november, SUNDAY); // weeks from Sunday 1 November
    const placed = placeItems([item('one', '2026-11-06'), item('two', '2026-11-06'), item('later', '2026-11-07'), item('long', '2026-11-05', '2026-11-10')], 'UTC');
    const weeks = layoutWeeks(placed, grid);
    const first = weeks[0]!;
    const piece = (key: string) => first.find((entry) => entry.placed.item.key === key);
    expect(piece('long')).toMatchObject({ col: 4, span: 3, lane: 0, before: false, after: true });
    expect(piece('one')).toMatchObject({ col: 5, span: 1, lane: 1 });
    expect(piece('two')).toMatchObject({ col: 5, span: 1, lane: 2 });
    expect(piece('later')).toMatchObject({ col: 6, span: 1, lane: 1 });
    expect(weeks[1]!.find((entry) => entry.placed.item.key === 'long')).toMatchObject({ col: 0, span: 3, lane: 0, before: true, after: false });
    expect(hiddenPerDay(first, 2)).toEqual([0, 0, 0, 0, 0, 1, 0]);
    expect(itemsOnDay(first, 5).map((entry) => entry.item.key)).toEqual(['long', 'one', 'two']);
  });

  it('carries a span through every week it touches, and from before the grid', () => {
    const { weeks } = layoutMonthCalendar([item('quarter', '2026-11-12', '2026-11-25'), item('early', '2026-10-20', '2026-11-03')], { month: november, firstDayOfWeek: SUNDAY, rows: 3, timeZone: 'UTC' });
    const pieces = (key: string) => weeks.map((week) => week.pieces.find((entry) => entry.placed.item.key === key)).map((entry) => (entry ? [entry.col, entry.span, entry.before, entry.after] : null));
    expect(pieces('quarter')).toEqual([null, [4, 3, false, true], [0, 7, true, true], [0, 4, true, false], null]);
    expect(pieces('early')).toEqual([[0, 3, true, false], null, null, null, null]);
  });

  it('lays a Saturday-first month out the same way (right to left is the same grid, mirrored)', () => {
    const { weeks, grid } = layoutMonthCalendar([item('weekend', '2026-11-06', '2026-11-08')], { month: november, firstDayOfWeek: SATURDAY, rows: 3, timeZone: 'UTC' });
    expect(dateOfDay(grid.start)).toBe('2026-10-31');
    expect(weeks[0]!.pieces[0]).toMatchObject({ col: 6, span: 1, after: true });
    expect(weeks[1]!.pieces[0]).toMatchObject({ col: 0, span: 2, before: true });
  });

  it('shows the rows given and counts the rest of a full day as "+N more"', () => {
    const busy = ['a', 'b', 'c', 'd', 'e'].map((key) => item(key, '2026-11-24'));
    const { weeks } = layoutMonthCalendar([...busy, item('across', '2026-11-23', '2026-11-25')], { month: november, firstDayOfWeek: SUNDAY, rows: 3, timeZone: 'UTC' });
    const week = weeks[3]!; // 22 to 28 November
    expect(dateOfDay(week.start)).toBe('2026-11-22');
    expect(week.shown).toHaveLength(3);
    expect(week.shown.map((entry) => entry.placed.item.key)).toEqual(['across', 'a', 'b']);
    expect(week.hidden).toEqual([0, 0, 3, 0, 0, 0, 0]);
    expect(itemsOnDay(week.pieces, 2).map((entry) => entry.item.key)).toEqual(['across', 'a', 'b', 'c', 'd', 'e']);
  });
});

describe('moving dates', () => {
  it('moves a date or a span by whole days, keeping its length', () => {
    expect(shiftItemDates({ start: '2026-11-30' }, 2, 'UTC')).toEqual({ start: '2026-12-02', end: null });
    expect(shiftItemDates({ start: '2026-11-03', end: '2026-11-05' }, -3, 'UTC')).toEqual({ start: '2026-10-31', end: '2026-11-02' });
    expect(shiftItemDates({ start: '2026-11-03', end: '2026-11-03' }, 7, 'UTC')).toEqual({ start: '2026-11-10', end: '2026-11-10' });
    expect(shiftItemDates({ start: '2026-11-03T10:15', end: '2026-11-04T09:00' }, 1, 'UTC')).toEqual({ start: '2026-11-04T10:15', end: '2026-11-05T09:00' });
  });

  it('moves an instant on the clock of its time zone, across a change to summer time, in the form it was written', () => {
    expect(shiftPoint('2026-11-03T07:30:00Z', 1, 'Asia/Riyadh')).toBe('2026-11-04T07:30:00Z');
    // New York moves its clocks on 8 March 2026: 10:00 stays 10:00.
    expect(shiftPoint('2026-03-07T15:00:00Z', 2, 'America/New_York')).toBe('2026-03-09T14:00:00Z');
    expect(shiftPoint('2026-03-07T10:00-05:00', 2, 'America/New_York')).toBe('2026-03-09T09:00-05:00');
    expect(shiftPoint('2026-11-03T07:30:00.250Z', 1, 'UTC')).toBe('2026-11-04T07:30:00.250Z');
    const kept = shiftItemDates({ start: '2026-03-07T15:00:00Z', end: '2026-03-07T16:30:00Z' }, 7, 'America/New_York');
    expect(Date.parse(kept.end!) - Date.parse(kept.start)).toBe(90 * 60_000);
    expect(shiftPoint('not a date', 1, 'UTC')).toBeNull();
  });
});

describe('the keys', () => {
  const friday = day('2026-11-13');

  it('move a day along the line (mirrored in right to left), a week, and to the ends of the week', () => {
    expect(moveDay(friday, 'ArrowRight', false, SUNDAY)).toBe(friday + 1);
    expect(moveDay(friday, 'ArrowRight', true, SATURDAY)).toBe(friday - 1);
    expect(moveDay(friday, 'ArrowLeft', true, SATURDAY)).toBe(friday + 1);
    expect(moveDay(friday, 'ArrowUp', false, SUNDAY)).toBe(friday - 7);
    expect(moveDay(friday, 'ArrowDown', true, SATURDAY)).toBe(friday + 7);
    expect(dateOfDay(moveDay(friday, 'Home', false, SUNDAY)!)).toBe('2026-11-08');
    expect(dateOfDay(moveDay(friday, 'End', false, SUNDAY)!)).toBe('2026-11-14');
    expect(dateOfDay(moveDay(friday, 'Home', true, SATURDAY)!)).toBe('2026-11-07');
    expect(dateOfDay(moveDay(friday, 'End', true, SATURDAY)!)).toBe('2026-11-13');
    expect(moveDay(friday, 'x', false, SUNDAY)).toBeNull();
  });

  it('turn months with PageUp and PageDown, years with Shift, the day cut to the month', () => {
    expect(dateOfDay(moveDay(day('2026-01-31'), 'PageDown', false, SUNDAY)!)).toBe('2026-02-28');
    expect(dateOfDay(moveDay(friday, 'PageUp', false, SUNDAY)!)).toBe('2026-10-13');
    expect(dateOfDay(moveDay(friday, 'PageDown', false, SUNDAY, true)!)).toBe('2027-11-13');
  });

  it('move an item a day along the line with Alt (mirrored in right to left) or a week', () => {
    expect([moveStep('ArrowLeft', false), moveStep('ArrowRight', false), moveStep('ArrowLeft', true), moveStep('ArrowRight', true)]).toEqual([-1, 1, 1, -1]);
    expect([moveStep('ArrowUp', true), moveStep('ArrowDown', false), moveStep('Home', false)]).toEqual([-7, 7, null]);
  });
});

describe('names', () => {
  it('come from Intl in the locale, on the Gregorian calendar, from the first day of the week', () => {
    const arabic = monthCalendarFormats('ar-SA', SATURDAY);
    expect(arabic.monthHeading(november)).toContain('نوفمبر');
    expect(arabic.weekdays[0]!.long).toBe('السبت');
    expect(arabic.longDate(day('2026-11-16'))).toContain('الاثنين');
    const english = monthCalendarFormats('en-US', SUNDAY);
    expect(english.monthHeading(november)).toBe('November 2026');
    expect(english.weekdays.map((name) => name.short)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(english.longDate(day('2026-11-16'))).toBe('Monday, November 16, 2026');
    expect(english.time(10 * 60 + 30)).toMatch(/^10:30\sAM$/u);
  });
});
