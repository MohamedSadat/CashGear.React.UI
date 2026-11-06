import type {
  CgChartAxisCrossing,
  CgChartAxisRef,
  CgChartConstantLineDescriptor,
  CgChartDashStyle,
  CgChartNumericValue,
  CgChartPointLabelOptions,
  CgChartPointLabelPosition,
  CgChartSeriesDescriptor,
  CgChartTextStyle,
  CgChartTickMarkStyle,
  CgChartValueAxisDescriptor,
} from './CgChart.types';
import { estimateTextWidth, planAxisLabels } from './chartAxisLabels';
import type { AxisLabelPlan, AxisLabelPlanItem } from './chartAxisLabels';
import {
  centredBaseline,
  insetRectangle,
  layoutDocumentLegend,
  layoutDocumentTitle,
} from './chartDocument';
import type { ChartLegendEntryInput, ChartLegendKeyInput } from './chartDocument';
import type { ChartRectangle } from './chartGeometry';
import { maximumOf, rectanglesOverlap, unionRectangles } from './chartGeometry';
import type {
  ChartAnnotationLayout,
  ChartArcShape,
  ChartAxisTickLayout,
  ChartBarShape,
  ChartConstantLineLayout,
  ChartDocumentAxis,
  ChartDocumentGrid,
  ChartDocumentLayout,
  ChartHitTarget,
  ChartLayout,
  ChartLayoutRequest,
  ChartLineSegment,
  ChartPointLabelLayout,
  ChartShape,
  ChartTextItem,
  ChartValueAxisLayout,
} from './chartLayoutTypes';
import type { ChartPoint, ChartSeries } from './chartModel';
import { arcPath, monotonePath, roundedRectPath, smoothPath, straightPath } from './chartPaths';
import type { SvgPoint } from './chartPaths';
import {
  clusteredBarSlot,
  createBandScale,
  createCategoryScale,
  createNumericScale,
  groupedBandSlot,
} from './chartScales';
import type { BandScale, NumericScale } from './chartScales';
import { buildStackPositions, stackPositionKey } from './chartStacking';
import type { ChartStackPosition } from './chartStacking';
import {
  dashArray,
  estimateText,
  isNoPaint,
  lineCapFor,
  mergeTextStyle,
  resolveStroke,
} from './chartText';
import type { ChartStroke, ChartTextMeasurer, ChartTextStyle } from './chartText';
import { createDateDomain, createNumericDomain } from './chartTicks';
import type { NumericDomain } from './chartTicks';
import {
  exactAdd,
  exactCompare,
  exactDivide,
  exactFromNumeric,
  exactMultiplyInteger,
  exactRatio,
  exactSubtract,
  exactText,
  normalizeArgument,
} from './chartValues';
import type { ExactValue, NormalizedArgument } from './chartValues';

export type {
  ChartAnnotationLayout,
  ChartArcShape,
  ChartAxisTickLayout,
  ChartBarShape,
  ChartConstantLineLayout,
  ChartDocumentAxis,
  ChartDocumentGrid,
  ChartDocumentLayout,
  ChartHitTarget,
  ChartLayout,
  ChartLayoutRequest,
  ChartLegendEntryLayout,
  ChartLegendKey,
  ChartLineSegment,
  ChartPathShape,
  ChartPointLabelLayout,
  ChartPointShape,
  ChartShape,
  ChartTextItem,
  ChartValueAxisLayout,
} from './chartLayoutTypes';

const MAJOR_TICK = 5;
const MINOR_TICK = 3;
const MAX_MINOR_TICKS = 1_000;

type Side = 'left' | 'right' | 'top' | 'bottom';

/** A numeric domain plus caller-given tick texts and minor ticks. */
interface AxisDomain extends NumericDomain {
  readonly texts?: ReadonlyArray<string>;
  readonly minor: ReadonlyArray<ExactValue>;
}

interface ArgumentProjection {
  readonly point: (argument: NormalizedArgument, index: number) => number;
  readonly ticks: ReadonlyArray<ChartAxisTickLayout>;
  readonly plan: AxisLabelPlan;
  readonly band: BandScale | null;
  /** True when argument minimum is at the physical far end (right or bottom). */
  readonly physicallyReversed: boolean;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  /** Category tick-mark positions, or numeric tick positions. */
  readonly tickMarks: ReadonlyArray<number>;
  readonly minorTicks: ReadonlyArray<number>;
  /** Fraction (0 at the minimum, 1 at the maximum) where a crossing sits along this axis. */
  readonly fraction: (crossing: CgChartAxisCrossing) => number;
}

function emptyLayout(width: number, height: number, tooSmall: boolean, isEmpty: boolean): ChartLayout {
  return Object.freeze({
    width, height, tooSmall, isEmpty,
    plot: Object.freeze({ x: 0, y: 0, width, height }),
    argumentTicks: Object.freeze([]),
    argumentLabelPlan: Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 }),
    valueAxes: Object.freeze([]), shapes: Object.freeze([]), labels: Object.freeze([]),
    constantLines: Object.freeze([]), annotations: Object.freeze([]), hitTargets: Object.freeze([]),
    document: null,
  });
}

function resolvedAxes(axes: ReadonlyArray<CgChartValueAxisDescriptor> | undefined): ReadonlyArray<CgChartValueAxisDescriptor> {
  return axes?.length ? axes : [Object.freeze({ name: 'primary' })];
}

function resolvedAxisPosition(axis: CgChartValueAxisDescriptor, index: number): 'start' | 'end' {
  return axis.position === 'start' || axis.position === 'end' ? axis.position : index === 0 ? 'start' : 'end';
}

function axisDescriptor<TItem>(request: ChartLayoutRequest<TItem>, name: string): CgChartValueAxisDescriptor | undefined {
  return resolvedAxes(request.valueAxes).find((axis) => (axis.name ?? 'primary') === name);
}

function valueAxisText(
  request: ChartLayoutRequest<unknown>,
  axis: CgChartValueAxisDescriptor,
  domain: AxisDomain,
  index: number,
): string {
  return domain.texts?.[index] ?? request.formatter.formatAxisValue(domain.ticks[index]!, axis, domain.interval);
}

function valueAxisLabelWidth<TItem>(
  request: ChartLayoutRequest<TItem>,
  axis: CgChartValueAxisDescriptor,
  domain: AxisDomain,
): number {
  return Math.max(0, ...domain.ticks.map((_tick, index) => estimateTextWidth(
    valueAxisText(request as ChartLayoutRequest<unknown>, axis, domain, index),
  )));
}

function chartPlot<TItem>(
  request: ChartLayoutRequest<TItem>,
  domains: ReadonlyMap<string, AxisDomain>,
): ChartRectangle {
  const { width, height } = request;
  if (request.model.kind === 'pie') {
    return Object.freeze({ x: 24, y: 16, width: Math.max(1, width - 48), height: Math.max(1, height - 32) });
  }
  const axes = resolvedAxes(request.valueAxes);
  const argumentLabels = request.model.arguments.map((argument) => request.formatter.formatArgument(argument, request.argumentAxis));
  const maximumArgumentWidth = maximumOf(argumentLabels.map((label) => estimateTextWidth(label)), 0);
  if (request.orientation === 'vertical') {
    let startWidth = 0;
    let endWidth = 0;
    axes.forEach((axis, index) => {
      if (axis.visible === false) return;
      const domain = domains.get(axis.name ?? 'primary');
      if (!domain) return;
      const reserve = valueAxisLabelWidth(request, axis, domain) + 18 + (axis.title ? 22 : 0);
      if (resolvedAxisPosition(axis, index) === 'start') startWidth += reserve;
      else endWidth += reserve;
    });
    const endpointReserve = request.model.argumentKind === 'category' ? 0 : maximumArgumentWidth / 2 + 6;
    const left = Math.max(36, request.rtl ? endWidth : startWidth, endpointReserve);
    const right = Math.max(18, request.rtl ? startWidth : endWidth, endpointReserve);
    return Object.freeze({
      x: left,
      y: 20,
      width: Math.max(1, width - left - right),
      height: Math.max(1, height - 82),
    });
  }
  const argumentReserve = maximumArgumentWidth + 18 + (request.argumentAxis?.title ? 20 : 0);
  let startAxes = 0;
  let endAxes = 0;
  axes.forEach((axis, index) => {
    if (axis.visible === false) return;
    const reserve = 18 + (axis.title ? 20 : 0);
    if (resolvedAxisPosition(axis, index) === 'start') startAxes += reserve;
    else endAxes += reserve;
  });
  const left = request.rtl ? 20 : Math.max(46, argumentReserve);
  const right = request.rtl ? Math.max(46, argumentReserve) : 20;
  const top = 16 + startAxes;
  const bottom = 34 + endAxes;
  return Object.freeze({ x: left, y: top, width: Math.max(1, width - left - right), height: Math.max(1, height - top - bottom) });
}

function constantLinesForAxis(
  request: ChartLayoutRequest<unknown>,
  axisName: string,
): ReadonlyArray<CgChartConstantLineDescriptor> {
  const nested = resolvedAxes(request.valueAxes).find((axis) => (axis.name ?? 'primary') === axisName)?.constantLines ?? [];
  return [...nested, ...(request.constantLines ?? [])].filter((line) => line.axis !== 'argument' && (line.axisName ?? 'primary') === axisName);
}

function minorValues(domain: NumericDomain, interval: CgChartNumericValue | undefined): ReadonlyArray<ExactValue> {
  if (interval === undefined) return Object.freeze([]);
  const step = exactFromNumeric(interval);
  if (step.coefficient <= 0n) return Object.freeze([]);
  const majors = new Set(domain.ticks.map(exactText));
  const scale = Math.max(domain.minimum.scale, step.scale);
  const numerator = domain.minimum.coefficient * 10n ** BigInt(scale - domain.minimum.scale);
  const denominator = step.coefficient * 10n ** BigInt(scale - step.scale);
  let quotient = numerator / denominator;
  if (quotient * denominator < numerator) quotient += 1n;
  const output: ExactValue[] = [];
  for (let index = 0; index < MAX_MINOR_TICKS; index++) {
    const value = exactMultiplyInteger(step, quotient + BigInt(index));
    if (exactCompare(value, domain.maximum) > 0) break;
    if (!majors.has(exactText(value))) output.push(value);
  }
  return Object.freeze(output);
}

/** Generated domain, or the caller's exact ticks inside an explicit or data-driven range. */
function axisDomain(
  values: ReadonlyArray<ExactValue>,
  axis: CgChartValueAxisDescriptor,
  includeZero: boolean,
  maximumTicks: number,
): AxisDomain {
  const explicit = axis.ticks?.length
    ? axis.ticks.map((tick) => ({ value: exactFromNumeric(tick.value), text: tick.text }))
      .sort((left, right) => exactCompare(left.value, right.value))
    : null;
  if (!explicit) {
    const domain = createNumericDomain(values, axis, includeZero, maximumTicks);
    return Object.freeze({ ...domain, minor: minorValues(domain, axis.minorTickInterval) });
  }
  const pool = [...values, ...explicit.map((tick) => tick.value)];
  if (includeZero) pool.push(exactFromNumeric(0));
  let minimum = axis.minimum === undefined ? pool[0]! : exactFromNumeric(axis.minimum);
  let maximum = axis.maximum === undefined ? pool[0]! : exactFromNumeric(axis.maximum);
  for (const value of pool) {
    if (axis.minimum === undefined && exactCompare(value, minimum) < 0) minimum = value;
    if (axis.maximum === undefined && exactCompare(value, maximum) > 0) maximum = value;
  }
  if (exactCompare(minimum, maximum) === 0) maximum = exactAdd(maximum, exactFromNumeric(1));
  const inside = explicit.filter((tick) => exactCompare(tick.value, minimum) >= 0 && exactCompare(tick.value, maximum) <= 0);
  const interval = inside.length > 1 ? exactSubtract(inside[1]!.value, inside[0]!.value) : exactSubtract(maximum, minimum);
  const domain: NumericDomain = Object.freeze({
    minimum, maximum, interval,
    ticks: Object.freeze(inside.map((tick) => tick.value)),
  });
  return Object.freeze({
    ...domain,
    texts: Object.freeze(inside.map((tick) => tick.text)),
    minor: minorValues(domain, axis.minorTickInterval),
  });
}

