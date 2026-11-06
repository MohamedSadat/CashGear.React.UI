import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgChart } from './CgChart';
import type {
  CgChartAppearance,
  CgChartArgumentAxisDescriptor,
  CgChartElementRef,
  CgChartProps,
  CgChartValueAxisDescriptor,
} from './CgChart.types';

const source = 'No exact Razor component';
const difference = 'Document layout for spreadsheet charts: the host works out every axis, colour and font and CgChart draws exactly that, with the title, legend and axis titles inside the SVG.';
const meta: Meta = { title: 'Phase 35/Chart document', component: CgChart, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

/** Office 2016 theme accents, in series order. */
const ACCENTS = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] as const;

interface Palette {
  readonly chart: string;
  readonly border: string;
  readonly text: string;
  readonly grid: string;
  readonly label: string;
}

const LIGHT: Palette = { chart: '#FFFFFF', border: '#D9D9D9', text: '#595959', grid: '#D9D9D9', label: '#404040' };
// The host swaps text and border colours for dark mode before it renders; CgChart only draws them.
const DARK: Palette = { chart: '#1E1E1E', border: '#595959', text: '#BFBFBF', grid: '#404040', label: '#D9D9D9' };

function appearance(palette: Palette): CgChartAppearance {
  return {
    fontFamily: 'Calibri, Carlito, "Segoe UI", sans-serif',
    chartArea: { fill: palette.chart, border: { color: palette.border, width: 1 }, cornerRadius: 0, padding: 8 },
    plotArea: { fill: 'none', border: 'none' },
    title: { fontSize: 18.67, color: palette.text },
    axisLabels: { fontSize: 12, color: palette.text },
    axisTitles: { fontSize: 13.33, color: palette.text },
    legend: { fontSize: 12, color: palette.text },
    pointLabels: { fontSize: 12, color: palette.label },
    selectionColor: palette === DARK ? '#9DC3E6' : '#4472C4',
  };
}

function valueAxis(palette: Palette, overrides: CgChartValueAxisDescriptor = {}): CgChartValueAxisDescriptor {
  return {
    minimum: 0,
    maximum: 6,
    tickInterval: 1,
    showAxisLine: false,
    showZeroLine: false,
    majorTickMarks: 'none',
    majorGridLineStyle: { color: palette.grid, width: 1 },
    numberFormatOptions: { maximumFractionDigits: 1 },
    ...overrides,
  };
}

function categoryAxis(palette: Palette, overrides: CgChartArgumentAxisDescriptor = {}): CgChartArgumentAxisDescriptor {
  return {
    valueType: 'category',
    categoryPlacement: 'betweenTicks',
    showAxisLine: true,
    axisLineStyle: { color: palette.grid, width: 1 },
    majorTickMarks: 'none',
    labelOverlapMode: 'auto',
    ...overrides,
  };
}

interface Row {
  readonly category: string;
  readonly s1: number;
  readonly s2: number;
  readonly s3: number;
}

/** The sample data a new spreadsheet chart starts with. */
const rows: ReadonlyArray<Row> = [
  { category: 'Category 1', s1: 4.3, s2: 2.4, s3: 2 },
  { category: 'Category 2', s1: 2.5, s2: 4.4, s3: 2 },
  { category: 'Category 3', s1: 3.5, s2: 1.8, s3: 3 },
  { category: 'Category 4', s1: 4.5, s2: 2.8, s3: 5 },
];

const SERIES_KEYS = ['s1', 's2', 's3'] as const;

const common = {
  width: 480,
  height: 288,
  interactive: false,
  palette: ACCENTS,
  dataTableMode: 'visuallyHidden',
  legend: { position: 'bottom', mode: 'static' },
} as const;

function columnChart(palette: Palette): CgChartProps<Row> {
  return {
    ...common,
    data: rows,
    title: 'Chart Title',
    appearance: appearance(palette),
    argumentAxis: categoryAxis(palette),
    valueAxes: [valueAxis(palette, { barGapWidth: 219, barOverlap: -27 })],
    series: SERIES_KEYS.map((key, index) => ({
      type: 'bar' as const, name: `Series ${index + 1}`, argument: (row: Row) => row.category, value: (row: Row) => row[key],
    })),
  };
}

