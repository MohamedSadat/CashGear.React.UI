# `@cashgear/ui`

CashGear's React 19 component library: accessible, typed, themeable controls for dense business applications. Phases 1–15 mirror the foundational controls, object- and scalar-key ComboBox surfaces, ListBox, TagBox, arbitrary-content DropDownBox, DateEdit, overlays, MaskedInput, command surfaces, descriptor-based navigation, responsive FormLayout, TreeView, the focused `CgLookUpGrid`, and the advanced Filter/Grid/Pager surface in `CG.CompLib` without Bootstrap or DevExpress runtime dependencies.

## Install and import

```bash
npm install @cashgear/ui
```

React and React DOM are peer dependencies. Import the one explicit stylesheet once at application startup:

```tsx
import '@cashgear/ui/styles.css';
import { CgButton, CgField, CgTextBox } from '@cashgear/ui';
```

Deep package imports are intentionally blocked. Runtime exports are limited to the documented root API.

## Theme, density, and direction

Theme and density are inherited through data attributes; direction uses native `dir` and logical CSS properties.

```html
<main data-cg-theme="dark" data-cg-density="compact" dir="rtl">
  <!-- CashGear controls -->
</main>
```

- `data-cg-theme`: `light` or `dark`
- `data-cg-density`: `comfortable` or `compact`
- `dir`: `ltr` or `rtl`

The stylesheet exposes the source-aligned `--cg-surface`, `--cg-text`, `--cg-accent`, feedback, typography, spacing, editor-height, focus, and overlay tokens. The earlier `--cg-color-*` names remain aliases. Override tokens on a scoped container; no global reset is installed.

## Fields and controlled state

`CgField` owns labels, descriptions, required indicators, validation messages, generated IDs, and ARIA relationships. It communicates with controls through context and never clones its child.

```tsx
import { useState } from 'react';
import { CgField, CgTextBox } from '@cashgear/ui';

export function AccountEditor() {
  const [code, setCode] = useState('');
  return (
    <CgField
      label="Account code"
      description="General-ledger account"
      required
      errorMessage={code ? undefined : 'Account code is required'}
    >
      <CgTextBox value={code} onValueChange={setCode} clearButton="auto" />
    </CgField>
  );
}
```

Controls accept either `value`/`checked` plus a change callback, or `defaultValue`/`defaultChecked` for uncontrolled use. Do not switch modes during a component's lifetime; development builds warn once when that happens, including under Strict Mode. TextBox and Memo keep a separate draft and can commit on input, blur, or a debounce. Controlled external updates cancel pending debounce work without replacing an active IME composition until composition ends.

## Native forms

Inputs forward refs and native attributes such as `name`, `form`, `required`, `autoComplete`, and `aria-*`. Button supports `button`, `submit`, and `reset`. Uncontrolled controls restore their defaults on native form reset, including controls associated to a non-ancestor form through `form="form-id"`. Standalone uncontrolled radios intentionally rely on native same-name grouping.

```tsx
<form onSubmit={save}>
  <CgField label="Reference" required>
    <CgTextBox name="reference" defaultValue="SO-" />
  </CgField>
  <CgCheckBox name="approved" label="Approved" />
  <CgButton type="submit" intent="primary">Save</CgButton>
  <CgButton type="reset" appearance="ghost">Reset</CgButton>
</form>
```

Read-only checkbox, switch, and radio controls remain focusable but suppress state changes. Disabled controls use native disabled behavior.

## ComboBox

`CgComboBox<TItem>` is object-valued and uses stable keys for identity and native form serialization. The editable query is never submitted. Supply local `options` or remote `loadOptions`, but not both.

```tsx
interface Customer { id: number; name: string; city: string }

<CgComboBox<Customer>
  name="customerId"
  form="order-form"
  options={customers}
  value={customer}
  onValueChange={(next, { reason }) => setCustomer(next)}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
  getOptionSearchText={(item) => `${item.name} ${item.city}`}
  clearable
  required
/>
```

Remote loading receives a trimmed eligible query, monotonic request ID, and `AbortSignal`. Debounced work is aborted when superseded or unmounted, and stale results cannot replace a newer generation.

```tsx
<CgComboBox<Customer>
  loadOptions={(query, { signal }) =>
    fetch(`/customers?q=${encodeURIComponent(query)}`, { signal }).then((response) => response.json())
  }
  minimumSearchLength={2}
  searchDelay={250}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

The visible input retains focus while the body-portal listbox opens, flips, shifts, and follows nested scrolling or viewport changes. Arabic digits/text and diacritic-insensitive locale matching are supported. Duplicate keys, conflicting local/remote sources, negative timing/length values, and invalid result limits throw clear errors.

## KeyComboBox

`CgKeyComboBox<TItem, TValue>` is the scalar-key adapter for models that store an id or code instead of the selected object. `TValue` is a `string` or `number`; `null` is empty and `0` remains a valid key. Filtering, loading, keyboard, ARIA, popup positioning, validation, form serialization, and reset behavior come from `CgComboBox`.

```tsx
interface Customer { id: number; name: string }

