import { useEffect, useRef, useState } from 'react';
import { useStableCallback } from '../../hooks';
import type { CgLayoutBreakpointQuery, CgLayoutBreakpointSize, UseCgLayoutBreakpointOptions } from './CgLayoutBreakpoint.types';

const NAMED_QUERIES: Record<CgLayoutBreakpointSize, string> = {
  'x-small': '(max-width: 575px)',
  small: '(min-width: 576px) and (max-width: 767px)',
  medium: '(min-width: 768px) and (max-width: 991px)',
  large: '(min-width: 992px) and (max-width: 1199px)',
  'x-large': '(min-width: 1200px)',
};

function validateBoundary(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`CgLayoutBreakpoint ${name} must be a nonnegative integer.`);
  }
}

export function createCgLayoutBreakpointQuery(options: CgLayoutBreakpointQuery): string {
  const size = options.size;
  const minWidth = options.minWidth;
  const maxWidth = options.maxWidth;
  if (size !== undefined && (minWidth !== undefined || maxWidth !== undefined)) {
    throw new Error('CgLayoutBreakpoint size cannot be combined with minWidth or maxWidth.');
  }
  if (size !== undefined) {
    const query = NAMED_QUERIES[size];
    if (!query) throw new Error(`CgLayoutBreakpoint received unknown size '${String(size)}'.`);
    return query;
  }
  if (minWidth === undefined && maxWidth === undefined) {
    throw new Error('CgLayoutBreakpoint requires size or at least one custom width boundary.');
  }
  validateBoundary('minWidth', minWidth);
  validateBoundary('maxWidth', maxWidth);
  if (minWidth !== undefined && maxWidth !== undefined && minWidth > maxWidth) {
    throw new RangeError('CgLayoutBreakpoint minWidth cannot be greater than maxWidth.');
  }
  return [
    minWidth === undefined ? undefined : `(min-width: ${minWidth}px)`,
    maxWidth === undefined ? undefined : `(max-width: ${maxWidth}px)`,
  ].filter(Boolean).join(' and ');
}

export function useCgLayoutBreakpoint(options: UseCgLayoutBreakpointOptions): boolean {
  const { defaultMatches = false, onMatchChange } = options;
  const query = createCgLayoutBreakpointQuery(options);
  const [matches, setMatches] = useState(defaultMatches);
  const lastMatchRef = useRef(defaultMatches);
  const notify = useStableCallback(onMatchChange);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    let current = true;
    const media = window.matchMedia(query);
    const update = (next: boolean) => {
      if (!current || lastMatchRef.current === next) return;
      lastMatchRef.current = next;
      setMatches(next);
      notify(next);
    };
    const onChange = (event: MediaQueryListEvent) => update(event.matches);
    update(media.matches);
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else media.addListener(onChange);
    return () => {
      current = false;
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, [notify, query]);

  return matches;
}
