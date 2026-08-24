import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useControllableState, useStableCallback } from '../../hooks';
import { CgPortal, useOverlayStack } from '../../internal';
import { cx } from '../../utils';
import styles from './CgLoadingPanel.module.css';
import type { CgLoadingPanelProps } from './CgLoadingPanel.types';

export const CgLoadingPanel = forwardRef<HTMLDivElement, CgLoadingPanelProps>(function CgLoadingPanel(
  { children, visible, defaultVisible = false, onVisibleChange, mode = 'inline', target, text = 'Loading…', indicator = 'spinner', customIndicator, shading = true, blocking = true, showContent = true, showDelay = 0, minimumVisibleDuration = 0, dismissOnClick = false, dismissOnEscape = false, className, style, 'data-testid': testId, ...nativeProps },
  ref,
) {
  const [requested, setRequested] = useControllableState(visible, defaultVisible, 'CgLoadingPanel');
  const [displayed, setDisplayed] = useState(requested && showDelay <= 0);
  const shownAtRef = useRef(requested ? Date.now() : 0);
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
  const stacked = useOverlayStack(displayed && mode !== 'inline', dismissOnEscape ? dismiss : undefined);

  useEffect(() => {
    if (!displayed || !blocking || mode !== 'portal' || typeof document === 'undefined') return undefined;
    const resolved = typeof target === 'string' ? document.querySelector(target) : target;
    if (!resolved) return undefined;
    const records = [...resolved.children]
      .filter((child) => !child.hasAttribute('data-cg-loading-overlay'))
      .map((child) => ({ child, inert: child.hasAttribute('inert') }));
    records.forEach(({ child }) => child.setAttribute('inert', ''));
    return () => records.forEach(({ child, inert }) => { if (!inert) child.removeAttribute('inert'); });
  }, [blocking, displayed, mode, target]);

  const visual: ReactNode = indicator === 'custom' ? customIndicator : (
    <span className={styles[indicator]} aria-hidden="true">
      {indicator === 'dots' ? <><i /><i /><i /></> : null}
    </span>
  );
  const panel = displayed ? (
    <div
      {...nativeProps}
      ref={ref}
      className={cx(styles.panel, mode === 'inline' && styles.inline, shading && mode !== 'inline' && styles.shading, className)}
      style={{ ...style, zIndex: mode === 'inline' ? undefined : `calc(var(--cg-z-overlay) + ${stacked.order})` }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-cg-loading-overlay=""
      data-testid={testId}
      onClick={(event) => { nativeProps.onClick?.(event); if (dismissOnClick && event.target === event.currentTarget) dismiss(); }}
    >
      <span className={styles.content}>{visual}{text ? <span>{text}</span> : null}</span>
    </div>
  ) : null;

  if (mode === 'inline') return <>{children}{panel}</>;
  if (mode === 'portal') return <>{showContent ? children : null}<CgPortal target={target}>{panel}</CgPortal></>;
  return (
    <div className={styles.wrapper} aria-busy={displayed || undefined}>
      <div className={cx(styles.wrappedContent, !showContent && displayed && styles.hidden)} inert={displayed && blocking ? true : undefined}>{children}</div>
      {panel}
    </div>
  );
});