function valueDomains<TItem>(
  request: ChartLayoutRequest<TItem>,
  stacks: ReadonlyMap<string, ChartStackPosition>,
): ReadonlyMap<string, AxisDomain> {
  const result = new Map<string, AxisDomain>();
  for (const axis of resolvedAxes(request.valueAxes)) {
    const name = axis.name ?? 'primary';
    const matching = request.model.visibleSeries.filter((series) => series.valueAxisName === name);
    const values: ExactValue[] = [];
    for (const series of matching) {
      for (const point of series.points) {
        if (!point.exactValue || !point.visible) continue;
        const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
        if (stack) values.push(stack.start, stack.end);
        else values.push(point.exactValue);
      }
    }
    for (const line of constantLinesForAxis(request as ChartLayoutRequest<unknown>, name)) {
      if (line.extendAxisRange !== false && line.axis !== 'argument') values.push(exactFromNumeric(line.value));
    }
    const automaticZero = matching.some((series) => series.descriptor.type === 'bar' || series.descriptor.type === 'area');
    result.set(name, axisDomain(values, axis, axis.includeZero ?? automaticZero, 7));
  }
  return result;
}

/** Fraction (0 at minimum, 1 at maximum) of a crossing along a numeric domain. */
function numericCrossingFraction(domain: NumericDomain, crossing: CgChartAxisCrossing): number {
  if (crossing === 'minimum') return 0;
  if (crossing === 'maximum') return 1;
  const zero = exactFromNumeric(0);
  if (crossing === 'auto') {
    if (exactCompare(domain.minimum, zero) >= 0) return 0;
    if (exactCompare(domain.maximum, zero) <= 0) return 1;
    return exactRatio(zero, domain.minimum, domain.maximum);
  }
  return Math.max(0, Math.min(1, exactRatio(exactFromNumeric(crossing), domain.minimum, domain.maximum)));
}

function numericCrossingValue(domain: NumericDomain, crossing: CgChartAxisCrossing): ExactValue {
  const zero = exactFromNumeric(0);
  if (crossing === 'minimum') return domain.minimum;
  if (crossing === 'maximum') return domain.maximum;
  if (crossing === 'auto') {
    if (exactCompare(domain.minimum, zero) >= 0) return domain.minimum;
    if (exactCompare(domain.maximum, zero) <= 0) return domain.maximum;
    return zero;
  }
  const value = exactFromNumeric(crossing);
  if (exactCompare(value, domain.minimum) < 0) return domain.minimum;
  if (exactCompare(value, domain.maximum) > 0) return domain.maximum;
  return value;
}

function labelStyleFor(request: ChartLayoutRequest<unknown>, override: CgChartTextStyle | undefined): ChartTextStyle | null {
  return request.document ? mergeTextStyle(request.document.axisLabels, override) : null;
}

function measurer(request: ChartLayoutRequest<unknown>): ChartTextMeasurer {
  return request.measure ?? estimateText;
}

function thinnedPlan(labels: ReadonlyArray<string>, length: number, lineHeight: number, interval: number | undefined): AxisLabelPlan {
  const stride = interval ?? Math.max(1, Math.ceil((labels.length * lineHeight * 1.1) / Math.max(1, length)));
  const items: AxisLabelPlanItem[] = [];
  labels.forEach((text, index) => {
    if (index % stride === 0) items.push(Object.freeze({ index, fullText: text, displayText: text, row: 0 }));
  });
  return Object.freeze({ items: Object.freeze(items), rotation: 0, staggered: false, thickness: lineHeight });
}

function planArgumentLabels<TItem>(
  request: ChartLayoutRequest<TItem>,
  labels: ReadonlyArray<string>,
  length: number,
  interval: number | undefined,
): AxisLabelPlan {
  const style = labelStyleFor(request as ChartLayoutRequest<unknown>, request.argumentAxis?.labelStyle);
  if (style && request.orientation === 'horizontal') return thinnedPlan(labels, length, style.size * 1.2, interval);
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const indexes = interval && interval > 1 ? labels.map((_, index) => index).filter((index) => index % interval === 0) : null;
  const subset = indexes ? indexes.map((index) => labels[index]!) : labels;
  const plan = planAxisLabels(
    subset, length, request.argumentAxis?.labelOverlapMode ?? 'auto',
    request.argumentAxis?.labelRotationAngle ?? 0, request.argumentAxis?.maximumLabelCharacters ?? 24,
    style?.size ?? 13, style ? (text) => measure(text, style) : undefined,
  );
  if (!indexes) return plan;
  return Object.freeze({ ...plan, items: Object.freeze(plan.items.map((item) => Object.freeze({ ...item, index: indexes[item.index]! }))) });
}

function argumentNumericDomain<TItem>(request: ChartLayoutRequest<TItem>, length: number): AxisDomain {
  const exacts = request.model.arguments.map((argument) => argument.exact!);
  for (const line of [...(request.constantLines ?? []), ...(request.argumentAxis?.constantLines ?? [])]) {
    if (line.axis !== 'argument' || line.extendAxisRange === false) continue;
    const normalized = normalizeArgument(line.value, request.argumentAxis?.valueType ?? 'auto');
    if (normalized.kind !== 'numeric') throw new RangeError('CgChart argument constant lines must match the argument-axis value representation.');
    exacts.push(normalized.exact!);
  }
  if (!exacts.length) exacts.push(exactFromNumeric(0));
  const axis = request.argumentAxis;
  const numericAxis: CgChartValueAxisDescriptor = {
    ...(axis?.minimum !== undefined ? { minimum: axis.minimum as CgChartNumericValue } : {}),
    ...(axis?.maximum !== undefined ? { maximum: axis.maximum as CgChartNumericValue } : {}),
    ...(axis?.tickInterval !== undefined ? { tickInterval: axis.tickInterval } : {}),
    ...(axis?.ticks ? { ticks: axis.ticks } : {}),
    ...(axis?.minorTickInterval !== undefined ? { minorTickInterval: axis.minorTickInterval } : {}),
  };
  return axisDomain(exacts, numericAxis, false, Math.max(2, Math.floor(length / 72)));
}

function buildArgumentProjection<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
): ArgumentProjection {
  const argumentsList = request.model.arguments;
  const vertical = request.orientation === 'vertical';
  const length = vertical ? plot.width : plot.height;
  const rangeStart = vertical ? plot.x : plot.y;
  const rangeEnd = vertical ? plot.x + plot.width : plot.y + plot.height;
  const reversedFlag = request.argumentAxis?.reversed === true;
  const physicallyReversed = (request.rtl && vertical) !== reversedFlag;
  const frame = { physicallyReversed, rangeStart, rangeEnd };
  if (request.model.argumentKind === 'category' || !argumentsList.length) {
    const labels = argumentsList.map((argument) => request.formatter.formatArgument(argument, request.argumentAxis));
    const plan = planArgumentLabels(request, labels, length, request.argumentAxis?.labelInterval);
    const placement = request.argumentAxis?.categoryPlacement ?? (request.document ? 'betweenTicks' : undefined);
    const band = placement
      ? createCategoryScale(argumentsList.length, rangeStart, rangeEnd, placement, physicallyReversed)
      : createBandScale(
        argumentsList.length, rangeStart, rangeEnd,
        request.argumentAxis?.categoryInnerPadding ?? 0.2,
        request.argumentAxis?.categoryOuterPadding ?? 0.1,
        physicallyReversed,
      );
    const ticks = plan.items.map((item) => {
      const start = band.position(item.index) ?? 0;
      return Object.freeze({
        position: start + band.bandwidth / 2,
        text: item.displayText,
        fullText: item.fullText,
        rotation: plan.rotation,
        row: item.row,
      });
    });
    const count = argumentsList.length;
    const markInterval = request.argumentAxis?.tickMarkInterval ?? 1;
    const tickMarks: number[] = [];
    if (placement === 'onTicks') {
      for (let index = 0; index < count; index += markInterval) tickMarks.push((band.position(index) ?? 0) + band.bandwidth / 2);
    } else {
      for (let index = 0; index <= count; index += markInterval) {
        tickMarks.push(physicallyReversed ? rangeEnd - band.step * index : rangeStart + band.step * index);
      }
    }
    return Object.freeze({
      ...frame,
      point: (_argument: NormalizedArgument, index: number) => (band.position(index) ?? 0) + band.bandwidth / 2,
      ticks: Object.freeze(ticks), plan, band,
      tickMarks: Object.freeze(tickMarks),
      minorTicks: Object.freeze([]),
      fraction: (crossing: CgChartAxisCrossing) => {
        if (crossing === 'auto' || crossing === 'minimum') return 0;
        if (crossing === 'maximum') return 1;
        const number = Number(exactText(exactFromNumeric(crossing)));
        const index = Math.max(1, Math.min(count, number)) - 1;
        return placement === 'onTicks' ? (count > 1 ? index / (count - 1) : 0.5) : count ? index / count : 0;
      },
    });
  }
  if (request.model.argumentKind === 'numeric') {
    const domain = argumentNumericDomain(request, length);
    const scale = createNumericScale(domain.minimum, domain.maximum, rangeStart, rangeEnd, physicallyReversed);
    const normalizedTicks = domain.ticks.map((exact) => Object.freeze<NormalizedArgument>({
      kind: 'numeric', key: `n:${exactText(exact)}`, original: exactText(exact), exact,
    }));
    const labels = normalizedTicks.map((tick, index) => domain.texts?.[index] ?? request.formatter.formatArgument(tick, request.argumentAxis));
    const plan = planArgumentLabels(request, labels, length, undefined);
    const ticks = plan.items.map((item) => Object.freeze({
      position: scale.project(normalizedTicks[item.index]!.exact!), text: item.displayText,
      fullText: item.fullText, rotation: plan.rotation, row: item.row,
    }));
    return Object.freeze({
      ...frame,
      point: (argument: NormalizedArgument) => scale.project(argument.exact!),
      ticks: Object.freeze(ticks), plan, band: null,
      tickMarks: Object.freeze(domain.ticks.map((tick) => scale.project(tick))),
      minorTicks: Object.freeze(domain.minor.map((tick) => scale.project(tick))),
      fraction: (crossing: CgChartAxisCrossing) => numericCrossingFraction(domain, crossing),
    });
  }
  const exacts: ExactValue[] = argumentsList.map((argument) => Object.freeze({ coefficient: argument.epochMilliseconds!, scale: 0 }));
  const extendingLines = [...(request.constantLines ?? []), ...(request.argumentAxis?.constantLines ?? [])]
    .filter((line) => line.axis === 'argument' && line.extendAxisRange !== false);
  for (const line of extendingLines) {
    const normalized = normalizeArgument(line.value, request.argumentAxis?.valueType ?? 'auto');
    if (normalized.kind !== request.model.argumentKind || (
      normalized.kind === 'date' && normalized.temporalKind !== request.model.temporalKind
    )) throw new RangeError('CgChart argument constant lines must match the argument-axis value representation.');
    exacts.push(normalized.exact ?? Object.freeze({ coefficient: normalized.epochMilliseconds!, scale: 0 }));
  }
  let minimum = exacts[0] ?? exactFromNumeric(0);
  let maximum = minimum;
  for (const value of exacts) {
    if (exactCompare(value, minimum) < 0) minimum = value;
    if (exactCompare(value, maximum) > 0) maximum = value;
  }
  if (request.argumentAxis?.minimum !== undefined) {
    const normalized = normalizeArgument(request.argumentAxis.minimum, request.argumentAxis.valueType ?? 'auto');
    minimum = normalized.exact ?? Object.freeze({ coefficient: normalized.epochMilliseconds!, scale: 0 });
  }
  if (request.argumentAxis?.maximum !== undefined) {
    const normalized = normalizeArgument(request.argumentAxis.maximum, request.argumentAxis.valueType ?? 'auto');
    maximum = normalized.exact ?? Object.freeze({ coefficient: normalized.epochMilliseconds!, scale: 0 });
  }
  if (exactCompare(minimum, maximum) === 0) {
    minimum = exactAdd(minimum, exactFromNumeric(-1));
    maximum = exactAdd(maximum, exactFromNumeric(1));
  }
  const maximumTicks = Math.max(2, Math.floor(length / 72));
  const explicitInterval = request.argumentAxis?.tickInterval === undefined
    ? undefined
    : exactFromNumeric(request.argumentAxis.tickInterval);
  const dateDomain = createDateDomain(
    minimum.coefficient, maximum.coefficient, maximumTicks, request.formatter.locale,
    request.model.temporalKind!, explicitInterval?.coefficient,
  );
  const scale = createNumericScale(
    { coefficient: dateDomain.minimum, scale: 0 }, { coefficient: dateDomain.maximum, scale: 0 },
    rangeStart, rangeEnd, physicallyReversed,
  );
  const labels = dateDomain.ticks.map((tick) => request.formatter.formatDateTick(tick, request.model.temporalKind!, request.argumentAxis));
  const plan = planArgumentLabels(request, labels, length, undefined);
  const ticks = plan.items.map((item) => Object.freeze({
    position: scale.project({ coefficient: dateDomain.ticks[item.index]!, scale: 0 }),
    text: item.displayText, fullText: item.fullText, rotation: plan.rotation, row: item.row,
  }));
  const numericDomain: NumericDomain = {
    minimum: { coefficient: dateDomain.minimum, scale: 0 }, maximum: { coefficient: dateDomain.maximum, scale: 0 },
    interval: { coefficient: 1n, scale: 0 }, ticks: [],
  };
  return Object.freeze({
    ...frame,
    point: (argument: NormalizedArgument) => scale.project({ coefficient: argument.epochMilliseconds!, scale: 0 }),
    ticks: Object.freeze(ticks), plan, band: null,
    tickMarks: Object.freeze(dateDomain.ticks.map((tick) => scale.project({ coefficient: tick, scale: 0 }))),
    minorTicks: Object.freeze([]),
    fraction: (crossing: CgChartAxisCrossing) => numericCrossingFraction(numericDomain, crossing),
  });
}

