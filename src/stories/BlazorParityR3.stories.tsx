import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgCalendar } from '../components/Calendar';
import type { CgCalendarVisibleRangeChangeDetails } from '../components/Calendar';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Editors/Calendar: CgCalendar.razor.cs, CgCalendarTypes.cs, CgCalendarCore.cs';
const difference = 'ViewMode becomes selectionView; RenderFragment templates become render props; VisibleRangeChanged becomes onVisibleRangeChange.';
const meta: Meta = { title: 'Blazor parity 2026-11/Calendar', component: CgCalendar, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

export const WeekNumbersAndCompactMonths: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <CgCalendar defaultVisibleDate="2026-01-01" today="2026-01-14" firstDayOfWeek="monday" showWeekNumbers weekNumberRule="firstFourDayWeek" locale="en-GB" />
      <CgCalendar defaultVisibleDate="2026-02-01" today="2026-02-10" firstDayOfWeek="sunday" fixedSixWeekLayout={false} showOutsideMonthDates={false} showWeekNumbers />
    </div>
  </StoryFrame>,
};

export const MonthAndYearPickers: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <CgCalendar selectionView="month" defaultValue="2026-03-01" today="2026-03-12" aria-label="Posting month" />
      <CgCalendar selectionView="year" selectionMode="range" defaultValue={{ start: '2024-01-01', end: '2026-01-01' }} today="2026-03-12" aria-label="Fiscal years" />
    </div>
  </StoryFrame>,
};

function AvailabilityCalendar() {
  const [range, setRange] = useState<CgCalendarVisibleRangeChangeDetails | null>(null);
  const [loading, setLoading] = useState(false);
  return <div style={{ display: 'grid', gap: 8 }}>
    <CgCalendar defaultVisibleDate="2026-03-01" today="2026-03-12" loading={loading}
      onVisibleRangeChange={(details) => { setRange(details); setLoading(true); setTimeout(() => setLoading(false), 600); }}
      renderHeader={({ heading }) => <strong>{heading}</strong>}
      renderWeekday={({ shortName }) => shortName.slice(0, 2)}
      renderFooter={({ today }) => <span style={{ marginInlineEnd: 'auto', fontSize: '0.8rem' }}>Today {today}</span>} />
    <output style={{ fontSize: '0.8rem' }}>{range ? `${range.startDate} → ${range.endDate} (v${range.version})` : ''}</output>
  </div>;
}

export const LoadingTemplatesAndVisibleRange: Story = {
  render: () => <StoryFrame source={source} difference={difference}><AvailabilityCalendar /></StoryFrame>,
};

export const LoadingArabic: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgCalendar locale="ar-EG" defaultVisibleDate="2026-03-01" today="2026-03-12" loading showWeekNumbers />
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
