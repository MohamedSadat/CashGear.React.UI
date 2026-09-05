import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { CgDayOfWeek } from '../../types/date';
import { useControllableState, useDirection, useStableCallback } from '../../hooks';
import { localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import { CgButton } from '../Button';
import { CgPopup } from '../Popup';
import { cx } from '../../utils';
import type { CgSchedulerAppointmentContext, CgSchedulerAppointmentDraft, CgSchedulerOperationHandler, CgSchedulerProps, CgSchedulerTimeCellContext, CgSchedulerView } from './CgScheduler.types';
import { addDays, boundary, civil, DAY, dayIndex, fromLocalInput, instant, iso, localInput, localParts, MINUTE, navigateDate, slots, timeMinutes, visibleDates, visibleRange, WEEKDAYS, WORKING_DAYS, zonedInstant } from './schedulerDate';
import { draftOf, layout, layoutDates, project } from './schedulerLayout';
import type { Appointment, Segment } from './schedulerLayout';
import { arabic, english } from './schedulerLabels';
import { useSchedulerPointer } from './useSchedulerPointer';
import type { PointerCell } from './useSchedulerPointer';
import styles from './CgScheduler.module.css';

const VIEWS: readonly CgSchedulerView[] = ['day', 'workWeek', 'week', 'month', 'timeline'];
const EMPTY: readonly never[] = [];
const systemNow = () => new Date().toISOString();
interface Editor<T> { appointment: Appointment<T> | null; draft: CgSchedulerAppointmentDraft }
function positive(value: number, name: string, max: number) { if (!Number.isInteger(value) || value <= 0 || value > max) throw new Error(`CgScheduler ${name} must be an integer between 1 and ${max}.`); }

export function CgScheduler<TItem>(props: CgSchedulerProps<TItem>) {
  const root = useRef<HTMLDivElement>(null); const scroll = useRef<HTMLDivElement>(null);
  const direction = useDirection(root, props.direction);
  const locale = props.locale ?? 'en-US'; const zone = props.displayTimeZone ?? 'UTC';
  const labels = { ...(locale.startsWith('ar') ? arabic : english), ...props.labels };
  const clock = props.now ?? systemNow;
  const [now, setNow] = useState(() => instant(clock()));
  // Synchronize an externally supplied clock and its timer subscription.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNow(instant(clock())); const timer = setInterval(() => setNow(instant(clock())), 60_000); return () => clearInterval(timer); }, [clock]);
  const todayDate = localParts(now, zone).date;
  const [date, setDate] = useControllableState(props.selectedDate, props.defaultSelectedDate ?? todayDate, 'CgScheduler.selectedDate');
  const [view, setView] = useControllableState(props.currentView, props.defaultCurrentView ?? 'week', 'CgScheduler.currentView');
  const [selected, setSelected] = useControllableState(props.selectedAppointmentId, props.defaultSelectedAppointmentId ?? null, 'CgScheduler.selectedAppointmentId');
  if (!VIEWS.includes(view)) throw new Error('Invalid CgScheduler view.');
  const interval = props.timeInterval ?? 30; const minimum = Math.ceil((props.minimumAppointmentDuration ?? 30) / interval) * interval;
  const dayCount = props.dayCount ?? 1; const monthCount = props.monthCount ?? 1; const monthLimit = props.monthAppointmentLimit ?? 3;
  const timelineDuration = props.timelineDuration ?? 1440; const timelineScale = props.timelineScale ?? 60;
  positive(interval, 'timeInterval', 1440); positive(minimum, 'minimumAppointmentDuration', 525600);
  positive(dayCount, 'dayCount', 31); positive(monthCount, 'monthCount', 12); positive(monthLimit, 'monthAppointmentLimit', 100);
  positive(timelineDuration, 'timelineDuration', 44640); positive(timelineScale, 'timelineScale', 44640);
  const workingKey = (props.workingDays ?? WORKING_DAYS).join(',');
  const working = useMemo(() => workingKey.split(',') as CgDayOfWeek[], [workingKey]);
  if (!working.length || working.some((day) => !WEEKDAYS.includes(day))) throw new Error('CgScheduler workingDays must contain valid weekdays.');
  const first = props.firstDayOfWeek ? WEEKDAYS.indexOf(props.firstDayOfWeek) : localeFirstDayOfWeek(locale);
  if (first < 0) throw new Error('Invalid CgScheduler firstDayOfWeek.');
  const workStart = timeMinutes(props.workDayStart ?? '08:00'); const workEnd = timeMinutes(props.workDayEnd ?? '17:00');
  const visibleStart = props.showWorkTimeOnly ? workStart : timeMinutes(props.visibleDayStart ?? '00:00');
  const visibleEnd = props.showWorkTimeOnly ? workEnd : timeMinutes(props.visibleDayEnd ?? '24:00');
  if (workEnd <= workStart || visibleEnd <= visibleStart) throw new Error('CgScheduler day end must be after day start.');
  const dates = useMemo(() => visibleDates(date, view, first, working, dayCount, monthCount), [date, view, first, working, dayCount, monthCount]);
  const range = useMemo(() => visibleRange(dates, zone, view === 'timeline' ? timelineDuration : undefined), [dates, zone, view, timelineDuration]);
  const rangeKey = `${range.start}/${range.end}/${view}/${zone}`;
  const rangeChanged = useStableCallback(props.onVisibleRangeChange);
  useEffect(() => { rangeChanged(range, view); }, [range, view, rangeChanged]);
  const [reload, setReload] = useState(0);
  const [remote, setRemote] = useState<{ key: string; items: readonly TItem[]; loading: boolean; error: boolean }>({ key: '', items: [], loading: false, error: false });
  const provider = props.itemsProvider;
  useEffect(() => {
    if (!provider) return;
    const controller = new AbortController();
    // Request lifecycle state belongs to this external provider subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemote({ key: rangeKey, items: [], loading: true, error: false });
    void Promise.resolve().then(() => provider({ range, view, signal: controller.signal })).then((items) => {
      if (!controller.signal.aborted) setRemote({ key: rangeKey, items, loading: false, error: false });
    }, () => { if (!controller.signal.aborted) setRemote({ key: rangeKey, items: [], loading: false, error: true }); });
    return () => controller.abort();
  }, [provider, range, view, rangeKey, reload]);
  const loading = !!provider && (remote.key !== rangeKey || remote.loading);
  const loadError = !!provider && remote.key === rangeKey && remote.error;
  const items = props.items ?? (remote.key === rangeKey ? remote.items : EMPTY);
  // Selectors are caller-owned and may change independently of items.
  const appointments = project(items, props).filter((a) => a.startMs < instant(range.end) && a.endMs > instant(range.start));
  const [slotSelection, setSlotSelection] = useState<CgSchedulerTimeCellContext | null>(null);
  const [focusKey, setFocusKey] = useState('');
  const [editor, setEditor] = useState<Editor<TItem> | null>(null);
  const [deleting, setDeleting] = useState<Appointment<TItem> | null>(null);
  const [moreDate, setMoreDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CgSchedulerAppointmentDraft, string>>>({});
  const operation = useRef<AbortController | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragAppointment = useRef<Appointment<TItem> | null>(null);
  const [preview, setPreview] = useState<{ key: string | null; draft: CgSchedulerAppointmentDraft } | null>(null);
  const writable = !props.readOnly && !props.disabled;
  const canCreate = writable && props.allowCreateAppointment !== false && !!props.onAppointmentCreating;
  const canEdit = writable && props.allowEditAppointment !== false && !!props.onAppointmentUpdating;
  const canDelete = writable && props.allowDeleteAppointment !== false && !!props.onAppointmentDeleting;
  const canDrag = writable && props.allowDragAppointment !== false && !!props.onAppointmentDragging;
  const canResize = writable && props.allowResizeAppointment !== false && !!props.onAppointmentResizing;
  const abortOperation = useStableCallback(() => { operation.current?.abort(); operation.current = null; setBusy(false); });
  // Navigation and host permission changes invalidate pending external operations and their UI.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { abortOperation(); setEditor(null); setDeleting(null); setMoreDate(null); setSlotSelection(null); setPreview(null); setError(''); setFocusKey(''); if (clickTimer.current) clearTimeout(clickTimer.current); }, [rangeKey, writable, abortOperation]);
  useEffect(() => () => { operation.current?.abort(); if (clickTimer.current) clearTimeout(clickTimer.current); }, []);
  const daySlots = useMemo(() => dates.map((d) => slots(d, zone, interval, working, workStart, workEnd, visibleStart, visibleEnd)), [dates, zone, interval, working, workStart, workEnd, visibleStart, visibleEnd]);
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }), [locale, zone]);
  const shortTimeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit' }), [locale, zone]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }), [locale]);
  const longDate = (d: string) => dateFormat.format(civil(d));
  const context = (a: Appointment<TItem>, before = false, after = false): CgSchedulerAppointmentContext<TItem> => ({ ...draftOf(a), item: a.item, id: a.id, isSelected: selected === a.id, continuesBefore: before, continuesAfter: after, view });
  const choose = (a: Appointment<TItem> | null, slot: CgSchedulerTimeCellContext | null) => {
    if (props.disabled) return;
    const id = a?.id ?? null;
    if (selected === id && slotSelection?.start === slot?.start && slotSelection?.end === slot?.end && slotSelection?.isAllDay === slot?.isAllDay) return;
    if (selected !== id) { setSelected(id); props.onSelectedAppointmentIdChange?.(id); }
    setSlotSelection(slot);
    props.onSelectionChange?.({ appointment: a?.item ?? null, appointmentId: id, slot });
  };
  const navigate = (direction: -1 | 1) => { if (!props.disabled) { const next = navigateDate(date, view, direction); setDate(next); props.onSelectedDateChange?.(next); } };
  const changeView = (next: CgSchedulerView) => { setView(next); props.onCurrentViewChange?.(next); };
  const goToday = () => { setDate(todayDate); props.onSelectedDateChange?.(todayDate); };
  const clearErrors = () => { setError(''); setFieldErrors({}); };
  const openEditor = (appointment: Appointment<TItem> | null, cell?: CgSchedulerTimeCellContext) => {
    if (busy || (appointment ? !canEdit : !canCreate)) return;
    clearErrors(); setMoreDate(null);
    setEditor({ appointment, draft: appointment ? draftOf(appointment) : { title: '', start: cell!.start, end: cell!.isAllDay ? cell!.end : iso(Math.max(instant(cell!.end), instant(cell!.start) + minimum * MINUTE)), isAllDay: cell!.isAllDay, description: '', color: '' } });
  };
  const closeEditor = () => { abortOperation(); setEditor(null); setDeleting(null); clearErrors(); };
  const run = async (handler: CgSchedulerOperationHandler<TItem> | undefined, appointment: Appointment<TItem> | null, draft: CgSchedulerAppointmentDraft, source: 'editor' | 'drag' | 'resize', edge?: 'start' | 'end') => {
    if (!handler || operation.current || !writable) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); clearErrors();
    try {
      const result = await handler({ originalItem: appointment?.item ?? null, original: appointment ? Object.freeze(draftOf(appointment)) : null, draft: Object.freeze({ ...draft }), source, edge }, controller.signal);
      if (controller.signal.aborted || operation.current !== controller) return;
      if (result.success) { setEditor(null); setDeleting(null); if (provider) setReload((n) => n + 1); }
      else { setError(result.error ?? labels.operationError); setFieldErrors(result.fieldErrors ?? {}); }
    } catch { if (!controller.signal.aborted && operation.current === controller) setError(labels.operationError); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); } }
  };
  const cellContext = (cell: PointerCell): CgSchedulerTimeCellContext => ({ date: cell.date, start: iso(cell.start), end: iso(cell.end), label: cell.allDay ? `${longDate(cell.date)} ${labels.allDay}` : `${longDate(cell.date)} ${timeFormat.format(cell.start)}`, isAllDay: cell.allDay, isWorkingTime: working.includes(WEEKDAYS[dayIndex(cell.date)]!) && localParts(cell.start, zone).minutes >= workStart && localParts(cell.start, zone).minutes < workEnd, isSelected: !!slotSelection && cell.start >= instant(slotSelection.start) && cell.end <= instant(slotSelection.end) && cell.allDay === slotSelection.isAllDay, view });
  const proposal = (origin: PointerCell, target: PointerCell, kind: string) => {
    const a = dragAppointment.current;
    if (kind === 'select' || !a) return { title: '', description: '', color: '', isAllDay: origin.allDay, start: iso(Math.min(origin.start, target.start)), end: iso(Math.max(origin.end, target.end)) };
    const draft = draftOf(a); const delta = Math.round((target.start - origin.start) / (interval * MINUTE)) * interval * MINUTE;
    const days = (civil(target.date) - civil(origin.date)) / DAY;
    const shift = (value: number) => { const local = localParts(value, zone); return a.isAllDay ? boundary(addDays(local.date, days), zone) : origin.allDay ? zonedInstant(addDays(local.date, days), local.minutes, zone) + local.seconds * 1000 + ((value % 1000) + 1000) % 1000 : value + delta; };
    if (kind === 'drag') { draft.start = iso(shift(a.startMs)); draft.end = iso(shift(a.endMs)); }
    else if (kind === 'start') draft.start = iso(Math.min(shift(a.startMs), a.isAllDay ? boundary(addDays(localParts(a.endMs, zone).date, -1), zone) : a.endMs - minimum * MINUTE));
    else draft.end = iso(Math.max(shift(a.endMs), a.isAllDay ? boundary(addDays(localParts(a.startMs, zone).date, 1), zone) : a.startMs + minimum * MINUTE));
    return draft;
  };
  const pointer = useSchedulerPointer(root, scroll, (origin, target, kind) => setPreview({ key: dragAppointment.current?.key ?? null, draft: proposal(origin, target, kind) }), (origin, target, kind) => {
    const draft = proposal(origin, target, kind);
    if (kind === 'select') { choose(null, cellContext({ date: localParts(instant(draft.start), zone).date, start: instant(draft.start), end: instant(draft.end), allDay: draft.isAllDay })); }
    else { const a = dragAppointment.current; if (a && (draft.start !== a.start || draft.end !== a.end)) void run(kind === 'drag' ? props.onAppointmentDragging : props.onAppointmentResizing, a, draft, kind === 'drag' ? 'drag' : 'resize', kind === 'start' || kind === 'end' ? kind : undefined); }
  }, () => { setPreview(null); dragAppointment.current = null; });
  const cancelPointer = useStableCallback(pointer.cancel);
  useEffect(() => { cancelPointer(); }, [rangeKey, writable, cancelPointer]);
  const delayClick = (fn: () => void) => { if (clickTimer.current) clearTimeout(clickTimer.current); clickTimer.current = setTimeout(fn, 250); };
  const cancelClick = () => { if (clickTimer.current) clearTimeout(clickTimer.current); };
  const defaultFocus = view === 'timeline' ? `cell:${range.start}` : `cell:${iso(boundary(dates[0]!, zone))}:all`;
  useEffect(() => {
    // Restore the roving entry point when host data removes/moves the focused appointment.
    if (!props.disabled && root.current && !root.current.querySelector('[data-focus-key][tabindex="0"]')) {
      setFocusKey(defaultFocus);
    }
  }, [appointments, props.disabled, defaultFocus, focusKey]);
  const tabIndex = (key: string) => props.disabled ? -1 : (focusKey || defaultFocus) === key ? 0 : -1;
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.disabled || !(event.target instanceof HTMLElement)) return;
    if (event.key === 'Escape') { event.preventDefault(); pointer.cancel(); closeEditor(); choose(null, null); return; }
    const target = event.target.closest<HTMLElement>('[data-focus-key]');
    if (!target) return;
    if (event.key === 'Delete') { const a = appointments.find((item) => item.key === target.dataset.appointment); if (a && canDelete && !busy) { event.preventDefault(); clearErrors(); setDeleting(a); } return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const candidates = [...root.current!.querySelectorAll<HTMLElement>('[data-focus-key]')];
    const col = Number(target.dataset.col); const row = Number(target.dataset.row);
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    let next: HTMLElement | undefined;
    if (event.key === 'Home' || event.key === 'End') next = event.key === 'Home' ? candidates[0] : candidates.at(-1);
    else {
      const c = col + (horizontal ? delta * (direction === 'rtl' ? -1 : 1) : 0); const r = row + (horizontal ? 0 : delta);
      next = candidates.find((el) => Number(el.dataset.col) === c && Number(el.dataset.row) === r);
      if (!next) next = candidates[candidates.indexOf(target) + delta];
    }
    if (next) { setFocusKey(next.dataset.focusKey!); next.focus(); next.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  };
  const renderCell = (cell: PointerCell, col: number, row: number, child?: ReactNode, style?: CSSProperties) => {
    const ctx = cellContext(cell); const key = `cell:${ctx.start}${cell.allDay ? ':all' : ''}`;
    const inPreview = preview?.key === null && cell.allDay === preview.draft.isAllDay && cell.start >= instant(preview.draft.start) && cell.start < instant(preview.draft.end);
    return <button key={key} type="button" role="gridcell" data-scheduler-cell data-start={cell.start} data-end={cell.end} data-date={cell.date} data-all-day={cell.allDay} data-axis={view === 'timeline' ? 'horizontal' : 'vertical'} data-interval={interval} data-direction={direction} data-focus-key={key} data-col={col} data-row={row} tabIndex={tabIndex(key)} disabled={props.disabled} aria-label={ctx.label} aria-selected={ctx.isSelected || !!inPreview} className={cx(styles.cell, ctx.isWorkingTime && styles.working, cell.allDay && styles.allDayCell)} style={style} onFocus={() => setFocusKey(key)}
      onPointerDown={(event) => { if (writable && !busy) { dragAppointment.current = null; pointer.start(event, 'select'); } }}
      onClick={(event) => { if (pointer.suppressClick.current) { pointer.suppressClick.current = false; return; } choose(null, ctx); if (event.detail === 0) openEditor(null, ctx); else delayClick(() => props.onTimeCellClick?.(ctx)); }}
      onDoubleClick={() => { cancelClick(); props.onTimeCellDoubleClick?.(ctx); openEditor(null, ctx); }}>
      {props.renderTimeCell?.(ctx) ?? child}
    </button>;
  };
  const renderAppointment = (segment: Segment<TItem>, style: CSSProperties, col: number, row: number, horizontal = false, suffix = '') => {
    const a = segment.appointment; const ctx = context(a, segment.continuesBefore, segment.continuesAfter); const key = `appointment:${a.key}:${suffix}`;
    const origin: PointerCell = { start: segment.start, end: segment.end, date: localParts(segment.start, zone).date, allDay: a.isAllDay || view === 'month' };
    const startPointer = (event: React.PointerEvent<HTMLElement>, kind: string) => { event.stopPropagation(); if (busy || (kind === 'drag' ? !canDrag : !canResize)) return; dragAppointment.current = a; pointer.start(event, kind, origin); };
    return <div key={key} role="gridcell" className={cx(styles.appointmentBox, horizontal && styles.horizontal)} style={{ ...style, '--cg-scheduler-appointment-color': a.color || undefined } as CSSProperties}>
      <button type="button" disabled={props.disabled} className={cx(styles.appointment, a.className)} data-appointment={a.key} data-focus-key={key} data-col={col} data-row={row} tabIndex={tabIndex(key)} aria-pressed={ctx.isSelected} aria-label={`${a.title}, ${a.isAllDay ? labels.allDay : timeFormat.format(a.startMs)}, ${longDate(localParts(a.startMs, zone).date)}`} onFocus={() => setFocusKey(key)} onPointerDown={(e) => startPointer(e, 'drag')}
        onClick={(event) => { if (pointer.suppressClick.current) { pointer.suppressClick.current = false; return; } if (selected !== a.id) choose(a, null); if (event.detail === 0) openEditor(a); else delayClick(() => props.onAppointmentClick?.(ctx)); }}
        onDoubleClick={() => { cancelClick(); props.onAppointmentDoubleClick?.(ctx); openEditor(a); }}>
        {props.renderAppointment?.(ctx) ?? <><span className={styles.appointmentTitle}>{ctx.continuesBefore && '‹ '}{a.title}{ctx.continuesAfter && ' ›'}</span>{!horizontal && !a.isAllDay && <small>{shortTimeFormat.format(a.startMs)} – {shortTimeFormat.format(a.endMs)}</small>}</>}
      </button>
      {canResize && <><span aria-hidden="true" data-resize="start" title={labels.resizeStart} className={cx(styles.resize, styles.resizeStart)} onPointerDown={(e) => startPointer(e, 'start')} /><span aria-hidden="true" data-resize="end" title={labels.resizeEnd} className={cx(styles.resize, styles.resizeEnd)} onPointerDown={(e) => startPointer(e, 'end')} /></>}
    </div>;
  };
  const header = (d: string) => props.renderDateHeader?.({ date: d, label: longDate(d), isToday: d === todayDate, view }) ?? <span className={d === todayDate ? styles.today : undefined}>{longDate(d)}</span>;
  const effectiveAppointments = preview?.key ? appointments.map((a) => a.key === preview.key ? { ...a, ...preview.draft, startMs: instant(preview.draft.start), endMs: instant(preview.draft.end) } : a) : appointments;
  const renderDateBand = (bandDates: string[], month: boolean, weekIndex: number) => {
    const start = boundary(bandDates[0]!, zone); const end = boundary(addDays(bandDates.at(-1)!, 1), zone);
    const segments = layoutDates(effectiveAppointments.filter((a) => month || a.isAllDay), start, end, zone);
    const laneCount = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
    const height = month ? 34 + monthLimit * 27 + 30 : Math.max(40, laneCount * 27 + 8);
    return <div key={bandDates[0]} role="row" className={styles.dateBand} style={{ height, gridTemplateColumns: `repeat(${bandDates.length}, minmax(${month ? 96 : 136}px, 1fr))` }}>
      {bandDates.map((d, col) => renderCell({ start: boundary(d, zone), end: boundary(addDays(d, 1), zone), date: d, allDay: true }, col, month ? weekIndex : -1, month ? <span className={styles.monthDate}>{header(d)}</span> : labels.allDay))}
      {segments.filter((s) => !month || s.lane < monthLimit).map((s) => {
        const covered = bandDates.map((d, i) => ({ d, i })).filter(({ d }) => s.start < boundary(addDays(d, 1), zone) && s.end > boundary(d, zone));
        if (!covered.length) return null;
        const col = covered[0]!.i; const span = covered.length;
        return renderAppointment(s, { insetInlineStart: `calc(${col / bandDates.length * 100}% + 3px)`, width: `calc(${span / bandDates.length * 100}% - 6px)`, top: (month ? 34 : 4) + s.lane * 27, height: 24 }, col, month ? weekIndex : -1, true, `${weekIndex}:all`);
      })}
      {month && bandDates.map((d, col) => { const count = segments.filter((s) => s.lane >= monthLimit && s.start < boundary(addDays(d, 1), zone) && s.end > boundary(d, zone)).length; return count ? <div role="gridcell" key={`more:${d}`} className={styles.more} style={{ insetInlineStart: `${col / 7 * 100}%`, width: `${100 / 7}%` }}><button type="button" disabled={props.disabled} onClick={() => setMoreDate(d)}>{labels.more(count)}</button></div> : null; })}
    </div>;
  };
  const renderTimeGrid = () => <>
    <div role="row" className={styles.headers} style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(136px, 1fr))` }}><div role="columnheader">{labels.start}</div>{dates.map((d) => <div role="columnheader" key={d}>{header(d)}</div>)}</div>
    <div className={styles.banded}>{renderDateBand(dates, false, 0)}</div>
    <div className={styles.timeColumns} style={{ gridTemplateColumns: `64px repeat(${dates.length}, minmax(136px, 1fr))` }}>
      <div role="row" className={styles.gutter}>{daySlots[0]?.map((slot) => <div role="rowheader" key={slot.start} style={{ height: 32 }}>{shortTimeFormat.format(slot.start)}</div>)}</div>
      {daySlots.map((day, col) => { const start = day[0]?.start; const end = day.at(-1)?.end;
        const segments = start !== undefined && end !== undefined ? layout(effectiveAppointments.filter((a) => !a.isAllDay), start, end) : [];
        const position = (value: number) => { const i = day.findIndex((slot) => value < slot.end); if (i < 0) return day.length; const slot = day[i]!; return i + Math.max(0, (value - slot.start) / (slot.end - slot.start)); };
        return <div role="row" className={styles.timeColumn} key={dates[col]} style={{ height: day.length * 32 }}>
          {day.map((slot, row) => renderCell({ ...slot, allDay: false }, col, row, daySlots[0]?.[row]?.minutes !== slot.minutes ? <span className={styles.timeLabel}>{shortTimeFormat.format(slot.start)}</span> : undefined, { height: 32 }))}
          {segments.map((segment) => renderAppointment(segment, { top: position(segment.start) * 32, height: Math.max(20, (position(segment.end) - position(segment.start)) * 32 - 2), insetInlineStart: `calc(3px + (100% - 4px) * ${segment.lane / segment.lanes})`, width: `calc((100% - 4px) / ${segment.lanes} - 2px)` }, col, Math.floor(position(segment.start)), false, dates[col]))}
          {props.showCurrentTimeIndicator !== false && start !== undefined && end !== undefined && now >= start && now < end && <div className={styles.now} style={{ top: position(now) * 32 }} aria-hidden="true" />}
        </div>;
      })}
    </div>
  </>;
  const renderTimeline = () => {
    const start = instant(range.start); const end = instant(range.end); const count = Math.ceil((end - start) / (timelineScale * MINUTE)); const cellWidth = props.timelineCellMinWidth ?? 96;
    const segments = layout(effectiveAppointments, start, end); const laneCount = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
    const columns = Array.from({ length: count }, (_, i) => `minmax(0, ${Math.min(timelineScale, timelineDuration - i * timelineScale)}fr)`).join(' ');
    return <div className={styles.timeline} style={{ minWidth: timelineDuration / timelineScale * cellWidth }}>
      <div role="row" className={styles.headers} style={{ gridTemplateColumns: columns }}>{Array.from({ length: count }, (_, i) => <div role="columnheader" key={i}>{shortTimeFormat.format(start + i * timelineScale * MINUTE)}</div>)}</div>
      <div role="row" className={styles.timelineBody} style={{ height: Math.max(180, laneCount * 40 + 20), gridTemplateColumns: columns }}>
        {Array.from({ length: count }, (_, i) => { const time = start + i * timelineScale * MINUTE; return renderCell({ start: time, end: Math.min(end, time + timelineScale * MINUTE), date: localParts(time, zone).date, allDay: false }, i, 0); })}
        {segments.map((s) => renderAppointment(s, { insetInlineStart: `${(s.start - start) / (end - start) * 100}%`, width: `${(s.end - s.start) / (end - start) * 100}%`, top: s.lane * 40 + 8, height: 34 }, Math.floor((s.start - start) / (timelineScale * MINUTE)), 0, true, 'timeline'))}
        {props.showCurrentTimeIndicator !== false && now >= start && now < end && <div className={styles.timelineNow} style={{ insetInlineStart: `${(now - start) / (end - start) * 100}%` }} aria-hidden="true" />}
      </div>
    </div>;
  };
  const saveEditor = () => {
    if (!editor) return;
    const draft = editor.draft; const errors: typeof fieldErrors = {};
    if (!draft.title.trim()) errors.title = labels.requiredTitle;
    try { if (instant(draft.end) <= instant(draft.start)) errors.end = labels.invalidDates; } catch { errors.start = labels.invalidDates; }
    if (Object.keys(errors).length) { setFieldErrors(errors); setError(labels.invalidDates); return; }
    void run(editor.appointment ? props.onAppointmentUpdating : props.onAppointmentCreating, editor.appointment, draft, 'editor');
  };
  const editorFields = () => {
    if (!editor) return null;
    const draft = editor.draft;
    const update = (next: CgSchedulerAppointmentDraft) => { if (!busy) setEditor({ ...editor, draft: next }); };
    if (props.renderEditor) return props.renderEditor({ item: editor.appointment?.item ?? null, draft: { ...draft }, setDraft: update, busy, fieldErrors });
    return <div className={styles.fields}>
      <label>{labels.title}<input name="title" autoFocus value={draft.title} disabled={busy} aria-invalid={!!fieldErrors.title} onChange={(e) => update({ ...draft, title: e.target.value })} /></label>
      <label className={styles.checkbox}><input type="checkbox" checked={draft.isAllDay} disabled={busy} onChange={(e) => { const isAllDay = e.target.checked; const startDate = localParts(instant(draft.start), zone).date; const endDate = localParts(instant(draft.end), zone).date; update({ ...draft, isAllDay, ...(isAllDay ? { start: iso(boundary(startDate, zone)), end: iso(boundary(endDate > startDate ? endDate : addDays(startDate, 1), zone)) } : {}) }); }} />{labels.allDay}</label>
      {(['start', 'end'] as const).map((field) => <label key={field}>{labels[field]}<input name={field} type={draft.isAllDay ? 'date' : 'datetime-local'} value={draft.isAllDay ? localParts(instant(draft[field]), zone).date : localInput(draft[field], zone)} disabled={busy} aria-invalid={!!fieldErrors[field]} onChange={(e) => { if (!e.target.value) return; try { update({ ...draft, [field]: draft.isAllDay ? iso(boundary(e.target.value, zone)) : fromLocalInput(e.target.value, zone) }); } catch { setFieldErrors({ [field]: labels.invalidDates }); } }} /></label>)}
      <small>{labels.timeZone}: {zone}</small>
      <label>{labels.description}<textarea name="description" value={draft.description} disabled={busy} onChange={(e) => update({ ...draft, description: e.target.value })} /></label>
      <label>{labels.color}<input name="color" value={draft.color} disabled={busy} onChange={(e) => update({ ...draft, color: e.target.value })} /></label>
    </div>;
  };
  return <div ref={root} id={props.id} dir={direction} className={cx(styles.root, props.className)} style={{ height: props.height ?? '42rem', ...props.style }} aria-label={props['aria-label'] ?? labels.scheduler} role="region" aria-disabled={props.disabled || undefined}>
    {props.showToolbar !== false && <div className={styles.toolbar}>{props.renderToolbar?.({ selectedDate: date, currentView: view, range, navigate, today: goToday, changeView, refresh: () => setReload((n) => n + 1) }) ?? <>
      <CgButton appearance="outline" disabled={props.disabled} aria-label={labels.previous} onClick={() => navigate(-1)}>{direction === 'rtl' ? '›' : '‹'}</CgButton>
      <CgButton appearance="outline" disabled={props.disabled} onClick={goToday}>{labels.today}</CgButton>
      <CgButton appearance="outline" disabled={props.disabled} aria-label={labels.next} onClick={() => navigate(1)}>{direction === 'rtl' ? '‹' : '›'}</CgButton>
      <strong className={styles.heading}>{longDate(range.startDate)} – {longDate(addDays(range.endDate, -1))}</strong>
      <select aria-label={labels.view} value={view} disabled={props.disabled} onChange={(e) => changeView(e.target.value as CgSchedulerView)}>{VIEWS.map((v) => <option key={v} value={v}>{labels[v]}</option>)}</select>
      {canCreate && <CgButton onClick={() => openEditor(null, slotSelection ?? cellContext({ date, start: zonedInstant(date, workStart, zone), end: zonedInstant(date, workStart, zone) + minimum * MINUTE, allDay: false }))}>{labels.create}</CgButton>}
    </>}</div>}
    <div className={styles.status} role="status" aria-live="polite">{loading ? labels.loading : preview ? `${preview.draft.title} ${timeFormat.format(instant(preview.draft.start))} – ${timeFormat.format(instant(preview.draft.end))}` : ''}</div>
    {loadError && <div role="alert">{labels.loadError} <CgButton onClick={() => setReload((n) => n + 1)}>{labels.retry}</CgButton></div>}
    {error && !editor && !deleting && <div role="alert" className={styles.error}>{error}</div>}
    <div ref={scroll} className={styles.scroll} role="grid" aria-label={labels.scheduler} aria-readonly={!writable} aria-busy={loading || busy} onKeyDown={onGridKey} onPointerMove={pointer.move} onPointerUp={pointer.end} onPointerCancel={pointer.cancel} onLostPointerCapture={pointer.cancel}>
      {view === 'month' ? Array.from({ length: dates.length / 7 }, (_, i) => renderDateBand(dates.slice(i * 7, i * 7 + 7), true, i)) : view === 'timeline' ? renderTimeline() : renderTimeGrid()}
    </div>
    <CgPopup open={!!editor && !deleting} onOpenChange={(open) => { if (!open) closeEditor(); }} headerText={editor?.appointment ? labels.edit : labels.create} width="min(34rem, 94vw)" showFooter footer={<div className={styles.actions}><CgButton disabled={busy} onClick={saveEditor}>{labels.save}</CgButton>{editor?.appointment && canDelete && <CgButton disabled={busy} appearance="outline" onClick={() => setDeleting(editor.appointment)}>{labels.delete}</CgButton>}<CgButton appearance="outline" onClick={closeEditor}>{labels.cancel}</CgButton></div>}>
      <div dir={direction}>{editorFields()}{error && <div role="alert" className={styles.error}>{error}{Object.entries(fieldErrors).map(([field, message]) => <div key={field}>{message}</div>)}</div>}</div>
    </CgPopup>
    <CgPopup open={!!deleting} role="alertdialog" onOpenChange={(open) => { if (!open) { abortOperation(); setDeleting(null); } }} headerText={labels.deleteConfirmation} showFooter footer={<div className={styles.actions}><CgButton disabled={busy} onClick={() => { if (deleting) void run(props.onAppointmentDeleting, deleting, draftOf(deleting), 'editor'); }}>{labels.delete}</CgButton><CgButton appearance="outline" onClick={() => { abortOperation(); setDeleting(null); }}>{labels.cancel}</CgButton></div>}>
      {deleting?.title}{error && <div role="alert">{error}</div>}
    </CgPopup>
    <CgPopup open={!!moreDate} onOpenChange={(open) => { if (!open) setMoreDate(null); }} headerText={moreDate ? longDate(moreDate) : ''}>
      <div className={styles.moreList}>{moreDate && appointments.filter((a) => a.startMs < boundary(addDays(moreDate, 1), zone) && a.endMs > boundary(moreDate, zone)).map((a) => <CgButton key={a.key} appearance="outline" onClick={() => { choose(a, null); openEditor(a); }}>{a.title}</CgButton>)}</div>
    </CgPopup>
  </div>;
}
