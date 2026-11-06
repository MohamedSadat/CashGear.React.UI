import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CG_PIVOT_FIELD_LIST_VALUES_KEY, CgPivotFieldList } from '../../index';
import type { CgPivotFieldListArea, CgPivotFieldListChange, CgPivotFieldListField, CgPivotFieldListLayout, CgPivotFieldListProps } from '../../index';

const fields: ReadonlyArray<CgPivotFieldListField> = [
  { key: 'region', caption: 'Region' },
  { key: 'product', caption: 'Product' },
  { key: 'date', caption: 'Date' },
  { key: 'sales', caption: 'Sales', defaultArea: 'values' },
  { key: 'units', caption: 'Units', defaultArea: 'values' },
];
const base: CgPivotFieldListLayout = {
  filters: [{ id: 'f-product', fieldKey: 'product' }],
  columns: [{ id: 'sigma', fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY }],
  rows: [{ id: 'r-region', fieldKey: 'region' }, { id: 'r-date', fieldKey: 'date' }],
  values: [{ id: 'v-sales', fieldKey: 'sales', caption: 'Sum of Sales' }, { id: 'v-units', fieldKey: 'units', caption: 'Sum of Units' }],
};
const empty: CgPivotFieldListLayout = { filters: [], columns: [], rows: [], values: [] };

type HarnessProps = Partial<Omit<CgPivotFieldListProps, 'layout'>> & { initial?: CgPivotFieldListLayout; spy?: (next: CgPivotFieldListLayout, change: CgPivotFieldListChange) => void };
function Harness({ initial = base, spy, ...props }: HarnessProps) {
  const [layout, setLayout] = useState(initial);
  return <CgPivotFieldList fields={fields} layout={layout} onLayoutChange={(next, change) => { spy?.(next, change); setLayout(next); }} getValueCaption={(field) => `Sum of ${field.caption}`} {...props} />;
}

const area = (name: string) => screen.getByRole('listbox', { name });
const itemsOf = (name: string) => within(area(name)).queryAllByRole('option').map((option) => option.textContent);
const item = (name: string, listName?: string) => (listName ? within(area(listName)) : screen).getByRole('option', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const lastChange = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls[spy.mock.calls.length - 1]![1] as CgPivotFieldListChange;

async function openMenu(element: HTMLElement) {
  act(() => element.focus());
  fireEvent.keyDown(element, { key: 'Enter' });
  return screen.findByRole('menu');
}
async function choose(element: HTMLElement, command: string) {
  const menu = await openMenu(element);
  const entry = within(menu).getByRole('menuitem', { name: command });
  await act(async () => { fireEvent.click(entry); });
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
}

/** A 2 × 2 grid of areas below a field list. Items are 20px rows from 20px into their area. */
const AREA_RECTS: Record<CgPivotFieldListArea, { x: number; y: number }> = { filters: { x: 0, y: 200 }, columns: { x: 100, y: 200 }, rows: { x: 0, y: 300 }, values: { x: 100, y: 300 } };
function rect(x: number, y: number, width: number, height: number) {
  return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) } as DOMRect;
}
function mockGeometry() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const areaName = this.getAttribute('data-area') as CgPivotFieldListArea | null;
    if (areaName) return rect(AREA_RECTS[areaName].x, AREA_RECTS[areaName].y, 100, 100);
    if (this.hasAttribute('data-cg-pivot-field-list-item')) {
      const owner = this.closest('[data-area]')!.getAttribute('data-area') as CgPivotFieldListArea;
      const index = [...this.parentElement!.children].indexOf(this);
      return rect(AREA_RECTS[owner].x, AREA_RECTS[owner].y + 20 + index * 20, 100, 20);
    }
    // Everything else, such as an overlay's anchor, sits away from the areas.
    return rect(600, 600, 40, 20);
  });
}
/** Drags from `element` to each point in turn, then drops on the last. */
function drag(element: HTMLElement, ...points: ReadonlyArray<[number, number]>) {
  fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
  for (const [x, y] of points) fireEvent.pointerMove(document, { pointerId: 1, clientX: x, clientY: y });
  const [x, y] = points[points.length - 1]!;
  fireEvent.pointerUp(document, { pointerId: 1, clientX: x, clientY: y });
}

