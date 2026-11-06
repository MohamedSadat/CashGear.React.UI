import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  Ref,
} from 'react';
import type { CgDirection, CgDateValue } from '../../types';
import type {
  CgDecimalValue,
  CgInstantValue,
  CgLocalDateTimeValue,
} from '../RangeSelector';

export type CgChartOrientation = 'vertical' | 'horizontal';
export type CgChartSeriesKind = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter';
export type CgChartStackMode = 'none' | 'stacked' | 'fullStacked';
/** `smooth` draws a Catmull-Rom spline through every point, as spreadsheet "smoothed lines" do. */
export type CgChartLineStyle = 'straight' | 'monotone' | 'smooth';
/**
 * The first four keep their fixed dash lengths outside `appearance`. With `appearance` set, and for
 * the other styles always, dash lengths are multiples of the line width.
 */
export type CgChartDashStyle =
  | 'solid'
  | 'dash'
  | 'dot'
  | 'dashDot'
  | 'squareDot'
  | 'dashDotDot'
  | 'longDash'
  | 'longDashDot'
  | 'longDashDotDot';
export type CgChartMarkerSymbol =
  | 'auto'
  | 'none'
  | 'circle'
  | 'square'
  | 'diamond'
  | 'triangle'
  | 'triangleDown'
  | 'cross';
export type CgChartMissingValueMode = 'gap' | 'zero' | 'skip';
/** `topEnd` stacks the legend in the top end corner; outside `appearance` it behaves as `top`. */
export type CgChartLegendPosition = 'none' | 'top' | 'bottom' | 'start' | 'end' | 'topEnd';
export type CgChartLegendOrientation = 'auto' | 'horizontal' | 'vertical';
export type CgChartLegendMode = 'static' | 'toggle';
export type CgChartSelectionMode = 'none' | 'single' | 'multiple';
export type CgChartAxisValueType = 'auto' | 'category' | 'numeric' | 'date';
export type CgChartAxisPosition = 'auto' | 'start' | 'end';
export type CgChartLabelOverlapMode = 'auto' | 'none' | 'hide' | 'rotate' | 'stagger' | 'shorten';
/**
 * `outside`, `inside` and `center` keep their original meaning. The others follow spreadsheet data
 * labels: `insideEnd`, `insideBase` and `outsideEnd` for bars and pie slices, `above`, `below`,
 * `left` and `right` for line, area and scatter points, and `bestFit` for pie slices (inside when
 * the text fits, outside otherwise). `left` and `right` are physical sides.
 */
export type CgChartPointLabelPosition =
  | 'outside'
  | 'inside'
  | 'center'
  | 'insideEnd'
  | 'insideBase'
  | 'outsideEnd'
  | 'above'
  | 'below'
  | 'left'
  | 'right'
  | 'bestFit';
export type CgChartPointLabelPart = 'seriesName' | 'argument' | 'value' | 'percentage';
export type CgChartTickMarkStyle = 'none' | 'outside' | 'inside' | 'cross';
export type CgChartAxisLabelPosition = 'nextToAxis' | 'low' | 'high' | 'none';
export type CgChartCategoryPlacement = 'betweenTicks' | 'onTicks';
export type CgChartDataTableMode = 'hidden' | 'visuallyHidden' | 'collapsed' | 'visible';
export type CgChartSmallSlicePolicy = 'show' | 'hideLabel';
export type CgChartAnimationMode = 'none' | 'onLoad';
export type CgChartCategorySortMode = 'dataOrder' | 'ascending' | 'descending';
export type CgChartConstantLineAxis = 'argument' | 'value';
export type CgChartConstantLineLabelPosition = 'start' | 'center' | 'end';

