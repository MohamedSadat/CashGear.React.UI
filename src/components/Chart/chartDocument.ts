import type { CgChartLegendPosition } from './CgChart.types';
import type { ChartRectangle } from './chartGeometry';
import type { ChartLegendEntryLayout, ChartLegendKey, ChartTextItem } from './chartLayoutTypes';
import { fitText, wrapText } from './chartText';
import type { ChartTextMeasurer, ChartTextStyle } from './chartText';

export type ChartLegendKeyInput = Omit<ChartLegendKey, 'x' | 'y' | 'width' | 'height'>;

export interface ChartLegendEntryInput {
  readonly seriesName: string;
  readonly pointIndex?: number;
  readonly label: string;
  readonly key: ChartLegendKeyInput;
}

export function insetRectangle(rectangle: ChartRectangle, inset: number): ChartRectangle {
  const width = Math.max(1, rectangle.width - inset * 2);
  const height = Math.max(1, rectangle.height - inset * 2);
  return Object.freeze({ x: rectangle.x + inset, y: rectangle.y + inset, width, height });
}

/** Text baseline that centres a line of `style` on `centerY`. */
export function centredBaseline(centerY: number, style: ChartTextStyle): number {
  return centerY + style.size * 0.35;
}

export interface DocumentTitleLayout {
  readonly lines: ReadonlyArray<ChartTextItem>;
  readonly box: ChartRectangle;
  readonly remaining: ChartRectangle;
}

/** Centres the title at the top of `content`, wrapping to `maxLines`. */
export function layoutDocumentTitle(
  text: string,
  content: ChartRectangle,
  style: ChartTextStyle,
  maxLines: number,
  measure: ChartTextMeasurer,
): DocumentTitleLayout | null {
  if (!text.trim()) return null;
  const lines = wrapText(text.trim(), content.width, style, measure, maxLines);
  const lineHeight = style.size * 1.2;
  const centerX = content.x + content.width / 2;
  const widest = Math.min(content.width, Math.max(1, ...lines.map((line) => measure(line, style))));
  const items = lines.map((line, index) => Object.freeze<ChartTextItem>({
    x: centerX,
    y: centredBaseline(content.y + lineHeight * index + lineHeight / 2, style),
    text: line,
    fullText: text,
    anchor: 'middle',
    style,
  }));
  const height = lineHeight * lines.length;
  const gap = style.size * 0.3;
  return Object.freeze({
    lines: Object.freeze(items),
    box: Object.freeze({ x: centerX - widest / 2, y: content.y, width: widest, height }),
    remaining: Object.freeze({
      x: content.x, y: content.y + height + gap, width: content.width,
      height: Math.max(1, content.height - height - gap),
    }),
  });
}

export interface DocumentLegendLayout {
  readonly box: ChartRectangle;
  readonly entries: ReadonlyArray<ChartLegendEntryLayout>;
  readonly remaining: ChartRectangle;
  /** True when some entries did not fit. */
  readonly truncated: boolean;
}

interface MeasuredEntry {
  readonly input: ChartLegendEntryInput;
  readonly text: string;
  readonly keyWidth: number;
  readonly width: number;
}

/**
 * Lays the legend out inside `content` and returns what is left for the plot. Horizontal legends
 * wrap into centred rows; vertical ones stack entries and are centred (start, end) or top aligned
 * (topEnd). In RTL the key sits on the right of its text and entries run right to left.
 */
