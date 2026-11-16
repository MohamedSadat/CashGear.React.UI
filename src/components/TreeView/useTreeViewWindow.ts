import { useCallback, useLayoutEffect, useState } from 'react';

/** The rows drawn: `start` to `end`, end excluded. */
export interface TreeViewWindow {
  readonly start: number;
  readonly end: number;
}

/**
 * The rows of `count` fixed-height rows that a viewport `height` pixels tall shows when scrolled
 * `scrollTop` pixels, with `overscan` rows more on each side.
 */
export function treeViewWindowRange(count: number, rowHeight: number, overscan: number, scrollTop: number, height: number): TreeViewWindow {
  if (count <= 0) return { start: 0, end: 0 };
  const visible = Math.max(1, Math.ceil(Math.max(0, height) / rowHeight));
  const first = Math.min(Math.max(0, count - visible), Math.floor(Math.max(0, scrollTop) / rowHeight));
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) };
}

/**
 * Follows a viewport's scroll and size. The viewport is passed as an element, not a ref, so a
 * tree drawn after it was empty is followed too. `measure` reads it again at once, after the
 * tree set its scroll itself.
 */
export function useTreeViewWindow(viewport: HTMLElement | null, count: number, rowHeight: number, overscan: number, enabled: boolean) {
  const [metrics, setMetrics] = useState({ top: 0, height: 0 });
  const measure = useCallback(() => {
    if (!viewport) return;
    const top = viewport.scrollTop;
    const height = viewport.clientHeight;
    setMetrics((current) => current.top === top && current.height === height ? current : { top, height });
  }, [viewport]);
  useLayoutEffect(() => {
    if (!enabled || !viewport) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the viewport's size and scroll are read when it is first followed.
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(viewport);
    viewport.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', measure);
    };
  }, [enabled, measure, viewport]);
  const range = enabled ? treeViewWindowRange(count, rowHeight, overscan, metrics.top, metrics.height) : { start: 0, end: count };
  return { ...range, measure };
}
