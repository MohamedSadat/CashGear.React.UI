import { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { ForwardedRef, KeyboardEvent } from 'react';
import type { CgInlineCommitDetails, CgInlineDoneDetails, CgInlineEditEnd, CgInlineEditorHandle } from './CgInlineEditor.types';

type Field = HTMLInputElement | HTMLTextAreaElement;

export type InlineReading<TValue> = { ok: true; value: TValue } | { ok: false };

export interface InlineEditingOptions<TValue> {
  initialText: string;
  multiline: boolean;
  autoFocus: boolean;
  initialSelection: 'all' | 'end';
  commitOnBlur: boolean;
  captureTab: boolean;
  isolateEvents: boolean;
  read: (text: string) => InlineReading<TValue>;
  onInvalid?: (field: Field) => void;
  onValid?: (field: Field) => void;
  onCommit: (value: TValue, details: CgInlineCommitDetails) => void;
  onDone?: (details: CgInlineDoneDetails) => void;
  handleRef: ForwardedRef<CgInlineEditorHandle>;
  onFocus?: () => void;
}

/**
 * The editing rules both inline editors share. The field is uncontrolled: typing changes nothing
 * React draws, and the text is read once, when the edit ends.
 */
export function useInlineEditing<TValue, TField extends Field>(options: InlineEditingOptions<TValue>) {
  const fieldRef = useRef<TField>(null);
  const doneRef = useRef(false);
  const optionsRef = useRef(options);
  useLayoutEffect(() => { optionsRef.current = options; });
  const startTextRef = useRef(options.initialText);

  useImperativeHandle(options.handleRef, () => ({
    focus() { fieldRef.current?.focus({ preventScroll: true }); },
    get text() { return fieldRef.current?.value ?? ''; },
  }), []);

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || !optionsRef.current.autoFocus) return;
    field.focus({ preventScroll: true });
    if (optionsRef.current.initialSelection === 'all') field.select();
    else field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  // A new starting text shows while the editor is not being typed in.
  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field || field.ownerDocument.activeElement === field) return;
    field.value = options.initialText;
    startTextRef.current = options.initialText;
  }, [options.initialText]);

  const finish = (end: CgInlineEditEnd): boolean => {
    const field = fieldRef.current;
    const current = optionsRef.current;
    if (doneRef.current || !field) return true;
    let committed = false;
    if (end === 'escape') {
      field.value = startTextRef.current;
    } else if (end !== 'blur' || current.commitOnBlur) {
      const reading = current.read(field.value);
      if (!reading.ok) {
        if (end !== 'blur') {
          current.onInvalid?.(field);
          return false;
        }
        field.value = startTextRef.current;
      } else {
        current.onCommit(reading.value, Object.freeze({ end, text: field.value, changed: field.value !== startTextRef.current }));
        committed = true;
      }
    }
    doneRef.current = true;
    current.onValid?.(field);
    current.onDone?.(Object.freeze({ end, committed }));
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<TField>) => {
    const current = optionsRef.current;
    if (current.isolateEvents) event.stopPropagation();
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const ending = event.key === 'Escape' || event.key === 'Enter' || (event.key === 'Tab' && current.captureTab);
    // An editor that stays focused after an edit ended starts the next one at the next key.
    if (doneRef.current && !ending && fieldRef.current) {
      doneRef.current = false;
      startTextRef.current = fieldRef.current.value;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      finish('escape');
    } else if (event.key === 'Enter' && !(current.multiline && event.shiftKey)) {
      event.preventDefault();
      finish('enter');
    } else if (event.key === 'Tab' && current.captureTab) {
      event.preventDefault();
      finish(event.shiftKey ? 'shiftTab' : 'tab');
    } else if (fieldRef.current?.hasAttribute('aria-invalid')) {
      current.onValid?.(fieldRef.current);
    }
  };

  return {
    fieldRef,
    fieldProps: {
      ref: fieldRef,
      defaultValue: options.initialText,
      onKeyDown,
      onBlur: () => { finish('blur'); },
      onFocus: () => {
        // An editor that stays mounted starts a new edit each time it is focused.
        if (doneRef.current && fieldRef.current) {
          doneRef.current = false;
          startTextRef.current = fieldRef.current.value;
        }
        optionsRef.current.onFocus?.();
      },
      onPointerDown: (event: { stopPropagation(): void }) => { if (optionsRef.current.isolateEvents) event.stopPropagation(); },
      onMouseDown: (event: { stopPropagation(): void }) => { if (optionsRef.current.isolateEvents) event.stopPropagation(); },
    },
  };
}
