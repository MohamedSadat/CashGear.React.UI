import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { acceptTokens, fileMatches } from './accept';
import styles from './CgFilePicker.module.css';
import type { CgFilePickerHandle, CgFilePickerProps, CgFilePickerSource } from './CgFilePicker.types';

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/**
 * A button that opens the browser's file dialog and gives the files chosen, and nothing else: it
 * reads, uploads and keeps nothing. With `dropZone`, files dropped on it are given the same way.
 */
export const CgFilePicker = forwardRef<CgFilePickerHandle, CgFilePickerProps>(function CgFilePicker(
  { children, accept, multiple = false, capture, onPick, onReject, onCancel, hint, dropZone = false, containerClassName, disabled = false, ...buttonProps },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const tokens = acceptTokens(accept);
  const disabledRef = useRef(disabled);
  useEffect(() => { disabledRef.current = disabled; }, [disabled]);

  useImperativeHandle(forwardedRef, () => ({
    open() { if (!disabledRef.current) inputRef.current?.click(); },
    focus() { buttonRef.current?.focus(); },
  }), []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !onCancel) return undefined;
    const cancel = () => onCancel();
    input.addEventListener('cancel', cancel);
    return () => input.removeEventListener('cancel', cancel);
  }, [onCancel]);

  const give = (files: File[], source: CgFilePickerSource) => {
    if (!files.length) return;
    const taken = files.filter((file) => fileMatches(file, tokens));
    const rejected = files.filter((file) => !fileMatches(file, tokens));
    const details = Object.freeze({ source });
    if (rejected.length) onReject?.(rejected, details);
    if (taken.length) onPick(multiple ? taken : taken.slice(0, 1), details);
  };

  const dropHandlers = dropZone && !disabled ? {
    onDragEnter: (event: DragEvent) => { if (carriesFiles(event)) { event.preventDefault(); setDragOver(true); } },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (event: DragEvent) => {
      if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
      setDragOver(false);
    },
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragOver(false);
      give(Array.from(event.dataTransfer.files), 'drop');
    },
  } : {};

  return <span
    className={cx(styles.root, dropZone && styles.dropZone, containerClassName)}
    data-cg-file-picker=""
    data-drag-over={dragOver ? '' : undefined}
    {...dropHandlers}
  >
    <input
      ref={inputRef}
      className={styles.input}
      type="file"
      accept={tokens.length ? tokens.join(',') : undefined}
      multiple={multiple}
      capture={capture}
      tabIndex={-1}
      aria-hidden="true"
      disabled={disabled}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        // Cleared, so choosing the same file again is still a change.
        event.currentTarget.value = '';
        give(files, 'dialog');
      }}
    />
    <CgButton {...buttonProps} ref={buttonRef} disabled={disabled} onClick={() => inputRef.current?.click()}>{children}</CgButton>
    {hint !== undefined ? <span className={styles.hint}>{hint}</span> : null}
  </span>;
});
