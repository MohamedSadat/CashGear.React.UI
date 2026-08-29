import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgPopup } from '../Popup';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgDateRangeValue } from '../../types';
import { CgDateRangePicker } from './CgDateRangePicker';

const source = 'CG.CompLib/Components/Editors/DateRangePicker/*; CG.CompLib.Demo/Components/Pages/DateRangePickerDemo.razor';
const difference = 'React submits two canonical native proxies and keeps incomplete or malformed external ranges observable instead of normalizing them.';
const meta: Meta = { title: 'Phase 16/DateRangePicker', component: CgDateRangePicker, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ControlledFixture({ immediate = false }: { immediate?: boolean }) {
  const [value, setValue] = useState<CgDateRangeValue>({ start: '2026-08-01', end: '2026-08-21' });
  return <StoryFrame source={source} difference={difference}><CgField label={immediate ? 'Immediate posting period' : 'Explicit posting period'} description="Type a range or select it from the calendar."><CgDateRangePicker aria-label="Posting period" value={value} onValueChange={setValue} commitMode={immediate ? 'immediate' : 'explicit'} today="2026-08-21" editFormat="dd/MM/yyyy" displayFormat="d MMM yyyy" showPresets defaultOpen /></CgField><output aria-label="Canonical posting period">{value?.start ?? '—'} / {value?.end ?? '—'}</output></StoryFrame>;
}

export const ExplicitWithPresets: Story = { render: () => <ControlledFixture /> };
export const ImmediateSelection: Story = { render: () => <ControlledFixture immediate /> };
export const ValidationAndRestrictions: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Required approval window"><CgDateRangePicker aria-label="Approval window" required startName="approvalStart" endName="approvalEnd" today="2026-08-21" editFormat="yyyy-MM-dd" minDate="2026-08-01" maxDate="2026-09-30" minimumRangeDays={3} maximumRangeDays={21} isDateDisabled={(date) => date.endsWith('-15')} defaultValue={{ start: '2026-09-10', end: '2026-08-10' }} /></CgField></StoryFrame> };
export const ArabicRtlCompact: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="فترة الترحيل"><CgDateRangePicker aria-label="فترة الترحيل" locale="ar-EG" direction="rtl" density="compact" today="2026-08-21" defaultValue={{ start: '2026-08-01', end: '2026-08-21' }} showPresets defaultOpen /></CgField></StoryFrame>, globals: { direction: 'rtl' } };
export const NestedOverlay: Story = { render: () => <CgPopup defaultOpen headerText="Create reporting period"><CgField label="Period inside dialog"><CgDateRangePicker aria-label="Nested period" today="2026-08-21" defaultValue={{ start: '2026-08-01', end: '2026-08-21' }} defaultOpen showPresets /></CgField></CgPopup> };
export const Narrow: Story = { render: () => <div style={{ width: 330 }}><ControlledFixture /></div>, parameters: { viewport: { defaultViewport: 'mobile1' } } };
