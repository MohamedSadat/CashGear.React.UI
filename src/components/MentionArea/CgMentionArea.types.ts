import type { HTMLAttributes, ReactNode } from 'react';
import type { CgCommandMenuItem } from '../CommandMenu';

/** A mention inside the area: drawn as one atom the caret steps over. */
export interface CgMentionAreaMention {
  /** What is mentioned, such as `user` or `page`. */
  kind: string;
  id: string;
  /** The text the atom shows, such as "@Layla Hassan". */
  text: string;
}

/** The area's content: text (with `\n` for line breaks) and mentions, in order. */
export type CgMentionAreaValue = ReadonlyArray<string | CgMentionAreaMention>;

export interface CgMentionAreaSuggestion<TData = unknown> extends CgCommandMenuItem<TData> {
  /** The mention this suggestion inserts. */
  mention: { kind: string; id: string };
  /** The atom's text. Default: the trigger followed by the label ("@Layla"). */
  text?: string;
}

/** What `ref` gives. Reading the value walks the area's DOM: nothing is kept in React state. */
export interface CgMentionAreaHandle {
  focus(): void;
  /** Empties the area. */
  clear(): void;
  getValue(): CgMentionAreaValue;
  setValue(value: CgMentionAreaValue): void;
}

export interface CgMentionAreaProps<TData = unknown> extends Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'defaultValue' | 'onChange' | 'onSubmit' | 'role' | 'aria-label' | 'contentEditable' | 'dangerouslySetInnerHTML'> {
  /** The area's accessible name. */
  label: string;
  placeholder?: string;
  /** The content it starts with. Later changes are the person's own; use the ref to replace it. */
  defaultValue?: CgMentionAreaValue;
  /** Characters that open the suggestion list when typed at a word start. Default `['@']`. */
  triggers?: readonly string[];
  /** The suggestions for what is typed after a trigger, grouped by their `group`. */
  suggest: (query: string, trigger: string) => ReadonlyArray<CgMentionAreaSuggestion<TData>>;
  /** The suggestion list's accessible name. */
  listLabel: string;
  /** Every input, with the area's content: cheap to ignore, read it only when needed. */
  onValueChange?: (value: CgMentionAreaValue) => void;
  /** Ctrl+Enter (⌘Enter on a Mac). */
  onSubmit?: (value: CgMentionAreaValue) => void;
  /** Escape while no list is open. */
  onCancel?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Draws a suggestion; default: the command menu's own row. */
  renderSuggestion?: (suggestion: CgMentionAreaSuggestion<TData>, active: boolean) => ReactNode;
}
