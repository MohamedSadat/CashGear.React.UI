import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgSplitter } from '../Splitter';
import type { CgSplitterPaneDescriptor } from '../Splitter';
import {
  normalizeCgDecimalValue,
  normalizeCgInstantValue,
  normalizeCgLocalDateTimeValue,
} from '../RangeSelector';
import { CgChart } from './CgChart';
import type {
  CgChartActions,
  CgChartPointRef,
  CgChartSeriesDescriptor,
} from './CgChart.types';

const source = 'CashGear.Blazor.UI/Components/Data/Chart/* @ 51d7689a7d407713fa18cb6268158b1a4f461fb3';
const difference = 'React builds immutable descriptor models and renders dependency-free responsive SVG with exact values, delegated interactions, accessible tables, and standalone SVG export.';
const meta: Meta = { title: 'Phase 20/Chart', component: CgChart, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface MonthDatum {
  readonly month: string;
  readonly revenue: number | null;
  readonly expense: number | null;
  readonly margin: number | null;
}

const months: ReadonlyArray<MonthDatum> = [
  { month: 'January', revenue: 182, expense: 126, margin: 56 },
  { month: 'February', revenue: 214, expense: 144, margin: 70 },
  { month: 'March', revenue: 196, expense: null, margin: 64 },
  { month: 'April', revenue: 248, expense: 171, margin: 77 },
  { month: 'May', revenue: 281, expense: 183, margin: 98 },
  { month: 'June', revenue: 264, expense: 175, margin: 89 },
];

const mixedSeries: ReadonlyArray<CgChartSeriesDescriptor<MonthDatum>> = [
  { type: 'bar', name: 'Revenue', argument: (item) => item.month, value: (item) => item.revenue, cornerRadius: 5 },
  { type: 'area', name: 'Expense', argument: (item) => item.month, value: (item) => item.expense, missingValueMode: 'gap', areaOpacity: 0.16, lineStyle: 'monotone' },
  { type: 'line', name: 'Margin', argument: (item) => item.month, value: (item) => item.margin, lineStyle: 'monotone', markerSymbol: 'diamond', markerSize: 8 },
];

function Frame({ children, width = 'min(860px, calc(100vw - 36px))' }: { children: React.ReactNode; width?: string | number }) {
  return <StoryFrame source={source} difference={difference}><div style={{ width }}>{children}</div></StoryFrame>;
}

export const CartesianMixed: Story = {
  render: () => <Frame><CgChart
    data={months}
    series={mixedSeries}
    title="Cash flow overview"
    subtitle="First half · USD thousands"
    description="Revenue bars with expense area and margin line by month."
    pointLabels={{ visible: true, hideOverlapping: true }}
    legend={{ position: 'top' }}
    dataTableMode="collapsed"
  /></Frame>,
};

export const HorizontalGroupedBars: Story = {
  render: () => <Frame width={720}><CgChart
    data={months.slice(0, 4)}
    series={[
      { type: 'bar', name: 'Revenue', argument: (item: MonthDatum) => item.month, value: (item) => item.revenue, maximumBarWidth: 28 },
      { type: 'bar', name: 'Expense', argument: (item: MonthDatum) => item.month, value: (item) => item.expense, maximumBarWidth: 28 },
    ]}
    orientation="horizontal"
    title="Horizontal grouped comparison"
    height={370}
    pointLabels={{ visible: true, position: 'outside' }}
  /></Frame>,
};

export const PositiveNegativeStacks: Story = {
  render: () => <Frame><CgChart
    data={[
      { group: 'Operations', actual: 48, adjustment: -12 },
      { group: 'Sales', actual: 62, adjustment: 17 },
      { group: 'Finance', actual: 34, adjustment: -8 },
      { group: 'Technology', actual: 51, adjustment: 14 },
    ]}
    series={[
      { type: 'bar', name: 'Actual', stacking: 'stacked', stackName: 'result', argument: (item) => item.group, value: (item) => item.actual },
      { type: 'bar', name: 'Adjustment', stacking: 'stacked', stackName: 'result', argument: (item) => item.group, value: (item) => item.adjustment },
    ]}
    title="Positive and negative stacks"
    valueAxes={[{ includeZero: true, showZeroLine: true }]}
  /></Frame>,
};

export const FullStackedAreas: Story = {
  render: () => <Frame><CgChart
    data={months}
    series={[
      { type: 'area', name: 'Committed', stacking: 'fullStacked', stackName: 'mix', argument: (item: MonthDatum) => item.month, value: () => 35, areaOpacity: 0.72, lineStyle: 'monotone' },
      { type: 'area', name: 'Expected', stacking: 'fullStacked', stackName: 'mix', argument: (item: MonthDatum) => item.month, value: (item) => (item.revenue ?? 0) - (item.margin ?? 0), areaOpacity: 0.58, lineStyle: 'monotone' },
      { type: 'area', name: 'At risk', stacking: 'fullStacked', stackName: 'mix', argument: (item: MonthDatum) => item.month, value: (item) => item.margin ?? 20, areaOpacity: 0.5, lineStyle: 'monotone' },
    ]}
    title="Full-stacked forecast composition"
    valueAxes={[{ labelFormatter: (value) => `${Number(value) * 100}%`, minimum: 0, maximum: 1 }]}
  /></Frame>,
};

export const MissingValuePolicies: Story = {
  render: () => <Frame><CgChart
    data={months}
    series={[
      { type: 'line', name: 'Gap', argument: (item: MonthDatum) => item.month, value: (item) => item.expense, missingValueMode: 'gap', lineWidth: 3 },
      { type: 'line', name: 'Zero', argument: (item: MonthDatum) => item.month, value: (item) => item.expense, missingValueMode: 'zero', dashStyle: 'dash' },
      { type: 'line', name: 'Skip', argument: (item: MonthDatum) => item.month, value: (item) => item.expense, missingValueMode: 'skip', dashStyle: 'dot' },
    ]}
    title="Missing-value policies"
  /></Frame>,
};

const exactData = [
  { argument: normalizeCgDecimalValue('100000000000000000000.01'), value: normalizeCgDecimalValue('9007199254740993.125') },
  { argument: normalizeCgDecimalValue('100000000000000000000.02'), value: normalizeCgDecimalValue('9007199254740994.250') },
  { argument: normalizeCgDecimalValue('100000000000000000000.03'), value: normalizeCgDecimalValue('9007199254740995.875') },
] as const;
export const ExactNumericAxis: Story = {
  render: () => <Frame><CgChart
    data={exactData}
    argumentAxis={{ valueType: 'numeric', numberFormatOptions: { maximumFractionDigits: 2 } }}
    series={[{ type: 'line', name: 'Exact balance', argument: (item) => item.argument, value: (item) => item.value, markerSymbol: 'circle' }]}
    title="Exact decimal arguments and values"
    tooltip={{ numberFormatOptions: { minimumFractionDigits: 3, maximumFractionDigits: 3 } }}
    dataTableMode="visible"
  /></Frame>,
};

const timelineData = [
  { at: normalizeCgInstantValue('2026-08-30T06:00:00Z'), amount: 16 },
  { at: normalizeCgInstantValue('2026-08-30T12:00:00+02:00'), amount: 23 },
  { at: normalizeCgInstantValue('2026-08-30T18:00:00Z'), amount: 19 },
] as const;
export const TemporalAxisAndTimeZone: Story = {
  render: () => <Frame><CgChart
    data={timelineData}
    argumentAxis={{ valueType: 'date', dateTimeFormatOptions: { hour: '2-digit', minute: '2-digit' } }}
    series={[{ type: 'area', name: 'Transactions', argument: (item) => item.at, value: (item) => item.amount, areaOpacity: 0.24, lineStyle: 'monotone' }]}
    title="Instant timeline · Cairo display zone"
    displayTimeZone="Africa/Cairo"
  /></Frame>,
};

export const AxesConstantsAndAnnotations: Story = {
  render: () => <Frame><CgChart
    data={months}
    series={[
      { ...mixedSeries[0]!, valueAxisName: 'money' },
      { type: 'line', name: 'Margin ratio', valueAxisName: 'ratio', argument: (item: MonthDatum) => item.month, value: (item) => (item.margin ?? 0) / (item.revenue ?? 1), dashStyle: 'dashDot' },
    ]}
    title="Multiple axes, targets, and annotation"
    valueAxes={[
      { name: 'money', title: 'USD thousands', position: 'start', constantLines: [{ value: 250, label: 'Stretch', color: '#b54444', extendAxisRange: true }] },
      { name: 'ratio', title: 'Margin', position: 'end', numberFormatOptions: { style: 'percent' }, minimum: 0, maximum: 0.5 },
    ]}
    constantLines={[{ axis: 'argument', value: 'April', label: 'Pricing change', dashStyle: 'dash' }]}
    annotations={[{ text: 'Peak revenue', argument: 'May', value: 281, valueAxisName: 'money', offsetY: -8 }]}
  /></Frame>,
};

const mixData = [
  { method: 'Bank transfer', amount: 46 },
  { method: 'Card', amount: 29 },
  { method: 'Cash', amount: 16 },
  { method: 'Other', amount: 9 },
] as const;
export const PieAndDonut: Story = {
  render: () => <Frame><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
    <CgChart data={mixData} series={[{ type: 'pie', name: 'Payment mix', argument: (item) => item.method, value: (item) => item.amount, showPercentages: true }]} title="Pie" pointLabels={{ visible: true, showConnectors: true }} height={320} />
    <CgChart data={mixData} series={[{ type: 'donut', name: 'Payment mix', argument: (item) => item.method, value: (item) => item.amount, showPercentages: true, smallSlicePolicy: 'hideLabel', smallSliceThreshold: 0.1 }]} title="Donut" pointLabels={{ visible: true, showConnectors: true }} height={320} />
  </div></Frame>,
};

function ControlledSelectionFixture() {
  const [selection, setSelection] = useState<ReadonlyArray<CgChartPointRef>>([{ seriesName: 'Revenue', pointIndex: 1 }]);
  return <Frame><div style={{ display: 'grid', gap: 8 }}>
    <output aria-label="Accepted chart selection">{selection.map((point) => `${point.seriesName}[${point.pointIndex}]`).join(', ') || 'None'}</output>
    <CgChart data={months} series={mixedSeries} title="Controlled multiple selection" selectionMode="multiple" selectedPoints={selection} onSelectedPointsChange={setSelection} />
  </div></Frame>;
}
export const ControlledSelection: Story = { render: () => <ControlledSelectionFixture /> };

function ControlledLegendFixture() {
  const [visible, setVisible] = useState<ReadonlyArray<string>>(['Revenue', 'Margin']);
  return <Frame><CgChart data={months} series={mixedSeries} title="Controlled series visibility" visibleSeriesNames={visible} onVisibleSeriesNamesChange={setVisible} legend={{ position: 'top', keepOneSeriesVisible: true }} /></Frame>;
}
export const ControlledLegendVisibility: Story = { render: () => <ControlledLegendFixture /> };

export const TablesAndStates: Story = {
  render: () => <Frame><div style={{ display: 'grid', gap: 24 }}>
    <CgChart data={months.slice(0, 3)} series={mixedSeries.slice(0, 2)} title="Always-visible data table" dataTableMode="visible" height={260} />
    <CgChart data={months} series={mixedSeries} title="Loading chart" loading renderLoading={() => <strong>Refreshing ledger…</strong>} height={180} dataTableMode="visuallyHidden" />
    <CgChart data={[]} series={mixedSeries} title="Empty chart" renderEmpty={() => <span>No posted entries in this period</span>} height={180} />
  </div></Frame>,
};

export const LocalDateTimeAxis: Story = {
  render: () => <Frame><CgChart
    data={[
      { at: normalizeCgLocalDateTimeValue('2026-08-31T08:00'), value: 4 },
      { at: normalizeCgLocalDateTimeValue('2026-08-31T11:30'), value: 11 },
      { at: normalizeCgLocalDateTimeValue('2026-08-31T16:00'), value: 8 },
    ]}
    argumentAxis={{ valueType: 'date' }}
    series={[{ type: 'bar', name: 'Approvals', argument: (item) => item.at, value: (item) => item.value }]}
    title="Civil local date-time axis"
  /></Frame>,
};

function SplitterChartFixture() {
  const panes = useMemo<ReadonlyArray<CgSplitterPaneDescriptor>>(() => [
    { key: 'filters', size: 190, minimumSize: 120, collapsible: true, renderContent: () => <div style={{ padding: 14 }}><strong>Filters</strong><p>Resize this pane to exercise chart measurement buckets.</p></div>, renderCollapsed: () => 'Filters' },
    { key: 'chart', size: '*', minimumSize: 180, renderContent: () => <div style={{ height: '100%', padding: 10 }}><CgChart data={months} series={mixedSeries} title="Splitter-hosted chart" height="100%" dataTableMode="visuallyHidden" /></div> },
  ], []);
  return <Frame><div style={{ height: 390 }}><CgSplitter panes={panes} aria-label="Resizable chart workspace" /></div></Frame>;
}
export const SplitterResizeHost: Story = { render: () => <SplitterChartFixture /> };

export const NarrowResponsive: Story = {
  render: () => <Frame width={294}><CgChart data={months} series={mixedSeries.slice(0, 2)} title="Narrow responsive chart" argumentAxis={{ labelOverlapMode: 'auto', maximumLabelCharacters: 8 }} height={330} /></Frame>,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};

export const DarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <Frame><CgChart data={months} series={mixedSeries} title="Dark compact chart" pointLabels={{ visible: true }} legend={{ position: 'top' }} /></Frame>,
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <div dir="rtl"><Frame><CgChart
    direction="rtl"
    locale="ar-EG"
    data={[
      { month: 'يناير', revenue: 182, expense: 126, margin: 56 },
      { month: 'فبراير', revenue: 214, expense: 144, margin: 70 },
      { month: 'مارس', revenue: 196, expense: 151, margin: 64 },
    ]}
    series={[
      { type: 'bar', name: 'الإيرادات', argument: (item: MonthDatum) => item.month, value: (item) => item.revenue, cornerRadius: 5 },
      { type: 'area', name: 'المصروفات', argument: (item: MonthDatum) => item.month, value: (item) => item.expense, areaOpacity: 0.16, lineStyle: 'monotone' },
      { type: 'line', name: 'الهامش', argument: (item: MonthDatum) => item.month, value: (item) => item.margin, lineStyle: 'monotone', markerSymbol: 'diamond' },
    ]}
    title="التدفق النقدي"
    description="الإيرادات والمصروفات والهامش حسب الشهر"
    strings={{ legendAriaLabel: 'سلاسل الرسم البياني', dataTableToggle: 'بيانات الرسم' }}
  /></Frame></div>,
};

