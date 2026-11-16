import { normalizeListBoxSearch } from '../../internal/listBox';
import type { CgCommandMenuItem } from './CgCommandMenu.types';

const WORD = /[\s\-_/.,:;()]+/u;

/**
 * The default match: every typed word starts a word of the label or keywords, or the label holds
 * the whole query. Case and Arabic marks (tashkeel, tatweel) are ignored.
 */
export function commandMatches<TData>(item: CgCommandMenuItem<TData>, query: string, locale?: string): boolean {
  const needle = normalizeListBoxSearch(query, locale);
  if (!needle) return true;
  const label = normalizeListBoxSearch(item.label, locale);
  if (label.includes(needle)) return true;
  const words = [label, ...(item.keywords ?? []).map((keyword) => normalizeListBoxSearch(keyword, locale))].flatMap((text) => text.split(WORD)).filter(Boolean);
  return needle.split(' ').every((part) => words.some((word) => word.startsWith(part)));
}

export interface CommandGroup<TData> {
  name: string | undefined;
  items: Array<{ item: CgCommandMenuItem<TData>; index: number }>;
}

/** Items grouped in the order each group first appears; `index` is the item's place in the flat order drawn. */
export function groupCommands<TData>(items: ReadonlyArray<CgCommandMenuItem<TData>>): { groups: CommandGroup<TData>[]; flat: CgCommandMenuItem<TData>[] } {
  const groups: CommandGroup<TData>[] = [];
  const byName = new Map<string | undefined, CommandGroup<TData>>();
  for (const item of items) {
    let group = byName.get(item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      byName.set(item.group, group);
      groups.push(group);
    }
    group.items.push({ item, index: -1 });
  }
  const flat: CgCommandMenuItem<TData>[] = [];
  for (const group of groups) for (const entry of group.items) { entry.index = flat.length; flat.push(entry.item); }
  return { groups, flat };
}
