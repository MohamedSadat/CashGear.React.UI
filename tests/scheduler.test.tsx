import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { CgScheduler } from '../src/components/Scheduler';
import type { CgSchedulerOperationRequest, CgSchedulerOperationResult, CgSchedulerProviderRequest } from '../src/components/Scheduler';
interface Item { id: number; title: string; start: string; end: string }
const a: Item = { id: 1, title: 'Planning', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z' };
const base = { items: [a], idSelector: (a: Item) => a.id, titleSelector: (a: Item) => a.title, startSelector: (a: Item) => a.start, endSelector: (a: Item) => a.end, defaultSelectedDate: '2026-09-07', defaultCurrentView: 'day' as const, visibleDayStart: '08:00', visibleDayEnd: '12:00', now: () => '2026-09-07T08:00:00Z' };
describe('CgScheduler', () => {
  it('does not re-emit a range when an inline working-day array has the same contents', () => {
    const changed = vi.fn();
    function Host() {
      const [range, setRange] = useState('');
      return <><output>{range}</output><CgScheduler {...base} workingDays={['monday', 'tuesday']} onVisibleRangeChange={(value) => { changed(value); setRange(value.start); }} /></>;
    }
    render(<Host />);
    expect(changed).toHaveBeenCalledOnce();
  });
  it('renders all five views and reports navigation without changing controlled state', () => {
    const change = vi.fn(); const range = vi.fn();
    const { rerender } = render(<CgScheduler {...base} selectedDate="2026-09-07" onSelectedDateChange={change} onVisibleRangeChange={range} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(change).toHaveBeenCalledWith('2026-09-08'); expect(screen.getByRole('button', { name: /Planning/ })).toBeVisible();
    for (const view of ['workWeek', 'week', 'month', 'timeline'] as const) { rerender(<CgScheduler {...base} currentView={view} />); expect(screen.getByRole('grid')).toBeVisible(); }
    expect(range).toHaveBeenCalled();
  });
  it('creates an immutable draft and retains validation failures', async () => {
    let request: CgSchedulerOperationRequest<Item> | undefined;
    const handler = vi.fn((value: CgSchedulerOperationRequest<Item>) => { request = value; return { success: false as const, fieldErrors: { title: 'Already exists' } }; });
    render(<CgScheduler {...base} onAppointmentCreating={handler} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create appointment' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: 'New item' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await screen.findByText('Already exists');
    expect(Object.isFrozen(request?.draft)).toBe(true); expect(request?.originalItem).toBeNull();
    expect(base.items).toEqual([a]); expect(within(dialog).getByLabelText('Title')).toHaveValue('New item');
  });
  it('edits and deletes through distinct handlers, and prevents operations in read-only mode', async () => {
    const update = vi.fn(() => ({ success: true as const })); const remove = vi.fn(() => ({ success: true as const }));
    const { rerender } = render(<CgScheduler {...base} onAppointmentUpdating={update} onAppointmentDeleting={remove} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })); await waitFor(() => expect(update).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.keyDown(screen.getByRole('button', { name: /Planning/ }), { key: 'Delete' });
    dialog = await screen.findByRole('alertdialog'); fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce()); expect(update).toHaveBeenCalledOnce();
    rerender(<CgScheduler {...base} readOnly onAppointmentUpdating={update} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ })); expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('cancels obsolete provider requests and ignores late responses', async () => {
    const requests: { request: CgSchedulerProviderRequest; resolve: (items: readonly Item[]) => void }[] = [];
    const provider = vi.fn((request: CgSchedulerProviderRequest) => new Promise<readonly Item[]>((resolve) => requests.push({ request, resolve })));
    const { items: _items, ...rest } = base;
    render(<CgScheduler {...rest} itemsProvider={provider} />);
    await waitFor(() => expect(requests).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0]!.request.signal.aborted).toBe(true);
    await act(async () => { requests[1]!.resolve([]); requests[0]!.resolve([a]); });
    expect(screen.queryByRole('button', { name: /Planning/ })).not.toBeInTheDocument(); expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false');
  });
  it('shows provider errors and retries', async () => {
    const provider = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([a]);
    const { items: _items, ...rest } = base;
    render(<CgScheduler {...rest} itemsProvider={provider} />);
    await screen.findByText('Appointments could not be loaded.'); fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByRole('button', { name: /Planning/ }); expect(provider).toHaveBeenCalledTimes(2);
  });
  it('aborts a save on navigation and ignores its late failure', async () => {
    let resolve!: (result: CgSchedulerOperationResult) => void; let signal!: AbortSignal;
    render(<CgScheduler {...base} onAppointmentUpdating={(_request, value) => { signal = value; return new Promise((done) => { resolve = done; }); }} />);
    fireEvent.doubleClick(screen.getByRole('button', { name: /Planning/ })); const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); expect(signal.aborted).toBe(true);
    await act(async () => resolve({ success: false, error: 'Stale error' })); expect(screen.queryByText('Stale error')).not.toBeInTheDocument();
  });
  it('suppresses the delayed single-click event after double-click', async () => {
    const single = vi.fn(); const double = vi.fn();
    render(<CgScheduler {...base} onAppointmentClick={single} onAppointmentDoubleClick={double} />);
    const button = screen.getByRole('button', { name: /Planning/ });
    fireEvent.click(button, { detail: 1 }); fireEvent.doubleClick(button);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 280)));
    expect(single).not.toHaveBeenCalled(); expect(double).toHaveBeenCalledOnce();
  });
  it('offers month overflow without losing appointments', async () => {
    render(<CgScheduler {...base} currentView="month" monthAppointmentLimit={1} items={[a, { ...a, id: 2, title: 'Second', start: '2026-09-07T11:00:00Z', end: '2026-09-07T12:00:00Z' }]} />);
    fireEvent.click(screen.getByRole('button', { name: '+1 more' }));
    const dialog = await screen.findByRole('dialog'); expect(within(dialog).getByRole('button', { name: 'Planning' })).toBeVisible(); expect(within(dialog).getByRole('button', { name: 'Second' })).toBeVisible();
  });
  it('restores a tab entry point after the host removes a focused appointment', () => {
    const { rerender, container } = render(<CgScheduler {...base} />);
    fireEvent.focus(screen.getByRole('button', { name: /Planning/ }));
    rerender(<CgScheduler {...base} items={[]} />);
    expect(container.querySelectorAll('[data-focus-key][tabindex="0"]')).toHaveLength(1);
  });
});
