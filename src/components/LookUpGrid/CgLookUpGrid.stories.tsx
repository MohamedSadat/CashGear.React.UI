import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgField } from '../Field';
import { CgGrid } from '../Grid';
import type { CgGridColumnDescriptor } from '../Grid';
import { CgPopup } from '../Popup';
import { CgLookUpGrid } from './CgLookUpGrid';
import type { CgLookUpGridColumnDescriptor, CgLookUpGridDataLoader } from './CgLookUpGrid.types';

interface Product {
  id: number;
  code: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  warehouse: string;
  posting: boolean;
  batch: string;
}

const products: Product[] = Array.from({ length: 120 }, (_, index) => ({
  id: index + 1,
  code: `ITM-${String(index + 1).padStart(4, '0')}`,
  name: index === 4 ? 'أَحْمَد Precision Gear' : `${['Precision Gear', 'Drive Shaft', 'Bearing Set', 'Hydraulic Seal'][index % 4]} ${index + 1}`,
  unit: index % 2 ? 'EA' : 'BOX',
  quantity: (index * 7) % 83,
  price: 12.5 + index * 1.75,
  warehouse: ['MAIN', 'WEST', 'ALEX'][index % 3]!,
  posting: index % 5 !== 0,
  batch: `B-${202600 + index}`,
}));

const columns: ReadonlyArray<CgLookUpGridColumnDescriptor<Product>> = [
  { fieldId: 'code', title: 'Item', accessor: (item) => item.code, width: 110 },
  { fieldId: 'name', title: 'Description', accessor: (item) => item.name, width: 220 },
  { fieldId: 'unit', title: 'Unit', accessor: (item) => item.unit, width: 70, filterable: false },
  { fieldId: 'quantity', title: 'Available', accessor: (item) => item.quantity, width: 90, alignment: 'end', searchable: false, formatValue: (value) => Number(value).toLocaleString() },
  { fieldId: 'price', title: 'Price', accessor: (item) => item.price, width: 100, alignment: 'end', searchable: false, formatValue: (value) => Number(value).toLocaleString(undefined, { style: 'currency', currency: 'USD' }) },
];
const advancedColumns: ReadonlyArray<CgGridColumnDescriptor<Product>> = [
  { type: 'text', fieldId: 'code', title: 'Item', accessor: (item) => item.code, width: 120 },
  { type: 'text', fieldId: 'name', title: 'Description', accessor: (item) => item.name, minWidth: 220 },
  { type: 'text', fieldId: 'warehouse', title: 'Warehouse', accessor: (item) => item.warehouse, width: 120 },
];

const source = 'CG.CompLib/Comp/Inputs/CgLookUpGrid.*; CG.CompLib.Tests/CgLookUpGrid*Tests.cs; LookUpGridDemo.razor; LookUpGridErpDemo.razor';
const difference = 'React uses immutable descriptors, AbortSignal loaders/resolvers, null as no selection, caller-supplied query-context equality, and intentionally exposes no virtualization prop.';
const meta: Meta = { title: 'Phase 14/LookUpGrid', component: CgLookUpGrid, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const text = (item: Product) => `${item.code} — ${item.name}`;
const key = (item: Product) => item.id;
const localProps = { data: products, columns, valueSelector: key, textSelector: text } as const;
const templatedColumns: ReadonlyArray<CgLookUpGridColumnDescriptor<Product>> = columns.map((column) => (
  column.fieldId === 'name'
    ? { ...column, renderCell: ({ item }) => <strong>{item.name}</strong> }
    : column
));
const pendingLoader: CgLookUpGridDataLoader<Product, unknown> = () => new Promise(() => undefined);

function Frame({ children }: { children: React.ReactNode }) {
  return <StoryFrame source={source} difference={difference}>{children}</StoryFrame>;
}

const serverLoader: CgLookUpGridDataLoader<Product, { warehouse?: string }> = async (query, { signal }) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 250);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  const search = query.searchText?.toLocaleLowerCase() ?? '';
  let matches = products.filter((item) => !query.queryContext?.warehouse || item.warehouse === query.queryContext.warehouse);
  if (search) matches = matches.filter((item) => `${item.code} ${item.name} ${item.unit}`.toLocaleLowerCase().includes(search));
  for (const [fieldId, filter] of Object.entries(query.columnFilters ?? {})) {
    matches = matches.filter((item) => String(item[fieldId as keyof Product]).toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  }
  if (query.sort) matches = [...matches].sort((left, right) => {
    const result = String(left[query.sort!.fieldId as keyof Product]).localeCompare(String(right[query.sort!.fieldId as keyof Product]), undefined, { numeric: true });
    return query.sort!.direction === 'descending' ? -result : result;
  });
  return { items: matches.slice(query.skip, query.skip + query.take), totalCount: matches.length };
};

