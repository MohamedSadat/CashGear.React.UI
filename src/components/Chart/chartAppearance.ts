import type { CgChartAppearance, CgChartPlotLayout } from './CgChart.types';
import { isNoPaint, mergeTextStyle, resolveStroke } from './chartText';
import type { ChartStroke, ChartTextStyle } from './chartText';

/** `appearance` with every default filled in. Colours default to the theme tokens. */
export interface ChartDocumentStyle {
  readonly fontFamily?: string;
  readonly chartFill: string | null;
  readonly chartBorder: ChartStroke | null;
  readonly cornerRadius: number;
  readonly padding: number;
  readonly plotFill: string | null;
  readonly plotBorder: ChartStroke | null;
  readonly plotLayout?: CgChartPlotLayout;
  readonly title: ChartTextStyle;
  readonly titleMaxLines: number;
  readonly axisLabels: ChartTextStyle;
  readonly axisTitles: ChartTextStyle;
  readonly legend: ChartTextStyle;
  readonly pointLabels: ChartTextStyle;
  readonly gridStroke: ChartStroke;
  readonly axisStroke: ChartStroke;
  readonly selectionColor: string;
}

export const DEFAULT_GRID_STROKE: ChartStroke = Object.freeze({ color: 'var(--cg-chart-grid)', width: 1, dashStyle: 'solid' });
export const DEFAULT_AXIS_STROKE: ChartStroke = Object.freeze({ color: 'var(--cg-chart-muted)', width: 1, dashStyle: 'solid' });
const DEFAULT_BORDER: ChartStroke = Object.freeze({ color: 'var(--cg-chart-border)', width: 1, dashStyle: 'solid' });

function text(size: number, color: string, family: string | undefined): ChartTextStyle {
  return Object.freeze({ ...(family ? { family } : {}), size, color, bold: false, italic: false });
}

export function resolveDocumentStyle(appearance: CgChartAppearance): ChartDocumentStyle {
  const family = appearance.fontFamily;
  const chartFill = appearance.chartArea?.fill ?? 'var(--cg-chart-bg)';
  const plotFill = appearance.plotArea?.fill;
  return Object.freeze({
    ...(family ? { fontFamily: family } : {}),
    chartFill: isNoPaint(chartFill) ? null : chartFill,
    chartBorder: resolveStroke(DEFAULT_BORDER, appearance.chartArea?.border),
    cornerRadius: appearance.chartArea?.cornerRadius ?? 0,
    padding: appearance.chartArea?.padding ?? 8,
    plotFill: plotFill === undefined || isNoPaint(plotFill) ? null : plotFill,
    plotBorder: appearance.plotArea?.border === undefined ? null : resolveStroke(DEFAULT_BORDER, appearance.plotArea.border),
    ...(appearance.plotArea?.layout ? { plotLayout: appearance.plotArea.layout } : {}),
    title: mergeTextStyle(text(16, 'var(--cg-chart-text)', family), appearance.title),
    titleMaxLines: appearance.title?.maxLines ?? 2,
    axisLabels: mergeTextStyle(text(12, 'var(--cg-chart-muted)', family), appearance.axisLabels),
    axisTitles: mergeTextStyle(text(12, 'var(--cg-chart-text)', family), appearance.axisTitles),
    legend: mergeTextStyle(text(12, 'var(--cg-chart-muted)', family), appearance.legend),
    pointLabels: mergeTextStyle(text(12, 'var(--cg-chart-muted)', family), appearance.pointLabels),
    gridStroke: DEFAULT_GRID_STROKE,
    axisStroke: DEFAULT_AXIS_STROKE,
    selectionColor: appearance.selectionColor ?? 'var(--cg-chart-accent)',
  });
}
