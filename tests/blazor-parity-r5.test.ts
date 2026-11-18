import { describe, expect, it } from 'vitest';
import type { CgChartProps } from '../src/components/Chart';
import { estimateTextWidth, fitSideBySide, planStackedAxisLabels, thinSideBySide } from '../src/components/Chart/chartAxisLabels';
import { resolveDocumentStyle } from '../src/components/Chart/chartAppearance';
import { createChartFormatter, resolveChartStrings } from '../src/components/Chart/chartFormatting';
import { buildChartLayout } from '../src/components/Chart/chartLayout';
import type { ChartLayoutRequest } from '../src/components/Chart/chartLayoutTypes';
import { buildChartSourceModel, projectVisibleModel } from '../src/components/Chart/chartModel';
import { estimateText } from '../src/components/Chart/chartText';

interface Row { readonly category: string; readonly value: number }
const formatter = createChartFormatter('en-US', 'UTC', resolveChartStrings());

function layoutFor(props: CgChartProps<Row>, overrides: Partial<ChartLayoutRequest<Row>> = {}) {
  const source = buildChartSourceModel(props, formatter);
  return buildChartLayout<Row>({
    model: projectVisibleModel(source, new Set(props.series.map((series) => series.name))),
    width: 640, height: 360, orientation: props.orientation ?? 'vertical', rtl: false, formatter,
    ...(props.pointLabels ? { pointLabels: props.pointLabels } : {}),
    ...(props.valueAxes ? { valueAxes: props.valueAxes } : {}),
    ...overrides,
  });
}

const bars = (data: ReadonlyArray<Row>, extra: Partial<CgChartProps<Row>> = {}): CgChartProps<Row> => ({
  data, series: [{ type: 'bar', name: 'Amount', argument: (row) => row.category, value: (row) => row.value }], ...extra,
});

describe('axis label planners', () => {
  it('stacks labels by line height, keeps the first and last, and shortens long names', () => {
    const labels = Array.from({ length: 40 }, (_, index) => `Category ${index + 1}`);
    labels[3] = 'A remarkably long customer name that would push the bars off the chart';
    const plan = planStackedAxisLabels(labels, 200, 'auto', 24, 13, 160);
    const indexes = plan.items.map((item) => item.index);
    expect(indexes[0]).toBe(0);
    expect(indexes.at(-1)).toBe(39);
    expect(indexes.length).toBeLessThan(40);
    const all = planStackedAxisLabels(labels, 2000, 'auto', 24, 13, 160);
    const long = all.items.find((item) => item.index === 3)!;
    expect(long.displayText.endsWith('…')).toBe(true);
    expect(long.fullText).toBe(labels[3]);
    expect(estimateTextWidth(long.displayText)).toBeLessThanOrEqual(152);
    expect(planStackedAxisLabels(labels, 200, 'none', 24, 13, 160).items).toHaveLength(40);
  });

  it('thins side-by-side labels so none overprints, keeping both ends', () => {
    const positions = [0, 30, 60, 90, 120, 150];
    const widths = positions.map(() => 50);
    expect(fitSideBySide(positions, widths)).toBe(false);
    const kept = [...thinSideBySide(positions, widths)].sort((left, right) => left - right);
    expect(kept[0]).toBe(0);
    expect(kept.at(-1)).toBe(5);
    const keptPositions = kept.map((index) => positions[index]!);
    expect(fitSideBySide(keptPositions, keptPositions.map(() => 50))).toBe(true);
  });
});

describe('horizontal bar charts', () => {
  it('caps the category strip at 40% of the chart and plans categories by line height', () => {
    const data = Array.from({ length: 60 }, (_, index) => ({ category: index === 0 ? 'Northern regional distribution warehouse and logistics hub' : `C${index}`, value: index + 1 }));
    const layout = layoutFor(bars(data, { orientation: 'horizontal' }), { orientation: 'horizontal' });
    expect(layout.plot.x).toBeLessThanOrEqual(640 * 0.4 + 18);
    expect(layout.argumentTicks.length).toBeLessThan(60);
    expect(layout.argumentTicks[0]!.fullText).toBe(data[0]!.category);
    expect(layout.argumentTicks[0]!.text.endsWith('…')).toBe(true);
  });

  it('chooses a value tick count whose labels clear each other', () => {
    const data = [{ category: 'A', value: 12_345_678_901 }, { category: 'B', value: 98_765_432_109 }];
    const layout = layoutFor(bars(data, { orientation: 'horizontal' }), { orientation: 'horizontal', width: 360 });
    const ticks = layout.valueAxes[0]!.ticks.filter((tick) => tick.text);
    expect(fitSideBySide(ticks.map((tick) => tick.position), ticks.map((tick) => estimateTextWidth(tick.text)))).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
  });
});

describe('outside bar labels', () => {
  it('keeps room at the end of the value axis so outside labels stay on the plot', () => {
    const data = [{ category: 'A', value: 100 }, { category: 'B', value: 40 }];
    const labelled = layoutFor(bars(data, { pointLabels: { visible: true } }));
    const top = labelled.labels.reduce((minimum, label) => Math.min(minimum, label.y - 13), Number.POSITIVE_INFINITY);
    expect(top).toBeGreaterThanOrEqual(labelled.plot.y - 0.5);
    const plain = layoutFor(bars(data));
    const tallest = (layout: typeof plain) => Math.min(...layout.shapes.filter((shape) => shape.kind === 'bar').map((shape) => shape.bounds.y));
    expect(tallest(labelled)).toBeGreaterThan(tallest(plain));
    expect(tallest(labelled) - labelled.plot.y).toBeLessThanOrEqual(labelled.plot.height * 0.4 + 0.5);
  });
});

describe('document pie labels', () => {
  it('shrinks the pie until outside labels stay inside the plot', () => {
    const data = [
      { category: 'Wholesale partners', value: 45 },
      { category: 'Retail showrooms', value: 30 },
      { category: 'Online channel sales', value: 25 },
    ];
    const props: CgChartProps<Row> = { data, series: [{ type: 'pie', name: 'Mix', argument: (row) => row.category, value: (row) => row.value, showPointLabels: true, pointLabelPosition: 'outsideEnd', pointLabelContent: ['argument'] }] };
    const layout = layoutFor(props, { document: resolveDocumentStyle({ chartArea: { padding: 0, border: 'none' } }), measure: estimateText, width: 480, height: 300, pointLabels: { visible: true } });
    const arcs = layout.shapes.filter((shape) => shape.kind === 'arc');
    const radius = Math.max(...arcs.map((shape) => Math.max(shape.bounds!.width, shape.bounds!.height))) / 2;
    expect(radius).toBeLessThan(Math.min(layout.plot.width, layout.plot.height) / 2 - 12);
    for (const label of layout.labels) {
      const width = estimateText(label.text, { size: 12, color: '', bold: false, italic: false });
      expect(label.x - width / 2).toBeGreaterThanOrEqual(layout.plot.x - 1);
      expect(label.x + width / 2).toBeLessThanOrEqual(layout.plot.x + layout.plot.width + 1);
    }
  });
});
