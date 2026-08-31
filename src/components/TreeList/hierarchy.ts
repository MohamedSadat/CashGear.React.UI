/* eslint-disable @typescript-eslint/no-base-to-string -- Descriptor values are intentionally normalized to searchable and sortable text. */
import { CgFilterFieldRegistry, compileFilterPredicate, validateFilter } from '../../filter';
import type { CgFilterFieldDescriptor } from '../../filter';
import type { CgGridSortDescriptor } from '../Grid';
import type {
  CgTreeListColumn,
  CgTreeListFilterMode,
  CgTreeListFilterNode,
  CgTreeListKey,
  CgTreeListNode,
  CgTreeListOrphanPolicy,
  CgTreeListParentKey,
  CgTreeListProviderNode,
} from './CgTreeList.types';

export const CG_TREE_LIST_DEFAULT_MAXIMUM_DEPTH = 512;
export const CG_TREE_LIST_MAXIMUM_DEPTH_LIMIT = 10_000;

export interface TreeListHierarchyNode<TItem, TKey extends CgTreeListKey> {
  item: TItem;
  readonly key: TKey;
  readonly token: string;
  parent: TreeListHierarchyNode<TItem, TKey> | null;
  children: Array<TreeListHierarchyNode<TItem, TKey>>;
  level: number;
  siblingIndex: number;
  hasUnloadedChildren: boolean;
  childrenLoaded: boolean;
  projectionComplete: boolean;
}

export interface TreeListHierarchy<TItem, TKey extends CgTreeListKey> {
  readonly roots: Array<TreeListHierarchyNode<TItem, TKey>>;
  readonly nodes: Array<TreeListHierarchyNode<TItem, TKey>>;
  readonly byToken: Map<string, TreeListHierarchyNode<TItem, TKey>>;
}

export interface TreeListProjectionNode<TItem, TKey extends CgTreeListKey> {
  readonly internal: TreeListHierarchyNode<TItem, TKey>;
  readonly publicNode: CgTreeListNode<TItem, TKey>;
}

export function treeListKeyToken(key: CgTreeListKey): string {
  if (typeof key === 'string') {
    if (!key.trim()) throw new Error('CgTreeList getKey returned an empty string. Keys must be stable non-empty primitives.');
    return `string:${key}`;
  }
  if (!Number.isFinite(key)) throw new Error('CgTreeList getKey returned a non-finite number.');
  return `number:${Object.is(key, -0) ? 0 : key}`;
}

export function parentKeyToken<TKey extends CgTreeListKey>(parent: CgTreeListParentKey<TKey>): string | null {
  return parent.kind === 'none' ? null : treeListKeyToken(parent.key);
}

function maximumDepth(value: number | undefined): number {
  const depth = value ?? CG_TREE_LIST_DEFAULT_MAXIMUM_DEPTH;
  if (!Number.isInteger(depth) || depth < 1 || depth > CG_TREE_LIST_MAXIMUM_DEPTH_LIMIT) {
    throw new Error(`CgTreeList maximumDepth must be an integer from 1 to ${CG_TREE_LIST_MAXIMUM_DEPTH_LIMIT}.`);
  }
  return depth;
}

function handleOrphan<TItem, TKey extends CgTreeListKey>(
  node: TreeListHierarchyNode<TItem, TKey>,
  policy: CgTreeListOrphanPolicy,
  roots: Array<TreeListHierarchyNode<TItem, TKey>>,
  reason: string,
): void {
  if (policy === 'throw') throw new Error(`CgTreeList node '${node.token}' ${reason}.`);
  if (policy === 'treat-as-root') roots.push(node);
}

function createNode<TItem, TKey extends CgTreeListKey>(item: TItem, key: TKey): TreeListHierarchyNode<TItem, TKey> {
  return {
    item, key, token: treeListKeyToken(key), parent: null, children: [], level: 1, siblingIndex: 0,
    hasUnloadedChildren: false, childrenLoaded: true, projectionComplete: true,
  };
}