export type CgChartNumericValue = number | bigint | CgDecimalValue;
export type CgChartTemporalArgument = CgDateValue | CgLocalDateTimeValue | CgInstantValue;
export type CgChartArgumentValue = string | boolean | number | bigint | CgDecimalValue | CgChartTemporalArgument;
export type CgChartValue = CgChartNumericValue | null;
/**
 * Where an axis crosses the other one. `auto` crosses at zero when zero is inside the range and at
 * the minimum otherwise. A number is a value on numeric axes and a 1-based category number on
 * category axes.
 */
export type CgChartAxisCrossing = 'auto' | 'minimum' | 'maximum' | CgChartNumericValue;

export interface CgChartPointRef {
  readonly seriesName: string;
  readonly pointIndex: number;
}

export interface CgChartPointEventDetail<TItem> extends CgChartPointRef {
  readonly argument: CgChartArgumentValue;
  readonly value: CgChartValue;
  readonly formattedArgument: string;
  readonly formattedValue: string;
  readonly dataItem: TItem;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly isSelected: boolean;
}

export interface CgChartSelectionChangeDetail {
  readonly selectedPoints: ReadonlyArray<CgChartPointRef>;
  readonly previousSelectedPoints: ReadonlyArray<CgChartPointRef>;
  readonly reason: 'activation' | 'action';
}

export interface CgChartLegendItemClickDetail {
  readonly seriesName: string;
  readonly visible: boolean;
  readonly pointIndex?: number;
}

export interface CgChartPointCustomization {
  /** Fill colour of the bar, slice or marker, and the colour of a line point. */
  readonly color?: string;
  /** Outline colour of a bar, slice or marker; `none` removes it. */
  readonly outlineColor?: string;
  readonly outlineWidth?: number;
  /** Pie and donut only: how far the slice moves out, as a fraction of the radius. */
  readonly explosion?: number;
  readonly opacity?: number;
  readonly visible?: boolean;
  readonly showLabel?: boolean;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
  readonly labelText?: string;
  readonly className?: string;
}

export interface CgChartPointCustomizationContext<TItem> extends CgChartPointRef {
  readonly argument: CgChartArgumentValue;
  readonly value: CgChartValue;
  readonly dataItem: TItem;
}

export interface CgChartLegendItemRenderContext {
  readonly seriesName: string;
  readonly pointIndex?: number;
  readonly label: string;
  readonly visible: boolean;
  readonly color: string;
  readonly markerSymbol: CgChartMarkerSymbol;
  readonly dashStyle: CgChartDashStyle;
  readonly defaultContent: ReactNode;
  readonly activate: () => void;
}

export interface CgChartStrings {
  readonly chartAriaLabel: string;
  readonly seriesRoleDescription: string;
  readonly pointRoleDescription: string;
  readonly noData: string;
  readonly loading: string;
  readonly noValue: string;
  readonly tooSmall: string;
  readonly dataTableSummary: string;
  readonly dataTableToggle: string;
  readonly argumentColumnHeader: string;
  readonly percentageColumnHeader: string;
  readonly legendAriaLabel: string;
  readonly thousandSuffix: string;
  readonly millionSuffix: string;
  readonly billionSuffix: string;
  readonly seriesShownTemplate: string;
  readonly seriesHiddenTemplate: string;
  readonly pointSelectedTemplate: string;
  readonly selectionCleared: string;
  readonly pointLabelTemplate: string;
  readonly seriesLabelTemplate: string;
  readonly keyboardInstructions: string;
}