function lineRuns<TItem>(series: ChartSeries<TItem>): ReadonlyArray<ReadonlyArray<ChartPoint<TItem>>> {
  const mode = series.descriptor.missingValueMode ?? 'gap';
  if (mode === 'skip') return [Object.freeze(series.points.filter((point) => point.exactValue && point.visible))];
  const runs: ChartPoint<TItem>[][] = [];
  let current: ChartPoint<TItem>[] = [];
  for (const point of series.points) {
    if (!point.exactValue || !point.visible) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length) runs.push(current);
  return Object.freeze(runs.map((run) => Object.freeze(run)));
}

interface LabelPlacement {
  readonly anchor?: 'start' | 'middle' | 'end';
  readonly style?: ChartTextStyle;
  readonly seriesName?: string;
  readonly pointIndex?: number;
  readonly measure?: ChartTextMeasurer;
}

function addLabel(
  labels: ChartPointLabelLayout[],
  occupied: ChartRectangle[],
  text: string,
  x: number,
  y: number,
  options: CgChartPointLabelOptions | undefined,
  connector?: ChartPointLabelLayout['connector'],
  placement?: LabelPlacement,
  hideOverlappingDefault = true,
): void {
  const style = placement?.style;
  const width = style && placement.measure ? Math.max(4, placement.measure(text, style)) : Math.max(8, text.length * 7);
  const height = style ? style.size * 1.2 : 16;
  const anchor = placement?.anchor ?? 'middle';
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'start' ? x : x - width;
  const box = style
    ? { x: left, y: y - style.size * 0.95, width, height }
    : { x: x - width / 2, y: y - 13, width, height: 16 };
  if ((options?.hideOverlapping ?? hideOverlappingDefault) && occupied.some((candidate) => rectanglesOverlap(candidate, box))) return;
  occupied.push(box);
  labels.push(Object.freeze({
    text, x, y, anchor,
    ...(connector ? { connector } : {}),
    ...(placement?.seriesName === undefined ? {} : { seriesName: placement.seriesName }),
    ...(placement?.pointIndex === undefined ? {} : { pointIndex: placement.pointIndex }),
    ...(style ? { style } : {}),
    box: Object.freeze(box),
  }));
}

const LEGACY_POSITIONS: ReadonlySet<CgChartPointLabelPosition> = new Set(['outside', 'inside', 'center']);

function pointLabelStyle(
  request: ChartLayoutRequest<unknown>,
  descriptor: CgChartSeriesDescriptor<unknown>,
): ChartTextStyle | undefined {
  if (request.document) return mergeTextStyle(request.document.pointLabels, descriptor.pointLabelStyle);
  if (!descriptor.pointLabelStyle) return undefined;
  return mergeTextStyle({ size: 12, color: 'var(--cg-chart-muted)', bold: false, italic: false }, descriptor.pointLabelStyle);
}

function strokeWidthOr(color: string | undefined, width: number | undefined): Readonly<{ stroke?: string; strokeWidth?: number }> {
  if (color === undefined || isNoPaint(color)) return {};
  return { stroke: color, strokeWidth: width ?? 1 };
}

interface BarGroup {
  readonly keys: string[];
  readonly gapWidth: number;
  readonly overlap: number;
}

function barSlotKey(series: ChartSeries<unknown>): string {
  const descriptor = series.descriptor;
  return descriptor.type === 'bar' && (descriptor.stacking ?? 'none') !== 'none'
    ? `stack:${series.valueAxisName}:${descriptor.stackName}`
    : `series:${series.name}`;
}

