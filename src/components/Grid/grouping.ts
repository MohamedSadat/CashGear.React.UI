/* eslint-disable @typescript-eslint/no-base-to-string -- group member keys use stable scalar fallback text. */
import type { CgGridAggregateValue, CgGridColumnDescriptor, CgGridGroupDescriptor, CgGridSummaryDescriptor } from './CgGrid.types';
import { calculateGridSummaries } from './summaries';
import { formatGridValue } from './columns';

export interface CgGridLocalGroup<TItem> { readonly kind: 'group'; readonly key: string; readonly level: number; readonly fieldId: string; readonly value: unknown; readonly displayText: string; readonly items: ReadonlyArray<TItem>; readonly children: ReadonlyArray<CgGridLocalGroup<TItem>>; readonly summaries: Readonly<Record<string, unknown>>; readonly aggregateStates?: Readonly<Record<string, CgGridAggregateValue>> }

function memberKey(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'blank';
  if (value instanceof Date) return `date:${value.toISOString()}`;
  return `${typeof value}:${String(value)}`;
}

export function buildLocalGroups<TItem>(items: ReadonlyArray<TItem>, groups: ReadonlyArray<CgGridGroupDescriptor>, columns: ReadonlyMap<string, CgGridColumnDescriptor<TItem>>, summaries: ReadonlyArray<CgGridSummaryDescriptor<TItem>>, parentKey = ''): ReadonlyArray<CgGridLocalGroup<TItem>> {
  if (!groups.length) return [];
  const [current, ...rest] = groups;
  if (!current) return [];
  const column = columns.get(current.fieldId);
  if (!column?.accessor) return [];
  const buckets = new Map<string, { value: unknown; items: TItem[] }>();
  for (const item of items) {
    const value = column.accessor(item); const key = memberKey(value);
    const bucket = buckets.get(key) ?? { value, items: [] }; bucket.items.push(item); buckets.set(key, bucket);
  }
  const ordered = [...buckets.entries()].sort(([, a], [, b]) => String(a.value ?? '').localeCompare(String(b.value ?? ''), undefined, { sensitivity: 'base', numeric: true }) * (current.direction === 'descending' ? -1 : 1));
  return ordered.map(([member, bucket]) => {
    const key = `${parentKey}/${current.fieldId}=${encodeURIComponent(member)}`;
    return { kind: 'group', key, level: groups.length - rest.length - 1, fieldId: current.fieldId, value: bucket.value, displayText: bucket.value === null || bucket.value === undefined || bucket.value === '' ? '(Blank)' : formatGridValue(column, bucket.items[0]!), items: bucket.items, children: buildLocalGroups(bucket.items, rest, columns, summaries, key), summaries: calculateGridSummaries(bucket.items, summaries, columns) };
  });
}

export function flattenLocalGroups<TItem>(groups: ReadonlyArray<CgGridLocalGroup<TItem>>, collapsed: ReadonlySet<string>): ReadonlyArray<CgGridLocalGroup<TItem> | TItem> {
  const result: Array<CgGridLocalGroup<TItem> | TItem> = [];
  const visit = (group: CgGridLocalGroup<TItem>) => {
    result.push(group); if (collapsed.has(group.key)) return;
    if (group.children.length) group.children.forEach(visit); else result.push(...group.items);
  };
  groups.forEach(visit); return result;
}
