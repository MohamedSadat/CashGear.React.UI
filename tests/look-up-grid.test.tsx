import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgFormLayout, CgFormLayoutItem, CgLookUpGrid } from '../src';
import type {
  CgLookUpGridActions,
  CgLookUpGridColumnDescriptor,
  CgLookUpGridDataLoader,
  CgLookUpGridProps,
  CgLookUpGridQuery,
} from '../src';

interface Item {
  id: number;
  code: string;
  name: string;
  quantity: number;
  enabled?: boolean;
}

const items: Item[] = [
  { id: 1, code: 'A-100', name: 'Alpha Shaft', quantity: 9, enabled: true },
  { id: 2, code: 'B-200', name: 'أَحْمَد Gear', quantity: 2, enabled: false },
  { id: 3, code: 'C-300', name: 'Gamma Bolt', quantity: 15, enabled: true },
  { id: 4, code: 'D-400', name: 'Delta Nut', quantity: 5, enabled: true },
];

const columns: ReadonlyArray<CgLookUpGridColumnDescriptor<Item>> = [
  { fieldId: 'code', title: 'Code', accessor: (item) => item.code, width: 100 },
  { fieldId: 'name', title: 'Description', accessor: (item) => item.name },
  { fieldId: 'quantity', title: 'Qty', accessor: (item) => item.quantity, alignment: 'end', formatValue: (value) => `${Number(value)} pcs` },
];

const base = {
  data: items,
  columns,
  valueSelector: (item: Item) => item.id,
  textSelector: (item: Item) => `${item.code} — ${item.name}`,
} satisfies CgLookUpGridProps<Item, number>;

function dataRows(): HTMLElement[] {
  return screen.getAllByRole('row', { hidden: true }).filter((row) => row.id.includes('-row-'));
}

