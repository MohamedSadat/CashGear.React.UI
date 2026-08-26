export function moveRovingKey(
  keys: ReadonlyArray<string>,
  currentKey: string | undefined,
  movement: 'next' | 'previous' | 'first' | 'last',
): string | undefined {
  if (keys.length === 0) return undefined;
  if (movement === 'first') return keys[0];
  if (movement === 'last') return keys.at(-1);
  const current = Math.max(0, keys.indexOf(currentKey ?? ''));
  const delta = movement === 'next' ? 1 : -1;
  return keys[(current + delta + keys.length) % keys.length];
}
