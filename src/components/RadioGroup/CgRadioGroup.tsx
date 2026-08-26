import { forwardRef, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useCgId, useControllableState, useDirection, useFormReset, useMergedRefs } from '../../hooks';
import { useFieldControl } from '../../internal';
import { cx } from '../../utils';
import choiceStyles from '../Choice.module.css';
import styles from './CgRadioGroup.module.css';
import type { CgRadioGroupProps } from './CgRadioGroup.types';

function CgRadioGroupInner<TValue extends string | number>(
  { options, value, defaultValue, onValueChange, legend, orientation = 'vertical', wrap = true, size = 'medium', readOnly = false, validationState = 'none', direction = 'auto', renderOption, name, form, id, required, disabled, className, style, 'data-testid': testId, 'aria-describedby': ariaDescribedBy, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...nativeProps }: CgRadioGroupProps<TValue>,
  forwardedRef: React.ForwardedRef<HTMLFieldSetElement>,
) {
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const generatedName = useCgId(name);
  const groupName = name ?? `${generatedName}-radio`;
  const [selected, setSelected] = useControllableState(value, defaultValue, 'CgRadioGroup');
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);
  const ref = useMergedRefs(fieldsetRef, forwardedRef);
  const resolvedDirection = useDirection(fieldsetRef, direction);
  useFormReset(fieldsetRef, () => {
    setSelected(defaultValue);
    if (value !== undefined) {
      fieldsetRef.current?.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input, index) => {
        input.checked = Object.is(options[index]?.value, value);
      });
    }
  });
  const choose = (next: TValue) => { setSelected(next); onValueChange?.(next); };
  const onArrow = (event: KeyboardEvent<HTMLInputElement>, currentIndex: number) => {
    const horizontalKey = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const verticalKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';
    if (!horizontalKey && !verticalKey) return;
    event.preventDefault();
    let delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    if (horizontalKey && resolvedDirection === 'rtl') delta *= -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (currentIndex + delta * offset + options.length) % options.length;
      const option = options[index];
      if (!option || disabled || option.disabled) continue;
      if (!readOnly) choose(option.value);
      fieldsetRef.current?.querySelector<HTMLInputElement>(`input[data-index="${index}"]`)?.focus();
      break;
    }
  };
  return (
    <fieldset {...nativeProps} ref={ref} id={field.id} form={form} className={cx(styles.group, className)} style={style} disabled={field.disabled} aria-label={field.ariaLabel} aria-labelledby={field.labelledBy} aria-readonly={field.readOnly || undefined} aria-invalid={field.validationState === 'error' || undefined} aria-describedby={field.describedBy} aria-errormessage={field.errorMessageId} data-orientation={orientation} data-wrap={wrap || undefined} data-testid={testId}>
      {legend ? <legend className={styles.legend}>{legend}{field.required ? <span aria-hidden="true"> *</span> : null}</legend> : null}
      <div className={styles.options}>
        {options.map((option, index) => {
          const isChecked = Object.is(selected, option.value);
          const optionId = `${field.id}-option-${index}`;
          const descriptionId = option.description ? `${optionId}-description` : undefined;
          return (
            <label key={`${typeof option.value}:${String(option.value)}`} className={cx(choiceStyles.root, choiceStyles[field.validationState])} data-size={size} data-disabled={field.disabled || option.disabled || undefined} data-readonly={field.readOnly || undefined}>
              <input className={choiceStyles.input} id={optionId} type="radio" name={groupName} form={form} value={String(option.value)} checked={isChecked} required={field.required} disabled={field.disabled || option.disabled} aria-describedby={descriptionId} aria-readonly={field.readOnly || undefined} data-index={index} onClick={(event) => { if (field.readOnly) event.preventDefault(); }} onChange={(event) => { if (!field.readOnly && event.target.checked) choose(option.value); }} onKeyDown={(event) => onArrow(event, index)} />
              <span className={choiceStyles.content}>{renderOption ? renderOption({ option, checked: isChecked, index }) : <><span>{option.label}</span>{option.description ? <span id={descriptionId} className={choiceStyles.description}>{option.description}</span> : null}</>}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export const CgRadioGroup = forwardRef(CgRadioGroupInner) as <TValue extends string | number = string>(props: CgRadioGroupProps<TValue> & React.RefAttributes<HTMLFieldSetElement>) => React.ReactElement;
