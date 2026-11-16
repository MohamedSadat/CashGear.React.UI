import type { HTMLAttributes } from 'react';

export interface CgEmojiPickerItem {
  /** The emoji as text, drawn by the system's emoji font. */
  emoji: string;
  /** Its accessible name and tooltip, in the reader's language. */
  name: string;
  /** More words the search matches. */
  keywords?: readonly string[];
  /** A key of `groups`. */
  group?: string;
}

export interface CgEmojiPickerGroup {
  key: string;
  label: string;
}

export interface CgEmojiPickerLabels {
  /** The search box's accessible name and placeholder. */
  search: string;
  /** The emoji grid's accessible name, as "Icons". */
  grid: string;
  /** Nothing matches the search. */
  noMatch: string;
  /** The heading of `recent`. Needed with `recent`. */
  recent?: string;
  /** The button that removes the current icon. Shown when given. */
  remove?: string;
}

export interface CgEmojiPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect' | 'dangerouslySetInnerHTML'> {
  /** The emoji offered, such as `cgPageIcons('ar').items`, or any set the caller brings. */
  items: readonly CgEmojiPickerItem[];
  /** Headings for the items' groups, in the order drawn. Items of no listed group come last. */
  groups?: readonly CgEmojiPickerGroup[];
  /** Emoji the person used last, drawn first under `labels.recent`. */
  recent?: readonly CgEmojiPickerItem[];
  /** An emoji was chosen, or `null` for the remove button. */
  onSelect: (emoji: string | null, item?: CgEmojiPickerItem) => void;
  /** Escape pressed inside the picker. */
  onEscape?: () => void;
  labels: CgEmojiPickerLabels;
  /** Emoji per row. Default 8. */
  columns?: number;
  /** The emoji now chosen, marked pressed. */
  value?: string | null;
  /** Shows the search box. Default true. */
  searchable?: boolean;
}