<CgKeyComboBox<Customer, number>
  name="customerId"
  options={customers}
  value={customerId}
  onValueChange={(nextId, { selectedItem }) => {
    setCustomerId(nextId);
    setCustomer(selectedItem);
  }}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

Keys resolve from local `options` first, then `selectedItem`, then the last item selected through the editor. Supply `selectedItem` when a controlled initial key is not in the local source, including remote or paged data. Without it the editor and native form value are empty, and a required editor is invalid. `isValueEqual` customizes key matching; for example, account codes can compare case-insensitively. There is intentionally no async key resolver.

```tsx
<CgKeyComboBox<Customer, number>
  loadOptions={loadCustomers}
  value={customerId}
  selectedItem={loadedCustomer}
  onValueChange={setCustomerId}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

## ListBox

`CgListBox<TItem>` binds an object array and uses `getItemKey` for stable identity, selection reconciliation, and native form serialization. Single and multiple selection support native-style pointer modifiers, keyboard ranges, disabled-item skipping, checkboxes, and filtered tri-state Select All.

```tsx
interface Warehouse { id: number; code: string; name: string; region: string }

<CgListBox<Warehouse>
  name="warehouseIds"
  form="transfer-form"
  items={warehouses}
  value={selectedWarehouses}
  onValueChange={(next, { addedItems, removedItems, reason }) => {
    setSelectedWarehouses(next);
  }}
  getItemKey={(item) => item.id}
  getItemLabel={(item) => `${item.code} - ${item.name}`}
  getItemSearchText={(item) => `${item.code} ${item.name} ${item.region}`}
  selectionMode="multiple"
  showCheckboxes
  showSelectAll
  searchable
  required
/>
```

Search is locally controlled or uncontrolled and debounces by 250 ms by default. It supports contains/starts-with/equals matching, all-words/any-word/exact parsing, locale-aware Arabic and diacritic folding, application filtering, searchable columns, safe `<mark>` fragments, and IME-safe drafts. Select All affects only currently visible, enabled items and preserves selections hidden by search or filtering.

Columns use a typed descriptor array; rows may instead use `renderItem`. One non-collapsible group level follows first-appearance order. `renderMode="entire"` permits variable-height templates, while `renderMode="virtual"` uses the private fixed-row virtualizer and therefore requires a stable `itemSize` when custom sizing is needed.

```tsx
<CgListBox
  items={warehouses}
  getItemKey={(item) => item.id}
  getItemLabel={(item) => item.name}
  columns={[
    { key: 'code', header: 'Code', getValue: (item) => item.code, width: 110 },
    { key: 'name', header: 'Warehouse', getValue: (item) => item.name },
    { key: 'region', header: 'Region', getValue: (item) => item.region, alignment: 'end' },
  ]}
  getItemGroupKey={(item) => item.region}
  renderMode="virtual"
  itemSize={40}
  height={320}
/>
```

Each selected stable key is submitted through an internal native multi-select; the search query is never submitted. `name`, external `form` association, required validity, disabled exclusion, missing selected keys, native reset, and invalid-focus transfer to the visible listbox are supported. Duplicate item or column keys, multiple values in single mode, negative timing/overscan, nonpositive item sizes, and invalid Select All configurations throw clear errors.

## TagBox

`CgTagBox<TItem>` binds an object array and renders the selected values as removable tags around an input-focused ARIA combobox. Stable keys reconcile refreshed objects and serialize native form values; selected objects missing from the current option source remain visible.

```tsx
<CgTagBox<Customer>
  name="customerIds"
  form="campaign-form"
  options={customers}
  value={selectedCustomers}
  onValueChange={(next, { addedItems, removedItems, reason }) => {
    setSelectedCustomers(next);
  }}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
  getOptionSearchText={(item) => `${item.code} ${item.name} ${item.city}`}
  maxSelectedItems={5}
  clearable
  required
/>
```

Supply exactly one of local `options` or remote `loadOptions`. Local filtering is immediate. Remote loading receives the trimmed eligible query, a monotonic request ID, and an `AbortSignal`; the raw draft remains available through `onSearchQueryChange` and native `onChange`.

```tsx
<CgTagBox<Customer>
  loadOptions={(query, { signal }) =>
    fetch(`/customers?q=${encodeURIComponent(query)}`, { signal }).then((response) => response.json())
  }
  minimumSearchLength={2}
  searchDelay={250}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

Arrow keys, Home/End, Enter, Escape, Tab, outside clicks, and empty-query Backspace follow the Razor interaction model. IME drafts do not start searches until composition ends. Contains/starts-with matching supports locale, Arabic, and diacritic folding. Maximum selection disables only unselected options; existing selections remain removable.

Each selected key is submitted through an internal native multi-select, never through the editable query. External `form` association, native reset, required validation, disabled exclusion, invalid-focus transfer, custom option/tag rendering, dark/compact density, and RTL are supported. Duplicate option keys and invalid source/timing/limit combinations throw clear errors.

The React contract intentionally stores selected objects rather than Razor scalar keys. Custom key comparers, scalar-key adapters, and `ResolveValuesAsync` hydration remain deferred because selected objects carry their tag labels.