interface CgChartSeriesCommon<TItem> {
  readonly name: string;
  readonly argument: (item: TItem) => CgChartArgumentValue | null;
  readonly value: (item: TItem) => CgChartValue;
  readonly data?: ReadonlyArray<TItem> | null;
  readonly initialVisible?: boolean;
  readonly color?: string;
  readonly opacity?: number;
  readonly valueAxisName?: string;
  readonly showInLegend?: boolean;
  readonly tooltipEnabled?: boolean;
  readonly missingValueMode?: CgChartMissingValueMode;
  readonly valueFormatter?: (value: CgChartNumericValue, item: TItem, pointIndex: number) => string;
  readonly valueFormatOptions?: Readonly<Intl.NumberFormatOptions>;
  readonly showPointLabels?: boolean;
  readonly pointLabelFormatter?: (value: CgChartNumericValue, item: TItem, pointIndex: number) => string;
  /** Overrides `pointLabels.position` for this series. */
  readonly pointLabelPosition?: CgChartPointLabelPosition;
  /**
   * Parts joined into each point label, in this order. `value` uses `pointLabelFormatter` or the
   * point-label formatter, and `percentage` applies to pie and donut slices only. A
   * `customizePoint` `labelText` still wins. Default: the value alone.
   */
  readonly pointLabelContent?: ReadonlyArray<CgChartPointLabelPart>;
  /** Joins the `pointLabelContent` parts. Default `', '`. */
  readonly pointLabelSeparator?: string;
  /** Font of this series' point labels, merged over `appearance.pointLabels`. */
  readonly pointLabelStyle?: CgChartTextStyle;
  readonly className?: string;
}

interface CgChartMarkerOptions {
  readonly showMarkers?: boolean;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
  /** Marker fill; defaults to the point colour. `none` leaves it hollow. */
  readonly markerFillColor?: string;
  /** Marker outline; defaults to none. */
  readonly markerOutlineColor?: string;
  /** Default 1 when `markerOutlineColor` is set. */
  readonly markerOutlineWidth?: number;
}

export interface CgChartBarSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem> {
  readonly type: 'bar';
  readonly stacking?: CgChartStackMode;
  readonly stackName?: string;
  readonly maximumBarWidth?: number;
  readonly cornerRadius?: number;
  /** Bar fill; defaults to `color`. */
  readonly fillColor?: string;
  /** Bar outline; defaults to none. */
  readonly outlineColor?: string;
  /** Default 1 when `outlineColor` is set. */
  readonly outlineWidth?: number;
  readonly outlineDashStyle?: CgChartDashStyle;
}

export interface CgChartLineSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem>, CgChartMarkerOptions {
  readonly type: 'line';
  readonly lineStyle?: CgChartLineStyle;
  readonly lineWidth?: number;
  readonly dashStyle?: CgChartDashStyle;
  /** Line colour; defaults to `color`. `none` hides the line and keeps the markers. */
  readonly lineColor?: string;
}

export interface CgChartAreaSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem>, CgChartMarkerOptions {
  readonly type: 'area';
  readonly lineStyle?: CgChartLineStyle;
  readonly lineWidth?: number;
  readonly dashStyle?: CgChartDashStyle;
  readonly areaOpacity?: number;
  readonly stacking?: CgChartStackMode;
  readonly stackName?: string;
  /** Area fill; defaults to `color`. */
  readonly fillColor?: string;
  /** The line along the top edge; defaults to `color`. `none` removes it. */
  readonly outlineColor?: string;
}

/**
 * A scatter series: `argument` returns a numeric x and `value` a numeric y. Each series keeps its
 * own points in data order, so x values may repeat and series need not share them. Scatter series
 * share a chart only with other scatter series and use a numeric argument axis.
 */
export interface CgChartScatterSeriesDescriptor<TItem>
  extends Omit<CgChartSeriesCommon<TItem>, 'argument'>, CgChartMarkerOptions {
  readonly type: 'scatter';
  readonly argument: (item: TItem) => CgChartNumericValue | null;
  /** Default `false`: markers only. */
  readonly showLine?: boolean;
  /** `straight` (default) or `smooth`. */
  readonly lineStyle?: CgChartLineStyle;
  readonly lineWidth?: number;
  readonly dashStyle?: CgChartDashStyle;
  readonly lineColor?: string;
}