function assignLevels<TItem, TKey extends CgTreeListKey>(
  roots: Array<TreeListHierarchyNode<TItem, TKey>>,
  limit: number,
): void {
  const stack = roots.map((node, index) => ({ node, level: 1, siblingIndex: index })).reverse();
  while (stack.length) {
    const current = stack.pop()!;
    if (current.level > limit) throw new Error(`CgTreeList maximum depth ${limit} was exceeded at node '${current.node.token}'.`);
    current.node.level = current.level;
    current.node.siblingIndex = current.siblingIndex;
    for (let index = current.node.children.length - 1; index >= 0; index--) {
      const child = current.node.children[index]!;
      stack.push({ node: child, level: current.level + 1, siblingIndex: index });
    }
  }
}

export function buildFlatHierarchy<TItem, TKey extends CgTreeListKey>(options: {
  readonly data: ReadonlyArray<TItem>;
  readonly getKey: (item: TItem) => TKey;
  readonly getParentKey: (item: TItem) => CgTreeListParentKey<TKey>;
  readonly isRoot?: (item: TItem) => boolean;
  readonly rootParentKeys?: ReadonlySet<TKey> | ReadonlyArray<TKey>;
  readonly orphanPolicy?: CgTreeListOrphanPolicy;
  readonly hasChildren?: (item: TItem) => boolean;
  readonly maximumDepth?: number;
}): TreeListHierarchy<TItem, TKey> {
  const roots: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const nodes: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const byToken = new Map<string, TreeListHierarchyNode<TItem, TKey>>();
  const desiredParents = new Map<string, string | null>();
  const explicitRoots = new Set<string>();
  const rootSentinels = new Set([...(options.rootParentKeys ?? [])].map(treeListKeyToken));
  const policy = options.orphanPolicy ?? 'treat-as-root';

  for (const item of options.data) {
    const node = createNode(item, options.getKey(item));
    if (byToken.has(node.token)) throw new Error(`CgTreeList contains duplicate key '${node.token}'.`);
    node.hasUnloadedChildren = options.hasChildren?.(item) ?? false;
    node.childrenLoaded = !node.hasUnloadedChildren;
    nodes.push(node);
    byToken.set(node.token, node);
    const parent = options.getParentKey(item);
    const parentToken = parentKeyToken(parent);
    const root = options.isRoot?.(item) === true || parentToken === null || (parentToken !== null && rootSentinels.has(parentToken));
    desiredParents.set(node.token, root ? null : parentToken);
    if (root) explicitRoots.add(node.token);
  }

  // Break parent cycles iteratively. The last edge encountered in declaration order is the deterministic break.
  const completed = new Set<string>();
  const cycleBreaks = new Set<string>();
  for (const start of nodes) {
    if (completed.has(start.token)) continue;
    const path: string[] = [];
    const positions = new Map<string, number>();
    let token: string | null = start.token;
    while (token !== null && byToken.has(token) && !completed.has(token)) {
      const repeatedAt = positions.get(token);
      if (repeatedAt !== undefined) {
        const closing = path.at(-1);
        if (closing) cycleBreaks.add(closing);
        break;
      }
      positions.set(token, path.length);
      path.push(token);
      token = desiredParents.get(token) ?? null;
    }
    for (const visited of path) completed.add(visited);
  }

  for (const node of nodes) {
    const desired = desiredParents.get(node.token) ?? null;
    if (explicitRoots.has(node.token) || desired === null) { roots.push(node); continue; }
    if (desired === node.token) { handleOrphan(node, policy, roots, 'references itself as its parent'); continue; }
    if (cycleBreaks.has(node.token)) { handleOrphan(node, policy, roots, 'closes a circular parent chain'); continue; }
    const parent = byToken.get(desired);
    if (!parent) { handleOrphan(node, policy, roots, 'references a missing parent'); continue; }
    node.parent = parent;
    parent.children.push(node);
    parent.childrenLoaded = true;
  }

  assignLevels(roots, maximumDepth(options.maximumDepth));
  return { roots, nodes, byToken };
}