function barChart(palette: Palette): CgChartProps<Row> {
  return {
    ...columnChart(palette),
    orientation: 'horizontal',
    // Spreadsheet bar charts put the first category nearest the value axis, at the bottom.
    argumentAxis: categoryAxis(palette, { reversed: true, valueAxisCrossesAt: 'auto' }),
    valueAxes: [valueAxis(palette, { barGapWidth: 182, barOverlap: -27 })],
  };
}

function lineChart(palette: Palette): CgChartProps<Row> {
  return {
    ...common,
    data: rows,
    title: 'Chart Title',
    appearance: appearance(palette),
    argumentAxis: categoryAxis(palette),
    valueAxes: [valueAxis(palette)],
    series: SERIES_KEYS.map((key, index) => ({
      type: 'line' as const, name: `Series ${index + 1}`, argument: (row: Row) => row.category, value: (row: Row) => row[key],
      lineWidth: 3, dashStyle: 'solid' as const, markerSymbol: 'circle' as const, markerSize: 7,
      markerOutlineColor: ACCENTS[index], markerOutlineWidth: 1,
    })),
  };
}

function areaChart(palette: Palette): CgChartProps<Row> {
  return {
    ...common,
    data: rows,
    title: 'Chart Title',
    appearance: appearance(palette),
    argumentAxis: categoryAxis(palette, { categoryPlacement: 'onTicks' }),
    valueAxes: [valueAxis(palette)],
    series: SERIES_KEYS.map((key, index) => ({
      type: 'area' as const, name: `Series ${index + 1}`, argument: (row: Row) => row.category, value: (row: Row) => row[key],
      areaOpacity: 1, outlineColor: 'none', showMarkers: false,
    })),
  };
}

interface Slice {
  readonly quarter: string;
  readonly sales: number;
}

const slices: ReadonlyArray<Slice> = [
  { quarter: '1st Qtr', sales: 8.2 },
  { quarter: '2nd Qtr', sales: 3.2 },
  { quarter: '3rd Qtr', sales: 1.4 },
  { quarter: '4th Qtr', sales: 1.2 },
];

function pieChart(palette: Palette, donut = false, labels = false): CgChartProps<Slice> {
  return {
    ...common,
    data: slices,
    title: 'Sales',
    appearance: appearance(palette),
    pointLabels: { visible: labels, showConnectors: true },
    customizePoint: ({ pointIndex }) => ({ color: ACCENTS[pointIndex % ACCENTS.length] }),
    series: [{
      type: donut ? 'donut' : 'pie', name: 'Sales', argument: (slice: Slice) => slice.quarter, value: (slice: Slice) => slice.sales,
      startAngleDegrees: -90, outlineColor: palette.chart, outlineWidth: 1,
      ...(donut ? { innerRadiusRatio: 0.75 } : {}),
      ...(labels ? { pointLabelPosition: 'bestFit' as const, pointLabelContent: ['percentage'] as const } : {}),
    }],
  };
}

interface Sample {
  readonly x: number;
  readonly y: number;
}

const scatterA: ReadonlyArray<Sample> = [
  { x: 0.7, y: 2.7 }, { x: 1.8, y: 3.2 }, { x: 2.6, y: 0.8 }, { x: 3.4, y: 2.1 }, { x: 4.1, y: 3.6 },
];
const scatterB: ReadonlyArray<Sample> = [
  { x: 0.4, y: 1.2 }, { x: 1.2, y: 1.9 }, { x: 2.2, y: 2.6 }, { x: 3.1, y: 3.4 }, { x: 4.6, y: 1.7 },
];