interface CgChartPieSeriesCommon<TItem> extends CgChartSeriesCommon<TItem> {
  readonly innerRadiusRatio?: number;
  /**
   * Angle of the first slice's leading edge in degrees: 0 is three o'clock and slices run
   * clockwise, so the default -90 is twelve o'clock. A spreadsheet first-slice angle A maps to A - 90.
   */
  readonly startAngleDegrees?: number;
  /** Slice outline, for example a 1px white edge; defaults to none. */
  readonly outlineColor?: string;
  /** Default 1 when `outlineColor` is set. */
  readonly outlineWidth?: number;
  /** How far every slice moves out, as a fraction of the radius. */
  readonly explosion?: number;
  readonly smallSlicePolicy?: CgChartSmallSlicePolicy;
  readonly smallSliceThreshold?: number;
  readonly showPercentages?: boolean;
}

export interface CgChartPieSeriesDescriptor<TItem> extends CgChartPieSeriesCommon<TItem> {
  readonly type: 'pie';
}

export interface CgChartDonutSeriesDescriptor<TItem> extends CgChartPieSeriesCommon<TItem> {
  readonly type: 'donut';
}

export type CgChartSeriesDescriptor<TItem> =
  | CgChartBarSeriesDescriptor<TItem>
  | CgChartLineSeriesDescriptor<TItem>
  | CgChartAreaSeriesDescriptor<TItem>
  | CgChartPieSeriesDescriptor<TItem>
  | CgChartDonutSeriesDescriptor<TItem>
  | CgChartScatterSeriesDescriptor<TItem>;

interface CgChartConstantLineCommon {
  readonly label?: string;
  readonly color?: string;
  readonly width?: number;
  readonly dashStyle?: CgChartDashStyle;
  readonly labelPosition?: CgChartConstantLineLabelPosition;
  readonly extendAxisRange?: boolean;
  readonly className?: string;
}

export interface CgChartValueConstantLineDescriptor extends CgChartConstantLineCommon {
  readonly axis?: 'value';
  readonly value: CgChartNumericValue;
  readonly axisName?: string;
}

export interface CgChartArgumentConstantLineDescriptor extends CgChartConstantLineCommon {
  readonly axis: 'argument';
  readonly value: CgChartArgumentValue;
}

export type CgChartConstantLineDescriptor =
  | CgChartValueConstantLineDescriptor
  | CgChartArgumentConstantLineDescriptor;

export interface CgChartTextStyle {
  readonly fontFamily?: string;
  /** In CSS pixels. */
  readonly fontSize?: number;
  readonly color?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
}

export interface CgChartStrokeStyle {
  /** `none` hides the stroke. */
  readonly color?: string;
  /** In CSS pixels. */
  readonly width?: number;
  readonly dashStyle?: CgChartDashStyle;
}

/** A tick the caller places exactly: its value and the text drawn beside it. */
export interface CgChartAxisTick {
  readonly value: CgChartNumericValue;
  readonly text: string;
}

/**
 * Shared axis options. `reversed`, `ticks` and `minorTickInterval` change the scale everywhere;
 * gridline styles apply everywhere. Axis-line style, tick marks, minor gridlines, label position,
 * fonts and crossings take effect when `appearance` is set.
 */
interface CgChartAxisStyleOptions {
  /** Runs the axis from its maximum to its minimum (categories from last to first). */
  readonly reversed?: boolean;
  readonly majorGridLineStyle?: CgChartStrokeStyle;
  readonly showMinorGridLines?: boolean;
  readonly minorGridLineStyle?: CgChartStrokeStyle;
  /** Numeric axes: spacing of minor tick marks and minor gridlines. */
  readonly minorTickInterval?: CgChartNumericValue;
  readonly axisLineStyle?: CgChartStrokeStyle;
  readonly majorTickMarks?: CgChartTickMarkStyle;
  readonly minorTickMarks?: CgChartTickMarkStyle;
  /** `low` and `high` put labels at the minimum or maximum side of the crossing axis. */
  readonly labelPosition?: CgChartAxisLabelPosition;
  readonly labelStyle?: CgChartTextStyle;
  readonly titleStyle?: CgChartTextStyle;
  /** Numeric axes: exact tick positions and texts, replacing the generated ticks and labels. */
  readonly ticks?: ReadonlyArray<CgChartAxisTick>;
}