function ControlledPopupExample() {
  const [open, setOpen] = useState(true);
  return <div><button type="button" onClick={() => setOpen((value) => !value)}>External toggle</button><CgLookUpGrid {...localProps} open={open} onOpenChange={setOpen} aria-label="Controlled item" /></div>;
}

function ViewAllExample() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const advancedItems = query
    ? products.filter((item) => `${item.code} ${item.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
    : products;
  return <><CgLookUpGrid {...localProps} defaultOpen onViewAllRequest={(search) => { setQuery(search); setOpen(true); }} aria-label="Item with advanced search" /><CgPopup open={open} onOpenChange={setOpen} title="Advanced item search"><p>Advanced search query: {query ?? '(all items)'}</p><CgGrid data={advancedItems} columns={advancedColumns} keySelector={(item) => item.id} height={260} aria-label="Advanced product results" /></CgPopup></>;
}

function WarehouseExample() {
  const [warehouse, setWarehouse] = useState('MAIN');
  const context = useMemo(() => ({ warehouse }), [warehouse]);
  return <div><label>Warehouse <select value={warehouse} onChange={(event) => setWarehouse(event.target.value)}><option>MAIN</option><option>WEST</option><option>ALEX</option></select></label><CgLookUpGrid dataLoader={serverLoader} columns={columns} valueSelector={key} textSelector={text} queryContext={context} defaultOpen pageSize={12} aria-label="Warehouse product" /></div>;
}

function ValidationExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return <form onSubmit={(event) => { event.preventDefault(); const next = new FormData(event.currentTarget).get('productId'); setSubmitted(typeof next === 'string' ? next : 'No value'); }}><CgField label="Required product" required validationState="error" validationMessage="Choose a product"><CgLookUpGrid {...localProps} name="productId" required validationState="error" /></CgField><button type="submit">Submit</button><button type="reset">Reset</button><output>{submitted}</output></form>;
}

function ErrorRetryExample() {
  const [attempt, setAttempt] = useState(0);
  const loader: CgLookUpGridDataLoader<Product, unknown> = () => {
    if (attempt === 0) return Promise.reject(new Error('Simulated lookup failure'));
    return Promise.resolve({ items: products.slice(0, 8), totalCount: 8 });
  };
  return <div><button type="button" onClick={() => setAttempt(1)}>Make retry succeed</button><CgLookUpGrid dataLoader={loader} columns={columns} valueSelector={key} textSelector={text} defaultOpen searchDebounceMilliseconds={0} aria-label="Retry item" /></div>;
}

export const LocalItemLookup: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen aria-label="Local item" /></Frame> };
export const ServerCustomerLookup: Story = { render: () => <Frame><CgLookUpGrid dataLoader={serverLoader} columns={columns} valueSelector={key} textSelector={text} defaultOpen pageSize={15} aria-label="Server customer" /></Frame> };
export const ExistingKeyResolvedAsynchronously: Story = { render: () => <Frame><CgLookUpGrid dataLoader={serverLoader} columns={columns} value={78} valueSelector={key} textSelector={text} itemResolver={(value) => Promise.resolve(products.find((item) => item.id === value))} aria-label="Resolved item" /></Frame> };
export const ColumnFilterRow: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen showFilterRow aria-label="Filtered item" /></Frame> };
export const Sorting: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen initialSort="price desc" aria-label="Sorted item" /></Frame> };
export const AppendPaging: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen pageSize={8} aria-label="Paged item" /></Frame> };
export const UnknownTotalCount: Story = { render: () => <Frame><CgLookUpGrid dataLoader={(query) => Promise.resolve({ items: products.slice(query.skip, query.skip + query.take) })} columns={columns} valueSelector={key} textSelector={text} defaultOpen pageSize={8} aria-label="Unknown total item" /></Frame> };
export const DisabledLedgerRows: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen rowDisabledSelector={(item) => !item.posting} aria-label="Ledger account" /></Frame> };
export const TemplatesAndCustomFooter: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultValue={products[2]!.id} defaultOpen renderSelected={({ item }) => <strong>{item.code} · {item.name}</strong>} renderFooter={(state) => <em>{state.items.length} lean DTOs loaded</em>} columns={templatedColumns} aria-label="Templated item" /></Frame> };
export const ValidationAndRequiredField: Story = { render: () => <Frame><ValidationExample /></Frame> };
export const ControlledPopup: Story = { render: () => <Frame><ControlledPopupExample /></Frame> };
export const ErrorAndRetry: Story = { render: () => <Frame><ErrorRetryExample /></Frame> };
export const MinimumSearchLength: Story = { render: () => <Frame><CgLookUpGrid dataLoader={serverLoader} columns={columns} valueSelector={key} textSelector={text} minimumSearchLength={3} defaultOpen aria-label="Minimum search item" /></Frame> };
export const ViewAllIntegration: Story = { render: () => <Frame><ViewAllExample /></Frame> };
export const ArabicRtlLookup: Story = { globals: { direction: 'rtl' }, render: () => <Frame><div dir="rtl"><CgField label="الصنف"><CgLookUpGrid {...localProps} defaultOpen locale="ar-EG" labels={{ toggleLookup: 'فتح قائمة الأصناف', clearSelection: 'مسح الصنف' }} /></CgField></div></Frame> };
export const ErpCustomerLookup: Story = { render: () => <Frame><CgLookUpGrid dataLoader={serverLoader} columns={columns.slice(0, 4)} valueSelector={key} textSelector={text} defaultOpen pageSize={10} aria-label="ERP customer" /></Frame> };
export const ErpProductLookupScopedByWarehouse: Story = { render: () => <Frame><WarehouseExample /></Frame> };
export const ErpLedgerAccountLookup: Story = { render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen rowDisabledSelector={(item) => !item.posting} renderFooter={() => <small>Non-posting headings remain visible but disabled.</small>} aria-label="ERP ledger account" /></Frame> };
export const ErpBatchLookupWithDocumentContext: Story = { render: () => <Frame><CgLookUpGrid dataLoader={serverLoader} columns={[columns[0]!, { fieldId: 'batch', title: 'Batch', accessor: (item) => item.batch, width: 130 }, columns[3]!]} valueSelector={key} textSelector={(item) => item.batch} queryContext={{ warehouse: 'MAIN' }} defaultOpen aria-label="ERP batch" /></Frame> };
export const MultipleInstances: Story = { render: () => <Frame><CgLookUpGrid {...localProps} aria-label="First item" /><CgLookUpGrid {...localProps} aria-label="Second item" /></Frame> };
export const NarrowViewportAndFlyoutFlip: Story = { render: () => <Frame><div style={{ inlineSize: 300, minBlockSize: 520, display: 'flex', alignItems: 'end' }}><CgLookUpGrid {...localProps} defaultOpen dropDownWidth={520} dropDownHeight={260} aria-label="Narrow item" /></div></Frame> };
export const DarkTheme: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <Frame><CgLookUpGrid {...localProps} defaultOpen showFilterRow aria-label="Dark item" /></Frame> };
export const ReducedMotion: Story = { render: () => <Frame><CgLookUpGrid dataLoader={pendingLoader} columns={columns} valueSelector={key} textSelector={text} defaultOpen aria-label="Reduced motion item" /></Frame> };
