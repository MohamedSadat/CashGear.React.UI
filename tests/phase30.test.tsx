import { act, render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgPivotTable, CgTreeList, createPivotQuery, normalizePivotLayout, processPivotData, getPivotDistinctValues, createPivotExport } from '../src';
import type { CgPivotActions, CgPivotField, CgPivotDataProvider, CgPivotResult, CgTreeListActions, CgTreeListColumn } from '../src';
import { createPivotExportAsync } from '../src/components/PivotTable/export';
import { validateTreeListPage } from '../src/components/TreeList/providerValidation';
import { descendantSummaries } from '../src/components/TreeList/summaries';
import { buildFlatHierarchy } from '../src/components/TreeList/hierarchy';

interface Row { id: number; group: string; detail: string; value: number; parent: number | null }
const data: Row[] = [{ id: 1, group: 'A', detail: 'one', value: 10, parent: null }, { id: 2, group: 'A', detail: 'two', value: 20, parent: 1 }, { id: 3, group: 'B', detail: 'three', value: 30, parent: 2 }];
const fields: readonly CgPivotField<Row>[] = [{ key: 'group', area: 'row', valueType: 'text', getValue: r => r.group }, { key: 'detail', area: 'row', valueType: 'text', getValue: r => r.detail }, { key: 'value', area: 'data', valueType: 'number', getValue: r => r.value }];
const layout = normalizePivotLayout(fields);
const columns: readonly CgTreeListColumn<Row, number>[] = [{ fieldId: 'detail', type: 'text', hierarchy: true, getValue: r => r.detail }, { fieldId: 'value', type: 'number', getValue: r => r.value }];
const parent = (r: Row) => r.parent === null ? { kind: 'none' as const } : { kind: 'key' as const, key: r.parent };
const key = (r: Row) => r.id;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe('Phase 30 pivot ownership and processing', () => {
  it('keeps opaque context identity without serializing or freezing host objects', () => {
    const context: { self?: unknown } = {}; context.self = context;
    const query = createPivotQuery(fields, layout, { queryContext: context, dataVersion: context });
    expect(query.queryContext).toBe(context); expect(query.dataVersion).toBe(context); expect(Object.isFrozen(context)).toBe(false);
  });
  it('evaluates each selector once per source record and enforces source/contribution budgets', async () => {
    const selector = vi.fn((r: Row) => r.value);
    const definitions = fields.map(f => f.key === 'value' ? { ...f, getValue: selector } : f);
    await processPivotData(data, definitions, createPivotQuery(definitions, layout));
    expect(selector).toHaveBeenCalledTimes(data.length);
    await expect(processPivotData(data, fields, createPivotQuery(fields, layout, { maximumSourceRows: 2 }))).rejects.toThrow(/sourceRows/);
    await expect(processPivotData(data, fields, createPivotQuery(fields, layout, { maximumAggregateOperations: 2 }))).rejects.toThrow(/aggregateOperations/);
  });
  it('keeps hidden dependent filters while paging distinct members', async () => {
    const filtered = normalizePivotLayout(fields, { ...layout, fields: layout.fields.map(f => f.key === 'group' ? { ...f, area: 'hidden', visible: false, filter: { includedValues: ['A'] } } : f) });
    const query = createPivotQuery(fields, filtered);
    expect((await processPivotData(data, fields, query)).sourceRecordCount).toBe(2);
    const page = await getPivotDistinctValues(data, fields, { fieldKey: 'detail', pivotQuery: query, searchText: '', skip: 1, take: 1 });
    expect(page.totalCount).toBe(2); expect(page.values).toHaveLength(1); expect(page.hasMore).toBe(false);
  });
  it('exports current collapsed layout separately from the all-expanded default', async () => {
    const result = await processPivotData(data, fields, createPivotQuery(fields, layout));
    const collapsed = { ...layout, expansionStateInitialized: true, expandedRowPaths: [], expandedColumnPaths: [] };
    const all = createPivotExport(result, collapsed, fields, 'csv');
    const current = await createPivotExportAsync(result, collapsed, fields, 'csv', { scope: 'currentLayout' });
    expect(current.rowCount).toBeLessThan(all.rowCount);
  });
  it('allows cancellation during export serialization', async () => {
    const rows = Array.from({ length: 400 }, (_, id) => ({ ...data[0]!, id, detail: String(id) }));
    const result = await processPivotData(rows, fields, createPivotQuery(fields, layout));
    const controller = new AbortController();
    const exporting = createPivotExportAsync(result, layout, fields, 'xlsx', { signal: controller.signal });
    controller.abort(); await expect(exporting).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('clears retained results on context changes and ignores old provider completions', async () => {
    const next = await processPivotData(data, fields, createPivotQuery(fields, layout));
    const old = deferred<CgPivotResult>(); const fresh = deferred<CgPivotResult>();
    const execute = vi.fn<CgPivotDataProvider['execute']>().mockResolvedValueOnce(next).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const provider: CgPivotDataProvider = { execute, getDistinctValues: vi.fn(), getDrillDown: vi.fn() };
    const actions = createRef<CgPivotActions>(); const a = {}; const b = {};
    const view = render(<CgPivotTable fields={fields} dataProvider={provider} queryContext={a} actionsRef={actions} />);
    await waitFor(() => expect(actions.current?.getResult()).not.toBeNull());
    let refreshing!: Promise<void>; act(() => { refreshing = actions.current!.refresh(); });
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
    view.rerender(<CgPivotTable fields={fields} dataProvider={provider} queryContext={b} actionsRef={actions} />);
    expect(actions.current?.getResult()).toBeNull();
    await act(async () => { old.resolve(next); await refreshing; });
    expect(actions.current?.getResult()).toBeNull();
    await act(async () => { fresh.resolve(next); });
    await waitFor(() => expect(actions.current?.getResult()).not.toBeNull());
    expect(execute.mock.calls.at(-1)?.[0].queryContext).toBe(b);
  });
});

describe('Phase 30 TreeList boundaries', () => {
  it('rejects duplicate, cross-parent and inconsistent pages', () => {
    const node = { item: data[0]!, key: 1, parentKey: { kind: 'none' as const }, hasChildren: false };
    expect(() => validateTreeListPage({ nodes: [node, node], totalCount: 2 }, { kind: 'none' }, 0, 10)).toThrow(/Duplicate/);
    expect(() => validateTreeListPage({ nodes: [node], totalCount: 1 }, { kind: 'key', key: 2 }, 0, 10)).toThrow(/parent/);
    expect(() => validateTreeListPage({ nodes: [], totalCount: 2, hasMore: true }, { kind: 'none' }, 0, 10)).toThrow(/page/);
  });
  it('weights descendant averages by values and excludes the parent', () => {
    const hierarchy = buildFlatHierarchy<Row, number>({ data, getKey: key, getParentKey: parent });
    const result = descendantSummaries(hierarchy, { id: 'avg', type: 'average', fieldId: 'value', scope: 'loaded-descendants' }, columns);
    expect(result.get('number:1')).toEqual({ value: 25, incomplete: false });
    expect(result.get('number:2')?.value).toBe(30);
  });
  it('rejects invalid editors before persistence and reports virtualization fallback', async () => {
    const actions = createRef<CgTreeListActions<Row, number>>(); const update = vi.fn();
    const editable: readonly CgTreeListColumn<Row, number>[] = [{ ...columns[0]!, editor: { kind: 'text', required: true, minimumLength: 20, setValue: (r: Row, value: unknown) => ({ ...r, detail: String(value) }) } }, columns[1]!];
    render(<CgTreeList<Row, number> data={data} columns={editable} getKey={key} getParentKey={parent} actionsRef={actions} allowEdit onUpdate={update} rowVirtualization />);
    await act(async () => { await actions.current!.editNode(1); });
    await act(async () => { expect(await actions.current!.saveEdit()).toBe(false); });
    expect(update).not.toHaveBeenCalled();
    expect(actions.current!.getVirtualizationStatus().reasons).toContain('inline-edit');
  });
});
