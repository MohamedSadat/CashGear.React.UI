/* eslint-disable @typescript-eslint/no-base-to-string -- display formatting explicitly accepts caller values. */
import type { CgGridColumnDescriptor, CgGridColumnState } from './CgGrid.types';

export interface NormalizedGridColumn<TItem> {
  readonly descriptor: CgGridColumnDescriptor<TItem>;
  readonly fieldId: string;
  readonly title: string;
  readonly visible: boolean;
  readonly frozen: boolean;
  readonly displayOrder: number;
  readonly width?: number | string;
}

export function validateGridColumns<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>): void {
  if (columns.length === 0) throw new Error('CgGrid requires at least one column descriptor.');
  const identities = new Map<string, string>();
  for (const column of columns) {
    const id = column.fieldId.trim();
    if (!id) throw new Error('CgGrid column fieldId cannot be blank.');
    const aliases = [id, ...(column.formerFieldIds ?? []).map((alias) => alias.trim())];
    if (aliases.some((alias) => !alias)) throw new Error(`CgGrid column '${id}' contains a blank formerFieldId.`);
    if (new Set(aliases).size !== aliases.length) throw new Error(`CgGrid column '${id}' contains a duplicate field identity.`);
    for (const identity of aliases) {
      const owner = identities.get(identity);
      if (owner) throw new Error(`CgGrid field identity '${identity}' is shared by columns '${owner}' and '${id}'.`);
      identities.set(identity, id);
    }
    const requiresAccessor = !['selection', 'command'].includes(column.type);
    if (requiresAccessor && !column.accessor) throw new Error(`CgGrid ${column.type} column '${id}' requires an accessor.`);
    if (column.type === 'template' && !column.renderCell) throw new Error(`CgGrid template column '${id}' requires renderCell.`);
    if (column.minWidth !== undefined && (!Number.isFinite(column.minWidth) || column.minWidth <= 0)) throw new Error(`CgGrid column '${id}' has an invalid minWidth.`);
    if (column.maxWidth !== undefined && (!Number.isFinite(column.maxWidth) || column.maxWidth <= 0)) throw new Error(`CgGrid column '${id}' has an invalid maxWidth.`);
    if (column.minWidth !== undefined && column.maxWidth !== undefined && column.minWidth > column.maxWidth) throw new Error(`CgGrid column '${id}' has minWidth greater than maxWidth.`);
  }
}

export function columnAliases<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const column of columns) for (const id of [column.fieldId, ...(column.formerFieldIds ?? [])]) result.set(id.trim(), column.fieldId.trim());
  return result;
}

export function normalizeGridColumns<TItem>(columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>, state: ReadonlyArray<CgGridColumnState>): ReadonlyArray<NormalizedGridColumn<TItem>> {
  validateGridColumns(columns);
  const byId = new Map(state.map((entry) => [entry.fieldId, entry]));
  return columns.map((descriptor, declarationIndex) => {
    const stored = byId.get(descriptor.fieldId);
    const width = stored?.userWidth ?? descriptor.width;
    return { descriptor, fieldId: descriptor.fieldId, title: descriptor.title?.trim() || descriptor.fieldId, visible: stored?.visible ?? descriptor.visible ?? true, frozen: stored?.frozen ?? false, displayOrder: stored?.displayOrder ?? declarationIndex, ...(width === undefined ? {} : { width }) };
  }).sort((a, b) => Number(b.frozen) - Number(a.frozen) || a.displayOrder - b.displayOrder);
}

export function isDataColumn<TItem>(column: CgGridColumnDescriptor<TItem>): boolean { return !['selection', 'command'].includes(column.type); }
export function isSortableColumn<TItem>(column: CgGridColumnDescriptor<TItem>): boolean { return isDataColumn(column) && column.sortable !== false && !!column.accessor; }
export function isFilterableColumn<TItem>(column: CgGridColumnDescriptor<TItem>): boolean { return isDataColumn(column) && column.filterable !== false && !!column.accessor; }
export function isSearchableColumn<TItem>(column: CgGridColumnDescriptor<TItem>): boolean { return isDataColumn(column) && column.searchable !== false && !!column.accessor; }
export function isGroupableColumn<TItem>(column: CgGridColumnDescriptor<TItem>): boolean { return isDataColumn(column) && column.groupable !== false && !!column.accessor; }

export function clampColumnWidth<TItem>(column: CgGridColumnDescriptor<TItem>, width: number): number {
  const minimum = column.minWidth ?? 48;
  const maximum = column.maxWidth ?? 1600;
  return Math.min(maximum, Math.max(minimum, width));
}

export function formatGridValue<TItem>(column: CgGridColumnDescriptor<TItem>, item: TItem, locale?: string): string {
  const value = column.accessor?.(item);
  if (value === null || value === undefined) return '';
  if (typeof column.format === 'function') return column.format(value as never, item);
  if (column.type === 'number' && typeof value === 'number') return new Intl.NumberFormat(locale, column.format ? { minimumFractionDigits: Number(column.format) || 0 } : undefined).format(value);
  if (column.type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locale, column.dateTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(date);
  }
  if (column.type === 'boolean') return value ? 'True' : 'False';
  return String(value);
}
