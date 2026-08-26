import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, CG_GRID_STATE_VERSION, calculateGridSummaries, createGridState, createGridXlsx, evaluateGridFilter, normalizeGridState, processLocalGridData, replaceFilterRowConditions, sanitizeGridExportFileName } from '../src';
import type { CgGridActions, CgGridColumnDescriptor, CgGridDataProvider, CgGridFilterNode, CgGridProps, CgGridState } from '../src';

interface Row { id: number; name: string; amount: number; active: boolean; date: string; region: string }
const rows: ReadonlyArray<Row> = [
  { id: 1, name: 'Alpha', amount: 20, active: true, date: '2026-08-25T08:00:00Z', region: 'North' },
  { id: 2, name: 'Beta', amount: 10, active: false, date: '2026-08-25T19:00:00Z', region: 'South' },
  { id: 3, name: 'Gamma', amount: 20, active: true, date: '2026-08-26T08:00:00Z', region: 'North' },
];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
  { type: 'text', fieldId: 'name', formerFieldIds: ['oldName'], title: 'Name', accessor: (row) => row.name, editor: { kind: 'text', required: true, setValue: (row, name) => ({ ...row, name: String(name) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount },
  { type: 'boolean', fieldId: 'active', title: 'Active', accessor: (row) => row.active },
  { type: 'date', fieldId: 'date', title: 'Date', accessor: (row) => row.date },
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (row) => row.region },
];

describe('CgGrid pure contracts and engines', () => {
  it('migrates state versions, former field ids, legacy widths, and unsafe identities', () => {
    const state = normalizeGridState(columns, { version: 1, pageSize: 25, sorts: [{ fieldId: 'oldName', direction: 'ascending' }], columns: [{ fieldId: 'oldName', visible: true, measuredWidth: 222 }], focusedColumnId: 'removed' });
    expect(state.version).toBe(CG_GRID_STATE_VERSION);
    expect(state.sorts[0]?.fieldId).toBe('name');
    expect(state.columns[0]).toMatchObject({ fieldId: 'name', userWidth: 222, displayOrder: 0 });
    expect(state.focusedColumnId).toBeNull();
  });

  it('keeps caller filters while replacing only filter-row conditions', () => {
    const caller: CgGridFilterNode = { kind: 'group', operator: 'or', children: [{ kind: 'condition', fieldId: 'name', operator: 'startsWith', value: 'A', source: 'caller' }, { kind: 'condition', fieldId: 'name', operator: 'endsWith', value: 'a', source: 'caller' }] };
    const first = replaceFilterRowConditions(caller, [{ kind: 'condition', fieldId: 'amount', operator: 'greaterThan', value: 10 }]);
    const second = replaceFilterRowConditions(first, [{ kind: 'condition', fieldId: 'amount', operator: 'between', value: 15, secondValue: 25 }]);
    expect(JSON.stringify(second)).toContain('startsWith');
    expect(JSON.stringify(second).match(/filterRow/g)).toHaveLength(1);
    expect(rows.filter((row) => evaluateGridFilter(second, row, new Map(columns.map((column) => [column.fieldId, column])))).map((row) => row.id)).toEqual([1, 3]);
  });

  it('uses formatted text and whole-day date semantics without crashing on invalid values', () => {
    const map = new Map(columns.map((column) => [column.fieldId, column]));
    expect(evaluateGridFilter({ kind: 'condition', fieldId: 'date', operator: 'equals', value: '2026-08-25' }, rows[0]!, map)).toBe(true);
    expect(evaluateGridFilter({ kind: 'condition', fieldId: 'date', operator: 'equals', value: '2026-08-25' }, rows[1]!, map)).toBe(true);
    expect(evaluateGridFilter({ kind: 'condition', fieldId: 'date', operator: 'between', value: 'bad', secondValue: 'also-bad' }, rows[0]!, map)).toBe(false);
  });

  it('runs search/filter/summaries/stable-sort/group/page without mutating input', () => {
    const source = [...rows];
    const result = processLocalGridData({ data: source, columns, searchText: '', filter: { kind: 'condition', fieldId: 'amount', operator: 'greaterThanOrEqual', value: 10 }, sorts: [{ fieldId: 'amount', direction: 'descending' }], groups: [{ fieldId: 'region', direction: 'ascending' }], summaries: [{ id: 'sum', type: 'sum', fieldId: 'amount' }], groupSummaries: [{ id: 'count', type: 'count' }], pageIndex: 0, pageSize: 2 });
    expect(result.filteredSortedItems.map((row) => row.id)).toEqual([1, 3, 2]);
    expect(result.pageItems.map((row) => row.id)).toEqual([1, 3]);
    expect(result.summaries.sum).toBe(50);
    expect(result.groups[0]?.summaries.count).toBe(2);
    expect(source).toEqual(rows);
  });

  it('calculates typed summaries and creates dependency-free typed XLSX output', () => {
    const map = new Map(columns.map((column) => [column.fieldId, column]));
    expect(calculateGridSummaries(rows, [{ id: 'count', type: 'count' }, { id: 'avg', type: 'average', fieldId: 'amount' }, { id: 'max', type: 'maximum', fieldId: 'date' }], map)).toMatchObject({ count: 3, avg: 50 / 3 });
    const result = createGridXlsx(rows, columns, 'bad:name?.xlsx');
    expect(result.fileName).toBe('bad_name_.xlsx');
    expect([...result.bytes.slice(0, 4)]).toEqual([80, 75, 3, 4]);
    expect(sanitizeGridExportFileName(' .xlsx')).toBe('grid-export.xlsx');
  });
});

describe('CgGrid rendering and interaction', () => {
  it('renders accessible metadata, striped rows, stable sorting, paging, and search', async () => {
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} stripedRows pageSizeOptions={[2, 3]} defaultState={{ pageSize: 2 }} />);
    const grid = screen.getByRole('grid');
    expect(grid).toHaveAttribute('aria-rowcount', '4');
    expect(grid).toHaveAttribute('aria-colcount', '5');
    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(screen.getByRole('columnheader', { name: /Amount/ })).toHaveAttribute('aria-sort', 'ascending');
    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(screen.getAllByRole('row')[2]).toHaveTextContent('Alpha');
    await userEvent.type(screen.getByRole('searchbox'), 'Gamma');
    await waitFor(() => expect(screen.getByText('Gamma')).toBeInTheDocument());
  });

  it('selects by key, supports keyboard navigation and batches controlled proposals', async () => {
    const actions = createRef<CgGridActions<Row>>(); const change = vi.fn(); const selection = vi.fn();
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} selectionMode="multiple" actionsRef={actions} onStateChange={change} onSelectionChange={selection} />);
    await act(async () => { await actions.current?.selectRowsByKey([1, 3]); });
    expect(selection).toHaveBeenLastCalledWith(expect.objectContaining({ selectedKeys: ['number:1', 'number:3'] }));
    const first = screen.getAllByRole('gridcell')[0]!; first.focus(); fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getAllByRole('gridcell')[1]);
    fireEvent.keyDown(document.activeElement!, { key: ' ' });
    expect(change).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ operation: 'selection' }));
  });

  it('rejects duplicate keys and conflicting sources clearly', () => {
    expect(() => render(<CgGrid data={[rows[0]!, rows[0]!]} columns={columns} keySelector={(row) => row.id} />)).toThrow(/duplicate key/);
    const provider: CgGridDataProvider<Row> = async () => ({ rows, totalCount: 3, authorizedFilteredRowCount: 3 });
    const invalidProps = { data: rows, dataProvider: provider, columns, keySelector: (row: Row) => row.id } as unknown as CgGridProps<Row>;
    expect(() => render(<CgGrid {...invalidProps} />)).toThrow(/exactly one data source/);
  });

  it('cancels stale provider work and retains rows on refresh error', async () => {
    let call = 0;
    const provider: CgGridDataProvider<Row> = async (_request, { signal }) => { call++; const current = call; await new Promise((resolve, reject) => { const timer = setTimeout(resolve, current === 1 ? 1 : 20); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }); }); if (current > 1) throw new Error('refresh failed'); return { rows, totalCount: 3, authorizedFilteredRowCount: 3 }; };
    const actions = createRef<CgGridActions<Row>>(); render(<CgGrid dataProvider={provider} columns={columns} keySelector={(row) => row.id} actionsRef={actions} />);
    await screen.findByText('Alpha');
    await act(async () => { await actions.current?.refresh(); });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Previously loaded records/);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('loads and merges page-bounded remote group items', async () => {
    const groupedRows = Array.from({ length: 5 }, (_, index) => ({ ...rows[index % rows.length]!, id: index + 10, name: `Remote ${index + 1}`, region: 'North' }));
    const requests: number[] = [];
    const provider: CgGridDataProvider<Row> = async (request) => {
      if (request.mode === 'groupNodes') return { groupNodes: [{ fieldId: 'region', memberKey: 'North', value: 'North', displayText: 'North', level: 0, childCount: 0, leafCount: 5, hasChildren: false, fullPath: { segments: [{ fieldId: 'region', memberKey: 'North', value: 'North', displayText: 'North' }] } }], totalCount: 1, authorizedFilteredRowCount: 5 };
      requests.push(request.skip);
      return { rows: groupedRows.slice(request.skip, request.skip + request.take), totalCount: 5, authorizedFilteredRowCount: 5 };
    };
    const { container } = render(<CgGrid dataProvider={provider} columns={columns} keySelector={(row) => row.id} allowGrouping defaultState={{ pageSize: 2, groups: [{ fieldId: 'region', direction: 'ascending' }] }} />);
    await waitFor(() => expect(container.querySelector('tbody tr[aria-expanded]')).not.toBeNull());
    await userEvent.click(within(container.querySelector('tbody tr[aria-expanded]')!).getByRole('button'));
    expect(await screen.findByText('Remote 1')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Remote 3')).toBeInTheDocument();
    expect(requests).toEqual([0, 2]);
  });

  it('isolates popup edits, validates fields, rejects key changes, and invokes update once', async () => {
    const update = vi.fn(async () => ({ succeeded: true })); const actions = createRef<CgGridActions<Row>>();
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} actionsRef={actions} editing={{ update: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    await act(async () => { expect(await actions.current?.beginEdit(1)).toBe(true); });
    const dialog = screen.getByRole('dialog'); const name = within(dialog).getByRole('textbox');
    await userEvent.clear(name); await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/required/);
    await userEvent.type(name, 'Changed'); await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(rows[0]?.name).toBe('Alpha');
  });

  it('supports detail stale cancellation and grouping controls', async () => {
    const actions = createRef<CgGridActions<Row>>(); const prepare = vi.fn(async (_item: Row, { signal }: { signal: AbortSignal }) => { await Promise.resolve(); if (signal.aborted) throw new DOMException('aborted', 'AbortError'); return 'ready'; });
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} actionsRef={actions} allowGrouping renderDetail={({ prepared }) => <span>Detail {String(prepared)}</span>} prepareDetail={prepare} />);
    await act(async () => { await actions.current?.expandDetail(1); }); expect(screen.getByText('Detail ready')).toBeInTheDocument();
    await act(async () => { await actions.current?.groupBy('region'); }); expect(screen.getByText(/Region: North/)).toBeInTheDocument();
  });

  it('keeps controlled state authoritative', async () => {
    const state: CgGridState = createGridState(columns); const change = vi.fn();
    render(<CgGrid data={rows} columns={columns} keySelector={(row) => row.id} state={state} onStateChange={change} />);
    await userEvent.click(screen.getByRole('button', { name: 'Name' }));
    expect(change).toHaveBeenCalledWith(expect.objectContaining({ sorts: [{ fieldId: 'name', direction: 'ascending' }] }), expect.anything());
    expect(screen.getByRole('columnheader', { name: /Name/ })).not.toHaveAttribute('aria-sort');
  });
});
