import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgListBox } from '../src';
import type { CgListBoxColumn } from '../src';

interface Warehouse { id: number; code: string; name: string; site: string; disabled?: boolean; }
const warehouses: Warehouse[] = [
  { id: 1, code: 'CAI-01', name: 'Cairo Main', site: 'Cairo' },
  { id: 2, code: 'CAI-02', name: 'Cairo Reserve', site: 'Cairo', disabled: true },
  { id: 3, code: 'GIZ-01', name: 'Giza Main', site: 'Giza' },
  { id: 4, code: 'ALX-01', name: 'Alexandria Port', site: 'Alexandria' },
  { id: 5, code: 'AR-01', name: 'أَحْمَد للتجارة', site: 'القاهرة' },
];
const key = (item: Warehouse) => item.id;
const label = (item: Warehouse) => `${item.code} - ${item.name}`;
const options = () => screen.getAllByRole('option');

describe('CgListBox selection', () => {
  it('supports uncontrolled single selection, Field naming, refs, native form values, and details', () => {
    const changed = vi.fn();
    const ref = createRef<HTMLDivElement>();
    render(<form data-testid="form"><CgField label="Warehouse"><CgListBox ref={ref} items={warehouses} getItemKey={key} getItemLabel={label} name="warehouse" onValueChange={changed} /></CgField></form>);
    const listbox = screen.getByRole('listbox', { name: 'Warehouse' });
    expect(ref.current).toBe(listbox);
    fireEvent.click(options()[2]!);
    expect(options()[2]).toHaveAttribute('aria-selected', 'true');
    expect(changed).toHaveBeenCalledWith([warehouses[2]], expect.objectContaining({ reason: 'pointer', previousValue: [], addedItems: [warehouses[2]], removedItems: [] }));
    expect(new FormData(screen.getByTestId('form')).get('warehouse')).toBe('3');
    fireEvent.click(options()[2]!);
    expect(changed).toHaveBeenCalledOnce();
  });

  it('keeps controlled values authoritative when a parent rejects a selection', () => {
    const changed = vi.fn();
    render(<CgListBox aria-label="Controlled" items={warehouses} value={[warehouses[0]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} />);
    fireEvent.click(options()[2]!);
    expect(changed).toHaveBeenCalledWith([warehouses[2]], expect.objectContaining({ removedItems: [warehouses[0]] }));
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(options()[2]).toHaveAttribute('aria-selected', 'false');
  });

  it('does not mark a required controlled list invalid when its parent rejects a deselection', () => {
    const changed = vi.fn();
    render(<CgListBox aria-label="Required controlled" items={warehouses} value={[warehouses[0]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} selectionMode="multiple" showCheckboxes required />);
    const listbox = screen.getByRole('listbox');
    fireEvent.click(options()[0]!);
    expect(changed).toHaveBeenCalledWith([], expect.objectContaining({ reason: 'pointer' }));
    expect(options()[0]).toHaveAttribute('aria-selected', 'true');
    expect(listbox).not.toHaveAttribute('aria-invalid');
  });

  it('implements replacement, Ctrl toggle, Shift range, additive range, and disabled skipping', () => {
    const changed = vi.fn();
    render(<CgListBox aria-label="Multiple" items={warehouses} defaultValue={[warehouses[4]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} isItemDisabled={(item) => Boolean(item.disabled)} selectionMode="multiple" />);
    fireEvent.click(options()[0]!);
    expect(changed).toHaveBeenLastCalledWith([warehouses[0]], expect.anything());
    fireEvent.click(options()[2]!, { ctrlKey: true });
    expect(changed).toHaveBeenLastCalledWith([warehouses[0], warehouses[2]], expect.anything());
    fireEvent.click(options()[4]!, { shiftKey: true });
    expect(changed).toHaveBeenLastCalledWith([warehouses[2], warehouses[3], warehouses[4]], expect.anything());
    fireEvent.click(options()[0]!, { ctrlKey: true, shiftKey: true });
    const selected = changed.mock.calls.at(-1)?.[0] as Warehouse[];
    expect(selected.map(key)).toEqual([3, 4, 5, 1]);
    expect(selected).not.toContain(warehouses[1]);
  });

  it('uses checkbox row toggling and filtered tri-state Select All while preserving hidden selection', () => {
    const changed = vi.fn();
    render(<CgListBox aria-label="Checkboxes" items={warehouses} defaultValue={[warehouses[3]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} getItemSearchText={(item) => `${item.name} ${item.site}`} isItemDisabled={(item) => Boolean(item.disabled)} selectionMode="multiple" showCheckboxes showSelectAll searchQuery="Cairo" />);
    const selectAll = screen.getByRole('checkbox', { name: 'Select all visible items' });
    expect(selectAll).not.toBeChecked();
    fireEvent.click(selectAll);
    const selected = changed.mock.calls.at(-1)?.[0] as Warehouse[];
    expect(selected.map(key)).toEqual([4, 1]);
    expect(selectAll).toBeChecked();
    fireEvent.click(options()[0]!);
    expect(selectAll).not.toBeChecked();
    expect(selectAll).not.toHaveAttribute('aria-checked', 'mixed');
  });

  it('suppresses disabled/read-only changes while retaining read-only focus navigation', () => {
    const changed = vi.fn();
    render(<><CgListBox aria-label="Read only" items={warehouses} defaultValue={[warehouses[0]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} readOnly /><CgListBox aria-label="Disabled" items={warehouses} getItemKey={key} getItemLabel={label} disabled /></>);
    const readonly = screen.getByRole('listbox', { name: 'Read only' });
    fireEvent.focus(readonly);
    fireEvent.keyDown(readonly, { key: 'ArrowDown' });
    expect(readonly).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-1'));
    fireEvent.keyDown(readonly, { key: 'Enter' });
    fireEvent.click(within(readonly).getAllByRole('option')[2]!);
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole('listbox', { name: 'Disabled' })).toHaveAttribute('tabindex', '-1');
  });
});

describe('CgListBox search and rendering', () => {
  it('debounces search, preserves IME, clears on Escape, and highlights safely', async () => {
    vi.useFakeTimers();
    const searchChanged = vi.fn();
    render(<CgListBox aria-label="Searchable" items={warehouses} getItemKey={key} getItemLabel={label} searchable searchDelay={50} onSearchQueryChange={searchChanged} />);
    const search = screen.getByRole('searchbox');
    fireEvent.compositionStart(search);
    fireEvent.change(search, { target: { value: 'Cairo' } });
    await act(() => vi.advanceTimersByTimeAsync(60));
    expect(searchChanged).not.toHaveBeenCalled();
    fireEvent.compositionEnd(search, { data: 'Cairo' });
    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(searchChanged).toHaveBeenCalledWith('Cairo');
    expect(options()).toHaveLength(2);
    expect(screen.getAllByText('Cairo', { selector: 'mark' })).not.toHaveLength(0);
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(searchChanged).toHaveBeenLastCalledWith('');
    expect(options()).toHaveLength(5);
  });

  it.each([
    ['allWords', 'Cairo Main', 1],
    ['anyWord', 'Cairo Giza', 3],
    ['exact', 'CAI-01 - Cairo Main', 1],
  ] as const)('supports %s parsing', (searchParseMode, searchQuery, count) => {
    render(<CgListBox aria-label="Parsed" items={warehouses} getItemKey={key} getItemLabel={label} searchQuery={searchQuery} searchParseMode={searchParseMode} searchCondition={searchParseMode === 'exact' ? 'equals' : 'contains'} />);
    expect(options()).toHaveLength(count);
  });

  it('applies application filtering before Arabic diacritic-insensitive search', () => {
    render(<CgListBox aria-label="Arabic" items={warehouses} getItemKey={key} getItemLabel={label} getItemSearchText={(item) => item.name} filterItem={(item) => item.id !== 3} searchQuery="احمد" locale="ar-EG" />);
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveAccessibleName(/أَحْمَد/u);
  });

  it('renders searchable columns, groups, cell templates, and group counts outside option indexing', () => {
    const cell = vi.fn(({ displayText }: { displayText: string }) => <strong>{displayText}</strong>);
    const columns: ReadonlyArray<CgListBoxColumn<Warehouse>> = [
      { key: 'code', header: 'Code', getValue: (item) => item.code, width: 100 },
      { key: 'name', header: 'Warehouse', getValue: (item) => item.name, renderCell: cell },
      { key: 'site', header: 'Site', getValue: (item) => item.site, searchable: false, alignment: 'end' },
    ];
    render(<CgListBox aria-label="Columns" items={warehouses} getItemKey={key} getItemLabel={label} columns={columns} getItemGroupKey={(item) => item.site} searchQuery="CAI" />);
    expect(screen.getByRole('listbox')).not.toContainElement(screen.getByText('Code'));
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    expect(options()).toHaveLength(2);
    expect(cell).toHaveBeenCalledWith(expect.objectContaining({ item: warehouses[0], visibleIndex: 0 }));
    expect(screen.getAllByText('Cairo')).toHaveLength(3);
  });

  it('keeps loading, empty, and no-result states outside listbox ownership', () => {
    const { rerender } = render(<CgListBox aria-label="States" items={warehouses} getItemKey={key} getItemLabel={label} loading />);
    expect(screen.getByRole('listbox')).not.toContainElement(screen.getByText('Loading…'));
    rerender(<CgListBox aria-label="States" items={[]} getItemKey={key} getItemLabel={label} />);
    expect(screen.getByRole('listbox')).not.toContainElement(screen.getByText('No data'));
    rerender(<CgListBox aria-label="States" items={warehouses} getItemKey={key} getItemLabel={label} searchQuery="missing" />);
    expect(screen.getByRole('listbox')).not.toContainElement(screen.getByText('No matching items'));
  });
});

describe('CgListBox keyboard, forms, and validation', () => {
  it('supports Home/End/Page navigation, range extension, Ctrl+A, Space, and active scrolling', () => {
    const changed = vi.fn();
    render(<CgListBox aria-label="Keyboard" items={warehouses} defaultValue={[]} onValueChange={changed} getItemKey={key} getItemLabel={label} isItemDisabled={(item) => Boolean(item.disabled)} selectionMode="multiple" showCheckboxes height={80} itemSize={40} />);
    const listbox = screen.getByRole('listbox');
    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(changed).toHaveBeenLastCalledWith([warehouses[4]], expect.objectContaining({ reason: 'keyboard' }));
    fireEvent.keyDown(listbox, { key: 'Home', shiftKey: true });
    expect((changed.mock.calls.at(-1)?.[0] as Warehouse[]).map(key)).toEqual([1, 3, 4, 5]);
    fireEvent.keyDown(listbox, { key: 'a', ctrlKey: true });
    expect((changed.mock.calls.at(-1)?.[0] as Warehouse[]).map(key)).toEqual([1, 3, 4, 5]);
  });

  it('renders a fixed virtual window and recovers an offscreen active option', async () => {
    const many = Array.from({ length: 100 }, (_, index) => ({ id: index, code: `W-${index}`, name: `Warehouse ${index}`, site: 'All' }));
    render(<CgListBox aria-label="Virtual" items={many} getItemKey={key} getItemLabel={label} renderMode="virtual" itemSize={32} overscanCount={1} height={96} />);
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option').length).toBeLessThan(100);
    fireEvent.focus(listbox);
    fireEvent.keyDown(listbox, { key: 'End' });
    await act(async () => Promise.resolve());
    expect(listbox).toHaveAttribute('aria-activedescendant', expect.stringContaining('option-99'));
    expect(document.getElementById(listbox.getAttribute('aria-activedescendant')!)).toBeInTheDocument();
  });

  it('submits multiple keys, resets selection and search through an external form, and preserves missing selected objects', async () => {
    const missing = { id: 99, code: 'OLD', name: 'Missing', site: 'Legacy' };
    const changed = vi.fn();
    const searchChanged = vi.fn();
    render(<><form id="external" /><CgListBox aria-label="External" form="external" name="warehouses" items={warehouses} defaultValue={[warehouses[0]!, missing]} onValueChange={changed} getItemKey={key} getItemLabel={label} selectionMode="multiple" searchable defaultSearchQuery="Cairo" onSearchQueryChange={searchChanged} /></>);
    expect(new FormData(document.getElementById('external') as HTMLFormElement).getAll('warehouses')).toEqual(['1', '99']);
    fireEvent.click(options()[0]!);
    fireEvent.reset(document.getElementById('external') as HTMLFormElement);
    await act(async () => Promise.resolve());
    expect(new FormData(document.getElementById('external') as HTMLFormElement).getAll('warehouses')).toEqual(['1', '99']);
    expect(changed).toHaveBeenLastCalledWith([warehouses[0], missing], expect.objectContaining({ reason: 'reset' }));
    expect(screen.getByRole('searchbox')).toHaveValue('Cairo');
    expect(searchChanged).toHaveBeenLastCalledWith('Cairo');
  });

  it('uses the form proxy for native required validity and focuses the visible listbox on invalid', () => {
    render(<form><CgListBox aria-label="Required list" items={warehouses} getItemKey={key} getItemLabel={label} required /><button type="submit">Submit</button></form>);
    const proxy = document.querySelector('[data-cg-listbox-form-proxy]') as HTMLSelectElement;
    expect(proxy.validity.valid).toBe(false);
    fireEvent.invalid(proxy);
    expect(screen.getByRole('listbox')).toHaveFocus();
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('adopts key-equivalent replacements without a callback and keeps disabled form values excluded', async () => {
    const changed = vi.fn();
    const replacement = warehouses.map((item) => ({ ...item, name: `${item.name} refreshed` }));
    const view = render(<form data-testid="replace-form"><CgListBox aria-label="Replace" items={warehouses} defaultValue={[warehouses[0]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} name="w" selectionMode="multiple" /></form>);
    view.rerender(<form data-testid="replace-form"><CgListBox aria-label="Replace" items={replacement} defaultValue={[warehouses[0]!]} onValueChange={changed} getItemKey={key} getItemLabel={label} name="w" selectionMode="multiple" /></form>);
    await act(async () => Promise.resolve());
    expect(changed).not.toHaveBeenCalled();
    expect(options()[0]).toHaveAccessibleName(/refreshed/u);
    view.rerender(<form data-testid="replace-form"><CgListBox aria-label="Replace" items={replacement} defaultValue={[warehouses[0]!]} getItemKey={key} getItemLabel={label} name="w" selectionMode="multiple" disabled /></form>);
    expect(new FormData(screen.getByTestId('replace-form')).getAll('w')).toEqual([]);
  });

  it('rejects duplicate keys, invalid selection/configuration, and invalid numeric inputs', () => {
    expect(() => render(<CgListBox items={[warehouses[0]!, { ...warehouses[1]!, id: 1 }]} getItemKey={key} getItemLabel={label} />)).toThrow(/duplicate item key 1/u);
    expect(() => render(<CgListBox items={warehouses} value={[warehouses[0]!, warehouses[2]!]} getItemKey={key} getItemLabel={label} />)).toThrow(/at most one/u);
    expect(() => render(<CgListBox items={warehouses} getItemKey={key} getItemLabel={label} showSelectAll />)).toThrow(/requires multiple selection/u);
    expect(() => render(<CgListBox items={warehouses} getItemKey={key} getItemLabel={label} searchDelay={-1} />)).toThrow(RangeError);
    expect(() => render(<CgListBox items={warehouses} getItemKey={key} getItemLabel={label} itemSize={0} />)).toThrow(RangeError);
    expect(() => render(<CgListBox items={warehouses} getItemKey={key} getItemLabel={label} overscanCount={-1} />)).toThrow(RangeError);
    expect(() => render(<CgListBox items={warehouses} getItemKey={key} getItemLabel={label} columns={[{ key: 'x', getValue: key }, { key: 'x', getValue: label }]} />)).toThrow(/duplicate column key/u);
  });
});
