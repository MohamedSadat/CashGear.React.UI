import type { CgChartDashStyle, CgChartStrokeStyle, CgChartTextStyle } from './CgChart.types';
import { estimateTextWidth } from './chartAxisLabels';

/** A text style with every value settled, as the document layout draws it. */
export interface ChartTextStyle {
  /** Undefined inherits the chart's font family. */
  readonly family?: string;
  readonly size: number;
  readonly color: string;
  readonly bold: boolean;
  readonly italic: boolean;
}

export interface ChartStroke {
  readonly color: string;
  readonly width: number;
  readonly dashStyle: CgChartDashStyle;
}

export type ChartTextMeasurer = (text: string, style: ChartTextStyle) => number;

export function mergeTextStyle(
  base: ChartTextStyle,
  ...overrides: ReadonlyArray<CgChartTextStyle | undefined>
): ChartTextStyle {
  let result = base;
  for (const override of overrides) {
    if (!override) continue;
    result = Object.freeze({
      ...(override.fontFamily ?? result.family ? { family: override.fontFamily ?? result.family } : {}),
      size: override.fontSize ?? result.size,
      color: override.color ?? result.color,
      bold: override.bold ?? result.bold,
      italic: override.italic ?? result.italic,
    });
  }
  return result;
}

/** A stroke, or null when its colour is `none` or its width is zero. */
export function resolveStroke(
  base: ChartStroke,
  override: CgChartStrokeStyle | 'none' | undefined,
): ChartStroke | null {
  if (override === 'none') return null;
  const color = override?.color ?? base.color;
  const width = override?.width ?? base.width;
  if (color === 'none' || width <= 0) return null;
  return Object.freeze({ color, width, dashStyle: override?.dashStyle ?? base.dashStyle });
}

export function isNoPaint(color: string | undefined): boolean {
  return color === 'none' || color === 'transparent';
}

const FIXED_DASHES: Readonly<Record<'solid' | 'dash' | 'dot' | 'dashDot', string | undefined>> = {
  solid: undefined,
  dash: '8 5',
  dot: '2 4',
  dashDot: '8 4 2 4',
};

const PROPORTIONAL_DASHES: Readonly<Record<CgChartDashStyle, ReadonlyArray<number> | undefined>> = {
  solid: undefined,
  dot: [0, 2],
  squareDot: [1, 1],
  dash: [4, 3],
  dashDot: [4, 3, 1, 3],
  dashDotDot: [4, 3, 1, 3, 1, 3],
  longDash: [8, 3],
  longDashDot: [8, 3, 1, 3],
  longDashDotDot: [8, 3, 1, 3, 1, 3],
};

/**
 * SVG dash array for a stroke. The four original styles keep their fixed lengths unless
 * `proportional` is set; the others, and every style when it is set, are multiples of the width
 * as spreadsheet line dashes are. `dot` relies on a round line cap.
 */
export function dashArray(style: CgChartDashStyle, width: number, proportional: boolean): string | undefined {
  if (style === 'solid') return undefined;
  if (!proportional && style in FIXED_DASHES) return FIXED_DASHES[style as keyof typeof FIXED_DASHES];
  // Unknown names (from older or newer callers) fall back to the nearest common dash.
  const pattern = PROPORTIONAL_DASHES[style] ?? PROPORTIONAL_DASHES.dash;
  if (!pattern) return undefined;
  const unit = Math.max(0.5, width);
  return pattern.map((length) => String(Number.parseFloat((length * unit).toFixed(3)))).join(' ');
}

export function lineCapFor(style: CgChartDashStyle, proportional: boolean): 'round' | 'butt' {
  if (!proportional) return 'round';
  return style === 'solid' || style === 'dot' ? 'round' : 'butt';
}

