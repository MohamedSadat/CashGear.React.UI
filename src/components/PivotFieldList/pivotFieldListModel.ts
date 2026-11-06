import type {
  CgPivotFieldListArea,
  CgPivotFieldListChange,
  CgPivotFieldListField,
  CgPivotFieldListItem,
  CgPivotFieldListItemChange,
  CgPivotFieldListLayout,
  CgPivotFieldListPosition,
} from './CgPivotFieldList.types';

/** `fieldKey` of the Σ Values item, Excel's field `-2`. */
export const CG_PIVOT_FIELD_LIST_VALUES_KEY = '__values';

export const PIVOT_FIELD_LIST_AREAS: ReadonlyArray<CgPivotFieldListArea> = ['filters', 'columns', 'rows', 'values'];

type MutableLayout = Record<CgPivotFieldListArea, CgPivotFieldListItem[]>;

export interface PivotFieldListEdit {
  layout: CgPivotFieldListLayout;
  change: CgPivotFieldListChange;
}

export interface PivotFieldListRules {
  fields: ReadonlyMap<string, CgPivotFieldListField>;
  canDrop?: ((fieldKey: string, area: CgPivotFieldListArea, index: number) => boolean) | undefined;
  getValueCaption?: ((field: CgPivotFieldListField) => string | undefined) | undefined;
}

export interface PivotFieldListPlacement {
  fieldKey: string;
  /** The item being moved. Absent when the field comes from the field list. */
  itemId?: string | undefined;
  area: CgPivotFieldListArea;
  /** Insertion point among the target area's current items, `0` to its length. */
  marker: number;
}

const copy = (layout: CgPivotFieldListLayout): MutableLayout => ({
  filters: [...layout.filters],
  columns: [...layout.columns],
  rows: [...layout.rows],
  values: [...layout.values],
});

export function validatePivotFieldListLayout(layout: CgPivotFieldListLayout) {
  const ids = new Set<string>();
  for (const area of PIVOT_FIELD_LIST_AREAS) {
    for (const item of layout[area]) {
      if (!item.id) throw new Error('CgPivotFieldList items require a nonempty id.');
      if (ids.has(item.id)) throw new Error(`CgPivotFieldList layout contains duplicate item id '${item.id}'.`);
      ids.add(item.id);
    }
  }
}

export function validatePivotFieldListFields(fields: ReadonlyArray<CgPivotFieldListField>): ReadonlyMap<string, CgPivotFieldListField> {
  const map = new Map<string, CgPivotFieldListField>();
  for (const field of fields) {
    if (!field.key) throw new Error('CgPivotFieldList fields require a nonempty key.');
    if (field.key === CG_PIVOT_FIELD_LIST_VALUES_KEY) throw new Error(`CgPivotFieldList field key '${CG_PIVOT_FIELD_LIST_VALUES_KEY}' is reserved for the Σ Values item.`);
    if (map.has(field.key)) throw new Error(`CgPivotFieldList contains duplicate field key '${field.key}'.`);
    map.set(field.key, field);
  }
  return map;
}

export function locateItem(layout: CgPivotFieldListLayout, itemId: string): (CgPivotFieldListPosition & { item: CgPivotFieldListItem }) | undefined {
  for (const area of PIVOT_FIELD_LIST_AREAS) {
    const index = layout[area].findIndex((item) => item.id === itemId);
    if (index >= 0) return { area, index, item: layout[area][index]! };
  }
  return undefined;
}

/** The item of a field in Filters, Columns or Rows. A field sits in at most one of them. */
export function locateAxisItem(layout: CgPivotFieldListLayout, fieldKey: string): (CgPivotFieldListPosition & { item: CgPivotFieldListItem }) | undefined {
  for (const area of PIVOT_FIELD_LIST_AREAS) {
    if (area === 'values') continue;
    const index = layout[area].findIndex((item) => item.fieldKey === fieldKey);
    if (index >= 0) return { area, index, item: layout[area][index]! };
  }
  return undefined;
}

export function isFieldInLayout(layout: CgPivotFieldListLayout, fieldKey: string) {
  return PIVOT_FIELD_LIST_AREAS.some((area) => layout[area].some((item) => item.fieldKey === fieldKey));
}

/** `${area}:${fieldKey}:${n}` with the smallest `n` from 0 that no item in the layout uses. */
export function nextPivotFieldListItemId(layout: CgPivotFieldListLayout, area: CgPivotFieldListArea, fieldKey: string) {
  const used = new Set(PIVOT_FIELD_LIST_AREAS.flatMap((name) => layout[name].map((item) => item.id)));
  for (let n = 0; ; n += 1) {
    const id = `${area}:${fieldKey}:${n}`;
    if (!used.has(id)) return id;
  }
}

/** Excel's rules, before the host's `canDrop`: Σ Values goes only in Columns or Rows, and a disabled field goes nowhere. */
export function ruleAllows(rules: PivotFieldListRules, fieldKey: string, area: CgPivotFieldListArea) {
  if (fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY) return area === 'columns' || area === 'rows';
  return rules.fields.get(fieldKey)?.disabled !== true;
}

const finalIndex = (marker: number, sourceIndex: number | undefined) => (sourceIndex !== undefined && marker > sourceIndex ? marker - 1 : marker);

/**
 * Where a placement lands, or `undefined` when nothing would change or it isn't allowed.
 * Values never takes a field out of another area: dropping into Values adds a value item.
 */
