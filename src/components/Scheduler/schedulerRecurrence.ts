import type { CgSchedulerAppointmentDraft, CgSchedulerRecurrenceRule, CgSchedulerVisibleRange } from './CgScheduler.types';
import { addDays, boundary, civil, DAY, dayIndex, instant, iso, localParts, MINUTE, WEEKDAYS, zonedInstant } from './schedulerDate';

const LIMIT = 500_000;
const limitError = () => new Error('Scheduler recurrence generated more than 500,000 candidates. Add an end date or reduce its range.');
export function validateRecurrence(rule: CgSchedulerRecurrenceRule): void {
  if (!['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(rule.frequency) || !['noEndDate', 'occurrenceCount', 'endByDate'].includes(rule.range ?? 'noEndDate') || !['none', 'first', 'second', 'third', 'fourth', 'last'].includes(rule.weekOfMonth ?? 'none')) throw new Error('Unknown Scheduler recurrence rule.');
  if (!Number.isSafeInteger(rule.interval ?? 1) || (rule.interval ?? 1) <= 0) throw new Error('Recurrence interval must be a positive integer.');
  if (rule.range === 'occurrenceCount' && (!Number.isSafeInteger(rule.occurrenceCount ?? 10) || (rule.occurrenceCount ?? 10) <= 0)) throw new Error('Recurrence count must be a positive integer.');
  if (rule.range === 'endByDate') { if (!rule.endDate) throw new Error('Recurrence requires an end date.'); civil(rule.endDate); }
  for (const [value, maximum, name] of [[rule.dayOfMonth, 31, 'day'], [rule.month, 12, 'month']] as const) if (value != null && (!Number.isInteger(value) || value < 1 || value > maximum)) throw new Error(`Invalid recurrence ${name}.`);
  if (rule.weekDays?.some(day => !WEEKDAYS.includes(day))) throw new Error('Invalid recurrence weekday.');
  for (const exception of rule.exceptions ?? []) {
    instant(exception.originalStart);
    if (!exception.isDeleted && exception.replacement && instant(exception.replacement.end) <= instant(exception.replacement.start)) throw new Error('Replacement occurrence must end after it starts.');
  }
}
/** Clone only owned recurrence data; caller records are never frozen or mutated. */
export function snapshotRecurrence(rule: CgSchedulerRecurrenceRule): CgSchedulerRecurrenceRule {
  validateRecurrence(rule);
  return Object.freeze({ ...rule, weekDays: Object.freeze([...new Set(rule.weekDays ?? [])]), exceptions: Object.freeze((rule.exceptions ?? []).map(exception => Object.freeze({ ...exception, replacement: exception.replacement ? Object.freeze({ ...exception.replacement, recurrence: undefined }) : undefined }))) });
}
export function changeOccurrence(rule: CgSchedulerRecurrenceRule, originalStart: string, replacement: CgSchedulerAppointmentDraft | 'delete' | 'restore'): CgSchedulerRecurrenceRule {
  const key = instant(originalStart);
  const exceptions = (rule.exceptions ?? []).filter(value => instant(value.originalStart) !== key);
  if (replacement !== 'restore') exceptions.push({ originalStart: iso(key), ...(replacement === 'delete' ? { isDeleted: true } : { replacement }) });
  return snapshotRecurrence({ ...rule, exceptions });
}
function monthDates(year: number, month: number, anchor: string, rule: CgSchedulerRecurrenceRule): string[] {
  if (year < 1 || year > 9999) return [];
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const date = new Date(civil(first)); date.setUTCMonth(month); date.setUTCDate(0);
  const last = date.getUTCDate();
  if (!rule.weekOfMonth || rule.weekOfMonth === 'none') return [addDays(first, Math.min(rule.dayOfMonth ?? Number(anchor.slice(8)), last) - 1)];
  const weekdays = rule.weekDays?.length ? rule.weekDays : [WEEKDAYS[dayIndex(anchor)]!];
  return [...new Set(weekdays)].map(weekday => {
    const day = WEEKDAYS.indexOf(weekday);
    const offset = rule.weekOfMonth === 'last' ? last - 1 - (dayIndex(addDays(first, last - 1)) - day + 7) % 7 : (day - dayIndex(first) + 7) % 7 + ['first', 'second', 'third', 'fourth'].indexOf(rule.weekOfMonth!) * 7;
    return addDays(first, offset);
  }).sort();
}
function* candidates(anchor: string, rule: CgSchedulerRecurrenceRule): Generator<string> {
  const interval = rule.interval ?? 1;
  const weekday = dayIndex(anchor);
  const days = [...new Set(rule.weekDays?.length ? rule.weekDays.map(day => WEEKDAYS.indexOf(day)) : [weekday])].sort();
  if (rule.frequency === 'daily' && interval % 7 === 0 && !days.includes(weekday)) throw new Error('Scheduler recurrence has no reachable weekdays.');
  for (let period = 0; ; period++) {
    if (period >= LIMIT) throw limitError(); // Also bounds impossible weekday/interval combinations.
    let dates: string[];
    if (rule.frequency === 'daily') {
      const date = addDays(anchor, period * interval);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Scheduler recurrence exceeds the supported year range.');
      dates = !rule.weekDays?.length || days.includes(dayIndex(date)) ? [date] : [];
    } else if (rule.frequency === 'weekly') dates = days.map(day => addDays(anchor, -weekday + period * interval * 7 + day));
    else {
      const monthIndex = Number(anchor.slice(0, 4)) * 12 + Number(anchor.slice(5, 7)) - 1 + (rule.frequency === 'monthly' ? period * interval : period * interval * 12);
      const year = Math.floor(monthIndex / 12); if (year > 9999) throw new Error('Scheduler recurrence exceeds the supported year range.');
      dates = monthDates(year, rule.frequency === 'yearly' ? rule.month ?? Number(anchor.slice(5, 7)) : monthIndex % 12 + 1, anchor, rule);
    }
    for (const date of dates) { if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Scheduler recurrence exceeds the supported year range.'); if (date >= anchor) yield date; }
  }
}
export interface Occurrence { start: string; end: string; originalStart: string; replacement?: Readonly<CgSchedulerAppointmentDraft> }
export function expandRecurrence(draft: CgSchedulerAppointmentDraft, range: CgSchedulerVisibleRange, zone: string): readonly Occurrence[] {
  const startMs = instant(draft.start), endMs = instant(draft.end), from = instant(range.start), to = instant(range.end);
  const rule = draft.recurrence;
  if (!rule || rule.frequency === 'none') return endMs > from && startMs < to ? [{ start: draft.start, end: draft.end, originalStart: draft.start }] : [];
  validateRecurrence(rule);
  const anchor = localParts(startMs, zone); const localEnd = localParts(endMs, zone);
  const preferredOffset = civil(anchor.date) + anchor.minutes * MINUTE + anchor.seconds * 1000 + ((startMs % 1000) + 1000) % 1000 - startMs;
  const exceptions = new Map((rule.exceptions ?? []).map(exception => [instant(exception.originalStart), exception]));
  // Include replacement occurrences moved into the window from later pattern dates.
  const lastNeeded = Math.max(to, ...[...exceptions].filter(([, value]) => !value.isDeleted && value.replacement && instant(value.replacement.end) > from && instant(value.replacement.start) < to).map(([key]) => key));
  const result: Occurrence[] = []; let count = 0;
  for (const date of candidates(anchor.date, rule)) {
    if (rule.range === 'endByDate' && date > rule.endDate!) break;
    if (rule.range === 'occurrenceCount' && count >= (rule.occurrenceCount ?? 10)) break;
    if (++count > LIMIT) throw limitError();
    const wall = civil(date) + anchor.minutes * MINUTE;
    const preferred = wall - preferredOffset; const parts = localParts(preferred, zone);
    const ms = (parts.date === date && parts.minutes === anchor.minutes ? preferred : zonedInstant(date, anchor.minutes, zone)) + anchor.seconds * 1000 + ((startMs % 1000) + 1000) % 1000;
    const originalStart = iso(ms), exception = exceptions.get(ms);
    const start = exception?.replacement ? instant(exception.replacement.start) : ms;
    const end = exception?.replacement ? instant(exception.replacement.end) : draft.isAllDay ? boundary(addDays(date, Math.max(1, (civil(localEnd.date) - civil(anchor.date)) / DAY)), zone) : ms + endMs - startMs;
    if (!exception?.isDeleted && end > from && start < to) result.push(Object.freeze({ start: iso(start), end: iso(end), originalStart, replacement: exception?.replacement }));
    if (ms >= lastNeeded) break;
  }
  return Object.freeze(result.sort((a, b) => instant(a.start) - instant(b.start)));
}
