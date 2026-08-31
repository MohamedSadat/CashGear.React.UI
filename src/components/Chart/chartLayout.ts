import type {
  CgChartAnnotationDescriptor,
  CgChartArgumentAxisDescriptor,
  CgChartConstantLineDescriptor,
  CgChartDashStyle,
  CgChartMarkerSymbol,
  CgChartNumericValue,
  CgChartOrientation,
  CgChartPointLabelOptions,
  CgChartValueAxisDescriptor,
} from './CgChart.types';
import type { ChartFormatter } from './chartFormatting';
import { estimateTextWidth, planAxisLabels } from './chartAxisLabels';
import type { AxisLabelPlan } from './chartAxisLabels';
import type { ChartPoint, ChartSeries, VisibleChartModel } from './chartModel';
import type { ChartRectangle } from './chartGeometry';
import { rectanglesOverlap } from './chartGeometry';
import { arcPath, monotonePath, roundedRectPath, straightPath } from './chartPaths';
import type { SvgPoint } from './chartPaths';
import { createBandScale, createNumericScale, groupedBandSlot } from './chartScales';
import type { BandScale, NumericScale } from './chartScales';
import { buildStackPositions, stackPositionKey } from './chartStacking';
import type { ChartStackPosition } from './chartStacking';
import { createDateDomain, createNumericDomain } from './chartTicks';
import type { NumericDomain } from './chartTicks';
import {
  exactAdd,
  exactCompare,
  exactDivide,
  exactFromNumeric,
  exactText,
  normalizeArgument,
} from './chartValues';
import type { ExactValue, NormalizedArgument } from './chartValues';

export interface ChartAxisTickLayout {
  readonly position: number;
  readonly text: string;
  readonly fullText: string;
  readonly rotation?: number;
  readonly row?: 0 | 1;
}

export interface ChartValueAxisLayout {
  readonly name: string;
  readonly title?: string;
  readonly position: 'start' | 'end';
  readonly offset: number;
  readonly labelWidth: number;
  readonly ticks: ReadonlyArray<ChartAxisTickLayout>;
  readonly zeroPosition: number | null;
  readonly showGridLines: boolean;
  readonly showAxisLine: boolean;
  readonly showZeroLine: boolean;
}

interface ChartShapeCommon {
  readonly seriesName: string;
  readonly color: string;
  readonly opacity: number;
  readonly className?: string;
}

export interface ChartPathShape extends ChartShapeCommon {
  readonly kind: 'path';
  readonly path: string;
  readonly fill: boolean;
  readonly lineWidth: number;
  readonly dashStyle: CgChartDashStyle;
}

export interface ChartPointShape extends ChartShapeCommon {
  readonly kind: 'point';
  readonly point: ChartPoint<unknown>;
  readonly x: number;
  readonly y: number;
  readonly markerSymbol: CgChartMarkerSymbol;
  readonly markerSize: number;
}

export interface ChartBarShape extends ChartShapeCommon {
  readonly kind: 'bar';
  readonly point: ChartPoint<unknown>;
  readonly path: string;
  readonly bounds: ChartRectangle;
  readonly zeroSizedStack: boolean;
}

export interface ChartArcShape extends ChartShapeCommon {
  readonly kind: 'arc';
  readonly point: ChartPoint<unknown>;
  readonly path: string;
  readonly percentage: string;
  readonly midX: number;
  readonly midY: number;
}

export type ChartShape = ChartPathShape | ChartPointShape | ChartBarShape | ChartArcShape;

export interface ChartPointLabelLayout {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly connector?: Readonly<{ x1: number; y1: number; x2: number; y2: number }>;
}

export interface ChartConstantLineLayout {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly label?: string;
  readonly labelX: number;
  readonly labelY: number;
  readonly labelAnchor: 'start' | 'middle' | 'end';
  readonly color?: string;
  readonly width: number;
  readonly dashStyle: CgChartDashStyle;
  readonly className?: string;
}

export interface ChartAnnotationLayout {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly className?: string;
}

