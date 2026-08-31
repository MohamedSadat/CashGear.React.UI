import { describe, expect, it, vi } from 'vitest';
import type { CgChartProps } from '../src/components/Chart';
import { planAxisLabels } from '../src/components/Chart/chartAxisLabels';
import { createChartFormatter, resolveChartStrings } from '../src/components/Chart/chartFormatting';
import { buildChartLayout } from '../src/components/Chart/chartLayout';
import { buildChartSourceModel, projectVisibleModel } from '../src/components/Chart/chartModel';
import { arcPath, monotonePath, svgNumber } from '../src/components/Chart/chartPaths';
import { createNumericScale } from '../src/components/Chart/chartScales';
import { buildStackPositions, stackPositionKey } from '../src/components/Chart/chartStacking';
import { projectChartTable } from '../src/components/Chart/chartTable';
import { createDateDomain, createNumericDomain } from '../src/components/Chart/chartTicks';
import {
  exactFromNumeric,
  exactRatio,
  exactText,
  normalizeArgument,
} from '../src/components/Chart/chartValues';
import { validateChartConfiguration } from '../src/components/Chart/chartValidation';
import { normalizeCgDecimalValue } from '../src/components/RangeSelector';

interface Datum {
  readonly category: string;
  readonly value: number | bigint | ReturnType<typeof normalizeCgDecimalValue> | null;
}

const formatter = createChartFormatter('en-US', 'UTC', resolveChartStrings());

function props(
  data: ReadonlyArray<Datum>,
  overrides: Partial<CgChartProps<Datum>> = {},
): CgChartProps<Datum> {
  return {
    data,
    series: [{ type: 'bar', name: 'Revenue', argument: (item) => item.category, value: (item) => item.value }],
    ...overrides,
  };
}