export function buildNestedHierarchy<TItem, TKey extends CgTreeListKey>(options: {
  readonly data: ReadonlyArray<TItem>;
  readonly getKey: (item: TItem) => TKey;
  readonly getChildren: (item: TItem) => ReadonlyArray<TItem> | null | undefined;
  readonly hasChildren?: (item: TItem) => boolean;
  readonly maximumDepth?: number;
}): TreeListHierarchy<TItem, TKey> {
  const roots: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const nodes: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const byToken = new Map<string, TreeListHierarchyNode<TItem, TKey>>();
  const limit = maximumDepth(options.maximumDepth);
  const stack = options.data.map((item, index) => ({ item, parent: null as TreeListHierarchyNode<TItem, TKey> | null, level: 1, index })).reverse();
  while (stack.length) {
    const current = stack.pop()!;
    if (current.level > limit) {
      const key = options.getKey(current.item);
      throw new Error(`CgTreeList maximum depth ${limit} was exceeded at node '${treeListKeyToken(key)}'.`);
    }
    const key = options.getKey(current.item);
    const token = treeListKeyToken(key);
    if (byToken.has(token)) continue;
    const node = createNode(current.item, key);
    node.parent = current.parent;
    node.level = current.level;
    const children = options.getChildren(current.item) ?? [];
    node.hasUnloadedChildren = children.length === 0 && (options.hasChildren?.(current.item) ?? false);
    node.childrenLoaded = !node.hasUnloadedChildren;
    byToken.set(token, node);
    nodes.push(node);
    if (current.parent) current.parent.children.push(node); else roots.push(node);
    for (let index = children.length - 1; index >= 0; index--) stack.push({ item: children[index]!, parent: node, level: current.level + 1, index });
  }
  assignLevels(roots, limit);
  return { roots, nodes, byToken };
}

export function buildProviderHierarchy<TItem, TKey extends CgTreeListKey>(options: {
  readonly records: ReadonlyArray<CgTreeListProviderNode<TItem, TKey>>;
  readonly maximumDepth?: number;
}): TreeListHierarchy<TItem, TKey> {
  const roots: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const nodes: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const byToken = new Map<string, TreeListHierarchyNode<TItem, TKey>>();
  const records = new Map<string, CgTreeListProviderNode<TItem, TKey>>();
  for (const record of options.records) {
    const node = createNode(record.item, record.key);
    if (byToken.has(node.token)) continue; // Overlapping provider pages deduplicate first-wins.
    node.hasUnloadedChildren = record.hasChildren && record.projectionComplete !== true;
    node.childrenLoaded = !node.hasUnloadedChildren;
    node.projectionComplete = record.projectionComplete ?? !record.hasChildren;
    byToken.set(node.token, node); records.set(node.token, record); nodes.push(node);
  }
  for (const node of nodes) {
    const parentToken = parentKeyToken(records.get(node.token)!.parentKey);
    const parent = parentToken === null ? undefined : byToken.get(parentToken);
    if (!parent || parent === node) roots.push(node);
    else { node.parent = parent; parent.children.push(node); parent.childrenLoaded = true; }
  }
  assignLevels(roots, maximumDepth(options.maximumDepth));
  return { roots, nodes, byToken };
}

/** Attach node-local lazy pages to a freshly built hierarchy without mutating caller data. */
export function attachLoadedChildren<TItem, TKey extends CgTreeListKey>(
  hierarchy: TreeListHierarchy<TItem, TKey>,
  pages: ReadonlyMap<string, ReadonlyArray<TItem>>,
  getKey: (item: TItem) => TKey,
  hasChildren: ((item: TItem) => boolean) | undefined,
  maximumDepthValue: number | undefined,
): void {
  const limit = maximumDepth(maximumDepthValue);
  const queue = [...hierarchy.nodes];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const parent = queue[cursor]!;
    const items = pages.get(parent.token);
    if (!items) continue;
    parent.childrenLoaded = true;
    parent.hasUnloadedChildren = false;
    for (const item of items) {
      const key = getKey(item);
      const token = treeListKeyToken(key);
      if (hierarchy.byToken.has(token)) continue;
      const child = createNode(item, key);
      child.parent = parent;
      child.level = parent.level + 1;
      if (child.level > limit) throw new Error(`CgTreeList maximum depth ${limit} was exceeded at node '${token}'.`);
      child.hasUnloadedChildren = hasChildren?.(item) ?? false;
      child.childrenLoaded = !child.hasUnloadedChildren;
      parent.children.push(child);
      hierarchy.nodes.push(child);
      hierarchy.byToken.set(token, child);
      queue.push(child);
    }
  }
  assignLevels(hierarchy.roots, limit);
}

function compareValues(left: unknown, right: unknown): number {
  if (Object.is(left, right)) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}

