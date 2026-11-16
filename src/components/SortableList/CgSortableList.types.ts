import type { HTMLAttributes, ReactNode } from 'react';

export interface CgSortableListMoveDetails {
  /** The item's place before the move. */
  readonly fromIndex: number;
  readonly source: 'pointer' | 'keyboard';
}

export interface CgSortableListItemContext {
  readonly index: number;
  /** The item is being dragged. */
  readonly dragging: boolean;
  /** The item cannot be moved (`isItemFixed`): it has no handle. */
  readonly fixed: boolean;
}

export interface CgSortableListProps<T> extends Omit<HTMLAttributes<HTMLUListElement>, 'children' | 'aria-label' | 'dangerouslySetInnerHTML'> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** A row's content, drawn after its handle. */
  renderItem: (item: T, context: CgSortableListItemContext) => ReactNode;
  /**
   * An item was moved: `toIndex` is its place in the list after the move. One call per move,
   * when a drag ends or an arrow key is pressed on a handle.
   */
  onMove: (key: string, toIndex: number, details: CgSortableListMoveDetails) => void;
  /** The list's accessible name. */
  label: string;
  /** Each handle's accessible name, such as "Move Status". */
  handleLabel: (item: T, index: number) => string;
  /** Spoken after a move, such as "Status moved to 3 of 7". */
  moveAnnouncement?: (item: T, toIndex: number, count: number) => string;
  /** Items without a handle that stay where they are, such as a title column. */
  isItemFixed?: (item: T) => boolean;
  /** Vetoes a move before it is proposed, and hides its drop line. */
  canMove?: (key: string, toIndex: number) => boolean;
  /** No handles: the list is shown only. */
  disabled?: boolean;
}
