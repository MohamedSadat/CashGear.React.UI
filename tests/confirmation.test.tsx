import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode, useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { CgConfirmationProvider, useCgConfirmation } from '../src/components/Confirmation';
import type { CgConfirmationApi } from '../src/components/Confirmation';

function Capture({ onApi }: { onApi: (api: CgConfirmationApi) => void }) { const api = useCgConfirmation(); useEffect(() => onApi(api), [api, onApi]); return null; }

function FocusReturnFixture() {
  const confirmation = useCgConfirmation();
  return <button type="button" onClick={() => { void confirmation.confirm('Restore focus'); }}>Open confirmation</button>;
}

describe('CgConfirmationProvider', () => {
  it('renders escaped React content, defaults focus to Cancel, and resolves paths', async () => {
    let api!: CgConfirmationApi;
    render(<CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider>);
    let result!: Promise<boolean>; act(() => { result = api.confirm('<script>unsafe</script>'); });
    expect(screen.getByText('<script>unsafe</script>')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' })); expect(await result).toBe(true);
  });

  it('shows exactly one request at a time in FIFO order', async () => {
    let api!: CgConfirmationApi;
    render(<CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider>);
    let first!: Promise<boolean>; let second!: Promise<boolean>;
    act(() => { first = api.confirm({ content: 'First', title: 'One' }); second = api.confirm({ content: 'Second', title: 'Two' }); });
    expect(screen.getByRole('alertdialog', { name: 'One' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' })); expect(await first).toBe(false);
    expect(screen.getByRole('alertdialog', { name: 'Two' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' })); expect(await second).toBe(true);
  });

  it('rejects queued and active aborts with AbortError and survives Strict Mode replay', async () => {
    let api!: CgConfirmationApi;
    render(<StrictMode><CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider></StrictMode>);
    const firstController = new AbortController(); const secondController = new AbortController();
    let first!: Promise<boolean>; let second!: Promise<boolean>;
    act(() => { first = api.confirm({ content: 'First', signal: firstController.signal }); second = api.confirm({ content: 'Second', signal: secondController.signal }); });
    secondController.abort(); await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    firstController.abort(); await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('rejects pending work on real provider unmount', async () => {
    let api!: CgConfirmationApi;
    const view = render(<CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider>);
    let pending!: Promise<boolean>; act(() => { pending = api.confirm('Pending'); }); view.unmount();
    await expect(pending).rejects.toThrow(/unmounted/u);
  });

  it('restores focus to the invocation target after dismissal', async () => {
    render(<CgConfirmationProvider><FocusReturnFixture /></CgConfirmationProvider>);
    const trigger = screen.getByRole('button', { name: 'Open confirmation' });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
