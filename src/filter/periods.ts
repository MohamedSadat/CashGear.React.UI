import type { CgFilterDateRange, CgFilterEvaluationContext, CgFilterPeriod } from './types';

export const CG_FILTER_PERIODS: ReadonlyArray<CgFilterPeriod> = Object.freeze([
  'today', 'yesterday', 'tomorrow', 'thisWeek', 'lastWeek', 'nextWeek', 'thisMonth', 'lastMonth', 'nextMonth',
  'thisQuarter', 'lastQuarter', 'nextQuarter', 'thisYear', 'lastYear', 'nextYear', 'yearToDate', 'monthToDate',
  'beforeThisYear', 'afterThisYear',
]);

export function createFilterEvaluationContext(options: Partial<CgFilterEvaluationContext> & Pick<CgFilterEvaluationContext, 'timeZone'>): CgFilterEvaluationContext {
  if (!options.timeZone.trim()) throw new Error('Filter evaluation timeZone must not be blank.');
  const firstDayOfWeek = options.firstDayOfWeek ?? 1;
  if (!Number.isInteger(firstDayOfWeek) || firstDayOfWeek < 0 || firstDayOfWeek > 6) throw new Error('Filter firstDayOfWeek must be from 0 through 6.');
  // Forces invalid IANA zones to fail during configuration rather than during row evaluation.
  new Intl.DateTimeFormat('en-US', { timeZone: options.timeZone }).format(new Date(0));
  return Object.freeze({ now: options.now ?? (() => new Date()), timeZone: options.timeZone, firstDayOfWeek, locale: options.locale });
}

function dateParts(date: Date, timeZone: string): [number, number, number] {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return [part('year'), part('month'), part('day')];
}

function civil(year: number, month: number, day: number): Date { return new Date(Date.UTC(year, month - 1, day)); }
function addDays(date: Date, days: number): Date { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; }
function addMonths(date: Date, months: number): Date { return civil(date.getUTCFullYear(), date.getUTCMonth() + months + 1, 1); }
function text(date: Date): string { return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`; }
function span(start: Date | null, endExclusive: Date | null): CgFilterDateRange { return { start: start ? text(start) : null, endExclusive: endExclusive ? text(endExclusive) : null }; }

export function currentCivilDate(context: CgFilterEvaluationContext): string {
  const [year, month, day] = dateParts(context.now(), context.timeZone);
  return text(civil(year, month, day));
}

export function resolveFilterPeriod(period: CgFilterPeriod, context: CgFilterEvaluationContext): CgFilterDateRange {
  if (!CG_FILTER_PERIODS.includes(period)) throw new Error(`Unknown relative filter period '${String(period)}'.`);
  const [year, month, day] = dateParts(context.now(), context.timeZone);
  const today = civil(year, month, day);
  const weekday = today.getUTCDay();
  const weekStart = addDays(today, -((weekday - context.firstDayOfWeek + 7) % 7));
  const monthStart = civil(year, month, 1);
  const quarterStart = civil(year, Math.floor((month - 1) / 3) * 3 + 1, 1);
  const yearStart = civil(year, 1, 1);
  switch (period) {
    case 'today': return span(today, addDays(today, 1));
    case 'yesterday': return span(addDays(today, -1), today);
    case 'tomorrow': return span(addDays(today, 1), addDays(today, 2));
    case 'thisWeek': return span(weekStart, addDays(weekStart, 7));
    case 'lastWeek': return span(addDays(weekStart, -7), weekStart);
    case 'nextWeek': return span(addDays(weekStart, 7), addDays(weekStart, 14));
    case 'thisMonth': return span(monthStart, addMonths(monthStart, 1));
    case 'lastMonth': return span(addMonths(monthStart, -1), monthStart);
    case 'nextMonth': return span(addMonths(monthStart, 1), addMonths(monthStart, 2));
    case 'thisQuarter': return span(quarterStart, addMonths(quarterStart, 3));
    case 'lastQuarter': return span(addMonths(quarterStart, -3), quarterStart);
    case 'nextQuarter': return span(addMonths(quarterStart, 3), addMonths(quarterStart, 6));
    case 'thisYear': return span(yearStart, civil(year + 1, 1, 1));
    case 'lastYear': return span(civil(year - 1, 1, 1), yearStart);
    case 'nextYear': return span(civil(year + 1, 1, 1), civil(year + 2, 1, 1));
    case 'yearToDate': return span(yearStart, addDays(today, 1));
    case 'monthToDate': return span(monthStart, addDays(today, 1));
    case 'beforeThisYear': return span(null, yearStart);
    case 'afterThisYear': return span(civil(year + 1, 1, 1), null);
  }
}

export function valueCivilDate(value: unknown, timeZone = 'UTC'): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const [year, month, day] = dateParts(value, timeZone);
    return text(civil(year, month, day));
  }
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const [year, month, day] = dateParts(parsed, timeZone);
  return text(civil(year, month, day));
}
