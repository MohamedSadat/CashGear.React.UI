// The month grid's layout, pure and tested on its own: the weeks of a month from the first day of
// the week, each item's first and last day on the calendar (an inclusive end; no end, or an end at
// or before the start, is one day), the piece of an item in each week it touches, their lanes
// (pieces by first day, longer ones first, then the caller's order; each in the first lane free
// from its first day), how many pieces a full day cannot show, and the keys that move between days.
import { addMonths, civilToDayNumber, dayNumberToCivil, daysInMonth } from '../../internal/date/dateMath';
import type { CgMonthCalendarItem } from './CgMonthCalendar.types';
import { readPoint, shiftPoint, weekdayOf } from './monthCalendarDates';
import type { CalendarMonth } from './monthCalendarDates';

export interface MonthGrid {
  /** The day number of the grid's first cell: the week's first day on or before the 1st. */
  readonly start: number;
  /** Rows of seven days, 4 to 6. */
  readonly weeks: number;
  /** The 1st and the last day of the month itself. */
  readonly first: number;
  readonly last: number;
}

/** The month's grid, its weeks starting on `firstDayOfWeek` (0 Sunday to 6 Saturday). */
export function monthGrid(month: CalendarMonth, firstDayOfWeek: number): MonthGrid {
  const first = civilToDayNumber({ year: month.year, month: month.month, day: 1 });
  const lead = (weekdayOf(first) - firstDayOfWeek + 7) % 7;
  const length = daysInMonth(month.year, month.month);
  return { start: first - lead, weeks: Math.ceil((lead + length) / 7), first, last: first + length - 1 };
}

/** An item placed on the calendar: its first and last day, its start time, and its place in the caller's order. */
export interface PlacedItem<TData> {
  readonly item: CgMonthCalendarItem<TData>;
  readonly start: number;
  readonly end: number;
  /** Minutes after midnight when the start has a time, else null. */
  readonly minutes: number | null;
  readonly order: number;
}

/** The items whose start can be read, placed by their days in `timeZone`. Keys must be unique and nonempty. */
export function placeItems<TData>(items: ReadonlyArray<CgMonthCalendarItem<TData>>, timeZone: string | undefined): PlacedItem<TData>[] {
  const keys = new Set<string>();
  const placed: PlacedItem<TData>[] = [];
  items.forEach((item, order) => {
    if (!item.key) throw new Error('CgMonthCalendar items require a nonempty key.');
    if (keys.has(item.key)) throw new Error(`CgMonthCalendar contains duplicate key '${item.key}'.`);
    keys.add(item.key);
    const start = readPoint(item.start, timeZone);
    if (!start) return;
    const last = item.end ? readPoint(item.end, timeZone) : null;
    placed.push({ item, start: start.day, end: last && last.day > start.day ? last.day : start.day, minutes: start.minutes, order });
  });
  return placed;
}

/** The piece of an item inside one week. */
export interface MonthSegment<TData> {
  readonly placed: PlacedItem<TData>;
  /** The week's row in the grid. */
  readonly week: number;
  /** The first day's column (0 is the week's first day) and how many days it covers. */
  readonly col: number;
  readonly span: number;
  readonly lane: number;
  /** The item began before this week, or goes on after it. */
  readonly before: boolean;
  readonly after: boolean;
}

/** The pieces of every item in each week of the grid, with their lanes. */
export function layoutWeeks<TData>(placed: ReadonlyArray<PlacedItem<TData>>, grid: Pick<MonthGrid, 'start' | 'weeks'>): MonthSegment<TData>[][] {
  const weeks: MonthSegment<TData>[][] = [];
  for (let week = 0; week < grid.weeks; week += 1) {
    const from = grid.start + week * 7;
    const to = from + 6;
    const pieces: Array<{ -readonly [K in keyof MonthSegment<TData>]: MonthSegment<TData>[K] }> = [];
    for (const entry of placed) {
      if (entry.start > to || entry.end < from) continue;
      const first = Math.max(entry.start, from);
      const last = Math.min(entry.end, to);
      pieces.push({ placed: entry, week, col: first - from, span: last - first + 1, lane: 0, before: entry.start < from, after: entry.end > to });
    }
    pieces.sort((a, b) => a.col - b.col || b.span - a.span || a.placed.order - b.placed.order);
    const laneEnds: number[] = [];
    for (const piece of pieces) {
      let lane = laneEnds.findIndex((end) => end < piece.col);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = piece.col + piece.span - 1;
      piece.lane = lane;
    }
    weeks.push(pieces);
  }
  return weeks;
}

