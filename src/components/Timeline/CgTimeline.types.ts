import type { HTMLAttributes, ReactNode, Ref } from 'react';
import type { CgDateValue, CgDayOfWeek } from '../../types/date';

/** How much time a day's width shows: the header's tiers follow it (months over days, months over weeks, years over months, years over quarters). */
export type CgTimelineScale = 'day' | 'week' | 'month' | 'quarter';

export interface CgTimelineItem<TData = unknown> {
  /** Unique among the items. */
  key: string;
  /** The item's text, drawn as it is (`dir="auto"`) inside its bar, or just after it when the bar is too short. */
  title: string;
  /**
   * The first day: a date (`YYYY-MM-DD`), a date and time with no zone (`2026-11-03T10:30`, read on
   * the timeline's clock), or an instant (`2026-11-03T07:30:00Z`, `…+03:00`), placed on its day in
   * `timeZone`. An item whose start cannot be read is not drawn and takes no line: list such items
   * beside the timeline.
   */
  start: string;
  /** The last day, inclusive, in the same forms. Missing, empty, unreadable or before the start: the item takes one day. */
  end?: string | null;
  /** The key of the lane it is grouped under, with `lanes`. An item whose lane is not listed goes under the last lane, `labels.noLane`. */
  lane?: string | null;
  /** A CSS colour: the default drawing tints the bar with it. */
  color?: string;
  /** `false` keeps the item where it is: no dragging its body and no Alt and arrow keys. Default true. */
  movable?: boolean;
  /** `false` keeps its length: no resize edges and no keys that change its start or end. Default true. */
  resizable?: boolean;
  data?: TData;
}

/** A group of lines under a header line that can be collapsed. */
export interface CgTimelineLane {
  /** Unique among the lanes; items name it in `lane`. */
  key: string;
  /** The header's text, drawn as it is (`dir="auto"`). */
  title: string;
}

/**
 * A link between two items, for dependencies: `from` blocks `to`. It is drawn as an arrow from the
 * end of `from`'s bar to the start of `to`'s, and named in both bars' descriptions. Display only.
 */
export interface CgTimelineLink {
  /** Unique among the links. */
  readonly id: string;
  /** The key of the item that blocks. */
  readonly from: string;
  /** The key of the item it blocks. */
  readonly to: string;
}

/** Which side of its links a bar's description is naming: what blocks it, or what it blocks. */
export type CgTimelineLinkSide = 'blockedBy' | 'blocking';

/** What `labels.item` is given to name an item: its dates as the timeline writes them. */
export interface CgTimelineItemNameInfo {
  /** The title as drawn: `labels.untitled` for a blank one. */
  readonly title: string;
  /** The first day, written in full. */
  readonly start: string;
  /** The last day written in full, or null for a one-day item. */
  readonly end: string | null;
  /** The days it covers, 1 or more. */
  readonly days: number;
  /** The title of the lane it is drawn under, or null without lanes. */
  readonly lane: string | null;
}

/** Which part of an item changed: all of it (`move`), its first day (`start`) or its last day (`end`). */
export type CgTimelineEdge = 'move' | 'start' | 'end';

export type CgTimelineMoveSource = 'pointer' | 'keyboard';

/** What `labels.moved` and `labels.resized` are given: the item's new days as the timeline writes them. */
export interface CgTimelineChangeInfo {
  /** The new first day, written in full. */
  readonly start: string;
  /** The new last day written in full, or null when it is now one day. */
  readonly end: string | null;
  /** The days it now covers. */
  readonly length: number;
  /** Whole days the changed part moved: negative is earlier. */
  readonly days: number;
  readonly edge: CgTimelineEdge;
}

/** What `labels.movedLane` is given: the item's new days and the lane it is now under. `days` is 0 when only its lane changed. */
export interface CgTimelineLaneChangeInfo extends CgTimelineChangeInfo {
  /** The title of the lane it is now under, as drawn: `labels.noLane` for the last lane. */
  readonly lane: string;
  /** That lane's key, or null for the last lane of unlisted items. */
  readonly laneKey: string | null;
}

