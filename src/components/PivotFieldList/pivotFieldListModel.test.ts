import { describe, expect, it } from 'vitest';
import type { CgPivotFieldListLayout } from './CgPivotFieldList.types';
import {
  CG_PIVOT_FIELD_LIST_VALUES_KEY,
  nextPivotFieldListItemId,
  resolveFieldRemoval,
  resolvePlacement,
  resolveRemoval,
  validatePivotFieldListFields,
  validatePivotFieldListLayout,
} from './pivotFieldListModel';
import type { PivotFieldListRules } from './pivotFieldListModel';

const fields = validatePivotFieldListFields([
  { key: 'region', caption: 'Region' },
  { key: 'product', caption: 'Product' },
  { key: 'date', caption: 'Date', disabled: true },
  { key: 'sales', caption: 'Sales' },
]);
const rules: PivotFieldListRules = { fields, getValueCaption: (field) => `Sum of ${field.caption}` };
const layout: CgPivotFieldListLayout = {
  filters: [],
  columns: [{ id: 'v', fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY }],
  rows: [{ id: 'r', fieldKey: 'region' }, { id: 'p', fieldKey: 'product' }],
  values: [{ id: 's1', fieldKey: 'sales', caption: 'Sum of Sales' }, { id: 's2', fieldKey: 'sales', caption: 'Count of Sales' }],
};
const ids = (value: CgPivotFieldListLayout) => ({ filters: value.filters.map((item) => item.id), columns: value.columns.map((item) => item.id), rows: value.rows.map((item) => item.id), values: value.values.map((item) => item.id) });

