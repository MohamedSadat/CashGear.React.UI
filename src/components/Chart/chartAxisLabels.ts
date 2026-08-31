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
): AxisLabelPlan {
  if (!labels.length) return Object.freeze({ items: Object.freeze([]), rotation: 0, staggered: false, thickness: 0 });
  const slot = availableLength / labels.length;
  const widths = labels.map((label) => estimateTextWidth(label, fontSize));
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
