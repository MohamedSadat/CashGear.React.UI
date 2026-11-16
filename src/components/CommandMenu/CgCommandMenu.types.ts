import type { HTMLAttributes, KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { CgOverlayPoint, CgOverlayRectangle } from '../../types';

export interface CgCommandMenuItem<TData = unknown> {
  /** Stable identity. */
  key: string;
  label: string;
  /** Items of a group are drawn together under its name, groups in the order they first appear. */
  group?: string;
  /** A `CgIcon` name or an element; an emoji or other text is drawn as given. */
  icon?: ReactNode;
  /** A second line, such as where a page sits or a matching sentence. */
  detail?: string;
  /** A key combination drawn at the line end, such as "Ctrl+Alt+1". */
  shortcut?: string;
  /** More words the default filter matches, such as "h1" or "title" for a heading. */
  keywords?: readonly string[];
  disabled?: boolean;
  data?: TData;
}

export interface CgCommandMenuSelectDetails {
  readonly source: 'keyboard' | 'pointer';
}

export type CgCommandMenuFilter<TData> = (item: CgCommandMenuItem<TData>, query: string) => boolean;

export interface CgCommandMenuRenderContext<TData> {
  readonly item: CgCommandMenuItem<TData>;
  readonly active: boolean;
  /** The menu's own drawing of the item: icon, label, detail and shortcut. */
  readonly defaultContent: ReactNode;
}

/** What `ref` gives: a host that keeps focus (an editor) forwards its keys here. */
export interface CgCommandMenuHandle {
  /**
   * Acts on ArrowUp, ArrowDown, Home, End, PageUp, PageDown, Enter, Tab (with `selectOnTab`) and
   * Escape. Returns true when the key was used; the event's default is then prevented.
   */
  handleKeyDown(event: KeyboardEvent | ReactKeyboardEvent): boolean;
  /** The id of the active option, for the focused element's `aria-activedescendant`. */
  readonly activeDescendantId: string | undefined;
  /** Moves the active option by `delta` places, wrapping. */
  move(delta: number): void;
  /** Chooses the active option, as Enter does. */
  selectActive(): void;
  /** Focuses the search box of a `searchable` menu. */
  focus(): void;
}

export interface CgCommandMenuProps<TData = unknown> extends Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'onSelect' | 'aria-label' | 'dangerouslySetInnerHTML'> {
  items: ReadonlyArray<CgCommandMenuItem<TData>>;
  /** The list's accessible name, such as "Blocks" or "Results". */
  label: string;
  /** Shown when no item is left, such as "No matching command". */
  emptyText: ReactNode;
  onSelect: (item: CgCommandMenuItem<TData>, details: CgCommandMenuSelectDetails) => void;

  /** The text the list is filtered by. Typed in the menu's search box when `searchable`. */
  query?: string;
  defaultQuery?: string;
  onQueryChange?: (query: string) => void;
  /**
   * How items match `query`. Default: every typed word starts a word of the label or keywords,
   * or the label contains the whole query, ignoring case and Arabic marks. `false` shows `items`
   * as given, for a caller that searches itself.
   */
  filter?: CgCommandMenuFilter<TData> | false;

  /** Draws a search box above the list that keeps focus (a palette). */
  searchable?: boolean;
  /** The search box's accessible name. Needed with `searchable`. */
  searchLabel?: string;
  searchPlaceholder?: string;

  /**
   * Draws the menu floating at this point or rectangle (viewport pixels, as a caret's), instead of
   * in place. It closes on Escape and on a press outside through `onDismiss`.
   */
  anchor?: CgOverlayPoint | CgOverlayRectangle;
  /** Anchored menus only. Default true. */
  open?: boolean;
  /** Escape, or a press outside an anchored menu. */
  onDismiss?: (reason: 'escape' | 'outsideClick') => void;

  /** Results are being fetched: Enter waits for them and acts on the active one when they come. */
  loading?: boolean;
  /** Shown while `loading` and nothing matches yet. */
  loadingText?: ReactNode;
  /** Tab chooses the active option, as in an editor's slash menu. Default false. */
  selectOnTab?: boolean;
  /** Reports the active option's id, for a host that keeps focus and sets `aria-activedescendant`. */
  onActiveDescendantChange?: (id: string | undefined) => void;
  renderItem?: (context: CgCommandMenuRenderContext<TData>) => ReactNode;
  /** The list's maximum height. Default 20rem. */
  maxHeight?: string | number;
  /** The list's width when anchored. Default 20rem. */
  width?: string | number;
  /** For the default filter's case folding. */
  locale?: string;
  /** A pointer press on an option, before it is chosen; the menu prevents focus moving. */
  onOptionMouseDown?: (item: CgCommandMenuItem<TData>, event: MouseEvent<HTMLDivElement>) => void;
}
