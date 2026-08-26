import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgMaskedInput } from './CgMaskedInput';

const source = 'CG.CompLib/Comp/Inputs/CgMaskedInput.*; CG.CompLib/Comp/Inputs/CgMaskParser.cs; CG.CompLib/Comp/Inputs/CgMaskState.cs; CG.CompLib.Demo/Components/Pages/MaskedInputDemo.razor';
const difference = 'React performs caret-sensitive editing locally without JS interop. Controlled proposals may render briefly for caret feedback, then snap to normalized authoritative slots when rejected.';
const meta: Meta = { title: 'Phase 9/MaskedInput', component: CgMaskedInput, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ControlledMask() {
  const [value, setValue] = useState('0101234567');
  return <><CgField label="Controlled mobile"><CgMaskedInput mask="0000 000 0000" value={value} onValueChange={setValue} direction="ltr" /></CgField><output aria-label="Controlled masked value">{value}</output></>;
}

function ExternalForm() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return <><form id="masked-story-form" onSubmit={(event) => { event.preventDefault(); const result = new FormData(event.currentTarget).get('taxId'); setSubmitted(typeof result === 'string' ? result : ''); }} /><CgField label="Tax identifier"><CgMaskedInput mask="000-000-000" name="taxId" form="masked-story-form" defaultValue="123456789" includeLiterals={false} required /></CgField><button type="submit" form="masked-story-form">Submit identifier</button><button type="reset" form="masked-story-form">Reset identifier</button><output aria-label="Submitted identifier">{submitted}</output></>;
}

function RejectedMask() {
  const [attempted, setAttempted] = useState('None');
  return <><CgField label="Authoritative code" description="The parent records but rejects proposed updates."><CgMaskedInput mask="000-00" value="123" showMask="always" onValueChange={setAttempted} /></CgField><output aria-label="Attempted masked value">{attempted}</output></>;
}

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledMask /><CgField label="Uncontrolled extension"><CgMaskedInput mask="000-999" defaultValue="123" /></CgField></StoryFrame> };
export const Grammar: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Required and optional grammar"><CgMaskedInput mask={String.raw`0-9 L-l A-a *-? \0`} defaultValue="١2شx7Q#z0" showMask="always" /></CgField></StoryFrame> };
export const ShowMaskModes: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Always"><CgMaskedInput aria-label="Always mask" mask="00-00" defaultValue="1" showMask="always" /></CgField><CgField label="On focus"><CgMaskedInput aria-label="Focus mask" mask="00-00" defaultValue="1" showMask="onFocus" /></CgField><CgField label="Never"><CgMaskedInput aria-label="Never mask" mask="00-00" defaultValue="1" showMask="never" /></CgField></StoryFrame> };
export const ValueSemanticsAndForm: Story = { render: () => <StoryFrame source={source} difference={difference}><ExternalForm /><CgField label="Raw bound value"><CgMaskedInput mask="00-00" defaultValue="1234" includeLiterals={false} /></CgField><CgField label="Formatted bound value"><CgMaskedInput mask="00-00" defaultValue="12-34" includeLiterals /></CgField></StoryFrame> };
export const Validation: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Required incomplete"><CgMaskedInput mask="000-00" defaultValue="12" required /></CgField><CgField label="Invalid controlled value"><CgMaskedInput mask="0L" value="A1" allowIncomplete /></CgField><CgField label="Incomplete allowed" description="Partial values remain valid."><CgMaskedInput mask="000" defaultValue="1" allowIncomplete /></CgField></StoryFrame> };
export const Unicode: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Arabic digit and letter"><CgMaskedInput mask="0L-A9?" defaultValue="١ش-7٥!" showMask="always" /></CgField><CgField label="Astral Unicode letter"><CgMaskedInput mask="L0" defaultValue="𐐀١" showMask="always" /></CgField></StoryFrame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <StoryFrame source={source} difference={difference}><CgField label="Compact account"><CgMaskedInput mask="AAAA-0000" defaultValue="GLAC1234" size="small" density="compact" showMask="always" /></CgField></StoryFrame> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl" style={{ width: 280, maxWidth: '100%' }}><CgField label="رقم الهاتف"><CgMaskedInput aria-label="رقم الهاتف" mask="0000 000 0000" defaultValue="٠١٠١٢٣٤٥٦٧" direction="ltr" fullWidth /></CgField></div></StoryFrame> };
export const ControlledRejection: Story = { render: () => <StoryFrame source={source} difference={difference}><RejectedMask /></StoryFrame> };
