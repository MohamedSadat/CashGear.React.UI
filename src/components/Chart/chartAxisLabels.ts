import type { CgChartLabelOverlapMode } from './CgChart.types';

export interface AxisLabelPlanItem {
  readonly index: number;
  readonly fullText: string;
  readonly displayText: string;
  readonly row: 0 | 1;
}

export interface AxisLabelPlan {
  readonly items: ReadonlyArray<AxisLabelPlanItem>;
  readonly rotation: number;
  readonly staggered: boolean;
  readonly thickness: number;
}

export function estimateTextWidth(text: string, fontSize = 13): number {
  let units = 0;
  for (const character of text) {
    if (/\s/u.test(character)) units += 0.4;
    else if (/\p{Script=Arabic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}/u.test(character)) units += 1;
    else if (/[MW@#%&]/u.test(character)) units += 0.9;
    else if (/[ilI1.,:;'|]/u.test(character)) units += 0.35;
    else units += 0.64;
  }
  return units * fontSize + 2;
}

function shortened(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  if (maximum <= 1) return '…';
  return `${text.slice(0, maximum - 1)}…`;
}

function thinIndexes(count: number, maximumVisible: number): Set<number> {
  if (count <= maximumVisible) return new Set(Array.from({ length: count }, (_, index) => index));
  const indexes = new Set<number>([0]);
  const stride = Math.max(1, Math.ceil((count - 1) / Math.max(1, maximumVisible - 1)));
  for (let index = stride; index < count - 1; index += stride) indexes.add(index);
  const finalIntermediate = [...indexes].at(-1);
  if (finalIntermediate !== undefined && finalIntermediate !== 0 && count - 1 - finalIntermediate < stride * 0.75) {
    indexes.delete(finalIntermediate);
  }
  indexes.add(count - 1);
  return indexes;
}

export function planAxisLabels(
  labels: ReadonlyArray<string>,
  availableLength: number,
  mode: CgChartLabelOverlapMode,
  explicitRotation: number,
  maximumCharacters: number,
  fontSize = 13,
  measure?: (text: string) => number,
): AxisLabelPlan {
  if (!labels.length) return Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 });
  const slot = availableLength / labels.length;
  const widths = labels.map((label) => measure ? measure(label) : estimateTextWidth(label, fontSize));
  const fitsFlat = widths.every((width) => width <= slot * 0.92);
  const fitCount = Math.max(2, Math.floor(availableLength / Math.max(1, Math.max(...widths) + 8)));
  let resolvedMode = mode;
  if (explicitRotation !== 0) resolvedMode = 'rotate';
  else if (mode === 'auto') {
    if (fitsFlat) resolvedMode = 'none';
    else if (widths.every((width) => width <= slot * 1.84)) resolvedMode = 'stagger';
    else if (widths.every((width) => width * 0.72 <= slot)) resolvedMode = 'rotate';
    else resolvedMode = 'hide';
  }
  const rotation = resolvedMode === 'rotate' ? (explicitRotation || -45) : 0;
  const included = resolvedMode === 'hide' ? thinIndexes(labels.length, fitCount) : null;
  const items = labels.flatMap((text, index) => {
    if (included && !included.has(index)) return [];
    const displayText = resolvedMode === 'shorten' ? shortened(text, maximumCharacters) : text;
    return [Object.freeze<AxisLabelPlanItem>({
      index,
      fullText: text,
      displayText,
      row: resolvedMode === 'stagger' && index % 2 === 1 ? 1 : 0,
    })];
  });
  const base = fontSize * 1.4;
  const thickness = resolvedMode === 'stagger' ? base * 2
    : rotation ? Math.min(Math.max(...widths) * Math.sin(Math.abs(rotation) * Math.PI / 180) + base, 110)
      : base;
  return Object.freeze({ items: Object.freeze(items), rotation, staggered: resolvedMode === 'stagger', thickness });
}

/** Clearance between neighbouring labels before they count as colliding (Blazor `LabelGapPx`). */
export const AXIS_LABEL_GAP = 8;

/** Shortens text with an ellipsis to fit a pixel budget. The caller keeps the full text. */
export function shortenToWidth(text: string, budget: number, fontSize = 13, measure?: (text: string) => number): string {
  const width = (value: string) => measure ? measure(value) : estimateTextWidth(value, fontSize);
  if (!text || !Number.isFinite(budget) || width(text) <= budget) return text;
  if (budget <= width('…')) return '…';
  const characters = [...text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (width(`${characters.slice(0, middle).join('').trimEnd()}…`) <= budget) low = middle;
    else high = middle - 1;
  }
  return low <= 0 ? '…' : `${characters.slice(0, low).join('').trimEnd()}…`;
}

/**
 * Plans category labels stacked down a vertical axis, as a horizontal bar chart's are (Blazor
 * `PlanStackedLabels`). Neighbours collide on line height, not width, so the set is thinned keeping the
 * first and last; text wider than `maximumWidth` is shortened with an ellipsis, so one long name cannot
 * crowd out the bars. `none` still renders everything.
 */
export function planStackedAxisLabels(
  labels: ReadonlyArray<string>,
  availableLength: number,
  mode: CgChartLabelOverlapMode,
  maximumCharacters: number,
  fontSize = 13,
  maximumWidth = Number.POSITIVE_INFINITY,
  measure?: (text: string) => number,
): AxisLabelPlan {
  if (!labels.length) return Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 });
  const budget = Number.isFinite(maximumWidth) && maximumWidth > 0 ? Math.max(0, maximumWidth - AXIS_LABEL_GAP) : Number.POSITIVE_INFINITY;
  const texts = labels.map((label) => shortenToWidth(mode === 'shorten' ? shortened(label, maximumCharacters) : label, budget, fontSize, measure));
  const lineHeight = fontSize * 1.25;
  const slot = availableLength / labels.length;
  const keep = mode !== 'none' && lineHeight > slot ? thinIndexes(labels.length, Math.max(2, Math.floor(labels.length * slot / lineHeight))) : null;
  const items = labels.flatMap((text, index) => keep && !keep.has(index) ? [] : [Object.freeze<AxisLabelPlanItem>({ index, fullText: text, displayText: texts[index]!, row: 0 })]);
  const widest = Math.max(0, ...items.map((item) => measure ? measure(item.displayText) : estimateTextWidth(item.displayText, fontSize)));
  return Object.freeze({ items: Object.freeze(items), rotation: 0, staggered: false, thickness: widest + AXIS_LABEL_GAP });
}