describe('CgLookUpGrid', () => {
  it('renders descriptor order, widths, alignment, formatting, and custom cells', async () => {
    const customColumns: ReadonlyArray<CgLookUpGridColumnDescriptor<Item>> = [
      columns[1]!,
      { ...columns[0]!, renderCell: ({ text }) => <strong>{text}</strong> },
      columns[2]!,
    ];
    render(<CgLookUpGrid {...base} columns={customColumns} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(screen.getByRole('grid', { hidden: true })).toBeInTheDocument());
    expect(screen.getAllByRole('columnheader', { hidden: true }).map((header) => header.textContent)).toEqual(['Description', 'Code', 'Qty']);
    expect(screen.getAllByRole('columnheader', { hidden: true })[1]).toHaveStyle({ width: '100px' });
    expect(screen.getByText('A-100', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('9 pcs')).toHaveAttribute('data-align', 'end');
  });

  it('validates sources, columns, numeric settings, and initial sort', () => {
    const noSource = { columns, valueSelector: base.valueSelector, textSelector: base.textSelector } as unknown as CgLookUpGridProps<Item, number>;
    expect(() => render(<CgLookUpGrid {...noSource} />)).toThrow(/exactly one data source/u);
    const both = { ...base, dataLoader: async () => ({ items: [] }) } as unknown as CgLookUpGridProps<Item, number>;
    expect(() => render(<CgLookUpGrid {...both} />)).toThrow(/exactly one data source/u);
    expect(() => render(<CgLookUpGrid {...base} columns={[columns[0]!, columns[0]!]} />)).toThrow(/duplicate column/u);
    expect(() => render(<CgLookUpGrid {...base} columns={[{ fieldId: 'missing', title: 'Missing' }]} />)).toThrow(/requires an accessor/u);
    expect(() => render(<CgLookUpGrid {...base} pageSize={0} />)).toThrow(RangeError);
    expect(() => render(<CgLookUpGrid {...base} searchDebounceMilliseconds={-1} />)).toThrow(RangeError);
    expect(() => render(<CgLookUpGrid {...base} rowHeight={-1} />)).toThrow(RangeError);
    expect(() => render(<CgLookUpGrid {...base} dropDownWidth={-1} />)).toThrow(RangeError);
    expect(() => render(<CgLookUpGrid {...base} initialSort="unknown asc" />)).toThrow(/unavailable sortable field/u);
    expect(() => render(<CgLookUpGrid {...base} initialSort="code sideways" />)).toThrow(/direction/u);
    expect(() => render(<CgLookUpGrid {...base} initialSort={{ fieldId: 'code', direction: 'sideways' as 'ascending' }} />)).toThrow(/direction/u);
    expect(() => render(<CgLookUpGrid {...base} columns={[{ fieldId: 'hidden', title: 'Hidden', visible: false }]} />)).not.toThrow();
    expect(() => render(<CgLookUpGrid {...({ ...base, data: {} } as unknown as CgLookUpGridProps<Item, number>)} />)).toThrow(/data must be an array/u);
  });

  it('skips null rows and accepts duplicate selected keys', async () => {
    render(<CgLookUpGrid {...base} data={[items[0], null, { ...items[1]!, id: 1 }, undefined]} defaultValue={1} />);
    expect(screen.getByRole('combobox')).toHaveValue(base.textSelector(items[0]!));
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    expect(dataRows()).toHaveLength(2);
    expect(dataRows().every((row) => row.getAttribute('aria-selected') === 'true')).toBe(true);
  });

  it('uses null and blank strings as empty while preserving numeric zero', () => {
    const zero = { id: 0, code: 'ZERO', name: 'Zero', quantity: 0 };
    const { rerender } = render(<CgLookUpGrid {...base} data={[zero]} value={0} />);
    expect(screen.getByRole('combobox')).toHaveValue('ZERO — Zero');
    rerender(<CgLookUpGrid data={[{ ...zero, code: 'BLANK' }]} columns={columns} valueSelector={(item) => String(item.id)} textSelector={base.textSelector} value="   " />);
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('supports uncontrolled selection, callback order, clearing, and form serialization', async () => {
    const order: string[] = [];
    render(
      <form data-testid="form">
        <CgLookUpGrid
          {...base}
          name="itemId"
          onValueChange={() => order.push('value')}
          onSelectedItemChange={() => order.push('item')}
          onItemSelect={() => order.push('select')}
          onClear={() => order.push('clear')}
        />
      </form>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.click(dataRows()[1]!);
    await waitFor(() => expect(order).toEqual(['value', 'item', 'select']));
    expect(new FormData(screen.getByTestId('form')).get('itemId')).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(order).toEqual(['value', 'item', 'select', 'value', 'item', 'clear']);
    expect(new FormData(screen.getByTestId('form')).get('itemId')).toBeNull();
  });

  it('reconciles a parent-rejected value and recovers from a throwing callback', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const thrower = vi.fn(() => { throw new Error('consumer'); });
    const first = render(<CgLookUpGrid {...base} value={1} onValueChange={() => undefined} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.click(dataRows()[2]!);
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(base.textSelector(items[0]!)));

    first.unmount();
    render(<CgLookUpGrid {...base} defaultValue={1} onValueChange={thrower} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.click(dataRows()[2]!);
    expect(screen.getByRole('combobox')).toHaveValue(base.textSelector(items[0]!));
    await waitFor(() => expect(thrower).toHaveBeenCalledOnce());
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining('rolled back'), expect.any(Error)));
    error.mockRestore();
  });

  it('resolves selected items locally, from the parent, and asynchronously without opening', async () => {
    const resolver = vi.fn(async () => items[2]);
    const { rerender } = render(<CgLookUpGrid {...base} value={3} data={[]} itemResolver={resolver} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(base.textSelector(items[2]!)));
    expect(resolver).toHaveBeenCalledOnce();
    rerender(<CgLookUpGrid {...base} value={3} data={[]} itemResolver={() => Promise.resolve(items[0])} />);
    await act(async () => Promise.resolve());
    expect(resolver).toHaveBeenCalledOnce();
    rerender(<CgLookUpGrid {...base} value={2} data={[]} selectedItem={items[1]} itemResolver={resolver} />);
    expect(screen.getByRole('combobox')).toHaveValue(base.textSelector(items[1]!));
  });

  it('keeps unresolved keys and ignores stale resolver work', async () => {
    const signals: AbortSignal[] = [];
    let resolve!: (item: Item | null) => void;
    const resolver = vi.fn((_value: number, context: { signal: AbortSignal }) => new Promise<Item | null>((next) => { signals.push(context.signal); resolve = next; }));
    const { rerender } = render(<CgLookUpGrid {...base} data={[]} value={99} itemResolver={resolver} />);
    expect(screen.getByRole('combobox')).toHaveValue('99');
    rerender(<CgLookUpGrid {...base} data={[]} value={3} itemResolver={resolver} />);
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => resolve(items[0]!));
    expect(screen.getByRole('combobox')).toHaveValue('3');
  });

  it('preserves resolver failures and retries a distinct key only after reload', async () => {
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    const resolver = vi.fn(() => Promise.reject(new Error('not found')));
    render(<CgLookUpGrid {...base} data={[]} value={404} itemResolver={resolver} actionsRef={actions} />);
    await waitFor(() => expect(resolver).toHaveBeenCalledOnce());
    expect(screen.getByRole('combobox')).toHaveValue('404');
    await act(async () => actions.current!.reload());
    await waitFor(() => expect(resolver).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('combobox')).toHaveValue('404');
  });

  it('searches visible searchable formatted text with Arabic folding and whitespace normalization', async () => {
    render(<CgLookUpGrid {...base} searchDebounceMilliseconds={0} locale="ar-EG" />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: '  احمد   Gear ' } });
    await waitFor(() => expect(dataRows()).toHaveLength(1));
    expect(dataRows()[0]).toHaveTextContent('B-200');
    fireEvent.change(input, { target: { value: '15 pcs' } });
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('C-300'));
  });

  it('excludes hidden and unsearchable columns', async () => {
    render(<CgLookUpGrid {...base} columns={[columns[0]!, { ...columns[1]!, visible: false }, { ...columns[2]!, searchable: false }]} searchDebounceMilliseconds={0} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Gamma' } });
    expect(await screen.findByText('No results found')).toBeInTheDocument();
    expect(dataRows()).toHaveLength(0);
  });

  it('does not fold Arabic or Latin diacritics when ignoreDiacritics is false', async () => {
    render(<CgLookUpGrid {...base} ignoreDiacritics={false} searchDebounceMilliseconds={0} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'احمد Gear' } });
    expect(await screen.findByText('No results found')).toBeInTheDocument();
  });

  it('combines global OR search with AND formatted column filters and persists filters', async () => {
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    render(<CgLookUpGrid {...base} actionsRef={actions} showFilterRow searchDebounceMilliseconds={0} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    await act(() => actions.current!.setColumnFilter('quantity', '5 pcs'));
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Delta' } });
    await waitFor(() => expect(dataRows()).toHaveLength(1));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('combobox'));
    expect(actions.current?.getColumnFilters()).toEqual({ quantity: '5 pcs' });
  });

  it('removes filters when a filtered column disappears and validates action fields', async () => {
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    const changed = vi.fn();
    const { rerender } = render(<CgLookUpGrid {...base} actionsRef={actions} onColumnFiltersChange={changed} />);
    await expect(actions.current!.setColumnFilter('missing', 'x')).rejects.toThrow(/cannot filter/u);
    await act(() => actions.current!.setColumnFilter('name', 'Alpha'));
    rerender(<CgLookUpGrid {...base} actionsRef={actions} columns={[columns[0]!, { ...columns[1]!, visible: false }, columns[2]!]} onColumnFiltersChange={changed} />);
    await waitFor(() => expect(actions.current?.getColumnFilters()).toEqual({}));
    expect(changed).toHaveBeenLastCalledWith({}, expect.objectContaining({ reason: 'columnRemoved' }));
  });

  it('debounces server queries, sends immutable snapshots, and rejects stale results', async () => {
    vi.useFakeTimers();
    const requests: Array<{ query: CgLookUpGridQuery<{ warehouse: string }>; resolve: (value: { items: Item[]; totalCount: number }) => void; signal: AbortSignal }> = [];
    const loader: CgLookUpGridDataLoader<Item, { warehouse: string }> = (query, { signal }) => new Promise((resolve) => requests.push({ query, resolve, signal }));
    render(<CgLookUpGrid dataLoader={loader} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} queryContext={{ warehouse: 'MAIN' }} searchDebounceMilliseconds={40} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Al' } });
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(requests).toHaveLength(1);
    expect(requests[0]!.query).toMatchObject({ searchText: 'Al', searchFields: ['code', 'name', 'quantity'], skip: 0, take: 50, queryContext: { warehouse: 'MAIN' } });
    expect(Object.isFrozen(requests[0]!.query)).toBe(true);
    fireEvent.change(input, { target: { value: 'Ga' } });
    await act(() => vi.advanceTimersByTimeAsync(40));
    expect(requests[0]!.signal.aborted).toBe(true);
    await act(async () => requests[0]!.resolve({ items: [items[0]!], totalCount: 1 }));
    await act(async () => requests[1]!.resolve({ items: [items[2]!], totalCount: 1 }));
    expect(dataRows()[0]).toHaveTextContent('C-300');
  });

  it('adopts fresh loader identities, compares query contexts structurally, and aborts on unmount', async () => {
    const load: CgLookUpGridDataLoader<Item, { warehouse: string }> = vi.fn(() => Promise.resolve({ items, totalCount: items.length }));
    const equalContext = (left: { warehouse: string }, right: { warehouse: string }) => left.warehouse === right.warehouse;
    const { rerender, unmount } = render(
      <CgLookUpGrid dataLoader={load} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} defaultOpen queryContext={{ warehouse: 'MAIN' }} isQueryContextEqual={equalContext} />,
    );
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    rerender(<CgLookUpGrid dataLoader={(query, context) => load(query, context)} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} defaultOpen queryContext={{ warehouse: 'MAIN' }} isQueryContextEqual={equalContext} />);
    await act(async () => Promise.resolve());
    expect(load).toHaveBeenCalledOnce();
    rerender(<CgLookUpGrid dataLoader={(query, context) => load(query, context)} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} defaultOpen queryContext={{ warehouse: 'WEST' }} isQueryContextEqual={equalContext} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(load).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 0, queryContext: { warehouse: 'WEST' } }), expect.anything());
    unmount();

    let signal: AbortSignal | undefined;
    const pending = render(<CgLookUpGrid dataLoader={(_query, context) => { signal = context.signal; return new Promise(() => undefined); }} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} defaultOpen />);
    await waitFor(() => expect(signal).toBeDefined());
    pending.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('suspends short nonempty searches but allows an empty initial query', async () => {
    const load = vi.fn(async () => ({ items, totalCount: items.length }));
    render(<CgLookUpGrid dataLoader={load} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} minimumSearchLength={3} searchDebounceMilliseconds={0} value={1} />);
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    await waitFor(() => expect(load).toHaveBeenCalledWith(expect.objectContaining({ searchText: null }), expect.anything()));
    expect(input).toHaveValue(base.textSelector(items[0]!));
    fireEvent.change(input, { target: { value: 'ab' } });
    await waitFor(() => expect(screen.getByText(/at least 3/u)).toBeInTheDocument());
    expect(load).toHaveBeenCalledOnce();
  });

  it('appends local and server pages and handles unknown totals', async () => {
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    const { rerender } = render(<CgLookUpGrid {...base} actionsRef={actions} pageSize={2} />);
    await act(() => actions.current!.open());
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    await act(() => actions.current!.loadMore());
    expect(dataRows()).toHaveLength(4);
    expect(actions.current?.hasMoreRows()).toBe(false);

    const loader = vi.fn(async (query: CgLookUpGridQuery) => ({ items: items.slice(query.skip, query.skip + query.take) }));
    rerender(<CgLookUpGrid dataLoader={loader} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} actionsRef={actions} pageSize={2} />);
    await act(() => actions.current!.reload());
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    await act(() => actions.current!.loadMore());
    expect(loader).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 2, take: 2 }), expect.anything());
    expect(dataRows()).toHaveLength(4);
  });

  it('uses pageSize as a hard cap without paging and serializes concurrent load-more requests', async () => {
    const localActions = createRef<CgLookUpGridActions<Item, number>>();
    const local = render(<CgLookUpGrid {...base} actionsRef={localActions} pageSize={2} allowPaging={false} />);
    await act(() => localActions.current!.open());
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    expect(localActions.current?.hasMoreRows()).toBe(false);
    await act(() => localActions.current!.loadMore());
    expect(dataRows()).toHaveLength(2);
    local.unmount();

    let resolveMore!: (result: { items: Item[] }) => void;
    const loader = vi.fn((query: CgLookUpGridQuery) => query.skip === 0
      ? Promise.resolve({ items: items.slice(0, 2) })
      : new Promise<{ items: Item[] }>((resolve) => { resolveMore = resolve; }));
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    render(<CgLookUpGrid dataLoader={loader} columns={columns} valueSelector={base.valueSelector} textSelector={base.textSelector} actionsRef={actions} defaultOpen pageSize={2} />);
    await waitFor(() => expect(dataRows()).toHaveLength(2));
    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = actions.current!.loadMore();
      second = actions.current!.loadMore();
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(2);
    await act(async () => { resolveMore({ items: items.slice(2, 4) }); await first; await second; });
    expect(dataRows()).toHaveLength(4);
  });

  it('applies a stable initial sort and cycles headers and Ctrl+Arrow', async () => {
    const changed = vi.fn();
    render(<CgLookUpGrid {...base} initialSort="quantity desc" onSortChange={changed} />);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(dataRows()[0]).toHaveTextContent('C-300'));
    const codeHeader = screen.getAllByRole('columnheader', { hidden: true })[0]!;
    fireEvent.click(codeHeader.querySelector('button')!);
    expect(codeHeader).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(codeHeader.querySelector('button')!);
    expect(codeHeader).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(codeHeader.querySelector('button')!);
    expect(codeHeader).toHaveAttribute('aria-sort', 'none');
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown', ctrlKey: true });
    expect(changed).toHaveBeenLastCalledWith(expect.objectContaining({ fieldId: 'code', direction: 'ascending' }), expect.anything());
  });

  it('skips disabled rows for navigation and refuses click and Enter', async () => {
    const selected = vi.fn();
    render(<CgLookUpGrid {...base} rowDisabledSelector={(item) => !item.enabled} onItemSelect={selected} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', dataRows()[2]!.id);
    fireEvent.click(dataRows()[1]!);
    expect(selected).not.toHaveBeenCalled();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('leaves no active descendant when every row is disabled', async () => {
    const selected = vi.fn();
    render(<CgLookUpGrid {...base} rowDisabledSelector={() => true} onItemSelect={selected} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    expect(input).not.toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(selected).not.toHaveBeenCalled();
  });

  it('keeps focus on the input, commits with Enter/Tab, and restores on Escape', async () => {
    render(<CgLookUpGrid {...base} defaultValue={1} />);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(input).toHaveAttribute('aria-activedescendant'));
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: 'Gamma' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue(base.textSelector(items[0]!));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'true'));
    fireEvent.keyDown(input, { key: 'End' });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input).toHaveValue(base.textSelector(items[3]!)));
  });

  it('clamps page navigation, commits with Tab, clears only an untouched draft, and never submits on Enter', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const changed = vi.fn();
    render(<form onSubmit={submit}><CgLookUpGrid {...base} onValueChange={changed} /><button>After</button></form>);
    const input = screen.getByRole('combobox');
    input.focus();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(input).toHaveAttribute('aria-activedescendant', dataRows()[3]!.id);
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(input).toHaveAttribute('aria-activedescendant', dataRows()[0]!.id);
    fireEvent.keyDown(input, { key: 'Tab' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith(1, expect.objectContaining({ reason: 'select' })));

    fireEvent.change(input, { target: { value: 'replacement' } });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(changed).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'Backspace' });
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith(null, expect.objectContaining({ reason: 'clear' })));
  });

  it('uses lookup-specific filter Tab traversal and never submits from filters', async () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={submit}><CgLookUpGrid {...base} showFilterRow /><button>After</button></form>);
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    await waitFor(() => expect(screen.getAllByRole('textbox', { hidden: true }).length).toBeGreaterThan(1));
    fireEvent.keyDown(input, { key: 'Tab' });
    const filters = screen.getAllByRole('textbox', { hidden: true }).filter((element) => element.hasAttribute('data-cg-lookupgrid-filter'));
    expect(filters[0]).toHaveFocus();
    fireEvent.keyDown(filters[0]!, { key: 'Enter' });
    expect(submit).not.toHaveBeenCalled();
    fireEvent.keyDown(filters[0]!, { key: 'Escape' });
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('renders valid combobox/grid ownership with status siblings', async () => {
    render(<CgLookUpGrid {...base} data={[]} />);
    const input = screen.getByRole('combobox');
    expect(input).not.toHaveAttribute('aria-controls');
    fireEvent.click(input);
    const grid = await screen.findByRole('grid', { hidden: true });
    expect(input).toHaveAttribute('aria-controls', grid.id);
    expect(grid.querySelector('[role="status"]')).toBeNull();
    expect(screen.getByText('No results found').parentElement).toBe(grid.parentElement);
    expect(grid.querySelector('[role="rowgroup"]')).toBeInTheDocument();
  });

  it('integrates field/FormLayout naming, validation, reset, and custom serialization', async () => {
    const changed = vi.fn();
    render(
      <form data-testid="form">
        <CgFormLayout>
          <CgFormLayoutItem caption="Inventory item">
            <CgField label="Inventory item" validationState="error" validationMessage="Required">
              <CgLookUpGrid {...base} defaultValue={1} name="item" required onValueChange={changed} />
            </CgField>
          </CgFormLayoutItem>
        </CgFormLayout>
      </form>,
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveAccessibleName('Inventory item');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.click(input);
    await waitFor(() => expect(dataRows()).toHaveLength(4));
    fireEvent.click(dataRows()[2]!);
    fireEvent.reset(screen.getByTestId('form'));
    await act(async () => Promise.resolve());
    expect(input).toHaveValue(base.textSelector(items[0]!));
    expect(changed).toHaveBeenLastCalledWith(1, expect.objectContaining({ reason: 'reset' }));
  });

  it('closes before View All, preserves the value, and exposes actions', async () => {
    const actions = createRef<CgLookUpGridActions<Item, number>>();
    const viewAll = vi.fn();
    render(<CgLookUpGrid {...base} defaultValue={1} actionsRef={actions} onViewAllRequest={viewAll} />);
    await act(() => actions.current!.open());
    await waitFor(() => expect(screen.getByText('View all')).toBeInTheDocument());
    fireEvent.click(screen.getByText('View all').closest('button')!);
    await waitFor(() => expect(viewAll).toHaveBeenCalledWith(null, expect.anything()));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    expect(actions.current?.getLoadedItems()).toHaveLength(4);
  });

  it('supports controlled popup state and SSR without browser-only APIs', () => {
    function Controlled() {
      const [open, setOpen] = useState(false);
      return <CgLookUpGrid {...base} open={open} onOpenChange={setOpen} />;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    expect(() => renderToString(<CgLookUpGrid {...base} />)).not.toThrow();
  });

  it('reconciles when a controlled parent rejects an open proposal', () => {
    const proposed = vi.fn();
    render(<CgLookUpGrid {...base} open={false} onOpenChange={proposed} />);
    const input = screen.getByRole('combobox');
    fireEvent.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(input);
    expect(proposed).toHaveBeenCalledTimes(2);
  });
});