## DropDownBox

`CgDropDownBox<TValue>` is a typed read-only value editor that hosts arbitrary React content in an SSR-safe body portal. `null` is empty by default; `emptyValue`, `isEmptyValue`, and `isValueEqual` support application-specific value models while preserving `0` and `false` as normal values.

Immediate mode commits hosted choices through the render context. The selected value controls display text, while the editable display input is never submitted:

```tsx
<CgDropDownBox<Customer>
  name="customerId"
  form="order-form"
  value={customer}
  onValueChange={setCustomer}
  getDisplayText={(item) => `${item.code} - ${item.name}`}
  isValueEqual={(left, right) => left?.id === right?.id}
  serializeValue={(item) => String(item.id)}
  clearable
  required
>
  {(dropDown) => (
    <CgListBox
      aria-label="Customer choices"
      items={customers}
      value={dropDown.pendingValue ? [dropDown.pendingValue] : []}
      onValueChange={(items, details) =>
        dropDown.commitValue(items[0] ?? null, details.event)
      }
      getItemKey={(item) => item.id}
      getItemLabel={(item) => item.name}
    />
  )}
</CgDropDownBox>
```

Explicit mode snapshots the authoritative value when opening. Hosted controls edit `pendingValue`; Apply commits once, while Cancel, Escape, outside click, anchor scroll/loss, and accepted programmatic closes restore the committed snapshot. A cancelled close preserves both the popup and pending state.

```tsx
<CgDropDownBox<readonly Customer[]>
  value={selectedCustomers}
  onValueChange={setSelectedCustomers}
  commitMode="explicit"
  getDisplayText={(items) => items.map((item) => item.code).join(', ')}
  isEmptyValue={(items) => !items?.length}
  serializeValue={(items) => items.map((item) => String(item.id))}
  renderFooter={(dropDown) => (
    <>
      <button type="button" onClick={() => dropDown.cancel()}>Cancel</button>
      <button type="button" onClick={() => dropDown.apply()}>Apply</button>
    </>
  )}
>
  {(dropDown) => (
    <CgTagBox
      options={customers}
      value={dropDown.pendingValue ?? []}
      onValueChange={dropDown.setPendingValue}
      getOptionKey={(item) => item.id}
      getOptionLabel={(item) => item.name}
    />
  )}
</CgDropDownBox>
```

Named primitive values serialize automatically. A named nonempty object or collection requires `serializeValue`, which may return one string or multiple strings. An internal select proxy handles nested/external forms, required validity, disabled exclusion, reset, and invalid-focus transfer to the visible input.

Open/close state is controlled or uncontrolled. Editor click, F4, and Alt+ArrowDown open the popup; Escape, outside pointer, ancestor scroll, and anchor loss close it. `actionsRef` exposes open, close, toggle, clear, focus, reposition, and display-text commands. Cancellable `onBeforeOpen`/`onBeforeClose` receive `AbortSignal`; newer transitions and disposal abort stale work, while `onTransitionError` observes rejected lifecycle thenables.

All twelve logical placements, editor/content/content-or-editor/explicit width modes, CSS size constraints, optional resize/scroll ownership, viewport flip/shift, nested scrolling, focus return, and stacked overlays are supported without focus trapping. Portal surfaces inherit the anchor's theme, density, and native direction.

## DateEdit

`CgDateEdit` stores only a canonical Gregorian civil date (`YYYY-MM-DD`) or `null`. Display and edit formatting never changes the submitted value, and no public state contains a JavaScript `Date`.

```tsx
<CgDateEdit
  name="postingDate"
  value={postingDate}
  onValueChange={setPostingDate}
  editFormat="dd/MM/yyyy"
  displayFormat="d MMMM yyyy"
  locale="en-GB"
  minDate="2026-01-01"
  maxDate="2026-12-31"
  required
/>
```

Formats use the exact tokens `yyyy`, `M`, `MM`, `MMM`, `MMMM`, `d`, and `dd`. Punctuation and whitespace are literal; alphabetic text must be quoted, as in `d 'of' MMMM yyyy`. A pattern must contain exactly one year, month, and day field. Parsing accepts locale digits and localized month names, strips bidirectional marks, and rejects missing/duplicate fields, mismatched padding or literals, and impossible dates without normalization. The default edit order comes from the locale's numeric date parts; `displayFormat` defaults to `editFormat`.

The private six-week calendar includes adjacent-month days plus month and 12-year panels. It uses `Intl` names, locale week starts, integer civil-date arithmetic, logical RTL navigation, and the shared body-portal overlay stack without a focus trap. `minDate`, `maxDate`, and `isDateDisabled` apply equally to typed values, calendar choices, and Today.

`onBeforeValueChange` can synchronously or asynchronously veto a proposal. It receives an `AbortSignal`; a newer attempt or unmount aborts older work, and stale completions cannot commit. A hidden native select submits only the canonical committed value and provides external-form association, reset, required/custom validity, disabled exclusion, and invalid-focus transfer. Invalid external values remain visible verbatim; valid restricted values remain formatted and invalid. DateRangePicker and a public Calendar remain intentionally deferred.

