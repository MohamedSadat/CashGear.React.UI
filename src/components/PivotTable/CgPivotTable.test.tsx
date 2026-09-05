import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CgPivotTable, normalizePivotLayout, processPivotData } from './index';
import type { CgPivotActions, CgPivotDataProvider, CgPivotField, CgPivotQuery, CgPivotResult } from './index';
const fields: ReadonlyArray<CgPivotField<{
    region: string;
    value: string;
}>> = [{ key: 'region', caption: 'Region', valueType: 'text', area: 'row', getValue: r => r.region }, { key: 'value', caption: 'Revenue', valueType: 'decimal', area: 'data', getValue: r => r.value }];
const data = [{ region: 'East', value: '0.1' }, { region: 'West', value: '0.2' }];
const ready = () => waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false'));
const provider = (execute: CgPivotDataProvider['execute']): CgPivotDataProvider => ({ execute, getDistinctValues: () => Promise.resolve({ values: [], totalCount: 0, hasMore: false }), getDrillDown: () => Promise.resolve({ columns: [], rows: [], totalCount: 0 }) });
describe('CgPivotTable', () => {
    it('does not overwrite a new controlled layout when an older saved layout arrives', async () => {
        let resolveLoad:(value:unknown)=>void=()=>{};
        const load=vi.fn(()=>new Promise<unknown>(resolve=>{resolveLoad=resolve;}));
        const save=vi.fn(()=>Promise.resolve());const store={load,save,delete:()=>Promise.resolve()};
        const change=vi.fn();const initial=normalizePivotLayout(fields);
        const {rerender}=render(<CgPivotTable data={data} fields={fields} layout={initial} onLayoutChange={change} layoutStore={store} layoutKey="race"/>);
        await waitFor(()=>expect(load).toHaveBeenCalledOnce());
        const current=normalizePivotLayout(fields,{...initial,rowTotalPlacement:'near'});
        rerender(<CgPivotTable data={data} fields={fields} layout={current} onLayoutChange={change} layoutStore={store} layoutKey="race"/>);
        await act(async()=>{resolveLoad(initial);await Promise.resolve();});expect(change).not.toHaveBeenCalled();
    });
    it('keeps unloaded member pages selected when unchecking a visible member', async () => {
        const records=Array.from({length:105},(_,i)=>({region:`Region ${String(i).padStart(3,'0')}`,value:'1'}));
        const actions=createRef<CgPivotActions>();render(<CgPivotTable fields={fields} data={records} actionsRef={actions}/>);await ready();fireEvent.click(screen.getByLabelText('Region Filters'));
        fireEvent.click(await screen.findByLabelText('Region 000'));fireEvent.click(screen.getByRole('button',{name:'Apply'}));await ready();
        expect(actions.current?.getResult()?.sourceRecordCount).toBe(104);
    });
    it('renders accessible cells and stable actions with exact totals', async () => {
        const actions = createRef<CgPivotActions>();
        const { rerender } = render(<CgPivotTable data={data} fields={fields} actionsRef={actions} beforeQuery={query=>{expect(Object.isFrozen(query)).toBe(true);expect(Object.isFrozen(query.fields)).toBe(true);}}/>);
        await ready();
        expect(screen.getByRole('gridcell', { name: '0.3' })).toBeInTheDocument();
        const initial = actions.current;
        rerender(<CgPivotTable data={data} fields={fields} actionsRef={actions} locale="en-GB"/>);
        await ready();
        expect(actions.current).toBe(initial);
    });
    it('emits controlled proposals without changing the authoritative layout', async () => {
        const onChange = vi.fn();
        const layout = normalizePivotLayout(fields);
        render(<CgPivotTable data={data} fields={fields} layout={layout} onLayoutChange={onChange}/>);
        await ready();
        fireEvent.change(screen.getByLabelText('Region Area'), { target: { value: 'column' } });
        expect(onChange).toHaveBeenCalledOnce();
        expect(screen.getByLabelText('Region Area')).toHaveValue('row');
    });
    it('defers field-list changes until Apply and discards Cancel', async () => {
        render(<CgPivotTable data={data} fields={fields}/>);
        await ready();
        fireEvent.click(screen.getByRole('button', { name: 'Field list' }));
        let dialog = await screen.findByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Region Area'), { target: { value: 'column' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
        expect(screen.getByLabelText('Region Area')).toHaveValue('row');
        fireEvent.click(screen.getByRole('button', { name: 'Field list' }));
        dialog = await screen.findByRole('dialog');
        fireEvent.change(within(dialog).getByLabelText('Region Area'), { target: { value: 'column' } });
        fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
        expect(screen.getByLabelText('Region Area')).toHaveValue('column');
    });
    it('uses explicit empty member selection and restores all', async () => {
        render(<CgPivotTable data={data} fields={fields}/>);
        await ready();
        fireEvent.click(screen.getByLabelText('Region Filters'));
        await screen.findByLabelText('East');
        fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await ready();
        expect(screen.getByText('No data')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Region Filters'));
        fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
        fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
        await ready();
        expect(screen.getByRole('gridcell', { name: '0.3' })).toBeInTheDocument();
    });
    it('cancels stale provider responses, retains the last result on error and retries', async () => {
        const pending: Array<{
            query: CgPivotQuery;
            signal: AbortSignal;
            resolve: (r: CgPivotResult) => void;
            reject: (e: Error) => void;
        }> = [];
        const p = provider((query, signal) => new Promise((resolve, reject) => pending.push({ query, signal, resolve, reject })));
        const actions = createRef<CgPivotActions>();
        render(<CgPivotTable fields={fields} dataProvider={p} actionsRef={actions}/>);
        await waitFor(() => expect(pending).toHaveLength(1));
        let refresh: Promise<void>;
        act(() => { refresh = actions.current!.refresh(); });
        await waitFor(() => expect(pending).toHaveLength(2));
        expect(pending[0]!.signal.aborted).toBe(true);
        await act(async () => { pending[1]!.resolve(await processPivotData(data, fields, pending[1]!.query)); await refresh!; });
        expect(screen.getByRole('gridcell', { name: '0.3' })).toBeInTheDocument();
        await act(async () => { pending[0]!.resolve(await processPivotData([], fields, pending[0]!.query)); });
        expect(screen.getByRole('gridcell', { name: '0.3' })).toBeInTheDocument();
        act(() => { refresh = actions.current!.refresh(); });
        await waitFor(() => expect(pending).toHaveLength(3));
        await act(async () => { pending[2]!.reject(new Error('offline')); await refresh!; });
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('gridcell', { name: '0.3' })).toBeInTheDocument();
    });
    it('opens drill-down with Control+Enter and provides a complete export', async () => {
        const actions = createRef<CgPivotActions>();
        const drill = vi.fn();
        render(<CgPivotTable data={data} fields={fields} actionsRef={actions} onDrillDown={drill}/>);
        await ready();
        fireEvent.keyDown(screen.getByRole('gridcell', { name: '0.1' }), { key: 'Enter', ctrlKey: true });
        expect(drill).toHaveBeenCalledOnce();
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        let file;
        await act(async () => { file = await actions.current!.exportCsv(); });
        expect(file).toMatchObject({ fileName: 'pivot.csv', rowCount: 3 });
    });
    it('aborts work when unmounted and renders an SSR-safe shell', async () => {
        let signal: AbortSignal | undefined;
        const p = provider((_q, s) => { signal = s; return new Promise(() => { }); });
        const { unmount } = render(<CgPivotTable fields={fields} dataProvider={p}/>);
        await waitFor(() => expect(signal).toBeDefined());
        unmount();
        expect(signal?.aborted).toBe(true);
        expect(renderToString(<CgPivotTable data={data} fields={fields}/>)).toContain('role="grid"');
    });
    it('reports typed limit failures and supports RTL', async () => {
        const diagnostic = vi.fn();
        render(<CgPivotTable data={data} fields={fields} maximumResultRows={1} onDiagnostics={diagnostic} locale="ar-EG"/>);
        await ready();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(diagnostic).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'limitExceeded', limit: expect.objectContaining({ limitName: 'rows' }) }));
    });
});
