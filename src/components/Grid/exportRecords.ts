import { awaitWithAbort } from '../../internal/awaitWithAbort';
import type { CgGridColumnDescriptor, CgGridSummaryDescriptor, CgGridGroupDescriptor } from './CgGrid.types';
import { buildLocalGroups } from './grouping';
import { calculateCustomGridSummaries, calculateGridSummaries } from './summaries';
import type { CgGridXlsxSettings } from './exportXlsx';

/** Values are snapshotted before handing a request to host code. */
export function immutableGridRequest<T>(value: T): T {
  const snapshot = structuredClone(value);
  const freeze = (item: unknown): void => {
    if (item && typeof item === 'object' && !Object.isFrozen(item)) { Object.freeze(item); Object.values(item).forEach(freeze); }
  };
  freeze(snapshot);
  return snapshot;
}

export async function gridExportSummaries<T>(items: readonly T[], columns: readonly CgGridColumnDescriptor<T>[], totals: readonly CgGridSummaryDescriptor<T>[],
  groups: readonly CgGridGroupDescriptor[], groupSummaries: readonly CgGridSummaryDescriptor<T>[], signal: AbortSignal, groupingColumns: readonly CgGridColumnDescriptor<T>[] = columns): Promise<NonNullable<CgGridXlsxSettings['summaryRows']>> {
  const result: Array<{ label: string; values: Record<string, unknown> }> = [];
  const columnMap = new Map(columns.map((column) => [column.fieldId, column]));
  const add = async (records: readonly T[], summaries: readonly CgGridSummaryDescriptor<T>[], prefix: string, groupKey?: string) => {
    signal.throwIfAborted();
    const values = calculateGridSummaries(records, summaries, columnMap);
    const custom = await awaitWithAbort(calculateCustomGridSummaries(records, summaries, groupKey ? { kind: 'group', groupKey } : { kind: 'total' }, signal), signal);
    for (const summary of summaries) {
      const value = summary.type === 'custom' ? custom[summary.id]?.available ? custom[summary.id]?.value : 'Unavailable' : values[summary.id];
      result.push({ label: `${prefix} · ${summary.label ?? summary.id}`, values: summary.fieldId ? { [summary.fieldId]: value } : columns[0] ? { [columns[0].fieldId]: value } : {} });
    }
  };
  if (groupSummaries.length) {
    const visit = async (nodes: ReturnType<typeof buildLocalGroups<T>>, prefix: string): Promise<void> => {
      for (const node of nodes) {
        const label = prefix ? `${prefix} / ${node.displayText}` : node.displayText;
        await visit(node.children, label);
        await add(node.items, groupSummaries, label, node.key);
      }
    };
    await visit(buildLocalGroups(items, groups, new Map(groupingColumns.map((column) => [column.fieldId, column])), []), '');
  }
  await add(items, totals, 'Total');
  return result;
}
