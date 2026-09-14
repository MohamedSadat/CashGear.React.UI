import type { CgTreeListKey, CgTreeListParentKey, CgTreeListProviderResult } from './CgTreeList.types';
import { treeListKeyToken } from './hierarchy';

export function validateTreeListPage<T, K extends CgTreeListKey>(result: CgTreeListProviderResult<T, K>, parent: CgTreeListParentKey<K>, skip: number, take: number, previousKeys: ReadonlySet<string> = new Set(), previousTotal?: number): void {
  if (!Number.isSafeInteger(result.totalCount) || result.totalCount < 0 || result.nodes.length > take ||
      (result.nodes.length > 0 && skip + result.nodes.length > result.totalCount) ||
      (result.hasMore === true && (result.nodes.length === 0 || skip + result.nodes.length >= result.totalCount)) ||
      (result.hasMore === false && skip + result.nodes.length < result.totalCount) ||
      (skip > 0 && previousTotal !== undefined && previousTotal !== result.totalCount)) throw new Error('Inconsistent TreeList page or total.');
  const keys = new Set(previousKeys);
  for (const record of result.nodes) {
    const key = treeListKeyToken(record.key);
    if (keys.has(key)) throw new Error('Duplicate or overlapping TreeList page key.');
    keys.add(key);
    if (record.parentKey.kind !== parent.kind || (record.parentKey.kind === 'key' && parent.kind === 'key' && treeListKeyToken(record.parentKey.key) !== treeListKeyToken(parent.key))) throw new Error('TreeList page contains a different parent.');
  }
}
