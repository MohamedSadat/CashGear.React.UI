import { expandAppointments } from './schedulerLayout';
import type { Appointment } from './schedulerLayout';
import { addDays, instant, iso, localParts, MINUTE } from './schedulerDate';
export function schedulerReminders<T>(appointments: readonly Appointment<T>[], selector: ((item: T) => number | null | undefined) | undefined, windowStart: string, windowEnd: string, zone: string) {
  const from = instant(windowStart), to = instant(windowEnd);
  if (to <= from) throw new Error('Scheduler reminder window end must be after its start.');
  if (!selector) return [];
  const leads = new Map(appointments.map(appointment => [appointment.id, selector(appointment.item)]));
  const valid = [...leads.values()].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const end = to + valid.reduce((max, lead) => Math.max(max, lead), 0) * MINUTE + 1;
  const range = { start: iso(from), end: iso(end), startDate: localParts(from, zone).date, endDate: addDays(localParts(end - 1, zone).date, 1) };
  return Object.freeze(expandAppointments(appointments, range, zone).flatMap(appointment => {
    const lead = leads.get(appointment.id); if (typeof lead !== 'number' || !Number.isFinite(lead) || lead < 0) return [];
    const due = appointment.startMs - lead * MINUTE;
    return due > from && due <= to ? [Object.freeze({ item: appointment.item, id: appointment.id, key: appointment.key, title: appointment.title, appointmentStart: appointment.start, dueAt: iso(due), isOccurrence: !!appointment.originalOccurrenceStart, originalOccurrenceStart: appointment.originalOccurrenceStart })] : [];
  }).sort((a, b) => instant(a.dueAt) - instant(b.dueAt) || a.key.localeCompare(b.key)));
}
