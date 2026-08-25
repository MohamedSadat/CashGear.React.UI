import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgTagBox } from '../src';
import type { CgTagBoxProps } from '../src';

interface Customer { id: number; name: string; code: string; disabled?: boolean; }
const customers: Customer[] = [
  { id: 1, name: 'Acme Manufacturing', code: 'A-100' },
  { id: 2, name: 'Contoso Retail', code: 'C-200' },
  { id: 3, name: 'أَحْمَد للتجارة', code: 'AR-300' },
  { id: 4, name: 'Disabled Customer', code: 'D-400', disabled: true },
];
const label = (item: Customer) => `${item.code} - ${item.name}`;
const key = (item: Customer) => item.id;

function popupOption(text: string): HTMLElement {
  const option = screen.getAllByText(text).map((element) => element.closest('[role="option"]')).find(Boolean);
  if (!(option instanceof HTMLElement)) throw new Error(`Popup option not found: ${text}`);
  return option;
}

function popupListbox(): HTMLElement | null {
  return document.querySelector('div[role="listbox"]');
}

describe('CgTagBox selection', () => {
  it('selects and removes objects, retains input focus, and reports detailed changes', () => {
    const changed = vi.fn();
    const selected = vi.fn();
    const removed = vi.fn();
    render(<CgTagBox aria-label="Customers" options={customers} getOptionLabel={label} getOptionKey={key} onValueChange={changed} onOptionSelected={selected} onOptionRemoved={removed} />);
    const input = screen.getByRole('combobox', { name: 'Customers' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(popupOption(label(customers[0]!)));
    expect(input).toHaveFocus();
    expect(document.querySelectorAll('[data-cg-tagbox-tag]')).toHaveLength(1);
    expect(changed).toHaveBeenLastCalledWith([customers[0]], expect.objectContaining({ reason: 'select', previousValue: [], addedItems: [customers[0]], removedItems: [] }));
    expect(selected).toHaveBeenCalledWith(customers[0]);
    fireEvent.click(screen.getByRole('button', { name: `Remove ${label(customers[0]!)}` }));
    expect(changed).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'remove', removedItems: [customers[0]] }));
    expect(removed).toHaveBeenCalledWith(customers[0]);
  });

  it('supports controlled values without phantom tags and idiomatic controlled updates', async () => {
    const rejected = vi.fn();
    const { rerender } = render(<CgTagBox aria-label="Controlled" options={customers} value={[customers[0]!]} onValueChange={rejected} getOptionLabel={label} getOptionKey={key} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Contoso' } });
    await act(async () => {
      fireEvent.click(popupOption(label(customers[1]!)));
      await Promise.resolve();
    });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    await waitFor(() => expect(input).toHaveValue('Contoso'));
    expect(document.querySelector('[data-cg-tagbox-tag]')).toHaveTextContent(label(customers[0]!));
    rerender(<CgTagBox aria-label="Controlled" options={customers} value={[customers[1]!]} onValueChange={rejected} getOptionLabel={label} getOptionKey={key} />);
    expect(document.querySelector('[data-cg-tagbox-tag]')).toHaveTextContent(label(customers[1]!));

    function Controlled() {
      const [value, setValue] = useState<ReadonlyArray<Customer>>([]);
      return <CgTagBox aria-label="Accepted" options={customers} value={value} onValueChange={setValue} getOptionLabel={label} getOptionKey={key} />;
    }
    render(<Controlled />);
    const accepted = screen.getByRole('combobox', { name: 'Accepted' });
    fireEvent.keyDown(accepted, { key: 'ArrowDown' });
    const acceptedListbox = document.getElementById(accepted.getAttribute('aria-controls')!);
    const acceptedOption = Array.from(acceptedListbox?.querySelectorAll('[role="option"]') ?? []).find((option) => option.textContent === label(customers[0]!));
    if (!(acceptedOption instanceof HTMLElement)) throw new Error('Accepted option not found');
    await act(async () => {
      fireEvent.click(acceptedOption);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(accepted.closest('[dir]')?.querySelectorAll('[data-cg-tagbox-tag]')).toHaveLength(1);
  });

  it('deduplicates selected keys, preserves missing objects, and silently adopts replacements', async () => {
    const missing: Customer = { id: 99, code: 'M-999', name: 'Missing customer' };
    const changed = vi.fn();
    const replacement = customers.map((item) => ({ ...item, name: `${item.name} reloaded` }));
    const { rerender } = render(<CgTagBox options={customers} defaultValue={[customers[0]!, customers[0]!, missing]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    expect(document.querySelectorAll('[data-cg-tagbox-tag]')).toHaveLength(2);
    expect(Array.from(document.querySelectorAll('[data-cg-tagbox-tag]')).some((tag) => tag.textContent?.includes(label(missing)))).toBe(true);
    rerender(<CgTagBox options={replacement} defaultValue={[customers[0]!, customers[0]!, missing]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} />);
    await waitFor(() => expect(document.querySelector('[data-cg-tagbox-tag]')).toHaveTextContent(label(replacement[0]!)));
    expect(changed).not.toHaveBeenCalled();
  });

  it('enforces maximum selection while keeping selected options removable', () => {
    render(<CgTagBox aria-label="Limited" options={customers} defaultValue={[customers[0]!]} getOptionLabel={label} getOptionKey={key} maxSelectedItems={1} isOptionDisabled={(item) => Boolean(item.disabled)} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(popupOption(label(customers[0]!))).not.toHaveAttribute('aria-disabled');
    expect(popupOption(label(customers[1]!))).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(popupOption(label(customers[0]!)));
    expect(document.querySelectorAll('[data-cg-tagbox-tag]')).toHaveLength(0);
  });

  it('supports Backspace, clear, close-on-selection, and open notifications', () => {
    const changed = vi.fn();
    const cleared = vi.fn();
    const opened = vi.fn();
    render(<CgTagBox aria-label="Actions" options={customers} defaultValue={[customers[0]!, customers[1]!]} onValueChange={changed} onCleared={cleared} onOpenChange={opened} getOptionLabel={label} getOptionKey={key} closeOnSelection />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(changed).toHaveBeenLastCalledWith([customers[0]], expect.objectContaining({ reason: 'backspace', removedItems: [customers[1]] }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all selections' }));
    expect(cleared).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'clear' }));
    expect(opened).toHaveBeenLastCalledWith(true);
    fireEvent.click(popupOption(label(customers[0]!)));
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('CgTagBox search and async behavior', () => {
  it('filters local text with Arabic/diacritic folding and supports controlled search', () => {
    const searchChanged = vi.fn();
    const { rerender } = render(<CgTagBox aria-label="Search" options={customers} searchQuery="احمد" onSearchQueryChange={searchChanged} getOptionLabel={label} getOptionKey={key} getOptionSearchText={(item) => item.name} locale="ar-EG" searchMode="startsWith" />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(popupListbox()?.querySelectorAll('[role="option"]')).toHaveLength(1);
    expect(popupListbox()?.querySelector('[role="option"]')).toHaveTextContent('أَحْمَد');
    fireEvent.change(input, { target: { value: 'Contoso' } });
    expect(searchChanged).toHaveBeenCalledWith('Contoso', expect.anything());
    rerender(<CgTagBox aria-label="Search" options={customers} searchQuery="Acme" onSearchQueryChange={searchChanged} getOptionLabel={label} getOptionKey={key} getOptionSearchText={(item) => item.name} locale="ar-EG" searchMode="startsWith" />);
    expect(input).toHaveValue('Acme');
  });

  it('does not search during IME composition and runs exactly once after composition', async () => {
    vi.useFakeTimers();
    const load = vi.fn(() => Promise.resolve(customers));
    render(<CgTagBox aria-label="IME" loadOptions={load} getOptionLabel={label} getOptionKey={key} searchDelay={25} />);
    const input = screen.getByRole('combobox');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'اح' } });
    await act(() => vi.advanceTimersByTimeAsync(30));
    expect(load).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: 'اح' });
    await act(() => vi.advanceTimersByTimeAsync(25));
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith('اح', expect.objectContaining({ requestId: 1 }));
  });

  it('trims remote requests, aborts stale work, ignores stale results, and recovers from errors', async () => {
    vi.useFakeTimers();
    const pending = new Map<string, { resolve: (items: ReadonlyArray<Customer>) => void; reject: (error: unknown) => void; signal: AbortSignal }>();
    const load = vi.fn((query: string, { signal }: { signal: AbortSignal }) => new Promise<ReadonlyArray<Customer>>((resolve, reject) => pending.set(query, { resolve, reject, signal })));
    render(<CgTagBox aria-label="Remote" loadOptions={load} getOptionLabel={label} getOptionKey={key} minimumSearchLength={2} searchDelay={50} errorMessage={(error) => error instanceof Error ? error.message : 'error'} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: ' x ' } });
    expect(screen.getByText(/Type at least 2/u)).toBeInTheDocument();
    fireEvent.change(input, { target: { value: ' ac ' } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(load).toHaveBeenCalledWith('ac', expect.objectContaining({ requestId: 1 }));
    fireEvent.change(input, { target: { value: 'co' } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(pending.get('ac')?.signal.aborted).toBe(true);
    await act(async () => pending.get('ac')?.resolve([customers[0]!]));
    expect(popupListbox()?.querySelector('[role="option"]')).not.toBeInTheDocument();
    await act(async () => pending.get('co')?.reject(new Error('offline')));
    expect(screen.getByRole('alert', { hidden: true })).toHaveTextContent('offline');
    fireEvent.change(input, { target: { value: 'contoso' } });
    await act(() => vi.advanceTimersByTimeAsync(50));
    await act(async () => pending.get('contoso')?.resolve([customers[1]!]));
    expect(popupOption(label(customers[1]!))).toBeInTheDocument();
  });

  it('keeps loading, minimum, empty, and error status outside option ownership', async () => {
    render(<CgTagBox aria-label="Status" loadOptions={() => Promise.resolve([])} getOptionLabel={label} getOptionKey={key} minimumSearchLength={2} searchDelay={0} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const listbox = popupListbox();
    expect(screen.getByText(/Type at least 2/u)).toBeInTheDocument();
    expect(listbox?.querySelector('[role="status"]')).toBeNull();
    fireEvent.change(input, { target: { value: 'none' } });
    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining('status'));
  });

  it('aborts pending remote work and disposes overlays on unmount', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const view = render(<CgTagBox aria-label="Cleanup" loadOptions={(_query, context) => { signal = context.signal; return new Promise<ReadonlyArray<Customer>>(() => undefined); }} getOptionLabel={label} getOptionKey={key} searchDelay={10} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'pending' } });
    await act(() => vi.advanceTimersByTimeAsync(10));
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    expect(popupListbox()).not.toBeInTheDocument();
  });
});

describe('CgTagBox forms, state, and validation', () => {
  it('submits multiple stable keys and resets selection/query through an external form', async () => {
    const ref = createRef<HTMLInputElement>();
    const changed = vi.fn();
    render(<><form id="external" /><CgTagBox ref={ref} aria-label="External" form="external" name="customerIds" options={customers} defaultValue={[customers[0]!]} defaultSearchQuery="draft" onValueChange={changed} getOptionLabel={label} getOptionKey={key} required /></>);
    expect(ref.current).toBe(screen.getByRole('combobox'));
    fireEvent.change(ref.current!, { target: { value: 'Contoso' } });
    fireEvent.click(popupOption(label(customers[1]!)));
    expect(new FormData(document.getElementById('external') as HTMLFormElement).getAll('customerIds')).toEqual(['1', '2']);
    fireEvent.reset(document.getElementById('external') as HTMLFormElement);
    await act(async () => { await Promise.resolve(); });
    expect(ref.current).toHaveValue('draft');
    expect(new FormData(document.getElementById('external') as HTMLFormElement).getAll('customerIds')).toEqual(['1']);
    expect(changed).toHaveBeenLastCalledWith([customers[0]], expect.objectContaining({ reason: 'reset' }));
  });

  it('focuses the visible input on invalid submission and composes Field ARIA', () => {
    render(<form><CgField label="Required customers" description="Choose one" errorMessage="Selection required"><CgTagBox options={customers} getOptionLabel={label} getOptionKey={key} name="customerIds" required validationState="error" /></CgField><button type="submit">Submit</button></form>);
    const input = screen.getByRole('combobox', { name: 'Required customers' });
    fireEvent.submit(input.closest('form')!);
    const proxy = document.querySelector('[data-cg-tagbox-form-proxy]') as HTMLSelectElement;
    fireEvent.invalid(proxy);
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(expect.stringContaining('Choose one'));
  });

  it('suppresses disabled/read-only changes and supports custom renderers and RTL', () => {
    const changed = vi.fn();
    const { rerender } = render(<CgTagBox aria-label="States" options={customers} defaultValue={[customers[0]!]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} disabled direction="rtl" renderTag={({ item }) => <strong>{item.code}</strong>} />);
    const input = screen.getByRole('combobox');
    expect(input).toBeDisabled();
    expect(input.closest('[dir="rtl"]')).not.toBeNull();
    expect(screen.getByText('A-100')).toBeInTheDocument();
    rerender(<CgTagBox aria-label="States" options={customers} defaultValue={[customers[0]!]} onValueChange={changed} getOptionLabel={label} getOptionKey={key} readOnly />);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(popupListbox()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/u })).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it('validates sources, limits, and stable keys', () => {
    const neither = { getOptionLabel: label, getOptionKey: key } as CgTagBoxProps<Customer>;
    const both = { options: customers, loadOptions: () => [], getOptionLabel: label, getOptionKey: key } as unknown as CgTagBoxProps<Customer>;
    expect(() => render(<CgTagBox {...neither} />)).toThrow(/exactly one/u);
    expect(() => render(<CgTagBox {...both} />)).toThrow(/exactly one/u);
    expect(() => render(<CgTagBox options={customers} getOptionLabel={label} getOptionKey={key} searchDelay={-1} />)).toThrow(RangeError);
    expect(() => render(<CgTagBox options={customers} getOptionLabel={label} getOptionKey={key} minimumSearchLength={-1} />)).toThrow(RangeError);
    expect(() => render(<CgTagBox options={customers} getOptionLabel={label} getOptionKey={key} maxVisibleItems={0} />)).toThrow(RangeError);
    expect(() => render(<CgTagBox options={customers} getOptionLabel={label} getOptionKey={key} maxSelectedItems={0} />)).toThrow(RangeError);
    expect(() => render(<CgTagBox options={[customers[0]!, { ...customers[1]!, id: 1 }]} getOptionLabel={label} getOptionKey={key} />)).toThrow(/duplicate option key 1/u);
    expect(() => render(<CgTagBox options={[{ ...customers[0]!, id: Number.NaN }]} getOptionLabel={label} getOptionKey={key} />)).toThrow(/finite/u);
  });
});
