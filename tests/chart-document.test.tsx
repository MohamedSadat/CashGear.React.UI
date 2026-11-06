import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgChart } from '../src/components/Chart';
import type { CgChartElementPointerDetail, CgChartProps } from '../src/components/Chart';
import { resolveDocumentStyle } from '../src/components/Chart/chartAppearance';
import { layoutDocumentLegend } from '../src/components/Chart/chartDocument';
import { createChartFormatter, resolveChartStrings } from '../src/components/Chart/chartFormatting';
import { buildChartLayout } from '../src/components/Chart/chartLayout';
import type { ChartBarShape, ChartLayoutRequest, ChartPathShape } from '../src/components/Chart/chartLayout';
import { buildChartSourceModel, projectVisibleModel } from '../src/components/Chart/chartModel';
import { smoothPath } from '../src/components/Chart/chartPaths';
import { clusteredBarSlot, createCategoryScale } from '../src/components/Chart/chartScales';
import { selectionGeometry } from '../src/components/Chart/chartSelection';
import { projectChartTable } from '../src/components/Chart/chartTable';
import { dashArray, estimateText, wrapText } from '../src/components/Chart/chartText';
import { validateChartConfiguration } from '../src/components/Chart/chartValidation';

interface Row {
  readonly category: string;
  readonly a: number;
  readonly b: number;
}

interface Point {
  readonly x: number;
  readonly y: number | null;
}

const formatter = createChartFormatter('en-US', 'UTC', resolveChartStrings());
const rows: ReadonlyArray<Row> = [
  { category: 'C1', a: 4, b: 2 },
  { category: 'C2', a: 2, b: 4 },
  { category: 'C3', a: 3, b: 1 },
  { category: 'C4', a: 5, b: 3 },
];
const documentStyle = resolveDocumentStyle({ chartArea: { padding: 0, border: 'none' }, legend: { fontSize: 10 } });

function layoutFor<TItem>(
  props: CgChartProps<TItem>,
  overrides: Partial<ChartLayoutRequest<TItem>> = {},
) {
  validateChartConfiguration(props);
  const source = buildChartSourceModel(props, formatter);
  return buildChartLayout<TItem>({
    model: projectVisibleModel(source, new Set(props.series.map((series) => series.name))),
    width: 480,
    height: 288,
    orientation: props.orientation ?? 'vertical',
    rtl: false,
    formatter,
    ...(props.argumentAxis ? { argumentAxis: props.argumentAxis } : {}),
    ...(props.valueAxes ? { valueAxes: props.valueAxes } : {}),
    ...(props.pointLabels ? { pointLabels: props.pointLabels } : {}),
    document: documentStyle,
    measure: estimateText,
    ...(props.title ? { title: props.title } : {}),
    ...(props.legend ? { legend: props.legend } : {}),
    ...overrides,
  });
}

function columns(overrides: Partial<CgChartProps<Row>> = {}): CgChartProps<Row> {
  return {
    data: rows,
    argumentAxis: { categoryPlacement: 'betweenTicks' },
    valueAxes: [{ minimum: 0, maximum: 6, tickInterval: 1, barGapWidth: 219, barOverlap: -27 }],
    series: [
      { type: 'bar', name: 'A', argument: (row) => row.category, value: (row) => row.a },
      { type: 'bar', name: 'B', argument: (row) => row.category, value: (row) => row.b },
    ],
    ...overrides,
  };
}

