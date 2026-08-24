import { forwardRef, useEffect, useRef } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import { useControllableState, useFormReset, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { cx } from '../../utils';
import choiceStyles from '../Choice.module.css';
import type { CgCheckedState, CgCheckBoxProps } from './CgCheckBox.types';

const nextState = (current: CgCheckedState): CgCheckedState => current === 'indeterminate' ? true : current ? false : 'indeterminate';

export const CgCheckBox = forwardRef<HTMLInputElement, CgCheckBoxProps>(function CgCheckBox(
  { checked, defaultChecked = false, onCheckedChange, onChange, cycleIndeterminate = false, label, description, labelPosition = 'end', size = 'medium', readOnly, validationState = 'none', id, required, disabled, className, style, 'data-testid': testId, onClick, 'aria-describedby': ariaDescribedBy, ...nativeProps },
  forwardedRef,
) {
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const [state, setState] = useControllableState(checked, defaultChecked, 'CgCheckBox');
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const descriptionId = description ? `${field.id}-description` : undefined;
  const describedBy = [field.describedBy, descriptionId].filter(Boolean).join(' ') || undefined;
  useEffect(() => { if (inputRef.current) inputRef.current.indeterminate = state === 'indeterminate'; }, [state]);
  useFormReset(inputRef, () => { setState(defaultChecked); onCheckedChange?.(defaultChecked); });
  const set = (next: CgCheckedState, event?: ChangeEvent<HTMLInputElement>) => { setState(next); onCheckedChange?.(next, event); };
  return (
    <label className={cx(choiceStyles.root, choiceStyles[field.validationState], className)} style={style} data-position={labelPosition} data-size={size} data-disabled={field.disabled || undefined} data-readonly={field.readOnly || undefined} data-testid={testId}>
      <input
        {...nativeProps}
        ref={ref}
        id={field.id}
        className={choiceStyles.input}
        type="checkbox"
        checked={state === true}
        disabled={field.disabled}
        required={field.required}
        aria-checked={state === 'indeterminate' ? 'mixed' : state}
        aria-readonly={field.readOnly || undefined}
        aria-invalid={field.validationState === 'error' || undefined}
        aria-describedby={describedBy}
        aria-errormessage={field.errorMessageId}
        onClick={(event: MouseEvent<HTMLInputElement>) => {
          if (field.readOnly || cycleIndeterminate) {
            event.preventDefault();
            queueMicrotask(() => { if (inputRef.current) { inputRef.current.checked = state === true; inputRef.current.indeterminate = state === 'indeterminate'; } });
          }
          if (!field.readOnly && cycleIndeterminate) set(nextState(state));
          onClick?.(event);
        }}
        onChange={(event) => { onChange?.(event); if (!field.readOnly && !cycleIndeterminate) set(event.target.checked, event); }}
      />
      {(label || description) ? <span className={choiceStyles.content}>{label ? <span>{label}</span> : null}{description ? <span id={descriptionId} className={choiceStyles.description}>{description}</span> : null}</span> : null}
    </label>
  );
});
