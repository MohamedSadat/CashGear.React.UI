import type {
  CgChartArgumentValue,
  CgChartDashStyle,
  CgChartMarkerSymbol,
  CgChartPointCustomization,
  CgChartPointCustomizationContext,
  CgChartPointRef,
  CgChartProps,
  CgChartSeriesDescriptor,
  CgChartValue,
} from './CgChart.types';
import type { ChartFormatter } from './chartFormatting';
import {
  compareArguments,
  exactFromNumeric,
  normalizeArgument,
} from './chartValues';
import type { ExactValue, NormalizedArgument, TemporalKind } from './chartValues';
import { CgChartConfigurationError, validateCustomization } from './chartValidation';

const DEFAULT_COLORS = Array.from({ length: 10 }, (_, index) => `var(--cg-chart-series-${index + 1})`);
const MARKERS: ReadonlyArray<Exclude<CgChartMarkerSymbol, 'auto' | 'none'>> = [
  'circle', 'square', 'diamond', 'triangle', 'triangleDown', 'cross',
];
const DASHES: ReadonlyArray<CgChartDashStyle> = ['solid', 'dash', 'dot', 'dashDot'];

export interface ChartPoint<TItem> {
  readonly seriesName: string;
  readonly pointIndex: number;
  readonly sourceIndex: number;
  readonly argument: NormalizedArgument;
  readonly originalArgument: CgChartArgumentValue;
  readonly originalValue: CgChartValue;
  readonly exactValue: ExactValue | null;
  readonly substitutedZero: boolean;
  readonly formattedArgument: string;
  readonly formattedValue: string;
  readonly formattedTooltipValue: string;
  readonly tooltipEnabled: boolean;
  readonly dataItem: TItem | null;
  readonly synthetic: boolean;
  readonly visible: boolean;
  readonly showLabel: boolean;
  readonly labelText?: string;
  readonly color?: string;
  readonly opacity?: number;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
  readonly className?: string;
}

export interface ChartSeries<TItem> {
  readonly descriptor: CgChartSeriesDescriptor<TItem>;
  readonly name: string;
  readonly declarationIndex: number;
  readonly points: ReadonlyArray<ChartPoint<TItem>>;
  readonly color: string;
  readonly opacity: number;
  readonly markerSymbol: CgChartMarkerSymbol;
  readonly dashStyle: CgChartDashStyle;
  readonly valueAxisName: string;
}

export interface ChartSourceModel<TItem> {
  readonly kind: 'cartesian' | 'pie';
  readonly argumentKind: 'category' | 'numeric' | 'date' | null;
  readonly temporalKind: TemporalKind | null;
  readonly arguments: ReadonlyArray<NormalizedArgument>;
  readonly series: ReadonlyArray<ChartSeries<TItem>>;
}

export interface VisibleChartModel<TItem> extends ChartSourceModel<TItem> {
  readonly visibleSeries: ReadonlyArray<ChartSeries<TItem>>;
  readonly visibleSeriesNames: ReadonlyArray<string>;
  readonly isEmpty: boolean;
}

interface RawPoint<TItem> {
  readonly sourceIndex: number;
  readonly argument: NormalizedArgument;
  readonly originalValue: CgChartValue;
  readonly exactValue: ExactValue | null;
  readonly substitutedZero: boolean;
  readonly dataItem: TItem;
}

interface RawSeries<TItem> {
  readonly descriptor: CgChartSeriesDescriptor<TItem>;
  readonly declarationIndex: number;
  readonly points: ReadonlyArray<RawPoint<TItem>>;
}

function freezePointRef(seriesName: string, pointIndex: number): CgChartPointRef {
  return Object.freeze({ seriesName, pointIndex });
}

function numericValue(value: CgChartValue): ExactValue | null {
  if (value === null) return null;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return exactFromNumeric(value);
}

function collectRawSeries<TItem>(
  props: CgChartProps<TItem>,
): ReadonlyArray<RawSeries<TItem>> {
  const axisType = props.argumentAxis?.valueType ?? 'auto';
  const maximum = props.maxPointsPerSeries ?? 5_000;
  return Object.freeze(props.series.map((descriptor, declarationIndex) => {
    const data = descriptor.data === undefined ? props.data ?? [] : descriptor.data ?? [];
    const points: RawPoint<TItem>[] = [];
    const seen = new Set<string>();
    for (let sourceIndex = 0; sourceIndex < data.length; sourceIndex++) {
      const dataItem = data[sourceIndex]!;
      const originalArgument = descriptor.argument(dataItem);
      const originalValue = descriptor.value(dataItem);
      if (originalArgument === null) continue;
      const argument = normalizeArgument(originalArgument, axisType);
      if (seen.has(argument.key)) continue;
      seen.add(argument.key);
      let exactValue = numericValue(originalValue);
      const substitutedZero = exactValue === null && (descriptor.missingValueMode ?? 'gap') === 'zero';
      if (substitutedZero) exactValue = Object.freeze({ coefficient: 0n, scale: 0 });
      points.push(Object.freeze({
        sourceIndex,
        argument,
        originalValue,
        exactValue,
        substitutedZero,
        dataItem,
      }));
      if (points.length > maximum) {
        throw new CgChartConfigurationError(`series "${descriptor.name}" has more than maxPointsPerSeries (${maximum}) points.`);
      }
    }
    return Object.freeze({ descriptor, declarationIndex, points: Object.freeze(points) });
  }));
}

