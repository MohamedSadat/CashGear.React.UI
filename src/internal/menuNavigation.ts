import type { MenuNode } from './menuTypes';

function normalizedLocation(value: string): URL {
  return new URL(value, typeof window === 'undefined' ? 'https://cashgear.invalid/' : window.location.href);
}

export function findRouteMenuItem<TData>(
  nodes: ReadonlyArray<MenuNode<TData>>,
  currentLocation: string,
): MenuNode<TData> | undefined {
  const current = normalizedLocation(currentLocation);
  let best: MenuNode<TData> | undefined;
  let score = -1;
  const visit = (items: ReadonlyArray<MenuNode<TData>>) => {
    for (const item of items) {
      if (item.href) {
        const target = new URL(item.href, current.href);
        if (target.origin === current.origin) {
          const exact = current.pathname === target.pathname
            && (!target.search || current.search === target.search)
            && (!target.hash || current.hash === target.hash);
          const prefix = current.pathname === target.pathname
            || current.pathname.startsWith(`${target.pathname.replace(/\/$/, '')}/`);
          if ((item.routeMatch === 'exact' ? exact : prefix)) {
            const candidate = target.pathname.length * 4 + (target.search ? 2 : 0) + (target.hash ? 1 : 0);
            if (candidate > score) { best = item; score = candidate; }
          }
        }
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
