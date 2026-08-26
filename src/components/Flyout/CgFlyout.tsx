import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RefObject } from 'react';
import { useMergedRefs, useStableCallback } from '../../hooks';
import {
  OverlayOwnerProvider,
  overlaySurfaceStyles,
  PositionedOverlay,
  requestExclusiveOverlay,
  useOverlayLifecycle,
  useOverlaySurface,
  useSurfaceGestures,
} from '../../internal';
import { assertNonNegative } from '../../internal/validation';
import type { CgOverlayPoint, CgOverlayRectangle } from '../../types';
import { cx } from '../../utils';
import styles from './CgFlyout.module.css';
import type {
  CgFlyoutActions,
  CgFlyoutAnchor,
  CgFlyoutCloseDetails,
  CgFlyoutProps,
} from './CgFlyout.types';

const RESIZE_EDGES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

function isRefAnchor(anchor: CgFlyoutAnchor): anchor is RefObject<HTMLElement | null> {
  return typeof anchor === 'object' && anchor !== null && 'current' in anchor;
}

function isElementAnchor(anchor: CgFlyoutAnchor): anchor is HTMLElement {
  return typeof HTMLElement !== 'undefined' && anchor instanceof HTMLElement;
}

function isRectangle(anchor: CgFlyoutAnchor): anchor is CgOverlayRectangle {
  return typeof anchor === 'object' && anchor !== null && 'width' in anchor && 'height' in anchor;
}

function virtualRect(anchor: CgOverlayRectangle | CgOverlayPoint) {
  const width = 'width' in anchor ? anchor.width : 0;
  const height = 'height' in anchor ? anchor.height : 0;
  return { left: anchor.x, top: anchor.y, width, height, right: anchor.x + width, bottom: anchor.y + height };
}

function validateAnchor(anchor: CgFlyoutAnchor): void {
  if (typeof anchor === 'string') {
    if (!anchor.trim()) throw new Error('CgFlyout anchor selector cannot be empty.');
    if (typeof document !== 'undefined') {
      try { document.querySelector(anchor); } catch { throw new Error(`CgFlyout anchor selector is invalid: ${anchor}`); }
    }
    return;
  }
  if (isElementAnchor(anchor) || isRefAnchor(anchor)) return;
  const values = isRectangle(anchor) ? [anchor.x, anchor.y, anchor.width, anchor.height] : [anchor.x, anchor.y];
  if (!values.every(Number.isFinite) || (isRectangle(anchor) && (anchor.width < 0 || anchor.height < 0))) {
    throw new RangeError('CgFlyout virtual anchor coordinates must be finite and rectangle sizes nonnegative.');
  }
}

