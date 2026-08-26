import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgAccordion } from '../src';
import type { CgAccordionActions, CgAccordionItemDescriptor } from '../src';

const panels: ReadonlyArray<CgAccordionItemDescriptor> = [
  { key: 'one', text: 'One', content: <input aria-label="One field" /> },
  { key: 'two', text: 'Two', content: <p>Second</p> },
];

describe('CgAccordion', () => {
  it('validates hierarchy, depth, keys, and safe URLs before visibility pruning', () => {
    expect(() => render(<CgAccordion items={[{ key: 'x', text: 'X', children: [] }, { key: 'y', text: 'Y', parentKey: 'x' }]} />)).toThrow(/cannot mix/);
    expect(() => render(<CgAccordion items={[{ key: 'x', text: 'X', parentKey: 'missing' }]} />)).toThrow(/missing parent/);
    expect(() => render(<CgAccordion items={[{ key: 'x', text: 'X', navigateUrl: 'java\nscript:alert(1)', visible: false }]} />)).toThrow(/unsafe/);
    expect(() => render(<CgAccordion items={[{ key: 'x', text: 'X', hasChildren: true }]} />)).toThrow(/without loadChildren/);
  });

  it('uses disclosure semantics and retains on-demand content after collapse', async () => {
    render(<CgAccordion items={panels} />);
    const one = screen.getByRole('button', { name: 'One' });
    expect(one).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(one);
    expect(one).toHaveAttribute('aria-expanded', 'true');
    const input = screen.getByRole('textbox', { name: 'One field' });
    await userEvent.type(input, 'retained');
    await userEvent.click(one);
    expect(screen.getByRole('region', { hidden: true })).not.toBeVisible();
    await userEvent.click(one);
    expect(screen.getByRole('textbox', { name: 'One field' })).toHaveValue('retained');
  });

  it('keeps controlled expansion authoritative and delays after callbacks until acceptance', async () => {
    const changed = vi.fn(); const after = vi.fn();
    render(<CgAccordion items={panels} expandedKeys={new Set()} onExpandedKeysChange={changed} afterExpand={after} />);
    await userEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(changed).toHaveBeenCalledWith(new Set(['one']), expect.objectContaining({ key: 'one' }));
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-expanded', 'false');
    expect(after).not.toHaveBeenCalled();
  });

  it('evaluates sibling collapses independently in single mode', async () => {
    const afterCollapse = vi.fn();
    render(<CgAccordion items={panels} expansionMode="single-sibling" defaultExpandedKeys={new Set(['one'])} beforeCollapse={(details) => details.key === 'one' ? false : undefined} afterCollapse={afterCollapse} />);
    await userEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-expanded', 'true');
    expect(afterCollapse).not.toHaveBeenCalled();
  });

  it('supersedes stale expansion guards', async () => {
    const signals: AbortSignal[] = []; let count = 0;
    render(<CgAccordion items={panels} beforeExpand={(details) => { signals.push(details.signal); count += 1; return count === 1 ? new Promise<boolean>(() => undefined) : true; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'One' }));
    fireEvent.click(screen.getByRole('button', { name: 'Two' }));
    await act(async () => Promise.resolve());
    expect(signals[0]?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters text and search text while preserving ancestors and uses safe highlighting', () => {
    const items: ReadonlyArray<CgAccordionItemDescriptor> = [{ key: 'root', text: 'Root', children: [{ key: 'match', text: '<script>Invoice</script>', searchText: 'aging', content: 'Found' }] }];
    const { container } = render(<CgAccordion items={items} defaultFilterText="aging" />);
    expect(screen.getByText('Root')).toBeInTheDocument();
    expect(screen.getByText('<script>Invoice</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  it('loads once, caches complete results, and exposes reload', async () => {
    const load = vi.fn(async () => [{ key: 'child', text: 'Child' }] satisfies ReadonlyArray<CgAccordionItemDescriptor>);
    const actions = createRef<CgAccordionActions>();
    render(<CgAccordion items={[{ key: 'remote', text: 'Remote', hasChildren: true }]} loadChildren={load} actionsRef={actions} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(await screen.findByText('Child')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remote' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remote' }));
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { await actions.current?.reloadChildren('remote'); });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('matches the longest relative route but never absolute URLs', () => {
    const changed = vi.fn();
    render(<CgAccordion items={[{ key: 'root', text: 'Root', children: [{ key: 'short', text: 'Sales', navigateUrl: '/sales' }, { key: 'long', text: 'Orders', navigateUrl: '/sales/orders/' }, { key: 'absolute', text: 'Absolute', navigateUrl: 'https://cashgear.invalid/sales/orders' }] }]} currentLocation="/sales/orders?view=open" onSelectedKeyChange={changed} />);
    expect(changed).toHaveBeenCalledWith('long', expect.objectContaining({ source: 'route', isUserInitiated: false }));
  });

  it('keeps physical tree keys unchanged in RTL and exposes actions', async () => {
    const actions = createRef<CgAccordionActions>();
    render(<CgAccordion items={[{ key: 'root', text: 'Root', children: [{ key: 'child', text: 'Child' }] }]} direction="rtl" actionsRef={actions} />);
    const root = screen.getByRole('button', { name: 'Root' }); root.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(root).toHaveAttribute('aria-expanded', 'true');
    await act(async () => { await actions.current?.selectItem('child'); });
    expect(screen.getByRole('treeitem', { name: /Child/ })).toHaveAttribute('aria-selected', 'true');
  });
});
