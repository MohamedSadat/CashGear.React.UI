/* eslint-disable @typescript-eslint/no-base-to-string -- custom summary values use safe fallback display text. */
import type { CgGridColumnDescriptor, CgGridSummaryDescriptor } from './CgGrid.types';

export function validateGridSummaries<TItem>(summaries: ReadonlyArray<CgGridSummaryDescriptor>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): void {
  const ids = new Set<string>();
  for (const summary of summaries) {
    if (!summary.id.trim() || ids.has(summary.id)) throw new Error(`CgGrid summary id '${summary.id}' is blank or duplicated.`);
    ids.add(summary.id);
    if (summary.type !== 'count' && !summary.fieldId) throw new Error(`CgGrid ${summary.type} summary '${summary.id}' requires fieldId.`);
    const column = summary.fieldId ? columns.get(summary.fieldId) : undefined;
    if (summary.fieldId && !column?.accessor) throw new Error(`CgGrid summary '${summary.id}' references unknown field '${summary.fieldId}'.`);
    if (['sum', 'average'].includes(summary.type) && column?.type !== 'number') throw new Error(`CgGrid ${summary.type} summary '${summary.id}' requires a number column.`);
  }
}

export function calculateGridSummaries<TItem>(items: ReadonlyArray<TItem>, summaries: ReadonlyArray<CgGridSummaryDescriptor>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const summary of summaries) {
    if (summary.type === 'count') { result[summary.id] = items.length; continue; }
    const accessor = summary.fieldId ? columns.get(summary.fieldId)?.accessor : undefined;
    const values = accessor ? items.map(accessor).filter((value) => value !== null && value !== undefined) : [];
    if (summary.type === 'sum' || summary.type === 'average') {
      const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
      const sum = numbers.reduce((total, value) => total + value, 0);
      result[summary.id] = summary.type === 'sum' ? sum : numbers.length ? sum / numbers.length : null;
    } else {
      result[summary.id] = values.length ? values.reduce((best, value) => {
        const left = value instanceof Date ? value.getTime() : value as string | number;
        const right = best instanceof Date ? best.getTime() : best as string | number;
        return summary.type === 'minimum' ? left < right ? value : best : left > right ? value : best;
      }) : null;
    }
  }
  return result;
}

export function formatGridSummary(value: unknown, descriptor: CgGridSummaryDescriptor): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(value);
  if (typeof value === 'number') return new Intl.NumberFormat(undefined, descriptor.format ? { minimumFractionDigits: Number(descriptor.format) || 0 } : undefined).format(value);
  return String(value);
}
