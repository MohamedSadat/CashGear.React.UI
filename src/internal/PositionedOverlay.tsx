import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, RefObject } from 'react';
import { useMergedRefs, useStableCallback } from '../hooks';
import { CgPortal } from './CgPortal';

const VIEWPORT_MARGIN = 4;

function viewportBounds() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  return {
    left,
    top,
    right: left + (viewport?.width ?? window.innerWidth),
    bottom: top + (viewport?.height ?? window.innerHeight),
  };
}

function observeGeometry(elements: ReadonlyArray<Element | null>, update: () => void) {
  const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
  elements.forEach((element) => { if (element) observer?.observe(element); });
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  return () => {
    observer?.disconnect();
    window.removeEventListener('resize', update);
    window.removeEventListener('scroll', update, true);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
  };
}

export interface PositionedOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
  maxHeight?: number;
  onOutsidePointerDown?: () => void;
}

/** Private fixed-position popover used by editors. */
export const PositionedOverlay = forwardRef<HTMLDivElement, PositionedOverlayProps>(function PositionedOverlay(
  { anchorRef, children, maxHeight = 288, onOutsidePointerDown, style, ...props },
  forwardedRef,
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(overlayRef, forwardedRef);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const dismissOutside = useStableCallback(onOutsidePointerDown);

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const overlay = overlayRef.current;
      if (!anchor || !overlay) {
        setPosition({ visibility: 'hidden' });
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      if (anchorRect.width <= 0 || anchorRect.height <= 0) {
        setPosition({ visibility: 'hidden' });
        return;
      }
      const bounds = viewportBounds();
      const below = Math.max(0, bounds.bottom - anchorRect.bottom - VIEWPORT_MARGIN);
      const above = Math.max(0, anchorRect.top - bounds.top - VIEWPORT_MARGIN);
      const desiredHeight = Math.min(maxHeight, Math.max(overlay.scrollHeight, 48));
      const placeAbove = below < desiredHeight && above > below;
      const availableHeight = Math.max(0, placeAbove ? above : below);
      const renderedHeight = Math.min(desiredHeight, availableHeight);
      const width = Math.min(anchorRect.width, Math.max(0, bounds.right - bounds.left - VIEWPORT_MARGIN * 2));
      const left = Math.min(
        Math.max(anchorRect.left, bounds.left + VIEWPORT_MARGIN),
        Math.max(bounds.left + VIEWPORT_MARGIN, bounds.right - VIEWPORT_MARGIN - width),
      );
      const top = placeAbove
        ? Math.max(bounds.top + VIEWPORT_MARGIN, anchorRect.top - renderedHeight)
        : anchorRect.bottom;
      setPosition({
        position: 'fixed',
        inset: 'auto',
        left,
        top,
        width,
        maxHeight: renderedHeight,
        visibility: renderedHeight > 0 ? 'visible' : 'hidden',
      });
    };
    update();
    return observeGeometry([anchorRef.current, overlayRef.current], update);
  }, [anchorRef, maxHeight]);

  useEffect(() => {
    if (!onOutsidePointerDown) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || overlayRef.current?.contains(target)) return;
      dismissOutside();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, dismissOutside, onOutsidePointerDown]);

  return (
    <CgPortal>
      <div {...props} ref={ref} style={{ ...position, ...style }}>{children}</div>
    </CgPortal>
  );
});

/** Resolves selector targets continuously so replaced portal hosts are adopted. */
export function useResolvedTarget(target: Element | string | null | undefined): Element | null {
  const resolve = useCallback((): Element | null => {
    if (typeof document === 'undefined') return null;
    return (typeof target === 'string' ? document.querySelector(target) : target) ?? document.body;
  }, [target]);
  const [resolved, setResolved] = useState<Element | null>(() => resolve());
  useEffect(() => {
    const update = () => setResolved(resolve());
    update();
    if (typeof target !== 'string' || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [resolve, target]);
  return resolved;
}

/** Returns a fixed rectangle that covers a live external portal target. */
export function useTargetCoverStyle(target: Element | null, active: boolean): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  useLayoutEffect(() => {
    if (!active || !target) return undefined;
    const update = () => {
      if (target === document.body || target === document.documentElement) {
        setStyle({ position: 'fixed', inset: 0, visibility: 'visible' });
        return;
      }
      const rect = target.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        inset: 'auto',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        visibility: rect.width > 0 && rect.height > 0 ? 'visible' : 'hidden',
      });
    };
    update();
    return observeGeometry([target], update);
  }, [active, target]);
  return style;
}
