/* eslint-disable @typescript-eslint/require-await -- deterministic story providers intentionally resolve synchronously. */
import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTreeList } from './CgTreeList';
import type { CgTreeListActions, CgTreeListColumn, CgTreeListDataProvider, CgTreeListParentKey } from './CgTreeList.types';

interface Account { readonly id: number; readonly parentId: number | null; readonly code: string; readonly name: string; readonly type: string; readonly balance: number; readonly active: boolean; readonly hasChildren?: boolean; readonly locked?: boolean }
const none = { kind: 'none' } as const;
const parent = (key: number): CgTreeListParentKey<number> => ({ kind: 'key', key });
const source = 'CashGear.Blazor.UI/Components/Data/TreeList at 51d7689a7d407713fa18cb6268158b1a4f461fb3';
const difference = 'React uses immutable typed descriptor objects, stable string/number keys, the shared structured filter AST, browser-neutral XLSX/print/PDF adapters, fixed-height virtualization, and host-owned persistence/authorization. QuestPDF and Razor child columns are intentionally not carried into the runtime.';

const accounts: ReadonlyArray<Account> = [
  { id: 1000, parentId: null, code: '1000', name: 'Assets', type: 'Header', balance: 1_284_300, active: true },
  { id: 1100, parentId: 1000, code: '1100', name: 'Cash and cash equivalents', type: 'Current asset', balance: 284_500, active: true },
  { id: 1110, parentId: 1100, code: '1110', name: 'Main operating account', type: 'Bank', balance: 198_250, active: true },
  { id: 1120, parentId: 1100, code: '1120', name: 'Petty cash', type: 'Cash', balance: 86_250, active: true },
  { id: 1200, parentId: 1000, code: '1200', name: 'Accounts receivable', type: 'Current asset', balance: 492_000, active: true },
  { id: 1300, parentId: 1000, code: '1300', name: 'Inventory', type: 'Current asset', balance: 507_800, active: true },
  { id: 2000, parentId: null, code: '2000', name: 'Liabilities', type: 'Header', balance: -734_800, active: true },
  { id: 2100, parentId: 2000, code: '2100', name: 'Accounts payable', type: 'Current liability', balance: -504_300, active: true },
  { id: 2200, parentId: 2000, code: '2200', name: 'Accrued expenses', type: 'Current liability', balance: -230_500, active: true, locked: true },
  { id: 3000, parentId: null, code: '3000', name: 'Equity', type: 'Header', balance: -549_500, active: true },
];

const accountColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [
  { type: 'text', fieldId: 'code', title: 'Account', hierarchy: true, getValue: (item) => item.code, width: 150, updateValue: (item, value) => ({ ...item, code: String(value) }) },
  { type: 'text', fieldId: 'name', title: 'Name', getValue: (item) => item.name, minWidth: 260, updateValue: (item, value) => ({ ...item, name: String(value) }) },
  { type: 'text', fieldId: 'type', title: 'Type', getValue: (item) => item.type, width: 150 },
  { type: 'number', fieldId: 'balance', title: 'Balance', getValue: (item) => item.balance, width: 150, alignment: 'end', formatValue: (value) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(value ?? 0), updateValue: (item, value) => ({ ...item, balance: Number(value) }) },
  { type: 'boolean', fieldId: 'active', title: 'Active', getValue: (item) => item.active, width: 90, alignment: 'center', updateValue: (item, value) => ({ ...item, active: Boolean(value) }) },
];
const getParentKey = (item: Account): CgTreeListParentKey<number> => item.parentId === null ? none : parent(item.parentId);
const common = { data: accounts, columns: accountColumns, getKey: (item: Account) => item.id, getParentKey, defaultExpandedKeys: new Set([1000, 1100, 2000]), height: 420 } as const;