export interface ChartHitTarget {
  readonly point: ChartPoint<unknown>;
  readonly bounds?: ChartRectangle;
  readonly path?: string;
  readonly x?: number;
  readonly y?: number;
  readonly radius?: number;
  readonly percentage?: string;
}

export interface ChartLayout {
  readonly width: number;
  readonly height: number;
  readonly tooSmall: boolean;
  readonly isEmpty: boolean;
  readonly plot: ChartRectangle;
  readonly argumentTicks: ReadonlyArray<ChartAxisTickLayout>;
  readonly argumentLabelPlan: AxisLabelPlan;
  readonly valueAxes: ReadonlyArray<ChartValueAxisLayout>;
  readonly shapes: ReadonlyArray<ChartShape>;
  readonly labels: ReadonlyArray<ChartPointLabelLayout>;
  readonly constantLines: ReadonlyArray<ChartConstantLineLayout>;
  readonly annotations: ReadonlyArray<ChartAnnotationLayout>;
  readonly hitTargets: ReadonlyArray<ChartHitTarget>;
}

export interface ChartLayoutRequest<TItem> {
  readonly model: VisibleChartModel<TItem>;
  readonly width: number;
  readonly height: number;
  readonly orientation: CgChartOrientation;
  readonly rtl: boolean;
  readonly formatter: ChartFormatter;
  readonly argumentAxis?: CgChartArgumentAxisDescriptor;
  readonly valueAxes?: ReadonlyArray<CgChartValueAxisDescriptor>;
  readonly constantLines?: ReadonlyArray<CgChartConstantLineDescriptor>;
  readonly annotations?: ReadonlyArray<CgChartAnnotationDescriptor>;
  readonly pointLabels?: CgChartPointLabelOptions;
}

interface ArgumentProjection {
  readonly point: (argument: NormalizedArgument, index: number) => number;
  readonly ticks: ReadonlyArray<ChartAxisTickLayout>;
  readonly plan: AxisLabelPlan;
  readonly band: BandScale | null;
}

function emptyLayout(width: number, height: number, tooSmall: boolean, isEmpty: boolean): ChartLayout {
  return Object.freeze({
    width, height, tooSmall, isEmpty,
    plot: Object.freeze({ x: 0, y: 0, width, height }),
    argumentTicks: Object.freeze([]),
    argumentLabelPlan: Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 }),
    valueAxes: Object.freeze([]), shapes: Object.freeze([]), labels: Object.freeze([]),
    constantLines: Object.freeze([]), annotations: Object.freeze([]), hitTargets: Object.freeze([]),
  });
}

function resolvedAxes(axes: ReadonlyArray<CgChartValueAxisDescriptor> | undefined): ReadonlyArray<CgChartValueAxisDescriptor> {
  return axes?.length ? axes : [Object.freeze({ name: 'primary' })];
}

function resolvedAxisPosition(axis: CgChartValueAxisDescriptor, index: number): 'start' | 'end' {
  return axis.position === 'start' || axis.position === 'end' ? axis.position : index === 0 ? 'start' : 'end';
}

function valueAxisLabelWidth<TItem>(
  request: ChartLayoutRequest<TItem>,
  axis: CgChartValueAxisDescriptor,
  domain: NumericDomain,
): number {
  return Math.max(0, ...domain.ticks.map((tick) => estimateTextWidth(
    request.formatter.formatAxisValue(tick, axis, domain.interval),
  )));
}

function chartPlot<TItem>(
  request: ChartLayoutRequest<TItem>,
  domains: ReadonlyMap<string, NumericDomain>,
): ChartRectangle {
  const { width, height } = request;
  if (request.model.kind === 'pie') {
    return Object.freeze({ x: 24, y: 16, width: Math.max(1, width - 48), height: Math.max(1, height - 32) });
  }
  const axes = resolvedAxes(request.valueAxes);
  const argumentLabels = request.model.arguments.map((argument) => request.formatter.formatArgument(argument, request.argumentAxis));
  const maximumArgumentWidth = Math.max(0, ...argumentLabels.map((label) => estimateTextWidth(label)));
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

function valueDomains<TItem>(
  request: ChartLayoutRequest<TItem>,
  stacks: ReadonlyMap<string, ChartStackPosition>,
): ReadonlyMap<string, NumericDomain> {
  const result = new Map<string, NumericDomain>();
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
    result.set(name, createNumericDomain(values, axis, axis.includeZero ?? automaticZero, 7));
  }
  return result;
}

