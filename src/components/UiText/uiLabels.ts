import { useMemo } from 'react';
import type { CgUiText } from './CgUiText.types';
import { useCgUiText } from './CgUiText';

const translatedDefaults = new WeakMap<CgUiText, WeakMap<object, object>>();

function translateValue(value: unknown, uiText: CgUiText): unknown {
  if (typeof value === 'string') return value ? uiText.translate(value) : value;
  if (value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, translateValue(entry, uiText)]));
  }
  return value;
}

/**
 * Translates every string in a component's English label defaults (nested
 * plain objects too). Functions and other values pass through unchanged.
 * Results are cached per translator and defaults object.
 */
export function translateUiLabels<T extends object>(defaults: T, uiText: CgUiText): T {
  let cache = translatedDefaults.get(uiText);
  if (!cache) { cache = new WeakMap(); translatedDefaults.set(uiText, cache); }
  const cached = cache.get(defaults);
  if (cached) return cached as T;
  const translated = translateValue(defaults, uiText) as T;
  cache.set(defaults, translated);
  return translated;
}

/**
 * Merges labels the page passed over the translated defaults. A passed label
 * always wins and is never translated; `undefined` entries fall back to the
 * default.
 */
export function mergeUiLabels<T extends object>(defaults: T, uiText: CgUiText, overrides?: Partial<T> | null, translateDefaults = true): T {
  const translated = translateDefaults ? translateUiLabels(defaults, uiText) : defaults;
  if (!overrides) return translated;
  const merged = { ...translated } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) if (value !== undefined) merged[key] = value;
  return merged as T;
}

/**
 * `mergeUiLabels` with the nearest provider's translator, memoized on the
 * passed labels. Pass `translateDefaults: false` for a built-in set that is
 * already in the user's language, such as a component's own Arabic labels.
 */
export function useUiLabels<T extends object>(defaults: T, overrides?: Partial<T> | null, translateDefaults = true): T {
  const uiText = useCgUiText();
  return useMemo(() => mergeUiLabels(defaults, uiText, overrides, translateDefaults), [defaults, uiText, overrides, translateDefaults]);
}

/** One built-in text: the passed value when given, else the translated English default. */
export function useUiString(english: string, explicit?: string | null): string {
  const uiText = useCgUiText();
  return explicit ?? uiText.translate(english);
}
