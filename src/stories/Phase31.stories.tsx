import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgCalendar, CgDateRangePresetSelect, CgField } from '../index';
import type { CgDateRangePresetSelection } from '../index';
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const [dates, setDates] = useState<readonly string[]>(['2026-09-03']);
  const [selection, setSelection] = useState<CgDateRangePresetSelection | null>(null);
  return <main dir={direction} style={{ display: 'grid', gap: 16, maxWidth: 600 }}>
    <h1 style={{ fontSize: 24, margin: 0 }}>Date selection</h1>
    <p>Select a date, Ctrl-click to toggle, or Shift-click to select a range.</p>
    <h2 style={{ fontSize: 18, margin: 0 }}>Selected days</h2>
    <CgCalendar selectionMode="multiple" value={dates} onValueChange={setDates} today="2026-09-14" direction={direction} showClearButton isDateDisabled={date => date === '2026-09-05'} />
    <output aria-label="Selected dates">{dates.join(', ') || 'No dates selected'}</output>
    <CgField label="Reporting period"><CgDateRangePresetSelect anchorDate="2026-09-14" minDate="2026-08-01" direction={direction} onSelectionChange={setSelection} /></CgField>
    <output aria-label="Selected range">{selection?.range ? `${selection.range.start} to ${selection.range.end}` : 'Choose a reporting period'}</output>
  </main>;
}
export default { title: 'Phase 31/Dates', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};
export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
