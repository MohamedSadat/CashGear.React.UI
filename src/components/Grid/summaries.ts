/* eslint-disable @typescript-eslint/no-base-to-string -- custom summary values use safe fallback display text. */
import type { CgGridAggregateErrorDetails, CgGridAggregateScope, CgGridAggregateValue, CgGridColumnDescriptor, CgGridProviderSummaryDescriptor, CgGridSummaryDescriptor } from './CgGrid.types';

export function validateGridSummaries<TItem>(summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): void {
  const ids = new Set<string>();
  for (const summary of summaries) {
    if (!summary.id.trim() || ids.has(summary.id)) throw new Error(`CgGrid summary id '${summary.id}' is blank or duplicated.`);
    ids.add(summary.id);
    if (summary.type === 'custom') {
      if (!summary.aggregateKey?.trim()) throw new Error(`CgGrid custom summary '${summary.id}' requires aggregateKey.`);
      if (!summary.inputFieldIds?.length) throw new Error(`CgGrid custom summary '${summary.id}' requires at least one input field.`);
      if (new Set(summary.inputFieldIds).size !== summary.inputFieldIds.length || summary.inputFieldIds.some((fieldId) => !fieldId.trim())) throw new Error(`CgGrid custom summary '${summary.id}' input fields must be ordered, unique, non-blank IDs.`);
      for (const fieldId of summary.inputFieldIds) if (!columns.get(fieldId)?.accessor) throw new Error(`CgGrid custom summary '${summary.id}' references unknown input field '${fieldId}'.`);
      continue;
    }
    if (summary.type !== 'count' && !summary.fieldId) throw new Error(`CgGrid ${summary.type} summary '${summary.id}' requires fieldId.`);
    const column = summary.fieldId ? columns.get(summary.fieldId) : undefined;
    if (summary.fieldId && !column?.accessor) throw new Error(`CgGrid summary '${summary.id}' references unknown field '${summary.fieldId}'.`);
    if (['sum', 'average'].includes(summary.type) && column?.type !== 'number') throw new Error(`CgGrid ${summary.type} summary '${summary.id}' requires a number column.`);
  }
}

export function calculateGridSummaries<TItem>(items: ReadonlyArray<TItem>, summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>): Readonly<Record<string, unknown>> {
  const result: Record<string, unknown> = {};
  for (const summary of summaries) {
    if (summary.type === 'custom') continue;
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

export function formatGridSummary<TItem>(value: unknown, descriptor: CgGridSummaryDescriptor<TItem>): string {
  if (value === null || value === undefined) return '—';
  if (value instanceof Date) return new Intl.DateTimeFormat(undefined, { dateStyle: 'short' }).format(value);
  if (typeof value === 'number') return new Intl.NumberFormat(undefined, descriptor.format ? { minimumFractionDigits: Number(descriptor.format) || 0 } : undefined).format(value);
  return String(value);
}

export function providerGridSummaries<TItem>(summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, scope: 'total' | 'group'): ReadonlyArray<CgGridProviderSummaryDescriptor> {
  return summaries.map((summary) => ({
    id: summary.id,
    type: summary.type,
    ...(summary.fieldId ? { fieldId: summary.fieldId } : {}),
    ...(summary.aggregateKey ? { aggregateKey: summary.aggregateKey } : {}),
    ...(summary.inputFieldIds ? { inputFieldIds: [...summary.inputFieldIds] } : {}),
    visible: summary.visible !== false,
    scope,
  }));
}

function safeAggregateErrorCode(value: string | undefined, fallback: string): string {
  return value && /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value) ? value : fallback;
}

export async function calculateCustomGridSummaries<TItem>(
  items: ReadonlyArray<TItem>,
  summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>,
  scope: CgGridAggregateScope,
  signal: AbortSignal,
  onError?: (details: CgGridAggregateErrorDetails<TItem>) => void,
): Promise<Readonly<Record<string, CgGridAggregateValue>>> {
  const custom = summaries.filter((summary) => summary.type === 'custom');
  const entries = await Promise.all(custom.map(async (descriptor): Promise<readonly [string, CgGridAggregateValue]> => {
    if (signal.aborted) throw new DOMException('The aggregate operation was aborted.', 'AbortError');
    if (!descriptor.localAggregate || !descriptor.aggregateKey || !descriptor.inputFieldIds) return [descriptor.id, { available: false, loading: false, errorCode: 'custom-aggregate-unavailable', completeness: 'unknown', scope }];
    try {
      const result = await descriptor.localAggregate({ aggregateKey: descriptor.aggregateKey, inputFieldIds: descriptor.inputFieldIds, items, scope, completeness: 'complete', signal });
      if (signal.aborted) throw new DOMException('The aggregate operation was aborted.', 'AbortError');
      const completeness = result.completeness ?? 'complete';
      const errorCode = result.errorCode ? safeAggregateErrorCode(result.errorCode, 'custom-aggregate-unavailable') : undefined;
      return [descriptor.id, { available: result.available, ...(result.available ? { value: result.value } : {}), loading: false, ...(errorCode ? { errorCode } : {}), completeness, scope }];
    } catch (error) {
      if (signal.aborted || error instanceof DOMException && error.name === 'AbortError') throw error;
      const errorCode = 'custom-aggregate-failed'; onError?.({ descriptor, scope, errorCode, error });
      return [descriptor.id, { available: false, loading: false, errorCode, completeness: 'unknown', scope }];
    }
  }));
  return Object.fromEntries(entries);
}