describe('pivot field list model', () => {
  it('rejects duplicate ids and keys and the reserved key', () => {
    expect(() => validatePivotFieldListLayout({ ...layout, filters: [{ id: 'r', fieldKey: 'region' }] })).toThrow(/duplicate item id 'r'/);
    expect(() => validatePivotFieldListFields([{ key: 'a', caption: 'A' }, { key: 'a', caption: 'B' }])).toThrow(/duplicate field key/);
    expect(() => validatePivotFieldListFields([{ key: CG_PIVOT_FIELD_LIST_VALUES_KEY, caption: 'V' }])).toThrow(/reserved/);
  });

  it('generates the smallest unused id for an area and field', () => {
    expect(nextPivotFieldListItemId(layout, 'values', 'sales')).toBe('values:sales:0');
    expect(nextPivotFieldListItemId({ ...layout, values: [{ id: 'values:sales:0', fieldKey: 'sales' }] }, 'values', 'sales')).toBe('values:sales:1');
  });

  it('reorders within an area, reporting the final index, and ignores a drop in place', () => {
    const edit = resolvePlacement(layout, rules, { fieldKey: 'region', itemId: 'r', area: 'rows', marker: 2 });
    expect(ids(edit!.layout).rows).toEqual(['p', 'r']);
    expect(edit!.change).toEqual({ kind: 'move', itemId: 'r', fieldKey: 'region', from: { area: 'rows', index: 0 }, to: { area: 'rows', index: 1 } });
    expect(resolvePlacement(layout, rules, { fieldKey: 'region', itemId: 'r', area: 'rows', marker: 1 })).toBeUndefined();
    expect(resolvePlacement(layout, rules, { fieldKey: 'region', itemId: 'r', area: 'rows', marker: 0 })).toBeUndefined();
  });

  it('moves a field between Filters, Columns and Rows, keeping its id', () => {
    const edit = resolvePlacement(layout, rules, { fieldKey: 'product', itemId: 'p', area: 'filters', marker: 0 });
    expect(ids(edit!.layout)).toMatchObject({ filters: ['p'], rows: ['r'] });
    expect(edit!.change).toMatchObject({ kind: 'move', itemId: 'p', from: { area: 'rows', index: 1 }, to: { area: 'filters', index: 0 } });
  });

  it('adding a field already on an axis moves it there instead', () => {
    const edit = resolvePlacement(layout, rules, { fieldKey: 'region', area: 'columns', marker: 0 });
    expect(ids(edit!.layout)).toMatchObject({ columns: ['r', 'v'], rows: ['p'] });
    expect(edit!.change.kind).toBe('move');
  });

  it('adds a new value item without taking the field out of Rows', () => {
    const edit = resolvePlacement(layout, rules, { fieldKey: 'region', itemId: 'r', area: 'values', marker: 0 });
    expect(ids(edit!.layout)).toMatchObject({ rows: ['r', 'p'], values: ['values:region:0', 's1', 's2'] });
    expect(edit!.layout.values[0]).toEqual({ id: 'values:region:0', fieldKey: 'region', caption: 'Sum of Region' });
    expect(edit!.change).toEqual({ kind: 'add', itemId: 'values:region:0', fieldKey: 'region', to: { area: 'values', index: 0 } });
  });

  it('lets Values hold the same field twice and reorders value items', () => {
    const added = resolvePlacement(layout, rules, { fieldKey: 'sales', area: 'values', marker: 2 });
    expect(ids(added!.layout).values).toEqual(['s1', 's2', 'values:sales:0']);
    const moved = resolvePlacement(layout, rules, { fieldKey: 'sales', itemId: 's2', area: 'values', marker: 0 });
    expect(ids(moved!.layout).values).toEqual(['s2', 's1']);
  });

  it('turns a value item dragged to an axis into the field there, as a batch', () => {
    const edit = resolvePlacement(layout, rules, { fieldKey: 'sales', itemId: 's1', area: 'rows', marker: 0 });
    expect(ids(edit!.layout)).toMatchObject({ rows: ['rows:sales:0', 'r', 'p'], values: ['s2'] });
    expect(edit!.change).toEqual({ kind: 'batch', changes: [
      { kind: 'remove', itemId: 's1', fieldKey: 'sales', from: { area: 'values', index: 0 } },
      { kind: 'add', itemId: 'rows:sales:0', fieldKey: 'sales', to: { area: 'rows', index: 0 } },
    ] });
    const regionValue = { ...layout, values: [...layout.values, { id: 'cr', fieldKey: 'region' }] };
    const back = resolvePlacement(regionValue, rules, { fieldKey: 'region', itemId: 'cr', area: 'columns', marker: 1 });
    expect(ids(back!.layout)).toMatchObject({ columns: ['v', 'r'], rows: ['p'], values: ['s1', 's2'] });
  });

  it('keeps Σ Values to Columns and Rows and never removes it', () => {
    expect(resolvePlacement(layout, rules, { fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY, itemId: 'v', area: 'filters', marker: 0 })).toBeUndefined();
    expect(resolvePlacement(layout, rules, { fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY, itemId: 'v', area: 'values', marker: 0 })).toBeUndefined();
    expect(resolvePlacement(layout, rules, { fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY, area: 'rows', marker: 0 })).toBeUndefined();
    const moved = resolvePlacement(layout, rules, { fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY, itemId: 'v', area: 'rows', marker: 1 });
    expect(ids(moved!.layout)).toMatchObject({ columns: [], rows: ['r', 'v', 'p'] });
    expect(resolveRemoval(layout, rules, 'v')).toBeUndefined();
  });

  it('honours disabled fields and the host veto with the final index', () => {
    expect(resolvePlacement(layout, rules, { fieldKey: 'date', area: 'rows', marker: 0 })).toBeUndefined();
    const seen: Array<[string, string, number]> = [];
    const vetoing: PivotFieldListRules = { ...rules, canDrop: (fieldKey, area, index) => { seen.push([fieldKey, area, index]); return area !== 'filters'; } };
    expect(resolvePlacement(layout, vetoing, { fieldKey: 'region', itemId: 'r', area: 'filters', marker: 0 })).toBeUndefined();
    expect(resolvePlacement(layout, vetoing, { fieldKey: 'region', itemId: 'r', area: 'rows', marker: 2 })).toBeDefined();
    expect(seen).toEqual([['region', 'filters', 0], ['region', 'rows', 1]]);
  });

  it('removes one item, or every item of a field', () => {
    expect(resolveRemoval(layout, rules, 'p')!.change).toEqual({ kind: 'remove', itemId: 'p', fieldKey: 'product', from: { area: 'rows', index: 1 } });
    const all = resolveFieldRemoval(layout, rules, 'sales');
    expect(ids(all!.layout).values).toEqual([]);
    expect(all!.change).toEqual({ kind: 'batch', changes: [
      { kind: 'remove', itemId: 's1', fieldKey: 'sales', from: { area: 'values', index: 0 } },
      { kind: 'remove', itemId: 's2', fieldKey: 'sales', from: { area: 'values', index: 0 } },
    ] });
    expect(resolveFieldRemoval(layout, rules, 'product')!.change.kind).toBe('remove');
    expect(resolveFieldRemoval(layout, rules, 'date')).toBeUndefined();
  });
});
