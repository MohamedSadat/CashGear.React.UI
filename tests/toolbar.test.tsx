import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgToolbar } from '../src';
import type { CgToolbarActions, CgToolbarItem } from '../src';
import { planToolbarLayout, toolbarRemovalOrder } from '../src/internal/toolbarLayout';
import type { ToolbarLayoutItem } from '../src/internal/toolbarLayout';

const candidates: ReadonlyArray<ToolbarLayoutItem> = [
  { name: 'pinned', visible: true, alignment: 'start', adaptivePriority: -10, overflowBehavior: 'never', allowTextCollapse: true, hasIcon: true, hasAdaptiveText: true, custom: false, declarationIndex: 0 },
  { name: 'first', visible: true, alignment: 'start', adaptivePriority: 0, overflowBehavior: 'auto', allowTextCollapse: true, hasIcon: true, hasAdaptiveText: true, custom: false, declarationIndex: 1 },
  { name: 'last', visible: true, alignment: 'end', adaptivePriority: 0, overflowBehavior: 'auto', allowTextCollapse: true, hasIcon: true, hasAdaptiveText: false, custom: false, declarationIndex: 2 },
  { name: 'always', visible: true, alignment: 'end', adaptivePriority: 10, overflowBehavior: 'always', allowTextCollapse: true, hasIcon: false, hasAdaptiveText: false, custom: false, declarationIndex: 3 },
  { name: 'hidden', visible: false, alignment: 'start', adaptivePriority: -100, overflowBehavior: 'always', allowTextCollapse: true, hasIcon: true, hasAdaptiveText: true, custom: false, declarationIndex: 4 },
];

describe('toolbar layout planner', () => {
  it('uses priority and reverse declaration order while honoring pinned, always, and minimum-visible items', () => {
    expect(toolbarRemovalOrder(candidates, 2)).toEqual(['last']);
    const full = planToolbarLayout(candidates, 0, 2);
    expect(full.start.map((item) => item.name)).toEqual(['pinned', 'first']);
    expect(full.end.map((item) => item.name)).toEqual(['last']);
    expect(full.overflow).toEqual(['always']);
    const narrow = planToolbarLayout(candidates, 3, 2);
    expect(narrow.overflow).toEqual(['last', 'always']);
    expect(narrow.start.map((item) => item.name)).toEqual(['pinned', 'first']);
  });

  it('advances full to adaptive to icon-only before one-at-a-time overflow', () => {
    expect(planToolbarLayout(candidates, 0).start[1]?.displayMode).toBe('full');
    expect(planToolbarLayout(candidates, 1).start[1]?.displayMode).toBe('adaptive');
    expect(planToolbarLayout(candidates, 2).start[1]?.displayMode).toBe('icon-only');
    expect(planToolbarLayout(candidates, 3).overflow).toEqual(['last', 'always']);
    expect(planToolbarLayout(candidates, 4).overflow).toEqual(['first', 'last', 'always']);
  });
});

describe('CgToolbar', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 10, y: 10, left: 10, top: 10, right: 130, bottom: 50, width: 120, height: 40, toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('normalizes rails and renders each command only in its planned location', async () => {
    const items: ReadonlyArray<CgToolbarItem> = [
      { name: 'new', text: 'New' },
      { name: 'save', text: 'Save', beginGroup: true },
      { name: 'help', text: 'Help', alignment: 'end', beginGroup: true },
      { name: 'hidden', text: 'Hidden', visible: false, overflowBehavior: 'always' },
      { name: 'settings', text: 'Settings', overflowBehavior: 'always' },
    ];
    render(<CgToolbar items={items} />);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More commands' }));
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getAllByText('Settings')).toHaveLength(1);
  });

  it('dispatches item, toolbar, and controlled check proposals in order', async () => {
    const order: string[] = [];
    const checked = vi.fn(async () => { order.push('checked'); });
    const items: ReadonlyArray<CgToolbarItem> = [{
      name: 'toggle', text: 'Toggle', checked: false,
      onClick: async () => { order.push('item'); },
      onCheckedChange: checked,
    }];
    render(<CgToolbar items={items} onItemClick={async () => { order.push('toolbar'); }} />);
    const toggle = screen.getByRole('button', { name: 'Toggle' });
    await userEvent.click(toggle);
    expect(order).toEqual(['item', 'toolbar', 'checked']);
    expect(checked).toHaveBeenCalledWith(true, expect.objectContaining({ proposedChecked: true }));
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('clears automatic busy state after failure and reports the error', async () => {
    const failed = vi.fn();
    render(<CgToolbar items={[{ name: 'fail', text: 'Fail', autoBusy: true, onClick: async () => { throw new Error('nope'); } }]} onItemError={failed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Fail' }));
    expect(failed).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ item: expect.objectContaining({ name: 'fail' }) }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fail' })).not.toHaveAttribute('aria-busy'));
  });

  it('uses roving logical focus and opens item menus with ArrowDown', async () => {
    const actions = createRef<CgToolbarActions>();
    render(<CgToolbar actionsRef={actions} direction="rtl" items={[
      { name: 'one', text: 'One' },
      { name: 'file', text: 'File', children: [{ name: 'open', text: 'Open' }] },
      { name: 'three', text: 'Three' },
    ]} />);
    act(() => actions.current?.focusItem('file'));
    const file = screen.getByRole('button', { name: 'File' });
    expect(file).toHaveFocus();
    fireEvent.keyDown(file, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus();
    act(() => actions.current?.focusItem('file'));
    fireEvent.keyDown(file, { key: 'ArrowDown' });
    expect(await screen.findByRole('menuitem', { name: 'Open' })).toBeInTheDocument();
    act(() => actions.current?.closeMenus());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('reconciles measured stages deterministically and disconnects observers', () => {
    const callbacks: ResizeObserverCallback[] = [];
    const disconnect = vi.fn();
    const Original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
      observe() { /* measured by the callback */ }
      unobserve() { /* no-op */ }
      disconnect() { disconnect(); }
    };
    const rendered = render(<CgToolbar minimumVisibleItemCount={1} items={[
      { name: 'one', text: 'One', icon: 'check' },
      { name: 'two', text: 'Two', icon: 'check' },
    ]} />);
    const toolbar = screen.getByRole('toolbar');
    let available = 100;
    let required = 300;
    Object.defineProperty(toolbar, 'clientWidth', { configurable: true, get: () => available });
    Object.defineProperty(toolbar, 'scrollWidth', { configurable: true, get: () => required });
    for (let count = 0; count < 3; count += 1) act(() => callbacks.at(-1)?.([], {} as ResizeObserver));
    expect(toolbar).toHaveAttribute('data-cg-toolbar-stage', '3');
    available = 400; required = 120;
    for (let count = 0; count < 3; count += 1) act(() => callbacks.at(-1)?.([], {} as ResizeObserver));
    expect(toolbar).toHaveAttribute('data-cg-toolbar-stage', '0');
    rendered.unmount();
    expect(disconnect).toHaveBeenCalled();
    globalThis.ResizeObserver = Original;
  });
});
