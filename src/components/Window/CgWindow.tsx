import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useControllableState, useMergedRefs, useStableCallback } from '../../hooks';
import {
  CgPortal,
  focusOverlayInitial,
  isTopmostOverlay,
  OverlayOwnerProvider,
  OverlaySurfaceContent,
  overlayOwnsNode,
  overlaySurfaceStyles,
  surfaceStyle,
  useFocusOrigin,
  useOverlayLifecycle,
  useOverlaySurface,
  usePortalContext,
  useSurfaceGestures,
  useSurfacePosition,
} from '../../internal';
import type { CgOverlayPoint } from '../../types';
import { cx } from '../../utils';
import styles from './CgWindow.module.css';
import type {
  CgWindowActions,
  CgWindowCloseDetails,
  CgWindowNearTarget,
  CgWindowPositionChangeReason,
  CgWindowProps,
  CgWindowRenderContext,
} from './CgWindow.types';

function assertPoint(name: string, point: CgOverlayPoint | undefined): asserts point is CgOverlayPoint | undefined {
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError(`CgWindow ${name} coordinates must be finite.`);
  }
}

function resolveNearTarget(target: CgWindowNearTarget): HTMLElement {
  if (typeof target !== 'string') return target;
  if (!target.trim()) throw new Error('CgWindow showNear selector cannot be empty.');
  let element: HTMLElement | null;
  try { element = document.querySelector<HTMLElement>(target); } catch { throw new Error(`CgWindow showNear selector is invalid: ${target}`); }
  if (!element) throw new Error(`CgWindow showNear could not find an element matching selector: ${target}`);
  return element;
}

function standardHeaderHasContent(header: CgWindowProps['header'], headerText: string | undefined): boolean {
  if (typeof headerText === 'string' && headerText.trim()) return true;
  if (typeof header === 'string') return Boolean(header.trim());
  return header !== undefined && header !== null && header !== false;
}

