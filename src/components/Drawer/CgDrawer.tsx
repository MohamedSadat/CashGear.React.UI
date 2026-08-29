import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, SyntheticEvent } from 'react';
import { useControllableState, useMergedRefs, useStableCallback } from '../../hooks';
import {
  focusOverlayInitial,
  isTopmostOverlay,
  OverlayOwnerProvider,
  useBodyScrollLock,
  useFocusOrigin,
  useModalFocusTrap,
  useModalIsolation,
  useOverlaySurface,
} from '../../internal';
import { cx } from '../../utils';
import styles from './CgDrawer.module.css';
import type {
  CgDrawerActions,
  CgDrawerBeforeCloseDetails,
  CgDrawerBeforeOpenDetails,
  CgDrawerClosedDetails,
  CgDrawerCloseReason,
  CgDrawerLifecyclePhase,
  CgDrawerOpenedDetails,
  CgDrawerOpenReason,
  CgDrawerProps,
  CgDrawerRenderContext,
} from './CgDrawer.types';
import { parseDrawerLength, transitionMilliseconds } from './drawerState';

type DrawerStyle = CSSProperties & Record<`--cg-${string}`, string | number>;
type DrawerDetails = CgDrawerOpenedDetails | CgDrawerClosedDetails;

interface PendingProposal {
  readonly target: boolean;
  readonly details: DrawerDetails;
  readonly generation: number;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function';
}

function freezeDetails<T extends object>(details: T): T {
  return Object.freeze({ ...details });
}

