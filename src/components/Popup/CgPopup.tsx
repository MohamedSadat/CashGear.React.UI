import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useControllableState, useMergedRefs, useStableCallback } from '../../hooks';
import {
  CgPortal,
  focusOverlayInitial,
  OverlayOwnerProvider,
  OverlaySurfaceContent,
  overlaySurfaceStyles,
  surfaceStyle,
  useFocusOrigin,
  useModalFocusTrap,
  useModalIsolation,
  useOverlayLifecycle,
  useOverlaySurface,
  usePortalContext,
  useSurfaceGestures,
  useSurfacePosition,
} from '../../internal';
import type { CgOverlayPoint } from '../../types';
import { cx } from '../../utils';
import styles from './CgPopup.module.css';
import type { CgPopupActions, CgPopupCloseDetails, CgPopupProps, CgPopupRenderContext } from './CgPopup.types';

function assertPoint(name: string, point: CgOverlayPoint | undefined): void {
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new RangeError(`CgPopup ${name} coordinates must be finite.`);
  }
}

function standardHeaderHasContent(header: CgPopupProps['header'], headerText: string | undefined): boolean {
  if (typeof headerText === 'string' && headerText.trim()) return true;
  if (typeof header === 'string') return Boolean(header.trim());
  return header !== undefined && header !== null && header !== false;
}

export const CgPopup = forwardRef<HTMLDivElement, CgPopupProps>(function CgPopup(
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
    width = 'min(32rem, calc(100vw - 24px))',
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
    allowDrag = false,
    dragByHeaderOnly = true,
    allowResize = false,
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
    scrollable = true,
    adaptive = true,
    shading = 'visible',
    closeOnOutsideClick = false,
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
  const [uncontrolledPosition, setUncontrolledPosition] = useControllableState<CgOverlayPoint | undefined>(position, defaultPosition, 'CgPopup position');

  const lifecycle = useOverlayLifecycle<{ reason: 'programmatic'; event?: Event }, CgPopupCloseDetails>({
    componentName: 'CgPopup',
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
      setTimeout(() => { if (capturedOriginRef.current?.isConnected) capturedOriginRef.current.focus({ preventScroll: true }); }, 0);
      return onAfterClose?.(details);
    },
    onLifecycleError,
  });
  const requestClose = useStableCallback((reason: CgPopupCloseDetails['reason'], event?: Event) => lifecycle.requestClose({ reason, event }));
  const stack = useOverlaySurface({
    active: lifecycle.open,
    kind: 'modal',
    elementRef: surfaceRef,
    ...(closeOnEscape ? { onEscape: (event: KeyboardEvent) => { void requestClose('escape', event); } } : {}),
    ...(closeOnOutsideClick ? { onOutside: (event: PointerEvent) => requestClose('outsideClick', event) } : {}),
  });
  const capturedOriginRef = useFocusOrigin(lifecycle.open);
  const shouldRender = lifecycle.open || contentLoadMode === 'fromMount' || (contentLoadMode === 'firstOpen' && hasOpened);

  usePortalContext(shouldRender, markerRef, portalRef);
  useSurfacePosition({
    open: lifecycle.open,
    surfaceRef,
    position: uncontrolledPosition,
    horizontalAlignment,
    verticalAlignment,
  });
  useModalFocusTrap(lifecycle.open, stack.id, surfaceRef);
  useModalIsolation(lifecycle.open, stack.id, portalRef, true, stack.order);
  useSurfaceGestures({
    active: lifecycle.open,
    surfaceRef,
    allowDrag,
    dragByHeaderOnly,
    allowResize,
    positionControlled: position !== undefined,
    authoritativePosition: position,
    onPosition: (next, event) => {
      const previousPosition = uncontrolledPosition ?? { x: surfaceRef.current?.offsetLeft ?? 0, y: surfaceRef.current?.offsetTop ?? 0 };
      setUncontrolledPosition(next);
      onPositionChange?.(next, { reason: 'drag', previousPosition, event });
    },
    onDragStart,
    onDragEnd,
    onResizeStart,
    onResizeEnd,
  });

  const focus = useStableCallback(() => focusOverlayInitial(surfaceRef.current));
  const actions = useMemo<CgPopupActions>(() => ({
    open: async () => { await lifecycle.requestOpen({ reason: 'programmatic' }); },
    close: async () => { await requestClose('programmatic'); },
    focus,
  }), [focus, lifecycle, requestClose]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  if (!shouldRender) return <span ref={markerRef} hidden data-cg-overlay-origin="" />;
  const resolvedId = id ?? stack.id;
  const bodyContent = body ?? children;
  const headerLabelsSurface = showHeader && !renderHeader && standardHeaderHasContent(header, headerText);
  const context: CgPopupRenderContext = {
    close: async () => { await requestClose('programmatic'); },
    focus,
    boundaryId: stack.id,
  };

  return (
    <>
      <span ref={markerRef} hidden data-cg-overlay-origin="" />
      <CgPortal>
        <div
          ref={portalRef}
          className={styles.portal}
          style={{ zIndex: zIndex ?? `calc(var(--cg-z-modal) + ${stack.order * 2})` }}
          hidden={!lifecycle.open}
          inert={!lifecycle.open}
          data-shading={shading}
          data-adaptive={adaptive}
          data-cg-overlay-portal=""
          data-cg-overlay-id={stack.id}
          data-cg-overlay-owner={stack.ownerId}
        >
          <div className={styles.backdrop} aria-hidden="true" data-cg-popup-backdrop="" />
          <div
            {...nativeProps}
            ref={mergedRef}
            id={resolvedId}
            className={cx(overlaySurfaceStyles.surface, styles.surface, className)}
            style={surfaceStyle(style, width, height, minWidth, maxWidth, minHeight, maxHeight)}
            role={role}
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy ?? (!ariaLabel && headerLabelsSurface ? `${resolvedId}-header` : undefined)}
            tabIndex={-1}
            data-size={size}
            data-cg-overlay-surface="popup"
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
