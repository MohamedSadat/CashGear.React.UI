import { useEditorRegistration } from '../EditorCommit/CgEditorCommit';
import { createEditorPublication } from '../../internal/editorPublication';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent } from 'react';
import { useControllableState, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, useFieldControl } from '../../internal';
import { createNumberFormatter, normalizeNumericValue, parseLocalizedNumber } from '../../internal/numeric';
import { assertFinite, assertNonNegativeInteger, assertPositive } from '../../internal/validation';
import type { CgEditorButtonDescriptor } from '../../types';
import { cx } from '../../utils';
import styles from './CgNumericEdit.module.css';
import type { CgNumericChangeReason, CgNumericEditProps } from './CgNumericEdit.types';

export type CgNumericDraftResult =
  | { readonly kind: 'value'; readonly value: number | null }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'invalid' };

interface CgNumericEditCoreProps extends CgNumericEditProps {
  readonly classifyDraft?: (draft: string, formatter: Intl.NumberFormat) => CgNumericDraftResult;
  readonly inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  readonly suppressDuplicateCommit?: boolean;
  readonly updateValueOnInput?: boolean;
}

export const CgNumericEditCore = forwardRef<HTMLInputElement, CgNumericEditCoreProps>(function CgNumericEditCore(
  { actionsRef, onCommitError, onCompositionStart, onCompositionEnd, value, defaultValue = null, onValueChange, onChange, onInvalidValue, locale, formatStyle = 'decimal', currency, precision, useGrouping = true, min, max, step, allowNegative = true, prefix, suffix, buttons = [], size = 'medium', validationState = 'none', fullWidth = false, id, required, disabled, readOnly, className, style, 'data-testid': testId, onBlur, onFocus, onKeyDown, 'aria-describedby': ariaDescribedBy, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, classifyDraft, inputMode = 'decimal', suppressDuplicateCommit = false, updateValueOnInput = false, ...nativeProps },
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
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const formatter = useMemo(() => createNumberFormatter({ locale, style: formatStyle, currency, precision, useGrouping }), [currency, formatStyle, locale, precision, useGrouping]);
  const format = useCallback((next: number | null) => next === null ? '' : formatter.format(next), [formatter]);
  const [committed, setCommitted] = useControllableState(value, defaultValue, 'CgNumericEdit');
  const [draft, setDraft] = useState(() => format(committed));
  const [draftInvalid, setDraftInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const controlledRef = useRef(value);
  const publishedRef = useRef(committed);
  const editingRef = useRef(false);
  const dirtyRef = useRef(false);
  const composingRef = useRef(false);
  const publication = useMemo(() => createEditorPublication<number | null>(), []);
  const publish = useStableCallback((next: number | null, details: Parameters<NonNullable<CgNumericEditProps['onValueChange']>>[1]) => {
    const revision = publication.revision;
    const pending = publication.publish(next, (item) => onValueChange?.(item, details));
    void pending.catch((error: unknown) => { if (revision === publication.revision) { dirtyRef.current = true; onCommitError?.(error); } });
    return pending;
  });
  const classify = useCallback((text: string): CgNumericDraftResult => {
    if (classifyDraft) return classifyDraft(text, formatter);
    const parsed = parseLocalizedNumber(text, formatter, formatStyle);
    return parsed === undefined ? { kind: 'invalid' } : { kind: 'value', value: parsed };
  }, [classifyDraft, formatStyle, formatter]);
  const commit = useStableCallback((reason: CgNumericChangeReason, event?: ChangeEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current) return false;
    if (!dirtyRef.current) return true;
    const text = inputRef.current?.value ?? draft;
    const parsed = classify(text);
    if (parsed.kind !== 'value' || (!allowNegative && parsed.value !== null && parsed.value < 0)) {
      setDraftInvalid(true);
      onInvalidValue?.(text);
      return false;
    }
    const next = parsed.value === null ? null : normalizeNumericValue(parsed.value, min, max, precision);
    setDraftInvalid(false);
    setCommitted(next);
    const duplicate = suppressDuplicateCommit && Object.is(publishedRef.current, next);
    publishedRef.current = next;
    setDraft(format(next));
    dirtyRef.current = false;
    if (!duplicate) void publish(next, { reason, event });
    return true;
  });
  const resetDraft = useStableCallback(() => { publication.reset(); dirtyRef.current = false; setDraftInvalid(false); setDraft(format(value !== undefined ? value : committed)); });
  const flush = useStableCallback(async () => {
    if (composingRef.current) return false;
    if (field.disabled || field.readOnly) return true;
    if (!commit('flush')) return false;
    return await publication.wait();
  });
  useImperativeHandle(actionsRef, () => ({ flush, resetDraft }), [flush, resetDraft]);
  useEditorRegistration({ flush, resetDraft });
  useEffect(() => () => publication.reset(), [publication]);
  const formatterRef = useRef(formatter);
  useEffect(() => {
    const formattingChanged = formatterRef.current !== formatter;
    const controlledChanged = value !== undefined && !Object.is(controlledRef.current, value);
    formatterRef.current = formatter;
    if (!formattingChanged && !controlledChanged) return;
    if (value !== undefined) controlledRef.current = value;
    if (controlledChanged && !Object.is(value, publishedRef.current)) { publication.reset(); dirtyRef.current = false; }
    if (controlledChanged) publishedRef.current = value ?? null;
    if (updateValueOnInput && editingRef.current && !formattingChanged) return;
    setDraft(format(value !== undefined ? value : committed));
    setDraftInvalid(false);
  }, [committed, format, formatter, publication, updateValueOnInput, value]);
  useFormReset(inputRef, () => {
    publication.reset(); dirtyRef.current = false;
    const next = value !== undefined ? value : defaultValue;
    setDraftInvalid(false);
    setDraft(format(next));
    publishedRef.current = next;
    if (value === undefined) { setCommitted(next); void publish(next, { reason: 'reset' }); }
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
        inputMode={inputMode}
        value={draft}
        required={field.required}
        disabled={field.disabled}
        readOnly={field.readOnly}
        data-step={step}
        aria-required={field.required || undefined}
        aria-label={field.ariaLabel}
        aria-labelledby={field.labelledBy}
        aria-invalid={draftInvalid || field.validationState === 'error' || undefined}
        aria-describedby={field.describedBy}
        aria-errormessage={field.errorMessageId}
        onChange={(event) => {
          const text = event.target.value;
          editingRef.current = true;
          dirtyRef.current = true;
          setDraftInvalid(false);
          setDraft(text);
          onChange?.(event);
          if (!updateValueOnInput || composingRef.current) return;
          const parsed = classify(text);
          if (parsed.kind === 'incomplete') return;
          if (parsed.kind === 'invalid' || (!allowNegative && parsed.value !== null && parsed.value < 0)) {
            setDraftInvalid(true);
            onInvalidValue?.(text);
            return;
          }
          const next = parsed.value === null ? null : normalizeNumericValue(parsed.value, min, max, precision);
          if (Object.is(publishedRef.current, next)) return;
          publishedRef.current = next;
          setCommitted(next);
          void publish(next, { reason: 'input', event });
        }}
        onCompositionStart={(event) => { composingRef.current = true; onCompositionStart?.(event); }}
        onCompositionEnd={(event) => { composingRef.current = false; onCompositionEnd?.(event); }}
        onFocus={(event) => { editingRef.current = true; onFocus?.(event); }}
        onBlur={(event) => { commit('blur', event); editingRef.current = false; onBlur?.(event); }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit('enter', event); } onKeyDown?.(event); }}
      />
    </InputShell>
  );
});

export const CgNumericEdit = forwardRef<HTMLInputElement, CgNumericEditProps>(function CgNumericEdit(props, ref) {
  return <CgNumericEditCore {...props} ref={ref} />;
});