export function resolvePlacement(layout: CgPivotFieldListLayout, rules: PivotFieldListRules, placement: PivotFieldListPlacement): PivotFieldListEdit | undefined {
  const { fieldKey, area } = placement;
  if (!ruleAllows(rules, fieldKey, area)) return undefined;
  const marker = Math.max(0, Math.min(placement.marker, layout[area].length));
  const source = placement.itemId === undefined ? undefined : locateItem(layout, placement.itemId);
  if (placement.itemId !== undefined && !source) return undefined;
  if (source && source.item.fieldKey !== fieldKey) return undefined;
  const veto = (index: number) => rules.canDrop !== undefined && !rules.canDrop(fieldKey, area, index);

  // The same item within one area, or a value item within Values: a reorder.
  if (source && source.area === area) {
    const index = finalIndex(marker, source.index);
    if (index === source.index || veto(index)) return undefined;
    const next = copy(layout);
    next[area].splice(source.index, 1);
    next[area].splice(index, 0, source.item);
    return { layout: next, change: { kind: 'move', itemId: source.item.id, fieldKey, from: { area, index: source.index }, to: { area, index } } };
  }

  if (area === 'values') {
    if (fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY || veto(marker)) return undefined;
    const field = rules.fields.get(fieldKey);
    const caption = field ? rules.getValueCaption?.(field) : undefined;
    const item: CgPivotFieldListItem = { id: nextPivotFieldListItemId(layout, 'values', fieldKey), fieldKey, ...(caption !== undefined ? { caption } : {}) };
    const next = copy(layout);
    next.values.splice(marker, 0, item);
    return { layout: next, change: { kind: 'add', itemId: item.id, fieldKey, to: { area, index: marker } } };
  }

  // Into Filters, Columns or Rows. Σ Values only moves; it is never added.
  if (fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY && !source) return undefined;
  const changes: CgPivotFieldListItemChange[] = [];
  let working: CgPivotFieldListLayout = layout;
  if (source && source.area === 'values') {
    // A value item dragged out of Values becomes the field in the target area.
    const next = copy(working);
    next.values.splice(source.index, 1);
    working = next;
    changes.push({ kind: 'remove', itemId: source.item.id, fieldKey, from: { area: 'values', index: source.index } });
  }
  const existing = fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY ? source : locateAxisItem(working, fieldKey);
  if (existing && existing.area === area) {
    const index = finalIndex(marker, existing.index);
    if (index === existing.index && changes.length === 0) return undefined;
    if (veto(index)) return undefined;
    const next = copy(working);
    next[area].splice(existing.index, 1);
    next[area].splice(index, 0, existing.item);
    working = next;
    if (index !== existing.index) changes.push({ kind: 'move', itemId: existing.item.id, fieldKey, from: { area, index: existing.index }, to: { area, index } });
  } else if (existing) {
    if (veto(marker)) return undefined;
    const next = copy(working);
    next[existing.area].splice(existing.index, 1);
    next[area].splice(marker, 0, existing.item);
    working = next;
    changes.push({ kind: 'move', itemId: existing.item.id, fieldKey, from: { area: existing.area, index: existing.index }, to: { area, index: marker } });
  } else {
    if (veto(marker)) return undefined;
    const item: CgPivotFieldListItem = { id: nextPivotFieldListItemId(working, area, fieldKey), fieldKey };
    const next = copy(working);
    next[area].splice(marker, 0, item);
    working = next;
    changes.push({ kind: 'add', itemId: item.id, fieldKey, to: { area, index: marker } });
  }
  if (changes.length === 0) return undefined;
  return { layout: working, change: changes.length === 1 ? changes[0]! : { kind: 'batch', changes } };
}

/** Removes one item. Σ Values can't be removed: it follows the value items. */
export function resolveRemoval(layout: CgPivotFieldListLayout, rules: PivotFieldListRules, itemId: string): PivotFieldListEdit | undefined {
  const source = locateItem(layout, itemId);
  if (!source || !canRemove(rules, source.item.fieldKey)) return undefined;
  const next = copy(layout);
  next[source.area].splice(source.index, 1);
  return { layout: next, change: { kind: 'remove', itemId, fieldKey: source.item.fieldKey, from: { area: source.area, index: source.index } } };
}

export function canRemove(rules: PivotFieldListRules, fieldKey: string) {
  return fieldKey !== CG_PIVOT_FIELD_LIST_VALUES_KEY && rules.fields.get(fieldKey)?.disabled !== true;
}

/** Removes every item of a field, as unchecking it does. */
export function resolveFieldRemoval(layout: CgPivotFieldListLayout, rules: PivotFieldListRules, fieldKey: string): PivotFieldListEdit | undefined {
  if (!canRemove(rules, fieldKey)) return undefined;
  const changes: CgPivotFieldListItemChange[] = [];
  let working = layout;
  for (;;) {
    const found = PIVOT_FIELD_LIST_AREAS.map((area) => ({ area, index: working[area].findIndex((item) => item.fieldKey === fieldKey) })).find((entry) => entry.index >= 0);
    if (!found) break;
    const next = copy(working);
    const [item] = next[found.area].splice(found.index, 1);
    working = next;
    changes.push({ kind: 'remove', itemId: item!.id, fieldKey, from: found });
  }
  if (changes.length === 0) return undefined;
  return { layout: working, change: changes.length === 1 ? changes[0]! : { kind: 'batch', changes } };
}

/** A string that changes only when what the pane draws from the layout changes. */
export function pivotFieldListLayoutSignature(layout: CgPivotFieldListLayout) {
  return JSON.stringify(PIVOT_FIELD_LIST_AREAS.map((area) => layout[area].map((item) => [item.id, item.fieldKey, item.caption ?? null])));
}

export function flattenChanges(change: CgPivotFieldListChange): ReadonlyArray<CgPivotFieldListItemChange> {
  return change.kind === 'batch' ? change.changes : [change];
}