function buildCartesian<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  domains: ReadonlyMap<string, AxisDomain>,
  stacks: ReadonlyMap<string, ChartStackPosition>,
): Pick<ChartLayout, 'shapes' | 'labels' | 'hitTargets' | 'valueAxes'> & { scales: ReadonlyMap<string, NumericScale> } {
  const shapes: ChartShape[] = [];
  const labels: ChartPointLabelLayout[] = [];
  const hits: ChartHitTarget[] = [];
  const occupied: ChartRectangle[] = [];
  const axes = resolvedAxes(request.valueAxes);
  const scales = new Map<string, NumericScale>();
  const axisLayouts: ChartValueAxisLayout[] = [];
  const documentMode = request.document !== undefined;
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const vertical = request.orientation === 'vertical';
  let startOffset = 0;
  let endOffset = 0;
  axes.forEach((axis, index) => {
    const name = axis.name ?? 'primary';
    const domain = domains.get(name)!;
    const reverse = (request.orientation === 'horizontal' && request.rtl) !== (axis.reversed === true);
    const scale = createNumericScale(
      domain.minimum, domain.maximum,
      vertical ? plot.y + plot.height : plot.x,
      vertical ? plot.y : plot.x + plot.width,
      reverse,
    );
    scales.set(name, scale);
    const zero = exactFromNumeric(0);
    const containsZero = exactCompare(zero, domain.minimum) >= 0 && exactCompare(zero, domain.maximum) <= 0;
    if (axis.visible === false) return;
    const position = resolvedAxisPosition(axis, index);
    const offset = position === 'start' ? startOffset : endOffset;
    const labelWidth = valueAxisLabelWidth(request, axis, domain);
    if (vertical) {
      if (position === 'start') startOffset += labelWidth + 18 + (axis.title ? 22 : 0);
      else endOffset += labelWidth + 18 + (axis.title ? 22 : 0);
    } else if (position === 'start') startOffset += 18 + (axis.title ? 20 : 0);
    else endOffset += 18 + (axis.title ? 20 : 0);
    axisLayouts.push(Object.freeze({
      name,
      ...(axis.title ? { title: axis.title } : {}),
      position,
      offset,
      labelWidth,
      ticks: Object.freeze(domain.ticks.map((tick, tickIndex) => {
        const text = valueAxisText(request as ChartLayoutRequest<unknown>, axis, domain, tickIndex);
        return Object.freeze({ position: scale.project(tick), text, fullText: text });
      })),
      zeroPosition: containsZero ? scale.project(zero) : null,
      showGridLines: axis.showGridLines ?? true,
      showAxisLine: axis.showAxisLine ?? false,
      showZeroLine: axis.showZeroLine ?? (documentMode ? false : true),
      minorTicks: Object.freeze(domain.minor.map((tick) => scale.project(tick))),
    }));
  });

  // Bars on an axis with barGapWidth or barOverlap form their own cluster; the rest share the
  // original grouped slots.
  const barSeries = request.model.visibleSeries.filter((series) => series.descriptor.type === 'bar') as ReadonlyArray<ChartSeries<unknown>>;
  const legacyKeys: string[] = [];
  const groups = new Map<string, BarGroup>();
  for (const series of barSeries) {
    const axis = axisDescriptor(request, series.valueAxisName);
    const key = barSlotKey(series);
    if (axis && (axis.barGapWidth !== undefined || axis.barOverlap !== undefined)) {
      const group = groups.get(series.valueAxisName) ?? { keys: [], gapWidth: axis.barGapWidth ?? 150, overlap: axis.barOverlap ?? 0 };
      if (!group.keys.includes(key)) group.keys.push(key);
      groups.set(series.valueAxisName, group);
    } else if (!legacyKeys.includes(key)) legacyKeys.push(key);
  }
  const continuousPositions = argument.band === null && barSeries.length
    ? request.model.arguments.map((value, index) => argument.point(value, index))
    : [];
  let minimumSpacing = Number.POSITIVE_INFINITY;
  for (let index = 1; index < continuousPositions.length; index++) {
    minimumSpacing = Math.min(minimumSpacing, Math.abs(continuousPositions[index]! - continuousPositions[index - 1]!));
  }
  const continuousStep = Number.isFinite(minimumSpacing) ? minimumSpacing : (vertical ? plot.width : plot.height) * 0.55;
  const continuousBandwidth = continuousPositions.length > 1
    ? continuousStep * (1 - (request.argumentAxis?.categoryInnerPadding ?? 0.2))
    : (vertical ? plot.width : plot.height) * 0.55;
  const proportionalDashes = documentMode;

  for (const genericSeries of request.model.visibleSeries) {
    const series = genericSeries as ChartSeries<unknown>;
    const descriptor = series.descriptor;
    const scale = scales.get(series.valueAxisName)!;
    const axis = axisDescriptor(request, series.valueAxisName);
    const domain = domains.get(series.valueAxisName)!;
    const crossing = axis?.argumentAxisCrossesAt;
    const baseline = crossing === undefined ? exactFromNumeric(0) : numericCrossingValue(domain, crossing);
    const labelPosition = descriptor.pointLabelPosition ?? request.pointLabels?.position ?? 'outside';
    const labelStyle = pointLabelStyle(request as ChartLayoutRequest<unknown>, descriptor);
    const placementBase: LabelPlacement = {
      ...(labelStyle ? { style: labelStyle, measure } : {}),
      seriesName: series.name,
    };
    if (descriptor.type === 'bar') {
      const slotKey = barSlotKey(series);
      const group = groups.get(series.valueAxisName);
      const keys = group?.keys ?? legacyKeys;
      const slotIndex = keys.indexOf(slotKey);
      const orderedIndex = group && argument.physicallyReversed ? keys.length - 1 - slotIndex : slotIndex;
      const fill = descriptor.fillColor;
      for (const point of series.points) {
        if (!point.exactValue || !point.visible) continue;
        const slot = (() => {
          if (group) {
            const center = argument.point(point.argument, point.pointIndex);
            const step = argument.band ? argument.band.step : continuousStep;
            return clusteredBarSlot(center - step / 2, step, orderedIndex, keys.length, group.gapWidth, group.overlap);
          }
          if (argument.band) {
            const bandStart = argument.band.position(point.pointIndex);
            return bandStart === null ? null : groupedBandSlot(
              argument.band, bandStart, slotIndex, keys.length,
              request.argumentAxis?.groupPadding ?? 0.08, descriptor.maximumBarWidth,
            );
          }
          const center = argument.point(point.argument, point.pointIndex);
          const available = continuousBandwidth * (1 - (request.argumentAxis?.groupPadding ?? 0.08));
          const rawWidth = available / Math.max(1, keys.length);
          const width = Math.min(rawWidth, descriptor.maximumBarWidth ?? Number.POSITIVE_INFINITY);
          return Object.freeze({
            start: center - available / 2 + slotIndex * rawWidth + (rawWidth - width) / 2,
            width,
          });
        })();
        if (!slot) continue;
        const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
        const startValue = stack?.start ?? baseline;
        const endValue = stack?.end ?? point.exactValue;
        const start = scale.project(startValue);
        const end = scale.project(endValue);
        const bounds: ChartRectangle = vertical
          ? { x: slot.start, y: Math.min(start, end), width: slot.width, height: Math.max(1, Math.abs(end - start)) }
          : { x: Math.min(start, end), y: slot.start, width: Math.max(1, Math.abs(end - start)), height: slot.width };
        const positive = exactCompare(endValue, startValue) >= 0;
        const leading = vertical ? ((positive !== (axis?.reversed === true)) ? 'top' : 'bottom')
          : request.rtl !== (axis?.reversed === true) ? (positive ? 'start' : 'end') : (positive ? 'end' : 'start');
        const outlineColor = point.outlineColor ?? descriptor.outlineColor;
        const outlineWidth = point.outlineWidth ?? descriptor.outlineWidth;
        const stroke = strokeWidthOr(outlineColor, outlineWidth);
        const shape: ChartBarShape = Object.freeze({
          kind: 'bar', seriesName: series.name, point, color: point.color ?? fill ?? series.color,
          opacity: point.opacity ?? series.opacity,
          path: roundedRectPath(bounds.x, bounds.y, bounds.width, bounds.height, descriptor.cornerRadius ?? (documentMode ? 0 : 2), leading),
          bounds: Object.freeze(bounds), zeroSizedStack: stack?.zeroSized ?? false,
          ...stroke,
          ...(stroke.stroke && descriptor.outlineDashStyle ? { dashArray: dashArray(descriptor.outlineDashStyle, stroke.strokeWidth!, proportionalDashes) } : {}),
          ...(point.className ?? descriptor.className ? { className: point.className ?? descriptor.className } : {}),
        });
        shapes.push(shape);
        if (!shape.zeroSizedStack && !point.synthetic) hits.push(Object.freeze({ point, bounds: shape.bounds }));
        if (point.showLabel && point.labelText) {
          if (LEGACY_POSITIONS.has(labelPosition) && !labelStyle) {
            const inside = labelPosition !== 'outside' && (vertical ? bounds.height : bounds.width) > 24;
            const x = vertical ? bounds.x + bounds.width / 2 : inside ? bounds.x + bounds.width / 2 : bounds.x + bounds.width + 6;
            const y = vertical ? inside ? bounds.y + bounds.height / 2 + 4 : bounds.y - 5 : bounds.y + bounds.height / 2 + 4;
            addLabel(labels, occupied, point.labelText, x, y, request.pointLabels, undefined, { ...placementBase, pointIndex: point.pointIndex });
          } else {
            const placed = barLabelPlacement(labelPosition, bounds, leading, labelStyle ?? { size: 12, color: '', bold: false, italic: false });
            addLabel(labels, occupied, point.labelText, placed.x, placed.y, request.pointLabels, undefined, {
              ...placementBase, pointIndex: point.pointIndex, anchor: placed.anchor,
            }, !documentMode);
          }
        }
      }
      continue;
    }

    if (descriptor.type === 'line' || descriptor.type === 'area' || descriptor.type === 'scatter') {
      const lineStyle = descriptor.lineStyle ?? 'straight';
      const lineColor = descriptor.type === 'area' ? descriptor.outlineColor : descriptor.lineColor;
      const lineWidth = descriptor.lineWidth ?? 2;
      const showLine = descriptor.type === 'scatter' ? descriptor.showLine === true : true;
      const showMarkers = descriptor.showMarkers ?? true;
      const runs: ReadonlyArray<ReadonlyArray<ChartPoint<unknown>>> = descriptor.type === 'scatter'
        ? scatterRuns(series)
        : lineRuns(series);
      for (const run of runs) {
        const endPoints: SvgPoint[] = run.map((point) => {
          const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
          const value = stack?.end ?? point.exactValue!;
          const argumentPosition = argument.point(point.argument, point.pointIndex);
          const valuePosition = scale.project(value);
          return vertical
            ? { x: argumentPosition, y: valuePosition }
            : { x: valuePosition, y: argumentPosition };
        });
        if (descriptor.type === 'area' && endPoints.length) {
          const stacked = run.some((point) => stacks.has(stackPositionKey(series.name, point.pointIndex)));
          const startPoints = [...run].reverse().map((point) => {
            const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
            const base = stack?.start ?? baseline;
            const argumentPosition = argument.point(point.argument, point.pointIndex);
            const valuePosition = scale.project(base);
            return vertical
              ? { x: argumentPosition, y: valuePosition }
              : { x: valuePosition, y: argumentPosition };
          });
          const areaPath = lineStyle === 'smooth'
            ? `${smoothPath(endPoints)} ${stacked ? smoothPath(startPoints, false) : straightPath(startPoints).replace(/^M/u, 'L')} Z`
            : straightPath([...endPoints, ...startPoints], true);
          shapes.push(Object.freeze({
            kind: 'path', seriesName: series.name, color: descriptor.fillColor ?? series.color,
            opacity: descriptor.areaOpacity ?? 0.25, path: areaPath,
            fill: true, lineWidth: 0, dashStyle: 'solid', ...(descriptor.className ? { className: descriptor.className } : {}),
          }));
        }
        if (showLine && endPoints.length > 1 && !isNoPaint(lineColor)) {
          const path = lineStyle === 'monotone'
            ? monotonePath(endPoints, vertical ? 'x' : 'y')
            : lineStyle === 'smooth' ? smoothPath(endPoints) : straightPath(endPoints);
          const style: CgChartDashStyle = series.dashStyle;
          shapes.push(Object.freeze({
            kind: 'path', seriesName: series.name, color: lineColor ?? series.color, opacity: series.opacity,
            path, fill: false, lineWidth, dashStyle: style,
            ...(dashArray(style, lineWidth, proportionalDashes) === undefined ? {} : { dashArray: dashArray(style, lineWidth, proportionalDashes)! }),
            ...(proportionalDashes ? { lineCap: lineCapFor(style, true) } : {}),
            ...(descriptor.className ? { className: descriptor.className } : {}),
          }));
        }
        run.forEach((point, index) => {
          const coordinate = endPoints[index]!;
          const symbol = point.markerSymbol ?? series.markerSymbol;
          const markerSize = point.markerSize ?? descriptor.markerSize ?? 7;
          if (showMarkers && symbol !== 'none') {
            const outline = point.outlineColor ?? descriptor.markerOutlineColor;
            const fillColor = descriptor.markerFillColor;
            shapes.push(Object.freeze({
              kind: 'point', seriesName: series.name, point, color: point.color ?? series.color,
              opacity: point.opacity ?? series.opacity, x: coordinate.x, y: coordinate.y,
              markerSymbol: symbol, markerSize,
              ...(fillColor !== undefined && point.color === undefined ? { fillColor } : {}),
              ...strokeWidthOr(outline, point.outlineWidth ?? descriptor.markerOutlineWidth),
              ...(point.className ?? descriptor.className ? { className: point.className ?? descriptor.className } : {}),
            }));
          }
          if (!point.synthetic) hits.push(Object.freeze({ point, x: coordinate.x, y: coordinate.y, radius: Math.max(10, markerSize) }));
          if (point.showLabel && point.labelText) {
            if (LEGACY_POSITIONS.has(labelPosition) && !labelStyle) {
              addLabel(labels, occupied, point.labelText, coordinate.x, coordinate.y - 10, request.pointLabels, undefined, { ...placementBase, pointIndex: point.pointIndex });
            } else {
              const placed = markerLabelPlacement(labelPosition, coordinate, showMarkers && symbol !== 'none' ? markerSize : 0, labelStyle ?? { size: 12, color: '', bold: false, italic: false });
              addLabel(labels, occupied, point.labelText, placed.x, placed.y, request.pointLabels, undefined, {
                ...placementBase, pointIndex: point.pointIndex, anchor: placed.anchor,
              }, !documentMode);
            }
          }
        });
      }
    }
  }
  return { shapes: Object.freeze(shapes), labels: Object.freeze(labels), hitTargets: Object.freeze(hits), valueAxes: Object.freeze(axisLayouts), scales };
}

function scatterRuns(series: ChartSeries<unknown>): ReadonlyArray<ReadonlyArray<ChartPoint<unknown>>> {
  return lineRuns(series);
}

function barLabelPlacement(
  position: CgChartPointLabelPosition,
  bounds: ChartRectangle,
  leading: 'top' | 'bottom' | 'start' | 'end',
  style: ChartTextStyle,
): Readonly<{ x: number; y: number; anchor: 'start' | 'middle' | 'end' }> {
  const gap = 3;
  const textHeight = style.size;
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const resolved = position === 'outside' || position === 'above' || position === 'bestFit' ? 'outsideEnd'
    : position === 'inside' ? 'insideEnd'
      : position === 'below' || position === 'left' || position === 'right' ? 'center' : position;
  if (leading === 'top' || leading === 'bottom') {
    const top = leading === 'top';
    const endY = top ? bounds.y : bounds.y + bounds.height;
    const baseY = top ? bounds.y + bounds.height : bounds.y;
    const direction = top ? -1 : 1;
    let center = centerY;
    if (resolved === 'outsideEnd') center = endY + direction * (gap + textHeight / 2);
    else if (resolved === 'insideEnd') center = endY - direction * (gap + textHeight / 2);
    else if (resolved === 'insideBase') center = baseY + direction * (gap + textHeight / 2);
    return { x: centerX, y: centredBaseline(center, style), anchor: 'middle' };
  }
  // Horizontal bars: `leading` names the physical side the bar grows to ('end' is right).
  const endRight = leading === 'end';
  const endX = endRight ? bounds.x + bounds.width : bounds.x;
  const baseX = endRight ? bounds.x : bounds.x + bounds.width;
  const direction = endRight ? 1 : -1;
  let x = centerX;
  let anchor: 'start' | 'middle' | 'end' = 'middle';
  if (resolved === 'outsideEnd') { x = endX + direction * gap; anchor = endRight ? 'start' : 'end'; }
  else if (resolved === 'insideEnd') { x = endX - direction * gap; anchor = endRight ? 'end' : 'start'; }
  else if (resolved === 'insideBase') { x = baseX + direction * gap; anchor = endRight ? 'start' : 'end'; }
  return { x, y: centredBaseline(centerY, style), anchor };
}

function markerLabelPlacement(
  position: CgChartPointLabelPosition,
  point: SvgPoint,
  markerSize: number,
  style: ChartTextStyle,
): Readonly<{ x: number; y: number; anchor: 'start' | 'middle' | 'end' }> {
  const gap = Math.max(3, markerSize / 2 + 3);
  const half = style.size / 2;
  switch (position) {
    case 'below': return { x: point.x, y: centredBaseline(point.y + gap + half, style), anchor: 'middle' };
    case 'left': return { x: point.x - gap, y: centredBaseline(point.y, style), anchor: 'end' };
    case 'right': return { x: point.x + gap, y: centredBaseline(point.y, style), anchor: 'start' };
    case 'center':
    case 'inside':
    case 'insideEnd':
    case 'insideBase': return { x: point.x, y: centredBaseline(point.y, style), anchor: 'middle' };
    default: return { x: point.x, y: centredBaseline(point.y - gap - half, style), anchor: 'middle' };
  }
}

function arcBounds(centerX: number, centerY: number, outer: number, inner: number, start: number, end: number): ChartRectangle {
  const points: SvgPoint[] = [];
  const steps = Math.max(2, Math.ceil(Math.abs(end - start) / (Math.PI / 16)));
  for (let index = 0; index <= steps; index++) {
    const angle = start + (end - start) * index / steps;
    points.push({ x: centerX + Math.cos(angle) * outer, y: centerY + Math.sin(angle) * outer });
    points.push({ x: centerX + Math.cos(angle) * inner, y: centerY + Math.sin(angle) * inner });
  }
  return unionRectangles(points.map((point) => ({ x: point.x, y: point.y, width: 0, height: 0 })))!;
}

