import type {
  CgChartPointRef,
  CgChartSelectionChangeDetail,
  CgChartSelectionMode,
  CgChartSeriesDescriptor,
} from './CgChart.types';

export function pointRefKey(reference: CgChartPointRef): string {
  return `${reference.seriesName}\u0000${reference.pointIndex}`;
}

export function freezePointRef(reference: CgChartPointRef): CgChartPointRef {
  return Object.freeze({ seriesName: reference.seriesName, pointIndex: reference.pointIndex });
}

export function normalizePointRefs(references: ReadonlyArray<CgChartPointRef>): ReadonlyArray<CgChartPointRef> {
  const seen = new Set<string>();
  const result: CgChartPointRef[] = [];
  for (const reference of references) {
    if (!reference.seriesName.trim() || !Number.isSafeInteger(reference.pointIndex) || reference.pointIndex < 0) continue;
    const key = pointRefKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(freezePointRef(reference));
  }
  return Object.freeze(result);
}

export function samePointRefs(
  left: ReadonlyArray<CgChartPointRef>,
  right: ReadonlyArray<CgChartPointRef>,
): boolean {
  return left.length === right.length && left.every((reference, index) => pointRefKey(reference) === pointRefKey(right[index]!));
}

export function proposePointSelection(
  mode: CgChartSelectionMode,
  current: ReadonlyArray<CgChartPointRef>,
  reference: CgChartPointRef,
  additive: boolean,
): ReadonlyArray<CgChartPointRef> {
  if (mode === 'none') return current;
  const key = pointRefKey(reference);
  const contains = current.some((candidate) => pointRefKey(candidate) === key);
  if (mode === 'single' || !additive) {
    return contains && current.length === 1 ? Object.freeze([]) : Object.freeze([freezePointRef(reference)]);
  }
  return contains
    ? Object.freeze(current.filter((candidate) => pointRefKey(candidate) !== key).map(freezePointRef))
    : Object.freeze([...current.map(freezePointRef), freezePointRef(reference)]);
}

export function selectionDetail(
  selectedPoints: ReadonlyArray<CgChartPointRef>,
  previousSelectedPoints: ReadonlyArray<CgChartPointRef>,
  reason: CgChartSelectionChangeDetail['reason'],
): CgChartSelectionChangeDetail {
  return Object.freeze({ selectedPoints, previousSelectedPoints, reason });
}

export function initialVisibleSeriesNames<TItem>(
  series: ReadonlyArray<CgChartSeriesDescriptor<TItem>>,
  supplied?: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const requested = supplied ? new Set(supplied) : null;
  return Object.freeze(series.filter((descriptor) => (
    requested ? requested.has(descriptor.name) : descriptor.initialVisible !== false
  )).map((descriptor) => descriptor.name));
}

export function normalizeVisibleSeriesNames<TItem>(
  series: ReadonlyArray<CgChartSeriesDescriptor<TItem>>,
  names: ReadonlyArray<string>,
): ReadonlyArray<string> {
  const supplied = new Set(names);
  return Object.freeze(series.filter((descriptor) => supplied.has(descriptor.name)).map((descriptor) => descriptor.name));
}