export interface CgChartArgumentAxisDescriptor extends CgChartAxisStyleOptions {
  readonly title?: string;
  readonly visible?: boolean;
  readonly valueType?: CgChartAxisValueType;
  readonly minimum?: CgChartArgumentValue;
  readonly maximum?: CgChartArgumentValue;
  readonly tickInterval?: CgChartNumericValue;
  readonly labelFormatter?: (value: CgChartArgumentValue) => string;
  readonly numberFormatOptions?: Readonly<Intl.NumberFormatOptions>;
  readonly dateTimeFormatOptions?: Readonly<Intl.DateTimeFormatOptions>;
  readonly labelRotationAngle?: number;
  readonly labelOverlapMode?: CgChartLabelOverlapMode;
  readonly maximumLabelCharacters?: number;
  readonly showGridLines?: boolean;
  readonly showAxisLine?: boolean;
  readonly showTickMarks?: boolean;
  readonly categorySort?: CgChartCategorySortMode;
  readonly categoryInnerPadding?: number;
  readonly categoryOuterPadding?: number;
  readonly groupPadding?: number;
  readonly constantLines?: ReadonlyArray<CgChartConstantLineDescriptor>;
  /** Category axes: draw every nth label, starting with the first. */
  readonly labelInterval?: number;
  /** Category axes: draw every nth tick mark. */
  readonly tickMarkInterval?: number;
  /**
   * Category axes: `betweenTicks` centres each category in an equal slot and `onTicks` puts the
   * first and last categories on the plot edges. Either one replaces the category padding options.
   */
  readonly categoryPlacement?: CgChartCategoryPlacement;
  /** Where the value axes cross this axis. */
  readonly valueAxisCrossesAt?: CgChartAxisCrossing;
}

export interface CgChartValueAxisDescriptor extends CgChartAxisStyleOptions {
  readonly name?: string;
  readonly title?: string;
  readonly visible?: boolean;
  readonly minimum?: CgChartNumericValue;
  readonly maximum?: CgChartNumericValue;
  readonly tickInterval?: CgChartNumericValue;
  readonly labelFormatter?: (value: CgChartNumericValue) => string;
  readonly numberFormatOptions?: Readonly<Intl.NumberFormatOptions>;
  readonly includeZero?: boolean | null;
  readonly showGridLines?: boolean;
  readonly showAxisLine?: boolean;
  readonly showZeroLine?: boolean;
  readonly position?: CgChartAxisPosition;
  readonly constantLines?: ReadonlyArray<CgChartConstantLineDescriptor>;
  /** Where the argument axis crosses this axis. Bars on this axis grow from that value. */
  readonly argumentAxisCrossesAt?: CgChartAxisCrossing;
  /**
   * Bars on this axis form their own cluster, centred in each category. The gap between clusters
   * as a percentage of one bar's width (0–500). Replaces the category padding maths for these bars.
   */
  readonly barGapWidth?: number;
  /**
   * Percentage of a bar's width that neighbouring bars in the cluster overlap (-100–100); negative
   * leaves space between them. Stacked bars share one slot, so it has no effect on them.
   */
  readonly barOverlap?: number;
}

export interface CgChartAnnotationDescriptor {
  readonly text: string;
  readonly argument?: CgChartArgumentValue;
  readonly value?: CgChartNumericValue;
  readonly valueAxisName?: string;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly className?: string;
}

export interface CgChartLegendOptions {
  readonly position?: CgChartLegendPosition;
  readonly orientation?: CgChartLegendOrientation;
  readonly mode?: CgChartLegendMode;
  readonly visible?: boolean;
  readonly keepOneSeriesVisible?: boolean;
  readonly renderItem?: (context: CgChartLegendItemRenderContext) => ReactNode;
}

