import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgScheduler } from '../src';
import type { CgSchedulerOperationRequest, CgSchedulerPopupContext, CgSchedulerProviderRequest, CgSchedulerResource } from '../src';
import { resourceColumns, validateResources } from '../src/components/Scheduler/schedulerResources';
import { advanceScale, scaleCells } from '../src/components/Scheduler/schedulerTimeline';
const resources: readonly CgSchedulerResource[] = [{ id: 1, caption: 'Room A' }, { id: 2, caption: 'Room B' }];
const item = { id: 1, title: 'Planning', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z', resources: [1] };
const base = { items: [item], idSelector: (value: typeof item) => value.id, titleSelector: (value: typeof item) => value.title, startSelector: (value: typeof item) => value.start, endSelector: (value: typeof item) => value.end, resourceIdsSelector: (value: typeof item) => value.resources, resources, defaultSelectedDate: '2026-09-07', defaultCurrentView: 'day' as const, visibleDayStart: '08:00', visibleDayEnd: '12:00' };
describe('Scheduler resources and customization', () => {
  it('keeps slot selection and new appointments in the selected resource', async () => {
    const create = vi.fn((_request: CgSchedulerOperationRequest<typeof item>) => ({ success: true as const }));
    render(<CgScheduler {...base} groupType="resource" onAppointmentCreating={create} />);
    const cell = document.querySelector<HTMLElement>('[data-resource-key="number:2"][data-start="1788771600000"]')!;
    fireEvent.click(cell, { detail: 1 }); expect(document.querySelectorAll('[data-scheduler-cell][aria-selected="true"]')).toHaveLength(1);
    fireEvent.doubleClick(cell); const dialog = await screen.findByRole('dialog'); fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'New booking' } }); fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(create).toHaveBeenCalled()); expect(create.mock.lastCall?.[0].draft.resourceIds).toEqual([2]);
  });
  it('orders resource/date groups, distinguishes numeric IDs and rejects malformed groups', () => {
    expect(resourceColumns(['2026-09-07', '2026-09-08'], resources, 'resource').map(value => value.key)).toEqual(['2026-09-07@number:1', '2026-09-08@number:1', '2026-09-07@number:2', '2026-09-08@number:2']);
    expect(resourceColumns(['2026-09-07', '2026-09-08'], resources, 'date')[1]?.resource?.id).toBe(2);
    expect(() => validateResources([{ id: 1, caption: '', isGroup: true, groupId: 1 }])).toThrow(/cycle/);
    expect(() => validateResources([...resources, resources[0]!])).toThrow(/Duplicate/);
  });
  it('advances calendar scales through leap months and DST, with bounded second scales', () => {
    expect(new Date(advanceScale(Date.parse('2024-01-31T09:00:00Z'), { unit: 'month' }, 'UTC')).toISOString()).toBe('2024-02-29T09:00:00.000Z');
    expect(new Date(advanceScale(Date.parse('2026-02-28T14:00:00Z'), { unit: 'month' }, 'America/New_York')).toISOString()).toBe('2026-03-28T13:00:00.000Z');
    expect(scaleCells(0, 2500, { unit: 'second' }, 'UTC', 'en-US').map(value => value.end)).toEqual([1000, 2000, 2500]);
    expect(() => advanceScale(0, { unit: 'hour', unitCount: 0 }, 'UTC')).toThrow(/positive/);
  });
  it('keeps visible-resource selection controlled and forwards captured provider ownership', async () => {
    const changed = vi.fn(); const requests: CgSchedulerProviderRequest[] = []; const pending: ((items: readonly typeof item[]) => void)[] = [];
    const provider = (request: CgSchedulerProviderRequest) => { requests.push(request); return new Promise<readonly typeof item[]>(resolve => pending.push(resolve)); };
    const { items: _items, ...rest } = base; const first = {};
    const view = render(<CgScheduler {...rest} itemsProvider={provider} visibleResourceIds={[1]} onVisibleResourceIdsChange={changed} queryContext={first} dataVersion={2} groupType="resource" />);
    await waitFor(() => expect(requests).toHaveLength(1)); fireEvent.click(screen.getByLabelText('Room B')); expect(changed).toHaveBeenCalledWith([1, 2]); expect(screen.getByLabelText('Room B')).not.toBeChecked();
    view.rerender(<CgScheduler {...rest} itemsProvider={provider} visibleResourceIds={[2]} queryContext={{}} dataVersion={3} groupType="resource" />);
    await waitFor(() => expect(requests).toHaveLength(2)); expect(requests[0]).toMatchObject({ queryContext: first, dataVersion: 2, visibleResourceIds: [1] }); expect(requests[0]?.signal.aborted).toBe(true);
    await act(async () => { pending[1]!([]); pending[0]!([item]); }); expect(screen.queryByRole('button', { name: /Planning/ })).toBeNull();
  });
  it('cancels opening, ignores obsolete approval, and permits closing cancellation', async () => {
    let resolve: (value: boolean) => void = () => {}; let opening: CgSchedulerPopupContext<typeof item> | undefined;
    const showing = (context: CgSchedulerPopupContext<typeof item>) => { opening = context; return new Promise<boolean>(done => { resolve = done; }); };
    const update = () => ({ success: true as const });
    const view = render(<CgScheduler {...base} onAppointmentUpdating={update} onAppointmentFormShowing={showing} queryContext="one" />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ })); expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<CgScheduler {...base} onAppointmentUpdating={update} onAppointmentFormShowing={showing} queryContext="two" />);
    expect(opening?.signal?.aborted).toBe(true); await act(async () => resolve(true)); expect(screen.queryByRole('dialog')).toBeNull();
    const closing = vi.fn(() => false);
    view.rerender(<CgScheduler {...base} onAppointmentUpdating={update} onAppointmentFormClosing={closing} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ })); const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(closing).toHaveBeenCalled()); expect(dialog).toBeVisible();
  });
  it('validates and snapshots metadata with resource reassignment and render precedence', async () => {
    const update = vi.fn((_request: CgSchedulerOperationRequest<typeof item>) => ({ success: false as const, error: 'Retained' }));
    render(<CgScheduler {...base} groupType="date" onAppointmentUpdating={update} locationSelector={() => 'Office'} appointmentLabels={[{ id: 'urgent', caption: 'Urgent' }]} customFields={[{ key: 'reference', label: 'Reference', required: true }]} renderAppointment={() => 'General renderer'} renderVerticalAppointment={() => 'Vertical renderer'} />);
    expect(screen.getByText('General renderer')).toBeVisible(); expect(screen.queryByText('Vertical renderer')).toBeNull();
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ })); const dialog = await screen.findByRole('dialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })); expect(update).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Reference'), { target: { value: 'CG-5' } }); fireEvent.change(within(dialog).getByLabelText('Location'), { target: { value: 'Remote' } }); fireEvent.click(within(dialog).getByLabelText('Room B')); fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Retained'); const draft = update.mock.lastCall?.[0].draft; expect(draft).toMatchObject({ location: 'Remote', resourceIds: [1, 2], customFields: { reference: 'CG-5' } }); expect(Object.isFrozen(draft?.resourceIds)).toBe(true);
  });
});