function buildPie<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
): Pick<ChartLayout, 'shapes' | 'labels' | 'hitTargets'> {
  const series = request.model.visibleSeries[0] as ChartSeries<unknown> | undefined;
  if (!series || (series.descriptor.type !== 'pie' && series.descriptor.type !== 'donut')) {
    return { shapes: Object.freeze([]), labels: Object.freeze([]), hitTargets: Object.freeze([]) };
  }
  const descriptor = series.descriptor;
  let total = exactFromNumeric(0);
  for (const point of series.points) if (point.exactValue && point.exactValue.coefficient > 0n && point.visible) total = exactAdd(total, point.exactValue);
  if (total.coefficient <= 0n) return { shapes: Object.freeze([]), labels: Object.freeze([]), hitTargets: Object.freeze([]) };
  const documentMode = request.document !== undefined;
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const labelPosition = descriptor.pointLabelPosition ?? request.pointLabels?.position ?? 'outside';
  const labelStyle = pointLabelStyle(request as ChartLayoutRequest<unknown>, descriptor);
  // Outside `appearance` the original three positions keep the original outside-with-connector labels.
  const legacyLabels = LEGACY_POSITIONS.has(labelPosition) && !documentMode;
  const maximumExplosion = Math.max(descriptor.explosion ?? 0, ...series.points.map((point) => point.explosion ?? 0));
  const centerX = plot.x + plot.width / 2;
  const centerY = plot.y + plot.height / 2;
  const outsideLabels = documentMode && series.points.some((point) => point.showLabel)
    && (labelPosition === 'outsideEnd' || labelPosition === 'bestFit' || labelPosition === 'outside');
  const labelRoom = outsideLabels ? (labelStyle?.size ?? 12) * 1.6 : 0;
  const radius = documentMode
    ? Math.max(1, (Math.min(plot.width, plot.height) / 2 - labelRoom) / (1 + maximumExplosion))
    : Math.max(1, Math.min(plot.width, plot.height) * 0.38);
  const inner = radius * (descriptor.innerRadiusRatio ?? (descriptor.type === 'donut' ? 0.55 : 0));
  const direction = request.rtl ? -1 : 1;
  let angle = (descriptor.startAngleDegrees ?? -90) * Math.PI / 180;
  const shapes: ChartShape[] = [];
  const labels: ChartPointLabelLayout[] = [];
  const hits: ChartHitTarget[] = [];
  const occupied: ChartRectangle[] = [];
  for (const point of series.points) {
    if (!point.exactValue || point.exactValue.coefficient <= 0n || !point.visible) continue;
    const ratio = exactDivide(point.exactValue, total);
    const end = angle + direction * ratio * Math.PI * 2;
    const mid = angle + (end - angle) / 2;
    const explosion = (point.explosion ?? descriptor.explosion ?? 0) * radius;
    const sliceX = centerX + Math.cos(mid) * explosion;
    const sliceY = centerY + Math.sin(mid) * explosion;
    const path = arcPath(sliceX, sliceY, radius, inner, angle, end);
    const percentage = request.formatter.formatPercentage(ratio);
    const outline = strokeWidthOr(point.outlineColor ?? descriptor.outlineColor, point.outlineWidth ?? descriptor.outlineWidth);
    const shape: ChartArcShape = Object.freeze({
      kind: 'arc', seriesName: series.name, point, color: point.color ?? `var(--cg-chart-series-${point.pointIndex % 10 + 1})`,
      opacity: point.opacity ?? series.opacity, path, percentage,
      midX: sliceX + Math.cos(mid) * (inner + (radius - inner) / 2),
      midY: sliceY + Math.sin(mid) * (inner + (radius - inner) / 2),
      bounds: arcBounds(sliceX, sliceY, radius, inner, angle, end),
      ...outline,
      ...(point.className ? { className: point.className } : {}),
    });
    shapes.push(shape);
    hits.push(Object.freeze({ point, path, percentage }));
    const showSmall = descriptor.smallSlicePolicy === 'show' || ratio >= (descriptor.smallSliceThreshold ?? 0.02);
    const labelText = descriptor.showPercentages && !descriptor.pointLabelContent ? percentage : point.labelText;
    if (point.showLabel && labelText && showSmall) {
      if (legacyLabels && !labelStyle) {
        const labelRadius = radius + 18;
        const x = centerX + Math.cos(mid) * labelRadius;
        const y = centerY + Math.sin(mid) * labelRadius;
        addLabel(labels, occupied, labelText, x, y, request.pointLabels, request.pointLabels?.showConnectors === false ? undefined : {
          x1: centerX + Math.cos(mid) * radius,
          y1: centerY + Math.sin(mid) * radius,
          x2: x,
          y2: y - 4,
        }, { seriesName: series.name, pointIndex: point.pointIndex });
        angle = end;
        continue;
      }
      const style = labelStyle ?? mergeTextStyle({ size: 12, color: 'var(--cg-chart-muted)', bold: false, italic: false });
      const width = measure(labelText, style);
      const height = style.size * 1.2;
      const halfExtent = Math.abs(Math.cos(mid)) * width / 2 + Math.abs(Math.sin(mid)) * height / 2;
      let mode: 'center' | 'insideEnd' | 'outsideEnd' = labelPosition === 'insideEnd' || labelPosition === 'inside' ? 'insideEnd'
        : labelPosition === 'outsideEnd' || labelPosition === 'outside' ? 'outsideEnd' : 'center';
      let labelRadius = inner > 0 ? (inner + radius) / 2 : radius * 0.55;
      if (labelPosition === 'bestFit') {
        const fitRadius = inner > 0 ? (inner + radius) / 2 : radius * 0.62;
        const span = Math.abs(end - angle);
        const chord = 2 * fitRadius * Math.sin(Math.min(Math.PI, span) / 2);
        const fits = (span >= Math.PI || chord >= Math.max(width, height) * 1.05) && radius - inner > height;
        mode = fits ? 'center' : 'outsideEnd';
        labelRadius = fitRadius;
      }
      if (mode === 'insideEnd') labelRadius = Math.max(inner + halfExtent, radius - halfExtent - 4);
      if (mode === 'outsideEnd') labelRadius = radius + halfExtent + 4;
      const x = sliceX + Math.cos(mid) * labelRadius;
      const y = sliceY + Math.sin(mid) * labelRadius;
      const leader = mode === 'outsideEnd' && labelPosition === 'bestFit' && request.pointLabels?.showConnectors !== false
        ? { x1: sliceX + Math.cos(mid) * radius, y1: sliceY + Math.sin(mid) * radius, x2: sliceX + Math.cos(mid) * (labelRadius - halfExtent), y2: sliceY + Math.sin(mid) * (labelRadius - halfExtent) }
        : undefined;
      addLabel(labels, occupied, labelText, x, centredBaseline(y, style), request.pointLabels, leader, {
        style, measure, seriesName: series.name, pointIndex: point.pointIndex, anchor: 'middle',
      }, !documentMode);
    }
    angle = end;
  }
  return { shapes: Object.freeze(shapes), labels: Object.freeze(labels), hitTargets: Object.freeze(hits) };
}

function constantLineLayouts<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  scales: ReadonlyMap<string, NumericScale>,
  domains: ReadonlyMap<string, AxisDomain>,
): ReadonlyArray<ChartConstantLineLayout> {
  const lines = [...(request.constantLines ?? [])];
  request.argumentAxis?.constantLines?.forEach((line) => lines.push(line));
  request.valueAxes?.forEach((axis) => axis.constantLines?.forEach((line) => lines.push({ ...line, ...(line.axis === 'argument' ? {} : { axisName: line.axisName ?? axis.name ?? 'primary' }) })));
  const output: ChartConstantLineLayout[] = [];
  for (const line of lines) {
    let position: number | null = null;
    const argumentLine = line.axis === 'argument';
    if (argumentLine) {
      try {
        const normalized = normalizeArgument(line.value, request.argumentAxis?.valueType ?? 'auto');
        const index = request.model.arguments.findIndex((candidate) => candidate.key === normalized.key);
        if (argument.band === null || index >= 0) position = argument.point(normalized, Math.max(0, index));
      } catch { position = null; }
    } else {
      const axisName = line.axisName ?? 'primary';
      const domain = domains.get(axisName);
      const scale = scales.get(axisName);
      if (domain && scale) {
        const value = exactFromNumeric(line.value);
        if (exactCompare(value, domain.minimum) >= 0 && exactCompare(value, domain.maximum) <= 0) position = scale.project(value);
      }
    }
    if (position === null) continue;
    const vertical = argumentLine ? request.orientation === 'vertical' : request.orientation === 'horizontal';
    const start = line.labelPosition === 'start' ? 0 : line.labelPosition === 'center' ? 0.5 : 1;
    const logical = request.rtl ? 1 - start : start;
    output.push(Object.freeze({
      x1: vertical ? position : plot.x, y1: vertical ? plot.y : position,
      x2: vertical ? position : plot.x + plot.width, y2: vertical ? plot.y + plot.height : position,
      ...(line.label ? { label: line.label } : {}),
      labelX: vertical ? position + 4 : plot.x + plot.width * logical,
      labelY: vertical ? plot.y + 14 + (plot.height - 22) * start : position - 5,
      labelAnchor: line.labelPosition === 'center' ? 'middle' : request.rtl !== (line.labelPosition === 'start') ? 'end' : 'start',
      ...(line.color ? { color: line.color } : {}), width: line.width ?? 1, dashStyle: line.dashStyle ?? 'dash',
      ...(line.className ? { className: line.className } : {}),
    }));
  }
  return Object.freeze(output);
}

function annotationLayouts<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  scales: ReadonlyMap<string, NumericScale>,
): ReadonlyArray<ChartAnnotationLayout> {
  return Object.freeze((request.annotations ?? []).flatMap((annotation) => {
    let argumentPosition = request.orientation === 'vertical' ? plot.x + plot.width / 2 : plot.y + plot.height / 2;
    if (annotation.argument !== undefined) {
      const normalized = normalizeArgument(annotation.argument, request.argumentAxis?.valueType ?? 'auto');
      const index = request.model.arguments.findIndex((candidate) => candidate.key === normalized.key);
      if (argument.band !== null && index < 0) return [];
      argumentPosition = argument.point(normalized, index);
    }
    let valuePosition = request.orientation === 'vertical' ? plot.y + plot.height / 2 : plot.x + plot.width / 2;
    if (annotation.value !== undefined) {
      const scale = scales.get(annotation.valueAxisName ?? 'primary');
      if (!scale) return [];
      valuePosition = scale.project(exactFromNumeric(annotation.value));
    }
    return [Object.freeze({
      text: annotation.text,
      x: (request.orientation === 'vertical' ? argumentPosition : valuePosition) + (annotation.offsetX ?? 0),
      y: (request.orientation === 'vertical' ? valuePosition : argumentPosition) + (annotation.offsetY ?? -12),
      ...(annotation.className ? { className: annotation.className } : {}),
    })];
  }));
}

/* ---------------------------------------------------------------------------------------------
 * Document layout: the frame, title, legend, axes and gridlines drawn inside the SVG.
 * ------------------------------------------------------------------------------------------- */

interface AxisPlacement {
  /** Where the axis line sits across the plot: 0 is left/top, 1 is right/bottom. */
  readonly lineAt: number;
  /** Direction from the line to its labels and outside tick marks, in increasing x or y. */
  readonly normal: -1 | 1;
  /** Where the labels sit across the plot (an edge when they are reserved space). */
  readonly labelsAt: number;
  readonly showLabels: boolean;
  readonly labelsAtEdge: boolean;
}

function placement(
  lineAt: number,
  labelPosition: 'nextToAxis' | 'low' | 'high' | 'none',
  lowEdge: 0 | 1,
): AxisPlacement {
  const clamped = Math.max(0, Math.min(1, lineAt));
  const atEdge = clamped <= 1e-9 || clamped >= 1 - 1e-9;
  if (labelPosition === 'none') {
    return { lineAt: clamped, normal: clamped >= 1 - 1e-9 ? 1 : lowEdge === 0 && atEdge ? -1 : 1, labelsAt: clamped, showLabels: false, labelsAtEdge: false };
  }
  if (labelPosition === 'low' || labelPosition === 'high') {
    const edge = labelPosition === 'low' ? lowEdge : (1 - lowEdge) as 0 | 1;
    return { lineAt: clamped, normal: edge === 0 ? -1 : 1, labelsAt: edge, showLabels: true, labelsAtEdge: true };
  }
  if (atEdge) {
    const edge = clamped < 0.5 ? 0 : 1;
    return { lineAt: clamped, normal: edge === 0 ? -1 : 1, labelsAt: edge, showLabels: true, labelsAtEdge: true };
  }
  return { lineAt: clamped, normal: lowEdge === 0 ? -1 : 1, labelsAt: clamped, showLabels: true, labelsAtEdge: false };
}

