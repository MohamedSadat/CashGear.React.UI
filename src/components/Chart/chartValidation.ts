import type {
  CgChartArgumentAxisDescriptor,
  CgChartConstantLineDescriptor,
  CgChartPointCustomization,
  CgChartProps,
  CgChartSeriesDescriptor,
  CgChartValueAxisDescriptor,
} from './CgChart.types';
import { compareArguments, exactCompare, exactFromNumeric, normalizeArgument } from './chartValues';

export class CgChartConfigurationError extends Error {
  constructor(message: string) {
    super(`CgChart ${message}`);
    this.name = 'CgChartConfigurationError';
  }
}

function fail(message: string): never {
  throw new CgChartConfigurationError(message);
}

function finite(value: number | undefined, name: string, minimum?: number): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || minimum !== undefined && value < minimum) {
    fail(`${name} must be finite${minimum === undefined ? '' : ` and at least ${minimum}`}.`);
  }
}

function fraction(value: number | undefined, name: string, includeOne = true): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || (includeOne ? value > 1 : value >= 1)) {
    fail(`${name} must be between 0 and ${includeOne ? '1' : 'less than 1'}.`);
  }
}

function nonEmpty(value: string | undefined, name: string): void {
  if (value !== undefined && value.trim().length === 0) fail(`${name} cannot be empty.`);
}

function oneOf(value: string | undefined, allowed: ReadonlyArray<string>, name: string): void {
  if (value !== undefined && !allowed.includes(value)) fail(`${name} must be one of ${allowed.join(', ')}.`);
}

function numberOptions(options: Readonly<Intl.NumberFormatOptions> | undefined, locale: string, name: string): void {
  if (!options) return;
  try { new Intl.NumberFormat(locale, { ...options }).format(0); } catch { fail(`${name} contains invalid number format options.`); }
}

function dateOptions(options: Readonly<Intl.DateTimeFormatOptions> | undefined, locale: string, name: string): void {
  if (!options) return;
  try { new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(0)); } catch { fail(`${name} contains invalid date-time format options.`); }
}

function validateConstantLine(line: CgChartConstantLineDescriptor): void {
  finite(line.width, 'constant-line width', Number.EPSILON);
  nonEmpty(line.label, 'constant-line label');
  nonEmpty(line.color, 'constant-line color');
  oneOf(line.axis, ['argument', 'value'], 'constant-line axis');
  oneOf(line.dashStyle, ['solid', 'dash', 'dot', 'dashDot'], 'constant-line dashStyle');
  oneOf(line.labelPosition, ['start', 'center', 'end'], 'constant-line labelPosition');
  if (line.axis === 'argument') return;
  exactFromNumeric(line.value);
  nonEmpty(line.axisName, 'constant-line axisName');
}

function validateArgumentAxis(axis: CgChartArgumentAxisDescriptor | undefined, locale: string): void {
  if (!axis) return;
  oneOf(axis.valueType, ['auto', 'category', 'numeric', 'date'], 'argument-axis valueType');
  oneOf(axis.labelOverlapMode, ['auto', 'none', 'hide', 'rotate', 'stagger', 'shorten'], 'argument-axis labelOverlapMode');
  oneOf(axis.categorySort, ['dataOrder', 'ascending', 'descending'], 'argument-axis categorySort');
  numberOptions(axis.numberFormatOptions, locale, 'argument axis');
  dateOptions(axis.dateTimeFormatOptions, locale, 'argument axis');
  finite(axis.labelRotationAngle, 'argument-axis labelRotationAngle');
  if (axis.maximumLabelCharacters !== undefined && (!Number.isSafeInteger(axis.maximumLabelCharacters) || axis.maximumLabelCharacters <= 0)) {
    fail('argument-axis maximumLabelCharacters must be a positive safe integer.');
  }
  for (const [value, name] of [
    [axis.categoryInnerPadding, 'categoryInnerPadding'],
    [axis.categoryOuterPadding, 'categoryOuterPadding'],
    [axis.groupPadding, 'groupPadding'],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value >= 1)) {
      fail(`argument-axis ${name} must be at least 0 and below 1.`);
    }
  }
  const minimum = axis.minimum === undefined ? undefined : normalizeArgument(axis.minimum, axis.valueType ?? 'auto');
  const maximum = axis.maximum === undefined ? undefined : normalizeArgument(axis.maximum, axis.valueType ?? 'auto');
  if (minimum?.kind === 'category' || maximum?.kind === 'category') fail('category argument axes cannot define minimum or maximum.');
  if (minimum && maximum && (
    minimum.kind !== maximum.kind
    || minimum.temporalKind !== maximum.temporalKind
    || compareArguments(minimum, maximum) >= 0
  )) fail('argument-axis minimum and maximum must use one representation with minimum below maximum.');
  if (axis.tickInterval !== undefined) {
    const interval = exactFromNumeric(axis.tickInterval);
    if (interval.coefficient <= 0n) fail('argument-axis tickInterval must be positive.');
    if (axis.valueType === 'category') fail('category argument axes cannot define tickInterval.');
    if (axis.valueType === 'date' && interval.scale !== 0) fail('date argument-axis tickInterval must be a whole number of milliseconds.');
  }
  axis.constantLines?.forEach(validateConstantLine);
}

