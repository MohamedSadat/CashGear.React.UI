import { describe, expect, it } from 'vitest';
import { cgNextOccurrence, cgOccurrencesBetween, cgSummarizeRecurrence, cgValidateRecurrence } from './recurrence';
import type { CgRecurrenceRule, CgRecurrenceSummaryWords } from './CgRecurrenceFields.types';

const english: CgRecurrenceSummaryWords = {
  none: 'Does not repeat',
  every: (frequency, interval) => {
    const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[frequency];
    return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
  },
  onWeekDays: (days) => `on ${days}`,
  onDayOfMonth: (day) => `on day ${day}`,
  onDate: (month, day) => `on ${day} ${month}`,
  onWeekOfMonth: (week, days) => `on the ${week} ${days}`,
  ofMonth: (month) => `of ${month}`,
  times: (count) => `${count} times`,
  until: (date) => `until ${date}`,
};

const arabic: CgRecurrenceSummaryWords = {
  none: 'لا يتكرر',
  every: (frequency, interval) => {
    const unit = { daily: ['يوم', 'يومين', 'أيام'], weekly: ['أسبوع', 'أسبوعين', 'أسابيع'], monthly: ['شهر', 'شهرين', 'أشهر'], yearly: ['سنة', 'سنتين', 'سنوات'] }[frequency];
    return interval === 1 ? `كل ${unit[0]}` : interval === 2 ? `كل ${unit[1]}` : `كل ${interval} ${unit[2]}`;
  },
  onWeekDays: (days) => `يوم ${days}`,
  onDayOfMonth: (day) => `في اليوم ${day}`,
  onDate: (month, day) => `في ${day} ${month}`,
  onWeekOfMonth: (week, days) => `في ${days} ${{ first: 'الأول', second: 'الثاني', third: 'الثالث', fourth: 'الرابع', last: 'الأخير' }[week]}`,
  ofMonth: (month) => `من ${month}`,
  times: (count) => `${count} مرات`,
  until: (date) => `حتى ${date}`,
  sentence: ({ every, on, month, end }) => [every, on, month].filter(Boolean).join(' ') + (end ? `، ${end}` : ''),
};

const days = (rule: CgRecurrenceRule, start: string, from: string, to: string) => cgOccurrencesBetween({ rule, start }, from, to);

describe('cgValidateRecurrence', () => {
  it('names the field to correct, in the order the scheduler checks them', () => {
    expect(cgValidateRecurrence({ frequency: 'weekly', weekDays: ['monday'] })).toBeNull();
    expect(cgValidateRecurrence({ frequency: 'hourly' as never })).toBe('rule');
    expect(cgValidateRecurrence({ frequency: 'daily', range: 'forever' as never })).toBe('rule');
    expect(cgValidateRecurrence({ frequency: 'monthly', weekOfMonth: 'fifth' as never })).toBe('rule');
    expect(cgValidateRecurrence({ frequency: 'daily', interval: 0 })).toBe('interval');
    expect(cgValidateRecurrence({ frequency: 'daily', interval: 1.5 })).toBe('interval');
    expect(cgValidateRecurrence({ frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 0 })).toBe('occurrenceCount');
    expect(cgValidateRecurrence({ frequency: 'daily', range: 'endByDate' })).toBe('endDate');
    expect(cgValidateRecurrence({ frequency: 'daily', range: 'endByDate', endDate: '2026-02-30' })).toBe('endDate');
    expect(cgValidateRecurrence({ frequency: 'monthly', dayOfMonth: 32 })).toBe('dayOfMonth');
    expect(cgValidateRecurrence({ frequency: 'yearly', month: 13 })).toBe('month');
    expect(cgValidateRecurrence({ frequency: 'weekly', weekDays: ['funday' as never] })).toBe('weekDays');
    expect(cgValidateRecurrence({ frequency: 'daily', interval: 0, range: 'endByDate' })).toBe('interval');
  });

  it('finds a rule that can never fall on a day only when given its start', () => {
    const rule: CgRecurrenceRule = { frequency: 'daily', interval: 14, weekDays: ['monday'] };
    expect(cgValidateRecurrence(rule)).toBeNull();
    expect(cgValidateRecurrence(rule, '2026-11-30')).toBeNull();
    expect(cgValidateRecurrence(rule, '2026-12-01')).toBe('unreachable');
    // 23:30 on a Sunday in New York is a Monday in UTC: the zone's day counts.
    expect(cgValidateRecurrence(rule, '2026-11-30T04:30:00Z', 'America/New_York')).toBe('unreachable');
    expect(cgOccurrencesBetween({ rule, start: '2026-12-01' }, '2026-01-01', '2028-01-01')).toEqual([]);
    expect(cgNextOccurrence({ rule, start: '2026-12-01' }, '2026-12-01')).toBeNull();
  });
});

