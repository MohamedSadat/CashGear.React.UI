import type { CgSchedulerAppointmentDraft, CgSchedulerRecurrenceRule, CgSchedulerVisibleRange } from './CgScheduler.types';
import type { CgRecurrenceProblem } from '../RecurrenceFields/CgRecurrenceFields.types';
import { cgValidateRecurrence, instantClock, RECURRENCE_LIMIT, recurrenceDates } from '../RecurrenceFields/recurrence';
import { addDays, boundary, civil, DAY, instant, iso, localParts } from './schedulerDate';

const MESSAGES: Readonly<Record<Exclude<CgRecurrenceProblem, 'unreachable'>, string>> = {
  rule: 'Unknown Scheduler recurrence rule.', interval: 'Recurrence interval must be a positive integer.', occurrenceCount: 'Recurrence count must be a positive integer.',
  endDate: 'Recurrence requires an end date.', dayOfMonth: 'Invalid recurrence day.', month: 'Invalid recurrence month.', weekDays: 'Invalid recurrence weekday.',
};
const limitError = () => new Error('Scheduler recurrence generated more than 500,000 candidates. Add an end date or reduce its range.');
export function validateRecurrence(rule: CgSchedulerRecurrenceRule): void {
  const problem = cgValidateRecurrence(rule);
  if (problem === 'endDate' && rule.endDate) civil(rule.endDate);
  if (problem && problem !== 'unreachable') throw new Error(MESSAGES[problem]);
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
export interface Occurrence { start: string; end: string; originalStart: string; replacement?: Readonly<CgSchedulerAppointmentDraft> }
export function expandRecurrence(draft: CgSchedulerAppointmentDraft, range: CgSchedulerVisibleRange, zone: string): readonly Occurrence[] {
  const startMs = instant(draft.start), endMs = instant(draft.end), from = instant(range.start), to = instant(range.end);
  const rule = draft.recurrence;
  if (!rule || rule.frequency === 'none') return endMs > from && startMs < to ? [{ start: draft.start, end: draft.end, originalStart: draft.start }] : [];
  validateRecurrence(rule);
  const clock = instantClock(startMs, zone); const localEnd = localParts(endMs, zone);
  const exceptions = new Map((rule.exceptions ?? []).map(exception => [instant(exception.originalStart), exception]));
  // Include replacement occurrences moved into the window from later pattern dates.
  const lastNeeded = Math.max(to, ...[...exceptions].filter(([, value]) => !value.isDeleted && value.replacement && instant(value.replacement.end) > from && instant(value.replacement.start) < to).map(([key]) => key));
  const result: Occurrence[] = []; let count = 0;
  for (const date of recurrenceDates(clock.date, rule)) {
    if (rule.range === 'endByDate' && date > rule.endDate!) break;
    if (rule.range === 'occurrenceCount' && count >= (rule.occurrenceCount ?? 10)) break;
    if (++count > RECURRENCE_LIMIT) throw limitError();
    const ms = clock.at(date);
    const originalStart = iso(ms), exception = exceptions.get(ms);
    const start = exception?.replacement ? instant(exception.replacement.start) : ms;
    const end = exception?.replacement ? instant(exception.replacement.end) : draft.isAllDay ? boundary(addDays(date, Math.max(1, (civil(localEnd.date) - civil(clock.date)) / DAY)), zone) : ms + endMs - startMs;
    if (!exception?.isDeleted && end > from && start < to) result.push(Object.freeze({ start: iso(start), end: iso(end), originalStart, replacement: exception?.replacement }));
    if (ms >= lastNeeded) break;
  }
  return Object.freeze(result.sort((a, b) => instant(a.start) - instant(b.start)));
}
