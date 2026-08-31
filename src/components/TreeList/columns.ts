import type { CgTreeListColumn, CgTreeListColumnState, CgTreeListKey } from './CgTreeList.types';

export interface NormalizedTreeListColumn<TItem, TKey extends CgTreeListKey> {
  readonly descriptor: CgTreeListColumn<TItem, TKey>;
  readonly fieldId: string;
  readonly title: string;
  readonly visible: boolean;
  readonly displayOrder: number;
  readonly width?: number | string;
  readonly fixed: 'none' | 'start' | 'end';
}

export function validateTreeListColumns<TItem, TKey extends CgTreeListKey>(columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>): string {
  if (!columns.length) throw new Error('CgTreeList requires at least one column descriptor.');
  const identities = new Map<string, string>();
  const declaredHierarchy = columns.filter((column) => column.hierarchy);
  if (declaredHierarchy.length > 1) throw new Error('CgTreeList allows exactly one hierarchy column; more than one was declared.');
  if (declaredHierarchy[0]?.type === 'selection') throw new Error('CgTreeList selection columns cannot be hierarchy columns.');
  for (const column of columns) {
    const id = column.fieldId.trim();
    if (!id) throw new Error('CgTreeList column fieldId cannot be blank.');
    for (const identity of [id, ...(column.formerFieldIds ?? []).map((value) => value.trim())]) {
      if (!identity) throw new Error(`CgTreeList column '${id}' contains a blank formerFieldId.`);
      const owner = identities.get(identity);
      if (owner) throw new Error(`CgTreeList field identity '${identity}' is shared by '${owner}' and '${id}'.`);
      identities.set(identity, id);
    }
    if (!['selection', 'command', 'template'].includes(column.type) && !column.getValue) throw new Error(`CgTreeList ${column.type} column '${id}' requires getValue.`);
    if (column.minWidth !== undefined && (!Number.isFinite(column.minWidth) || column.minWidth <= 0)) throw new Error(`CgTreeList column '${id}' has an invalid minWidth.`);
    if (column.maxWidth !== undefined && (!Number.isFinite(column.maxWidth) || column.maxWidth <= 0)) throw new Error(`CgTreeList column '${id}' has an invalid maxWidth.`);
    if (column.minWidth !== undefined && column.maxWidth !== undefined && column.minWidth > column.maxWidth) throw new Error(`CgTreeList column '${id}' has minWidth greater than maxWidth.`);
  }
  const hierarchy = declaredHierarchy[0] ?? columns.find((column) => column.visible !== false && column.type !== 'selection');
  if (!hierarchy) throw new Error('CgTreeList has no eligible visible hierarchy column.');
  return hierarchy.fieldId;
}

export function normalizeTreeListColumns<TItem, TKey extends CgTreeListKey>(
  columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>,
  state: ReadonlyArray<CgTreeListColumnState>,
  hierarchyFieldId: string,
): ReadonlyArray<NormalizedTreeListColumn<TItem, TKey>> {
  const byId = new Map(state.map((entry) => [entry.fieldId, entry]));
  return columns.map((descriptor, declarationIndex) => {
    const stored = byId.get(descriptor.fieldId);
    const visible = descriptor.fieldId === hierarchyFieldId ? true : stored?.visible ?? descriptor.visible ?? true;
    return {
      descriptor,
      fieldId: descriptor.fieldId,
      title: descriptor.title?.trim() || descriptor.fieldId,
      visible,
      displayOrder: stored?.displayOrder ?? declarationIndex,
      width: stored?.width ?? descriptor.width,
      fixed: stored?.fixed ?? 'none',
    };
  }).sort((left, right) => {
    const rank = (region: 'none' | 'start' | 'end') => region === 'start' ? 0 : region === 'none' ? 1 : 2;
    return rank(left.fixed) - rank(right.fixed) || left.displayOrder - right.displayOrder;
  });
}

export function clampTreeListColumnWidth<TItem, TKey extends CgTreeListKey>(column: CgTreeListColumn<TItem, TKey>, width: number): number {
  return Math.min(column.maxWidth ?? 1600, Math.max(column.minWidth ?? 48, width));
}