function buildArgumentProjection<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
): ArgumentProjection {
  const argumentsList = request.model.arguments;
  const length = request.orientation === 'vertical' ? plot.width : plot.height;
  const planFor = (labels: ReadonlyArray<string>) => planAxisLabels(
    labels, length, request.argumentAxis?.labelOverlapMode ?? 'auto',
    request.argumentAxis?.labelRotationAngle ?? 0, request.argumentAxis?.maximumLabelCharacters ?? 24,
  );
  if (request.model.argumentKind === 'category' || !argumentsList.length) {
    const labels = argumentsList.map((argument) => request.formatter.formatArgument(argument, request.argumentAxis));
    const plan = planFor(labels);
    const band = createBandScale(
      argumentsList.length,
      request.orientation === 'vertical' ? plot.x : plot.y,
      request.orientation === 'vertical' ? plot.x + plot.width : plot.y + plot.height,
      request.argumentAxis?.categoryInnerPadding ?? 0.2,
      request.argumentAxis?.categoryOuterPadding ?? 0.1,
      request.rtl && request.orientation === 'vertical',
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
    return Object.freeze({
      point: (_argument: NormalizedArgument, index: number) => (band.position(index) ?? 0) + band.bandwidth / 2,
      ticks: Object.freeze(ticks), plan, band,
    });
  }
  const exacts = argumentsList.map((argument) => argument.kind === 'numeric'
    ? argument.exact!
    : Object.freeze({ coefficient: argument.epochMilliseconds!, scale: 0 }));
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
  if (request.model.argumentKind === 'numeric') {
    const numericAxis: CgChartValueAxisDescriptor = {
      ...(request.argumentAxis?.minimum !== undefined ? { minimum: request.argumentAxis.minimum as CgChartNumericValue } : {}),
      ...(request.argumentAxis?.maximum !== undefined ? { maximum: request.argumentAxis.maximum as CgChartNumericValue } : {}),
      ...(request.argumentAxis?.tickInterval !== undefined ? { tickInterval: request.argumentAxis.tickInterval } : {}),
    };
    const domain = createNumericDomain(exacts, numericAxis, false, maximumTicks);
    const scale = createNumericScale(
      domain.minimum, domain.maximum,
      request.orientation === 'vertical' ? plot.x : plot.y,
      request.orientation === 'vertical' ? plot.x + plot.width : plot.y + plot.height,
      request.rtl && request.orientation === 'vertical',
    );
    const normalizedTicks = domain.ticks.map((exact) => Object.freeze<NormalizedArgument>({
      kind: 'numeric', key: `n:${exactText(exact)}`, original: exactText(exact), exact,
    }));
    const plan = planFor(normalizedTicks.map((tick) => request.formatter.formatArgument(tick, request.argumentAxis)));
    const ticks = plan.items.map((item) => Object.freeze({
      position: scale.project(normalizedTicks[item.index]!.exact!), text: item.displayText,
      fullText: item.fullText, rotation: plan.rotation, row: item.row,
    }));
    return Object.freeze({
      point: (argument: NormalizedArgument) => scale.project(argument.exact!),
      ticks: Object.freeze(ticks), plan, band: null,
    });
  }
  const explicitInterval = request.argumentAxis?.tickInterval === undefined
    ? undefined
    : exactFromNumeric(request.argumentAxis.tickInterval);
  const dateDomain = createDateDomain(
    minimum.coefficient, maximum.coefficient, maximumTicks, request.formatter.locale,
    request.model.temporalKind!, explicitInterval?.coefficient,
  );
  const scale = createNumericScale(
    { coefficient: dateDomain.minimum, scale: 0 }, { coefficient: dateDomain.maximum, scale: 0 },
    request.orientation === 'vertical' ? plot.x : plot.y,
    request.orientation === 'vertical' ? plot.x + plot.width : plot.y + plot.height,
    request.rtl && request.orientation === 'vertical',
  );
  const labels = dateDomain.ticks.map((tick) => request.formatter.formatDateTick(tick, request.model.temporalKind!, request.argumentAxis));
  const plan = planFor(labels);
  const ticks = plan.items.map((item) => Object.freeze({
    position: scale.project({ coefficient: dateDomain.ticks[item.index]!, scale: 0 }),
    text: item.displayText, fullText: item.fullText, rotation: plan.rotation, row: item.row,
  }));
  return Object.freeze({
    point: (argument: NormalizedArgument) => scale.project({ coefficient: argument.epochMilliseconds!, scale: 0 }),
    ticks: Object.freeze(ticks), plan, band: null,
  });
}

function dashStyle(series: ChartSeries<unknown>): CgChartDashStyle {
  return series.dashStyle;
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

function addLabel(
  labels: ChartPointLabelLayout[],
  occupied: ChartRectangle[],
  text: string,
  x: number,
  y: number,
  options: CgChartPointLabelOptions | undefined,
  connector?: ChartPointLabelLayout['connector'],
): void {
  const width = Math.max(8, text.length * 7);
  const box = { x: x - width / 2, y: y - 13, width, height: 16 };
  if (options?.hideOverlapping !== false && occupied.some((candidate) => rectanglesOverlap(candidate, box))) return;
  occupied.push(box);
  labels.push(Object.freeze({ text, x, y, anchor: 'middle', ...(connector ? { connector } : {}) }));
}

function buildCartesian<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  domains: ReadonlyMap<string, NumericDomain>,
  stacks: ReadonlyMap<string, ChartStackPosition>,
): Pick<ChartLayout, 'shapes' | 'labels' | 'hitTargets' | 'valueAxes'> {
  const shapes: ChartShape[] = [];
  const labels: ChartPointLabelLayout[] = [];
  const hits: ChartHitTarget[] = [];
  const occupied: ChartRectangle[] = [];
  const axes = resolvedAxes(request.valueAxes);
  const scales = new Map<string, NumericScale>();
  const axisLayouts: ChartValueAxisLayout[] = [];
  let startOffset = 0;
  let endOffset = 0;
  axes.forEach((axis, index) => {
    const name = axis.name ?? 'primary';
    const domain = domains.get(name)!;
    const scale = createNumericScale(
      domain.minimum, domain.maximum,
      request.orientation === 'vertical' ? plot.y + plot.height : plot.x,
      request.orientation === 'vertical' ? plot.y : plot.x + plot.width,
      request.orientation === 'horizontal' && request.rtl,
    );
    scales.set(name, scale);
    const zero = exactFromNumeric(0);
    const containsZero = exactCompare(zero, domain.minimum) >= 0 && exactCompare(zero, domain.maximum) <= 0;
    if (axis.visible === false) return;
    const position = resolvedAxisPosition(axis, index);
    const offset = position === 'start' ? startOffset : endOffset;
    const labelWidth = valueAxisLabelWidth(request, axis, domain);
    if (request.orientation === 'vertical') {
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
      ticks: Object.freeze(domain.ticks.map((tick) => Object.freeze({
        position: scale.project(tick),
        text: request.formatter.formatAxisValue(tick, axis, domain.interval),
        fullText: request.formatter.formatAxisValue(tick, axis, domain.interval),
      }))),
      zeroPosition: containsZero ? scale.project(zero) : null,
      showGridLines: axis.showGridLines ?? true,
      showAxisLine: axis.showAxisLine ?? false,
      showZeroLine: axis.showZeroLine ?? true,
    }));
  });

  const barSeries = request.model.visibleSeries.filter((series) => series.descriptor.type === 'bar');
  const slotKeys: string[] = [];
  for (const series of barSeries) {
    const descriptor = series.descriptor;
    if (descriptor.type !== 'bar') continue;
    const key = (descriptor.stacking ?? 'none') === 'none' ? `series:${series.name}` : `stack:${series.valueAxisName}:${descriptor.stackName}`;
    if (!slotKeys.includes(key)) slotKeys.push(key);
  }
  const continuousPositions = argument.band === null
    ? request.model.arguments.map((value, index) => argument.point(value, index))
    : [];
  const continuousBandwidth = continuousPositions.length > 1
    ? Math.min(...continuousPositions.slice(1).map((position, index) => Math.abs(position - continuousPositions[index]!)))
      * (1 - (request.argumentAxis?.categoryInnerPadding ?? 0.2))
    : (request.orientation === 'vertical' ? plot.width : plot.height) * 0.55;

  for (const genericSeries of request.model.visibleSeries) {
    const series = genericSeries as ChartSeries<unknown>;
    const descriptor = series.descriptor;
    const scale = scales.get(series.valueAxisName)!;
    if (descriptor.type === 'bar') {
      const slotKey = (descriptor.stacking ?? 'none') === 'none' ? `series:${series.name}` : `stack:${series.valueAxisName}:${descriptor.stackName}`;
      const slotIndex = slotKeys.indexOf(slotKey);
      for (const point of series.points) {
        if (!point.exactValue || !point.visible) continue;
        const slot = (() => {
          if (argument.band) {
            const bandStart = argument.band.position(point.pointIndex);
            return bandStart === null ? null : groupedBandSlot(
              argument.band, bandStart, slotIndex, slotKeys.length,
              request.argumentAxis?.groupPadding ?? 0.08, descriptor.maximumBarWidth,
            );
          }
          const center = argument.point(point.argument, point.pointIndex);
          const available = continuousBandwidth * (1 - (request.argumentAxis?.groupPadding ?? 0.08));
          const rawWidth = available / Math.max(1, slotKeys.length);
          const width = Math.min(rawWidth, descriptor.maximumBarWidth ?? Number.POSITIVE_INFINITY);
          return Object.freeze({
            start: center - available / 2 + slotIndex * rawWidth + (rawWidth - width) / 2,
            width,
          });
        })();
        if (!slot) continue;
        const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
        const startValue = stack?.start ?? exactFromNumeric(0);
        const endValue = stack?.end ?? point.exactValue;
        const start = scale.project(startValue);
        const end = scale.project(endValue);
        const bounds: ChartRectangle = request.orientation === 'vertical'
          ? { x: slot.start, y: Math.min(start, end), width: slot.width, height: Math.max(1, Math.abs(end - start)) }
          : { x: Math.min(start, end), y: slot.start, width: Math.max(1, Math.abs(end - start)), height: slot.width };
        const positive = endValue.coefficient >= startValue.coefficient;
        const leading = request.orientation === 'vertical' ? (positive ? 'top' : 'bottom')
          : request.rtl ? (positive ? 'start' : 'end') : (positive ? 'end' : 'start');
        const shape: ChartBarShape = Object.freeze({
          kind: 'bar', seriesName: series.name, point, color: point.color ?? series.color,
          opacity: point.opacity ?? series.opacity, path: roundedRectPath(bounds.x, bounds.y, bounds.width, bounds.height, descriptor.cornerRadius ?? 2, leading),
          bounds: Object.freeze(bounds), zeroSizedStack: stack?.zeroSized ?? false,
          ...(point.className ?? descriptor.className ? { className: point.className ?? descriptor.className } : {}),
        });
        shapes.push(shape);
        if (!shape.zeroSizedStack && !point.synthetic) hits.push(Object.freeze({ point, bounds: shape.bounds }));
        if (point.showLabel && point.labelText) {
          const inside = (request.pointLabels?.position ?? 'outside') !== 'outside' && (request.orientation === 'vertical' ? bounds.height : bounds.width) > 24;
          const x = request.orientation === 'vertical' ? bounds.x + bounds.width / 2 : inside ? bounds.x + bounds.width / 2 : bounds.x + bounds.width + 6;
          const y = request.orientation === 'vertical' ? inside ? bounds.y + bounds.height / 2 + 4 : bounds.y - 5 : bounds.y + bounds.height / 2 + 4;
          addLabel(labels, occupied, point.labelText, x, y, request.pointLabels);
        }
      }
      continue;
    }

    if (descriptor.type === 'line' || descriptor.type === 'area') {
      for (const run of lineRuns(series)) {
        const endPoints: SvgPoint[] = run.map((point) => {
          const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
          const value = stack?.end ?? point.exactValue!;
          const argumentPosition = argument.point(point.argument, point.pointIndex);
          const valuePosition = scale.project(value);
          return request.orientation === 'vertical'
            ? { x: argumentPosition, y: valuePosition }
            : { x: valuePosition, y: argumentPosition };
        });
        if (descriptor.type === 'area' && endPoints.length) {
          const startPoints = [...run].reverse().map((point) => {
            const stack = stacks.get(stackPositionKey(series.name, point.pointIndex));
            const baseline = stack?.start ?? exactFromNumeric(0);
            const argumentPosition = argument.point(point.argument, point.pointIndex);
            const valuePosition = scale.project(baseline);
            return request.orientation === 'vertical'
              ? { x: argumentPosition, y: valuePosition }
              : { x: valuePosition, y: argumentPosition };
          });
          shapes.push(Object.freeze({
            kind: 'path', seriesName: series.name, color: series.color,
            opacity: descriptor.areaOpacity ?? 0.25, path: straightPath([...endPoints, ...startPoints], true),
            fill: true, lineWidth: 0, dashStyle: 'solid', ...(descriptor.className ? { className: descriptor.className } : {}),
          }));
        }
        if (endPoints.length > 1) shapes.push(Object.freeze({
          kind: 'path', seriesName: series.name, color: series.color, opacity: series.opacity,
          path: descriptor.lineStyle === 'monotone' ? monotonePath(endPoints, request.orientation === 'vertical' ? 'x' : 'y') : straightPath(endPoints),
          fill: false, lineWidth: descriptor.lineWidth ?? 2, dashStyle: dashStyle(series),
          ...(descriptor.className ? { className: descriptor.className } : {}),
        }));
        run.forEach((point, index) => {
          const coordinate = endPoints[index]!;
          const symbol = point.markerSymbol ?? series.markerSymbol;
          const markerSize = point.markerSize ?? descriptor.markerSize ?? 7;
          if ((descriptor.showMarkers ?? true) && symbol !== 'none') shapes.push(Object.freeze({
            kind: 'point', seriesName: series.name, point, color: point.color ?? series.color,
            opacity: point.opacity ?? series.opacity, x: coordinate.x, y: coordinate.y,
            markerSymbol: symbol, markerSize,
            ...(point.className ?? descriptor.className ? { className: point.className ?? descriptor.className } : {}),
          }));
          if (!point.synthetic) hits.push(Object.freeze({ point, x: coordinate.x, y: coordinate.y, radius: Math.max(10, markerSize) }));
          if (point.showLabel && point.labelText) addLabel(labels, occupied, point.labelText, coordinate.x, coordinate.y - 10, request.pointLabels);
        });
      }
    }
  }
  return { shapes: Object.freeze(shapes), labels: Object.freeze(labels), hitTargets: Object.freeze(hits), valueAxes: Object.freeze(axisLayouts) };
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
  const centerX = plot.x + plot.width / 2;
  const centerY = plot.y + plot.height / 2;
  const radius = Math.max(1, Math.min(plot.width, plot.height) * 0.38);
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
    const path = arcPath(centerX, centerY, radius, inner, angle, end);
    const percentage = request.formatter.formatPercentage(ratio);
    const shape: ChartArcShape = Object.freeze({
      kind: 'arc', seriesName: series.name, point, color: point.color ?? `var(--cg-chart-series-${point.pointIndex % 10 + 1})`,
      opacity: point.opacity ?? series.opacity, path, percentage,
      midX: centerX + Math.cos(mid) * (inner + (radius - inner) / 2),
      midY: centerY + Math.sin(mid) * (inner + (radius - inner) / 2),
      ...(point.className ? { className: point.className } : {}),
    });
    shapes.push(shape);
    hits.push(Object.freeze({ point, path, percentage }));
    const showSmall = descriptor.smallSlicePolicy === 'show' || ratio >= (descriptor.smallSliceThreshold ?? 0.02);
    const labelText = descriptor.showPercentages ? percentage : point.labelText;
    if (point.showLabel && labelText && showSmall) {
      const labelRadius = radius + 18;
      const x = centerX + Math.cos(mid) * labelRadius;
      const y = centerY + Math.sin(mid) * labelRadius;
      addLabel(labels, occupied, labelText, x, y, request.pointLabels, request.pointLabels?.showConnectors === false ? undefined : {
        x1: centerX + Math.cos(mid) * radius,
        y1: centerY + Math.sin(mid) * radius,
        x2: x,
        y2: y - 4,
      });
    }
    angle = end;
  }
  return { shapes: Object.freeze(shapes), labels: Object.freeze(labels), hitTargets: Object.freeze(hits) };
}

