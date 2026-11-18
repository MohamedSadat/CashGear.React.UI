import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgButton, CgDropDownButton, CgSplitButton } from '../src';
import type { CgButtonMenuItem } from '../src';

const items: ReadonlyArray<CgButtonMenuItem> = [
  { key: 'edit', text: 'Edit' },
  { key: 'export', text: 'Export', children: [{ key: 'pdf', text: 'PDF' }, { key: 'xlsx', text: 'Excel' }] },
  { key: 'archive', text: 'Archive' },
];

describe('button menu additions', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows a decorative drop-down indicator that a host can replace or turn off', () => {
    const { rerender } = render(<CgDropDownButton items={items}>Actions</CgDropDownButton>);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    const indicator = trigger.querySelector('[data-cg-dropdown-indicator]')!;
    expect(indicator).toHaveTextContent('▾');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    rerender(<CgDropDownButton items={items} toggleIcon={<span data-testid="caret">v</span>}>Actions</CgDropDownButton>);
    expect(screen.getByRole('button', { name: 'Actions' }).querySelector('[data-cg-dropdown-indicator]')).toContainElement(screen.getByTestId('caret'));
    rerender(<CgDropDownButton items={items} dropDownIndicatorVisible={false}>Actions</CgDropDownButton>);
    expect(screen.getByRole('button', { name: 'Actions' }).querySelector('[data-cg-dropdown-indicator]')).toBeNull();
  });

  it('renders button trailing content except while busy', () => {
    const { rerender } = render(<CgButton trailingContent={<span data-testid="tail">›</span>}>Next</CgButton>);
    expect(screen.getByRole('button', { name: /Next/ })).toContainElement(screen.getByTestId('tail'));
    rerender(<CgButton loading trailingContent={<span data-testid="tail">›</span>}>Next</CgButton>);
    expect(screen.queryByTestId('tail')).toBeNull();
  });

  it('opens from the trigger on the first item with ArrowDown and the last with ArrowUp', async () => {
    const { unmount } = render(<CgDropDownButton items={items}>Actions</CgDropDownButton>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions' }), { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveFocus());
    unmount();
    render(<CgDropDownButton items={items}>Actions</CgDropDownButton>);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions' }), { key: 'ArrowUp' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus());
  });

  it('opens a split button toggle on the last item with ArrowUp and draws its own icon', async () => {
    render(<CgSplitButton items={items} toggleIcon={<span data-testid="chevron">⌄</span>}>Save</CgSplitButton>);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toContainElement(screen.getByTestId('chevron'));
    expect(screen.getByTestId('chevron').parentElement).toHaveAttribute('aria-hidden', 'true');
    fireEvent.keyDown(toggle, { key: 'ArrowUp' });
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Archive' })).toHaveFocus());
  });

  it('puts the menu class on every level and closes all levels with Alt+ArrowUp', async () => {
    const changed = vi.fn();
    render(<CgDropDownButton items={items} menuClassName="tenant-menu" onOpenChange={changed}>Actions</CgDropDownButton>);
    const trigger = screen.getByRole('button', { name: 'Actions' });
    await userEvent.click(trigger);
    const exportItem = await screen.findByRole('menuitem', { name: 'Export' });
    act(() => exportItem.focus());
    fireEvent.keyDown(exportItem, { key: 'ArrowRight' });
    const pdf = await screen.findByRole('menuitem', { name: 'PDF' });
    const menus = screen.getAllByRole('menu');
    expect(menus.length).toBe(2);
    for (const menu of menus) expect(menu).toHaveClass('tenant-menu');
    fireEvent.keyDown(pdf, { key: 'ArrowUp', altKey: true });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(changed).toHaveBeenLastCalledWith(false);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes and reports once when an open menu loses every command', async () => {
    const changed = vi.fn();
    const { rerender } = render(<CgDropDownButton items={items} open onOpenChange={changed}>Actions</CgDropDownButton>);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    rerender(<CgDropDownButton items={items.map((item) => ({ ...item, disabled: true, children: undefined }))} open onOpenChange={changed}>Actions</CgDropDownButton>);
    await waitFor(() => expect(changed).toHaveBeenCalledWith(false));
    rerender(<CgDropDownButton items={items.map((item) => ({ ...item, disabled: true, children: undefined }))} open onOpenChange={changed}>Actions</CgDropDownButton>);
    expect(changed.mock.calls.filter(([value]) => value === false)).toHaveLength(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
