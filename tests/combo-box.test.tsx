import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgComboBox } from '../src';
import type { CgComboBoxProps } from '../src';

interface Customer { id: number; name: string; code: string; }
const customers: Customer[] = [
  { id: 1, name: 'Acme Manufacturing', code: 'A-100' },
  { id: 2, name: 'Contoso Retail', code: 'C-200' },
  { id: 3, name: 'أَحْمَد للتجارة', code: 'AR-300' },
];
const label = (item: Customer) => `${item.code} - ${item.name}`;
const key = (item: Customer) => item.id;

describe('CgComboBox', () => {
  it('filters local options, keeps focus, commits an object, and serializes its key', async () => {
    const changes = vi.fn();
    render(<form data-testid="form"><CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} getOptionSearchText={(item) => item.name} name="customerId" onValueChange={changes} /></form>);
    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox', { hidden: true })).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'contoso' } });
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('option', { hidden: true }));
    fireEvent.click(screen.getByRole('option', { hidden: true }));
    expect(changes).toHaveBeenLastCalledWith(customers[1], expect.objectContaining({ reason: 'select', previousValue: null }));
    expect(input).toHaveValue('C-200 - Contoso Retail');
    expect(screen.queryByRole('listbox', { hidden: true })).not.toBeInTheDocument();
    expect(new FormData(screen.getByTestId('form')).get('customerId')).toBe('2');
  });

  it('supports keyboard navigation and prevents Enter submission only while open', () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} /><button type="submit">Submit</button></form>);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox', { hidden: true }).id);
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option', { hidden: true })[0]?.id);
    fireEvent.keyDown(input, { key: 'End' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option', { hidden: true })[2]?.id);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue(label(customers[2]!));
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.submit(input.closest('form')!);
    expect(submit).toHaveBeenCalledOnce();
  });

  it('restores committed text on Escape, Tab, outside pointer, and below-minimum blur', async () => {
    render(<><CgComboBox options={customers} defaultValue={customers[0]} getOptionLabel={label} getOptionKey={key} minimumSearchLength={2} /><button>Outside</button></>);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Co' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue(label(customers[0]!));
    fireEvent.change(input, { target: { value: 'Co' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveValue(label(customers[0]!));
    fireEvent.change(input, { target: { value: 'x' } });
    fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveValue(label(customers[0]!)));
    fireEvent.change(input, { target: { value: 'Co' } });
    const outside = screen.getByRole('button', { name: 'Outside' });
    fireEvent.pointerDown(outside, { pointerId: 11 });
    fireEvent.pointerUp(outside, { pointerId: 11 });
    expect(input).toHaveValue(label(customers[0]!));
  });

  it('restores a parent-rejected controlled selection and accepts external updates', async () => {
    const changed = vi.fn();
    const { rerender } = render(<CgComboBox options={customers} value={customers[0]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Contoso' } });
    fireEvent.click(screen.getByRole('option', { hidden: true }));
    await waitFor(() => expect(input).toHaveValue(label(customers[0]!)));
    expect(changed).toHaveBeenCalledWith(customers[1], expect.objectContaining({ reason: 'select' }));
    rerender(<CgComboBox options={customers} value={customers[2]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    await waitFor(() => expect(input).toHaveValue(label(customers[2]!)));
  });

  it('adopts key-equivalent option replacements without emitting a change', async () => {
    const changed = vi.fn();
    const replacement = customers.map((item) => ({ ...item, name: `${item.name} reloaded` }));
    const { rerender } = render(<CgComboBox options={customers} defaultValue={customers[0]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    rerender(<CgComboBox options={replacement} defaultValue={customers[0]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(label(replacement[0]!)));
    expect(changed).not.toHaveBeenCalled();
  });

  it('normalizes Arabic marks and supports starts-with search', () => {
    render(<CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} getOptionSearchText={(item) => item.name} searchMode="startsWith" locale="ar-EG" />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'احمد' } });
    expect(screen.getAllByRole('option', { hidden: true })).toHaveLength(1);
    expect(screen.getByRole('option', { hidden: true })).toHaveTextContent('أَحْمَد');
  });

  it('debounces remote work, aborts stale requests, and ignores stale results', async () => {
    vi.useFakeTimers();
    const pending = new Map<string, { resolve: (items: ReadonlyArray<Customer>) => void; signal: AbortSignal }>();
    const load = vi.fn((query: string, { signal }: { signal: AbortSignal }) => new Promise<ReadonlyArray<Customer>>((resolve) => pending.set(query, { resolve, signal })));
    render(<CgComboBox loadOptions={load} getOptionLabel={label} getOptionKey={key} minimumSearchLength={2} searchDelay={50} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'a' } });
    expect(screen.getByRole('status', { hidden: true })).toHaveTextContent('at least 2');
    fireEvent.change(input, { target: { value: 'ac' } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(load).toHaveBeenCalledWith('ac', expect.objectContaining({ requestId: 1 }));
    fireEvent.change(input, { target: { value: 'co' } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(pending.get('ac')?.signal.aborted).toBe(true);
    await act(async () => pending.get('ac')?.resolve([customers[0]!]));
    expect(screen.queryByRole('option', { hidden: true })).not.toBeInTheDocument();
    await act(async () => pending.get('co')?.resolve([customers[1]!]));
    expect(screen.getByRole('option', { hidden: true })).toHaveTextContent('Contoso');
  });

  it('handles remote rejection and keeps status nodes outside the listbox', async () => {
    render(<CgComboBox loadOptions={() => Promise.reject(new Error('offline'))} getOptionLabel={label} getOptionKey={key} searchDelay={0} errorMessage={(error) => error instanceof Error ? error.message : 'error'} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'customer' } });
    expect(await screen.findByRole('alert', { hidden: true })).toHaveTextContent('offline');
    expect(screen.getByRole('listbox', { hidden: true }).querySelector('[role="alert"]')).toBeNull();
  });

  it('does not search during composition and runs exactly once when composition ends', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.resolve(customers));
    render(<CgComboBox loadOptions={load} getOptionLabel={label} getOptionKey={key} searchDelay={25} />);
    const input = screen.getByRole('combobox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'اح' } });
    await act(() => vi.advanceTimersByTimeAsync(30));
    expect(load).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: 'اح' });
    await act(() => vi.advanceTimersByTimeAsync(25));
    expect(load).toHaveBeenCalledOnce();
  });

  it('resets through an external form association and exposes native state and refs', async () => {
    const ref = createRef<HTMLInputElement>();
    const changed = vi.fn();
    render(<><form id="external" /><CgComboBox ref={ref} form="external" name="customer" options={customers} defaultValue={customers[0]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} required validationState="error" /></>);
    expect(ref.current).toBe(screen.getByRole('combobox'));
    expect(ref.current).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(ref.current!, { target: { value: 'Contoso' } });
    fireEvent.click(screen.getByRole('option', { hidden: true }));
    expect(new FormData(document.getElementById('external') as HTMLFormElement).get('customer')).toBe('2');
    fireEvent.reset(document.getElementById('external') as HTMLFormElement);
    await act(async () => { await Promise.resolve(); });
    expect(ref.current).toHaveValue(label(customers[0]!));
    expect(changed).toHaveBeenLastCalledWith(customers[0], expect.objectContaining({ reason: 'reset' }));
  });

  it('validates source configuration, limits, and option keys', () => {
    const conflictingSource = { options: customers, loadOptions: () => [], getOptionLabel: label, getOptionKey: key } as unknown as CgComboBoxProps<Customer>;
    expect(() => render(<CgComboBox {...conflictingSource} />)).toThrow(/either options or loadOptions/u);
    expect(() => render(<CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} searchDelay={-1} />)).toThrow(RangeError);
    expect(() => render(<CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} minimumSearchLength={-1} />)).toThrow(RangeError);
    expect(() => render(<CgComboBox options={customers} getOptionLabel={label} getOptionKey={key} maxVisibleItems={0} />)).toThrow(RangeError);
    expect(() => render(<CgComboBox options={[customers[0]!, { ...customers[1]!, id: 1 }]} getOptionLabel={label} getOptionKey={key} />)).toThrow(/duplicate option key 1/u);
    expect(() => render(<CgComboBox options={[customers[0]!, customers[1]!, { ...customers[2]!, id: 1 }]} getOptionLabel={label} getOptionKey={key} maxVisibleItems={1} />)).toThrow(/duplicate option key 1/u);
  });

  it('supports idiomatic controlled composition', () => {
    function Controlled() {
      const [value, setValue] = useState<Customer | null>(null);
      return <CgComboBox options={customers} value={value} onValueChange={setValue} getOptionLabel={label} getOptionKey={key} />;
    }
    render(<Controlled />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Acme' } });
    fireEvent.click(screen.getByRole('option', { hidden: true }));
    expect(input).toHaveValue(label(customers[0]!));
  });
});
