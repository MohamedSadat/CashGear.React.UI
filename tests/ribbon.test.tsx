import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgRibbon } from '../src';
import type { CgRibbonActions, CgRibbonGroup, CgRibbonTab } from '../src';
import { planRibbonLayout, ribbonLayoutSteps } from '../src/components/Ribbon/ribbonLayout';
import { assignKeyTips, matchKeyTip } from '../src/components/Ribbon/keyTips';
import type { RibbonLayoutGroup } from '../src/components/Ribbon/ribbonLayout';

const flyoutSize = { x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) };

describe('ribbon layout plan', () => {
  const groups: ReadonlyArray<RibbonLayoutGroup> = [
    { key: 'first', priority: 5, hasLargeItems: true, hasHideableText: true },
    { key: 'second', priority: 0, hasLargeItems: false, hasHideableText: true },
    { key: 'third', priority: 0, hasLargeItems: true, hasHideableText: false },
  ];

  it('shrinks every group one level before the next, lowest priority and later groups first', () => {
    expect(ribbonLayoutSteps(groups)).toEqual([
      { key: 'third', mode: 'compact' },
      { key: 'first', mode: 'compact' },
      { key: 'second', mode: 'icons' },
      { key: 'first', mode: 'icons' },
      { key: 'third', mode: 'collapsed' },
      { key: 'second', mode: 'collapsed' },
      { key: 'first', mode: 'collapsed' },
    ]);
  });

  it('plans each stage from the steps before it, and stays put past the last', () => {
    expect([...planRibbonLayout(groups, 0)]).toEqual([['first', 'full'], ['second', 'full'], ['third', 'full']]);
    expect([...planRibbonLayout(groups, 2)]).toEqual([['first', 'compact'], ['second', 'full'], ['third', 'compact']]);
    expect([...planRibbonLayout(groups, 5)]).toEqual([['first', 'icons'], ['second', 'icons'], ['third', 'collapsed']]);
    expect([...planRibbonLayout(groups, 99)]).toEqual([['first', 'collapsed'], ['second', 'collapsed'], ['third', 'collapsed']]);
    expect([...planRibbonLayout(groups, -1)]).toEqual([['first', 'full'], ['second', 'full'], ['third', 'full']]);
  });
});

const clipboard: CgRibbonGroup = {
  key: 'clipboard',
  text: 'Clipboard',
  items: [
    { name: 'paste', text: 'Paste', icon: 'paste', size: 'large' },
    { name: 'cut', text: 'Cut', icon: 'cut' },
    { name: 'bold', text: 'Bold', icon: 'text-bold', hideText: true },
  ],
};
const tabs: ReadonlyArray<CgRibbonTab> = [
  { key: 'home', text: 'Home', groups: [clipboard, { key: 'tools', text: 'Tools', items: [{ name: 'sum', text: 'Sum', icon: 'autosum' }] }] },
  { key: 'insert', text: 'Insert', groups: [{ key: 'charts', text: 'Charts', icon: 'chart-pie', items: [{ name: 'pie', text: 'Pie', icon: 'chart-pie', size: 'large' }] }] },
  { key: 'hidden', text: 'Hidden', visible: false, groups: [] },
  { key: 'off', text: 'Off', disabled: true, groups: [] },
];

