import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

export interface LookUpVirtualRange {
  readonly start: number;
  readonly end: number;
  readonly paddingBefore: number;
  readonly paddingAfter: number;
}

/** Rows to render for a scroll position, with overscan on both sides. Blazor `CgVirtualizationMath.CalculateRows`. */
export function calculateLookUpRows(count: number, scrollTop: number, viewportHeight: number, rowHeight: number, overscan: number): LookUpVirtualRange {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0, paddingBefore: 0, paddingAfter: 0 };
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / rowHeight));
  const last = Math.max(first + 1, Math.ceil((Math.max(0, scrollTop) + Math.max(rowHeight, viewportHeight)) / rowHeight));
  const start = Math.min(count - 1, Math.max(0, first - overscan));
  const end = Math.min(count, last + overscan);
  return { start, end, paddingBefore: start * rowHeight, paddingAfter: Math.max(0, count - end) * rowHeight };
}

/**
 * The row height in pixels for virtualization: a number, or a positive `px`, `rem` or `em` length
 * (16px per rem or em). Blazor requires the same units when virtualization is on.
 */
export function resolveLookUpRowHeight(value: CSSProperties['height'] | undefined): number {
  if (value === undefined || value === null || value === '') return 32;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) throw new Error('CgLookUpGrid rowHeight must be positive when virtualization is enabled.');
    return value;
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(px|rem|em)\s*$/iu.exec(String(value));
  const amount = match ? Number(match[1]) : Number.NaN;
  if (!match || !(amount > 0)) throw new Error('CgLookUpGrid rowHeight must be a positive px, rem, or em value when virtualization is enabled.');
  return match[2]!.toLowerCase() === 'px' ? amount : amount * 16;
}

/**
 * Tracks the scroll position and height of the lookup's row viewport while the flyout is open. The
 * viewport mounts with the flyout, so it is measured again whenever it appears or the lookup opens, and
 * nothing is published while it is empty or hidden, when its height is not the rows' (Blazor 7db46710).
 */
export function useLookUpViewport(viewport: HTMLElement | null, body: HTMLElement | null, open: boolean, enabled: boolean): { readonly scrollTop: number; readonly height: number } {
  const [metrics, setMetrics] = useState({ scrollTop: 0, height: 360 });
  useEffect(() => {
    if (!enabled || !open || !viewport) return undefined;
    let frame = 0;
    const publish = () => {
      frame = 0;
      if (!viewport.clientHeight || !body?.childElementCount) return;
      const scrollTop = Math.max(0, viewport.scrollTop - (body.offsetTop ?? 0));
      const height = viewport.clientHeight;
      setMetrics((current) => current.scrollTop === scrollTop && current.height === height ? current : { scrollTop, height });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(publish); };
    viewport.addEventListener('scroll', schedule, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    observer?.observe(viewport);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', schedule);
      observer?.disconnect();
    };
  }, [body, enabled, open, viewport]);
  return metrics;
}
