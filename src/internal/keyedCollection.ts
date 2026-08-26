export interface CgKeyedItem { key: string }

export function validateKeyedItems<T extends CgKeyedItem>(items: ReadonlyArray<T>, componentName: string): void {
  const keys = new Set<string>();
  for (const item of items) {
    if (!item.key.trim()) throw new Error(`${componentName} items require a nonempty key.`);
    if (keys.has(item.key)) throw new Error(`${componentName} contains duplicate key '${item.key}'.`);
    keys.add(item.key);
  }
}

export function reconcileAvailableKey<T extends CgKeyedItem>(
  items: ReadonlyArray<T>,
  requestedKey: string | null | undefined,
  previousIndex: number,
  isAvailable: (item: T) => boolean,
  preference: 'forward-then-backward' | 'previous-then-first',
): string | null {
  if (requestedKey != null) {
    const requested = items.find((item) => item.key === requestedKey);
    if (requested && isAvailable(requested)) return requested.key;
  }
  if (items.length === 0) return null;
  if (preference === 'previous-then-first') {
    for (let index = Math.min(previousIndex - 1, items.length - 1); index >= 0; index -= 1) {
      const item = items[index];
      if (item && isAvailable(item)) return item.key;
    }
    return items.find(isAvailable)?.key ?? null;
  }
  const start = Math.max(0, Math.min(previousIndex, items.length));
  for (let index = start; index < items.length; index += 1) {
    const item = items[index];
    if (item && isAvailable(item)) return item.key;
  }
  for (let index = Math.min(start - 1, items.length - 1); index >= 0; index -= 1) {
    const item = items[index];
    if (item && isAvailable(item)) return item.key;
  }
  return null;
}

export function stableKeyToken(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const readable = key.replace(/[^a-zA-Z0-9_-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 24) || 'item';
  return `${readable}-${(hash >>> 0).toString(36)}`;
}