function sharedArguments<TItem>(
  raw: ReadonlyArray<RawSeries<TItem>>,
  props: CgChartProps<TItem>,
): ReadonlyArray<NormalizedArgument> {
  if (raw.some((series) => series.descriptor.type === 'pie' || series.descriptor.type === 'donut')) {
    return Object.freeze(raw[0]?.points.map((point) => point.argument) ?? []);
  }
  const seen = new Set<string>();
  const union: NormalizedArgument[] = [];
  for (const series of raw) {
    for (const point of series.points) {
      if (seen.has(point.argument.key)) continue;
      seen.add(point.argument.key);
      union.push(point.argument);
    }
  }
  const kind = union[0]?.kind;
  if (union.some((argument) => argument.kind !== kind)) {
    throw new CgChartConfigurationError('series resolve to incompatible argument-axis kinds.');
  }
  if (kind !== 'category') union.sort(compareArguments);
  else if (props.argumentAxis?.categorySort === 'ascending') {
    union.sort((left, right) => (left.categoryText ?? '').localeCompare(right.categoryText ?? '', props.locale ?? 'en-US'));
  } else if (props.argumentAxis?.categorySort === 'descending') {
    union.sort((left, right) => (right.categoryText ?? '').localeCompare(left.categoryText ?? '', props.locale ?? 'en-US'));
  }
  return Object.freeze(union);
}

function customizePoint<TItem>(
  props: CgChartProps<TItem>,
  seriesName: string,
  pointIndex: number,
  raw: RawPoint<TItem>,
): CgChartPointCustomization | null {
  if (!props.customizePoint) return null;
  const context = Object.freeze<CgChartPointCustomizationContext<TItem>>({
    seriesName,
    pointIndex,
    argument: raw.argument.original,
    value: raw.originalValue,
    dataItem: raw.dataItem,
  });
  return validateCustomization(props.customizePoint(context), seriesName, pointIndex);
}

function buildPoint<TItem>(
  props: CgChartProps<TItem>,
  formatter: ChartFormatter,
  descriptor: CgChartSeriesDescriptor<TItem>,
  pointIndex: number,
  raw: RawPoint<TItem> | undefined,
  argument: NormalizedArgument,
): ChartPoint<TItem> {
  if (!raw) {
    const substitutedZero = (descriptor.missingValueMode ?? 'gap') === 'zero';
    const formattedValue = substitutedZero
      ? formatter.formatValue(0, descriptor.valueFormatOptions)
      : formatter.strings.noValue;
    return Object.freeze({
      seriesName: descriptor.name,
      pointIndex,
      sourceIndex: -1,
      argument,
      originalArgument: argument.original,
      originalValue: null,
      exactValue: substitutedZero ? Object.freeze({ coefficient: 0n, scale: 0 }) : null,
      substitutedZero,
      formattedArgument: formatter.formatArgument(argument, props.argumentAxis),
      formattedValue,
      formattedTooltipValue: formattedValue,
      tooltipEnabled: false,
      dataItem: null,
      synthetic: true,
      visible: substitutedZero,
      showLabel: false,
    });
  }

  const customization = customizePoint(props, descriptor.name, pointIndex, raw);
  const valueForFormatting = raw.exactValue === null
    ? null
    : raw.substitutedZero ? 0 : raw.originalValue;
  let formattedValue = formatter.strings.noValue;
  const reference = freezePointRef(descriptor.name, pointIndex);
  if (valueForFormatting !== null) {
    formattedValue = descriptor.valueFormatter
      ? descriptor.valueFormatter(valueForFormatting, raw.dataItem, pointIndex)
      : formatter.formatValue(valueForFormatting, descriptor.valueFormatOptions);
  }
  const formattedTooltipValue = valueForFormatting !== null
    && (props.tooltip?.valueFormatter || props.tooltip?.numberFormatOptions)
    ? formatter.formatTooltipValue(valueForFormatting, reference, props.tooltip)
    : formattedValue;
  const showLabel = customization?.showLabel
    ?? descriptor.showPointLabels
    ?? props.pointLabels?.visible
    ?? false;
  const labelText = customization?.labelText ?? (
    raw.exactValue && showLabel
      ? descriptor.pointLabelFormatter?.(valueForFormatting!, raw.dataItem, pointIndex)
        ?? formatter.formatPointLabel(valueForFormatting!, reference, props.pointLabels)
      : undefined
  );
  return Object.freeze({
    seriesName: descriptor.name,
    pointIndex,
    sourceIndex: raw.sourceIndex,
    argument,
    originalArgument: raw.argument.original,
    originalValue: raw.originalValue,
    exactValue: raw.exactValue,
    substitutedZero: raw.substitutedZero,
    formattedArgument: formatter.formatArgument(argument, props.argumentAxis),
    formattedValue,
    formattedTooltipValue,
    tooltipEnabled: descriptor.tooltipEnabled ?? true,
    dataItem: raw.dataItem,
    synthetic: false,
    visible: customization?.visible ?? true,
    showLabel,
    ...(labelText === undefined ? {} : { labelText }),
    ...(customization?.color === undefined ? {} : { color: customization.color }),
    ...(customization?.opacity === undefined ? {} : { opacity: customization.opacity }),
    ...(customization?.markerSymbol === undefined ? {} : { markerSymbol: customization.markerSymbol }),
    ...(customization?.markerSize === undefined ? {} : { markerSize: customization.markerSize }),
    ...(customization?.className === undefined ? {} : { className: customization.className }),
  });
}