function constantLineLayouts<TItem>(
  request: ChartLayoutRequest<TItem>,
  plot: ChartRectangle,
  argument: ArgumentProjection,
  domains: ReadonlyMap<string, NumericDomain>,
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
      if (domain) {
        const value = exactFromNumeric(line.value);
        if (exactCompare(value, domain.minimum) >= 0 && exactCompare(value, domain.maximum) <= 0) {
          const scale = createNumericScale(
            domain.minimum, domain.maximum,
            request.orientation === 'vertical' ? plot.y + plot.height : plot.x,
            request.orientation === 'vertical' ? plot.y : plot.x + plot.width,
            request.orientation === 'horizontal' && request.rtl,
          );
          position = scale.project(value);
        }
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
  domains: ReadonlyMap<string, NumericDomain>,
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
      const domain = domains.get(annotation.valueAxisName ?? 'primary');
      if (!domain) return [];
      const scale = createNumericScale(
        domain.minimum, domain.maximum,
        request.orientation === 'vertical' ? plot.y + plot.height : plot.x,
        request.orientation === 'vertical' ? plot.y : plot.x + plot.width,
        request.orientation === 'horizontal' && request.rtl,
      );
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

export function buildChartLayout<TItem>(request: ChartLayoutRequest<TItem>): ChartLayout {
  const { width, height } = request;
  if (width < 160 || height < 120) return emptyLayout(width, height, true, request.model.isEmpty);
  if (request.model.isEmpty) return emptyLayout(width, height, false, true);
  const stacks = buildStackPositions(request.model.visibleSeries);
  const domains = request.model.kind === 'cartesian' ? valueDomains(request, stacks) : new Map<string, NumericDomain>();
  const plot = chartPlot(request, domains);
  const argument = buildArgumentProjection(request, plot);
  const geometry = request.model.kind === 'pie'
    ? { ...buildPie(request, plot), valueAxes: Object.freeze([]) }
    : buildCartesian(request, plot, argument, domains, stacks);
  return Object.freeze({
    width, height, tooSmall: false, isEmpty: false, plot,
    argumentTicks: request.model.kind === 'pie' ? Object.freeze([]) : argument.ticks,
    argumentLabelPlan: request.model.kind === 'pie'
      ? Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 })
      : argument.plan,
    valueAxes: geometry.valueAxes,
    shapes: geometry.shapes,
    labels: geometry.labels,
    constantLines: request.model.kind === 'pie' ? Object.freeze([]) : constantLineLayouts(request, plot, argument, domains),
    annotations: annotationLayouts(request, plot, argument, domains),
    hitTargets: geometry.hitTargets,
  });
}
