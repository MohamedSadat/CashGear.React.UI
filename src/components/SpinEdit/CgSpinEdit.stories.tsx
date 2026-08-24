import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgSpinEdit } from './CgSpinEdit';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgSpinEdit.*; CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor';
const difference = 'Null stepping matches Razor; pointer press-and-hold is a React extension and can be disabled with repeatOnHold.';
const meta = { title: 'Phase 1–2/SpinEdit', component: CgSpinEdit, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSpinEdit>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [value, setValue] = useState<number | null>(null); return <CgField label="Controlled quantity"><CgSpinEdit value={value} onValueChange={setValue} min={5} max={50} step={5} pageStep={20} /></CgField>; }
export const ControlledAndUncontrolled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /><CgSpinEdit aria-label="Uncontrolled" defaultValue={10} /></StoryFrame> };
export const KeyboardAndStates: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSpinEdit aria-label="Keyboard stepping" defaultValue={5} step={1} pageStep={10} /><CgSpinEdit aria-label="Read only" defaultValue={10} readOnly /><CgSpinEdit aria-label="Disabled" disabled /><CgSpinEdit aria-label="Required invalid" required validationState="error" /><small>Use Arrow Up/Down and Page Up/Down in the first editor.</small></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgSpinEdit aria-label="الكمية" locale="ar-EG" defaultValue={12} /></div></StoryFrame> };
export const PointerHold: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSpinEdit aria-label="Hold to repeat" defaultValue={0} min={0} max={100} /><CgSpinEdit aria-label="Single pointer step" defaultValue={0} repeatOnHold={false} /><small>Hold either editor button; the first accelerates and the second steps once.</small></StoryFrame> };
