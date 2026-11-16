import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ForwardedRef, KeyboardEvent, MouseEvent, PointerEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useCgId, useControllableState, useMergedRefs } from '../../hooks';
import { dayOfWeekIndex, localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { cgStartsDrag, cgTrackDrag } from '../DragDrop';
import { CgFlyout } from '../Flyout';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import styles from './CgMonthCalendar.module.css';
import type {
  CgMonthCalendarItem,
  CgMonthCalendarLabels,
  CgMonthCalendarMonthChangeReason,
  CgMonthCalendarProps,
} from './CgMonthCalendar.types';
import { addMonthsTo, assertTimeZone, dateOfDay, dayOfDate, monthCalendarFormats, monthOfDay, monthText, parseMonth, sameMonth, todayIn } from './monthCalendarDates';
import type { CalendarMonth } from './monthCalendarDates';
import { itemsOnDay, layoutMonthCalendar, moveDay, moveStep, shiftItemDates } from './monthCalendarLayout';
import type { MonthSegment, PlacedItem } from './monthCalendarLayout';

const MOVE_KEYS = 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown';

type PendingFocus = { kind: 'day'; day: number } | { kind: 'item'; key: string; day: number };

function assertLabels<TData>(labels: CgMonthCalendarLabels<TData>, creates: boolean, moves: boolean): void {
  for (const name of ['grid', 'previousMonth', 'nextMonth', 'today'] as const) {
    if (typeof labels[name] !== 'string' || !labels[name].trim()) throw new Error(`CgMonthCalendar labels.${name} cannot be empty.`);
  }
  if (typeof labels.more !== 'function' || typeof labels.dayItems !== 'function') throw new Error('CgMonthCalendar labels.more and labels.dayItems are required.');
  if (creates && typeof labels.create !== 'function') throw new Error('CgMonthCalendar labels.create is required with onCreate.');
  if (moves && typeof labels.moved !== 'function') throw new Error('CgMonthCalendar labels.moved is required with onItemMove.');
}

/** The copy that follows the pointer sits on the body: it keeps the theme and density of the calendar it left. */
function draggedCopy(source: HTMLElement): HTMLElement {
  const rect = source.getBoundingClientRect();
  const copy = source.cloneNode(true) as HTMLElement;
  for (const element of [copy, ...copy.querySelectorAll('[id]')]) element.removeAttribute('id');
  copy.removeAttribute('tabindex');
  copy.style.removeProperty('grid-column');
  copy.style.removeProperty('grid-row');
  copy.style.inlineSize = `${rect.width}px`;
  copy.style.blockSize = `${rect.height}px`;
  for (const name of ['data-cg-theme', 'data-cg-density']) {
    const value = source.closest(`[${name}]`)?.getAttribute(name);
    if (value) copy.setAttribute(name, value);
  }
  return copy;
}

const dayCell = (element: HTMLElement): HTMLElement => element.closest<HTMLElement>('[data-cg-month-day]') ?? element;

/**
 * A month of days with the caller's items on them: one-day and zero-length items, and spans from a
 * start to an inclusive end drawn as bars across the days and on through the weeks, in lanes; a
 * "+N more" list where a day is full. It has no editor: opening, creating and moving are callbacks.
 * The days are one tab stop moved by the arrows (mirrored in right to left), Home, End, PageUp and
 * PageDown; the items on the selected day follow it in the tab order, open with Enter and move with
 * Alt and the arrows, or by dragging.
 */
function CgMonthCalendarInner<TData>(
  {
    items, labels, month, defaultMonth, onMonthChange, locale, firstDayOfWeek, today, timeZone, maxItemRows = 3,
    renderItem, onItemOpen, onCreate, onItemMove, className, style, ...nativeProps
  }: CgMonthCalendarProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  assertLabels(labels, onCreate !== undefined, onItemMove !== undefined);
  if (!Number.isInteger(maxItemRows) || maxItemRows < 1) throw new RangeError('CgMonthCalendar maxItemRows must be a positive integer.');
  assertTimeZone(timeZone);
  const todayDay = today === undefined ? todayIn(timeZone) : dayOfDate(today);
  if (todayDay === null) throw new RangeError(`CgMonthCalendar today '${String(today)}' is not a YYYY-MM-DD date.`);

  const baseId = useCgId();
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(rootRef, forwardedRef);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const stopDrag = useRef<(() => void) | null>(null);
  const marked = useRef<HTMLElement[]>([]);
  const [monthValue, setMonthValue] = useControllableState<string>(month, defaultMonth ?? monthText(monthOfDay(todayDay)), 'CgMonthCalendar');
  const [active, setActive] = useState<number | null>(null);
  const [more, setMore] = useState<{ day: number; anchor: HTMLElement } | null>(null);
  const [, setFocusRequests] = useState(0);

  const firstDay = useMemo(() => (firstDayOfWeek === undefined ? localeFirstDayOfWeek(locale) : dayOfWeekIndex(firstDayOfWeek)), [firstDayOfWeek, locale]);
  const formats = useMemo(() => monthCalendarFormats(locale, firstDay), [firstDay, locale]);
  const shown = useMemo(() => parseMonth(monthValue), [monthValue]);
  const layout = useMemo(
    () => (shown ? layoutMonthCalendar(items, { month: shown, firstDayOfWeek: firstDay, rows: maxItemRows, timeZone }) : null),
    [firstDay, items, maxItemRows, shown, timeZone],
  );

  useEffect(() => () => stopDrag.current?.(), []);

  // A day reached by the keys, or an item moved by them, is a new element: focus follows it there.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    const root = rootRef.current;
    if (!pending || !root) return;
    pendingFocus.current = null;
    let target: HTMLElement | undefined;
    if (pending.kind === 'item') {
      const pieces = [...root.querySelectorAll<HTMLElement>('[data-cg-month-item]')].filter((element) => element.dataset.cgMonthItem === pending.key);
      target = pieces.find((element) => Number(element.dataset.firstDay) <= pending.day && pending.day <= Number(element.dataset.lastDay)) ?? pieces[0];
    }
    target ??= root.querySelector<HTMLElement>(`[data-cg-month-day="${pending.day}"]`) ?? root.querySelector<HTMLElement>('[data-cg-month-day][tabindex="0"]') ?? undefined;
    target?.focus();
  });

  if (!shown || !layout) throw new RangeError(`CgMonthCalendar month '${monthValue}' is not a YYYY-MM month.`);
  const { grid } = layout;
  const gridEnd = grid.start + grid.weeks * 7 - 1;
  const inMonth = (day: number) => day >= grid.first && day <= grid.last;
  const activeDay = active !== null && active >= grid.start && active <= gridEnd ? active : inMonth(todayDay) ? todayDay : grid.first;
  const titleId = `${baseId}-title`;
  const hintId = `${baseId}-hint`;

  // ---- Months and days ---------------------------------------------------------------------------
  /** Focus goes to the day or item after the next drawing, which this asks for even if nothing else changed. */
  const requestFocus = (pending: PendingFocus) => {
    pendingFocus.current = pending;
    setFocusRequests((count) => count + 1);
  };
  const changeMonth = (next: CalendarMonth, reason: CgMonthCalendarMonthChangeReason) => {
    const text = monthText(next);
    if (text === monthValue) return;
    setMore(null);
    setMonthValue(text);
    onMonthChange?.(text, Object.freeze({ reason, previousMonth: monthValue }));
  };
  const turn = (count: number) => {
    const next = addMonthsTo(shown, count);
    setActive(dayOfDate(`${monthText(next)}-01`));
    changeMonth(next, count < 0 ? 'previous' : 'next');
  };
  const goToDay = (day: number) => {
    setActive(day);
    if (!sameMonth(monthOfDay(day), shown)) changeMonth(monthOfDay(day), 'keyboard');
    requestFocus({ kind: 'day', day });
  };

  // ---- Names -------------------------------------------------------------------------------------
  const titleOf = (item: CgMonthCalendarItem<TData>) => (item.title.trim() ? item.title : labels.untitled ?? item.title);
  const timeOf = (placed: PlacedItem<TData>) => (placed.minutes === null ? null : formats.time(placed.minutes));
  const nameOf = (placed: PlacedItem<TData>) => labels.item?.(placed.item, Object.freeze({
    title: titleOf(placed.item),
    start: formats.longDate(placed.start),
    end: placed.end > placed.start ? formats.longDate(placed.end) : null,
    time: timeOf(placed),
  })) ?? titleOf(placed.item);
  const content = (placed: PlacedItem<TData>, piece: Pick<MonthSegment<TData>, 'before' | 'after' | 'span'>, placement: 'bar' | 'list'): ReactNode => {
    const time = timeOf(placed);
    if (renderItem) return renderItem(placed.item, Object.freeze({ time, continuesBefore: piece.before, continuesAfter: piece.after, span: piece.span, placement }));
    return <>
      {time !== null && !piece.before ? <span className={styles.time}>{time}</span> : null}
      <span className={styles.text} dir="auto">{titleOf(placed.item)}</span>
    </>;
  };
  const colourOf = (item: CgMonthCalendarItem<TData>): CSSProperties => (item.color ? { '--cg-month-calendar-item-color': item.color } as CSSProperties : {});

  // ---- Moving ------------------------------------------------------------------------------------
  const movable = (placed: PlacedItem<TData>) => onItemMove !== undefined && placed.item.movable !== false;
  const move = (placed: PlacedItem<TData>, days: number, source: 'pointer' | 'keyboard') => {
    if (!onItemMove || !days) return;
    const next = shiftItemDates(placed.item, days, timeZone);
    onItemMove(placed.item, Object.freeze({ start: next.start, end: next.end, days, source }));
    const message = labels.moved?.(placed.item, formats.longDate(placed.start + days));
    if (message) live.current?.announce(message);
  };
  const mark = (cells: HTMLElement[]) => {
    for (const cell of marked.current) if (!cells.includes(cell)) cell.removeAttribute('data-drop');
    for (const cell of cells) cell.setAttribute('data-drop', '');
    marked.current = cells;
  };

  // A drag is followed outside React: the days it would cover are marked in the DOM, and only the
  // drop is a call.
  const startDrag = (event: PointerEvent<HTMLDivElement>, placed: PlacedItem<TData>) => {
    if (event.button !== 0 || !movable(placed)) return;
    const source = event.currentTarget;
    if (!cgStartsDrag(event.target, source)) return;
    const scroller = scrollerRef.current;
    const press = { x: event.clientX, y: event.clientY };
    const length = placed.end - placed.start;
    let cells: Array<{ day: number; element: HTMLElement; rect: DOMRect }> = [];
    let origin = { left: 0, top: 0 };
    let grab = Number(source.dataset.firstDay);
    const dayAt = (x: number, y: number) => {
      const dx = (scroller?.scrollLeft ?? 0) - origin.left;
      const dy = (scroller?.scrollTop ?? 0) - origin.top;
      return cells.find(({ rect }) => x >= rect.left - dx && x < rect.right - dx && y >= rect.top - dy && y < rect.bottom - dy);
    };
    stopDrag.current?.();
    stopDrag.current = cgTrackDrag(event, source, {
      scroller,
      ghost: draggedCopy,
      onStart: () => {
        origin = { left: scroller?.scrollLeft ?? 0, top: scroller?.scrollTop ?? 0 };
        cells = [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-cg-month-day]') ?? [])]
          .map((element) => ({ day: Number(element.dataset.cgMonthDay), element, rect: element.getBoundingClientRect() }));
        grab = dayAt(press.x, press.y)?.day ?? grab;
      },
      onMove: (x, y) => {
        const cell = dayAt(x, y);
        if (!cell) { mark([]); return; }
        const from = cell.day - (grab - placed.start);
        mark(cells.filter(({ day }) => day >= from && day <= from + length).map(({ element }) => element));
      },
      onDrop: (x, y) => {
        mark([]);
        stopDrag.current = null;
        const cell = dayAt(x, y);
        if (!cell || cell.day === grab) return;
        if (source.ownerDocument.activeElement === source) requestFocus({ kind: 'item', key: placed.item.key, day: cell.day });
        move(placed, cell.day - grab, 'pointer');
      },
      onCancel: () => {
        mark([]);
        stopDrag.current = null;
      },
    });
  };

  // ---- Events ------------------------------------------------------------------------------------
  const onDayKeyDown = (event: KeyboardEvent<HTMLDivElement>, day: number) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Enter' && onCreate) {
      event.preventDefault();
      onCreate(dateOfDay(day), Object.freeze({ source: 'keyboard', anchor: event.currentTarget }));
      return;
    }
    const next = moveDay(day, event.key, getComputedStyle(event.currentTarget).direction === 'rtl', firstDay, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    if (next !== day) goToDay(next);
  };
  const onDayDoubleClick = (event: MouseEvent<HTMLDivElement>, day: number) => {
    if (!onCreate || (event.target instanceof Element && event.target.closest('button, [data-cg-month-item]'))) return;
    onCreate(dateOfDay(day), Object.freeze({ source: 'doubleClick', anchor: event.currentTarget }));
  };
  const onItemKeyDown = (event: KeyboardEvent<HTMLDivElement>, placed: PlacedItem<TData>) => {
    if (event.target !== event.currentTarget) return;
    if ((event.key === 'Enter' || event.key === ' ') && !event.altKey) {
      event.preventDefault();
      onItemOpen?.(placed.item, Object.freeze({ source: 'keyboard', anchor: event.currentTarget }));
      return;
    }
    if (!event.altKey || event.ctrlKey || event.metaKey || !movable(placed)) return;
    const step = moveStep(event.key, getComputedStyle(event.currentTarget).direction === 'rtl');
    if (step === null) return;
    event.preventDefault();
    const first = Number(event.currentTarget.dataset.firstDay);
    const last = Number(event.currentTarget.dataset.lastDay);
    const to = (activeDay >= first && activeDay <= last ? activeDay : first) + step;
    move(placed, step, 'keyboard');
    setActive(to);
    if (!sameMonth(monthOfDay(to), shown)) changeMonth(monthOfDay(to), 'move');
    requestFocus({ kind: 'item', key: placed.item.key, day: to });
  };

  // ---- Drawing -----------------------------------------------------------------------------------
  const piece = (segment: MonthSegment<TData>, weekStart: number) => {
    const { placed } = segment;
    const first = weekStart + segment.col;
    const last = first + segment.span - 1;
    const canMove = movable(placed);
    return <div
      key={`${placed.item.key}:${segment.week}`}
      role="button"
      className={styles.item}
      tabIndex={activeDay >= first && activeDay <= last ? 0 : -1}
      data-cg-month-item={placed.item.key}
      data-first-day={first}
      data-last-day={last}
      data-continues-before={segment.before ? '' : undefined}
      data-continues-after={segment.after ? '' : undefined}
      data-movable={canMove ? '' : undefined}
      aria-label={nameOf(placed)}
      aria-describedby={canMove && labels.moveHint ? hintId : undefined}
      aria-keyshortcuts={canMove ? MOVE_KEYS : undefined}
      style={{ gridColumn: `${segment.col + 1} / span ${segment.span}`, gridRow: segment.lane + 1, ...colourOf(placed.item) }}
      onClick={(event) => onItemOpen?.(placed.item, Object.freeze({ source: 'pointer', anchor: event.currentTarget }))}
      onKeyDown={(event) => onItemKeyDown(event, placed)}
      onPointerDown={(event) => startDrag(event, placed)}
    >{content(placed, segment, 'bar')}</div>;
  };

  const moreWeek = more ? layout.weeks[Math.floor((more.day - grid.start) / 7)] : undefined;
  const moreList = more && moreWeek ? itemsOnDay(moreWeek.pieces, more.day - moreWeek.start) : null;

  return <div
    {...nativeProps}
    ref={ref}
    className={cx(styles.root, className)}
    style={{ '--cg-month-calendar-rows': maxItemRows, ...style } as CSSProperties}
    data-cg-month-calendar=""
  >
    <div className={styles.header}>
      <div id={titleId} className={styles.title} aria-live="polite">{formats.monthHeading(shown)}</div>
      <div className={styles.navigation}>
        <CgButton appearance="ghost" size="small" aria-label={labels.previousMonth} title={labels.previousMonth} onClick={() => turn(-1)}><CgIcon name="chevron-start" /></CgButton>
        <CgButton appearance="outline" size="small" onClick={() => { setActive(todayDay); changeMonth(monthOfDay(todayDay), 'today'); }}>{labels.today}</CgButton>
        <CgButton appearance="ghost" size="small" aria-label={labels.nextMonth} title={labels.nextMonth} onClick={() => turn(1)}><CgIcon name="chevron-end" /></CgButton>
      </div>
    </div>
    <div ref={scrollerRef} className={styles.scroller}>
      <div role="grid" className={styles.grid} aria-label={labels.grid} aria-describedby={titleId} aria-readonly={onItemMove ? undefined : true}>
        <div role="row" className={styles.weekdays}>
          {formats.weekdays.map((name, index) => <div key={index} role="columnheader" className={styles.weekday} aria-label={name.long} title={name.long}>{name.short}</div>)}
        </div>
        {layout.weeks.map((week) => <div key={week.start} role="row" className={styles.week}>
          {Array.from({ length: 7 }, (_, col) => {
            const day = week.start + col;
            const selected = day === activeDay;
            const date = formats.longDate(day);
            const hidden = week.hidden[col] ?? 0;
            return <div
              key={day}
              role="gridcell"
              className={styles.day}
              tabIndex={selected ? 0 : -1}
              aria-label={date}
              aria-selected={selected}
              aria-current={day === todayDay ? 'date' : undefined}
              data-cg-month-day={day}
              data-outside={inMonth(day) ? undefined : ''}
              data-today={day === todayDay ? '' : undefined}
              onFocus={() => setActive(day)}
              onKeyDown={(event) => onDayKeyDown(event, day)}
              onDoubleClick={(event) => onDayDoubleClick(event, day)}
            >
              <span className={styles.number} aria-hidden="true">{formats.dayNumber(day)}</span>
              {onCreate ? <button
                type="button"
                className={styles.add}
                tabIndex={selected ? 0 : -1}
                aria-label={labels.create?.(date)}
                title={labels.create?.(date)}
                onClick={(event) => onCreate(dateOfDay(day), Object.freeze({ source: 'button', anchor: dayCell(event.currentTarget) }))}
              ><CgIcon name="add" /></button> : null}
              {hidden ? <button
                type="button"
                className={styles.more}
                tabIndex={selected ? 0 : -1}
                aria-label={labels.moreLabel?.(hidden, date)}
                aria-haspopup="dialog"
                aria-expanded={more?.day === day}
                onClick={(event) => setMore({ day, anchor: dayCell(event.currentTarget) })}
              >{labels.more(hidden)}</button> : null}
            </div>;
          })}
          {/* A row's children are its cells: the items drawn over the week's days are the cell after them. */}
          <div role="gridcell" className={styles.lanes} aria-label={labels.weekItems?.(formats.longDate(week.start), formats.longDate(week.start + 6))}>
            {week.shown.map((segment) => piece(segment, week.start))}
          </div>
        </div>)}
      </div>
    </div>
    {onItemMove && labels.moveHint ? <span id={hintId} hidden>{labels.moveHint}</span> : null}
    {onItemMove ? <CgLiveAnnouncer ref={live} /> : null}
    {more && moreList ? <CgFlyout
      anchor={more.anchor}
      open
      onOpenChange={(open) => { if (!open) setMore(null); }}
      autoFocus
      returnFocusOnClose
      placement="bottom-start"
      minWidth="14rem"
      maxWidth="min(20rem, calc(100vw - 8px))"
      role="dialog"
      aria-label={labels.dayItems(formats.longDate(more.day))}
      data-cg-month-more=""
    >
      <ul className={styles.moreList}>
        {moreList.map((placed, index) => <li key={placed.item.key}>
          <button
            type="button"
            className={styles.moreItem}
            style={colourOf(placed.item)}
            aria-label={nameOf(placed)}
            data-cg-initial-focus={index === 0 ? '' : undefined}
            onClick={() => {
              const anchor = more.anchor;
              setMore(null);
              onItemOpen?.(placed.item, Object.freeze({ source: 'list', anchor }));
            }}
          >{content(placed, { before: false, after: false, span: Math.min(7, placed.end - placed.start + 1) }, 'list')}</button>
        </li>)}
      </ul>
    </CgFlyout> : null}
  </div>;
}

export const CgMonthCalendar = forwardRef(CgMonthCalendarInner) as <TData = unknown>(
  props: CgMonthCalendarProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
