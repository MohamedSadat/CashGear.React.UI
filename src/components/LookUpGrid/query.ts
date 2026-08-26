import type { CgLookUpGridColumnDescriptor, CgLookUpGridQuery, CgLookUpGridSort } from './CgLookUpGrid.types';
import { normalizeLookUpText } from './filtering';

export function normalizeColumnFilters(values: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [fieldId, value] of Object.entries(values)) {
    const normalized = value.trim();
    if (normalized) result[fieldId] = normalized;
  }
  return Object.freeze(result);
}

export function createLookUpQuery<TItem, TContext>(options: {
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>;
  searchText: string;
  sort: CgLookUpGridSort | null;
  columnFilters: Readonly<Record<string, string>>;
  skip: number;
  take: number;
  queryContext: TContext;
}): CgLookUpGridQuery<TContext> {
  const search = normalizeLookUpText(options.searchText);
  const filters = normalizeColumnFilters(options.columnFilters);
  return Object.freeze({
    searchText: search || null,
    searchFields: Object.freeze(options.columns.filter((column) => column.visible !== false && column.searchable !== false).map((column) => column.fieldId)),
    sort: options.sort ? Object.freeze({ ...options.sort }) : null,
    columnFilters: Object.keys(filters).length > 0 ? filters : undefined,
    skip: options.skip,
    take: options.take,
    queryContext: options.queryContext,
  });
}
