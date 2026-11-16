import type { TreeViewModel, TreeViewModelDescriptor } from '../../internal/treeViewModel';
import type { CgTreeViewDropPosition } from './CgTreeView.types';

/** Which of a row's three drop positions the rules allow. */
export type TreeViewDropAllowance = Readonly<Record<CgTreeViewDropPosition, boolean>>;

/** A node's new place: its parent, its index among that parent's children, and its neighbours there. */
export interface TreeViewDropPlace {
  readonly targetKey: string;
  readonly position: CgTreeViewDropPosition;
  readonly parentKey: string | null;
  readonly index: number;
  readonly previousKey: string | null;
  readonly nextKey: string | null;
  readonly oldParentKey: string | null;
  readonly oldIndex: number;
}

/** A row as a drop works it out: rows come in the order they are drawn. */
export interface TreeViewDropRow {
  readonly key: string;
  readonly depth: number;
  readonly parentKey: string | null;
  /** The row is expanded and its children are drawn under it. */
  readonly open: boolean;
}

/** One position over a row: the move it means, and where its mark is drawn. */
export interface TreeViewDropSpot {
  readonly targetKey: string;
  readonly position: CgTreeViewDropPosition;
  /** The level the line is drawn at (inside: the row's own). */
  readonly level: number;
  /** The line at the row's block start or end; inside marks the whole row. */
  readonly edge: 'start' | 'end' | 'row';
}

/**
 * Where a pointer `offset` pixels below a row's block start drops, in a row `size` pixels tall:
 * the first quarter before the row, the last quarter after it, the middle inside it. A position
 * the rules refuse gives way to its neighbour: before or after to inside; when inside is refused,
 * the row splits in halves. Null when nothing there is allowed.
 */
export function treeViewDropPosition(offset: number, size: number, allowed: TreeViewDropAllowance): CgTreeViewDropPosition | null {
  if (!(size > 0) || !Number.isFinite(offset)) return null;
  const ratio = Math.min(1, Math.max(0, offset / size));
  if (allowed.inside) {
    if (ratio < 0.25 && allowed.before) return 'before';
    if (ratio > 0.75 && allowed.after) return 'after';
    return 'inside';
  }
  const half: CgTreeViewDropPosition = ratio < 0.5 ? 'before' : 'after';
  return allowed[half] ? half : null;
}

/**
 * The level a drop below a row lands at, from the pointer's distance from the tree's inline start:
 * one level per indent, kept between `min` and `max`.
 */
export function treeViewDropLevel(inlineOffset: number, indent: number, min: number, max: number): number {
  const level = indent > 0 && Number.isFinite(inlineOffset) ? Math.floor(inlineOffset / indent) : max;
  return Math.max(min, Math.min(max, level));
}

/**
 * The three spots over row `index`. Before and inside are the row's own. Below an open row with
 * children, the line is its first child's start. Below a row that ends a branch, the pointer's
 * level picks the ancestor the node goes after, down to the level of the row that follows.
 */
export function treeViewDropSpots(
  rows: ReadonlyArray<TreeViewDropRow>,
  index: number,
  pointerLevel: number,
  parentOf: (key: string) => string | null,
): Readonly<Record<CgTreeViewDropPosition, TreeViewDropSpot>> | null {
  const row = rows[index];
  if (!row) return null;
  const next = rows[index + 1];
  let after: TreeViewDropSpot;
  if (row.open && next && next.parentKey === row.key) {
    after = { targetKey: next.key, position: 'before', level: next.depth, edge: 'end' };
  } else {
    const minimum = Math.min(row.depth, next?.depth ?? 0);
    const level = Math.max(minimum, Math.min(row.depth, pointerLevel));
    let targetKey = row.key;
    for (let depth = row.depth; depth > level; depth -= 1) targetKey = parentOf(targetKey) ?? targetKey;
    after = { targetKey, position: 'after', level, edge: 'end' };
  }
  return Object.freeze({
    before: { targetKey: row.key, position: 'before', level: row.depth, edge: 'start' },
    inside: { targetKey: row.key, position: 'inside', level: row.depth, edge: 'row' },
    after,
  });
}

function siblingKeys<T extends TreeViewModelDescriptor>(model: TreeViewModel<T>, parentKey: string | null): string[] {
  const siblings = parentKey === null ? model.roots : model.byKey.get(parentKey)?.children ?? [];
  return siblings.map((node) => node.key);
}

/**
 * The place a move of `key` to `position` of `targetKey` gives. Indexes count every child in
 * `nodes`, the hidden ones too, after the moved node leaves its old place; inside means last.
 * Null when the node would go inside itself or one of its descendants, or stay where it is.
 */
export function resolveTreeViewDrop<T extends TreeViewModelDescriptor>(
  model: TreeViewModel<T>,
  key: string,
  targetKey: string,
  position: CgTreeViewDropPosition,
): TreeViewDropPlace | null {
  const node = model.byKey.get(key);
  const target = model.byKey.get(targetKey);
  if (!node || !target || node.key === target.key) return null;
  for (let ancestor = target.parentKey; ancestor !== null; ancestor = model.byKey.get(ancestor)?.parentKey ?? null) {
    if (ancestor === node.key) return null;
  }
  const oldIndex = siblingKeys(model, node.parentKey).indexOf(node.key);
  const parentKey = position === 'inside' ? target.key : target.parentKey;
  const siblings = siblingKeys(model, parentKey).filter((candidate) => candidate !== node.key);
  const index = position === 'inside' ? siblings.length : siblings.indexOf(target.key) + (position === 'after' ? 1 : 0);
  if (parentKey === node.parentKey && index === oldIndex) return null;
  return Object.freeze({
    targetKey: target.key,
    position,
    parentKey,
    index,
    previousKey: siblings[index - 1] ?? null,
    nextKey: siblings[index] ?? null,
    oldParentKey: node.parentKey,
    oldIndex,
  });
}

export type TreeViewKeyboardMove = 'up' | 'down' | 'indent' | 'outdent';

/**
 * A move by keys among the siblings drawn: up goes before the previous one, down after the next,
 * indent inside the previous one (last), outdent after the parent. Null at an edge.
 */
export function treeViewKeyboardMove(
  siblings: ReadonlyArray<string>,
  key: string,
  parentKey: string | null,
  move: TreeViewKeyboardMove,
): { targetKey: string; position: CgTreeViewDropPosition } | null {
  const at = siblings.indexOf(key);
  if (at < 0) return null;
  const previous = siblings[at - 1];
  const next = siblings[at + 1];
  if (move === 'up') return previous === undefined ? null : { targetKey: previous, position: 'before' };
  if (move === 'down') return next === undefined ? null : { targetKey: next, position: 'after' };
  if (move === 'indent') return previous === undefined ? null : { targetKey: previous, position: 'inside' };
  return parentKey === null ? null : { targetKey: parentKey, position: 'after' };
}
