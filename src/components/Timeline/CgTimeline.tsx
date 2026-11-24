import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ForwardedRef, KeyboardEvent, MouseEvent, PointerEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useCgId, useControllableState, useDebouncedCallback, useMergedRefs, useStableCallback } from '../../hooks';
import { dayOfWeekIndex, localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { cgStartsDrag, cgTrackDrag } from '../DragDrop';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import { dateOfDay, dayOfDate, todayIn } from '../MonthCalendar/monthCalendarDates';
import styles from './CgTimeline.module.css';
import type {
  CgTimelineEdge,
  CgTimelineHandle,
  CgTimelineItem,
  CgTimelineLabels,
  CgTimelineLink,
  CgTimelineMoveSource,
  CgTimelineProps,
  CgTimelineScale,
} from './CgTimeline.types';
import { DEFAULT_DAY_WIDTHS, REACH_DAYS, SCALE_TIERS, TIMELINE_SCALES, axisUnits, shownDays, timelineFormats } from './timelineDates';
import {
  TimelinePlacements, buildLines, changeItemDates, clampChange, drawnLane, itemLineId, keyChange, laneBeside, laneKeyStep, laneLineId, laneMoveDates, laneRange,
  lineStep, lineUnder,
} from './timelineLayout';
import type { TimelineItemLine, TimelineLine, TimelineSpan } from './timelineLayout';
import { arrowPath, indexLinks, routeLink, routePath } from './timelineLinks';
import type { LinkEnd } from './timelineLinks';

/** The header's two tiers, in pixels. */
const HEADER = 56;
/** The narrowest a bar is drawn, so a one-day item at a wide scale can still be seen and pressed. */
const MIN_BAR = 8;
/** A resize edge's width; a bar narrower than three of them has its edges outside it. */
const EDGE = 10;
/** Lines are drawn in steps of this many, so scrolling draws again only now and then. */
const LINE_STEP = 8;
/** Sizes used before the scroller has been measured (and where nothing is laid out, as in tests). */
const FALLBACK_WIDTH = 960;
/** The widest view drawn for: no screen is wider, and it bounds the header's units however the timeline is laid out. */
const MAX_WIDTH = 8192;
const FALLBACK_HEIGHT = 448;
const NO_LANES: ReadonlyArray<string | null> = Object.freeze([]);
const MODIFIERS: ReadonlySet<string> = new Set(['Alt', 'AltGraph', 'Control', 'Meta', 'Shift', 'OS']);

const knownZones = new Set<string>();
function assertTimeZone(timeZone: string | undefined): void {
  if (timeZone === undefined || knownZones.has(timeZone)) return;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new RangeError(`CgTimeline timeZone '${timeZone}' is not a time zone this browser knows.`);
  }
  knownZones.add(timeZone);
}

/** A date given to the timeline as a day number; a `RangeError` naming `what` when it is not a `YYYY-MM-DD` date. */
function dayOfValue(value: string, what: string): number {
  const day = typeof value === 'string' ? dayOfDate(value) : null;
  if (day === null) throw new RangeError(`CgTimeline ${what} '${String(value)}' is not a YYYY-MM-DD date.`);
  return day;
}

const filled = (value: unknown): boolean => typeof value === 'string' && value.trim() !== '';

function assertLabels<TData>(labels: CgTimelineLabels<TData>, toolbar: boolean, moves: boolean, laneMoves: boolean, scales: ReadonlyArray<CgTimelineScale>, links: boolean): void {
  if (!filled(labels.grid)) throw new Error('CgTimeline labels.grid cannot be empty.');
  if (toolbar) {
    for (const name of ['previous', 'next', 'today'] as const) if (!filled(labels[name])) throw new Error(`CgTimeline labels.${name} cannot be empty.`);
    if (labels.scales) {
      if (!filled(labels.scale)) throw new Error('CgTimeline labels.scale is required with labels.scales.');
      for (const scale of scales) if (!filled(labels.scales[scale])) throw new Error(`CgTimeline labels.scales.${scale} cannot be empty.`);
    }
  }
  if (moves && (typeof labels.moved !== 'function' || typeof labels.resized !== 'function')) throw new Error('CgTimeline labels.moved and labels.resized are required with onItemMove.');
  if (moves && laneMoves && typeof labels.movedLane !== 'function') throw new Error('CgTimeline labels.movedLane is required with moveBetweenLanes and onItemMove.');
  if (links && (typeof labels.blockedBy !== 'function' || typeof labels.blocking !== 'function' || typeof labels.conflict !== 'function')) {
    throw new Error('CgTimeline labels.blockedBy, labels.blocking and labels.conflict are required with links.');
  }
}

const isRtl = (element: Element): boolean => getComputedStyle(element).direction === 'rtl';
/** The scroll from the inline start: right to left scrolls to negative `scrollLeft`. */
const inlineScroll = (scroller: HTMLElement, rtl: boolean): number => (rtl ? -scroller.scrollLeft : scroller.scrollLeft);
const setInlineScroll = (scroller: HTMLElement, rtl: boolean, value: number): void => { scroller.scrollLeft = rtl ? -value : value; };

const barSize = (span: TimelineSpan, dayWidth: number): number => Math.max(MIN_BAR, (span.end - span.start + 1) * dayWidth);
/** Whether a title fits inside a bar of `size` pixels: an estimate from its length, so nothing is measured. */
const fits = (title: string, size: number): boolean => title.length * 7 + 16 <= size;

interface ViewWindow {
  /** The first line of the step the view starts in. */
  readonly line: number;
  /** The first day of the step the view starts in. */
  readonly day: number;
  readonly width: number;
  readonly height: number;
  /** The scroller is right to left: the links' drawing, written from the inline start, is mirrored. */
  readonly rtl: boolean;
}

/** What was last measured, to keep the day in the middle when the scale changes. */
interface SeenView {
  readonly from: number;
  readonly dayWidth: number;
  readonly inline: number;
  readonly width: number;
}

/** A day to scroll to after the next drawing: at `lead` of the view's width from its inline start. */
interface PendingScroll {
  readonly position: number;
  readonly lead: number;
}

/** A line to focus after the next drawing, and which part of its bar to bring into view. */
interface PendingFocus {
  readonly id: string;
  readonly reveal: 'focus' | CgTimelineEdge;
}

/** The bar being dragged as its links see it: the line it is drawn on now and the days it covers now. */
interface DragPlace {
  readonly key: string;
  readonly line: number;
  readonly span: TimelineSpan;
}

/** A link as drawn: its route and arrowhead, and whether its blocked item starts before its blocker ends. */
interface DrawnLink {
  readonly link: CgTimelineLink;
  readonly route: string;
  readonly head: string;
  readonly conflict: boolean;
}

const NO_LINKS: ReadonlyArray<DrawnLink> = Object.freeze([]);

