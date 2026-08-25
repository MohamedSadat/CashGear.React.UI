import { useMemo } from 'react';
import { useCgId } from '../../hooks';
import { CgFieldContext } from '../../internal/field';
import { cx } from '../../utils';
import styles from './CgField.module.css';
import type { CgFieldProps } from './CgField.types';

export function CgField({
  children,
  label,
  description,
  required = false,
  disabled = false,
  readOnly = false,
  validationState = 'none',
  validationMessage,
  errorMessage,
  controlId,
  className,
  style,
  'data-testid': testId,
}: CgFieldProps) {
  const id = useCgId(controlId);
  const labelId = label ? `${id}-label` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;
  const message = errorMessage ?? validationMessage;
  const messageId = message ? `${id}-message` : undefined;
  const effectiveValidation = errorMessage ? 'error' : validationState;
  const context = useMemo(
    () => ({ controlId: id, labelId, descriptionId, messageId, required, disabled, readOnly, validationState: effectiveValidation }),
    [descriptionId, disabled, effectiveValidation, id, labelId, messageId, readOnly, required],
  );

  return (
    <div className={cx(styles.field, className)} style={style} data-validation={effectiveValidation} data-testid={testId}>
      {label ? (
        <label id={labelId} className={styles.label} htmlFor={id}>
          {label}
          {required ? <span className={styles.required} aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      {description ? <div id={descriptionId} className={styles.description}>{description}</div> : null}
      <CgFieldContext.Provider value={context}>{children}</CgFieldContext.Provider>
      {message ? (
        <div
          id={messageId}
          className={styles.message}
          role={effectiveValidation === 'error' ? 'alert' : 'status'}
          aria-live={effectiveValidation === 'error' ? 'assertive' : 'polite'}
        >
          {message}
        </div>
      ) : null}
    </div>
  );
}
