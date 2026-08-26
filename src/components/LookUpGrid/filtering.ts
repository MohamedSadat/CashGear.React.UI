import type { CgLookUpGridColumnDescriptor } from './CgLookUpGrid.types';

export function normalizeLookUpText(value: string): string {
  return value.trim().replace(/\s+/gu, ' ');
}

export function foldLookUpText(value: string, locale: string | undefined, ignoreDiacritics: boolean): string {
  let normalized = normalizeLookUpText(value);
  if (ignoreDiacritics) {
    normalized = normalized
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/\u0640/gu, '')
      .replace(/[أإآٱ]/gu, 'ا')
      .replace(/ؤ/gu, 'و')
      .replace(/ئ/gu, 'ي');
  }
  return locale ? normalized.toLocaleLowerCase(locale) : normalized.toLocaleLowerCase();
}

export function formatLookUpCell<TItem>(column: CgLookUpGridColumnDescriptor<TItem>, item: TItem): string {
  if (!column.accessor) return '';
  const value = column.accessor(item);
  if (column.formatValue) return column.formatValue(value, item) ?? '';
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toLocaleString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.description ?? '';
  throw new TypeError(`CgLookUpGrid column "${column.fieldId}" requires formatValue when its accessor returns an object.`);
}

export function filterLookUpItems<TItem>(
  items: ReadonlyArray<TItem>,
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>,
  searchText: string,
  filters: Readonly<Record<string, string>>,
  locale: string | undefined,
  ignoreDiacritics: boolean,
): TItem[] {
  const foldedSearch = foldLookUpText(searchText, locale, ignoreDiacritics);
  const searchable = columns.filter((column) => column.visible !== false && column.searchable !== false);
  const filterEntries = Object.entries(filters);
  const byField = new Map(columns.map((column) => [column.fieldId, column]));
  return items.filter((item) => {
    if (foldedSearch && !searchable.some((column) => foldLookUpText(formatLookUpCell(column, item), locale, ignoreDiacritics).includes(foldedSearch))) return false;
    return filterEntries.every(([fieldId, filter]) => {
      const column = byField.get(fieldId);
      if (!column) return false;
      return foldLookUpText(formatLookUpCell(column, item), locale, ignoreDiacritics)
        .includes(foldLookUpText(filter, locale, ignoreDiacritics));
    });
  });
}