function validateValueAxes(axes: ReadonlyArray<CgChartValueAxisDescriptor> | undefined, locale: string): Set<string> {
  const names = new Set<string>();
  const resolved = axes?.length ? axes : [{ name: 'primary' }];
  for (const axis of resolved) {
    const name = axis.name ?? 'primary';
    if (!name.trim()) fail('value-axis names cannot be empty.');
    if (names.has(name)) fail(`value-axis name "${name}" is duplicated.`);
    names.add(name);
    oneOf(axis.position, ['auto', 'start', 'end'], `value axis "${name}" position`);
    numberOptions(axis.numberFormatOptions, locale, `value axis "${name}"`);
    const minimum = axis.minimum === undefined ? undefined : exactFromNumeric(axis.minimum);
    const maximum = axis.maximum === undefined ? undefined : exactFromNumeric(axis.maximum);
    if (minimum && maximum && exactCompare(minimum, maximum) >= 0) {
      fail(`value axis "${name}" must have minimum below maximum.`);
    }
    if (axis.tickInterval !== undefined && exactFromNumeric(axis.tickInterval).coefficient <= 0n) {
      fail(`value axis "${name}" must have a positive tickInterval.`);
    }
    axis.constantLines?.forEach(validateConstantLine);
  }
  return names;
}

