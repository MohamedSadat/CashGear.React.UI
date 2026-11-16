import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeTreeView } from '../../internal/treeViewModel';
import { CgTreeView } from './CgTreeView';
import type {
  CgTreeViewActions,
  CgTreeViewLoadChildrenDetails,
  CgTreeViewLoadLabels,
  CgTreeViewMoveDetails,
  CgTreeViewMoveLabels,
  CgTreeViewNodeDescriptor,
} from './CgTreeView.types';
import {
  resolveTreeViewDrop,
  treeViewDropLevel,
  treeViewDropPosition,
  treeViewDropSpots,
  treeViewKeyboardMove,
} from './treeViewDrop';
import { treeViewWindowRange } from './useTreeViewWindow';

const all = { before: true, inside: true, after: true } as const;
const pages: ReadonlyArray<CgTreeViewNodeDescriptor> = [
  { key: 'alpha', text: 'Alpha', children: [
    { key: 'beta', text: 'Beta', children: [{ key: 'delta', text: 'Delta' }] },
    { key: 'hidden', text: 'Hidden', visible: false },
    { key: 'epsilon', text: 'Epsilon' },
  ] },
  { key: 'gamma', text: 'Gamma' },
];
const moveLabels: CgTreeViewMoveLabels = {
  instructions: 'Drag, or Alt+Shift with an arrow key, to move',
  moved: (details) => `${details.key} moved ${details.position} ${details.targetKey}`,
};
const loadLabels: CgTreeViewLoadLabels = { loading: 'Loading pages', loadError: (error) => `Could not load: ${String((error as Error).message)}`, retry: 'Try again' };
const item = (key: string) => document.querySelector<HTMLElement>(`[data-node-key="${key}"]`)!;
const row = (key: string) => item(key).querySelector<HTMLElement>(':scope > [data-cg-tree-row]')!;

function pointer(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  return event;
}

/** Rows 32 pixels tall, from the top, in the order they are drawn; the tree 300 pixels wide. */
function layOutRows() {
  const box = (top: number, height: number, width = 300) => ({ x: 0, y: top, left: 0, top, right: width, bottom: top + height, width, height, toJSON: () => ({}) }) as DOMRect;
  const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    const rows = [...document.querySelectorAll<HTMLElement>('[data-cg-tree-row]')];
    const at = rows.indexOf(this);
    if (at >= 0) return box(at * 32, 32);
    if (this.getAttribute('role') === 'tree') return box(0, rows.length * 32);
    return box(0, 0, 0);
  });
  return () => spy.mockRestore();
}

function drag(from: string, x: number, y: number) {
  act(() => { row(from).dispatchEvent(pointer('pointerdown', 10, 10)); });
  act(() => { window.dispatchEvent(pointer('pointermove', x, y)); });
  act(() => { window.dispatchEvent(pointer('pointerup', x, y)); });
}

afterEach(() => vi.restoreAllMocks());

