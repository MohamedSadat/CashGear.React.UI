import { useEditorRegistration } from '../EditorCommit/CgEditorCommit';
import { createEditorPublication } from '../../internal/editorPublication';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';
import { useControllableState, useDebouncedCallback, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, renderIcon, useFieldControl } from '../../internal';
import { assertNonNegative } from '../../internal/validation';
import type { CgEditorButtonDescriptor } from '../../types';
import { cx } from '../../utils';
import styles from './CgTextBox.module.css';
import type { CgTextBoxProps, CgTextChangeReason } from './CgTextBox.types';

export const CgTextBox = forwardRef<HTMLInputElement, CgTextBoxProps>(function CgTextBox(
  {
    actionsRef,
    onCommitError,
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
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  },
  forwardedRef,
) {
  assertNonNegative('debounceMs', debounceMs);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const [committed, setCommitted] = useControllableState(value, defaultValue, 'CgTextBox');
  const [draft, setDraft] = useState(committed);
  const [revealed, setRevealed] = useState(false);
  const composingRef = useRef(false);
  const pendingExternalRef = useRef<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const publication = useMemo(() => createEditorPublication<string>(), []);
  const draftRef = useRef(committed);
  const publishedRef = useRef(committed);
  const echoRef = useRef<string | undefined>(undefined);
  const emit = useStableCallback((next: string, reason: CgTextChangeReason, event?: ChangeEvent<HTMLInputElement>) => {
    setCommitted(next);
    publishedRef.current = next;
    const revision = publication.revision;
    const pending = publication.publish(next, (item) => { echoRef.current = item; return onValueChange?.(item, { reason, event }); });
    void pending.catch((error: unknown) => { if (revision === publication.revision) { if (publishedRef.current === next) publishedRef.current = committed; onCommitError?.(error); } });
    return pending;
  });
  const debounced = useDebouncedCallback((next: string) => { void emit(next, 'debounce'); }, debounceMs);
  const controlledRef = useRef(value);
  useEffect(() => {
    debounced.cancel();
    if (composingRef.current || field.disabled || field.readOnly || draftRef.current === publishedRef.current) return;
    if (commitMode === 'input') void emit(draftRef.current, 'input');
    else if (commitMode === 'debounced') debounced.schedule(draftRef.current);
  }, [commitMode, debounced, emit, field.disabled, field.readOnly]);

  useEffect(() => {
    if (value === undefined || controlledRef.current === value) return;
    controlledRef.current = value;
    if (value === echoRef.current) { echoRef.current = undefined; return; }
    publication.reset();
    publishedRef.current = value;
    debounced.cancel();
    if (composingRef.current) {
      pendingExternalRef.current = value;
      return;
    }
    draftRef.current = value;
    setDraft(value);
  }, [debounced, publication, value]);

  const resetDraft = useStableCallback(() => {
    publication.reset(); echoRef.current = undefined; debounced.cancel(); pendingExternalRef.current = undefined;
    const next = value ?? committed; draftRef.current = next; publishedRef.current = next; setDraft(next);
  });
  const flush = useStableCallback(async () => {
    debounced.cancel();
    if (composingRef.current) return false;
    if (field.disabled || field.readOnly) return true;
    const next = inputRef.current?.value ?? draftRef.current;
    if (next !== publishedRef.current) await emit(next, 'flush');
    return await publication.wait();
  });
  useImperativeHandle(actionsRef, () => ({ flush, resetDraft }), [flush, resetDraft]);
  useEditorRegistration({ flush, resetDraft });
  useEffect(() => () => publication.reset(), [publication]);
  useFormReset(inputRef, () => {
    publication.reset();
    debounced.cancel();
    pendingExternalRef.current = undefined;
    const next = value ?? defaultValue;
    draftRef.current = next;
    setDraft(next);
    if (value === undefined) void emit(next, 'reset');
  });

  const commitFromInput = (next: string, event: ChangeEvent<HTMLInputElement>) => {
    if (commitMode === 'input') void emit(next, 'input', event);
    else if (commitMode === 'debounced') debounced.schedule(next);
  };
  const clear = () => {
    debounced.cancel();
    draftRef.current = '';
    setDraft('');
    void emit('', 'clear');
    inputRef.current?.focus();
  };
  const showClear = clearButton === 'always' || (clearButton === 'auto' && draft.length > 0);
  const startButtons = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const endButtons = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (items: ReadonlyArray<CgEditorButtonDescriptor<string>>) =>
    items.map((button) => <EditorButton key={button.key} descriptor={{ ...button, onPress: async (context) => { if (await flush()) await button.onPress?.({ ...context, value: draftRef.current }); } }} value={draft} disabled={field.disabled || field.readOnly} />);

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
        aria-label={field.ariaLabel}
        aria-labelledby={field.labelledBy}
        aria-invalid={field.validationState === 'error' || undefined}
        aria-describedby={field.describedBy}
        aria-errormessage={field.errorMessageId}
        onChange={(event) => {
          const next = event.target.value;
          draftRef.current = next;
          setDraft(next);
          onChange?.(event);
          if (!composingRef.current) commitFromInput(next, event);
        }}
        onBlur={(event) => {
          if (composingRef.current) { onBlur?.(event); return; }
          if (commitMode === 'blur') void emit(draftRef.current, 'blur');
          else if (commitMode === 'debounced') debounced.flush();
          onBlur?.(event);
        }}
        onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = true;
          onCompositionStart?.(event);
        }}
        onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = false;
          if (pendingExternalRef.current !== undefined) {
            draftRef.current = pendingExternalRef.current;
            setDraft(pendingExternalRef.current);
            pendingExternalRef.current = undefined;
            onCompositionEnd?.(event);
            return;
          }
          const next = event.currentTarget.value;
          draftRef.current = next;
          setDraft(next);
          if (commitMode === 'input') void emit(next, 'input');
          else if (commitMode === 'debounced') debounced.schedule(next);
          onCompositionEnd?.(event);
        }}
      />
    </InputShell>
  );
});