export interface CgChartTooltipOptions {
  readonly enabled?: boolean;
  readonly showSeriesName?: boolean;
  readonly valueFormatter?: (value: CgChartNumericValue, point: CgChartPointRef) => string;
  readonly numberFormatOptions?: Readonly<Intl.NumberFormatOptions>;
}

export interface CgChartPointLabelOptions {
  readonly visible?: boolean;
  readonly position?: CgChartPointLabelPosition;
  readonly formatter?: (value: CgChartNumericValue, point: CgChartPointRef) => string;
  readonly numberFormatOptions?: Readonly<Intl.NumberFormatOptions>;
  readonly hideOverlapping?: boolean;
  readonly showConnectors?: boolean;
}

export interface CgChartBoxStyle {
  /** `none` or `transparent` leaves the box unfilled. */
  readonly fill?: string;
  /** `none` removes the border. */
  readonly border?: CgChartStrokeStyle | 'none';
}

/** A rectangle as fractions (0–1) of the chart width and height. */
export interface CgChartRelativeRectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CgChartPlotLayout extends CgChartRelativeRectangle {
  /** `inner` (default) is the rectangle the axes enclose; `outer` also holds tick labels and axis titles. */
  readonly target?: 'inner' | 'outer';
}

export interface CgChartTitleStyle extends CgChartTextStyle {
  /** Lines the title may wrap to before it is truncated with an ellipsis. Default 2. */
  readonly maxLines?: number;
}

export interface CgChartAreaStyle extends CgChartBoxStyle {
  /** Default 0. */
  readonly cornerRadius?: number;
  /** Space inside the border, in pixels. Default 8. */
  readonly padding?: number;
}

export interface CgChartPlotAreaStyle extends CgChartBoxStyle {
  /** Places the plot area manually instead of laying it out automatically. */
  readonly layout?: CgChartPlotLayout;
}

/**
 * Draws the chart as a document object instead of a dashboard card. When set, the title, legend and
 * axis titles are drawn inside the SVG, the surface loses its card border, radius and background,
 * the chart is drawn at exactly the measured or given pixel size, and the data table defaults to
 * `visuallyHidden`. Every field is optional; unset colours come from the theme tokens.
 */
export interface CgChartAppearance {
  readonly fontFamily?: string;
  readonly chartArea?: CgChartAreaStyle;
  readonly plotArea?: CgChartPlotAreaStyle;
  readonly title?: CgChartTitleStyle;
  readonly axisLabels?: CgChartTextStyle;
  readonly axisTitles?: CgChartTextStyle;
  readonly legend?: CgChartTextStyle;
  readonly pointLabels?: CgChartTextStyle;
  /** Colour of the `highlightedElement` outline and handles. */
  readonly selectionColor?: string;
}

/** Names an axis: the argument axis, or a value axis by name. */
export type CgChartAxisRef =
  | { readonly axis: 'argument' }
  | { readonly axis: 'value'; readonly axisName: string };

/** A chart element an editor can select. */
export type CgChartElementRef =
  | { readonly kind: 'chartArea' }
  | { readonly kind: 'plotArea' }
  | { readonly kind: 'title' }
  | { readonly kind: 'legend' }
  | { readonly kind: 'legendEntry'; readonly seriesName: string; readonly pointIndex?: number }
  | ({ readonly kind: 'axis' } & CgChartAxisRef)
  | ({ readonly kind: 'axisTitle' } & CgChartAxisRef)
  | ({ readonly kind: 'majorGridLines' } & CgChartAxisRef)
  | ({ readonly kind: 'minorGridLines' } & CgChartAxisRef)
  | { readonly kind: 'series'; readonly seriesName: string }
  | { readonly kind: 'point'; readonly seriesName: string; readonly pointIndex: number }
  | { readonly kind: 'pointLabels'; readonly seriesName: string; readonly pointIndex?: number };