describe('tree drop geometry', () => {
  it('splits a row in quarters, and gives a refused place to its neighbour', () => {
    expect(treeViewDropPosition(2, 32, all)).toBe('before');
    expect(treeViewDropPosition(16, 32, all)).toBe('inside');
    expect(treeViewDropPosition(30, 32, all)).toBe('after');
    expect(treeViewDropPosition(2, 32, { before: false, inside: true, after: true })).toBe('inside');
    expect(treeViewDropPosition(12, 32, { before: true, inside: false, after: true })).toBe('before');
    expect(treeViewDropPosition(20, 32, { before: true, inside: false, after: true })).toBe('after');
    expect(treeViewDropPosition(20, 32, { before: true, inside: false, after: false })).toBeNull();
    expect(treeViewDropPosition(30, 32, { before: false, inside: true, after: false })).toBe('inside');
    expect(treeViewDropPosition(5, 0, all)).toBeNull();
  });

  it('reads the level below a branch from the inline distance, within bounds', () => {
    expect(treeViewDropLevel(5, 20, 0, 3)).toBe(0);
    expect(treeViewDropLevel(45, 20, 0, 3)).toBe(2);
    expect(treeViewDropLevel(400, 20, 0, 3)).toBe(3);
    expect(treeViewDropLevel(5, 20, 1, 3)).toBe(1);
  });

  it('puts a drop below an open row first inside it, and below a branch after the ancestor the pointer is at', () => {
    const rows = [
      { key: 'alpha', depth: 0, parentKey: null, open: true },
      { key: 'beta', depth: 1, parentKey: 'alpha', open: true },
      { key: 'delta', depth: 2, parentKey: 'beta', open: false },
      { key: 'gamma', depth: 0, parentKey: null, open: false },
    ];
    const parents: Record<string, string | null> = { alpha: null, beta: 'alpha', delta: 'beta', gamma: null };
    const parentOf = (key: string) => parents[key] ?? null;
    expect(treeViewDropSpots(rows, 0, 9, parentOf)?.after).toEqual({ targetKey: 'beta', position: 'before', level: 1, edge: 'end' });
    expect(treeViewDropSpots(rows, 2, 9, parentOf)?.after).toMatchObject({ targetKey: 'delta', position: 'after', level: 2 });
    expect(treeViewDropSpots(rows, 2, 1, parentOf)?.after).toMatchObject({ targetKey: 'beta', position: 'after', level: 1 });
    expect(treeViewDropSpots(rows, 2, 0, parentOf)?.after).toMatchObject({ targetKey: 'alpha', position: 'after', level: 0 });
    expect(treeViewDropSpots(rows, 3, 0, parentOf)?.before).toMatchObject({ targetKey: 'gamma', position: 'before', edge: 'start' });
  });

  it('resolves parent, index and neighbours, counts hidden children, and refuses cycles and no-op moves', () => {
    const model = normalizeTreeView(pages);
    expect(resolveTreeViewDrop(model, 'gamma', 'epsilon', 'before')).toEqual({
      targetKey: 'epsilon', position: 'before', parentKey: 'alpha', index: 2, previousKey: 'hidden', nextKey: 'epsilon', oldParentKey: null, oldIndex: 1,
    });
    expect(resolveTreeViewDrop(model, 'gamma', 'beta', 'inside')).toMatchObject({ parentKey: 'beta', index: 1, previousKey: 'delta', nextKey: null });
    expect(resolveTreeViewDrop(model, 'beta', 'epsilon', 'after')).toMatchObject({ parentKey: 'alpha', index: 2, previousKey: 'epsilon', nextKey: null, oldIndex: 0 });
    expect(resolveTreeViewDrop(model, 'alpha', 'delta', 'inside')).toBeNull();
    expect(resolveTreeViewDrop(model, 'alpha', 'beta', 'after')).toBeNull();
    expect(resolveTreeViewDrop(model, 'beta', 'beta', 'inside')).toBeNull();
    expect(resolveTreeViewDrop(model, 'beta', 'hidden', 'before')).toBeNull();
    expect(resolveTreeViewDrop(model, 'gamma', 'alpha', 'after')).toBeNull();
  });

  it('moves by keys among the siblings drawn', () => {
    expect(treeViewKeyboardMove(['a', 'b', 'c'], 'b', 'p', 'up')).toEqual({ targetKey: 'a', position: 'before' });
    expect(treeViewKeyboardMove(['a', 'b', 'c'], 'b', 'p', 'down')).toEqual({ targetKey: 'c', position: 'after' });
    expect(treeViewKeyboardMove(['a', 'b', 'c'], 'b', 'p', 'indent')).toEqual({ targetKey: 'a', position: 'inside' });
    expect(treeViewKeyboardMove(['a', 'b', 'c'], 'b', 'p', 'outdent')).toEqual({ targetKey: 'p', position: 'after' });
    expect(treeViewKeyboardMove(['a', 'b'], 'a', null, 'up')).toBeNull();
    expect(treeViewKeyboardMove(['a', 'b'], 'a', null, 'outdent')).toBeNull();
  });

  it('windows fixed rows with overscan', () => {
    expect(treeViewWindowRange(5000, 32, 2, 0, 320)).toEqual({ start: 0, end: 12 });
    expect(treeViewWindowRange(5000, 32, 2, 3200, 320)).toEqual({ start: 98, end: 112 });
    expect(treeViewWindowRange(5000, 32, 2, 999999, 320)).toEqual({ start: 4988, end: 5000 });
    expect(treeViewWindowRange(0, 32, 2, 0, 320)).toEqual({ start: 0, end: 0 });
  });
});

