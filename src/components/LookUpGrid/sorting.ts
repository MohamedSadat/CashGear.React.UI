import type { CgLookUpGridColumnDescriptor, CgLookUpGridSort } from './CgLookUpGrid.types';

function compareValues(left: unknown, right: unknown, locale?: string): number {
  if (Object.is(left, right)) return 0;
  if (left === null || left === undefined) return -1;
  if (right === null || right === undefined) return 1;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === 'number' && typeof right === 'number') return Number.isNaN(left) ? -1 : Number.isNaN(right) ? 1 : left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  const text = (value: unknown): string => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
    if (typeof value === 'symbol') return value.description ?? '';
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    throw new TypeError('CgLookUpGrid local sorting supports nulls, strings, numbers, dates, and Booleans.');
  };
  return text(left).localeCompare(text(right), locale, { numeric: true, sensitivity: 'base' });
}

export function sortLookUpItems<TItem>(
  items: ReadonlyArray<TItem>,
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>,
  sort: CgLookUpGridSort | null,
  locale?: string,
): TItem[] {
  if (!sort) return [...items];
  const column = columns.find((candidate) => candidate.fieldId === sort.fieldId);
  if (!column?.accessor) return [...items];
  const factor = sort.direction === 'descending' ? -1 : 1;
  return items.map((item, index) => ({ item, index })).sort((left, right) => {
    const result = compareValues(column.accessor!(left.item), column.accessor!(right.item), locale) * factor;
    return result || left.index - right.index;
  }).map(({ item }) => item);
}

export function parseLookUpSort<TItem>(
  value: string | CgLookUpGridSort | null | undefined,
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>,
): CgLookUpGridSort | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'string' ? (() => {
    const parts = value.trim().split(/\s+/u);
    if (parts.length < 1 || parts.length > 2 || !parts[0]) throw new Error('CgLookUpGrid initialSort must be "field", "field asc", or "field desc".');
    const direction = parts[1]?.toLowerCase();
    if (direction && direction !== 'asc' && direction !== 'desc') throw new Error('CgLookUpGrid initialSort direction must be "asc" or "desc".');
    return { fieldId: parts[0], direction: direction === 'desc' ? 'descending' as const : 'ascending' as const };
  })() : value;
  if (parsed.direction !== 'ascending' && parsed.direction !== 'descending') {
    throw new Error('CgLookUpGrid initialSort direction must be "ascending" or "descending".');
  }
  const column = columns.find((candidate) => candidate.fieldId === parsed.fieldId);
  if (!column || column.visible === false || column.sortable === false) {
    throw new Error(`CgLookUpGrid initialSort refers to unavailable sortable field "${parsed.fieldId}".`);
  }
  return Object.freeze({ fieldId: parsed.fieldId, direction: parsed.direction });
}
