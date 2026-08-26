/* eslint-disable @typescript-eslint/require-await -- story providers intentionally resolve immediately. */
import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgGrid } from './CgGrid';
import { createGridState } from './state';
import { CgGridBrowserViewStore } from './views';
import type { CgGridColumnDescriptor, CgGridDataProvider, CgGridState } from './CgGrid.types';

interface Invoice { id: number; customer: string; region: string; amount: number; paid: boolean; issued: string }
const data: ReadonlyArray<Invoice> = Array.from({ length: 36 }, (_, index) => ({ id: index + 1, customer: ['Acme Trading', 'Cairo Retail', 'Nile Logistics', 'Delta Foods'][index % 4]!, region: ['Cairo', 'Alexandria', 'Giza'][index % 3]!, amount: 1250 + index * 137.5, paid: index % 3 !== 0, issued: `2026-08-${String(index % 25 + 1).padStart(2, '0')}` }));
const columns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = [
  { type: 'selection', fieldId: '__selection', title: 'Select', width: 54, hideable: false },
  { type: 'number', fieldId: 'id', title: 'Invoice', accessor: (item) => item.id, width: 90, editor: { kind: 'number', readOnly: true, setValue: (item, value) => ({ ...item, id: Number(value) }) } },
  { type: 'text', fieldId: 'customer', title: 'Customer', accessor: (item) => item.customer, minWidth: 190, editor: { kind: 'text', required: true, minimumLength: 2, setValue: (item, value) => ({ ...item, customer: String(value) }) } },
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (item) => item.region, width: 130, initialGroupIndex: undefined, editor: { kind: 'enum', options: ['Cairo', 'Alexandria', 'Giza'].map((value) => ({ key: value, label: value, value })), setValue: (item, value) => ({ ...item, region: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (item) => item.amount, width: 130, editor: { kind: 'number', required: true, minimum: 0, step: 0.01, setValue: (item, value) => ({ ...item, amount: Number(value) }) } },
  { type: 'boolean', fieldId: 'paid', title: 'Paid', accessor: (item) => item.paid, width: 90, editor: { kind: 'boolean', setValue: (item, value) => ({ ...item, paid: Boolean(value) }) } },
  { type: 'date', fieldId: 'issued', title: 'Issued', accessor: (item) => item.issued, width: 130, editor: { kind: 'date', required: true, setValue: (item, value) => ({ ...item, issued: String(value) }) } },
];
const crudColumns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = [
  ...columns,
  { type: 'command', fieldId: '__commands', title: 'Actions', width: 130, hideable: false },
];
const source = 'CG.CompLib/Comp/Grid/*; CG.CompLib.Tests/CgGrid*Tests.cs; CG.CompLib.Demo/Components/Pages/GridDemo.razor';
const difference = 'React uses immutable typed column descriptors, CgGridActions, AbortSignal providers, explicit immutable editor setters, injected view stores, and a testable Uint8Array XLSX result.';
const meta: Meta = { title: 'Phase 13/Grid', component: CgGrid, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const base = { data, columns, keySelector: (item: Invoice) => item.id, height: 420, 'aria-label': 'Invoice grid' };
export const BasicLocal: Story = { render: () => <StoryFrame source={source} difference={difference}><CgGrid {...base} stripedRows /></StoryFrame> };
export const SortingFilteringSearch: Story = { render: () => <CgGrid {...base} defaultState={{ sorts: [{ fieldId: 'amount', direction: 'descending' }], filter: { kind: 'condition', fieldId: 'amount', operator: 'greaterThan', value: 2000, source: 'caller' } }} /> };
export const Selection: Story = { render: () => <CgGrid {...base} selectionMode="checkbox" defaultState={{ selectedKeys: ['number:2', 'number:4'] }} /> };
export const Summaries: Story = { render: () => <CgGrid {...base} totalSummaries={[{ id: 'count', type: 'count' }, { id: 'sum', type: 'sum', fieldId: 'amount', label: 'Total' }]} /> };
export const MasterDetail: Story = { render: () => <CgGrid {...base} renderDetail={({ item }) => <div><strong>{item.customer}</strong><p>Invoice detail and payment history.</p></div>} prepareDetail={async (item) => ({ invoiceId: item.id })} /> };
export const LocalGrouping: Story = { render: () => <CgGrid {...base} allowGrouping defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }} groupSummaries={[{ id: 'sum', type: 'sum', fieldId: 'amount' }]} /> };

const provider: CgGridDataProvider<Invoice> = async (request, { signal }) => { await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 350); signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('aborted', 'AbortError')); }); }); const page = data.slice(request.skip, request.skip + request.take); return { rows: page, totalCount: data.length, authorizedFilteredRowCount: data.length, totalSummaries: { count: data.length } }; };
export const AsyncProvider: Story = { render: () => <CgGrid dataProvider={provider} columns={columns} keySelector={(item) => item.id} height={420} /> };
const groupedProvider: CgGridDataProvider<Invoice> = async (request) => request.mode === 'groupNodes' ? { groupNodes: ['Cairo', 'Alexandria', 'Giza'].map((region) => ({ memberKey: region, fieldId: 'region', level: 0, value: region, displayText: region, childCount: 0, leafCount: data.filter((item) => item.region === region).length, hasChildren: false, fullPath: { segments: [{ fieldId: 'region', memberKey: region, value: region, displayText: region }] } })), totalCount: 3, authorizedFilteredRowCount: data.length } : { rows: data.filter((item) => item.region === request.groupPath.segments[0]?.memberKey).slice(request.skip, request.skip + request.take), totalCount: data.filter((item) => item.region === request.groupPath.segments[0]?.memberKey).length, authorizedFilteredRowCount: data.length };
export const RemoteGrouping: Story = { render: () => <CgGrid dataProvider={groupedProvider} columns={columns} keySelector={(item) => item.id} allowGrouping defaultState={{ groups: [{ fieldId: 'region', direction: 'ascending' }] }} height={420} /> };
export const ColumnPersonalization: Story = { render: () => <CgGrid {...base} allowColumnChooser allowColumnReordering allowColumnResizing /> };

