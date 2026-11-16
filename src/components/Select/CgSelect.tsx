import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState } from '../../hooks';
import { InputShell, useFieldControl } from '../../internal';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import styles from './CgSelect.module.css';
import type { CgSelectOption, CgSelectProps } from './CgSelect.types';

/**
 * A single choice from a short list, drawn and labelled as the library's fields: the browser's own
 * select underneath, so its keyboard, its type-ahead and a phone's picker all work as people expect.
 * `CgComboBox` is the control that filters.
 */
export const CgSelect = forwardRef<HTMLSelectElement, CgSelectProps>(function CgSelect(
  {
    options,
    value,
    defaultValue = null,
    onValueChange,
    placeholder,
    size = 'medium',
    fullWidth = false,
    readOnly,
    required,
    disabled,
    validationState,
    id,
    className,
    style,
    'data-testid': testId,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  },
  forwardedRef,
) {
  const values = new Set<string>();
  for (const option of options) {
    if (values.has(option.value)) throw new Error(`CgSelect option values must be unique: ${option.value}`);
    values.add(option.value);
  }
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const [current, setCurrent] = useControllableState<string | null>(value, defaultValue, 'CgSelect');
  const chosen = current !== null && values.has(current) ? current : null;
  const shown = chosen ?? (placeholder !== undefined ? '' : (options.find((option) => !option.disabled)?.value ?? ''));

  // Options of a group are listed together, groups in the order they first appear.
  const groups: Array<{ name: string | undefined; options: CgSelectOption[] }> = [];
  for (const option of options) {
    let group = groups.find((entry) => entry.name === option.group);
    if (!group) { group = { name: option.group, options: [] }; groups.push(group); }
    group.options.push(option);
  }
  const optionElement = (option: CgSelectOption): ReactNode => <option key={option.value} value={option.value} disabled={option.disabled}>{option.label}</option>;

  return <InputShell
    size={size}
    validationState={field.validationState}
    disabled={field.disabled}
    readOnly={field.readOnly}
    className={cx(styles.shell, fullWidth && styles.fullWidth, className)}
    style={style}
    data-testid={testId}
  >
    <select
      {...nativeProps}
      ref={forwardedRef}
      id={field.id}
      className={styles.select}
      value={shown}
      required={field.required}
      disabled={field.disabled}
      aria-readonly={field.readOnly || undefined}
      aria-required={field.required || undefined}
      aria-label={field.ariaLabel}
      aria-labelledby={field.labelledBy}
      aria-invalid={field.validationState === 'error' || undefined}
      aria-describedby={field.describedBy}
      aria-errormessage={field.errorMessageId}
      dir="auto"
      onChange={(event) => {
        if (field.readOnly) return;
        const next = event.currentTarget.value === '' && placeholder !== undefined ? null : event.currentTarget.value;
        setCurrent(next);
        onValueChange?.(next, Object.freeze({ option: options.find((option) => option.value === next) ?? null, event }));
      }}
    >
      {placeholder !== undefined ? <option value="" disabled={field.required}>{placeholder}</option> : null}
      {groups.map((group, index) => group.name === undefined
        ? group.options.map(optionElement)
        : <optgroup key={`group-${index}`} label={group.name}>{group.options.map(optionElement)}</optgroup>)}
    </select>
    <span className={styles.chevron} aria-hidden="true"><CgIcon name="chevron-down" /></span>
  </InputShell>;
});
