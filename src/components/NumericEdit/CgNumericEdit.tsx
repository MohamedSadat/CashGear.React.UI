import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { useControllableState, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, useFieldControl } from '../../internal';
import { createNumberFormatter, normalizeNumericValue, parseLocalizedNumber } from '../../internal/numeric';
import { assertFinite, assertNonNegativeInteger, assertPositive } from '../../internal/validation';
import type { CgEditorButtonDescriptor } from '../../types';
import { cx } from '../../utils';
import styles from './CgNumericEdit.module.css';
import type { CgNumericChangeReason, CgNumericEditProps } from './CgNumericEdit.types';

export const CgNumericEdit = forwardRef<HTMLInputElement, CgNumericEditProps>(function CgNumericEdit(
  { value, defaultValue = null, onValueChange, onChange, onInvalidValue, locale, formatStyle = 'decimal', currency, precision, useGrouping = true, min, max, step, allowNegative = true, prefix, suffix, buttons = [], size = 'medium', validationState = 'none', fullWidth = false, id, required, disabled, readOnly, className, style, 'data-testid': testId, onBlur, onFocus, onKeyDown, 'aria-describedby': ariaDescribedBy, ...nativeProps },
  forwardedRef,
) {
  assertFinite('value', value);
  assertFinite('defaultValue', defaultValue);
  assertFinite('min', min);
  assertFinite('max', max);
  if (min !== undefined && max !== undefined && min > max) {
    throw new RangeError('min must be less than or equal to max.');
  }
  if (precision !== undefined) assertNonNegativeInteger('precision', precision);
  if (step !== undefined) assertPositive('step', step);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const formatter = useMemo(() => createNumberFormatter({ locale, style: formatStyle, currency, precision, useGrouping }), [currency, formatStyle, locale, precision, useGrouping]);
  const format = useCallback((next: number | null) => next === null ? '' : formatter.format(next), [formatter]);
  const [committed, setCommitted] = useControllableState(value, defaultValue, 'CgNumericEdit');
  const [draft, setDraft] = useState(() => format(committed));
  const [draftInvalid, setDraftInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const controlledRef = useRef(value);
  const commit = useStableCallback((reason: CgNumericChangeReason, event?: ChangeEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => {
    const parsed = parseLocalizedNumber(draft, formatter, formatStyle);
    if (parsed === undefined || (!allowNegative && parsed !== null && parsed < 0)) {
      setDraftInvalid(true);
      onInvalidValue?.(draft);
      return;
    }
    const next = parsed === null ? null : normalizeNumericValue(parsed, min, max, precision);
    setDraftInvalid(false);
    setCommitted(next);
    setDraft(format(next));
    onValueChange?.(next, { reason, event });
  });
  const formatterRef = useRef(formatter);
  useEffect(() => {
    const formattingChanged = formatterRef.current !== formatter;
    const controlledChanged = value !== undefined && !Object.is(controlledRef.current, value);
    formatterRef.current = formatter;
    if (!formattingChanged && !controlledChanged) return;
    if (value !== undefined) controlledRef.current = value;
    setDraft(format(value !== undefined ? value : committed));
    setDraftInvalid(false);
  }, [committed, format, formatter, value]);
  useFormReset(inputRef, () => {
    const next = value !== undefined ? value : defaultValue;
    setDraftInvalid(false);
    setDraft(format(next));
    if (value === undefined) { setCommitted(next); onValueChange?.(next, { reason: 'reset' }); }
  });
  const startButtons = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const endButtons = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (items: ReadonlyArray<CgEditorButtonDescriptor<number | null>>) => items.map((button) => <EditorButton key={button.key} descriptor={button} value={committed} disabled={field.disabled || field.readOnly} />);
  return (
    <InputShell start={<>{renderButtons(startButtons)}{prefix ? <span aria-hidden="true">{prefix}</span> : null}</>} end={<>{suffix ? <span aria-hidden="true">{suffix}</span> : null}{renderButtons(endButtons)}</>} size={size} validationState={draftInvalid ? 'error' : field.validationState} disabled={field.disabled} readOnly={field.readOnly} className={cx(fullWidth && styles.fullWidth, className)} style={style} data-testid={testId}>
      <input
        {...nativeProps}
        ref={ref}
        id={field.id}
        type="text"
        inputMode="decimal"
        value={draft}
        required={field.required}
        disabled={field.disabled}
        readOnly={field.readOnly}
        data-step={step}
        aria-required={field.required || undefined}
        aria-invalid={draftInvalid || field.validationState === 'error' || undefined}
        aria-describedby={field.describedBy}
        aria-errormessage={field.errorMessageId}
        onChange={(event) => { setDraftInvalid(false); setDraft(event.target.value); onChange?.(event); }}
        onFocus={(event) => { onFocus?.(event); }}
        onBlur={(event) => { commit('blur', event); onBlur?.(event); }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit('enter', event); } onKeyDown?.(event); }}
      />
    </InputShell>
  );
});