function NamedViewsExample() { const store = useMemo(() => new CgGridBrowserViewStore(), []); return <CgGrid {...base} viewKey="invoice-list" viewStore={store} allowSharedViews allowColumnChooser />; }
export const NamedViews: Story = { render: () => <NamedViewsExample /> };
function CrudExample() { const [items, setItems] = useState(data.slice(0, 8)); return <CgGrid data={items} columns={crudColumns} keySelector={(item) => item.id} height={420} editing={{ create: true, update: true, delete: true, newItemFactory: () => ({ id: Math.max(0, ...items.map((item) => item.id)) + 1, customer: '', region: 'Cairo', amount: 0, paid: false, issued: '2026-08-26' }), editModelFactory: (item) => ({ ...item }), createItem: async ({ createModel }) => { setItems((current) => [...current, createModel]); return { succeeded: true }; }, updateItem: async ({ rowKey, editModel }) => { setItems((current) => current.map((item) => `number:${item.id}` === rowKey ? editModel : item)); return { succeeded: true }; }, deleteItem: async ({ rowKey }) => { setItems((current) => current.filter((item) => `number:${item.id}` !== rowKey)); return { succeeded: true }; }, confirmDelete: async () => true, confirmDirtyClose: async () => globalThis.confirm?.('Discard changes?') ?? true }} />; }
export const PopupCrud: Story = { render: () => <CrudExample /> };
export const AutomaticEditors: Story = { render: () => <CrudExample /> };
export const ContextMenus: Story = { render: () => <CgGrid {...base} contextMenuAreas={['row', 'cell', 'header', 'emptyArea']} contextMenuSelectionBehavior="selectIfNeeded" selectionMode="multiple" /> };
export const Export: Story = { render: () => <CgGrid {...base} toolbar={(actions) => <button type="button" onClick={() => void actions.exportToXlsx({ fileName: 'invoices.xlsx', download: true })}>Export XLSX</button>} /> };
export const EmptyState: Story = { render: () => <CgGrid data={[]} columns={columns} keySelector={(item) => item.id} /> };
export const LoadingState: Story = { render: () => <CgGrid dataProvider={async () => new Promise<never>(() => undefined)} columns={columns} keySelector={(item) => item.id} /> };
export const ErrorState: Story = { render: () => <CgGrid dataProvider={async () => { throw new Error('Demo failure'); }} columns={columns} keySelector={(item) => item.id} /> };
export const DarkTheme: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <CgGrid {...base} stripedRows /> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 460 }}><CgGrid {...base} direction="rtl" height={360} /></div> };
function ControlledGrid() { const [state, setState] = useState<CgGridState>(() => createGridState(columns)); return <CgGrid {...base} state={state} onStateChange={setState} />; }
export const ControlledState: Story = { render: () => <ControlledGrid /> };
