import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import type {
  CgOverlayDragEndDetails,
  CgOverlayDragStartDetails,
  CgOverlayHorizontalAlignment,
  CgOverlayPoint,
  CgOverlayResizeEndDetails,
  CgOverlayResizeStartDetails,
  CgOverlayVerticalAlignment,
} from '../types';
import { useStableCallback } from '../hooks';
import { cx } from '../utils';
import { clampWindowPosition } from './overlayDom';
import styles from './OverlaySurface.module.css';

const EDGES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
const VIEWPORT_MARGIN = 12;

function computedLimit(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function viewportRectangle() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const width = viewport?.width ?? window.innerWidth;
  const height = viewport?.height ?? window.innerHeight;
  return { left, top, right: left + width, bottom: top + height };
}

export interface OverlaySurfaceRenderContext {
  close: () => Promise<void>;
  focus: () => void;
  boundaryId: string;
}

export interface OverlaySurfaceContentProps {
  id: string;
  context: OverlaySurfaceRenderContext;
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  renderHeader?: (context: OverlaySurfaceRenderContext) => ReactNode;
  renderBody?: (context: OverlaySurfaceRenderContext) => ReactNode;
  renderFooter?: (context: OverlaySurfaceRenderContext) => ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  scrollable?: boolean;
  allowResize?: boolean;
  onCloseButton: () => void;
}

