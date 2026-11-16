// The board's arithmetic, pure and tested on its own: the cards of each column in their order,
// a column's layout (fixed sizes, each card followed by the gap) and the cards inside a scrolled
// window, where a dragged card lands and its index after the move, the column nearest the
// pointer, and the keys as moves of the focus or of a picked-up card (mirrored in RTL); and the
// columns' own order: a column's move, where a dragged column lands and where its line is drawn.
import type { CgKanbanCard, CgKanbanColumn } from './CgKanbanBoard.types';

/** A column's cards one under another: `offsets[i]` is card i's block start, `offsets[count]` the end. */
export interface KanbanColumnLayout {
  readonly offsets: readonly number[];
  readonly count: number;
  /** The space after each card. */
  readonly gap: number;
  /** The column's block size: the last card's end, its gap included. */
  readonly total: number;
}

/** A card's place: the column's index among the shown columns and the card's index in it. */
export interface KanbanPosition {
  readonly col: number;
  readonly index: number;
}

export type KanbanKeyMove = 'up' | 'down' | 'previous' | 'next' | 'first' | 'last';

/**
 * The cards of each column, keyed by column key, in their order: by `order` when a column has
 * one (ties keep their order in `cards`), else as they come. Cards of an unknown column are left out.
 */
export function groupKanbanCards<TData, TColumnData>(
  columns: ReadonlyArray<CgKanbanColumn<TColumnData>>,
  cards: ReadonlyArray<CgKanbanCard<TData>>,
): Map<string, Array<CgKanbanCard<TData>>> {
  const byColumn = new Map<string, Array<CgKanbanCard<TData>>>();
  for (const column of columns) {
    if (byColumn.has(column.key)) throw new Error(`CgKanbanBoard column keys must be unique: '${column.key}' is used twice.`);
    byColumn.set(column.key, []);
  }
  const seen = new Set<string>();
  for (const card of cards) {
    if (seen.has(card.key)) throw new Error(`CgKanbanBoard card keys must be unique: '${card.key}' is used twice.`);
    seen.add(card.key);
    byColumn.get(card.columnKey)?.push(card);
  }
  for (const list of byColumn.values()) {
    // Array sort is stable, so cards with the same order keep their order in `cards`.
    if (list.some((card) => card.order !== undefined)) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return byColumn;
}

/**
 * `cards` with the card `key` moved to `toIndex` of `toColumnKey` (its index there after the
 * move), for a caller that keeps one list in board order and no `order` values.
 */
export function moveKanbanCard<TCard extends { key: string; columnKey: string }>(
  cards: readonly TCard[],
  key: string,
  toColumnKey: string,
  toIndex: number,
): TCard[] {
  const moving = cards.find((card) => card.key === key);
  if (!moving) return [...cards];
  const rest = cards.filter((card) => card.key !== key);
  const target = rest.filter((card) => card.columnKey === toColumnKey);
  const anchor = target[Math.max(0, toIndex)];
  const last = target[target.length - 1];
  const at = anchor ? rest.indexOf(anchor) : last ? rest.indexOf(last) + 1 : rest.length;
  rest.splice(at, 0, { ...moving, columnKey: toColumnKey });
  return rest;
}

/**
 * `columns` with the column `key` moved to `toIndex` among the shown columns (those not
 * `hidden`), as `onColumnMove` gives it. Hidden columns keep their places among the others.
 */
export function moveKanbanColumn<TColumn extends { key: string; hidden?: boolean }>(
  columns: readonly TColumn[],
  key: string,
  toIndex: number,
): TColumn[] {
  const moving = columns.find((column) => column.key === key);
  if (!moving) return [...columns];
  const rest = columns.filter((column) => column.key !== key);
  const shown = rest.filter((column) => !column.hidden);
  const anchor = shown[Math.max(0, toIndex)];
  const last = shown[shown.length - 1];
  const at = anchor ? rest.indexOf(anchor) : last ? rest.indexOf(last) + 1 : rest.length;
  rest.splice(at, 0, moving);
  return rest;
}

/** Lays out cards of the given block sizes, each followed by `gap`. */
export function kanbanColumnLayout(sizes: readonly number[], gap: number): KanbanColumnLayout {
  const offsets = new Array<number>(sizes.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < sizes.length; index += 1) offsets[index + 1] = offsets[index]! + sizes[index]! + gap;
  return { offsets, count: sizes.length, gap, total: offsets[sizes.length]! };
}

/** The index of the last card that starts at or before `y` (0 when `y` is before the first). */
function cardAt(layout: KanbanColumnLayout, y: number): number {
  let low = 0;
  let high = layout.count - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (layout.offsets[middle]! <= y) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The cards a window `[top, bottom)` of the column's own coordinates shows: `start` to `end` (excluded). */
export function kanbanCardsInWindow(layout: KanbanColumnLayout, top: number, bottom: number): { start: number; end: number } {
  if (layout.count === 0 || bottom <= 0 || top >= layout.total || bottom <= top) return { start: 0, end: 0 };
  const start = cardAt(layout, Math.max(0, top));
  const end = cardAt(layout, Math.max(0, bottom - 1)) + 1;
  return { start, end: Math.min(layout.count, end) };
}

/**
 * Where a card dropped at `y` (the column's own coordinates) goes: the gap before the first card
 * whose middle is below `y`, else the gap after the last. Counted among every card of the column,
 * the dragged one included: 0 to `count`.
 */
export function kanbanDropGap(layout: KanbanColumnLayout, y: number): number {
  let low = 0;
  let high = layout.count;
  while (low < high) {
    const index = Math.floor((low + high) / 2);
    const middle = (layout.offsets[index]! + layout.offsets[index + 1]! - layout.gap) / 2;
    if (y < middle) high = index;
    else low = index + 1;
  }
  return low;
}

/**
 * A drop in the gap `gap` of the card's own column (the card at `from`), as the card's index after
 * the move. Null when it lands where it already is.
 */
export function kanbanTargetIndex(from: number, gap: number): number | null {
  if (gap === from || gap === from + 1) return null;
  return gap > from ? gap - 1 : gap;
}

/** The gap among every card of its own column that the card at `from` takes to end at `toIndex`. */
export function kanbanGapOf(from: number, toIndex: number): number {
  return toIndex >= from ? toIndex + 1 : toIndex;
}

/** The column whose box is nearest `x` (inside one is a distance of 0); -1 without columns. */
export function kanbanNearestColumn(boxes: ReadonlyArray<{ left: number; right: number }>, x: number): number {
  let best = -1;
  let distance = Infinity;
  boxes.forEach((box, index) => {
    const away = x < box.left ? box.left - x : x > box.right ? x - box.right : 0;
    if (away < distance) {
      distance = away;
      best = index;
    }
  });
  return best;
}

/** A key as a board move: left and right swap in RTL, where the next column is on the left. */
export function kanbanKeyMove(key: string, rtl: boolean): KanbanKeyMove | null {
  switch (key) {
    case 'ArrowUp': return 'up';
    case 'ArrowDown': return 'down';
    case 'ArrowLeft': return rtl ? 'next' : 'previous';
    case 'ArrowRight': return rtl ? 'previous' : 'next';
    case 'Home': return 'first';
    case 'End': return 'last';
    default: return null;
  }
}

/**
 * Where the focus goes from a card, given each column's count of cards: up and down its column,
 * to the previous or next column that has cards (the same index, or its last card), to the
 * column's first or last card. Null when it stays.
 */
export function kanbanMoveFocus(counts: readonly number[], position: KanbanPosition, move: KanbanKeyMove): KanbanPosition | null {
  const count = counts[position.col] ?? 0;
  switch (move) {
    case 'up': return position.index > 0 ? { col: position.col, index: position.index - 1 } : null;
    case 'down': return position.index < count - 1 ? { col: position.col, index: position.index + 1 } : null;
    case 'first': return count > 0 && position.index !== 0 ? { col: position.col, index: 0 } : null;
    case 'last': return count > 0 && position.index !== count - 1 ? { col: position.col, index: count - 1 } : null;
    case 'previous':
    case 'next': {
      const step = move === 'next' ? 1 : -1;
      for (let col = position.col + step; col >= 0 && col < counts.length; col += step) {
        const cards = counts[col] ?? 0;
        if (cards > 0) return { col, index: Math.min(position.index, cards - 1) };
      }
      return null;
    }
  }
}

/** A column's box in viewport pixels (physical, in either direction). */
export interface KanbanColumnBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/**
 * Where a column dropped at `x` (viewport pixels) goes: the gap among every shown column, the
 * dragged one included (0 to their count), counting the columns whose middle `x` has passed in
 * the reading direction: rightwards in LTR, leftwards in RTL.
 */
export function kanbanColumnDropGap(boxes: ReadonlyArray<{ left: number; right: number }>, x: number, rtl: boolean): number {
  let gap = 0;
  for (const box of boxes) {
    const middle = (box.left + box.right) / 2;
    if (rtl ? x < middle : x > middle) gap += 1;
  }
  return gap;
}

/**
 * The line down the gap `gap` among the columns (in their order, 0 to their count): its `x` in
 * viewport pixels, halfway between the two neighbours (`half` outside the first or the last), and
 * the block extent of its neighbours. Null without columns.
 */
export function kanbanColumnLine(boxes: readonly KanbanColumnBox[], gap: number, rtl: boolean, half: number): { x: number; top: number; bottom: number } | null {
  const before = boxes[gap - 1];
  const after = boxes[gap];
  // The inline end of the column before and the inline start of the one after.
  const end = before ? (rtl ? before.left : before.right) : undefined;
  const start = after ? (rtl ? after.right : after.left) : undefined;
  let x: number;
  if (end !== undefined && start !== undefined) x = (end + start) / 2;
  else if (start !== undefined) x = start + (rtl ? half : -half);
  else if (end !== undefined) x = end + (rtl ? -half : half);
  else return null;
  const neighbours = [before, after].filter((box): box is KanbanColumnBox => box !== undefined);
  return { x, top: Math.min(...neighbours.map((box) => box.top)), bottom: Math.max(...neighbours.map((box) => box.bottom)) };
}

/**
 * Where a picked-up column would land after a key, among `count` shown columns: one place
 * towards the start or the end of the row, or to its first or last place. Up and down do not
 * move it. Null when it stays.
 */
export function kanbanMoveColumn(count: number, index: number, move: KanbanKeyMove): number | null {
  switch (move) {
    case 'previous': return index > 0 ? index - 1 : null;
    case 'next': return index < count - 1 ? index + 1 : null;
    case 'first': return count > 0 && index !== 0 ? 0 : null;
    case 'last': return count > 0 && index !== count - 1 ? count - 1 : null;
    default: return null;
  }
}

/**
 * Where a picked-up card would land after a key, given each column's count of the other cards (the
 * card itself left out): an index from 0 to that count. Another column keeps the index, cut to its
 * count; empty columns are places too. Null when it stays.
 */
export function kanbanMoveDrop(counts: readonly number[], position: KanbanPosition, move: KanbanKeyMove): KanbanPosition | null {
  const max = counts[position.col] ?? 0;
  switch (move) {
    case 'up': return position.index > 0 ? { col: position.col, index: position.index - 1 } : null;
    case 'down': return position.index < max ? { col: position.col, index: position.index + 1 } : null;
    case 'first': return position.index !== 0 ? { col: position.col, index: 0 } : null;
    case 'last': return position.index !== max ? { col: position.col, index: max } : null;
    case 'previous':
    case 'next': {
      const col = position.col + (move === 'next' ? 1 : -1);
      if (col < 0 || col >= counts.length) return null;
      return { col, index: Math.min(position.index, counts[col] ?? 0) };
    }
  }
}
