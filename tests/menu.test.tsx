import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgMenu } from '../src';
import type { CgMenuActions, CgMenuItem } from '../src';
import { normalizeMenuTree } from '../src/internal/menuTree';

const items: ReadonlyArray<CgMenuItem> = [
  { key: 'home', text: 'Home', navigateUrl: '/', routeMatch: 'exact' },
  { key: 'sales', text: 'Sales', children: [
    { key: 'orders', text: 'Orders', navigateUrl: '/sales/orders' },
    { key: 'disabled', text: 'Disabled', disabled: true },
  ] },
  { key: 'settings', text: 'Settings' },
];

describe('menu foundation', () => {
  it('validates hierarchy and URLs before pruning', () => {
    expect(() => normalizeMenuTree([
      { key: 'a', text: 'A', parentKey: 'missing', visible: false },
    ], { componentName: 'Test', maxDepth: 16 })).toThrow(/missing parent/);
    expect(() => normalizeMenuTree([
      { key: 'a', text: 'A', href: 'java\nscript:alert(1)' },
    ], { componentName: 'Test', maxDepth: 16 })).toThrow(/unsafe/);
    expect(() => normalizeMenuTree([
      { key: 'a', text: 'A' }, { key: 'a', text: 'Again' },
    ], { componentName: 'Test', maxDepth: 16 })).toThrow(/duplicate/);
  });

  it('prunes hidden empty parents and normalizes separators', () => {
    const normalized = normalizeMenuTree([
      { key: 'hidden', text: 'Hidden', visible: false },
      { key: 'separator-first', separator: true },
      { key: 'empty', text: 'Empty', children: [{ key: 'gone', text: 'Gone', visible: false }] },
      { key: 'kept', text: 'Kept', beginGroup: true },
      { key: 'separator-last', separator: true },
    ], { componentName: 'Test', maxDepth: 16 });
    expect(normalized.map((node) => node.key)).toEqual(['kept']);
  });
});

describe('CgMenu', () => {
  it('renders native navigation and selects the most specific route', () => {
    render(<CgMenu items={items} currentLocation="https://cashgear.test/sales/orders/42" />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sales' }));
    expect(screen.getByText('Orders').closest('a')).toHaveAttribute('aria-current', 'page');
  });

  it('keeps controlled selection and expansion authoritative', async () => {
    const selected = vi.fn();
    const expanded = vi.fn();
    render(
      <CgMenu
        items={items}
        semanticMode="application-menu"
        selectionMode="manual"
        selectedKey="home"
        expandedKeys={new Set()}
        onSelectedKeyChange={selected}
        onExpandedKeysChange={expanded}
      />,
    );
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sales' }));
    expect(expanded).toHaveBeenCalled();
    expect(screen.queryByRole('menuitem', { name: 'Orders' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(selected).toHaveBeenCalledWith('settings', expect.any(Object));
    expect(screen.getByRole('menuitem', { name: 'Home' })).toHaveAttribute('data-selected', 'true');
  });

  it('supports roving keyboard focus, typeahead, RTL, and actions', async () => {
    const actions = createRef<CgMenuActions>();
    function Harness() {
      const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
      return <CgMenu items={items} semanticMode="application-menu" direction="rtl" expandedKeys={expanded} onExpandedKeysChange={setExpanded} actionsRef={actions} />;
    }
    render(<Harness />);
    act(() => actions.current?.focusItem('sales'));
    expect(screen.getByRole('menuitem', { name: 'Sales' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    const orders = (await screen.findByText('Orders')).closest('a')!;
    fireEvent.keyDown(orders, { key: 'Escape' });
    expect(screen.getByRole('menuitem', { name: 'Sales' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Sales' }), { key: 's' });
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveFocus();
  });

  it('produces deterministic full SSR markup before measurement', () => {
    const html = renderToString(<CgMenu items={items} displayMode="automatic" />);
    expect(html).toContain('Home');
    expect(html).toContain('Sales');
    expect(html).not.toContain('Open menu');
  });

  it('keeps a hover submenu open while the pointer crosses into its portal', () => {
    vi.useFakeTimers();
    try {
      render(<CgMenu items={items} semanticMode="application-menu" submenuTrigger="hover" openDelay={100} closeDelay={200} />);
      fireEvent.pointerEnter(screen.getByRole('menuitem', { name: 'Sales' }));
      act(() => vi.advanceTimersByTime(110));
      const orders = document.querySelector<HTMLElement>('[data-cg-menu-key="orders"]')!;
      expect(orders).toBeInTheDocument();
      fireEvent.pointerLeave(screen.getByRole('menuitem', { name: 'Sales' }));
      fireEvent.pointerEnter(orders.closest('ul')!);
      act(() => vi.advanceTimersByTime(210));
      expect(orders).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Sales' })).toHaveAttribute('aria-expanded', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});
