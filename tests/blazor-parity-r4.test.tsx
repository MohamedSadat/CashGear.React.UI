import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, CgGridBrowserViewStore, CgTreeList, CgTreeListBrowserViewStore, createTreeListState } from '../src';
import type { CgGridColumnDescriptor, CgTreeListActions, CgTreeListColumn, CgTreeListParentKey, CgTreeListState } from '../src';

interface Account { id: number; parent: number | null; name: string; balance: number }
const accounts: ReadonlyArray<Account> = [{ id: 1, parent: null, name: 'Assets', balance: 100 }, { id: 2, parent: 1, name: 'Cash', balance: 40 }];
const columns: ReadonlyArray<CgTreeListColumn<Account, number>> = [
  { type: 'text', fieldId: 'name', title: 'Account', hierarchy: true, getValue: (item) => item.name },
  { type: 'number', fieldId: 'balance', title: 'Balance', getValue: (item) => item.balance },
  { type: 'text', fieldId: 'code', title: 'Code', getValue: (item) => String(item.id) },
];
const parentKey = (item: Account): CgTreeListParentKey<number> => item.parent === null ? { kind: 'none' } : { kind: 'key', key: item.parent };

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}

const headerTitles = (container: HTMLElement) => [...container.querySelectorAll('[role="columnheader"]')].map((cell) => cell.textContent?.trim()).filter(Boolean);

describe('TreeList column manager', () => {
  it('hides, moves, resizes and fixes columns, and resets the layout', async () => {
    const actions = createRef<CgTreeListActions<Account, number>>();
    const { container } = render(<CgTreeList data={accounts} columns={columns} getKey={(item) => item.id} getParentKey={parentKey} showColumnManager actionsRef={actions} />);
    const manager = container.querySelector<HTMLElement>('[data-cg-tree-list-column-manager]')!;
    expect(within(manager).getByRole('checkbox', { name: 'Account' })).toBeDisabled();
    await act(async () => { fireEvent.click(within(manager).getByRole('checkbox', { name: 'Code' })); });
    expect(actions.current!.getState().columns.find((column) => column.fieldId === 'code')?.visible).toBe(false);
    await act(async () => { fireEvent.click(within(manager).getByRole('button', { name: 'Move before: Balance' })); });
    expect([...actions.current!.getState().columns].sort((a, b) => a.displayOrder - b.displayOrder)[0]?.fieldId).toBe('balance');
    await act(async () => { fireEvent.change(within(manager).getAllByRole('spinbutton')[0]!, { target: { value: '240' } }); });
    expect(actions.current!.getState().columns.find((column) => column.fieldId === 'balance')?.width).toBe(240);
    await act(async () => { fireEvent.change(within(manager).getAllByRole('combobox')[0]!, { target: { value: 'start' } }); });
    expect(actions.current!.getState().columns.find((column) => column.fieldId === 'balance')?.fixed).toBe('start');
    await act(async () => { fireEvent.click(within(manager).getByRole('button', { name: 'Reset' })); });
    expect(actions.current!.getState().columns.find((column) => column.fieldId === 'code')?.visible).toBe(true);
    expect(headerTitles(container)[0]).toContain('Account');
  });
});

describe('TreeList named views', () => {
  it('saves, applies and defaults views through the shared view manager', async () => {
    const storage = memoryStorage();
    const store = new CgTreeListBrowserViewStore<number>(storage);
    const actions = createRef<CgTreeListActions<Account, number>>();
    const view = render(<CgTreeList data={accounts} columns={columns} getKey={(item) => item.id} getParentKey={parentKey} actionsRef={actions} namedViewStore={store} namedViewKey="accounts" />);
    await act(async () => { await actions.current!.setColumnVisibility('balance', false); });
    fireEvent.click(screen.getByRole('button', { name: 'Saved views' }));
    const dialog = await screen.findByRole('dialog', { name: 'Saved views' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Without balance' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Save new view' })); });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Make default' })); });
    await waitFor(() => expect(storage.getItem('cg.treelist.views:accounts')).toContain('Without balance'));
    view.unmount();

    const restored = createRef<CgTreeListActions<Account, number>>();
    render(<CgTreeList data={accounts} columns={columns} getKey={(item) => item.id} getParentKey={parentKey} actionsRef={restored} namedViewStore={store} namedViewKey="accounts" />);
    await waitFor(() => expect(restored.current!.getState().columns.find((column) => column.fieldId === 'balance')?.visible).toBe(false));
  });

  it('round-trips the sets and maps of TreeList state', async () => {
    const store = new CgTreeListBrowserViewStore<number>(memoryStorage());
    const context = { viewKey: 'k', schemaSignature: 's' };
    const state: CgTreeListState<number> = { ...createTreeListState(columns), collapsedGroupKeys: new Set(['a']), childPages: new Map([[1, { pageIndex: 2, pageSize: 10 }]]) };
    const saved = await store.save(context, { name: 'Groups', scope: 'personal', state }, new AbortController().signal);
    const loaded = await store.load(context, saved.view.viewId, new AbortController().signal);
    const rebuilt = createTreeListState(columns, loaded!.state);
    expect([...rebuilt.collapsedGroupKeys]).toEqual(['a']);
    expect(rebuilt.childPages.get(1)).toEqual({ pageIndex: 2, pageSize: 10 });
    await expect(store.save(context, { name: 'groups', scope: 'personal', state }, new AbortController().signal)).rejects.toThrow("A TreeList view named 'groups' already exists.");
  });

  it('keeps the Grid browser store and its messages', async () => {
    const store = new CgGridBrowserViewStore(memoryStorage());
    await expect(store.save({ viewKey: 'g', schemaSignature: 's' }, { name: '', scope: 'personal', state: {} as never }, new AbortController().signal)).rejects.toThrow('Grid view name must contain 1 to 100 characters.');
    await expect(store.save({ viewKey: 'g', schemaSignature: 's' }, { name: 'x', scope: 'role', state: {} as never }, new AbortController().signal)).rejects.toThrow('CgGridBrowserViewStore supports personal views only.');
    interface Row { id: number }
    const gridColumns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [{ type: 'number', fieldId: 'id', title: 'Id', accessor: (row) => row.id }];
    const apply = vi.fn();
    render(<CgGrid data={[{ id: 1 }]} columns={gridColumns} keySelector={(row) => row.id} viewKey="grid" viewStore={store} onStateChange={apply} />);
    expect(screen.getByRole('button', { name: 'Views' })).toBeInTheDocument();
  });
});