function resolveSeries<TItem>(
  props: CgChartProps<TItem>,
  formatter: ChartFormatter,
  raw: RawSeries<TItem>,
  argumentsUnion: ReadonlyArray<NormalizedArgument>,
): ChartSeries<TItem> {
  const descriptor = raw.descriptor;
  const byKey = new Map(raw.points.map((point) => [point.argument.key, point]));
  const pointArguments = descriptor.type === 'pie' || descriptor.type === 'donut'
    ? raw.points.map((point) => point.argument)
    : argumentsUnion;
  const points = pointArguments.map((argument, pointIndex) => (
    buildPoint(props, formatter, descriptor, pointIndex, byKey.get(argument.key), argument)
  ));
  const palette = props.palette?.length ? props.palette : DEFAULT_COLORS;
  const marker = descriptor.type === 'line' || descriptor.type === 'area' ? descriptor.markerSymbol : undefined;
  const dash = descriptor.type === 'line' || descriptor.type === 'area' ? descriptor.dashStyle : undefined;
  return Object.freeze({
    descriptor,
    name: descriptor.name,
    declarationIndex: raw.declarationIndex,
    points: Object.freeze(points),
    color: descriptor.color ?? palette[raw.declarationIndex % palette.length]!,
    opacity: descriptor.opacity ?? 1,
    markerSymbol: marker && marker !== 'auto' ? marker : MARKERS[raw.declarationIndex % MARKERS.length]!,
    dashStyle: dash ?? DASHES[raw.declarationIndex % DASHES.length]!,
    valueAxisName: descriptor.valueAxisName ?? 'primary',
  });
}

export function buildChartSourceModel<TItem>(
  props: CgChartProps<TItem>,
  formatter: ChartFormatter,
): ChartSourceModel<TItem> {
  const raw = collectRawSeries(props);
  const argumentsUnion = sharedArguments(raw, props);
  const argumentKind = argumentsUnion[0]?.kind ?? null;
  if (argumentKind === 'category' && props.argumentAxis?.tickInterval !== undefined) {
    throw new CgChartConfigurationError('category argument axes cannot define tickInterval.');
  }
  const temporalKinds = new Set(argumentsUnion.map((argument) => argument.temporalKind).filter(Boolean));
  if (temporalKinds.size > 1) throw new CgChartConfigurationError('date axes cannot mix civil dates, local date-times, and instants.');
  const series = Object.freeze(raw.map((candidate) => resolveSeries(props, formatter, candidate, argumentsUnion)));
  return Object.freeze({
    kind: series.some((candidate) => candidate.descriptor.type === 'pie' || candidate.descriptor.type === 'donut') ? 'pie' : 'cartesian',
    argumentKind,
    temporalKind: temporalKinds.values().next().value ?? null,
    arguments: argumentsUnion,
    series,
  });
}

export function projectVisibleModel<TItem>(
  source: ChartSourceModel<TItem>,
  visibleSeriesNames: ReadonlySet<string>,
): VisibleChartModel<TItem> {
  const visibleSeries = Object.freeze(source.series.filter((series) => visibleSeriesNames.has(series.name)));
  const hasValue = visibleSeries.some((series) => series.points.some((point) => (
    point.exactValue !== null && point.visible && !point.synthetic
  )));
  return Object.freeze({
    ...source,
    visibleSeries,
    visibleSeriesNames: Object.freeze(visibleSeries.map((series) => series.name)),
    isEmpty: !hasValue,
  });
}

export function pointByRef<TItem>(
  model: ChartSourceModel<TItem>,
  reference: CgChartPointRef,
): ChartPoint<TItem> | null {
  return model.series.find((series) => series.name === reference.seriesName)?.points[reference.pointIndex] ?? null;
}
