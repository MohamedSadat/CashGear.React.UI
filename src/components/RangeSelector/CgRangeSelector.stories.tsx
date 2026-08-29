import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import {
  normalizeCgDecimalValue,
  normalizeCgInstantValue,
  normalizeCgLocalDateTimeValue,
} from './rangeValue';
import { CgRangeSelector } from './CgRangeSelector';
import type { CgRangeSelectorValue } from './CgRangeSelector.types';

const source = 'CashGear.Blazor.UI/Components/Data/RangeSelector/* @ 51d7689a7d407713fa18cb6268158b1a4f461fb3';
const difference = 'React uses exact discriminated values, BigInt-backed wires, and one atomic immutable range value.';
const meta: Meta = { title: 'Phase 19/RangeSelector', component: CgRangeSelector, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}><div style={{ inlineSize: 'min(44rem, 82vw)' }}>{content}</div></StoryFrame>;

export const NumberRange: Story = { render: () => frame(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 18, end: 72 }} step={2} formatValue={(value) => `${value}%`} />) };
export const ExactBigintAndDecimal: Story = { render: () => frame(<div style={{ display: 'grid', gap: 28 }}><CgRangeSelector valueKind="bigint" minimum={0n} maximum={10_000_000_000_000_000_000n} defaultValue={{ start: 2_000_000_000_000_000_000n, end: 7_500_000_000_000_000_000n }} step={100_000_000_000_000_000n} formatValue={(value) => value.toLocaleString()} /><CgRangeSelector valueKind="decimal" minimum={normalizeCgDecimalValue('-10.00')} maximum={normalizeCgDecimalValue('25.00')} defaultValue={{ start: normalizeCgDecimalValue('1.125'), end: normalizeCgDecimalValue('18.875') }} step={normalizeCgDecimalValue('0.125')} formatValue={(value) => `$${value}`} /></div>) };
export const CivilDateRange: Story = { render: () => frame(<CgRangeSelector valueKind="date" minimum="2026-01-01" maximum="2026-12-31" defaultValue={{ start: '2026-03-01', end: '2026-09-30' }} step={1} formatValue={(value) => value.replaceAll('-', ' / ')} />) };
export const DecimalAndDateVisual: Story = { render: () => frame(<div style={{ display: 'grid', gap: 28 }}><CgRangeSelector valueKind="decimal" minimum={normalizeCgDecimalValue('0')} maximum={normalizeCgDecimalValue('100')} defaultValue={{ start: normalizeCgDecimalValue('12.375'), end: normalizeCgDecimalValue('84.625') }} step={normalizeCgDecimalValue('0.125')} formatValue={(value) => `${value} kg`} /><CgRangeSelector valueKind="date" minimum="2026-01-01" maximum="2026-12-31" defaultValue={{ start: '2026-03-01', end: '2026-09-30' }} step={1} /></div>) };
export const LocalDateTimeAndInstant: Story = { render: () => frame(<div style={{ display: 'grid', gap: 28 }}><CgRangeSelector valueKind="datetime-local" minimum={normalizeCgLocalDateTimeValue('2026-08-29T08:00')} maximum={normalizeCgLocalDateTimeValue('2026-08-29T20:00')} defaultValue={{ start: normalizeCgLocalDateTimeValue('2026-08-29T10:30'), end: normalizeCgLocalDateTimeValue('2026-08-29T17:00') }} step={900_000} /><CgRangeSelector valueKind="instant" minimum={normalizeCgInstantValue('2026-08-29T08:00+02:00')} maximum={normalizeCgInstantValue('2026-08-29T20:00+02:00')} defaultValue={{ start: normalizeCgInstantValue('2026-08-29T09:00Z'), end: normalizeCgInstantValue('2026-08-29T15:00Z') }} step={1_800_000} /></div>) };
export const SpanConstraints: Story = { render: () => frame(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 25, end: 55 }} step={5} minimumSelectionSpan={20} maximumSelectionSpan={45} />) };
export const HandleSwapping: Story = { render: () => frame(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 35, end: 65 }} allowHandleSwap />) };
export const RangeDragging: Story = { render: () => frame(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 25, end: 55 }} allowRangeDrag moveSelectedRangeByClick />) };
export const MarkersLabelsAndChart: Story = { render: () => frame(<CgRangeSelector valueKind="number" minimum={0} maximum={12} defaultValue={{ start: 2, end: 10 }} showMarkers markerCount={7} renderChart={() => <div style={{ display: 'flex', alignItems: 'end', blockSize: '100%', gap: 3 }}>{[22, 37, 55, 31, 68, 84, 57, 74, 46, 63, 41, 27].map((height, index) => <span key={index} style={{ flex: 1, blockSize: `${height}%`, background: 'color-mix(in srgb, var(--cg-accent) 28%, transparent)', borderRadius: '3px 3px 0 0' }} />)}</div>} />) };

function RejectedFixture() {
  const [attempt, setAttempt] = useState<CgRangeSelectorValue<number> | null>(null);
  return frame(<div style={{ display: 'grid', gap: 12 }}><CgRangeSelector valueKind="number" minimum={0} maximum={100} value={{ start: 22.5, end: 77.5 }} step={5} onValueChange={setAttempt} /><output aria-label="Attempted range">{attempt ? `${attempt.start} – ${attempt.end}` : 'No proposal yet'}</output></div>);
}
export const ControlledValueRejection: Story = { render: () => <RejectedFixture /> };
export const DisabledAndReadOnly: Story = { render: () => frame(<div style={{ display: 'grid', gap: 28 }}><CgRangeSelector valueKind="number" minimum={0} maximum={100} value={{ start: 20, end: 70 }} disabled /><CgRangeSelector valueKind="number" minimum={0} maximum={100} value={{ start: 30, end: 80 }} readOnly /></div>) };
export const DarkCompact: Story = { render: () => frame(<CgRangeSelector valueKind="decimal" minimum={normalizeCgDecimalValue('0')} maximum={normalizeCgDecimalValue('100')} defaultValue={{ start: normalizeCgDecimalValue('17.5'), end: normalizeCgDecimalValue('81.25') }} step={normalizeCgDecimalValue('0.25')} showMarkers markerCount={5} />), globals: { theme: 'dark', density: 'compact' } };
export const ArabicRtl: Story = { render: () => <div dir="rtl">{frame(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 15, end: 70 }} formatValue={(value) => `${value.toLocaleString('ar-EG')}٪`} startHandleAriaLabel="بداية النطاق" endHandleAriaLabel="نهاية النطاق" showMarkers />)}</div>, globals: { direction: 'rtl' } };
export const NarrowLayout: Story = { render: () => <div style={{ inlineSize: 290 }}>{frame(<CgRangeSelector valueKind="date" minimum="2026-08-01" maximum="2026-08-31" defaultValue={{ start: '2026-08-07', end: '2026-08-24' }} showMarkers markerCount={5} />)}</div>, parameters: { viewport: { defaultViewport: 'mobile1' } } };
