import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgButtonMenuItem } from '../DropDownButton';
import { CgSplitButton } from './CgSplitButton';

const source = 'CG.CompLib/Comp/Buttons/CgSplitButton.*; CG.CompLib.Demo/Components/Pages/SplitButtonDemo.razor';
const difference = 'React preserves the primary native button/form contract and gives the menu toggle an independent CgFlyout surface.';
const meta: Meta = { title: 'Phase 10/SplitButton', component: CgSplitButton, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const items: ReadonlyArray<CgButtonMenuItem> = [
  { key: 'save-close', text: 'Save and close' },
  { key: 'save-new', text: 'Save and create another' },
];

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSplitButton items={items} intent="primary">Save</CgSplitButton></StoryFrame> };
export const ToggleAtStart: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSplitButton items={items} togglePosition="start">Print</CgSplitButton></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgSplitButton items={items} direction="rtl" togglePosition="start">حفظ</CgSplitButton></StoryFrame> };
