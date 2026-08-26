/* eslint-disable @typescript-eslint/no-base-to-string -- stable fallback comparison supports serializable scalar values. */
import type { CgGridColumnDescriptor, CgGridFilterNode, CgGridGroupDescriptor, CgGridSortDescriptor, CgGridSummaryDescriptor } from './CgGrid.types';
import type { CgGridLocalGroup } from './grouping';
import { formatGridValue, isSearchableColumn } from './columns';
import { evaluateGridFilter } from './filtering';
import { buildLocalGroups } from './grouping';
import { calculateGridSummaries } from './summaries';

export interface CgGridLocalResult<TItem> { readonly filteredSortedItems: ReadonlyArray<TItem>; readonly pageItems: ReadonlyArray<TItem>; readonly totalCount: number; readonly summaries: Readonly<Record<string, unknown>>; readonly groups: ReadonlyArray<CgGridLocalGroup<TItem>>; readonly pageCount: number; readonly pageIndex: number }

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

export function processLocalGridData<TItem>(options: { readonly data: ReadonlyArray<TItem>; readonly columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>; readonly searchText: string; readonly filter: CgGridFilterNode | null; readonly sorts: ReadonlyArray<CgGridSortDescriptor>; readonly groups: ReadonlyArray<CgGridGroupDescriptor>; readonly summaries: ReadonlyArray<CgGridSummaryDescriptor>; readonly groupSummaries: ReadonlyArray<CgGridSummaryDescriptor>; readonly pageIndex: number; readonly pageSize: number }): CgGridLocalResult<TItem> {
  const columnMap = new Map(options.columns.map((column) => [column.fieldId, column]));
  const searchColumns = options.columns.filter(isSearchableColumn);
  const query = options.searchText.trim().toLocaleLowerCase();
  const searched = query ? options.data.filter((item) => searchColumns.some((column) => formatGridValue(column, item).toLocaleLowerCase().includes(query))) : [...options.data];
  const filtered = searched.filter((item) => evaluateGridFilter(options.filter, item, columnMap));
  const summaries = calculateGridSummaries(filtered, options.summaries, columnMap);
  const sorted = stableSortGridItems(filtered, options.sorts, columnMap);
  const groups = buildLocalGroups(sorted, options.groups, columnMap, options.groupSummaries);
  const pageCount = Math.max(1, Math.ceil(sorted.length / options.pageSize));
  const pageIndex = Math.min(Math.max(0, options.pageIndex), pageCount - 1);
  return { filteredSortedItems: sorted, pageItems: sorted.slice(pageIndex * options.pageSize, (pageIndex + 1) * options.pageSize), totalCount: sorted.length, summaries, groups, pageCount, pageIndex };
}
