import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgBreadcrumb, collapseCrumbs } from './CgBreadcrumb';
import type { CgBreadcrumbItem } from './CgBreadcrumb.types';

const trail: CgBreadcrumbItem[] = [
  { key: 'section', text: 'خاص' },
  { key: 'p1', text: 'المالية', href: '#/p/p1', icon: '💰' },
  { key: 'p2', text: 'الميزانيات', href: '#/p/p2' },
  { key: 'p3', text: '2026', href: '#/p/p3' },
  { key: 'p4', text: 'الربع الرابع', href: '#/p/p4' },
  { key: 'p5', text: 'مراجعة نوفمبر', href: '#/p/p5', icon: '📄' },
];

describe('collapseCrumbs', () => {
  it('keeps the first and last crumbs and hides the middle', () => {
    expect(collapseCrumbs([1, 2, 3, 4, 5, 6], 4, 1, 2)).toEqual({ shown: [1, null, 5, 6], hidden: [2, 3, 4] });
    expect(collapseCrumbs([1, 2, 3], 4, 1, 2)).toEqual({ shown: [1, 2, 3], hidden: [] });
    expect(collapseCrumbs([1, 2, 3], undefined, 1, 2)).toEqual({ shown: [1, 2, 3], hidden: [] });
    expect(collapseCrumbs([1, 2, 3], 2, 1, 2)).toEqual({ shown: [1, 2, 3], hidden: [] });
  });
});

describe('CgBreadcrumb', () => {
  it('is a named navigation list whose last crumb is the current page', () => {
    render(<CgBreadcrumb items={trail} label="مسار التنقل" />);
    const nav = screen.getByRole('navigation', { name: 'مسار التنقل' });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('خاص');
    expect(within(items[0]!).queryByRole('link')).toBeNull();
    expect(screen.getByRole('link', { name: 'المالية' })).toHaveAttribute('href', '#/p/p1');
    const current = nav.querySelector('[aria-current="page"]')!;
    expect(current).toHaveTextContent('مراجعة نوفمبر');
    expect(current.tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: /مراجعة/u })).toBeNull();
    expect(nav.querySelector('[dir="auto"]')).not.toBeNull();
  });

  it('collapses the middle into a menu that lists and navigates to the hidden crumbs', async () => {
    const onNavigate = vi.fn(({ event }: { event: Event | { preventDefault(): void } }) => event.preventDefault());
    render(<CgBreadcrumb items={trail} label="مسار التنقل" maxItems={4} itemsBeforeCollapse={1} itemsAfterCollapse={2} overflowLabel={(hidden) => `${hidden.length} صفحات أخرى`} onNavigate={onNavigate} />);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('listitem')).toHaveLength(4);
    const more = screen.getByRole('button', { name: '3 صفحات أخرى' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    await userEvent.click(more);
    const menu = await screen.findByRole('menu', { hidden: true });
    expect(menu).toHaveAttribute('aria-label', '3 صفحات أخرى');
    const entries = within(menu).getAllByRole('menuitem', { hidden: true });
    expect(entries.map((entry) => entry.textContent)).toEqual(['المالية', 'الميزانيات', '2026']);
    await userEvent.click(entries[1]!);
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ item: trail[2], source: 'overflow' }));
  });

  it('reports a crumb chosen in the trail, and leaves a crumb without a link as text', async () => {
    const onNavigate = vi.fn(({ event }: { event: { preventDefault(): void } }) => event.preventDefault());
    render(<CgBreadcrumb items={[{ key: 'a', text: 'أ' }, { key: 'b', text: 'ب', href: '#/b' }, { key: 'c', text: 'ج' }]} label="مسار" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('link', { name: 'ب' }));
    expect(onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ item: expect.objectContaining({ key: 'b' }), source: 'trail' }));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('links the current page only when asked, and draws a custom separator', () => {
    const { container } = render(<CgBreadcrumb items={trail.slice(1, 3)} label="مسار" currentLinked separator="/" />);
    expect(screen.getByRole('link', { name: 'الميزانيات' })).toHaveAttribute('aria-current', 'page');
    expect(container.querySelectorAll('li')[1]!.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('li')[1]!.firstElementChild).toHaveTextContent('/');
  });

  it('needs a label, sound counts and an overflow label when it collapses', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgBreadcrumb items={trail} label=" " />)).toThrow(/label/u);
    expect(() => render(<CgBreadcrumb items={trail} label="x" maxItems={1} />)).toThrow(RangeError);
    expect(() => render(<CgBreadcrumb items={trail} label="x" maxItems={3} />)).toThrow(/overflowLabel/u);
  });
});
