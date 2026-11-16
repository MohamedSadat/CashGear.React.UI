import type { HTMLAttributes, ReactNode } from 'react';

export interface CgOptionPickerOption {
  key: string;
  name: string;
  /** A key of `colours`. */
  colour?: string;
  /** A key of `groups`. */
  group?: string;
}

export interface CgOptionPickerColour {
  key: string;
  /** The colour's name, as in "Red". */
  label: string;
  /** The chip's background, any CSS colour or token. */
  background: string;
  /** The chip's text colour. Default: the theme's text. */
  text?: string;
}

export interface CgOptionPickerGroup {
  key: string;
  label: string;
}

export type CgOptionPickerChange =
  | { readonly kind: 'create'; readonly key: string }
  | { readonly kind: 'rename' | 'recolour' | 'regroup' | 'delete'; readonly key: string }
  | { readonly kind: 'reorder'; readonly key: string; readonly toIndex: number };

/** Every string the picker shows or names; none is built in. */
export interface CgOptionPickerLabels {
  /** The search box's name and placeholder while options can be created, as "Search or create". */
  search: string;
  /** The search box's name and placeholder otherwise, as "Search". */
  searchOnly?: string;
  /** The list's accessible name. */
  list: string;
  /** The row that creates an option from the text typed. */
  create: (name: string) => string;
  /** Nothing matches the text typed. */
  noMatch: string;
  /** There are no options. */
  none: string;
  /** The option editor's name and the tooltip of its button (F2 opens it from the keyboard). */
  optionMenu: (name: string) => string;
  /** The tooltip of an option's drag handle (Alt+arrows move it from the keyboard). */
  drag: (name: string) => string;
  /** A chip's remove button. */
  remove: (name: string) => string;
  /** The editor's back button. */
  back: string;
  /** The editor's name field. */
  name: string;
  /** The editor's colour choices. */
  colour: string;
  /** The editor's group choices. */
  group: string;
  /** The editor's delete button. */
  delete: string;
  /** Spoken after a move, such as "Done moved to 2 of 4". */
  moved?: (name: string, toIndex: number, count: number) => string;
}

export interface CgOptionPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'dangerouslySetInnerHTML'> {
  options: readonly CgOptionPickerOption[];
  /** The chosen options' keys. */
  selected: readonly string[];
  /** Several options at once. Default false: choosing one replaces the choice. */
  multiple?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  /** Options can be created, renamed, recoloured, regrouped, reordered and deleted. Default false. */
  canManage?: boolean;
  /** The options after a change made here, written by the caller. */
  onOptionsChange?: (options: CgOptionPickerOption[], change: CgOptionPickerChange) => void;
  /**
   * Makes the option created from typed text. Default: a random key, the least-used colour and
   * the first group.
   */
  createOption?: (name: string) => CgOptionPickerOption;
  colours?: readonly CgOptionPickerColour[];
  /** Options are listed under these, in this order (a status's To do, In progress, Done). */
  groups?: readonly CgOptionPickerGroup[];
  /** Only managing the options: choosing one opens its editor. */
  manage?: boolean;
  /** The search text it starts with, such as a key typed on a cell. */
  defaultQuery?: string;
  labels: CgOptionPickerLabels;
  /** Draws an option's chip; default: its name on its colour. */
  renderChip?: (option: CgOptionPickerOption) => ReactNode;
  /**
   * Folds text for matching, applied to the query and to each option's name (an app's own rule,
   * such as Arabic alef forms, ى and ی as ي, ة as ه and Arabic-Indic digits). A name that folds to
   * the typed text is not offered again as new. Default: case and Arabic marks ignored.
   */
  normalize?: (text: string) => string;
  /** Decides which options match the query, in place of the default and of `normalize`. */
  filter?: (option: CgOptionPickerOption, query: string) => boolean;
}

export interface CgItemPickerItem {
  key: string;
  label: string;
  /** What the list draws for it. Default: the label. */
  content?: ReactNode;
}

export interface CgItemPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'dangerouslySetInnerHTML'> {
  /** The results for `query`, found by the caller. */
  items: readonly CgItemPickerItem[];
  selected: readonly string[];
  multiple?: boolean;
  onSelectionChange: (keys: string[]) => void;
  /** A chosen item's chip; it may not be among `items`. */
  chip: (key: string) => { label: string; content?: ReactNode };
  query: string;
  onQueryChange: (query: string) => void;
  searchLabel: string;
  listLabel: string;
  emptyText: ReactNode;
  /** A chip's remove button. */
  removeLabel: (label: string) => string;
  loading?: boolean;
  loadingText?: ReactNode;
  /** A note under the list, such as a limit reached. */
  note?: ReactNode;
}