function sortedSiblings<TItem, TKey extends CgTreeListKey>(
  items: ReadonlyArray<TreeListHierarchyNode<TItem, TKey>>,
  sorts: ReadonlyArray<CgGridSortDescriptor>,
  columns: ReadonlyMap<string, CgTreeListColumn<TItem, TKey>>,
): Array<TreeListHierarchyNode<TItem, TKey>> {
  if (!sorts.length) return [...items];
  return items.map((node, index) => ({ node, index })).sort((left, right) => {
    for (const sort of sorts) {
      const column = columns.get(sort.fieldId);
      const compared = compareValues(column?.getValue?.(left.node.item), column?.getValue?.(right.node.item));
      if (compared) return sort.direction === 'ascending' ? compared : -compared;
    }
    return left.index - right.index;
  }).map((entry) => entry.node);
}

function filterRegistry<TItem, TKey extends CgTreeListKey>(columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>): CgFilterFieldRegistry<TItem> {
  const fields: Array<CgFilterFieldDescriptor<TItem>> = [];
  for (const column of columns) {
    if (!column.getValue || column.filterable === false || column.type === 'selection' || column.type === 'command' || column.type === 'template') continue;
    const kind = column.type === 'date' ? (column.dateTime ? 'dateTime' : 'date') : column.type === 'number' || column.type === 'boolean' ? column.type : 'text';
    fields.push({ fieldId: column.fieldId, formerFieldIds: column.formerFieldIds, label: column.title ?? column.fieldId, kind, accessor: column.getValue, enabled: true, visible: column.visible !== false });
  }
  return new CgFilterFieldRegistry(fields);
}

export function formatTreeListValue<TItem, TKey extends CgTreeListKey>(column: CgTreeListColumn<TItem, TKey>, item: TItem, locale?: string): string {
  const value = column.getValue?.(item);
  if (value === null || value === undefined) return '';
  if (column.formatValue) return column.formatValue(value as never, item);
  if (column.type === 'number' && typeof value === 'number') return new Intl.NumberFormat(locale).format(value);
  if (column.type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, column.dateTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(date);
  }
  if (column.type === 'boolean') return value ? 'True' : 'False';
  return String(value);
}

function preorder<TItem, TKey extends CgTreeListKey>(
  roots: ReadonlyArray<TreeListHierarchyNode<TItem, TKey>>,
  sorts: ReadonlyArray<CgGridSortDescriptor>,
  columns: ReadonlyMap<string, CgTreeListColumn<TItem, TKey>>,
): Array<TreeListHierarchyNode<TItem, TKey>> {
  const result: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const stack = sortedSiblings(roots, sorts, columns).reverse();
  while (stack.length) {
    const node = stack.pop()!;
    result.push(node);
    const children = sortedSiblings(node.children, sorts, columns);
    for (let index = children.length - 1; index >= 0; index--) stack.push(children[index]!);
  }
  return result;
}

