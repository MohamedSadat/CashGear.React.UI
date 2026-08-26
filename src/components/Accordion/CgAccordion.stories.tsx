import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgAccordion } from './CgAccordion';
import type { CgAccordionItemDescriptor } from './CgAccordion.types';

const source = 'CG.CompLib/Comp/Accordion/*; CG.CompLib.Demo/Components/Pages/AccordionDemo.razor';
const difference = 'React uses immutable tree descriptors, native anchors, key-controlled state, and abortable lazy loaders without a router dependency.';
const meta: Meta<typeof CgAccordion> = { title: 'Phase 11/Accordion', component: CgAccordion, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj<typeof meta>;

const panels: ReadonlyArray<CgAccordionItemDescriptor> = [
  { key: 'customer', text: 'Customer', content: <p>Customer and contact details.</p> },
  { key: 'delivery', text: 'Delivery', content: <p>Address and shipping method.</p> },
  { key: 'disabled', text: 'Archived', disabled: true, content: <p>Unavailable.</p> },
];
const tree: ReadonlyArray<CgAccordionItemDescriptor> = [
  { key: 'sales', text: 'Sales', children: [
    { key: 'orders', text: 'Orders', navigateUrl: '/sales/orders' },
    { key: 'reports', text: 'Reports', searchText: 'analysis insight', children: [{ key: 'aging', text: 'Aging report', content: <p>Receivables aging.</p> }] },
  ] },
  { key: 'purchasing', text: 'Purchasing', children: [{ key: 'vendors', text: 'Vendors', navigateUrl: '/purchasing/vendors' }] },
];

function ControlledExample() {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['customer']));
  const [selected, setSelected] = useState<string | null>('customer');
  return <CgAccordion items={panels} expandedKeys={expanded} onExpandedKeysChange={setExpanded} selectedKey={selected} onSelectedKeyChange={setSelected} />;
}

export const ControlledDisclosure: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /></StoryFrame> };
export const NestedTree: Story = { args: { items: tree, defaultExpandedKeys: new Set(['sales', 'reports']), currentLocation: '/sales/orders' } };
export const Filtered: Story = { args: { items: tree, defaultExpandedKeys: new Set(['sales']), defaultFilterText: 'aging', noMatchContent: <p>No matching sections.</p> } };
export const LazyFailure: Story = { args: { items: [{ key: 'remote', text: 'Remote children', hasChildren: true }], loadChildren: async () => { await Promise.resolve(); throw new Error('Demo load failure'); } } };
export const SingleReadOnly: Story = { args: { items: panels, expansionMode: 'single-sibling', defaultExpandedKeys: new Set(['customer']), readOnly: true } };
export const Empty: Story = { args: { items: [], emptyContent: <p>No sections.</p> } };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, args: { items: panels, size: 'small', defaultExpandedKeys: new Set(['delivery']) } };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 320 }}><CgAccordion direction="rtl" items={[{ key: 'مبيعات', text: 'المبيعات', children: [{ key: 'طلبات', text: 'الطلبات', content: <p>تفاصيل الطلبات</p> }] }]} defaultExpandedKeys={new Set(['مبيعات', 'طلبات'])} /></div> };
