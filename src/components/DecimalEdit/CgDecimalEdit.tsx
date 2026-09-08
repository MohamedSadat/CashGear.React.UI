import { flushSync } from 'react-dom';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { useControllableState, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, useFieldControl } from '../../internal';
import { calculateDecimal, compareDecimal, decimalParts, decimalText, formatDecimal, normalizeDecimalInput, parseDecimalExpression, roundDecimal } from '../../internal/decimal';
import type { DecimalRounding } from '../../internal/decimal';
import { createEditorPublication } from '../../internal/editorPublication';
import type { CgTextBoxProps } from '../TextBox';
import type { CgDecimalValue } from '../RangeSelector';
import type { CgEditorActions } from '../EditorCommit';
import { useEditorRegistration } from '../EditorCommit/CgEditorCommit';

export interface CgDecimalEditProps extends Omit<CgTextBoxProps, 'value' | 'defaultValue' | 'onValueChange' | 'buttons' | 'type' | 'actionsRef' | 'clearButton' | 'clearAriaLabel' | 'passwordReveal' | 'revealAriaLabel' | 'leadingIcon' | 'trailingIcon'> {
  value?: CgDecimalValue | null;
  defaultValue?: CgDecimalValue | null;
  onValueChange?: (value: CgDecimalValue | null, details: { reason: 'input' | 'blur' | 'enter' | 'flush' | 'step' | 'debounce' | 'reset' }) => void | PromiseLike<void>;
  actionsRef?: Ref<CgEditorActions>;
  min?: CgDecimalValue;
  max?: CgDecimalValue;
  step?: CgDecimalValue;
  precision?: number;
  roundingMode?: DecimalRounding;
  rangeBehavior?: 'clamp' | 'reject';
  allowExpressions?: boolean;
  showSpinButtons?: boolean;
  enableKeyboardStepping?: boolean;
  locale?: string;
  formatStyle?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  useGrouping?: boolean;
  invalidValueMessage?: string;
}

