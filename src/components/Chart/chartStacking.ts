import type { CgChartStackMode } from './CgChart.types';
import type { ChartSeries } from './chartModel';
import {
  exactAbs,
  exactAdd,
  exactDivide,
  exactFromNumeric,
  exactIsZero,
} from './chartValues';
import type { ExactValue } from './chartValues';

export interface ChartStackPosition {
  readonly start: ExactValue;
  readonly end: ExactValue;
  readonly zeroSized: boolean;
  readonly mode: Exclude<CgChartStackMode, 'none'>;
}

function descriptorStack<TItem>(series: ChartSeries<TItem>): Readonly<{
  mode: CgChartStackMode;
  name: string;
}> {
  const descriptor = series.descriptor;
  if (descriptor.type !== 'bar' && descriptor.type !== 'area') return { mode: 'none', name: '' };
  return { mode: descriptor.stacking ?? 'none', name: descriptor.stackName ?? '' };
}

function key(seriesName: string, pointIndex: number): string {
  return `${seriesName}\u0000${pointIndex}`;
}

export function stackPositionKey(seriesName: string, pointIndex: number): string {
  return key(seriesName, pointIndex);
}

export function buildStackPositions<TItem>(
  series: ReadonlyArray<ChartSeries<TItem>>,
): ReadonlyMap<string, ChartStackPosition> {
  const result = new Map<string, ChartStackPosition>();
  const groups = new Map<string, ChartSeries<TItem>[]>();
  for (const candidate of series) {
    const stack = descriptorStack(candidate);
    if (stack.mode === 'none') continue;
    const groupKey = `${candidate.valueAxisName}\u0000${stack.name}\u0000${stack.mode}`;
    const group = groups.get(groupKey) ?? [];
    group.push(candidate);
    groups.set(groupKey, group);
  }

  for (const group of groups.values()) {
    const mode = descriptorStack(group[0]!).mode as Exclude<CgChartStackMode, 'none'>;
    const pointCount = Math.max(0, ...group.map((candidate) => candidate.points.length));
    for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
      let positive: ExactValue = Object.freeze({ coefficient: 0n, scale: 0 });
      let negative: ExactValue = positive;
      let total: ExactValue = positive;
      if (mode === 'fullStacked') {
        for (const candidate of group) {
          const value = candidate.points[pointIndex]?.exactValue;
          if (value) total = exactAdd(total, exactAbs(value));
        }
      }
      for (const candidate of group) {
        const value = candidate.points[pointIndex]?.exactValue;
        if (!value) continue;
        const start = value.coefficient < 0n ? negative : positive;
        const end = exactAdd(start, value);
        if (value.coefficient < 0n) negative = end;
        else positive = end;
        const resolvedStart = mode === 'fullStacked' && !exactIsZero(total)
          ? exactFromNumeric(exactDivide(start, total))
          : mode === 'fullStacked' ? exactFromNumeric(0) : start;
        const resolvedEnd = mode === 'fullStacked' && !exactIsZero(total)
          ? exactFromNumeric(exactDivide(end, total))
          : mode === 'fullStacked' ? exactFromNumeric(0) : end;
        result.set(key(candidate.name, pointIndex), Object.freeze({
          start: resolvedStart,
          end: resolvedEnd,
          zeroSized: exactIsZero(value),
          mode,
        }));
      }
    }
  }
  return result;
}
