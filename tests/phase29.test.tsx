import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, createGridXlsx } from '../src';
import type { CgGridActions, CgGridColumnDescriptor, CgGridDataProvider, CgGridDataRequest, CgGridExportOptions, CgGridExportResult, CgGridRemoteExportContext } from '../src';
import { gridKeyToken } from '../src/components/Grid/keys';
import { createGridXlsxAsync } from '../src/components/Grid/exportXlsx';

interface Row { id: number; name: string; amount: number; region: string }
const data: Row[] = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, name: `Record ${index + 1}`, amount: index + 1, region: index % 2 ? 'B' : 'A' }));
const columns: readonly CgGridColumnDescriptor<Row>[] = [
  { type: 'text', fieldId: 'name', title: 'Name', width: 160, accessor: (row) => row.name, editor: { kind: 'text', setValue: (row, value) => ({ ...row, name: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', width: 120, accessor: (row) => row.amount },
  { type: 'text', fieldId: 'region', title: 'Region', width: 120, accessor: (row) => row.region },
  ...Array.from({ length: 20 }, (_, index): CgGridColumnDescriptor<Row> => ({ type: 'number', fieldId: `extra${index}`, width: 100, accessor: (row) => row.amount + index })),
];
const key = (row: Row) => row.id;
const xml = (result: CgGridExportResult) => new TextDecoder().decode(result.bytes);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }

describe('Phase 29 virtualization and exports', () => {
  it('preserves focus actions for rendered grouped records outside the flat page', async () => {
    const actions = createRef<CgGridActions<Row>>();
    render(<CgGrid data={data.slice(0, 30)} columns={columns.slice(0, 3)} keySelector={key} actionsRef={actions}
      defaultState={{ pageSize: 10, groups: [{ fieldId: 'region', direction: 'ascending' }] }} rowVirtualization={{}} columnVirtualization={{}} />);
    await act(async () => { expect(await actions.current!.focusCell(30, 'amount')).toBe(true); });
    expect(document.activeElement?.closest('[data-row-key]')).toHaveAttribute('data-row-key', 'number:30');
  });
  it('renders bounded windows, reveals offscreen cells and preserves their focus', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const view = render(<CgGrid data={data} columns={columns} keySelector={key} actionsRef={actions} defaultState={{ pageSize: 1000, columns: [{ fieldId: 'name', frozen: true, visible: true }, { fieldId: 'amount', frozen: true, visible: true }] }} rowVirtualization={{ rowHeight: 40 }} columnVirtualization={{}} showFilterRow={false} />);
    expect(view.container.querySelectorAll('[data-cg-grid-row]').length).toBeLessThan(20);
    expect(screen.getAllByRole('columnheader').length).toBeLessThan(columns.length);
    expect(actions.current!.getVirtualizationStatus()).toMatchObject({ rows: true, columns: true });
    await act(async () => { expect(await actions.current!.focusCell(900, 'extra18')).toBe(true); });
    expect(document.activeElement).toHaveAttribute('data-column-id', 'extra18');
    const focused = document.activeElement;
    const scroller = screen.getByRole('grid').parentElement!;
    scroller.scrollTop = 0; scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    await waitFor(() => expect(actions.current!.getVirtualizationStatus().rowStart).toBe(0));
    expect(document.activeElement).toBe(focused);
    const frozen = view.container.querySelector('th[data-column-id="amount"]') as HTMLElement;
    expect(frozen.style.getPropertyValue('--cg-grid-frozen-offset')).toBe('160px');
  });
  it('falls back for grouping, details, inline drafts and CSS column widths', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const props = { data: data.slice(0, 10), columns, keySelector: key, actionsRef: actions, rowVirtualization: {}, columnVirtualization: {}, showFilterRow: false };
    const view = render(<CgGrid {...props} defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }} />);
    expect(actions.current!.getVirtualizationStatus()).toMatchObject({ rows: false, rowFallback: 'grouped' });
    await act(async () => { await actions.current!.clearGrouping(); });
    view.rerender(<CgGrid {...props} renderDetail={() => <div>Details</div>} />);
    await act(async () => { await actions.current!.expandDetail(1); });
    expect(actions.current!.getVirtualizationStatus().rowFallback).toBe('details');
    await act(async () => { await actions.current!.collapseDetail(); });
    view.rerender(<CgGrid {...props} editing={{ mode: 'inlineRow', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: () => Promise.resolve({ succeeded: true }) }} />);
    await act(async () => { await actions.current!.beginEdit(1); });
    expect(actions.current!.getVirtualizationStatus()).toMatchObject({ rows: false, columns: false, rowFallback: 'editing' });
    await act(async () => { await actions.current!.cancelEdits(); });
    view.rerender(<CgGrid {...props} columns={[{ ...columns[0]!, width: '20rem' }, ...columns.slice(1)]} />);
    expect(actions.current!.getVirtualizationStatus()).toMatchObject({ columns: false, columnFallback: 'nonNumericWidths' });
  });
  it('exports all committed records, pages, hidden selections and summaries with hard limits', async () => {
    const actions = createRef<CgGridActions<Row>>();
    render(<CgGrid data={data} columns={columns.slice(0, 3)} keySelector={key} actionsRef={actions} rowVirtualization={{}} defaultState={{ pageSize: 10 }} totalSummaries={[{ id: 'sum', type: 'sum', fieldId: 'amount' }]} />);
    const all = await actions.current!.exportToXlsx();
    expect(all.rowCount).toBe(1000);
    expect(xml(all)).toContain('Record 1000');
    expect(xml(all)).toContain('500500');
    expect((await actions.current!.exportToXlsx({ scope: 'currentPage' })).rowCount).toBe(10);
    await act(async () => { await actions.current!.selectRowsByKey([999]); });
    await act(async () => { await actions.current!.applyState({ searchText: 'Record 1' }); });
    const selected = await actions.current!.exportToXlsx({ scope: 'selectedRecords' });
    expect(selected.rowCount).toBe(1); expect(xml(selected)).toContain('Record 999');
    await expect(actions.current!.exportToXlsx({ maxRows: 2 })).rejects.toThrow(/limit/);
    const controller = new AbortController(); controller.abort();
    await expect(actions.current!.exportToXlsx({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('exports collapsed group summaries and authorized fields without editor drafts', async () => {
    const actions = createRef<CgGridActions<Row>>();
    render(<CgGrid data={data.slice(0, 4)} columns={columns.slice(0, 3)} keySelector={key} actionsRef={actions} defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }} groupSummaries={[{ id: 'groupSum', type: 'sum', fieldId: 'amount' }]} showGroupFooters
      isExportFieldAuthorized={(column) => column.fieldId !== 'region'} editing={{ mode: 'popup', update: true, editModelFactory: (row) => ({ ...row }), updateItem: () => Promise.resolve({ succeeded: true }) }} />);
    await act(async () => { await actions.current!.applyState({ collapsedGroupKeys: ['/region=string%3AA', '/region=string%3AB'] }); });
    await act(async () => { await actions.current!.beginEdit(1); });
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Uncommitted' } });
    const result = await actions.current!.exportToXlsx();
    expect(result.rowCount).toBe(4); expect(xml(result)).toContain('Record 1'); expect(xml(result)).not.toContain('Uncommitted');
    expect(xml(result)).not.toContain('>Region<');
  });
  it('keeps remote exports separate from loading and supplies immutable adapter context', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const loading = deferred<{ rows: Row[]; totalCount: number; authorizedFilteredRowCount: number }>();
    let loadSignal!: AbortSignal;
    const provider: CgGridDataProvider<Row> = (_request, { signal }) => { loadSignal = signal; return loading.promise; };
    const pending = deferred<CgGridExportResult>();
    let context!: CgGridRemoteExportContext;
    const remote = vi.fn((_request, _options, received: CgGridRemoteExportContext) => { context = received; return pending.promise; });
    const view = render(<CgGrid columns={columns} keySelector={key} dataProvider={provider} remoteExport={remote} actionsRef={actions} defaultState={{ selectedKeys: [gridKeyToken(99)] }} />);
    const controller = new AbortController();
    const exporting = actions.current!.exportToXlsx({ scope: 'selectedRecords', maxRows: 5, signal: controller.signal });
    expect(loadSignal.aborted).toBe(false);
    expect(context).toMatchObject({ scope: 'selectedRecords', maxRows: 5, selectedKeys: [gridKeyToken(99)] });
    expect(Object.isFrozen(context.selectedKeys)).toBe(true);
    expect(Object.isFrozen(remote.mock.calls[0]![0])).toBe(true);
    controller.abort();
    await expect(exporting).rejects.toMatchObject({ name: 'AbortError' });
    expect(loadSignal.aborted).toBe(false);
    view.unmount();
    pending.resolve(createGridXlsx([], columns));
  });
  it('keeps collapsed group totals in exports and supplies group-footer context', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const contexts: string[] = [];
    render(<CgGrid data={data.slice(0, 4)} columns={columns.slice(0, 3)} keySelector={key} actionsRef={actions}
      showFilterRow={false} showGroupFooters defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }}
      groupSummaries={[{ id: 'subtotal', type: 'sum', fieldId: 'amount' }]}
      contextMenuAreas={['groupFooter']} customizeContextMenu={({ invocation, items }) => { contexts.push(invocation.context.area); return items; }} />);
    await act(async () => { fireEvent.contextMenu(screen.getByText('4', { selector: 'span' })); });
    expect(contexts).toContain('groupFooter');
    await act(async () => { await actions.current!.applyState({ collapsedGroupKeys: ['/region=string%3AA', '/region=string%3AB'] }); });
    expect(screen.queryByText('Record 1')).not.toBeInTheDocument();
    const result = await actions.current!.exportToXlsx();
    expect(xml(result)).toContain('A · subtotal'); expect(xml(result)).toContain('B · subtotal');
    expect(result.rowCount).toBe(4);
  });
  it('cancels obsolete export work on query changes and replacement exports', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const provider: CgGridDataProvider<Row> = () => Promise.resolve({ rows: [], totalCount: 0, authorizedFilteredRowCount: 0 });
    const remote = () => new Promise<CgGridExportResult>(() => undefined);
    render(<CgGrid columns={columns} keySelector={key} dataProvider={provider} remoteExport={remote} actionsRef={actions} />);
    await act(async () => { await Promise.resolve(); });
    const first = actions.current!.exportToXlsx();
    const firstRejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = actions.current!.exportToXlsx();
    const secondRejected = expect(second).rejects.toMatchObject({ name: 'AbortError' });
    await firstRejected;
    await act(async () => { await actions.current!.applyState({ searchText: 'new query' }); });
    await secondRejected;
  });
  it('rejects remote limit violations and stops local incremental export on cancellation', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const provider: CgGridDataProvider<Row> = () => Promise.resolve({ rows: [], totalCount: 0, authorizedFilteredRowCount: 0 });
    const view = render(<CgGrid columns={columns} keySelector={key} dataProvider={provider} actionsRef={actions} remoteExport={() => Promise.resolve({ ...createGridXlsx([], columns), rowCount: 12 })} />);
    await act(async () => { await Promise.resolve(); });
    await expect(actions.current!.exportToXlsx({ maxRows: 10 })).rejects.toThrow(/limit/);
    // Public compatibility fixture: the original signal-only adapter and byte result remain accepted.
    const legacy = (_request: CgGridDataRequest, _options: CgGridExportOptions, { signal }: { readonly signal: AbortSignal }): Promise<CgGridExportResult> => {
      signal.throwIfAborted();
      const { bytes, fileName, mimeType } = createGridXlsx([], columns);
      return Promise.resolve({ bytes, fileName, mimeType });
    };
    view.rerender(<CgGrid columns={columns} keySelector={key} dataProvider={provider} actionsRef={actions} remoteExport={legacy} />);
    expect((await actions.current!.exportToXlsx()).bytes.length).toBeGreaterThan(0);
    await expect(actions.current!.exportToXlsx({ maxRows: 10 })).rejects.toThrow(/report rowCount/);
    const controller = new AbortController();
    const pending = createGridXlsxAsync(data, columns, undefined, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const safe = createGridXlsx([{ ...data[0]!, name: '=HYPERLINK("bad")' }], columns);
    expect(xml(safe)).not.toContain('<f>'); expect(xml(safe)).toContain('inlineStr');
  });
});