function validateSeries<TItem>(
  series: ReadonlyArray<CgChartSeriesDescriptor<TItem>>,
  axes: ReadonlySet<string>,
  locale: string,
): void {
  const names = new Set<string>();
  let pieCount = 0;
  let cartesianCount = 0;
  const stackModes = new Map<string, string>();
  const stackFamilies = new Map<string, 'bar' | 'area'>();

  for (const descriptor of series) {
    oneOf(descriptor.type, ['bar', 'line', 'area', 'pie', 'donut'], 'series type');
    if (!descriptor.name.trim()) fail('every series needs a nonempty name.');
    if (names.has(descriptor.name)) fail(`series name "${descriptor.name}" is duplicated.`);
    names.add(descriptor.name);
    fraction(descriptor.opacity, `series "${descriptor.name}" opacity`);
    nonEmpty(descriptor.color, `series "${descriptor.name}" color`);
    nonEmpty(descriptor.className, `series "${descriptor.name}" className`);
    oneOf(descriptor.missingValueMode, ['gap', 'zero', 'skip'], `series "${descriptor.name}" missingValueMode`);
    numberOptions(descriptor.valueFormatOptions, locale, `series "${descriptor.name}"`);

    if (descriptor.type === 'pie' || descriptor.type === 'donut') {
      pieCount++;
      fraction(descriptor.innerRadiusRatio, `series "${descriptor.name}" innerRadiusRatio`, false);
      fraction(descriptor.smallSliceThreshold, `series "${descriptor.name}" smallSliceThreshold`);
      finite(descriptor.startAngleDegrees, `series "${descriptor.name}" startAngleDegrees`);
      oneOf(descriptor.smallSlicePolicy, ['show', 'hideLabel'], `series "${descriptor.name}" smallSlicePolicy`);
    } else {
      cartesianCount++;
      const axisName = descriptor.valueAxisName ?? 'primary';
      if (!axes.has(axisName)) {
        fail(`series "${descriptor.name}" references unknown value axis "${axisName}"; declared axes: ${[...axes].join(', ')}.`);
      }
    }

    if (descriptor.type === 'bar' || descriptor.type === 'area') {
      const stacking = descriptor.stacking ?? 'none';
      oneOf(stacking, ['none', 'stacked', 'fullStacked'], `series "${descriptor.name}" stacking`);
      if (stacking !== 'none' && !descriptor.stackName?.trim()) {
        fail(`series "${descriptor.name}" needs a nonempty stackName when stacking is enabled.`);
      }
      if (stacking !== 'none') {
        const key = `${descriptor.valueAxisName ?? 'primary'}\u0000${descriptor.stackName}`;
        const previous = stackModes.get(key);
        if (previous && previous !== stacking) fail(`stack "${descriptor.stackName}" mixes stacked and fullStacked modes.`);
        const family = stackFamilies.get(key);
        if (family && family !== descriptor.type) fail(`stack "${descriptor.stackName}" cannot mix bar and area series.`);
        stackModes.set(key, stacking);
        stackFamilies.set(key, descriptor.type);
      }
    }

    if (descriptor.type === 'bar') {
      finite(descriptor.maximumBarWidth, `series "${descriptor.name}" maximumBarWidth`, 1);
      finite(descriptor.cornerRadius, `series "${descriptor.name}" cornerRadius`, 0);
    }
    if (descriptor.type === 'line' || descriptor.type === 'area') {
      oneOf(descriptor.lineStyle, ['straight', 'monotone'], `series "${descriptor.name}" lineStyle`);
      oneOf(descriptor.dashStyle, ['solid', 'dash', 'dot', 'dashDot'], `series "${descriptor.name}" dashStyle`);
      oneOf(descriptor.markerSymbol, ['auto', 'none', 'circle', 'square', 'diamond', 'triangle', 'triangleDown', 'cross'], `series "${descriptor.name}" markerSymbol`);
      finite(descriptor.lineWidth, `series "${descriptor.name}" lineWidth`, Number.EPSILON);
      finite(descriptor.markerSize, `series "${descriptor.name}" markerSize`, Number.EPSILON);
      if (descriptor.type === 'area') fraction(descriptor.areaOpacity, `series "${descriptor.name}" areaOpacity`);
    }
  }

  if (pieCount > 0 && cartesianCount > 0) fail('cannot mix pie or donut series with Cartesian series.');
  if (pieCount > 1) fail('supports one pie or donut series per chart; use separate charts for separate compositions.');
}

export interface ValidatedChartConfiguration {
  readonly valueAxisNames: ReadonlySet<string>;
}

