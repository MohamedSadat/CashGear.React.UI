/* eslint-disable @typescript-eslint/no-base-to-string -- stable fallback comparison supports serializable scalar values. */
import type { CgGridAggregateErrorDetails, CgGridAggregateValue, CgGridColumnDescriptor, CgGridFilterNode, CgGridGroupDescriptor, CgGridSortDescriptor, CgGridSummaryDescriptor } from './CgGrid.types';
import { compileFilterPredicate } from '../../filter';
import type { CgFilterEvaluationContext, CgFilterFieldDescriptor } from '../../filter';
import type { CgGridLocalGroup } from './grouping';
import { formatGridValue, isSearchableColumn } from './columns';
import { CgGridFilterConfigurationError, gridFilterRegistry, validateGridFilter } from './filtering';
import { buildLocalGroups } from './grouping';
import { calculateCustomGridSummaries, calculateGridSummaries } from './summaries';

export interface CgGridLocalResult<TItem> { readonly filteredSortedItems: ReadonlyArray<TItem>; readonly pageItems: ReadonlyArray<TItem>; readonly totalCount: number; readonly summaries: Readonly<Record<string, unknown>>; readonly aggregateStates: Readonly<Record<string, CgGridAggregateValue>>; readonly groups: ReadonlyArray<CgGridLocalGroup<TItem>>; readonly pageCount: number; readonly pageIndex: number }
export interface CgGridLocalDataOptions<TItem> { readonly data: ReadonlyArray<TItem>; readonly columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>; readonly searchText: string; readonly filter: CgGridFilterNode | null; readonly filterEnabled?: boolean; readonly filterFields?: ReadonlyArray<CgFilterFieldDescriptor<TItem>>; readonly filterEvaluationContext?: CgFilterEvaluationContext; readonly isFilterFieldAuthorized?: (field: CgFilterFieldDescriptor<TItem>) => boolean; readonly sorts: ReadonlyArray<CgGridSortDescriptor>; readonly groups: ReadonlyArray<CgGridGroupDescriptor>; readonly summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>; readonly groupSummaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>; readonly pageIndex: number; readonly pageSize: number }

function compareValues(left: unknown, right: unknown): number {
  if (left === right) return 0; if (left === null || left === undefined) return -1; if (right === null || right === undefined) return 1;
  if (left instanceof Date || right instanceof Date) return new Date(String(left)).getTime() - new Date(String(right)).getTime();
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base', numeric: true });
}

export function stableSortGridItems<TItem>(items: ReadonlyArray<TItem>, sorts: ReadonlyArray<CgGridSortDescriptor>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): ReadonlyArray<TItem> {
  return items.map((item, index) => ({ item, index })).sort((a, b) => {
    for (const sort of sorts) { const accessor = columns.get(sort.fieldId)?.accessor; if (!accessor) continue; const compared = compareValues(accessor(a.item), accessor(b.item)); if (compared) return compared * (sort.direction === 'descending' ? -1 : 1); }
    return a.index - b.index;
  }).map(({ item }) => item);
}

export function processLocalGridData<TItem>(options: CgGridLocalDataOptions<TItem>): CgGridLocalResult<TItem> {
  const columnMap = new Map(options.columns.map((column) => [column.fieldId, column]));
  const searchColumns = options.columns.filter(isSearchableColumn);
  const query = options.searchText.trim().toLocaleLowerCase();
  const searched = query ? options.data.filter((item) => searchColumns.some((column) => formatGridValue(column, item).toLocaleLowerCase().includes(query))) : [...options.data];
  const validation = validateGridFilter(options.filter, options.columns, options.filterFields, options.filterEvaluationContext, options.isFilterFieldAuthorized);
  if (options.filterEnabled !== false && !validation.valid) throw new CgGridFilterConfigurationError('The local Grid filter is invalid.', validation.problems);
  const predicate = options.filterEnabled === false ? () => true : compileFilterPredicate(validation.criteria, gridFilterRegistry(options.columns, options.filterFields), options.filterEvaluationContext);
  const filtered = searched.filter(predicate);
  const summaries = calculateGridSummaries(filtered, options.summaries, columnMap);
  const aggregateStates = Object.fromEntries(options.summaries.filter((summary) => summary.type !== 'custom').map((summary) => [summary.id, { available: true, value: summaries[summary.id], loading: false, completeness: 'complete', scope: { kind: 'total' } } satisfies CgGridAggregateValue]));
  const sorted = stableSortGridItems(filtered, options.sorts, columnMap);
  const groups = buildLocalGroups(sorted, options.groups, columnMap, options.groupSummaries);
  const pageCount = Math.max(1, Math.ceil(sorted.length / options.pageSize));
  const pageIndex = Math.min(Math.max(0, options.pageIndex), pageCount - 1);
  return { filteredSortedItems: sorted, pageItems: sorted.slice(pageIndex * options.pageSize, (pageIndex + 1) * options.pageSize), totalCount: sorted.length, summaries, aggregateStates, groups, pageCount, pageIndex };
}

async function resolveGroupAggregates<TItem>(groups: ReadonlyArray<CgGridLocalGroup<TItem>>, summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, signal: AbortSignal, onError?: (details: CgGridAggregateErrorDetails<TItem>) => void): Promise<ReadonlyArray<CgGridLocalGroup<TItem>>> {
  return Promise.all(groups.map(async (group) => {
    const scope = { kind: 'group' as const, groupKey: group.key };
    const aggregateStates = await calculateCustomGridSummaries(group.items, summaries, scope, signal, onError);
    const children = await resolveGroupAggregates(group.children, summaries, signal, onError);
    const customValues = Object.fromEntries(Object.entries(aggregateStates).filter(([, state]) => state.available).map(([id, state]) => [id, state.value]));
    return { ...group, children, summaries: { ...group.summaries, ...customValues }, aggregateStates: { ...group.aggregateStates, ...aggregateStates } };
  }));
}

export async function processLocalGridDataAsync<TItem>(options: CgGridLocalDataOptions<TItem>, context: { readonly signal: AbortSignal; readonly onAggregateError?: (details: CgGridAggregateErrorDetails<TItem>) => void }): Promise<CgGridLocalResult<TItem>> {
  const result = processLocalGridData(options);
  const aggregateStates = await calculateCustomGridSummaries(result.filteredSortedItems, options.summaries, { kind: 'total' }, context.signal, context.onAggregateError);
  const groups = await resolveGroupAggregates(result.groups, options.groupSummaries, context.signal, context.onAggregateError);
  const customValues = Object.fromEntries(Object.entries(aggregateStates).filter(([, state]) => state.available).map(([id, state]) => [id, state.value]));
  return { ...result, summaries: { ...result.summaries, ...customValues }, aggregateStates: { ...result.aggregateStates, ...aggregateStates }, groups };
}
