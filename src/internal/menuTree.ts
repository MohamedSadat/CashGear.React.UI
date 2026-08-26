import type { MenuDescriptor, MenuNode, NormalizeMenuOptions } from './menuTypes';
import { validateSafeUrl } from './routeMatch';

function keyOf(value: string | undefined, componentName: string): string {
  const key = value?.trim();
  if (!key) throw new Error(`${componentName} items require a non-empty key.`);
  return key;
}

export function validateMenuUrl(value: string | undefined, componentName = 'Menu'): string | undefined {
  return validateSafeUrl(value, componentName);
}

function cloneNode<TData>(
  item: MenuDescriptor<TData>,
  key: string,
  depth: number,
  sourceIndex: number,
  children: ReadonlyArray<MenuNode<TData>>,
  options: NormalizeMenuOptions,
): MenuNode<TData> {
  const separator = item.separator === true;
  const text = item.text ?? '';
  if (!separator && options.requireText !== false && !text.trim()) {
    throw new Error(`${options.componentName} item '${key}' requires non-empty text.`);
  }
  if (item.radioGroup?.trim() && item.checked === undefined) {
    throw new Error(`${options.componentName} item '${key}' sets radioGroup without checked state.`);
  }
  const href = validateMenuUrl(item.href, options.componentName);
  if (children.length > 0 && options.allowBranchAction !== true
    && (href !== undefined || item.onActivate !== undefined || item.checked !== undefined)) {
    throw new Error(`${options.componentName} branch '${key}' cannot be actionable or checkable.`);
  }
  return Object.freeze({
    key,
    ...(item.parentKey?.trim() ? { parentKey: item.parentKey.trim() } : {}),
    text,
    ...(item.icon !== undefined ? { icon: item.icon } : {}),
    visible: item.visible !== false,
    disabled: item.disabled === true,
    separator,
    beginGroup: item.beginGroup === true,
    ...(item.tooltip !== undefined ? { tooltip: item.tooltip } : {}),
    ...(item.className !== undefined ? { className: item.className } : {}),
    intent: item.intent ?? 'neutral',
    ...(item.badge !== undefined ? { badge: item.badge } : {}),
    ...(item.shortcut !== undefined ? { shortcut: item.shortcut } : {}),
    ...(href !== undefined ? { href } : {}),
    ...(item.target !== undefined ? { target: item.target } : {}),
    routeMatch: item.routeMatch ?? 'prefix',
    ...(item.checked !== undefined ? { checked: item.checked } : {}),
    ...(item.radioGroup?.trim() ? { radioGroup: item.radioGroup.trim() } : {}),
    ...(item.data !== undefined ? { data: item.data } : {}),
    adaptivePriority: item.adaptivePriority ?? 0,
    sourceIndex,
    depth,
    children: Object.freeze([...children]),
    ...(item.onActivate !== undefined ? { onActivate: item.onActivate } : {}),
  });
}

function normalizeSeparators<TData>(nodes: ReadonlyArray<MenuNode<TData>>): ReadonlyArray<MenuNode<TData>> {
  const result: MenuNode<TData>[] = [];
  for (const node of nodes) {
    if (node.beginGroup && result.length > 0 && !result.at(-1)?.separator) {
      result.push(Object.freeze({
        key: `__cg-group-${node.key}`,
        text: '',
        visible: true,
        disabled: true,
        separator: true,
        beginGroup: false,
        intent: 'neutral',
        routeMatch: 'prefix',
        adaptivePriority: node.adaptivePriority,
        sourceIndex: node.sourceIndex - 0.5,
        depth: node.depth,
        children: Object.freeze([]),
      }));
    }
    if (node.separator && (result.length === 0 || result.at(-1)?.separator)) continue;
    result.push(node);
  }
  while (result.at(-1)?.separator) result.pop();
  return Object.freeze(result);
}

function prune<TData>(nodes: ReadonlyArray<MenuNode<TData>>, pruneEmptyParents: boolean): ReadonlyArray<MenuNode<TData>> {
  const visible: MenuNode<TData>[] = [];
  for (const node of nodes) {
    if (!node.visible) continue;
    const children = prune(node.children, pruneEmptyParents);
    const actionable = node.href !== undefined || node.onActivate !== undefined || node.checked !== undefined;
    if (pruneEmptyParents && node.children.length > 0 && children.length === 0 && !actionable) continue;
    visible.push(children === node.children ? node : Object.freeze({ ...node, children }));
  }
  return normalizeSeparators(visible);
}

