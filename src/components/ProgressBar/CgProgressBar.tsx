import { forwardRef } from 'react';
import { cx } from '../../utils';
import styles from './CgProgressBar.module.css';
import type { CgProgressBarProps } from './CgProgressBar.types';

export const CgProgressBar = forwardRef<HTMLDivElement, CgProgressBarProps>(function CgProgressBar(
  { value, min = 0, max = 100, label, showLabel = false, labelFormatter, intent = 'primary', size = 'medium', className, style, 'data-testid': testId, ...nativeProps },
  ref,
) {
  const range = max > min ? max - min : 1;
  const clamped = value === undefined ? undefined : Math.min(max, Math.max(min, value));
  const percent = clamped === undefined ? undefined : ((clamped - min) / range) * 100;
  const displayLabel = label ?? (labelFormatter ? labelFormatter(value, { min, max, percent }) : showLabel ? (percent === undefined ? 'Loading…' : `${Math.round(percent)}%`) : null);
  return (
    <div className={styles.container}>
      <div {...nativeProps} ref={ref} className={cx(styles.track, value === undefined && styles.indeterminate, className)} style={style} role="progressbar" aria-valuemin={min} aria-valuemax={max} aria-valuenow={clamped} aria-valuetext={typeof displayLabel === 'string' ? displayLabel : undefined} data-intent={intent} data-size={size} data-testid={testId}>
        <span className={styles.fill} style={percent === undefined ? undefined : { inlineSize: `${percent}%` }} />
      </div>
      {displayLabel ? <span className={styles.label}>{displayLabel}</span> : null}
    </div>
  );
});