export const CgDrawer = forwardRef<HTMLDivElement, CgDrawerProps>(function CgDrawer(
  {
    open,
    defaultOpen = false,
    onOpenChange,
    onBeforeOpen,
    onBeforeClose,
    onOpened,
    onClosed,
    onLifecycleError,
    mode = 'shrink',
    position = 'start',
    openSize = '20rem',
    miniModeEnabled = false,
    miniSize = '4rem',
    responsiveOverlay = true,
    responsiveBreakpoint = 768,
    applyBackgroundShading = true,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    lockBodyScroll = true,
    trapFocus = true,
    restoreFocus = true,
    disabled = false,
    visible = true,
    renderDrawer,
    renderMiniDrawer,
    renderHeader,
    renderFooter,
    renderApplicationContent,
    role,
    panelId,
    panelClassName,
    panelStyle,
    panelAttributes,
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
  if (mode !== 'shrink' && mode !== 'overlay') throw new Error(`CgDrawer mode '${String(mode)}' is not supported.`);
  if (position !== 'start' && position !== 'end') throw new Error(`CgDrawer position '${String(position)}' is not supported.`);
  if (!Number.isFinite(responsiveBreakpoint) || responsiveBreakpoint <= 0) {
    throw new Error('CgDrawer responsiveBreakpoint must be greater than zero.');
  }
  const parsedOpenSize = parseDrawerLength(openSize, 'openSize', '20rem');
  const parsedMiniSize = parseDrawerLength(miniSize, 'miniSize', '4rem');
  if (parsedOpenSize.value <= 0) throw new Error('CgDrawer openSize must be greater than zero.');
  if (parsedOpenSize.unit === parsedMiniSize.unit && parsedMiniSize.value > parsedOpenSize.value) {
    throw new Error('CgDrawer miniSize cannot exceed openSize when units match.');
  }
  if (panelId !== undefined && !panelId.trim()) throw new Error('CgDrawer panelId cannot be empty.');
  if (!ariaLabelledBy && (ariaLabel === '' || (typeof ariaLabel === 'string' && !ariaLabel.trim()))) {
    throw new Error('CgDrawer requires a nonempty aria-label or aria-labelledby.');
  }

  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRootRef = useMergedRefs(rootRef, forwardedRef);
  const panelRef = useRef<HTMLElement>(null);
  const applicationRef = useRef<HTMLElement>(null);
  const [actualOpen, setActualOpen] = useControllableState(open, defaultOpen, 'CgDrawer open');
  const [responsiveActive, setResponsiveActive] = useState(false);
  const openRef = useRef(actualOpen);
  const visibleRef = useRef(visible);
  const disabledRef = useRef(disabled);
  const controlledRef = useRef(open !== undefined);
  const mountedRef = useRef(true);
  const lifecycleGenerationRef = useRef(0);
  const lifecycleControllerRef = useRef<AbortController | undefined>(undefined);
  const lifecycleTargetRef = useRef<boolean | undefined>(undefined);
  const pendingProposalRef = useRef<PendingProposal | undefined>(undefined);
  const previousRenderedOpenRef = useRef(actualOpen);
  const visualGenerationRef = useRef(0);
  const visualCleanupRef = useRef<(() => void) | undefined>(undefined);
  const openedAsOverlayRef = useRef(false);
  openRef.current = actualOpen;
  visibleRef.current = visible;
  disabledRef.current = disabled;
  controlledRef.current = open !== undefined;

  const effectiveMode = mode === 'overlay' || responsiveOverlay && responsiveActive ? 'overlay' : 'shrink';
  const overlayActive = visible && actualOpen && effectiveMode === 'overlay';
  const modalActive = overlayActive && trapFocus;
  const miniActive = visible && !actualOpen && miniModeEnabled;

  const notifyOpenChange = useStableCallback(onOpenChange);
  const beforeOpen = useStableCallback(onBeforeOpen);
  const beforeClose = useStableCallback(onBeforeClose);
  const notifyOpened = useStableCallback(onOpened);
  const notifyClosed = useStableCallback(onClosed);
  const reportLifecycleError = useStableCallback((error: unknown, phase: CgDrawerLifecyclePhase) => {
    try { onLifecycleError?.(error, phase); } catch { /* Error reporting is terminal. */ }
  });

  useEffect(() => {
    if (!responsiveOverlay || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setResponsiveActive(false);
      return undefined;
    }
    const maximum = Math.max(0, responsiveBreakpoint - 0.02);
    const media = window.matchMedia(`(max-width: ${maximum}px)`);
    let current = true;
    const update = (matches: boolean) => { if (current) setResponsiveActive(matches); };
    const onChange = (event: MediaQueryListEvent) => update(event.matches);
    update(media.matches);
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    else media.addListener(onChange);
    return () => {
      current = false;
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange);
      else media.removeListener(onChange);
    };
  }, [responsiveBreakpoint, responsiveOverlay]);

  const beginLifecycle = useStableCallback(() => {
    lifecycleControllerRef.current?.abort();
    const controller = new AbortController();
    lifecycleControllerRef.current = controller;
    return { controller, generation: ++lifecycleGenerationRef.current };
  });
  const isCurrentLifecycle = useStableCallback((operation: { controller: AbortController; generation: number }) => (
    mountedRef.current
    && !operation.controller.signal.aborted
    && lifecycleGenerationRef.current === operation.generation
  ));

  const requestOpenState = useStableCallback(async (
    target: boolean,
    openReason: CgDrawerOpenReason,
    closeReason: CgDrawerCloseReason,
    event?: Event | SyntheticEvent,
  ): Promise<boolean> => {
    if (!mountedRef.current || disabledRef.current || !visibleRef.current) return false;
    if (openRef.current === target) {
      if (lifecycleTargetRef.current !== undefined && lifecycleTargetRef.current !== target) {
        lifecycleControllerRef.current?.abort();
        lifecycleGenerationRef.current += 1;
        lifecycleTargetRef.current = undefined;
      }
      return true;
    }
    const operation = beginLifecycle();
    lifecycleTargetRef.current = target;
    const details = target
      ? freezeDetails<CgDrawerOpenedDetails>({ reason: openReason, ...(event ? { event } : {}) })
      : freezeDetails<CgDrawerClosedDetails>({ reason: closeReason, ...(event ? { event } : {}) });
    try {
      const result = target
        ? beforeOpen(freezeDetails<CgDrawerBeforeOpenDetails>({
          reason: openReason,
          ...(event ? { event } : {}),
          signal: operation.controller.signal,
        }))
        : beforeClose(freezeDetails<CgDrawerBeforeCloseDetails>({
          reason: closeReason,
          ...(event ? { event } : {}),
          signal: operation.controller.signal,
        }));
      const accepted = isPromiseLike(result) ? await result : result;
      if (!isCurrentLifecycle(operation) || accepted === false) {
        if (lifecycleGenerationRef.current === operation.generation) lifecycleTargetRef.current = undefined;
        return false;
      }
    } catch (error) {
      if (isCurrentLifecycle(operation)) reportLifecycleError(error, target ? 'beforeOpen' : 'beforeClose');
      if (lifecycleGenerationRef.current === operation.generation) lifecycleTargetRef.current = undefined;
      return false;
    }
    lifecycleTargetRef.current = undefined;
    pendingProposalRef.current = { target, details, generation: operation.generation };
    if (!controlledRef.current) {
      openRef.current = target;
      setActualOpen(target);
    }
    notifyOpenChange(target, details);
    if (controlledRef.current) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      if (!isCurrentLifecycle(operation) || openRef.current !== target) {
        if (pendingProposalRef.current?.generation === operation.generation) pendingProposalRef.current = undefined;
        return false;
      }
    }
    return true;
  });

  const requestOpen = useStableCallback((event?: Event | SyntheticEvent) => requestOpenState(true, 'programmatic', 'programmatic', event));
  const requestClose = useStableCallback((reason: CgDrawerCloseReason = 'programmatic', event?: Event | SyntheticEvent) => (
    requestOpenState(false, 'programmatic', reason, event)
  ));
  const requestToggle = useStableCallback((event?: Event | SyntheticEvent) => openRef.current
    ? requestOpenState(false, 'toggle', 'toggle', event)
    : requestOpenState(true, 'toggle', 'toggle', event));

  const stack = useOverlaySurface({
    active: overlayActive,
    kind: modalActive ? 'modal' : 'transient',
    elementRef: panelRef,
    ...(closeOnEscape ? { onEscape: (event: KeyboardEvent) => { void requestClose('escape', event); } } : {}),
    ...(closeOnOutsideClick ? { onOutside: (event: PointerEvent) => requestClose('outsideInteraction', event) } : {}),
  });
  const focusOriginRef = useFocusOrigin(overlayActive);
  useModalFocusTrap(modalActive, stack.id, panelRef);
  useModalIsolation(modalActive, stack.id, rootRef, false, stack.order);
  useBodyScrollLock(overlayActive && lockBodyScroll);

  const restoreCapturedFocus = useStableCallback(() => {
    if (!openedAsOverlayRef.current) return;
    openedAsOverlayRef.current = false;
    const origin = focusOriginRef.current;
    if (restoreFocus && origin?.isConnected) origin.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (overlayActive) openedAsOverlayRef.current = true;
  }, [overlayActive]);

  const cancelVisualTransition = useStableCallback(() => {
    visualGenerationRef.current += 1;
    visualCleanupRef.current?.();
    visualCleanupRef.current = undefined;
  });
  const startVisualTransition = useStableCallback((target: boolean, details: DrawerDetails) => {
    cancelVisualTransition();
    if (!visibleRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    const generation = ++visualGenerationRef.current;
    let finished = false;
    let timer = 0;
    const cleanup = () => {
      if (timer) window.clearTimeout(timer);
      panel.removeEventListener('transitionend', onTransitionEnd);
      if (visualCleanupRef.current === cleanup) visualCleanupRef.current = undefined;
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup();
      if (!mountedRef.current || generation !== visualGenerationRef.current || openRef.current !== target || !visibleRef.current) return;
      if (!target) restoreCapturedFocus();
      try {
        const result = target
          ? notifyOpened(details as CgDrawerOpenedDetails)
          : notifyClosed(details);
        if (isPromiseLike(result)) {
          void Promise.resolve(result).catch((error: unknown) => reportLifecycleError(error, target ? 'opened' : 'closed'));
        }
      } catch (error) {
        reportLifecycleError(error, target ? 'opened' : 'closed');
      }
    };
    function onTransitionEnd(event: TransitionEvent) {
      if (event.target === panel) finish();
    }
    panel.addEventListener('transitionend', onTransitionEnd);
    timer = window.setTimeout(finish, transitionMilliseconds(panel) + 50);
    visualCleanupRef.current = cleanup;
  });

  useEffect(() => {
    if (actualOpen === previousRenderedOpenRef.current) return;
    previousRenderedOpenRef.current = actualOpen;
    const pending = pendingProposalRef.current;
    let details: DrawerDetails;
    if (pending?.target === actualOpen && pending.generation === lifecycleGenerationRef.current) {
      details = pending.details;
    } else {
      lifecycleControllerRef.current?.abort();
      lifecycleGenerationRef.current += 1;
      details = actualOpen
        ? freezeDetails<CgDrawerOpenedDetails>({ reason: 'programmatic' })
        : freezeDetails<CgDrawerClosedDetails>({ reason: 'programmatic' });
    }
    pendingProposalRef.current = undefined;
    startVisualTransition(actualOpen, details);
  }, [actualOpen, startVisualTransition]);

  useEffect(() => {
    if (visible) return;
    lifecycleControllerRef.current?.abort();
    lifecycleGenerationRef.current += 1;
    lifecycleTargetRef.current = undefined;
    pendingProposalRef.current = undefined;
    cancelVisualTransition();
    restoreCapturedFocus();
  }, [cancelVisualTransition, restoreCapturedFocus, visible]);

  const previousEffectiveModeRef = useRef(effectiveMode);
  useEffect(() => {
    if (effectiveMode === previousEffectiveModeRef.current) return;
    previousEffectiveModeRef.current = effectiveMode;
    cancelVisualTransition();
  }, [cancelVisualTransition, effectiveMode]);

  const focusApplication = useStableCallback(() => {
    if (!visibleRef.current) return;
    focusOverlayInitial(applicationRef.current);
  });
  const focusDrawer = useStableCallback(() => {
    if (!visibleRef.current || (!openRef.current && !miniModeEnabled)) return;
    stack.raise();
    focusOverlayInitial(panelRef.current);
  });
  const actions = useMemo<CgDrawerActions>(() => Object.freeze({
    focus: focusApplication,
    focusDrawer,
    open: () => requestOpen(),
    close: () => requestClose(),
    toggle: () => requestToggle(),
    getState: () => openRef.current,
  }), [focusApplication, focusDrawer, requestClose, requestOpen, requestToggle]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  useLayoutEffect(() => {
    if (!modalActive || !isTopmostOverlay(stack.id)) return;
    const focused = document.activeElement;
    if (!(focused instanceof Node) || !panelRef.current?.contains(focused)) focusOverlayInitial(panelRef.current);
  }, [modalActive, stack.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleControllerRef.current?.abort();
      lifecycleTargetRef.current = undefined;
      lifecycleGenerationRef.current += 1;
      cancelVisualTransition();
    };
  }, [cancelVisualTransition]);

  const resolvedPanelId = panelId?.trim() || (id ? `${id}-panel` : `${stack.id}-panel`);
  const context = Object.freeze<CgDrawerRenderContext>({
    open: actualOpen,
    mode,
    effectiveMode,
    position,
    mini: miniActive,
    visible,
    disabled,
    boundaryId: stack.id,
    actions,
  });
  const rootStyle = {
    ...style,
    '--cg-drawer-size': parsedOpenSize.css,
    '--cg-drawer-mini-size': parsedMiniSize.css,
    '--cg-drawer-stack-order': stack.order,
  } as DrawerStyle;
  const mergedPanelStyle = { ...panelStyle };
  const resolvedRole = role ?? (modalActive ? 'dialog' : 'complementary');

  return (
    <div
      {...nativeProps}
      ref={mergedRootRef}
      id={id}
      className={cx(styles.root, className)}
      style={rootStyle}
      hidden={!visible}
      inert={!visible}
      data-cg-drawer=""
      data-cg-overlay-id={overlayActive ? stack.id : undefined}
      data-cg-open={actualOpen ? 'true' : 'false'}
      data-cg-mode={effectiveMode}
      data-cg-position={position}
      data-cg-mini={miniActive ? 'true' : 'false'}
      data-cg-shading={applyBackgroundShading ? 'true' : 'false'}
      data-cg-disabled={disabled ? 'true' : 'false'}
    >
      <div className={styles.backdrop} data-cg-drawer-backdrop="" aria-hidden="true" />
      <aside
        {...panelAttributes}
        ref={panelRef}
        id={resolvedPanelId}
        className={cx(styles.panel, panelClassName)}
        style={mergedPanelStyle}
        role={resolvedRole}
        aria-label={ariaLabelledBy ? ariaLabel : ariaLabel ?? 'Drawer'}
        aria-labelledby={ariaLabelledBy}
        aria-modal={modalActive ? 'true' : undefined}
        aria-hidden={!actualOpen && !miniActive}
        tabIndex={-1}
        data-cg-drawer-panel=""
      >
        <OverlayOwnerProvider id={stack.id}>
          <div className={styles.full} aria-hidden={!actualOpen} inert={!actualOpen}>
            <header className={styles.header} hidden={!renderHeader}>{renderHeader?.(context)}</header>
            <div className={styles.body} data-cg-overlay-body="">{renderDrawer?.(context)}</div>
            <footer className={styles.footer} hidden={!renderFooter}>{renderFooter?.(context)}</footer>
          </div>
          <div className={styles.mini} aria-hidden={!miniActive} inert={!miniActive}>
            {renderMiniDrawer?.(context)}
          </div>
        </OverlayOwnerProvider>
      </aside>
      <main
        ref={applicationRef}
        className={styles.application}
        tabIndex={-1}
        inert={modalActive}
        data-cg-drawer-content=""
      >
        {renderApplicationContent?.(context)}
      </main>
    </div>
  );
});
