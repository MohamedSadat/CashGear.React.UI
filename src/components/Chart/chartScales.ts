import type { ExactValue } from './chartValues';
import { exactRatio } from './chartValues';

export interface NumericScale {
  readonly minimum: ExactValue;
  readonly maximum: ExactValue;
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly project: (value: ExactValue) => number;
}

export function createNumericScale(
  minimum: ExactValue,
  maximum: ExactValue,
  rangeStart: number,
  rangeEnd: number,
  reverse = false,
): NumericScale {
  const start = reverse ? rangeEnd : rangeStart;
  const end = reverse ? rangeStart : rangeEnd;
  return Object.freeze({
    minimum,
    maximum,
    rangeStart,
    rangeEnd,
    project(value: ExactValue) {
      const ratio = Math.max(0, Math.min(1, exactRatio(value, minimum, maximum)));
      return start + (end - start) * ratio;
    },
  });
}

export interface BandScale {
  readonly count: number;
  readonly step: number;
  readonly bandwidth: number;
  readonly position: (index: number) => number | null;
}

export function createBandScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  innerPadding: number,
  outerPadding: number,
  reverse = false,
): BandScale {
  const span = Math.max(0, rangeEnd - rangeStart);
  const denominator = Math.max(1, count - innerPadding + outerPadding * 2);
  const step = span / denominator;
  const bandwidth = Math.max(0, step * (1 - innerPadding));
  return Object.freeze({
    count,
    step,
    bandwidth,
    position(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= count) return null;
      const physical = reverse ? count - 1 - index : index;
      return rangeStart + step * (outerPadding + physical);
    },
  });
}

export function groupedBandSlot(
  scale: BandScale,
  bandStart: number,
  slotIndex: number,
  slotCount: number,
  groupPadding: number,
  maximumWidth?: number,
): Readonly<{ start: number; width: number }> {
  const count = Math.max(1, slotCount);
  const available = scale.bandwidth;
  const gap = count > 1 ? available * groupPadding / (count - 1) : 0;
  const rawWidth = Math.max(1, (available - gap * (count - 1)) / count);
  const width = maximumWidth === undefined ? rawWidth : Math.min(rawWidth, maximumWidth);
  const occupied = width * count + gap * (count - 1);
  const offset = (available - occupied) / 2;
  return Object.freeze({ start: bandStart + offset + slotIndex * (width + gap), width });
}
