import type { CgGridKey } from './CgGrid.types';

export function gridKeyToken(value: CgGridKey): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error('CgGrid keySelector returned an invalid Date.');
    return `date:${value.toISOString()}`;
  }
  if (typeof value === 'string') return `string:${value}`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('CgGrid keySelector returned a non-finite number.');
    return `number:${Object.is(value, -0) ? 0 : value}`;
  }
  if (typeof value === 'bigint') return `bigint:${value}`;
  if (typeof value === 'boolean') return `boolean:${value}`;
  throw new Error('CgGrid keySelector returned an unsupported key. Use a string, number, bigint, boolean, or Date.');
}

export function indexGridKeys<TItem>(items: ReadonlyArray<TItem>, selector: (item: TItem) => CgGridKey): ReadonlyMap<string, TItem> {
  const result = new Map<string, TItem>();
  for (const item of items) {
    const token = gridKeyToken(selector(item));
    if (result.has(token)) throw new Error(`CgGrid contains duplicate key '${token}'. Keys must be unique in every loaded result.`);
    result.set(token, item);
  }
  return result;
}
