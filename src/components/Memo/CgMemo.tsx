import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import { useControllableState, useDebouncedCallback, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, useFieldControl } from '../../internal';
import { assertNonNegative, assertNonNegativeInteger, assertPositiveInteger } from '../../internal/validation';
import type { CgEditorButtonDescriptor } from '../../types';
import { cx } from '../../utils';
import styles from './CgMemo.module.css';
import type { CgMemoChangeReason, CgMemoProps } from './CgMemo.types';

const normalize = (text: string) => text.replace(/\r\n?/g, '\n');

export const CgMemo = forwardRef<HTMLTextAreaElement, CgMemoProps>(function CgMemo(
  {
    value,
    defaultValue = '',
    onValueChange,
    onChange,
    commitMode = 'input',
    debounceMs = 300,
    rows = 3,
    maxRows,
    resizeMode = 'manual',
    showCounter = false,
    counterFormatter,
    clearButton = 'never',
    buttons = [],
    size = 'medium',
    validationState = 'none',
    fullWidth = false,
    id,
    required,
    disabled,
    readOnly,
    maxLength,
    className,
    style,
    'data-testid': testId,
    onBlur,
    onCompositionStart,
    onCompositionEnd,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  },
  forwardedRef,
) {
  assertNonNegative('debounceMs', debounceMs);
  assertPositiveInteger('rows', rows);
  if (maxRows !== undefined) {
    assertPositiveInteger('maxRows', maxRows);
    if (maxRows < rows) throw new RangeError('maxRows must be greater than or equal to rows.');
  }
  if (maxLength !== undefined) assertNonNegativeInteger('maxLength', maxLength);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const initial = normalize(defaultValue);
  const [committed, setCommitted] = useControllableState(value === undefined ? undefined : normalize(value), initial, 'CgMemo');
  const [draft, setDraft] = useState(committed);
  const composingRef = useRef(false);
  const pendingExternalRef = useRef<string | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ref = useMergedRefs(textareaRef, forwardedRef);
  const emit = useStableCallback((next: string, reason: CgMemoChangeReason, event?: ChangeEvent<HTMLTextAreaElement>) => {
    const normalized = normalize(next);
    setCommitted(normalized);
    onValueChange?.(normalized, { reason, event });
  });
  const debounced = useDebouncedCallback((next: string) => emit(next, 'debounce'), debounceMs);
  const controlledRef = useRef(value);

  const resize = useStableCallback(() => {
    const element = textareaRef.current;
    if (!element || resizeMode !== 'auto') return;
    element.style.height = 'auto';
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight) || 20;
    const maximum = maxRows ? lineHeight * maxRows + 16 : Number.POSITIVE_INFINITY;
    element.style.height = `${Math.min(element.scrollHeight, maximum)}px`;
  });
  useEffect(() => {
    resize();
    const element = textareaRef.current;
    if (!element) return undefined;
    if (resizeMode !== 'auto') {
      element.style.removeProperty('height');
      return undefined;
    }
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [draft, maxRows, resize, resizeMode]);

  useEffect(() => {
    if (value === undefined || controlledRef.current === value) return;
    controlledRef.current = value;
    debounced.cancel();
    if (composingRef.current) {
      pendingExternalRef.current = normalize(value);
      return;
    }
    setDraft(normalize(value));
  }, [debounced, value]);
  useFormReset(textareaRef, () => {
    debounced.cancel();
    pendingExternalRef.current = undefined;
    const next = normalize(value ?? defaultValue);
    setDraft(next);
    if (value === undefined) emit(next, 'reset');
  });

  const commitInput = (next: string, event: ChangeEvent<HTMLTextAreaElement>) => {
    if (commitMode === 'input') emit(next, 'input', event);
    else if (commitMode === 'debounced') debounced.schedule(next);
  };
  const clear = () => { debounced.cancel(); setDraft(''); emit('', 'clear'); textareaRef.current?.focus(); };
  const showClear = clearButton === 'always' || (clearButton === 'auto' && draft.length > 0);
  const startButtons = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const endButtons = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (items: ReadonlyArray<CgEditorButtonDescriptor<string>>) => items.map((button) => <EditorButton key={button.key} descriptor={button} value={draft} disabled={field.disabled || field.readOnly} />);
  const counterId = showCounter ? `${field.id}-counter` : undefined;
  const describedBy = [field.describedBy, counterId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth, className)} style={style} data-testid={testId}>
      <InputShell
        start={renderButtons(startButtons)}
        end={<>{showClear ? <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: 'Clear value', onPress: clear }} value={draft} disabled={field.disabled || field.readOnly} /> : null}{renderButtons(endButtons)}</>}
        size={size}
        validationState={field.validationState}
        disabled={field.disabled}
        readOnly={field.readOnly}
        className={styles.shell}
      >
        <textarea
          {...nativeProps}
          ref={ref}
          id={field.id}
          value={draft}
          rows={rows}
          maxLength={maxLength}
          required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          aria-required={field.required || undefined}
          aria-label={field.ariaLabel}
          aria-labelledby={field.labelledBy}
          aria-invalid={field.validationState === 'error' || undefined}
          aria-describedby={describedBy}
          aria-errormessage={field.errorMessageId}
          data-resize={resizeMode}
          onChange={(event) => { const next = normalize(event.target.value); setDraft(next); onChange?.(event); if (!composingRef.current) commitInput(next, event); }}
          onBlur={(event) => { if (commitMode === 'blur') emit(draft, 'blur'); else if (commitMode === 'debounced') debounced.flush(); onBlur?.(event); }}
          onCompositionStart={(event: CompositionEvent<HTMLTextAreaElement>) => { composingRef.current = true; onCompositionStart?.(event); }}
          onCompositionEnd={(event: CompositionEvent<HTMLTextAreaElement>) => {
            composingRef.current = false;
            if (pendingExternalRef.current !== undefined) {
              setDraft(pendingExternalRef.current);
              pendingExternalRef.current = undefined;
              onCompositionEnd?.(event);
              return;
            }
            const next = normalize(event.currentTarget.value);
            if (commitMode === 'input') emit(next, 'input');
            else if (commitMode === 'debounced') debounced.schedule(next);
            onCompositionEnd?.(event);
          }}
        />
      </InputShell>
      {showCounter ? <div id={counterId} className={styles.counter} aria-live="polite">{counterFormatter ? counterFormatter(draft.length, maxLength) : maxLength !== undefined ? `${draft.length} / ${maxLength}` : draft.length}</div> : null}
    </div>
  );
});
