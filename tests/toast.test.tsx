import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgToastProvider, useCgToast } from '../src/components/Toast';
import type { CgToastApi } from '../src/components/Toast';

function Capture({ onApi }: { onApi: (api: CgToastApi) => void }) { const api = useCgToast(); useEffect(() => onApi(api), [api, onApi]); return null; }

describe('CgToastProvider', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('queues deterministically, suppresses duplicates, and promotes after dismissal', () => {
    let api!: CgToastApi;
    render(<CgToastProvider maximumVisible={1}><Capture onApi={(value) => { api = value; }} /></CgToastProvider>);
    act(() => {
      const first = api.info('First', { persistent: true, duplicateKey: 'same', suppressDuplicates: true });
      expect(api.error('Duplicate', { persistent: true, duplicateKey: 'same', suppressDuplicates: true })).toBe(first);
      api.success('Second', { persistent: true });
    });
    expect(screen.getByText('First')).toBeInTheDocument(); expect(screen.queryByText('Second')).not.toBeInTheDocument();
    act(() => { api.clear('info'); vi.advanceTimersByTime(180); });
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('pauses automatic dismissal during hover and resumes remaining time', () => {
    let api!: CgToastApi;
    render(<CgToastProvider duration={1000}><Capture onApi={(value) => { api = value; }} /></CgToastProvider>);
    act(() => { api.info('Timed'); vi.advanceTimersByTime(400); });
    const toast = screen.getByText('Timed').closest('article')!;
    act(() => { toast.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Timed')).toBeInTheDocument();
    act(() => { toast.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true })); vi.advanceTimersByTime(600); vi.advanceTimersByTime(180); });
    expect(screen.queryByText('Timed')).not.toBeInTheDocument();
  });

  it('executes async actions once and contains rejection', async () => {
    vi.useRealTimers();
    let api!: CgToastApi; const action = vi.fn(async () => { throw new Error('failed'); }); const onError = vi.fn();
    render(<CgToastProvider onActionError={onError}><Capture onApi={(value) => { api = value; }} /></CgToastProvider>);
    act(() => { api.error('Retryable', { persistent: true, action: { label: 'Retry', onAction: action } }); });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' })); await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(action).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalled(); expect(screen.getByText('Retryable')).toBeInTheDocument();
  });
});