describe('CgChart pure engine', () => {
  it('preserves arbitrary precision decimal and bigint values through ratios and scales', () => {
    const minimum = exactFromNumeric(normalizeCgDecimalValue('-100000000000000000000.01'));
    const maximum = exactFromNumeric(normalizeCgDecimalValue('100000000000000000000.01'));
    const middle = exactFromNumeric(0n);
    expect(exactRatio(middle, minimum, maximum)).toBeCloseTo(0.5, 12);
    expect(exactText(exactFromNumeric(9_007_199_254_740_993n))).toBe('9007199254740993');
    const scale = createNumericScale(minimum, maximum, 20, 620);
    expect(scale.project(middle)).toBeCloseTo(320, 8);
  });

  it('builds an immutable shared category union, keeps first duplicates, and synthesizes gaps', () => {
    const customize = vi.fn(() => ({ color: '#123456' }));
    const first = [{ category: 'B', value: 2 }, { category: 'A', value: 1 }, { category: 'B', value: 99 }];
    const second = [{ category: 'C', value: 4 }, { category: 'A', value: null }];
    const model = buildChartSourceModel({
      data: first,
      series: [
        { type: 'line', name: 'First', argument: (item) => item.category, value: (item) => item.value },
        { type: 'bar', name: 'Second', data: second, argument: (item) => item.category, value: (item) => item.value, missingValueMode: 'zero' },
      ],
      customizePoint: customize,
    }, formatter);

    expect(model.arguments.map((argument) => argument.categoryText)).toEqual(['B', 'A', 'C']);
    expect(model.series[0]!.points.map((point) => point.originalValue)).toEqual([2, 1, null]);
    expect(model.series[1]!.points.map((point) => point.originalValue)).toEqual([null, null, 4]);
    expect(model.series[1]!.points[0]).toMatchObject({ substitutedZero: true, synthetic: true, formattedValue: '0' });
    expect(model.series[1]!.points[1]).toMatchObject({ substitutedZero: true, synthetic: false });
    expect(customize).toHaveBeenCalledTimes(4);
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.series[0]!.points)).toBe(true);
    expect(first[0]).toEqual({ category: 'B', value: 2 });
  });

  it('does not rerun accessors or customization during visibility projection and layout', () => {
    const argument = vi.fn((item: Datum) => item.category);
    const value = vi.fn((item: Datum) => item.value);
    const customize = vi.fn(() => null);
    const chartProps = props([{ category: 'A', value: 1 }, { category: 'B', value: 2 }], {
      series: [{ type: 'line', name: 'Revenue', argument, value, lineStyle: 'monotone' }],
      customizePoint: customize,
    });
    const source = buildChartSourceModel(chartProps, formatter);
    const calls = [argument.mock.calls.length, value.mock.calls.length, customize.mock.calls.length];
    const visible = projectVisibleModel(source, new Set(['Revenue']));
    buildChartLayout({ model: visible, width: 640, height: 320, orientation: 'vertical', rtl: false, formatter });
    buildChartLayout({ model: visible, width: 800, height: 400, orientation: 'vertical', rtl: false, formatter });
    projectVisibleModel(source, new Set());
    expect([argument.mock.calls.length, value.mock.calls.length, customize.mock.calls.length]).toEqual(calls);
  });

  it('stacks positive and negative values independently and normalizes full stacks', () => {
    const data = [{ category: 'A', value: 2 }, { category: 'B', value: -3 }];
    const source = buildChartSourceModel({
      data,
      series: [
        { type: 'bar', name: 'One', stacking: 'fullStacked', stackName: 'total', argument: (item) => item.category, value: (item) => item.value },
        { type: 'bar', name: 'Two', stacking: 'fullStacked', stackName: 'total', argument: (item) => item.category, value: (item) => item.category === 'A' ? 6 : -1 },
      ],
    }, formatter);
    const positions = buildStackPositions(source.series);
    expect(exactText(positions.get(stackPositionKey('One', 0))!.end)).toBe('0.25');
    expect(exactText(positions.get(stackPositionKey('Two', 0))!.start)).toBe('0.25');
    expect(exactText(positions.get(stackPositionKey('Two', 0))!.end)).toBe('1');
    expect(exactText(positions.get(stackPositionKey('One', 1))!.end)).toBe('-0.75');
    expect(exactText(positions.get(stackPositionKey('Two', 1))!.end)).toBe('-1');
  });

  it('creates indexed nice numeric ticks without losing exact endpoints', () => {
    const domain = createNumericDomain([
      exactFromNumeric(normalizeCgDecimalValue('0.000000000000000001')),
      exactFromNumeric(normalizeCgDecimalValue('0.000000000000000009')),
    ], undefined, false, 5);
    expect(exactText(domain.interval)).toBe('0.000000000000000002');
    expect(domain.ticks.map(exactText)).toEqual([
      '0', '0.000000000000000002', '0.000000000000000004',
      '0.000000000000000006', '0.000000000000000008', '0.00000000000000001',
    ]);
  });

  it('uses leap-safe calendar ticks and locale-aware week candidates', () => {
    const day = 86_400_000n;
    const domain = createDateDomain(19_723n * day, 20_453n * day, 6, 'en-US', 'civilDate');
    expect(['quarter', 'year']).toContain(domain.unit);
    expect(domain.ticks.length).toBeGreaterThan(1);
    expect(domain.ticks.every((tick, index) => index === 0 || tick > domain.ticks[index - 1]!)).toBe(true);
  });
  it('projects continuous argument axes from generated numeric and calendar ticks', () => {
    const numericData = Array.from({ length: 20 }, (_, x) => ({ x, y: x + 1 }));
    const numericProps: CgChartProps<(typeof numericData)[number]> = {
      data: numericData,
      argumentAxis: { valueType: 'numeric', minimum: 0, maximum: 20, tickInterval: 5 },
      series: [{ type: 'bar', name: 'Numeric', argument: (item) => item.x, value: (item) => item.y }],
    };
    const numericSource = buildChartSourceModel(numericProps, formatter);
    const numericLayout = buildChartLayout({
      model: projectVisibleModel(numericSource, new Set(['Numeric'])), width: 640, height: 320,
      orientation: 'vertical', rtl: false, formatter, argumentAxis: numericProps.argumentAxis,
      constantLines: [{ axis: 'argument', value: 7.5, label: 'Midpoint' }],
    });
    expect(numericLayout.argumentTicks.map((tick) => tick.fullText)).toEqual(['0', '5', '10', '15', '20']);
    expect(numericLayout.argumentTicks).toHaveLength(5);
    expect(numericLayout.constantLines).toHaveLength(1);
    expect(numericLayout.shapes.filter((shape) => shape.kind === 'bar')).toHaveLength(20);

    const labelFormatter = vi.fn((value) => `tick:${String(value)}`);
    const dateData = [{ x: '2026-01-01', y: 1 }, { x: '2026-01-07', y: 2 }];
    const dateProps: CgChartProps<(typeof dateData)[number]> = {
      data: dateData,
      argumentAxis: { valueType: 'date', tickInterval: 172_800_000, labelFormatter },
      series: [{ type: 'line', name: 'Dates', argument: (item) => item.x, value: (item) => item.y }],
    };
    const dateSource = buildChartSourceModel(dateProps, formatter);
    labelFormatter.mockClear();
    const dateLayout = buildChartLayout({
      model: projectVisibleModel(dateSource, new Set(['Dates'])), width: 640, height: 320,
      orientation: 'vertical', rtl: false, formatter, argumentAxis: dateProps.argumentAxis,
    });
    expect(dateLayout.argumentTicks.map((tick) => tick.fullText)).toEqual([
      'tick:2026-01-01', 'tick:2026-01-03', 'tick:2026-01-05', 'tick:2026-01-07',
    ]);
    expect(labelFormatter.mock.calls.slice(-4).map(([value]) => String(value))).toEqual([
      '2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07',
    ]);
  });

  it('runs the label ladder and always retains first and last when thinning', () => {
    const labels = Array.from({ length: 12 }, (_, index) => `Very long category ${index + 1}`);
    const plan = planAxisLabels(labels, 260, 'auto', 0, 12);
    expect(plan.items[0]!.index).toBe(0);
    expect(plan.items.at(-1)!.index).toBe(labels.length - 1);
    expect(plan.items.length).toBeLessThan(labels.length);
    const shortened = planAxisLabels(['A deliberately long label'], 100, 'shorten', 0, 8);
    expect(shortened.items[0]).toMatchObject({ fullText: 'A deliberately long label', displayText: 'A delib…' });
  });

  it('serializes invariant SVG numbers and creates bounded monotone and donut paths', () => {
    expect(svgNumber(-0)).toBe('0');
    expect(svgNumber(1.23456789)).toBe('1.2346');
    expect(monotonePath([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }])).toMatch(/^M0 0 C/u);
    const donut = arcPath(50, 50, 40, 20, -Math.PI / 2, Math.PI);
    expect(donut).toContain('A40 40');
    expect(donut).toContain('A20 20');
    expect(donut.endsWith('Z')).toBe(true);
  });

  it('lays out Cartesian and donut families with deterministic too-small behavior', () => {
    const cartesian = buildChartSourceModel(props([{ category: 'A', value: 3 }, { category: 'B', value: -2 }]), formatter);
    const cartesianLayout = buildChartLayout({
      model: projectVisibleModel(cartesian, new Set(['Revenue'])),
      width: 640,
      height: 320,
      orientation: 'vertical',
      rtl: false,
      formatter,
      constantLines: [{ value: 10, label: 'Target', extendAxisRange: true }],
      annotations: [{ text: 'Peak', argument: 'A', value: 3 }],
    });
    expect(cartesianLayout.shapes.some((shape) => shape.kind === 'bar')).toBe(true);
    expect(cartesianLayout.constantLines).toHaveLength(1);
    expect(cartesianLayout.annotations).toHaveLength(1);
    expect(buildChartLayout({
      model: projectVisibleModel(cartesian, new Set(['Revenue'])),
      width: 159,
      height: 119,
      orientation: 'vertical',
      rtl: false,
      formatter,
    }).tooSmall).toBe(true);

    const donutSource = buildChartSourceModel({
      data: [{ category: 'Cash', value: 75 }, { category: 'Credit', value: 25 }],
      series: [{ type: 'donut', name: 'Mix', argument: (item) => item.category, value: (item) => item.value, showPercentages: true, showPointLabels: true }],
    }, formatter);
    const donutLayout = buildChartLayout({ model: projectVisibleModel(donutSource, new Set(['Mix'])), width: 640, height: 320, orientation: 'vertical', rtl: false, formatter, pointLabels: { visible: true } });
    expect(donutLayout.shapes.filter((shape) => shape.kind === 'arc')).toHaveLength(2);
    expect(donutLayout.hitTargets.map((target) => target.percentage)).toEqual(['75%', '25%']);
    expect(donutLayout.labels.map((label) => label.text)).toEqual(['75%', '25%']);
    expect(donutLayout.argumentTicks).toEqual([]);
    expect(donutLayout.valueAxes).toEqual([]);
  });
  it('omits hidden value axes from layout while retaining their series geometry', () => {
    const source = buildChartSourceModel(props([{ category: 'A', value: 3 }]), formatter);
    const layout = buildChartLayout({
      model: projectVisibleModel(source, new Set(['Revenue'])), width: 640, height: 320,
      orientation: 'vertical', rtl: false, formatter, valueAxes: [{ name: 'primary', visible: false }],
    });
    expect(layout.valueAxes).toEqual([]);
    expect(layout.shapes.some((shape) => shape.kind === 'bar')).toBe(true);
  });

  it('projects accessible Cartesian and pie tables from visible data', () => {
    const source = buildChartSourceModel(props([{ category: 'A', value: 2 }, { category: 'B', value: null }]), formatter);
    const table = projectChartTable(projectVisibleModel(source, new Set(['Revenue'])), formatter);
    expect(table.seriesNames).toEqual(['Revenue']);
    expect(table.rows).toEqual([
      expect.objectContaining({ argument: 'A', cells: [expect.objectContaining({ text: '2' })] }),
      expect.objectContaining({ argument: 'B', cells: [expect.objectContaining({ text: 'no data' })] }),
    ]);
    expect(Object.isFrozen(table.rows)).toBe(true);
  });

  it('distinguishes temporal syntax and rejects incoherent configurations', () => {
    expect(normalizeArgument('2026-02-28', 'date')).toMatchObject({ kind: 'date', temporalKind: 'civilDate' });
    expect(normalizeArgument('2026-02-28T12:30:00.000', 'date')).toMatchObject({ kind: 'date', temporalKind: 'localDateTime' });
    expect(() => buildChartSourceModel({
      data: [{ category: '2026-01-01', value: 1 }, { category: '2026-01-02T00:00:00.000', value: 2 }],
      argumentAxis: { valueType: 'date' },
      series: [{ type: 'line', name: 'Mixed', argument: (item) => item.category, value: (item) => item.value }],
    }, formatter)).toThrow(/cannot mix civil dates/i);
    expect(() => validateChartConfiguration({
      data: [],
      series: [
        { type: 'bar', name: 'Cartesian', argument: () => 'A', value: () => 1 },
        { type: 'pie', name: 'Pie', argument: () => 'A', value: () => 1 },
      ],
    })).toThrow(/cannot mix pie/i);
    expect(() => validateChartConfiguration({
      data: [],
      series: [{ type: 'area', name: 'Bad stack', stacking: 'stacked', argument: () => 'A', value: () => 1 }],
    })).toThrow(/stackName/i);
    expect(() => validateChartConfiguration(props([], {
      argumentAxis: { valueType: 'numeric', numberFormatOptions: { style: 'currency' } },
    }))).toThrow(/format options/i);
    expect(() => buildChartSourceModel(props([{ category: 'A', value: 1 }], {
      argumentAxis: { tickInterval: 1 },
    }), formatter)).toThrow(/category argument axes/i);
  });
});
