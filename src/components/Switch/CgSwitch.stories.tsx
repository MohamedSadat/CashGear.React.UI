import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgSwitch } from './CgSwitch';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgCheckBox.* switch mode; CheckBoxDemo.razor';
const difference = 'Extracted as a separate two-state React component; the source has no pending state.';
const meta = { title: 'Phase 1–2/Switch', component: CgSwitch, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSwitch>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [checked, setChecked] = useState(true); return <CgSwitch checked={checked} onCheckedChange={setChecked} label="Controlled" />; }
export const ControlledAndUncontrolled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /><CgSwitch label="Uncontrolled" /></StoryFrame> };
export const StatesSizesAndArabic: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSwitch size="small" label="Small" /><CgSwitch size="large" label="Large" /><CgSwitch required validationState="error" label="Required invalid" /><CgSwitch defaultChecked readOnly label="Read only" /><CgSwitch disabled label="Disabled" /><div dir="rtl"><CgSwitch label="تفعيل" /></div></StoryFrame> };
