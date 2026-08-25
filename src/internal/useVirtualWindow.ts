import { useEffect, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface VirtualWindow {
  start: number;
  end: number;
  paddingBefore: number;
  paddingAfter: number;
}

export function useVirtualWindow(
  viewportRef: RefObject<HTMLElement | null>,
  count: number,
  itemSize: number,
  overscan: number,
  enabled: boolean,
): VirtualWindow {
  const [metrics, setMetrics] = useState({ scrollTop: 0, height: 0 });
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const update = () => setMetrics({ scrollTop: viewport.scrollTop, height: viewport.clientHeight });
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(viewport);
    viewport.addEventListener('scroll', update, { passive: true });
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', update);
    };
  }, [enabled, viewportRef]);
  useEffect(() => {
    if (enabled) setMetrics((current) => ({ ...current, scrollTop: viewportRef.current?.scrollTop ?? 0 }));
  }, [count, enabled, viewportRef]);
  if (!enabled) return { start: 0, end: count, paddingBefore: 0, paddingAfter: 0 };
  const visible = Math.max(1, Math.ceil(metrics.height / itemSize));
  const start = Math.max(0, Math.floor(metrics.scrollTop / itemSize) - overscan);
  const end = Math.min(count, start + visible + overscan * 2);
  return {
    start,
    end,
    paddingBefore: start * itemSize,
    paddingAfter: Math.max(0, (count - end) * itemSize),
  };
}
