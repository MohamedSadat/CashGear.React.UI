import type { CgSchedulerAppointmentDraft, CgSchedulerKey, CgSchedulerProps, CgSchedulerVisibleRange } from './CgScheduler.types';
import { expandRecurrence, snapshotRecurrence } from './schedulerRecurrence';
import { addDays, boundary, instant, iso, localParts } from './schedulerDate';

export interface Appointment<TItem> extends CgSchedulerAppointmentDraft { item: TItem; id: CgSchedulerKey; key: string; startMs: number; endMs: number; className: string; originalOccurrenceStart?: string; series?: CgSchedulerAppointmentDraft }
export function project<TItem>(items: readonly TItem[], props: CgSchedulerProps<TItem>): Appointment<TItem>[] {
  const keys = new Set<string>();
  return items.flatMap((item) => {
    const id = props.idSelector(item);
    if (!((typeof id === 'string' && id.trim()) || (typeof id === 'number' && Number.isFinite(id)))) throw new Error('CgScheduler appointment IDs must be nonempty strings or finite numbers.');
    const key = `${typeof id}:${id}`;
    if (keys.has(key)) throw new Error(`Duplicate CgScheduler appointment ID: ${id}`);
    keys.add(key);
    const startMs = instant(props.startSelector(item)); const endMs = instant(props.endSelector(item));
    if (endMs <= startMs) return [];
    const recurrence = props.enableRecurrence ? props.recurrenceSelector?.(item) : undefined;
    return [{ item, id, key, startMs, endMs, start: iso(startMs), end: iso(endMs), title: props.titleSelector(item) ?? '', description: props.descriptionSelector?.(item) ?? '', color: props.colorSelector?.(item) ?? '', isAllDay: props.allDaySelector?.(item) ?? false, className: props.cssClassSelector?.(item) ?? '', ...(recurrence ? { recurrence: snapshotRecurrence(recurrence) } : {}), ...(props.locationSelector ? { location: props.locationSelector(item) ?? '' } : {}), ...(props.labelIdSelector ? { labelId: props.labelIdSelector(item) ?? null } : {}), ...(props.statusIdSelector ? { statusId: props.statusIdSelector(item) ?? null } : {}), ...(props.resourceIdsSelector ? { resourceIds: Object.freeze([...new Set(props.resourceIdsSelector(item) ?? [])]) } : {}), ...(props.customFieldsSelector ? { customFields: Object.freeze({ ...props.customFieldsSelector(item) }) } : {}) }];
  }).sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs || a.key.localeCompare(b.key));
}
export function draftOf<TItem>(a: Appointment<TItem>): CgSchedulerAppointmentDraft { return { title: a.title, start: a.start, end: a.end, description: a.description, color: a.color, isAllDay: a.isAllDay, ...(a.recurrence ? { recurrence: snapshotRecurrence(a.recurrence) } : {}), ...(a.location !== undefined ? { location: a.location } : {}), ...(a.labelId !== undefined ? { labelId: a.labelId } : {}), ...(a.statusId !== undefined ? { statusId: a.statusId } : {}), ...(a.resourceIds ? { resourceIds: Object.freeze([...a.resourceIds]) } : {}), ...(a.customFields ? { customFields: Object.freeze({ ...a.customFields }) } : {}) }; }
export function expandAppointments<TItem>(appointments: readonly Appointment<TItem>[], range: CgSchedulerVisibleRange, zone: string): Appointment<TItem>[] {
  return appointments.flatMap(a => expandRecurrence(a, range, zone).map(occurrence => a.recurrence && a.recurrence.frequency !== 'none' ? { ...a, ...occurrence.replacement, start: occurrence.start, end: occurrence.end, startMs: instant(occurrence.start), endMs: instant(occurrence.end), key: `${a.key}@${occurrence.originalStart}`, originalOccurrenceStart: occurrence.originalStart, series: draftOf(a), recurrence: a.recurrence } : a)).sort((a, b) => a.startMs - b.startMs || a.key.localeCompare(b.key));
}
export interface Segment<TItem> { appointment: Appointment<TItem>; start: number; end: number; lane: number; lanes: number; continuesBefore: boolean; continuesAfter: boolean }
/** Interval partitioning: adjacent half-open intervals share a lane; connected overlap groups share widths. */
export function layout<TItem>(appointments: readonly Appointment<TItem>[], start: number, end: number): Segment<TItem>[] {
  const result: Segment<TItem>[] = [];
  let group: Segment<TItem>[] = []; let ends: number[] = []; let groupEnd = -Infinity;
  const finish = () => { for (const segment of group) segment.lanes = ends.length; group = []; ends = []; };
  for (const appointment of [...appointments].sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs || a.key.localeCompare(b.key))) {
    if (appointment.startMs >= end || appointment.endMs <= start) continue;
    const clippedStart = Math.max(start, appointment.startMs); const clippedEnd = Math.min(end, appointment.endMs);
    if (clippedStart >= groupEnd) finish();
    let lane = ends.findIndex((value) => value <= clippedStart);
    if (lane < 0) lane = ends.length;
    ends[lane] = clippedEnd; groupEnd = Math.max(groupEnd, clippedEnd);
    const segment = { appointment, start: clippedStart, end: clippedEnd, lane, lanes: 1, continuesBefore: appointment.startMs < start, continuesAfter: appointment.endMs > end };
    result.push(segment); group.push(segment);
  }
  finish();
  return result;
}

/** Date bands partition occupied display dates, so two timed items on one date never cover each other. */
export function layoutDates<TItem>(appointments: readonly Appointment<TItem>[], start: number, end: number, zone: string): Segment<TItem>[] {
  const originals = new Map(appointments.map((a) => [a.key, a]));
  const spans = appointments.map((a) => ({ ...a, startMs: boundary(localParts(a.startMs, zone).date, zone), endMs: boundary(addDays(localParts(a.endMs - 1, zone).date, 1), zone) }));
  return layout(spans, start, end).map((segment) => ({ ...segment, appointment: originals.get(segment.appointment.key)! }));
}
