import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgRadioGroup } from './CgRadioGroup';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgRadioGroup.*; CG.CompLib.Demo/Components/Pages/RadioDemo.razor';
const difference = 'Generic React options replace reflection-based field-name mapping.';
const meta = { title: 'Phase 1–2/RadioGroup', component: CgRadioGroup, parameters: parityParameters(source, difference), args: { options: [] } } satisfies Meta<typeof CgRadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
const options = [{ value: 1, label: 'Low' }, { value: 2, label: 'Normal' }, { value: 3, label: 'High', disabled: true }];

function ControlledExample() { const [value, setValue] = useState<number | undefined>(1); return <CgRadioGroup legend="Controlled priority" value={value} onValueChange={setValue} orientation="horizontal" options={options} />; }
export const ControlledAndUncontrolled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /><CgRadioGroup legend="Uncontrolled" defaultValue={2} options={options} /></StoryFrame> };
export const RequiredReadOnlyAndKeyboard: Story = { render: () => <StoryFrame source={source} difference={difference}><CgRadioGroup legend="Required invalid" required validationState="error" options={options} /><CgRadioGroup legend="Read only" readOnly defaultValue={1} options={options} /><small>Focus an option and use arrow keys; disabled options are skipped.</small></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgRadioGroup legend="طريقة الشحن" direction="rtl" orientation="horizontal" defaultValue="sea" options={[{ value: 'sea', label: 'بحري' }, { value: 'air', label: 'جوي' }]} /></div></StoryFrame> };
