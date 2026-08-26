import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useControllableState, useMergedRefs, useStableCallback } from '../../hooks';
import { CgPortal, useOverlayStack, useResolvedTarget, useTargetCoverStyle } from '../../internal';
import { acquireInert } from '../../internal/inert';
import { assertNonNegative } from '../../internal/validation';
import { cx } from '../../utils';
import styles from './CgLoadingPanel.module.css';
import type { CgLoadingPanelProps } from './CgLoadingPanel.types';

export const CgLoadingPanel = forwardRef<HTMLDivElement, CgLoadingPanelProps>(function CgLoadingPanel(
  { children, visible, defaultVisible = false, onVisibleChange, mode = 'inline', target, text = 'Loading…', indicator = 'spinner', customIndicator, shading = true, blocking = true, showContent = true, showDelay = 0, minimumVisibleDuration = 0, dismissOnClick = false, dismissOnEscape = false, trapFocus = false, className, style, 'data-testid': testId, ...nativeProps },
  ref,
) {
  assertNonNegative('showDelay', showDelay);
  assertNonNegative('minimumVisibleDuration', minimumVisibleDuration);
  if (trapFocus && (!blocking || mode === 'inline')) {
    throw new Error('trapFocus requires a blocking overlay or portal loading panel.');
  }
  const [requested, setRequested] = useControllableState(visible, defaultVisible, 'CgLoadingPanel');
  const [displayed, setDisplayed] = useState(requested && showDelay <= 0);
  const shownAtRef = useRef(requested ? Date.now() : 0);
  const panelRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(panelRef, ref);
  const resolvedTarget = useResolvedTarget(target);
  const coverStyle = useTargetCoverStyle(resolvedTarget, displayed && mode === 'portal');
  const dismiss = useStableCallback(() => { setRequested(false); onVisibleChange?.(false); });
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (requested) {
      if (displayed) return undefined;
      timer = setTimeout(() => { shownAtRef.current = Date.now(); setDisplayed(true); }, Math.max(0, showDelay));
    } else if (displayed) {
      const remaining = Math.max(0, minimumVisibleDuration - (Date.now() - shownAtRef.current));
      timer = setTimeout(() => setDisplayed(false), remaining);
    }
    return () => { if (timer !== undefined) clearTimeout(timer); };
  }, [displayed, minimumVisibleDuration, requested, showDelay]);
  const stacked = useOverlayStack(displayed && mode !== 'inline', dismissOnEscape ? dismiss : undefined, panelRef);

  useEffect(() => {
    if (!displayed || !blocking || mode !== 'portal' || typeof document === 'undefined') return undefined;
    const resolved = resolvedTarget ?? document.body;
    const releases = [...resolved.children]
      .filter((child) => !child.hasAttribute('data-cg-loading-overlay'))
      .map((child) => acquireInert(child));
    return () => releases.forEach((release) => release());
  }, [blocking, displayed, mode, resolvedTarget]);

  useEffect(() => {
    if (!displayed || !trapFocus || mode === 'inline') return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () => [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    (getFocusable()[0] ?? panel).focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) {
        (getFocusable()[0] ?? panel).focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('focusin', onFocusIn, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('focusin', onFocusIn, true);
      queueMicrotask(() => { if (origin?.isConnected) origin.focus({ preventScroll: true }); });
    };
  }, [displayed, mode, trapFocus]);

  const visual: ReactNode = indicator === 'custom' ? customIndicator : (
    <span className={styles[indicator]} aria-hidden="true">
      {indicator === 'dots' ? <><i /><i /><i /></> : null}
    </span>
  );
  const panel = displayed ? (
    <div
      {...nativeProps}
      ref={mergedRef}
      className={cx(styles.panel, mode === 'inline' && styles.inline, shading && mode !== 'inline' && styles.shading, className)}
      style={{ ...style, ...(mode === 'portal' ? coverStyle : null), zIndex: mode === 'inline' ? undefined : stacked.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${stacked.order * 2 + 1})` : `calc(var(--cg-z-overlay) + ${stacked.order})` }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-blocking={blocking}
      data-cg-overlay-id={stacked.id}
      data-cg-overlay-owner={stacked.ownerId}
      data-cg-loading-overlay=""
      data-testid={testId}
      tabIndex={trapFocus ? -1 : nativeProps.tabIndex}
      onClick={(event) => { nativeProps.onClick?.(event); if (dismissOnClick && event.target === event.currentTarget) dismiss(); }}
    >
      <span className={styles.content}>{visual}{text ? <span>{text}</span> : null}</span>
    </div>
  ) : null;

  if (mode === 'inline') return <>{showContent || !displayed ? children : null}{panel}</>;
  if (mode === 'portal') return <>{showContent || !displayed ? children : null}<CgPortal>{panel}</CgPortal></>;
  return (
    <div className={styles.wrapper} aria-busy={displayed || undefined}>
      <div className={cx(styles.wrappedContent, !showContent && displayed && styles.hidden)} inert={displayed && blocking ? true : undefined}>{children}</div>
      {panel}
    </div>
  );
});
