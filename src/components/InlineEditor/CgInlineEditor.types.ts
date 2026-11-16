import type { InputHTMLAttributes } from 'react';

/** How an edit ended: Enter, Tab, Shift+Tab, Escape, or focus leaving the editor. */
export type CgInlineEditEnd = 'enter' | 'tab' | 'shiftTab' | 'escape' | 'blur';

export interface CgInlineCommitDetails {
  readonly end: Exclude<CgInlineEditEnd, 'escape'>;
  /** The text typed, before it was read as a value. */
  readonly text: string;
  /** The text differs from the one the edit started from. */
  readonly changed: boolean;
}

export interface CgInlineDoneDetails {
  readonly end: CgInlineEditEnd;
  /** `onCommit` was called for this edit. */
  readonly committed: boolean;
}

export interface CgInlineEditorHandle {
  focus(): void;
  /** The text in the editor now. Reading it draws nothing. */
  readonly text: string;
}

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'onKeyDown' | 'onBlur' | 'onFocus' | 'type' | 'children' | 'aria-label' | 'autoFocus' | 'aria-invalid' | 'dangerouslySetInnerHTML'>;

export interface CgInlineEditorBaseProps<TValue> extends NativeInputProps {
  /** The accessible name, such as the column's or field's name. */
  label: string;
  /** Focus the editor when it mounts. Default true. */
  autoFocus?: boolean;
  /** On mount: select all of the text (default), or put the caret at its end, as after a typed first key. */
  initialSelection?: 'all' | 'end';
  /** The value, on Enter, Tab, Shift+Tab or leaving the editor. Escape never commits. */
  onCommit: (value: TValue, details: CgInlineCommitDetails) => void;
  /** After each edit, committed or not; a cell editor unmounts here. */
  onDone?: (details: CgInlineDoneDetails) => void;
  /** Leaving the editor commits (default). When false, it ends the edit without committing. */
  commitOnBlur?: boolean;
  /** Tab and Shift+Tab commit and end the edit, reported as `tab` or `shiftTab`, without moving focus (default). When false, Tab moves focus as usual. */
  captureTab?: boolean;
  /** Keys and pointer presses stay in the editor, so a grid or board around it does not act on them. Default true. */
  isolateEvents?: boolean;
}

export interface CgInlineTextEditorProps extends CgInlineEditorBaseProps<string> {
  /** The text the edit starts from. Later changes show only while the editor is not focused. */
  defaultValue: string;
  /** A text area: Enter commits, Shift+Enter starts a new line. */
  multiline?: boolean;
  /** Rows of a multiline editor. Default 1. */
  rows?: number;
}

export interface CgInlineNumberEditorProps extends CgInlineEditorBaseProps<number | null> {
  /** The number the edit starts from; `null` starts empty. */
  defaultValue: number | null;
  /** Shown as the editor's tooltip and error while its text does not read as a number. */
  invalidMessage: string;
  /** For reading digits, separators and signs typed in that locale. Default: the browser's. */
  locale?: string;
  /** Reads typed text: a number, `null` for empty, `undefined` when it is not a number. Default: the locale's reading, Arabic-Indic digits included. */
  parse?: (text: string) => number | null | undefined;
  /** The text a number starts as. Default `String(value)`. */
  format?: (value: number) => string;
  /** Text that does not read as a number was committed with Enter or Tab: the editor stays open. */
  onInvalidText?: (text: string) => void;
}