export interface CgTimelineLabels<TData = unknown> {
  /** The grid's accessible name, as "Tasks timeline". */
  grid: string;
  /** The button that shows earlier days. */
  previous: string;
  /** The button that shows later days. */
  next: string;
  /** The button that shows today. */
  today: string;
  /** The names of the scales, shown as buttons that switch between them. Without it there are no scale buttons. */
  scales?: Readonly<Record<CgTimelineScale, string>>;
  /** The name of the group of scale buttons, as "Zoom". Needed with `scales`. */
  scale?: string;
  /**
   * An item's accessible name, as "Budget, Monday 16 to Wednesday 18 November". Start it with what
   * the bar shows (its title), so a spoken name matches the visible one. Default: the title, then
   * the days it covers.
   */
  item?: (item: CgTimelineItem<TData>, info: CgTimelineItemNameInfo) => string;
  /**
   * Read after a movable item's name, as "Alt and the arrow keys move it; add Shift to change its
   * end, or Ctrl and Shift its start". With `moveBetweenLanes`, name the lane keys too, as "…; Alt
   * with ArrowUp or ArrowDown moves it to the lane above or below".
   */
  moveHint?: string;
  /** Spoken after a move by drag or keys, as "Budget moved to Monday 16 November". Needed with `onItemMove`. */
  moved?: (item: CgTimelineItem<TData>, info: CgTimelineChangeInfo) => string;
  /** Spoken after a start or an end changed by drag or keys, as "Budget now ends Friday 20 November". Needed with `onItemMove`. */
  resized?: (item: CgTimelineItem<TData>, info: CgTimelineChangeInfo) => string;
  /**
   * Spoken after a move to another lane by drag or keys, its days changed or not, as "Budget moved
   * to Review, Monday 16 November". Needed with `moveBetweenLanes` and `onItemMove`.
   */
  movedLane?: (item: CgTimelineItem<TData>, info: CgTimelineLaneChangeInfo) => string;
  /** The title of the last lane, holding the items whose lane is not listed. Needed with `lanes` when such items exist. */
  noLane?: string;
  /** Drawn and read for an item whose title is blank. */
  untitled?: string;
  /**
   * A lane's collapse button's name, given its title as drawn, how many items it holds and its key
   * (null for the last lane); start it with the title. Default: the title. The button says whether
   * it is expanded (`aria-expanded`).
   */
  lane?: (title: string, count: number, lane: string | null) => string;
  /** A quarter's header text, given its number (1 to 4) and its year as the header writes it. Default: its months, as "Jan – Mar". */
  quarter?: (quarter: number, year: string) => string;
  /**
   * With `links`, read in the description of a bar something blocks: the blockers' titles in a list
   * in the locale ("Design and Budget") and the items, as "Blocked by Design and Budget". Needed with `links`.
   */
  blockedBy?: (titles: string, items: ReadonlyArray<CgTimelineItem<TData>>) => string;
  /** With `links`, read in the description of a bar that blocks others, as "Blocking Launch". Needed with `links`. */
  blocking?: (titles: string, items: ReadonlyArray<CgTimelineItem<TData>>) => string;
  /**
   * With `links`, read after them for the links in conflict, where the blocked item starts on or
   * before the blocker's last day: the other items' titles and the side this bar is on, as "Starts
   * before Design ends" (`blockedBy`) or "Launch starts before this ends" (`blocking`). Such a link
   * is drawn dashed in the danger colour. Needed with `links`.
   */
  conflict?: (titles: string, side: CgTimelineLinkSide, items: ReadonlyArray<CgTimelineItem<TData>>) => string;
}

export interface CgTimelineItemRenderContext {
  /** The days the bar covers. */
  readonly days: number;
  /** The bar is too short for its title, which is drawn just after it. */
  readonly outside: boolean;
}

export type CgTimelineOpenSource = 'pointer' | 'keyboard';

export interface CgTimelineOpenDetails {
  readonly source: CgTimelineOpenSource;
  /** The bar that was activated. */
  readonly anchor: HTMLElement;
}

export type CgTimelineCreateSource = 'doubleClick' | 'keyboard';

export interface CgTimelineCreateDetails {
  readonly source: CgTimelineCreateSource;
  /** A box over the day on its line (a double click), or the focused line (keys): to place an editor of the caller's own by. */
  readonly anchor: HTMLElement;
}