## Flyout and overlay lifecycle

`CgFlyout` is a non-modal, non-trapping body-portal surface. Its anchor may be an element, React ref, selector, viewport rectangle, or point. Twelve logical placements support RTL, offset, flip, shift, anchor-width matching, CSS constraints, resizing, scrolling, and explicit repositioning. Outside dismissal uses a matching pointer-down/up pair; owned nested portals and `data-cg-overlay-boundary` markers count as inside their ancestors.

```tsx
const anchor = useRef<HTMLButtonElement>(null);
const flyout = useRef<CgFlyoutActions>(null);

<button ref={anchor} onClick={() => void flyout.current?.toggle()}>Actions</button>
<CgFlyout anchor={anchor} actionsRef={flyout} placement="bottom-end" header="Posting">
  <button type="button">Post journal</button>
</CgFlyout>
```

Flyout, Popup, and Window share the same controlled/uncontrolled lifecycle. Component, action, and user proposals run cancellable `onBeforeOpen`/`onBeforeClose` hooks; every newer request aborts older work, rejected thenables are reported through `onLifecycleError`, and stale completions cannot change state. Controlled props remain authoritative. Direct controlled-prop transitions skip cancellable before-hooks but emit their after-hook only after the rendered transition. `contentLoadMode` chooses `everyOpen`, `firstOpen`, or `fromMount` retention.

## Popup and Window

`CgPopup` is always modal. It renders a backdrop plus `dialog` or `alertdialog`, traps focus only in the topmost modal, isolates body siblings, locks body scrolling, and restores the connected opener after an accepted close. Standard header/body/footer nodes and text shortcuts may be replaced by `renderHeader`, `renderBody`, and `renderFooter`; their context supplies `close`, `focus`, and the ownership `boundaryId`. Position/alignment, dragging, eight-edge resizing, scrolling, transparent shading, and adaptive full-available-width layout below 768px are supported.

`CgWindow` reuses the same chrome, sizing, content retention, focus entry, drag, resize, and viewport constraints without modal isolation or trapping. Multiple windows maintain modeless paint order and raise on pointer/focus entry. Its actions expose `show`, `close`, `showAt`, `showAtPoint`, `showNear`, `moveTo`, `moveToPoint`, and `focus`; controlled position rejection restores authoritative coordinates. Escape is scoped to the focused window or an owned descendant overlay.

```tsx
<CgPopup defaultOpen headerText="Approve journal" allowDrag allowResize>
  Review the posting before approval.
</CgPopup>

<CgWindow defaultOpen headerText="Account lookup" defaultPosition={{ x: 160, y: 90 }}>
  Modeless working content
</CgWindow>
```

Body portals inherit the source `data-cg-theme`, `data-cg-density`, and computed direction. This is the deliberate React adaptation in place of Razor/DevExpress top-layer plumbing. A third-party portal rendered from an overlay template can join ownership by setting `data-cg-overlay-boundary={boundaryId}`.

## Menus, context commands, button menus, and Toolbar

All Phase 10 command surfaces adapt immutable public descriptors into one private menu engine. It owns structural validation, pruning, safe URLs, locale-aware typeahead, roving focus, logical RTL arrows, check/radio proposals, and nested `CgFlyout` ownership. Menu and standalone button trees support up to 16 levels, context menus up to 32, and Toolbar descriptors up to three. Relative/hash URLs and absolute `http`, `https`, `mailto`, and `tel` URLs are accepted; other schemes are rejected.

```tsx
const menuItems = [
  { key: 'home', text: 'Home', navigateUrl: '/' },
  { key: 'sales', text: 'Sales', children: [{ key: 'orders', text: 'Orders' }] },
] as const;

<CgMenu items={menuItems} semanticMode="navigation" selectionMode="route" />
<CgDropDownButton items={[{ key: 'new', text: 'New invoice' }]}>Actions</CgDropDownButton>
<CgSplitButton items={[{ key: 'save-close', text: 'Save and close' }]}>Save</CgSplitButton>
<CgToolbar items={[{ name: 'new', text: 'New', icon: 'check' }]} />
```

`CgMenu` supports navigation or application semantics, nested or flat trees, controlled selection/expansion, route matching without a router dependency, and deterministic container-based caption/hamburger adaptation. Native anchors keep their `href`, target, modifier/middle-click, and browser-context-menu behavior; `currentLocation` is authoritative for SSR or SPA integration and `onNavigate` is observational.

`CgContextMenu<TContext>` gives every invocation a typed context, fresh structural/check snapshot, owner, anchor metadata, and `AbortSignal`. `useCgContextMenuTarget` composes a target ref and handlers for right-click, Shift+F10/Menu, long press, and optional click without wrapper DOM or string IDs. Confirmation-bearing items require an explicit `confirm` callback. New invocations supersede stale opening/command work; cancellation or failure rolls check/radio proposals back.