export const StaticImageAccessibility: Story = {
  render: () => <Frame><CgChart data={months} series={mixedSeries} enableKeyboardNavigation={false} title="Static accessible chart" description="An image-semantic version with a complete visible data table." dataTableMode="visible" /></Frame>,
};

function ActionsAndLifecycleFixture() {
  const actions = useRef<CgChartActions>(null);
  const [mounted, setMounted] = useState(true);
  const [result, setResult] = useState('No action yet');
  return <Frame><div style={{ display: 'grid', gap: 10 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" onClick={() => setMounted((value) => !value)}>{mounted ? 'Unmount chart' : 'Mount chart'}</button>
      <button type="button" disabled={!mounted} onClick={() => setResult(`${actions.current?.getSvg()?.length ?? 0} SVG characters`)}>Read SVG</button>
      <button type="button" disabled={!mounted} onClick={() => actions.current?.exportSvg('quarterly chart.svg')}>Export SVG</button>
      <button type="button" disabled={!mounted} onClick={() => actions.current?.refresh()}>Refresh model</button>
      <output aria-label="Chart action result">{result}</output>
    </div>
    {mounted ? <CgChart data={months} series={mixedSeries} title="Lifecycle and export chart" actionsRef={actions} animation="onLoad" /> : <p>Chart unmounted cleanly</p>}
  </div></Frame>;
}
export const ActionsAndLifecycle: Story = { render: () => <ActionsAndLifecycleFixture /> };

const denseData = Array.from({ length: 180 }, (_, index) => ({ index, value: 50 + Math.sin(index / 8) * 26 + Math.cos(index / 17) * 12 }));
export const DenseReducedMotion: Story = {
  render: () => <Frame><CgChart data={denseData} argumentAxis={{ valueType: 'numeric', labelOverlapMode: 'hide' }} series={[{ type: 'area', name: 'Signal', argument: (item) => item.index, value: (item) => item.value, lineStyle: 'monotone', showMarkers: false, areaOpacity: 0.18 }]} title="Dense 180-point series" animation="onLoad" dataTableMode="hidden" /></Frame>,
  parameters: { reducedMotion: 'reduce' },
};
