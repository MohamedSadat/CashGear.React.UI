import type { CSSProperties, ReactNode } from 'react';
import { CgIcon } from '../Icon';
import styles from './CgOptionPicker.module.css';

export function PickerChip({ label, content, style, removeLabel, onRemove }: {
  label: string;
  content?: ReactNode;
  style?: CSSProperties;
  removeLabel?: string;
  onRemove?: () => void;
}) {
  return <span className={styles.chip} style={style} data-cg-picker-chip="">
    {content ?? <span className={styles.chipText} dir="auto">{label}</span>}
    {onRemove ? <button
      type="button"
      className={styles.chipRemove}
      aria-label={removeLabel}
      title={removeLabel}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onRemove}
    ><CgIcon name="close" size="0.75em" /></button> : null}
  </span>;
}

export function Check({ on }: { on: boolean }) {
  return <span className={styles.check} aria-hidden="true">{on ? <CgIcon name="check" /> : null}</span>;
}

/** The next option of a list walked by arrows, wrapping. */
export function stepIndex(current: number, step: number, total: number): number {
  return total ? (current + step + total) % total : 0;
}
