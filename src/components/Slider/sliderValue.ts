export interface SliderRange {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

function decimalPlaces(value: number): number {
  const [mantissa = '', exponent = '0'] = String(value).split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

export function clampSliderValue(value: number, { min, max }: SliderRange): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to the nearest step counted from `min`. `max` stays reachable even when it is off the grid. */
export function snapSliderValue(value: number, range: SliderRange): number {
  const { min, max, step } = range;
  const clamped = clampSliderValue(value, range);
  const places = Math.min(100, Math.max(decimalPlaces(min), decimalPlaces(step)));
  const snapped = Number((min + Math.round((clamped - min) / step) * step).toFixed(places));
  return snapped > max || max - clamped < Math.abs(snapped - clamped) ? max : snapped;
}

/** Moves a whole number of steps. From between two steps, the next one in that direction counts as the first. */
export function stepSliderValue(value: number, steps: number, range: SliderRange): number {
  const { min, step } = range;
  const position = (value - min) / step;
  const nearest = Math.round(position);
  const base = Math.abs(position - nearest) < 1e-9 ? nearest : steps > 0 ? Math.floor(position) : Math.ceil(position);
  return snapSliderValue(min + (base + steps) * step, range);
}
