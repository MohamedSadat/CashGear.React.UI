import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CgCheckedState } from './CgCheckBox.types';
import { CgCheckBox } from './CgCheckBox';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgCheckBox.*; CG.CompLib.Demo/Components/Pages/CheckBoxDemo.razor';
const difference = 'Uses an idiomatic boolean/mixed model; Razor numeric/string mappings are omitted.';
const meta = { title: 'Phase 1–2/CheckBox', component: CgCheckBox, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgCheckBox>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [checked, setChecked] = useState<CgCheckedState>('indeterminate'); return <CgCheckBox checked={checked} onCheckedChange={setChecked} cycleIndeterminate label="Controlled three-state" description="Cycles mixed, checked, unchecked" />; }
export const ControlledAndUncontrolled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /><CgCheckBox defaultChecked label="Uncontrolled" /></StoryFrame> };
export const StatesAndSizes: Story = { render: () => <StoryFrame source={source} difference={difference}><CgCheckBox size="small" label="Small" /><CgCheckBox size="large" label="Large" /><CgCheckBox label="Required invalid" required validationState="error" /><CgCheckBox label="Read only" defaultChecked readOnly /><CgCheckBox label="Disabled" disabled /></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgCheckBox label="موافقة" description="اختيار مطلوب" required /></div></StoryFrame> };