export interface CgTimelineMoveDetails {
  /** The new start, in the form the item's start had (an instant keeps its time of day in `timeZone`). */
  readonly start: string;
  /**
   * The new end. A move shifts the end by the same days, or keeps it null when the item has none; a
   * changed end, or a start moved earlier on an item with none, is written in the form of the end
   * (or of the start when it had no end).
   */
  readonly end: string | null;
  /** Whole days the changed part moved: negative is earlier, 0 when only its lane changed. */
  readonly days: number;
  readonly edge: CgTimelineEdge;
  readonly source: CgTimelineMoveSource;
  /**
   * With `moveBetweenLanes`, the lane it was moved to, in the same call as its dates: a lane's key,
   * or null for the last lane of unlisted items. Absent when its lane did not change.
   */
  readonly lane?: string | null;
}

/** The days shown, inclusive (`YYYY-MM-DD`): the caller fetches the items in a window around them. */
export interface CgTimelineRange {
  readonly from: CgDateValue;
  readonly to: CgDateValue;
}

export interface CgTimelineScaleChangeDetails {
  readonly previousScale: CgTimelineScale;
}

/** The lane of a line found by `laneAt`: its key, or null for the last lane of unlisted items. */
export interface CgTimelineLaneHit {
  readonly lane: string | null;
}

/**
 * What `actionsRef` gives, for what happens outside the grid: a drag from a list of the caller's own
 * onto a day, a toolbar of its own, or revealing an item. Dates are `YYYY-MM-DD`; a method given
 * anything else throws a `RangeError`. The DOM's attributes are not part of this contract.
 */
export interface CgTimelineHandle {
  /**
   * The day under a viewport point (a pointer event's `clientX` and `clientY`) in the shown part of
   * the lines, or null off them (the header included). It reads the layout and draws nothing, so it
   * can be called on every pointer move.
   */
  dateAt(x: number, y: number): CgDateValue | null;
  /** The lane of the line under a viewport point; null off the lines, or when the timeline has no lanes. */
  laneAt(x: number, y: number): CgTimelineLaneHit | null;
  /** Marks a day's column as the drop target, or clears the mark with null. Written to the DOM: nothing is drawn again. */
  markDropDate(date: CgDateValue | null): void;
  /** Scrolls so that the day is the first one shown (the timeline grows to reach it). */
  scrollToDate(date: CgDateValue): void;
  /** Scrolls an item's line into view and its bar's start into the days shown. False when no line holds it. */
  scrollToItem(key: string): boolean;
  /** The item's bar while its line is drawn, else null: an anchor for an editor of the caller's own. */
  getItemElement(key: string): HTMLElement | null;
}

type NativeTimelineProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange' | 'dangerouslySetInnerHTML'>;

