import type { CgTreeListColumn, CgTreeListKey, CgTreeListState } from './CgTreeList.types';

export const CG_TREE_LIST_STATE_VERSION = 1 as const;

export function createTreeListState<TItem, TKey extends CgTreeListKey>(
  columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>,
  input: Partial<CgTreeListState<TKey>> = {},
): CgTreeListState<TKey> {
  const stored = new Map((input.columns ?? []).map((column) => [column.fieldId, column]));
  return Object.freeze({
    version: CG_TREE_LIST_STATE_VERSION,
    columns: Object.freeze(columns.map((column, index) => Object.freeze({
      fieldId: column.fieldId,
      visible: stored.get(column.fieldId)?.visible ?? column.visible ?? true,
      displayOrder: stored.get(column.fieldId)?.displayOrder ?? index,
      width: stored.get(column.fieldId)?.width,
      fixed: stored.get(column.fieldId)?.fixed ?? 'none',
    }))),
    sorts: Object.freeze([...(input.sorts ?? [])]),
    filter: input.filter ?? null,
    filterMode: input.filterMode ?? 'match-with-ancestors',
    groups: Object.freeze([...(input.groups ?? [])]),
    collapsedGroupKeys: Object.freeze(new Set(input.collapsedGroupKeys ?? [])),
    rootPage: Object.freeze({ pageIndex: Math.max(0, input.rootPage?.pageIndex ?? 0), pageSize: Math.max(1, input.rootPage?.pageSize ?? 50), ...(input.rootPage?.totalCount === undefined ? {} : { totalCount: Math.max(0, input.rootPage.totalCount) }) }),
    childPages: Object.freeze(new Map(input.childPages ?? [])),
  });
}

export function normalizeTreeListState<TItem, TKey extends CgTreeListKey>(
  columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>,
  input: Partial<CgTreeListState<TKey>>,
  hierarchyFieldId: string,
): CgTreeListState<TKey> {
  if (input.version !== undefined && input.version !== CG_TREE_LIST_STATE_VERSION) return createTreeListState(columns);
  const known = new Set(columns.map((column) => column.fieldId));
  const normalized = createTreeListState(columns, {
    ...input,
    columns: input.columns?.filter((column) => known.has(column.fieldId)),
    sorts: input.sorts?.filter((sort) => known.has(sort.fieldId)),
    groups: input.groups?.filter((group) => known.has(group.fieldId)),
  });
  return Object.freeze({ ...normalized, columns: Object.freeze(normalized.columns.map((column) => column.fieldId === hierarchyFieldId ? Object.freeze({ ...column, visible: true }) : column)) });
}