describe('CgChart document geometry', () => {
  it('sizes clustered bars with spreadsheet gap width and overlap', () => {
    const slot = clusteredBarSlot(0, 100, 0, 2, 219, -27);
    // w = 100 / (2.19 + 1 + 1.27)
    expect(slot.width).toBeCloseTo(100 / 4.46, 6);
    expect(slot.start).toBeCloseTo((slot.width * 2.19) / 2, 6);
    const second = clusteredBarSlot(0, 100, 1, 2, 219, -27);
    expect(second.start - slot.start).toBeCloseTo(slot.width * 1.27, 6);
    // A full overlap stacks every bar on the same slot.
    expect(clusteredBarSlot(0, 100, 1, 3, 0, 100).start).toBeCloseTo(clusteredBarSlot(0, 100, 0, 3, 0, 100).start, 6);
  });

  it('places categories between or on tick marks without padding', () => {
    const between = createCategoryScale(4, 0, 400, 'betweenTicks');
    expect([0, 1, 2, 3].map((index) => between.position(index)! + between.bandwidth / 2)).toEqual([50, 150, 250, 350]);
    const on = createCategoryScale(5, 0, 400, 'onTicks');
    expect([0, 4].map((index) => on.position(index)! + on.bandwidth / 2)).toEqual([0, 400]);
    const reversed = createCategoryScale(4, 0, 400, 'betweenTicks', true);
    expect(reversed.position(0)! + reversed.bandwidth / 2).toBe(350);
  });

  it('lays bars out from the given gap and overlap inside equal category slots', () => {
    const layout = layoutFor(columns());
    const bars = layout.shapes.filter((shape): shape is ChartBarShape => shape.kind === 'bar');
    expect(bars).toHaveLength(8);
    const step = layout.plot.width / 4;
    const expectedWidth = step / 4.46;
    expect(bars[0]!.bounds.width).toBeCloseTo(expectedWidth, 4);
    expect(bars[0]!.bounds.x).toBeCloseTo(layout.plot.x + expectedWidth * 2.19 / 2, 4);
    // Series B sits one bar plus 27% further on.
    const b = bars.find((bar) => bar.seriesName === 'B' && bar.point.pointIndex === 0)!;
    expect(b.bounds.x - bars[0]!.bounds.x).toBeCloseTo(expectedWidth * 1.27, 4);
    expect(bars[0]!.path).not.toContain('Q');
  });

  it('honours explicit ticks, reversed value axes and the crossing value for bar bases', () => {
    const layout = layoutFor(columns({
      valueAxes: [{
        minimum: 1, maximum: 6, reversed: true, argumentAxisCrossesAt: 1,
        ticks: [{ value: 1, text: 'one' }, { value: 3.5, text: 'mid' }, { value: 6, text: 'six' }],
      }],
    }));
    const axis = layout.valueAxes[0]!;
    expect(axis.ticks.map((tick) => tick.text)).toEqual(['one', 'mid', 'six']);
    // Reversed: the minimum is at the top.
    expect(axis.ticks[0]!.position).toBeCloseTo(layout.plot.y, 6);
    expect(axis.ticks[2]!.position).toBeCloseTo(layout.plot.y + layout.plot.height, 6);
    const bar = layout.shapes.find((shape): shape is ChartBarShape => shape.kind === 'bar')!;
    // Bars hang from the crossing value (1, at the top) downwards.
    expect(bar.bounds.y).toBeCloseTo(layout.plot.y, 6);
    const valueAxisLabels = layout.document!.axes.find((candidate) => candidate.ref.axis === 'value')!.labels;
    expect(valueAxisLabels.map((label) => label.text)).toEqual(['one', 'mid', 'six']);
  });

  it('reverses categories and thins labels and tick marks by interval', () => {
    const layout = layoutFor(columns({
      argumentAxis: { categoryPlacement: 'betweenTicks', reversed: true, labelInterval: 2, tickMarkInterval: 2, majorTickMarks: 'outside' },
    }));
    expect(layout.argumentTicks.map((tick) => tick.text)).toEqual(['C1', 'C3']);
    expect(layout.argumentTicks[0]!.position).toBeGreaterThan(layout.argumentTicks[1]!.position);
    const argumentAxis = layout.document!.axes.find((axis) => axis.ref.axis === 'argument')!;
    // Five boundaries, every second one: 0, 2, 4.
    expect(argumentAxis.tickMarks).toHaveLength(3);
    expect(argumentAxis.tickMarks[0]!.y2 - argumentAxis.tickMarks[0]!.y1).toBe(5);
  });

  it('draws the title and legend inside the surface and leaves the rest to the plot', () => {
    const layout = layoutFor(columns({ title: 'Chart Title', legend: { position: 'bottom' } }));
    const document = layout.document!;
    expect(document.title!.lines.map((line) => line.text)).toEqual(['Chart Title']);
    expect(document.title!.lines[0]!.anchor).toBe('middle');
    expect(document.legend!.entries.map((entry) => entry.seriesName)).toEqual(['A', 'B']);
    expect(document.legend!.entries[0]!.key.kind).toBe('rect');
    expect(document.legend!.box.y).toBeGreaterThan(layout.plot.y + layout.plot.height);
    expect(layout.plot.y).toBeGreaterThan(document.title!.box.y + document.title!.box.height);
  });

  it('wraps and truncates long titles to the available width', () => {
    const style = documentStyle.title;
    const lines = wrapText('A rather long chart title that will not fit on one line at all', 120, style, estimateText, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.endsWith('…')).toBe(true);
    for (const line of lines) expect(estimateText(line, style)).toBeLessThanOrEqual(120);
  });

  it('mirrors legend entries in RTL and stacks them in the end corner', () => {
    const inputs = [
      { seriesName: 'One', label: 'One', key: { kind: 'rect' as const, color: 'red' } },
      { seriesName: 'Two', label: 'Two', key: { kind: 'line' as const, color: 'blue', markerSymbol: 'circle' as const, markerSize: 6 } },
    ];
    const content = { x: 0, y: 0, width: 300, height: 200 };
    const ltr = layoutDocumentLegend(inputs, content, 'bottom', documentStyle.legend, estimateText, false)!;
    const rtl = layoutDocumentLegend(inputs, content, 'bottom', documentStyle.legend, estimateText, true)!;
    expect(ltr.entries[0]!.box.x).toBeLessThan(ltr.entries[1]!.box.x);
    expect(rtl.entries[0]!.box.x).toBeGreaterThan(rtl.entries[1]!.box.x);
    expect(rtl.entries[0]!.key.x).toBeGreaterThan(rtl.entries[0]!.text.x);
    const corner = layoutDocumentLegend(inputs, content, 'topEnd', documentStyle.legend, estimateText, false)!;
    expect(corner.box.y).toBe(0);
    expect(corner.box.x + corner.box.width).toBeCloseTo(300, 6);
    expect(corner.remaining.width).toBeLessThan(300);
  });

  it('places the plot area manually as fractions of the chart', () => {
    const style = resolveDocumentStyle({ plotArea: { layout: { x: 0.1, y: 0.2, width: 0.5, height: 0.25 } } });
    const layout = layoutFor(columns(), { document: style });
    expect(layout.plot).toEqual({ x: 48, y: 57.6, width: 240, height: 72 });
  });

  it('draws spreadsheet smooth lines as Catmull-Rom Béziers through every point', () => {
    const path = smoothPath([{ x: 0, y: 0 }, { x: 60, y: 60 }, { x: 120, y: 0 }]);
    // First control point: p1 + (p2 - p0) / 6 with p0 = p1.
    expect(path).toBe('M0 0 C10 10 40 60 60 60 C80 60 110 10 120 0');
    expect(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe('M0 0 L10 5');
  });

  it('keeps scatter points in data order with their own x values', () => {
    const first: ReadonlyArray<Point> = [{ x: 3, y: 1 }, { x: 1, y: 2 }, { x: 3, y: 4 }];
    const second: ReadonlyArray<Point> = [{ x: 0.5, y: 3 }, { x: 2, y: null }, { x: 4, y: 2 }];
    const props: CgChartProps<Point> = {
      data: null,
      argumentAxis: { valueType: 'numeric', minimum: 0, maximum: 5, tickInterval: 1 },
      valueAxes: [{ minimum: 0, maximum: 5 }],
      series: [
        { type: 'scatter', name: 'First', data: first, argument: (point) => point.x, value: (point) => point.y, showLine: true, lineStyle: 'smooth' },
        { type: 'scatter', name: 'Second', data: second, argument: (point) => point.x, value: (point) => point.y, markerSymbol: 'diamond' },
      ],
    };
    const source = buildChartSourceModel(props, formatter);
    expect(source.series[0]!.points.map((point) => point.originalValue)).toEqual([1, 2, 4]);
    expect(source.series[1]!.points).toHaveLength(3);
    const layout = layoutFor(props);
    const markers = layout.shapes.filter((shape) => shape.kind === 'point' && shape.seriesName === 'First');
    expect(markers).toHaveLength(3);
    const line = layout.shapes.find((shape): shape is ChartPathShape => shape.kind === 'path' && shape.seriesName === 'First')!;
    expect(line.path).toContain('C');
    expect(layout.shapes.some((shape) => shape.kind === 'path' && shape.seriesName === 'Second')).toBe(false);
    expect(layout.argumentTicks.map((tick) => tick.text)).toEqual(['0', '1', '2', '3', '4', '5']);
    const table = projectChartTable(projectVisibleModel(source, new Set(['First', 'Second'])), formatter);
    expect(table.rows.map((row) => row.argument)).toEqual(['0.5', '1', '2', '3', '4']);
    expect(() => validateChartConfiguration({ ...props, series: [...props.series, { type: 'line', name: 'Line', argument: (point: Point) => point.x, value: (point: Point) => point.y }] }))
      .toThrow(/cannot mix scatter/i);
  });

  it('runs a primary bar axis and a secondary line axis on independent explicit scales', () => {
    const layout = layoutFor<Row>({
      data: rows,
      argumentAxis: { categoryPlacement: 'betweenTicks' },
      valueAxes: [
        { name: 'left', minimum: 0, maximum: 10, tickInterval: 5, barGapWidth: 100 },
        { name: 'right', position: 'end', minimum: 0, maximum: 1, ticks: [{ value: 0, text: '0%' }, { value: 1, text: '100%' }] },
      ],
      series: [
        { type: 'area', name: 'Area', valueAxisName: 'left', argument: (row) => row.category, value: (row) => row.b },
        { type: 'bar', name: 'Bars', valueAxisName: 'left', argument: (row) => row.category, value: (row) => row.a },
        { type: 'line', name: 'Line', valueAxisName: 'right', argument: (row) => row.category, value: (row) => row.a / 10 },
      ],
    });
    const [left, right] = layout.valueAxes;
    expect(left!.ticks.map((tick) => tick.text)).toEqual(['0', '5', '10']);
    expect(right!.ticks.map((tick) => tick.text)).toEqual(['0%', '100%']);
    const axes = layout.document!.axes.filter((axis) => axis.ref.axis === 'value');
    expect(axes[0]!.labels[0]!.x).toBeLessThan(layout.plot.x);
    expect(axes[1]!.labels[0]!.x).toBeGreaterThan(layout.plot.x + layout.plot.width);
    // 4 on 0–10 and 0.4 on 0–1 land at the same height.
    const bar = layout.shapes.find((shape): shape is ChartBarShape => shape.kind === 'bar' && shape.point.pointIndex === 0)!;
    const marker = layout.shapes.find((shape) => shape.kind === 'point' && shape.seriesName === 'Line' && shape.point.pointIndex === 0)!;
    expect(marker.kind === 'point' && marker.y).toBeCloseTo(bar.bounds.y, 6);
    // The single bar is centred in its category.
    expect(bar.bounds.x + bar.bounds.width / 2).toBeCloseTo(layout.plot.x + layout.plot.width / 8, 6);
  });

  it('positions point labels around bars and markers and composes pie label content', () => {
    const bars = layoutFor(columns({ pointLabels: { visible: true, position: 'insideBase' } }));
    const firstBar = bars.shapes.find((shape): shape is ChartBarShape => shape.kind === 'bar')!;
    const label = bars.labels.find((candidate) => candidate.seriesName === 'A' && candidate.pointIndex === 0)!;
    expect(label.y).toBeLessThan(firstBar.bounds.y + firstBar.bounds.height);
    expect(label.y).toBeGreaterThan(firstBar.bounds.y + firstBar.bounds.height - 20);
    const pie = layoutFor<Row>({
      data: rows,
      pointLabels: { visible: true },
      series: [{
        type: 'pie', name: 'Mix', argument: (row) => row.category, value: (row) => row.a,
        pointLabelContent: ['argument', 'percentage'], pointLabelSeparator: '; ', pointLabelPosition: 'center', explosion: 0.1,
        outlineColor: '#fff', outlineWidth: 1,
      }],
    });
    expect(pie.labels.map((candidate) => candidate.text)).toEqual(['C1; 28.6%', 'C2; 14.3%', 'C3; 21.4%', 'C4; 35.7%']);
    const slice = pie.shapes.find((shape) => shape.kind === 'arc')!;
    expect(slice.stroke).toBe('#fff');
    expect(slice.strokeWidth).toBe(1);
  });

  it('describes selection outlines for areas, axes, series and points', () => {
    const layout = layoutFor(columns({ title: 'Chart Title', legend: { position: 'bottom' } }));
    expect(selectionGeometry(layout, { kind: 'plotArea' }).rectangles).toEqual([layout.plot]);
    expect(selectionGeometry(layout, { kind: 'plotArea' }).handles).toHaveLength(4);
    expect(selectionGeometry(layout, { kind: 'title' }).rectangles).toHaveLength(1);
    expect(selectionGeometry(layout, { kind: 'legendEntry', seriesName: 'B' }).rectangles).toHaveLength(1);
    expect(selectionGeometry(layout, { kind: 'axis', axis: 'value', axisName: 'primary' }).rectangles).toHaveLength(1);
    expect(selectionGeometry(layout, { kind: 'series', seriesName: 'A' }).handles).toHaveLength(4);
    expect(selectionGeometry(layout, { kind: 'point', seriesName: 'A', pointIndex: 2 }).rectangles).toHaveLength(1);
    expect(selectionGeometry(layout, { kind: 'majorGridLines', axis: 'value', axisName: 'primary' }).handles).toHaveLength(14);
  });

  it('scales dash patterns with the line width in document layout', () => {
    expect(dashArray('dash', 2, false)).toBe('8 5');
    expect(dashArray('dash', 2, true)).toBe('8 6');
    expect(dashArray('longDashDot', 1, false)).toBe('8 3 1 3');
    expect(dashArray('solid', 3, true)).toBeUndefined();
  });

  it('lays out twenty series of five thousand points', () => {
    const points = Array.from({ length: 5_000 }, (_, index) => ({ x: index, y: Math.sin(index / 50) * 10 }));
    const props: CgChartProps<{ x: number; y: number }> = {
      data: points,
      argumentAxis: { valueType: 'numeric' },
      series: Array.from({ length: 20 }, (_, index) => ({
        type: 'scatter' as const, name: `S${index}`, argument: (point: { x: number }) => point.x + index * 0.5,
        value: (point: { y: number }) => point.y + index, showLine: true, showMarkers: false,
      })),
    };
    const layout = layoutFor(props);
    expect(layout.shapes.filter((shape) => shape.kind === 'path')).toHaveLength(20);
    expect(layout.hitTargets).toHaveLength(100_000);
  }, 60_000);
});

describe('CgChart document rendering', () => {
  const props: CgChartProps<Row> = {
    ...columns(),
    title: 'Chart Title',
    width: 480,
    height: 288,
    interactive: false,
    appearance: {
      fontFamily: 'Calibri, sans-serif',
      chartArea: { fill: '#FFFFFF', border: { color: '#D9D9D9', width: 1 } },
      title: { fontSize: 18.67, color: '#595959' },
      axisLabels: { fontSize: 12, color: '#595959' },
    },
  };

  it('renders the exact size with the frame, title and legend inside the SVG', () => {
    const html = renderToString(<CgChart {...props} />);
    expect(html).toContain('viewBox="0 0 480 288"');
    expect(html).toContain('data-cg-chart-width="480"');
    expect(html).toContain('data-cg-element="chartArea"');
    expect(html).toContain('stroke="#D9D9D9"');
    expect(html).toContain('font-size="18.67"');
    expect(html).toContain('data-cg-element="legend"');
    expect(html).not.toContain('<details');
  });

  it('reports the element under the pointer and draws the highlight', () => {
    const onElementPointerDown = vi.fn<(detail: CgChartElementPointerDetail) => void>();
    const { container, rerender } = render(<CgChart {...props} onElementPointerDown={onElementPointerDown} />);
    fireEvent.pointerDown(container.querySelector('[data-cg-element="title"] text')!);
    expect(onElementPointerDown.mock.calls[0]![0].element).toEqual({ kind: 'title' });
    fireEvent.pointerDown(container.querySelector('[data-cg-chart-point][data-cg-series-name="B"][data-cg-point-index="1"]')!);
    expect(onElementPointerDown.mock.calls[1]![0].element).toEqual({ kind: 'point', seriesName: 'B', pointIndex: 1 });
    fireEvent.pointerDown(container.querySelector('[data-cg-element="axis"][data-cg-axis="value"] rect')!);
    expect(onElementPointerDown.mock.calls[2]![0].element).toEqual({ kind: 'axis', axis: 'value', axisName: 'primary' });
    fireEvent.pointerDown(container.querySelector('[data-cg-element="legendEntry"][data-cg-series-name="A"] rect')!);
    expect(onElementPointerDown.mock.calls[3]![0].element).toEqual({ kind: 'legendEntry', seriesName: 'A' });
    fireEvent.pointerDown(container.querySelector('[data-cg-element="majorGridLines"] path')!);
    expect(onElementPointerDown.mock.calls[4]![0].element).toEqual({ kind: 'majorGridLines', axis: 'value', axisName: 'primary' });
    expect(container.querySelector('[data-cg-chart-selection]')).toBeNull();
    rerender(<CgChart {...props} highlightedElement={{ kind: 'legend' }} />);
    expect(container.querySelector('[data-cg-chart-selection]')).not.toBeNull();
  });

  it('turns off tooltips and focus styling when not interactive', () => {
    const { container } = render(<CgChart {...props} />);
    expect(container.querySelector('svg')!.getAttribute('class')).toMatch(/static/u);
    fireEvent.pointerOver(container.querySelector('[data-cg-chart-point]')!);
    expect(screen.getByRole('tooltip', { hidden: true })).not.toBeVisible();
    expect(container.querySelector('[data-cg-hovering]')).toBeNull();
  });

  it('shows the too-small message only below 120 by 80 pixels', () => {
    const { rerender } = render(<CgChart {...props} width={120} height={80} />);
    expect(screen.queryByText('Not enough room to draw this chart')).toBeNull();
    rerender(<CgChart key="small" {...props} width={119} height={80} />);
    expect(screen.getByText('Not enough room to draw this chart')).toBeInTheDocument();
  });
});