Button menus compose `CgButton`, `CgFlyout`, and the same menu surface. `CgDropDownButton` is only a trigger; `CgSplitButton` isolates the primary action/form contract from its toggle. Arbitrary content uses dialog semantics and receives `close()` and `reposition()`. Toolbar dispatches commands, links, custom content, dropdowns, and split buttons across logical start/end rails, then adapts full text → adaptive text → icon-only → deterministic one-at-a-time overflow through a container `ResizeObserver`.

## Descriptor navigation and FormLayout

Phase 11 adds keyed, immutable descriptor surfaces for Tabs, Stepper, Accordion, and FormLayout tabs. Keys are required nonempty strings and controlled props remain authoritative: user interaction proposes state through callbacks, while collection reconciliation emits a single non-user correction when the authoritative key disappears. Async guards and close/load lifecycles receive `AbortSignal`; replacement work aborts stale generations and errors use the component-specific observer.

```tsx
<CgTabs
  tabs={[
    { key: 'summary', text: 'Summary', content: <Summary /> },
    { key: 'lines', text: 'Lines', content: <Lines />, closable: true },
  ]}
  activeKey={activeTab}
  onActiveKeyChange={setActiveTab}
  contentMode="on-demand"
/>

<CgStepper
  steps={steps}
  selectedKey={currentStep}
  onSelectedKeyChange={setCurrentStep}
  beforeSelectionChange={({ signal }) => validateStep(signal)}
/>
```

`CgTabs` supplies manual keyboard activation, logical RTL arrows, close proposals, pointer reordering, four header positions, retained on-demand panels, overflow controls, and imperative focus/activation/scroll actions. `CgStepper` defaults to linear horizontal progress, evaluates current/target/global guards in order, presents optional/validation/skipped/completed status text, and exposes asynchronous navigation actions. `CgAccordion` accepts either nested descriptors or a flat `parentKey` collection, supports disclosure or tree semantics, controlled expansion/selection/filtering, safe route matching, transient filtered expansion, cached abortable lazy loading, and retained on-demand content.

`CgLayoutBreakpoint` and `useCgLayoutBreakpoint` expose the exact named bands `x-small`, `small`, `medium`, `large`, and `x-large`, or an inclusive custom integer range. SSR and hydration start from `defaultMatches` before reconciling with `matchMedia`; named boundaries are 575/576, 767/768, 991/992, and 1199/1200 pixels.

```tsx
<CgFormLayout captionPosition="horizontal" captionWidth="10rem">
  <CgFormLayoutItem caption="Customer" xs={12} md={6}>
    <CgTextBox value={customer} onValueChange={setCustomer} />
  </CgFormLayoutItem>
  <CgFormLayoutGroup caption="Delivery" collapsible>
    {/* Nested layout items */}
  </CgFormLayoutGroup>
</CgFormLayout>
```

FormLayout is real React composition through private context rather than declaration inspection or registration. Its root, group bodies, and tab panels establish inline-size containers; spans switch at 576, 768, 992, 1200, and 1400 pixels, while side captions become a two-track layout at 560 pixels. A caption is a native label only with `captionFor`; otherwise compatible CashGear fields consume private caption context after explicit ARIA and `CgField` names. Collapsed group bodies remain mounted and hidden, and `CgFormLayoutTabs` uses key-oriented descriptor tabs with retained on-demand content by default. No `CgFormLayoutTabPage` compatibility marker is exported.

## TreeView

`CgTreeView<TItem>` uses immutable keyed descriptors. Supply either nested `children` or one flat collection with `parentKey`; mixing the two forms, duplicate/empty keys, missing parents, cycles, self-parenting, and excessive depth are configuration errors. Caller descriptors are never mutated, and state is preserved by stable key when nodes reorder.

```tsx
const nodes = [
  {
    key: 'products',
    text: 'Products',
    children: [
      { key: 'hardware', text: 'Hardware' },
      { key: 'software', text: 'Software', searchText: 'applications' },
    ],
  },
] as const;

<CgTreeView
  nodes={nodes}
  checkMode="recursive"
  defaultExpandedKeys={new Set(['products'])}
  showFilterPanel
  contextMenuAreas="all"
  aria-label="Product catalog"
/>
```

Selection, expansion, checking, and filtering are independently controlled or uncontrolled. Recursive checking applies to the complete normalized model—even while filtered—and derives checked/mixed ancestors without changing disabled or non-checkable descendants. Filtering retains matching ancestors and transiently expands their paths; clearing it restores committed expansion exactly. Rich React labels need `searchText` or a custom filter predicate because highlighting is built from safe text fragments rather than HTML.

The component owns `tree`/`treeitem`/`group` structure, one roving tab stop, complete physical Left/Right tree navigation in LTR and RTL, selection/check/expansion semantics, and stable instance-scoped DOM IDs. Read-only trees remain navigable. Node and empty-area menus reuse `CgContextMenu`; opening one never selects a node, and commands revalidate their target before execution. `CgTreeViewActions` exposes focus, selection, expansion, checking, ancestor expansion, and scrolling operations. TreeList, lazy loading, virtualization, drag-and-drop, and inline editing remain deliberately outside this component.