/** Whether labels centred on their positions clear each other along one line. */
export function fitSideBySide(positions: ReadonlyArray<number>, widths: ReadonlyArray<number>): boolean {
  const order = positions.map((_, index) => index).sort((left, right) => positions[left]! - positions[right]!);
  for (let step = 1; step < order.length; step++) {
    const before = order[step - 1]!;
    const after = order[step]!;
    if (positions[after]! - positions[before]! < (widths[before]! + widths[after]!) / 2 + AXIS_LABEL_GAP) return false;
  }
  return true;
}

/**
 * Indexes of side-by-side labels to keep so none overprints, keeping the first and the last
 * (Blazor `BuildThinnedSideBySide`): each label that clears the previous kept one stays, then the end
 * gives way so the last label always shows.
 */
export function thinSideBySide(positions: ReadonlyArray<number>, widths: ReadonlyArray<number>): ReadonlySet<number> {
  const order = positions.map((_, index) => index).sort((left, right) => positions[left]! - positions[right]!);
  if (order.length <= 2) return new Set(order);
  const clears = (before: number, after: number) => Math.abs(positions[after]! - positions[before]!) >= (widths[before]! + widths[after]!) / 2 + AXIS_LABEL_GAP;
  const kept = [order[0]!];
  for (let step = 1; step < order.length - 1; step++) if (clears(kept.at(-1)!, order[step]!)) kept.push(order[step]!);
  const last = order.at(-1)!;
  while (kept.length > 1 && !clears(kept.at(-1)!, last)) kept.pop();
  if (clears(kept.at(-1)!, last)) kept.push(last);
  return new Set(kept);
}
