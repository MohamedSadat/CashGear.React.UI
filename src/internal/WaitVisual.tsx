import type { ReactNode } from 'react';
import { cx } from '../utils';
import styles from './WaitVisual.module.css';

export type WaitVisualAnimation = 'spinner' | 'dots' | 'pulse';

export function WaitVisual({ animation, className, variant = 'indicator' }: { animation: WaitVisualAnimation; className?: string; variant?: 'indicator' | 'panel' }): ReactNode {
  return <span className={cx(styles.visual, styles[animation], variant === 'panel' && styles.panel, className)} data-cg-wait-animation={animation} aria-hidden="true">
    {animation === 'dots' ? <><i /><i /><i /></> : null}
  </span>;
}