describe('CgTreeView moving', () => {
  it('requires its words when moving is on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgTreeView nodes={pages} onNodeMove={() => undefined} />)).toThrow(/moveLabels/);
    expect(() => render(<CgTreeView nodes={pages} onNodeMove={() => undefined} moveLabels={{ instructions: ' ', moved: () => '' }} />)).toThrow(/moveLabels/);
  });

  it('reports a pointer drop inside, before and after a row, and announces it', async () => {
    const restore = layOutRows();
    const onNodeMove = vi.fn<(details: CgTreeViewMoveDetails) => void>();
    render(<CgTreeView nodes={pages} defaultExpandedKeys={new Set(['alpha'])} onNodeMove={onNodeMove} moveLabels={moveLabels} aria-label="Pages" />);
    expect(item('gamma')).toHaveAccessibleDescription(moveLabels.instructions);
    expect(item('gamma')).toHaveAttribute('aria-keyshortcuts', expect.stringContaining('Alt+Shift+ArrowUp'));
    // Rows: alpha 0-32, beta 32-64, epsilon 64-96, gamma 96-128.
    drag('gamma', 100, 66);
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({
      key: 'gamma', targetKey: 'epsilon', position: 'before', parentKey: 'alpha', index: 2, previousKey: 'hidden', nextKey: 'epsilon',
      oldParentKey: null, oldIndex: 1, source: 'pointer',
    }));
    expect(onNodeMove.mock.calls[0]![0].node.key).toBe('gamma');
    expect(Object.isFrozen(onNodeMove.mock.calls[0]![0])).toBe(true);
    // Below the last row of Alpha's branch, near the inline start: after Alpha, at the top level.
    drag('beta', 5, 94);
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'beta', targetKey: 'alpha', position: 'after', parentKey: null, index: 1, previousKey: 'alpha', nextKey: 'gamma' }));
    // The same place, with the pointer over the row: after Epsilon, among Alpha's children.
    drag('gamma', 100, 94);
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'gamma', targetKey: 'epsilon', position: 'after', parentKey: 'alpha', index: 3 }));
    drag('gamma', 100, 48);
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'gamma', targetKey: 'beta', position: 'inside', parentKey: 'beta', index: 1, previousKey: 'delta', nextKey: null }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('gamma moved inside beta'));
    // The node a drop went inside opens.
    await waitFor(() => expect(item('beta')).toHaveAttribute('aria-expanded', 'true'));
    restore();
  });

  it('never drops a node inside itself or its descendants, and honours the host veto', () => {
    const restore = layOutRows();
    const onNodeMove = vi.fn();
    const canDrop = vi.fn((candidate: { targetKey: string; position: string }) => !(candidate.targetKey === 'epsilon' && candidate.position === 'inside'));
    render(<CgTreeView nodes={pages} defaultExpandedKeys={new Set(['alpha', 'beta'])} onNodeMove={onNodeMove} canDrop={canDrop} moveLabels={moveLabels} />);
    // Rows: alpha 0, beta 32, delta 64, epsilon 96, gamma 128.
    drag('alpha', 100, 80);
    expect(onNodeMove).not.toHaveBeenCalled();
    expect(canDrop).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'alpha', targetKey: 'delta' }));
    drag('gamma', 100, 112);
    expect(canDrop).toHaveBeenCalledWith(expect.objectContaining({ key: 'gamma', targetKey: 'epsilon', position: 'inside', parentKey: 'epsilon', source: 'pointer' }));
    // Inside was vetoed, so the row's halves are before and after it.
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ targetKey: 'epsilon', position: 'after' }));
    canDrop.mockReturnValue(false);
    onNodeMove.mockClear();
    drag('gamma', 100, 40);
    expect(onNodeMove).not.toHaveBeenCalled();
    restore();
  });

  it('shows a line for before and after, marks the row for inside, and clears both on Escape', () => {
    const restore = layOutRows();
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onNodeMove = vi.fn();
    const { container } = render(<CgTreeView nodes={pages} defaultExpandedKeys={new Set(['alpha'])} onNodeMove={onNodeMove} moveLabels={moveLabels} />);
    const line = container.querySelector<HTMLElement>('[data-cg-drop-indicator]')!;
    act(() => { row('gamma').dispatchEvent(pointer('pointerdown', 10, 10)); });
    act(() => { window.dispatchEvent(pointer('pointermove', 100, 66)); vi.advanceTimersByTime(20); });
    expect(line.hidden).toBe(false);
    expect(line.style.insetBlockStart).toBe('64px');
    expect(line.style.insetInlineStart).toBe('24px');
    act(() => { window.dispatchEvent(pointer('pointermove', 100, 48)); vi.advanceTimersByTime(20); });
    expect(line.hidden).toBe(true);
    expect(row('beta')).toHaveAttribute('data-cg-drop-inside');
    expect(row('gamma')).toHaveAttribute('data-cg-dragging');
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(row('beta')).not.toHaveAttribute('data-cg-drop-inside');
    expect(document.querySelector('[data-cg-drag-ghost]')).toBeNull();
    act(() => { window.dispatchEvent(pointer('pointerup', 100, 48)); });
    expect(onNodeMove).not.toHaveBeenCalled();
    restore();
  });

  it('moves by Alt+Shift and the arrows, refocuses the moved row, and leaves locked rows', async () => {
    const onNodeMove = vi.fn<(details: CgTreeViewMoveDetails) => void>();
    function Moving() {
      const [nodes, setNodes] = useState<ReadonlyArray<CgTreeViewNodeDescriptor>>([
        { key: 'one', text: 'One' }, { key: 'two', text: 'Two' }, { key: 'three', text: 'Three', allowDrag: false },
      ]);
      return <CgTreeView nodes={nodes} moveLabels={moveLabels} onNodeMove={(details) => {
        onNodeMove(details);
        setNodes((current) => {
          const moving = current.find((node) => node.key === details.key)!;
          const rest = current.filter((node) => node.key !== details.key);
          if (details.parentKey === null) return [...rest.slice(0, details.index), moving, ...rest.slice(details.index)];
          return rest.map((node) => node.key === details.parentKey ? { ...node, children: [...(node.children ?? []), moving] } : node);
        });
      }} />;
    }
    render(<Moving />);
    act(() => item('two').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}');
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'two', targetKey: 'one', position: 'before', index: 0, source: 'keyboard' }));
    expect([...document.querySelectorAll('[role=treeitem]')].map((element) => element.getAttribute('data-node-key'))).toEqual(['two', 'one', 'three']);
    await waitFor(() => expect(item('two')).toHaveFocus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}');
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'two', targetKey: 'one', position: 'after', index: 1 }));
    await waitFor(() => expect(item('two')).toHaveFocus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'two', targetKey: 'one', position: 'inside', parentKey: 'one' }));
    // The new parent opens, and the moved row keeps focus there.
    await waitFor(() => expect(item('one')).toHaveAttribute('aria-expanded', 'true'));
    await waitFor(() => expect(item('two')).toHaveFocus());
    expect(item('two')).toHaveAttribute('aria-level', '2');
    const calls = onNodeMove.mock.calls.length;
    act(() => item('three').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}');
    expect(onNodeMove).toHaveBeenCalledTimes(calls);
    expect(item('three')).not.toHaveAttribute('aria-describedby');
  });

  it('indents with ArrowLeft in right to left when arrow keys are logical', async () => {
    const onNodeMove = vi.fn();
    const onExpanded = vi.fn();
    render(<CgTreeView nodes={pages} direction="rtl" arrowKeys="logical" onExpandedKeysChange={onExpanded} onNodeMove={onNodeMove} moveLabels={moveLabels} />);
    act(() => item('alpha').focus());
    await userEvent.keyboard('{ArrowLeft}');
    expect(onExpanded).toHaveBeenLastCalledWith(new Set(['alpha']), expect.objectContaining({ expanded: true }));
    act(() => item('gamma').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    expect(onNodeMove).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'gamma', position: 'inside', targetKey: 'alpha' }));
  });
});

