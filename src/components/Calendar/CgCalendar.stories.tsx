import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgDateRangeValue, CgDateValue } from '../../types';
import { CgCalendar } from './CgCalendar';

const source = 'CG.CompLib/Components/Editors/Calendar/*; CG.CompLib.Tests/Components/Editors/Calendar*';
const difference = 'React exposes the promoted civil-date engine directly and uses canonical YYYY-MM-DD strings with dependency-free Intl formatting.';
const meta: Meta = { title: 'Phase 16/Calendar', component: CgCalendar, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function SingleAndRangeFixture() {
  const [single, setSingle] = useState<CgDateValue | null>('2026-08-21');
  const [range, setRange] = useState<CgDateRangeValue>({ start: '2026-08-10', end: '2026-08-21' });
  return <StoryFrame source={source} difference={difference}>
    <div><h3>Settlement date</h3><CgCalendar value={single} onValueChange={setSingle} today="2026-08-21" defaultVisibleDate="2026-08-01" showTodayButton showClearButton /></div>
    <div><h3>Posting period</h3><CgCalendar selectionMode="range" value={range} onValueChange={setRange} today="2026-08-21" defaultVisibleDate="2026-08-01" calendarCount={2} /></div>
  </StoryFrame>;
}

export const SingleAndRange: Story = { render: () => <SingleAndRangeFixture /> };
export const RestrictionsAndCustomDays: Story = { render: () => <StoryFrame source={source} difference={difference}><CgCalendar selectionMode="range" today="2026-08-21" defaultVisibleDate="2026-08-01" minDate="2026-08-05" maxDate="2026-09-20" isDateDisabled={(date) => date.endsWith('-09') || date.endsWith('-16')} minimumRangeDays={3} maximumRangeDays={14} renderDay={(day) => <span title={day.isDisabled ? 'Closed ledger day' : undefined}>{Number(day.date.slice(-2))}</span>} /></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><CgCalendar selectionMode="range" locale="ar-EG" direction="rtl" density="comfortable" today="2026-08-21" defaultVisibleDate="2026-08-01" calendarCount={2} /></StoryFrame>, globals: { direction: 'rtl' } };
export const DarkCompact: Story = { render: () => <StoryFrame source={source} difference={difference}><CgCalendar density="compact" today="2026-08-21" defaultVisibleDate="2026-08-01" value="2026-08-21" /></StoryFrame>, globals: { theme: 'dark', density: 'compact' } };
export const NarrowTwoCalendar: Story = { render: () => <div style={{ width: 340 }}><StoryFrame source={source} difference={difference}><CgCalendar selectionMode="range" today="2026-08-21" defaultVisibleDate="2026-08-01" calendarCount={2} /></StoryFrame></div>, parameters: { viewport: { defaultViewport: 'mobile1' } } };
