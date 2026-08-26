import type { TreeViewModel, TreeViewModelDescriptor, TreeViewModelNode } from './treeViewModel';

export interface TreeViewTextFragment { readonly text: string; readonly matched: boolean }

export interface TreeViewFilterResult<TDescriptor extends TreeViewModelDescriptor> {
  readonly active: boolean;
  readonly query: string;
  readonly roots: ReadonlyArray<TreeViewModelNode<TDescriptor>>;
  readonly includedKeys: ReadonlySet<string>;
  readonly matchedKeys: ReadonlySet<string>;
  readonly forcedExpandedKeys: ReadonlySet<string>;
  readonly childrenByKey: ReadonlyMap<string, ReadonlyArray<TreeViewModelNode<TDescriptor>>>;
}

export interface TreeViewFilterOptions<TDescriptor extends TreeViewModelDescriptor> {
  minimumLength?: number;
  locale?: string;
  text: (descriptor: TDescriptor) => unknown;
  searchText?: (descriptor: TDescriptor) => string | undefined;
  predicate?: (descriptor: TDescriptor, normalizedQuery: string) => boolean;
}

export function normalizeTreeViewFilter(value: string, minimumLength = 1, locale?: string): string {
  if (!Number.isInteger(minimumLength) || minimumLength < 0) {
    throw new RangeError('CgTreeView filterMinimumLength must be a nonnegative integer.');
  }
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length >= minimumLength ? trimmed.toLocaleLowerCase(locale) : '';
}

export function filterTreeViewModel<TDescriptor extends TreeViewModelDescriptor>(
  model: TreeViewModel<TDescriptor>,
  value: string,
  options: TreeViewFilterOptions<TDescriptor>,
): TreeViewFilterResult<TDescriptor> {
  const query = normalizeTreeViewFilter(value, options.minimumLength, options.locale);
  const included = new Set<string>();
  const matched = new Set<string>();
  const forced = new Set<string>();
  const childrenByKey = new Map<string, ReadonlyArray<TreeViewModelNode<TDescriptor>>>();
  if (!query) {
    for (const node of model.visibleNodes) {
      included.add(node.key);
      childrenByKey.set(node.key, Object.freeze(node.children.filter((child) => child.modelVisible)));
    }
    return Object.freeze({
      active: false,
      query,
      roots: Object.freeze(model.roots.filter((node) => node.modelVisible)),
      includedKeys: included,
      matchedKeys: matched,
      forcedExpandedKeys: forced,
      childrenByKey,
    });
  }

  for (const node of [...model.allNodes].reverse()) {
    if (!node.modelVisible) continue;
    const text = options.text(node.descriptor);
    const searchable = `${typeof text === 'string' ? text : ''} ${options.searchText?.(node.descriptor) ?? ''}`
      .toLocaleLowerCase(options.locale);
    const ownMatch = options.predicate?.(node.descriptor, query) ?? searchable.includes(query);
    const includedChildren = node.children.filter((child) => included.has(child.key));
    if (ownMatch) matched.add(node.key);
    if (!ownMatch && includedChildren.length === 0) continue;
    included.add(node.key);
    childrenByKey.set(node.key, Object.freeze(includedChildren));
    if (includedChildren.length > 0) forced.add(node.key);
  }
  return Object.freeze({
    active: true,
    query,
    roots: Object.freeze(model.roots.filter((node) => included.has(node.key))),
    includedKeys: included,
    matchedKeys: matched,
    forcedExpandedKeys: forced,
    childrenByKey,
  });
}

export function createTreeViewTextFragments(text: string, query: string, locale?: string): ReadonlyArray<TreeViewTextFragment> {
  if (!query) return Object.freeze([{ text, matched: false }]);
  const normalizedText = text.toLocaleLowerCase(locale);
  const normalizedQuery = query.toLocaleLowerCase(locale);
  const fragments: TreeViewTextFragment[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = normalizedText.indexOf(normalizedQuery, cursor);
    if (index < 0) { fragments.push({ text: text.slice(cursor), matched: false }); break; }
    if (index > cursor) fragments.push({ text: text.slice(cursor, index), matched: false });
    fragments.push({ text: text.slice(index, index + normalizedQuery.length), matched: true });
    cursor = index + normalizedQuery.length;
  }
  return Object.freeze(fragments.length > 0 ? fragments : [{ text, matched: false }]);
}
