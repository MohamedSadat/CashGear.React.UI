import { StrictMode, createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CgTreeList,
  CG_TREE_LIST_STATE_VERSION,
  createTreeListState,
  treeListKeyToken,
} from '../src';
import type {
  CgTreeListActions,
  CgTreeListColumn,
  CgTreeListCreateContext,
  CgTreeListDataProvider,
  CgTreeListDetailRenderContext,
  CgTreeListMoveContext,
  CgTreeListParentKey,
  CgTreeListState,
  CgTreeListSummaryProviderRequest,
  CgTreeListUpdateContext,
  CgTreeListViewContext,
} from '../src';

interface Account { id: number; parent: number | null; name: string; balance: number; disabled?: boolean; hasChildren?: boolean }
const none = { kind: 'none' } as const;
const parent = (key: number): CgTreeListParentKey<number> => ({ kind: 'key', key });
const columns: ReadonlyArray<CgTreeListColumn<Account, number>> = [
  { type: 'text', fieldId: 'name', title: 'Account', hierarchy: true, getValue: (item) => item.name, searchable: true },
  { type: 'number', fieldId: 'balance', title: 'Balance', getValue: (item) => item.balance },
];
const accounts: ReadonlyArray<Account> = [
  { id: 1, parent: null, name: 'Assets', balance: 100 },
  { id: 2, parent: 1, name: 'Cash', balance: 40 },
  { id: 3, parent: 1, name: 'Receivables', balance: 60 },
  { id: 4, parent: null, name: 'Liabilities', balance: 75 },
];

function flatProps(overrides: Record<string, unknown> = {}) {
  return {
    data: accounts,
    columns,
    getKey: (item: Account) => item.id,
    getParentKey: (item: Account): CgTreeListParentKey<number> => item.parent === null ? none : parent(item.parent),
    ...overrides,
  };
}