describe('CgRibbon', () => {
  beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(flyoutSize); });
  afterEach(() => vi.restoreAllMocks());

  it('names the ribbon, shows tabs and one toolbar per named group', () => {
    render(<CgRibbon tabs={tabs} data-testid="ribbon" />);
    expect(screen.getByRole('region', { name: 'Ribbon' })).toHaveAttribute('data-testid', 'ribbon');
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Home', 'Insert', 'Off']);
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('toolbar', { name: 'Clipboard' })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Charts' })).toBeNull();
  });

  it('shows large items stacked, small items with text, and hideText items as icons with a name', () => {
    render(<CgRibbon tabs={tabs} />);
    expect(screen.getByRole('button', { name: 'Paste' }).parentElement).toHaveAttribute('data-stacked');
    const cut = screen.getByRole('button', { name: 'Cut' });
    expect(cut).toHaveTextContent('Cut');
    expect(cut.parentElement).not.toHaveAttribute('data-stacked');
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).not.toHaveTextContent('Bold');
    expect(bold).toHaveAttribute('title', 'Bold');
  });

  it('switches tabs, reports the change, and stays authoritative when controlled', async () => {
    const change = vi.fn();
    const { rerender } = render(<CgRibbon tabs={tabs} activeKey="home" onActiveKeyChange={change} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Insert' }));
    expect(change.mock.calls[0]![0]).toBe('insert');
    expect(change.mock.calls[0]![1]).toMatchObject({ previousKey: 'home', source: 'pointer', isUserInitiated: true });
    expect(screen.getByRole('toolbar', { name: 'Clipboard' })).toBeInTheDocument();
    rerender(<CgRibbon tabs={tabs} activeKey="insert" onActiveKeyChange={change} />);
    expect(screen.getByRole('toolbar', { name: 'Charts' })).toBeInTheDocument();
  });

  it('runs commands through their own callback and the ribbon-wide one, and reports failures', async () => {
    const own = vi.fn();
    const shared = vi.fn();
    const failed = vi.fn();
    const failure = new Error('nope');
    render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'g', text: 'G', items: [{ name: 'a', text: 'A', onClick: own }, { name: 'b', text: 'B', onClick: () => { throw failure; } }] }] }]} onItemClick={shared} onItemError={failed} />);
    await userEvent.click(screen.getByRole('button', { name: 'A' }));
    await waitFor(() => expect(shared).toHaveBeenCalledOnce());
    expect(own).toHaveBeenCalledOnce();
    expect(shared.mock.calls[0]![0].item.name).toBe('a');
    await userEvent.click(screen.getByRole('button', { name: 'B' }));
    await waitFor(() => expect(failed).toHaveBeenCalledOnce());
    expect(failed.mock.calls[0]![0]).toBe(failure);
  });

  it('reports an icon-only item with its text, whatever its width', async () => {
    const shared = vi.fn();
    render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'g', text: 'G', items: [{ name: 'bold', text: 'Bold', icon: 'text-bold', hideText: true }] }] }]} onItemClick={shared} />);
    await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
    await waitFor(() => expect(shared).toHaveBeenCalledOnce());
    expect(shared.mock.calls[0]![0].item.text).toBe('Bold');
  });

  it('toggles checked items through the host', async () => {
    function Host() {
      const [bold, setBold] = useState(false);
      return <CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'g', text: 'G', items: [{ name: 'bold', text: 'Bold', icon: 'text-bold', hideText: true, checked: bold, onCheckedChange: setBold }] }] }]} />;
    }
    render(<Host />);
    const bold = screen.getByRole('button', { name: 'Bold' });
    expect(bold).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(bold);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true'));
  });

  it('adds a launcher beside a group name that reports clicks, with a translatable name', async () => {
    const launcher = vi.fn();
    render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'font', text: 'Font', onLauncherClick: launcher, items: [{ name: 'a', text: 'A' }] }, { key: 'other', text: 'Other', onLauncherClick: launcher, launcherLabel: 'Other settings', items: [{ name: 'b', text: 'B' }] }] }]} labels={{ launcher: (group) => `${group} dialog` }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Font dialog' }));
    expect(launcher).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Other settings' })).toBeInTheDocument();
  });

  it('leaves out invisible and empty groups, and names a split arrow from its item', () => {
    render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [
      { key: 'gone', text: 'Gone', visible: false, items: [{ name: 'a', text: 'A' }] },
      { key: 'empty', text: 'Empty', items: [{ name: 'b', text: 'B', visible: false }] },
      { key: 'kept', text: 'Kept', items: [{ name: 'c', text: 'Paste', onClick: () => undefined, children: [{ name: 'd', text: 'Values' }] }] },
    ] }]} />);
    expect(screen.getAllByRole('toolbar').map((toolbar) => toolbar.getAttribute('aria-label'))).toEqual(['Kept']);
    expect(screen.getByRole('button', { name: 'Paste: more options' })).toBeInTheDocument();
  });

  describe('collapse', () => {
    it('hides the commands from the button, Ctrl+F1 and a double-clicked tab, and restores them', async () => {
      const changed = vi.fn();
      render(<CgRibbon tabs={tabs} onCollapsedChange={changed} />);
      const button = screen.getByRole('button', { name: 'Collapse the ribbon' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
      await userEvent.click(button);
      expect(changed).toHaveBeenLastCalledWith(true, { source: 'button' });
      expect(screen.queryByRole('toolbar')).toBeNull();
      expect(screen.getByRole('tab', { name: 'Home' })).toBeInTheDocument();
      const expand = screen.getByRole('button', { name: 'Expand the ribbon' });
      expect(expand).toHaveAttribute('aria-expanded', 'false');
      fireEvent.keyDown(expand, { key: 'F1', ctrlKey: true });
      expect(changed).toHaveBeenLastCalledWith(false, { source: 'keyboard' });
      expect(screen.getByRole('toolbar', { name: 'Clipboard' })).toBeInTheDocument();
      fireEvent.doubleClick(screen.getByRole('tab', { name: 'Home' }));
      expect(changed).toHaveBeenLastCalledWith(true, { source: 'tab' });
    });

    it('keeps focus in the ribbon when Ctrl+F1 collapses it from a command, so Ctrl+F1 can expand it again', () => {
      render(<CgRibbon tabs={tabs} />);
      const cut = screen.getByRole('button', { name: 'Cut' });
      act(() => cut.focus());
      fireEvent.keyDown(cut, { key: 'F1', ctrlKey: true });
      expect(screen.queryByRole('toolbar')).toBeNull();
      const home = screen.getByRole('tab', { name: 'Home' });
      expect(home).toHaveFocus();
      fireEvent.keyDown(home, { key: 'F1', ctrlKey: true });
      expect(screen.getByRole('toolbar', { name: 'Clipboard' })).toBeInTheDocument();
    });

    it('does not bring a peek back when the host expands and collapses again', async () => {
      const { rerender } = render(<CgRibbon tabs={tabs} collapsed />);
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await screen.findByRole('toolbar', { name: 'Clipboard' });
      rerender(<CgRibbon tabs={tabs} collapsed={false} />);
      rerender(<CgRibbon tabs={tabs} collapsed />);
      expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('closes the open tab when a launcher is used', async () => {
      const launcher = vi.fn();
      render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'g', text: 'G', onLauncherClick: launcher, items: [{ name: 'a', text: 'A' }] }] }]} defaultCollapsed />);
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await userEvent.click(await screen.findByRole('button', { name: 'G: more options' }));
      expect(launcher).toHaveBeenCalledOnce();
      await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
    });

    it('returns focus to the tab shown, after switching tabs while one is open', async () => {
      render(<CgRibbon tabs={tabs} defaultCollapsed />);
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await screen.findByRole('toolbar', { name: 'Clipboard' });
      const insert = screen.getByRole('tab', { name: 'Insert' });
      await userEvent.click(insert);
      const pie = await screen.findByRole('button', { name: 'Pie' });
      await waitFor(() => expect(pie).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
      await waitFor(() => expect(insert).toHaveFocus());
    });

    it('leaves focus where a click outside put it', async () => {
      render(<><CgRibbon tabs={tabs} defaultCollapsed /><input aria-label="Below" /></>);
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await screen.findByRole('toolbar', { name: 'Clipboard' });
      const below = screen.getByRole('textbox', { name: 'Below' });
      await userEvent.click(below);
      await waitFor(() => expect(screen.queryByRole('toolbar')).toBeNull());
      expect(below).toHaveFocus();
    });

    it('stays authoritative when controlled, and can be switched off', async () => {
      const changed = vi.fn();
      const { unmount } = render(<CgRibbon tabs={tabs} collapsed={false} onCollapsedChange={changed} />);
      await userEvent.click(screen.getByRole('button', { name: 'Collapse the ribbon' }));
      expect(changed).toHaveBeenCalledWith(true, { source: 'button' });
      expect(screen.getByRole('toolbar', { name: 'Clipboard' })).toBeInTheDocument();
      unmount();
      render(<CgRibbon tabs={tabs} collapsible={false} onCollapsedChange={changed} />);
      expect(screen.queryByRole('button', { name: 'Collapse the ribbon' })).toBeNull();
      changed.mockClear();
      fireEvent.doubleClick(screen.getByRole('tab', { name: 'Home' }));
      fireEvent.keyDown(screen.getByRole('tab', { name: 'Home' }), { key: 'F1', ctrlKey: true });
      expect(changed).not.toHaveBeenCalled();
    });

    it('opens a tab over the content when collapsed, toggles from the same tab, and swaps with another', async () => {
      render(<CgRibbon tabs={tabs} defaultCollapsed />);
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      const toolbar = (name: string) => document.querySelector(`[role="toolbar"][aria-label="${name}"]`);
      await waitFor(() => expect(toolbar('Clipboard')).not.toBeNull());
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await waitFor(() => expect(toolbar('Clipboard')).toBeNull());
      await userEvent.click(screen.getByRole('tab', { name: 'Home' }));
      await waitFor(() => expect(toolbar('Clipboard')).not.toBeNull());
      await userEvent.click(screen.getByRole('tab', { name: 'Insert' }));
      await waitFor(() => expect(toolbar('Charts')).not.toBeNull());
      expect(toolbar('Clipboard')).toBeNull();
    });

    it('moves focus into the open tab, returns it on Escape, and closes after a command', async () => {
      const run = vi.fn();
      render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ key: 'g', text: 'G', items: [{ name: 'a', text: 'A', onClick: run }] }] }]} defaultCollapsed />);
      const tab = screen.getByRole('tab', { name: 'Home' });
      act(() => tab.focus());
      fireEvent.keyDown(tab, { key: 'Enter' });
      const command = await screen.findByRole('button', { name: 'A' });
      await waitFor(() => expect(command).toHaveFocus());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('button', { name: 'A' })).toBeNull());
      await waitFor(() => expect(tab).toHaveFocus());
      await userEvent.click(tab);
      await userEvent.click(await screen.findByRole('button', { name: 'A' }));
      await waitFor(() => expect(run).toHaveBeenCalledOnce());
      await waitFor(() => expect(document.querySelector('[role="toolbar"]')).toBeNull());
    });
  });

  it('exposes focus, collapse and re-measure actions', () => {
    const actions = createRef<CgRibbonActions>();
    const changed = vi.fn();
    render(<CgRibbon tabs={tabs} actionsRef={actions} onCollapsedChange={changed} />);
    act(() => actions.current?.focus());
    expect(screen.getByRole('tab', { name: 'Home' })).toHaveFocus();
    act(() => actions.current?.focusTab('insert'));
    expect(screen.getByRole('tab', { name: 'Insert' })).toHaveFocus();
    act(() => actions.current?.toggleCollapsed());
    expect(changed).toHaveBeenLastCalledWith(true, { source: 'action' });
    act(() => actions.current?.setCollapsed(false));
    expect(changed).toHaveBeenLastCalledWith(false, { source: 'action' });
    expect(() => act(() => actions.current?.recalculateLayout())).not.toThrow();
  });

  it('shows start and end content, and takes translated labels', () => {
    render(<CgRibbon tabs={tabs} startContent={<button type="button">File</button>} endContent={<span>Saved</span>} labels={{ ribbon: 'الشريط', collapse: 'طي', expand: 'توسيع' }} />);
    expect(screen.getByRole('region', { name: 'الشريط' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'File' })).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'طي' })).toBeInTheDocument();
  });

  it('rejects groups without keys or with repeated keys', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgRibbon tabs={[{ key: 'a', text: 'A', groups: [{ key: ' ', text: 'G', items: [] }] }]} />)).toThrow(/without a key/);
    expect(() => render(<CgRibbon tabs={[{ key: 'a', text: 'A', groups: [{ key: 'g', text: 'G', items: [] }, { key: 'g', text: 'H', items: [] }] }]} />)).toThrow(/duplicate group/);
    silence.mockRestore();
  });

  describe('shrinking by group', () => {
    const groups: ReadonlyArray<CgRibbonGroup> = [
      { key: 'one', text: 'One', icon: 'paste', items: [{ name: 'a', text: 'Alpha', icon: 'paste', size: 'large' }, { name: 'b', text: 'Beta', icon: 'cut' }] },
      { key: 'two', text: 'Two', icon: 'copy', priority: 1, items: [{ name: 'c', text: 'Gamma', icon: 'copy', size: 'large' }] },
    ];
    const shrinkTabs: ReadonlyArray<CgRibbonTab> = [{ key: 'home', text: 'Home', groups }];

    /** A fake layout where each group's width follows its mode. */
    function measure(available: () => number) {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(available);
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const widths: Record<string, number> = { full: 200, compact: 150, icons: 100, collapsed: 60 };
        const width = this.hasAttribute('data-cg-ribbon-group') ? widths[this.dataset.mode ?? 'full']! : [...this.querySelectorAll<HTMLElement>('[data-cg-ribbon-group]')].reduce((sum, group) => sum + widths[group.dataset.mode ?? 'full']!, 0);
        return { ...flyoutSize, width, right: width };
      });
    }
    const mode = (key: string) => document.querySelector(`[data-cg-ribbon-group="${key}"]`)?.getAttribute('data-mode');
    const stage = () => document.querySelector('[data-cg-ribbon-stage]')?.getAttribute('data-cg-ribbon-stage');

    it('stays as declared when there is room', () => {
      measure(() => 1000);
      render(<CgRibbon tabs={shrinkTabs} />);
      expect(stage()).toBe('0');
      expect(mode('one')).toBe('full');
      expect(mode('two')).toBe('full');
    });

    it.each([
      [360, '1', 'compact', 'full'],
      [310, '2', 'compact', 'compact'],
      [260, '3', 'icons', 'compact'],
      [210, '4', 'icons', 'icons'],
      [165, '5', 'collapsed', 'icons'],
      [125, '6', 'collapsed', 'collapsed'],
      [50, '6', 'collapsed', 'collapsed'],
    ])('at %i px takes stage %s, shrinking the lower priority group first', (available, expectedStage, modeOne, modeTwo) => {
      measure(() => available);
      render(<CgRibbon tabs={shrinkTabs} />);
      expect(stage()).toBe(expectedStage);
      expect(mode('one')).toBe(modeOne);
      expect(mode('two')).toBe(modeTwo);
    });

    it('reshapes items as a group shrinks', () => {
      measure(() => 310);
      render(<CgRibbon tabs={shrinkTabs} />);
      expect(screen.getByRole('button', { name: 'Alpha' }).parentElement).not.toHaveAttribute('data-stacked');
      expect(screen.getByRole('button', { name: 'Alpha' })).toHaveTextContent('Alpha');
      vi.restoreAllMocks();
    });

    it('drops text at the icon stage, keeping names and tooltips', () => {
      measure(() => 210);
      render(<CgRibbon tabs={shrinkTabs} />);
      const alpha = screen.getByRole('button', { name: 'Alpha' });
      expect(alpha).not.toHaveTextContent('Alpha');
      expect(alpha).toHaveAttribute('title', 'Alpha');
    });

    it('collapses a group into a button whose flyout holds it as declared, and closes after a command', async () => {
      const run = vi.fn();
      measure(() => 125);
      render(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [{ ...groups[0]!, items: [{ name: 'a', text: 'Alpha', icon: 'paste', size: 'large', onClick: run }] }, groups[1]!] }]} />);
      expect(screen.queryByRole('button', { name: 'Alpha' })).toBeNull();
      const one = screen.getByRole('button', { name: 'One' });
      expect(one).toHaveAttribute('aria-haspopup', 'dialog');
      await userEvent.click(one);
      // This fake layout gives the flyout no size, so it stays hidden and has no accessible names.
      const flyoutButton = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="One"] [data-cg-toolbar-name="a"]');
      await waitFor(() => expect(flyoutButton()).not.toBeNull());
      expect(flyoutButton()!.parentElement).toHaveAttribute('data-stacked');
      fireEvent.click(flyoutButton()!);
      await waitFor(() => expect(run).toHaveBeenCalledOnce());
      await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    });

    it('keeps measured widths through a toggled state, and restores the layout as room returns', () => {
      let available = 150;
      measure(() => available);
      const callbacks: ResizeObserverCallback[] = [];
      const Original = globalThis.ResizeObserver;
      globalThis.ResizeObserver = class {
        constructor(callback: ResizeObserverCallback) { callbacks.push(callback); }
        observe() { /* measured by the callback */ }
        unobserve() { /* no-op */ }
        disconnect() { /* no-op */ }
      };
      const items = (checked: boolean): ReadonlyArray<CgRibbonTab> => [{ key: 'home', text: 'Home', groups: [groups[0]!, { ...groups[1]!, items: [{ name: 'c', text: 'Gamma', icon: 'copy', size: 'large', checked, onClick: () => undefined }] }] }];
      const { rerender } = render(<CgRibbon tabs={items(false)} />);
      const narrow = stage();
      expect(Number(narrow)).toBeGreaterThan(0);
      rerender(<CgRibbon tabs={items(true)} />);
      expect(stage()).toBe(narrow);
      available = 1000;
      act(() => { for (const callback of callbacks) callback([], {} as ResizeObserver); });
      expect(stage()).toBe('0');
      globalThis.ResizeObserver = Original;
    });

    it('measures again from the start when commands change', () => {
      let available = 150;
      measure(() => available);
      const { rerender } = render(<CgRibbon tabs={shrinkTabs} />);
      expect(Number(stage())).toBeGreaterThan(0);
      available = 1000;
      rerender(<CgRibbon tabs={[{ key: 'home', text: 'Home', groups: [groups[0]!] }]} />);
      expect(stage()).toBe('0');
    });
  });
});

