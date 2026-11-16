import { forwardRef, useMemo } from 'react';
import { createNumberFormatter, parseLocalizedNumber } from '../../internal/numeric';
import { cx } from '../../utils';
import styles from './CgInlineEditor.module.css';
import type { CgInlineEditorHandle, CgInlineNumberEditorProps } from './CgInlineEditor.types';
import { useInlineEditing } from './useInlineEditing';

/**
 * A number editor that keeps no React draft. Text that does not read as a number is marked
 * invalid on Enter or Tab and stays to be fixed; leaving the editor then puts the starting text
 * back. Empty text commits `null`.
 */
export const CgInlineNumberEditor = forwardRef<CgInlineEditorHandle, CgInlineNumberEditorProps>(function CgInlineNumberEditor(
  {
    label,
    defaultValue,
    invalidMessage,
    locale,
    parse,
    format,
    onInvalidText,
    autoFocus = true,
    initialSelection = 'all',
    onCommit,
    onDone,
    commitOnBlur = true,
    captureTab = true,
    isolateEvents = true,
    className,
    dir = 'ltr',
    inputMode = 'decimal',
    title,
    ...nativeProps
  },
  forwardedRef,
) {
  if (!label.trim()) throw new Error('CgInlineNumberEditor label cannot be empty.');
  if (!invalidMessage.trim()) throw new Error('CgInlineNumberEditor invalidMessage cannot be empty.');
  if (defaultValue !== null && !Number.isFinite(defaultValue)) throw new RangeError('CgInlineNumberEditor defaultValue must be a finite number or null.');
  const formatter = useMemo(() => createNumberFormatter({ locale, useGrouping: true }), [locale]);
  const initialText = defaultValue === null ? '' : (format ?? String)(defaultValue);
  const { fieldProps } = useInlineEditing<number | null, HTMLInputElement>({
    initialText,
    multiline: false,
    autoFocus,
    initialSelection,
    commitOnBlur,
    captureTab,
    isolateEvents,
    read: (text) => {
      const value = parse ? parse(text) : parseLocalizedNumber(text, formatter, 'decimal');
      if (value === undefined || (value !== null && !Number.isFinite(value))) return { ok: false };
      return { ok: true, value: value === 0 ? 0 : value };
    },
    onInvalid: (field) => {
      field.setAttribute('aria-invalid', 'true');
      field.title = invalidMessage;
      onInvalidText?.(field.value);
    },
    onValid: (field) => {
      field.removeAttribute('aria-invalid');
      if (title === undefined) field.removeAttribute('title');
      else field.title = title;
    },
    onCommit,
    onDone,
    handleRef: forwardedRef,
  });
  return <input
    type="text"
    autoComplete="off"
    spellCheck={false}
    {...nativeProps}
    {...fieldProps}
    title={title}
    className={cx(styles.editor, styles.number, className)}
    dir={dir}
    inputMode={inputMode}
    aria-label={label}
    data-cg-inline-editor="number"
  />;
});
