import type { CSSProperties } from 'react';

export interface FormLayoutSpans {
  xs?: number; sm?: number; md?: number; lg?: number; xl?: number; xxl?: number;
}

export function resolveFormLayoutSpans(spans: FormLayoutSpans, itemDefaults: boolean): readonly [number, number, number, number, number, number] {
  for (const [name, value] of Object.entries(spans)) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 12)) throw new RangeError(`CgFormLayout ${name} span must be an integer from 1 through 12.`);
  }
  const defaults = itemDefaults ? [12, 12, 6, 6, 6, 6] as const : [12, 12, 12, 12, 12, 12] as const;
  const supplied = [spans.xs, spans.sm, spans.md, spans.lg, spans.xl, spans.xxl];
  const firstSupplied = supplied.findIndex((value) => value !== undefined);
  if (firstSupplied < 0) return defaults;
  const resolved: number[] = [];
  let previous: number | undefined;
  for (let index = 0; index < supplied.length; index += 1) {
    const value = supplied[index];
    if (value !== undefined) previous = value;
    resolved.push(index < firstSupplied ? 12 : previous!);
  }
  return resolved as unknown as readonly [number, number, number, number, number, number];
}

export function formLayoutSpanStyle(spans: FormLayoutSpans, itemDefaults: boolean): CSSProperties {
  const [xs, sm, md, lg, xl, xxl] = resolveFormLayoutSpans(spans, itemDefaults);
  return { '--cg-fl-xs': xs, '--cg-fl-sm': sm, '--cg-fl-md': md, '--cg-fl-lg': lg, '--cg-fl-xl': xl, '--cg-fl-xxl': xxl } as CSSProperties;
}
