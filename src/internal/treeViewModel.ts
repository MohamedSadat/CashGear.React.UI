export interface TreeViewModelDescriptor {
  key: string;
  parentKey?: string | null;
  children?: ReadonlyArray<TreeViewModelDescriptor>;
  visible?: boolean;
  disabled?: boolean;
  allowSelection?: boolean;
  allowCheck?: boolean;
}

export interface TreeViewModelNode<TDescriptor extends TreeViewModelDescriptor = TreeViewModelDescriptor> {
  readonly key: string;
  readonly descriptor: TDescriptor;
  readonly parentKey: string | null;
  readonly children: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly depth: number;
  readonly sourceIndex: number;
  readonly modelVisible: boolean;
  readonly siblingPosition: number;
  readonly siblingCount: number;
  readonly checkableDescendantKeys: ReadonlyArray<string>;
}

export interface TreeViewModel<TDescriptor extends TreeViewModelDescriptor = TreeViewModelDescriptor> {
  readonly roots: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly allNodes: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly visibleNodes: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly selectableNodes: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly checkableNodes: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly byKey: ReadonlyMap<string, TreeViewModelNode<TDescriptor>>;
}

export interface NormalizeTreeViewOptions {
  componentName?: string;
  maxDepth?: number;
}

interface MutableNode<TDescriptor extends TreeViewModelDescriptor> {
  key: string;
  descriptor: TDescriptor;
  parentKey: string | null;
  parent: MutableNode<TDescriptor> | null;
  children: MutableNode<TDescriptor>[];
  depth: number;
  sourceIndex: number;
  modelVisible: boolean;
  siblingPosition: number;
  siblingCount: number;
  checkableDescendantKeys: string[];
}

function requiredKey(value: string | undefined, componentName: string): string {
  const key = typeof value === 'string' ? value.trim() : '';
  if (!key) throw new Error(`${componentName} nodes require a non-empty key.`);
  return key;
}

