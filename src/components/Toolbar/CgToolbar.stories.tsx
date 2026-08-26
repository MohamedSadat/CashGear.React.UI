import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgPopup } from '../Popup';
import { CgToolbar } from './CgToolbar';
import type { CgToolbarItem } from './CgToolbar.types';

const source = 'CG.CompLib/Comp/Toolbar/*; CG.CompLib.Demo/Components/Pages/ToolbarDemo.razor; ToolbarAdaptiveDemo.razor';
const difference = 'React uses immutable descriptors, a pure stage planner, ResizeObserver, semantic anchors, and shared button-menu surfaces.';
const meta: Meta = { title: 'Phase 10/Toolbar', component: CgToolbar, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const items: ReadonlyArray<CgToolbarItem> = [
  { name: 'new', text: 'New invoice', adaptiveText: 'New', icon: 'check', adaptivePriority: 10 },
  { name: 'save', text: 'Save', icon: 'check', adaptivePriority: 20 },
  { name: 'export', text: 'Export', adaptiveText: 'Export', children: [{ name: 'pdf', text: 'PDF' }, { name: 'excel', text: 'Excel' }] },
  { name: 'post', text: 'Post', icon: 'check', children: [{ name: 'post-close', text: 'Post and close' }], onClick: () => undefined },
  { name: 'active', text: 'Active', checked: true, beginGroup: true },
  { name: 'help', text: 'Help', alignment: 'end', overflowBehavior: 'never' },
];

export const Full: Story = { render: () => <StoryFrame source={source} difference={difference}><CgToolbar title="Sales order" items={items} /></StoryFrame> };
export const NarrowOverflow: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 280 }}><CgToolbar items={items} /></div></StoryFrame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <StoryFrame source={source} difference={difference}><CgToolbar items={items} size="small" /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgToolbar title="أمر البيع" items={items} direction="rtl" /></StoryFrame> };
export const NarrowPopup: Story = { render: () => <StoryFrame source={source} difference={difference}><CgPopup defaultOpen headerText="Toolbar in popup" width={460}><CgToolbar items={items} /></CgPopup></StoryFrame> };