export function OverlaySurfaceContent({
  id,
  context,
  header,
  body,
  footer,
  headerText,
  bodyText,
  footerText,
  renderHeader,
  renderBody,
  renderFooter,
  showHeader = true,
  showFooter = Boolean(renderFooter || footer !== undefined || footerText !== undefined),
  showCloseButton = false,
  closeButtonAriaLabel = 'Close',
  scrollable = true,
  allowResize = false,
  onCloseButton,
}: OverlaySurfaceContentProps) {
  const headerContent = header ?? headerText;
  const footerContent = footer ?? footerText;
  return (
    <>
      {showHeader ? (
        <div
          className={cx(styles.header, renderHeader && styles.template)}
          data-cg-overlay-header=""
        >
          {renderHeader ? renderHeader(context) : (
            <>
              <div id={`${id}-header`} className={styles.headerContent}>{headerContent}</div>
              {showCloseButton ? (
                <button type="button" className={styles.close} aria-label={closeButtonAriaLabel} onClick={onCloseButton}>×</button>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      <div className={cx(styles.body, scrollable && styles.scrollable, renderBody && styles.template)} data-cg-overlay-body="">
        {renderBody ? renderBody(context) : <div className={styles.bodyContent}>{body ?? bodyText}</div>}
      </div>
      {showFooter ? (
        <div className={cx(styles.footer, renderFooter && styles.template)} data-cg-overlay-footer="">
          {renderFooter ? renderFooter(context) : <div className={styles.footerContent}>{footerContent}</div>}
        </div>
      ) : null}
      {allowResize ? EDGES.map((edge) => (
        <span key={edge} className={cx(styles.resize, styles[edge])} data-cg-resize={edge} aria-hidden="true" />
      )) : null}
    </>
  );
}

interface SurfacePositionOptions {
  open: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
  position: CgOverlayPoint | undefined;
  horizontalAlignment: CgOverlayHorizontalAlignment;
  verticalAlignment: CgOverlayVerticalAlignment;
  revision?: number;
}

export function useSurfacePosition({
  open,
  surfaceRef,
  position,
  horizontalAlignment,
  verticalAlignment,
  revision = 0,
}: SurfacePositionOptions): void {
  useLayoutEffect(() => {
    if (!open) return undefined;
    const surface = surfaceRef.current;
    if (!surface) return undefined;
    const update = () => {
      const viewport = window.visualViewport;
      const bounds = {
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
        height: viewport?.height ?? window.innerHeight,
      };
      const rect = surface.getBoundingClientRect();
      const direction = getComputedStyle(surface).direction;
      let x: number;
      let y: number;
      if (position) {
        ({ x, y } = clampWindowPosition(surface, position));
      } else {
        const horizontal = horizontalAlignment === 'start'
          ? direction === 'rtl' ? 'right' : 'left'
          : horizontalAlignment === 'end'
            ? direction === 'rtl' ? 'left' : 'right'
            : horizontalAlignment;
        x = horizontal === 'left'
          ? bounds.left + 12
          : horizontal === 'right'
            ? bounds.left + bounds.width - rect.width - 12
            : bounds.left + (bounds.width - rect.width) / 2;
        y = verticalAlignment === 'top'
          ? bounds.top + 12
          : verticalAlignment === 'bottom'
            ? bounds.top + bounds.height - rect.height - 12
            : bounds.top + (bounds.height - rect.height) / 2;
        ({ x, y } = clampWindowPosition(surface, { x, y }));
      }
      surface.style.left = `${x}px`;
      surface.style.top = `${y}px`;
      surface.style.visibility = 'visible';
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(surface);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, [horizontalAlignment, open, position, revision, surfaceRef, verticalAlignment]);
}

interface SurfaceGesturesOptions {
  active: boolean;
  surfaceRef: RefObject<HTMLElement | null>;
  allowDrag: boolean;
  dragByHeaderOnly: boolean;
  allowResize: boolean;
  positionControlled: boolean;
  authoritativePosition: CgOverlayPoint | undefined;
  onPosition: (point: CgOverlayPoint, event: PointerEvent) => void;
  onDragStart?: (details: CgOverlayDragStartDetails) => void;
  onDragEnd?: (details: CgOverlayDragEndDetails) => void;
  onResizeStart?: (details: CgOverlayResizeStartDetails) => void;
  onResizeEnd?: (details: CgOverlayResizeEndDetails) => void;
}

export function useSurfaceGestures(options: SurfaceGesturesOptions): void {
  const finishRef = useRef<(() => void) | undefined>(undefined);
  const onPosition = useStableCallback(options.onPosition);
  const onDragStart = useStableCallback(options.onDragStart);
  const onDragEnd = useStableCallback(options.onDragEnd);
  const onResizeStart = useStableCallback(options.onResizeStart);
  const onResizeEnd = useStableCallback(options.onResizeEnd);

  useEffect(() => {
    if (!options.active) return undefined;
    const surface = options.surfaceRef.current;
    if (!surface) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const edge = target?.closest<HTMLElement>('[data-cg-resize]')?.dataset.cgResize;
      const interactive = target?.closest('button,input,select,textarea,a[href],[contenteditable="true"],[data-cg-no-drag]');
      const header = target?.closest('[data-cg-overlay-header]');
      const resizing = Boolean(edge && options.allowResize);
      const dragging = !resizing && options.allowDrag && !interactive && (!options.dragByHeaderOnly || Boolean(header));
      if (!resizing && !dragging) return;
      event.preventDefault();
      const startRect = surface.getBoundingClientRect();
      const start = { x: startRect.left, y: startRect.top };
      const startSize = { width: startRect.width, height: startRect.height };
      const pointer = { x: event.clientX, y: event.clientY };
      const computed = getComputedStyle(surface);
      const minimumWidth = Math.max(120, computedLimit(computed.minWidth, 0));
      const minimumHeight = Math.max(44, computedLimit(computed.minHeight, 0));
      const maximumCssWidth = computedLimit(computed.maxWidth, Number.POSITIVE_INFINITY);
      const maximumCssHeight = computedLimit(computed.maxHeight, Number.POSITIVE_INFINITY);
      const bounds = viewportRectangle();
      const controller = new AbortController();
      finishRef.current?.();
      let ended = false;
      try { surface.setPointerCapture(event.pointerId); } catch { /* Synthetic pointers need no capture. */ }
      if (dragging) onDragStart({ start, event });
      else onResizeStart({ startSize, event });

      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const dx = moveEvent.clientX - pointer.x;
        const dy = moveEvent.clientY - pointer.y;
        if (dragging) {
          const next = clampWindowPosition(surface, { x: start.x + dx, y: start.y + dy });
          surface.style.left = `${next.x}px`;
          surface.style.top = `${next.y}px`;
          return;
        }
        const east = edge?.includes('e');
        const west = edge?.includes('w');
        const south = edge?.includes('s');
        const north = edge?.includes('n');
        const maximumViewportWidth = west
          ? startRect.right - (bounds.left + VIEWPORT_MARGIN)
          : bounds.right - VIEWPORT_MARGIN - startRect.left;
        const maximumViewportHeight = north
          ? startRect.bottom - (bounds.top + VIEWPORT_MARGIN)
          : bounds.bottom - VIEWPORT_MARGIN - startRect.top;
        const maximumWidth = Math.max(minimumWidth, Math.min(maximumCssWidth, maximumViewportWidth));
        const maximumHeight = Math.max(minimumHeight, Math.min(maximumCssHeight, maximumViewportHeight));
        const requestedWidth = startSize.width + (east ? dx : west ? -dx : 0);
        const requestedHeight = startSize.height + (south ? dy : north ? -dy : 0);
        const width = east || west ? Math.min(Math.max(minimumWidth, requestedWidth), maximumWidth) : startSize.width;
        const height = south || north ? Math.min(Math.max(minimumHeight, requestedHeight), maximumHeight) : startSize.height;
        surface.style.width = `${width}px`;
        surface.style.height = `${height}px`;
        if (west) surface.style.left = `${start.x + startSize.width - width}px`;
        if (north) surface.style.top = `${start.y + startSize.height - height}px`;
      };
      const release = () => {
        controller.abort();
        try {
          if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
        } catch { /* Capture may already have ended. */ }
      };
      const end = (endEvent: PointerEvent) => {
        if (ended || endEvent.pointerId !== event.pointerId) return;
        ended = true;
        release();
        const rect = surface.getBoundingClientRect();
        if (dragging) {
          const next = { x: rect.left, y: rect.top };
          onPosition(next, endEvent);
          onDragEnd({ start, end: next, event: endEvent });
          if (options.positionControlled) {
            const authoritative = options.authoritativePosition ?? start;
            surface.style.left = `${authoritative.x}px`;
            surface.style.top = `${authoritative.y}px`;
          }
        } else {
          onResizeEnd({ startSize, endSize: { width: rect.width, height: rect.height }, event: endEvent });
        }
      };
      surface.addEventListener('pointermove', move, { signal: controller.signal });
      surface.addEventListener('pointerup', end, { signal: controller.signal });
      surface.addEventListener('pointercancel', end, { signal: controller.signal });
      surface.addEventListener('lostpointercapture', end, { signal: controller.signal });
      finishRef.current = () => {
        if (!ended) release();
        ended = true;
      };
      window.addEventListener('blur', finishRef.current, { signal: controller.signal });
    };
    surface.addEventListener('pointerdown', onPointerDown);
    return () => {
      finishRef.current?.();
      finishRef.current = undefined;
      surface.removeEventListener('pointerdown', onPointerDown);
    };
  }, [onDragEnd, onDragStart, onPosition, onResizeEnd, onResizeStart, options.active, options.allowDrag, options.allowResize, options.authoritativePosition, options.dragByHeaderOnly, options.positionControlled, options.surfaceRef]);
}

export function surfaceStyle(
  style: CSSProperties | undefined,
  width: CSSProperties['width'],
  height: CSSProperties['height'],
  minWidth: CSSProperties['minWidth'],
  maxWidth: CSSProperties['maxWidth'],
  minHeight: CSSProperties['minHeight'],
  maxHeight: CSSProperties['maxHeight'],
): CSSProperties {
  return { width, height, minWidth, maxWidth, minHeight, maxHeight, visibility: 'hidden', ...style };
}

export { styles as overlaySurfaceStyles };
