import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgScheduler } from '../src';
import type { CgSchedulerAppointmentDraft, CgSchedulerOperationRequest, CgSchedulerRecurrenceRule, CgSchedulerVisibleRange } from '../src';
import { changeOccurrence, expandRecurrence, snapshotRecurrence } from '../src/components/Scheduler/schedulerRecurrence';
const draft: CgSchedulerAppointmentDraft = { title: 'Standup', start: '2026-03-07T14:00:00Z', end: '2026-03-07T15:00:00Z', description: '', color: '', isAllDay: false, recurrence: { frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 3 } };
const range = (start = '2026-03-01', end = '2026-04-01'): CgSchedulerVisibleRange => ({ startDate: start, endDate: end, start: `${start}T00:00:00Z`, end: `${end}T00:00:00Z` });
describe('Scheduler recurrence', () => {
  it('preserves wall time across DST and exclusive all-day midnight boundaries', () => {
    expect(expandRecurrence(draft, range(), 'America/New_York').map(value => value.start)).toEqual(['2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z', '2026-03-09T13:00:00.000Z']);
    const days = expandRecurrence({ ...draft, start: '2026-03-07T05:00:00Z', end: '2026-03-08T05:00:00Z', isAllDay: true }, range(), 'America/New_York');
    expect(days[1]).toMatchObject({ start: '2026-03-08T05:00:00.000Z', end: '2026-03-09T04:00:00.000Z' });
  });
  it('preserves the preferred fold offset and advances nonexistent wall times', () => {
    const gap = expandRecurrence({ ...draft, start: '2026-03-07T07:30:00Z', end: '2026-03-07T08:30:00Z' }, range(), 'America/New_York');
    expect(gap[1]?.start).toBe('2026-03-08T07:00:00.000Z');
    const fold = expandRecurrence({ ...draft, start: '2026-10-31T05:30:00Z', end: '2026-10-31T06:30:00Z' }, range('2026-10-30', '2026-11-04'), 'America/New_York');
    expect(fold[1]?.start).toBe('2026-11-01T05:30:00.000Z');
  });
  it('uses intervals, ordered weekly days and source month-end clamping', () => {
    const expand = (recurrence: CgSchedulerRecurrenceRule) => expandRecurrence({ ...draft, start: '2024-01-31T09:00:00Z', end: '2024-01-31T10:00:00Z', recurrence }, range('2024-01-01', '2025-04-01'), 'UTC').map(value => value.start.slice(0, 10));
    expect(expand({ frequency: 'monthly', range: 'occurrenceCount', occurrenceCount: 3 })).toEqual(['2024-01-31', '2024-02-29', '2024-03-31']);
    expect(expand({ frequency: 'weekly', interval: 2, weekDays: ['friday', 'monday'], range: 'occurrenceCount', occurrenceCount: 3 })).toEqual(['2024-02-02', '2024-02-12', '2024-02-16']);
    expect(expand({ frequency: 'yearly', month: 2, dayOfMonth: 29, range: 'occurrenceCount', occurrenceCount: 2 })).toEqual(['2024-02-29', '2025-02-28']);
    expect(expand({ frequency: 'monthly', weekDays: ['monday'], weekOfMonth: 'last', range: 'endByDate', endDate: '2024-03-31' })).toEqual(['2024-02-26', '2024-03-25']);
  });
  it('deletes, replaces and restores immutably, including moves from outside the window', () => {
    const rule = snapshotRecurrence({ frequency: 'daily', range: 'occurrenceCount', occurrenceCount: 30 });
    const moved = changeOccurrence(rule, '2026-03-25T13:00:00Z', { ...draft, start: '2026-03-08T17:00:00Z', end: '2026-03-08T18:00:00Z' });
    const deleted = changeOccurrence(moved, '2026-03-08T13:00:00Z', 'delete');
    const values = expandRecurrence({ ...draft, recurrence: deleted }, range('2026-03-08', '2026-03-09'), 'America/New_York');
    expect(values).toHaveLength(1); expect(values[0]?.originalStart).toBe('2026-03-25T13:00:00.000Z');
    expect(rule.exceptions).toHaveLength(0); expect(Object.isFrozen(moved.exceptions?.[0]?.replacement)).toBe(true);
    expect(changeOccurrence(deleted, '2026-03-08T13:00:00Z', 'restore').exceptions).toHaveLength(1);
  });
  it('fails clearly for invalid rules and bounded impossible candidate searches', () => {
    expect(() => snapshotRecurrence({ frequency: 'daily', interval: 0 })).toThrow(/interval/);
    expect(() => snapshotRecurrence({ frequency: 'daily', range: 'endByDate' })).toThrow(/end date/);
    // Every seventh day remains Saturday, so Monday is impossible; this must terminate.
    expect(() => expandRecurrence({ ...draft, recurrence: { frequency: 'daily', interval: 7, weekDays: ['monday'] } }, range(), 'UTC')).toThrow(/recurrence/);
  });
  it('keeps authoritative IDs while editing occurrence or series scopes and retaining failed drafts', async () => {
    const item = { id: 42, ...draft }; const update = vi.fn((_request: CgSchedulerOperationRequest<typeof item>) => ({ success: false as const, error: 'Try again' }));
    render(<CgScheduler items={[item]} idSelector={value => value.id} titleSelector={value => value.title} startSelector={value => value.start} endSelector={value => value.end} recurrenceSelector={value => value.recurrence} enableRecurrence displayTimeZone="America/New_York" defaultSelectedDate="2026-03-08" defaultCurrentView="day" visibleDayStart="08:00" visibleDayEnd="12:00" onAppointmentUpdating={update} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Standup/ })); const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'Moved title' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Try again'); expect(update.mock.lastCall?.[0]).toMatchObject({ originalItem: { id: 42 }, scope: 'occurrence', originalOccurrenceStart: '2026-03-08T13:00:00.000Z', draft: { title: 'Moved title' } });
    fireEvent.change(within(dialog).getByLabelText('Edit scope'), { target: { value: 'series' } });
    expect(within(dialog).getByLabelText('Frequency')).toHaveValue('daily'); fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2)); expect(update.mock.lastCall?.[0]).toMatchObject({ scope: 'series', draft: { start: new Date(draft.start).toISOString() } });
  });
});
