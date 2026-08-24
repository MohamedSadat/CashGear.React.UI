import { forwardRef, useEffect, useMemo, useRef } from 'react';
import { useControllableState, useFormReset, useMergedRefs } from '../../hooks';
import type { CgEditorButtonDescriptor } from '../../types';
import { createNumberFormatter, normalizeNumericValue, parseLocalizedNumber } from '../../internal/numeric';
import { assertPositive } from '../../internal/validation';
import { CgNumericEdit } from '../NumericEdit';
import type { CgSpinEditProps } from './CgSpinEdit.types';

export const CgSpinEdit = forwardRef<HTMLInputElement, CgSpinEditProps>(function CgSpinEdit(
  { value, defaultValue = null, onValueChange, onChange, step = 1, pageStep, min, max, precision, locale, formatStyle = 'decimal', currency, useGrouping = true, disabled, readOnly, incrementAriaLabel = 'Increase value', decrementAriaLabel = 'Decrease value', onKeyDown, ...props },
  ref,
) {
  assertPositive('step', step);
  if (pageStep !== undefined) assertPositive('pageStep', pageStep);
  const [current, setCurrent] = useControllableState(value, defaultValue, 'CgSpinEdit');
  const draftRef = useRef('');
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(inputRef, ref);
  const formatter = useMemo(
    () => createNumberFormatter({ locale, style: formatStyle, currency, precision, useGrouping }),
    [currency, formatStyle, locale, precision, useGrouping],
  );
  useEffect(() => {
    draftRef.current = '';
  }, [currency, formatStyle, locale, precision, useGrouping, value]);
  const change = (next: number | null, reason: 'step' | 'blur' | 'enter' | 'reset') => {
    draftRef.current = '';
    setCurrent(next);
    onValueChange?.(next, { reason });
  };
  useFormReset(inputRef, () => {
    if (value !== undefined) return;
    change(defaultValue, 'reset');
  });
  const stepBy = (direction: 1 | -1, amount = step) => {
    if (disabled || readOnly) return;
    const parsedDraft = draftRef.current
      ? parseLocalizedNumber(draftRef.current, formatter, formatStyle)
      : undefined;
    const basis = typeof parsedDraft === 'number' ? parsedDraft : current;
    const raw = basis === null ? (direction > 0 ? (min ?? 0) : (max ?? 0)) : basis + direction * amount;
    change(normalizeNumericValue(raw, min, max, precision), 'step');
  };
  const buttons: Array<CgEditorButtonDescriptor<number | null>> = [
    { key: 'increment', icon: 'chevron-up', ariaLabel: incrementAriaLabel, disabled: disabled || readOnly || (max !== undefined && current !== null && current >= max), onPress: () => stepBy(1) },
    { key: 'decrement', icon: 'chevron-down', ariaLabel: decrementAriaLabel, disabled: disabled || readOnly || (min !== undefined && current !== null && current <= min), onPress: () => stepBy(-1) },
  ];
  return <CgNumericEdit {...props} ref={mergedRef} value={current} defaultValue={defaultValue} locale={locale} formatStyle={formatStyle} currency={currency} useGrouping={useGrouping} min={min} max={max} precision={precision} step={step} disabled={disabled} readOnly={readOnly} buttons={buttons} role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={current ?? undefined} onChange={(event) => { draftRef.current = event.target.value; onChange?.(event); }} onValueChange={(next, details) => { draftRef.current = ''; setCurrent(next); onValueChange?.(next, details); }} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); stepBy(1); } else if (event.key === 'ArrowDown') { event.preventDefault(); stepBy(-1); } else if (pageStep && event.key === 'PageUp') { event.preventDefault(); stepBy(1, pageStep); } else if (pageStep && event.key === 'PageDown') { event.preventDefault(); stepBy(-1, pageStep); } onKeyDown?.(event); }} />;
});
