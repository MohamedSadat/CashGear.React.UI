import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTimeEdit } from './CgTimeEdit';
import type { CgTimeValue } from './CgTimeEdit.types';

const source = 'CashGear.Blazor.UI@f8e7235b/CashGear.Blazor.UI/Components/CgTimeEdit.razor';
const difference = 'React binds canonical HH:mm:ss.SSS clock strings without Date, uses Intl for localized digits and periods, and composes the shared editor overlay and native form-proxy infrastructure.';
const meta = { title: 'Phase 24/TimeEdit', component: CgTimeEdit, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgTimeEdit>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledTime() {
  const [value, setValue] = useState<CgTimeValue | null>('13:17:23.456');
  const [open, setOpen] = useState(false);
  return <><CgField label="Controlled shift start"><CgTimeEdit value={value} open={open} onOpenChange={setOpen} onValueChange={setValue} editFormat="h:mm:ss tt" locale="en-US" showSeconds /></CgField><output aria-label="Canonical time">{value ?? 'None'}</output></>;
}

function TimeForm() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return <form onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get('cutoff'); setSubmitted(typeof value === 'string' ? value : 'None'); }}><CgField label="Required cutoff"><CgTimeEdit name="cutoff" required defaultValue="17:05:42.250" editFormat="HH:mm" displayFormat="HH:mm" /></CgField><button type="submit">Submit time</button><button type="reset">Reset time</button><output aria-label="Submitted canonical time">{submitted}</output></form>;
}

export const Primary: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Posting time"><CgTimeEdit defaultValue="13:17:23.456" editFormat="h:mm:ss tt" locale="en-US" showSeconds minuteStep={15} defaultOpen /></CgField></StoryFrame> };
export const Controlled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledTime /></StoryFrame> };
export const ValidationAndForm: Story = { render: () => <StoryFrame source={source} difference={difference}><TimeForm /><CgField label="Outside processing window" errorMessage="Choose a time between 08:00 and 18:00."><CgTimeEdit value="20:30:00.000" minTime="08:00:00.000" maxTime="18:00:00.000" editFormat="HH:mm" validationState="error" /></CgField></StoryFrame> };
export const StatesAndCustomButton: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Command time"><CgTimeEdit defaultValue="09:45:00.000" editFormat="HH:mm" buttons={[{ key: 'inspect', text: 'i', ariaLabel: 'Inspect time', placement: 'start' }]} /></CgField><CgField label="Read-only"><CgTimeEdit defaultValue="10:15:00.000" readOnly /></CgField><CgField label="Disabled"><CgTimeEdit defaultValue="11:30:00.000" disabled /></CgField></StoryFrame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <StoryFrame source={source} difference={difference}><CgField label="Compact time"><CgTimeEdit defaultValue="21:07:09.125" size="small" density="compact" showSeconds defaultOpen /></CgField></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="وقت الترحيل"><CgTimeEdit aria-label="وقت الترحيل" defaultValue="13:17:23.456" locale="ar-EG" direction="rtl" showSeconds defaultOpen /></CgField></div></StoryFrame> };
export const Narrow: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 260, maxWidth: '100%' }}><CgField label="Narrow time"><CgTimeEdit defaultValue="13:17:23.456" editFormat="HH:mm:ss" showSeconds fullWidth defaultOpen /></CgField></div></StoryFrame> };
