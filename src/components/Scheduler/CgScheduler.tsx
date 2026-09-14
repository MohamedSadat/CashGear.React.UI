import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import type { CgDayOfWeek } from '../../types/date';
import { useControllableState, useDirection, useStableCallback } from '../../hooks';
import { localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import { CgButton } from '../Button';
import { CgPopup } from '../Popup';
import type { CgPopupActions } from '../Popup';
import { cx } from '../../utils';
import type { CgSchedulerAppointmentContext, CgSchedulerAppointmentDraft, CgSchedulerOperationHandler, CgSchedulerRecurrenceEditScope, CgSchedulerResource, CgSchedulerPopupContext, CgSchedulerProps, CgSchedulerTimeCellContext, CgSchedulerView } from './CgScheduler.types';
import { addDays, boundary, civil, DAY, dayIndex, fromLocalInput, instant, iso, localInput, localParts, MINUTE, navigateDate, slots, timeMinutes, visibleDates, visibleRange, WEEKDAYS, WORKING_DAYS, zonedInstant } from './schedulerDate';
import { draftOf, expandAppointments, layout, layoutDates, project } from './schedulerLayout';
import type { Appointment, Segment } from './schedulerLayout';
import { snapshotRecurrence, validateRecurrence } from './schedulerRecurrence';
import { SchedulerMetadataFields } from './SchedulerMetadataFields';
import { useSchedulerPopupGate } from './useSchedulerPopupGate';
import { SchedulerRecurrenceFields } from './SchedulerRecurrenceFields';
import { matchesResource, resourceColumns, resourceKey, validateResources } from './schedulerResources';
import { advanceScale, scaleCells } from './schedulerTimeline';
import { arabic, english } from './schedulerLabels';
import { useSchedulerPointer } from './useSchedulerPointer';
import type { PointerCell } from './useSchedulerPointer';
import styles from './CgScheduler.module.css';

const VIEWS: readonly CgSchedulerView[] = ['day', 'workWeek', 'week', 'month', 'timeline'];
const EMPTY: readonly never[] = [];
const systemNow = () => new Date().toISOString();
interface Editor<T> { appointment: Appointment<T> | null; draft: CgSchedulerAppointmentDraft; scope?: CgSchedulerRecurrenceEditScope }
function positive(value: number, name: string, max: number) { if (!Number.isInteger(value) || value <= 0 || value > max) throw new Error(`CgScheduler ${name} must be an integer between 1 and ${max}.`); }

export function CgScheduler<TItem>(props: CgSchedulerProps<TItem>) {
  const root = useRef<HTMLDivElement>(null); const scroll = useRef<HTMLDivElement>(null);
  const direction = useDirection(root, props.direction);
  const locale = props.locale ?? 'en-US';
  const [zone, setZone] = useControllableState(props.displayTimeZone, props.defaultDisplayTimeZone ?? 'UTC', 'CgScheduler.displayTimeZone');
  const resources = props.resources ?? EMPTY; validateResources(resources);
  const [visibleIds, setVisibleIds] = useControllableState(props.visibleResourceIds, props.defaultVisibleResourceIds, 'CgScheduler.visibleResourceIds');
  const visibleKey = JSON.stringify(visibleIds ?? resources.filter(resource => !resource.isGroup).map(resource => resource.id));
  const visibleResourceIds = useMemo(() => Object.freeze(JSON.parse(visibleKey) as (string | number)[]), [visibleKey]);
  const effectiveResources = resources.filter(resource => !resource.isGroup && visibleResourceIds.includes(resource.id));
  const group = props.groupType ?? 'none';
  if (!['none', 'resource', 'date'].includes(group)) throw new Error('Invalid Scheduler groupType.');
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
  const [occurrenceSelection, setOccurrenceSelection] = useControllableState(props.selectedOccurrenceStart, null, 'CgScheduler.selectedOccurrenceStart');
  if (!VIEWS.includes(view)) throw new Error('Invalid CgScheduler view.');
  const interval = props.timeInterval ?? 30; const minimum = Math.ceil((props.minimumAppointmentDuration ?? 30) / interval) * interval;
  const dayCount = props.dayCount ?? 1; const monthCount = props.monthCount ?? 1; const monthLimit = props.monthAppointmentLimit ?? 3;
  const timelineDuration = props.timelineDuration ?? 1440; const timelineScale = props.timelineScale ?? 60;
  positive(interval, 'timeInterval', 1440); positive(minimum, 'minimumAppointmentDuration', 525600);
  positive(dayCount, 'dayCount', 31); positive(monthCount, 'monthCount', 12); positive(monthLimit, 'monthAppointmentLimit', 100);
  positive(timelineDuration, 'timelineDuration', props.timelineScales?.length ? 5256000 : 44640); positive(timelineScale, 'timelineScale', 44640);
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
  const timelineStart = timeMinutes(props.timelineStartTime ?? '00:00');
  const range = useMemo(() => { const result = visibleRange(dates, zone, view === 'timeline' ? timelineDuration : undefined); if (view === 'timeline' && timelineStart) { result.start = iso(zonedInstant(dates[0]!, timelineStart, zone)); result.end = iso(instant(result.start) + timelineDuration * MINUTE); result.endDate = addDays(localParts(instant(result.end) - 1, zone).date, 1); } return result; }, [dates, zone, view, timelineDuration, timelineStart]);
  const columns = resourceColumns(dates, effectiveResources, group);
  const rangeKey = `${range.start}/${range.end}/${view}/${zone}`;
  const rangeChanged = useStableCallback(props.onVisibleRangeChange);
  useEffect(() => { rangeChanged(range, view); }, [range, view, rangeChanged]);
  const [reload, setReload] = useState(0);
  const [remote, setRemote] = useState<{ key: object | null; items: readonly TItem[]; loading: boolean; error: boolean }>({ key: null, items: [], loading: false, error: false });
  const provider = props.itemsProvider;
  const ownership = useMemo(() => ({ dataVersion: props.dataVersion, queryContext: props.queryContext, visibleResourceIds, provider, rangeKey, reload }), [props.dataVersion, props.queryContext, visibleResourceIds, provider, rangeKey, reload]);
  useEffect(() => {
    if (!provider) return;
    const controller = new AbortController();
    // Request lifecycle state belongs to this external provider subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemote({ key: ownership, items: [], loading: true, error: false });
    void Promise.resolve().then(() => provider({ range, view, signal: controller.signal, dataVersion: ownership.dataVersion, queryContext: ownership.queryContext, visibleResourceIds: ownership.visibleResourceIds })).then((items) => {
      if (!controller.signal.aborted) setRemote({ key: ownership, items, loading: false, error: false });
    }, () => { if (!controller.signal.aborted) setRemote({ key: ownership, items: [], loading: false, error: true }); });
    return () => controller.abort();
  }, [provider, range, view, ownership]);
  const loading = !!provider && (remote.key !== ownership || remote.loading);
  const loadError = !!provider && remote.key === ownership && remote.error;
  const items = props.items ?? (remote.key === ownership ? remote.items : EMPTY);
  // Selectors are caller-owned and may change independently of items.
  const appointments = expandAppointments(project(items, props), range, zone).filter(a => !props.resourceIdsSelector || !a.resourceIds?.length || a.resourceIds.some(id => visibleResourceIds.includes(id)));
  const [slotSelection, setSlotSelection] = useState<CgSchedulerTimeCellContext | null>(null);
  const [focusKey, setFocusKey] = useState('');
  const [editor, setEditor] = useState<Editor<TItem> | null>(null);
  const [deleting, setDeleting] = useState<Appointment<TItem> | null>(null);
  const [moreDate, setMoreDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CgSchedulerAppointmentDraft, string>>>({});
  const operation = useRef<AbortController | null>(null);
  const formPopup = useRef<CgPopupActions>(null); const tooltipPopup = useRef<CgPopupActions>(null);
  const [tooltip, setTooltip] = useState<Appointment<TItem> | null>(null);
  const popupOwnership = useMemo(() => ({ ownership, disabled: props.disabled, readOnly: props.readOnly, allowCreate: props.allowCreateAppointment, allowEdit: props.allowEditAppointment }), [ownership, props.disabled, props.readOnly, props.allowCreateAppointment, props.allowEditAppointment]);
  const formGate = useSchedulerPopupGate<TItem>(popupOwnership, () => setError(labels.operationError));
  const tooltipGate = useSchedulerPopupGate<TItem>(popupOwnership, () => setError(labels.operationError));
  const lastForm = useRef<CgSchedulerPopupContext<TItem> | null>(null); const lastTooltip = useRef<CgSchedulerPopupContext<TItem> | null>(null);
  useLayoutEffect(() => { if (editor && lastForm.current) lastForm.current = { ...lastForm.current, draft: Object.freeze({ ...editor.draft }), scope: editor.scope }; }, [editor]);
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
  useLayoutEffect(() => { abortOperation(); setEditor(null); setDeleting(null); setMoreDate(null); setTooltip(null); setSlotSelection(null); setPreview(null); setError(''); setFocusKey(''); if (clickTimer.current) clearTimeout(clickTimer.current); }, [ownership, writable, abortOperation]);
  useEffect(() => () => { operation.current?.abort(); if (clickTimer.current) clearTimeout(clickTimer.current); }, []);
  const daySlots = columns.map(column => slots(column.date, zone, interval, working, workStart, workEnd, visibleStart, visibleEnd));
  const timeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }), [locale, zone]);
  const shortTimeFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: zone, hour: '2-digit', minute: '2-digit' }), [locale, zone]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }), [locale]);
  const longDate = (d: string) => dateFormat.format(civil(d));
  const context = (a: Appointment<TItem>, before = false, after = false): CgSchedulerAppointmentContext<TItem> => ({ ...draftOf(a), item: a.item, id: a.id, isSelected: selected === a.id && (!a.originalOccurrenceStart || occurrenceSelection === a.originalOccurrenceStart), originalOccurrenceStart: a.originalOccurrenceStart, continuesBefore: before, continuesAfter: after, view });
  const choose = (a: Appointment<TItem> | null, slot: CgSchedulerTimeCellContext | null) => {
    if (props.disabled) return;
    const id = a?.id ?? null;
    if (selected === id && occurrenceSelection === (a?.originalOccurrenceStart ?? null) && slotSelection?.start === slot?.start && slotSelection?.end === slot?.end && slotSelection?.isAllDay === slot?.isAllDay && slotSelection?.resource?.id === slot?.resource?.id) return;
    if (selected !== id) { setSelected(id); props.onSelectedAppointmentIdChange?.(id); }
    setSlotSelection(slot); setOccurrenceSelection(a?.originalOccurrenceStart ?? null); props.onSelectedOccurrenceStartChange?.(a?.originalOccurrenceStart ?? null);
    props.onSelectionChange?.({ appointment: a?.item ?? null, appointmentId: id, slot, originalOccurrenceStart: a?.originalOccurrenceStart });
  };
  const navigate = (direction: -1 | 1) => { if (!props.disabled) { const next = navigateDate(date, view, direction * (view === 'day' ? dayCount : view === 'month' ? monthCount : view === 'timeline' ? Math.max(1, Math.ceil(timelineDuration / 1440)) : 1)); setDate(next); props.onSelectedDateChange?.(next); } };
  const changeView = (next: CgSchedulerView) => { setView(next); props.onCurrentViewChange?.(next); };
  const goToday = () => { setDate(todayDate); props.onSelectedDateChange?.(todayDate); };
  const clearErrors = () => { setError(''); setFieldErrors({}); };
  const openEditor = (appointment: Appointment<TItem> | null, cell?: CgSchedulerTimeCellContext) => {
    if (busy || (appointment ? !canEdit : !canCreate)) return;
    clearErrors(); setMoreDate(null);
    const candidate: Editor<TItem> = { appointment, scope: appointment?.originalOccurrenceStart ? 'occurrence' : 'series', draft: appointment ? draftOf(appointment) : { title: '', start: cell!.start, end: cell!.isAllDay ? cell!.end : iso(Math.max(instant(cell!.end), instant(cell!.start) + minimum * MINUTE)), isAllDay: cell!.isAllDay, ...(cell?.resource ? { resourceIds: Object.freeze([cell.resource.id]) } : {}), description: '', color: '' } };
    const opening = { item: appointment?.item ?? null, draft: Object.freeze({ ...candidate.draft }), scope: candidate.scope, isTooltip: false };
    formGate.request(opening, props.onAppointmentFormShowing, () => { lastForm.current = opening; setEditor(candidate); setTooltip(null); });
  };
  const clearEditor = () => { abortOperation(); setEditor(null); setDeleting(null); clearErrors(); };
  const closeEditor = () => { formGate.cancel(); if (editor) void formPopup.current?.close(); else clearEditor(); };
  const openTooltip = (appointment: Appointment<TItem>) => { if (props.disabled) return; const opening = { item: appointment.item, draft: Object.freeze(draftOf(appointment)), isTooltip: true }; tooltipGate.request(opening, props.onAppointmentTooltipShowing, () => { lastTooltip.current = opening; setTooltip(appointment); }); };
  const closeTooltip = () => { tooltipGate.cancel(); void tooltipPopup.current?.close(); };
  const run = async (handler: CgSchedulerOperationHandler<TItem> | undefined, appointment: Appointment<TItem> | null, draft: CgSchedulerAppointmentDraft, source: 'editor' | 'drag' | 'resize', edge?: 'start' | 'end', scope: CgSchedulerRecurrenceEditScope = appointment?.originalOccurrenceStart ? (source === 'editor' ? editor?.scope ?? 'occurrence' : props.recurringAppointmentDragMode ?? 'occurrence') : 'series') => {
    if (!handler || operation.current || !writable) return;
    const controller = new AbortController(); operation.current = controller; setBusy(true); clearErrors();
    try {
      if (scope === 'series' && source !== 'editor' && appointment?.series) draft = { ...draft, start: iso(instant(appointment.series.start) + instant(draft.start) - appointment.startMs), end: iso(instant(appointment.series.end) + instant(draft.end) - appointment.endMs) };
      const frozenDraft = Object.freeze({ ...draft, ...(draft.resourceIds ? { resourceIds: Object.freeze([...draft.resourceIds]) } : {}), ...(draft.customFields ? { customFields: Object.freeze({ ...draft.customFields }) } : {}), ...(draft.recurrence ? { recurrence: snapshotRecurrence(draft.recurrence) } : {}) });
      const result = await handler({ originalItem: appointment?.item ?? null, original: appointment ? Object.freeze(scope === 'series' && appointment.series ? { ...appointment.series } : draftOf(appointment)) : null, draft: frozenDraft, source, edge, scope, dataVersion: ownership.dataVersion, queryContext: ownership.queryContext, originalOccurrenceStart: appointment?.originalOccurrenceStart }, controller.signal);
      if (controller.signal.aborted || operation.current !== controller) return;
      if (result.success) { if (editor && !deleting) await formPopup.current?.close(); else setEditor(null); setDeleting(null); if (provider) setReload((n) => n + 1); }
      else { setError(result.error ?? labels.operationError); setFieldErrors(result.fieldErrors ?? {}); }
    } catch { if (!controller.signal.aborted && operation.current === controller) setError(labels.operationError); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); } }
  };
  const cellContext = (cell: PointerCell): CgSchedulerTimeCellContext => ({ resource: resources.find(resource => resourceKey(resource.id) === cell.resourceKey), date: cell.date, start: iso(cell.start), end: iso(cell.end), label: cell.allDay ? `${longDate(cell.date)} ${labels.allDay}` : `${longDate(cell.date)} ${timeFormat.format(cell.start)}`, isAllDay: cell.allDay, isWorkingTime: working.includes(WEEKDAYS[dayIndex(cell.date)]!) && localParts(cell.start, zone).minutes >= workStart && localParts(cell.start, zone).minutes < workEnd, isSelected: !!slotSelection && cell.start >= instant(slotSelection.start) && cell.end <= instant(slotSelection.end) && cell.allDay === slotSelection.isAllDay && cell.resourceKey === (slotSelection.resource ? resourceKey(slotSelection.resource.id) : undefined), view });
  const proposal = (origin: PointerCell, target: PointerCell, kind: string) => {
    const a = dragAppointment.current;
    if (kind === 'select' || !a) return { ...(origin.resourceKey ? { resourceIds: resources.filter(resource => resourceKey(resource.id) === origin.resourceKey).map(resource => resource.id) } : {}), title: '', description: '', color: '', isAllDay: origin.allDay, start: iso(Math.min(origin.start, target.start)), end: iso(Math.max(origin.end, target.end)) };
    const draft = draftOf(a);
    if (kind === 'drag' && target.resourceKey !== origin.resourceKey && props.allowDragAppointmentBetweenResources !== false) { const targetResource = resources.find(resource => resourceKey(resource.id) === target.resourceKey); if (targetResource) draft.resourceIds = Object.freeze([targetResource.id]); }
    const delta = props.snapToCellsMode === 'never' ? target.start - origin.start : Math.round((target.start - origin.start) / (interval * MINUTE)) * interval * MINUTE;
    const days = (civil(target.date) - civil(origin.date)) / DAY;
    const shift = (value: number) => { const local = localParts(value, zone); return a.isAllDay ? boundary(addDays(local.date, days), zone) : origin.allDay ? zonedInstant(addDays(local.date, days), local.minutes, zone) + local.seconds * 1000 + ((value % 1000) + 1000) % 1000 : value + delta; };
    if (kind === 'drag') { draft.start = iso(shift(a.startMs)); draft.end = iso(shift(a.endMs)); }
    else if (kind === 'start') draft.start = iso(Math.min(shift(a.startMs), a.isAllDay ? boundary(addDays(localParts(a.endMs, zone).date, -1), zone) : a.endMs - minimum * MINUTE));
    else draft.end = iso(Math.max(shift(a.endMs), a.isAllDay ? boundary(addDays(localParts(a.startMs, zone).date, 1), zone) : a.startMs + minimum * MINUTE));
    return draft;
  };
  const pointer = useSchedulerPointer(root, scroll, (origin, target, kind) => setPreview({ key: dragAppointment.current?.key ?? null, draft: proposal(origin, target, kind) }), (origin, target, kind) => {
    const draft = proposal(origin, target, kind);
    if (kind === 'select') { choose(null, cellContext({ date: localParts(instant(draft.start), zone).date, start: instant(draft.start), end: instant(draft.end), allDay: draft.isAllDay, resourceKey: draft.resourceIds?.[0] !== undefined ? resourceKey(draft.resourceIds[0]) : undefined })); }
    else { const a = dragAppointment.current; if (a && (draft.start !== a.start || draft.end !== a.end || JSON.stringify(draft.resourceIds) !== JSON.stringify(a.resourceIds))) void run(kind === 'drag' ? props.onAppointmentDragging : props.onAppointmentResizing, a, draft, kind === 'drag' ? 'drag' : 'resize', kind === 'start' || kind === 'end' ? kind : undefined); }
  }, () => { setPreview(null); dragAppointment.current = null; });
  const cancelPointer = useStableCallback(pointer.cancel);
  useEffect(() => { cancelPointer(); }, [rangeKey, writable, cancelPointer]);
  const delayClick = (fn: () => void) => { if (clickTimer.current) clearTimeout(clickTimer.current); clickTimer.current = setTimeout(fn, 250); };
  const cancelClick = () => { if (clickTimer.current) clearTimeout(clickTimer.current); };
  const defaultResource = group !== 'none' && effectiveResources[0] ? `@${resourceKey(effectiveResources[0].id)}` : '';
  const defaultFocus = view === 'timeline' ? `cell:${range.start}${defaultResource}` : `cell:${iso(boundary(columns[0]?.date ?? dates[0]!, zone))}:all${view !== 'month' ? defaultResource : ''}`;
  useEffect(() => {
    // Restore the roving entry point when host data removes/moves the focused appointment.
    if (!props.disabled && root.current && !root.current.querySelector('[data-focus-key][tabindex="0"]')) {
      setFocusKey(defaultFocus);
    }
  }, [appointments, props.disabled, defaultFocus, focusKey]);
  const tabIndex = (key: string) => props.disabled ? -1 : (focusKey || defaultFocus) === key ? 0 : -1;
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (props.disabled || !(event.target instanceof HTMLElement)) return;
    if (event.key === 'Escape') { event.preventDefault(); pointer.cancel(); closeTooltip(); closeEditor(); choose(null, null); return; }
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
    const ctx = cellContext(cell); const decoration = props.cellDecoration?.({ ...ctx, cellType: cell.allDay ? 'allDayTimeCell' : 'timeCell' }); const key = `cell:${ctx.start}${cell.allDay ? ':all' : ''}${cell.resourceKey ? `@${cell.resourceKey}` : ''}`;
    const inPreview = preview?.key === null && cell.allDay === preview.draft.isAllDay && cell.start >= instant(preview.draft.start) && cell.start < instant(preview.draft.end);
    return <button {...decoration?.attributes} key={key} type="button" role="gridcell" data-scheduler-cell data-resource-key={cell.resourceKey} data-snap={props.snapToCellsMode} data-start={cell.start} data-end={cell.end} data-date={cell.date} data-all-day={cell.allDay} data-axis={view === 'timeline' ? 'horizontal' : 'vertical'} data-interval={interval} data-direction={direction} data-focus-key={key} data-col={col} data-row={row} tabIndex={tabIndex(key)} disabled={props.disabled} aria-label={ctx.label} aria-selected={ctx.isSelected || !!inPreview} className={cx(styles.cell, ctx.isWorkingTime && styles.working, cell.allDay && styles.allDayCell, decoration?.className)} style={{ ...style, ...decoration?.style }} onFocus={() => setFocusKey(key)}
      onPointerDown={(event) => { if (writable && !busy) { dragAppointment.current = null; pointer.start(event, 'select'); } }}
      onClick={(event) => { if (pointer.suppressClick.current) { pointer.suppressClick.current = false; return; } choose(null, ctx); if (event.detail === 0) openEditor(null, ctx); else delayClick(() => props.onTimeCellClick?.(ctx)); }}
      onDoubleClick={() => { cancelClick(); props.onTimeCellDoubleClick?.(ctx); openEditor(null, ctx); }}>
      {props.renderTimeCell?.(ctx) ?? (cell.allDay ? props.renderAllDayTimeCell?.(ctx) : undefined) ?? child}
    </button>;
  };
  const renderAppointment = (segment: Segment<TItem>, style: CSSProperties, col: number, row: number, horizontal = false, suffix = '', resource?: CgSchedulerResource) => {
    const a = segment.appointment; const ctx = { ...context(a, segment.continuesBefore, segment.continuesAfter), orientation: horizontal ? 'horizontal' as const : 'vertical' as const, resource }; const key = `appointment:${a.key}:${suffix}`;
    const origin: PointerCell = { start: segment.start, end: segment.end, date: localParts(segment.start, zone).date, allDay: a.isAllDay || view === 'month', resourceKey: resource ? resourceKey(resource.id) : undefined };
    const startPointer = (event: React.PointerEvent<HTMLElement>, kind: string) => { event.stopPropagation(); if (busy || (kind === 'drag' ? !canDrag : !canResize)) return; dragAppointment.current = a; pointer.start(event, kind, origin); };
    return <div key={key} role="gridcell" className={cx(styles.appointmentBox, horizontal && styles.horizontal)} style={{ ...style, '--cg-scheduler-appointment-color': a.color || props.appointmentLabels?.find(label => label.id === a.labelId)?.color || resource?.color || undefined } as CSSProperties}>
      <button type="button" disabled={props.disabled} className={cx(styles.appointment, a.className, props.appointmentLabels?.find(label => label.id === a.labelId)?.className, props.statuses?.find(status => status.id === a.statusId)?.className)} data-appointment={a.key} data-focus-key={key} data-col={col} data-row={row} tabIndex={tabIndex(key)} aria-pressed={ctx.isSelected} aria-label={`${a.title}, ${a.isAllDay ? labels.allDay : timeFormat.format(a.startMs)}, ${longDate(localParts(a.startMs, zone).date)}`} onFocus={() => setFocusKey(key)} onPointerDown={(e) => startPointer(e, 'drag')}
        onClick={(event) => { if (pointer.suppressClick.current) { pointer.suppressClick.current = false; return; } choose(a, null); if (event.detail === 0) openEditor(a); else delayClick(() => { props.onAppointmentClick?.(ctx); if (props.showAppointmentTooltip) openTooltip(a); }); }}
        onDoubleClick={() => { cancelClick(); props.onAppointmentDoubleClick?.(ctx); openEditor(a); }}>
        {props.renderAppointment?.(ctx) ?? (horizontal ? props.renderHorizontalAppointment?.(ctx) : props.renderVerticalAppointment?.(ctx)) ?? <><span className={styles.appointmentTitle}>{ctx.continuesBefore && '‹ '}{a.title}{ctx.continuesAfter && ' ›'}</span>{!horizontal && !a.isAllDay && props.showAppointmentDateTimeRange !== false && <small>{shortTimeFormat.format(a.startMs)} – {shortTimeFormat.format(a.endMs)}</small>}</>}
      </button>
      {canResize && <><span aria-hidden="true" data-resize="start" title={labels.resizeStart} className={cx(styles.resize, styles.resizeStart)} onPointerDown={(e) => startPointer(e, 'start')} /><span aria-hidden="true" data-resize="end" title={labels.resizeEnd} className={cx(styles.resize, styles.resizeEnd)} onPointerDown={(e) => startPointer(e, 'end')} /></>}
    </div>;
  };
  const header = (d: string) => { const context = { date: d, label: longDate(d), isToday: d === todayDate, view }; const decoration = props.cellDecoration?.({ ...cellContext({ date: d, start: boundary(d, zone), end: boundary(addDays(d, 1), zone), allDay: true }), cellType: 'dateHeader' }); return <span {...decoration?.attributes} className={decoration?.className} style={decoration?.style}>{props.renderDateHeader?.(context) ?? <span className={d === todayDate ? styles.today : undefined}>{longDate(d)}</span>}</span>; };
  const effectiveAppointments = preview?.key ? appointments.map((a) => a.key === preview.key ? { ...a, ...preview.draft, startMs: instant(preview.draft.start), endMs: instant(preview.draft.end) } : a) : appointments;
  const renderDateBand = (bandDates: string[], month: boolean, weekIndex: number, resource?: CgSchedulerResource) => {
    const start = boundary(bandDates[0]!, zone); const end = boundary(addDays(bandDates.at(-1)!, 1), zone);
    const segments = layoutDates(effectiveAppointments.filter((a) => (month || a.isAllDay) && matchesResource(a.resourceIds, resource)), start, end, zone);
    const laneCount = segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);
    const height = month ? Math.max(props.monthCellMinHeight ?? 0, 34 + monthLimit * 27 + 30) : Math.max(40, laneCount * 27 + 8);
    return <div key={`${bandDates[0]}${resource ? `@${resourceKey(resource.id)}` : ''}`} role="row" className={styles.dateBand} style={{ height, gridTemplateColumns: `repeat(${bandDates.length}, minmax(${month ? props.monthCellMinWidth ?? 96 : props.dayCellMinWidth ?? 136}px, 1fr))` }}>
      {bandDates.map((d, col) => renderCell({ start: boundary(d, zone), end: boundary(addDays(d, 1), zone), date: d, allDay: true, resourceKey: resource ? resourceKey(resource.id) : undefined }, col + (resource ? weekIndex : 0), month ? weekIndex : -1, month ? <span className={styles.monthDate}>{header(d)}</span> : labels.allDay))}
      {segments.filter((s) => !month || s.lane < monthLimit).map((s) => {
        const covered = bandDates.map((d, i) => ({ d, i })).filter(({ d }) => s.start < boundary(addDays(d, 1), zone) && s.end > boundary(d, zone));
        if (!covered.length) return null;
        const col = covered[0]!.i; const span = covered.length;
        return renderAppointment(s, { insetInlineStart: `calc(${col / bandDates.length * 100}% + 3px)`, width: `calc(${span / bandDates.length * 100}% - 6px)`, top: (month ? 34 + (props.monthLastAppointmentIndent ?? 0) : 4) + s.lane * 27, height: 24 }, col, month ? weekIndex : -1, true, `${weekIndex}:all${resource ? `@${resourceKey(resource.id)}` : ''}`, resource);
      })}
      {month && bandDates.map((d, col) => { const count = segments.filter((s) => s.lane >= monthLimit && s.start < boundary(addDays(d, 1), zone) && s.end > boundary(d, zone)).length; return count ? <div role="gridcell" key={`more:${d}`} className={styles.more} style={{ insetInlineStart: `${col / bandDates.length * 100}%`, width: `${100 / bandDates.length}%` }}><button type="button" disabled={props.disabled} onClick={() => setMoreDate(d)}>{labels.more(count)}</button></div> : null; })}
    </div>;
  };
  const resourceHeader = (resource: CgSchedulerResource, headerDate = date) => { const decoration = props.cellDecoration?.({ ...cellContext({ date: headerDate, start: boundary(headerDate, zone), end: boundary(addDays(headerDate, 1), zone), allDay: true }), resource, cellType: 'resourceHeader' }); return <span {...decoration?.attributes} className={cx(resource.className, decoration?.className)} style={{ ...(props.resourceColorInHeaderVisible ? { borderInlineStart: `4px solid ${resource.color ?? 'var(--cg-accent)'}`, paddingInlineStart: 6 } : {}), ...decoration?.style }}>{props.renderResourceHeader?.({ resource, view, date: headerDate }) ?? resource.caption}</span>; };
  const renderTimeGrid = () => <>
    <div role="row" className={styles.headers} style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(${props.dayCellMinWidth ?? 136}px, 1fr))` }}><div role="columnheader">{labels.start}</div>{columns.map(column => <div role="columnheader" key={column.key}>{column.resource && resourceHeader(column.resource, column.date)}{column.resource && <br />}{header(column.date)}</div>)}</div>
    <div className={styles.banded}>{group === 'none' ? renderDateBand(columns.map(column => column.date), false, 0) : <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(${props.dayCellMinWidth ?? 136}px, 1fr))` }}>{columns.map((column, i) => renderDateBand([column.date], false, i, column.resource))}</div>}</div>
    <div className={styles.timeColumns} style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(${props.dayCellMinWidth ?? 136}px, 1fr))` }}>
      <div role="row" className={styles.gutter}>{daySlots[0]?.map((slot) => <div role="rowheader" key={slot.start} style={{ height: 32 }}>{shortTimeFormat.format(slot.start)}</div>)}</div>
      {daySlots.map((day, col) => { const start = day[0]?.start; const end = day.at(-1)?.end;
        const segments = start !== undefined && end !== undefined ? layout(effectiveAppointments.filter((a) => !a.isAllDay && matchesResource(a.resourceIds, columns[col]?.resource)), start, end) : [];
        const indicator = props.timeIndicatorVisibility === 'always' ? zonedInstant(columns[col]!.date, localParts(now, zone).minutes, zone) : now;
        const position = (value: number) => { const i = day.findIndex((slot) => value < slot.end); if (i < 0) return day.length; const slot = day[i]!; return i + Math.max(0, (value - slot.start) / (slot.end - slot.start)); };
        return <div role="row" className={styles.timeColumn} key={columns[col]!.key} style={{ height: day.length * 32 }}>
          {day.map((slot, row) => renderCell({ ...slot, allDay: false, resourceKey: columns[col]?.resource ? resourceKey(columns[col].resource.id) : undefined }, col, row, daySlots[0]?.[row]?.minutes !== slot.minutes ? <span className={styles.timeLabel}>{shortTimeFormat.format(slot.start)}</span> : undefined, { height: 32 }))}
          {segments.map((segment) => renderAppointment(segment, { top: position(segment.start) * 32, height: Math.max(20, (position(segment.end) - position(segment.start)) * 32 - 2), insetInlineStart: `calc(3px + (100% - 4px) * ${segment.lane / segment.lanes})`, width: `calc((100% - 4px) / ${segment.lanes} - 2px)` }, col, Math.floor(position(segment.start)), false, columns[col]!.key, columns[col]!.resource))}
          {props.showCurrentTimeIndicator !== false && props.timeIndicatorVisibility !== 'never' && start !== undefined && end !== undefined && indicator >= start && indicator < end && <div className={styles.now} style={{ top: position(indicator) * 32 }} aria-hidden="true" />}
        </div>;
      })}
    </div>
  </>;
  const renderTimeline = () => {
    const start = instant(range.start), end = instant(range.end);
    const scales = props.timelineScales?.length ? props.timelineScales : undefined;
    const baseMs = scales ? advanceScale(start, scales.at(-1)!, zone) - start : timelineScale * MINUTE;
    const count = Math.ceil((end - start) / baseMs); if (count > 50_000) throw new Error('Scheduler timeline exceeds 50,000 cells. Choose a coarser scale.');
    const cells = Array.from({ length: count }, (_, i) => ({ start: start + i * baseMs, end: Math.min(end, start + (i + 1) * baseMs) }));
    const template = cells.map(cell => 'minmax(0, ' + (cell.end - cell.start) + 'fr)').join(' ');
    const rows: readonly (CgSchedulerResource | undefined)[] = group !== 'none' && effectiveResources.length ? effectiveResources : [undefined];
    return <div className={styles.timeline} style={{ minWidth: (end - start) / baseMs * (props.timelineCellMinWidth ?? 96) }}>
      {scales ? scales.map((scale, i) => <div key={i} role="row" className={styles.headers} style={{ display: 'flex', position: 'relative' }}>{scaleCells(start, end, scale, zone, locale).map(cell => <div key={cell.start} role="columnheader" style={{ flex: cell.end - cell.start }}>{cell.label}</div>)}</div>) : <div role="row" className={styles.headers} style={{ gridTemplateColumns: template }}>{cells.map(cell => <div role="columnheader" key={cell.start}>{shortTimeFormat.format(cell.start)}</div>)}</div>}
      {rows.map((resource, rowIndex) => {
        const segments = layout(effectiveAppointments.filter(a => matchesResource(a.resourceIds, resource)), start, end); const laneCount = segments.reduce((max, segment) => Math.max(max, segment.lane + 1), 0);
        return <div key={resource ? resourceKey(resource.id) : 'all'}>{resource && <div role="row"><div role="rowheader" className={styles.resourceHeading} style={{ minWidth: props.resourceCellWidth, writingMode: props.resourceCaptionOrientation === 'vertical' ? 'vertical-rl' : undefined }}>{resourceHeader(resource)}</div></div>}
          <div role="row" className={styles.timelineBody} style={{ height: Math.max(props.timelineCellMinHeight ?? 180, laneCount * 40 + (props.timelineLastAppointmentIndent ?? 20)), gridTemplateColumns: template }}>
            {cells.map((cell, i) => renderCell({ ...cell, date: localParts(cell.start, zone).date, allDay: false, resourceKey: resource ? resourceKey(resource.id) : undefined }, i, rowIndex))}
            {segments.map(segment => renderAppointment(segment, { insetInlineStart: (segment.start - start) / (end - start) * 100 + '%', width: (segment.end - segment.start) / (end - start) * 100 + '%', top: segment.lane * 40 + 8, height: 34 }, Math.floor((segment.start - start) / baseMs), rowIndex, true, 'timeline:' + rowIndex, resource))}
            {props.showCurrentTimeIndicator !== false && props.timeIndicatorVisibility !== 'never' && now >= start && now < end && <div className={styles.timelineNow} style={{ insetInlineStart: (now - start) / (end - start) * 100 + '%' }} aria-hidden="true" />}
          </div>
        </div>;
      })}
    </div>;
  };
  const saveEditor = () => {
    if (!editor) return;
    const draft = editor.draft; const errors: typeof fieldErrors = {};
    if (props.validateEditForm !== false && !draft.title.trim()) errors.title = labels.requiredTitle;
    try { if (instant(draft.end) <= instant(draft.start)) errors.end = labels.invalidDates; } catch { errors.start = labels.invalidDates; }
    if (props.validateEditForm !== false) for (const field of props.customFields ?? []) { const value = draft.customFields?.[field.key]; if (field.required && (value == null || value === '' || field.type === 'boolean' && !value)) errors.customFields = `${field.label} is required.`; if (field.type === 'number' && value != null && !Number.isFinite(value)) errors.customFields = `${field.label} must be a finite number.`; }
    try { if (draft.recurrence) validateRecurrence(draft.recurrence); } catch (cause) { errors.recurrence = cause instanceof Error ? cause.message : labels.invalidDates; }
    if (Object.keys(errors).length) { setFieldErrors(errors); setError(labels.invalidDates); return; }
    void run(editor.appointment ? props.onAppointmentUpdating : props.onAppointmentCreating, editor.appointment, draft, 'editor');
  };
  const editorFields = () => {
    if (!editor) return null;
    const draft = editor.draft;
    const update = (next: CgSchedulerAppointmentDraft) => { if (!busy) setEditor({ ...editor, draft: next }); };
    if (props.renderEditor) return props.renderEditor({ item: editor.appointment?.item ?? null, draft: { ...draft }, setDraft: update, busy, fieldErrors });
    return <div className={styles.fields}>
      <>{editor.appointment?.originalOccurrenceStart && <label>{locale.startsWith('ar') ? 'نطاق التعديل' : 'Edit scope'}<select value={editor.scope} disabled={busy} onChange={event => { const scope = event.target.value as CgSchedulerRecurrenceEditScope; setEditor({ ...editor, scope, draft: scope === 'series' ? { ...editor.appointment!.series! } : draftOf(editor.appointment!) }); }}><option value="occurrence">{locale.startsWith('ar') ? 'هذا الموعد' : 'This occurrence'}</option><option value="series">{locale.startsWith('ar') ? 'السلسلة' : 'Entire series'}</option></select></label>}</>
      <label>{labels.title}<input name="title" autoFocus value={draft.title} disabled={busy} aria-invalid={!!fieldErrors.title} onChange={(e) => update({ ...draft, title: e.target.value })} /></label>
      <label className={styles.checkbox}><input type="checkbox" checked={draft.isAllDay} disabled={busy} onChange={(e) => { const isAllDay = e.target.checked; const startDate = localParts(instant(draft.start), zone).date; const endDate = localParts(instant(draft.end), zone).date; update({ ...draft, isAllDay, ...(isAllDay ? { start: iso(boundary(startDate, zone)), end: iso(boundary(endDate > startDate ? endDate : addDays(startDate, 1), zone)) } : {}) }); }} />{labels.allDay}</label>
      {(['start', 'end'] as const).map((field) => <label key={field}>{labels[field]}<input name={field} type={draft.isAllDay ? 'date' : 'datetime-local'} value={draft.isAllDay ? localParts(instant(draft[field]), zone).date : localInput(draft[field], zone)} disabled={busy} aria-invalid={!!fieldErrors[field]} onChange={(e) => { if (!e.target.value) return; try { update({ ...draft, [field]: draft.isAllDay ? iso(boundary(e.target.value, zone)) : fromLocalInput(e.target.value, zone) }); } catch { setFieldErrors({ [field]: labels.invalidDates }); } }} /></label>)}
      <small>{labels.timeZone}: {zone}</small>
      {props.enableRecurrence && editor.scope !== 'occurrence' && <SchedulerRecurrenceFields draft={draft} update={update} disabled={busy} locale={locale} />}
      <SchedulerMetadataFields draft={draft} update={update} disabled={busy} locale={locale} resources={resources} labels={props.appointmentLabels} statuses={props.statuses} fields={props.customFields} showLocation={!!props.locationSelector || draft.location !== undefined} />
      <label>{labels.description}<textarea name="description" value={draft.description} disabled={busy} onChange={(e) => update({ ...draft, description: e.target.value })} /></label>
      <label>{labels.color}<input name="color" value={draft.color} disabled={busy} onChange={(e) => update({ ...draft, color: e.target.value })} /></label>
    </div>;
  };
  const monthDates = dates.filter(d => !props.showWorkDaysOnly || working.includes(WEEKDAYS[dayIndex(d)]!));
  const monthColumns = props.showWorkDaysOnly ? new Set(working).size : 7;
  return <div ref={root} id={props.id} dir={direction} className={cx(styles.root, props.className)} style={{ height: props.height ?? '42rem', ...props.style }} aria-label={props['aria-label'] ?? labels.scheduler} role="region" aria-disabled={props.disabled || undefined}>
    {props.showToolbar !== false && <div className={styles.toolbar}>{props.renderToolbar?.({ selectedDate: date, currentView: view, range, navigate, today: goToday, changeView, refresh: () => setReload((n) => n + 1) }) ?? <>
      <CgButton appearance="outline" disabled={props.disabled} aria-label={labels.previous} onClick={() => navigate(-1)}>{direction === 'rtl' ? '›' : '‹'}</CgButton>
      <CgButton appearance="outline" disabled={props.disabled} onClick={goToday}>{labels.today}</CgButton>
      <CgButton appearance="outline" disabled={props.disabled} aria-label={labels.next} onClick={() => navigate(1)}>{direction === 'rtl' ? '‹' : '›'}</CgButton>
      <strong className={styles.heading}>{longDate(range.startDate)} – {longDate(addDays(range.endDate, -1))}</strong>
      <select aria-label={labels.view} value={view} disabled={props.disabled} onChange={(e) => changeView(e.target.value as CgSchedulerView)}>{VIEWS.map((v) => <option key={v} value={v}>{labels[v]}</option>)}</select>
      {props.showTimeZoneSelector && <select aria-label={labels.timeZone} value={zone} disabled={props.disabled} onChange={event => { setZone(event.target.value); props.onDisplayTimeZoneChange?.(event.target.value); }}>{[...new Set([zone, ...(props.timeZoneOptions ?? [])])].map(value => <option key={value} value={value}>{value}</option>)}</select>}
      {canCreate && <CgButton onClick={() => openEditor(null, slotSelection ?? cellContext({ date, start: zonedInstant(date, workStart, zone), end: zonedInstant(date, workStart, zone) + minimum * MINUTE, allDay: false }))}>{labels.create}</CgButton>}
    </>}</div>}
    {!!resources.length && props.resourceNavigatorVisible !== false && <fieldset className={styles.resourceNavigator} disabled={props.disabled}><legend>{locale.startsWith('ar') ? 'الموارد المرئية' : 'Visible resources'}</legend>{resources.map(resource => resource.isGroup ? <strong key={resourceKey(resource.id)}>{resource.caption}</strong> : <label key={resourceKey(resource.id)}><input type="checkbox" checked={visibleResourceIds.includes(resource.id)} onChange={event => { const next = Object.freeze(event.target.checked ? [...new Set([...visibleResourceIds, resource.id])] : visibleResourceIds.filter(id => id !== resource.id)); setVisibleIds(next); props.onVisibleResourceIdsChange?.(next); }} />{resource.caption}</label>)}</fieldset>}
    <div className={styles.status} role="status" aria-live="polite">{loading ? labels.loading : preview ? `${preview.draft.title} ${timeFormat.format(instant(preview.draft.start))} – ${timeFormat.format(instant(preview.draft.end))}` : ''}</div>
    {loadError && <div role="alert">{labels.loadError} <CgButton onClick={() => setReload((n) => n + 1)}>{labels.retry}</CgButton></div>}
    {error && !editor && !deleting && <div role="alert" className={styles.error}>{error}</div>}
    <div ref={scroll} className={styles.scroll} role="grid" aria-label={labels.scheduler} aria-readonly={!writable} aria-busy={loading || busy} onKeyDown={onGridKey} onPointerMove={pointer.move} onPointerUp={pointer.end} onPointerCancel={pointer.cancel} onLostPointerCapture={pointer.cancel}>
      {view === 'month' ? <>{props.renderDayOfWeekHeader && <div role="row" className={styles.headers} style={{ gridTemplateColumns: `repeat(${monthColumns}, minmax(${props.monthCellMinWidth ?? 96}px, 1fr))` }}>{monthDates.slice(0, monthColumns).map(d => <div role="columnheader" key={d}>{props.renderDayOfWeekHeader!({ date: d, label: longDate(d), isToday: d === todayDate, view })}</div>)}</div>}{Array.from({ length: Math.ceil(monthDates.length / monthColumns) }, (_, i) => renderDateBand(monthDates.slice(i * monthColumns, (i + 1) * monthColumns), true, i))}</> : view === 'timeline' ? renderTimeline() : renderTimeGrid()}
    </div>
    <CgPopup actionsRef={formPopup} open={!!editor && !deleting} onOpenChange={(open) => { if (!open) clearEditor(); }} onBeforeClose={details => lastForm.current ? props.onAppointmentFormClosing?.({ ...lastForm.current, draft: Object.freeze({ ...editor!.draft }), signal: details.signal }) : undefined} onAfterOpen={() => lastForm.current ? props.onAppointmentFormShown?.(lastForm.current) : undefined} onAfterClose={() => lastForm.current ? props.onAppointmentFormClosed?.(lastForm.current) : undefined} onLifecycleError={() => setError(labels.operationError)} header={editor && props.renderEditorHeader ? props.renderEditorHeader({ item: editor.appointment?.item ?? null, draft: editor.draft, setDraft: draft => { if (!busy) setEditor({ ...editor, draft }); }, busy, fieldErrors }) : undefined} headerText={editor?.appointment ? labels.edit : labels.create} width="min(34rem, 94vw)" {...props.appointmentFormOptions} showFooter footer={<div className={styles.actions}><CgButton disabled={busy} onClick={saveEditor}>{labels.save}</CgButton>{editor?.appointment && canDelete && <CgButton disabled={busy} appearance="outline" onClick={() => setDeleting(editor.appointment)}>{labels.delete}</CgButton>}<CgButton appearance="outline" onClick={closeEditor}>{labels.cancel}</CgButton></div>}>
      <div dir={direction}>{editorFields()}{error && <div role="alert" className={styles.error}>{error}{Object.entries(fieldErrors).map(([field, message]) => <div key={field}>{message}</div>)}</div>}</div>
    </CgPopup>
    <CgPopup open={!!deleting} role="alertdialog" onOpenChange={(open) => { if (!open) { abortOperation(); setDeleting(null); } }} headerText={labels.deleteConfirmation} showFooter footer={<div className={styles.actions}><CgButton disabled={busy} onClick={() => { if (deleting) void run(props.onAppointmentDeleting, deleting, draftOf(deleting), 'editor'); }}>{labels.delete}</CgButton><CgButton appearance="outline" onClick={() => { abortOperation(); setDeleting(null); }}>{labels.cancel}</CgButton></div>}>
      {deleting?.title}{error && <div role="alert">{error}</div>}
    </CgPopup>
    <CgPopup actionsRef={tooltipPopup} open={!!tooltip} onOpenChange={open => { if (!open) setTooltip(null); }} onBeforeClose={details => lastTooltip.current ? props.onAppointmentTooltipClosing?.({ ...lastTooltip.current, signal: details.signal }) : undefined} onAfterOpen={() => lastTooltip.current ? props.onAppointmentTooltipShown?.(lastTooltip.current) : undefined} onAfterClose={() => lastTooltip.current ? props.onAppointmentTooltipClosed?.(lastTooltip.current) : undefined} onLifecycleError={() => setError(labels.operationError)} width="min(28rem, 92vw)" {...props.appointmentTooltipOptions} header={tooltip ? props.renderAppointmentTooltipHeader?.(context(tooltip)) : undefined} headerText={tooltip?.title}>
      {tooltip && (props.renderAppointmentTooltip?.(context(tooltip)) ?? <div dir={direction}><p>{tooltip.description}</p><p>{tooltip.location}</p><p>{timeFormat.format(tooltip.startMs)} – {timeFormat.format(tooltip.endMs)}</p><CgButton onClick={closeTooltip}>{labels.cancel}</CgButton></div>)}
    </CgPopup>
    <CgPopup open={!!moreDate} onOpenChange={(open) => { if (!open) setMoreDate(null); }} headerText={moreDate ? longDate(moreDate) : ''}>
      <div className={styles.moreList}>{moreDate && appointments.filter((a) => a.startMs < boundary(addDays(moreDate, 1), zone) && a.endMs > boundary(moreDate, zone)).map((a) => <CgButton key={a.key} appearance="outline" onClick={() => { choose(a, null); openEditor(a); }}>{a.title}</CgButton>)}</div>
    </CgPopup>
  </div>;
}
