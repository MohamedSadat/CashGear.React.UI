import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cx } from '../../utils';
import styles from './CgInlineEditor.module.css';
import type { CgInlineEditorHandle, CgInlineTextEditorProps } from './CgInlineEditor.types';
import { useInlineEditing } from './useInlineEditing';

/**
 * A text editor that keeps no React draft: what is typed lives in the field until the edit ends.
 * Enter, Tab and leaving it commit; Escape puts the starting text back and commits nothing.
 */
export const CgInlineTextEditor = forwardRef<CgInlineEditorHandle, CgInlineTextEditorProps>(function CgInlineTextEditor(
  {
    label,
    defaultValue,
    multiline = false,
    rows = 1,
    autoFocus = true,
    initialSelection = 'all',
    onCommit,
    onDone,
    commitOnBlur = true,
    captureTab = true,
    isolateEvents = true,
    className,
    dir = 'auto',
    ...nativeProps
  },
  forwardedRef,
) {
  if (!label.trim()) throw new Error('CgInlineTextEditor label cannot be empty.');
  const { fieldProps } = useInlineEditing<string, HTMLInputElement & HTMLTextAreaElement>({
    initialText: defaultValue,
    multiline,
    autoFocus,
    initialSelection,
    commitOnBlur,
    captureTab,
    isolateEvents,
    read: (text) => ({ ok: true, value: text }),
    onCommit,
    onDone,
    handleRef: forwardedRef,
  });
  const shared = {
    ...nativeProps,
    ...fieldProps,
    className: cx(styles.editor, multiline && styles.multiline, className),
    dir,
    'aria-label': label,
    'data-cg-inline-editor': 'text',
  };
  if (multiline) return <textarea {...(shared as unknown as TextareaHTMLAttributes<HTMLTextAreaElement>)} ref={fieldProps.ref} rows={rows} />;
  return <input type="text" autoComplete="off" {...shared} />;
});
