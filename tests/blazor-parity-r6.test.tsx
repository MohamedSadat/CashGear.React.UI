import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CgLookUpGrid } from '../src';
import type { CgLookUpGridColumnDescriptor } from '../src';
import { calculateLookUpRows, resolveLookUpRowHeight } from '../src/components/LookUpGrid/virtualRows';

interface Customer { id: number; name: string }
const customers: Customer[] = Array.from({ length: 600 }, (_, index) => ({ id: index + 1, name: `Customer ${String(index + 1).padStart(3, '0')}` }));
const columns: ReadonlyArray<CgLookUpGridColumnDescriptor<Customer>> = [{ fieldId: 'name', title: 'Name', accessor: (item) => item.name }];
const base = { data: customers, columns, valueSelector: (item: Customer) => item.id, textSelector: (item: Customer) => item.name, 'aria-label': 'Customer' };
const renderedRows = () => [...document.querySelectorAll<HTMLElement>('[role="row"]')].filter((row) => row.id.includes('-row-'));

describe('LookUpGrid row virtualization', () => {
  it('calculates the window with overscan and spacers', () => {
    expect(calculateLookUpRows(600, 0, 320, 32, 5)).toEqual({ start: 0, end: 15, paddingBefore: 0, paddingAfter: 585 * 32 });
    expect(calculateLookUpRows(600, 3200, 320, 32, 5)).toEqual({ start: 95, end: 115, paddingBefore: 95 * 32, paddingAfter: 485 * 32 });
    expect(calculateLookUpRows(0, 0, 320, 32, 5)).toEqual({ start: 0, end: 0, paddingBefore: 0, paddingAfter: 0 });
  });

  it('resolves row heights in px, rem and em and refuses other units', () => {
    expect(resolveLookUpRowHeight(undefined)).toBe(32);
    expect(resolveLookUpRowHeight(28)).toBe(28);
    expect(resolveLookUpRowHeight('2.5rem')).toBe(40);
    expect(resolveLookUpRowHeight('36px')).toBe(36);
    expect(() => resolveLookUpRowHeight('10%')).toThrow(/px, rem, or em/);
  });

  it('renders only the rows near the scroll position, keeping the full row count', async () => {
    render(<CgLookUpGrid {...base} defaultOpen pageSize={600} />);
    await waitFor(() => expect(renderedRows().length).toBeGreaterThan(0));
    expect(renderedRows().length).toBeLessThan(40);
    expect(document.querySelector('[role="grid"]')).toHaveAttribute('aria-rowcount', '601');
    expect(document.querySelector('[data-cg-lookupgrid-spacer="after"]')).not.toBeNull();
    expect(renderedRows()[0]).toHaveAttribute('aria-rowindex', '2');
  });

  it('renders every row with virtualization off and validates overscan', async () => {
    const { unmount } = render(<CgLookUpGrid {...base} defaultOpen pageSize={600} enableVirtualization={false} />);
    await waitFor(() => expect(renderedRows()).toHaveLength(600));
    unmount();
    expect(() => render(<CgLookUpGrid {...base} rowOverscan={101} />)).toThrow(/rowOverscan/);
    expect(() => render(<CgLookUpGrid {...base} rowHeight="10%" />)).toThrow(/rowHeight/);
  });

  it('scrolls a keyboard target outside the window into view', async () => {
    render(<CgLookUpGrid {...base} defaultOpen pageSize={600} />);
    await waitFor(() => expect(renderedRows().length).toBeGreaterThan(0));
    const input = screen.getByRole('combobox', { name: 'Customer' });
    const viewport = document.querySelector<HTMLElement>('[data-cg-lookupgrid-viewport]')!;
    await act(async () => { fireEvent.keyDown(input, { key: 'End' }); });
    await waitFor(() => expect(viewport.scrollTop).toBeGreaterThan(0));
  });
});
