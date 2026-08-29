import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, RefObject } from 'react';
import { useMergedRefs, useStableCallback } from '../hooks';
import { CgPortal } from './CgPortal';

const VIEWPORT_MARGIN = 4;

export type PositionedOverlayPlacement =
  | 'bottom-start' | 'bottom' | 'bottom-end'
  | 'top-start' | 'top' | 'top-end'
  | 'right-start' | 'right' | 'right-end'
  | 'left-start' | 'left' | 'left-end';

export type PositionedOverlayWidthMode = 'editor' | 'content' | 'contentOrEditor' | 'explicit';

export interface PositionedOverlayPositionDetails {
  readonly placement: PositionedOverlayPlacement;
  readonly side: 'top' | 'bottom' | 'left' | 'right';
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly anchor: Readonly<{ left: number; top: number; right: number; bottom: number; width: number; height: number }>;
}

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
  const mutationObserver = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(update);
  elements.forEach((element) => { if (element) observer?.observe(element); });
  if (typeof document !== 'undefined') {
    mutationObserver?.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-cg-theme', 'data-cg-density', 'dir'],
    });
  }
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update, true);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);
  return () => {
    observer?.disconnect();
    mutationObserver?.disconnect();
    window.removeEventListener('resize', update);
    window.removeEventListener('scroll', update, true);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
  };
}

function syncPortalContext(anchor: HTMLElement, overlay: HTMLElement) {
  const theme = anchor.closest<HTMLElement>('[data-cg-theme]')?.dataset.cgTheme;
  const density = anchor.closest<HTMLElement>('[data-cg-density]')?.dataset.cgDensity;
  const direction = getComputedStyle(anchor).direction;
  if (theme && overlay.dataset.cgTheme !== theme) overlay.dataset.cgTheme = theme;
  else if (!theme && overlay.dataset.cgTheme !== undefined) delete overlay.dataset.cgTheme;
  if (density && overlay.dataset.cgDensity !== density) overlay.dataset.cgDensity = density;
  else if (!density && overlay.dataset.cgDensity !== undefined) delete overlay.dataset.cgDensity;
  if ((direction === 'rtl' || direction === 'ltr') && overlay.dir !== direction) overlay.dir = direction;
}

export interface PositionedOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  anchorRef?: RefObject<HTMLElement | null>;
  contextRef?: RefObject<Element | null>;
  getAnchorRect?: () => { left: number; top: number; width: number; height: number; right?: number; bottom?: number } | null;
  children: React.ReactNode;
  placement?: PositionedOverlayPlacement;
  /** Optional ordered candidates for overlays such as tooltips. Existing callers retain legacy placement behavior. */
  placementCandidates?: ReadonlyArray<PositionedOverlayPlacement>;
  offset?: number;
  flipOnOverflow?: boolean;
  shiftOnOverflow?: boolean;
  widthMode?: PositionedOverlayWidthMode;
  overlayWidth?: CSSProperties['width'];
  overlayHeight?: CSSProperties['height'];
  minWidth?: CSSProperties['minWidth'];
  maxWidth?: CSSProperties['maxWidth'];
  minHeight?: CSSProperties['minHeight'];
  maxHeight?: CSSProperties['maxHeight'];
  resizable?: boolean;
  scrollable?: boolean;
  revision?: number;
  onOutsidePointerDown?: () => void;
  onReadyChange?: (ready: boolean) => void;
  onAnchorLost?: () => void;
  onAnchorScroll?: () => void;
  onPlacementChange?: (side: 'top' | 'bottom' | 'left' | 'right') => void;
  onPositioned?: (details: PositionedOverlayPositionDetails) => void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function constrainedMaximum(value: CSSProperties['maxWidth'], available: number): CSSProperties['maxWidth'] {
  if (value === undefined) return available;
  if (typeof value === 'number') return Math.min(value, available);
  return `min(${available}px, ${value})`;
}

function alignedOffset(
  alignment: 'start' | 'center' | 'end',
  anchorStart: number,
  anchorSize: number,
  overlaySize: number,
  rtl: boolean,
): number {
  if (alignment === 'center') return anchorStart + (anchorSize - overlaySize) / 2;
  const resolved = rtl ? (alignment === 'start' ? 'end' : 'start') : alignment;
  return resolved === 'end' ? anchorStart + anchorSize - overlaySize : anchorStart;
}

function splitPlacement(placement: PositionedOverlayPlacement) {
  const [side, suffix] = placement.split('-') as [string, string | undefined];
  return { side, alignment: (suffix ?? 'center') as 'start' | 'center' | 'end' };
}