export function layoutDocumentLegend(
  inputs: ReadonlyArray<ChartLegendEntryInput>,
  content: ChartRectangle,
  position: Exclude<CgChartLegendPosition, 'none'>,
  style: ChartTextStyle,
  measure: ChartTextMeasurer,
  rtl: boolean,
): DocumentLegendLayout | null {
  if (!inputs.length) return null;
  const size = style.size;
  const keySide = Math.max(4, Math.round(size * 0.6));
  const keyGap = size * 0.3;
  const spacing = size * 0.9;
  const rowHeight = Math.max(size * 1.25, ...inputs.map((input) => (input.key.markerSize ?? 0) + 2));
  const gapAfter = size * 0.5;
  const horizontal = position === 'top' || position === 'bottom';
  const textLimit = horizontal
    ? Math.max(8, content.width - keySide * 3 - keyGap)
    : Math.max(8, content.width * 0.4 - keySide * 3 - keyGap);
  const measured: MeasuredEntry[] = inputs.map((input) => {
    const keyWidth = input.key.kind === 'line' ? Math.round(size * 1.9) : keySide;
    const text = fitText(input.label, textLimit, style, measure);
    return { input, text, keyWidth, width: keyWidth + keyGap + measure(text, style) };
  });

  const placed: Array<{ entry: MeasuredEntry; x: number; y: number }> = [];
  let box: ChartRectangle;
  let remaining: ChartRectangle;
  let truncated = false;
  if (horizontal) {
    const rows: MeasuredEntry[][] = [];
    let row: MeasuredEntry[] = [];
    let rowWidth = 0;
    for (const entry of measured) {
      const next = row.length ? rowWidth + spacing + entry.width : entry.width;
      if (row.length && next > content.width) {
        rows.push(row);
        row = [entry];
        rowWidth = entry.width;
      } else {
        row.push(entry);
        rowWidth = next;
      }
    }
    if (row.length) rows.push(row);
    const maximumRows = Math.max(1, Math.floor((content.height * 0.5) / rowHeight));
    if (rows.length > maximumRows) truncated = true;
    rows.length = Math.min(rows.length, maximumRows);
    const height = rows.length * rowHeight;
    const top = position === 'top' ? content.y : content.y + content.height - height;
    let widest = 0;
    rows.forEach((entries, rowIndex) => {
      const width = entries.reduce((total, entry) => total + entry.width, 0) + spacing * (entries.length - 1);
      widest = Math.max(widest, width);
      let x = content.x + (content.width - width) / 2;
      const ordered = rtl ? [...entries] : entries;
      if (rtl) x += width;
      for (const entry of ordered) {
        if (rtl) {
          x -= entry.width;
          placed.push({ entry, x, y: top + rowIndex * rowHeight });
          x -= spacing;
        } else {
          placed.push({ entry, x, y: top + rowIndex * rowHeight });
          x += entry.width + spacing;
        }
      }
    });
    box = Object.freeze({ x: content.x + (content.width - widest) / 2, y: top, width: widest, height });
    remaining = position === 'top'
      ? Object.freeze({ x: content.x, y: content.y + height + gapAfter, width: content.width, height: Math.max(1, content.height - height - gapAfter) })
      : Object.freeze({ x: content.x, y: content.y, width: content.width, height: Math.max(1, content.height - height - gapAfter) });
  } else {
    const count = Math.max(1, Math.min(measured.length, Math.floor(content.height / rowHeight)));
    if (count < measured.length) truncated = true;
    const entries = measured.slice(0, count);
    const width = Math.max(...entries.map((entry) => entry.width));
    const height = count * rowHeight;
    const atEnd = position === 'end' || position === 'topEnd';
    const physicalRight = atEnd !== rtl;
    const x = physicalRight ? content.x + content.width - width : content.x;
    const y = position === 'topEnd' ? content.y : content.y + (content.height - height) / 2;
    entries.forEach((entry, index) => placed.push({ entry, x: rtl ? x + width - entry.width : x, y: y + index * rowHeight }));
    box = Object.freeze({ x, y, width, height });
    remaining = physicalRight
      ? Object.freeze({ x: content.x, y: content.y, width: Math.max(1, content.width - width - gapAfter), height: content.height })
      : Object.freeze({ x: content.x + width + gapAfter, y: content.y, width: Math.max(1, content.width - width - gapAfter), height: content.height });
  }

  const layouts = placed.map(({ entry, x, y }) => {
    const centerY = y + rowHeight / 2;
    const keyHeight = entry.input.key.kind === 'line' ? keySide : keySide;
    const keyX = rtl ? x + entry.width - entry.keyWidth : x;
    const key = Object.freeze<ChartLegendKey>({
      ...entry.input.key,
      x: keyX,
      y: centerY - keyHeight / 2,
      width: entry.keyWidth,
      height: keyHeight,
    });
    const text = Object.freeze<ChartTextItem>({
      x: rtl ? keyX - keyGap : keyX + entry.keyWidth + keyGap,
      y: centredBaseline(centerY, style),
      text: entry.text,
      fullText: entry.input.label,
      anchor: rtl ? 'end' : 'start',
      style,
    });
    return Object.freeze<ChartLegendEntryLayout>({
      seriesName: entry.input.seriesName,
      ...(entry.input.pointIndex === undefined ? {} : { pointIndex: entry.input.pointIndex }),
      box: Object.freeze({ x, y, width: entry.width, height: rowHeight }),
      key,
      text,
    });
  });
  return Object.freeze({ box, entries: Object.freeze(layouts), remaining, truncated });
}
