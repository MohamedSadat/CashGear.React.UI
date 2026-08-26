import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  ChangeEvent,
  ClipboardEvent,
  CompositionEvent,
  FocusEvent,
  FormEvent,
  InputEvent as ReactInputEvent,
  KeyboardEvent,
  PointerEvent,
  SyntheticEvent,
  TouchEvent,
} from 'react';
import { useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import {
  applyMaskText,
  compileMask,
  displayMaskState,
  emptyMaskState,
  InputShell,
  maskBoundValue,
  maskCaretPosition,
  maskEndSlot,
  maskFormattedValue,
  maskIsComplete,
  maskIsEmpty,
  maskIsValid,
  maskRawValue,
  maskSelectedSlots,
  maskStateSignature,
  maskTargetSlot,
  maskTokenIndexAtPosition,
  maskTokenIndexForSlot,
  normalizeMaskValue,
  sameMaskSlots,
  useFieldControl,
  validatePromptCharacter,
} from '../../internal';
import type { CompiledMask, MaskState } from '../../internal';
import { cx } from '../../utils';
import styles from './CgMaskedInput.module.css';
import type {
  CgMaskedInputChangeReason,
  CgMaskedInputCommitDetails,
  CgMaskedInputFocusDetails,
  CgMaskedInputProps,
  CgMaskedInputStateDetails,
  CgMaskedInputTransitionDetails,
  CgMaskedInputValueChangeDetails,
} from './CgMaskedInput.types';

function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? [...new Set(ids)].join(' ') : undefined;
}

function stateDetails(
  definition: CompiledMask,
  state: MaskState,
  promptCharacter: string,
  showMask: CgMaskedInputProps['showMask'],
  focused: boolean,
  includeLiterals: boolean,
  required: boolean,
  allowIncomplete: boolean,
  fieldInvalid: boolean,
): CgMaskedInputStateDetails {
  return {
    value: maskBoundValue(definition, state, includeLiterals),
    rawValue: maskRawValue(state),
    formattedValue: maskFormattedValue(definition, state),
    displayValue: displayMaskState(definition, state, promptCharacter, showMask ?? 'onFocus', focused).text,
    isEmpty: maskIsEmpty(state),
    isComplete: maskIsComplete(definition, state),
    isValid: maskIsValid(definition, state, required, allowIncomplete) && !fieldInvalid,
    invalidExternalValue: state.invalidExternal,
    rejectedCharacters: state.issues.map((issue) => issue.character),
  };
}

