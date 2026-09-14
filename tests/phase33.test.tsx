import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, CgLookUpGrid, createGridXlsx } from '../src';
import type { CgGridActions, CgGridColumnDescriptor, CgGridJsonExportResult, CgGridJsonWriteResult, CgGridRemoteExportContext } from '../src';
import { createGridJson, writeGridJson } from '../src/components/Grid/exportJson';
import { downloadGridExport } from '../src/components/Grid/exportXlsx';
import { gridExportWidth } from '../src/components/Grid/exportWidths';
const data = [{ id: 1, name: 'Alpha', amount: '9007199254740993.12' }, { id: 2, name: 'Beta', amount: '2.00' }, { id: 3, name: 'Gamma', amount: '3.00' }];
type Row = typeof data[number];
const columns: readonly CgGridColumnDescriptor<Row>[] = [{ fieldId: 'name', type: 'text', title: 'Name', accessor: row => row.name, width: 120 }, { fieldId: 'amount', type: 'text', accessor: row => row.amount, exportWidth: 145 }, { fieldId: 'secret', type: 'number', accessor: row => row.id, exportEnabled: false }];
const key = (row: Row) => row.id;
const lookup = { data, columns: [{ fieldId: 'name', title: 'Name', accessor: (row: Row) => row.name }], valueSelector: key, textSelector: (row: Row) => row.name };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; }
async function choose(name: string) { fireEvent.click(screen.getByRole('combobox')); await screen.findByRole('grid', { hidden: true }); fireEvent.click(await screen.findByText(name, { selector: '[role=gridcell]' })); }
describe('Phase 33 exports and asynchronous lookup selection', () => {
  it('exports visible authorized committed fields and preserves hidden selections and decimal strings', async () => {
    const actions = createRef<CgGridActions<Row>>(); render(<CgGrid data={data} columns={columns} keySelector={key} actionsRef={actions} defaultState={{ pageSize: 1 }} />);
    const result: CgGridJsonExportResult = await actions.current!.exportToJson(); expect(JSON.parse(result.text)).toEqual(data.map(row => ({ name: row.name, amount: row.amount }))); expect(result.bytes).toEqual(new TextEncoder().encode(result.text));
    expect((await actions.current!.exportToJson({ scope: 'currentPage' })).rowCount).toBe(1);
    await act(async () => { await actions.current!.selectRowsByKey([3]); }); await act(async () => { await actions.current!.applyState({ searchText: 'Alpha' }); });
    expect(JSON.parse((await actions.current!.exportToJson({ scope: 'selectedRecords' })).text)).toEqual([{ name: 'Gamma', amount: '3.00' }]);
    await expect(actions.current!.exportToJson({ maxCells: 1 })).rejects.toThrow(/cell limit/); await expect(actions.current!.exportToXlsx({ maxCells: 1 })).rejects.toThrow(/cell limit/);
    await expect(actions.current!.exportToJson({ maxRows: -1 })).rejects.toThrow(/maxRows/);
  });
  it('uses JSON semantics and rejects unsupported and circular records with an index', async () => {
    const col: CgGridColumnDescriptor<unknown>[] = [{ fieldId: 'value', type: 'text', accessor: value => value }];
    expect(JSON.parse((await createGridJson([undefined, null, NaN, new Date('2026-01-01Z'), { omitted: undefined }], col)).text)).toEqual([{}, { value: null }, { value: null }, { value: '2026-01-01T00:00:00.000Z' }, { value: {} }]);
    const circular: { self?: unknown } = {}; circular.self = circular;
    for (const value of [circular, 1n, Symbol('x'), () => 1]) await expect(createGridJson([value], col)).rejects.toThrow(/record 1/);
  });
  it('streams UTF-8 with backpressure, keeps destination open and releases its lock after failure', async () => {
    const chunks: Uint8Array[] = []; const close = vi.fn(); const stream = new WritableStream<Uint8Array>({ write(chunk) { chunks.push(chunk); }, close });
    const result: CgGridJsonWriteResult = await writeGridJson(stream, data, columns); expect(result.fieldIds).toEqual(['name', 'amount']); expect(JSON.parse(chunks.map(chunk => new TextDecoder().decode(chunk)).join(''))).toHaveLength(3); expect(stream.locked).toBe(false); expect(close).not.toHaveBeenCalled();
    const failure = new WritableStream<Uint8Array>({ write() { throw new Error('disk full'); }, close }); await expect(writeGridJson(failure, data, columns)).rejects.toThrow('disk full'); expect(failure.locked).toBe(false);
    const pending = deferred<void>(); const controller = new AbortController(); const blocked = new WritableStream<Uint8Array>({ write: () => pending.promise }); const writing = writeGridJson(blocked, data, columns, { signal: controller.signal }); controller.abort(); await expect(writing).rejects.toMatchObject({ name: 'AbortError' }); expect(blocked.locked).toBe(false); pending.resolve();
  });
  it('invalidates late remote JSON exports without aborting loads and passes owned limits/scope', async () => {
    const actions = createRef<CgGridActions<Row>>(); const pending = deferred<CgGridJsonExportResult>(); let context!: CgGridRemoteExportContext;
    const provider = () => Promise.resolve({ rows: data, totalCount: 3, authorizedFilteredRowCount: 3 }); const remote = vi.fn((_request, _options, received: CgGridRemoteExportContext) => { context = received; return pending.promise; });
    const view = render(<CgGrid dataProvider={provider} columns={columns} keySelector={key} actionsRef={actions} remoteJsonExport={remote} />); await screen.findByText('Alpha');
    const result = actions.current!.exportToJson({ scope: 'selectedRecords', maxCells: 8 }); const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' }); expect(context).toMatchObject({ scope: 'selectedRecords', maxCells: 8, authorizedFieldIds: ['name', 'amount'] }); expect(Object.isFrozen(context.selectedKeys)).toBe(true);
    view.unmount(); await rejected; expect(context.signal.aborted).toBe(true); pending.resolve(await createGridJson(data, columns));
  });
  it('writes real XLSX widths using explicit, displayed, saved, measured and configured precedence', () => {
    const state = { fieldId: 'name', visible: true, userWidth: 200, measuredWidth: 180 }; const root = document.createElement('div'); root.innerHTML = '<table><thead><tr><th data-column-id="name"></th></tr></thead></table>'; const header = root.querySelector('th')!; vi.spyOn(header, 'getBoundingClientRect').mockReturnValue({ width: 240 } as DOMRect);
    expect(gridExportWidth({ ...columns[0]!, exportWidth: 145 }, state, root)).toBe(145); expect(gridExportWidth(columns[0]!, state, root)).toBe(240); expect(gridExportWidth(columns[0]!, state)).toBe(200); expect(gridExportWidth(columns[0]!, { ...state, userWidth: undefined })).toBe(180); expect(gridExportWidth(columns[0]!)).toBe(120);
    const xml = new TextDecoder().decode(createGridXlsx(data, columns).bytes); expect(xml).toContain('<col min="2" max="2" width="20" customWidth="1"/>'); expect(xml).not.toContain('<col min="3"');
    expect(() => createGridXlsx(data, columns, undefined, { maxCells: 5 })).toThrow(/cell limit/);
  });
  it('keeps download URLs alive until browser consumption', () => {
    vi.useFakeTimers(); const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:export'); const revoke = vi.spyOn(URL, 'revokeObjectURL'); const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadGridExport(createGridXlsx([], columns)); expect(create).toHaveBeenCalledOnce(); expect(click).toHaveBeenCalledOnce(); expect(revoke).not.toHaveBeenCalled(); vi.advanceTimersByTime(60000); expect(revoke).toHaveBeenCalledWith('blob:export'); vi.useRealTimers();
  });
  it('awaits lookup callbacks in order before reconciling delayed parent acceptance', async () => {
    const pending = deferred<void>(); const order: string[] = [];
    function Host() { const [value, setValue] = useState<number | null>(1); return <CgLookUpGrid {...lookup} value={value} onValueChange={async next => { order.push('value'); await pending.promise; setValue(next); }} onSelectedItemChange={() => order.push('item')} onItemSelect={() => order.push('select')} />; }
    render(<Host />); await choose('Beta'); await waitFor(() => expect(order).toEqual(['value'])); await act(async () => { pending.resolve(); }); await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('Beta')); expect(order).toEqual(['value', 'item', 'select']);
  });
  it('ignores an older rejected lookup selection after clear, context replacement and unmount', async () => {
    const pending = deferred<void>(); const selected = vi.fn(); const changed = vi.fn((value: number | null) => value === 2 ? pending.promise : undefined); const view = render(<CgLookUpGrid {...lookup} defaultValue={1} onValueChange={changed} onItemSelect={selected} />);
    await choose('Beta'); await waitFor(() => expect(changed).toHaveBeenCalledOnce()); fireEvent.click(screen.getByRole('button', { name: 'Clear selection' })); await act(async () => { pending.reject(new Error('obsolete')); }); expect(screen.getByRole('combobox')).toHaveValue(''); expect(selected).not.toHaveBeenCalled();
    const second = deferred<void>(); view.rerender(<CgLookUpGrid {...lookup} value={1} queryContext="A" onValueChange={() => second.promise} onItemSelect={selected} />); await choose('Beta'); view.rerender(<CgLookUpGrid {...lookup} value={3} queryContext="B" onValueChange={() => second.promise} onItemSelect={selected} />); await act(async () => { second.resolve(); }); expect(screen.getByRole('combobox')).toHaveValue('Gamma'); expect(selected).not.toHaveBeenCalled(); view.unmount();
  });
});
