/** Pixels a press travels before it becomes a drag (a click stays a click). */
export const CG_DRAG_THRESHOLD = 4;
const EDGE = 48;
const MAX_STEP = 18;

export interface CgDragHandlers {
  /** The press became a drag. */
  onStart?: () => void;
  /** The pointer is at (x, y) in the viewport: at most once a frame, and again after an edge scroll. */
  onMove?: (x: number, y: number) => void;
  /** The pointer was released after a drag. */
  onDrop: (x: number, y: number) => void;
  /** Escape, a cancelled pointer, or the returned stop function, after the drag started. */
  onCancel?: () => void;
}

export interface CgDragOptions extends CgDragHandlers {
  /** A box that scrolls when the pointer nears its edges. */
  scroller?: HTMLElement | null;
  /** Pixels before a press becomes a drag. Default 4. */
  threshold?: number;
  /**
   * A copy that follows the pointer: `true` (default) clones the source, a function builds one,
   * `false` draws none. It is placed by a transform once a frame, and is hidden from assistive technology.
   */
  ghost?: boolean | ((source: HTMLElement) => HTMLElement);
  /** Class name added to the copy. */
  ghostClassName?: string;
}

/** Whether a press on `target` may drag `source`: not when it lands on a control inside it. */
export function cgStartsDrag(target: EventTarget | null, source: HTMLElement): boolean {
  const element = target instanceof Element ? target : null;
  if (!element) return false;
  const control = element.closest('button, a, input, textarea, select, label, [role="checkbox"], [contenteditable="true"], [data-cg-no-drag]');
  return !control || !source.contains(control) || control === source;
}

/** How far to scroll for a pointer at `position` in a box from `start` to `end`: faster nearer the edge. */
export function cgEdgeScrollStep(position: number, start: number, end: number): number {
  if (position < start + EDGE) return -Math.ceil(MAX_STEP * Math.min(1, (start + EDGE - position) / EDGE));
  if (position > end - EDGE) return Math.ceil(MAX_STEP * Math.min(1, (position - (end - EDGE)) / EDGE));
  return 0;
}

function cloneGhost(source: HTMLElement, rect: DOMRect): HTMLElement {
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.removeAttribute('id');
  for (const element of ghost.querySelectorAll('[id]')) element.removeAttribute('id');
  ghost.style.removeProperty('inset-block-start');
  ghost.style.removeProperty('inset-inline-start');
  ghost.style.inlineSize = `${rect.width}px`;
  ghost.style.blockSize = `${rect.height}px`;
  return ghost;
}

/**
 * Follows a press on `source` and, once it travels, drags it outside React: a copy follows the
 * pointer, the source is marked `data-cg-dragging`, a scroller scrolls near its edges, Escape or a
 * cancelled pointer ends it without a drop, and the click after a drop is swallowed. Pointer
 * events serve mouse, pen and touch alike. Returns a function that stops it at once.
 */
export function cgTrackDrag(press: PointerEvent | { nativeEvent: PointerEvent }, source: HTMLElement, options: CgDragOptions): () => void {
  const start = 'nativeEvent' in press ? press.nativeEvent : press;
  const view = source.ownerDocument.defaultView ?? window;
  const threshold = options.threshold ?? CG_DRAG_THRESHOLD;
  const rect = source.getBoundingClientRect();
  const grabX = start.clientX - rect.left;
  const grabY = start.clientY - rect.top;
  let dragging = false;
  let done = false;
  let ghost: HTMLElement | null = null;
  let x = start.clientX;
  let y = start.clientY;
  let frame = 0;

  const place = () => { if (ghost) ghost.style.transform = `translate3d(${x - grabX}px, ${y - grabY}px, 0)`; };
  const tick = () => {
    frame = 0;
    if (done || !dragging) return;
    place();
    let scrolled = false;
    const scroller = options.scroller;
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      const dx = cgEdgeScrollStep(x, box.left, box.right);
      const dy = cgEdgeScrollStep(y, box.top, box.bottom);
      if (dx || dy) {
        const left = scroller.scrollLeft;
        const top = scroller.scrollTop;
        scroller.scrollBy(dx, dy);
        scrolled = scroller.scrollLeft !== left || scroller.scrollTop !== top;
      }
    }
    options.onMove?.(x, y);
    if (scrolled) frame = view.requestAnimationFrame(tick);
  };
  const begin = () => {
    dragging = true;
    if (options.ghost !== false) {
      ghost = typeof options.ghost === 'function' ? options.ghost(source) : cloneGhost(source, rect);
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('data-cg-drag-ghost', '');
      ghost.dir = view.getComputedStyle(source).direction;
      if (options.ghostClassName) ghost.classList.add(options.ghostClassName);
      // Placed by viewport coordinates, which are physical: left and top, in either direction.
      Object.assign(ghost.style, { position: 'fixed', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0', pointerEvents: 'none', zIndex: 'var(--cg-z-modal, 1300)', opacity: '0.9', boxShadow: 'var(--cg-shadow)' });
      place();
      source.ownerDocument.body.append(ghost);
    }
    source.setAttribute('data-cg-dragging', '');
    options.onStart?.();
  };
  const finish = () => {
    done = true;
    if (frame) view.cancelAnimationFrame(frame);
    ghost?.remove();
    source.removeAttribute('data-cg-dragging');
    view.removeEventListener('pointermove', onMove, true);
    view.removeEventListener('pointerup', onUp, true);
    view.removeEventListener('pointercancel', onCancel, true);
    view.removeEventListener('keydown', onKey, true);
  };
  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    x = event.clientX;
    y = event.clientY;
    if (!dragging) {
      if (Math.hypot(x - start.clientX, y - start.clientY) < threshold) return;
      begin();
    }
    event.preventDefault();
    if (!frame) frame = view.requestAnimationFrame(tick);
  };
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== start.pointerId) return;
    const was = dragging;
    finish();
    if (!was) return;
    // The click that follows a drop must not open what was dragged.
    const swallow = (click: MouseEvent) => { click.stopPropagation(); click.preventDefault(); };
    view.addEventListener('click', swallow, { capture: true, once: true });
    view.setTimeout(() => view.removeEventListener('click', swallow, true), 0);
    options.onDrop(event.clientX, event.clientY);
  };
  const onCancel = () => {
    const was = dragging;
    finish();
    if (was) options.onCancel?.();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !dragging) return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };
  view.addEventListener('pointermove', onMove, true);
  view.addEventListener('pointerup', onUp, true);
  view.addEventListener('pointercancel', onCancel, true);
  view.addEventListener('keydown', onKey, true);
  return () => { if (!done) onCancel(); };
}
