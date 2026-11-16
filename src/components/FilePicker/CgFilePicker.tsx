import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { acceptTokens, fileMatches } from './accept';
import { droppedFiles } from './folderEntries';
import type { PathedFile } from './folderEntries';
import styles from './CgFilePicker.module.css';
import type { CgFilePickerHandle, CgFilePickerProps, CgFilePickerSource } from './CgFilePicker.types';

const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');

/**
 * A button that opens the browser's file dialog and gives the files chosen, and nothing else: it
 * reads, uploads and keeps nothing. With `dropZone`, files dropped on it are given the same way.
 */
export const CgFilePicker = forwardRef<CgFilePickerHandle, CgFilePickerProps>(function CgFilePicker(
  { children, accept, multiple = false, directory = false, capture, onPick, onReject, onCancel, hint, dropZone = false, containerClassName, disabled = false, ...buttonProps },
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

  // A folder dialog is asked for through the non-standard attribute every current browser reads.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.toggleAttribute('webkitdirectory', directory);
  }, [directory]);

  const give = (pathed: readonly PathedFile[], source: CgFilePickerSource) => {
    if (!pathed.length) return;
    const several = multiple || directory;
    const taken = pathed.filter(({ file }) => fileMatches(file, tokens));
    const rejected = pathed.filter(({ file }) => !fileMatches(file, tokens));
    const given = several ? taken : taken.slice(0, 1);
    if (rejected.length) onReject?.(rejected.map(({ file }) => file), Object.freeze({ source, paths: Object.freeze(rejected.map(({ path }) => path)) }));
    if (given.length) onPick(given.map(({ file }) => file), Object.freeze({ source, paths: Object.freeze(given.map(({ path }) => path)) }));
  };
  const flat = (files: readonly File[]): PathedFile[] => files.map((file) => ({ file, path: file.webkitRelativePath || file.name }));

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
      const files = Array.from(event.dataTransfer.files);
      if (!directory) { give(flat(files), 'drop'); return; }
      // Dropped folders are read through to their files, each with its path below the drop.
      void droppedFiles(event.dataTransfer.items).then(
        (pathed) => give(pathed ?? flat(files), 'drop'),
        () => give(flat(files), 'drop'),
      );
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
      multiple={multiple || directory}
      capture={capture}
      tabIndex={-1}
      aria-hidden="true"
      disabled={disabled}
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        // Cleared, so choosing the same file again is still a change.
        event.currentTarget.value = '';
        give(flat(files), 'dialog');
      }}
    />
    <CgButton {...buttonProps} ref={buttonRef} disabled={disabled} onClick={() => inputRef.current?.click()}>{children}</CgButton>
    {hint !== undefined ? <span className={styles.hint}>{hint}</span> : null}
  </span>;
});
