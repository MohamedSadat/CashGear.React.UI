import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgTreeView } from '../src';
import type { CgTreeViewActions, CgTreeViewNodeDescriptor } from '../src';
import { normalizeTreeView } from '../src/internal/treeViewModel';

const nested: ReadonlyArray<CgTreeViewNodeDescriptor<{ code: string }>> = [
  { key: 'root', text: 'Root', item: { code: 'R' }, children: [
    { key: 'branch', text: 'Branch', item: { code: 'B' }, children: [
      { key: 'leaf', text: 'Invoice', searchText: 'aging receivable', item: { code: 'L' } },
      { key: 'second', text: 'Second', item: { code: 'S' } },
      { key: 'disabled', text: 'Disabled', disabled: true, item: { code: 'D' } },
      { key: 'plain', text: 'Plain', allowCheck: false, item: { code: 'P' } },
    ] },
  ] },
  { key: 'other', text: 'Other', item: { code: 'O' } },
];

const item = (key: string) => document.querySelector<HTMLElement>(`[data-node-key="${key}"]`)!;

describe('TreeView model', () => {
  it('normalizes nested and flat hierarchies without mutating descriptors', () => {
    const child = { key: ' child ', text: 'Child' };
    const source = [{ key: ' root ', text: 'Root', children: [child] }];
    const model = normalizeTreeView(source);
    expect(model.allNodes.map((node) => [node.key, node.parentKey, node.depth])).toEqual([
      ['root', null, 0], ['child', 'root', 1],
    ]);
    expect(source[0]?.key).toBe(' root ');

    const flat = normalizeTreeView([
      { key: 'root', text: 'Root', parentKey: null },
      { key: 'child', text: 'Child', parentKey: 'root' },
    ]);
    expect(flat.roots[0]?.children[0]?.key).toBe('child');
  });

  it('rejects duplicate, missing, self-parent, cycle, ambiguous, and excessive-depth input', () => {
    expect(() => normalizeTreeView([{ key: 'x' }, { key: ' x ' }])).toThrow(/duplicate key/);
    expect(() => normalizeTreeView([{ key: 'x', parentKey: 'missing' }])).toThrow(/missing parent/);
    expect(() => normalizeTreeView([{ key: 'x', parentKey: 'x' }])).toThrow(/parent itself/);
    expect(() => normalizeTreeView([{ key: 'x', parentKey: 'y' }, { key: 'y', parentKey: 'x' }])).toThrow(/cycle/);
    expect(() => normalizeTreeView([{ key: 'x', children: [] }, { key: 'y', parentKey: null }])).toThrow(/cannot mix/);
    expect(() => normalizeTreeView([{ key: 'x', children: [{ key: 'y' }] }], { maxDepth: 1 })).toThrow(/exceeds/);
  });

  it('prunes hidden ancestor subtrees from available indexes while retaining the complete model', () => {
    const model = normalizeTreeView([{ key: 'hidden', visible: false, children: [{ key: 'child' }] }]);
    expect(model.allNodes.map((node) => node.key)).toEqual(['hidden', 'child']);
    expect(model.visibleNodes).toHaveLength(0);
    expect(model.byKey.get('child')?.modelVisible).toBe(false);
  });
});

