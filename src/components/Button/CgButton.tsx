import { forwardRef } from 'react';
import type { MouseEvent } from 'react';
import { cx } from '../../utils/cx';
import type { CgButtonProps } from './CgButton.types';
import styles from './CgButton.module.css';

/**
 * `CgButton` — the standard CashGear action control.
 *
 * Conventions demonstrated here apply to every component in this library:
 * - the underlying DOM element's props are spread last-but-one, so consumers
 *   keep full access to native attributes (`form`, `name`, `aria-*`, …);
 * - props the component guarantees (`className`, `disabled`, `type`) are
 *   applied after the spread so they cannot be silently overridden;
 * - the `ref` points at the real `<button>`, which is what callers need for
 *   focus management, popovers and form libraries.
 */
export const CgButton = forwardRef<HTMLButtonElement, CgButtonProps>(function CgButton(
  {
    children,
    variant = 'secondary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    iconBefore,
    iconAfter,
    type = 'button',
    className,
    style,
    onClick,
    'data-testid': dataTestId,
    ...nativeProps
  },
  ref,
) {
  const isInoperable = disabled || loading;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // `loading` does not set the `disabled` attribute (that would drop the
    // button out of the tab order mid-interaction and move focus), so clicks
    // must be suppressed explicitly.
    if (isInoperable) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...nativeProps}
      ref={ref}
      type={type}
      className={cx(
        styles.root,
        styles[size],
        styles[variant],
        fullWidth && styles.fullWidth,
        className,
      )}
      style={style}
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      data-testid={dataTestId}
      onClick={handleClick}
    >
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {!loading && iconBefore ? (
        <span className={styles.icon} aria-hidden="true">
          {iconBefore}
        </span>
      ) : null}
      <span className={styles.label}>{children}</span>
      {iconAfter ? (
        <span className={styles.icon} aria-hidden="true">
          {iconAfter}
        </span>
      ) : null}
    </button>
  );
});