export function cssFont(style: ChartTextStyle, fallbackFamily = 'sans-serif'): string {
  const family = style.family && !style.family.includes('var(') && style.family !== 'inherit' ? style.family : fallbackFamily;
  return `${style.italic ? 'italic ' : ''}${style.bold ? '700' : '400'} ${style.size}px ${family}`;
}

function estimate(text: string, style: ChartTextStyle): number {
  // The estimate is tuned for 13px UI text; scale its em units and allow for bold.
  return (estimateTextWidth(text, style.size) - 2) * (style.bold ? 1.07 : 1);
}

interface OffscreenContext {
  font: string;
  measureText(text: string): { readonly width: number };
}

/**
 * Measures with an offscreen canvas where the browser has one, and estimates otherwise (jsdom,
 * SSR). Results are cached per font and text.
 */
export function createTextMeasurer(fallbackFamily = 'sans-serif'): ChartTextMeasurer {
  let context: OffscreenContext | null = null;
  try {
    const Offscreen = (globalThis as { OffscreenCanvas?: new (width: number, height: number) => { getContext(kind: '2d'): unknown } }).OffscreenCanvas;
    if (typeof Offscreen === 'function') context = new Offscreen(1, 1).getContext('2d') as OffscreenContext | null;
  } catch {
    context = null;
  }
  const cache = new Map<string, number>();
  return (text, style) => {
    if (!text) return 0;
    const font = cssFont(style, fallbackFamily);
    const key = `${font}\u0000${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let width: number;
    if (context) {
      context.font = font;
      width = context.measureText(text).width;
    } else width = estimate(text, style);
    if (cache.size > 4_000) cache.clear();
    cache.set(key, width);
    return width;
  };
}

/** A measurer that never touches the DOM, for tests and server rendering. */
export const estimateText: ChartTextMeasurer = (text, style) => (text ? estimate(text, style) : 0);

function truncateToWidth(text: string, width: number, style: ChartTextStyle, measure: ChartTextMeasurer): string {
  if (measure(text, style) <= width) return text;
  const characters = [...text];
  let low = 0;
  let high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${characters.slice(0, middle).join('').trimEnd()}…`;
    if (measure(candidate, style) <= width) low = middle;
    else high = middle - 1;
  }
  return low <= 0 ? '…' : `${characters.slice(0, low).join('').trimEnd()}…`;
}

/** Shortens text with an ellipsis so it fits `width`. */
export function fitText(text: string, width: number, style: ChartTextStyle, measure: ChartTextMeasurer): string {
  return truncateToWidth(text, Math.max(0, width), style, measure);
}

/**
 * Greedy word wrap into at most `maxLines` lines no wider than `width`. Words longer than a line
 * are broken by character; the last line takes an ellipsis when text remains.
 */
export function wrapText(
  text: string,
  width: number,
  style: ChartTextStyle,
  measure: ChartTextMeasurer,
  maxLines: number,
): ReadonlyArray<string> {
  const limit = Math.max(1, Math.floor(maxLines));
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/u);
  let truncated = false;
  outer: for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measure(candidate, style) <= width) { current = candidate; continue; }
      if (current) {
        lines.push(current);
        if (lines.length >= limit) { truncated = true; break outer; }
      }
      current = word;
      while (measure(current, style) > width && [...current].length > 1) {
        const characters = [...current];
        let take = characters.length - 1;
        while (take > 1 && measure(characters.slice(0, take).join(''), style) > width) take--;
        lines.push(characters.slice(0, take).join(''));
        if (lines.length >= limit) { truncated = true; break outer; }
        current = characters.slice(take).join('');
      }
    }
    lines.push(current);
    if (lines.length >= limit) {
      truncated = paragraphs.indexOf(paragraph) < paragraphs.length - 1;
      break;
    }
  }
  if (lines.length > limit) lines.length = limit;
  if (truncated && lines.length) {
    const last = lines.length - 1;
    lines[last] = truncateToWidth(`${lines[last]}…`, width, style, measure);
  }
  return Object.freeze(lines.length ? lines : ['']);
}