## Filter Core and FilterBuilder

The UI-independent Filter Core provides immutable groups, scalar and collection aggregate conditions, explicit source ownership, canonical typed values, relative periods, safe normalization/validation, structural comparison, formatting, field-ID migration, local evaluation, predicate compilation, and saved-view helpers. It never evaluates property paths, expressions, functions, or source text: local execution requires a registered field accessor. Relative criteria require an injected clock, IANA timezone, and first weekday so calendar-day and DST behavior is deterministic.

`CgFilterBuilder<TItem>` edits that same AST without mutating caller state. Explicit, immediate, and debounced apply modes retain separate draft/applied state; incomplete rows remain visible and block Apply. Stable node IDs support nested/negated groups, collection aggregates, duplicate/remove/reorder/collapse actions, accessible errors and announcements, keyboard reordering, RTL, forced colors, reduced motion, and responsive stacking. Custom field editors and displays take precedence over generated CashGear editors.

Persistence and transport use the exact Razor `$type` wire discriminators and pinned numeric ordinals, while React code keeps ergonomic string literals in memory. Legacy `value`/`secondValue` operands and Grid states v1–v9 are accepted only at compatibility boundaries and normalize to the canonical typed AST.

## Pager

`CgPager` owns no data. It exposes zero-based state with one-based display, controlled or uncontrolled page/page-size state, authoritative or derived page counts, overflow-safe arithmetic, numeric/input/status/auto modes, first/previous/next/last controls, page-size selection, first-visible-item preservation, templates, loading/read-only/disabled behavior, Unicode decimal input, roving focus, and chronological keyboard navigation in LTR and RTL. Responsive measurement is SSR-safe and never emits navigation merely because the mode changed.

## Grid

`CgGrid<TItem>` is a descriptor-driven data grid for local arrays or abortable async providers. Columns require stable `fieldId` identities and explicit typed accessors; `keySelector` supplies stable scalar row identity. Version-10 serializable state carries paging, search, sorting, canonical filters and suspension, key selection, focus, column layout, grouping, remote expansion paths, and summary identity/visibility. State migration accepts versions 1–9 and reconciles renamed fields and changed aggregate keys before a provider request is constructed.

```tsx
const columns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = [
  { type: 'text', fieldId: 'customer', accessor: row => row.customer, searchable: true },
  { type: 'number', fieldId: 'amount', accessor: row => row.amount },
];

<CgGrid
  data={invoices}
  columns={columns}
  keySelector={row => row.id}
  selectionMode="multiple"
  allowGrouping
  allowColumnChooser
/>
```

Local processing is search, validated filter, complete-set summaries, stable sorting, grouping, then paging. Filter-row and builder-owned criteria remain structurally separate; invalid saved criteria retain diagnostics but never execute or reach a provider. The default footer is controlled `CgPager`, while Grid remains the sole paging/data authority. Provider requests use stable field IDs and `rows`, `groupNodes`, and `groupItems` modes with typed group paths, cancellation, sequencing, retained refresh errors, and authoritative summaries. Razor-compatible request helpers encode/decode the wire AST without changing semantic provider callbacks.

`CgGridActions<TItem>` exposes refresh, paging, filter-builder delegation, state, focus, selection, grouping, detail, editing, layout, and XLSX operations. Popup editing remains the default; inline-row, cell, and atomic batch modes add immutable draft snapshots, active-cell state, dirty navigation policies, validation focus, concurrency metadata, conflict retry/reload, and one complete batch callback. Paging, sorting, filtering, grouping, views, refresh, and external router guards share one cancellable dirty-navigation gate. The caller owns persistence and source updates; successful persistence reloads once after its callback completes.

Custom summaries use stable aggregate keys and ordered input field IDs. Built-ins stay synchronous; trusted local custom delegates run through an abortable async path over complete filtered total/group scopes, and remote requests contain only serializable IDs, keys, fields, scope, and query state. Availability, loading, safe error codes, and completeness are explicit.

The React adaptation deliberately does not expose Razor child registration, expressions, SQL/EF/Dapper translation, generic HTTP adapters, server persistence, or Blazor lifecycle concepts. Row/column virtualization, automatic column discovery, and unrelated deferred controls remain out of scope.

## LookUpGrid

`CgLookUpGrid<TItem, TValue>` is a key-bound, single-selection editor whose `CgFlyout` contains a focused multi-column lookup surface. Immutable descriptors replace Razor child-column registration, and exactly one local array or abortable async loader is required.

```tsx
const lookupColumns: ReadonlyArray<CgLookUpGridColumnDescriptor<Product>> = [
  { fieldId: 'code', title: 'Item', accessor: row => row.code, width: 120 },
  { fieldId: 'name', title: 'Description', accessor: row => row.name },
  { fieldId: 'available', title: 'Available', accessor: row => row.available,
    alignment: 'end', searchable: false },
];

<CgLookUpGrid
  data={products}
  columns={lookupColumns}
  value={productId}
  onValueChange={setProductId}
  valueSelector={row => row.id}
  textSelector={row => `${row.code} — ${row.name}`}
  showFilterRow
/>
```

