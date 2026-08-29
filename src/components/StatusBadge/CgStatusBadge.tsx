import { forwardRef, useReducer, useRef } from 'react';
import { renderIcon as renderCgIcon } from '../../internal/icons';
import { cx } from '../../utils';
import styles from './CgStatusBadge.module.css';
import type { CgStatusBadgeDismissDetails, CgStatusBadgeProps } from './CgStatusBadge.types';

export const CgStatusBadge = forwardRef<HTMLSpanElement, CgStatusBadgeProps>(function CgStatusBadge({
  text,
  children,
  type = 'neutral',
  appearance = 'soft',
  size = 'medium',
  shape = 'rounded',
  icon,
  renderIcon,
  indicator = false,
  dismissible = false,
  onDismiss,
  dismissAriaLabel = 'Dismiss status',
  visible = true,
  role,
  accessibleLabel,
  className,
  ...nativeProps
}, forwardedRef) {
  if (!dismissAriaLabel.trim()) throw new Error('CgStatusBadge dismissAriaLabel cannot be empty.');
  if (accessibleLabel !== undefined && !accessibleLabel.trim()) throw new Error('CgStatusBadge accessibleLabel cannot be empty.');
  const [, render] = useReducer((value: number) => value + 1, 0);
  const dismissedRef = useRef(false);
  const dismissalStartedRef = useRef(false);
  const previousVisibleRef = useRef(visible);
  if (!previousVisibleRef.current && visible) {
    dismissedRef.current = false;
    dismissalStartedRef.current = false;
  }
  previousVisibleRef.current = visible;
  if (!visible || dismissedRef.current) return null;

  const dismiss = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (dismissalStartedRef.current) return;
    dismissalStartedRef.current = true;
    dismissedRef.current = true;
    const details = Object.freeze<CgStatusBadgeDismissDetails>({ reason: 'dismissButton', event });
    render();
    queueMicrotask(() => {
      try {
        Promise.resolve(onDismiss?.(details)).catch((error: unknown) => {
          console.error('CgStatusBadge onDismiss rejected.', error);
        });
      } catch (error) {
        console.error('CgStatusBadge onDismiss failed.', error);
      }
    });
  };
  const iconContent = renderIcon ? renderIcon() : renderCgIcon(icon);

  return <span
    {...nativeProps}
    ref={forwardedRef}
    role={role}
    aria-label={accessibleLabel}
    className={cx(styles.root, styles[type], styles[appearance], styles[size], styles[shape], className)}
    data-cg-status-badge=""
    data-type={type}
    data-appearance={appearance}
    data-size={size}
    data-shape={shape}
  >
    {indicator ? <span className={styles.indicator} aria-hidden="true" /> : null}
    {iconContent ? <span className={styles.icon} aria-hidden="true">{iconContent}</span> : null}
    <span className={styles.content}>{children ?? text}</span>
    {dismissible ? <button type="button" className={styles.dismiss} aria-label={dismissAriaLabel} onClick={dismiss}>×</button> : null}
  </span>;
});
