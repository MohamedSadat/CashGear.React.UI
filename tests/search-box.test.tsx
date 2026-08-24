import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgSearchBox } from '../src';

describe('CgSearchBox', () => {
  it('uses trimmed length for eligibility but passes the original raw query', () => {
    const search = vi.fn();
    render(<CgSearchBox aria-label="Find" searchMode="submit" minimumLength={3} minimumLengthMessage={(minimum) => `Enter ${minimum} characters`} onSearch={search} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    fireEvent.change(input, { target: { value: '  ab  ' } });
    expect(input).toHaveAccessibleDescription('Enter 3 characters');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  abc  ' } });
    expect(input).not.toHaveAccessibleDescription('Enter 3 characters');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledWith('  abc  ', expect.objectContaining({ reason: 'submit', requestId: 1 }));
  });

  it('debounces, aborts stale work, recovers duplicate bookkeeping, and keeps request IDs monotonic', async () => {
    vi.useFakeTimers();
    const calls: Array<{ query: string; requestId: number; signal: AbortSignal }> = [];
    const resolvers: Array<() => void> = [];
    const search = vi.fn((query: string, context: { requestId: number; signal: AbortSignal }) => {
      calls.push({ query, ...context });
      return new Promise<void>((resolve) => resolvers.push(resolve));
    });
    render(<CgSearchBox aria-label="Find" searchDelay={50} minimumLength={2} onSearch={search} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    fireEvent.change(input, { target: { value: 'first' } });
    act(() => vi.advanceTimersByTime(50));
    fireEvent.change(input, { target: { value: 'x' } });
    expect(calls[0]?.signal.aborted).toBe(true);
    fireEvent.change(input, { target: { value: 'second' } });
    act(() => vi.advanceTimersByTime(50));
    expect(calls[1]?.requestId).toBeGreaterThan(calls[0]?.requestId ?? 0);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledTimes(2);
    await act(async () => resolvers[1]?.());
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('applies clear policy consistently to the button and Escape exactly once', () => {
    const queryChange = vi.fn();
    const search = vi.fn();
    const { rerender } = render(<CgSearchBox aria-label="Find" defaultQuery="term" escapeClears searchMode="submit" onQueryChange={queryChange} onSearch={search} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear value' }));
    expect(queryChange).toHaveBeenCalledTimes(1);
    expect(queryChange).toHaveBeenLastCalledWith('', undefined);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith('', expect.objectContaining({ reason: 'clear' }));

    rerender(<CgSearchBox aria-label="Find" query="again" escapeClears searchMode="submit" searchOnClear={false} onQueryChange={queryChange} onSearch={search} />);
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Find' }), { key: 'Escape' });
    expect(queryChange).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('searchbox', { name: 'Find' })).toHaveValue('');
  });

  it('searches exactly once after IME composition and resets through an external form', async () => {
    const search = vi.fn();
    const queryChange = vi.fn();
    render(<><form id="search-form" /><CgSearchBox aria-label="Search" form="search-form" name="query" defaultQuery="base" searchMode="input" onQueryChange={queryChange} onSearch={search} /></>);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '検索' } });
    expect(search).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: '検索' });
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('検索', expect.objectContaining({ reason: 'input' }));
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(input).toHaveValue('base');
    expect(new FormData(document.querySelector('form')!).get('query')).toBe('base');
  });

  it('resets request state after rejection and validates timing inputs', async () => {
    const search = vi.fn(() => Promise.reject(new Error('expected')));
    render(<CgSearchBox aria-label="Find" defaultQuery="ready" searchMode="submit" onSearch={search} />);
    const input = screen.getByRole('searchbox', { name: 'Find' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => Promise.resolve());
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(search).toHaveBeenCalledTimes(2);
    expect(() => render(<CgSearchBox searchDelay={-1} />)).toThrow(/searchDelay/);
    expect(() => render(<CgSearchBox minimumLength={-1} />)).toThrow(/minimumLength/);
  });
});