Async loaders receive normalized search text, visible searchable field IDs, one sort, immutable column filters, `skip`/`take`, opaque `queryContext`, and an `AbortSignal`. `itemResolver` hydrates an existing key without opening or searching. Fresh callback identities are adopted without resetting state; stale work is aborted and rejected by generation.

`null` is the explicit React no-selection value. Blank string keys are also empty for ERP compatibility, while numeric zero remains valid. Strings and numbers serialize to native forms automatically; other named values require `serializeValue`. Object query contexts should be memoized or paired with `isQueryContextEqual`. Context is query input, not an authorization boundary—the server must still enforce tenant, branch, warehouse, and permission scope.

The input retains focus and owns `aria-activedescendant`; paging appends rows, disabled rows stay visible but cannot be selected, and the filter-row Tab path is lookup-specific. `CgLookUpGridActions` exposes popup, reload, paging, sorting, filtering, state inspection, focus, and clear operations. Multiple selection, grouping, master-detail, column chooser/reordering/resizing/freezing, CRUD, summaries, export, and row virtualization remain intentionally exclusive to `CgGrid`; no ignored or fake virtualization prop is exposed.

## MaskedInput

`CgMaskedInput` follows TextBox's `value`, `defaultValue`, and `onValueChange` convention, uses `''` as empty, and forwards its `HTMLInputElement` ref plus native events and attributes. Masks are Unicode-aware: `0`, `L`, `A`, and `*` are required digit/letter/alphanumeric slots; `9`, `l`, `a`, and `?` are optional; backslash escapes the next code point. Empty masks and trailing escapes are configuration errors.

```tsx
<CgMaskedInput
  name="phone"
  mask="(000) 000-0000"
  showMask="onFocus"
  includeLiterals={false}
  required
  onValueChange={setPhone}
/>
```

Prompt characters are display-only. `showMask` supports `always`, `onFocus`, and `never`; `includeLiterals` chooses raw versus formatted committed values, and `allowIncomplete` controls native/form validity. Typing, replacement, deletion, paste, cut, composition, Unicode code points, and UTF-16 caret positions share one slot model. Invalid external text retains rejected/extra/misplaced character evidence instead of becoming silently valid. The private form proxy submits only the authoritative committed value and supports external forms, reset, required/incomplete/custom validity, disabled exclusion, and invalid-focus transfer. Rich mask details are available from `onValueCommitted`, `onComplete`, `onIncomplete`, `onMaskedFocus`, and `onMaskedBlur` while native callbacks remain intact.

## Numeric editors

`CgNumericEdit` uses a `number | null` committed value. Invalid drafts such as `-` remain visible and internally invalid on blur/Enter without replacing the last committed value; `onInvalidValue` receives the draft. A trailing locale decimal such as `1.` remains visible while focused and commits as `1` on blur/Enter. Parsing strictly recognizes locale digits, separators, signs, and the configured currency/percent literals instead of stripping arbitrary characters. It supports grouping, precision, bounds, prefixes/suffixes, paste, and typed editor commands, and reformats when locale/format options change even when the numeric value is unchanged.

`CgSpinEdit` adds accessible buttons and Arrow/Page stepping and steps from the current parseable draft before falling back to the committed/null-start policy. A null increment starts at `min` when supplied, otherwise 0; a null decrement starts at `max`, otherwise 0. Pointer press-and-hold repeats and accelerates by default; set `repeatOnHold={false}` for single pointer steps. Repeat timing is intentionally private.

JavaScript numbers use IEEE-754 floating-point arithmetic. Do not use these editors as an arbitrary-precision accounting representation; keep minor units or a decimal value in the application when exact base-10 arithmetic is required.

## Async search and loading

`CgSearchBox` owns no data fetching. Its callback receives cancellation and ordering metadata:

```tsx
<CgSearchBox
  query={query}
  onQueryChange={setQuery}
  minimumLength={2}
  minimumLengthMessage={(minimum) => `Enter at least ${minimum} characters`}
  searchOnClear
  onSearch={async (text, { reason, requestId, signal }) => {
    const response = await fetch(`/search?q=${encodeURIComponent(text)}`, { signal });
    // requestId is monotonic; aborted/stale generations are not treated as current.
  }}
/>
```

Eligibility uses the trimmed query length, but `onSearch` receives the original query—including surrounding spaces. `searchOnClear` defaults to `true` and applies equally to the clear button and opt-in Escape clearing. Cancellation, below-minimum input, clear, rejection, and completion all release duplicate-submit bookkeeping while request IDs remain monotonic.

`CgLoadingPanel` supports inline, wrapper overlay, and portal-target modes, delayed display, minimum visible time, inert blocking, shading, dismissal, topmost Escape ordering, and target geometry tracking. Focus containment remains off by default; `trapFocus` enables Tab cycling and focus return for blocking overlay/portal modes only.

## Public API

Components:

