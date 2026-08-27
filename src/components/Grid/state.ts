import type { CgFilterEvaluationContext, CgFilterFieldDescriptor, CgFilterNode, CgFilterProblem } from '../../filter';
import { mapFilterFieldIds } from '../../filter';
import type {
  CgGridColumnDescriptor, CgGridColumnState, CgGridFilterNode, CgGridState, CgGridSummaryDescriptor, CgGridSummaryState,
} from './CgGrid.types';
import { clampColumnWidth, columnAliases, isDataColumn } from './columns';
import { normalizeGridFilter, validateGridFilter } from './filtering';

export const CG_GRID_STATE_VERSION = 10;

export interface CgGridStateNormalizationOptions<TItem> {
  readonly filterFields?: ReadonlyArray<CgFilterFieldDescriptor<TItem>>;
  readonly filterEvaluationContext?: CgFilterEvaluationContext;
  readonly isFilterFieldAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean;
  readonly summaries?: ReadonlyArray<CgGridSummaryDescriptor<TItem>>;
}

function adoptLegacySources(node: CgFilterNode): CgFilterNode {
  if (node.kind === 'condition') return { ...node, source: 'filterRow' };
  if (node.kind === 'group' && node.operator === 'and' && node.children.every((child) => child.kind === 'condition')) return { ...node, children: node.children.map((child) => ({ ...child, source: 'filterRow' as const })) };
  return node;
}

function migrateFilter(input: CgGridFilterNode | null, aliases: ReadonlyMap<string, string>, legacySource: boolean): { readonly filter: CgFilterNode | null; readonly problems: ReadonlyArray<CgFilterProblem> } {
  try {
    const decoded = normalizeGridFilter(input);
    if (!decoded) return { filter: null, problems: [] };
    const sourced = legacySource ? adoptLegacySources(decoded) : decoded;
    return { filter: mapFilterFieldIds(sourced, (fieldId) => aliases.get(fieldId) ?? fieldId), problems: [] };
  } catch (error) {
    return { filter: null, problems: [{ kind: 'unknownNode', message: error instanceof Error ? error.message : 'The saved Grid filter is malformed.', path: '$', blocksApply: true }] };
  }
}

function normalizeSummaryStates<TItem>(source: ReadonlyArray<CgGridSummaryState> | undefined, declared: ReadonlyArray<CgGridSummaryDescriptor<TItem>> | undefined): ReadonlyArray<CgGridSummaryState> {
  const saved = new Map<string, CgGridSummaryState>();
  for (const summary of source ?? []) if (summary.id?.trim()) saved.set(summary.id.trim(), { id: summary.id.trim(), ...(summary.aggregateKey?.trim() ? { aggregateKey: summary.aggregateKey.trim() } : {}), visible: summary.visible !== false });
  if (!declared) return Object.freeze([...saved.values()]);
  const result = new Map<string, CgGridSummaryState>();
  for (const descriptor of declared) {
    const id = descriptor.id.trim();
    if (!id) continue;
    const aggregateKey = 'aggregateKey' in descriptor && typeof descriptor.aggregateKey === 'string' && descriptor.aggregateKey.trim() ? descriptor.aggregateKey.trim() : undefined;
    const prior = saved.get(id);
    result.set(id, { id, ...(aggregateKey ? { aggregateKey } : {}), visible: prior && prior.aggregateKey === aggregateKey ? prior.visible : descriptor.visible !== false });
  }
  return Object.freeze([...result.values()]);
}

export function createGridState<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, input: Partial<CgGridState> = {}): CgGridState {
  const pageSize = Number.isInteger(input.pageSize) && (input.pageSize ?? 0) > 0 ? input.pageSize! : 50;
  const columnState = columns.map((column, index): CgGridColumnState => ({ fieldId: column.fieldId, visible: column.visible ?? true, frozen: false, displayOrder: index }));
  const initialGroups = columns.filter((column) => column.initialGroupIndex !== undefined).sort((a, b) => a.initialGroupIndex! - b.initialGroupIndex!).map((column) => ({ fieldId: column.fieldId, direction: 'ascending' as const }));
  return {
    version: CG_GRID_STATE_VERSION, pageIndex: input.pageIndex ?? 0, pageSize, searchText: input.searchText ?? '', sorts: input.sorts ?? [],
    filter: input.filter ?? null, filterDisabled: input.filterDisabled ?? false, filterProblems: input.filterProblems ?? [],
    selectedKeys: input.selectedKeys ?? [], focusedRowKey: input.focusedRowKey ?? null, focusedColumnId: input.focusedColumnId ?? null,
    columns: input.columns?.length ? input.columns : columnState, collapsedGroupKeys: input.collapsedGroupKeys ?? [],
    groups: input.groups?.length ? input.groups : initialGroups, expandedGroupPaths: input.expandedGroupPaths ?? [], summaries: input.summaries ?? [],
  };
}

export function normalizeGridState<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, source: Partial<CgGridState>, options: CgGridStateNormalizationOptions<TItem> = {}): CgGridState {
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
  const declaredGroups = columns.filter((column) => column.initialGroupIndex !== undefined).sort((a, b) => a.initialGroupIndex! - b.initialGroupIndex!).map((column) => ({ fieldId: column.fieldId, direction: 'ascending' as const }));
  const groups = (version < 4 ? declaredGroups : source.groups ?? []).map((group) => ({ ...group, fieldId: migrate(group.fieldId) })).filter((group, index, all) => known.has(group.fieldId) && all.findIndex((candidate) => candidate.fieldId === group.fieldId) === index);
  const migrated = migrateFilter(source.filter ?? null, aliases, version < 5);
  const retainedProblems = !migrated.filter && source.filterProblems?.some((problem) => problem.blocksApply) ? source.filterProblems : undefined;
  const validation = migrated.problems.length
    ? { criteria: migrated.filter, valid: false, problems: migrated.problems }
    : retainedProblems ? { criteria: null, valid: false, problems: retainedProblems }
      : validateGridFilter(migrated.filter, columns, options.filterFields, options.filterEvaluationContext, options.isFilterFieldAuthorized);
  return createGridState(columns, {
    ...source, version: CG_GRID_STATE_VERSION, pageIndex: Math.max(0, source.pageIndex ?? 0), sorts, groups,
    filter: validation.criteria, filterDisabled: version < 10 ? false : source.filterDisabled ?? false, filterProblems: validation.problems,
    columns: normalizedColumns, focusedColumnId: source.focusedColumnId ? (known.has(migrate(source.focusedColumnId)) ? migrate(source.focusedColumnId) : null) : null,
    expandedGroupPaths: version < 8 ? [] : source.expandedGroupPaths ?? [], summaries: normalizeSummaryStates(version < 9 ? [] : source.summaries, options.summaries),
  });
}

export function savedViewState(state: CgGridState): CgGridState {
  return { ...state, pageIndex: 0, selectedKeys: [], focusedRowKey: null, focusedColumnId: null, collapsedGroupKeys: [], expandedGroupPaths: [] };
}