export function projectHierarchy<TItem, TKey extends CgTreeListKey>(options: {
  readonly hierarchy: TreeListHierarchy<TItem, TKey>;
  readonly columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>;
  readonly expandedTokens: ReadonlySet<string>;
  readonly sorts: ReadonlyArray<CgGridSortDescriptor>;
  readonly searchText: string;
  readonly filter: CgTreeListFilterNode | null;
  readonly filterMode: CgTreeListFilterMode;
  readonly locale?: string;
}): { readonly visible: ReadonlyArray<TreeListProjectionNode<TItem, TKey>>; readonly transientExpandedTokens: ReadonlySet<string>; readonly directMatches: ReadonlySet<string> } {
  const columnMap = new Map(options.columns.map((column) => [column.fieldId, column]));
  const ordered = preorder(options.hierarchy.roots, options.sorts, columnMap);
  const normalizedSearch = options.searchText.trim().toLocaleLowerCase(options.locale);
  const queryActive = normalizedSearch.length > 0 || options.filter !== null;
  let predicate: ((item: TItem) => boolean) | null = null;
  if (options.filter) {
    const registry = filterRegistry(options.columns);
    const validation = validateFilter(options.filter, registry);
    if (!validation.valid) throw new Error(`CgTreeList filter is invalid: ${validation.problems.map((problem) => problem.message).join('; ')}`);
    predicate = compileFilterPredicate(options.filter, registry);
  }
  const searchable = options.columns.filter((column) => column.searchable !== false && column.visible !== false && column.getValue);
  const directMatches = new Set<string>();
  if (queryActive) {
    for (const node of ordered) {
      const searchMatch = !normalizedSearch || searchable.some((column) => formatTreeListValue(column, node.item, options.locale).toLocaleLowerCase(options.locale).includes(normalizedSearch));
      if (searchMatch && (!predicate || predicate(node.item))) directMatches.add(node.token);
    }
  }

  const included = new Set<string>();
  const transientExpandedTokens = new Set<string>();
  if (queryActive) {
    for (const token of directMatches) {
      included.add(token);
      const matched = options.hierarchy.byToken.get(token)!;
      if (options.filterMode !== 'match-only') {
        let parent = matched.parent;
        while (parent) { included.add(parent.token); transientExpandedTokens.add(parent.token); parent = parent.parent; }
      }
      if (options.filterMode === 'ancestors-and-descendants') {
        const stack = [...matched.children];
        while (stack.length) { const child = stack.pop()!; included.add(child.token); stack.push(...child.children); }
      }
    }
  }

  const raw: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  if (queryActive && options.filterMode === 'match-only') {
    for (const node of ordered) if (included.has(node.token)) raw.push(node);
  } else {
    const roots = sortedSiblings(options.hierarchy.roots, options.sorts, columnMap);
    const stack = roots.reverse();
    while (stack.length) {
      const node = stack.pop()!;
      if (!queryActive || included.has(node.token)) raw.push(node);
      const expanded = options.expandedTokens.has(node.token) || transientExpandedTokens.has(node.token);
      if (!expanded) continue; // Crucially, collapsed subtrees are not traversed.
      const children = sortedSiblings(node.children, options.sorts, columnMap);
      for (let index = children.length - 1; index >= 0; index--) {
        if (!queryActive || included.has(children[index]!.token)) stack.push(children[index]!);
      }
    }
  }

  const visibleSet = new Set(raw.map((node) => node.token));
  const siblingMeta = new Map<string, { position: number; size: number }>();
  const siblingBuckets = new Map<string, Array<TreeListHierarchyNode<TItem, TKey>>>();
  for (const node of raw) {
    const bucketKey = options.filterMode === 'match-only' && queryActive ? '__flat__' : node.parent?.token ?? '__root__';
    const bucket = siblingBuckets.get(bucketKey) ?? [];
    bucket.push(node);
    siblingBuckets.set(bucketKey, bucket);
  }
  for (const bucket of siblingBuckets.values()) for (let index = 0; index < bucket.length; index++) siblingMeta.set(bucket[index]!.token, { position: index + 1, size: bucket.length });

  const visible = raw.map((node, index): TreeListProjectionNode<TItem, TKey> => {
    const meta = siblingMeta.get(node.token)!;
    const parentKey: CgTreeListParentKey<TKey> = node.parent ? { kind: 'key', key: node.parent.key } : { kind: 'none' };
    return {
      internal: node,
      publicNode: Object.freeze({
        item: node.item, key: node.key, parentKey, level: node.level, visibleIndex: index,
        posInSet: meta.position, setSize: meta.size, siblingIndex: meta.position - 1,
        hasChildren: node.children.length > 0 || node.hasUnloadedChildren,
        childrenLoaded: node.childrenLoaded,
        directMatch: directMatches.has(node.token),
        retainedAsAncestor: queryActive && included.has(node.token) && !directMatches.has(node.token) && [...node.children].some((child) => visibleSet.has(child.token)),
      }),
    };
  });
  return { visible: Object.freeze(visible), transientExpandedTokens: Object.freeze(transientExpandedTokens), directMatches: Object.freeze(directMatches) };
}

export function hierarchyDescendants<TItem, TKey extends CgTreeListKey>(node: TreeListHierarchyNode<TItem, TKey>): ReadonlyArray<TreeListHierarchyNode<TItem, TKey>> {
  const result: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  const stack = [...node.children];
  while (stack.length) { const current = stack.pop()!; result.push(current); stack.push(...current.children); }
  return result;
}

export function hierarchyAncestors<TItem, TKey extends CgTreeListKey>(node: TreeListHierarchyNode<TItem, TKey>): ReadonlyArray<TreeListHierarchyNode<TItem, TKey>> {
  const result: Array<TreeListHierarchyNode<TItem, TKey>> = [];
  let current = node.parent;
  while (current) { result.push(current); current = current.parent; }
  return result;
}
