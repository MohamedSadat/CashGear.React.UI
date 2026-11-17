// The timeline's lines and moves, pure and tested on its own: one line per item whose start can be
// read, in the caller's order, under a header line per lane (the items of a lane not listed under a
// last one); where an item's bar falls (its first and last day, read only for the lines drawn, since
// placing an instant in a time zone is the costly part); an item's dates after a move or a change
// to its start or end, in the forms they were written; and the keys that move between lines and
// change a bar.
import { readPoint, shiftPoint } from '../MonthCalendar/monthCalendarDates';
import type { CgTimelineEdge, CgTimelineItem, CgTimelineLane } from './CgTimeline.types';

export interface TimelineLaneLine {
  readonly kind: 'lane';
  readonly id: string;
  /** The lane's key, or null for the last lane of unlisted items. */
  readonly lane: string | null;
  readonly title: string;
  /** Items under it, collapsed or not. */
  readonly count: number;
  readonly collapsed: boolean;
}

export interface TimelineItemLine<TData> {
  readonly kind: 'item';
  readonly id: string;
  readonly item: CgTimelineItem<TData>;
  /** The lane it is drawn under: its key, null for the last lane or without lanes. */
  readonly lane: string | null;
  /** That lane's title, or null without lanes. */
  readonly laneTitle: string | null;
}

export type TimelineLine<TData> = TimelineLaneLine | TimelineItemLine<TData>;

export interface TimelineLines<TData> {
  readonly lines: ReadonlyArray<TimelineLine<TData>>;
  /** A line's place by its id. */
  readonly index: ReadonlyMap<string, number>;
  /** Lines are grouped under lanes. */
  readonly grouped: boolean;
}

export const itemLineId = (key: string): string => `i:${key}`;
export const laneLineId = (lane: string | null): string => (lane === null ? 'n' : `l:${lane}`);

/** Whether a start or end can be read: only its form is checked, not where it falls in a time zone. */
export const readable = (value: unknown): value is string => typeof value === 'string' && shiftPoint(value, 0, undefined) !== null;

/**
 * The lines: an item's for each one whose start can be read, in the order given, under a header
 * line per lane in order, the items of a lane not listed (or of none) under a last one titled
 * `noLane`. A collapsed lane keeps its header and hides its items. Keys must be unique and nonempty.
 */
export function buildLines<TData>(
  items: ReadonlyArray<CgTimelineItem<TData>>,
  lanes: ReadonlyArray<CgTimelineLane> | undefined,
  collapsed: ReadonlySet<string | null>,
  noLane: string | undefined,
): TimelineLines<TData> {
  const keys = new Set<string>();
  const shown: CgTimelineItem<TData>[] = [];
  for (const item of items) {
    if (!item.key) throw new Error('CgTimeline items require a nonempty key.');
    if (keys.has(item.key)) throw new Error(`CgTimeline contains duplicate key '${item.key}'.`);
    keys.add(item.key);
    if (readable(item.start)) shown.push(item);
  }
  const lines: TimelineLine<TData>[] = [];
  const index = new Map<string, number>();
  const add = (line: TimelineLine<TData>) => {
    index.set(line.id, lines.length);
    lines.push(line);
  };
  if (!lanes) {
    for (const item of shown) add({ kind: 'item', id: itemLineId(item.key), item, lane: null, laneTitle: null });
    return { lines, index, grouped: false };
  }
  const groups = new Map<string, CgTimelineItem<TData>[]>();
  for (const lane of lanes) {
    if (!lane.key) throw new Error('CgTimeline lanes require a nonempty key.');
    if (groups.has(lane.key)) throw new Error(`CgTimeline contains duplicate lane '${lane.key}'.`);
    groups.set(lane.key, []);
  }
  const rest: CgTimelineItem<TData>[] = [];
  for (const item of shown) {
    const group = item.lane === undefined || item.lane === null ? undefined : groups.get(item.lane);
    (group ?? rest).push(item);
  }
  const addLane = (lane: string | null, title: string, members: ReadonlyArray<CgTimelineItem<TData>>) => {
    const folded = collapsed.has(lane);
    add({ kind: 'lane', id: laneLineId(lane), lane, title, count: members.length, collapsed: folded });
    if (!folded) for (const item of members) add({ kind: 'item', id: itemLineId(item.key), item, lane, laneTitle: title });
  };
  for (const lane of lanes) addLane(lane.key, lane.title, groups.get(lane.key)!);
  if (rest.length) {
    if (typeof noLane !== 'string' || !noLane.trim()) throw new Error('CgTimeline labels.noLane is required when items are in no listed lane.');
    addLane(null, noLane, rest);
  }
  return { lines, index, grouped: true };
}

// ---- Where a bar falls --------------------------------------------------------------------------

/** An item's first and last day on the timeline. */
export interface TimelineSpan {
  readonly start: number;
  readonly end: number;
}

