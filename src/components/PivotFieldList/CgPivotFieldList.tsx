import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgCheckBox } from '../CheckBox';
import { CgButton } from '../Button';
import { CgContextMenu } from '../ContextMenu';
import type { CgContextMenuActions, CgContextMenuCloseReason, CgContextMenuItem } from '../ContextMenu';
import { CgDropDownButton } from '../DropDownButton';
import type { CgButtonMenuItem } from '../DropDownButton';
import { CgIcon } from '../Icon';
import { CgSearchBox } from '../SearchBox';
import type { CgIconName } from '../../types';
import styles from './CgPivotFieldList.module.css';
import type {
  CgPivotFieldListArea,
  CgPivotFieldListChange,
  CgPivotFieldListField,
  CgPivotFieldListFieldOrder,
  CgPivotFieldListItem,
  CgPivotFieldListItemChange,
  CgPivotFieldListLabels,
  CgPivotFieldListLayout,
  CgPivotFieldListProps,
  CgPivotFieldListSectionLayout,
} from './CgPivotFieldList.types';
import {
  CG_PIVOT_FIELD_LIST_VALUES_KEY,
  PIVOT_FIELD_LIST_AREAS,
  flattenChanges,
  isFieldInLayout,
  locateAxisItem,
  locateItem,
  pivotFieldListLayoutSignature,
  resolveFieldRemoval,
  resolvePlacement,
  resolveRemoval,
  validatePivotFieldListFields,
  validatePivotFieldListLayout,
} from './pivotFieldListModel';
import type { PivotFieldListEdit, PivotFieldListRules } from './pivotFieldListModel';

export const CG_PIVOT_FIELD_LIST_DEFAULT_LABELS: CgPivotFieldListLabels = {
  title: 'PivotTable Fields',
  tools: 'Tools',
  stacked: 'Fields Section and Areas Section Stacked',
  sideBySide: 'Fields Section and Areas Section Side-By-Side',
  sortAscending: 'Sort A to Z',
  sortSourceOrder: 'Sort in Data Source Order',
  chooseFields: 'Choose fields to add to report:',
  search: 'Search',
  noFields: 'No fields match your search.',
  dragBetweenAreas: 'Drag fields between areas below:',
  filters: 'Filters',
  columns: 'Columns',
  rows: 'Rows',
  values: 'Values',
  valuesItem: 'Σ Values',
  emptyArea: '',
  fieldOptions: (caption) => `${caption} options`,
  itemOptions: (caption) => `${caption} options`,
  keyboardHint: 'Press Enter or Shift+F10 for options.',
  moveUp: 'Move Up',
  moveDown: 'Move Down',
  moveToBeginning: 'Move to Beginning',
  moveToEnd: 'Move to End',
  moveToFilters: 'Move to Report Filter',
  moveToRows: 'Move to Row Labels',
  moveToColumns: 'Move to Column Labels',
  moveToValues: 'Move to Values',
  addToFilters: 'Add to Report Filter',
  addToRows: 'Add to Row Labels',
  addToColumns: 'Add to Column Labels',
  addToValues: 'Add to Values',
  removeField: 'Remove Field',
  fieldSettings: 'Field Settings…',
  valueFieldSettings: 'Value Field Settings…',
  deferUpdate: 'Defer Layout Update',
  update: 'Update',
  readOnly: 'This PivotTable can’t be changed here.',
  announceAdd: (caption, area, position) => `${caption} added to ${area}, position ${position}.`,
  announceMove: (caption, area, position) => `${caption} moved to ${area}, position ${position}.`,
  announceRemove: (caption) => `${caption} removed.`,
};

const AREA_ICONS: Record<CgPivotFieldListArea, CgIconName> = { filters: 'filter', columns: 'column-insert', rows: 'row-insert', values: 'autosum' };
const MOVE_LABEL: Record<CgPivotFieldListArea, 'moveToFilters' | 'moveToColumns' | 'moveToRows' | 'moveToValues'> = { filters: 'moveToFilters', columns: 'moveToColumns', rows: 'moveToRows', values: 'moveToValues' };
const ADD_LABEL: Record<CgPivotFieldListArea, 'addToFilters' | 'addToColumns' | 'addToRows' | 'addToValues'> = { filters: 'addToFilters', columns: 'addToColumns', rows: 'addToRows', values: 'addToValues' };
/** Excel's menu order: Report Filter, Row Labels, Column Labels, Values. */
const MENU_AREAS: ReadonlyArray<CgPivotFieldListArea> = ['filters', 'rows', 'columns', 'values'];
const DRAG_THRESHOLD = 4;

