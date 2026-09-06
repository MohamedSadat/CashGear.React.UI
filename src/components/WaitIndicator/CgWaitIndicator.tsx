import { forwardRef } from 'react';
import { WaitVisual } from '../../internal/WaitVisual';
import { cx } from '../../utils';
import type { CgWaitIndicatorProps } from './CgWaitIndicator.types';
import styles from './CgWaitIndicator.module.css';

export const CgWaitIndicator = forwardRef<HTMLSpanElement, CgWaitIndicatorProps>(function CgWaitIndicator(
  { visible = true, animation = 'spinner', size = 'medium', decorative = false, ariaLabel = 'Loading', children, className, style, ...nativeProps },
  ref,
) {
  if (!['spinner', 'dots', 'pulse'].includes(animation)) throw new RangeError('CgWaitIndicator animation is invalid.');
  if (!['small', 'medium', 'large'].includes(size)) throw new RangeError('CgWaitIndicator size is invalid.');
  if (!visible) return null;
  return <span
    {...nativeProps}
    ref={ref}
    className={cx(styles.root, styles[size], className)}
    style={style}
    role={decorative ? undefined : 'status'}
    aria-live={decorative ? undefined : 'polite'}
    aria-label={decorative ? undefined : ariaLabel}
    aria-hidden={decorative || undefined}
    data-cg-wait-indicator=""
  >{children ?? <WaitVisual animation={animation} />}</span>;
});
