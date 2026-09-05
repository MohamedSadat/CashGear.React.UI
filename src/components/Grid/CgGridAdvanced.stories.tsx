/* eslint-disable @typescript-eslint/require-await -- story persistence callbacks intentionally update local state synchronously. */
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgSpinEdit } from '../SpinEdit';
import { CgGrid } from './CgGrid';
import type { CgGridAutomaticEditorContext, CgGridBatchMutationRequest, CgGridColumnDescriptor, CgGridEditMode, CgGridSummaryDescriptor } from './CgGrid.types';

interface Invoice { readonly id: number; readonly customer: string; readonly region: string; readonly amount: number; readonly paid: boolean; readonly issued: string }
const seed: ReadonlyArray<Invoice> = Array.from({ length: 18 }, (_, index) => ({ id: index + 1, customer: ['Acme Trading', 'Cairo Retail', 'Nile Logistics'][index % 3]!, region: ['Cairo', 'Alexandria', 'Giza'][index % 3]!, amount: 950 + index * 175, paid: index % 3 !== 0, issued: `2026-08-${String(index % 25 + 1).padStart(2, '0')}` }));
const columns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = [
  { type: 'number', fieldId: 'id', title: 'Invoice', accessor: (item) => item.id, width: 88, editor: { kind: 'number', readOnly: true, setValue: (item, value) => ({ ...item, id: Number(value) }) } },
  { type: 'text', fieldId: 'customer', title: 'Customer', accessor: (item) => item.customer, minWidth: 190, editor: { kind: 'text', required: true, memo: 'Required customer display name', setValue: (item, value) => ({ ...item, customer: String(value) }) } },
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (item) => item.region, width: 130, editor: { kind: 'enum', options: ['Cairo', 'Alexandria', 'Giza'].map((value) => ({ key: value, label: value, value })), setValue: (item, value) => ({ ...item, region: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (item) => item.amount, width: 130, editor: { kind: 'number', minimum: 0, setValue: (item, value) => ({ ...item, amount: Number(value) }) } },
  { type: 'boolean', fieldId: 'paid', title: 'Paid', accessor: (item) => item.paid, width: 88, editor: { kind: 'boolean', setValue: (item, value) => ({ ...item, paid: Boolean(value) }) } },
  { type: 'date', fieldId: 'issued', title: 'Issued', accessor: (item) => item.issued, width: 130, editor: { kind: 'date', setValue: (item, value) => ({ ...item, issued: String(value) }) } },
  { type: 'command', fieldId: '__commands', title: 'Actions', width: 132, hideable: false },
];

function applyBatch(items: ReadonlyArray<Invoice>, request: CgGridBatchMutationRequest<Invoice>): ReadonlyArray<Invoice> {
  return request.operations.reduce<ReadonlyArray<Invoice>>((current, operation) => {
    if (operation.operation === 'create') return [...current, operation.createModel];
    if (operation.operation === 'delete') return current.filter((item) => `number:${item.id}` !== operation.rowKey);
    return current.map((item) => `number:${item.id}` === operation.rowKey ? operation.editModel : item);
  }, items);
}

function EditingExample({ mode }: { readonly mode: CgGridEditMode }) {
  const [items, setItems] = useState(seed.slice(0, 8));
  const common = { create: true, update: true, delete: true, newItemFactory: () => ({ id: Math.max(0, ...items.map((item) => item.id)) + 1, customer: '', region: 'Cairo', amount: 0, paid: false, issued: '2026-08-27' }), editModelFactory: (item: Invoice) => ({ ...item }), canEditCell: (_item: Invoice, column: CgGridColumnDescriptor<Invoice>) => column.fieldId !== 'id', confirmDelete: async () => true };
  if (mode === 'batch') return <CgGrid data={items} columns={columns} keySelector={(item) => item.id} height={410} editing={{ ...common, mode, navigationPolicy: 'preserve', commitBatch: async (request) => { setItems((current) => [...applyBatch(current, request)]); return { succeeded: true, outcome: 'succeeded' }; } }} />;
  const mutation = { createItem: async ({ createModel }: { createModel: Invoice }) => { setItems((current) => [...current, createModel]); return { succeeded: true }; }, updateItem: async ({ rowKey, editModel }: { rowKey: string; editModel: Invoice }) => { setItems((current) => current.map((item) => `number:${item.id}` === rowKey ? editModel : item)); return { succeeded: true }; }, deleteItem: async ({ rowKey }: { rowKey: string }) => { setItems((current) => current.filter((item) => `number:${item.id}` !== rowKey)); return { succeeded: true }; } };
  return <CgGrid data={items} columns={columns} keySelector={(item) => item.id} height={410} editing={mode === 'popup' ? { ...common, ...mutation, mode } : { ...common, ...mutation, mode, navigationPolicy: 'confirmDiscard', confirmDiscard: async () => true }} />;
}

const spreadsheetColumns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = columns.map((column): CgGridColumnDescriptor<Invoice> => {
  if (column.fieldId !== 'amount' || column.type !== 'number') return column;
  return {
    ...column,
    editor: {
      kind: 'number', minimum: 0,
      setValue: (item: Invoice, value: number | null | undefined) => ({ ...item, amount: Number(value) }),
      render: ({ value, setValue }: CgGridAutomaticEditorContext<Invoice, number | null | undefined>) => <CgSpinEdit aria-label="Amount formula" value={typeof value === 'number' ? value : null} onValueChange={(nextValue) => setValue(nextValue)} allowExpressions updateValueOnInput showSpinButtons={false} min={0} />,
    },
  };
});
function SpreadsheetEditingExample() {
  const [items, setItems] = useState(seed.slice(0, 6));
  return <CgGrid aria-label="Spreadsheet editing grid" data={items} columns={spreadsheetColumns} keySelector={(item) => item.id} height={390} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, allowTypeToEdit: true, enterMovesToNextRow: true, canEditCell: (_item, column) => column.fieldId !== 'id', editModelFactory: (item) => ({ ...item }), updateItem: async ({ rowKey, editModel }) => { setItems((current) => current.map((item) => `number:${item.id}` === rowKey ? editModel : item)); return { succeeded: true }; } }} />;
}