describe('CgTreeView state and interaction', () => {
  it('keeps row selection separate from expansion and checking', async () => {
    const selected = vi.fn(); const expanded = vi.fn(); const checked = vi.fn();
    render(<CgTreeView nodes={nested} checkMode="multiple" onSelectedKeyChange={selected} onExpandedKeysChange={expanded} onCheckedKeysChange={checked} />);
    await userEvent.click(within(item('root')).getByRole('button', { name: /Expand/ }));
    expect(expanded).toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled();
    await userEvent.click(item('root').querySelector<HTMLElement>(':scope > div > [role=checkbox]')!);
    expect(checked).toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled();
    await userEvent.click(item('root').querySelector<HTMLElement>('[class*=row]')!);
    expect(selected).toHaveBeenCalledWith('root', expect.objectContaining({ source: 'pointer' }));
  });

  it('keeps controlled selection and expansion authoritative', async () => {
    const selected = vi.fn(); const expanded = vi.fn(); const after = vi.fn();
    render(<CgTreeView nodes={nested} selectedKey={null} expandedKeys={new Set()} onSelectedKeyChange={selected} onExpandedKeysChange={expanded} afterExpansionChange={after} />);
    await userEvent.click(within(item('root')).getByRole('button', { name: /Expand/ }));
    expect(expanded).toHaveBeenCalledWith(new Set(['root']), expect.objectContaining({ expanded: true }));
    expect(item('root')).toHaveAttribute('aria-expanded', 'false');
    expect(after).not.toHaveBeenCalled();
    await userEvent.click(item('root'));
    expect(selected).toHaveBeenCalledWith('root', expect.objectContaining({ oldKey: null }));
    expect(item('root')).toHaveAttribute('aria-selected', 'false');
  });

  it('keeps controlled checking authoritative and supports check-all and clear actions', async () => {
    const checks = vi.fn();
    const controlled = new Set<string>();
    const { rerender } = render(<CgTreeView nodes={nested} checkMode="multiple" checkedKeys={controlled} onCheckedKeysChange={checks} defaultExpandedKeys={new Set(['root', 'branch'])} />);
    await userEvent.click(item('leaf').querySelector<HTMLElement>(':scope > div > [role=checkbox]')!);
    expect(checks).toHaveBeenCalledWith(new Set(['leaf']), expect.objectContaining({ newlyCheckedKeys: new Set(['leaf']) }));
    expect(item('leaf')).toHaveAttribute('aria-checked', 'false');
    rerender(<CgTreeView nodes={nested} checkMode="multiple" checkedKeys={new Set(['leaf'])} onCheckedKeysChange={checks} defaultExpandedKeys={new Set(['root', 'branch'])} />);
    expect(item('leaf')).toHaveAttribute('aria-checked', 'true');

    const actions = createRef<CgTreeViewActions>();
    const view = render(<CgTreeView nodes={nested} actionsRef={actions} checkMode="multiple" />);
    await act(async () => { expect(await actions.current?.checkAll()).toBe(true); });
    await act(async () => { expect(await actions.current?.clearChecks()).toBe(true); });
    view.unmount();
  });

  it('cancels expansion proposals without selecting or changing controlled state', async () => {
    const selected = vi.fn(); const expanded = vi.fn(); const after = vi.fn();
    render(<CgTreeView nodes={nested} expandedKeys={new Set()} beforeExpand={() => false} onExpandedKeysChange={expanded} afterExpansionChange={after} onSelectedKeyChange={selected} />);
    await userEvent.click(within(item('root')).getByRole('button', { name: /Expand/ }));
    expect(item('root')).toHaveAttribute('aria-expanded', 'false');
    expect(expanded).not.toHaveBeenCalled(); expect(after).not.toHaveBeenCalled(); expect(selected).not.toHaveBeenCalled();
  });

  it('preserves uncontrolled state by key across reorder and emits collection corrections on removal', async () => {
    const selection = vi.fn(); const expansion = vi.fn(); const checks = vi.fn();
    const { rerender } = render(<CgTreeView nodes={nested} defaultSelectedKey="leaf" defaultExpandedKeys={new Set(['root', 'branch'])} defaultCheckedKeys={new Set(['leaf'])} checkMode="multiple" onSelectedKeyChange={selection} onExpandedKeysChange={expansion} onCheckedKeysChange={checks} />);
    rerender(<CgTreeView nodes={[nested[1]!, nested[0]!]} defaultSelectedKey="leaf" defaultExpandedKeys={new Set()} defaultCheckedKeys={new Set()} checkMode="multiple" onSelectedKeyChange={selection} onExpandedKeysChange={expansion} onCheckedKeysChange={checks} />);
    expect(item('leaf')).toHaveAttribute('aria-selected', 'true');
    rerender(<CgTreeView nodes={[nested[1]!]} checkMode="multiple" onSelectedKeyChange={selection} onExpandedKeysChange={expansion} onCheckedKeysChange={checks} />);
    await waitFor(() => expect(selection).toHaveBeenCalledWith(null, expect.objectContaining({ source: 'collection', isUserInitiated: false })));
    expect(expansion).toHaveBeenCalledWith(new Set(), expect.objectContaining({ source: 'collection' }));
    await waitFor(() => expect(checks).toHaveBeenCalledWith(new Set(), expect.objectContaining({ source: 'collection' })));
  });

  it('derives recursive checked and mixed states while skipping disabled and non-checkable descendants', async () => {
    render(<CgTreeView nodes={nested} checkMode="recursive" defaultExpandedKeys={new Set(['root', 'branch'])} />);
    await userEvent.click(item('branch').querySelector<HTMLElement>(':scope > div > [role=checkbox]')!);
    expect(item('branch')).toHaveAttribute('aria-checked', 'true');
    expect(item('leaf')).toHaveAttribute('aria-checked', 'true');
    expect(item('disabled')).not.toHaveAttribute('aria-checked');
    expect(item('plain')).not.toHaveAttribute('aria-checked');
    await userEvent.click(item('leaf').querySelector<HTMLElement>(':scope > div > [role=checkbox]')!);
    expect(item('branch')).toHaveAttribute('aria-checked', 'mixed');
    expect(item('root')).toHaveAttribute('aria-checked', 'mixed');
  });

  it('checks the complete model while filtered and restores committed expansion after clearing', async () => {
    const actions = createRef<CgTreeViewActions>();
    render(<CgTreeView nodes={nested} actionsRef={actions} checkMode="recursive" showFilterPanel defaultFilterText="aging" />);
    expect(item('leaf')).toBeInTheDocument();
    expect(item('root')).toHaveAttribute('aria-expanded', 'true');
    await act(async () => { await actions.current?.setNodeChecked('branch', true); });
    expect(item('leaf')).toHaveAttribute('aria-checked', 'true');
    await userEvent.clear(screen.getByRole('searchbox'));
    expect(item('root')).toHaveAttribute('aria-expanded', 'false');
  });

  it('matches text and searchText, retains ancestors, and highlights safely', () => {
    const { container } = render(<CgTreeView nodes={[{ key: 'root', text: 'Root', children: [{ key: 'match', text: '<script>Invoice</script>', searchText: 'aging' }] }]} showFilterPanel defaultFilterText="invoice" />);
    expect(item('root')).toBeInTheDocument(); expect(item('match')).toBeInTheDocument();
    expect(screen.getByText('Invoice', { selector: 'mark' })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('requires searchText for rich ReactNode defaults and supports a custom predicate', () => {
    const rich = [{ key: 'rich', text: <strong>Invoice</strong>, searchText: 'ledger' }];
    const { rerender } = render(<CgTreeView nodes={rich} showFilterPanel filterText="invoice" />);
    expect(document.querySelector('[data-node-key=rich]')).toBeNull();
    rerender(<CgTreeView nodes={rich} showFilterPanel filterText="ledger" />);
    expect(item('rich')).toBeInTheDocument();
    rerender(<CgTreeView nodes={rich} showFilterPanel filterText="custom" filterPredicate={(_node, query) => query === 'custom'} />);
    expect(item('rich')).toBeInTheDocument();
  });

  it('keeps rapid controlled filter drafts and defers IME commits', async () => {
    function Controlled() {
      const [value, setValue] = useState('');
      return <CgTreeView nodes={nested} showFilterPanel filterText={value} onFilterTextChange={setValue} />;
    }
    render(<Controlled />);
    const filter = screen.getByRole('searchbox');
    await userEvent.type(filter, 'aging');
    expect(filter).toHaveValue('aging');
    fireEvent.compositionStart(filter);
    fireEvent.change(filter, { target: { value: 'aging請' } });
    fireEvent.compositionEnd(filter, { data: '請' });
    expect(filter).toHaveValue('aging請');
  });

  it('supports wrapping roving focus, Home/End, physical arrows, Enter, and Space in RTL', async () => {
    render(<CgTreeView nodes={nested} direction="rtl" checkMode="multiple" defaultExpandedKeys={new Set(['root', 'branch'])} />);
    act(() => item('root').focus());
    await userEvent.keyboard('{ArrowDown}'); expect(item('branch')).toHaveFocus();
    await userEvent.keyboard('{End}'); expect(item('other')).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}'); expect(item('root')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}'); expect(item('branch')).toHaveFocus();
    await userEvent.keyboard('{Enter}'); await waitFor(() => expect(item('branch')).toHaveAttribute('aria-selected', 'true'));
    await userEvent.keyboard(' '); await waitFor(() => expect(item('branch')).toHaveAttribute('aria-checked', 'true'));
    await userEvent.keyboard('{ArrowLeft}'); expect(item('branch')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{Home}'); expect(item('root')).toHaveFocus();
  });

  it('recovers focused state after filtering removes the focused node', async () => {
    const { rerender } = render(<CgTreeView nodes={nested} defaultExpandedKeys={new Set(['root', 'branch'])} />);
    act(() => item('leaf').focus());
    rerender(<CgTreeView nodes={nested} defaultExpandedKeys={new Set(['root', 'branch'])} filterText="Other" />);
    await waitFor(() => expect(item('other')).toHaveFocus());
    expect(document.querySelectorAll('[role=treeitem][tabindex="0"]')).toHaveLength(1);
  });

  it('cancels guards, supersedes stale async work, and aborts on unmount', async () => {
    const signals: AbortSignal[] = []; let call = 0;
    const actions = createRef<CgTreeViewActions>();
    const { unmount } = render(<CgTreeView nodes={nested} actionsRef={actions} beforeSelectionChange={({ signal }) => {
      signals.push(signal); call += 1; return call === 1 || call === 3 ? new Promise<boolean>(() => undefined) : false;
    }} defaultExpandedKeys={new Set(['root'])} />);
    fireEvent.click(item('branch'));
    fireEvent.click(item('other'));
    await act(async () => Promise.resolve());
    expect(signals[0]?.aborted).toBe(true);
    expect(item('other')).toHaveAttribute('aria-selected', 'false');
    act(() => { void actions.current?.select('branch'); });
    await waitFor(() => expect(signals).toHaveLength(3));
    unmount();
    expect(signals.at(-1)?.aborted).toBe(true);
  });

  it('exposes programmatic actions and rejects unknown or unavailable keys', async () => {
    const actions = createRef<CgTreeViewActions>();
    render(<CgTreeView nodes={nested} actionsRef={actions} />);
    await expect(actions.current?.select('missing')).rejects.toThrow(/no node/);
    await expect(actions.current?.select('disabled')).rejects.toThrow(/not selectable/);
    await act(async () => { expect(await actions.current?.setNodeExpanded('root', true)).toBe(true); });
    await act(async () => { expect(await actions.current?.expandToKey('leaf')).toBe(true); });
    expect(item('leaf')).toBeInTheDocument();
    await act(async () => { await actions.current?.focus('leaf'); });
    expect(item('leaf')).toHaveFocus();
  });

  it('opens node and empty-area context menus without changing selection', async () => {
    render(<CgTreeView nodes={nested} contextMenuAreas="all" defaultExpandedKeys={new Set(['root'])} />);
    fireEvent.contextMenu(item('branch'), { clientX: 20, clientY: 30 });
    expect(await screen.findByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(item('branch')).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard('{Escape}');
    fireEvent.contextMenu(document.querySelector('[data-cg-treeview]')!, { clientX: 40, clientY: 40 });
    expect(await screen.findByText('Expand all')).toBeInTheDocument();
  });

  it('customizes context commands, reports failures, rejects stale targets, and cleans up on unmount', async () => {
    const failure = vi.fn(); const activation = vi.fn(); const selection = vi.fn();
    const { rerender, unmount } = render(<CgTreeView
      nodes={nested}
      contextMenuAreas="node"
      defaultExpandedKeys={new Set(['root'])}
      onSelectedKeyChange={selection}
      customizeContextMenu={({ items }) => [...items.filter((command) => command.key !== 'copy-key'), { key: 'broken', text: 'Broken', command: () => { throw new Error('broken command'); } }]}
      onContextMenuItemActivate={activation}
      onContextMenuCommandFailure={failure}
    />);
    fireEvent.contextMenu(item('branch'), { clientX: 20, clientY: 30 });
    await userEvent.click(await screen.findByText('Broken'));
    await waitFor(() => expect(failure).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(Error) })));
    expect(activation).toHaveBeenCalled();

    fireEvent.contextMenu(item('branch'), { clientX: 20, clientY: 30 });
    await screen.findByText('Open');
    rerender(<CgTreeView nodes={[nested[1]!]} contextMenuAreas="node" onSelectedKeyChange={selection} />);
    const staleOpen = screen.queryByText('Open');
    if (staleOpen) await userEvent.click(staleOpen);
    expect(selection).not.toHaveBeenCalled();
    unmount();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
