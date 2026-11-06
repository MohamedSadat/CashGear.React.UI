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

/**
 * Equal category slots with no padding. `betweenTicks` centres category i in slot i; `onTicks`
 * puts the first and last categories on the range ends, so the step is the span over count - 1.
 */
export function createCategoryScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  placement: 'betweenTicks' | 'onTicks',
  reverse = false,
): BandScale {
  const span = Math.max(0, rangeEnd - rangeStart);
  const onTicks = placement === 'onTicks';
  const step = onTicks ? span / Math.max(1, count - 1) : span / Math.max(1, count);
  return Object.freeze({
    count,
    step,
    bandwidth: step,
    position(index: number) {
      if (!Number.isInteger(index) || index < 0 || index >= count) return null;
      const physical = reverse ? count - 1 - index : index;
      if (onTicks && count === 1) return rangeStart + span / 2 - step / 2;
      return rangeStart + step * physical - (onTicks ? step / 2 : 0);
    },
  });
}

/**
 * Spreadsheet bar spacing inside one category slot of width `step`. With N bars of width w, gap
 * G% and overlap O%, the slot holds w·G/100 of gap plus N bars that each advance w·(1 - O/100),
 * so w = step / (G/100 + 1 + (N - 1)(1 - O/100)).
 */
export function clusteredBarSlot(
  slotStart: number,
  step: number,
  slotIndex: number,
  slotCount: number,
  gapWidth: number,
  overlap: number,
): Readonly<{ start: number; width: number }> {
  const count = Math.max(1, slotCount);
  const advance = 1 - overlap / 100;
  const width = step / (gapWidth / 100 + 1 + (count - 1) * advance);
  const start = slotStart + (width * gapWidth / 100) / 2 + slotIndex * width * advance;
  return Object.freeze({ start, width: Math.max(0, width) });
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