export const CgWindow = forwardRef<HTMLDivElement, CgWindowProps>(function CgWindow(
  {
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
    body,
    footer,
    headerText,
    bodyText,
    footerText,
    renderHeader,
    renderBody,
    renderFooter,
    showHeader = true,
    showFooter,
    showCloseButton = true,
    closeButtonAriaLabel = 'Close',
    contentLoadMode = 'everyOpen',
    role = 'dialog',
    size = 'medium',
    width = 'min(28rem, calc(100vw - 24px))',
    height,
    minWidth,
    maxWidth = 'calc(100vw - 24px)',
    minHeight,
    maxHeight = 'calc(100vh - 24px)',
    position,
    defaultPosition,
    onPositionChange,
    horizontalAlignment = 'center',
    verticalAlignment = 'center',
    allowDrag = true,
    dragByHeaderOnly = true,
    allowResize = false,
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
    scrollable = true,
    closeOnEscape = true,
    zIndex,
    actionsRef,
    id,
    className,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  },
  forwardedRef,
) {
  assertPoint('position', position);
  assertPoint('defaultPosition', defaultPosition);
  const markerRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(surfaceRef, forwardedRef);
  const [hasOpened, setHasOpened] = useState(defaultOpen || open === true);
  const [currentPosition, setCurrentPosition] = useControllableState<CgOverlayPoint | undefined>(position, defaultPosition, 'CgWindow position');
  const ownedFocusRef = useRef(false);

  const lifecycle = useOverlayLifecycle<{ reason: 'programmatic'; event?: Event }, CgWindowCloseDetails>({
    componentName: 'CgWindow',
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
    onAfterClose: (details) => {
      const shouldRestore = ownedFocusRef.current;
      ownedFocusRef.current = false;
      if (shouldRestore) queueMicrotask(() => { if (capturedOriginRef.current?.isConnected) capturedOriginRef.current.focus({ preventScroll: true }); });
      return onAfterClose?.(details);
    },
    onLifecycleError,
  });
  const requestClose = useStableCallback((reason: CgWindowCloseDetails['reason'], event?: Event) => lifecycle.requestClose({ reason, event }));
  const stack = useOverlaySurface({
    active: lifecycle.open,
    kind: 'window',
    elementRef: surfaceRef,
    ...(closeOnEscape ? { onEscape: (event: KeyboardEvent) => { void requestClose('escape', event); } } : {}),
  });
  const raiseWindow = useStableCallback(() => stack.raise());
  const capturedOriginRef = useFocusOrigin(lifecycle.open);
  const shouldRender = lifecycle.open || contentLoadMode === 'fromMount' || (contentLoadMode === 'firstOpen' && hasOpened);

  usePortalContext(shouldRender, markerRef, portalRef);
  useSurfacePosition({ open: lifecycle.open, surfaceRef, position: currentPosition, horizontalAlignment, verticalAlignment });
  const proposePosition = useStableCallback((next: CgOverlayPoint, reason: CgWindowPositionChangeReason, event?: Event) => {
    assertPoint('proposed position', next);
    const previousPosition = currentPosition ?? {
      x: Number.parseFloat(surfaceRef.current?.style.left ?? '') || 0,
      y: Number.parseFloat(surfaceRef.current?.style.top ?? '') || 0,
    };
    setCurrentPosition(next);
    onPositionChange?.(next, { reason, previousPosition, event });
  });
  useSurfaceGestures({
    active: lifecycle.open,
    surfaceRef,
    allowDrag,
    dragByHeaderOnly,
    allowResize,
    positionControlled: position !== undefined,
    authoritativePosition: position,
    onPosition: (next, event) => proposePosition(next, 'drag', event),
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
  });

  const focus = useStableCallback(() => {
    raiseWindow();
    focusOverlayInitial(surfaceRef.current);
  });
  const showAtPoint = useStableCallback(async (point: CgOverlayPoint, reason: 'showAt' | 'showNear' = 'showAt') => {
    assertPoint('show position', point);
    proposePosition(point, reason);
    await lifecycle.requestOpen({ reason: 'programmatic' });
  });
  const actions = useMemo<CgWindowActions>(() => ({
    show: async () => { await lifecycle.requestOpen({ reason: 'programmatic' }); },
    close: async () => { await requestClose('programmatic'); },
    showAt: async (x, y) => { await showAtPoint({ x, y }); },
    showAtPoint: async (point) => { await showAtPoint(point); },
    showNear: async (target) => {
      const element = resolveNearTarget(target);
      if (!element.isConnected) throw new Error('CgWindow showNear target must be connected to the document.');
      const rect = element.getBoundingClientRect();
      await showAtPoint({ x: rect.left, y: rect.bottom + 4 }, 'showNear');
    },
    moveTo: (x, y) => proposePosition({ x, y }, 'move'),
    moveToPoint: (point) => proposePosition(point, 'move'),
    focus,
  }), [focus, lifecycle, proposePosition, requestClose, showAtPoint]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  useEffect(() => {
    if (!lifecycle.open) return undefined;
    const updateOwnership = (event: FocusEvent) => {
      ownedFocusRef.current = event.target instanceof Node && overlayOwnsNode(stack.id, event.target);
    };
    const raise = (event: Event) => {
      if (event.target instanceof Node && overlayOwnsNode(stack.id, event.target)) raiseWindow();
    };
    document.addEventListener('focusin', updateOwnership, true);
    document.addEventListener('focusin', raise, true);
    document.addEventListener('pointerdown', raise, true);
    queueMicrotask(() => {
      if (!lifecycle.openRef.current || !isTopmostOverlay(stack.id)) return;
      focusOverlayInitial(surfaceRef.current);
      ownedFocusRef.current = true;
    });
    return () => {
      document.removeEventListener('focusin', updateOwnership, true);
      document.removeEventListener('focusin', raise, true);
      document.removeEventListener('pointerdown', raise, true);
    };
  }, [lifecycle.open, lifecycle.openRef, raiseWindow, stack.id]);

  if (!shouldRender) return <span ref={markerRef} hidden data-cg-overlay-origin="" />;
  const resolvedId = id ?? stack.id;
  const bodyContent = body ?? children;
  const headerLabelsSurface = showHeader && !renderHeader && standardHeaderHasContent(header, headerText);
  const context: CgWindowRenderContext = { close: async () => { await requestClose('programmatic'); }, focus, boundaryId: stack.id };

  return (
    <>
      <span ref={markerRef} hidden data-cg-overlay-origin="" />
      <CgPortal>
        <div
          ref={portalRef}
          className={styles.portal}
          style={{ zIndex: zIndex ?? `calc(var(--cg-z-overlay) + ${stack.order * 2})` }}
          hidden={!lifecycle.open}
          inert={!lifecycle.open}
          data-cg-overlay-portal=""
          data-cg-overlay-id={stack.id}
          data-cg-overlay-owner={stack.ownerId}
        >
          <div
            {...nativeProps}
            ref={mergedRef}
            id={resolvedId}
            className={cx(overlaySurfaceStyles.surface, styles.surface, className)}
            style={surfaceStyle(style, width, height, minWidth, maxWidth, minHeight, maxHeight)}
            role={role}
            aria-modal="false"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy ?? (!ariaLabel && headerLabelsSurface ? `${resolvedId}-header` : undefined)}
            tabIndex={-1}
            data-size={size}
            data-cg-overlay-surface="window"
          >
            <OverlayOwnerProvider id={stack.id}>
              <OverlaySurfaceContent
                id={resolvedId}
                context={context}
                header={header}
                body={bodyContent}
                footer={footer}
                headerText={headerText}
                bodyText={bodyText}
                footerText={footerText}
                renderHeader={renderHeader}
                renderBody={renderBody}
                renderFooter={renderFooter}
                showHeader={showHeader}
                showFooter={showFooter}
                showCloseButton={showCloseButton}
                closeButtonAriaLabel={closeButtonAriaLabel}
                scrollable={scrollable}
                allowResize={allowResize}
                onCloseButton={() => { void requestClose('closeButton'); }}
              />
            </OverlayOwnerProvider>
          </div>
        </div>
      </CgPortal>
    </>
  );
});
