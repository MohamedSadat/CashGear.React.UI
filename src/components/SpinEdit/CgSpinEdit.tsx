import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useControllableState, useFormReset, useMergedRefs } from '../../hooks';
import type { CgEditorButtonDescriptor } from '../../types';
import type { InternalEditorButtonDescriptor } from '../../internal/EditorButton';
import { createNumberFormatter, normalizeNumericValue, parseLocalizedNumber } from '../../internal/numeric';
import { assertPositive } from '../../internal/validation';
import { CgNumericEdit } from '../NumericEdit';
import type { CgSpinEditProps } from './CgSpinEdit.types';

export const CgSpinEdit = forwardRef<HTMLInputElement, CgSpinEditProps>(function CgSpinEdit(
  { value, defaultValue = null, onValueChange, onChange, step = 1, pageStep, min, max, precision, locale, formatStyle = 'decimal', currency, useGrouping = true, disabled, readOnly, incrementAriaLabel = 'Increase value', decrementAriaLabel = 'Decrease value', repeatOnHold = true, onKeyDown, ...props },
  ref,
) {
  assertPositive('step', step);
  if (pageStep !== undefined) assertPositive('pageStep', pageStep);
  const [current, setCurrent] = useControllableState(value, defaultValue, 'CgSpinEdit');
  const draftRef = useRef('');
  const currentRef = useRef(current);
  useLayoutEffect(() => { currentRef.current = current; }, [current]);
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
    currentRef.current = next;
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
    const basis = typeof parsedDraft === 'number' ? parsedDraft : currentRef.current;
    const raw = basis === null ? (direction > 0 ? (min ?? 0) : (max ?? 0)) : basis + direction * amount;
    change(normalizeNumericValue(raw, min, max, precision), 'step');
  };
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdStartedAtRef = useRef(0);
  const suppressClickRef = useRef(false);
  const stopHold = useCallback(() => {
    if (holdTimerRef.current !== undefined) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = undefined;
  }, []);
  const startHold = (direction: 1 | -1, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || disabled || readOnly) return;
    event.preventDefault();
    suppressClickRef.current = true;
    stepBy(direction);
    if (!repeatOnHold) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic pointer events may not have an active platform pointer. The
      // window/pointer cleanup paths still stop the repeat safely.
    }
    holdStartedAtRef.current = Date.now();
    const repeat = () => {
      stepBy(direction);
      const elapsed = Date.now() - holdStartedAtRef.current;
      const delay = elapsed < 1_000 ? 120 : elapsed < 2_500 ? 75 : 40;
      holdTimerRef.current = setTimeout(repeat, delay);
    };
    holdTimerRef.current = setTimeout(repeat, 400);
  };
  useEffect(() => {
    if (disabled || readOnly) stopHold();
  }, [disabled, readOnly, stopHold]);
  useEffect(() => {
    window.addEventListener('blur', stopHold);
    return () => {
      window.removeEventListener('blur', stopHold);
      stopHold();
    };
  }, [stopHold]);
  const interaction = (direction: 1 | -1): InternalEditorButtonDescriptor<number | null>['interaction'] => ({
    onPointerDown: (event) => startHold(direction, event),
    onPointerUp: stopHold,
    onPointerCancel: stopHold,
    onLostPointerCapture: stopHold,
    consumeClick: () => {
      if (!suppressClickRef.current) return false;
      setTimeout(() => { suppressClickRef.current = false; }, 0);
      return true;
    },
  });
  const buttons: Array<CgEditorButtonDescriptor<number | null>> = [
    { key: 'increment', icon: 'chevron-up', ariaLabel: incrementAriaLabel, disabled: disabled || readOnly || (max !== undefined && current !== null && current >= max), onPress: () => stepBy(1), interaction: interaction(1) } as InternalEditorButtonDescriptor<number | null>,
    { key: 'decrement', icon: 'chevron-down', ariaLabel: decrementAriaLabel, disabled: disabled || readOnly || (min !== undefined && current !== null && current <= min), onPress: () => stepBy(-1), interaction: interaction(-1) } as InternalEditorButtonDescriptor<number | null>,
  ];
  return <CgNumericEdit {...props} ref={mergedRef} value={current} defaultValue={defaultValue} locale={locale} formatStyle={formatStyle} currency={currency} useGrouping={useGrouping} min={min} max={max} precision={precision} step={step} disabled={disabled} readOnly={readOnly} buttons={buttons} role="spinbutton" aria-valuemin={min} aria-valuemax={max} aria-valuenow={current ?? undefined} onChange={(event) => { draftRef.current = event.target.value; onChange?.(event); }} onValueChange={(next, details) => { draftRef.current = ''; currentRef.current = next; setCurrent(next); onValueChange?.(next, details); }} onKeyDown={(event) => { if (event.key === 'ArrowUp') { event.preventDefault(); stepBy(1); } else if (event.key === 'ArrowDown') { event.preventDefault(); stepBy(-1); } else if (pageStep && event.key === 'PageUp') { event.preventDefault(); stepBy(1, pageStep); } else if (pageStep && event.key === 'PageDown') { event.preventDefault(); stepBy(-1, pageStep); } onKeyDown?.(event); }} />;
});
