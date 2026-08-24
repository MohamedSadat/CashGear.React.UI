import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgLoadingPanel, CgNumericEdit, CgSearchBox, CgSpinEdit } from '../src';

describe('numeric, search, and loading edge cases', () => {
  it.each([
    ['-', null],
    ['1.', null],
    ['١٢٫٥', 12.5],
    ['۱۲٫۵', 12.5],
  ])('handles localized or incomplete draft %s', (draft, expected) => {
    const changed = vi.fn();
    const invalid = vi.fn();
    render(<CgField label="Amount"><CgNumericEdit locale="ar-EG" defaultValue={null} precision={1} min={0} max={20} onValueChange={changed} onInvalidValue={invalid} /></CgField>);
    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.blur(input);
    if (expected === null) expect(invalid).toHaveBeenCalledWith(draft);
    else expect(changed).toHaveBeenLastCalledWith(expected, expect.objectContaining({ reason: 'blur' }));
  });

  it('clamps, rounds, clears to null, and steps from null using Razor policy', () => {
    const changed = vi.fn();
    const { rerender } = render(<CgField label="Quantity"><CgNumericEdit defaultValue={null} precision={2} min={0} max={10} onValueChange={changed} /></CgField>);
    const input = screen.getByLabelText('Quantity');
    fireEvent.change(input, { target: { value: '12.345' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changed).toHaveBeenLastCalledWith(10, expect.objectContaining({ reason: 'enter' }));
    fireEvent.change(input, { target: { value: '' } }); fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith(null, expect.anything());
    rerender(<CgField label="Quantity"><CgSpinEdit defaultValue={null} min={5} max={20} onValueChange={changed} /></CgField>);
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }));
    expect(changed).toHaveBeenLastCalledWith(5, expect.objectContaining({ reason: 'step' }));
  });

  it('debounces search, cancels stale requests, uses monotonic ids, and guards duplicate submit', async () => {
    vi.useFakeTimers();
    const calls: Array<{ query: string; requestId: number; signal: AbortSignal }> = [];
    const search = vi.fn((query: string, context: { requestId: number; signal: AbortSignal }) => { calls.push({ query, ...context }); return new Promise<void>(() => undefined); });
    render(<CgSearchBox aria-label="Find" searchDelay={50} onSearch={search} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    fireEvent.change(input, { target: { value: 'first' } });
    act(() => vi.advanceTimersByTime(50));
    expect(search).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: 'second' } });
    act(() => vi.advanceTimersByTime(50));
    expect(calls[0]?.signal.aborted).toBe(true);
    expect(calls[1]?.requestId).toBeGreaterThan(calls[0]?.requestId ?? 0);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('delays loading, enforces minimum duration, restores inert, portals, and dismisses only the top overlay', () => {
    vi.useFakeTimers();
    const first = vi.fn();
    const second = vi.fn();
    const target = document.createElement('div');
    target.innerHTML = '<button>Target child</button>';
    document.body.append(target);
    const { rerender } = render(<><CgLoadingPanel mode="portal" target={target} visible showDelay={20} minimumVisibleDuration={100}>content</CgLoadingPanel><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={first}><span>one</span></CgLoadingPanel><CgLoadingPanel mode="overlay" visible dismissOnEscape onVisibleChange={second}><span>two</span></CgLoadingPanel></>);
    expect(target.querySelector('[role="status"]')).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(second).toHaveBeenCalledWith(false);
    expect(first).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(20));
    expect(target.querySelector('[role="status"]')).toBeInTheDocument();
    expect(target.firstElementChild).toHaveAttribute('inert');
    rerender(<CgLoadingPanel mode="portal" target={target} visible={false} minimumVisibleDuration={100}>content</CgLoadingPanel>);
    act(() => vi.advanceTimersByTime(100));
    expect(target.firstElementChild).not.toHaveAttribute('inert');
    target.remove();
    vi.useRealTimers();
  });
});
