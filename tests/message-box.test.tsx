import { StrictMode, useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgConfirmationProvider, CgMessageBox, useCgConfirmation } from '../src';
import type { CgConfirmationApi } from '../src';

function Capture({ onApi }: { onApi: (api: CgConfirmationApi) => void }) {
  const api = useCgConfirmation();
  useEffect(() => onApi(api), [api, onApi]);
  return null;
}

describe('CgMessageBox provider alerts', () => {
  it('shares FIFO ordering with confirmations and keeps their defaults independent', async () => {
    let api!: CgConfirmationApi;
    render(<CgConfirmationProvider alertDefaults={{ actionLabel: 'Acknowledge' }}><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider>);
    let alert!: Promise<void>;
    let confirmation!: Promise<boolean>;
    act(() => { alert = api.alert('Review totals', 'Notice'); confirmation = api.confirm('Post batch?'); });
    expect(screen.getByRole('alertdialog', { name: 'Notice' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await alert;
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await confirmation).toBe(true);
  });

  it('resolves dismissal and rejects explicit abort', async () => {
    let api!: CgConfirmationApi;
    render(<CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider>);
    let dismissed!: Promise<void>;
    act(() => { dismissed = api.alert('Dismiss me'); });
    const dismissalSettled = vi.fn();
    void dismissed.then(dismissalSettled);
    expect(await screen.findByRole('alertdialog', { name: 'Message' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'OK' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(dismissalSettled).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    const controller = new AbortController();
    let aborted!: Promise<void>;
    act(() => { aborted = api.alert({ content: 'Abort me', signal: controller.signal }); controller.abort(); });
    const abortRejected = vi.fn();
    void aborted.catch(abortRejected);
    await waitFor(() => expect(abortRejected).toHaveBeenCalledWith(expect.objectContaining({ name: 'AbortError' })));
  });

  it('survives Strict Mode replay', async () => {
    let api!: CgConfirmationApi;
    render(<StrictMode><CgConfirmationProvider><Capture onApi={(value) => { api = value; }} /></CgConfirmationProvider></StrictMode>);
    const controller = new AbortController();
    let aborted!: Promise<void>;
    act(() => { aborted = api.alert({ content: 'Abort in strict mode', signal: controller.signal }); });
    act(() => controller.abort());
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});

describe('declarative CgMessageBox', () => {
  it('reports explicit acceptance once and gives children precedence', async () => {
    const closed = vi.fn();
    render(<CgMessageBox defaultOpen message="Ignored" onClosed={closed}><strong>Imported 12 rows</strong></CgMessageBox>);
    expect(screen.getByText('Imported 12 rows')).toBeInTheDocument();
    expect(screen.queryByText('Ignored')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(closed).toHaveBeenCalledWith(true, expect.objectContaining({ accepted: true, reason: 'accept' })));
    expect(closed).toHaveBeenCalledOnce();
  });

  it('keeps controlled open authoritative and does not leak a rejected acceptance', async () => {
    const openChanged = vi.fn();
    const closed = vi.fn();
    const view = render(<CgMessageBox open message="Controlled" onOpenChange={openChanged} onClosed={closed} />);
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(openChanged).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'accept' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(closed).not.toHaveBeenCalled();
    await act(async () => Promise.resolve());
    view.rerender(<CgMessageBox open={false} message="Controlled" onOpenChange={openChanged} onClosed={closed} />);
    await waitFor(() => expect(closed).toHaveBeenCalledWith(false, expect.objectContaining({ accepted: false, reason: 'programmatic' })));
  });

  it('reports Escape dismissal and restores focus', async () => {
    const closed = vi.fn();
    render(<><button>Origin</button><CgMessageBox defaultOpen title="Notice" message="Read this" onClosed={closed} /></>);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(closed).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'escape' })));
  });
});
