import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgTextBox } from './CgTextBox';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgTextBox.*; CG.CompLib.Demo/Components/Pages/TextBoxDemo.razor';
const difference = 'Labels and validation messages are composed through CgField.';
const meta = { title: 'Phase 1–2/TextBox', component: CgTextBox, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgTextBox>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [value, setValue] = useState('Controlled'); return <CgField label="Controlled"><CgTextBox value={value} onValueChange={setValue} clearButton="auto" /></CgField>; }
export const Controlled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /></StoryFrame> };
export const UncontrolledAndCommands: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Password"><CgTextBox defaultValue="secret" type="password" passwordReveal clearButton="auto" /></CgField><CgField label="Custom command"><CgTextBox defaultValue="ABC" buttons={[{ key: 'validate', icon: 'check', ariaLabel: 'Validate' }]} /></CgField></StoryFrame> };
export const StatesAndSizes: Story = { render: () => <StoryFrame source={source} difference={difference}><CgTextBox aria-label="Small" size="small" placeholder="Empty" /><CgTextBox aria-label="Large" size="large" defaultValue={'Long content '.repeat(8)} /><CgTextBox aria-label="Read only" defaultValue="Read only" readOnly /><CgTextBox aria-label="Disabled" disabled /><CgTextBox aria-label="Invalid" required validationState="error" /></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="بند عربي" required errorMessage="القيمة مطلوبة"><CgTextBox placeholder="أدخل القيمة" /></CgField></div></StoryFrame> };
