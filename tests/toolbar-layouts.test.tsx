import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgToolbar } from '../src';
import type { CgToolbarItem } from '../src';

const flyoutSize = { x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) };

describe('CgToolbar additions for layouts and flyouts', () => {
  beforeEach(() => { vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(flyoutSize); });
  afterEach(() => vi.restoreAllMocks());

  it('starts a new row at each beginRow item in the rows layout', () => {
    render(<CgToolbar layout="rows" autoOverflow={false} autoCollapseText={false} items={[{ name: 'a', text: 'A' }, { name: 'b', text: 'B' }, { name: 'c', text: 'C', beginRow: true }]} />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveAttribute('data-layout', 'rows');
    expect(screen.getByRole('button', { name: 'A' }).parentElement!.parentElement).toBe(screen.getByRole('button', { name: 'B' }).parentElement!.parentElement);
    expect(screen.getByRole('button', { name: 'C' }).parentElement!.parentElement).not.toBe(screen.getByRole('button', { name: 'A' }).parentElement!.parentElement);
  });

  it('marks stacked items and sets the row count in the columns layout, and moves arrows across layouts as one list', () => {
    render(<CgToolbar layout="columns" columnRows={2} autoOverflow={false} autoCollapseText={false} items={[{ name: 'a', text: 'A', stacked: true }, { name: 'b', text: 'B' }, { name: 'c', text: 'C' }]} />);
    const a = screen.getByRole('button', { name: 'A' });
    expect(a.parentElement).toHaveAttribute('data-stacked');
    expect(screen.getByRole('button', { name: 'B' }).parentElement).not.toHaveAttribute('data-stacked');
    expect(a.parentElement!.parentElement!.style.getPropertyValue('--cg-toolbar-rows')).toBe('2');
    act(() => a.focus());
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'B' })).toHaveFocus();
  });

  it('opens a flyout from a drop-down button, or from the arrow of a split button with onClick', async () => {
    const primary = vi.fn();
    render(<CgToolbar autoOverflow={false} autoCollapseText={false} items={[
      { name: 'drop', text: 'Drop', renderFlyout: () => <p>Dropped</p> },
      { name: 'split', text: 'Split', toggleAriaLabel: 'Open split', menuAriaLabel: 'Split panel', onClick: primary, renderFlyout: ({ close }) => <button type="button" onClick={close}>Done</button> },
    ]} />);
    expect(screen.getByRole('button', { name: 'Drop' })).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Drop' }));
    expect(await screen.findByRole('dialog', { name: 'Drop' })).toHaveTextContent('Dropped');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Split' }));
    await waitFor(() => expect(primary).toHaveBeenCalledOnce());
    await userEvent.click(screen.getByRole('button', { name: 'Open split' }));
    expect(await screen.findByRole('dialog', { name: 'Split panel' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('opens a flyout with ArrowDown, like a menu', async () => {
    render(<CgToolbar autoOverflow={false} autoCollapseText={false} items={[{ name: 'drop', text: 'Drop', renderFlyout: () => <p>Dropped</p> }]} />);
    const button = screen.getByRole('button', { name: 'Drop' });
    act(() => button.focus());
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    expect(await screen.findByRole('dialog', { name: 'Drop' })).toBeInTheDocument();
  });

  it('never moves a flyout item into the overflow menu', () => {
    const items: ReadonlyArray<CgToolbarItem> = [{ name: 'flyout', text: 'Flyout', overflowBehavior: 'always', renderFlyout: () => null }];
    render(<CgToolbar items={items} />);
    expect(screen.getByRole('button', { name: 'Flyout' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More commands' })).toBeNull();
  });

  it('leaves the keyboard to content that owns it: typing a space works and arrows pass over it', async () => {
    render(<CgToolbar autoOverflow={false} autoCollapseText={false} items={[
      { name: 'one', text: 'One' },
      { name: 'input', ownsKeyboard: true, tooltip: 'Search', render: () => <input aria-label="Name" /> },
      { name: 'two', text: 'Two' },
    ]} />);
    const input = screen.getByRole('textbox', { name: 'Name' });
    expect(input.parentElement).not.toHaveAttribute('tabindex');
    expect(input.parentElement).not.toHaveAttribute('data-cg-toolbar-name');
    await userEvent.type(input, 'a b');
    expect(input).toHaveValue('a b');
    const home = createEvent.keyDown(input, { key: 'ArrowLeft' });
    fireEvent(input, home);
    expect(home.defaultPrevented).toBe(false);
    expect(input).toHaveFocus();
    const one = screen.getByRole('button', { name: 'One' });
    act(() => one.focus());
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus();
  });

  it('keeps a roving tab stop on the buttons when keyboard-owning content comes first', () => {
    render(<CgToolbar autoOverflow={false} autoCollapseText={false} items={[
      { name: 'input', ownsKeyboard: true, render: () => <input aria-label="Name" /> },
      { name: 'one', text: 'One' },
      { name: 'two', text: 'Two' },
    ]} />);
    expect(screen.getByRole('button', { name: 'One' }).tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Two' }).tabIndex).toBe(-1);
  });

  it('rejects flyout and keyboard options that cannot work', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const noOverflow = { autoOverflow: false, autoCollapseText: false };
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', text: 'A', renderFlyout: () => null, children: [{ name: 'b', text: 'B' }] }]} />)).toThrow(/cannot combine renderFlyout/);
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', render: () => null, renderFlyout: () => null }]} />)).toThrow(/cannot combine renderFlyout/);
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', text: 'A', children: [{ name: 'b', text: 'B', renderFlyout: () => null }] }]} />)).toThrow(/cannot open a flyout/);
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', text: 'A', navigateUrl: '/x', renderFlyout: () => null }]} />)).toThrow(/cannot navigate/);
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', text: 'A', checked: true, renderFlyout: () => null }]} />)).toThrow(/needs onClick/);
    expect(() => render(<CgToolbar {...noOverflow} items={[{ name: 'a', text: 'A', ownsKeyboard: true }]} />)).toThrow(/ownsKeyboard without render/);
    expect(() => render(<CgToolbar {...noOverflow} layout="columns" columnRows={0} items={[]} />)).toThrow(/columnRows/);
    silence.mockRestore();
  });
});
