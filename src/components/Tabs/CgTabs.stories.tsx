import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTabs } from './CgTabs';
import type { CgTabDescriptor } from './CgTabs.types';

const source = 'CG.CompLib/Comp/Tabs/*; CG.CompLib.Demo/Components/Pages/TabsDemo.razor';
const difference = 'Immutable keyed descriptors replace CgTabPage declarations; close and reorder are caller-owned requests.';
const meta: Meta<typeof CgTabs> = { title: 'Phase 11/Tabs', component: CgTabs, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj<typeof meta>;

const baseTabs: ReadonlyArray<CgTabDescriptor> = [
  { key: 'general', text: 'General', icon: 'check', content: <p>General settings</p> },
  { key: 'lines', text: 'Order lines', closable: true, content: <label>Line state <input defaultValue="draft" /></label> },
  { key: 'audit', text: 'Audit', disabled: true, content: <p>Audit</p> },
];

function ControlledTabs() {
  const [tabs, setTabs] = useState(baseTabs);
  const [active, setActive] = useState<string | null>('general');
  return <CgTabs tabs={tabs} activeKey={active} onActiveKeyChange={setActive} contentMode="on-demand" reorderable onCloseRequest={({ key }) => setTabs((current) => current.filter((tab) => tab.key !== key))} onReorder={({ fromIndex, toIndex }) => setTabs((current) => { const next = [...current]; const [item] = next.splice(fromIndex, 1); if (item) next.splice(toIndex, 0, item); return next; })} />;
}

export const ControlledClosableReorderable: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 620 }}><ControlledTabs /></div></StoryFrame> };
export const Vertical: Story = { args: { tabs: baseTabs, position: 'left', defaultActiveKey: 'general', contentMode: 'all', style: { width: 560, minHeight: 240 } } };
export const OverflowButtons: Story = { args: { tabs: Array.from({ length: 12 }, (_, index) => ({ key: `tab-${index}`, text: `Warehouse section ${index + 1}`, content: `Panel ${index + 1}` })), scrollMode: 'buttons', style: { width: 420 } } };
export const Empty: Story = { args: { tabs: [], emptyContent: <p>No tabs are available.</p> } };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, args: { tabs: baseTabs, defaultActiveKey: 'lines' } };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, args: { tabs: [{ key: 'عام', text: 'عام', content: 'الإعدادات العامة' }, { key: 'سطور', text: 'السطور', closable: true, content: 'سطور الطلب' }], direction: 'rtl' } };
