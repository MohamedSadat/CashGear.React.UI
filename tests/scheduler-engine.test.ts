import { describe, expect, it } from 'vitest';
import { addDays, boundary, fromLocalInput, instant, localInput, MINUTE, navigateDate, slots, visibleDates, visibleRange, WORKING_DAYS, zonedInstant } from '../src/components/Scheduler/schedulerDate';
import { layout, layoutDates, project } from '../src/components/Scheduler/schedulerLayout';
const item = (id: number, start: string, end: string) => ({ id, start, end, title: String(id) });
type Item = ReturnType<typeof item>;
const selectors = { items: [], idSelector: (a: Item) => a.id, titleSelector: (a: Item) => a.title, startSelector: (a: Item) => a.start, endSelector: (a: Item) => a.end };
describe('Scheduler date and layout engines', () => {
  it('uses real instants on 23/25-hour days and includes repeated labels', () => {
    const spring = slots('2026-03-08', 'America/New_York', 30, WORKING_DAYS, 480, 1020);
    const fall = slots('2026-11-01', 'America/New_York', 30, WORKING_DAYS, 480, 1020);
    expect(spring).toHaveLength(46); expect(fall).toHaveLength(50);
    expect(spring.some((s) => s.minutes === 120)).toBe(false);
    expect(fall.filter((s) => s.minutes === 60)).toHaveLength(2);
    expect(new Set(fall.map((s) => s.start)).size).toBe(50);
  });
  it('advances invalid wall times and chooses the earlier repeated instant', () => {
    expect(fromLocalInput('2026-03-08T02:30', 'America/New_York')).toBe('2026-03-08T07:00:00.000Z');
    expect(fromLocalInput('2026-11-01T01:30', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z');
    expect(localInput('2026-09-07T06:00:00Z', 'Africa/Cairo')).toBe('2026-09-07T09:00');
    expect(zonedInstant('2026-09-07', 540, 'Africa/Cairo')).toBe(instant('2026-09-07T06:00:00Z'));
    expect(localInput('0001-09-07T06:00:00Z', 'UTC')).toBe('0001-09-07T06:00');
  });
  it('handles a skipped midnight and exclusive all-day boundaries', () => {
    const start = boundary('2026-03-08', 'America/New_York'); const end = boundary(addDays('2026-03-08', 1), 'America/New_York');
    expect((end - start) / MINUTE).toBe(1380);
    expect(boundary('2011-12-30', 'Pacific/Apia')).toBe(boundary('2011-12-31', 'Pacific/Apia'));
  });
  it('produces all five ranges and clamps month navigation', () => {
    expect(visibleDates('2026-09-07', 'day', 1, WORKING_DAYS)).toEqual(['2026-09-07']);
    expect(visibleDates('2026-09-07', 'timeline', 1, WORKING_DAYS)).toHaveLength(1);
    expect(visibleDates('2026-09-07', 'week', 1, WORKING_DAYS)).toHaveLength(7);
    expect(visibleDates('2026-09-07', 'workWeek', 1, WORKING_DAYS)).toHaveLength(5);
    const month = visibleDates('2026-09-07', 'month', 1, WORKING_DAYS);
    expect(month[0]).toBe('2026-08-31'); expect(month.at(-1)).toBe('2026-10-04');
    expect(visibleRange(month, 'UTC').end).toBe('2026-10-05T00:00:00.000Z');
    expect(navigateDate('2026-01-31', 'month', 1)).toBe('2026-02-28');
  });
  it('requires explicit offsets and validates item identity before filtering', () => {
    expect(() => instant('2026-09-07T09:00')).toThrow(/offset/);
    expect(() => instant('2026-02-30T09:00:00Z')).toThrow();
    expect(instant('2026-09-07T09:00:00.1234567+02:00')).toBe(instant('2026-09-07T07:00:00.123Z'));
    const a = item(1, '2026-09-07T09:00Z', '2026-09-07T10:00Z');
    expect(() => project([a, a], selectors)).toThrow(/Duplicate/);
    expect(project([{ ...a, end: a.start }], selectors)).toEqual([]);
  });
  it('partitions overlap groups and reuses lanes for adjacent intervals', () => {
    const a = project([item(1, '2026-09-07T09:00Z', '2026-09-07T10:00Z'), item(2, '2026-09-07T09:30Z', '2026-09-07T10:30Z'), item(3, '2026-09-07T10:30Z', '2026-09-07T11:00Z')], selectors);
    const result = layout(a, boundary('2026-09-07', 'UTC'), boundary('2026-09-08', 'UTC'));
    expect(result.map((s) => [s.lane, s.lanes])).toEqual([[0, 2], [1, 2], [0, 1]]);
    expect(layoutDates(a, boundary('2026-09-07', 'UTC'), boundary('2026-09-08', 'UTC'), 'UTC').map((s) => s.lane)).toEqual([0, 1, 2]);
  });
  it('clips multi-day segments and preserves continuation flags', () => {
    const a = project([item(1, '2026-09-06T12:00Z', '2026-09-09T12:00Z')], selectors);
    expect(layout(a, boundary('2026-09-07', 'UTC'), boundary('2026-09-08', 'UTC'))[0]).toMatchObject({ continuesBefore: true, continuesAfter: true });
  });
});