const meta: Meta = { title: 'Phase 21/TreeList', component: CgTreeList, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Bom { readonly id: number; readonly part: string; readonly quantity: number; readonly cost: number; readonly children?: ReadonlyArray<Bom> }
const bom: ReadonlyArray<Bom> = [{ id: 1, part: 'FG-100 Cargo Scanner', quantity: 1, cost: 625, children: [
  { id: 2, part: 'ASM-210 Optical assembly', quantity: 1, cost: 210, children: [{ id: 5, part: 'CMP-501 Scan engine', quantity: 1, cost: 155 }, { id: 6, part: 'CMP-502 Lens carrier', quantity: 1, cost: 55 }] },
  { id: 3, part: 'ASM-220 Enclosure', quantity: 1, cost: 95, children: [{ id: 7, part: 'CMP-610 Upper shell', quantity: 1, cost: 42 }, { id: 8, part: 'CMP-611 Lower shell', quantity: 1, cost: 53 }] },
  { id: 4, part: 'CMP-300 Controller board', quantity: 1, cost: 320 },
] }];
const bomColumns: ReadonlyArray<CgTreeListColumn<Bom, number>> = [
  { type: 'text', fieldId: 'part', title: 'Part', hierarchy: true, getValue: (item) => item.part, minWidth: 300 },
  { type: 'number', fieldId: 'quantity', title: 'Qty', getValue: (item) => item.quantity, width: 90, alignment: 'end' },
  { type: 'number', fieldId: 'cost', title: 'Unit cost', getValue: (item) => item.cost, width: 130, alignment: 'end', formatValue: (value) => `$${value?.toFixed(2) ?? '0.00'}` },
];

function LazyExample() {
  const attempts = useRef(new Map<number, number>());
  return <StoryFrame source={source} difference={difference}><CgTreeList data={[{ ...accounts[0]!, name: 'Remote chart of accounts', hasChildren: true }]} columns={accountColumns} getKey={(item) => item.id} getParentKey={getParentKey} hasChildren={(item) => !!item.hasChildren} loadChildren={async ({ parentKey, skip }) => {
    const attempt = (attempts.current.get(parentKey) ?? 0) + 1; attempts.current.set(parentKey, attempt);
    await new Promise((resolve) => setTimeout(resolve, 350));
    if (attempt === 1) throw new Error('Temporary ledger service failure');
    return { children: accounts.filter((item) => item.parentId === 1000).slice(skip, skip + 2), hasMore: skip + 2 < 3, totalCount: 3 };
  }} height={380} aria-label="Lazy chart of accounts" /></StoryFrame>;
}

function EditingExample({ popup = false, conflict = false }: { readonly popup?: boolean; readonly conflict?: boolean }) {
  const actions = useRef<CgTreeListActions<Account, number>>(null); const [items, setItems] = useState(accounts); const [attempt, setAttempt] = useState(0);
  return <StoryFrame source={source} difference={difference}><div className="story-actions"><button type="button" onClick={() => { void actions.current?.editNode(1110); }}>Edit operating account</button><button type="button" onClick={() => { void actions.current?.retryConflict(); }}>Retry conflict</button></div><CgTreeList data={items} columns={accountColumns} getKey={(item) => item.id} getParentKey={getParentKey} defaultExpandedKeys={new Set([1000, 1100])} actionsRef={actions} allowEdit editMode={popup ? 'popup' : 'inline'} editModelFactory={(item) => ({ ...item })} onUpdate={async ({ key, draft }) => { if (conflict && attempt === 0) { setAttempt(1); return { outcome: 'conflict', generalErrors: ['The account changed on the server. Review and retry.'] }; } setItems((current) => current.map((item) => item.id === key ? draft : item)); return { outcome: 'success' }; }} height={410} /></StoryFrame>;
}

function StructuralExample() {
  const actions = useRef<CgTreeListActions<Account, number>>(null); const [message, setMessage] = useState('Ready');
  return <StoryFrame source={source} difference={difference}><div className="story-actions"><button type="button" onClick={() => { void actions.current?.addChild(1000, { id: 1400, parentId: 1000, code: '1400', name: 'Prepayments', type: 'Current asset', balance: 0, active: true }); }}>Add child</button><button type="button" onClick={() => { void actions.current?.moveNode(1300, parent(1200), 0); }}>Move inventory</button><button type="button" onClick={() => { void actions.current?.deleteNode(2200); }}>Delete accrued</button><span>{message}</span></div><CgTreeList {...common} actionsRef={actions} allowAddChild allowMove allowDelete newItemFactory={() => accounts[0]!} onCreate={async () => { setMessage('Create request authorized'); return { outcome: 'success' }; }} onMove={async () => { setMessage('Move request authorized'); return { outcome: 'success' }; }} onDelete={async () => { setMessage('Delete request authorized'); return { outcome: 'success' }; }} /></StoryFrame>;
}

const provider: CgTreeListDataProvider<Account, number> = async (request) => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (request.mode === 'children' && request.parentKey.kind === 'key') { const parentKey = request.parentKey.key; const children = accounts.filter((item) => item.parentId === parentKey); return { nodes: children.map((item) => ({ item, key: item.id, parentKey: parent(parentKey), hasChildren: accounts.some((candidate) => candidate.parentId === item.id) })), totalCount: children.length, projectionComplete: true }; }
  const roots = accounts.filter((item) => item.parentId === null); return { nodes: roots.slice(request.skip, request.skip + request.take).map((item) => ({ item, key: item.id, parentKey: none, hasChildren: true })), totalCount: roots.length, projectionComplete: false };
};