// Menus open over animation frames, so the longer journeys get room on a loaded machine.
describe('CgPivotFieldList', () => {
  beforeEach(() => mockGeometry());
  afterEach(() => vi.restoreAllMocks());

  it('shows the fields, which ones are used, and the four labelled areas', () => {
    render(<Harness />);
    expect(screen.getByRole('region', { name: 'PivotTable Fields' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PivotTable Fields' })).toBeInTheDocument();
    for (const name of ['Region', 'Product', 'Date', 'Sales', 'Units']) expect(checkbox(name)).toBeChecked();
    expect(itemsOf('Filters')).toEqual(['Product']);
    expect(itemsOf('Columns')).toEqual(['Σ Values']);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    expect(itemsOf('Values')).toEqual(['Sum of Sales', 'Sum of Units']);
    expect(screen.getByRole('region', { name: 'Rows' })).toContainElement(area('Rows'));
  });

  it('reports a toggle to the host and changes nothing itself when onFieldToggle is given', async () => {
    const toggle = vi.fn();
    const spy = vi.fn();
    render(<Harness initial={empty} onFieldToggle={toggle} spy={spy} />);
    await userEvent.click(checkbox('Sales'));
    expect(toggle).toHaveBeenCalledWith('sales', true);
    expect(spy).not.toHaveBeenCalled();
    expect(checkbox('Sales')).not.toBeChecked();
    render(<Harness onFieldToggle={toggle} />);
    await userEvent.click(screen.getAllByRole('checkbox', { name: 'Region' })[1]!);
    expect(toggle).toHaveBeenLastCalledWith('region', false);
  });

  it('without onFieldToggle, adds a field to its default area and removes every item of it', async () => {
    const spy = vi.fn();
    render(<Harness initial={empty} spy={spy} />);
    await userEvent.click(checkbox('Region'));
    expect(itemsOf('Rows')).toEqual(['Region']);
    expect(lastChange(spy)).toEqual({ kind: 'add', itemId: 'rows:region:0', fieldKey: 'region', to: { area: 'rows', index: 0 } });
    await userEvent.click(checkbox('Sales'));
    expect(itemsOf('Values')).toEqual(['Sum of Sales']);
    expect(checkbox('Sales')).toBeChecked();
    await userEvent.click(checkbox('Region'));
    expect(itemsOf('Rows')).toEqual([]);
    expect(lastChange(spy)).toMatchObject({ kind: 'remove', itemId: 'rows:region:0' });
  });

  it('adds a field from its menu, with entries for areas it is already in disabled', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const menu = await openMenu(checkbox('Region'));
    expect(within(menu).getAllByRole('menuitem').map((entry) => entry.textContent)).toEqual(['Add to Report Filter', 'Add to Row Labels', 'Add to Column Labels', 'Add to Values']);
    expect(within(menu).getByRole('menuitem', { name: 'Add to Row Labels' })).toBeDisabled();
    await act(async () => { fireEvent.click(within(menu).getByRole('menuitem', { name: 'Add to Values' })); });
    await waitFor(() => expect(itemsOf('Values')).toEqual(['Sum of Sales', 'Sum of Units', 'Sum of Region']));
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    await choose(checkbox('Region'), 'Add to Column Labels');
    expect(itemsOf('Rows')).toEqual(['Date']);
    expect(itemsOf('Columns')).toEqual(['Σ Values', 'Region']);
    expect(lastChange(spy)).toMatchObject({ kind: 'move', itemId: 'r-region', from: { area: 'rows', index: 0 }, to: { area: 'columns', index: 1 } });
    await waitFor(() => expect(checkbox('Region')).toHaveFocus());
  }, 20_000);

  it('runs every move command on an item and keeps focus on it', async () => {
    const spy = vi.fn();
    render(<Harness initial={{ ...base, rows: [{ id: 'a', fieldKey: 'region' }, { id: 'b', fieldKey: 'date' }, { id: 'c', fieldKey: 'product' }], filters: [] }} spy={spy} />);
    const menu = await openMenu(item('Region'));
    expect(within(menu).getAllByRole('menuitem').map((entry) => entry.textContent)).toEqual([
      'Move Up', 'Move Down', 'Move to Beginning', 'Move to End', 'Move to Report Filter', 'Move to Row Labels', 'Move to Column Labels', 'Move to Values', 'Remove Field', 'Field Settings…',
    ]);
    for (const name of ['Move Up', 'Move to Beginning', 'Move to Row Labels', 'Field Settings…']) expect(within(menu).getByRole('menuitem', { name })).toBeDisabled();
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    await waitFor(() => expect(item('Region')).toHaveFocus());

    await choose(item('Region'), 'Move Down');
    expect(itemsOf('Rows')).toEqual(['Date', 'Region', 'Product']);
    await waitFor(() => expect(item('Region')).toHaveFocus());
    await choose(item('Region'), 'Move to End');
    expect(itemsOf('Rows')).toEqual(['Date', 'Product', 'Region']);
    await choose(item('Region'), 'Move Up');
    expect(itemsOf('Rows')).toEqual(['Date', 'Region', 'Product']);
    await choose(item('Region'), 'Move to Beginning');
    expect(itemsOf('Rows')).toEqual(['Region', 'Date', 'Product']);
    await choose(item('Region'), 'Move to Report Filter');
    expect(itemsOf('Filters')).toEqual(['Region']);
    await waitFor(() => expect(item('Region', 'Filters')).toHaveFocus());
    await choose(item('Region'), 'Move to Column Labels');
    expect(itemsOf('Columns')).toEqual(['Σ Values', 'Region']);
    await choose(item('Region'), 'Move to Row Labels');
    expect(itemsOf('Rows')).toEqual(['Date', 'Product', 'Region']);
    expect(lastChange(spy)).toEqual({ kind: 'move', itemId: 'a', fieldKey: 'region', from: { area: 'columns', index: 1 }, to: { area: 'rows', index: 2 } });
    await choose(item('Region'), 'Move to Values');
    expect(itemsOf('Values')).toEqual(['Sum of Sales', 'Sum of Units', 'Sum of Region']);
    expect(itemsOf('Rows')).toEqual(['Date', 'Product', 'Region']);
    await waitFor(() => expect(item('Sum of Region')).toHaveFocus());
    await choose(item('Product'), 'Remove Field');
    expect(itemsOf('Rows')).toEqual(['Date', 'Region']);
    expect(lastChange(spy)).toEqual({ kind: 'remove', itemId: 'c', fieldKey: 'product', from: { area: 'rows', index: 1 } });
    await waitFor(() => expect(item('Region', 'Rows')).toHaveFocus());
  }, 20_000);

  it('moves a value item out of Values as a batch and opens the settings callbacks', async () => {
    const spy = vi.fn();
    const fieldSettings = vi.fn();
    const valueSettings = vi.fn();
    render(<Harness spy={spy} onFieldSettings={fieldSettings} onValueFieldSettings={valueSettings} />);
    await choose(item('Sum of Units'), 'Value Field Settings…');
    expect(valueSettings).toHaveBeenCalledWith({ id: 'v-units', fieldKey: 'units', caption: 'Sum of Units' });
    await choose(item('Date'), 'Field Settings…');
    expect(fieldSettings).toHaveBeenCalledWith({ id: 'r-date', fieldKey: 'date' }, 'rows');
    expect(spy).not.toHaveBeenCalled();
    await choose(item('Sum of Units'), 'Move to Row Labels');
    expect(itemsOf('Values')).toEqual(['Sum of Sales']);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date', 'Units']);
    expect(lastChange(spy)).toEqual({ kind: 'batch', changes: [
      { kind: 'remove', itemId: 'v-units', fieldKey: 'units', from: { area: 'values', index: 1 } },
      { kind: 'add', itemId: 'rows:units:0', fieldKey: 'units', to: { area: 'rows', index: 2 } },
    ] });
  }, 20_000);

  it('keeps Σ Values to Columns and Rows', async () => {
    render(<Harness />);
    const menu = await openMenu(item('Σ Values'));
    for (const name of ['Move to Report Filter', 'Move to Values', 'Move to Column Labels', 'Remove Field', 'Field Settings…']) expect(within(menu).getByRole('menuitem', { name })).toBeDisabled();
    await act(async () => { fireEvent.click(within(menu).getByRole('menuitem', { name: 'Move to Row Labels' })); });
    await waitFor(() => expect(itemsOf('Rows')).toEqual(['Region', 'Date', 'Σ Values']));
    drag(item('Σ Values'), [50, 230], [50, 230]);
    expect(itemsOf('Filters')).toEqual(['Product']);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date', 'Σ Values']);
    drag(item('Σ Values'), [400, 50]);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date', 'Σ Values']);
    drag(item('Σ Values'), [50, 315]);
    expect(itemsOf('Rows')).toEqual(['Σ Values', 'Region', 'Date']);
  });

  it('reorders by drag, with an insertion marker, and moves between areas', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.pointerDown(item('Region'), { pointerId: 1, button: 0, clientX: 10, clientY: 325 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 11, clientY: 326 });
    expect(document.querySelector('[data-drop-before]')).toBeNull();
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 20, clientY: 375 });
    expect(area('Rows')).toHaveAttribute('data-drop-end');
    expect(screen.getByRole('region', { name: 'Rows' })).toHaveAttribute('data-drop-target');
    expect(item('Region')).toHaveAttribute('data-dragging');
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 20, clientY: 375 });
    expect(itemsOf('Rows')).toEqual(['Date', 'Region']);
    expect(lastChange(spy)).toEqual({ kind: 'move', itemId: 'r-region', fieldKey: 'region', from: { area: 'rows', index: 0 }, to: { area: 'rows', index: 1 } });

    fireEvent.pointerDown(item('Region'), { pointerId: 2, button: 0, clientX: 10, clientY: 345 });
    fireEvent.pointerMove(document, { pointerId: 2, clientX: 30, clientY: 215 });
    expect(item('Product')).toHaveAttribute('data-drop-before');
    fireEvent.pointerUp(document, { pointerId: 2, clientX: 30, clientY: 215 });
    expect(itemsOf('Filters')).toEqual(['Region', 'Product']);
    expect(itemsOf('Rows')).toEqual(['Date']);
    expect(lastChange(spy)).toMatchObject({ kind: 'move', itemId: 'r-region', from: { area: 'rows', index: 1 }, to: { area: 'filters', index: 0 } });
  });

  it('drags a field from the list into an area at a position, and into Values as a new item', () => {
    const spy = vi.fn();
    render(<Harness initial={{ ...base, rows: [{ id: 'r-date', fieldKey: 'date' }] }} spy={spy} />);
    const regionRow = checkbox('Region').closest('[role="listitem"]') as HTMLElement;
    drag(regionRow, [40, 310]);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    expect(lastChange(spy)).toEqual({ kind: 'add', itemId: 'rows:region:0', fieldKey: 'region', to: { area: 'rows', index: 0 } });
    expect(checkbox('Region')).toBeChecked();
    drag(regionRow, [150, 390]);
    expect(itemsOf('Values')).toEqual(['Sum of Sales', 'Sum of Units', 'Sum of Region']);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    // A click after a drag doesn't toggle the field.
    fireEvent.click(regionRow);
    expect(checkbox('Region')).toBeChecked();
  });

  it('removes an item dropped outside the areas, and cancels on Escape', () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.pointerDown(item('Date'), { pointerId: 1, button: 0, clientX: 10, clientY: 345 });
    fireEvent.pointerMove(document, { pointerId: 1, clientX: 400, clientY: 400 });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerUp(document, { pointerId: 1, clientX: 400, clientY: 400 });
    expect(spy).not.toHaveBeenCalled();
    drag(item('Date'), [400, 400]);
    expect(itemsOf('Rows')).toEqual(['Region']);
    expect(lastChange(spy)).toEqual({ kind: 'remove', itemId: 'r-date', fieldKey: 'date', from: { area: 'rows', index: 1 } });
    expect(checkbox('Date')).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Date removed.');
  });

  it('lets the host veto a drop or a command', async () => {
    const spy = vi.fn();
    const canDrop = vi.fn((_fieldKey: string, target: CgPivotFieldListArea) => target !== 'filters');
    render(<Harness spy={spy} canDrop={canDrop} />);
    drag(item('Region'), [30, 215]);
    expect(spy).not.toHaveBeenCalled();
    expect(canDrop).toHaveBeenCalledWith('region', 'filters', 0);
    const menu = await openMenu(item('Region'));
    expect(within(menu).getByRole('menuitem', { name: 'Move to Report Filter' })).toBeDisabled();
    expect(within(menu).getByRole('menuitem', { name: 'Move to Column Labels' })).toBeEnabled();
  });

  it('holds edits in a draft until Update while deferred', async () => {
    const spy = vi.fn();
    const deferChange = vi.fn();
    const { rerender } = render(<Harness spy={spy} defaultDeferUpdate onDeferUpdateChange={deferChange} />);
    expect(screen.getByRole('checkbox', { name: 'Defer Layout Update' })).toBeChecked();
    drag(item('Date'), [400, 400]);
    await choose(item('Region'), 'Move to Column Labels');
    expect(itemsOf('Rows')).toEqual([]);
    expect(itemsOf('Columns')).toEqual(['Σ Values', 'Region']);
    expect(checkbox('Date')).not.toBeChecked();
    expect(spy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(lastChange(spy)).toEqual({ kind: 'batch', changes: [
      { kind: 'remove', itemId: 'r-date', fieldKey: 'date', from: { area: 'rows', index: 1 } },
      { kind: 'move', itemId: 'r-region', fieldKey: 'region', from: { area: 'rows', index: 0 }, to: { area: 'columns', index: 1 } },
    ] });
    expect(itemsOf('Columns')).toEqual(['Σ Values', 'Region']);

    // Turning deferral off applies what is pending.
    drag(item('Region'), [30, 215]);
    expect(spy).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Defer Layout Update' }));
    expect(deferChange).toHaveBeenCalledWith(false);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(itemsOf('Filters')).toEqual(['Region', 'Product']);
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
    drag(item('Product'), [400, 400]);
    expect(spy).toHaveBeenCalledTimes(3);

    // A new layout from the host replaces a draft.
    const onLayoutChange = vi.fn();
    rerender(<CgPivotFieldList fields={fields} layout={base} onLayoutChange={onLayoutChange} deferUpdate />);
    drag(item('Date'), [400, 400]);
    expect(itemsOf('Rows')).toEqual(['Region']);
    rerender(<CgPivotFieldList fields={fields} layout={{ ...base, filters: [] }} onLayoutChange={onLayoutChange} deferUpdate />);
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    expect(onLayoutChange).not.toHaveBeenCalled();
  }, 20_000);

  it('shows everything and changes nothing when read-only', async () => {
    const spy = vi.fn();
    const toggle = vi.fn();
    render(<Harness spy={spy} onFieldToggle={toggle} readOnly readOnlyMessage="This PivotTable can't be changed here" />);
    expect(screen.getByRole('note')).toHaveTextContent("This PivotTable can't be changed here");
    await userEvent.click(checkbox('Region'));
    expect(checkbox('Region')).toBeChecked();
    expect(toggle).not.toHaveBeenCalled();
    drag(item('Region'), [400, 400]);
    fireEvent.keyDown(item('Region'), { key: 'Delete' });
    fireEvent.keyDown(item('Region'), { key: 'Enter' });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    expect(itemsOf('Rows')).toEqual(['Region', 'Date']);
    expect(screen.getByRole('checkbox', { name: 'Defer Layout Update' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Update' })).toBeDisabled();
  });

  it('locks a disabled field in the list and in the areas', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} fields={fields.map((field) => (field.key === 'date' ? { ...field, disabled: true } : field))} />);
    expect(checkbox('Date')).toBeDisabled();
    expect(item('Date')).toHaveAttribute('aria-disabled', 'true');
    drag(item('Date'), [400, 400]);
    expect(spy).not.toHaveBeenCalled();
    const menu = await openMenu(item('Date'));
    for (const name of ['Move Up', 'Move to Report Filter', 'Move to Values', 'Remove Field']) expect(within(menu).getByRole('menuitem', { name })).toBeDisabled();
  });

  it('is keyboard operable: arrows, Space, Shift+F10, the context-menu key and Delete', async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const region = checkbox('Region');
    expect(region).toHaveAttribute('tabindex', '0');
    expect(checkbox('Product')).toHaveAttribute('tabindex', '-1');
    act(() => region.focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(checkbox('Product')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(checkbox('Units')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(region).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(region).not.toBeChecked();
    expect(itemsOf('Rows')).toEqual(['Date']);
    await userEvent.keyboard(' ');
    expect(itemsOf('Rows')).toEqual(['Date', 'Region']);
    fireEvent.keyDown(region, { key: 'F10', shiftKey: true });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(region).toHaveFocus());

    const date = item('Date');
    expect(date).toHaveAttribute('tabindex', '0');
    expect(item('Region', 'Rows')).toHaveAttribute('tabindex', '-1');
    act(() => date.focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(item('Region', 'Rows')).toHaveFocus();
    expect(item('Region', 'Rows')).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(item('Region', 'Rows'), { key: 'ContextMenu' });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    fireEvent.keyDown(item('Region', 'Rows'), { key: 'Delete' });
    expect(itemsOf('Rows')).toEqual(['Date']);
    await waitFor(() => expect(item('Date')).toHaveFocus());
    expect(screen.getByRole('status')).toHaveTextContent('Region removed.');
  }, 20_000);

  it('searches the fields, sorts them and switches the section layout from the tools menu', async () => {
    const order = vi.fn();
    const sections = vi.fn();
    const { container } = render(<Harness onFieldOrderChange={order} onSectionLayoutChange={sections} fields={[...fields].reverse()} />);
    const names = () => within(screen.getByRole('list', { name: 'Choose fields to add to report:' })).getAllByRole('checkbox').map((box) => box.getAttribute('aria-label') ?? box.closest('label')?.textContent);
    expect(names()).toEqual(['Units', 'Sales', 'Date', 'Product', 'Region']);
    await userEvent.click(screen.getByRole('button', { name: 'Tools' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Sort A to Z' }));
    expect(order).toHaveBeenCalledWith('ascending');
    expect(names()).toEqual(['Date', 'Product', 'Region', 'Sales', 'Units']);
    await userEvent.click(screen.getByRole('button', { name: 'Tools' }));
    await userEvent.click(await screen.findByRole('menuitemradio', { name: 'Fields Section and Areas Section Side-By-Side' }));
    expect(sections).toHaveBeenCalledWith('sideBySide');
    expect(container.querySelector('[data-cg-pivot-field-list]')).toHaveAttribute('data-section-layout', 'sideBySide');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'al');
    expect(names()).toEqual(['Sales']);
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), 'zz');
    expect(screen.getByText('No fields match your search.')).toBeInTheDocument();
  }, 20_000);

  it('takes Arabic labels and an explicit direction', () => {
    render(<Harness direction="rtl" labels={{ title: 'حقول PivotTable', rows: 'الصفوف', valuesItem: 'Σ القيم' }} />);
    expect(screen.getByRole('region', { name: 'حقول PivotTable' })).toHaveAttribute('dir', 'rtl');
    expect(itemsOf('الصفوف')).toEqual(['Region', 'Date']);
    expect(screen.getByRole('option', { name: 'Σ القيم' })).toBeInTheDocument();
  });

  it('rejects duplicate item ids and reserved field keys', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgPivotFieldList fields={fields} layout={{ ...base, filters: [{ id: 'r-date', fieldKey: 'date' }] }} onLayoutChange={() => undefined} />)).toThrow(/duplicate item id/);
    expect(() => render(<CgPivotFieldList fields={[{ key: CG_PIVOT_FIELD_LIST_VALUES_KEY, caption: 'x' }]} layout={empty} onLayoutChange={() => undefined} />)).toThrow(/reserved/);
  });
});
