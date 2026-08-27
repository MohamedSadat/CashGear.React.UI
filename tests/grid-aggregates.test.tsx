import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, createGridDataRequest, createGridState, normalizeGridState, processLocalGridData, processLocalGridDataAsync } from '../src';
import type { CgGridColumnDescriptor, CgGridCustomAggregateResult, CgGridSummaryDescriptor } from '../src';

interface Row { readonly id: number; readonly region: string; readonly amount: number }
const rows: ReadonlyArray<Row> = [
  { id: 1, region: 'North', amount: 10 },
  { id: 2, region: 'South', amount: 20 },
  { id: 3, region: 'North', amount: 30 },
];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (row) => row.region },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount },
];
const options = { data: rows, columns, searchText: '', filter: null, sorts: [], groups: [{ fieldId: 'region', direction: 'ascending' as const }], pageIndex: 0, pageSize: 10 };

describe('CgGrid custom aggregates', () => {
  it('keeps synchronous built-ins and resolves custom totals/groups over complete filtered sets', async () => {
    const custom: CgGridSummaryDescriptor<Row> = { id: 'weighted', type: 'custom', aggregateKey: 'weighted-v1', inputFieldIds: ['amount'], localAggregate: async ({ items }) => ({ available: true, value: items.reduce((sum, row) => sum + row.amount * 2, 0), completeness: 'complete' }) };
    const synchronous = processLocalGridData({ ...options, summaries: [{ id: 'sum', type: 'sum', fieldId: 'amount' }, custom], groupSummaries: [custom] });
    expect(synchronous.summaries).toEqual({ sum: 60 });

    const result = await processLocalGridDataAsync({ ...options, summaries: [{ id: 'sum', type: 'sum', fieldId: 'amount' }, custom], groupSummaries: [custom] }, { signal: new AbortController().signal });
    expect(result.summaries).toEqual({ sum: 60, weighted: 120 });
    expect(result.aggregateStates.weighted).toMatchObject({ available: true, value: 120, completeness: 'complete', scope: { kind: 'total' } });
    expect(result.groups.map((group) => group.summaries.weighted)).toEqual([80, 40]);
  });

  it('reports safe errors without retaining exception text', async () => {
    const onAggregateError = vi.fn();
    const broken: CgGridSummaryDescriptor<Row> = { id: 'broken', type: 'custom', aggregateKey: 'broken-v1', inputFieldIds: ['amount'], localAggregate: async () => { throw new Error('sensitive implementation detail'); } };
    const result = await processLocalGridDataAsync({ ...options, summaries: [broken], groupSummaries: [] }, { signal: new AbortController().signal, onAggregateError });
    expect(result.aggregateStates.broken).toEqual({ available: false, loading: false, errorCode: 'custom-aggregate-failed', completeness: 'unknown', scope: { kind: 'total' } });
    expect(JSON.stringify(result)).not.toContain('sensitive implementation detail');
    expect(onAggregateError).toHaveBeenCalledWith(expect.objectContaining({ errorCode: 'custom-aggregate-failed', error: expect.any(Error) }));
  });

  it('strips local delegates and presentation metadata from provider requests and reconciles changed keys', () => {
    const localAggregate = vi.fn(async () => ({ available: true, value: 1 }));
    const descriptor: CgGridSummaryDescriptor<Row> = { id: 'risk', type: 'custom', aggregateKey: 'risk-v2', inputFieldIds: ['amount', 'region'], label: 'Risk', format: '2', localAggregate };
    const state = normalizeGridState(columns, { ...createGridState(columns), summaries: [{ id: 'risk', aggregateKey: 'risk-v1', visible: false }] }, { summaries: [descriptor] });
    expect(state.summaries).toEqual([{ id: 'risk', aggregateKey: 'risk-v2', visible: true }]);
    const request = createGridDataRequest(state, columns, [descriptor], []);
    expect(request.totalSummaries).toEqual([{ id: 'risk', type: 'custom', aggregateKey: 'risk-v2', inputFieldIds: ['amount', 'region'], visible: true, scope: 'total' }]);
    expect(JSON.stringify(request)).not.toMatch(/localAggregate|label|format|authorization|expression/u);
  });

  it('aborts obsolete local work and rejects stale aggregate results', async () => {
    const pending: Array<{ readonly signal: AbortSignal; readonly resolve: (result: CgGridCustomAggregateResult) => void }> = [];
    const descriptor: CgGridSummaryDescriptor<Row> = { id: 'late', type: 'custom', aggregateKey: 'late-v1', inputFieldIds: ['amount'], localAggregate: ({ signal }) => new Promise((resolve) => pending.push({ signal, resolve })) };
    const { container, rerender } = render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} totalSummaries={[descriptor]} />);
    await waitFor(() => expect(pending).toHaveLength(1));
    rerender(<CgGrid data={rows.slice(0, 1)} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} totalSummaries={[descriptor]} />);
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal.aborted).toBe(true);
    pending[1]?.resolve({ available: true, value: 10 }); pending[0]?.resolve({ available: true, value: 999 });
    await waitFor(() => expect(container.querySelector('tfoot')).toHaveTextContent('10'));
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
});
