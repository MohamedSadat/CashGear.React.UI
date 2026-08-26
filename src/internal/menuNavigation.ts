import type { MenuNode } from './menuTypes';
import { routeMatchScore } from './routeMatch';

export function findRouteMenuItem<TData>(
  nodes: ReadonlyArray<MenuNode<TData>>,
  currentLocation: string,
): MenuNode<TData> | undefined {
  let best: MenuNode<TData> | undefined;
  let score = -1;
  const visit = (items: ReadonlyArray<MenuNode<TData>>) => {
    for (const item of items) {
      if (item.href) {
        const candidate = routeMatchScore(item.href, currentLocation, item.routeMatch, { allowAbsolute: true });
        if (candidate > score) { best = item; score = candidate; }
      }
      visit(item.children);
    }
  };
  visit(nodes);
  return best;
}

export function enabledMenuItems<TData>(nodes: ReadonlyArray<MenuNode<TData>>): ReadonlyArray<MenuNode<TData>> {
  return nodes.filter((node) => !node.separator && !node.disabled);
}

export function findTypeaheadItem<TData>(
  nodes: ReadonlyArray<MenuNode<TData>>,
  query: string,
  locale: string | undefined,
  afterKey: string | undefined,
): MenuNode<TData> | undefined {
  const candidates = enabledMenuItems(nodes);
  if (candidates.length === 0) return undefined;
  const collator = new Intl.Collator(locale, { sensitivity: 'base', usage: 'search' });
  const start = Math.max(0, candidates.findIndex((node) => node.key === afterKey) + 1);
  const ordered = [...candidates.slice(start), ...candidates.slice(0, start)];
  return ordered.find((node) => collator.compare(node.text.slice(0, query.length), query) === 0);
}
