import { validateSafeUrl } from './routeMatch';

export interface AccordionTreeDescriptor<TData = unknown> {
  key: string;
  text: string;
  parentKey?: string;
  children?: ReadonlyArray<AccordionTreeDescriptor<TData>>;
  navigateUrl?: string;
  visible?: boolean;
  disabled?: boolean;
  selectable?: boolean;
  expandable?: boolean;
  hasChildren?: boolean;
  data?: TData;
}

export interface AccordionTreeNode<TDescriptor extends AccordionTreeDescriptor = AccordionTreeDescriptor> {
  readonly key: string;
  readonly descriptor: TDescriptor;
  readonly parentKey?: string;
  readonly depth: number;
  readonly sourceIndex: number;
  readonly navigateUrl?: string;
  readonly children: ReadonlyArray<AccordionTreeNode<TDescriptor>>;
}

export interface NormalizeAccordionTreeOptions {
  componentName?: string;
  maxDepth?: number;
  canLoadChildren?: boolean;
}

export function flattenAccordionTree<T extends AccordionTreeDescriptor>(
  nodes: ReadonlyArray<AccordionTreeNode<T>>,
): ReadonlyArray<AccordionTreeNode<T>> {
  return nodes.flatMap((node) => [node, ...flattenAccordionTree(node.children)]);
}

export function normalizeAccordionTree<T extends AccordionTreeDescriptor>(
  items: ReadonlyArray<T>,
  options: NormalizeAccordionTreeOptions = {},
): ReadonlyArray<AccordionTreeNode<T>> {
  const componentName = options.componentName ?? 'CgAccordion';
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) throw new RangeError(`${componentName} maxDepth must be a positive integer.`);

  const keys = new Set<string>();
  let hasNested = false;
  let hasParent = false;
  const registerAll = (source: ReadonlyArray<T>, ancestry: ReadonlySet<T> = new Set()) => {
    for (const item of source) {
      if (ancestry.has(item)) throw new Error(`${componentName} contains a cyclic children reference.`);
      const key = item.key?.trim();
      if (!key) throw new Error(`${componentName} items require a non-empty key.`);
      if (keys.has(key)) throw new Error(`${componentName} contains duplicate key '${key}'.`);
      keys.add(key);
      if (!item.text?.trim()) throw new Error(`${componentName} item '${key}' requires non-empty text.`);
      if (item.children !== undefined) hasNested = true;
      if (item.parentKey !== undefined) hasParent = true;
      validateSafeUrl(item.navigateUrl, componentName);
      if (item.hasChildren && item.children === undefined && options.canLoadChildren !== true) {
        throw new Error(`${componentName} item '${key}' declares hasChildren without loadChildren.`);
      }
      const next = new Set(ancestry); next.add(item);
      registerAll((item.children ?? []) as ReadonlyArray<T>, next);
    }
  };
  registerAll(items);
  if (hasNested && hasParent) throw new Error(`${componentName} cannot mix children collections with parentKey relationships.`);

  let sourceIndex = 0;
  const createNode = (item: T, depth: number, parentKey: string | undefined, children: ReadonlyArray<AccordionTreeNode<T>>) => {
    if (depth >= maxDepth) throw new Error(`${componentName} item '${item.key}' exceeds ${maxDepth} levels.`);
    const navigateUrl = validateSafeUrl(item.navigateUrl, componentName);
    return Object.freeze({
      key: item.key.trim(), descriptor: item, ...(parentKey ? { parentKey } : {}), depth,
      sourceIndex: sourceIndex++, ...(navigateUrl ? { navigateUrl } : {}), children: Object.freeze([...children]),
    });
  };

  let roots: ReadonlyArray<AccordionTreeNode<T>>;
  if (hasParent) {
    const entries = items.map((item) => ({ item, key: item.key.trim() }));
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    for (const entry of entries) {
      const parentKey = entry.item.parentKey?.trim();
      if (!parentKey) continue;
      if (parentKey === entry.key) throw new Error(`${componentName} item '${entry.key}' cannot parent itself.`);
      if (!byKey.has(parentKey)) throw new Error(`${componentName} item '${entry.key}' references missing parent '${parentKey}'.`);
    }
    const depthFor = (entry: (typeof entries)[number], path: string[] = []): number => {
      if (path.includes(entry.key)) throw new Error(`${componentName} parent cycle: ${[...path, entry.key].join(' -> ')}.`);
      const parentKey = entry.item.parentKey?.trim();
      return parentKey ? depthFor(byKey.get(parentKey)!, [...path, entry.key]) + 1 : 0;
    };
    const build = (entry: (typeof entries)[number]): AccordionTreeNode<T> => {
      const depth = depthFor(entry);
      const children = entries.filter((candidate) => candidate.item.parentKey?.trim() === entry.key).map(build);
      return createNode(entry.item, depth, entry.item.parentKey?.trim(), children);
    };
    roots = entries.filter((entry) => !entry.item.parentKey?.trim()).map(build);
  } else {
    const build = (item: T, depth: number, parentKey?: string): AccordionTreeNode<T> => {
      if (depth >= maxDepth) throw new Error(`${componentName} item '${item.key}' exceeds ${maxDepth} levels.`);
      const children = ((item.children ?? []) as ReadonlyArray<T>).map((child) => build(child, depth + 1, item.key.trim()));
      return createNode(item, depth, parentKey, children);
    };
    roots = items.map((item) => build(item, 0));
  }

  const prune = (nodes: ReadonlyArray<AccordionTreeNode<T>>): ReadonlyArray<AccordionTreeNode<T>> => Object.freeze(
    nodes.flatMap((node) => {
      if (node.descriptor.visible === false) return [];
      const children = prune(node.children);
      return [children === node.children ? node : Object.freeze({ ...node, children })];
    }),
  );
  return prune(roots);
}