/** Private fixed-position popover used by editors. */
export const PositionedOverlay = forwardRef<HTMLDivElement, PositionedOverlayProps>(function PositionedOverlay(
  {
    anchorRef,
    contextRef,
    getAnchorRect,
    children,
    placement = 'bottom-start',
    placementCandidates,
    offset = 0,
    flipOnOverflow = true,
    shiftOnOverflow = true,
    widthMode = 'editor',
    overlayWidth,
    overlayHeight,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight = 288,
    resizable = false,
    scrollable,
    revision = 0,
    onOutsidePointerDown,
    onReadyChange,
    onAnchorLost,
    onAnchorScroll,
    onPlacementChange,
    onPositioned,
    style,
    ...props
  },
  forwardedRef,
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(overlayRef, forwardedRef);
  const [position, setPosition] = useState<CSSProperties>({ visibility: 'hidden' });
  const dismissOutside = useStableCallback(onOutsidePointerDown);
  const notifyReady = useStableCallback(onReadyChange);
  const notifyAnchorLost = useStableCallback(onAnchorLost);
  const notifyAnchorScroll = useStableCallback(onAnchorScroll);
  const notifyPlacement = useStableCallback(onPlacementChange);
  const readyRef = useRef(false);

  const setReady = useCallback((ready: boolean) => {
    if (readyRef.current === ready) return;
    readyRef.current = ready;
    notifyReady(ready);
  }, [notifyReady]);

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef?.current;
      const overlay = overlayRef.current;
      const suppliedRect = getAnchorRect?.();
      if ((!anchor && !suppliedRect) || !overlay) {
        setPosition({ visibility: 'hidden' });
        setReady(false);
        return;
      }
      const context = anchor ?? contextRef?.current;
      if (context instanceof HTMLElement) syncPortalContext(context, overlay);
      const rawRect = suppliedRect ?? anchor?.getBoundingClientRect();
      if (!rawRect) return;
      const anchorRect = {
        left: rawRect.left,
        top: rawRect.top,
        width: rawRect.width,
        height: rawRect.height,
        right: rawRect.right ?? rawRect.left + rawRect.width,
        bottom: rawRect.bottom ?? rawRect.top + rawRect.height,
      };
      if ((anchor && !anchor.isConnected) || anchorRect.width < 0 || anchorRect.height < 0 || (!suppliedRect && (anchorRect.width <= 0 || anchorRect.height <= 0))) {
        setPosition({ visibility: 'hidden' });
        setReady(false);
        notifyAnchorLost();
        return;
      }
      const bounds = viewportBounds();
      const usesLegacyEditorSizing = scrollable === undefined
        && widthMode === 'editor'
        && placement === 'bottom-start'
        && placementCandidates === undefined
        && overlayWidth === undefined
        && overlayHeight === undefined
        && minWidth === undefined
        && maxWidth === undefined
        && minHeight === undefined
        && !resizable
        && typeof maxHeight === 'number';
      if (usesLegacyEditorSizing) {
        const below = Math.max(0, bounds.bottom - anchorRect.bottom - VIEWPORT_MARGIN - offset);
        const above = Math.max(0, anchorRect.top - bounds.top - VIEWPORT_MARGIN - offset);
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
          ? Math.max(bounds.top + VIEWPORT_MARGIN, anchorRect.top - renderedHeight - offset)
          : anchorRect.bottom + offset;
        notifyPlacement(placeAbove ? 'top' : 'bottom');
        setPosition({
          position: 'fixed',
          left,
          top,
          width,
          maxHeight: renderedHeight,
          visibility: renderedHeight > 0 ? 'visible' : 'hidden',
        });
        setReady(renderedHeight > 0);
        return;
      }
      const spaces = {
        top: Math.max(0, anchorRect.top - bounds.top - VIEWPORT_MARGIN - offset),
        bottom: Math.max(0, bounds.bottom - anchorRect.bottom - VIEWPORT_MARGIN - offset),
        left: Math.max(0, anchorRect.left - bounds.left - VIEWPORT_MARGIN - offset),
        right: Math.max(0, bounds.right - anchorRect.right - VIEWPORT_MARGIN - offset),
      };
      const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
      const overlayRect = overlay.getBoundingClientRect();
      // Candidate surfaces can contain decorative absolutely positioned arrows.
      // Their scroll extent belongs in the placement gap, not the surface's fit size.
      const naturalWidth = placementCandidates?.length
        ? overlayRect.width
        : Math.max(overlayRect.width, Math.min(overlay.scrollWidth, bounds.right - bounds.left));
      const naturalHeight = placementCandidates?.length
        ? overlayRect.height
        : Math.max(overlayRect.height, Math.min(overlay.scrollHeight, bounds.bottom - bounds.top));
      const desiredHeight = naturalHeight;
      let selectedPlacement = placement;
      if (placementCandidates?.length) {
        const fit = placementCandidates.find((candidate) => {
          const candidateSide = splitPlacement(candidate).side as keyof typeof spaces;
          const desired = candidateSide === 'top' || candidateSide === 'bottom' ? desiredHeight : naturalWidth;
          return spaces[candidateSide] >= desired;
        });
        selectedPlacement = fit ?? placementCandidates.reduce((best, candidate) => {
          const bestSide = splitPlacement(best).side as keyof typeof spaces;
          const candidateSide = splitPlacement(candidate).side as keyof typeof spaces;
          return spaces[candidateSide] > spaces[bestSide] ? candidate : best;
        }, placementCandidates[0] ?? placement);
      }
      const selected = splitPlacement(selectedPlacement);
      const selectedSide = selected.side;
      const vertical = selectedSide === 'top' || selectedSide === 'bottom';
      const desiredMain = vertical ? desiredHeight : naturalWidth;
      const side = !placementCandidates?.length && flipOnOverflow && spaces[selectedSide as keyof typeof spaces] < desiredMain && spaces[opposite[selectedSide as keyof typeof opposite]] > spaces[selectedSide as keyof typeof spaces]
        ? opposite[selectedSide as keyof typeof opposite]
        : selectedSide;
      const resolvedPlacement = side === selectedSide ? selectedPlacement : (selectedPlacement.replace(selectedSide, side) as PositionedOverlayPlacement);
      const { alignment } = splitPlacement(resolvedPlacement);
      const availableMain = spaces[side as keyof typeof spaces];
      const availableWidth = Math.max(0, bounds.right - bounds.left - VIEWPORT_MARGIN * 2);
      const availableHeight = Math.max(0, bounds.bottom - bounds.top - VIEWPORT_MARGIN * 2);
      const measuredWidth = widthMode === 'editor'
        ? Math.min(anchorRect.width, availableWidth)
        : Math.min(naturalWidth, availableWidth);
      const measuredHeight = Math.min(desiredHeight, availableHeight, vertical ? availableMain : availableHeight);
      const rtl = getComputedStyle(anchor ?? contextRef?.current ?? document.documentElement).direction === 'rtl';
      let left = vertical
        ? alignedOffset(alignment, anchorRect.left, anchorRect.width, measuredWidth, rtl)
        : side === 'left' ? anchorRect.left - measuredWidth - offset : anchorRect.right + offset;
      let top = vertical
        ? side === 'top' ? anchorRect.top - measuredHeight - offset : anchorRect.bottom + offset
        : alignedOffset(alignment, anchorRect.top, anchorRect.height, measuredHeight, false);
      if (shiftOnOverflow) {
        left = clamp(left, bounds.left + VIEWPORT_MARGIN, bounds.right - VIEWPORT_MARGIN - measuredWidth);
        top = clamp(top, bounds.top + VIEWPORT_MARGIN, bounds.bottom - VIEWPORT_MARGIN - measuredHeight);
      }
      notifyPlacement(side as 'top' | 'bottom' | 'left' | 'right');
      onPositioned?.(Object.freeze({
        placement: resolvedPlacement,
        side: side as 'top' | 'bottom' | 'left' | 'right',
        left,
        top,
        width: measuredWidth,
        height: measuredHeight,
        anchor: Object.freeze({ ...anchorRect }),
      }));
      setPosition({
        position: 'fixed',
        inset: 'auto',
        left,
        top,
        width: widthMode === 'editor' ? measuredWidth : undefined,
        minWidth:
          widthMode === 'contentOrEditor'
            ? typeof minWidth === 'number'
              ? Math.max(anchorRect.width, minWidth)
              : minWidth === undefined
                ? anchorRect.width
                : `max(${anchorRect.width}px, ${minWidth})`
            : minWidth,
        maxWidth: constrainedMaximum(maxWidth, vertical ? availableWidth : Math.min(availableWidth, availableMain)),
        maxHeight: constrainedMaximum(maxHeight, vertical ? Math.min(availableHeight, availableMain) : availableHeight),
        visibility: measuredWidth > 0 && measuredHeight > 0 ? 'visible' : 'hidden',
      });
      setReady(measuredWidth > 0 && measuredHeight > 0);
    };
    update();
    const cleanup = observeGeometry([anchorRef?.current ?? null, contextRef?.current ?? null, overlayRef.current], update);
    return () => {
      cleanup();
      setReady(false);
    };
  }, [anchorRef, contextRef, flipOnOverflow, getAnchorRect, maxHeight, maxWidth, minHeight, minWidth, notifyAnchorLost, notifyPlacement, offset, onPositioned, overlayHeight, overlayWidth, placement, placementCandidates, resizable, revision, scrollable, setReady, shiftOnOverflow, widthMode]);

  useEffect(() => {
    if (!onAnchorScroll) return undefined;
    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && overlayRef.current?.contains(target)) return;
      if (target instanceof Element && anchorRef?.current && !target.contains(anchorRef.current)) return;
      notifyAnchorScroll();
    };
    document.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('scroll', onScroll);
    return () => {
      document.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('scroll', onScroll);
    };
  }, [anchorRef, notifyAnchorScroll, onAnchorScroll]);

  useEffect(() => {
    if (!onOutsidePointerDown) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef?.current?.contains(target) || overlayRef.current?.contains(target)) return;
      dismissOutside();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [anchorRef, dismissOutside, onOutsidePointerDown]);

  return (
    <CgPortal>
      <div
        {...props}
        ref={ref}
        style={{
          width: widthMode === 'explicit' ? overlayWidth : widthMode === 'content' || widthMode === 'contentOrEditor' ? 'max-content' : undefined,
          height: overlayHeight,
          minHeight,
          resize: resizable ? 'both' : undefined,
          overflow: scrollable === undefined ? undefined : scrollable ? 'auto' : resizable ? 'hidden' : 'visible',
          ...position,
          ...style,
        }}
      >{children}</div>
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