function tickExtent(style: CgChartTickMarkStyle | undefined, length: number, normal: -1 | 1): Readonly<{ from: number; to: number; outside: number }> {
  if (style === 'outside') return { from: 0, to: normal * length, outside: length };
  if (style === 'inside') return { from: 0, to: -normal * length, outside: 0 };
  if (style === 'cross') return { from: -length, to: length, outside: length };
  return { from: 0, to: 0, outside: 0 };
}

interface DocumentPlan {
  readonly argument: AxisPlacement;
  readonly values: ReadonlyMap<string, AxisPlacement & { readonly offset: number }>;
}

interface ValueAxisInfo {
  readonly descriptor: CgChartValueAxisDescriptor;
  readonly name: string;
  readonly index: number;
  readonly domain: AxisDomain;
  readonly texts: ReadonlyArray<string>;
}

function visibleValueAxes<TItem>(request: ChartLayoutRequest<TItem>, domains: ReadonlyMap<string, AxisDomain>): ReadonlyArray<ValueAxisInfo> {
  return resolvedAxes(request.valueAxes).flatMap((descriptor, index) => {
    const name = descriptor.name ?? 'primary';
    const domain = domains.get(name);
    if (!domain || descriptor.visible === false) return [];
    return [{ descriptor, name, index, domain, texts: domain.ticks.map((_tick, tickIndex) => valueAxisText(request as ChartLayoutRequest<unknown>, descriptor, domain, tickIndex)) }];
  });
}

/** Physical fraction across the plot where the primary value axis meets `crossing` on the argument axis. */
function argumentCrossingAt(argument: Pick<ArgumentProjection, 'fraction' | 'physicallyReversed'>, crossing: CgChartAxisCrossing): number {
  const fraction = argument.fraction(crossing);
  return argument.physicallyReversed ? 1 - fraction : fraction;
}

function planDocumentAxes<TItem>(
  request: ChartLayoutRequest<TItem>,
  domains: ReadonlyMap<string, AxisDomain>,
  argument: Pick<ArgumentProjection, 'fraction' | 'physicallyReversed'>,
): DocumentPlan {
  const vertical = request.orientation === 'vertical';
  const axes = visibleValueAxes(request, domains);
  const primaryName = resolvedAxes(request.valueAxes)[0]?.name ?? 'primary';
  const primaryDescriptor = resolvedAxes(request.valueAxes)[0]!;
  const primaryDomain = domains.get(primaryName)!;
  // Physical value direction: in vertical charts value minimum is at the bottom (fraction 1).
  const valueReversed = primaryDescriptor.reversed === true;
  const valueMinimumAt: 0 | 1 = vertical ? (valueReversed ? 0 : 1) : ((request.rtl !== valueReversed) ? 1 : 0);
  const valueFraction = numericCrossingFraction(primaryDomain, primaryDescriptor.argumentAxisCrossesAt ?? 'auto');
  const argumentLineAt = valueMinimumAt === 1 ? 1 - valueFraction : valueFraction;
  const argumentPlacement = placement(argumentLineAt, request.argumentAxis?.labelPosition ?? 'nextToAxis', valueMinimumAt);
  const argumentMinimumAt: 0 | 1 = argument.physicallyReversed ? 1 : 0;
  const values = new Map<string, AxisPlacement & { offset: number }>();
  const offsets = new Map<number, number>();
  for (const axis of axes) {
    let lineAt: number;
    const crossing = request.argumentAxis?.valueAxisCrossesAt;
    if (axis.index === 0 && crossing !== undefined) lineAt = argumentCrossingAt(argument, crossing);
    else {
      const position = resolvedAxisPosition(axis.descriptor, axis.index);
      lineAt = vertical ? ((position === 'start') !== request.rtl ? 0 : 1) : position === 'start' ? 0 : 1;
    }
    const axisPlacement = placement(lineAt, axis.descriptor.labelPosition ?? 'nextToAxis', argumentMinimumAt);
    const edgeKey = axisPlacement.lineAt <= 1e-9 ? 0 : axisPlacement.lineAt >= 1 - 1e-9 ? 1 : -1;
    const offset = edgeKey === -1 ? 0 : offsets.get(edgeKey) ?? 0;
    values.set(axis.name, { ...axisPlacement, offset });
    if (edgeKey !== -1) offsets.set(edgeKey, offset + 1);
  }
  return { argument: argumentPlacement, values };
}

interface Reserves { left: number; right: number; top: number; bottom: number }

function sideOf(vertical: boolean, along: 'x' | 'y', at: number): Side {
  void vertical;
  return along === 'x' ? (at < 0.5 ? 'left' : 'right') : (at < 0.5 ? 'top' : 'bottom');
}

/** Reserved thickness beside each plot edge for labels, outside ticks and titles, plus the per-axis offsets. */
function documentReserves<TItem>(
  request: ChartLayoutRequest<TItem>,
  plan: DocumentPlan,
  axes: ReadonlyArray<ValueAxisInfo>,
  argumentThickness: number,
): Readonly<{ reserves: Reserves; axisOffsets: ReadonlyMap<string, number> }> {
  const style = request.document!;
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const vertical = request.orientation === 'vertical';
  const reserves: Reserves = { left: 0, right: 0, top: 0, bottom: 0 };
  const axisOffsets = new Map<string, number>();
  const edgeTotals = new Map<Side, number>();
  for (const axis of axes) {
    const placed = plan.values.get(axis.name)!;
    const labelStyle = mergeTextStyle(style.axisLabels, axis.descriptor.labelStyle);
    const gap = Math.max(3, labelStyle.size * 0.3);
    const ticks = tickExtent(axis.descriptor.majorTickMarks ?? 'none', MAJOR_TICK, placed.normal);
    const labelSize = placed.showLabels
      ? vertical ? maximumOf(axis.texts.map((text) => measure(text, labelStyle)), 0) : labelStyle.size * 1.2
      : 0;
    const titleStyle = mergeTextStyle(style.axisTitles, axis.descriptor.titleStyle);
    const title = axis.descriptor.title ? titleStyle.size * 1.2 + titleStyle.size * 0.4 : 0;
    const total = (placed.labelsAtEdge && placed.showLabels ? labelSize + gap : 0) + ticks.outside + title;
    const lineEdge = placed.lineAt <= 1e-9 || placed.lineAt >= 1 - 1e-9;
    if (!lineEdge && !placed.labelsAtEdge && !title) continue;
    const side = sideOf(vertical, vertical ? 'x' : 'y', placed.labelsAtEdge ? placed.labelsAt : placed.lineAt);
    const before = edgeTotals.get(side) ?? 0;
    axisOffsets.set(axis.name, before);
    edgeTotals.set(side, before + total + (before ? gap : 0));
  }
  for (const [side, total] of edgeTotals) reserves[side] = Math.max(reserves[side], total);
  const argumentPlaced = plan.argument;
  if (request.argumentAxis?.visible !== false) {
    const labelStyle = mergeTextStyle(style.axisLabels, request.argumentAxis?.labelStyle);
    const gap = Math.max(3, labelStyle.size * 0.3);
    const ticks = tickExtent(request.argumentAxis?.majorTickMarks ?? (request.argumentAxis?.showTickMarks === false ? 'none' : 'outside'), MAJOR_TICK, argumentPlaced.normal);
    const titleStyle = mergeTextStyle(style.axisTitles, request.argumentAxis?.titleStyle);
    const title = request.argumentAxis?.title ? titleStyle.size * 1.2 + titleStyle.size * 0.4 : 0;
    const labels = argumentPlaced.showLabels && argumentPlaced.labelsAtEdge ? argumentThickness + gap : 0;
    const total = labels + ticks.outside + title;
    const side = sideOf(vertical, vertical ? 'y' : 'x', argumentPlaced.labelsAtEdge ? argumentPlaced.labelsAt : argumentPlaced.lineAt);
    reserves[side] = Math.max(reserves[side], total);
  }
  // Edge labels centred on the plot corners overhang the plot.
  const valueLabelStyle = style.axisLabels;
  if (vertical) {
    if (axes.some((axis) => plan.values.get(axis.name)!.showLabels)) {
      reserves.top = Math.max(reserves.top, valueLabelStyle.size * 0.6);
      reserves.bottom = Math.max(reserves.bottom, valueLabelStyle.size * 0.6);
    }
  } else if (axes.length) {
    const widest = maximumOf(axes.flatMap((axis) => axis.texts.map((text) => measure(text, mergeTextStyle(valueLabelStyle, axis.descriptor.labelStyle)))), 0);
    reserves.left = Math.max(reserves.left, widest / 2);
    reserves.right = Math.max(reserves.right, widest / 2);
  }
  return { reserves, axisOffsets };
}

function documentLegendEntries<TItem>(request: ChartLayoutRequest<TItem>): ReadonlyArray<ChartLegendEntryInput> {
  const model = request.model;
  if (model.kind === 'pie') {
    const series = model.visibleSeries[0];
    if (!series || series.descriptor.showInLegend === false) return [];
    const descriptor = series.descriptor;
    const outline = descriptor.type === 'pie' || descriptor.type === 'donut' ? descriptor.outlineColor : undefined;
    return series.points.filter((point) => !point.synthetic).map((point) => ({
      seriesName: series.name,
      pointIndex: point.pointIndex,
      label: point.formattedArgument,
      key: {
        kind: 'rect',
        color: point.color ?? `var(--cg-chart-series-${point.pointIndex % 10 + 1})`,
        ...strokeWidthOr(point.outlineColor ?? outline, point.outlineWidth),
      },
    }));
  }
  return model.visibleSeries.filter((series) => series.descriptor.showInLegend !== false).map((series) => {
    const descriptor = series.descriptor as CgChartSeriesDescriptor<unknown>;
    let key: ChartLegendKeyInput;
    if (descriptor.type === 'bar') {
      key = { kind: 'rect', color: descriptor.fillColor ?? series.color, ...strokeWidthOr(descriptor.outlineColor, descriptor.outlineWidth) };
    } else if (descriptor.type === 'area') {
      key = { kind: 'rect', color: descriptor.fillColor ?? series.color, opacity: descriptor.areaOpacity ?? 0.25 };
    } else if (descriptor.type === 'line' || descriptor.type === 'scatter') {
      const lineColor = descriptor.lineColor ?? series.color;
      const lineWidth = Math.min(4, descriptor.lineWidth ?? 2);
      const showLine = (descriptor.type === 'line' || descriptor.showLine === true) && !isNoPaint(lineColor);
      const markers = (descriptor.showMarkers ?? true) && series.markerSymbol !== 'none';
      key = {
        kind: 'line',
        color: lineColor,
        showLine,
        strokeWidth: lineWidth,
        ...(dashArray(series.dashStyle, lineWidth, true) ? { dashArray: dashArray(series.dashStyle, lineWidth, true)! } : {}),
        ...(markers ? {
          markerSymbol: series.markerSymbol,
          markerSize: Math.min(request.document!.legend.size, descriptor.markerSize ?? 7),
          markerFill: descriptor.markerFillColor ?? series.color,
          ...(descriptor.markerOutlineColor && !isNoPaint(descriptor.markerOutlineColor)
            ? { markerStroke: descriptor.markerOutlineColor, markerStrokeWidth: descriptor.markerOutlineWidth ?? 1 } : {}),
        } : {}),
      };
    } else key = { kind: 'rect', color: series.color };
    return { seriesName: series.name, label: series.name, key };
  });
}

interface DocumentFrame {
  readonly chartArea: ChartRectangle;
  readonly title: ChartDocumentLayout['title'];
  readonly legend: ChartDocumentLayout['legend'];
  readonly content: ChartRectangle;
  readonly legendTruncated: boolean;
}

interface FrameOptions {
  readonly titleLines: number;
  readonly legend: boolean;
  readonly title: boolean;
}