describe('CgTreeView rename', () => {
  it('requires a field name when rename is on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgTreeView nodes={pages} onNodeRename={() => undefined} />)).toThrow(/renameLabel/);
  });

  it('opens with F2, commits changed text on Enter, and gives focus back to the row', async () => {
    const onNodeRename = vi.fn();
    render(<CgTreeView nodes={pages} onNodeRename={onNodeRename} renameLabel="Page title" />);
    act(() => item('gamma').focus());
    await userEvent.keyboard('{F2}');
    const field = screen.getByRole('textbox', { name: 'Page title' });
    expect(field).toHaveFocus();
    expect(field).toHaveValue('Gamma');
    await userEvent.keyboard('Gamma 2026{Enter}');
    expect(onNodeRename).toHaveBeenCalledWith(expect.objectContaining({ key: 'gamma', text: 'Gamma 2026', previousText: 'Gamma', end: 'enter' }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => expect(item('gamma')).toHaveFocus());
  });

  it('reverts on Escape, reports nothing for unchanged text, and commits on blur', async () => {
    const onNodeRename = vi.fn();
    render(<><CgTreeView nodes={pages} onNodeRename={onNodeRename} renameLabel={(node) => `Title of ${typeof node.text === 'string' ? node.text : ''}`} /><button type="button">Elsewhere</button></>);
    act(() => item('gamma').focus());
    await userEvent.keyboard('{F2}');
    await userEvent.keyboard('Changed{Escape}');
    expect(onNodeRename).not.toHaveBeenCalled();
    await waitFor(() => expect(item('gamma')).toHaveFocus());
    expect(item('gamma')).toHaveTextContent('Gamma');
    await userEvent.keyboard('{F2}{Enter}');
    expect(onNodeRename).not.toHaveBeenCalled();
    await userEvent.dblClick(item('gamma').querySelector('[class*=content]')!);
    const field = screen.getByRole('textbox', { name: 'Title of Gamma' });
    await userEvent.type(field, ' blurred');
    await userEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onNodeRename).toHaveBeenCalledWith(expect.objectContaining({ text: 'Gamma blurred', end: 'blur' }));
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus();
  });

  it('starts from renameText, through the action, and not on locked rows', async () => {
    const actions = createRef<CgTreeViewActions>();
    const onNodeRename = vi.fn();
    render(<CgTreeView actionsRef={actions} nodes={[{ key: 'blank', text: 'Untitled', renameText: '' }, { key: 'fixed', text: 'Fixed', allowRename: false }]} onNodeRename={onNodeRename} renameLabel="Page title" />);
    await act(async () => { await actions.current!.startRename('blank'); });
    expect(screen.getByRole('textbox', { name: 'Page title' })).toHaveValue('');
    expect(() => actions.current!.startRename('fixed')).toThrow(/cannot be renamed/);
    await userEvent.keyboard('{Escape}');
    act(() => item('fixed').focus());
    await userEvent.keyboard('{F2}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});

describe('CgTreeView lazy children', () => {
  function Lazy({ fail = 0, delay = 20, onLoad }: { fail?: number; delay?: number; onLoad: (details: CgTreeViewLoadChildrenDetails) => void }) {
    const [children, setChildren] = useState<ReadonlyArray<CgTreeViewNodeDescriptor> | undefined>(undefined);
    const attempts = { count: 0 };
    const [state] = useState(attempts);
    return <CgTreeView
      nodes={[{ key: 'remote', text: 'Remote', hasChildren: true, ...(children ? { children } : {}) }, { key: 'local', text: 'Local' }]}
      loadLabels={loadLabels}
      loadChildren={(details) => {
        onLoad(details);
        state.count += 1;
        return new Promise<void>((resolve, reject) => {
          details.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          setTimeout(() => {
            if (details.signal.aborted) return;
            if (state.count <= fail) { reject(new Error('offline')); return; }
            setChildren([{ key: 'child', text: 'Child' }]);
            resolve();
          }, delay);
        });
      }}
    />;
  }

  it('requires its words when lazy children are on', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgTreeView nodes={pages} loadChildren={() => Promise.resolve()} />)).toThrow(/loadLabels/);
  });

  it('loads on expand with a loading row, then shows the children', async () => {
    const onLoad = vi.fn();
    render(<Lazy delay={300} onLoad={onLoad} />);
    expect(item('remote')).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(within(item('remote')).getByRole('button', { name: 'Expand Remote' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(expect.objectContaining({ key: 'remote', source: 'expand', signal: expect.any(AbortSignal) })));
    const loadingRow = await screen.findByRole('treeitem', { name: 'Loading pages' });
    expect(loadingRow).toHaveAttribute('aria-disabled', 'true');
    expect(loadingRow).toHaveAttribute('aria-level', '2');
    expect(item('remote')).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(item('child')).toBeInTheDocument());
    expect(screen.queryByRole('treeitem', { name: 'Loading pages' })).not.toBeInTheDocument();
    expect(item('remote')).not.toHaveAttribute('aria-busy');
    expect(onLoad).toHaveBeenCalledTimes(1);
  });

  it('shows a failure with a retry button, announces it, and loads again', async () => {
    const onLoad = vi.fn();
    render(<Lazy fail={1} onLoad={onLoad} />);
    act(() => item('remote').focus());
    await userEvent.keyboard('{ArrowRight}');
    const failure = await screen.findByRole('treeitem', { name: 'Could not load: offline Try again' });
    expect(failure).not.toHaveAttribute('aria-disabled');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Could not load: offline'));
    // ArrowRight on the open node reaches the failure row; Enter there retries.
    await userEvent.keyboard('{ArrowRight}');
    expect(failure).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onLoad).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'retry' }));
    await waitFor(() => expect(item('child')).toBeInTheDocument());
    await waitFor(() => expect(item('child')).toHaveFocus());
  });

  it('retries from the button', async () => {
    const onLoad = vi.fn();
    render(<Lazy fail={1} onLoad={onLoad} />);
    await userEvent.click(within(item('remote')).getByRole('button', { name: 'Expand Remote' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(item('child')).toBeInTheDocument());
  });

  it('aborts a load when the node is collapsed, and loads again on the next expand', async () => {
    const onLoad = vi.fn();
    render(<Lazy delay={400} onLoad={onLoad} />);
    const toggle = () => item('remote').querySelector<HTMLElement>(':scope > div > button')!;
    await userEvent.click(toggle());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(1));
    const first = onLoad.mock.calls[0]![0] as CgTreeViewLoadChildrenDetails;
    await userEvent.click(toggle());
    await waitFor(() => expect(first.signal.aborted).toBe(true));
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'Loading pages' })).not.toBeInTheDocument());
    await userEvent.click(toggle());
    await waitFor(() => expect(onLoad).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(item('child')).toBeInTheDocument());
  });
});

