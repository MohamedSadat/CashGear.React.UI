import type { CgTreeListColumn, CgTreeListKey, CgTreeListSummary } from './CgTreeList.types';
import type { TreeListHierarchy } from './hierarchy';

interface Aggregate { count: number; numbers: number; sum: number; minimum: number; maximum: number; incomplete: boolean }
const empty = (): Aggregate => ({ count: 0, numbers: 0, sum: 0, minimum: Infinity, maximum: -Infinity, incomplete: false });
const merge = (a: Aggregate, b: Aggregate) => { a.count += b.count; a.numbers += b.numbers; a.sum += b.sum; a.minimum = Math.min(a.minimum, b.minimum); a.maximum = Math.max(a.maximum, b.maximum); a.incomplete ||= b.incomplete; };
export function descendantSummaries<T, K extends CgTreeListKey>(hierarchy: TreeListHierarchy<T, K>, summary: CgTreeListSummary<T>, columns: ReadonlyArray<CgTreeListColumn<T, K>>): ReadonlyMap<string, { value: unknown; incomplete: boolean }> {
  const column = columns.find(c => c.fieldId === summary.fieldId);
  const subtree = new Map<string, Aggregate>();
  const result = new Map<string, { value: unknown; incomplete: boolean }>();
  const stack = hierarchy.roots.map(node => ({ node, visited: false }));
  while (stack.length) {
    const entry = stack.pop()!;
    const { node } = entry;
    if (!entry.visited) { stack.push({ node, visited: true }); for (const child of node.children) stack.push({ node: child, visited: false }); continue; }
    const descendants = empty();
    descendants.incomplete = node.hasUnloadedChildren || !node.projectionComplete;
    for (const child of node.children) merge(descendants, subtree.get(child.token)!);
    const value = summary.type === 'count' ? descendants.count : !descendants.numbers ? undefined : summary.type === 'sum' ? descendants.sum : summary.type === 'average' ? descendants.sum / descendants.numbers : summary.type === 'minimum' ? descendants.minimum : summary.type === 'maximum' ? descendants.maximum : undefined;
    result.set(node.token, { value, incomplete: descendants.incomplete });
    const own = column?.getValue?.(node.item);
    const aggregate = { ...descendants, count: descendants.count + 1 };
    if (typeof own === 'number' && Number.isFinite(own)) { aggregate.numbers++; aggregate.sum += own; aggregate.minimum = Math.min(aggregate.minimum, own); aggregate.maximum = Math.max(aggregate.maximum, own); }
    subtree.set(node.token, aggregate);
  }
  return result;
}