function PersonalizationExample() {
  const actions = useRef<CgTreeListActions<Account, number>>(null);
  return <StoryFrame source={source} difference={difference}><div className="story-actions"><button type="button" onClick={() => { void actions.current?.setColumnVisibility('type', false); }}>Hide type</button><button type="button" onClick={() => { void actions.current?.setColumnVisibility('type', true); }}>Show type</button><button type="button" onClick={() => { void actions.current?.resizeColumn('name', 380); }}>Widen name</button><button type="button" onClick={() => { void actions.current?.fixColumn('code', 'start'); }}>Fix account</button></div><CgTreeList {...common} actionsRef={actions} /></StoryFrame>;
}

function OutputExample() {
  const actions = useRef<CgTreeListActions<Account, number>>(null); const [message, setMessage] = useState('No output generated');
  return <StoryFrame source={source} difference={difference}><div className="story-actions"><button type="button" onClick={() => { void actions.current?.exportXlsx().then((result) => setMessage(`${result.rowCount} rows, ${result.bytes.length} bytes`)); }}>Create XLSX</button><button type="button" onClick={() => { void actions.current?.print({ title: 'Chart of accounts' }).then((result) => setMessage(`${result.rowCount} printable rows`)); }}>Prepare print</button><span data-testid="tree-output-status">{message}</span></div><CgTreeList {...common} actionsRef={actions} /></StoryFrame>;
}

const virtualItems: ReadonlyArray<Account> = Array.from({ length: 220 }, (_, index) => ({ id: index + 1, parentId: null, code: `CC-${String(index + 1).padStart(4, '0')}`, name: `Cost center ${index + 1}`, type: ['Operations', 'Sales', 'Support'][index % 3]!, balance: 2500 + index * 37, active: index % 11 !== 0 }));
const wideColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [...accountColumns, ...Array.from({ length: 10 }, (_, index): CgTreeListColumn<Account, number> => ({ type: 'text', fieldId: `dimension${index + 1}`, title: `Dimension ${index + 1}`, getValue: (item) => `${item.type} ${index + 1}`, width: 150 }))];