describe('CgTreeList hierarchy and contracts', () => {
  it('validates stable primitive keys and state version', () => {
    expect(treeListKeyToken('account-1')).toBe('string:account-1');
    expect(treeListKeyToken(-0)).toBe('number:0');
    expect(() => treeListKeyToken('')).toThrow(/empty string/i);
    expect(() => treeListKeyToken(Number.NaN)).toThrow(/non-finite/i);
    expect(createTreeListState(columns).version).toBe(CG_TREE_LIST_STATE_VERSION);
  });

  it('renders an ARIA treegrid and does not enter collapsed subtrees', () => {
    render(<CgTreeList {...flatProps()} />);
    const treegrid = screen.getByRole('treegrid');
    expect(treegrid).toHaveAttribute('aria-rowcount', '2');
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();
    const assets = screen.getByText('Assets').closest('tr')!;
    expect(assets).toHaveAttribute('aria-level', '1');
    expect(assets).toHaveAttribute('aria-posinset', '1');
    expect(assets).toHaveAttribute('aria-setsize', '2');
  });

  it('expands without selecting and retains descendant expansion state', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    render(<CgTreeList {...flatProps({ actionsRef, selectionMode: 'multiple', defaultExpandedKeys: new Set([1]) })} />);
    expect(screen.getByText('Cash')).toBeInTheDocument();
    await act(() => actionsRef.current!.collapseNode(1));
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();
    await act(() => actionsRef.current!.expandNode(1));
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Assets').closest('tr')).toHaveAttribute('aria-selected', 'false');
  });

  it('supports cancellable expansion and immutable event details', async () => {
    const beforeExpand = vi.fn((_detail: unknown) => false);
    const onExpandedKeysChange = vi.fn();
    render(<CgTreeList {...flatProps({ beforeExpand, onExpandedKeysChange })} />);
    await userEvent.click(screen.getByRole('button', { name: /expand assets/i }));
    expect(screen.queryByText('Cash')).not.toBeInTheDocument();
    expect(beforeExpand).toHaveBeenCalledOnce();
    expect(Object.isFrozen(beforeExpand.mock.calls[0]![0])).toBe(true);
    expect(onExpandedKeysChange).not.toHaveBeenCalled();
  });

  it('sorts every sibling collection without moving children from their parent', async () => {
    render(<CgTreeList {...flatProps({ defaultExpandedKeys: new Set([1]) })} />);
    await userEvent.click(screen.getByRole('button', { name: /account/i }));
    const rows = screen.getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(rows[0]).toContain('Assets');
    expect(rows[1]).toContain('Cash');
    expect(rows[2]).toContain('Receivables');
    expect(rows[3]).toContain('Liabilities');
  });

  it('keeps ancestors transiently for search and restores host expansion exactly', () => {
    const { rerender } = render(<CgTreeList {...flatProps({ expandedKeys: new Set<number>(), searchText: 'receivables' })} />);
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Receivables')).toBeInTheDocument();
    expect(screen.getByText('Receivables').closest('mark')).toBeInTheDocument();
    rerender(<CgTreeList {...flatProps({ expandedKeys: new Set<number>(), searchText: '' })} />);
    expect(screen.queryByText('Receivables')).not.toBeInTheDocument();
  });

  it('supports all filter modes and true depth in match-only mode', () => {
    render(<CgTreeList {...flatProps({ searchText: 'cash', filterMode: 'match-only' })} />);
    expect(screen.queryByText('Assets')).not.toBeInTheDocument();
    const cash = screen.getByText('Cash').closest('tr')!;
    expect(cash).toHaveAttribute('aria-level', '2');
    expect(cash).toHaveAttribute('aria-posinset', '1');
    expect(cash).toHaveAttribute('aria-setsize', '1');
  });

  it('keeps selection, focus, and recursive checks independent', async () => {
    const selected = vi.fn(); const checked = vi.fn();
    render(<CgTreeList {...flatProps({ defaultExpandedKeys: new Set([1]), selectionMode: 'multiple', checkMode: 'recursive', onSelectedKeysChange: selected, onCheckedKeysChange: checked })} />);
    await userEvent.click(screen.getByText('Assets'));
    expect(screen.getByText('Assets').closest('tr')).toHaveAttribute('aria-selected', 'true');
    const row = screen.getByText('Assets').closest('tr')!;
    await userEvent.click(within(row).getByRole('checkbox', { name: /check assets/i }));
    expect(checked).toHaveBeenCalled();
    const lastCheckedKeys = checked.mock.calls.at(-1)?.[0] as ReadonlySet<number>;
    expect(new Set(lastCheckedKeys)).toEqual(new Set([1, 2, 3]));
    expect(selected).toHaveBeenCalledOnce();
  });

  it('reports mixed for checked nodes with possible unloaded descendants', () => {
    const data = [{ id: 1, parent: null, name: 'Remote', balance: 0, hasChildren: true }];
    render(<CgTreeList {...flatProps({ data, hasChildren: (item: Account) => !!item.hasChildren, checkMode: 'recursive', defaultCheckedKeys: new Set([1]) })} />);
    expect(screen.getByRole('checkbox', { name: /check remote/i })).toHaveAttribute('aria-checked', 'mixed');
  });

  it('recovers focus to a visible ancestor after collapse', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    render(<CgTreeList {...flatProps({ actionsRef, defaultExpandedKeys: new Set([1]), defaultFocusedKey: 2, defaultFocusedColumnId: 'name' })} />);
    await act(() => actionsRef.current!.collapseNode(1));
    await waitFor(() => expect(screen.getByText('Assets').closest('[role="gridcell"]')).toHaveAttribute('tabindex', '0'));
  });

  it('implements delegated physical hierarchy arrows and roving focus', async () => {
    render(<CgTreeList {...flatProps()} />);
    const cell = screen.getByText('Assets').closest('[role="gridcell"]') as HTMLElement;
    cell.focus();
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('Cash')).toBeInTheDocument());
    fireEvent.keyDown(cell, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('Cash').closest('[role="gridcell"]')).toHaveFocus());
  });

  it('builds nested data iteratively and applies first-parent-wins', () => {
    interface Nested { id: number; name: string; children?: Nested[] }
    const shared = { id: 3, name: 'Shared' };
    const data: Nested[] = [{ id: 1, name: 'One', children: [shared] }, { id: 2, name: 'Two', children: [shared] }];
    const nestedColumns: ReadonlyArray<CgTreeListColumn<Nested, number>> = [{ type: 'text', fieldId: 'name', getValue: (item) => item.name, hierarchy: true }];
    render(<CgTreeList data={data} columns={nestedColumns} getKey={(item) => item.id} getChildren={(item) => item.children} defaultExpandedKeys={new Set([1, 2])} />);
    expect(screen.getAllByText('Shared')).toHaveLength(1);
    expect(screen.getByText('Shared').closest('tr')?.previousElementSibling?.textContent).toContain('One');
  });

  it('handles roots, sentinels, missing parents, self parents, cycles, and duplicates deterministically', () => {
    const data: Account[] = [
      { id: 1, parent: 0, name: 'Sentinel root', balance: 0 },
      { id: 2, parent: 99, name: 'Orphan', balance: 0 },
      { id: 3, parent: 3, name: 'Self', balance: 0 },
      { id: 4, parent: 5, name: 'Cycle A', balance: 0 },
      { id: 5, parent: 4, name: 'Cycle B', balance: 0 },
    ];
    render(<CgTreeList {...flatProps({ data, rootParentKeys: [0] })} />);
    expect(screen.getByText('Sentinel root')).toBeInTheDocument();
    expect(screen.getByText('Orphan')).toBeInTheDocument();
    expect(screen.getByText('Self')).toBeInTheDocument();
    expect(screen.getByText('Cycle B')).toBeInTheDocument();
    expect(() => render(<CgTreeList {...flatProps({ data: [accounts[0], accounts[0]] })} />)).toThrow(/duplicate key/i);
    expect(() => render(<CgTreeList {...flatProps({ data: [{ id: 1, parent: 99, name: 'Bad', balance: 0 }], orphanPolicy: 'throw' })} />)).toThrow(/missing parent/i);
  });

  it('processes a 10,000-level hierarchy without stack overflow and enforces the default maximum', () => {
    const deep = Array.from({ length: 10_000 }, (_, index): Account => ({ id: index + 1, parent: index === 0 ? null : index, name: `Node ${index + 1}`, balance: 0 }));
    expect(() => render(<CgTreeList {...flatProps({ data: deep })} />)).toThrow(/maximum depth 512/i);
    expect(() => render(<CgTreeList {...flatProps({ data: deep, maximumDepth: 10_000 })} />)).not.toThrow();
  });

  it('loads lazy children once, deduplicates overlapping pages, and supports removal/reload', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    const loader = vi.fn().mockResolvedValue({ children: [{ id: 2, parent: 1, name: 'Lazy child', balance: 1 }], hasMore: false });
    render(<CgTreeList {...flatProps({ data: [{ id: 1, parent: null, name: 'Lazy root', balance: 0, hasChildren: true }], hasChildren: (item: Account) => !!item.hasChildren, loadChildren: loader, actionsRef })} />);
    await act(() => actionsRef.current!.expandNode(1));
    await screen.findByText('Lazy child');
    await act(() => actionsRef.current!.collapseNode(1)); await act(() => actionsRef.current!.expandNode(1));
    expect(loader).toHaveBeenCalledOnce();
    await act(() => actionsRef.current!.removeLoadedChildren(1));
    expect(screen.queryByText('Lazy child')).not.toBeInTheDocument();
    await act(() => actionsRef.current!.reloadNode(1));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('shapes bounded provider requests and ignores stale results after replacement', async () => {
    const provider: CgTreeListDataProvider<Account, number> = vi.fn(async () => ({ nodes: [{ item: accounts[0]!, key: 1, parentKey: none, hasChildren: true }], totalCount: 1, projectionComplete: false }));
    render(<CgTreeList columns={columns} dataProvider={provider} rootPageSize={5000} maximumProviderTake={100} queryId="accounts" />);
    await screen.findByText('Assets');
    const request = vi.mocked(provider).mock.calls[0]![0];
    expect(request.mode).toBe('roots'); expect(request.take).toBe(100); expect(request.queryId).toBe('accounts'); expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(Object.isFrozen(request)).toBe(true);
  });

  it('turns an empty authoritative provider child page into a known leaf', async () => {
    const provider: CgTreeListDataProvider<Account, number> = vi.fn(async (request) => request.mode === 'roots'
      ? { nodes: [{ item: { ...accounts[0]!, name: 'Remote root' }, key: 1, parentKey: none, hasChildren: true, projectionComplete: false }], totalCount: 1, projectionComplete: false }
      : { nodes: [], totalCount: 0, hasMore: false, projectionComplete: true });
    render(<CgTreeList columns={columns} dataProvider={provider} />);
    await userEvent.click(await screen.findByRole('button', { name: /expand remote root/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /expand remote root/i })).not.toBeInTheDocument());
    expect(provider).toHaveBeenCalledTimes(2);
  });

  it('pages local roots while retaining each root subtree', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    render(<CgTreeList {...flatProps({ actionsRef, showPager: true, rootPageSize: 1, defaultExpandedKeys: new Set([1]) })} />);
    expect(screen.getByText('Assets')).toBeInTheDocument();
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.queryByText('Liabilities')).not.toBeInTheDocument();
    expect(await act(() => actionsRef.current!.goToRootPage(1))).toBe(true);
    expect(screen.getByText('Liabilities')).toBeInTheDocument();
    expect(screen.queryByText('Assets')).not.toBeInTheDocument();
    expect(await act(() => actionsRef.current!.goToRootPage(2))).toBe(false);
  });

  it('saves normalized personalization after the view store has loaded', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    const save = vi.fn(async (_context: CgTreeListViewContext, _state: CgTreeListState<number>, _signal: AbortSignal) => undefined);
    render(<CgTreeList {...flatProps({ actionsRef, viewContext: { viewId: 'accounts', roleIds: ['finance'] }, viewStore: { load: async () => null, save } })} />);
    await waitFor(() => expect(actionsRef.current).not.toBeNull());
    await act(() => actionsRef.current!.resizeColumn('name', 320));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls.at(-1)?.[1].columns.find((column) => column.fieldId === 'name')?.width).toBe(320);
  });

  it('renders authorized complete-subtree summary values from the summary provider', async () => {
    const summaryProvider = vi.fn(async (_request: CgTreeListSummaryProviderRequest<number>) => ({ values: [{ nodeKey: 1, summaryId: 'complete-balance', value: 1000, completeness: 'complete' as const }] }));
    render(<CgTreeList {...flatProps({ summaries: [{ id: 'complete-balance', type: 'sum', fieldId: 'balance', scope: 'complete-subtree', nodeKey: 1, label: 'Complete balance' }], summaryProvider })} />);
    expect(await screen.findByText('Complete balance: 1000')).toBeInTheDocument();
    expect(summaryProvider).toHaveBeenCalledOnce();
    expect(Object.isFrozen(summaryProvider.mock.calls[0]![0])).toBe(true);
  });

  it('exposes editable create drafts in a popup and honors read-only mutation gates', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    const onCreate = vi.fn(async (_request: CgTreeListCreateContext<Account, number>) => ({ outcome: 'success' as const }));
    const editableColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [{ ...columns[0]!, updateValue: (item: Account, value: unknown) => ({ ...item, name: String(value) }) }, columns[1]!];
    const { rerender } = render(<CgTreeList {...flatProps({ columns: editableColumns, actionsRef, allowAddRoot: true, onCreate })} />);
    await act(() => actionsRef.current!.addRoot({ id: 9, parent: null, name: 'Draft', balance: 0 }));
    const input = await screen.findByRole('textbox');
    await userEvent.clear(input); await userEvent.type(input, 'Authorized root');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate.mock.calls[0]![0].draft.name).toBe('Authorized root');
    rerender(<CgTreeList {...flatProps({ columns: editableColumns, actionsRef, allowAddRoot: true, onCreate, readOnly: true })} />);
    expect(await actionsRef.current!.addRoot({ id: 10, parent: null, name: 'Blocked', balance: 0 })).toBe(false);
  });

  it('rolls back only the failed optimistic edit projection', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    let settle: ((result: { outcome: 'validation-failure' }) => void) | undefined;
    const onUpdate = vi.fn((_request: CgTreeListUpdateContext<Account, number>) => new Promise<{ outcome: 'validation-failure' }>((resolve) => { settle = resolve; }));
    const editableColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [{ ...columns[0]!, updateValue: (item: Account, value: unknown) => ({ ...item, name: String(value) }) }, columns[1]!];
    render(<CgTreeList {...flatProps({ columns: editableColumns, actionsRef, allowEdit: true, optimistic: true, onUpdate, defaultExpandedKeys: new Set([1]) })} />);
    await act(() => actionsRef.current!.editNode(2));
    const input = screen.getByDisplayValue('Cash'); await userEvent.clear(input); await userEvent.type(input, 'Optimistic-cash');
    let saving!: Promise<boolean>; act(() => { saving = actionsRef.current!.saveEdit(); });
    await waitFor(() => expect(actionsRef.current!.getItem(2)?.name).toBe('Optimistic-cash'));
    await act(async () => { settle?.({ outcome: 'validation-failure' }); await saving; });
    expect(actionsRef.current!.getItem(2)?.name).toBe('Cash');
  });

  it('retries node-local detail failures without collapsing the detail row', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('DETAIL_RETRY')).mockResolvedValueOnce({ detail: 'Authorized detail' });
    render(<CgTreeList {...flatProps({ detailLoader: loader, renderDetail: ({ detail, errorCode, retry }: CgTreeListDetailRenderContext<Account, number>) => <div>{errorCode ? <button type="button" onClick={() => { void retry(); }}>{errorCode}</button> : typeof detail === 'string' ? detail : 'Loading'}</div> })} />);
    await userEvent.dblClick(screen.getByText('Assets'));
    await userEvent.click(await screen.findByRole('button', { name: 'DETAIL_RETRY' }));
    expect(await screen.findByText('Authorized detail')).toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('cancels XLSX preparation through the public export signal', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>(); const controller = new AbortController(); controller.abort();
    render(<CgTreeList {...flatProps({ actionsRef })} />);
    await expect(actionsRef.current!.exportXlsx({ signal: controller.signal })).rejects.toThrow(/aborted/i);
  });

  it('maps Ctrl+Shift structural shortcuts to validated move requests', async () => {
    const onMove = vi.fn(async (_request: CgTreeListMoveContext<Account, number>) => ({ outcome: 'success' as const }));
    render(<CgTreeList {...flatProps({ allowMove: true, onMove })} />);
    const cell = screen.getByText('Assets').closest('[role="gridcell"]') as HTMLElement;
    cell.focus(); fireEvent.keyDown(cell, { key: 'ArrowDown', ctrlKey: true, shiftKey: true });
    await waitFor(() => expect(onMove).toHaveBeenCalledOnce());
    expect(onMove.mock.calls[0]![0].proposedParentKey).toEqual(none);
    expect(onMove.mock.calls[0]![0].proposedSiblingPosition).toBe(1);
  });

  it('keeps a stable actions object, returns predictable unknown-key results, and snapshots without mutation', async () => {
    const actionsRef = createRef<CgTreeListActions<Account, number>>();
    const { rerender } = render(<CgTreeList {...flatProps({ actionsRef })} />);
    const first = actionsRef.current;
    rerender(<CgTreeList {...flatProps({ actionsRef, className: 'rerender' })} />);
    expect(actionsRef.current).toBe(first);
    expect(await actionsRef.current!.expandNode(999)).toBe(false);
    const snapshot = actionsRef.current!.getSnapshot('loaded-nodes');
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(snapshot.rows).toHaveLength(4);
    expect(accounts[0]).toEqual({ id: 1, parent: null, name: 'Assets', balance: 100 });
  });

  it('validates hierarchy columns independently from Grid', () => {
    expect(() => render(<CgTreeList {...flatProps({ columns: [{ ...columns[0], hierarchy: true }, { ...columns[1], hierarchy: true }] })} />)).toThrow(/more than one/i);
    expect(() => render(<CgTreeList {...flatProps({ columns: [{ type: 'selection', fieldId: 'select' }] })} />)).toThrow(/no eligible/i);
  });

  it('is SSR-import safe, deterministic, Strict Mode safe, and supports multiple instances', () => {
    const markup1 = renderToString(<CgTreeList {...flatProps()} />);
    const markup2 = renderToString(<CgTreeList {...flatProps()} />);
    expect(markup1).toContain('role="treegrid"');
    expect(markup1.replaceAll(/cg-r\d+/g, 'cg-id')).toBe(markup2.replaceAll(/cg-r\d+/g, 'cg-id'));
    render(<StrictMode><CgTreeList {...flatProps({ 'aria-label': 'First tree' })} /><CgTreeList {...flatProps({ 'aria-label': 'Second tree', defaultExpandedKeys: new Set([1]) })} /></StrictMode>);
    expect(screen.getByRole('treegrid', { name: 'First tree' })).toHaveAttribute('aria-rowcount', '2');
    expect(screen.getByRole('treegrid', { name: 'Second tree' })).toHaveAttribute('aria-rowcount', '4');
  });
});