/** An item moved to another lane: its bar is focused in its new line once the caller has moved it there. */
interface PendingFollow {
  /** The item's line id. */
  readonly id: string;
  readonly key: string;
  readonly lane: string | null;
}

/**
 * Items on a time axis, one line each in the caller's order, optionally under lanes that collapse:
 * each item a bar from its start to its inclusive end, at a scale of days, weeks, months or
 * quarters, under a two-tier header. Only the lines in view, and the header's units and grid lines
 * near the days in view, are drawn, so 50,000 items cost little more than a date check each.
 * Time runs from the inline start: right to left in a right-to-left container. It has no editor:
 * opening, creating and moving (dragging a bar or an edge, or keys on its focused bar, and with
 * `moveBetweenLanes` to another lane) are callbacks. The lines are one tab stop moved by ArrowUp,
 * ArrowDown, PageUp, PageDown, Home and End. `actionsRef` finds and marks days for a drag from
 * outside, and scrolls.
 */
function CgTimelineInner<TData>(
  {
    items, labels, lanes, collapsedLanes, defaultCollapsedLanes, onCollapsedLanesChange, scale, defaultScale = 'week', onScaleChange, scales,
    dayWidths, startDate, defaultStartDate, onRangeChange, rangeChangeDelay = 150, lineHeight = 36, overscan = 6, height = '28rem',
    showToolbar = true, locale, firstDayOfWeek, today, timeZone, renderItem, onItemOpen, onCreate, onItemMove, moveBetweenLanes = false, links, actionsRef,
    className, style, ...nativeProps
  }: CgTimelineProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const offered = scales ?? TIMELINE_SCALES;
  assertLabels(labels, showToolbar, onItemMove !== undefined, moveBetweenLanes, offered, !!links?.length);
  if (!Number.isFinite(lineHeight) || lineHeight < 24) throw new RangeError('CgTimeline lineHeight must be at least 24 pixels.');
  if (!Number.isInteger(overscan) || overscan < 0) throw new RangeError('CgTimeline overscan must be a whole number of lines, 0 or more.');
  if (!Number.isFinite(rangeChangeDelay) || rangeChangeDelay < 0) throw new RangeError('CgTimeline rangeChangeDelay must be 0 or more milliseconds.');
  assertTimeZone(timeZone);
  const todayDay = today === undefined ? todayIn(timeZone) : dayOfValue(today, 'today');
  const startDay = startDate === undefined ? undefined : dayOfValue(startDate, 'startDate');
  const defaultStartDay = defaultStartDate === undefined ? undefined : dayOfValue(defaultStartDate, 'defaultStartDate');

  const baseId = useCgId();
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(rootRef, forwardedRef);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const laneDropRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const dragging = useRef(false);
  const growing = useRef(false);
  const seen = useRef<SeenView | null>(null);
  const pendingScroll = useRef<PendingScroll | null>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const following = useRef<PendingFollow | null>(null);
  const lastRange = useRef('');
  const mounted = useRef(false);
  const linksRef = useRef<SVGSVGElement>(null);
  const dragPlace = useRef<DragPlace | null>(null);

  const [scaleValue, setScaleValue] = useControllableState<CgTimelineScale>(scale, defaultScale, 'CgTimeline');
  if (!TIMELINE_SCALES.includes(scaleValue)) throw new RangeError(`CgTimeline scale '${String(scaleValue)}' is not day, week, month or quarter.`);
  const dayWidth = dayWidths?.[scaleValue] ?? DEFAULT_DAY_WIDTHS[scaleValue];
  if (!Number.isFinite(dayWidth) || dayWidth <= 0) throw new RangeError(`CgTimeline dayWidths.${scaleValue} must be a positive number of pixels.`);
  const [collapsed, setCollapsed] = useControllableState<ReadonlyArray<string | null>>(collapsedLanes, defaultCollapsedLanes ?? NO_LANES, 'CgTimeline collapsedLanes');
  const [extent, setExtent] = useState(() => {
    const day = startDay ?? defaultStartDay ?? todayDay;
    return { from: day - REACH_DAYS[scaleValue], to: day + REACH_DAYS[scaleValue] };
  });
  const [view, setView] = useState<ViewWindow>(() => ({ line: 0, day: startDay ?? defaultStartDay ?? todayDay, width: 0, height: 0, rtl: false }));
  const [active, setActive] = useState<{ id: string; index: number } | null>(null);
  const [dragLine, setDragLine] = useState<string | null>(null);
  const [shown, setShown] = useState<{ first: number; last: number } | null>(null);
  const [, setFocusRequests] = useState(0);

  const firstDay = useMemo(() => (firstDayOfWeek === undefined ? localeFirstDayOfWeek(locale) : dayOfWeekIndex(firstDayOfWeek)), [firstDayOfWeek, locale]);
  const formats = useMemo(() => timelineFormats(locale, labels.quarter), [labels.quarter, locale]);
  const countFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);
  const model = useMemo(() => buildLines(items, lanes, collapsedSet, labels.noLane), [collapsedSet, items, labels.noLane, lanes]);
  const placements = useMemo(() => new TimelinePlacements(timeZone), [timeZone]);
  const linkIndex = useMemo(() => (links?.length ? indexLinks(links) : null), [links]);
  const listFormat = useMemo(() => new Intl.ListFormat(locale, { type: 'conjunction' }), [locale]);
  const { lines } = model;
  const count = lines.length;
  const laneMoves = moveBetweenLanes && onItemMove !== undefined && model.grouped;

  // ---- Geometry ----------------------------------------------------------------------------------
  const width = view.width || FALLBACK_WIDTH;
  const bodyHeight = Math.max(lineHeight, (view.height || FALLBACK_HEIGHT) - HEADER);
  const pageLines = Math.max(1, Math.floor(bodyHeight / lineHeight));
  const total = (extent.to - extent.from + 1) * dayWidth;
  const xOf = (day: number) => (day - extent.from) * dayWidth;
  const shownDayCount = Math.ceil(width / dayWidth) + 1;
  const firstTick = Math.max(extent.from, view.day - shownDayCount);
  const lastTick = Math.min(extent.to, view.day + 3 * shownDayCount);
  const firstLine = Math.max(0, view.line - overscan);
  const lastLine = Math.min(count - 1, view.line + pageLines + LINE_STEP + overscan);

  const activeIndex = active ? model.index.get(active.id) ?? Math.min(active.index, count - 1) : 0;
  const activeId = lines[activeIndex]?.id;

  // ---- Measuring and scrolling -------------------------------------------------------------------
  /** Reads the scroller: the lines and days to draw, the timeline growing near an end, the days shown reported once they settle. */
  const reportRange = useDebouncedCallback((first: number, last: number) => {
    const key = `${first}:${last}`;
    if (key === lastRange.current) return;
    lastRange.current = key;
    setShown({ first, last });
    onRangeChange?.(Object.freeze({ from: dateOfDay(first), to: dateOfDay(last) }));
  }, rangeChangeDelay);
  const measure = useStableCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const rtl = isRtl(scroller);
    const inline = inlineScroll(scroller, rtl);
    const viewWidth = Math.min(scroller.clientWidth, MAX_WIDTH);
    const viewHeight = scroller.clientHeight;
    const across = viewWidth || FALLBACK_WIDTH;
    seen.current = { from: extent.from, dayWidth, inline, width: across };
    const days = shownDays(inline, across, dayWidth, extent.from);
    const step = Math.max(1, Math.ceil((Math.ceil(across / dayWidth) + 1) / 2));
    const day = Math.floor(days.first / step) * step;
    const line = Math.floor(scroller.scrollTop / lineHeight / LINE_STEP) * LINE_STEP;
    setView((current) => (current.line === line && current.day === day && current.width === viewWidth && current.height === viewHeight && current.rtl === rtl
      ? current
      : { line, day, width: viewWidth, height: viewHeight, rtl }));
    reportRange.schedule(days.first, Math.min(days.last, extent.to));
    // Near an end, the timeline grows by a reach (and the view keeps its day when it grows at the start).
    // Not while a drag measures against it, and never when the scroller is as wide as the canvas: a
    // container sized by its content would grow with it, and growing it would never end.
    if (dragging.current || growing.current || Math.abs(scroller.clientWidth - total) < 1) return;
    const grow = Math.max(REACH_DAYS[scaleValue], Math.ceil((3 * across) / dayWidth));
    if (inline < 1.5 * across) {
      growing.current = true;
      pendingScroll.current = { position: extent.from + inline / dayWidth, lead: 0 };
      setExtent({ from: extent.from - grow, to: extent.to });
    } else if (total - inline - across < 1.5 * across) {
      growing.current = true;
      setExtent({ from: extent.from, to: extent.to + grow });
    }
  });
  /** Scrolls so that `position` (a day, with a fraction) sits at `lead` of the view's width; the timeline is drawn again around it when it is out of reach. */
  const scrollToPosition = useStableCallback((position: number, lead: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const across = Math.min(scroller.clientWidth, MAX_WIDTH) || FALLBACK_WIDTH;
    const margin = Math.ceil((2 * across) / dayWidth);
    if (position - margin < extent.from || position + margin > extent.to) {
      const reach = Math.max(REACH_DAYS[scaleValue], Math.ceil((3 * across) / dayWidth));
      pendingScroll.current = { position, lead };
      setExtent({ from: Math.floor(position) - reach, to: Math.ceil(position) + reach });
      return;
    }
    setInlineScroll(scroller, isRtl(scroller), (position - extent.from) * dayWidth - lead * across);
    measure();
  });
  /** Brings a line into view, and the part of its bar that matters: its start, or the edge that changed. */
  const reveal = useStableCallback((index: number, part: 'focus' | CgTimelineEdge) => {
    const scroller = scrollerRef.current;
    const line = lines[index];
    if (!scroller || !line) return;
    const top = index * lineHeight;
    const visible = Math.max(lineHeight, scroller.clientHeight - HEADER);
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (top + lineHeight > scroller.scrollTop + visible) scroller.scrollTop = top + lineHeight - visible;
    if (line.kind !== 'item') return;
    const span = placements.get(line.item);
    if (!span) return;
    const rtl = isRtl(scroller);
    const inline = inlineScroll(scroller, rtl);
    const across = Math.min(scroller.clientWidth, MAX_WIDTH) || FALLBACK_WIDTH;
    const pad = Math.min(48, across / 5);
    const start = xOf(span.start);
    const end = start + barSize(span, dayWidth);
    if (part === 'end') {
      if (end > inline + across - pad) setInlineScroll(scroller, rtl, end - across + pad);
      else if (end < inline + pad) setInlineScroll(scroller, rtl, end - pad);
    } else if (part === 'focus') {
      if (end < inline || start > inline + across) setInlineScroll(scroller, rtl, start - pad);
    } else if (start < inline || start > inline + across - pad) {
      setInlineScroll(scroller, rtl, start < inline ? start - pad : start - across + pad * 2);
    }
  });

  /**
   * A bar moved to another lane is focused in its new line once the caller has drawn it there (that
   * lane's header when the lane is collapsed and holds it), after the next drawing; not if the focus
   * has left the timeline meanwhile. Until then it waits.
   */
  const settleFollow = useStableCallback(() => {
    const follow = following.current;
    const root = rootRef.current;
    if (!follow || !root) return;
    let arrived: number | undefined;
    const at = model.index.get(follow.id);
    if (at !== undefined) arrived = lines[at]?.lane === follow.lane ? at : undefined;
    else if (collapsedSet.has(follow.lane)) {
      const item = items.find((entry) => entry.key === follow.key);
      arrived = item && drawnLane(item, lanes) === follow.lane ? model.index.get(laneLineId(follow.lane)) : undefined;
    }
    if (arrived === undefined) return;
    following.current = null;
    const focused = root.ownerDocument.activeElement;
    if (focused && focused !== root.ownerDocument.body && !root.contains(focused)) return;
    const line = lines[arrived]!;
    setActive({ id: line.id, index: arrived });
    pendingFocus.current = { id: line.id, reveal: 'focus' };
    setFocusRequests((value) => value + 1);
  });

  /** A direction changed above the timeline: only the links' drawing needs telling (the rest is logical CSS). */
  const followDirection = useStableCallback(() => {
    const scroller = scrollerRef.current;
    if (!linkIndex || !scroller) return;
    const rtl = isRtl(scroller);
    setView((current) => (current.rtl === rtl ? current : { ...current, rtl }));
  });

  // The scroller is followed outside React: a drawing happens only when the lines or days to draw change.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const onScroll = () => measure();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(onScroll);
    observer?.observe(scroller);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [measure]);

  // The first day shown: `startDate` at first and whenever it changes, else `defaultStartDate`, else a little before today.
  useLayoutEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      const day = startDay ?? defaultStartDay;
      scrollToPosition(day ?? todayDay, day === undefined ? 0.2 : 0);
      return;
    }
    if (startDay !== undefined) scrollToPosition(startDay, 0);
    // Only a new start date scrolls: the others are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDay]);

  // After each drawing: a new scale keeps the day in the middle; a scroll waiting for the timeline to
  // grow is made; a line reached by the keys is focused and brought into view.
  useLayoutEffect(() => {
    growing.current = false;
    followDirection();
    const before = seen.current;
    if (before && before.dayWidth !== dayWidth && !pendingScroll.current) {
      pendingScroll.current = { position: before.from + (before.inline + before.width / 2) / before.dayWidth, lead: 0.5 };
    }
    const pending = pendingScroll.current;
    if (pending) {
      pendingScroll.current = null;
      scrollToPosition(pending.position, pending.lead);
    } else if (before && before.from !== extent.from) {
      measure();
    }
    const focus = pendingFocus.current;
    const root = rootRef.current;
    if (focus && root) {
      pendingFocus.current = null;
      const index = model.index.get(focus.id);
      const target = [...root.querySelectorAll<HTMLElement>('[data-cg-timeline-stop]')].find((element) => element.dataset.cgTimelineStop === focus.id);
      if (index !== undefined) reveal(index, focus.reveal);
      target?.focus({ preventScroll: true });
    }
    settleFollow();
  });

  useEffect(() => () => {
    stopDrag.current?.();
    reportRange.cancel();
  }, [reportRange]);

  // ---- Lines and focus ---------------------------------------------------------------------------
  /** Focus goes to a line after the next drawing, which this asks for even if nothing else changed. */
  const focusLine = (index: number, part: PendingFocus['reveal'] = 'focus') => {
    const line = lines[index];
    if (!line) return;
    setActive({ id: line.id, index });
    pendingFocus.current = { id: line.id, reveal: part };
    setFocusRequests((value) => value + 1);
  };
  const onStopFocus = (line: TimelineLine<TData>, index: number) => {
    // Focus on another line ends a wait for a bar moved to another lane.
    if (following.current && following.current.id !== line.id) following.current = null;
    if (active?.id !== line.id || active.index !== index) setActive({ id: line.id, index });
  };
  const toggleLane = (lane: string | null) => {
    const next = collapsedSet.has(lane) ? collapsed.filter((key) => key !== lane) : [...collapsed, lane];
    setCollapsed(next);
    onCollapsedLanesChange?.(Object.freeze(next));
  };

  // ---- Days under the pointer, marks and the anchor ----------------------------------------------
  const dayAtX = (x: number, rtl: boolean) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return extent.from + Math.floor((rtl ? rect.right - x : x - rect.left) / dayWidth);
  };
  /** Whether a viewport point is on the scroller's days, below its header. */
  const inBody = (x: number, y: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return false;
    const box = scroller.getBoundingClientRect();
    const left = box.left + scroller.clientLeft;
    const top = box.top + scroller.clientTop;
    const right = left + (scroller.clientWidth || box.width);
    const bottom = top + (scroller.clientHeight || box.height);
    return x >= left && x < right && y >= top + HEADER && y < bottom;
  };
  const lineAtY = (y: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const index = Math.floor((y - rect.top - HEADER) / lineHeight);
    return index >= 0 && index < count ? index : null;
  };
  /** Puts the anchor over a day on a line and returns it: what a create's editor is placed by. */
  const placeAnchor = (index: number, day: number): HTMLElement | null => {
    const anchor = anchorRef.current;
    if (!anchor) return null;
    anchor.style.setProperty('--cg-timeline-x', `${xOf(day)}px`);
    anchor.style.setProperty('--cg-timeline-y', `${index * lineHeight}px`);
    anchor.style.setProperty('--cg-timeline-w', `${Math.max(1, dayWidth)}px`);
    return anchor;
  };
  const markDay = (day: number | null) => {
    const mark = dropRef.current;
    if (!mark) return;
    if (day === null || day < extent.from || day > extent.to) {
      mark.removeAttribute('data-shown');
      return;
    }
    mark.style.setProperty('--cg-timeline-x', `${xOf(day)}px`);
    mark.style.setProperty('--cg-timeline-w', `${Math.max(2, dayWidth)}px`);
    mark.setAttribute('data-shown', '');
  };
  /** Marks the lines of the lane a dragged bar would drop in, its header to its last line, or clears the mark with undefined. Written to the DOM. */
  const markLane = (lane: string | null | undefined) => {
    const mark = laneDropRef.current;
    if (!mark) return;
    const range = lane === undefined ? null : laneRange(model, lane);
    if (!range) {
      mark.removeAttribute('data-shown');
      mark.removeAttribute('data-lane');
      return;
    }
    mark.style.setProperty('--cg-timeline-y', `${range.first * lineHeight}px`);
    mark.style.setProperty('--cg-timeline-h', `${(range.last - range.first + 1) * lineHeight}px`);
    mark.setAttribute('data-lane', lane ?? '');
    mark.setAttribute('data-shown', '');
  };
  const shownNow = () => {
    const before = seen.current;
    return before ? shownDays(before.inline, before.width, before.dayWidth, before.from) : { first: view.day, last: view.day + shownDayCount - 1 };
  };

  useImperativeHandle(actionsRef, (): CgTimelineHandle => ({
    dateAt: (x, y) => {
      const scroller = scrollerRef.current;
      if (!scroller || !inBody(x, y)) return null;
      const day = dayAtX(x, isRtl(scroller));
      return day === null || day < extent.from || day > extent.to ? null : dateOfDay(day);
    },
    laneAt: (x, y) => {
      if (!model.grouped || !inBody(x, y)) return null;
      const index = lineAtY(y);
      const line = index === null ? undefined : lines[index];
      return line ? Object.freeze({ lane: line.lane }) : null;
    },
    markDropDate: (date) => markDay(date === null ? null : dayOfValue(date, 'markDropDate')),
    scrollToDate: (date) => scrollToPosition(dayOfValue(date, 'scrollToDate'), 0),
    scrollToItem: (key) => {
      const index = model.index.get(itemLineId(key));
      if (index === undefined) return false;
      reveal(index, 'focus');
      return true;
    },
    getItemElement: (key) => [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-cg-timeline-item]') ?? [])].find((element) => element.dataset.cgTimelineItem === key) ?? null,
  }));

  // ---- Names -------------------------------------------------------------------------------------
  const titleOf = (item: CgTimelineItem<TData>) => (item.title.trim() ? item.title : labels.untitled ?? item.title);
  const nameOf = (line: TimelineItemLine<TData>, span: TimelineSpan) => {
    const title = titleOf(line.item);
    return labels.item?.(line.item, Object.freeze({
      title,
      start: formats.longDate(span.start),
      end: span.end > span.start ? formats.longDate(span.end) : null,
      days: span.end - span.start + 1,
      lane: line.laneTitle,
    })) ?? `${title} ${formats.span(span.start, span.end)}`;
  };

  // ---- Links -------------------------------------------------------------------------------------
  /**
   * Where an item's bar is for its links: its line (its lane's header line when that lane is
   * collapsed) and its days, or the dragged bar where it is drawn now. Null when it has no line.
   */
  const linkEnd = (key: string, dragged: DragPlace | null): (LinkEnd & { span: TimelineSpan }) | null => {
    const item = model.byKey.get(key);
    if (!item) return null;
    const drag = dragged?.key === key ? dragged : null;
    const span = drag ? drag.span : placements.get(item);
    if (!span) return null;
    let line = drag ? drag.line : model.index.get(itemLineId(key));
    if (line === undefined && model.grouped) line = model.index.get(laneLineId(drawnLane(item, lanes)));
    if (line === undefined) return null;
    const start = xOf(span.start);
    const size = barSize(span, dayWidth);
    // A title drawn just after a short bar starts a few pixels on: the route turns before it.
    const exit = fits(titleOf(item), size) ? undefined : size < 3 * EDGE ? 6 : 2;
    return { line, start, end: start + size, span, ...(exit === undefined ? {} : { exit }) };
  };
  /**
   * The links of the bars on the lines drawn (and of the dragged bar), routed round the bars and the
   * titles drawn after short ones on those lines; the others are not drawn.
   */
  const drawLinks = (drag: DragPlace | null): ReadonlyArray<DrawnLink> => {
    if (!linkIndex || !count) return NO_LINKS;
    const top = firstLine * lineHeight;
    const obstacles = new Map<number, (readonly [number, number])[]>();
    const obstaclesOf = (index: number) => {
      let spans = obstacles.get(index);
      if (spans) return spans;
      spans = [];
      const line = lines[index];
      const span = line?.kind === 'item' && line.item.key !== drag?.key ? placements.get(line.item) : null;
      if (line?.kind === 'item' && span) {
        const start = xOf(span.start);
        const size = barSize(span, dayWidth);
        const title = titleOf(line.item);
        spans.push([start, start + size + (fits(title, size) ? 0 : (size < 3 * EDGE ? 12 : 4) + title.length * 7)]);
      }
      if (drag && drag.line === index) spans.push([xOf(drag.span.start), xOf(drag.span.start) + barSize(drag.span, dayWidth)]);
      obstacles.set(index, spans);
      return spans;
    };
    const drawn: DrawnLink[] = [];
    const done = new Set<string>();
    const add = (link: CgTimelineLink) => {
      if (done.has(link.id)) return;
      done.add(link.id);
      const from = linkEnd(link.from, drag);
      const to = linkEnd(link.to, drag);
      if (!from || !to) return;
      const points = routeLink(from, to, lineHeight, firstLine, lastLine, obstaclesOf);
      drawn.push({ link, route: routePath(points, top), head: arrowPath(points, top), conflict: to.span.start <= from.span.end });
    };
    const addOf = (key: string) => {
      for (const link of linkIndex.from.get(key) ?? []) add(link);
      for (const link of linkIndex.to.get(key) ?? []) add(link);
    };
    for (let index = firstLine; index <= lastLine; index += 1) {
      const line = lines[index];
      if (line?.kind === 'item') addOf(line.item.key);
    }
    if (drag) addOf(drag.key);
    return drawn;
  };
  // Drawn at rest; a drag writes its routes to the DOM (and a drawing during it is at rest until the next move).
  const drawnLinks = drawLinks(null);
  const redrawLinks = useStableCallback(() => {
    const svg = linksRef.current;
    if (!svg) return;
    const routes = new Map(drawLinks(dragPlace.current).map((drawn) => [drawn.link.id, drawn]));
    for (const group of svg.querySelectorAll<SVGGElement>('[data-cg-timeline-link]')) {
      const drawn = routes.get(group.dataset.cgTimelineLink ?? '');
      if (!drawn) continue;
      group.firstElementChild?.setAttribute('d', drawn.route);
      group.lastElementChild?.setAttribute('d', drawn.head);
      group.toggleAttribute('data-conflict', drawn.conflict);
    }
  });
  /** A bar's description of its links: what blocks it and what it blocks, then those in conflict. Null when it has none. */
  const linkDescription = (item: CgTimelineItem<TData>): string | null => {
    if (!linkIndex) return null;
    const others = (found: ReadonlyArray<CgTimelineLink> | undefined, end: 'from' | 'to') => {
      const seen = new Set<string>();
      const result: CgTimelineItem<TData>[] = [];
      for (const link of found ?? []) {
        const other = model.byKey.get(link[end]);
        if (other && !seen.has(other.key)) {
          seen.add(other.key);
          result.push(other);
        }
      }
      return result;
    };
    const blockers = others(linkIndex.to.get(item.key), 'from');
    const blocked = others(linkIndex.from.get(item.key), 'to');
    if (!blockers.length && !blocked.length) return null;
    const own = placements.get(item);
    const list = (entries: ReadonlyArray<CgTimelineItem<TData>>) => listFormat.format(entries.map(titleOf));
    const late = own ? blockers.filter((other) => { const span = placements.get(other); return !!span && own.start <= span.end; }) : [];
    const early = own ? blocked.filter((other) => { const span = placements.get(other); return !!span && span.start <= own.end; }) : [];
    return [
      blockers.length ? labels.blockedBy?.(list(blockers), blockers) : null,
      late.length ? labels.conflict?.(list(late), 'blockedBy', late) : null,
      blocked.length ? labels.blocking?.(list(blocked), blocked) : null,
      early.length ? labels.conflict?.(list(early), 'blocking', early) : null,
    ].filter(Boolean).join(' ');
  };

  // ---- Moving ------------------------------------------------------------------------------------
  const canMove = (item: CgTimelineItem<TData>) => onItemMove !== undefined && item.movable !== false;
  const canResize = (item: CgTimelineItem<TData>) => onItemMove !== undefined && item.resizable !== false;
  const allowed = (item: CgTimelineItem<TData>, edge: CgTimelineEdge) => (edge === 'move' ? canMove(item) : canResize(item));
  /** A lane's title as drawn on its header line: `labels.noLane` for the last lane. */
  const laneTitleOf = (lane: string | null) => {
    const head = model.index.get(laneLineId(lane));
    const line = head === undefined ? undefined : lines[head];
    return line?.kind === 'lane' ? line.title : lane ?? labels.noLane ?? '';
  };
  /**
   * One change, reported and spoken in one call; false when it changes nothing. `lane` is the lane a
   * move puts it in: a change when it is not the lane it is drawn under, even by no days.
   */
  const commit = (line: TimelineItemLine<TData>, span: TimelineSpan, edge: CgTimelineEdge, days: number, source: CgTimelineMoveSource, lane?: string | null) => {
    if (!onItemMove) return false;
    const toLane = edge === 'move' && lane !== undefined && lane !== line.lane ? lane : undefined;
    const change = toLane === undefined ? changeItemDates(line.item, span, edge, days, timeZone) : laneMoveDates(line.item, span, days, timeZone);
    if (!change) return false;
    onItemMove(line.item, Object.freeze({ start: change.start, end: change.end, days: change.days, edge, source, ...(toLane === undefined ? {} : { lane: toLane }) }));
    const info = {
      start: formats.longDate(change.span.start),
      end: change.span.end > change.span.start ? formats.longDate(change.span.end) : null,
      length: change.span.end - change.span.start + 1,
      days: change.days,
      edge,
    };
    const message = toLane !== undefined
      ? labels.movedLane?.(line.item, Object.freeze({ ...info, lane: laneTitleOf(toLane), laneKey: toLane }))
      : edge === 'move' ? labels.moved?.(line.item, Object.freeze(info)) : labels.resized?.(line.item, Object.freeze(info));
    if (message) live.current?.announce(message);
    return true;
  };

  // A drag is followed outside React: the bar is moved by custom properties written to it (its
  // place and length, and with lanes the lines it is shifted by), the lane it would drop in is
  // marked, and only the drop is a call. The line stays drawn while it lasts; the timeline does not grow.
  const startDrag = (event: PointerEvent<HTMLDivElement>, line: TimelineItemLine<TData>, index: number, span: TimelineSpan) => {
    if (event.button !== 0 || !onItemMove) return;
    const bar = event.currentTarget;
    const handle = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-cg-timeline-edge]') : null;
    const edge: CgTimelineEdge = handle && bar.contains(handle) ? (handle.dataset.cgTimelineEdge === 'start' ? 'start' : 'end') : 'move';
    if (!allowed(line.item, edge) || !cgStartsDrag(event.target, bar)) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    following.current = null;
    const rtl = isRtl(scroller);
    const pressX = event.clientX;
    const from = extent.from;
    const across = dayWidth;
    const acrossLanes = edge === 'move' && laneMoves;
    let grab = 0;
    let shownSpan = span;
    let shownLane = line.lane;
    let shownShift = 0;
    let shownLine = index;
    /** The whole days the pointer at `x` has carried the dragged part, a start kept on or before its end. */
    const carried = (x: number) => clampChange(span, edge, (dayAtX(x, rtl) ?? grab) - grab);
    /** The line under a viewport y, kept to the lines shown below the header, and its lane: the bar's own when there is none. */
    const target = (y: number) => {
      const box = scroller.getBoundingClientRect();
      const top = box.top + scroller.clientTop;
      const canvas = canvasRef.current?.getBoundingClientRect();
      const at = canvas ? lineUnder(y, top + HEADER, top + (scroller.clientHeight || box.height), canvas.top + HEADER, lineHeight, count) : null;
      const under = at === null ? undefined : lines[at];
      return under ? { index: at!, lane: under.lane } : { index, lane: line.lane };
    };
    const finish = () => {
      bar.style.removeProperty('--cg-timeline-drag-x');
      bar.style.removeProperty('--cg-timeline-drag-w');
      bar.style.removeProperty('--cg-timeline-drag-y');
      markLane(undefined);
      stopDrag.current = null;
      dragging.current = false;
      if (dragPlace.current) {
        dragPlace.current = null;
        redrawLinks();
      }
      setDragLine(null);
    };
    stopDrag.current?.();
    stopDrag.current = cgTrackDrag(event, bar, {
      scroller,
      ghost: false,
      onStart: () => {
        grab = dayAtX(pressX, rtl) ?? span.start;
        dragging.current = true;
        if (linkIndex) dragPlace.current = { key: line.item.key, line: index, span };
        setDragLine(line.id);
      },
      onMove: (x, y) => {
        const days = carried(x);
        const next = edge === 'move'
          ? { start: span.start + days, end: span.end + days }
          : edge === 'start' ? { start: span.start + days, end: span.end } : { start: span.start, end: span.end + days };
        let changed = false;
        if (next.start !== shownSpan.start || next.end !== shownSpan.end) {
          shownSpan = next;
          changed = true;
          bar.style.setProperty('--cg-timeline-drag-x', `${(next.start - from) * across}px`);
          bar.style.setProperty('--cg-timeline-drag-w', `${barSize(next, across)}px`);
        }
        if (acrossLanes) {
          // Over another lane the bar is drawn on the line under the pointer; over its own, on its own line.
          const over = target(y);
          const shift = over.lane === line.lane ? 0 : (over.index - index) * lineHeight;
          if (shift !== shownShift) {
            shownShift = shift;
            shownLine = shift ? over.index : index;
            changed = true;
            if (shift) bar.style.setProperty('--cg-timeline-drag-y', `${shift}px`);
            else bar.style.removeProperty('--cg-timeline-drag-y');
          }
          if (over.lane !== shownLane) {
            shownLane = over.lane;
            markLane(over.lane === line.lane ? undefined : over.lane);
          }
        }
        // The links follow the bar: their routes are written to the DOM, as the bar's place is.
        if (changed && dragPlace.current) {
          dragPlace.current = { key: line.item.key, line: shownLine, span: shownSpan };
          redrawLinks();
        }
      },
      // Read at the drop itself: a quick drag can end before a frame has drawn its last move.
      onDrop: (x, y) => {
        const days = carried(x);
        const lane = acrossLanes ? target(y).lane : line.lane;
        finish();
        if (!days && lane === line.lane) return;
        if (commit(line, span, edge, days, 'pointer', lane) && lane !== line.lane) following.current = { id: line.id, key: line.item.key, lane };
      },
      onCancel: finish,
    });
  };

  // ---- Events ------------------------------------------------------------------------------------
  const createAt = (index: number, day: number, lane: string | null, source: 'doubleClick' | 'keyboard', fallback: HTMLElement) => {
    if (!onCreate) return;
    const anchor = placeAnchor(index, day) ?? fallback;
    onCreate(dateOfDay(day), lane, Object.freeze({ source, anchor }));
  };
  const onLineDoubleClick = (event: MouseEvent<HTMLDivElement>, line: TimelineLine<TData>, index: number) => {
    if (!onCreate || (event.target instanceof Element && event.target.closest('[data-cg-timeline-item], button'))) return;
    const day = dayAtX(event.clientX, isRtl(event.currentTarget));
    if (day !== null) createAt(index, day, line.lane, 'doubleClick', event.currentTarget);
  };
  const onStopKeyDown = (event: KeyboardEvent<HTMLElement>, line: TimelineLine<TData> | null, index: number) => {
    if (event.target !== event.currentTarget) return;
    // A key other than a modifier ends a wait for a bar moved to another lane (a lane key starts another).
    if (!MODIFIERS.has(event.key)) following.current = null;
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    if (event.key === 'Enter' && event.shiftKey && plain) {
      if (!onCreate) return;
      event.preventDefault();
      const days = shownNow();
      createAt(index, todayDay >= days.first && todayDay <= days.last ? todayDay : days.first, line?.lane ?? null, 'keyboard', event.currentTarget);
      return;
    }
    if (!line) return;
    if (line.kind === 'item') {
      if ((event.key === 'Enter' || event.key === ' ') && plain && !event.shiftKey) {
        event.preventDefault();
        onItemOpen?.(line.item, Object.freeze({ source: 'keyboard', anchor: event.currentTarget }));
        return;
      }
      // Alt+ArrowUp and Alt+ArrowDown: the lane above or below, the days kept.
      const step = laneMoves ? laneKeyStep(event) : null;
      if (step) {
        const span = placements.get(line.item);
        if (!span || !canMove(line.item)) return;
        event.preventDefault();
        const lane = laneBeside(model, line.lane, step);
        if (lane !== undefined && commit(line, span, 'move', 0, 'keyboard', lane)) following.current = { id: line.id, key: line.item.key, lane };
        return;
      }
      const change = keyChange(event, isRtl(event.currentTarget));
      if (change) {
        const span = placements.get(line.item);
        if (!span || !allowed(line.item, change.edge)) return;
        event.preventDefault();
        if (commit(line, span, change.edge, change.days, 'keyboard')) focusLine(index, change.edge);
        return;
      }
    }
    if (event.altKey || event.metaKey || event.shiftKey || (event.ctrlKey && event.key !== 'Home' && event.key !== 'End')) return;
    const next = lineStep(event.key, index, count, pageLines);
    if (next === null) return;
    event.preventDefault();
    if (next !== index) focusLine(next);
  };
  const changeScale = (next: CgTimelineScale) => {
    if (next === scaleValue) return;
    setScaleValue(next);
    onScaleChange?.(next, Object.freeze({ previousScale: scaleValue }));
  };
  const turn = (direction: -1 | 1) => {
    const before = seen.current;
    if (!before) return;
    scrollToPosition(before.from + (before.inline + direction * before.width * 0.8) / before.dayWidth, 0);
  };

  // ---- Drawing -----------------------------------------------------------------------------------
  const hintId = `${baseId}-hint`;
  const rangeId = `${baseId}-range`;
  const keysOf = (item: CgTimelineItem<TData>) => [
    ...(canMove(item) ? ['Alt+ArrowLeft', 'Alt+ArrowRight'] : []),
    ...(canMove(item) && laneMoves ? ['Alt+ArrowUp', 'Alt+ArrowDown'] : []),
    ...(canResize(item) ? ['Alt+Shift+ArrowLeft', 'Alt+Shift+ArrowRight', 'Control+Shift+ArrowLeft', 'Control+Shift+ArrowRight'] : []),
    ...(onCreate ? ['Shift+Enter'] : []),
  ].join(' ') || undefined;

  const bar = (line: TimelineItemLine<TData>, index: number): ReactNode => {
    const span = placements.get(line.item);
    if (!span) return null;
    const { item } = line;
    const size = barSize(span, dayWidth);
    const title = titleOf(item);
    const outside = !fits(title, size);
    const movable = canMove(item);
    const resizable = canResize(item);
    const content = renderItem ? renderItem(item, Object.freeze({ days: span.end - span.start + 1, outside })) : <span className={styles.text} dir="auto">{title}</span>;
    const linked = linkDescription(item);
    const linkedId = `${baseId}-links-${index}`;
    const described = [linked ? linkedId : null, (movable || resizable) && labels.moveHint ? hintId : null].filter(Boolean).join(' ');
    return <>{linked ? <span id={linkedId} hidden>{linked}</span> : null}<div
      role="button"
      className={styles.bar}
      tabIndex={line.id === activeId ? 0 : -1}
      data-cg-timeline-item={item.key}
      data-cg-timeline-stop={line.id}
      data-movable={movable ? '' : undefined}
      data-resizable={resizable ? '' : undefined}
      data-outside={outside ? '' : undefined}
      data-narrow={size < 3 * EDGE ? '' : undefined}
      aria-label={nameOf(line, span)}
      aria-describedby={described || undefined}
      aria-keyshortcuts={keysOf(item)}
      style={{
        '--cg-timeline-x': `${xOf(span.start)}px`,
        '--cg-timeline-w': `${size}px`,
        ...(item.color ? { '--cg-timeline-item-color': item.color } : {}),
      } as CSSProperties}
      onClick={(event) => onItemOpen?.(item, Object.freeze({ source: 'pointer', anchor: event.currentTarget }))}
      onFocus={() => onStopFocus(line, index)}
      onKeyDown={(event) => onStopKeyDown(event, line, index)}
      onPointerDown={(event) => startDrag(event, line, index, span)}
    >
      {resizable ? <span className={styles.edge} data-cg-timeline-edge="start" aria-hidden="true" /> : null}
      <span className={outside ? styles.outside : styles.inside}>{content}</span>
      {resizable ? <span className={styles.edge} data-cg-timeline-edge="end" aria-hidden="true" /> : null}
    </div></>;
  };

  const row = (index: number): ReactNode => {
    const line = lines[index]!;
    const isActive = line.id === activeId;
    return <div
      key={line.id}
      role="row"
      aria-rowindex={index + 1}
      className={cx(styles.line, line.kind === 'lane' && styles.laneLine)}
      style={{ '--cg-timeline-y': `${index * lineHeight}px` } as CSSProperties}
      data-cg-timeline-line={index}
    >
      <div role="gridcell" className={styles.cell} onDoubleClick={(event) => onLineDoubleClick(event, line, index)}>
        {line.kind === 'item' ? bar(line, index) : <div className={styles.laneHead}>
          <button
            type="button"
            className={styles.laneToggle}
            tabIndex={isActive ? 0 : -1}
            aria-expanded={!line.collapsed}
            aria-label={labels.lane?.(line.title, line.count, line.lane)}
            aria-keyshortcuts={onCreate ? 'Shift+Enter' : undefined}
            data-cg-timeline-stop={line.id}
            data-cg-timeline-lane={line.lane ?? ''}
            onClick={() => toggleLane(line.lane)}
            onFocus={() => onStopFocus(line, index)}
            onKeyDown={(event) => onStopKeyDown(event, line, index)}
          >
            <CgIcon name={line.collapsed ? 'chevron-end' : 'chevron-down'} />
            <span className={styles.laneTitle} dir="auto">{line.title}</span>
          </button>
          <span className={styles.laneCount} aria-hidden="true">{countFormat.format(line.count)}</span>
        </div>}
      </div>
    </div>;
  };

  // The lines in view, and the active and dragged ones wherever they are, so focus and a drag survive scrolling.
  const drawn = new Set<number>();
  for (let index = firstLine; index <= lastLine; index += 1) drawn.add(index);
  if (count) drawn.add(Math.max(0, Math.min(count - 1, activeIndex)));
  const dragIndex = dragLine === null ? undefined : model.index.get(dragLine);
  if (dragIndex !== undefined) drawn.add(dragIndex);

  const [upper, lower] = SCALE_TIERS[scaleValue];
  const upperUnits = axisUnits(upper, firstTick, lastTick, firstDay);
  const lowerUnits = axisUnits(lower, firstTick, lastTick, firstDay);
  const majors = new Set(upperUnits.map((unit) => unit.start));
  const unitStyle = (start: number, end: number) => {
    const first = Math.max(start, extent.from);
    return { '--cg-timeline-x': `${xOf(first)}px`, '--cg-timeline-w': `${(Math.min(end, extent.to) - first + 1) * dayWidth}px` } as CSSProperties;
  };
  const showsToday = todayDay >= extent.from && todayDay <= extent.to;

  return <div
    {...nativeProps}
    ref={ref}
    className={cx(styles.root, className)}
    style={{ blockSize: typeof height === 'number' ? `${height}px` : height, '--cg-timeline-line': `${lineHeight}px`, '--cg-timeline-header': `${HEADER}px`, '--cg-timeline-day': `${dayWidth}px`, ...style } as CSSProperties}
    data-cg-timeline=""
    data-scale={scaleValue}
  >
    {showToolbar ? <div className={styles.toolbar}>
      <div className={styles.navigation}>
        <CgButton appearance="ghost" size="small" aria-label={labels.previous} title={labels.previous} onClick={() => turn(-1)}><CgIcon name="chevron-start" /></CgButton>
        <CgButton appearance="outline" size="small" onClick={() => scrollToPosition(todayDay, 0.2)}>{labels.today}</CgButton>
        <CgButton appearance="ghost" size="small" aria-label={labels.next} title={labels.next} onClick={() => turn(1)}><CgIcon name="chevron-end" /></CgButton>
      </div>
      <div id={rangeId} className={styles.range}>{shown ? formats.range(shown.first, shown.last) : null}</div>
      {labels.scales ? <div role="group" className={styles.scales} aria-label={labels.scale}>
        {offered.map((name) => <CgButton
          key={name}
          appearance={name === scaleValue ? 'soft' : 'ghost'}
          size="small"
          aria-pressed={name === scaleValue}
          data-cg-timeline-scale={name}
          onClick={() => changeScale(name)}
        >{labels.scales?.[name]}</CgButton>)}
      </div> : null}
    </div> : null}
    <div ref={scrollerRef} className={styles.scroller} data-cg-timeline-scroller="">
      <div ref={canvasRef} className={styles.canvas} style={{ '--cg-timeline-canvas-w': `${total}px`, '--cg-timeline-canvas-h': `${HEADER + Math.max(bodyHeight, count * lineHeight)}px` } as CSSProperties}>
        <div className={styles.header} aria-hidden="true">
          <div className={styles.tier}>
            {upperUnits.map((unit) => <div key={unit.start} className={styles.unit} style={unitStyle(unit.start, unit.end)}>
              <span className={styles.unitText}>{formats.unit(unit, 'upper')}</span>
            </div>)}
          </div>
          <div className={cx(styles.tier, styles.lowerTier)}>
            {lowerUnits.map((unit) => <div
              key={unit.start}
              className={styles.unit}
              style={unitStyle(unit.start, unit.end)}
              data-today={lower === 'day' && unit.start === todayDay ? '' : undefined}
            >
              <span className={styles.unitText}>{formats.unit(unit, 'lower')}</span>
              {lower === 'day' ? <span className={styles.weekday}>{formats.weekday(unit.start)}</span> : null}
            </div>)}
          </div>
          {showsToday ? <div className={styles.todayMark} style={{ '--cg-timeline-x': `${xOf(todayDay) + dayWidth / 2}px` } as CSSProperties} /> : null}
        </div>
        <div className={styles.body}>
          <div className={styles.backdrop} aria-hidden="true">
            {lowerUnits.map((unit) => (unit.start > extent.from ? <div
              key={unit.start}
              className={styles.gridLine}
              data-major={majors.has(unit.start) ? '' : undefined}
              style={{ '--cg-timeline-x': `${xOf(unit.start)}px` } as CSSProperties}
            /> : null))}
            {showsToday ? <div className={styles.todayLine} style={{ '--cg-timeline-x': `${xOf(todayDay) + dayWidth / 2}px` } as CSSProperties} /> : null}
            <div ref={dropRef} className={styles.dropMark} data-cg-timeline-drop="" />
            <div ref={anchorRef} className={styles.anchor} data-cg-timeline-anchor="" />
          </div>
          <div
            role="grid"
            className={styles.grid}
            aria-label={labels.grid}
            aria-describedby={showToolbar && shown ? rangeId : undefined}
            aria-rowcount={Math.max(1, count)}
            aria-readonly={onItemMove ? undefined : true}
          >
            {count ? [...drawn].sort((a, b) => a - b).map(row) : <div role="row" aria-rowindex={1} className={styles.line} style={{ '--cg-timeline-y': '0px' } as CSSProperties}>
              <div
                role="gridcell"
                className={styles.cell}
                tabIndex={onCreate ? 0 : undefined}
                aria-keyshortcuts={onCreate ? 'Shift+Enter' : undefined}
                data-cg-timeline-stop="empty"
                onKeyDown={(event) => onStopKeyDown(event, null, 0)}
                onDoubleClick={(event) => {
                  if (!onCreate) return;
                  const day = dayAtX(event.clientX, isRtl(event.currentTarget));
                  if (day !== null) createAt(0, day, null, 'doubleClick', event.currentTarget);
                }}
              />
            </div>}
          </div>
          {drawnLinks.length ? <svg
            ref={linksRef}
            className={styles.links}
            aria-hidden="true"
            focusable="false"
            data-cg-timeline-links=""
            style={{ '--cg-timeline-y': `${firstLine * lineHeight}px`, '--cg-timeline-h': `${(lastLine - firstLine + 1) * lineHeight}px`, transform: view.rtl ? 'scaleX(-1)' : undefined } as CSSProperties}
          >
            {drawnLinks.map(({ link, route, head, conflict }) => <g
              key={link.id}
              data-cg-timeline-link={link.id}
              data-cg-timeline-link-from={link.from}
              data-cg-timeline-link-to={link.to}
              data-conflict={conflict ? '' : undefined}
            >
              <path d={route} />
              <path d={head} data-head="" />
            </g>)}
          </svg> : null}
          {laneMoves ? <div ref={laneDropRef} className={styles.laneDrop} data-cg-timeline-lane-drop="" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
    {onItemMove && labels.moveHint ? <span id={hintId} hidden>{labels.moveHint}</span> : null}
    {onItemMove ? <CgLiveAnnouncer ref={live} /> : null}
  </div>;
}

export const CgTimeline = forwardRef(CgTimelineInner) as <TData = unknown>(
  props: CgTimelineProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