function documentFrame<TItem>(request: ChartLayoutRequest<TItem>, options: FrameOptions): DocumentFrame {
  const style = request.document!;
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const chartArea = Object.freeze({ x: 0, y: 0, width: request.width, height: request.height });
  let content = insetRectangle(chartArea, (style.chartBorder?.width ?? 0) + style.padding);
  const title = request.title && options.title ? layoutDocumentTitle(request.title, content, style.title, options.titleLines, measure) : null;
  if (title) content = title.remaining;
  const position = request.legend?.visible === false || !options.legend ? 'none' : request.legend?.position ?? 'bottom';
  const legend = position === 'none'
    ? null
    : layoutDocumentLegend(documentLegendEntries(request), content, position, style.legend, measure, request.rtl);
  if (legend) content = legend.remaining;
  return {
    chartArea,
    title: title ? Object.freeze({ lines: title.lines, box: title.box }) : null,
    legend: legend ? Object.freeze({ box: legend.box, entries: legend.entries }) : null,
    content,
    legendTruncated: legend?.truncated ?? false,
  };
}

/**
 * At small sizes the title and legend can crowd out the plot. Try the full frame first, then a
 * one-line title, then no legend, then no title, and keep the first whose plot keeps a usable
 * share of the chart and whose legend shows every entry.
 */
function fittedDocumentFrame<TItem>(
  request: ChartLayoutRequest<TItem>,
  domains: ReadonlyMap<string, AxisDomain>,
): Readonly<{ frame: DocumentFrame; plot: ChartRectangle }> {
  const style = request.document!;
  const candidates: ReadonlyArray<FrameOptions> = [
    { titleLines: style.titleMaxLines, legend: true, title: true },
    { titleLines: 1, legend: true, title: true },
    { titleLines: 1, legend: false, title: true },
    { titleLines: 1, legend: false, title: false },
  ];
  const minimumWidth = Math.max(24, request.width * 0.3);
  const minimumHeight = Math.max(20, request.height * 0.3);
  let fallback: Readonly<{ frame: DocumentFrame; plot: ChartRectangle }> | null = null;
  for (const options of candidates) {
    const frame = documentFrame(request, options);
    const plot = documentPlot(request, domains, frame);
    fallback = { frame, plot };
    const legendFits = !frame.legendTruncated || request.height >= 200;
    if (style.plotLayout || (plot.width >= minimumWidth && plot.height >= minimumHeight && legendFits)) break;
  }
  return fallback!;
}

function relativeRectangle(request: ChartLayoutRequest<unknown>, rectangle: { x: number; y: number; width: number; height: number }): ChartRectangle {
  return Object.freeze({
    x: rectangle.x * request.width,
    y: rectangle.y * request.height,
    width: Math.max(1, rectangle.width * request.width),
    height: Math.max(1, rectangle.height * request.height),
  });
}

function argumentThickness<TItem>(request: ChartLayoutRequest<TItem>, plan: AxisLabelPlan, labels: ReadonlyArray<string>): number {
  const style = mergeTextStyle(request.document!.axisLabels, request.argumentAxis?.labelStyle);
  if (request.orientation === 'horizontal') {
    const measure = measurer(request as ChartLayoutRequest<unknown>);
    return maximumOf(plan.items.map((item) => measure(labels[item.index] ?? item.displayText, style)), 0);
  }
  return plan.items.length ? plan.thickness : 0;
}

function argumentLabelTexts<TItem>(request: ChartLayoutRequest<TItem>, length: number): ReadonlyArray<string> {
  if (request.model.argumentKind === 'category' || !request.model.arguments.length) {
    return request.model.arguments.map((argument) => request.formatter.formatArgument(argument, request.argumentAxis));
  }
  if (request.model.argumentKind === 'numeric') {
    const domain = argumentNumericDomain(request, length);
    return domain.ticks.map((exact, index) => domain.texts?.[index] ?? request.formatter.formatArgument(
      Object.freeze({ kind: 'numeric', key: `n:${exactText(exact)}`, original: exactText(exact), exact }), request.argumentAxis,
    ));
  }
  return [];
}

function documentPlot<TItem>(
  request: ChartLayoutRequest<TItem>,
  domains: ReadonlyMap<string, AxisDomain>,
  frame: DocumentFrame,
): ChartRectangle {
  const style = request.document!;
  const layout = style.plotLayout;
  if (layout && (layout.target ?? 'inner') === 'inner') return relativeRectangle(request as ChartLayoutRequest<unknown>, layout);
  const outer = layout ? relativeRectangle(request as ChartLayoutRequest<unknown>, layout) : frame.content;
  if (request.model.kind === 'pie') return outer;
  const vertical = request.orientation === 'vertical';
  const provisional = buildArgumentProjection(request, outer);
  const plan = planDocumentAxes(request, domains, provisional);
  const axes = visibleValueAxes(request, domains);
  // Value reserves never depend on argument labels, so settle them first and plan the argument
  // labels on the length that is left.
  const first = documentReserves(request, plan, axes, 0);
  const length = vertical
    ? outer.width - first.reserves.left - first.reserves.right
    : outer.height - first.reserves.top - first.reserves.bottom;
  const labels = argumentLabelTexts(request, Math.max(1, length));
  const argumentPlan = planArgumentLabels(request, labels, Math.max(1, length), request.model.argumentKind === 'category' ? request.argumentAxis?.labelInterval : undefined);
  const { reserves } = documentReserves(request, plan, axes, argumentThickness(request, argumentPlan, labels));
  if (request.model.argumentKind !== 'category' && plan.argument.showLabels && labels.length) {
    const measure = measurer(request as ChartLayoutRequest<unknown>);
    const labelStyle = mergeTextStyle(style.axisLabels, request.argumentAxis?.labelStyle);
    if (vertical) {
      const half = Math.max(measure(labels[0]!, labelStyle), measure(labels.at(-1)!, labelStyle)) / 2;
      reserves.left = Math.max(reserves.left, half);
      reserves.right = Math.max(reserves.right, half);
    } else {
      reserves.top = Math.max(reserves.top, labelStyle.size * 0.6);
      reserves.bottom = Math.max(reserves.bottom, labelStyle.size * 0.6);
    }
  } else if (request.argumentAxis?.categoryPlacement === 'onTicks' && plan.argument.showLabels && labels.length && vertical) {
    const measure = measurer(request as ChartLayoutRequest<unknown>);
    const labelStyle = mergeTextStyle(style.axisLabels, request.argumentAxis?.labelStyle);
    const half = Math.max(measure(labels[0]!, labelStyle), measure(labels.at(-1)!, labelStyle)) / 2;
    reserves.left = Math.max(reserves.left, half);
    reserves.right = Math.max(reserves.right, half);
  }
  return Object.freeze({
    x: outer.x + reserves.left,
    y: outer.y + reserves.top,
    width: Math.max(1, outer.width - reserves.left - reserves.right),
    height: Math.max(1, outer.height - reserves.top - reserves.bottom),
  });
}

function along(vertical: boolean, plot: ChartRectangle, at: number, across: 'x' | 'y'): number {
  void vertical;
  return across === 'x' ? plot.x + plot.width * at : plot.y + plot.height * at;
}

function segment(alongX: boolean, position: number, from: number, to: number): ChartLineSegment {
  return alongX
    ? Object.freeze({ x1: position, y1: from, x2: position, y2: to })
    : Object.freeze({ x1: from, y1: position, x2: to, y2: position });
}

function boxOfText(item: ChartTextItem, measure: ChartTextMeasurer): ChartRectangle {
  const width = measure(item.text, item.style);
  const height = item.style.size * 1.2;
  if (item.rotation) {
    const radians = Math.abs(item.rotation) * Math.PI / 180;
    const w = Math.abs(Math.cos(radians)) * width + Math.abs(Math.sin(radians)) * height;
    const h = Math.abs(Math.sin(radians)) * width + Math.abs(Math.cos(radians)) * height;
    const pivotX = item.pivotX ?? item.x;
    const pivotY = item.pivotY ?? item.y;
    if (Math.abs(item.rotation) === 90) return { x: pivotX - h / 2 + (item.y - pivotY), y: pivotY - w / 2, width: h, height: w };
    const left = item.anchor === 'end' ? pivotX - w : item.anchor === 'middle' ? pivotX - w / 2 : pivotX;
    return { x: left, y: item.rotation < 0 && item.anchor === 'end' ? pivotY - h * 0.2 : pivotY - h + height * 0.3, width: w, height: h };
  }
  const left = item.anchor === 'end' ? item.x - width : item.anchor === 'middle' ? item.x - width / 2 : item.x;
  return { x: left, y: item.y - item.style.size * 0.95, width, height };
}

function strokeFor(base: ChartStroke, override: Parameters<typeof resolveStroke>[1]): ChartStroke | null {
  return resolveStroke(base, override);
}

