import { useEffect, useRef } from 'react';
import type { PointerEvent, RefObject } from 'react';
import { useStableCallback } from '../../hooks';

export interface PointerCell { start: number; end: number; date: string; allDay: boolean }
interface Gesture { pointerId: number; x: number; y: number; currentX: number; currentY: number; moved: boolean; origin: PointerCell; target: PointerCell; element: HTMLElement; kind: string }
function readCell(element: Element | null, x?: number): PointerCell | null {
  const cell = element?.closest<HTMLElement>('[data-scheduler-cell]');
  if (!cell) return null;
  let start = Number(cell.dataset.start); let end = Number(cell.dataset.end);
  if (cell.dataset.axis === 'horizontal' && x !== undefined) {
    const rect = cell.getBoundingClientRect(); const reversed = cell.dataset.direction === 'rtl';
    const fraction = Math.max(0, Math.min(0.999999, (reversed ? rect.right - x : x - rect.left) / rect.width));
    const interval = Number(cell.dataset.interval) * 60_000;
    start += Math.floor(fraction * (end - start) / interval) * interval;
    end = Math.min(end, start + interval);
  }
  return { start, end, date: cell.dataset.date!, allDay: cell.dataset.allDay === 'true' };
}
export function useSchedulerPointer(root: RefObject<HTMLDivElement | null>, scroll: RefObject<HTMLDivElement | null>, onPreview: (origin: PointerCell, target: PointerCell, kind: string) => void, onCommit: (origin: PointerCell, target: PointerCell, kind: string) => void, onCancel: () => void) {
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const clickReset = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animation = useRef(0);
  const preview = useStableCallback(onPreview); const commit = useStableCallback(onCommit); const canceled = useStableCallback(onCancel);
  const stop = useStableCallback((cancel: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    cancelAnimationFrame(animation.current);
    if (!g) return;
    if (g.element.hasPointerCapture?.(g.pointerId)) g.element.releasePointerCapture(g.pointerId);
    if (g.moved) {
      suppressClick.current = true;
      if (clickReset.current) clearTimeout(clickReset.current);
      clickReset.current = setTimeout(() => { suppressClick.current = false; }, 0);
      if (!cancel) commit(g.origin, g.target, g.kind);
    }
    canceled();
  });
  const locate = useStableCallback((g: Gesture) => {
    const elements = document.elementsFromPoint(g.currentX, g.currentY);
    const hit = elements.find((element) => root.current?.contains(element) && element.matches('[data-scheduler-cell]'));
    const cell = readCell(hit ?? null, g.currentX);
    if (cell && cell.allDay === g.origin.allDay) { g.target = cell; preview(g.origin, cell, g.kind); }
  });
  const tick = useStableCallback(function frame() {
    const g = gesture.current; const viewport = scroll.current;
    if (!g?.moved || !viewport) return;
    const box = viewport.getBoundingClientRect();
    const delta = (p: number, low: number, high: number) => p < low + 32 ? -12 : p > high - 32 ? 12 : 0;
    viewport.scrollBy(delta(g.currentX, box.left, box.right), delta(g.currentY, box.top, box.bottom));
    locate(g);
    animation.current = requestAnimationFrame(frame);
  });
  useEffect(() => () => { cancelAnimationFrame(animation.current); if (clickReset.current) clearTimeout(clickReset.current); gesture.current = null; }, []);
  return {
    suppressClick,
    cancel: () => stop(true),
    start: (event: PointerEvent<HTMLElement>, kind: string, origin?: PointerCell) => {
      if (event.button !== 0 || gesture.current) return;
      suppressClick.current = false;
      const underneath = document.elementsFromPoint?.(event.clientX, event.clientY).find((element) => root.current?.contains(element) && element.matches('[data-scheduler-cell]'));
      const cell = readCell(underneath ?? null, event.clientX) ?? origin ?? readCell(event.target as Element, event.clientX);
      if (!cell) return;
      // Capture on the stable viewport: overlap reflow can move an appointment's DOM node.
      const element = scroll.current ?? event.currentTarget;
      gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, currentX: event.clientX, currentY: event.clientY, moved: false, origin: cell, target: cell, element, kind };
      element.setPointerCapture?.(event.pointerId);
    },
    move: (event: PointerEvent) => {
      const g = gesture.current;
      if (!g || g.pointerId !== event.pointerId) return;
      g.currentX = event.clientX; g.currentY = event.clientY;
      if (!g.moved && Math.hypot(g.currentX - g.x, g.currentY - g.y) < 5) return;
      event.preventDefault();
      if (!g.moved) { g.moved = true; animation.current = requestAnimationFrame(tick); }
      locate(g);
    },
    end: () => stop(false),
  };
}