export const CgDecimalEdit = forwardRef<HTMLInputElement, CgDecimalEditProps>(function CgDecimalEdit({
  value, defaultValue = null, onValueChange, actionsRef, min, max, step, precision, roundingMode = 'awayFromZero', rangeBehavior = 'clamp',
  allowExpressions = false, showSpinButtons = true, enableKeyboardStepping = false, locale, formatStyle = 'decimal', currency, useGrouping = true,
  commitMode = 'blur', debounceMs = 500, invalidValueMessage, onCommitError, onChange, onFocus, onBlur, onKeyDown, onCompositionStart, onCompositionEnd,
  id, required, disabled, readOnly, validationState, size = 'medium', name, form, className, style, fullWidth, prefix, suffix,
  'aria-label': ariaLabel, 'aria-labelledby': labelledBy, 'aria-describedby': describedBy, ...native
}, forwardedRef) {
  const low = min === undefined ? undefined : decimalParts(min);
  const high = max === undefined ? undefined : decimalParts(max);
  const increment = decimalParts(step ?? '1');
  if (increment.coefficient <= 0n) throw new RangeError('step must be positive.');
  if (low && high && compareDecimal(low, high) > 0) throw new RangeError('min must not exceed max.');
  if (precision !== undefined) roundDecimal(increment, precision);
  if (!Number.isFinite(debounceMs) || debounceMs < 0) throw new RangeError('debounceMs must be nonnegative.');
  if (value !== undefined && value !== null) decimalParts(value);
  if (defaultValue !== null) decimalParts(defaultValue);
  const [current, setCurrent] = useControllableState(value, defaultValue, 'CgDecimalEdit');
  const format = useStableCallback((next: CgDecimalValue | null, editing = false) => next === null ? '' : formatDecimal(decimalParts(next), { locale, style: formatStyle, currency, precision: editing ? undefined : precision, grouping: editing ? false : useGrouping, rounding: roundingMode }));
  const [draft, setDraft] = useState(() => format(current));
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, ariaLabel, labelledBy, describedBy });
  const dirty = useRef(false); const composing = useRef(false); const focused = useRef(false);
  const currentRef = useRef(current); const echo = useRef<CgDecimalValue | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const publication = useMemo(() => createEditorPublication<CgDecimalValue | null>(), []);
  const cancelTimer = useStableCallback(() => { if (timer.current !== undefined) clearTimeout(timer.current); timer.current = undefined; });
  const report = useStableCallback((failure: unknown) => onCommitError?.(failure));
  const publish = useStableCallback((next: CgDecimalValue | null, reason: Parameters<NonNullable<CgDecimalEditProps['onValueChange']>>[1]['reason']) => {
    currentRef.current = next; setCurrent(next); dirty.current = false; setError(false);
    const revision = publication.revision;
    const pending = publication.publish(next, (item) => { echo.current = item; return onValueChange?.(item, { reason }); });
    void pending.catch((failure: unknown) => { if (revision === publication.revision) { dirty.current = true; report(failure); } });
    return pending;
  });
  const commit = useStableCallback(async (reason: Parameters<NonNullable<CgDecimalEditProps['onValueChange']>>[1]['reason']) => {
    cancelTimer();
    if (composing.current) return false;
    if (field.disabled || field.readOnly) return true;
    if (!dirty.current) return await publication.wait();
    let next: CgDecimalValue | null;
    try {
      let parsed = parseDecimalExpression(normalizeDecimalInput(inputRef.current?.value ?? draft, locale, currency), allowExpressions, roundingMode);
      if (parsed && formatStyle === 'percent') parsed = calculateDecimal(parsed, decimalParts('100'), '/', roundingMode);
      if (parsed && precision !== undefined) parsed = roundDecimal(parsed, precision, roundingMode);
      if (parsed && low && compareDecimal(parsed, low) < 0) { if (rangeBehavior === 'reject') throw new RangeError(); parsed = low; }
      if (parsed && high && compareDecimal(parsed, high) > 0) { if (rangeBehavior === 'reject') throw new RangeError(); parsed = high; }
      next = parsed ? decimalText(parsed) : null;
    } catch (failure) { if ((reason === 'input' || reason === 'debounce') && failure instanceof Error && failure.message === 'Incomplete expression.') return false; setError(true); return false; }
    setDraft(format(next, focused.current));
    await publish(next, reason);
    return true;
  });
  const resetDraft = useStableCallback(() => { cancelTimer(); publication.reset(); dirty.current = false; echo.current = undefined; const next = value !== undefined ? value : currentRef.current; currentRef.current = next; setDraft(format(next)); setError(false); });
  const flush = useStableCallback(() => commit('flush'));
  useImperativeHandle(actionsRef, () => ({ flush, resetDraft }), [flush, resetDraft]);
  useEditorRegistration({ flush, resetDraft });
  const controlled = useRef(value);
  const refreshFormat = useStableCallback(() => { if (!dirty.current) setDraft(format(currentRef.current, focused.current)); });
  useEffect(() => refreshFormat(), [currency, formatStyle, locale, precision, refreshFormat, roundingMode, useGrouping]);
  useEffect(() => {
    if (controlled.current === value) return; controlled.current = value;
    if (value === undefined) return;
    if (echo.current === value) { echo.current = undefined; return; }
    resetDraft();
  }, [resetDraft, value]);
  useEffect(() => {
    cancelTimer();
    if (!dirty.current || composing.current || field.disabled || field.readOnly) return;
    if (commitMode === 'input') void commit('input').catch(report);
    else if (commitMode === 'debounced') timer.current = setTimeout(() => { void commit('debounce').catch(report); }, debounceMs);
    return cancelTimer;
  }, [cancelTimer, commit, commitMode, debounceMs, field.disabled, field.readOnly, report]);
  useEffect(() => () => { cancelTimer(); publication.reset(); }, [cancelTimer, publication]);
  useFormReset(inputRef, () => { resetDraft(); const next = value !== undefined ? value : defaultValue; setDraft(format(next)); if (value === undefined) void publish(next, 'reset'); });
  const stepBy = useStableCallback(async (direction: 1 | -1) => {
    if (field.disabled || field.readOnly || !await flush()) return;
    try {
      if (currentRef.current !== null && (direction > 0 && high && compareDecimal(decimalParts(currentRef.current), high) >= 0 || direction < 0 && low && compareDecimal(decimalParts(currentRef.current), low) <= 0)) return;
      let next = currentRef.current === null ? low ?? decimalParts('0') : calculateDecimal(decimalParts(currentRef.current), increment, direction === 1 ? '+' : '-', roundingMode);
      if (low && compareDecimal(next, low) < 0) next = low;
      if (high && compareDecimal(next, high) > 0) next = high;
      const text = decimalText(next); setDraft(format(text, focused.current)); await publish(text, 'step');
    } catch { setError(true); }
  });
  const text = invalidValueMessage ?? (locale?.startsWith('ar') ? 'أدخل رقمًا عشريًا صالحًا ضمن الحدود.' : 'Enter a valid decimal within the allowed range.');
  return <div style={{ minWidth: 0, ...(fullWidth ? { width: '100%' } : {}) }}><InputShell size={size} validationState={error ? 'error' : field.validationState} disabled={field.disabled} readOnly={field.readOnly} className={className} style={{ ...style, ...(fullWidth ? { width: '100%' } : {}) }} start={prefix} end={<>{suffix}{showSpinButtons ? <>
    <EditorButton value={current} disabled={field.disabled || field.readOnly} descriptor={{ key: 'increase', disabled: current !== null && !!high && compareDecimal(decimalParts(current), high) >= 0, icon: 'chevron-up', ariaLabel: locale?.startsWith('ar') ? 'زيادة القيمة' : 'Increase value', onPress: () => stepBy(1) }} />
    <EditorButton value={current} disabled={field.disabled || field.readOnly} descriptor={{ key: 'decrease', disabled: current !== null && !!low && compareDecimal(decimalParts(current), low) <= 0, icon: 'chevron-down', ariaLabel: locale?.startsWith('ar') ? 'تقليل القيمة' : 'Decrease value', onPress: () => stepBy(-1) }} />
  </> : null}</>}>
    <input {...native} ref={ref} id={field.id} form={form} type="text" inputMode={allowExpressions ? 'text' : 'decimal'} value={draft} required={field.required} disabled={field.disabled} readOnly={field.readOnly} aria-label={field.ariaLabel} aria-labelledby={field.labelledBy} aria-describedby={[field.describedBy, error ? `${field.id}-decimal-error` : undefined].filter(Boolean).join(' ') || undefined} aria-invalid={error || field.validationState === 'error' || undefined}
      onChange={(event) => { dirty.current = true; setDraft(event.currentTarget.value); setError(false); onChange?.(event); cancelTimer(); if (composing.current) return; if (commitMode === 'input') void commit('input').catch(report); else if (commitMode === 'debounced') timer.current = setTimeout(() => { void commit('debounce').catch(report); }, debounceMs); }}
      onFocus={(event) => { focused.current = true; if (!dirty.current) flushSync(() => setDraft(format(currentRef.current, true))); event.currentTarget.select(); onFocus?.(event); }}
      onBlur={(event) => { focused.current = false; void commit('blur').then((valid) => { if (valid && !dirty.current) setDraft(format(currentRef.current)); }).catch(report); onBlur?.(event); }}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void commit('enter').catch(report); } if (enableKeyboardStepping && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); void stepBy(event.key === 'ArrowUp' ? 1 : -1); } onKeyDown?.(event); }}
      onCompositionStart={(event) => { composing.current = true; cancelTimer(); onCompositionStart?.(event); }} onCompositionEnd={(event) => { composing.current = false; onCompositionEnd?.(event); if (commitMode === 'input') void commit('input').catch(report); else if (commitMode === 'debounced') timer.current = setTimeout(() => { void commit('debounce').catch(report); }, debounceMs); }} />
    {name ? <input type="hidden" name={name} form={form} value={current ?? ''} disabled={field.disabled} /> : null}
  </InputShell>
    {error ? <span id={`${field.id}-decimal-error`} role="alert">{text}</span> : null}
  </div>;
});
