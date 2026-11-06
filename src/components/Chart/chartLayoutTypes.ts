import type {
  CgChartAnnotationDescriptor,
  CgChartArgumentAxisDescriptor,
  CgChartAxisRef,
  CgChartConstantLineDescriptor,
  CgChartDashStyle,
  CgChartLegendOptions,
  CgChartMarkerSymbol,
  CgChartOrientation,
  CgChartPointLabelOptions,
  CgChartValueAxisDescriptor,
} from './CgChart.types';
import type { ChartDocumentStyle } from './chartAppearance';
import type { AxisLabelPlan } from './chartAxisLabels';
import type { ChartFormatter } from './chartFormatting';
import type { ChartRectangle } from './chartGeometry';
import type { ChartPoint, VisibleChartModel } from './chartModel';
import type { ChartStroke, ChartTextMeasurer, ChartTextStyle } from './chartText';

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
  /** Pixel positions of minor ticks along the value direction. */
  readonly minorTicks: ReadonlyArray<number>;
}

interface ChartShapeCommon {
  readonly seriesName: string;
  readonly color: string;
  readonly opacity: number;
  readonly className?: string;
  /** Outline; absent means none. */
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dashArray?: string;
}

export interface ChartPathShape extends ChartShapeCommon {
  readonly kind: 'path';
  readonly path: string;
  readonly fill: boolean;
  readonly lineWidth: number;
  readonly dashStyle: CgChartDashStyle;
  readonly lineCap?: 'round' | 'butt';
}

export interface ChartPointShape extends ChartShapeCommon {
  readonly kind: 'point';
  readonly point: ChartPoint<unknown>;
  readonly x: number;
  readonly y: number;
  readonly markerSymbol: CgChartMarkerSymbol;
  readonly markerSize: number;
  /** Marker fill; undefined uses `color`, `none` leaves it hollow. */
  readonly fillColor?: string;
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
  readonly bounds?: ChartRectangle;
}

export type ChartShape = ChartPathShape | ChartPointShape | ChartBarShape | ChartArcShape;

export interface ChartPointLabelLayout {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly connector?: Readonly<{ x1: number; y1: number; x2: number; y2: number }>;
  readonly seriesName?: string;
  readonly pointIndex?: number;
  /** Set when the label is drawn with an explicit font. */
  readonly style?: ChartTextStyle;
  readonly box?: ChartRectangle;
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

export interface ChartLineSegment {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Text placed at a physical anchor: `start` is the left edge whatever the direction. */
export interface ChartTextItem {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly fullText?: string;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly style: ChartTextStyle;
  readonly rotation?: number;
  readonly pivotX?: number;
  readonly pivotY?: number;
}

export interface ChartDocumentAxis {
  readonly ref: CgChartAxisRef;
  readonly line: ChartLineSegment | null;
  readonly lineStroke: ChartStroke | null;
  /** Stroke of the tick marks; follows `axisLineStyle` even when the axis line is hidden. */
  readonly tickStroke: ChartStroke | null;
  readonly tickMarks: ReadonlyArray<ChartLineSegment>;
  readonly minorTickMarks: ReadonlyArray<ChartLineSegment>;
  readonly labels: ReadonlyArray<ChartTextItem>;
  readonly box: ChartRectangle | null;
  readonly title: Readonly<{ item: ChartTextItem; box: ChartRectangle }> | null;
}

export interface ChartDocumentGrid {
  readonly ref: CgChartAxisRef;
  readonly kind: 'major' | 'minor';
  readonly lines: ReadonlyArray<ChartLineSegment>;
  readonly stroke: ChartStroke;
}

export interface ChartLegendKey {
  readonly kind: 'rect' | 'line';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly color: string;
  readonly opacity?: number;
  readonly stroke?: string;
  readonly strokeWidth?: number;
  readonly dashArray?: string;
  readonly markerSymbol?: CgChartMarkerSymbol;
  readonly markerSize?: number;
  readonly markerFill?: string;
  readonly markerStroke?: string;
  readonly markerStrokeWidth?: number;
  readonly showLine?: boolean;
}

export interface ChartLegendEntryLayout {
  readonly seriesName: string;
  readonly pointIndex?: number;
  readonly box: ChartRectangle;
  readonly key: ChartLegendKey;
  readonly text: ChartTextItem;
}

export interface ChartDocumentLayout {
  readonly style: ChartDocumentStyle;
  readonly chartArea: ChartRectangle;
  readonly title: Readonly<{ lines: ReadonlyArray<ChartTextItem>; box: ChartRectangle }> | null;
  readonly legend: Readonly<{ box: ChartRectangle; entries: ReadonlyArray<ChartLegendEntryLayout> }> | null;
  readonly axes: ReadonlyArray<ChartDocumentAxis>;
  readonly grids: ReadonlyArray<ChartDocumentGrid>;
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
  /** Set when `appearance` is: the frame, axes and legend drawn inside the SVG. */
  readonly document: ChartDocumentLayout | null;
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
  /** Set to lay the chart out as a document object. */
  readonly document?: ChartDocumentStyle;
  readonly measure?: ChartTextMeasurer;
  /** Document layout only: the title drawn inside the chart. */
  readonly title?: string;
  /** Document layout only: the legend drawn inside the chart. */
  readonly legend?: CgChartLegendOptions;
}
