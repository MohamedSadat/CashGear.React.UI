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
export type CgChartSeriesKind = 'bar' | 'line' | 'area' | 'pie' | 'donut';
export type CgChartStackMode = 'none' | 'stacked' | 'fullStacked';
export type CgChartLineStyle = 'straight' | 'monotone';
export type CgChartDashStyle = 'solid' | 'dash' | 'dot' | 'dashDot';
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
export type CgChartLegendPosition = 'none' | 'top' | 'bottom' | 'start' | 'end';
export type CgChartLegendOrientation = 'auto' | 'horizontal' | 'vertical';
export type CgChartLegendMode = 'static' | 'toggle';
export type CgChartSelectionMode = 'none' | 'single' | 'multiple';
export type CgChartAxisValueType = 'auto' | 'category' | 'numeric' | 'date';
export type CgChartAxisPosition = 'auto' | 'start' | 'end';
export type CgChartLabelOverlapMode = 'auto' | 'none' | 'hide' | 'rotate' | 'stagger' | 'shorten';
export type CgChartPointLabelPosition = 'outside' | 'inside' | 'center';
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
  readonly color?: string;
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
  readonly className?: string;
}

export interface CgChartBarSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem> {
  readonly type: 'bar';
  readonly stacking?: CgChartStackMode;
  readonly stackName?: string;
  readonly maximumBarWidth?: number;
  readonly cornerRadius?: number;
}

export interface CgChartLineSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem> {
  readonly type: 'line';
  readonly lineStyle?: CgChartLineStyle;
  readonly lineWidth?: number;
  readonly dashStyle?: CgChartDashStyle;
  readonly showMarkers?: boolean;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
}

export interface CgChartAreaSeriesDescriptor<TItem> extends CgChartSeriesCommon<TItem> {
  readonly type: 'area';
  readonly lineStyle?: CgChartLineStyle;
  readonly lineWidth?: number;
  readonly dashStyle?: CgChartDashStyle;
  readonly showMarkers?: boolean;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
  readonly areaOpacity?: number;
  readonly stacking?: CgChartStackMode;
  readonly stackName?: string;
}

interface CgChartPieSeriesCommon<TItem> extends CgChartSeriesCommon<TItem> {
  readonly innerRadiusRatio?: number;
  readonly startAngleDegrees?: number;
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
  | CgChartDonutSeriesDescriptor<TItem>;

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

export interface CgChartArgumentAxisDescriptor {
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
}

export interface CgChartValueAxisDescriptor {
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
}
