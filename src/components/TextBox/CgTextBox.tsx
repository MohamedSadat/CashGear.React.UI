import { forwardRef } from 'react';
import type { ChangeEvent } from 'react';
import { useCgId } from '../../hooks/useCgId';
import { useControllableState } from '../../hooks/useControllableState';
import { cx } from '../../utils/cx';
import type { CgTextBoxProps } from './CgTextBox.types';
import styles from './CgTextBox.module.css';

const VALIDATION_CLASS = {
  none: undefined,
  error: 'error',
  warning: 'warning',
  success: 'success',
} as const;

/**
 * `CgTextBox` — single-line text entry.
 *
 * Accessibility contract:
 * - the `<label>` is wired to the input through a generated (or supplied) id;
 * - `message` is announced through `aria-errormessage` when the field is in
 *   error and through `aria-describedby` otherwise;
 * - `aria-invalid` and `aria-required` mirror the props;
 * - the focus ring is drawn on the field wrapper so prefix/suffix affixes are
 *   visibly part of the focused control.
 *
 * The forwarded `ref` points at the `<input>` — the element callers need for
 * `focus()`, selection and form-library registration.
 */
export const CgTextBox = forwardRef<HTMLInputElement, CgTextBoxProps>(function CgTextBox(
  {
    label,
    value,
    defaultValue = '',
    onValueChange,
    onChange,
    size = 'md',
    validationState = 'none',
    message,
    required = false,
    disabled = false,
    readOnly = false,
    fullWidth = false,
    prefix,
    suffix,
    type = 'text',
    id,
    className,
    style,
    'data-testid': dataTestId,
    ...nativeProps
  },
  ref,
) {
  const inputId = useCgId(id);
  const messageId = `${inputId}-message`;
  const hasError = validationState === 'error';
  const hasMessage = message !== undefined && message !== null && message !== false;

  const [currentValue, setCurrentValue] = useControllableState(value, defaultValue);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCurrentValue(event.target.value);
    onChange?.(event);
    onValueChange?.(event.target.value, event);
  };

  const describedBy = hasMessage && !hasError ? messageId : undefined;
  const errorMessageId = hasMessage && hasError ? messageId : undefined;

  return (
    <div
      className={cx(
        styles.root,
        styles[size],
        VALIDATION_CLASS[validationState] && styles[VALIDATION_CLASS[validationState]],
        disabled && styles.disabled,
        readOnly && styles.readOnly,
        fullWidth && styles.fullWidth,
        className,
      )}
      style={style}
      data-testid={dataTestId}
    >
      {label !== undefined ? (
        <span className={styles.labelRow}>
          {/* The required marker sits outside <label> on purpose: keeping it out
              of the label's text content means `getByLabelText('Code')` and the
              accessible name both stay exactly the label the consumer passed. */}
          <label className={styles.label} htmlFor={inputId}>
            {label}
          </label>
          {required ? (
            <span className={styles.required} aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
      ) : null}

      <div className={styles.field}>
        {prefix ? (
          <span className={styles.affix} aria-hidden="true">
            {prefix}
          </span>
        ) : null}

        <input
          {...nativeProps}
          ref={ref}
          id={inputId}
          type={type}
          className={styles.input}
          value={currentValue}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-invalid={hasError || undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy}
          aria-errormessage={errorMessageId}
          onChange={handleChange}
        />

        {suffix ? (
          <span className={styles.affix} aria-hidden="true">
            {suffix}
          </span>
        ) : null}
      </div>

      {hasMessage ? (
        <span
          id={messageId}
          className={styles.message}
          role={hasError ? 'alert' : undefined}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
});
