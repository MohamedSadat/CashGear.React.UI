import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgMenu } from './CgMenu';
import type { CgMenuItem } from './CgMenu.types';

const source = 'CG.CompLib/Comp/Menu/*; CG.CompLib.Demo/Components/Pages/MenuDemo.razor';
const difference = 'React uses immutable descriptors, native links, controlled location input, ResizeObserver, and the shared Flyout menu engine without a router dependency.';
const meta: Meta = { title: 'Phase 10/Menu', component: CgMenu, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const items: ReadonlyArray<CgMenuItem> = [
  { key: 'home', text: 'Home', icon: 'check', navigateUrl: '/' },
  { key: 'sales', text: 'Sales', children: [
    { key: 'orders', text: 'Orders', navigateUrl: '/orders' },
    { key: 'reports', text: 'Reports', children: [{ key: 'aging', text: 'Aging report' }] },
  ] },
  { key: 'settings', text: 'Settings', adaptivePriority: -1 },
];

function ControlledApplicationMenu() {
  const [selected, setSelected] = useState<string | null>('home');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  return <CgMenu items={items} semanticMode="application-menu" submenuTrigger="hover" selectionMode="manual" selectedKey={selected} onSelectedKeyChange={setSelected} expandedKeys={expanded} onExpandedKeysChange={setExpanded} title="Cash Gear" />;
}

export const HorizontalNavigation: Story = { render: () => <StoryFrame source={source} difference={difference}><CgMenu items={items} currentLocation="/orders" /></StoryFrame> };
export const ApplicationMenu: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledApplicationMenu /></StoryFrame> };
export const Mobile: Story = { render: () => <StoryFrame source={source} difference={difference}><CgMenu items={items} displayMode="mobile" title="Modules" /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgMenu items={items} direction="rtl" title="القائمة" /></StoryFrame> };
