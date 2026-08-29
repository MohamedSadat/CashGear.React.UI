export interface ParsedDrawerLength {
  readonly value: number;
  readonly unit: string;
  readonly css: string;
}

const PATTERN = /^(?:(\d+(?:\.\d*)?|\.\d+))(px|%|rem|em|vw|vh|vmin|vmax|ch)?$/iu;

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function parseDrawerLength(value: number | string | undefined, name: string, fallback: string): ParsedDrawerLength {
  const candidate = value === undefined || (typeof value === 'string' && !value.trim()) ? fallback : value;
  if (typeof candidate === 'number') {
    if (!Number.isFinite(candidate) || candidate < 0) throw new Error(`CgDrawer ${name} must be a finite nonnegative CSS length.`);
    return Object.freeze({ value: candidate, unit: 'px', css: `${formatNumber(candidate)}px` });
  }
  const match = PATTERN.exec(candidate.trim().toLowerCase());
  if (!match) throw new Error(`CgDrawer ${name} must be a nonnegative CSS length.`);
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 0) throw new Error(`CgDrawer ${name} contains an invalid numeric value.`);
  const unit = (match[2] ?? 'px').toLowerCase();
  return Object.freeze({ value: number, unit, css: `${formatNumber(number)}${unit}` });
}

export function transitionMilliseconds(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const durations = style.transitionDuration.split(',').map(parseCssTime);
  const delays = style.transitionDelay.split(',').map(parseCssTime);
  let maximum = 0;
  for (let index = 0; index < durations.length; index += 1) {
    maximum = Math.max(maximum, (durations[index] ?? 0) + (delays[index] ?? delays[0] ?? 0));
  }
  return maximum;
}

function parseCssTime(value: string): number {
  const text = value.trim();
  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return 0;
  return text.endsWith('ms') ? number : number * 1000;
}