export interface CgTimelineProps<TData = unknown> extends NativeTimelineProps {
  /** One line each, in the order given (the caller sorts), under their lanes when `lanes` is given. */
  items: ReadonlyArray<CgTimelineItem<TData>>;
  labels: CgTimelineLabels<TData>;
  /** Groups of lines, in order, each under a header line; items whose lane is not listed go under a last one, `labels.noLane`. */
  lanes?: ReadonlyArray<CgTimelineLane>;
  /** The collapsed lanes' keys (null is the last lane of unlisted items), controlled. */
  collapsedLanes?: ReadonlyArray<string | null>;
  /** The lanes collapsed at first when uncontrolled. Default none. */
  defaultCollapsedLanes?: ReadonlyArray<string | null>;
  /** A lane's button was pressed: the collapsed lanes after it. */
  onCollapsedLanesChange?: (collapsed: ReadonlyArray<string | null>) => void;
  /** The scale, controlled. */
  scale?: CgTimelineScale;
  /** The first scale when uncontrolled. Default `week`. */
  defaultScale?: CgTimelineScale;
  /** A scale button was pressed. The day in the middle of the view stays there. */
  onScaleChange?: (scale: CgTimelineScale, details: CgTimelineScaleChangeDetails) => void;
  /** The scales offered as buttons, with `labels.scales`. Default all four. */
  scales?: ReadonlyArray<CgTimelineScale>;
  /** Pixels a day takes at each scale. Default `{ day: 48, week: 20, month: 5, quarter: 2 }`. */
  dayWidths?: Partial<Readonly<Record<CgTimelineScale, number>>>;
  /**
   * The first day shown (`YYYY-MM-DD`). The timeline scrolls there at first and whenever it
   * changes; scrolling does not change it back (`onRangeChange` reports what is shown).
   */
  startDate?: CgDateValue;
  /** The first day shown at first when `startDate` is not given. Default: a little before today. */
  defaultStartDate?: CgDateValue;
  /** The days shown changed, by scrolling, a scale or a resize: called once they settle, and once at first. */
  onRangeChange?: (range: CgTimelineRange) => void;
  /** Milliseconds the days shown stay still before `onRangeChange`. Default 150. */
  rangeChangeDelay?: number;
  /** Pixels a line takes, the same for every line so only the lines in view are drawn. Default 36, at least 24. */
  lineHeight?: number;
  /** Lines drawn past each edge of the view. Default 6. */
  overscan?: number;
  /** The timeline's block size: a CSS length, or pixels. Default `28rem`; `100%` fills a parent with a height. */
  height?: number | string;
  /** Draws the previous, today, next and scale buttons above the lines. Default true; without them use `actionsRef`. */
  showToolbar?: boolean;
  /** Month and weekday names, day numbers and the dates in names. Default: the browser's. */
  locale?: string;
  /** Where weeks start, at the week scale. Default: the locale's (Saturday in most Arabic regions, Sunday in the United States). */
  firstDayOfWeek?: CgDayOfWeek;
  /** The day marked as today (`YYYY-MM-DD`). Default: today in `timeZone`. */
  today?: CgDateValue;
  /** The IANA zone instants are placed and moved in. Default: the browser's. */
  timeZone?: string;
  /** An item's content inside its bar (or after it when the bar is too short). Default: its title. */
  renderItem?: (item: CgTimelineItem<TData>, context: CgTimelineItemRenderContext) => ReactNode;
  /** An item's bar was clicked, or Enter or Space pressed on it. */
  onItemOpen?: (item: CgTimelineItem<TData>, details: CgTimelineOpenDetails) => void;
  /**
   * An empty spot of a line was double-clicked (that day, in that line's lane), or Shift+Enter
   * pressed on a line (today when shown, else the first day shown). `lane` is the line's lane key,
   * null for the last lane or without lanes.
   */
  onCreate?: (date: CgDateValue, lane: string | null, details: CgTimelineCreateDetails) => void;
  /**
   * An item was dragged by its body (`move`) or an edge (`start`, `end`), whole days at a time, or
   * moved with the keys on its focused bar, mirrored in right to left:
   * Alt+ArrowLeft and Alt+ArrowRight move it a day; Alt+Shift with them moves its end; Ctrl+Shift
   * (Cmd+Shift on a Mac) with them moves its start. None of them is Ctrl+Alt, which is AltGr. A start
   * never passes its end. With `moveBetweenLanes`, a move can also change its lane (`details.lane`).
   * One call per change; the caller writes the new dates (and lane). Without it, nothing moves.
   */
  onItemMove?: (item: CgTimelineItem<TData>, details: CgTimelineMoveDetails) => void;
  /**
   * With `lanes` and `onItemMove`, a movable item can change lane: its body dragged over another
   * lane's lines (or its header line, collapsed or not) while it moves by whole days as before, the
   * lane it would drop in marked, dragging near the top or bottom edge scrolling the lines and
   * Escape cancelling; or Alt+ArrowUp and Alt+ArrowDown on its focused bar, the lane above or below
   * in the order drawn, never mirrored. `onItemMove` is called once with the new dates and
   * `details.lane`; the focus follows the bar to its new line once the caller has moved it there (to
   * the lane's header when that lane is collapsed). The last lane of unlisted items means no lane
   * (null). Needs `labels.movedLane`. Default false.
   */
  moveBetweenLanes?: boolean;
  /**
   * Dependencies: an arrow from each link's `from` bar's end to its `to` bar's start, right-angled,
   * routed round the bars between, mirrored in right to left, dashed in the danger colour when `to`
   * starts on or before `from`'s last day. Drawn for the bars in view (an arrow to a bar out of view
   * runs to the drawing's edge; one to an item in a collapsed lane, to that lane's header line), and
   * following a bar while it is dragged, resized or moved to another lane. Each bar's description
   * names what blocks it and what it blocks (`labels.blockedBy`, `labels.blocking`, `labels.conflict`).
   * Links are not focus stops and cannot be drawn by pointer; a link naming an item not given is left out.
   */
  links?: ReadonlyArray<CgTimelineLink>;
  /** Finding and marking days from outside the grid, scrolling, and an item's bar. `ref` stays the root element. */
  actionsRef?: Ref<CgTimelineHandle>;
}