export const FlatChartOfAccounts: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} aria-label="Chart of accounts" /></StoryFrame> };
export const NestedBillOfMaterials: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList data={bom} columns={bomColumns} getKey={(item) => item.id} getChildren={(item) => item.children} defaultExpandedKeys={new Set([1, 2, 3])} height={400} aria-label="Bill of materials" /></StoryFrame> };
export const LazyChildrenLoadMoreRetry: Story = { render: () => <LazyExample /> };
export const MultipleSelection: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} selectionMode="multiple" defaultSelectedKeys={new Set([1110, 1200])} /></StoryFrame> };
export const RecursiveChecksDisabledUnloaded: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} checkMode="recursive" defaultCheckedKeys={new Set([1000, 1100, 1110, 1120])} canCheck={(item) => !item.locked} /></StoryFrame> };
export const SiblingSorting: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} defaultSorts={[{ fieldId: 'balance', direction: 'descending' }]} /></StoryFrame> };
export const SearchAndFilterModes: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(250px, 1fr))', gap: 12 }}><CgTreeList {...common} searchText="cash" filterMode="match-only" height={300} aria-label="Match only" /><CgTreeList {...common} searchText="cash" filterMode="match-with-ancestors" height={300} aria-label="Matches and ancestors" /><CgTreeList {...common} searchText="assets" filterMode="ancestors-and-descendants" height={300} aria-label="Ancestors and descendants" /></div></StoryFrame> };
export const InlineEditing: Story = { render: () => <EditingExample /> };
export const PopupEditingConflictRecovery: Story = { render: () => <EditingExample popup conflict /> };
export const AddDeleteMoveOperations: Story = { render: () => <StructuralExample /> };
export const RootPagingProviderMode: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList columns={accountColumns} dataProvider={provider} rootPageSize={2} showPager height={400} aria-label="Provider accounts" /></StoryFrame> };
export const RowAndColumnVirtualization: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList data={virtualItems} columns={wideColumns} getKey={(item) => item.id} getParentKey={getParentKey} rowVirtualization columnVirtualization rowHeight={40} overscan={4} height={420} aria-label="Virtual cost centers" /></StoryFrame> };
export const DetailRows: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} defaultExpandedDetailKeys={new Set([1110])} renderDetail={({ item }) => <div><strong>{item.name}</strong><p>Last reconciled 29 Aug 2026 · Company CG-EG · Currency EGP</p></div>} /></StoryFrame> };
export const SiblingGroupingAndSummaries: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} defaultExpandedDetailKeys={new Set([1110])} renderDetail={({ item }) => <div><strong>{item.name}</strong> · reconciled 29 Aug 2026</div>} groups={[{ fieldId: 'type', direction: 'ascending' }]} summaries={[{ id: 'balance-total', type: 'sum', fieldId: 'balance', scope: 'visible-rows', label: 'Visible balance' }]} /></StoryFrame> };
export const ColumnPersonalization: Story = { render: () => <PersonalizationExample /> };
export const XlsxAndPrintActions: Story = { render: () => <OutputExample /> };
export const DarkCompactTheme: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <StoryFrame source={source} difference={difference}><CgTreeList {...common} size="small" checkMode="recursive" selectionMode="multiple" defaultSelectedKeys={new Set([1200])} /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgTreeList data={[{ id: 1, parentId: null, code: '١٠٠٠', name: 'الأصول', type: 'رئيسي', balance: 1284300, active: true }, { id: 2, parentId: 1, code: '١١٠٠', name: 'النقد وما في حكمه', type: 'أصل متداول', balance: 284500, active: true }, { id: 3, parentId: 1, code: '١٢٠٠', name: 'حسابات العملاء', type: 'أصل متداول', balance: 492000, active: true }]} columns={accountColumns} getKey={(item) => item.id} getParentKey={getParentKey} defaultExpandedKeys={new Set([1])} direction="rtl" height={340} aria-label="دليل الحسابات" /></StoryFrame> };
export const NarrowMobileLayout: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 320 }}><CgTreeList {...common} height={410} aria-label="Narrow chart of accounts" /></div></StoryFrame> };
export const DisabledReadOnlyPermissions: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 16, width: '100%' }}><CgTreeList {...common} disabled height={260} aria-label="Disabled accounts" /><CgTreeList {...common} readOnly allowEdit allowDelete canEdit={(item) => !item.locked} canDelete={(item) => !item.locked} height={260} aria-label="Permission limited accounts" /></div></StoryFrame> };
