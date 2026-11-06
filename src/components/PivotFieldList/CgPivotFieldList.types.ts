import type { HTMLAttributes } from 'react';
import type { CgBaseProps, CgDirection } from '../../types';

/** The four drop areas, in Excel's order. */
export type CgPivotFieldListArea = 'filters' | 'columns' | 'rows' | 'values';

/** `stacked` puts the fields above the areas. `sideBySide` puts them beside the areas, which then stack one above another. */
export type CgPivotFieldListSectionLayout = 'stacked' | 'sideBySide';

/** `source` keeps the order of `fields`. `ascending` sorts by caption, A to Z. */
export type CgPivotFieldListFieldOrder = 'source' | 'ascending';

export interface CgPivotFieldListField {
  key: string;
  caption: string;
  /** Where checking the field puts it when the host doesn't handle `onFieldToggle`. Defaults to `rows`. */
  defaultArea?: CgPivotFieldListArea;
  /** The field can't be checked, unchecked, added, moved or removed. Its items in the areas are still shown. */
  disabled?: boolean;
}

export interface CgPivotFieldListItem {
  /** Unique across the whole layout. */
  id: string;
  /** A field's `key`, or `CG_PIVOT_FIELD_LIST_VALUES_KEY` for the Σ Values item. */
  fieldKey: string;
  /** Shown instead of the field's caption, such as `Sum of Sales` for a value item. */
  caption?: string;
}

export interface CgPivotFieldListLayout {
  filters: ReadonlyArray<CgPivotFieldListItem>;
  columns: ReadonlyArray<CgPivotFieldListItem>;
  rows: ReadonlyArray<CgPivotFieldListItem>;
  values: ReadonlyArray<CgPivotFieldListItem>;
}

export interface CgPivotFieldListPosition {
  area: CgPivotFieldListArea;
  index: number;
}

/** One edit. `from` is where the item was, in the layout before the change. `to` is where it is, in the layout after it. */
export interface CgPivotFieldListItemChange {
  kind: 'add' | 'move' | 'remove';
  itemId: string;
  fieldKey: string;
  /** Absent for `add`. */
  from?: CgPivotFieldListPosition;
  /** Absent for `remove`. */
  to?: CgPivotFieldListPosition;
}

/**
 * Several edits reported at once, in order, each against the layout its predecessor left. It comes from Update with
 * updates deferred, from dragging a value item out of Values (its removal, then the field's add or move), and from
 * unchecking a field that has more than one item.
 */
export interface CgPivotFieldListChangeBatch {
  kind: 'batch';
  changes: ReadonlyArray<CgPivotFieldListItemChange>;
}

export type CgPivotFieldListChange = CgPivotFieldListItemChange | CgPivotFieldListChangeBatch;

export interface CgPivotFieldListLabels {
  title: string;
  tools: string;
  stacked: string;
  sideBySide: string;
  sortAscending: string;
  sortSourceOrder: string;
  chooseFields: string;
  search: string;
  noFields: string;
  dragBetweenAreas: string;
  filters: string;
  columns: string;
  rows: string;
  values: string;
  /** Caption of the Σ Values item. */
  valuesItem: string;
  emptyArea: string;
  /** Tooltip of a field's dropdown arrow. */
  fieldOptions: (caption: string) => string;
  /** Tooltip of an item's dropdown arrow. */
  itemOptions: (caption: string) => string;
  /** Read by screen readers on fields and items: how to open their menu. */
  keyboardHint: string;
  moveUp: string;
  moveDown: string;
  moveToBeginning: string;
  moveToEnd: string;
  moveToFilters: string;
  moveToRows: string;
  moveToColumns: string;
  moveToValues: string;
  addToFilters: string;
  addToRows: string;
  addToColumns: string;
  addToValues: string;
  removeField: string;
  fieldSettings: string;
  valueFieldSettings: string;
  deferUpdate: string;
  update: string;
  /** Shown when `readOnly` is set and no `readOnlyMessage` is given. Empty shows nothing. */
  readOnly: string;
  /** Announced after an item is added. */
  announceAdd: (caption: string, area: string, position: number) => string;
  /** Announced after an item moves. */
  announceMove: (caption: string, area: string, position: number) => string;
  /** Announced after an item is removed. */
  announceRemove: (caption: string) => string;
}

type NativePivotFieldListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'defaultValue' | 'dir' | 'onChange' | 'role' | 'style'>;

export interface CgPivotFieldListProps extends NativePivotFieldListProps, CgBaseProps {
  /** The source fields, in data source order. Keys must be unique and must not be `CG_PIVOT_FIELD_LIST_VALUES_KEY`. */
  fields: ReadonlyArray<CgPivotFieldListField>;
  /** The current layout. The pane is controlled: it shows this and reports proposals through `onLayoutChange`. */
  layout: CgPivotFieldListLayout;
  /** Called with the next layout and the change that made it, at once, or on Update when updates are deferred. */
  onLayoutChange: (next: CgPivotFieldListLayout, change: CgPivotFieldListChange) => void;
  /**
   * Checking or unchecking a field in the list. When given, the pane only reports it and the host changes `layout`.
   * Without it, checking adds the field to its `defaultArea` and unchecking removes every item of the field.
   */
  onFieldToggle?: (fieldKey: string, checked: boolean) => void;
  /** Field Settings… on an item in Filters, Columns or Rows. Without it the command is disabled. */
  onFieldSettings?: (item: CgPivotFieldListItem, area: CgPivotFieldListArea) => void;
  /** Value Field Settings… on an item in Values. Without it the command is disabled. */
  onValueFieldSettings?: (item: CgPivotFieldListItem) => void;
  /** Names a value item the pane creates, such as `Sum of Sales`. Without it the item has no caption and shows the field's. */
  getValueCaption?: (field: CgPivotFieldListField) => string | undefined;
  /** Vetoes a drop or a menu command. `index` is where the item would land. The pane's own rules apply first. */
  canDrop?: (fieldKey: string, area: CgPivotFieldListArea, index: number) => boolean;
  /** Whether edits wait for Update. */
  deferUpdate?: boolean;
  defaultDeferUpdate?: boolean;
  onDeferUpdateChange?: (deferred: boolean) => void;
  sectionLayout?: CgPivotFieldListSectionLayout;
  /** Defaults to `stacked`. */
  defaultSectionLayout?: CgPivotFieldListSectionLayout;
  onSectionLayoutChange?: (layout: CgPivotFieldListSectionLayout) => void;
  fieldOrder?: CgPivotFieldListFieldOrder;
  /** Defaults to `source`. */
  defaultFieldOrder?: CgPivotFieldListFieldOrder;
  onFieldOrderChange?: (order: CgPivotFieldListFieldOrder) => void;
  /** Shows everything and changes nothing. The tools menu still changes the pane's own view. */
  readOnly?: boolean;
  /** Shown at the top while `readOnly`. Defaults to `labels.readOnly`. */
  readOnlyMessage?: string;
  /** Every visible string. English defaults. */
  labels?: Partial<CgPivotFieldListLabels>;
  direction?: CgDirection;
  id?: string;
  'aria-label'?: string;
}
