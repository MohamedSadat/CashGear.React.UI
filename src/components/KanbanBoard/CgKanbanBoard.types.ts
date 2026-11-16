import type { HTMLAttributes, ReactNode } from 'react';
import type { CgContextMenuItem } from '../ContextMenu';

export interface CgKanbanColumn<TColumnData = unknown> {
  /** Stable identity, such as a status option's id. */
  key: string;
  /** The column's name in its header, drawn with `dir="auto"`, and passed to the labels. */
  title: string;
  /** Drawn before the title, such as a colour dot. Decoration only. */
  icon?: ReactNode;
  /** The count in the header and in the region's name. Default: the column's cards. Pass the total when cards come in pages. */
  count?: number;
  /** Not drawn as a column. Listed under `labels.hiddenColumns`, with a button to show it, when `onShowColumn` is given. */
  hidden?: boolean;
  data?: TColumnData;
}

export interface CgKanbanCard<TData = unknown> {
  /** Stable identity, unique on the board. */
  key: string;
  /** The column the card is in. A card of an unknown or hidden column is not drawn. */
  columnKey: string;
  /** The card's accessible name, and its name on its handle and in announcements. */
  label: string;
  /** Sorts the column's cards, lowest first; ties keep their order in `cards`. Default 0, so `cards` order. */
  order?: number;
  /** The card's block size in pixels, instead of `cardSize`. Cards are placed by these sizes, so content must fit. */
  size?: number;
  /** The card stays where it is: no handle, no pick-up, no move items. */
  fixed?: boolean;
  data?: TData;
}

export interface CgKanbanCardContext<TColumnData = unknown> {
  /** The card's index in its column. */
  readonly index: number;
  readonly column: CgKanbanColumn<TColumnData>;
}

export interface CgKanbanMoveDetails {
  readonly fromColumnKey: string;
  /** The card's index in its column before the move. */
  readonly fromIndex: number;
  /** `pointer`: a drag or a move item chosen by pointer. `keyboard`: a keyboard drop or a move item chosen by key. */
  readonly source: 'pointer' | 'keyboard';
}

export interface CgKanbanOpenDetails {
  readonly source: 'pointer' | 'keyboard';
}

/**
 * Every string the board shows or speaks. `index` arguments are 0-based places (add 1 to show
 * them) and `count` is the column's number of cards after the move.
 */
export interface CgKanbanBoardLabels<TData = unknown, TColumnData = unknown> {
  /** The board region's name, such as "Tasks board". */
  board: string;
  /** A column region's name, such as "To do, 12 cards". */
  column: (column: CgKanbanColumn<TColumnData>, count: number) => string;
  /** Shown in a column without cards, such as "No cards". */
  emptyColumn: string;
  /** Read with every card, such as "Space picks the card up, Enter opens it". Needed when cards can move. */
  cardHint?: string;
  /** The handle's name and tooltip, and the name of the menu it opens, such as "Move Pay the invoices". Needed when cards can move. */
  cardHandle?: (card: CgKanbanCard<TData>) => string;
  /** Spoken when Space picks a card up. Needed when cards can move. */
  pickedUp?: (card: CgKanbanCard<TData>, column: CgKanbanColumn<TColumnData>, index: number, count: number) => string;
  /** Spoken as a picked-up card moves, such as "Done, 3 of 12". Needed when cards can move. */
  position?: (card: CgKanbanCard<TData>, column: CgKanbanColumn<TColumnData>, index: number, count: number) => string;
  /** Spoken after a move, such as "Pay the invoices moved to Done, 3 of 12". Needed when cards can move. */
  moved?: (card: CgKanbanCard<TData>, column: CgKanbanColumn<TColumnData>, index: number, count: number) => string;
  /** Spoken when a keyboard move is cancelled. Needed when cards can move. */
  cancelled?: (card: CgKanbanCard<TData>) => string;
  /** A menu item that moves the card to the end of another column, such as "Move to Done". Needed when cards can move. */
  moveToColumn?: (column: CgKanbanColumn<TColumnData>) => string;
  /** Menu items that move the card one place within its column. Needed when cards can move, unless `fixedOrder`. */
  moveUp?: string;
  moveDown?: string;
  /** The add button's name and tooltip, such as "New card in To do". Needed with `onAddCard`. */
  addCard?: (column: CgKanbanColumn<TColumnData>) => string;
  /** The collapse button's name and tooltip, such as "Collapse To do" and "Expand To do". Needed with `collapsible`. */
  collapseColumn?: (column: CgKanbanColumn<TColumnData>) => string;
  expandColumn?: (column: CgKanbanColumn<TColumnData>) => string;
  /** The title and region name of the list of hidden columns, and each one's show button. Needed with `onShowColumn`. */
  hiddenColumns?: string;
  showColumn?: (column: CgKanbanColumn<TColumnData>) => string;
}

export interface CgKanbanBoardProps<TData = unknown, TColumnData = unknown> extends Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'aria-label' | 'dangerouslySetInnerHTML'> {
  /** In their order; columns marked `hidden` are not drawn. */
  columns: ReadonlyArray<CgKanbanColumn<TColumnData>>;
  cards: ReadonlyArray<CgKanbanCard<TData>>;
  /** A card's content, drawn inside the board's card box (which holds the focus, the handle and the drag). */
  renderCard: (card: CgKanbanCard<TData>, context: CgKanbanCardContext<TColumnData>) => ReactNode;
  labels: CgKanbanBoardLabels<TData, TColumnData>;
  /**
   * A card was moved: `toIndex` is its index in `toColumnKey` after the move. One call per drop,
   * keyboard drop or move item; the board never reorders `cards` itself. Without it the board is
   * shown only: no handles, no drags, no pick-up.
   */
  onCardMove?: (cardKey: string, toColumnKey: string, toIndex: number, details: CgKanbanMoveDetails) => void;
  /** Vetoes a place before it is shown or dropped on. */
  canMove?: (cardKey: string, toColumnKey: string, toIndex: number) => boolean;
  /** A card was clicked (not on a control inside it) or Enter was pressed on it. */
  onCardOpen?: (cardKey: string, details: CgKanbanOpenDetails) => void;
  /** Draws an add button in each column's header. */
  onAddCard?: (columnKey: string) => void;
  /** More items for a card's menu (its handle, right click, Shift+F10), after the move items. The menu's context is the card key. */
  cardMenuItems?: (card: CgKanbanCard<TData>) => ReadonlyArray<CgContextMenuItem<string>>;
  /**
   * The cards keep the caller's order (a sort): a card moves only between columns, the whole column
   * is marked as the drop target, and `toIndex` is the target column's end.
   */
  fixedOrder?: boolean;
  /** A card's block size in pixels. Default 72. */
  cardSize?: number;
  /** Pixels between two cards. Default 8. */
  cardGap?: number;
  /** A column's inline size: pixels or a CSS length. Default `17rem`. */
  columnSize?: number | string;
  /** Draws a collapse button in each header; a collapsed column is a narrow strip that still takes drops. */
  collapsible?: boolean;
  /** The collapsed columns' keys (controlled). */
  collapsedColumns?: readonly string[];
  defaultCollapsedColumns?: readonly string[];
  onCollapsedColumnsChange?: (keys: readonly string[]) => void;
  /** Lists the hidden columns after the others, each with a button that calls this. */
  onShowColumn?: (columnKey: string) => void;
  /** Drawn at the end of a header, such as a column menu button. */
  renderColumnActions?: (column: CgKanbanColumn<TColumnData>) => ReactNode;
  /** The locale of the counts in the headers, such as `ar-EG`. Default: the runtime's. */
  locale?: string;
}
