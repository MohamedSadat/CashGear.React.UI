import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgDropDownButton } from './CgDropDownButton';
import type { CgButtonMenuItem } from './CgDropDownButton.types';

const source = 'CG.CompLib/Comp/Buttons/CgDropDownButton.*; CG.CompLib.Demo/Components/Pages/DropDownButtonDemo.razor';
const difference = 'React uses immutable descriptors, CgFlyout ownership, async keep-open results, and render callbacks instead of Razor fragments.';
const meta: Meta = { title: 'Phase 10/DropDownButton', component: CgDropDownButton, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const items: ReadonlyArray<CgButtonMenuItem> = [
  { key: 'new', text: 'New invoice', icon: 'check' },
  { key: 'export', text: 'Export', children: [{ key: 'pdf', text: 'PDF' }, { key: 'excel', text: 'Excel' }] },
  { key: 'archived', text: 'Include archived', checked: false, beginGroup: true },
];

export const Commands: Story = { render: () => <StoryFrame source={source} difference={difference}><CgDropDownButton items={items} intent="primary">Actions</CgDropDownButton></StoryFrame> };
export const ArbitraryContent: Story = { render: () => <StoryFrame source={source} difference={difference}><CgDropDownButton renderFlyout={({ close }) => <div style={{ padding: 12 }}><label>Period <input /></label><button type="button" onClick={close}>Apply</button></div>}>Filters</CgDropDownButton></StoryFrame> };
export const BusyCommand: Story = { render: () => <StoryFrame source={source} difference={difference}><CgDropDownButton items={items} onItemClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}>Async actions</CgDropDownButton></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgDropDownButton items={items} direction="rtl">الإجراءات</CgDropDownButton></StoryFrame> };