describe('CgTreeView row actions', () => {
  it('draws actions at the row end without selecting the row on their clicks', async () => {
    const onSelected = vi.fn();
    const onAdd = vi.fn();
    render(<CgTreeView nodes={pages} onSelectedKeyChange={onSelected} renderActions={(context) => <button type="button" tabIndex={-1} onClick={() => { onAdd(context.key); }}>Add inside {typeof context.text === 'string' ? context.text : ''}</button>} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add inside Gamma' }));
    expect(onAdd).toHaveBeenCalledWith('gamma');
    expect(onSelected).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Add inside Gamma' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onSelected).not.toHaveBeenCalled();
  });
});

describe('CgTreeView virtualisation', () => {
  const groups = Array.from({ length: 50 }, (_, group): CgTreeViewNodeDescriptor => ({
    key: `g${group}`,
    text: `Group ${group + 1}`,
    children: Array.from({ length: 99 }, (_, index) => ({ key: `g${group}-${index}`, text: `Page ${group + 1}.${index + 1}` })),
  }));

  function sizeViewport() {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('role') === 'tree' ? 320 : 0; } });
    return () => { Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight'); };
  }

  it('draws only the rows in view of 5,000 nodes, with their place in the hierarchy', () => {
    const restore = sizeViewport();
    render(<CgTreeView nodes={groups} virtualize rowHeight={32} overscan={2} height={320} defaultExpandedKeys={new Set(['g0'])} aria-label="Pages" />);
    const tree = screen.getByRole('tree', { name: 'Pages' });
    const items = within(tree).getAllByRole('treeitem');
    expect(items).toHaveLength(12);
    expect(items[0]).toHaveAttribute('aria-level', '1');
    expect(items[0]).toHaveAttribute('aria-posinset', '1');
    expect(items[0]).toHaveAttribute('aria-setsize', '50');
    expect(items[0]).toHaveAttribute('aria-expanded', 'true');
    expect(items[3]).toHaveAttribute('aria-level', '2');
    expect(items[3]).toHaveAttribute('aria-posinset', '3');
    expect(items[3]).toHaveAttribute('aria-setsize', '99');
    expect(items[3]!.style.insetBlockStart).toBe('96px');
    expect(tree.querySelector<HTMLElement>('[role=none]')!.style.blockSize).toBe(`${(50 + 99) * 32}px`);
    act(() => { tree.scrollTop = 3200; fireEvent.scroll(tree); });
    const scrolled = within(tree).getAllByRole('treeitem');
    // The focus stop (the first row) stays drawn above the window.
    // Rows 98 to 111: the last two pages of Group 1, then Groups 2 to 13.
    expect(scrolled.map((element) => element.getAttribute('data-node-key'))).toEqual([
      'g0', 'g0-97', 'g0-98', ...Array.from({ length: 12 }, (_, index) => `g${index + 1}`),
    ]);
    expect(item('g1')).toHaveAttribute('aria-posinset', '2');
    restore();
  });

  it('keeps keyboard focus when it moves to a row outside the window, and scrolls to it', async () => {
    const restore = sizeViewport();
    const actions = createRef<CgTreeViewActions>();
    render(<CgTreeView actionsRef={actions} nodes={groups} virtualize rowHeight={32} overscan={2} defaultExpandedKeys={new Set(['g0'])} />);
    const tree = screen.getByRole('tree');
    act(() => item('g0').focus());
    await userEvent.keyboard('{End}');
    await waitFor(() => expect(item('g49')).toHaveFocus());
    expect(item('g49')).toHaveAttribute('tabindex', '0');
    expect(tree.scrollTop).toBe((50 + 99) * 32 - 320);
    expect(within(tree).getAllByRole('treeitem').length).toBeLessThan(20);
    await userEvent.keyboard('{Home}');
    await waitFor(() => expect(item('g0')).toHaveFocus());
    expect(tree.scrollTop).toBe(0);
    await act(async () => { await actions.current!.focus('g30'); });
    await waitFor(() => expect(item('g30')).toHaveFocus());
    expect(document.querySelectorAll('[role=treeitem][tabindex="0"]')).toHaveLength(1);
    restore();
  });
});
