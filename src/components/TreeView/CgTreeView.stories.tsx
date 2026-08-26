import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTreeView } from './CgTreeView';
import type { CgTreeViewActions, CgTreeViewNodeDescriptor } from './CgTreeView.types';

const source = 'CG.CompLib/Comp/TreeView/*; CG.CompLib.Tests/CgTreeViewTests.cs; CG.CompLib.Demo/Components/Pages/TreeViewDemo.razor';
const difference = 'React uses immutable nested or flat descriptors, ReadonlySet-controlled state, SSR-safe IDs, safe text fragments, and the Phase 10 ContextMenu engine; Razor node registration is intentionally not exposed.';
const meta: Meta<typeof CgTreeView> = {
  title: 'Phase 12/TreeView',
  component: CgTreeView,
  parameters: parityParameters(source, difference),
};
export default meta;
type Story = StoryObj<typeof meta>;

const catalog: ReadonlyArray<CgTreeViewNodeDescriptor> = [
  { key: 'products', text: 'Products', icon: <span>▣</span>, children: [
    { key: 'hardware', text: 'Hardware', icon: <span>▣</span>, children: [
      { key: 'keyboard', text: 'Mechanical Keyboard', searchText: 'typing usb' },
      { key: 'mouse', text: 'Wireless Mouse', searchText: 'pointing bluetooth' },
      { key: 'legacy', text: 'Legacy Adapter', disabled: true },
    ] },
    { key: 'software', text: 'Software', icon: <span>▣</span>, children: [
      { key: 'accounting', text: 'Accounting Suite' },
      { key: 'crm', text: 'CRM' },
    ] },
  ] },
  { key: 'services', text: 'Services', children: [
    { key: 'installation', text: 'Installation' },
    { key: 'support', text: 'Support' },
  ] },
];

const flat: ReadonlyArray<CgTreeViewNodeDescriptor> = [
  { key: 'company', text: 'CashGear', parentKey: null },
  { key: 'finance', text: 'Finance', parentKey: 'company' },
  { key: 'sales', text: 'Sales', parentKey: 'company' },
  { key: 'receivables', text: 'Receivables', parentKey: 'finance' },
  { key: 'payables', text: 'Payables', parentKey: 'finance' },
];

function ControlledExample() {
  const [selected, setSelected] = useState<string | null>('keyboard');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['products', 'hardware']));
  return <StoryFrame source={source} difference={difference}>
    <CgTreeView nodes={catalog} selectedKey={selected} onSelectedKeyChange={setSelected} expandedKeys={expanded} onExpandedKeysChange={setExpanded} aria-label="Controlled product tree" />
    <p data-testid="tree-state">Selected: {selected ?? 'none'}; expanded: {[...expanded].join(', ') || 'none'}</p>
  </StoryFrame>;
}

function DynamicExample() {
  const [showMouse, setShowMouse] = useState(true);
  const nodes: ReadonlyArray<CgTreeViewNodeDescriptor> = [{ key: 'root', text: 'Devices', children: [
    { key: 'keyboard', text: 'Keyboard' },
    ...(showMouse ? [{ key: 'mouse', text: 'Mouse' }] : []),
  ] }];
  return <StoryFrame source={source} difference={difference}>
    <button type="button" data-testid="toggle-mouse" onClick={() => setShowMouse((value) => !value)}>Toggle mouse</button>
    <CgTreeView nodes={nodes} defaultExpandedKeys={new Set(['root'])} defaultSelectedKey="mouse" />
  </StoryFrame>;
}

function KeyboardFocusExample() {
  const actions = useRef<CgTreeViewActions>(null);
  useEffect(() => { void actions.current?.focus('hardware'); }, []);
  return <CgTreeView nodes={catalog} actionsRef={actions} defaultExpandedKeys={new Set(['products'])} aria-label="Keyboard focused tree" />;
}

export const NestedDescriptors: Story = { args: { nodes: catalog, defaultExpandedKeys: new Set(['products', 'hardware']), 'aria-label': 'Product catalog' } };
export const FlatParentKeys: Story = { args: { nodes: flat, defaultExpandedKeys: new Set(['company', 'finance']), size: 'small', 'aria-label': 'Organization tree' } };
export const ControlledSelectionExpansion: Story = { render: () => <ControlledExample /> };
export const MultipleChecking: Story = { args: { nodes: catalog, checkMode: 'multiple', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard']) } };
export const RecursiveChecking: Story = { args: { nodes: catalog, checkMode: 'recursive', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard']) } };
export const Filtering: Story = { args: { nodes: catalog, showFilterPanel: true, defaultFilterText: 'bluetooth', defaultExpandedKeys: new Set(['services']) } };
export const DynamicRemoval: Story = { render: () => <DynamicExample /> };
export const ContextMenus: Story = { args: { nodes: catalog, contextMenuAreas: 'all', checkMode: 'multiple', defaultExpandedKeys: new Set(['products']) } };
export const DisabledReadOnly: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 16 }}><CgTreeView nodes={catalog} disabled defaultExpandedKeys={new Set(['products'])} aria-label="Disabled tree" /><CgTreeView nodes={catalog} readOnly defaultExpandedKeys={new Set(['products'])} aria-label="Read-only tree" /></div></StoryFrame> };
export const EmptyTree: Story = { args: { nodes: [], renderEmpty: () => <p data-testid="tree-empty">Nothing to display.</p> } };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, args: { nodes: catalog, size: 'small', checkMode: 'recursive', defaultExpandedKeys: new Set(['products', 'hardware']), defaultCheckedKeys: new Set(['keyboard', 'mouse', 'hardware']) } };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 310 }}><CgTreeView direction="rtl" nodes={[{ key: 'sales-ar', text: 'المبيعات والتوزيع', children: [{ key: 'orders-ar', text: 'طلبات العملاء طويلة الوصف التي تلتف داخل المساحة الضيقة' }, { key: 'invoices-ar', text: 'الفواتير' }] }]} defaultExpandedKeys={new Set(['sales-ar'])} aria-label="شجرة التنقل" /></div> };
export const NarrowWrappingLabels: Story = { render: () => <div style={{ width: 260 }}><CgTreeView nodes={[{ key: 'long', text: 'A very long operational category that wraps naturally in a narrow sidebar', children: [{ key: 'detail', text: 'Detailed child label with additional explanatory wording' }] }]} defaultExpandedKeys={new Set(['long'])} /></div> };
export const KeyboardFocusedState: Story = { render: () => <KeyboardFocusExample /> };
export const SelectedExpanded: Story = { args: { nodes: catalog, defaultSelectedKey: 'mouse', defaultExpandedKeys: new Set(['products', 'hardware']) } };
