import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgLayoutBreakpoint, useCgLayoutBreakpoint } from '../src';

interface MockMedia {
  media: string;
  matches: boolean;
  listener?: (event: MediaQueryListEvent) => void;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

function installMatchMedia(initial = false) {
  const entries: MockMedia[] = [];
  const matchMedia = vi.fn((query: string) => {
    const entry: MockMedia = {
      media: query,
      matches: initial,
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => { entry.listener = listener; }),
      removeEventListener: vi.fn(),
    };
    entries.push(entry);
    return entry as unknown as MediaQueryList;
  });
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
  return entries;
}

describe('CgLayoutBreakpoint', () => {
  it.each([
    ['x-small', '(max-width: 575px)'],
    ['small', '(min-width: 576px) and (max-width: 767px)'],
    ['medium', '(min-width: 768px) and (max-width: 991px)'],
    ['large', '(min-width: 992px) and (max-width: 1199px)'],
    ['x-large', '(min-width: 1200px)'],
  ] as const)('creates the exact %s band', (size, query) => {
    const entries = installMatchMedia();
    renderHook(() => useCgLayoutBreakpoint({ size }));
    expect(entries[0]?.media).toBe(query);
  });

  it('creates inclusive custom ranges and rejects invalid combinations', () => {
    const entries = installMatchMedia();
    renderHook(() => useCgLayoutBreakpoint({ minWidth: 0, maxWidth: 900 }));
    expect(entries[0]?.media).toBe('(min-width: 0px) and (max-width: 900px)');
    expect(() => renderHook(() => useCgLayoutBreakpoint({ minWidth: -1 }))).toThrow(RangeError);
    expect(() => renderHook(() => useCgLayoutBreakpoint({ minWidth: 901, maxWidth: 900 }))).toThrow(RangeError);
    expect(() => renderHook(() => useCgLayoutBreakpoint({ size: 'small', minWidth: 1 } as never))).toThrow(/cannot be combined/);
  });

  it('keeps the SSR fallback and hydrates to the live match once', () => {
    expect(renderToString(<CgLayoutBreakpoint size="medium" defaultMatches>{(matches) => <span>{String(matches)}</span>}</CgLayoutBreakpoint>)).toContain('true');
    const changed = vi.fn();
    installMatchMedia(true);
    render(<CgLayoutBreakpoint size="medium" onMatchChange={changed}>{(matches) => <output>{String(matches)}</output>}</CgLayoutBreakpoint>);
    expect(screen.getByRole('status')).toHaveTextContent('true');
    expect(changed).toHaveBeenCalledOnce();
  });

  it('deduplicates events and cleans listeners on query changes and unmount', () => {
    const changed = vi.fn();
    const entries = installMatchMedia(false);
    const view = render(<CgLayoutBreakpoint size="small" onMatchChange={changed}>{String}</CgLayoutBreakpoint>);
    act(() => entries[0]?.listener?.({ matches: true } as MediaQueryListEvent));
    act(() => entries[0]?.listener?.({ matches: true } as MediaQueryListEvent));
    expect(changed).toHaveBeenCalledTimes(1);
    view.rerender(<CgLayoutBreakpoint size="large" onMatchChange={changed}>{String}</CgLayoutBreakpoint>);
    expect(entries[0]?.removeEventListener).toHaveBeenCalledOnce();
    expect(entries).toHaveLength(2);
    view.unmount();
    expect(entries[1]?.removeEventListener).toHaveBeenCalledOnce();
  });
});