export function normalizeTreeView<TDescriptor extends TreeViewModelDescriptor>(
  descriptors: ReadonlyArray<TDescriptor>,
  options: NormalizeTreeViewOptions = {},
): TreeViewModel<TDescriptor> {
  const componentName = options.componentName ?? 'CgTreeView';
  const maxDepth = options.maxDepth ?? 64;
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new RangeError(`${componentName} maxDepth must be a positive integer.`);
  }

  let hasNested = false;
  let hasParent = false;
  const seenDescriptors = new Set<TreeViewModelDescriptor>();
  const inspect = (items: ReadonlyArray<TDescriptor>, ancestry: ReadonlySet<TreeViewModelDescriptor>, depth: number): void => {
    for (const descriptor of items) {
      if (depth >= maxDepth) throw new Error(`${componentName} node '${String(descriptor.key)}' exceeds ${maxDepth} levels.`);
      if (ancestry.has(descriptor)) throw new Error(`${componentName} contains a cyclic children reference.`);
      if (descriptor.children !== undefined) hasNested = true;
      if (descriptor.parentKey !== undefined) hasParent = true;
      if (seenDescriptors.has(descriptor)) continue;
      seenDescriptors.add(descriptor);
      const nextAncestry = new Set(ancestry);
      nextAncestry.add(descriptor);
      inspect((descriptor.children ?? []) as ReadonlyArray<TDescriptor>, nextAncestry, depth + 1);
    }
  };
  inspect(descriptors, new Set(), 0);
  if (hasNested && hasParent) {
    throw new Error(`${componentName} cannot mix children collections with parentKey relationships.`);
  }

  const byKeyMutable = new Map<string, MutableNode<TDescriptor>>();
  let sourceIndex = 0;
  const createNode = (descriptor: TDescriptor, parent: MutableNode<TDescriptor> | null, depth: number): MutableNode<TDescriptor> => {
    if (depth >= maxDepth) {
      throw new Error(`${componentName} node '${descriptor.key}' exceeds ${maxDepth} levels.`);
    }
    const key = requiredKey(descriptor.key, componentName);
    if (byKeyMutable.has(key)) throw new Error(`${componentName} contains duplicate key '${key}'.`);
    const node: MutableNode<TDescriptor> = {
      key,
      descriptor,
      parentKey: parent?.key ?? null,
      parent,
      children: [],
      depth,
      sourceIndex: sourceIndex++,
      modelVisible: false,
      siblingPosition: 0,
      siblingCount: 0,
      checkableDescendantKeys: [],
    };
    byKeyMutable.set(key, node);
    return node;
  };

  let mutableRoots: MutableNode<TDescriptor>[];
  if (hasParent) {
    const ordered: MutableNode<TDescriptor>[] = [];
    for (const descriptor of descriptors) ordered.push(createNode(descriptor, null, 0));
    for (const node of ordered) {
      if (node.descriptor.parentKey !== undefined && node.descriptor.parentKey !== null && typeof node.descriptor.parentKey !== 'string') {
        throw new Error(`${componentName} node '${node.key}' has an invalid parentKey.`);
      }
      const parentKey = node.descriptor.parentKey?.trim() || null;
      if (parentKey === null) continue;
      if (parentKey === node.key) throw new Error(`${componentName} node '${node.key}' cannot parent itself.`);
      const parent = byKeyMutable.get(parentKey);
      if (!parent) throw new Error(`${componentName} node '${node.key}' references missing parent '${parentKey}'.`);
      node.parent = parent;
      node.parentKey = parent.key;
      parent.children.push(node);
    }
    const states = new Map<string, 0 | 1 | 2>();
    const resolveDepth = (node: MutableNode<TDescriptor>, path: string[]): number => {
      const state = states.get(node.key) ?? 0;
      if (state === 2) return node.depth;
      if (state === 1) throw new Error(`${componentName} parent cycle: ${[...path, node.key].join(' -> ')}.`);
      states.set(node.key, 1);
      node.depth = node.parent ? resolveDepth(node.parent, [...path, node.key]) + 1 : 0;
      if (node.depth >= maxDepth) throw new Error(`${componentName} node '${node.key}' exceeds ${maxDepth} levels.`);
      states.set(node.key, 2);
      return node.depth;
    };
    for (const node of ordered) resolveDepth(node, []);
    mutableRoots = ordered.filter((node) => node.parent === null);
  } else {
    const buildNested = (
      descriptor: TDescriptor,
      parent: MutableNode<TDescriptor> | null,
      depth: number,
    ): MutableNode<TDescriptor> => {
      const node = createNode(descriptor, parent, depth);
      node.children = ((descriptor.children ?? []) as ReadonlyArray<TDescriptor>)
        .map((child) => buildNested(child, node, depth + 1));
      return node;
    };
    mutableRoots = descriptors.map((descriptor) => buildNested(descriptor, null, 0));
  }

  const preorder: MutableNode<TDescriptor>[] = [];
  const decorate = (siblings: MutableNode<TDescriptor>[], ancestorVisible: boolean): void => {
    const visibleSiblings = siblings.filter((node) => ancestorVisible && node.descriptor.visible !== false);
    const positions = new Map(visibleSiblings.map((node, index) => [node.key, index + 1]));
    for (const node of siblings) {
      node.modelVisible = ancestorVisible && node.descriptor.visible !== false;
      node.siblingPosition = positions.get(node.key) ?? 0;
      node.siblingCount = node.modelVisible ? visibleSiblings.length : 0;
      preorder.push(node);
      decorate(node.children, node.modelVisible);
    }
  };
  decorate(mutableRoots, true);

  for (const node of [...preorder].reverse()) {
    node.checkableDescendantKeys = node.children.flatMap((child) => [
      ...(child.modelVisible && child.descriptor.disabled !== true && child.descriptor.allowCheck !== false ? [child.key] : []),
      ...child.checkableDescendantKeys,
    ]);
  }

  const project = (node: MutableNode<TDescriptor>): TreeViewModelNode<TDescriptor> => {
    const projected = {
      key: node.key,
      descriptor: node.descriptor,
      parentKey: node.parentKey,
      children: Object.freeze(node.children.map(project)),
      depth: node.depth,
      sourceIndex: node.sourceIndex,
      modelVisible: node.modelVisible,
      siblingPosition: node.siblingPosition,
      siblingCount: node.siblingCount,
      checkableDescendantKeys: Object.freeze([...node.checkableDescendantKeys]),
    } satisfies TreeViewModelNode<TDescriptor>;
    return Object.freeze(projected);
  };
  const roots = Object.freeze(mutableRoots.map(project));
  const allNodes: TreeViewModelNode<TDescriptor>[] = [];
  const collect = (nodes: ReadonlyArray<TreeViewModelNode<TDescriptor>>): void => {
    for (const node of nodes) { allNodes.push(node); collect(node.children); }
  };
  collect(roots);
  const byKey = new Map(allNodes.map((node) => [node.key, node]));
  const visibleNodes = allNodes.filter((node) => node.modelVisible);
  return Object.freeze({
    roots,
    allNodes: Object.freeze(allNodes),
    visibleNodes: Object.freeze(visibleNodes),
    selectableNodes: Object.freeze(visibleNodes.filter((node) => node.descriptor.disabled !== true && node.descriptor.allowSelection !== false)),
    checkableNodes: Object.freeze(visibleNodes.filter((node) => node.descriptor.disabled !== true && node.descriptor.allowCheck !== false)),
    byKey,
  });
}
