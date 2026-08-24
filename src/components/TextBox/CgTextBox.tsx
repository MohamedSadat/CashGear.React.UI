import { forwardRef, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import { useControllableState, useDebouncedCallback, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, renderIcon, useFieldControl } from '../../internal';
import type { CgEditorButtonDescriptor } from '../../types';
import { cx } from '../../utils';
import styles from './CgTextBox.module.css';
import type { CgTextBoxProps, CgTextChangeReason } from './CgTextBox.types';

export const CgTextBox = forwardRef<HTMLInputElement, CgTextBoxProps>(function CgTextBox(
  {
    value,
    defaultValue = '',
    onValueChange,
    onChange,
    commitMode = 'input',
    debounceMs = 300,
    size = 'medium',
    validationState = 'none',
    fullWidth = false,
    prefix,
    suffix,
    leadingIcon,
    trailingIcon,
    buttons = [],
    clearButton = 'never',
    clearAriaLabel = 'Clear value',
    passwordReveal = false,
    revealAriaLabel = 'Show password',
    type = 'text',
    id,
    required,
    disabled,
    readOnly,
    className,
    style,
    'data-testid': testId,
    onBlur,
    onCompositionStart,
    onCompositionEnd,
    'aria-describedby': ariaDescribedBy,
    ...nativeProps
  },
  forwardedRef,
) {
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const [committed, setCommitted] = useControllableState(value, defaultValue, 'CgTextBox');
  const [draft, setDraft] = useState(committed);
  const [revealed, setRevealed] = useState(false);
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const emit = useStableCallback((next: string, reason: CgTextChangeReason, event?: ChangeEvent<HTMLInputElement>) => {
    setCommitted(next);
    onValueChange?.(next, { reason, event });
  });
  const debounced = useDebouncedCallback((next: string) => emit(next, 'debounce'), debounceMs);
  const controlledRef = useRef(value);

  useEffect(() => {
    if (value === undefined || controlledRef.current === value) return;
    controlledRef.current = value;
    debounced.cancel();
    setDraft(value);
  }, [debounced, value]);

  useFormReset(inputRef, () => {
    debounced.cancel();
    const next = value ?? defaultValue;
    setDraft(next);
    if (value === undefined) emit(next, 'reset');
  });

  const commitFromInput = (next: string, event: ChangeEvent<HTMLInputElement>) => {
    if (commitMode === 'input') emit(next, 'input', event);
    else if (commitMode === 'debounced') debounced.schedule(next);
  };
  const clear = () => {
    debounced.cancel();
    setDraft('');
    emit('', 'clear');
    inputRef.current?.focus();
  };
  const showClear = clearButton === 'always' || (clearButton === 'auto' && draft.length > 0);
  const startButtons = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const endButtons = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (items: ReadonlyArray<CgEditorButtonDescriptor<string>>) =>
    items.map((button) => <EditorButton key={button.key} descriptor={button} value={draft} disabled={field.disabled || field.readOnly} />);

  const start = <>{renderButtons(startButtons)}{leadingIcon ? renderIcon(leadingIcon) : null}{prefix ? <span aria-hidden="true">{prefix}</span> : null}</>;
  const end = <>{suffix ? <span aria-hidden="true">{suffix}</span> : null}{trailingIcon ? renderIcon(trailingIcon) : null}{showClear ? <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: clearAriaLabel, disabled: field.readOnly, onPress: clear }} value={draft} disabled={field.disabled} /> : null}{type === 'password' && passwordReveal ? <EditorButton descriptor={{ key: 'reveal', icon: revealed ? 'eye-off' : 'eye', ariaLabel: revealed ? 'Hide password' : revealAriaLabel, onPress: () => setRevealed((current) => !current) }} value={draft} disabled={field.disabled} /> : null}{renderButtons(endButtons)}</>;

  return (
    <InputShell
      start={start}
      end={end}
      size={size}
      validationState={field.validationState}
      disabled={field.disabled}
      readOnly={field.readOnly}
      className={cx(fullWidth && styles.fullWidth, className)}
      style={style}
      data-testid={testId}
    >
      <input
        {...nativeProps}
        ref={ref}
        id={field.id}
        type={type === 'password' && revealed ? 'text' : type}
        value={draft}
        required={field.required}
        disabled={field.disabled}
        readOnly={field.readOnly}
        aria-required={field.required || undefined}
        aria-invalid={field.validationState === 'error' || undefined}
        aria-describedby={field.describedBy}
        aria-errormessage={field.errorMessageId}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          onChange?.(event);
          if (!composingRef.current) commitFromInput(next, event);
        }}
        onBlur={(event) => {
          if (commitMode === 'blur') emit(draft, 'blur');
          else if (commitMode === 'debounced') debounced.flush();
          onBlur?.(event);
        }}
        onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = true;
          onCompositionStart?.(event);
        }}
        onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = false;
          const next = event.currentTarget.value;
          if (commitMode === 'input') emit(next, 'input');
          else if (commitMode === 'debounced') debounced.schedule(next);
          onCompositionEnd?.(event);
        }}
      />
    </InputShell>
  );
});
