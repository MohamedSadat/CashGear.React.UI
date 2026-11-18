import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgDateRangePicker, CgGrid, CgLoadingPanel, CgPivotTable, CgRadioGroup, CgTagBox, CgTextBox, CgTreeList } from '../src';
import type { CgGridActions, CgGridColumnDescriptor, CgPivotField, CgTreeListColumn, CgTreeListParentKey } from '../src';

interface Row { readonly id: number; readonly name: string; readonly amount: number }
const source: ReadonlyArray<Row> = [{ id: 1, name: 'Alpha', amount: 10 }, { id: 2, name: 'Beta', amount: 20 }];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
  { type: 'text', fieldId: 'name', title: 'Name', accessor: (row) => row.name, editor: { kind: 'text', setValue: (row, value) => ({ ...row, name: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount },
];

describe('Grid additions', () => {
  it('adds the row class a host selects for each data row', () => {
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} rowClassName={(row) => row.amount > 15 ? 'large-amount' : undefined} />);
    expect(container.querySelector('[data-row-key="number:2"]')).toHaveClass('large-amount');
    expect(container.querySelector('[data-row-key="number:2"]')).toHaveAttribute('data-cg-grid-row-custom', 'true');
    expect(container.querySelector('[data-row-key="number:1"]')).not.toHaveAttribute('data-cg-grid-row-custom');
  });

  it('commits a cell editor when focus leaves it, and not without the option', async () => {
    for (const commitOnFocusOut of [true, false]) {
      const update = vi.fn(async () => ({ succeeded: true as const }));
      const view = render(<><CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false}
        editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, commitOnFocusOut, editModelFactory: (row) => ({ ...row }), updateItem: update }} /><button type="button">Outside</button></>);
      const cell = view.container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
      cell.focus(); fireEvent.keyDown(cell, { key: 'F2' });
      await waitFor(() => expect(cell.querySelector('input')).not.toBeNull());
      const editor = cell.querySelector<HTMLInputElement>('input')!;
      fireEvent.change(editor, { target: { value: 'Alpha 2' } });
      const outside = screen.getByRole('button', { name: 'Outside' });
      await act(async () => { outside.focus(); fireEvent.blur(editor, { relatedTarget: outside }); await new Promise((resolve) => setTimeout(resolve, 10)); });
      if (commitOnFocusOut) await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ editModel: expect.objectContaining({ name: 'Alpha 2' }) }), expect.anything()));
      else expect(update).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('announces column moves and resizes', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} actionsRef={actions} labels={{ columnResizedAnnouncement: '{0} is now {1} px wide.' }} />);
    const status = container.querySelector('[data-cg-grid-layout-status]')!;
    expect(status).toHaveAttribute('role', 'status');
    await act(async () => { await actions.current?.moveColumn('amount', 0); });
    expect(status).toHaveTextContent('Amount moved to position 1.');
    await act(async () => { await actions.current?.resizeColumn('name', 210.4); });
    expect(status).toHaveTextContent('Name is now 210 px wide.');
  });
});

interface Account { id: number; parent: number | null; name: string }
const accounts: ReadonlyArray<Account> = [{ id: 1, parent: null, name: 'Assets' }, { id: 2, parent: 1, name: 'Cash' }];
const treeColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [{ type: 'text', fieldId: 'name', title: 'Account', hierarchy: true, getValue: (item) => item.name }];

describe('TreeList additions', () => {
  it('sets the indent per level and renders a toolbar', () => {
    const { container } = render(<CgTreeList data={accounts} columns={treeColumns} getKey={(item) => item.id}
      getParentKey={(item): CgTreeListParentKey<number> => item.parent === null ? { kind: 'none' } : { kind: 'key', key: item.parent }}
      indentSize="2rem" toolbar={<button type="button">New account</button>} />);
    const root = container.querySelector<HTMLElement>('[data-cg-tree-list]')!;
    expect(root.style.getPropertyValue('--cg-tree-list-indent')).toBe('2rem');
    expect(container.querySelector('[data-cg-tree-list-toolbar]')).toContainElement(screen.getByRole('button', { name: 'New account' }));
  });
});

