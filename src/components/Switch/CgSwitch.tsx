import { forwardRef, useRef } from 'react';
import type { MouseEvent } from 'react';
import { useControllableState, useFormReset, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { cx } from '../../utils';
import choiceStyles from '../Choice.module.css';
import styles from './CgSwitch.module.css';
import type { CgSwitchProps } from './CgSwitch.types';

export const CgSwitch = forwardRef<HTMLInputElement, CgSwitchProps>(function CgSwitch(
  { checked, defaultChecked = false, onCheckedChange, onChange, label, description, labelPosition = 'end', size = 'medium', readOnly, validationState = 'none', id, required, disabled, className, style, 'data-testid': testId, onClick, 'aria-describedby': ariaDescribedBy, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...nativeProps },
  forwardedRef,
) {
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const [state, setState] = useControllableState(checked, defaultChecked, 'CgSwitch');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const descriptionId = description ? `${field.id}-description` : undefined;
  const describedBy = [field.describedBy, descriptionId].filter(Boolean).join(' ') || undefined;
  useFormReset(inputRef, () => {
    if (checked !== undefined) {
      if (inputRef.current) inputRef.current.checked = state;
      return;
    }
    setState(defaultChecked);
    onCheckedChange?.(defaultChecked);
  });
  return (
    <label className={cx(choiceStyles.root, choiceStyles[field.validationState], className)} style={style} data-position={labelPosition} data-size={size} data-disabled={field.disabled || undefined} data-readonly={field.readOnly || undefined} data-testid={testId}>
      <span className={styles.track} aria-hidden="true"><span className={styles.thumb} data-checked={state || undefined} /></span>
      <input
        {...nativeProps}
        ref={ref}
        id={field.id}
        className={styles.input}
        type="checkbox"
        role="switch"
        checked={state}
        disabled={field.disabled}
        required={field.required}
        aria-readonly={field.readOnly || undefined}
        aria-label={field.ariaLabel}
        aria-labelledby={field.labelledBy}
        aria-invalid={field.validationState === 'error' || undefined}
        aria-describedby={describedBy}
        aria-errormessage={field.errorMessageId}
        onClick={(event: MouseEvent<HTMLInputElement>) => { if (field.readOnly) { event.preventDefault(); queueMicrotask(() => { if (inputRef.current) inputRef.current.checked = state; }); } onClick?.(event); }}
        onChange={(event) => { onChange?.(event); if (!field.readOnly) { setState(event.target.checked); onCheckedChange?.(event.target.checked, event); } else event.currentTarget.checked = state; }}
      />
      {(label || description) ? <span className={choiceStyles.content}>{label ? <span>{label}</span> : null}{description ? <span id={descriptionId} className={choiceStyles.description}>{description}</span> : null}</span> : null}
    </label>
  );
});