export const CgFlyout = forwardRef<HTMLDivElement, CgFlyoutProps>(function CgFlyout(
  {
    anchor,
    open,
    defaultOpen = false,
    onOpenChange,
    onBeforeOpen,
    onAfterOpen,
    onBeforeClose,
    onAfterClose,
    onLifecycleError,
    children,
    header,
    footer,
    contentLoadMode = 'everyOpen',
    placement = 'bottom-start',
    offset = 4,
    flipOnOverflow = true,
    shiftOnOverflow = true,
    matchAnchorWidth = false,
    width,
    height,
    minWidth,
    maxWidth = 'calc(100vw - 8px)',
    minHeight,
    maxHeight = 'min(20rem, calc(100vh - 8px))',
    resizable = false,
    scrollable = true,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeOnScroll = false,
    exclusiveGroup,
    zIndex,
    actionsRef,
    id,
    className,
    style,
    ...nativeProps
  },
  forwardedRef,
) {
  validateAnchor(anchor);
  assertNonNegative('offset', offset);
  const markerRef = useRef<HTMLSpanElement>(null);
  const resolvedAnchorRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(surfaceRef, forwardedRef);
  const [positionRevision, setPositionRevision] = useState(0);
  const [placedSide, setPlacedSide] = useState<'top' | 'bottom' | 'left' | 'right'>('bottom');
  const [hasOpened, setHasOpened] = useState(defaultOpen || open === true);
  const anchorBoundaryRefs = useMemo(() => [resolvedAnchorRef], []);

  const lifecycle = useOverlayLifecycle<{ reason: 'programmatic'; event?: Event }, CgFlyoutCloseDetails>({
    componentName: 'CgFlyout',
    open,
    defaultOpen,
    createOpenDetails: () => ({ reason: 'programmatic' }),
    onOpenChange,
    onBeforeOpen,
    onAfterOpen: (details) => {
      setHasOpened(true);
      return onAfterOpen?.(details);
    },
    onBeforeClose,
    onAfterClose,
    onLifecycleError,
  });

  const requestClose = useStableCallback((reason: CgFlyoutCloseDetails['reason'], event?: Event) => (
    lifecycle.requestClose({ reason, event })
  ));

  const stack = useOverlaySurface({
    active: lifecycle.open,
    kind: 'transient',
    elementRef: surfaceRef,
    boundaryRefs: anchorBoundaryRefs,
    ...(closeOnEscape ? { onEscape: (event: KeyboardEvent) => { void requestClose('escape', event); } } : {}),
    ...(closeOnOutsideClick ? { onOutside: (event: PointerEvent) => requestClose('outsideClick', event) } : {}),
    ...(exclusiveGroup ? { exclusiveGroup } : {}),
    onSuperseded: () => requestClose('superseded'),
  });

  useLayoutEffect(() => {
    const resolve = () => {
      if (isElementAnchor(anchor)) resolvedAnchorRef.current = anchor;
      else if (isRefAnchor(anchor)) resolvedAnchorRef.current = anchor.current;
      else if (typeof anchor === 'string') resolvedAnchorRef.current = document.querySelector<HTMLElement>(anchor);
      else resolvedAnchorRef.current = null;
      setPositionRevision((revision) => revision + 1);
    };
    resolve();
    if ((typeof anchor !== 'string' && !isElementAnchor(anchor) && !isRefAnchor(anchor)) || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [anchor]);

  useEffect(() => {
    if (!lifecycle.open || typeof anchor !== 'string' && !isElementAnchor(anchor) && !isRefAnchor(anchor)) return;
    if (!resolvedAnchorRef.current?.isConnected) void requestClose('anchorLost');
  }, [anchor, lifecycle.open, positionRevision, requestClose]);

  useEffect(() => {
    if (!lifecycle.open || !resizable || !surfaceRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => setPositionRevision((revision) => revision + 1));
    observer.observe(surfaceRef.current);
    return () => observer.disconnect();
  }, [lifecycle.open, resizable]);

  useSurfaceGestures({
    active: lifecycle.open,
    surfaceRef,
    allowDrag: false,
    dragByHeaderOnly: false,
    allowResize: resizable,
    positionControlled: false,
    authoritativePosition: undefined,
    onPosition: () => undefined,
  });

  const focusFirst = useStableCallback(() => {
    const first = surfaceRef.current?.querySelector<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])');
    (first ?? surfaceRef.current)?.focus({ preventScroll: true });
  });
  const focusAnchor = useStableCallback(() => resolvedAnchorRef.current?.focus({ preventScroll: true }));
  const reposition = useStableCallback(() => setPositionRevision((revision) => revision + 1));
  const actions = useMemo<CgFlyoutActions>(() => ({
    open: async () => {
      if (!exclusiveGroup || await requestExclusiveOverlay(exclusiveGroup, stack.ownerId)) {
        await lifecycle.requestOpen({ reason: 'programmatic' });
      }
    },
    close: async () => { await requestClose('programmatic'); },
    toggle: async () => {
      if (lifecycle.openRef.current) await requestClose('programmatic');
      else if (!exclusiveGroup || await requestExclusiveOverlay(exclusiveGroup, stack.ownerId)) await lifecycle.requestOpen({ reason: 'programmatic' });
    },
    reposition,
    focusFirst,
    focusAnchor,
  }), [exclusiveGroup, focusAnchor, focusFirst, lifecycle, reposition, requestClose, stack.ownerId]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const virtual = useMemo(
    () => !isElementAnchor(anchor) && !isRefAnchor(anchor) && typeof anchor !== 'string' ? virtualRect(anchor) : undefined,
    [anchor],
  );
  const getVirtualAnchorRect = useMemo(() => virtual ? () => virtual : undefined, [virtual]);
  const shouldRender = lifecycle.open || contentLoadMode === 'fromMount' || (contentLoadMode === 'firstOpen' && hasOpened);
  if (!shouldRender) return <span ref={markerRef} hidden data-cg-overlay-origin="" />;
  const resolvedId = id ?? stack.id;

  return (
    <>
      <span ref={markerRef} hidden data-cg-overlay-origin="" />
      <PositionedOverlay
        {...nativeProps}
        ref={mergedRef}
        anchorRef={resolvedAnchorRef}
        contextRef={markerRef}
        getAnchorRect={getVirtualAnchorRect}
        id={resolvedId}
        className={cx(styles.root, className)}
        placement={placement}
        offset={offset}
        flipOnOverflow={flipOnOverflow}
        shiftOnOverflow={shiftOnOverflow}
        widthMode={matchAnchorWidth ? 'editor' : width === undefined ? 'content' : 'explicit'}
        overlayWidth={width}
        overlayHeight={height}
        minWidth={minWidth}
        maxWidth={maxWidth}
        minHeight={minHeight}
        maxHeight={maxHeight}
        resizable={false}
        scrollable={false}
        revision={positionRevision}
        hidden={!lifecycle.open}
        inert={!lifecycle.open}
        tabIndex={-1}
        data-cg-overlay-portal=""
        data-cg-overlay-surface="flyout"
        data-cg-overlay-id={stack.id}
        data-cg-overlay-owner={stack.ownerId}
        data-cg-flyout-placed={placedSide}
        onPlacementChange={setPlacedSide}
        onAnchorLost={() => { if (lifecycle.open) void requestClose('anchorLost'); }}
        onAnchorScroll={closeOnScroll ? () => { void requestClose('scroll'); } : undefined}
        style={{ zIndex: zIndex ?? `calc(var(--cg-z-${stack.rootKind === 'modal' ? 'modal' : 'popover'}) + ${stack.order * 2 + 1})`, ...style }}
      >
        <OverlayOwnerProvider id={stack.id}>
          {header !== undefined ? <div className={styles.header}>{header}</div> : null}
          <div className={cx(styles.body, scrollable && styles.scrollable)}>{children}</div>
          {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
          {resizable ? RESIZE_EDGES.map((edge) => (
            <span key={edge} className={cx(overlaySurfaceStyles.resize, overlaySurfaceStyles[edge])} data-cg-resize={edge} aria-hidden="true" />
          )) : null}
        </OverlayOwnerProvider>
      </PositionedOverlay>
    </>
  );
});