export function validateChartConfiguration<TItem>(props: CgChartProps<TItem>): ValidatedChartConfiguration {
  const locale = props.locale ?? 'en-US';
  const displayTimeZone = props.displayTimeZone ?? 'UTC';
  try { new Intl.NumberFormat(locale).format(0); } catch { fail('locale must be a supported Intl locale.'); }
  try { new Intl.DateTimeFormat(locale, { timeZone: displayTimeZone }).format(new Date(0)); } catch { fail('displayTimeZone must be a supported IANA time zone.'); }
  oneOf(props.orientation, ['vertical', 'horizontal'], 'orientation');
  oneOf(props.selectionMode, ['none', 'single', 'multiple'], 'selectionMode');
  oneOf(props.dataTableMode, ['hidden', 'visuallyHidden', 'collapsed', 'visible'], 'dataTableMode');
  oneOf(props.animation, ['none', 'onLoad'], 'animation');
  oneOf(props.direction, ['auto', 'ltr', 'rtl'], 'direction');
  if (typeof props.width === 'number' && (!Number.isFinite(props.width) || props.width <= 0)) fail('numeric width must be finite and above zero.');
  if (typeof props.height === 'number' && (!Number.isFinite(props.height) || props.height <= 0)) fail('numeric height must be finite and above zero.');
  const fallbackWidth = props.fallbackWidth ?? 640;
  const fallbackHeight = props.fallbackHeight ?? 320;
  if (!Number.isSafeInteger(fallbackWidth) || fallbackWidth <= 0 || !Number.isSafeInteger(fallbackHeight) || fallbackHeight <= 0) {
    fail('fallbackWidth and fallbackHeight must be positive safe integers.');
  }
  if (props.aspectRatio !== undefined && (!Number.isFinite(props.aspectRatio) || props.aspectRatio <= 0)) {
    fail('aspectRatio must be finite and above zero.');
  }
  const maximum = props.maxPointsPerSeries ?? 5_000;
  if (!Number.isSafeInteger(maximum) || maximum <= 0) fail('maxPointsPerSeries must be a positive safe integer.');
  if (props.palette) {
    props.palette.forEach((color, index) => {
      if (!color.trim()) fail(`palette entry ${index} cannot be empty.`);
    });
  }
  validateArgumentAxis(props.argumentAxis, locale);
  const axes = validateValueAxes(props.valueAxes, locale);
  props.valueAxes?.forEach((axis) => axis.constantLines?.forEach((line) => {
    if (line.axis === 'argument') normalizeArgument(line.value, props.argumentAxis?.valueType ?? 'auto');
    else if (!axes.has(line.axisName ?? axis.name ?? 'primary')) fail(`constant line references an unknown value axis.`);
  }));
  validateSeries(props.series, axes, locale);
  oneOf(props.legend?.position, ['none', 'top', 'bottom', 'start', 'end'], 'legend position');
  oneOf(props.legend?.orientation, ['auto', 'horizontal', 'vertical'], 'legend orientation');
  oneOf(props.legend?.mode, ['static', 'toggle'], 'legend mode');
  oneOf(props.pointLabels?.position, ['outside', 'inside', 'center'], 'point-label position');
  numberOptions(props.tooltip?.numberFormatOptions, locale, 'tooltip');
  numberOptions(props.pointLabels?.numberFormatOptions, locale, 'point labels');
  props.constantLines?.forEach((line) => {
    validateConstantLine(line);
    if (line.axis === 'argument') normalizeArgument(line.value, props.argumentAxis?.valueType ?? 'auto');
    else if (!axes.has(line.axisName ?? 'primary')) fail(`constant line references unknown value axis "${line.axisName}".`);
  });
  props.annotations?.forEach((annotation) => {
    if (!annotation.text.trim()) fail('annotations need nonempty text.');
    finite(annotation.offsetX, 'annotation offsetX');
    finite(annotation.offsetY, 'annotation offsetY');
    nonEmpty(annotation.className, 'annotation className');
    if (annotation.argument !== undefined) normalizeArgument(annotation.argument, props.argumentAxis?.valueType ?? 'auto');
    if (annotation.value !== undefined) exactFromNumeric(annotation.value);
    if (annotation.valueAxisName !== undefined && !axes.has(annotation.valueAxisName)) {
      fail(`annotation references unknown value axis "${annotation.valueAxisName}".`);
    }
  });
  return Object.freeze({ valueAxisNames: axes });
}

export function validateCustomization(
  customization: CgChartPointCustomization | null | undefined,
  seriesName: string,
  pointIndex: number,
): CgChartPointCustomization | null {
  if (!customization) return null;
  fraction(customization.opacity, `customization for ${seriesName}[${pointIndex}] opacity`);
  finite(customization.markerSize, `customization for ${seriesName}[${pointIndex}] markerSize`, Number.EPSILON);
  nonEmpty(customization.color, `customization for ${seriesName}[${pointIndex}] color`);
  nonEmpty(customization.className, `customization for ${seriesName}[${pointIndex}] className`);
  return Object.freeze({ ...customization });
}
