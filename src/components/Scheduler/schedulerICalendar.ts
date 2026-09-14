import type { CgSchedulerAppointmentDraft, CgSchedulerKey, CgSchedulerRecurrenceRule } from './CgScheduler.types';
import { addDays, boundary, instant, iso, localParts, WEEKDAYS } from './schedulerDate';
import { validateRecurrence } from './schedulerRecurrence';
const escape = (value: string) => value.replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;');
const utc = (value: string) => iso(instant(value)).replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const date = (value: string, zone: string) => localParts(instant(value), zone).date.replaceAll('-', '');
function ruleText(rule: CgSchedulerRecurrenceRule, zone: string, allDay: boolean): string {
  validateRecurrence(rule); const parts = [`FREQ=${rule.frequency.toUpperCase()}`];
  if ((rule.interval ?? 1) > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.weekDays?.length) parts.push(`BYDAY=${WEEKDAYS.filter(day => rule.weekDays!.includes(day)).map(day => ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][WEEKDAYS.indexOf(day)]).join(',')}`);
  if (rule.dayOfMonth != null) parts.push(`BYMONTHDAY=${rule.dayOfMonth}`);
  if (rule.weekOfMonth && rule.weekOfMonth !== 'none') parts.push(`BYSETPOS=${rule.weekOfMonth === 'last' ? -1 : ['first', 'second', 'third', 'fourth'].indexOf(rule.weekOfMonth) + 1}`);
  if (rule.month != null) parts.push(`BYMONTH=${rule.month}`);
  if (rule.range === 'occurrenceCount') parts.push(`COUNT=${rule.occurrenceCount ?? 10}`);
  if (rule.range === 'endByDate') parts.push(`UNTIL=${allDay ? rule.endDate!.replaceAll('-', '') : utc(iso(boundary(addDays(rule.endDate!, 1), zone) - 1))}`);
  return parts.join(';');
}
/** Fold by UTF-8 octets without splitting a Unicode character. */
function fold(line: string): string {
  const encoder = new TextEncoder(); let length = 0, result = '';
  for (const character of line) { const bytes = encoder.encode(character).length; if (length + bytes > 73) { result += '\r\n '; length = 1; } result += character; length += bytes; }
  return result;
}
export function schedulerICalendar(appointments: readonly { id: CgSchedulerKey; draft: CgSchedulerAppointmentDraft }[], zone: string, generatedAt: string, calendarName?: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CashGear//CgScheduler//EN', 'CALSCALE:GREGORIAN'];
  if (calendarName?.trim()) lines.push(`X-WR-CALNAME:${escape(calendarName)}`);
  const event = (id: CgSchedulerKey, draft: CgSchedulerAppointmentDraft, originalStart?: string, originalAllDay?: boolean) => {
    lines.push('BEGIN:VEVENT', `UID:${escape(`${typeof id}:${id}`)}@cashgear`, `DTSTAMP:${utc(generatedAt)}`);
    if (originalStart) lines.push(originalAllDay ? `RECURRENCE-ID;VALUE=DATE:${date(originalStart, zone)}` : `RECURRENCE-ID:${utc(originalStart)}`);
    if (draft.isAllDay) lines.push(`DTSTART;VALUE=DATE:${date(draft.start, zone)}`, `DTEND;VALUE=DATE:${addDays(localParts(instant(draft.end) - 1, zone).date, 1).replaceAll('-', '')}`);
    else lines.push(`DTSTART:${utc(draft.start)}`, `DTEND:${utc(draft.end)}`);
    for (const [name, value] of [['SUMMARY', draft.title], ['DESCRIPTION', draft.description], ['LOCATION', draft.location]] as const) if (value?.trim()) lines.push(`${name}:${escape(value)}`);
    if (draft.labelId != null) lines.push(`CATEGORIES:${escape(String(draft.labelId))}`);
    if (draft.statusId != null) lines.push(`X-CG-STATUS:${escape(String(draft.statusId))}`);
    for (const id of draft.resourceIds ?? []) lines.push(`X-CG-RESOURCE-ID:${escape(String(id))}`);
    for (const key of Object.keys(draft.customFields ?? {}).sort()) { const value = draft.customFields![key]; const name = key.toUpperCase().replace(/[^A-Z0-9]/g, '-'); if (value != null && name) lines.push(`X-CG-${name}:${escape(typeof value === 'object' ? JSON.stringify(value) : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' ? String(value) : '')}`); }
    if (!originalStart && draft.recurrence && draft.recurrence.frequency !== 'none') {
      lines.push(`RRULE:${ruleText(draft.recurrence, zone, draft.isAllDay)}`);
      const excluded = [...new Set((draft.recurrence.exceptions ?? []).filter(exception => exception.isDeleted || exception.replacement).map(exception => draft.isAllDay ? date(exception.originalStart, zone) : utc(exception.originalStart)))];
      if (excluded.length) lines.push(`EXDATE${draft.isAllDay ? ';VALUE=DATE' : ''}:${excluded.join(',')}`);
    }
    lines.push('END:VEVENT');
  };
  for (const { id, draft } of appointments) {
    event(id, draft);
    for (const exception of draft.recurrence?.exceptions ?? []) if (!exception.isDeleted && exception.replacement) event(id, { ...exception.replacement, recurrence: undefined }, exception.originalStart, draft.isAllDay);
  }
  lines.push('END:VCALENDAR'); return lines.map(fold).join('\r\n') + '\r\n';
}
export function downloadICalendar(text: string, fileName = 'schedule.ics'): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  try { const anchor = document.createElement('a'); anchor.download = fileName.endsWith('.ics') ? fileName : `${fileName}.ics`; anchor.href = url; anchor.click(); }
  finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
}
