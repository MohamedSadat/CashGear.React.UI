# PivotFieldList

`CgPivotFieldList` is the spreadsheet "PivotTable Fields" task pane: a checklist of source fields above (or beside) four areas, Filters, Columns, Rows and Σ Values. It holds no pivot logic. The host owns the layout and the pane proposes changes to it.

```tsx
import { CgPivotFieldList, CG_PIVOT_FIELD_LIST_VALUES_KEY } from '@cashgear/ui';
import type { CgPivotFieldListLayout } from '@cashgear/ui';

const fields = [
  { key: 'region', caption: 'Region' },
  { key: 'date', caption: 'Date' },
  { key: 'sales', caption: 'Sales', defaultArea: 'values' as const },
];

function Fields({ layout, apply }: { layout: CgPivotFieldListLayout; apply: (next: CgPivotFieldListLayout) => void }) {
  return (
    <CgPivotFieldList
      fields={fields}
      layout={layout}
      onLayoutChange={(next, change) => apply(next)}
      getValueCaption={(field) => `Sum of ${field.caption}`}
      onFieldSettings={(item, area) => openFieldSettings(item, area)}
      onValueFieldSettings={(item) => openValueFieldSettings(item)}
    />
  );
}
```

## Layout and changes

`layout` holds four lists of items. An item has a unique `id`, the `fieldKey` it shows and an optional `caption`, such as `Sum of Sales`. The Σ Values item, Excel's field `-2`, has `fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY` (`'__values'`). The host adds and removes it; the pane only draws it and keeps it to Columns and Rows.

`onLayoutChange(next, change)` receives the whole proposed layout and what made it:

- `{ kind: 'add', itemId, fieldKey, to }`, `{ kind: 'move', itemId, fieldKey, from, to }` or `{ kind: 'remove', itemId, fieldKey, from }`. `from` is the position before the change and `to` the position after it.
- `{ kind: 'batch', changes }` for several at once, in order: Update with updates deferred, a value item dragged out of Values (its removal, then the field's add or move), and unchecking a field with more than one item.

Items the pane creates get the id `${area}:${fieldKey}:${n}`, with the smallest `n` from 0 that the layout doesn't use, such as `values:sales:0`. Hosts usually re-key them. A new value item is named by `getValueCaption(field)`; without it the item has no caption and shows the field's.

The pane enforces Excel's rules before calling `canDrop(fieldKey, area, index)`, where `index` is where the item would land:

- A field sits in at most one of Filters, Columns and Rows. Adding it to another of them moves it.
- Values can hold the same field more than once. Dropping or adding a field to Values always adds a new value item and leaves the field where it was.
- Dragging a value item to Filters, Columns or Rows removes it from Values and adds (or moves) the field there.
- Σ Values moves only within and between Columns and Rows, and can't be removed.
- A `disabled` field can't be checked, added, moved or removed.

## Fields

A field is checked while any item uses it. Checking or unchecking calls `onFieldToggle(fieldKey, checked)` when given, and the pane changes nothing itself, so the host decides where it goes. Without it, checking adds the field to its `defaultArea` (default `rows`) and unchecking removes every item of the field. With deferred updates, prefer `defaultArea`, since a new `layout` from the host replaces the draft.

Each field has a dropdown arrow on hover and focus with Add to Report Filter, Row Labels, Column Labels and Values. The search box filters by caption. The tools menu switches the sections between stacked (`sectionLayout: 'stacked'`, the default) and side by side, and the list between data source order and A to Z (`fieldOrder`). Both are controlled or uncontrolled, with `default…` and `on…Change` props.

## Items, dragging and the keyboard

Each item's menu has Move Up, Move Down, Move to Beginning, Move to End, Move to Report Filter, Row Labels, Column Labels or Values, Remove Field, and Field Settings… (Filters, Columns, Rows) or Value Field Settings… (Values), which call `onFieldSettings(item, area)` and `onValueFieldSettings(item)`. A command that would change nothing or that a rule refuses is disabled.

Drag a field from the list, or an item, with the pointer. A line marks where it lands, and an area that won't take it isn't highlighted. Dropping an item outside the areas removes it. Escape cancels a drag.

The keyboard does everything drag does through the menus. Tab moves between the tools button, search box, field list, each area, Defer Layout Update and Update. In a list the arrows, Home and End move, Space toggles a field, Enter, Shift+F10 or the context-menu key opens the menu, and Delete removes an item. After a move, focus follows the item. Changes are announced in a polite live region.

## Deferred updates and read-only

With Defer Layout Update checked (`deferUpdate` / `defaultDeferUpdate` / `onDeferUpdateChange`), edits go to a draft that the pane shows, and Update reports them as one batch. Unchecking it applies anything pending, while a host that sets `deferUpdate={false}` itself drops the draft. A new `layout` from the host also replaces the draft. The pane doesn't add or remove Σ Values in a draft, so it appears or goes when the host takes the update.

`readOnly` shows everything and changes nothing: no toggles, drags or item menus, with `readOnlyMessage` (or `labels.readOnly`) at the top. The tools menu still works because it changes only the pane's own view.

## Labels, direction and theme

`labels` overrides every visible string, including the announcements; English is the default. The pane uses logical CSS and follows `direction` or its parent's, so Arabic labels mirror. It uses the theme tokens, so `data-cg-theme="dark"` works. Its host gives it a size: it fills its container's height, with a 24rem minimum.

Storybook: `Phase 36/PivotFieldList`. Tests: `CgPivotFieldList.test.tsx`, `pivotFieldListModel.test.ts`, `tests/browser/phase36.browser.spec.ts` and `tests/browser/phase36.visual.spec.ts`.