/** For each day of a week, how many of its pieces fall in lanes past the `rows` shown. */
export function hiddenPerDay(pieces: ReadonlyArray<MonthSegment<unknown>>, rows: number): number[] {
  const hidden = [0, 0, 0, 0, 0, 0, 0];
  for (const piece of pieces) {
    if (piece.lane < rows) continue;
    for (let col = piece.col; col < piece.col + piece.span; col += 1) hidden[col]! += 1;
  }
  return hidden;
}

/** The items on one day of a week, in their lane order: the "+N more" list. */
export function itemsOnDay<TData>(pieces: ReadonlyArray<MonthSegment<TData>>, col: number): PlacedItem<TData>[] {
  return pieces
    .filter((piece) => piece.col <= col && col < piece.col + piece.span)
    .sort((a, b) => a.lane - b.lane)
    .map((piece) => piece.placed);
}

export interface MonthCalendarWeek<TData> {
  /** The day number of the week's first day. */
  readonly start: number;
  readonly pieces: ReadonlyArray<MonthSegment<TData>>;
  /** The pieces in the lanes shown. */
  readonly shown: ReadonlyArray<MonthSegment<TData>>;
  /** For each day, the pieces not shown: its "+N more". */
  readonly hidden: ReadonlyArray<number>;
}

export interface MonthCalendarLayout<TData> {
  readonly grid: MonthGrid;
  readonly placed: ReadonlyArray<PlacedItem<TData>>;
  readonly weeks: ReadonlyArray<MonthCalendarWeek<TData>>;
}

export interface MonthCalendarLayoutOptions {
  readonly month: CalendarMonth;
  /** 0 Sunday to 6 Saturday. */
  readonly firstDayOfWeek: number;
  /** Rows of items a week shows. */
  readonly rows: number;
  readonly timeZone?: string;
}

/** The whole month: its grid, the items placed, and each week's pieces, the ones shown and each day's "+N more". */
export function layoutMonthCalendar<TData>(items: ReadonlyArray<CgMonthCalendarItem<TData>>, options: MonthCalendarLayoutOptions): MonthCalendarLayout<TData> {
  const grid = monthGrid(options.month, options.firstDayOfWeek);
  const placed = placeItems(items, options.timeZone);
  const weeks = layoutWeeks(placed, grid).map((pieces, week) => ({
    start: grid.start + week * 7,
    pieces,
    shown: pieces.filter((piece) => piece.lane < options.rows),
    hidden: hiddenPerDay(pieces, options.rows),
  }));
  return { grid, placed, weeks };
}

/**
 * The day a key moves the focus to: a day either way along the line (mirrored in right to left), a
 * week up or down, the week's first or last day, a month back or on (the same day, cut to the
 * month's length; a year with Shift). Null when the key is not a move.
 */
export function moveDay(day: number, key: string, rtl: boolean, firstDayOfWeek: number, shift = false): number | null {
  switch (key) {
    case 'ArrowLeft': return day + (rtl ? 1 : -1);
    case 'ArrowRight': return day + (rtl ? -1 : 1);
    case 'ArrowUp': return day - 7;
    case 'ArrowDown': return day + 7;
    case 'Home': return day - ((weekdayOf(day) - firstDayOfWeek + 7) % 7);
    case 'End': return day + 6 - ((weekdayOf(day) - firstDayOfWeek + 7) % 7);
    case 'PageUp':
    case 'PageDown': return civilToDayNumber(addMonths(dayNumberToCivil(day), (key === 'PageUp' ? -1 : 1) * (shift ? 12 : 1)));
    default: return null;
  }
}

/** The days Alt and an arrow key move an item by: a day along the line (mirrored in right to left), a week up or down. */
export function moveStep(key: string, rtl: boolean): number | null {
  switch (key) {
    case 'ArrowLeft': return rtl ? 1 : -1;
    case 'ArrowRight': return rtl ? -1 : 1;
    case 'ArrowUp': return -7;
    case 'ArrowDown': return 7;
    default: return null;
  }
}

/** An item's dates moved by whole days: its start, and its end when it has one, so it keeps its length. */
export function shiftItemDates(item: Pick<CgMonthCalendarItem, 'start' | 'end'>, days: number, timeZone: string | undefined): { start: string; end: string | null } {
  const start = shiftPoint(item.start, days, timeZone) ?? item.start;
  const end = item.end ? shiftPoint(item.end, days, timeZone) ?? item.end : null;
  return { start, end };
}
