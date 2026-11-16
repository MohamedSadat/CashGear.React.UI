import type { HTMLAttributes, ReactNode } from 'react';
import type { CgDateValue, CgDayOfWeek } from '../../types/date';

/** A month as `YYYY-MM`, such as `2026-11`. */
export type CgMonthCalendarMonth = string;

export interface CgMonthCalendarItem<TData = unknown> {
  /** Unique among the items. */
  key: string;
  /** The item's text, drawn as it is (`dir="auto"`). */
  title: string;
  /**
   * The first day: a date (`YYYY-MM-DD`), a date and time with no zone (`2026-11-03T10:30`, read on
   * the calendar's clock), or an instant (`2026-11-03T07:30:00Z`, `…+03:00`), placed on its day in
   * `timeZone`. An item whose start cannot be read is not drawn.
   */
  start: string;
  /**
   * The last day, inclusive, in the same forms. Missing, empty, unreadable or before the start: the
   * item takes one day (a zero-length item is one day too).
   */
  end?: string | null;
  /** A CSS colour: the default drawing tints the bar with it and marks its start. */
  color?: string;
  /** `false` keeps the item where it is: no drag, no Alt and arrow keys. Default true. */
  movable?: boolean;
  data?: TData;
}

/** What `labels.item` is given to name an item: its dates and time as the calendar writes them. */
export interface CgMonthCalendarItemNameInfo {
  /** The title as drawn: `labels.untitled` for a blank one. */
  readonly title: string;
  /** The first day, written in full. */
  readonly start: string;
  /** The last day written in full, or null for a one-day item. */
  readonly end: string | null;
  /** The start time for an item with one, else null. */
  readonly time: string | null;
}

export interface CgMonthCalendarLabels<TData = unknown> {
  /** The grid's accessible name, as "Tasks calendar". */
  grid: string;
  /** The previous-month button's name. */
  previousMonth: string;
  /** The next-month button's name. */
  nextMonth: string;
  /** The button that shows today's month. */
  today: string;
  /** The text of a full day's button, as "+2 more". */
  more: (count: number) => string;
  /** That button's accessible name, given the day written in full, as "2 more on Monday 16 November". Default: `more`. */
  moreLabel?: (count: number, date: string) => string;
  /** The name of the list a "+N more" button opens, as "Items on Monday 16 November". */
  dayItems: (date: string) => string;
  /** A day's create button, as "New on Monday 16 November". Needed with `onCreate`. */
  create?: (date: string) => string;
  /** Spoken after a move by drag or keys, as "Budget moved to Monday 16 November". Needed with `onItemMove`. */
  moved?: (item: CgMonthCalendarItem<TData>, date: string) => string;
  /** An item's accessible name, as "Budget, Monday 16 to Wednesday 18 November". Default: its title. */
  item?: (item: CgMonthCalendarItem<TData>, info: CgMonthCalendarItemNameInfo) => string;
  /** Read after a movable item's name, as "Alt and the arrow keys move it". */
  moveHint?: string;
  /** The name of the cell holding a week's items, given its first and last day. */
  weekItems?: (start: string, end: string) => string;
  /** Drawn and read for an item whose title is blank. */
  untitled?: string;
}

export interface CgMonthCalendarItemRenderContext {
  /** The start time as the calendar writes it, for an item with a time; else null. */
  readonly time: string | null;
  /** This piece began in an earlier week, or goes on into a later one. */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
  /** The days this piece covers in its week, 1 to 7. */
  readonly span: number;
  /** `bar` in the grid, `list` in a day's "+N more" list. */
  readonly placement: 'bar' | 'list';
}

export type CgMonthCalendarOpenSource = 'pointer' | 'keyboard' | 'list';

export interface CgMonthCalendarOpenDetails {
  readonly source: CgMonthCalendarOpenSource;
  /** The bar that was activated, or the day whose list it was chosen from. */
  readonly anchor: HTMLElement;
}

export type CgMonthCalendarCreateSource = 'button' | 'doubleClick' | 'keyboard';

export interface CgMonthCalendarCreateDetails {
  readonly source: CgMonthCalendarCreateSource;
  /** The day's cell, to place an editor of the caller's own by. */
  readonly anchor: HTMLElement;
}

export interface CgMonthCalendarMoveDetails {
  /** The new start, in the form the item's start had (an instant keeps its time of day in `timeZone`). */
  readonly start: string;
  /** The end moved by the same days, or null when the item has none. */
  readonly end: string | null;
  /** Whole days moved: negative is earlier. */
  readonly days: number;
  readonly source: 'pointer' | 'keyboard';
}

export type CgMonthCalendarMonthChangeReason = 'previous' | 'next' | 'today' | 'keyboard' | 'move';

export interface CgMonthCalendarMonthChangeDetails {
  readonly reason: CgMonthCalendarMonthChangeReason;
  readonly previousMonth: CgMonthCalendarMonth;
}

type NativeMonthCalendarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange' | 'dangerouslySetInnerHTML'>;

export interface CgMonthCalendarProps<TData = unknown> extends NativeMonthCalendarProps {
  items: ReadonlyArray<CgMonthCalendarItem<TData>>;
  labels: CgMonthCalendarLabels<TData>;
  /** The month shown (`YYYY-MM`), controlled. */
  month?: CgMonthCalendarMonth;
  /** The first month shown when uncontrolled. Default: today's. */
  defaultMonth?: CgMonthCalendarMonth;
  onMonthChange?: (month: CgMonthCalendarMonth, details: CgMonthCalendarMonthChangeDetails) => void;
  /** Month and weekday names, day numbers and times. Default: the browser's. */
  locale?: string;
  /** Default: the locale's (Saturday in most Arabic regions, Sunday in the United States). */
  firstDayOfWeek?: CgDayOfWeek;
  /** The day marked as today (`YYYY-MM-DD`). Default: today in `timeZone`. */
  today?: CgDateValue;
  /** The IANA zone instants are placed and moved in. Default: the browser's. */
  timeZone?: string;
  /** Rows of items a week shows before a day's "+N more". Default 3. */
  maxItemRows?: number;
  /** An item's content inside its bar (and in a day's list). Default: its time and title. */
  renderItem?: (item: CgMonthCalendarItem<TData>, context: CgMonthCalendarItemRenderContext) => ReactNode;
  /** An item was clicked, or Enter or Space pressed on it, or it was chosen from a day's list. */
  onItemOpen?: (item: CgMonthCalendarItem<TData>, details: CgMonthCalendarOpenDetails) => void;
  /**
   * A day's "+" was pressed, the day was double-clicked, or Enter pressed on it: `date` is
   * `YYYY-MM-DD`. Without it, days have no create button.
   */
  onCreate?: (date: CgDateValue, details: CgMonthCalendarCreateDetails) => void;
  /**
   * An item was dropped on another day, or moved with Alt and the arrow keys (a day either way, a
   * week up or down). One call per move; the caller writes the new dates. Without it, nothing moves.
   */
  onItemMove?: (item: CgMonthCalendarItem<TData>, details: CgMonthCalendarMoveDetails) => void;
}
