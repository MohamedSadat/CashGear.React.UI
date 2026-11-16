import type { ReactNode } from 'react';
import type { CgButtonProps } from '../Button';

/** What `ref` gives. */
export interface CgFilePickerHandle {
  /** Opens the browser's file dialog, as a click on the button does. */
  open(): void;
  /** Focuses the button. */
  focus(): void;
}

export type CgFilePickerSource = 'dialog' | 'drop';

export interface CgFilePickerDetails {
  readonly source: CgFilePickerSource;
  /**
   * Each file's path, in the order of the files: its name, or with `directory`, its path below
   * the folder chosen or dropped (`notes/2026/plan.md`), with `/` between folders.
   */
  readonly paths: readonly string[];
}

export interface CgFilePickerProps extends Omit<CgButtonProps, 'onClick' | 'type' | 'children' | 'onDrop' | 'onDragOver' | 'onDragEnter' | 'onDragLeave'> {
  /** The button's content: no text is built in. */
  children: ReactNode;
  /**
   * The kinds of file taken, as `<input accept>`: extensions (`.csv`), types (`text/csv`) or
   * families (`image/*`). Dropped files are checked against it too. Default: any file.
   */
  accept?: string | readonly string[];
  /** Several files at once. Without it only the first file taken is given. */
  multiple?: boolean;
  /**
   * Chooses a folder: the dialog asks for one and gives every file in it, and folders dropped on a
   * `dropZone` are read through to their files. `accept` still filters the files; `details.paths`
   * gives each file's path below the folder.
   */
  directory?: boolean;
  /** A camera on a phone, as `<input capture>`. */
  capture?: 'user' | 'environment';
  /** The files chosen or dropped that match `accept`; never called with none. */
  onPick: (files: File[], details: CgFilePickerDetails) => void;
  /** Files chosen or dropped that do not match `accept`. */
  onReject?: (files: File[], details: CgFilePickerDetails) => void;
  /** The dialog was closed without a choice (browsers that send `cancel`). */
  onCancel?: () => void;
  /** Drawn beside the button, such as "or drop a CSV file here". */
  hint?: ReactNode;
  /** The button and its hint take dropped files. */
  dropZone?: boolean;
  /** Class name of the box holding the button and hint. `className` stays the button's. */
  containerClassName?: string;
}