- `CgIcon`, `CgButton`, `CgField`
- `CgTextBox`, `CgMemo`, `CgCheckBox`, `CgSwitch`, `CgComboBox`, `CgKeyComboBox`, `CgLookUpGrid`, `CgListBox`, `CgTagBox`, `CgDropDownBox`, `CgDateEdit`
- `CgFlyout`, `CgPopup`, `CgWindow`, `CgMaskedInput`
- `CgMenu`, `CgContextMenu`, `CgDropDownButton`, `CgSplitButton`, `CgToolbar`
- `CgLayoutBreakpoint`, `CgTabs`, `CgStepper`, `CgAccordion`, `CgTreeView`, `CgFilterBuilder`, `CgPager`, `CgGrid`
- `CgFormLayout`, `CgFormLayoutItem`, `CgFormLayoutGroup`, `CgFormLayoutTabs`
- `CgRadio`, `CgRadioGroup`
- `CgNumericEdit`, `CgSpinEdit`, `CgSearchBox`
- `CgLoadingPanel`, `CgProgressBar`

Focused shared types include `CgSizeMode`, `CgDensity`, `CgIntent`, `CgOrientation`, `CgDirection`, `CgValidationState`, `CgIconName`, `CgIconSource`, `CgEditorButtonDescriptor<T>`, the Filter Core AST/registry/persistence contracts, the `CgDateEdit` contracts, the shared overlay contracts, and each descriptor component's props, actions, lifecycle details, and render/state contexts. Private menu, adaptive-layout, and TreeView normalization/check/filter engines are not exported. There is intentionally no universal component-state interface.

The public hooks are `useControllableState`, `useCgId`, and `useCgContextMenuTarget`; `cx` is the public class-name utility. All other primitives and hooks are private implementation details.

## Development

Use Node `^22.22.2 || ^24.15.0 || >=26.0.0`; this matches the locked jsdom requirement. The verified local runtime is Node 24.19.

| Command | Purpose |
| --- | --- |
| `npm run storybook` | Run Storybook on port 6006 with theme, density, direction, and a11y controls |
| `npm run build-storybook` | Create the static Storybook build |
| `npm run test:browser` | Build Storybook and run all Playwright browser projects |
| `npm run test:browser:semantic` | Run semantic and Axe checks in Chromium, Firefox, and WebKit |
| `npm run test:browser:visual` | Compare canonical Chromium screenshots |
| `npm run test:browser:update` | Regenerate Chromium screenshots on the current platform |
| `npm run typecheck` | Strict TypeScript check for source, tests, and Storybook |
| `npm run lint` | Type-aware ESLint and React Hooks rules |
| `npm run test` | Semantic Vitest/Testing Library suite |
| `npm run check:cycles` | Reject relative-import cycles in shipped source |
| `npm run build` | Clean, type-check, and build the ESM library/declarations/styles |
| `npm run verify:package` | Verify exports, declarations/maps, CSS, React externalization, ESM import, and dry-run tarball |
| `npm run verify` | Run all gates, including the static Storybook and package checks |

Install browser binaries once with `npx playwright install chromium firefox webkit`. Storybook's global toolbar switches light/dark, comfortable/compact, and LTR/RTL. Every component has its own story module with applicable controlled/uncontrolled, disabled, read-only, required/invalid, size, long/empty, loading, keyboard, and Arabic RTL scenarios. Each module records its Razor source and known difference. Storybook retains its accessibility panel; Playwright also runs Axe against canonical stories and fails serious or critical findings.

Chromium screenshots in `tests/browser/__snapshots__` are canonical Windows/Node 24.19 baselines. Playwright snapshots are platform-specific; regenerate them on the same operating system used for comparison. Browser tests serve the prebuilt Storybook through a lifecycle-managed Vite preview server. No CI workflow is installed; browser gates run locally through `npm run verify`.

The Phase 10 Node 24.19 verification completed with 205 Vitest tests, 68 semantic/Axe cases per engine, 108 Chromium visual tests comparing 116 Windows snapshots, and package verification of exactly 33 runtime exports across 648 packed files. Firefox's headless software renderer still cannot start on this host; all 68 cases were covered headed, with one legacy TagBox browser-context teardown flake passing immediately in isolation. See the parity ledger for the exact gate breakdown.

Phase 15 verification on 2026-08-27 passed strict typecheck and lint, 36 Vitest files/351 tests, cycle analysis across 209 source modules, the 204-module library build, the 270-module Storybook build, package verification of 141 runtime exports across 988 packed files, all 163 Windows Chromium visual cases, and the final affected 16-case Chromium/WebKit semantic and Axe matrix. The complete 182-case Chromium/WebKit semantic suite also passed during acceptance; see the parity ledger for command-level detail and the Firefox host limitation.

## Packaging

The library is ESM-only. Vite preserves modules for tree-shaking, keeps React external, emits declarations and declaration maps, and produces `dist/cashgear-ui.css`, exported only as `@cashgear/ui/styles.css`. `npm run verify:package` also runs `npm pack --dry-run` so the publish allow-list is checked before release.

See [the parity ledger](docs/cgcomplib-react-parity.md) for the original and current Razor snapshots, source/test/story paths, intentional differences, exact verification results, and deferred advanced components.
