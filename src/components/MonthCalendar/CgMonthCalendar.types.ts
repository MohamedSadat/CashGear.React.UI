import type { HTMLAttributes, ReactNode, Ref } from 'react';
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
  /** Describes that button, given the day written in full, as "2 more on Monday 16 November" (its name is the `more` text it shows). */
  moreLabel?: (count: number, date: string) => string;
  /** The name of the list a "+N more" button opens, as "Items on Monday 16 November". */
  dayItems: (date: string) => string;
  /** A day's create button, as "New on Monday 16 November". Needed with `onCreate`. */
  create?: (date: string) => string;
  /** Spoken after a move by drag or keys, as "Budget moved to Monday 16 November". Needed with `onItemMove`. */
  moved?: (item: CgMonthCalendarItem<TData>, date: string) => string;
  /**
   * An item's accessible name, as "Budget, Monday 16 to Wednesday 18 November". Start it with what
   * the item shows (its time, then its title), so a spoken name matches the visible one. Default:
   * the time shown, then the title.
   */
  item?: (item: CgMonthCalendarItem<TData>, info: CgMonthCalendarItemNameInfo) => string;
  /** Read after a movable item's name, as "Alt and the arrow keys move it". */
  moveHint?: string;
  /**
   * Describes the cell holding a week's items, given its first and last day (its description, not
   * its name: the cell is named by the items' titles it shows).
   */
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

/** `programmatic` is a call to the handle's `startCreate`. */
export type CgMonthCalendarCreateSource = 'button' | 'doubleClick' | 'keyboard' | 'programmatic';

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

/** `programmatic` is a call to the handle's `startCreate` on a day of another month. */
export type CgMonthCalendarMonthChangeReason = 'previous' | 'next' | 'today' | 'keyboard' | 'move' | 'programmatic';

export interface CgMonthCalendarMonthChangeDetails {
  readonly reason: CgMonthCalendarMonthChangeReason;
  readonly previousMonth: CgMonthCalendarMonth;
}

/**
 * What moved the selected day: the arrows, Home, End, PageUp or PageDown (`keyboard`); a day, or a
 * control in it, taking focus, as a click does (`focus`); the month buttons (`previous`, `next`,
 * `today`); an item moved with Alt and the arrows (`move`); the handle's `startCreate` (`programmatic`).
 */
export type CgMonthCalendarSelectedDayChangeReason = 'keyboard' | 'focus' | 'previous' | 'next' | 'today' | 'move' | 'programmatic';

export interface CgMonthCalendarSelectedDayChangeDetails {
  readonly reason: CgMonthCalendarSelectedDayChangeReason;
  /** The day selected before (`YYYY-MM-DD`). */
  readonly previousDay: CgDateValue;
}

/**
 * What `actionsRef` gives, for what happens outside the grid: a drag from a list of the caller's own
 * onto a day, or a create started from a toolbar. Dates are `YYYY-MM-DD`; a method given anything
 * else throws a `RangeError`. The day cells' attributes are not part of this contract: use
 * `dayAt` and `getDayElement`.
 */
export interface CgMonthCalendarHandle {
  /**
   * The day whose cell is under a viewport point (a pointer event's `clientX` and `clientY`), a day
   * of the month before or after included; null off the days or outside the visible part of the
   * grid. It reads the layout and draws nothing, so it can be called on every pointer move.
   */
  dayAt(x: number, y: number): CgDateValue | null;
  /**
   * Marks a day as the drop target, as a drag inside the grid marks one (`data-drop` on its cell),
   * or clears the mark with null. Written to the DOM: nothing is drawn again. A day whose week is
   * not shown marks nothing.
   */
  markDropDay(date: CgDateValue | null): void;
  /** The day's cell while its week is shown, else null: an anchor for an editor of the caller's own. */
  getDayElement(date: CgDateValue): HTMLElement | null;
  /**
   * Starts a create on a day: turns to its month when it is not the one shown (`onMonthChange` with
   * `programmatic`), selects and focuses the day, then calls `onCreate` with the source
   * `programmatic` and the day's cell as anchor once the cell is drawn. A controlled `month` the
   * caller does not turn leaves the day unshown, and `onCreate` is not called. Without `onCreate`
   * it only selects and focuses the day.
   */
  startCreate(date: CgDateValue): void;
}

type NativeMonthCalendarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange' | 'dangerouslySetInnerHTML'>;

export interface CgMonthCalendarProps<TData = unknown> extends NativeMonthCalendarProps {
  items: ReadonlyArray<CgMonthCalendarItem<TData>>;
  labels: CgMonthCalendarLabels<TData>;
  /** The month shown (`YYYY-MM`), controlled. */
  month?: CgMonthCalendarMonth;
  /** The first month shown when uncontrolled. Default: the month of `selectedDay` or `defaultSelectedDay` when given, else today's. */
  defaultMonth?: CgMonthCalendarMonth;
  onMonthChange?: (month: CgMonthCalendarMonth, details: CgMonthCalendarMonthChangeDetails) => void;
  /**
   * The selected day (`YYYY-MM-DD`), controlled: the days' one tab stop, marked `aria-selected`.
   * Keyboard moves, clicks and the month buttons report a new one through `onSelectedDayChange`; a
   * move into another month turns the month as before. Setting it does not turn the month: a day
   * whose week is not shown leaves the stop on today in the month shown, else on its first day.
   */
  selectedDay?: CgDateValue;
  /** The first selected day when uncontrolled. Default: today in the month shown, else its first day. */
  defaultSelectedDay?: CgDateValue;
  onSelectedDayChange?: (date: CgDateValue, details: CgMonthCalendarSelectedDayChangeDetails) => void;
  /** Finding and marking days from outside the grid, and starting a create on one. `ref` stays the root element. */
  actionsRef?: Ref<CgMonthCalendarHandle>;
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
   * A day's "+" was pressed, the day was double-clicked, Enter pressed on it, or the handle's
   * `startCreate` called: `date` is `YYYY-MM-DD`, the anchor the day's cell. Without it, days have
   * no create button.
   */
  onCreate?: (date: CgDateValue, details: CgMonthCalendarCreateDetails) => void;
  /**
   * An item was dropped on another day, or moved with Alt and the arrow keys (a day either way, a
   * week up or down). One call per move; the caller writes the new dates. Without it, nothing moves.
   */
  onItemMove?: (item: CgMonthCalendarItem<TData>, details: CgMonthCalendarMoveDetails) => void;
}
