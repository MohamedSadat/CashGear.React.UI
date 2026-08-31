import type { ChartFormatter } from './chartFormatting';
import type { VisibleChartModel } from './chartModel';
import { exactAdd, exactDivide, exactFromNumeric } from './chartValues';

export interface ChartTableCell {
  readonly seriesName: string;
  readonly text: string;
  readonly missing: boolean;
}

export interface ChartTableRow {
  readonly argument: string;
  readonly cells: ReadonlyArray<ChartTableCell>;
  readonly percentage?: string;
}

export interface ChartTableProjection {
  readonly seriesNames: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ChartTableRow>;
  readonly pie: boolean;
}

export function projectChartTable<TItem>(
  model: VisibleChartModel<TItem>,
  formatter: ChartFormatter,
): ChartTableProjection {
  if (model.kind === 'pie') {
    const series = model.visibleSeries[0];
    if (!series) return Object.freeze({ seriesNames: Object.freeze([]), rows: Object.freeze([]), pie: true });
    let total = exactFromNumeric(0);
    for (const point of series.points) {
      if (point.exactValue && point.exactValue.coefficient > 0n) total = exactAdd(total, point.exactValue);
    }
    const rows = series.points.map((point) => Object.freeze<ChartTableRow>({
      argument: point.formattedArgument,
      cells: Object.freeze([Object.freeze({
        seriesName: series.name,
        text: point.formattedValue,
        missing: point.exactValue === null,
      })]),
      ...((series.descriptor.type === 'pie' || series.descriptor.type === 'donut') && series.descriptor.showPercentages !== false && point.exactValue && total.coefficient > 0n
        ? { percentage: formatter.formatPercentage(Math.max(0, exactDivide(point.exactValue, total))) }
        : {}),
    }));
    return Object.freeze({ seriesNames: Object.freeze([series.name]), rows: Object.freeze(rows), pie: true });
  }

  const rows = model.arguments.map((argument, pointIndex) => Object.freeze<ChartTableRow>({
    argument: model.visibleSeries[0]?.points[pointIndex]?.formattedArgument
      ?? formatter.formatArgument(argument),
    cells: Object.freeze(model.visibleSeries.map((series) => {
      const point = series.points[pointIndex];
      return Object.freeze({
        seriesName: series.name,
        text: point?.formattedValue ?? formatter.strings.noValue,
        missing: point?.exactValue === null || point === undefined,
      });
    })),
  }));
  return Object.freeze({
    seriesNames: Object.freeze(model.visibleSeries.map((series) => series.name)),
    rows: Object.freeze(rows),
    pie: false,
  });
}