type MenuContext = { kind: 'field'; fieldKey: string } | { kind: 'item'; itemId: string };
type FocusTarget = { kind: 'field'; fieldKey: string } | { kind: 'item'; itemId: string } | { kind: 'area'; area: CgPivotFieldListArea };
type DragSource = { kind: 'field'; fieldKey: string } | { kind: 'item'; itemId: string; fieldKey: string };

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  source: DragSource;
  caption: string;
  active: boolean;
  result: { area: CgPivotFieldListArea; marker: number; edit: PivotFieldListEdit | undefined } | { area: undefined; removal: PivotFieldListEdit | undefined };
}

interface DragView {
  caption: string;
  /** The area item being dragged. */
  itemId: string | undefined;
  x: number;
  y: number;
  area: CgPivotFieldListArea | undefined;
  marker: number | undefined;
  /** The drop would change something. */
  allowed: boolean;
  removing: boolean;
}

interface Draft {
  base: string;
  layout: CgPivotFieldListLayout;
  changes: ReadonlyArray<CgPivotFieldListItemChange>;
}

const inside = (rect: DOMRect, x: number, y: number) => rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

export const CgPivotFieldList = forwardRef<HTMLDivElement, CgPivotFieldListProps>(function CgPivotFieldList(
  {
    fields,
    layout,
    onLayoutChange,
    onFieldToggle,
    onFieldSettings,
    onValueFieldSettings,
    getValueCaption,
    canDrop,
    deferUpdate,
    defaultDeferUpdate = false,
    onDeferUpdateChange,
    sectionLayout,
    defaultSectionLayout = 'stacked',
    onSectionLayoutChange,
    fieldOrder,
    defaultFieldOrder = 'source',
    onFieldOrderChange,
    readOnly = false,
    readOnlyMessage,
    labels: labelOverrides,
    direction = 'auto',
    className,
    style,
    id,
    'aria-label': ariaLabel,
    'data-testid': testId,
    ...nativeProps
  },
  forwardedRef,
) {
  const labels = useMemo<CgPivotFieldListLabels>(() => ({ ...CG_PIVOT_FIELD_LIST_DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const fieldMap = useMemo(() => validatePivotFieldListFields(fields), [fields]);
  validatePivotFieldListLayout(layout);
  const rules = useMemo<PivotFieldListRules>(() => ({ fields: fieldMap, canDrop, getValueCaption }), [canDrop, fieldMap, getValueCaption]);

  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const baseId = useCgId(id);
  const titleId = `${baseId}-title`;
  const hintId = `${baseId}-hint`;

  const [deferred, setDeferred] = useControllableState(deferUpdate, defaultDeferUpdate, 'CgPivotFieldList deferUpdate');
  const [sections, setSections] = useControllableState<CgPivotFieldListSectionLayout>(sectionLayout, defaultSectionLayout, 'CgPivotFieldList sectionLayout');
  const [order, setOrder] = useControllableState<CgPivotFieldListFieldOrder>(fieldOrder, defaultFieldOrder, 'CgPivotFieldList fieldOrder');
  const [query, setQuery] = useState('');

  // While deferred, edits go to a draft over the layout they started from. A new layout from the host replaces it.
  const signature = useMemo(() => pivotFieldListLayoutSignature(layout), [layout]);
  const [draft, setDraft] = useState<Draft>();
  const activeDraft = deferred && draft?.base === signature ? draft : undefined;
  const shown = activeDraft?.layout ?? layout;
  const shownRef = useRef(shown);
  shownRef.current = shown;

  const [announcement, setAnnouncement] = useState('');
  const [activeFieldKey, setActiveFieldKey] = useState<string>();
  const [activeItemId, setActiveItemId] = useState<string>();
  const [pendingFocus, setPendingFocus] = useState<{ target: FocusTarget; nonce: number }>();
  const fieldElements = useRef(new Map<string, HTMLInputElement>());
  const itemElements = useRef(new Map<string, HTMLDivElement>());
  const areaElements = useRef(new Map<CgPivotFieldListArea, HTMLElement>());
  const listElements = useRef(new Map<CgPivotFieldListArea, HTMLDivElement>());
  const menuRef = useRef<CgContextMenuActions<MenuContext>>(null);
  const menuFocus = useRef<FocusTarget | undefined>(undefined);

  const caption = useCallback((item: CgPivotFieldListItem) => {
    if (item.fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY) return item.caption ?? labels.valuesItem;
    return item.caption ?? fieldMap.get(item.fieldKey)?.caption ?? item.fieldKey;
  }, [fieldMap, labels.valuesItem]);

  const announce = (edit: PivotFieldListEdit) => {
    const changes = flattenChanges(edit.change);
    const last = changes[changes.length - 1];
    if (!last) return;
    const item = locateItem(edit.layout, last.itemId)?.item ?? { id: last.itemId, fieldKey: last.fieldKey };
    const name = caption(item);
    if (last.kind === 'remove' || !last.to) setAnnouncement(labels.announceRemove(name));
    else setAnnouncement((last.kind === 'add' ? labels.announceAdd : labels.announceMove)(name, labels[last.to.area], last.to.index + 1));
  };

  const commit = (edit: PivotFieldListEdit | undefined) => {
    if (!edit || readOnly) return false;
    if (deferred) setDraft({ base: signature, layout: edit.layout, changes: [...(activeDraft?.changes ?? []), ...flattenChanges(edit.change)] });
    else onLayoutChange(edit.layout, edit.change);
    announce(edit);
    return true;
  };

  const applyDraft = () => {
    if (!activeDraft || activeDraft.changes.length === 0) return;
    const change: CgPivotFieldListChange = { kind: 'batch', changes: activeDraft.changes };
    setDraft(undefined);
    onLayoutChange(activeDraft.layout, change);
  };

  const changeDeferred = (next: boolean) => {
    if (readOnly || next === deferred) return;
    if (!next) applyDraft();
    setDeferred(next);
    onDeferUpdateChange?.(next);
  };

  // ── Field list ──────────────────────────────────────────────────────────────
  const visibleFields = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matching = needle ? fields.filter((field) => field.caption.toLocaleLowerCase().includes(needle)) : [...fields];
    if (order === 'ascending') {
      const collator = new Intl.Collator(resolvedDirection === 'rtl' ? 'ar' : undefined, { sensitivity: 'base', numeric: true });
      matching.sort((a, b) => collator.compare(a.caption, b.caption));
    }
    return matching;
  }, [fields, order, query, resolvedDirection]);
  const fieldTabStop = visibleFields.some((field) => field.key === activeFieldKey) ? activeFieldKey : visibleFields[0]?.key;

  const toggleField = (field: CgPivotFieldListField, checked: boolean) => {
    if (readOnly || field.disabled) return;
    if (onFieldToggle) { onFieldToggle(field.key, checked); return; }
    if (checked) {
      const area = field.defaultArea ?? 'rows';
      commit(resolvePlacement(shownRef.current, rules, { fieldKey: field.key, area, marker: shownRef.current[area].length }));
    } else {
      commit(resolveFieldRemoval(shownRef.current, rules, field.key));
    }
  };

  const focusField = (key: string | undefined) => {
    if (key === undefined) return;
    setActiveFieldKey(key);
    fieldElements.current.get(key)?.focus();
  };

  const fieldKeyDown = (event: KeyboardEvent<HTMLInputElement>, field: CgPivotFieldListField) => {
    const index = visibleFields.findIndex((candidate) => candidate.key === field.key);
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focusField(visibleFields[Math.min(index + 1, visibleFields.length - 1)]?.key); return;
      case 'ArrowUp': event.preventDefault(); focusField(visibleFields[Math.max(index - 1, 0)]?.key); return;
      case 'Home': event.preventDefault(); focusField(visibleFields[0]?.key); return;
      case 'End': event.preventDefault(); focusField(visibleFields[visibleFields.length - 1]?.key); return;
      case 'Enter': event.preventDefault(); openMenu({ kind: 'field', fieldKey: field.key }, event.currentTarget); return;
      case 'ContextMenu': event.preventDefault(); openMenu({ kind: 'field', fieldKey: field.key }, event.currentTarget); return;
      case 'F10': if (event.shiftKey) { event.preventDefault(); openMenu({ kind: 'field', fieldKey: field.key }, event.currentTarget); } return;
      default:
    }
  };

  // ── Area items ──────────────────────────────────────────────────────────────
  const focusItem = (itemId: string | undefined) => {
    if (itemId === undefined) return;
    setActiveItemId(itemId);
    itemElements.current.get(itemId)?.focus();
  };

  const runFocus = useStableCallback((target: FocusTarget) => {
    if (target.kind === 'item') {
      const element = itemElements.current.get(target.itemId);
      if (element) { setActiveItemId(target.itemId); element.focus(); return; }
    }
    if (target.kind === 'field') {
      const element = fieldElements.current.get(target.fieldKey);
      if (element) { setActiveFieldKey(target.fieldKey); element.focus(); return; }
    }
    if (target.kind === 'area') {
      const first = shownRef.current[target.area][0];
      if (first) { focusItem(first.id); return; }
      listElements.current.get(target.area)?.focus();
      return;
    }
    rootRef.current?.focus();
  });
  useEffect(() => { if (pendingFocus) runFocus(pendingFocus.target); }, [pendingFocus, runFocus]);
  const requestFocus = (target: FocusTarget) => setPendingFocus((current) => ({ target, nonce: (current?.nonce ?? 0) + 1 }));

  /** After an item leaves, focus its neighbour, or the field in the list. */
  const neighbourAfterRemoval = (before: CgPivotFieldListLayout, itemId: string): FocusTarget => {
    const source = locateItem(before, itemId);
    if (!source) return { kind: 'area', area: 'rows' };
    const list = before[source.area];
    const neighbour = list[source.index + 1] ?? list[source.index - 1];
    if (neighbour) return { kind: 'item', itemId: neighbour.id };
    return fieldMap.has(source.item.fieldKey) ? { kind: 'field', fieldKey: source.item.fieldKey } : { kind: 'area', area: source.area };
  };

  const itemKeyDown = (event: KeyboardEvent<HTMLDivElement>, area: CgPivotFieldListArea, item: CgPivotFieldListItem) => {
    const list = shown[area];
    const index = list.findIndex((candidate) => candidate.id === item.id);
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); focusItem(list[Math.min(index + 1, list.length - 1)]?.id); return;
      case 'ArrowUp': event.preventDefault(); focusItem(list[Math.max(index - 1, 0)]?.id); return;
      case 'Home': event.preventDefault(); focusItem(list[0]?.id); return;
      case 'End': event.preventDefault(); focusItem(list[list.length - 1]?.id); return;
      case 'Enter':
      case 'ContextMenu': event.preventDefault(); openMenu({ kind: 'item', itemId: item.id }, event.currentTarget); return;
      case 'F10': if (event.shiftKey) { event.preventDefault(); openMenu({ kind: 'item', itemId: item.id }, event.currentTarget); } return;
      case 'Delete': {
        event.preventDefault();
        const target = neighbourAfterRemoval(shown, item.id);
        if (commit(resolveRemoval(shown, rules, item.id))) requestFocus(target);
        return;
      }
      default:
    }
  };

  // ── Menus ───────────────────────────────────────────────────────────────────
  const openMenu = (context: MenuContext, anchor: HTMLElement, event?: MouseEvent<HTMLElement>) => {
    if (readOnly) return;
    menuFocus.current = context.kind === 'field' ? { kind: 'field', fieldKey: context.fieldKey } : { kind: 'item', itemId: context.itemId };
    if (event) void menuRef.current?.showFromEvent(event, context);
    else void menuRef.current?.showNear(anchor, context, { kind: 'keyboard' });
  };

  const buildMenu = (context: MenuContext): ReadonlyArray<CgContextMenuItem<MenuContext>> => {
    const current = shownRef.current;
    if (context.kind === 'field') {
      const field = fieldMap.get(context.fieldKey);
      if (!field) return [];
      const axis = locateAxisItem(current, field.key);
      return MENU_AREAS.map((area) => {
        const edit = area !== 'values' && axis?.area === area ? undefined : resolvePlacement(current, rules, { fieldKey: field.key, area, marker: current[area].length });
        // Focus stays on the field, so the next one can be added straight away.
        return { key: `add-${area}`, text: labels[ADD_LABEL[area]], disabled: edit === undefined, command: () => { commit(edit); } } satisfies CgContextMenuItem<MenuContext>;
      });
    }
    const source = locateItem(current, context.itemId);
    if (!source) return [];
    const { area, index, item } = source;
    const length = current[area].length;
    const settingsArea = area === 'values' ? undefined : area;
    const isValues = item.fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY;
    const place = (targetArea: CgPivotFieldListArea, marker: number) => resolvePlacement(current, rules, { fieldKey: item.fieldKey, itemId: item.id, area: targetArea, marker });
    const moveCommand = (key: string, text: string, edit: PivotFieldListEdit | undefined, beginGroup?: boolean): CgContextMenuItem<MenuContext> => ({
      key,
      text,
      disabled: edit === undefined,
      ...(beginGroup ? { beginGroup: true } : {}),
      command: () => {
        if (!commit(edit)) return;
        const changes = edit ? flattenChanges(edit.change) : [];
        const landed = changes[changes.length - 1];
        menuFocus.current = landed && landed.kind !== 'remove' ? { kind: 'item', itemId: landed.itemId } : neighbourAfterRemoval(current, item.id);
      },
    });
    const removal = resolveRemoval(current, rules, item.id);
    const blocked = !isValues && fieldMap.get(item.fieldKey)?.disabled === true;
    return [
      moveCommand('move-up', labels.moveUp, index > 0 && !blocked ? place(area, index - 1) : undefined),
      moveCommand('move-down', labels.moveDown, index < length - 1 && !blocked ? place(area, index + 2) : undefined),
      moveCommand('move-beginning', labels.moveToBeginning, index > 0 && !blocked ? place(area, 0) : undefined),
      moveCommand('move-end', labels.moveToEnd, index < length - 1 && !blocked ? place(area, length) : undefined),
      ...MENU_AREAS.map((target, position) => moveCommand(`move-${target}`, labels[MOVE_LABEL[target]], target === area ? undefined : place(target, current[target].length), position === 0)),
      {
        key: 'remove',
        text: labels.removeField,
        beginGroup: true,
        disabled: removal === undefined,
        command: () => {
          const target = neighbourAfterRemoval(current, item.id);
          if (commit(removal)) menuFocus.current = target;
        },
      },
      settingsArea === undefined
        ? { key: 'value-settings', text: labels.valueFieldSettings, beginGroup: true, disabled: onValueFieldSettings === undefined, command: () => onValueFieldSettings?.(item) }
        : { key: 'field-settings', text: labels.fieldSettings, beginGroup: true, disabled: onFieldSettings === undefined || isValues, command: () => onFieldSettings?.(item, settingsArea) },
    ];
  };

  // CgContextMenu treats a new afterClose as a remount, so both callbacks keep their identity.
  const customizeMenu = useStableCallback(({ invocation }: { invocation: { context: MenuContext } }) => buildMenu(invocation.context));
  const afterMenuClose = useStableCallback(({ reason }: { reason: CgContextMenuCloseReason }) => {
    const target = menuFocus.current;
    menuFocus.current = undefined;
    if (target && (reason === 'item' || reason === 'escape')) requestFocus(target);
  });

  // ── Pointer drag ────────────────────────────────────────────────────────────
  const dragRef = useRef<DragState | undefined>(undefined);
  const suppressClick = useRef(false);
  const [dragView, setDragView] = useState<DragView>();
  const listenersRef = useRef<(() => void) | undefined>(undefined);

  const endDrag = useStableCallback(() => {
    listenersRef.current?.();
    listenersRef.current = undefined;
    dragRef.current = undefined;
    setDragView(undefined);
  });
  useEffect(() => () => listenersRef.current?.(), []);

  const evaluateDrop = (drag: DragState, x: number, y: number): DragState['result'] => {
    const current = shownRef.current;
    for (const area of PIVOT_FIELD_LIST_AREAS) {
      const zone = areaElements.current.get(area);
      if (!zone || !inside(zone.getBoundingClientRect(), x, y)) continue;
      const list = current[area];
      let marker = list.length;
      for (let index = 0; index < list.length; index += 1) {
        const element = itemElements.current.get(list[index]!.id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) { marker = index; break; }
      }
      const fieldKey = drag.source.fieldKey;
      const itemId = drag.source.kind === 'item' ? drag.source.itemId : undefined;
      return { area, marker, edit: resolvePlacement(current, rules, { fieldKey, itemId, area, marker }) };
    }
    return { area: undefined, removal: drag.source.kind === 'item' ? resolveRemoval(current, rules, drag.source.itemId) : undefined };
  };

  const pointerMove = useStableCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < DRAG_THRESHOLD) return;
      drag.active = true;
    }
    event.preventDefault();
    drag.result = evaluateDrop(drag, event.clientX, event.clientY);
    const result = drag.result;
    setDragView({
      caption: drag.caption,
      itemId: drag.source.kind === 'item' ? drag.source.itemId : undefined,
      x: event.clientX,
      y: event.clientY,
      area: result.area,
      marker: result.area !== undefined && result.edit ? result.marker : undefined,
      allowed: result.area !== undefined ? result.edit !== undefined : result.removal !== undefined,
      removing: result.area === undefined && result.removal !== undefined,
    });
  });

  const pointerUp = useStableCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.active) {
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      const result = evaluateDrop(drag, event.clientX, event.clientY);
      commit(result.area !== undefined ? result.edit : result.removal);
    }
    endDrag();
  });

  const pointerCancel = useStableCallback((event: PointerEvent) => {
    if (dragRef.current && event.pointerId === dragRef.current.pointerId) endDrag();
  });
  const dragKeyDown = useStableCallback((event: globalThis.KeyboardEvent) => {
    if (event.key === 'Escape' && dragRef.current) { event.preventDefault(); event.stopPropagation(); endDrag(); }
  });

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, source: DragSource, name: string) => {
    if (readOnly || event.button !== 0 || dragRef.current?.active) return;
    if ((event.target as Element).closest('[data-cg-pivot-field-list-arrow]')) return;
    if (fieldMap.get(source.fieldKey)?.disabled) return;
    listenersRef.current?.();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, source, caption: name, active: false, result: { area: undefined, removal: undefined } };
    const owner = event.currentTarget.ownerDocument;
    owner.addEventListener('pointermove', pointerMove);
    owner.addEventListener('pointerup', pointerUp);
    owner.addEventListener('pointercancel', pointerCancel);
    owner.addEventListener('keydown', dragKeyDown, true);
    listenersRef.current = () => {
      owner.removeEventListener('pointermove', pointerMove);
      owner.removeEventListener('pointerup', pointerUp);
      owner.removeEventListener('pointercancel', pointerCancel);
      owner.removeEventListener('keydown', dragKeyDown, true);
    };
  };

  const clickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  // ── Rendering ───────────────────────────────────────────────────────────────
  const gearItems: ReadonlyArray<CgButtonMenuItem> = [
    { key: 'stacked', text: labels.stacked, radioGroup: 'sections', checked: sections === 'stacked', onClick: () => { setSections('stacked'); onSectionLayoutChange?.('stacked'); } },
    { key: 'sideBySide', text: labels.sideBySide, radioGroup: 'sections', checked: sections === 'sideBySide', onClick: () => { setSections('sideBySide'); onSectionLayoutChange?.('sideBySide'); } },
    { key: 'ascending', text: labels.sortAscending, radioGroup: 'order', beginGroup: true, checked: order === 'ascending', onClick: () => { setOrder('ascending'); onFieldOrderChange?.('ascending'); } },
    { key: 'source', text: labels.sortSourceOrder, radioGroup: 'order', checked: order === 'source', onClick: () => { setOrder('source'); onFieldOrderChange?.('source'); } },
  ];

  const message = readOnly ? readOnlyMessage ?? labels.readOnly : '';
  // The ghost follows the pointer, so it is placed in physical coordinates, on the reading side of the pointer.
  const dragStyle: CSSProperties | undefined = dragView ? (resolvedDirection === 'rtl' ? { left: dragView.x - 12, top: dragView.y + 8, transform: 'translateX(-100%)' } : { left: dragView.x + 12, top: dragView.y + 8 }) : undefined;

  const renderArea = (area: CgPivotFieldListArea) => {
    const headingId = `${baseId}-${area}`;
    const list = shown[area];
    const tabStop = list.some((item) => item.id === activeItemId) ? activeItemId : list[0]?.id;
    const target = dragView?.area === area;
    return (
      <section
        key={area}
        ref={(element) => { if (element) areaElements.current.set(area, element); else areaElements.current.delete(area); }}
        className={styles.area}
        aria-labelledby={headingId}
        data-area={area}
        data-drop-target={target && dragView?.allowed ? '' : undefined}
        data-drop-blocked={target && !dragView?.allowed ? '' : undefined}
      >
        <div id={headingId} className={styles.areaHeading}><CgIcon name={AREA_ICONS[area]} size="1rem" /><span>{labels[area]}</span></div>
        <div className={styles.areaBody}>
          <div
            ref={(element) => { if (element) listElements.current.set(area, element); else listElements.current.delete(area); }}
            role="listbox"
            aria-labelledby={headingId}
            aria-describedby={list.length > 0 && !readOnly ? hintId : undefined}
            aria-readonly={readOnly || undefined}
            tabIndex={list.length === 0 ? -1 : undefined}
            className={styles.list}
            data-drop-end={target && dragView?.marker === list.length && list.length > 0 ? '' : undefined}
            data-drop-empty={target && dragView?.marker === 0 && list.length === 0 ? '' : undefined}
          >
            {list.map((item, index) => {
              const name = caption(item);
              const isValuesItem = item.fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY;
              const blocked = readOnly || (!isValuesItem && fieldMap.get(item.fieldKey)?.disabled === true);
              return (
                <div
                  key={item.id}
                  ref={(element) => { if (element) itemElements.current.set(item.id, element); else itemElements.current.delete(item.id); }}
                  id={`${baseId}-item-${index}-${area}`}
                  role="option"
                  aria-selected={item.id === tabStop}
                  aria-disabled={blocked || undefined}
                  tabIndex={item.id === tabStop ? 0 : -1}
                  className={styles.item}
                  data-cg-pivot-field-list-item={item.id}
                  data-values-item={isValuesItem ? '' : undefined}
                  data-drop-before={target && dragView?.marker === index ? '' : undefined}
                  data-dragging={dragView?.itemId === item.id ? '' : undefined}
                  onFocus={() => setActiveItemId(item.id)}
                  onKeyDown={(event) => itemKeyDown(event, area, item)}
                  onPointerDown={blocked ? undefined : (event) => beginDrag(event, { kind: 'item', itemId: item.id, fieldKey: item.fieldKey }, name)}
                  onClickCapture={clickCapture}
                  onContextMenu={(event) => { if (readOnly) return; event.preventDefault(); setActiveItemId(item.id); openMenu({ kind: 'item', itemId: item.id }, event.currentTarget, event); }}
                >
                  <span className={styles.itemCaption}>{name}</span>
                  {readOnly ? null : (
                    <span
                      aria-hidden="true"
                      className={styles.arrow}
                      title={labels.itemOptions(name)}
                      data-cg-pivot-field-list-arrow=""
                      onClick={(event) => { event.stopPropagation(); setActiveItemId(item.id); openMenu({ kind: 'item', itemId: item.id }, event.currentTarget.parentElement ?? event.currentTarget); }}
                    ><CgIcon name="chevron-down" size="0.875rem" /></span>
                  )}
                </div>
              );
            })}
          </div>
          {list.length === 0 && labels.emptyArea ? <div className={styles.emptyArea}>{labels.emptyArea}</div> : null}
        </div>
      </section>
    );
  };

  return (
    <div
      {...nativeProps}
      ref={mergedRef}
      id={baseId}
      dir={direction === 'auto' ? undefined : direction}
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : titleId}
      tabIndex={-1}
      className={cx(styles.root, className)}
      style={style}
      data-testid={testId}
      data-cg-pivot-field-list=""
      data-section-layout={sections}
      data-readonly={readOnly || undefined}
      data-dragging={dragView ? '' : undefined}
    >
      <div className={styles.header}>
        <h2 id={titleId} className={styles.title}>{labels.title}</h2>
        <CgDropDownButton
          appearance="ghost"
          size="small"
          icon="settings"
          aria-label={labels.tools}
          title={labels.tools}
          menuAriaLabel={labels.tools}
          placement="bottom-end"
          direction={resolvedDirection}
          items={gearItems}
          menuMaxWidth="none"
        >{null}</CgDropDownButton>
      </div>
      {message ? <div role="note" className={styles.message}>{message}</div> : null}
      <div className={styles.body}>
        <div className={styles.fieldsSection}>
          <div id={`${baseId}-choose`} className={styles.caption}>{labels.chooseFields}</div>
          <CgSearchBox
            size="small"
            query={query}
            onQueryChange={setQuery}
            searchMode="input"
            placeholder={labels.search}
            aria-label={labels.search}
            searchAriaLabel={labels.search}
            className={styles.search}
          />
          <div role="list" aria-labelledby={`${baseId}-choose`} className={styles.fields} data-cg-pivot-field-list-fields="">
            {visibleFields.map((field) => {
              const checked = isFieldInLayout(shown, field.key);
              const blocked = readOnly || field.disabled === true;
              return (
                <div
                  key={field.key}
                  role="listitem"
                  className={styles.field}
                  data-cg-pivot-field-list-field={field.key}
                  data-disabled={field.disabled ? '' : undefined}
                  onPointerDown={blocked ? undefined : (event) => beginDrag(event, { kind: 'field', fieldKey: field.key }, field.caption)}
                  onClickCapture={clickCapture}
                  onContextMenu={(event) => { if (readOnly) return; event.preventDefault(); setActiveFieldKey(field.key); openMenu({ kind: 'field', fieldKey: field.key }, event.currentTarget, event); }}
                >
                  <CgCheckBox
                    ref={(element) => { if (element) fieldElements.current.set(field.key, element); else fieldElements.current.delete(field.key); }}
                    className={styles.fieldCheck}
                    size="small"
                    checked={checked}
                    label={field.caption}
                    disabled={field.disabled}
                    readOnly={readOnly}
                    tabIndex={field.key === fieldTabStop ? 0 : -1}
                    aria-describedby={blocked ? undefined : hintId}
                    onFocus={() => setActiveFieldKey(field.key)}
                    onKeyDown={(event) => fieldKeyDown(event, field)}
                    onCheckedChange={(next) => toggleField(field, next === true)}
                  />
                  {blocked ? null : (
                    <span
                      aria-hidden="true"
                      className={styles.arrow}
                      title={labels.fieldOptions(field.caption)}
                      data-cg-pivot-field-list-arrow=""
                      onClick={(event) => { event.stopPropagation(); setActiveFieldKey(field.key); openMenu({ kind: 'field', fieldKey: field.key }, event.currentTarget.parentElement ?? event.currentTarget); }}
                    ><CgIcon name="chevron-down" size="0.875rem" /></span>
                  )}
                </div>
              );
            })}
          </div>
          {visibleFields.length === 0 && query.trim() ? <div className={styles.noFields}>{labels.noFields}</div> : null}
        </div>
        <div className={styles.areasSection}>
          <div className={styles.caption}>{labels.dragBetweenAreas}</div>
          <div className={styles.areas}>{PIVOT_FIELD_LIST_AREAS.map(renderArea)}</div>
        </div>
      </div>
      <div className={styles.footer}>
        <CgCheckBox size="small" label={labels.deferUpdate} checked={deferred} disabled={readOnly} onCheckedChange={(next) => changeDeferred(next === true)} />
        <CgButton size="small" appearance="outline" disabled={readOnly || !deferred} onClick={applyDraft}>{labels.update}</CgButton>
      </div>
      <span id={hintId} className={styles.visuallyHidden}>{labels.keyboardHint}</span>
      <div role="status" aria-live="polite" className={styles.visuallyHidden}>{announcement}</div>
      {dragView ? (
        <div className={styles.ghost} style={dragStyle} aria-hidden="true" data-removing={dragView.removing ? '' : undefined} data-blocked={!dragView.allowed ? '' : undefined}>
          {dragView.removing ? <CgIcon name="close" size="0.875rem" /> : null}
          <span>{dragView.caption}</span>
        </div>
      ) : null}
      <CgContextMenu<MenuContext>
        actionsRef={menuRef}
        items={[]}
        ariaLabel={labels.title}
        direction={resolvedDirection}
        restoreFocus={false}
        customizeMenu={customizeMenu}
        afterClose={afterMenuClose}
      />
    </div>
  );
});
