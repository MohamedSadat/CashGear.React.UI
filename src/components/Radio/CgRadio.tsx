import { forwardRef, useRef } from 'react';
import type { MouseEvent } from 'react';
import { useFormReset, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { cx } from '../../utils';
import choiceStyles from '../Choice.module.css';
import type { CgRadioProps } from './CgRadio.types';

function CgRadioInner<TValue extends string | number>(
  { value, checked, defaultChecked = false, onCheckedChange, onChange, label, description, labelPosition = 'end', size = 'medium', readOnly, validationState = 'none', id, required, disabled, className, style, 'data-testid': testId, onClick, 'aria-describedby': ariaDescribedBy, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...nativeProps }: CgRadioProps<TValue>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const descriptionId = description ? `${field.id}-description` : undefined;
  const describedBy = [field.describedBy, descriptionId].filter(Boolean).join(' ') || undefined;
  useFormReset(inputRef, () => {
    if (inputRef.current) inputRef.current.checked = checked ?? defaultChecked;
  });
  return (
    <label className={cx(choiceStyles.root, choiceStyles[field.validationState], className)} style={style} data-position={labelPosition} data-size={size} data-disabled={field.disabled || undefined} data-readonly={field.readOnly || undefined} data-testid={testId}>
      <input
        {...nativeProps}
        ref={ref}
        id={field.id}
        className={choiceStyles.input}
        type="radio"
        value={String(value)}
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        required={field.required}
        disabled={field.disabled}
        aria-readonly={field.readOnly || undefined}
        aria-label={field.ariaLabel}
        aria-labelledby={field.labelledBy}
        aria-invalid={field.validationState === 'error' || undefined}
        aria-describedby={describedBy}
        aria-errormessage={field.errorMessageId}
        onClick={(event: MouseEvent<HTMLInputElement>) => { if (field.readOnly) event.preventDefault(); onClick?.(event); }}
        onChange={(event) => {
          onChange?.(event);
          if (!field.readOnly && event.target.checked) onCheckedChange?.(value, event);
        }}
      />
      {(label || description) ? <span className={choiceStyles.content}>{label ? <span>{label}</span> : null}{description ? <span id={descriptionId} className={choiceStyles.description}>{description}</span> : null}</span> : null}
    </label>
  );
}

export const CgRadio = forwardRef(CgRadioInner) as <TValue extends string | number = string>(props: CgRadioProps<TValue> & React.RefAttributes<HTMLInputElement>) => React.ReactElement;