export function normalizeMenuTree<TData>(
  items: ReadonlyArray<MenuDescriptor<TData>>,
  options: NormalizeMenuOptions,
): ReadonlyArray<MenuNode<TData>> {
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 1) {
    throw new RangeError(`${options.componentName} maxDepth must be a positive integer.`);
  }
  const keys = new Set<string>();
  const hasNested = items.some((item) => item.children !== undefined);
  const hasParents = items.some((item) => Boolean(item.parentKey?.trim()));
  if (hasNested && hasParents) {
    throw new Error(`${options.componentName} cannot mix children collections with parentKey relationships.`);
  }
  if (hasParents && options.allowFlat === false) {
    throw new Error(`${options.componentName} does not support parentKey relationships.`);
  }
  let sourceIndex = 0;
  const register = (item: MenuDescriptor<TData>) => {
    const key = keyOf(item.key, options.componentName);
    if (keys.has(key)) throw new Error(`${options.componentName} contains duplicate key '${key}'.`);
    keys.add(key);
    return key;
  };
  const registerAll = (source: ReadonlyArray<MenuDescriptor<TData>>) => {
    for (const item of source) {
      register(item);
      registerAll(item.children ?? []);
    }
  };
  registerAll(items);

  let roots: ReadonlyArray<MenuNode<TData>>;
  if (hasParents) {
    const entries = items.map((item) => ({ item, key: keyOf(item.key, options.componentName), children: [] as MenuNode<TData>[] }));
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    for (const entry of entries) {
      const parentKey = entry.item.parentKey?.trim();
      if (!parentKey) continue;
      if (parentKey === entry.key) throw new Error(`${options.componentName} item '${entry.key}' cannot parent itself.`);
      if (!byKey.has(parentKey)) throw new Error(`${options.componentName} item '${entry.key}' references missing parent '${parentKey}'.`);
    }
    const depthFor = (entry: (typeof entries)[number], path: string[] = []): number => {
      if (path.includes(entry.key)) throw new Error(`${options.componentName} parent cycle: ${[...path, entry.key].join(' -> ')}.`);
      const parentKey = entry.item.parentKey?.trim();
      return parentKey ? depthFor(byKey.get(parentKey)!, [...path, entry.key]) + 1 : 0;
    };
    const built = new Map<string, MenuNode<TData>>();
    const build = (entry: (typeof entries)[number]): MenuNode<TData> => {
      const existing = built.get(entry.key);
      if (existing) return existing;
      const depth = depthFor(entry);
      if (depth >= options.maxDepth) throw new Error(`${options.componentName} item '${entry.key}' exceeds ${options.maxDepth} levels.`);
      const children = entries.filter((candidate) => candidate.item.parentKey?.trim() === entry.key).map(build);
      const node = cloneNode(entry.item, entry.key, depth, sourceIndex++, children, options);
      built.set(entry.key, node);
      return node;
    };
    roots = entries.filter((entry) => !entry.item.parentKey?.trim()).map(build);
  } else {
    const ancestry = new Set<MenuDescriptor<TData>>();
    const build = (item: MenuDescriptor<TData>, depth: number): MenuNode<TData> => {
      if (depth >= options.maxDepth) throw new Error(`${options.componentName} exceeds ${options.maxDepth} levels.`);
      if (ancestry.has(item)) throw new Error(`${options.componentName} contains a cyclic children reference.`);
      ancestry.add(item);
      const key = keyOf(item.key, options.componentName);
      const children = (item.children ?? []).map((child) => build(child, depth + 1));
      ancestry.delete(item);
      return cloneNode(item, key, depth, sourceIndex++, children, options);
    };
    roots = items.map((item) => build(item, 0));
  }
  const checkedGroups = new Map<string, number>();
  for (const node of flattenMenu(roots)) {
    if (node.radioGroup && node.checked) checkedGroups.set(node.radioGroup, (checkedGroups.get(node.radioGroup) ?? 0) + 1);
  }
  for (const [group, count] of checkedGroups) {
    if (count > 1) throw new Error(`${options.componentName} radio group '${group}' has more than one checked item.`);
  }
  return prune(roots, options.pruneEmptyParents !== false);
}

export function flattenMenu<TData>(nodes: ReadonlyArray<MenuNode<TData>>): ReadonlyArray<MenuNode<TData>> {
  return nodes.flatMap((node) => [node, ...flattenMenu(node.children)]);
}

export function containsEnabledLeaf<TData>(node: MenuNode<TData>): boolean {
  return !node.disabled && !node.separator && (node.children.length === 0 || node.children.some(containsEnabledLeaf));
}

export function proposeMenuCheck<TData>(nodes: ReadonlyArray<MenuNode<TData>>, key: string): ReadonlyArray<MenuNode<TData>> {
  const target = flattenMenu(nodes).find((node) => node.key === key);
  if (!target || target.checked === undefined) return nodes;
  const update = (source: ReadonlyArray<MenuNode<TData>>): ReadonlyArray<MenuNode<TData>> => source.map((node) => {
    const children = update(node.children);
    let checked = node.checked;
    if (node.key === key) checked = target.radioGroup ? true : !target.checked;
    else if (target.radioGroup && node.radioGroup === target.radioGroup && node.checked !== undefined) checked = false;
    if (children === node.children && checked === node.checked) return node;
    return Object.freeze({ ...node, children, ...(checked !== undefined ? { checked } : {}) });
  });
  return update(nodes);
}