function scatterChart(palette: Palette, smooth: boolean): CgChartProps<Sample> {
  const axisStyle = { showAxisLine: false, majorTickMarks: 'none', majorGridLineStyle: { color: palette.grid, width: 1 } } as const;
  return {
    ...common,
    data: null,
    title: 'Chart Title',
    appearance: appearance(palette),
    argumentAxis: { valueType: 'numeric', minimum: 0, maximum: 5, tickInterval: 1, showGridLines: true, ...axisStyle },
    valueAxes: [{ minimum: 0, maximum: 4, tickInterval: 0.5, ...axisStyle, numberFormatOptions: { minimumFractionDigits: 1 } }],
    series: [scatterA, scatterB].map((points, index) => ({
      type: 'scatter' as const, name: `Series ${index + 1}`, data: points, argument: (sample: Sample) => sample.x, value: (sample: Sample) => sample.y,
      ...(smooth
        ? { showLine: true, lineStyle: 'smooth' as const, lineWidth: 3, dashStyle: 'solid' as const, showMarkers: false }
        : { markerSymbol: 'circle' as const, markerSize: 7, markerOutlineColor: ACCENTS[index], markerOutlineWidth: 1 }),
    })),
  };
}

interface Month {
  readonly month: string;
  readonly revenue: number;
  readonly cost: number;
  readonly backlog: number;
  readonly margin: number;
}

const months: ReadonlyArray<Month> = [
  { month: 'Jan', revenue: 120, cost: 82, backlog: 60, margin: 0.32 },
  { month: 'Feb', revenue: 136, cost: 90, backlog: 72, margin: 0.34 },
  { month: 'Mar', revenue: 151, cost: 112, backlog: 64, margin: 0.26 },
  { month: 'Apr', revenue: 128, cost: 85, backlog: 88, margin: 0.34 },
  { month: 'May', revenue: 162, cost: 101, backlog: 95, margin: 0.38 },
  { month: 'Jun', revenue: 178, cost: 108, backlog: 102, margin: 0.39 },
];

function comboChart(palette: Palette): CgChartProps<Month> {
  return {
    ...common,
    width: 560,
    height: 320,
    data: months,
    title: 'Revenue, cost and margin',
    appearance: appearance(palette),
    argumentAxis: categoryAxis(palette),
    valueAxes: [
      valueAxis(palette, { name: 'amount', minimum: 0, maximum: 200, tickInterval: 50, barGapWidth: 150, barOverlap: -10, title: 'Amount (k)' }),
      valueAxis(palette, {
        name: 'ratio', position: 'end', minimum: 0, maximum: 0.5, showGridLines: false, title: 'Margin',
        ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((value) => ({ value, text: `${Math.round(value * 100)}%` })),
      }),
    ],
    series: [
      { type: 'area', name: 'Backlog', valueAxisName: 'amount', argument: (row) => row.month, value: (row) => row.backlog, color: ACCENTS[2], areaOpacity: 0.6, outlineColor: 'none', showMarkers: false },
      { type: 'bar', name: 'Revenue', valueAxisName: 'amount', argument: (row) => row.month, value: (row) => row.revenue, color: ACCENTS[0] },
      { type: 'bar', name: 'Cost', valueAxisName: 'amount', argument: (row) => row.month, value: (row) => row.cost, color: ACCENTS[1] },
      { type: 'line', name: 'Margin', valueAxisName: 'ratio', argument: (row) => row.month, value: (row) => row.margin, color: ACCENTS[3], lineWidth: 3, dashStyle: 'solid', markerSymbol: 'circle', markerSize: 7 },
    ],
  };
}

function frame(content: ReactNode, background?: string) {
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, ...(background ? { padding: 12, background } : {}) }}>{content}</div>
  </StoryFrame>;
}

function chart<TItem>(props: CgChartProps<TItem>, label: string) {
  return <CgChart<TItem> {...props} ariaLabel={label} />;
}

export const ExcelClusteredColumn: Story = { render: () => frame(chart(columnChart(LIGHT), 'Clustered column')) };
export const ExcelClusteredBar: Story = { render: () => frame(chart(barChart(LIGHT), 'Clustered bar')) };
export const ExcelLineWithMarkers: Story = { render: () => frame(chart(lineChart(LIGHT), 'Line with markers')) };
export const ExcelArea: Story = { render: () => frame(chart(areaChart(LIGHT), 'Area')) };
export const ExcelPie: Story = { render: () => frame(<>{chart(pieChart(LIGHT), 'Pie')}{chart(pieChart(LIGHT, false, true), 'Pie with labels')}</>) };
export const ExcelDoughnut: Story = { render: () => frame(chart(pieChart(LIGHT, true), 'Doughnut')) };
export const ExcelScatterMarkers: Story = { render: () => frame(chart(scatterChart(LIGHT, false), 'Scatter with markers')) };
export const ExcelScatterSmooth: Story = { render: () => frame(chart(scatterChart(LIGHT, true), 'Scatter with smooth lines')) };
export const ExcelComboSecondaryAxis: Story = { render: () => frame(chart(comboChart(LIGHT), 'Combination chart')) };

