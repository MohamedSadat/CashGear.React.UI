import type { CSSProperties, FormEventHandler, HTMLAttributes, Ref } from 'react';
import type { CgDirection, CgTextCommitMode } from '../../types';

export type CgRichTextEditorChangeReason = 'input' | 'debounce' | 'blur' | 'flush' | 'reset';
export type CgRichTextEditorErrorPhase = 'initialization' | 'commit' | 'command';
export type CgRichTextEditorCommand =
  | 'undo' | 'redo' | 'bold' | 'italic' | 'underline' | 'strike'
  | 'left' | 'center' | 'right' | 'justify'
  | 'bulletList' | 'orderedList' | 'indent' | 'outdent' | 'clear'
  | 'link' | 'unlink' | 'image' | 'table' | 'rule'
  | 'addRowBefore' | 'addRowAfter' | 'deleteRow'
  | 'addColumnBefore' | 'addColumnAfter' | 'deleteColumn'
  | 'toggleHeaderRow' | 'mergeCells' | 'splitCell' | 'deleteTable';

export interface CgRichTextEditorChangeDetails {
  readonly reason: CgRichTextEditorChangeReason;
}

export interface CgRichTextEditorErrorDetails {
  readonly phase: CgRichTextEditorErrorPhase;
  readonly error: unknown;
}

export interface CgRichTextEditorLabels {
  commandLabels: Readonly<Record<CgRichTextEditorCommand, string>>;
  homeTab: string;
  insertTab: string;
  tableTab: string;
  paragraphStyle: string;
  normal: string;
  heading1: string;
  heading2: string;
  heading3: string;
  fontFamily: string;
  defaultFont: string;
  fontSize: string;
  defaultSize: string;
  textColor: string;
  highlightColor: string;
  formattingToolbar: string;
  insertToolbar: string;
  tableToolbar: string;
  moreCommands: string;
  linkDialogTitle: string;
  imageDialogTitle: string;
  tableDialogTitle: string;
  url: string;
  alternativeText: string;
  rows: string;
  columns: string;
  cancel: string;
  apply: string;
  invalidTable: string;
  invalidLinkUrl: string;
  invalidImageUrl: string;
  loading: string;
  loadError: string;
  documentStatistics: string;
  words: (count: number) => string;
  characters: (count: number) => string;
  disabledStatus: string;
  readOnlyStatus: string;
  documentStatus: string;
}

export type CgRichTextEditorLabelOverrides = Partial<Omit<CgRichTextEditorLabels, 'commandLabels'>> & {
  commandLabels?: Partial<CgRichTextEditorLabels['commandLabels']>;
};

export interface CgRichTextEditorActions {
  focus: () => void;
  getHtml: () => string;
  flush: () => Promise<void>;
}

type NativeRichTextEditorProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange' | 'onInput' | 'onError' | 'onInvalid' | 'dir'>;

export interface CgRichTextEditorProps extends NativeRichTextEditorProps {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string, details: CgRichTextEditorChangeDetails) => void | PromiseLike<void>;
  commitMode?: CgTextCommitMode;
  inputDelay?: number;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  height?: CSSProperties['height'];
  showRibbon?: boolean;
  showStatusBar?: boolean;
  direction?: CgDirection;
  inputId?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  name?: string;
  form?: string;
  required?: boolean;
  onInvalid?: FormEventHandler<HTMLTextAreaElement>;
  labels?: CgRichTextEditorLabelOverrides;
  actionsRef?: Ref<CgRichTextEditorActions>;
  onError?: (details: CgRichTextEditorErrorDetails) => void;
}
