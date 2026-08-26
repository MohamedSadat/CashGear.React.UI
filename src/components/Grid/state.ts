import type { CgGridColumnDescriptor, CgGridColumnState, CgGridFilterNode, CgGridState } from './CgGrid.types';
import { clampColumnWidth, columnAliases, isDataColumn } from './columns';
import { pruneGridFilter } from './filtering';

export const CG_GRID_STATE_VERSION = 8;

function migrateFilter(node: CgGridFilterNode | null, aliases: ReadonlyMap<string, string>, legacySource: boolean): CgGridFilterNode | null {
  if (!node) return null;
  if (node.kind === 'condition') return { ...node, fieldId: aliases.get(node.fieldId) ?? node.fieldId, source: legacySource ? 'filterRow' : node.source ?? 'caller' };
  const adopt = legacySource && node.operator === 'and' && node.children.every((child) => child.kind === 'condition');
  return { ...node, children: node.children.map((child) => migrateFilter(child, aliases, adopt)).filter((child): child is CgGridFilterNode => child !== null) };
}

export function createGridState<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, input: Partial<CgGridState> = {}): CgGridState {
  const pageSize = Number.isInteger(input.pageSize) && (input.pageSize ?? 0) > 0 ? input.pageSize! : 50;
  const columnState = columns.map((column, index): CgGridColumnState => ({ fieldId: column.fieldId, visible: column.visible ?? true, frozen: false, displayOrder: index }));
  const initialGroups = columns.filter((column) => column.initialGroupIndex !== undefined).sort((a, b) => a.initialGroupIndex! - b.initialGroupIndex!).map((column) => ({ fieldId: column.fieldId, direction: 'ascending' as const }));
  return { version: CG_GRID_STATE_VERSION, pageIndex: input.pageIndex ?? 0, pageSize, searchText: input.searchText ?? '', sorts: input.sorts ?? [], filter: input.filter ?? null, selectedKeys: input.selectedKeys ?? [], focusedRowKey: input.focusedRowKey ?? null, focusedColumnId: input.focusedColumnId ?? null, columns: input.columns?.length ? input.columns : columnState, collapsedGroupKeys: input.collapsedGroupKeys ?? [], groups: input.groups?.length ? input.groups : initialGroups, expandedGroupPaths: input.expandedGroupPaths ?? [] };
}

export function normalizeGridState<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, source: Partial<CgGridState>): CgGridState {
  const version = Number(source.version ?? 1);
  if (!Number.isInteger(version) || version < 1 || version > CG_GRID_STATE_VERSION) throw new Error(`CgGrid state version '${String(source.version)}' is unsupported.`);
  const aliases = columnAliases(columns); const known = new Set(columns.map((column) => column.fieldId));
  const migrate = (id: string) => aliases.get(id) ?? id;
  const sourceColumns = new Map<string, CgGridColumnState>();
  for (const entry of source.columns ?? []) { const id = migrate(entry.fieldId); if (known.has(id) && !sourceColumns.has(id)) sourceColumns.set(id, { ...entry, fieldId: id }); }
  const normalizedColumns = columns.map((column, declarationIndex): CgGridColumnState => {
    const stored = sourceColumns.get(column.fieldId); const legacyWidth = version <= 6 ? stored?.measuredWidth : undefined; const width = stored?.userWidth ?? legacyWidth;
    return { fieldId: column.fieldId, visible: stored?.visible ?? column.visible ?? true, frozen: stored?.frozen ?? false, displayOrder: stored?.displayOrder ?? declarationIndex, ...(width !== undefined && Number.isFinite(width) ? { userWidth: clampColumnWidth(column, width) } : {}) };
  }).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)).map((entry, index) => ({ ...entry, displayOrder: index }));
  const dataVisible = normalizedColumns.filter((entry) => entry.visible && isDataColumn(columns.find((column) => column.fieldId === entry.fieldId)!));
  if (!dataVisible.length) { const first = normalizedColumns.find((entry) => isDataColumn(columns.find((column) => column.fieldId === entry.fieldId)!)); if (first) normalizedColumns[normalizedColumns.indexOf(first)] = { ...first, visible: true }; }
  const sorts = (source.sorts ?? []).map((sort) => ({ ...sort, fieldId: migrate(sort.fieldId) })).filter((sort, index, all) => known.has(sort.fieldId) && all.findIndex((candidate) => candidate.fieldId === sort.fieldId) === index);
  const groups = version < 4 ? createGridState(columns).groups : (source.groups ?? []).map((group) => ({ ...group, fieldId: migrate(group.fieldId) })).filter((group, index, all) => known.has(group.fieldId) && all.findIndex((candidate) => candidate.fieldId === group.fieldId) === index);
  const migratedFilter = migrateFilter(source.filter ?? null, aliases, version < 5);
  return createGridState(columns, { ...source, version: CG_GRID_STATE_VERSION, pageIndex: Math.max(0, source.pageIndex ?? 0), sorts, groups, filter: pruneGridFilter(migratedFilter, known), columns: normalizedColumns, focusedColumnId: source.focusedColumnId ? (known.has(migrate(source.focusedColumnId)) ? migrate(source.focusedColumnId) : null) : null, expandedGroupPaths: version < 8 ? [] : source.expandedGroupPaths ?? [] });
}

export function savedViewState(state: CgGridState): CgGridState { return { ...state, pageIndex: 0, selectedKeys: [], focusedRowKey: null, focusedColumnId: null, collapsedGroupKeys: [], expandedGroupPaths: [] }; }
