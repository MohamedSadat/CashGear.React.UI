import { forwardRef } from 'react';
import { useControllableState } from '../../hooks';
import type { CgEditorButtonDescriptor } from '../../types';
import { normalizeNumericValue } from '../../internal/numeric';
import { CgNumericEdit } from '../NumericEdit';
import type { CgSpinEditProps } from './CgSpinEdit.types';

export const CgSpinEdit = forwardRef<HTMLInputElement, CgSpinEditProps>(function CgSpinEdit(
  { value, defaultValue = null, onValueChange, step = 1, pageStep, min, max, precision, disabled, readOnly, incrementAriaLabel = 'Increase value', decrementAriaLabel = 'Decrease value', onKeyDown, ...props },
  ref,
) {
  const [current, setCurrent] = useControllableState(value, defaultValue, 'CgSpinEdit');
  const change = (next: number | null, reason: 'step' | 'blur' | 'enter' | 'reset') => {
    setCurrent(next);
    onValueChange?.(next, { reason });
  };
  const stepBy = (direction: 1 | -1, amount = step) => {
    if (disabled || readOnly || amount <= 0) return;
    const raw = current === null ? (direction > 0 ? (min ?? 0) : (max ?? 0)) : current + direction * amount;
    change(normalizeNumericValue(raw, min, max, precision), 'step');
  };
  const buttons: Array<CgEditorButtonDescriptor<number | null>> = [
    { key: 'increment', icon: 'chevron-up', ariaLabel: incrementAriaLabel, disabled: disabled || readOnly || (max !== undefined && current !== null && current >= max), onPress: () => stepBy(1) },
    { key: 'decrement', icon: 'chevron-down', ariaLabel: decrementAriaLabel, disabled: disabled || readOnly || (min !== undefined && current !== null && current <= min), onPress: () => stepBy(-1) },
  ];
  return <CgNumericEdit {...props} ref={ref} value={current} defaultValue={defaultValue} min={min} max={max} precision={precision} step={step} disabled={disabled} readOnly={readOnly} buttons={buttons} role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={current ?? undefined} onValueChange={(next, details) => { setCurrent(next); onValueChange?.(next, details); }} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); stepBy(1); } else if (event.key === 'ArrowDown') { event.preventDefault(); stepBy(-1); } else if (pageStep && event.key === 'PageUp') { event.preventDefault(); stepBy(1, pageStep); } else if (pageStep && event.key === 'PageDown') { event.preventDefault(); stepBy(-1, pageStep); } onKeyDown?.(event); }} />;
});
