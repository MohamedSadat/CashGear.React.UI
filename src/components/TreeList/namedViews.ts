import { BrowserViewStore } from '../Grid/views';
import type { CgTreeListColumn, CgTreeListKey, CgTreeListState } from './CgTreeList.types';

/**
 * Personal named TreeList views in `localStorage`, keyed by `viewKey`. Sets and maps in the state are
 * written as arrays and rebuilt when a view is applied. Blazor `CgTreeListViewStore`.
 */
export class CgTreeListBrowserViewStore<TKey extends CgTreeListKey = CgTreeListKey> extends BrowserViewStore<CgTreeListState<TKey>> {
  constructor(storage?: Storage) { super(storage, 'cg.treelist.views', 'CgTreeList', 'TreeList'); }
}

/** Identifies a column set; views saved for another set are not offered. */
export function treeListSchemaSignature<TItem, TKey extends CgTreeListKey>(columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>): string {
  return columns.map((column) => `${column.fieldId}:${column.type}:${(column.formerFieldIds ?? []).join(',')}`).join('|');
}
