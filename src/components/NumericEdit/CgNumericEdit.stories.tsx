import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgNumericEdit } from './CgNumericEdit';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'No exact source; informed by CG.CompLib/Comp/Inputs/CgNumberInput.* and CgSpinEdit.*';
const difference = 'New number|null editor using Intl.NumberFormat and IEEE-754 arithmetic.';
const meta = { title: 'Phase 1–2/NumericEdit', component: CgNumericEdit, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgNumericEdit>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [value, setValue] = useState<number | null>(1234.5); return <CgField label="Controlled EGP"><CgNumericEdit value={value} onValueChange={setValue} locale="ar-EG" formatStyle="currency" currency="EGP" precision={2} min={0} /></CgField>; }
export const ControlledAndUncontrolled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /><CgField label="Empty nullable"><CgNumericEdit defaultValue={null} /></CgField></StoryFrame> };
export const FormatsAndStates: Story = { render: () => <StoryFrame source={source} difference={difference}><CgNumericEdit aria-label="Percent" formatStyle="percent" defaultValue={0.42} /><CgNumericEdit aria-label="Read only" defaultValue={12} readOnly /><CgNumericEdit aria-label="Disabled" disabled /><CgNumericEdit aria-label="Required invalid" required validationState="error" /><CgNumericEdit aria-label="Large" size="large" defaultValue={999999.99} /></StoryFrame> };
export const ArabicRtlAndDrafts: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="المبلغ"><CgNumericEdit locale="ar-EG" precision={2} defaultValue={123.5} /></CgField></div><small>Try incomplete drafts such as “-” or a trailing locale decimal, then blur or press Enter.</small></StoryFrame> };