describe('cgNextOccurrence and cgOccurrencesBetween on days', () => {
  it('takes a short month\'s last day for the 31st and comes back to the 31st', () => {
    const rule: CgRecurrenceRule = { frequency: 'monthly', dayOfMonth: 31 };
    expect(days(rule, '2026-01-31', '2026-01-01', '2026-06-01')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
    expect(cgNextOccurrence({ rule, start: '2026-01-31' }, '2026-01-31')).toBe('2026-02-28');
    expect(cgNextOccurrence({ rule, start: '2026-01-31' }, '2026-04-15')).toBe('2026-04-30');
  });

  it('keeps 29 February in a leap year and its month\'s last day otherwise', () => {
    const rule: CgRecurrenceRule = { frequency: 'yearly' };
    expect(days(rule, '2024-02-29', '2024-01-01', '2029-01-01')).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('repeats weekly on chosen days every so many weeks, from the week of the start', () => {
    const rule: CgRecurrenceRule = { frequency: 'weekly', interval: 2, weekDays: ['wednesday', 'monday'] };
    expect(days(rule, '2026-11-30', '2026-11-30', '2027-01-01')).toEqual(['2026-11-30', '2026-12-02', '2026-12-14', '2026-12-16', '2026-12-28', '2026-12-30']);
    // A start on a Tuesday: that week's Wednesday is the first.
    expect(cgNextOccurrence({ rule, start: '2026-12-01' }, '2026-11-01')).toBe('2026-12-02');
    // No days: the start's weekday.
    expect(days({ frequency: 'weekly' }, '2026-12-01', '2026-12-01', '2026-12-16')).toEqual(['2026-12-01', '2026-12-08', '2026-12-15']);
  });

  it('repeats monthly on a weekday of a week, the last one too', () => {
    expect(days({ frequency: 'monthly', weekOfMonth: 'last', weekDays: ['friday'] }, '2026-01-30', '2026-01-01', '2026-05-01')).toEqual(['2026-01-30', '2026-02-27', '2026-03-27', '2026-04-24']);
    // A fifth Thursday exists in October 2026, but the fourth is the fourth.
    expect(days({ frequency: 'monthly', weekOfMonth: 'fourth', weekDays: ['thursday'] }, '2026-10-01', '2026-10-01', '2026-12-01')).toEqual(['2026-10-22', '2026-11-26']);
    expect(days({ frequency: 'monthly', weekOfMonth: 'last', weekDays: ['thursday'] }, '2026-10-01', '2026-10-01', '2026-12-01')).toEqual(['2026-10-29', '2026-11-26']);
    expect(days({ frequency: 'yearly', month: 11, weekOfMonth: 'fourth', weekDays: ['thursday'] }, '2026-01-01', '2026-01-01', '2029-01-01')).toEqual(['2026-11-26', '2027-11-25', '2028-11-23']);
  });

  it('ends after a count (the start counted when the rule falls on it) or on a date, inclusive', () => {
    const counted: CgRecurrenceRule = { frequency: 'daily', interval: 3, range: 'occurrenceCount', occurrenceCount: 3 };
    expect(days(counted, '2026-12-01', '2026-01-01', '2027-01-01')).toEqual(['2026-12-01', '2026-12-04', '2026-12-07']);
    expect(cgNextOccurrence({ rule: counted, start: '2026-12-01' }, '2026-12-04')).toBe('2026-12-07');
    expect(cgNextOccurrence({ rule: counted, start: '2026-12-01' }, '2026-12-07')).toBeNull();
    const until: CgRecurrenceRule = { frequency: 'weekly', range: 'endByDate', endDate: '2026-12-15' };
    expect(days(until, '2026-12-01', '2026-01-01', '2027-01-01')).toEqual(['2026-12-01', '2026-12-08', '2026-12-15']);
  });

  it('gives a rule that does not repeat its start once, and stops at the limit', () => {
    expect(cgNextOccurrence({ rule: { frequency: 'none' }, start: '2026-12-01' }, '2026-11-30')).toBe('2026-12-01');
    expect(cgNextOccurrence({ rule: { frequency: 'none' }, start: '2026-12-01' }, '2026-12-01')).toBeNull();
    expect(cgOccurrencesBetween({ rule: { frequency: 'daily' }, start: '2026-01-01' }, '2026-01-01', '2027-01-01', 5)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']);
  });

  it('reads an instant bound of a day series as its day in the zone', () => {
    // 23:00 on 1 December in New York is the 2nd in UTC: after the 1st means from the 2nd.
    expect(cgNextOccurrence({ rule: { frequency: 'daily' }, start: '2026-11-01', timeZone: 'America/New_York' }, '2026-12-02T04:00:00Z')).toBe('2026-12-02');
    expect(cgNextOccurrence({ rule: { frequency: 'daily' }, start: '2026-11-01' }, '2026-12-02T04:00:00Z')).toBe('2026-12-03');
  });

  it('refuses an invalid rule, start or bound', () => {
    expect(() => cgNextOccurrence({ rule: { frequency: 'daily', interval: -1 }, start: '2026-12-01' }, '2026-12-01')).toThrow(/interval/);
    expect(() => cgNextOccurrence({ rule: { frequency: 'daily' }, start: '2026-12-01T10:00' }, '2026-12-01')).toThrow(RangeError);
    expect(() => cgOccurrencesBetween({ rule: { frequency: 'daily' }, start: '2026-12-01' }, 'soon', '2027-01-01')).toThrow(RangeError);
  });
});

describe('cgNextOccurrence and cgOccurrencesBetween on instants', () => {
  it('keeps the wall-clock time across a change of offset in the zone, as the scheduler does', () => {
    const series = { rule: { frequency: 'daily' } as const, start: '2026-03-07T14:00:00Z', timeZone: 'America/New_York' };
    expect(cgOccurrencesBetween(series, '2026-03-07T00:00:00Z', '2026-03-10T00:00:00Z')).toEqual(['2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-09T13:00:00.000Z']);
    expect(cgNextOccurrence(series, '2026-03-07T14:00:00Z')).toBe('2026-03-08T13:00:00.000Z');
    // A day bound is that day's midnight in the zone.
    expect(cgOccurrencesBetween(series, '2026-03-08', '2026-03-09')).toEqual(['2026-03-08T13:00:00.000Z']);
  });

  it('moves a skipped time to the first valid minute and keeps a repeated one at the first offset', () => {
    const gap = { rule: { frequency: 'daily' } as const, start: '2026-03-07T07:30:00Z', timeZone: 'America/New_York' };
    expect(cgOccurrencesBetween(gap, '2026-03-07', '2026-03-10')).toEqual(['2026-03-07T07:30:00.000Z', '2026-03-08T07:00:00.000Z', '2026-03-09T06:30:00.000Z']);
    const fold = { rule: { frequency: 'daily' } as const, start: '2026-10-31T05:30:00Z', timeZone: 'America/New_York' };
    expect(cgNextOccurrence(fold, '2026-10-31T05:30:00Z')).toBe('2026-11-01T05:30:00.000Z');
  });

  it('falls on the zone\'s days, not UTC\'s', () => {
    // 01:00 on Mondays in Cairo is Sunday evening in UTC.
    const series = { rule: { frequency: 'weekly', weekDays: ['monday'] } as const, start: '2026-11-29T23:00:00Z', timeZone: 'Africa/Cairo' };
    expect(cgOccurrencesBetween(series, '2026-11-01', '2026-12-31')).toEqual(['2026-11-29T23:00:00.000Z', '2026-12-06T23:00:00.000Z', '2026-12-13T23:00:00.000Z', '2026-12-20T23:00:00.000Z', '2026-12-27T23:00:00.000Z']);
  });

  it('finds the next of a long series quickly', () => {
    const begun = performance.now();
    expect(cgNextOccurrence({ rule: { frequency: 'daily' }, start: '2020-01-01T09:00:00Z', timeZone: 'Asia/Riyadh' }, '2026-11-25T12:00:00Z')).toBe('2026-11-26T09:00:00.000Z');
    expect(performance.now() - begun).toBeLessThan(500);
  });
});

describe('cgSummarizeRecurrence', () => {
  it('writes each kind of rule in the given words', () => {
    expect(cgSummarizeRecurrence({ frequency: 'none' }, english)).toBe('Does not repeat');
    expect(cgSummarizeRecurrence({ frequency: 'daily' }, english)).toBe('Every day');
    expect(cgSummarizeRecurrence({ frequency: 'weekly', interval: 2, weekDays: ['wednesday', 'monday'] }, english)).toBe('Every 2 weeks on Monday and Wednesday');
    expect(cgSummarizeRecurrence({ frequency: 'weekly' }, english, { start: '2026-12-01' })).toBe('Every week on Tuesday');
    expect(cgSummarizeRecurrence({ frequency: 'weekly' }, english)).toBe('Every week');
    expect(cgSummarizeRecurrence({ frequency: 'monthly', dayOfMonth: 31 }, english)).toBe('Every month on day 31');
    expect(cgSummarizeRecurrence({ frequency: 'monthly' }, english, { start: '2026-12-15' })).toBe('Every month on day 15');
    expect(cgSummarizeRecurrence({ frequency: 'monthly', weekOfMonth: 'last', weekDays: ['friday'] }, english)).toBe('Every month on the last Friday');
    expect(cgSummarizeRecurrence({ frequency: 'yearly', month: 3, dayOfMonth: 15 }, english)).toBe('Every year on 15 March');
    expect(cgSummarizeRecurrence({ frequency: 'yearly', month: 11, weekOfMonth: 'fourth', weekDays: ['thursday'] }, english)).toBe('Every year on the fourth Thursday of November');
    expect(cgSummarizeRecurrence({ frequency: 'daily', weekDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] }, english)).toBe('Every day on Monday, Tuesday, Wednesday, Thursday, and Friday');
    expect(cgSummarizeRecurrence({ frequency: 'weekly', range: 'occurrenceCount', occurrenceCount: 5, weekDays: ['monday'] }, english)).toBe('Every week on Monday, 5 times');
    expect(cgSummarizeRecurrence({ frequency: 'daily', range: 'endByDate', endDate: '2026-12-31' }, english)).toBe('Every day, until Dec 31, 2026');
  });

  it('lists days from the locale\'s first day, in its own names and list words', () => {
    // Saturday first in Arabic.
    expect(cgSummarizeRecurrence({ frequency: 'weekly', interval: 2, weekDays: ['monday', 'saturday'] }, arabic, { locale: 'ar' })).toBe('كل أسبوعين يوم السبت والاثنين');
    expect(cgSummarizeRecurrence({ frequency: 'weekly', weekDays: ['monday', 'sunday'] }, english, { locale: 'en-GB' })).toBe('Every week on Monday and Sunday');
    expect(cgSummarizeRecurrence({ frequency: 'weekly', weekDays: ['monday', 'sunday'] }, english, { firstDayOfWeek: 'sunday' })).toBe('Every week on Sunday and Monday');
    expect(cgSummarizeRecurrence({ frequency: 'monthly', weekOfMonth: 'first', weekDays: ['sunday'] }, arabic, { locale: 'ar', start: '2026-12-01' })).toBe('كل شهر في الأحد الأول');
    expect(cgSummarizeRecurrence({ frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 3 }, arabic, { locale: 'ar' })).toBe('كل يوم، 3 مرات');
  });

  it('reads an instant start on the zone\'s clock', () => {
    expect(cgSummarizeRecurrence({ frequency: 'weekly' }, english, { start: '2026-11-30T23:00:00Z', timeZone: 'Africa/Cairo' })).toBe('Every week on Tuesday');
    expect(cgSummarizeRecurrence({ frequency: 'weekly' }, english, { start: '2026-11-30T23:00:00Z' })).toBe('Every week on Monday');
  });
});
