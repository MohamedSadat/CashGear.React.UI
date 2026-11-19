import { useLayoutEffect, useState } from 'react';
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
  headerSize = 0,
  leadingRef?: RefObject<HTMLElement | null>,
): VirtualWindow {
  const [metrics, setMetrics] = useState({ scrollTop: 0, height: 0 });
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const leadingHeight = () => leadingRef?.current?.offsetHeight ?? 0;
    const update = () => {
      const offset = viewport.scrollTop - leadingHeight();
      setMetrics({ scrollTop: Math.max(0, offset), height: Math.max(0, viewport.clientHeight - headerSize + Math.min(0, offset)) });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(viewport);
    if (leadingRef?.current) observer?.observe(leadingRef.current);
    viewport.addEventListener('scroll', update, { passive: true });
    return () => {
      observer?.disconnect();
      viewport.removeEventListener('scroll', update);
    };
  }, [count, enabled, headerSize, leadingRef, viewportRef]);
  if (!enabled) return { start: 0, end: count, paddingBefore: 0, paddingAfter: 0 };
  const visible = Math.max(1, Math.ceil(metrics.height / itemSize));
  const start = Math.max(0, Math.min(Math.max(0, count - visible), Math.floor(metrics.scrollTop / itemSize) - overscan));
  const end = Math.min(count, start + visible + overscan * 2);
  return {
    start,
    end,
    paddingBefore: start * itemSize,
    paddingAfter: Math.max(0, (count - end) * itemSize),
  };
}