describe('LoadingPanel additions', () => {
  it('places text, drops the frame, sizes and stacks the panel', () => {
    render(<CgLoadingPanel visible mode="overlay" textAlignment="bottom" indicatorAreaVisible={false} size="large" zIndex={4200} text="Posting…"><p>Body</p></CgLoadingPanel>);
    const panel = screen.getByRole('status');
    const area = panel.querySelector<HTMLElement>('[data-cg-loading-indicator-area]')!;
    expect(area).toHaveAttribute('data-text-alignment', 'bottom');
    expect(area.className).toMatch(/frameless/);
    expect(panel).toHaveAttribute('data-size', 'large');
    expect(panel.style.zIndex).toBe('4200');
  });

  it('rejects an invalid z-index and alignment', () => {
    expect(() => render(<CgLoadingPanel visible zIndex={0} />)).toThrow(/zIndex/);
    expect(() => render(<CgLoadingPanel visible textAlignment={'left' as never} />)).toThrow(/textAlignment/);
  });
});

describe('TagBox hideSelectedItems', () => {
  it('leaves selected items out of the list', async () => {
    const options = ['Red', 'Green', 'Blue'];
    render(<CgTagBox options={options} getOptionKey={(option) => option} getOptionLabel={(option) => option} defaultValue={['Green']} hideSelectedItems aria-label="Colours" />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Colours' }), { key: 'ArrowDown' });
    await waitFor(() => expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0));
    const offered = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent);
    expect(offered.some((text) => text?.includes('Red'))).toBe(true);
    expect(offered.some((text) => text?.includes('Blue'))).toBe(true);
    expect(offered.some((text) => text?.includes('Green'))).toBe(false);
  });
});

describe('DateRangePicker additions', () => {
  it('keeps the text read-only without text input but still opens from the keyboard', async () => {
    const change = vi.fn();
    render(<CgDateRangePicker aria-label="Period" allowTextInput={false} placement="top-start" onValueChange={change} />);
    const input = screen.getByRole('combobox', { name: 'Period' });
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-readonly', 'true');
    fireEvent.change(input, { target: { value: '01/01/2026 – 01/02/2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).not.toBeNull());
  });
});

describe('RadioGroup item layout', () => {
  it('passes label position, alignment and wrapping to each item', () => {
    const { container } = render(<CgRadioGroup aria-label="Status" options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }]} itemLabelPosition="start" itemAlignment="end" itemLabelWrap={false} />);
    const items = container.querySelectorAll('label');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item).toHaveAttribute('data-position', 'start');
      expect(item).toHaveAttribute('data-align', 'end');
      expect(item).toHaveAttribute('data-label-wrap', 'false');
    }
  });
});

describe('Editor button descriptors', () => {
  it('renders links, unfocusable and form buttons with their own classes', async () => {
    const press = vi.fn();
    render(<form><CgTextBox aria-label="Invoice" buttons={[
      { key: 'open', ariaLabel: 'Open invoice', text: 'Open', href: '/invoices/7', target: '_blank', className: 'open-link', onPress: press },
      { key: 'closed', ariaLabel: 'Closed link', href: '/x', disabled: true },
      { key: 'skip', ariaLabel: 'Pick', focusable: false },
      { key: 'send', ariaLabel: 'Send', type: 'submit' },
    ]} /></form>);
    const link = screen.getByRole('link', { name: 'Open invoice' });
    expect(link).toHaveAttribute('href', '/invoices/7');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('open-link');
    fireEvent.click(link);
    await waitFor(() => expect(press).toHaveBeenCalledOnce());
    const disabled = screen.getByRole('link', { name: 'Closed link' });
    expect(disabled).not.toHaveAttribute('href');
    expect(disabled).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Pick' })).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Send' })).toHaveAttribute('type', 'submit');
  });

  it('refuses unsafe link schemes', () => {
    expect(() => render(<CgTextBox aria-label="Bad" buttons={[{ key: 'x', ariaLabel: 'X', href: 'javascript:alert(1)' }]} />)).toThrow(/unsafe/);
  });
});

describe('PivotTable column headers', () => {
  it('shows no grand-total label above the measures when there are no column fields', async () => {
    const fields: ReadonlyArray<CgPivotField<{ region: string; value: string }>> = [
      { key: 'region', caption: 'Region', valueType: 'text', area: 'row', getValue: (row) => row.region },
      { key: 'value', caption: 'Revenue', valueType: 'decimal', area: 'data', getValue: (row) => row.value },
    ];
    render(<CgPivotTable data={[{ region: 'East', value: '1' }]} fields={fields} />);
    await waitFor(() => expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'false'));
    const header = screen.getAllByRole('columnheader').find((element) => element.textContent?.includes('Revenue'))!;
    expect(header.textContent).toBe('Revenue');
    expect(screen.getAllByRole('rowheader').some((element) => /Grand Total/.test(element.textContent ?? ''))).toBe(true);
  });
});