const custom: CgGridSummaryDescriptor<Invoice> = { id: 'exposure', type: 'custom', aggregateKey: 'exposure-v1', inputFieldIds: ['amount', 'paid'], label: 'Open exposure', localAggregate: async ({ items, signal }) => { await Promise.resolve(); if (signal.aborted) throw new DOMException('aborted', 'AbortError'); return { available: true, value: items.filter((item) => !item.paid).reduce((sum, item) => sum + item.amount, 0), completeness: 'complete' }; } };
const meta: Meta = { title: 'Phase 15/Advanced Grid', component: CgGrid };
export default meta;
type Story = StoryObj;

export const TypedFiltersAndNumericPager: Story = { render: () => <CgGrid data={seed} columns={columns} keySelector={(item) => item.id} height={410} pagerMode="numericButtons" showActiveFilterPanel defaultState={{ pageSize: 5, filter: { kind: 'group', operator: 'and', negated: true, children: [{ kind: 'condition', fieldId: 'region', operator: 'equals', values: [{ kind: 'text', text: 'Giza' }], source: 'builder' }] } }} /> };
export const PopupEditing: Story = { render: () => <EditingExample mode="popup" /> };
export const InlineRowEditing: Story = { render: () => <EditingExample mode="inlineRow" /> };
export const CellEditing: Story = { render: () => <EditingExample mode="cell" /> };
export const BatchEditing: Story = { render: () => <EditingExample mode="batch" /> };
export const SpreadsheetEditing: Story = { render: () => <SpreadsheetEditingExample /> };
export const CustomAggregates: Story = { render: () => <CgGrid data={seed} columns={columns} keySelector={(item) => item.id} height={410} totalSummaries={[custom]} allowGrouping defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }} groupSummaries={[custom]} /> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <EditingExample mode="cell" /> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 470 }}><CgGrid data={seed} columns={columns} keySelector={(item) => item.id} direction="rtl" height={390} pagerMode="auto" defaultState={{ pageSize: 5 }} /></div> };
export const ForcedColors: Story = { render: () => <EditingExample mode="inlineRow" /> };
export const ReducedMotion: Story = { render: () => <CgGrid data={seed} columns={columns} keySelector={(item) => item.id} height={390} pagerMode="auto" defaultState={{ pageSize: 5 }} /> };
