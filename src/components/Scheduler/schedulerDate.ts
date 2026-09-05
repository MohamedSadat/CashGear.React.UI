import type { CgDayOfWeek } from '../../types/date';
import type { CgSchedulerView, CgSchedulerVisibleRange } from './CgScheduler.types';

export const MINUTE = 60_000;
export const DAY = 86_400_000;
export const WEEKDAYS: readonly CgDayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const WORKING_DAYS: readonly CgDayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const formatters = new Map<string, Intl.DateTimeFormat>();
const boundaries = new Map<string, number>();
function formatter(zone: string) {
  let result = formatters.get(zone);
  if (!result) {
    result = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    if (formatters.size > 32) formatters.clear();
    formatters.set(zone, result);
  }
  return result;
}
export function localParts(instant: number, zone: string) {
  const p = Object.fromEntries(formatter(zone).formatToParts(instant).map((part) => [part.type, part.value]));
  return { date: `${p.year!.padStart(4, '0')}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), seconds: Number(p.second) };
}
export function civil(value: string): number {
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value) throw new Error('CgScheduler requires a valid YYYY-MM-DD date.');
  return result;
}
export function addDays(date: string, count: number): string { return new Date(civil(date) + count * DAY).toISOString().slice(0, 10); }
export function dayIndex(date: string): number { return new Date(civil(date)).getUTCDay(); }
export function instant(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('CgScheduler instants require an explicit ISO timezone offset.');
  civil(value.slice(0, 10));
  // .NET DateTimeOffset commonly serializes seven fraction digits. Use JS millisecond precision consistently across browsers.
  const normalized = value.replace(/\.(\d+)(?=Z|[+-])/, (_match, fraction: string) => `.${fraction.slice(0, 3).padEnd(3, '0')}`);
  const result = Date.parse(normalized);
  if (!Number.isFinite(result)) throw new Error('Invalid CgScheduler instant.');
  return result;
}
export function iso(value: number): string { return new Date(value).toISOString(); }
export function timeMinutes(value: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(value)) throw new Error('CgScheduler times require HH:mm.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
/** Resolve wall time with the source policy: earliest repeated instant, advance gaps to first valid minute. */
export function zonedInstant(date: string, minutes: number, zone: string): number {
  const wall = civil(date) + minutes * MINUTE;
  const offsets = new Set<number>();
  // Sample both sides of an offset transition, including a skipped civil day.
  for (const delta of [-2, -1, 0, 1, 2]) {
    const sample = wall + delta * DAY;
    const p = localParts(sample, zone);
    offsets.add(civil(p.date) + p.minutes * MINUTE + p.seconds * 1000 - sample);
  }
  for (let advance = 0; advance <= 1440; advance++) {
    const target = wall + advance * MINUTE;
    const matches: number[] = [];
    for (const offset of offsets) {
      const candidate = target - offset;
      const p = localParts(candidate, zone);
      if (civil(p.date) + p.minutes * MINUTE + p.seconds * 1000 === target) matches.push(candidate);
    }
    if (matches.length) return Math.min(...matches);
  }
  throw new Error('Unable to resolve scheduler time in display timezone.');
}
export function boundary(date: string, zone: string): number {
  const key = `${zone}/${date}`;
  let value = boundaries.get(key);
  if (value === undefined) { value = zonedInstant(date, 0, zone); if (boundaries.size > 2000) boundaries.clear(); boundaries.set(key, value); }
  return value;
}
export function localInput(value: string, zone: string): string {
  const p = localParts(instant(value), zone);
  return `${p.date}T${String(Math.floor(p.minutes / 60)).padStart(2, '0')}:${String(p.minutes % 60).padStart(2, '0')}`;
}
export function fromLocalInput(value: string, zone: string): string { return iso(zonedInstant(value.slice(0, 10), timeMinutes(value.slice(11)), zone)); }
export function visibleDates(date: string, view: CgSchedulerView, first: number, working: readonly CgDayOfWeek[], dayCount = 1, monthCount = 1): string[] {
  civil(date);
  const weekStart = (d: string) => addDays(d, -((dayIndex(d) - first + 7) % 7));
  if (view === 'day' || view === 'timeline') return Array.from({ length: dayCount }, (_, n) => addDays(date, n));
  if (view === 'week' || view === 'workWeek') return Array.from({ length: 7 }, (_, n) => addDays(weekStart(date), n)).filter((d) => view === 'week' || working.includes(WEEKDAYS[dayIndex(d)]!));
  const start = weekStart(`${date.slice(0, 7)}-01`);
  const next = new Date(civil(`${date.slice(0, 7)}-01`));
  next.setUTCMonth(next.getUTCMonth() + monthCount);
  const end = addDays(weekStart(addDays(next.toISOString().slice(0, 10), -1)), 7);
  return Array.from({ length: (civil(end) - civil(start)) / DAY }, (_, n) => addDays(start, n));
}
export function navigateDate(date: string, view: CgSchedulerView, direction: number): string {
  if (view !== 'month') return addDays(date, direction * (view === 'week' || view === 'workWeek' ? 7 : 1));
  const d = new Date(civil(date));
  const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + direction);
  const last = new Date(d.getTime()); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  d.setUTCDate(Math.min(day, last.getUTCDate()));
  return d.toISOString().slice(0, 10);
}
export function visibleRange(dates: readonly string[], zone: string, timelineDuration?: number): CgSchedulerVisibleRange {
  const startDate = dates[0]!;
  const start = boundary(startDate, zone);
  const end = timelineDuration ? start + timelineDuration * MINUTE : boundary(addDays(dates.at(-1)!, 1), zone);
  return { startDate, endDate: timelineDuration ? addDays(localParts(end - 1, zone).date, 1) : addDays(dates.at(-1)!, 1), start: iso(start), end: iso(end) };
}
export interface SchedulerSlot { start: number; end: number; date: string; minutes: number; working: boolean }
export function slots(date: string, zone: string, interval: number, working: readonly CgDayOfWeek[], workStart: number, workEnd: number, visibleStart = 0, visibleEnd = 1440): SchedulerSlot[] {
  const result: SchedulerSlot[] = [];
  const end = boundary(addDays(date, 1), zone);
  for (let start = boundary(date, zone); start < end; start += interval * MINUTE) {
    const p = localParts(start, zone);
    if (p.minutes >= visibleStart && p.minutes < visibleEnd) result.push({ start, end: Math.min(start + interval * MINUTE, end), date, minutes: p.minutes, working: working.includes(WEEKDAYS[dayIndex(date)]!) && p.minutes >= workStart && p.minutes < workEnd });
  }
  return result;
}
