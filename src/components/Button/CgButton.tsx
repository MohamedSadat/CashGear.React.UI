import { forwardRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { renderIcon } from '../../internal';
import { cx } from '../../utils';
import styles from './CgButton.module.css';
import type { CgButtonProps } from './CgButton.types';

export const CgButton = forwardRef<HTMLButtonElement, CgButtonProps>(function CgButton(
  {
    children,
    intent = 'neutral',
    appearance = intent === 'link' ? 'link' : 'solid',
    size = 'medium',
    icon,
    iconPosition = 'start',
    loading = false,
    autoLoading = true,
    suppressDuplicateClicks = true,
    loadingContent,
    disabled = false,
    fullWidth = false,
    type = 'button',
    className,
    style,
    onClick,
    'data-testid': testId,
    ...nativeProps
  },
  ref,
) {
  const [automaticLoading, setAutomaticLoading] = useState(false);
  const busy = loading || automaticLoading;
  const blocked = disabled || (busy && suppressDuplicateClicks);
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) { event.preventDefault(); event.stopPropagation(); return; }
    const result = onClick?.(event);
    if (autoLoading && result instanceof Promise) {
      setAutomaticLoading(true);
      void result.finally(() => setAutomaticLoading(false)).catch(() => undefined);
    }
  };
  const content = busy && loadingContent !== undefined ? loadingContent : children;
  return (
    <button
      {...nativeProps}
      ref={ref}
      type={type}
      className={cx(styles.root, fullWidth && styles.fullWidth, className)}
      style={style}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-disabled={blocked || undefined}
      data-intent={intent}
      data-appearance={appearance}
      data-size={size}
      data-testid={testId}
      onClick={handleClick}
    >
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {!busy && icon && iconPosition === 'start' ? <span className={styles.icon}>{renderIcon(icon)}</span> : null}
      <span className={styles.label}>{content}</span>
      {!busy && icon && iconPosition === 'end' ? <span className={styles.icon}>{renderIcon(icon)}</span> : null}
    </button>
  );
});