describe('key tips', () => {
  it('keeps the tips asked for and makes the rest from the text, none starting another', () => {
    const tips = assignKeyTips([
      { id: 'home', text: 'Home', keyTip: 'H' },
      { id: 'help', text: 'Help' },
      { id: 'insert', text: 'Insert' },
      { id: 'ink', text: 'Ink' },
      { id: 'group', text: 'Font', prefix: 'Z' },
    ], ['Z']);
    expect(tips.get('home')).toBe('H');
    expect(tips.get('help')).toBe('E');
    expect(tips.get('insert')).toBe('I');
    expect(tips.get('ink')).not.toMatch(/^I/);
    expect(tips.get('group')).toBe('ZF');
    const all = [...tips.values()];
    for (const tip of all) expect(all.filter((other) => other !== tip && other.startsWith(tip))).toEqual([]);
    expect(matchKeyTip('H', all)).toEqual({ exact: 'H', more: false });
    expect(matchKeyTip('Z', all)).toEqual({ exact: null, more: true });
    expect(matchKeyTip('Q', all)).toEqual({ exact: null, more: false });
  });

  describe('in the ribbon', () => {
    beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(flyoutSize); });
    afterEach(() => vi.restoreAllMocks());

    const tapAlt = () => {
      fireEvent.keyDown(window, { key: 'Alt', code: 'AltLeft', altKey: true });
      fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft' });
    };
    const press = (letter: string, init: Partial<KeyboardEventInit> = {}) =>
      fireEvent.keyDown(window, { key: letter.toLowerCase(), code: /\d/.test(letter) ? 'Digit' + letter : 'Key' + letter, ...init });
    const badges = () => [...document.querySelectorAll('[data-cg-keytip-badge]')].map((badge) => badge.textContent);

    const keyed = (onBold: () => void, onLaunch: () => void): ReadonlyArray<CgRibbonTab> => [
      {
        key: 'home',
        text: 'Home',
        keyTip: 'H',
        groups: [{
          key: 'font',
          text: 'Font',
          onLauncherClick: onLaunch,
          launcherKeyTip: 'FN',
          items: [
            { name: 'bold', text: 'Bold', icon: 'text-bold', hideText: true, keyTip: '1', onClick: onBold },
            { name: 'cut', text: 'Cut', icon: 'cut' },
          ],
        }],
      },
      { key: 'insert', text: 'Insert', keyTip: 'N', groups: [{ key: 'charts', text: 'Charts', items: [{ name: 'pie', text: 'Pie', icon: 'chart-pie' }] }] },
    ];

    it('shows the tabs’ tips on a tap of Alt, then a tab’s commands, and runs one', async () => {
      const bold = vi.fn();
      const changes: boolean[] = [];
      render(<CgRibbon tabs={keyed(bold, () => undefined)} defaultActiveKey="insert" keyTips onKeyTipsChange={(shown) => changes.push(shown)} startContent={<button type="button" data-cg-keytip="F">File</button>} />);
      tapAlt();
      await waitFor(() => expect(badges()).toEqual(['F', 'H', 'N']));
      press('H');
      await waitFor(() => expect(badges()).toEqual(['1', 'C', 'FN']));
      expect(screen.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
      press('1');
      expect(bold).toHaveBeenCalledTimes(1);
      expect(badges()).toEqual([]);
      expect(changes).toEqual([true, false]);
    });

    it('waits for a second letter, goes back a level on Esc, and ends on a click', async () => {
      const launch = vi.fn();
      render(<CgRibbon tabs={keyed(() => undefined, launch)} keyTips />);
      tapAlt();
      press('H');
      await waitFor(() => expect(badges()).toContain('FN'));
      press('F');
      expect(badges()).toEqual(['FN']);
      press('N');
      expect(launch).toHaveBeenCalledTimes(1);
      tapAlt();
      press('H');
      await waitFor(() => expect(badges()).toContain('1'));
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      await waitFor(() => expect(badges()).toEqual(['H', 'N']));
      fireEvent.pointerDown(document.body);
      expect(badges()).toEqual([]);
    });

    it('goes straight to a tab with Alt and its letter, but not for a reserved letter', async () => {
      render(<CgRibbon tabs={keyed(() => undefined, () => undefined)} keyTips reservedAltKeys={['h']} />);
      fireEvent.keyDown(window, { key: 'Alt', code: 'AltLeft', altKey: true });
      press('N', { altKey: true });
      fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft' });
      await waitFor(() => expect(badges()).toEqual(['P']));
      expect(screen.getByRole('tab', { name: 'Insert' })).toHaveAttribute('aria-selected', 'true');
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
      fireEvent.keyDown(window, { key: 'Alt', code: 'AltLeft', altKey: true });
      press('H', { altKey: true });
      expect(badges()).toEqual([]);
      expect(screen.getByRole('tab', { name: 'Insert' })).toHaveAttribute('aria-selected', 'true');
    });

    it('stays quiet without the prop', () => {
      render(<CgRibbon tabs={keyed(() => undefined, () => undefined)} />);
      tapAlt();
      expect(badges()).toEqual([]);
    });
  });
});

describe('key tips on a rendered item', () => {
  beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(flyoutSize); });
  afterEach(() => vi.restoreAllMocks());

  it('focuses the input of an item that keeps its own keyboard', async () => {
    render(<CgRibbon keyTips tabs={[{ key: 'home', text: 'Home', keyTip: 'H', groups: [{ key: 'font', text: 'Font', items: [{ name: 'font-name', keyTip: 'FF', ownsKeyboard: true, render: () => <input aria-label="Font" /> }] }] }]} />);
    fireEvent.keyDown(window, { key: 'Alt', code: 'AltLeft', altKey: true });
    fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft' });
    fireEvent.keyDown(window, { key: 'h', code: 'KeyH' });
    await waitFor(() => expect(document.querySelector('[data-cg-keytip-badge="FF"]')).not.toBeNull());
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF' });
    fireEvent.keyDown(window, { key: 'f', code: 'KeyF' });
    expect(screen.getByRole('textbox', { name: 'Font' })).toHaveFocus();
  });
});
