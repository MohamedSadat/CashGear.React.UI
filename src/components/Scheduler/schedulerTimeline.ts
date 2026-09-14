import { addDays, civil, DAY, iso, localParts, MINUTE, zonedInstant } from './schedulerDate';
import type { CgSchedulerTimeScale } from './CgScheduler.types';
export function advanceScale(start: number, scale: CgSchedulerTimeScale, zone: string): number {
  const count = scale.unitCount ?? 1;
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Timeline scale count must be a positive integer.');
  const fixed = { second: 1000, minute: MINUTE, hour: 60 * MINUTE, day: DAY, week: 7 * DAY };
  if (scale.unit in fixed) return start + fixed[scale.unit as keyof typeof fixed] * count;
  const months = { month: 1, quarter: 3, year: 12 }[scale.unit as 'month' | 'quarter' | 'year'];
  if (!months) throw new Error('Unknown Scheduler timeline scale.');
  const local = localParts(start, zone), date = new Date(civil(`${local.date.slice(0, 7)}-01`));
  date.setUTCMonth(date.getUTCMonth() + months * count);
  const last = new Date(date); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  const nextDate = addDays(iso(date.getTime()).slice(0, 10), Math.min(Number(local.date.slice(8)), last.getUTCDate()) - 1);
  return zonedInstant(nextDate, local.minutes, zone) + local.seconds * 1000 + ((start % 1000) + 1000) % 1000;
}
export function scaleCells(start: number, end: number, scale: CgSchedulerTimeScale, zone: string, locale: string): readonly { start: number; end: number; label: string }[] {
  const result = [];
  for (let time = start; time < end;) {
    if (result.length >= 50_000) throw new Error('Scheduler timeline exceeds 50,000 cells. Choose a coarser scale.');
    const next = advanceScale(time, scale, zone); if (!Number.isFinite(next) || next <= time) throw new Error('Invalid timeline scale interval.');
    const options: Intl.DateTimeFormatOptions = scale.unit === 'year' ? { year: 'numeric' } : scale.unit === 'month' || scale.unit === 'quarter' ? { month: 'long', year: 'numeric' } : scale.unit === 'week' || scale.unit === 'day' ? { month: 'short', day: 'numeric' } : { hour: '2-digit', minute: '2-digit', ...(scale.unit === 'second' ? { second: '2-digit' as const } : {}) };
    const local = localParts(time, zone);
    result.push({ start: time, end: Math.min(end, next), label: scale.unit === 'quarter' ? `Q${Math.ceil(Number(local.date.slice(5, 7)) / 3)} ${local.date.slice(0, 4)}` : new Intl.DateTimeFormat(locale, { ...options, timeZone: zone }).format(time) }); time = next;
  }
  return result;
}