export interface CgChartElementPointerDetail {
  /** The most specific element under the pointer. */
  readonly element: CgChartElementRef;
  /** Pointer position from the top-left corner of the chart surface, in CSS pixels. */
  readonly x: number;
  readonly y: number;
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly originalEvent: PointerEvent;
}

export interface CgChartActions {
  focus: () => boolean;
  refresh: () => void;
  getSvg: () => string | null;
  exportSvg: (fileName?: string) => boolean;
  setSeriesVisible: (seriesName: string, visible: boolean) => boolean;
  selectPoints: (points: ReadonlyArray<CgChartPointRef>) => boolean;
  resetSelection: () => boolean;
  getActivePoint: () => CgChartPointRef | null;
}

type NativeChartProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  | 'children'
  | 'role'
  | 'title'
  | 'onSelect'
  | 'onChange'
  | 'dangerouslySetInnerHTML'
  | 'aria-label'
>;

export interface CgChartProps<TItem> extends NativeChartProps {
  data: ReadonlyArray<TItem> | null;
  series: ReadonlyArray<CgChartSeriesDescriptor<TItem>>;
  argumentAxis?: CgChartArgumentAxisDescriptor;
  valueAxes?: ReadonlyArray<CgChartValueAxisDescriptor>;
  constantLines?: ReadonlyArray<CgChartConstantLineDescriptor>;
  annotations?: ReadonlyArray<CgChartAnnotationDescriptor>;
  legend?: CgChartLegendOptions;
  tooltip?: CgChartTooltipOptions;
  pointLabels?: CgChartPointLabelOptions;
  renderEmpty?: () => ReactNode;
  renderLoading?: () => ReactNode;
  title?: string;
  subtitle?: string;
  description?: string;
  ariaLabel?: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  aspectRatio?: number;
  fallbackWidth?: number;
  fallbackHeight?: number;
  orientation?: CgChartOrientation;
  palette?: ReadonlyArray<string>;
  selectionMode?: CgChartSelectionMode;
  selectedPoints?: ReadonlyArray<CgChartPointRef>;
  defaultSelectedPoints?: ReadonlyArray<CgChartPointRef>;
  onSelectedPointsChange?: (
    selectedPoints: ReadonlyArray<CgChartPointRef>,
    detail: CgChartSelectionChangeDetail,
  ) => void;
  onSelectionChanged?: (detail: CgChartSelectionChangeDetail) => void;
  visibleSeriesNames?: ReadonlyArray<string>;
  defaultVisibleSeriesNames?: ReadonlyArray<string>;
  onVisibleSeriesNamesChange?: (visibleSeriesNames: ReadonlyArray<string>) => void;
  dataTableMode?: CgChartDataTableMode;
  enableKeyboardNavigation?: boolean;
  animation?: CgChartAnimationMode;
  loading?: boolean;
  maxPointsPerSeries?: number;
  customizePoint?: (
    context: CgChartPointCustomizationContext<TItem>,
  ) => CgChartPointCustomization | null | undefined;
  onPointActivate?: (detail: CgChartPointEventDetail<TItem>) => void;
  onLegendItemClick?: (detail: CgChartLegendItemClickDetail) => void;
  locale?: string;
  displayTimeZone?: string;
  strings?: Partial<CgChartStrings>;
  direction?: CgDirection;
  actionsRef?: Ref<CgChartActions>;
  /** Draws the chart as a document object; see `CgChartAppearance`. */
  appearance?: CgChartAppearance;
  /** `false` turns off hover dimming, tooltips, focus outlines and selection strokes. Default `true`. */
  interactive?: boolean;
  /** Reports the chart element under the pointer on each pointer down inside the chart surface. */
  onElementPointerDown?: (detail: CgChartElementPointerDetail) => void;
  /** Draws a selection outline with corner handles around this element. */
  highlightedElement?: CgChartElementRef | null;
}
