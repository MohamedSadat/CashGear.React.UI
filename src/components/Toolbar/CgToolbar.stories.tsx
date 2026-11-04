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

const columnItems: ReadonlyArray<CgToolbarItem> = [
  { name: 'paste', text: 'Paste', icon: 'paste', stacked: true, onClick: () => undefined, children: [{ name: 'values', text: 'Paste values' }] },
  { name: 'cut', text: 'Cut', icon: 'cut' },
  { name: 'copy', text: 'Copy', icon: 'copy' },
  { name: 'painter', text: 'Format painter', icon: 'format-painter' },
];
const rowItems: ReadonlyArray<CgToolbarItem> = [
  { name: 'name', ownsKeyboard: true, render: () => <input aria-label="Name" defaultValue="Typing a space works here" style={{ inlineSize: '12rem' }} /> },
  { name: 'bold', tooltip: 'Bold', icon: 'text-bold', checked: true },
  { name: 'italic', tooltip: 'Italic', icon: 'text-italic', beginRow: true, checked: false },
  { name: 'flyout', text: 'Flyout', icon: 'fill-color', renderFlyout: ({ close }) => <button type="button" onClick={close}>Close this flyout</button> },
  { name: 'split', text: 'Split', icon: 'border-all', onClick: () => undefined, renderFlyout: () => <p style={{ margin: 0 }}>Any content</p> },
];

export const Layouts: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 12 }}><CgToolbar ariaLabel="Columns" size="small" layout="columns" autoOverflow={false} autoCollapseText={false} items={columnItems} /><CgToolbar ariaLabel="Rows" size="small" layout="rows" autoOverflow={false} autoCollapseText={false} items={rowItems} /></div></StoryFrame> };