export const CgMaskedInput = forwardRef<HTMLInputElement, CgMaskedInputProps>(function CgMaskedInput(
  {
    mask,
    value,
    defaultValue = '',
    onValueChange,
    onValueCommitted,
    onComplete,
    onIncomplete,
    onMaskedFocus,
    onMaskedBlur,
    promptCharacter = '_',
    showMask = 'onFocus',
    includeLiterals = true,
    allowIncomplete = false,
    requiredMessage = 'A value is required.',
    incompleteMessage = 'Complete all required mask positions.',
    invalidValueMessage = 'The value contains characters that do not match the mask.',
    validationState = 'none',
    size = 'medium',
    density = 'comfortable',
    direction = 'auto',
    fullWidth = false,
    id,
    name,
    form,
    required,
    disabled,
    readOnly,
    className,
    style,
    'data-testid': testId,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onBeforeInput,
    onInput,
    onChange,
    onKeyDown,
    onPaste,
    onCut,
    onFocus,
    onBlur,
    onCompositionStart,
    onCompositionEnd,
    onPointerUp,
    onTouchEnd,
    onInvalid,
    ...nativeProps
  },
  forwardedRef,
) {
  const definition = useMemo(() => compileMask(mask), [mask]);
  const prompt = useMemo(() => validatePromptCharacter(promptCharacter), [promptCharacter]);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const proxyRef = useRef<HTMLSelectElement>(null);
  const mergedRef = useMergedRefs(inputRef, forwardedRef);
  const resolvedDirection = useDirection(inputRef, direction);
  const controlled = value !== undefined;
  const externalState = useMemo(() => normalizeMaskValue(definition, prompt, value), [definition, prompt, value]);
  const [uncontrolledState, setUncontrolledState] = useState<MaskState>(() => normalizeMaskValue(definition, prompt, defaultValue));
  const uncontrolledConfigurationRef = useRef(`${definition.source}\u0000${prompt}`);
  const currentConfiguration = `${definition.source}\u0000${prompt}`;
  const adjustedUncontrolledState = uncontrolledConfigurationRef.current === currentConfiguration
    ? uncontrolledState
    : normalizeMaskValue(definition, prompt, maskRawValue(uncontrolledState));
  const authoritativeState = controlled ? externalState : adjustedUncontrolledState;
  const [draftState, setDraftState] = useState(authoritativeState);
  const [focused, setFocused] = useState(false);
  const authoritativeRef = useRef(authoritativeState);
  const draftRef = useRef(draftState);
  const focusedRef = useRef(false);
  const configurationRevisionRef = useRef(0);
  const editRevisionRef = useRef(0);
  const compositionRef = useRef<{ revision: number; start: number; end: number } | undefined>(undefined);
  const pendingControlledRef = useRef<{
    signature: string;
    previousComplete: boolean;
    reason: CgMaskedInputChangeReason;
    event?: SyntheticEvent<HTMLInputElement>;
  } | undefined>(undefined);
  const previousExternalKeyRef = useRef('');
  const errorId = `${field.id}-mask-error`;

  const emitTransition = useStableCallback((previousComplete: boolean, next: MaskState, reason: CgMaskedInputChangeReason, event?: SyntheticEvent<HTMLInputElement>) => {
    const complete = maskIsComplete(definition, next);
    if (complete === previousComplete) return;
    const details: CgMaskedInputTransitionDetails = {
      ...stateDetails(definition, next, prompt, showMask, focusedRef.current, includeLiterals, field.required, allowIncomplete, field.validationState === 'error'),
      reason,
      event,
    };
    if (complete) onComplete?.(details);
    else onIncomplete?.(details);
  });

  const scheduleCaret = useStableCallback((state: MaskState, slot: number) => {
    queueMicrotask(() => {
      const input = inputRef.current;
      if (!input || document.activeElement !== input) return;
      const display = displayMaskState(definition, state, prompt, showMask, focusedRef.current);
      const position = maskCaretPosition(display, state, slot);
      try { input.setSelectionRange(position, position); } catch { /* Unsupported input selection is harmless. */ }
    });
  });

  useLayoutEffect(() => {
    authoritativeRef.current = authoritativeState;
    draftRef.current = draftState;
    focusedRef.current = focused;
  }, [authoritativeState, draftState, focused]);

  const externalKey = `${currentConfiguration}\u0000${resolvedDirection}\u0000${controlled ? `${value ?? ''}\u0000${maskStateSignature(externalState)}` : ''}`;
  useLayoutEffect(() => {
    if (previousExternalKeyRef.current === externalKey) return;
    previousExternalKeyRef.current = externalKey;
    configurationRevisionRef.current += 1;
    editRevisionRef.current += 1;
    uncontrolledConfigurationRef.current = currentConfiguration;
    if (!controlled && adjustedUncontrolledState !== uncontrolledState) setUncontrolledState(adjustedUncontrolledState);
    const input = inputRef.current;
    const oldDisplay = displayMaskState(definition, draftRef.current, prompt, showMask, focusedRef.current);
    const targetSlot = input ? maskTargetSlot(oldDisplay, definition, draftRef.current, input.selectionStart ?? 0) : maskEndSlot(authoritativeState);
    if (!sameMaskSlots(draftRef.current, authoritativeState)) {
      draftRef.current = authoritativeState;
      setDraftState(authoritativeState);
      scheduleCaret(authoritativeState, Math.min(targetSlot, authoritativeState.slots.length));
    }
    if (controlled && pendingControlledRef.current) {
      const pending = pendingControlledRef.current;
      pendingControlledRef.current = undefined;
      if (pending.signature === maskStateSignature(authoritativeState)) {
        emitTransition(pending.previousComplete, authoritativeState, pending.reason, pending.event);
      }
    }
  }, [adjustedUncontrolledState, authoritativeState, controlled, currentConfiguration, definition, emitTransition, externalKey, prompt, scheduleCaret, showMask, uncontrolledState]);

  const detailsFor = useStableCallback((state: MaskState) => stateDetails(
    definition,
    state,
    prompt,
    showMask,
    focusedRef.current,
    includeLiterals,
    field.required,
    allowIncomplete,
    field.validationState === 'error',
  ));

  const proposeState = useStableCallback((next: MaskState, reason: CgMaskedInputChangeReason, event?: SyntheticEvent<HTMLInputElement>, caretSlot?: number) => {
    const previous = authoritativeRef.current;
    const previousComplete = maskIsComplete(definition, previous);
    const revision = configurationRevisionRef.current;
    const editRevision = ++editRevisionRef.current;
    draftRef.current = next;
    setDraftState(next);
    if (!controlled) {
      authoritativeRef.current = next;
      setUncontrolledState(next);
      emitTransition(previousComplete, next, reason, event);
    } else {
      pendingControlledRef.current = { signature: maskStateSignature(next), previousComplete, reason, event };
    }
    const details: CgMaskedInputValueChangeDetails = { ...detailsFor(next), reason, event };
    onValueChange?.(details.value, details);
    if (caretSlot !== undefined) scheduleCaret(next, caretSlot);
    if (controlled) {
      queueMicrotask(() => {
        if (configurationRevisionRef.current !== revision || editRevisionRef.current !== editRevision) return;
        if (pendingControlledRef.current?.signature === maskStateSignature(next)) pendingControlledRef.current = undefined;
        const restored = authoritativeRef.current;
        draftRef.current = restored;
        setDraftState(restored);
        if (caretSlot !== undefined) scheduleCaret(restored, Math.min(caretSlot, restored.slots.length));
      });
    }
  });

  const currentDisplay = () => displayMaskState(definition, draftRef.current, prompt, showMask, focusedRef.current);
  const currentSelection = () => ({ start: inputRef.current?.selectionStart ?? 0, end: inputRef.current?.selectionEnd ?? inputRef.current?.selectionStart ?? 0 });
  const insertText = useStableCallback((text: string, reason: CgMaskedInputChangeReason, event?: SyntheticEvent<HTMLInputElement>, selection: { start: number; end: number } = currentSelection()) => {
    const display = currentDisplay();
    const selected = maskSelectedSlots(display, selection.start, selection.end);
    const startTokenIndex = selection.start !== selection.end
      ? maskTokenIndexAtPosition(display, definition, draftRef.current, selection.start)
      : maskTokenIndexForSlot(definition, maskTargetSlot(display, definition, draftRef.current, selection.start));
    const result = applyMaskText(definition, draftRef.current, prompt, text, startTokenIndex, selected);
    if (result.accepted === 0) {
      scheduleCaret(draftRef.current, result.nextSlot);
      return;
    }
    proposeState(result.state, reason, event, result.nextSlot);
  });

  const clearSlots = useStableCallback((slots: ReadonlyArray<number>, caretSlot: number, reason: CgMaskedInputChangeReason, event?: SyntheticEvent<HTMLInputElement>) => {
    if (slots.length === 0 || !slots.some((slot) => draftRef.current.slots[slot] !== null)) {
      scheduleCaret(draftRef.current, caretSlot);
      return;
    }
    const next: MaskState = {
      slots: draftRef.current.slots.map((value, index) => slots.includes(index) ? null : value),
      issues: [],
      invalidExternal: false,
    };
    proposeState(next, reason, event, caretSlot);
  });

  const deleteSelection = useStableCallback((backward: boolean, event: SyntheticEvent<HTMLInputElement>) => {
    const selection = currentSelection();
    const display = currentDisplay();
    const selected = maskSelectedSlots(display, selection.start, selection.end);
    if (selected.length > 0) {
      clearSlots(selected, selected[0] ?? 0, 'delete', event);
      return;
    }
    const target = maskTargetSlot(display, definition, draftRef.current, selection.start);
    const slot = backward ? Math.min(draftRef.current.slots.length - 1, target - 1) : target;
    if (slot >= 0 && slot < draftRef.current.slots.length) clearSlots([slot], slot, 'delete', event);
  });

  useFormReset(inputRef, () => {
    if (controlled) {
      draftRef.current = authoritativeRef.current;
      setDraftState(authoritativeRef.current);
      return;
    }
    const next = normalizeMaskValue(definition, prompt, defaultValue);
    proposeState(next, 'reset');
  });

  const internalMessage = authoritativeState.invalidExternal
    ? invalidValueMessage
    : maskIsEmpty(authoritativeState) && field.required
      ? requiredMessage
      : !maskIsEmpty(authoritativeState) && !allowIncomplete && !maskIsComplete(definition, authoritativeState)
        ? incompleteMessage
        : undefined;
  const effectiveValidation = internalMessage ? 'error' : field.validationState;
  const describedBy = joinIds(field.describedBy, internalMessage ? errorId : undefined);
  const display = displayMaskState(definition, draftState, prompt, showMask, focused);
  const committedValue = maskBoundValue(definition, authoritativeState, includeLiterals);
  const serializedValues = committedValue ? [committedValue] : [];

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(internalMessage ?? '');
    return () => input.setCustomValidity('');
  }, [internalMessage]);

  const commit = (reason: 'blur' | 'enter', event: SyntheticEvent<HTMLInputElement>) => {
    const state = authoritativeRef.current;
    const details: CgMaskedInputCommitDetails = { ...detailsFor(state), reason, event };
    onValueCommitted?.(details.value, details);
  };

  const snapCaret = () => {
    queueMicrotask(() => {
      const selection = currentSelection();
      if (selection.start !== selection.end) return;
      scheduleCaret(draftRef.current, maskTargetSlot(currentDisplay(), definition, draftRef.current, selection.start));
    });
  };

  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density}>
      <InputShell
        size={size}
        validationState={effectiveValidation}
        disabled={field.disabled}
        readOnly={field.readOnly}
        className={cx(styles.control, className)}
        style={style}
        data-testid={testId}
      >
        <input
          {...nativeProps}
          ref={mergedRef}
          id={field.id}
          className={styles.input}
          type="text"
          dir={resolvedDirection}
          value={display.text}
          form={form}
          required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          aria-required={field.required || undefined}
          aria-label={field.ariaLabel}
          aria-labelledby={field.labelledBy}
          aria-invalid={effectiveValidation === 'error' || undefined}
          aria-describedby={describedBy}
          aria-errormessage={internalMessage ? errorId : field.errorMessageId}
          data-cg-masked-input=""
          onBeforeInput={(event: ReactInputEvent<HTMLInputElement>) => {
            onBeforeInput?.(event);
            if (event.defaultPrevented || field.disabled || field.readOnly || compositionRef.current) return;
            const inputEvent = event.nativeEvent;
            if ((inputEvent.inputType === 'insertText' || inputEvent.inputType === 'insertReplacementText') && inputEvent.data !== null) {
              event.preventDefault();
              insertText(inputEvent.data, 'input', event);
            } else if (inputEvent.inputType === 'deleteContentBackward' || inputEvent.inputType === 'deleteContentForward' || inputEvent.inputType === 'deleteByCut') {
              event.preventDefault();
              deleteSelection(inputEvent.inputType === 'deleteContentBackward', event);
            }
          }}
          onInput={onInput}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange?.(event);
            if (compositionRef.current || field.disabled || field.readOnly) return;
            const nextText = event.currentTarget.value;
            if (!nextText) {
              proposeState(emptyMaskState(definition), 'input', event, 0);
              return;
            }
            const result = applyMaskText(definition, emptyMaskState(definition), prompt, nextText, 0);
            if (result.accepted > 0) proposeState(result.state, 'input', event, result.nextSlot);
            else scheduleCaret(draftRef.current, maskTargetSlot(currentDisplay(), definition, draftRef.current, event.currentTarget.selectionStart ?? 0));
          }}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (!field.disabled && !field.readOnly && !compositionRef.current && !event.altKey && !event.ctrlKey && !event.metaKey) {
              const selection = currentSelection();
              const target = maskTargetSlot(currentDisplay(), definition, draftRef.current, event.key === 'ArrowRight' ? selection.end : selection.start);
              if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                deleteSelection(event.key === 'Backspace', event);
              } else if (event.key === 'Home' && !event.shiftKey) {
                event.preventDefault();
                scheduleCaret(draftRef.current, 0);
              } else if (event.key === 'End' && !event.shiftKey) {
                event.preventDefault();
                scheduleCaret(draftRef.current, maskEndSlot(draftRef.current));
              } else if (event.key === 'ArrowLeft' && !event.shiftKey) {
                event.preventDefault();
                scheduleCaret(draftRef.current, Math.max(0, target - 1));
              } else if (event.key === 'ArrowRight' && !event.shiftKey) {
                event.preventDefault();
                scheduleCaret(draftRef.current, Math.min(draftRef.current.slots.length, target + 1));
              } else if (event.key === 'Enter') commit('enter', event);
            }
            onKeyDown?.(event);
          }}
          onPaste={(event: ClipboardEvent<HTMLInputElement>) => {
            onPaste?.(event);
            if (event.defaultPrevented || field.disabled || field.readOnly || compositionRef.current) return;
            event.preventDefault();
            insertText(event.clipboardData.getData('text'), 'paste', event);
          }}
          onCut={(event: ClipboardEvent<HTMLInputElement>) => {
            onCut?.(event);
            if (event.defaultPrevented || field.disabled || field.readOnly || compositionRef.current) return;
            const selection = currentSelection();
            if (selection.start === selection.end) return;
            event.preventDefault();
            event.clipboardData.setData('text/plain', display.text.slice(selection.start, selection.end));
            const selected = maskSelectedSlots(currentDisplay(), selection.start, selection.end);
            clearSlots(selected, selected[0] ?? 0, 'cut', event);
          }}
          onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => {
            const selection = currentSelection();
            compositionRef.current = { revision: configurationRevisionRef.current, ...selection };
            onCompositionStart?.(event);
          }}
          onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
            const composition = compositionRef.current;
            compositionRef.current = undefined;
            if (composition?.revision === configurationRevisionRef.current && !field.disabled && !field.readOnly) {
              insertText(event.data, 'composition', event, composition);
            }
            onCompositionEnd?.(event);
          }}
          onFocus={(event: FocusEvent<HTMLInputElement>) => {
            const target = maskTargetSlot(currentDisplay(), definition, draftRef.current, event.currentTarget.selectionStart ?? 0);
            focusedRef.current = true;
            setFocused(true);
            scheduleCaret(draftRef.current, target);
            const details: CgMaskedInputFocusDetails = { ...detailsFor(authoritativeRef.current), reason: 'focus', event };
            onMaskedFocus?.(details);
            onFocus?.(event);
          }}
          onBlur={(event: FocusEvent<HTMLInputElement>) => {
            focusedRef.current = false;
            setFocused(false);
            commit('blur', event);
            const details: CgMaskedInputFocusDetails = { ...detailsFor(authoritativeRef.current), reason: 'blur', event };
            onMaskedBlur?.(details);
            onBlur?.(event);
          }}
          onPointerUp={(event: PointerEvent<HTMLInputElement>) => { onPointerUp?.(event); if (!event.defaultPrevented) snapCaret(); }}
          onTouchEnd={(event: TouchEvent<HTMLInputElement>) => { onTouchEnd?.(event); if (!event.defaultPrevented) snapCaret(); }}
          onInvalid={(event: FormEvent<HTMLInputElement>) => {
            onInvalid?.(event);
            if (!event.defaultPrevented) inputRef.current?.focus({ preventScroll: true });
          }}
        />
      </InputShell>
      <select
        ref={proxyRef}
        className={styles.formProxy}
        name={name}
        form={form}
        multiple
        disabled={field.disabled}
        value={serializedValues}
        tabIndex={-1}
        aria-hidden="true"
        data-cg-masked-input-form-proxy=""
        onChange={() => undefined}
      >
        {serializedValues.map((serialized) => <option key={serialized} value={serialized}>{serialized}</option>)}
      </select>
      {internalMessage ? <div id={errorId} className={styles.validationMessage} role="alert">{internalMessage}</div> : null}
    </div>
  );
});
