import type {
  CgChartAppearance,
  CgChartArgumentAxisDescriptor,
  CgChartAxisCrossing,
  CgChartConstantLineDescriptor,
  CgChartPointCustomization,
  CgChartProps,
  CgChartSeriesDescriptor,
  CgChartStrokeStyle,
  CgChartTextStyle,
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

const DASH_STYLES = ['solid', 'dash', 'dot', 'dashDot', 'squareDot', 'dashDotDot', 'longDash', 'longDashDot', 'longDashDotDot'];
const MARKER_SYMBOLS = ['auto', 'none', 'circle', 'square', 'diamond', 'triangle', 'triangleDown', 'cross'];
const LABEL_POSITIONS = ['outside', 'inside', 'center', 'insideEnd', 'insideBase', 'outsideEnd', 'above', 'below', 'left', 'right', 'bestFit'];
const TICK_MARKS = ['none', 'outside', 'inside', 'cross'];

function positiveInteger(value: number | undefined, name: string): void {
  if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) fail(`${name} must be a positive safe integer.`);
}

function between(value: number | undefined, minimum: number, maximum: number, name: string): void {
  if (value !== undefined && (!Number.isFinite(value) || value < minimum || value > maximum)) {
    fail(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function validateStroke(stroke: CgChartStrokeStyle | 'none' | undefined, name: string): void {
  if (stroke === undefined || stroke === 'none') return;
  nonEmpty(stroke.color, `${name} color`);
  finite(stroke.width, `${name} width`, 0);
  oneOf(stroke.dashStyle, DASH_STYLES, `${name} dashStyle`);
}

function validateText(style: CgChartTextStyle | undefined, name: string): void {
  if (!style) return;
  finite(style.fontSize, `${name} fontSize`, Number.EPSILON);
  nonEmpty(style.color, `${name} color`);
  nonEmpty(style.fontFamily, `${name} fontFamily`);
}

function validateCrossing(value: CgChartAxisCrossing | undefined, name: string): void {
  if (value === undefined || value === 'auto' || value === 'minimum' || value === 'maximum') return;
  try { exactFromNumeric(value); } catch { fail(`${name} must be auto, minimum, maximum, or a number.`); }
}

function validateAxisStyle(axis: CgChartArgumentAxisDescriptor | CgChartValueAxisDescriptor, name: string): void {
  validateStroke(axis.majorGridLineStyle, `${name} majorGridLineStyle`);
  validateStroke(axis.minorGridLineStyle, `${name} minorGridLineStyle`);
  validateStroke(axis.axisLineStyle, `${name} axisLineStyle`);
  oneOf(axis.majorTickMarks, TICK_MARKS, `${name} majorTickMarks`);
  oneOf(axis.minorTickMarks, TICK_MARKS, `${name} minorTickMarks`);
  oneOf(axis.labelPosition, ['nextToAxis', 'low', 'high', 'none'], `${name} labelPosition`);
  validateText(axis.labelStyle, `${name} labelStyle`);
  validateText(axis.titleStyle, `${name} titleStyle`);
  if (axis.minorTickInterval !== undefined && exactFromNumeric(axis.minorTickInterval).coefficient <= 0n) {
    fail(`${name} minorTickInterval must be positive.`);
  }
  axis.ticks?.forEach((tick) => {
    exactFromNumeric(tick.value);
    if (typeof tick.text !== 'string') fail(`${name} tick text must be a string.`);
  });
}

function validateAppearance(appearance: CgChartAppearance | undefined): void {
  if (!appearance) return;
  nonEmpty(appearance.fontFamily, 'appearance fontFamily');
  nonEmpty(appearance.selectionColor, 'appearance selectionColor');
  validateStroke(appearance.chartArea?.border, 'appearance chartArea border');
  validateStroke(appearance.plotArea?.border, 'appearance plotArea border');
  nonEmpty(appearance.chartArea?.fill, 'appearance chartArea fill');
  nonEmpty(appearance.plotArea?.fill, 'appearance plotArea fill');
  finite(appearance.chartArea?.cornerRadius, 'appearance chartArea cornerRadius', 0);
  finite(appearance.chartArea?.padding, 'appearance chartArea padding', 0);
  const layout = appearance.plotArea?.layout;
  if (layout) {
    for (const key of ['x', 'y', 'width', 'height'] as const) fraction(layout[key], `appearance plotArea layout ${key}`);
    if (layout.width <= 0 || layout.height <= 0) fail('appearance plotArea layout needs a positive width and height.');
    oneOf(layout.target, ['inner', 'outer'], 'appearance plotArea layout target');
  }
  validateText(appearance.title, 'appearance title');
  positiveInteger(appearance.title?.maxLines, 'appearance title maxLines');
  validateText(appearance.axisLabels, 'appearance axisLabels');
  validateText(appearance.axisTitles, 'appearance axisTitles');
  validateText(appearance.legend, 'appearance legend');
  validateText(appearance.pointLabels, 'appearance pointLabels');
}

function validateConstantLine(line: CgChartConstantLineDescriptor): void {
  finite(line.width, 'constant-line width', Number.EPSILON);
  nonEmpty(line.label, 'constant-line label');
  nonEmpty(line.color, 'constant-line color');
  oneOf(line.axis, ['argument', 'value'], 'constant-line axis');
  oneOf(line.dashStyle, DASH_STYLES, 'constant-line dashStyle');
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
  oneOf(axis.categoryPlacement, ['betweenTicks', 'onTicks'], 'argument-axis categoryPlacement');
  positiveInteger(axis.labelInterval, 'argument-axis labelInterval');
  positiveInteger(axis.tickMarkInterval, 'argument-axis tickMarkInterval');
  validateCrossing(axis.valueAxisCrossesAt, 'argument-axis valueAxisCrossesAt');
  validateAxisStyle(axis, 'argument-axis');
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
    between(axis.barGapWidth, 0, 500, `value axis "${name}" barGapWidth`);
    between(axis.barOverlap, -100, 100, `value axis "${name}" barOverlap`);
    validateCrossing(axis.argumentAxisCrossesAt, `value axis "${name}" argumentAxisCrossesAt`);
    validateAxisStyle(axis, `value axis "${name}"`);
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
  let scatterCount = 0;
  const stackModes = new Map<string, string>();
  const stackFamilies = new Map<string, 'bar' | 'area'>();

  for (const descriptor of series) {
    oneOf(descriptor.type, ['bar', 'line', 'area', 'pie', 'donut', 'scatter'], 'series type');
    oneOf(descriptor.pointLabelPosition, LABEL_POSITIONS, `series "${descriptor.name}" pointLabelPosition`);
    descriptor.pointLabelContent?.forEach((part) => oneOf(part, ['seriesName', 'argument', 'value', 'percentage'], `series "${descriptor.name}" pointLabelContent`));
    validateText(descriptor.pointLabelStyle, `series "${descriptor.name}" pointLabelStyle`);
    if ('outlineColor' in descriptor) nonEmpty(descriptor.outlineColor, `series "${descriptor.name}" outlineColor`);
    if ('outlineWidth' in descriptor) finite(descriptor.outlineWidth, `series "${descriptor.name}" outlineWidth`, 0);
    if ('fillColor' in descriptor) nonEmpty(descriptor.fillColor, `series "${descriptor.name}" fillColor`);
    if ('lineColor' in descriptor) nonEmpty(descriptor.lineColor, `series "${descriptor.name}" lineColor`);
    if ('markerOutlineWidth' in descriptor) finite(descriptor.markerOutlineWidth, `series "${descriptor.name}" markerOutlineWidth`, 0);
    if (descriptor.type === 'scatter') scatterCount++;
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
      finite(descriptor.explosion, `series "${descriptor.name}" explosion`, 0);
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
    if (descriptor.type === 'bar') oneOf(descriptor.outlineDashStyle, DASH_STYLES, `series "${descriptor.name}" outlineDashStyle`);
    if (descriptor.type === 'line' || descriptor.type === 'area' || descriptor.type === 'scatter') {
      oneOf(descriptor.lineStyle, descriptor.type === 'scatter' ? ['straight', 'smooth'] : ['straight', 'monotone', 'smooth'], `series "${descriptor.name}" lineStyle`);
      oneOf(descriptor.dashStyle, DASH_STYLES, `series "${descriptor.name}" dashStyle`);
      oneOf(descriptor.markerSymbol, MARKER_SYMBOLS, `series "${descriptor.name}" markerSymbol`);
      finite(descriptor.lineWidth, `series "${descriptor.name}" lineWidth`, Number.EPSILON);
      finite(descriptor.markerSize, `series "${descriptor.name}" markerSize`, Number.EPSILON);
      nonEmpty(descriptor.markerFillColor, `series "${descriptor.name}" markerFillColor`);
      nonEmpty(descriptor.markerOutlineColor, `series "${descriptor.name}" markerOutlineColor`);
      if (descriptor.type === 'area') fraction(descriptor.areaOpacity, `series "${descriptor.name}" areaOpacity`);
    }
  }

  if (scatterCount > 0 && scatterCount !== series.length) fail('cannot mix scatter series with other series types.');
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
  if (props.series.some((descriptor) => descriptor.type === 'scatter')
    && props.argumentAxis?.valueType !== undefined && props.argumentAxis.valueType !== 'auto' && props.argumentAxis.valueType !== 'numeric') {
    fail('scatter series need a numeric argument axis.');
  }
  validateAppearance(props.appearance);
  oneOf(props.legend?.position, ['none', 'top', 'bottom', 'start', 'end', 'topEnd'], 'legend position');
  oneOf(props.legend?.orientation, ['auto', 'horizontal', 'vertical'], 'legend orientation');
  oneOf(props.legend?.mode, ['static', 'toggle'], 'legend mode');
  oneOf(props.pointLabels?.position, LABEL_POSITIONS, 'point-label position');
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
  finite(customization.outlineWidth, `customization for ${seriesName}[${pointIndex}] outlineWidth`, 0);
  finite(customization.explosion, `customization for ${seriesName}[${pointIndex}] explosion`, 0);
  nonEmpty(customization.outlineColor, `customization for ${seriesName}[${pointIndex}] outlineColor`);
  nonEmpty(customization.color, `customization for ${seriesName}[${pointIndex}] color`);
  nonEmpty(customization.className, `customization for ${seriesName}[${pointIndex}] className`);
  return Object.freeze({ ...customization });
}
