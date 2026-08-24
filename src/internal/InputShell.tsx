import { cx } from '../utils';
import styles from './InputShell.module.css';
import type { InputShellProps } from './InputShell.types';

export function InputShell({
  children,
  start,
  end,
  size = 'medium',
  validationState = 'none',
  disabled = false,
  readOnly = false,
  className,
  ...props
}: InputShellProps) {
  return (
    <div
      {...props}
      className={cx(styles.shell, className)}
      data-size={size}
      data-validation={validationState}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      {start ? <span className={styles.adornment}>{start}</span> : null}
      {children}
      {end ? <span className={styles.adornment}>{end}</span> : null}
    </div>
  );
}