/** Where an item falls in `timeZone`: an end missing, unreadable or before the start makes it one day. Null when its start cannot be read. */
export function placeItem(item: Pick<CgTimelineItem, 'start' | 'end'>, timeZone: string | undefined): TimelineSpan | null {
  const start = readPoint(item.start, timeZone);
  if (!start) return null;
  const end = item.end ? readPoint(item.end, timeZone) : null;
  return { start: start.day, end: end && end.day > start.day ? end.day : start.day };
}

/**
 * Items placed once each, when their lines are first drawn, for one time zone. Kept by the item
 * object: a changed item is a new object (the caller's list is not changed in place), so it is
 * placed again, and items no longer given are let go.
 */
export class TimelinePlacements {
  private readonly spans = new WeakMap<CgTimelineItem<unknown>, TimelineSpan | null>();
  private readonly timeZone: string | undefined;

  constructor(timeZone: string | undefined) {
    this.timeZone = timeZone;
  }

  get(item: CgTimelineItem<unknown>): TimelineSpan | null {
    let span = this.spans.get(item);
    if (span === undefined) {
      span = placeItem(item, this.timeZone);
      this.spans.set(item, span);
    }
    return span;
  }
}

// ---- Changes ------------------------------------------------------------------------------------

export interface TimelineChange {
  readonly start: string;
  readonly end: string | null;
  /** The days the changed part moved, after keeping a start on or before its end. */
  readonly days: number;
  /** Where the item falls after the change. */
  readonly span: TimelineSpan;
}

/** The days a change can take: a start never passes its end, nor an end its start. */
export function clampChange(span: TimelineSpan, edge: CgTimelineEdge, days: number): number {
  if (edge === 'start') return Math.min(days, span.end - span.start);
  if (edge === 'end') return Math.max(days, span.start - span.end);
  return days;
}

/**
 * An item's dates after moving all of it, its start or its end by whole days, in the forms they
 * were written (an instant keeps its time of day in `timeZone`): a move shifts an end by the same
 * days and keeps a missing one missing; a start moved earlier on a one-day item without a real end
 * writes its old start as the end; a changed end of an item without a real end is its start moved.
 * Null when the change is no change.
 */
export function changeItemDates(
  item: Pick<CgTimelineItem, 'start' | 'end'>,
  span: TimelineSpan,
  edge: CgTimelineEdge,
  requested: number,
  timeZone: string | undefined,
): TimelineChange | null {
  const days = clampChange(span, edge, requested);
  if (!days) return null;
  if (edge === 'move') {
    return {
      start: shiftPoint(item.start, days, timeZone) ?? item.start,
      end: item.end ? shiftPoint(item.end, days, timeZone) ?? item.end : null,
      days,
      span: { start: span.start + days, end: span.end + days },
    };
  }
  // An end counts when it can be read and is not before the start; else the item has none of its own.
  const ownEnd = item.end ? readPoint(item.end, timeZone) : null;
  const end = ownEnd && ownEnd.day >= span.start ? item.end! : null;
  if (edge === 'start') {
    return { start: shiftPoint(item.start, days, timeZone) ?? item.start, end: end ?? item.start, days, span: { start: span.start + days, end: span.end } };
  }
  return { start: item.start, end: shiftPoint(end ?? item.start, days, timeZone) ?? end ?? item.start, days, span: { start: span.start, end: span.end + days } };
}

// ---- Keys ---------------------------------------------------------------------------------------

export interface KeyChord {
  readonly key: string;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/**
 * What a key changes on a focused bar, a day along the line (mirrored in right to left, where time
 * runs from right to left): Alt and an arrow moves it, Alt+Shift its end, Ctrl+Shift (or Cmd+Shift)
 * its start. Never Ctrl with Alt, which is AltGr. Null when the key changes nothing.
 */
export function keyChange(chord: KeyChord, rtl: boolean): { edge: CgTimelineEdge; days: number } | null {
  if (chord.key !== 'ArrowLeft' && chord.key !== 'ArrowRight') return null;
  const days = (chord.key === 'ArrowRight') !== rtl ? 1 : -1;
  const command = chord.ctrlKey || chord.metaKey;
  if (chord.altKey && !command) return { edge: chord.shiftKey ? 'end' : 'move', days };
  if (command && chord.shiftKey && !chord.altKey) return { edge: 'start', days };
  return null;
}

/** The line a key moves the focus to: one up or down, a page, the first or last. Null when the key is not one of them. */
export function lineStep(key: string, current: number, count: number, page: number): number | null {
  let next: number;
  switch (key) {
    case 'ArrowUp': next = current - 1; break;
    case 'ArrowDown': next = current + 1; break;
    case 'PageUp': next = current - Math.max(1, page); break;
    case 'PageDown': next = current + Math.max(1, page); break;
    case 'Home': next = 0; break;
    case 'End': next = count - 1; break;
    default: return null;
  }
  return Math.max(0, Math.min(count - 1, next));
}