export const ExcelDarkColours: Story = {
  globals: { theme: 'dark' },
  render: () => frame(<>
    {chart(columnChart(DARK), 'Dark clustered column')}
    {chart(barChart(DARK), 'Dark clustered bar')}
    {chart(lineChart(DARK), 'Dark line')}
    {chart(areaChart(DARK), 'Dark area')}
    {chart(pieChart(DARK), 'Dark pie')}
    {chart(pieChart(DARK, true), 'Dark doughnut')}
    {chart(scatterChart(DARK, false), 'Dark scatter')}
    {chart(scatterChart(DARK, true), 'Dark smooth scatter')}
    {chart(comboChart(DARK), 'Dark combination')}
  </>),
};

/** No colours given: every default comes from the theme tokens, so it follows `data-cg-theme`. */
function ThemeDefaultsFixture() {
  return frame(<>
    <div data-cg-theme="light">{chart({ ...columnChart(LIGHT), appearance: {} }, 'Theme defaults light')}</div>
    <div data-cg-theme="dark">{chart({ ...columnChart(LIGHT), appearance: {} }, 'Theme defaults dark')}</div>
  </>);
}
export const ThemeDefaults: Story = { render: () => <ThemeDefaultsFixture /> };

export const SmallSizes: Story = {
  render: () => frame(<>
    {chart({ ...columnChart(LIGHT), width: 120, height: 80 }, 'Column 120 by 80')}
    {chart({ ...lineChart(LIGHT), width: 160, height: 100 }, 'Line 160 by 100')}
    {chart({ ...pieChart(LIGHT), width: 120, height: 90 }, 'Pie 120 by 90')}
    {chart({ ...columnChart(LIGHT), width: 100, height: 60 }, 'Column too small')}
  </>),
};

export const ExcelArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <div dir="rtl">{frame(chart<Row>({
    ...columnChart(LIGHT),
    locale: 'ar-EG',
    title: 'المبيعات حسب الفئة',
    data: rows.map((row, index) => ({ ...row, category: ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'][index]! })),
    series: SERIES_KEYS.map((key, index) => ({
      type: 'bar' as const, name: ['الشمال', 'الجنوب', 'الغرب'][index]!, argument: (row: Row) => row.category, value: (row: Row) => row[key],
    })),
  }, 'مخطط عمودي'))}</div>,
};

function describe(element: CgChartElementRef | null): string {
  if (!element) return 'Nothing selected';
  return Object.entries(element).map(([key, value]) => `${key}: ${String(value)}`).join(', ');
}

function EditorFixture() {
  const [selected, setSelected] = useState<CgChartElementRef | null>({ kind: 'plotArea' });
  const props = comboChart(LIGHT);
  return frame(<div style={{ display: 'grid', gap: 8 }}>
    <output aria-label="Selected chart element">{describe(selected)}</output>
    <CgChart<Month>
      {...props}
      ariaLabel="Editable chart"
      pointLabels={{ visible: true }}
      series={props.series.map((descriptor) => descriptor.name === 'Revenue'
        ? { ...descriptor, pointLabelPosition: 'insideEnd' as const, pointLabelStyle: { color: '#FFFFFF' } }
        : descriptor.name === 'Margin' ? { ...descriptor, pointLabelPosition: 'above' as const, pointLabelFormatter: (value) => `${Math.round(Number(value) * 100)}%` }
          : { ...descriptor, showPointLabels: false })}
      highlightedElement={selected}
      onElementPointerDown={(detail) => setSelected(detail.element)}
    />
  </div>);
}
export const ElementHitTesting: Story = { render: () => <EditorFixture /> };
