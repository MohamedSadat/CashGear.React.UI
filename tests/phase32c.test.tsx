import { act, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgScheduler } from '../src';
import type { CgSchedulerActions, CgSchedulerAppointmentDraft, CgSchedulerOperationRequest, CgSchedulerOperationResult } from '../src';
import { schedulerICalendar } from '../src/components/Scheduler/schedulerICalendar';
const item = { id: 'series', title: 'Planning', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z', description: '', color: '', isAllDay: false };
const base = { items: [item], idSelector: (value: typeof item) => value.id, titleSelector: (value: typeof item) => value.title, startSelector: (value: typeof item) => value.start, endSelector: (value: typeof item) => value.end, defaultSelectedDate: '2026-09-07', defaultCurrentView: 'day' as const, visibleDayStart: '08:00', visibleDayEnd: '12:00' };
describe('Scheduler actions, reminders and iCalendar', () => {
  it('delivers due reminders once while mounted and keeps deterministic inclusive-end queries', async () => {
    vi.useFakeTimers(); let time = '2026-09-07T08:29:00Z'; const clock = () => time; const due = vi.fn(); const actions = createRef<CgSchedulerActions<typeof item>>();
    const view = render(<CgScheduler {...base} now={clock} reminderSelector={() => 30} onRemindersDue={due} actionsRef={actions} />);
    expect(actions.current?.getReminders('2026-09-07T08:29:00Z', '2026-09-07T08:30:00Z')).toHaveLength(1);
    time = '2026-09-07T08:30:00Z'; await act(async () => { vi.advanceTimersByTime(60000); }); expect(due).toHaveBeenCalledTimes(1); expect(due.mock.calls[0]?.[0][0]).toMatchObject({ id: 'series', dueAt: '2026-09-07T08:30:00.000Z' });
    time = '2026-09-07T08:29:00Z'; await act(async () => { vi.advanceTimersByTime(60000); }); time = '2026-09-07T08:30:00Z'; await act(async () => { vi.advanceTimersByTime(60000); }); expect(due).toHaveBeenCalledTimes(1);
    view.unmount(); expect(actions.current).toBeNull(); expect(vi.getTimerCount()).toBe(0); vi.useRealTimers();
  });
  it('keeps controlled navigation authoritative and validates action persistence', async () => {
    const actions = createRef<CgSchedulerActions<typeof item>>(); const changed = vi.fn(); const create = vi.fn(() => ({ success: true as const }));
    render(<CgScheduler {...base} selectedDate="2026-09-07" onSelectedDateChange={changed} actionsRef={actions} onAppointmentCreating={create} />);
    act(() => actions.current?.goToDate('2026-09-09')); expect(changed).toHaveBeenCalledWith('2026-09-09'); expect(screen.getByRole('button', { name: /Planning/ })).toBeVisible();
    await act(async () => { const result = await actions.current?.createAppointment({ ...item, title: '' }); expect(result?.success).toBe(false); }); expect(create).not.toHaveBeenCalled();
    await act(async () => { await actions.current?.createAppointment({ ...item, title: 'Valid' }); }); expect(create).toHaveBeenCalledOnce();
    expect(actions.current?.exportToICalendar()).toContain('SUMMARY:Planning');
  });
  it('restores deleted occurrences through the host and suppresses unmounted completions', async () => {
    const actions = createRef<CgSchedulerActions<typeof item>>(); let resolve: (result: CgSchedulerOperationResult) => void = () => {}; let signal: AbortSignal | undefined;
    const update = vi.fn((request: CgSchedulerOperationRequest<typeof item>, abort: AbortSignal) => { signal = abort; expect(request).toMatchObject({ scope: 'occurrence', occurrenceAction: 'restore', originalOccurrenceStart: '2026-09-08T09:00:00.000Z' }); expect(request.draft.recurrence?.exceptions).toHaveLength(0); return new Promise<CgSchedulerOperationResult>(done => { resolve = done; }); });
    const view = render(<CgScheduler {...base} actionsRef={actions} enableRecurrence recurrenceSelector={() => ({ frequency: 'daily', exceptions: [{ originalStart: '2026-09-08T09:00:00Z', isDeleted: true }] })} onAppointmentUpdating={update} />);
    let pending: Promise<unknown> | undefined; act(() => { pending = actions.current?.restoreOccurrence({ id: 'series', originalOccurrenceStart: '2026-09-08T09:00:00Z' }); }); expect(update).toHaveBeenCalledOnce();
    view.unmount(); expect(signal?.aborted).toBe(true); await act(async () => { resolve({ success: true }); expect(await pending).toBeUndefined(); });
  });
  it('opens forms/tooltips via actions and retains failed save drafts', async () => {
    const actions = createRef<CgSchedulerActions<typeof item>>(); render(<CgScheduler {...base} actionsRef={actions} onAppointmentUpdating={() => ({ success: false, error: 'Retained draft' })} />);
    act(() => actions.current?.showEditAppointmentForm({ id: 'series' })); await screen.findByRole('dialog');
    await act(async () => { await actions.current?.saveForm(); }); expect(screen.getByText('Retained draft')).toBeVisible();
    act(() => actions.current?.closeAppointmentForm()); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => actions.current?.showAppointmentTooltip({ id: 'series' })); await screen.findByRole('dialog');
    act(() => actions.current?.closeAppointmentTooltip()); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('exports parseable event/exception metadata, escaping and UTF-8 folded lines', () => {
    const draft: CgSchedulerAppointmentDraft = { ...item, title: 'مرحبا 😀'.repeat(30), description: 'Line 1\r\nLine 2, semicolon; slash\\', location: 'Room A', resourceIds: ['a', 2], labelId: 'review', statusId: 'confirmed', customFields: { 'booking-ref': 'CG-1' }, recurrence: { frequency: 'weekly', weekDays: ['monday', 'wednesday'], interval: 2, range: 'occurrenceCount', occurrenceCount: 5, exceptions: [{ originalStart: '2026-09-09T09:00:00Z', isDeleted: true }, { originalStart: '2026-09-21T09:00:00Z', replacement: { ...item, title: 'Moved', start: '2026-09-22T10:00:00Z', end: '2026-09-22T11:00:00Z' } }] } };
    const text = schedulerICalendar([{ id: item.id, draft }], 'UTC', '2026-09-01T00:00:00Z', 'Team calendar');
    expect(text.split('\r\n').every(line => new TextEncoder().encode(line).length <= 73)).toBe(true);
    const unfolded = text.replace(/\r\n /g, ''); const events = unfolded.split('BEGIN:VEVENT\r\n').slice(1).map(event => Object.fromEntries(event.split('END:VEVENT')[0]!.trim().split('\r\n').map(line => { const index = line.indexOf(':'); return [line.slice(0, index), line.slice(index + 1)]; })));
    expect(events).toHaveLength(2); expect(events[0]).toMatchObject({ SUMMARY: draft.title, RRULE: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=5', LOCATION: 'Room A', 'X-CG-BOOKING-REF': 'CG-1' }); expect(events[1]?.['RECURRENCE-ID']).toBe('20260921T090000Z'); expect(events[1]?.UID).toBe(events[0]?.UID);
    expect(unfolded).toContain('DESCRIPTION:Line 1\\nLine 2\\, semicolon\\; slash\\\\');
  });
  it('keeps all-day exceptions typed as civil dates and exclusive ends', () => {
    const text = schedulerICalendar([{ id: 1, draft: { ...item, isAllDay: true, start: '2026-03-08T05:00:00Z', end: '2026-03-09T04:00:00Z', recurrence: { frequency: 'daily', exceptions: [{ originalStart: '2026-03-09T04:00:00Z', isDeleted: true }] } } }], 'America/New_York', '2026-03-01T00:00:00Z');
    expect(text).toContain('DTSTART;VALUE=DATE:20260308'); expect(text).toContain('DTEND;VALUE=DATE:20260309'); expect(text).toContain('EXDATE;VALUE=DATE:20260309');
  });
});