function buildDocumentAxes<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  domains: ReadonlyMap<string, AxisDomain>,
  valueAxes: ReadonlyArray<ChartValueAxisLayout>,
): Pick<ChartDocumentLayout, 'axes' | 'grids'> {
  const style = request.document!;
  const measure = measurer(request as ChartLayoutRequest<unknown>);
  const vertical = request.orientation === 'vertical';
  const plan = planDocumentAxes(request, domains, argument);
  const axesInfo = visibleValueAxes(request, domains);
  const { axisOffsets } = documentReserves(request, plan, axesInfo, 0);
  const axes: ChartDocumentAxis[] = [];
  const grids: ChartDocumentGrid[] = [];
  // Value axes run along y in vertical charts (lines are vertical: constant x).
  const valueLinesAlongX = vertical;

  const gridLines = (positions: ReadonlyArray<number>, acrossX: boolean): ReadonlyArray<ChartLineSegment> => positions.map((position) => acrossX
    ? Object.freeze({ x1: plot.x, y1: position, x2: plot.x + plot.width, y2: position })
    : Object.freeze({ x1: position, y1: plot.y, x2: position, y2: plot.y + plot.height }));

  for (const info of axesInfo) {
    const layout = valueAxes.find((candidate) => candidate.name === info.name);
    if (!layout) continue;
    const descriptor = info.descriptor;
    const placed = plan.values.get(info.name)!;
    const ref: CgChartAxisRef = { axis: 'value', axisName: info.name };
    const labelStyle = mergeTextStyle(style.axisLabels, descriptor.labelStyle);
    const gap = Math.max(3, labelStyle.size * 0.3);
    const order = axisOffsets.get(info.name) ?? 0;
    const lineCoordinate = along(vertical, plot, placed.lineAt, valueLinesAlongX ? 'x' : 'y') + placed.normal * order;
    const major = tickExtent(descriptor.majorTickMarks ?? 'none', MAJOR_TICK, placed.normal);
    const minor = tickExtent(descriptor.minorTickMarks ?? 'none', MINOR_TICK, placed.normal);
    const positions = layout.ticks.map((tick) => tick.position);
    const lineStroke = (descriptor.showAxisLine ?? false) ? strokeFor(style.axisStroke, descriptor.axisLineStyle) : null;
    const tickStroke = strokeFor(style.axisStroke, descriptor.axisLineStyle);
    const line = valueLinesAlongX
      ? segment(true, lineCoordinate, plot.y, plot.y + plot.height)
      : segment(false, lineCoordinate, plot.x, plot.x + plot.width);
    const tickMarks = major.from === major.to ? [] : positions.map((position) => valueLinesAlongX
      ? Object.freeze({ x1: lineCoordinate + major.from, y1: position, x2: lineCoordinate + major.to, y2: position })
      : Object.freeze({ x1: position, y1: lineCoordinate + major.from, x2: position, y2: lineCoordinate + major.to }));
    const minorMarks = minor.from === minor.to ? [] : layout.minorTicks.map((position) => valueLinesAlongX
      ? Object.freeze({ x1: lineCoordinate + minor.from, y1: position, x2: lineCoordinate + minor.to, y2: position })
      : Object.freeze({ x1: position, y1: lineCoordinate + minor.from, x2: position, y2: lineCoordinate + minor.to }));
    const labelBase = (placed.labelsAtEdge ? along(vertical, plot, placed.labelsAt, valueLinesAlongX ? 'x' : 'y') + placed.normal * order : lineCoordinate)
      + placed.normal * (gap + major.outside);
    // Labels closer together than they are tall (or wide, along x) are thinned to every nth.
    const spacing = layout.ticks.length > 1 ? Math.abs(layout.ticks[1]!.position - layout.ticks[0]!.position) : Number.POSITIVE_INFINITY;
    const extentAlong = valueLinesAlongX
      ? labelStyle.size * 1.1
      : maximumOf(layout.ticks.map((tick) => measure(tick.text, labelStyle)), 0) + labelStyle.size * 0.5;
    const stride = spacing > 0 ? Math.max(1, Math.ceil(extentAlong / spacing)) : 1;
    const labels: ChartTextItem[] = placed.showLabels ? layout.ticks.filter((_tick, index) => index % stride === 0).map((tick) => valueLinesAlongX
      ? Object.freeze<ChartTextItem>({ x: labelBase, y: centredBaseline(tick.position, labelStyle), text: tick.text, anchor: placed.normal < 0 ? 'end' : 'start', style: labelStyle })
      : Object.freeze<ChartTextItem>({
        x: tick.position,
        y: placed.normal > 0 ? labelBase + labelStyle.size * 0.8 : labelBase - labelStyle.size * 0.25,
        text: tick.text, anchor: 'middle', style: labelStyle,
      })) : [];
    const labelExtent = valueLinesAlongX ? maximumOf(labels.map((label) => measure(label.text, labelStyle)), 0) : labelStyle.size * 1.2;
    let title: ChartDocumentAxis['title'] = null;
    if (descriptor.title) {
      const titleStyle = mergeTextStyle(style.axisTitles, descriptor.titleStyle);
      const titleCenter = labelBase + placed.normal * ((placed.showLabels ? labelExtent : 0) + titleStyle.size * 0.4 + titleStyle.size * 0.6);
      const item: ChartTextItem = valueLinesAlongX
        ? { x: titleCenter, y: centredBaseline(plot.y + plot.height / 2, titleStyle) - titleStyle.size * 0.35 + titleStyle.size * 0.35, text: descriptor.title, anchor: 'middle', style: titleStyle, rotation: -90, pivotX: titleCenter, pivotY: plot.y + plot.height / 2 }
        : { x: plot.x + plot.width / 2, y: centredBaseline(titleCenter, titleStyle), text: descriptor.title, anchor: 'middle', style: titleStyle };
      const width = measure(descriptor.title, titleStyle);
      const box = valueLinesAlongX
        ? { x: titleCenter - titleStyle.size * 0.6, y: plot.y + plot.height / 2 - width / 2, width: titleStyle.size * 1.2, height: width }
        : { x: plot.x + plot.width / 2 - width / 2, y: titleCenter - titleStyle.size * 0.6, width, height: titleStyle.size * 1.2 };
      // Rotated -90: the baseline offset moves along +x, so draw at the centre with a baseline shift.
      title = Object.freeze({
        item: valueLinesAlongX ? Object.freeze({ ...item, x: titleCenter, y: plot.y + plot.height / 2 + titleStyle.size * 0.35 }) : Object.freeze(item),
        box: Object.freeze(box),
      });
    }
    const pieces = [...labels.map((label) => boxOfText(label, measure)), lineBox(line), ...tickMarks.map(lineBox)];
    axes.push(Object.freeze({
      ref, line: lineStroke ? line : null, lineStroke, tickStroke,
      tickMarks: Object.freeze(tickMarks), minorTickMarks: Object.freeze(minorMarks),
      labels: Object.freeze(labels),
      box: unionRectangles(pieces),
      title,
    }));
    if (layout.showGridLines) {
      const stroke = resolveStroke(style.gridStroke, descriptor.majorGridLineStyle);
      if (stroke) grids.push(Object.freeze({ ref, kind: 'major', lines: Object.freeze(gridLines(positions, valueLinesAlongX)), stroke }));
    }
    if (descriptor.showMinorGridLines && layout.minorTicks.length) {
      const stroke = resolveStroke(style.gridStroke, descriptor.minorGridLineStyle);
      if (stroke) grids.push(Object.freeze({ ref, kind: 'minor', lines: Object.freeze(gridLines(layout.minorTicks, valueLinesAlongX)), stroke }));
    }
  }

  const argumentDescriptor = request.argumentAxis;
  if (argumentDescriptor?.visible !== false && request.model.kind === 'cartesian') {
    const ref: CgChartAxisRef = { axis: 'argument' };
    const placed = plan.argument;
    const labelStyle = mergeTextStyle(style.axisLabels, argumentDescriptor?.labelStyle);
    const gap = Math.max(3, labelStyle.size * 0.3);
    const argumentLinesAlongX = !vertical; // in vertical charts the argument axis is horizontal (constant y)
    const lineCoordinate = along(vertical, plot, placed.lineAt, vertical ? 'y' : 'x');
    const major = tickExtent(argumentDescriptor?.majorTickMarks ?? (argumentDescriptor?.showTickMarks === false ? 'none' : 'outside'), MAJOR_TICK, placed.normal);
    const minor = tickExtent(argumentDescriptor?.minorTickMarks ?? 'none', MINOR_TICK, placed.normal);
    const lineStroke = (argumentDescriptor?.showAxisLine ?? true) ? strokeFor(style.axisStroke, argumentDescriptor?.axisLineStyle) : null;
    const tickStroke = strokeFor(style.axisStroke, argumentDescriptor?.axisLineStyle);
    const line = argumentLinesAlongX
      ? segment(true, lineCoordinate, plot.y, plot.y + plot.height)
      : segment(false, lineCoordinate, plot.x, plot.x + plot.width);
    const marks = (positions: ReadonlyArray<number>, extent: ReturnType<typeof tickExtent>) => extent.from === extent.to ? [] : positions.map((position) => argumentLinesAlongX
      ? Object.freeze({ x1: lineCoordinate + extent.from, y1: position, x2: lineCoordinate + extent.to, y2: position })
      : Object.freeze({ x1: position, y1: lineCoordinate + extent.from, x2: position, y2: lineCoordinate + extent.to }));
    const tickMarks = marks(argument.tickMarks, major);
    const minorMarks = marks(argument.minorTicks, minor);
    const labelBase = (placed.labelsAtEdge ? along(vertical, plot, placed.labelsAt, vertical ? 'y' : 'x') : lineCoordinate) + placed.normal * (gap + major.outside);
    const lineHeight = labelStyle.size * 1.2;
    const labels: ChartTextItem[] = placed.showLabels ? argument.ticks.map((tick) => {
      if (argumentLinesAlongX) {
        return Object.freeze<ChartTextItem>({ x: labelBase, y: centredBaseline(tick.position, labelStyle), text: tick.text, fullText: tick.fullText, anchor: placed.normal < 0 ? 'end' : 'start', style: labelStyle });
      }
      const row = tick.row ?? 0;
      const baseline = placed.normal > 0
        ? labelBase + labelStyle.size * 0.8 + row * lineHeight
        : labelBase - labelStyle.size * 0.25 - row * lineHeight;
      if (tick.rotation) {
        const anchor = (tick.rotation < 0) === (placed.normal > 0) ? 'end' : 'start';
        return Object.freeze<ChartTextItem>({ x: tick.position, y: baseline, text: tick.text, fullText: tick.fullText, anchor, style: labelStyle, rotation: tick.rotation, pivotX: tick.position, pivotY: baseline });
      }
      return Object.freeze<ChartTextItem>({ x: tick.position, y: baseline, text: tick.text, fullText: tick.fullText, anchor: 'middle', style: labelStyle });
    }) : [];
    let title: ChartDocumentAxis['title'] = null;
    if (argumentDescriptor?.title) {
      const titleStyle = mergeTextStyle(style.axisTitles, argumentDescriptor.titleStyle);
      const thickness = argumentLinesAlongX
        ? maximumOf(labels.map((label) => measure(label.text, labelStyle)), 0)
        : labels.length ? argument.plan.thickness : 0;
      const titleCenter = labelBase + placed.normal * ((placed.showLabels ? thickness : 0) + titleStyle.size * 0.4 + titleStyle.size * 0.6);
      const width = measure(argumentDescriptor.title, titleStyle);
      title = argumentLinesAlongX
        ? Object.freeze({
          item: Object.freeze<ChartTextItem>({ x: titleCenter, y: plot.y + plot.height / 2 + titleStyle.size * 0.35, text: argumentDescriptor.title, anchor: 'middle', style: titleStyle, rotation: -90, pivotX: titleCenter, pivotY: plot.y + plot.height / 2 }),
          box: Object.freeze({ x: titleCenter - titleStyle.size * 0.6, y: plot.y + plot.height / 2 - width / 2, width: titleStyle.size * 1.2, height: width }),
        })
        : Object.freeze({
          item: Object.freeze<ChartTextItem>({ x: plot.x + plot.width / 2, y: centredBaseline(titleCenter, titleStyle), text: argumentDescriptor.title, anchor: 'middle', style: titleStyle }),
          box: Object.freeze({ x: plot.x + plot.width / 2 - width / 2, y: titleCenter - titleStyle.size * 0.6, width, height: titleStyle.size * 1.2 }),
        });
    }
    axes.push(Object.freeze({
      ref, line: lineStroke ? line : null, lineStroke, tickStroke,
      tickMarks: Object.freeze(tickMarks), minorTickMarks: Object.freeze(minorMarks),
      labels: Object.freeze(labels),
      box: unionRectangles([...labels.map((label) => boxOfText(label, measure)), lineBox(line), ...tickMarks.map(lineBox)]),
      title,
    }));
    if (argumentDescriptor?.showGridLines) {
      const stroke = resolveStroke(style.gridStroke, argumentDescriptor.majorGridLineStyle);
      if (stroke) grids.push(Object.freeze({ ref, kind: 'major', lines: Object.freeze(gridLines(argument.tickMarks, argumentLinesAlongX)), stroke }));
    }
    if (argumentDescriptor?.showMinorGridLines && argument.minorTicks.length) {
      const stroke = resolveStroke(style.gridStroke, argumentDescriptor.minorGridLineStyle);
      if (stroke) grids.push(Object.freeze({ ref, kind: 'minor', lines: Object.freeze(gridLines(argument.minorTicks, argumentLinesAlongX)), stroke }));
    }
  }
  return { axes: Object.freeze(axes), grids: Object.freeze(grids) };
}

function lineBox(line: ChartLineSegment): ChartRectangle {
  const pad = 3;
  return {
    x: Math.min(line.x1, line.x2) - pad,
    y: Math.min(line.y1, line.y2) - pad,
    width: Math.abs(line.x2 - line.x1) + pad * 2,
    height: Math.abs(line.y2 - line.y1) + pad * 2,
  };
}

export function buildChartLayout<TItem>(request: ChartLayoutRequest<TItem>): ChartLayout {
  const { width, height } = request;
  const documentMode = request.document !== undefined;
  if (documentMode ? width < 120 || height < 80 : width < 160 || height < 120) return emptyLayout(width, height, true, request.model.isEmpty);
  if (request.model.isEmpty) return emptyLayout(width, height, false, true);
  const stacks = buildStackPositions(request.model.visibleSeries);
  const domains = request.model.kind === 'cartesian' ? valueDomains(request, stacks) : new Map<string, AxisDomain>();
  const fitted = documentMode ? fittedDocumentFrame(request, domains) : null;
  const frame = fitted?.frame ?? null;
  const plot = fitted?.plot ?? chartPlot(request, domains);
  const argument = buildArgumentProjection(request, plot);
  const geometry = request.model.kind === 'pie'
    ? { ...buildPie(request, plot), valueAxes: Object.freeze([]), scales: new Map<string, NumericScale>() }
    : buildCartesian(request, plot, argument, domains, stacks);
  const document: ChartDocumentLayout | null = frame ? Object.freeze({
    style: request.document!,
    chartArea: frame.chartArea,
    title: frame.title,
    legend: frame.legend,
    ...(request.model.kind === 'pie'
      ? { axes: Object.freeze([]), grids: Object.freeze([]) }
      : buildDocumentAxes(request, plot, argument, domains, geometry.valueAxes)),
  }) : null;
  return Object.freeze({
    width, height, tooSmall: false, isEmpty: false, plot,
    argumentTicks: request.model.kind === 'pie' ? Object.freeze([]) : argument.ticks,
    argumentLabelPlan: request.model.kind === 'pie'
      ? Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 })
      : argument.plan,
    valueAxes: geometry.valueAxes,
    shapes: geometry.shapes,
    labels: geometry.labels,
    constantLines: request.model.kind === 'pie' ? Object.freeze([]) : constantLineLayouts(request, plot, argument, geometry.scales, domains),
    annotations: annotationLayouts(request, plot, argument, geometry.scales),
    hitTargets: geometry.hitTargets,
    document,
  });
}

