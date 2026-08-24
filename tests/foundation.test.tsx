import { StrictMode, createRef, useRef, useState } from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgTextBox, useCgId, useControllableState } from '../src';
import { CgPortal } from '../src/internal';
import { useAsyncOperation, useDebouncedCallback, useDirection, useMergedRefs, useStableCallback } from '../src/hooks';

describe('foundation hooks and field semantics', () => {
  it('warns once when controlled mode changes and stays quiet in Strict Mode otherwise', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { rerender } = renderHook(({ value }: { value: string | undefined }) => useControllableState(value, 'default', 'Probe'), { initialProps: { value: 'controlled' as string | undefined }, wrapper: StrictMode });
    expect(error).not.toHaveBeenCalled();
    rerender({ value: undefined });
    rerender({ value: 'again' });
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('Probe changed from controlled to uncontrolled');
    error.mockRestore();
  });

  it('keeps callbacks stable while invoking the latest closure', () => {
    const { result, rerender } = renderHook(({ value }) => useStableCallback(() => value), { initialProps: { value: 1 } });
    const callback = result.current;
    rerender({ value: 2 });
    expect(result.current).toBe(callback);
    expect(callback()).toBe(2);
  });

  it('merges object and changing callback refs without leaving a stale reference', () => {
    const objectRef = createRef<HTMLInputElement>();
    const first = vi.fn();
    const second = vi.fn();
    function Probe({ callback }: { callback: (value: HTMLInputElement | null) => void }) { const ref = useMergedRefs(objectRef, callback); return <input ref={ref} />; }
    const view = render(<Probe callback={first} />);
    expect(objectRef.current).toBe(screen.getByRole('textbox'));
    expect(first).toHaveBeenCalledWith(objectRef.current);
    view.rerender(<Probe callback={second} />);
    expect(first).toHaveBeenLastCalledWith(null);
    expect(second).toHaveBeenLastCalledWith(objectRef.current);
    view.unmount();
    expect(second).toHaveBeenLastCalledWith(null);
  });

  it('reschedules and cleans up debounce timers', () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 50));
    act(() => result.current.schedule('first'));
    act(() => vi.advanceTimersByTime(25));
    act(() => result.current.schedule('second'));
    act(() => vi.advanceTimersByTime(49));
    expect(callback).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(callback).toHaveBeenCalledWith('second');
    callback.mockClear();
    act(() => result.current.schedule('unmounted'));
    unmount();
    act(() => vi.runAllTimers());
    expect(callback).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('aborts the previous async generation and assigns monotonic generations', async () => {
    const { result } = renderHook(() => useAsyncOperation());
    const aborted = vi.fn();
    let release: (() => void) | undefined;
    const first = act(() => result.current.run(({ signal }) => new Promise<void>((resolve) => { release = resolve; signal.addEventListener('abort', aborted); })));
    const second = act(() => result.current.run(async ({ generation }) => generation));
    expect(aborted).toHaveBeenCalledOnce();
    await expect(second).resolves.toBe(2);
    release?.();
    await first;
  });

  it('aborts async work on unmount without a post-unmount state update', () => {
    const aborted = vi.fn();
    const { result, unmount } = renderHook(() => useAsyncOperation());
    act(() => {
      void result.current.run(({ signal }) => new Promise<void>(() => signal.addEventListener('abort', aborted)));
    });
    unmount();
    expect(aborted).toHaveBeenCalledOnce();
  });

  it('generates stable ids and composes field ARIA without cloning children', () => {
    function IdProbe() { return <output>{useCgId()}</output>; }
    const { rerender } = render(<IdProbe />);
    const id = screen.getByRole('status').textContent;
    rerender(<IdProbe />);
    expect(screen.getByRole('status')).toHaveTextContent(id ?? '');

    render(<CgField label="Account" description="Ledger code" required errorMessage="Required"><CgTextBox /></CgField>);
    const input = screen.getByLabelText('Account *');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Ledger code'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('reacts to nested direction mutations and keeps portals SSR-safe', async () => {
    function DirectionProbe() {
      const ref = useRef<HTMLDivElement>(null);
      const direction = useDirection(ref);
      return <div ref={ref}><output>{direction}</output></div>;
    }
    const view = render(<section dir="ltr"><DirectionProbe /></section>);
    expect(screen.getByRole('status')).toHaveTextContent('ltr');
    view.container.querySelector('section')?.setAttribute('dir', 'rtl');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('rtl'));
    expect(() => renderToString(<CgPortal><span>safe</span></CgPortal>)).not.toThrow();
  });

  it('resets uncontrolled text associated through an external form attribute', async () => {
    function Form() { const [last, setLast] = useState(''); return <><form id="external-form"><button type="reset">Reset</button></form><CgField label="Name"><CgTextBox form="external-form" defaultValue="CashGear" onValueChange={setLast} /></CgField><output>{last}</output></>; }
    render(<Form />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await act(async () => Promise.resolve());
    expect(screen.getByLabelText('Name')).toHaveValue('CashGear');
  });
});
