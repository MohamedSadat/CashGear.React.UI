# `@cashgear/ui`

`CgScheduler` adds Day, Work Week, Week, Month, and Timeline scheduling with CRUD, drag/resize, timezone-aware recurrence and occurrence exceptions, resources, reminders, iCalendar, typed actions, and cancellable range loading. See [Scheduler usage and contracts](src/components/Scheduler/README.md).

`CgPdfViewer` adds lazy browser PDF rendering with URL, data, or authorized-provider sources, navigation, search, zoom, rotation, thumbnails, outlines, password handling, and opt-in annotations. See [PDF Viewer usage and security](src/components/PdfViewer/README.md).

CashGear's React 19 component library: accessible, typed, themeable controls for dense business applications. Phases 1–33 cover the foundational controls, object- and scalar-key ComboBox surfaces, ListBox, TagBox, arbitrary-content DropDownBox, DateEdit, TimeEdit, Calendar, DateRangePicker, FileUploader, PDF Viewer, RangeSelector, Chart, Tooltip, StatusBadge, Splitter, Drawer, Toast and Confirmation providers, MessageBox alerts, overlays, MaskedInput, command surfaces, GridLayout, responsive FormLayout, TreeView, TreeList, PivotTable, the focused `CgLookUpGrid`, and the advanced Filter/Grid/Pager surface without Bootstrap or DevExpress.

Calendar supports single, range and multiple dates. The standalone `CgDateRangePresetSelect` shares boundary-safe calculations with DateRangePicker. Grid adds cancellable JSON/UTF-8 streaming exports and XLSX widths; LookUpGrid supports asynchronous selection callbacks. Existing selection, numeric and export defaults remain compatible. See [current parity classification and acceptance](docs/cgcomplib-react-parity.md).

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

Phase 22 adds [`CgPivotTable`](src/components/PivotTable/README.md): exact-decimal summaries and calculated measures, hierarchical analysis, field lists and filters, two-axis virtualization, drill-down, saved layouts, and CSV/XLSX exports. Local data and cancellable host-owned providers share the same typed query contract. Explore `Phase 22/PivotTable` in Storybook.

Phase 23 adds [`CgButtonGroup`](src/components/ButtonGroup/README.md), [`CgMap`](src/components/Map/README.md), and [`CgRichTextEditor`](src/components/RichTextEditor/README.md). Leaflet, Tiptap, and DOMPurify are pinned, checked-in lazy chunks with integrity manifests and notices; the published package still has no production dependencies beyond its React peers. Explore the three `Phase 23` Storybook groups.

Phase 24 adds `CgTimeEdit`, `CgGridLayout`/`CgGridLayoutItem`, `CgWaitIndicator`, and alert-style `CgMessageBox`. Alerts also join the existing confirmation provider through `useCgConfirmation().alert(...)`, preserving the shared FIFO and cancellation lifecycle. Explore the four `Phase 24` Storybook groups.

Phase 24.1 refreshes Grid and lookup reliability against `CashGear.Blazor.UI` commit `c5c03fb9e5bc2f49b7a3af87729cfbb83ab86c1c`: Grid state v11 adds opt-in table appearance, all edit modes share parsing and synchronous validation, pending persistence locks the editor session, and ComboBox/KeyComboBox/LookUpGrid gain query-context/data-version invalidation, diagnostics, resolver refresh, and safer IME/keyboard behavior. Explore `Phase 24.1/Reliability Refresh` in Storybook.

Phase 25 mirrors `CgPdfViewer` from `CashGear.Blazor.UI` commit `32edd96e1220ec5cf1b5ed691795fd95f605c19a`. A typed URL/data/provider source union and generation-scoped `AbortSignal` replace .NET stream callbacks while preserving the complete viewer interaction surface. PDF.js 6.2.108 is pinned as checked-in, integrity-verified, lazily loaded package content; external links and form controls remain opt-in. Explore `Phase 25/PdfViewer` in Storybook.

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

Controls follow the nearest `dir` above them, so setting it once on a container is enough, and a control follows when it changes. To set one control differently, pass `direction="ltr"` or `direction="rtl"`. `CgPivotTable` is the exception: without `direction`, it takes its direction from `locale`.

The stylesheet exposes the source-aligned `--cg-surface`, `--cg-text`, `--cg-accent`, feedback, typography, spacing, editor-height, focus, and overlay tokens. The earlier `--cg-color-*` names remain aliases. Override tokens on a scoped container; no global reset is installed.

## Built-in text

Components with built-in English (a grid's search box and context menu, a popup's close button, a pager, list and editor messages) read it through the optional `CgUiTextProvider`. Without a provider every component keeps its English text. With one, each built-in default goes through `translate` once; text the page passes is used as it is, even when it equals the English default.

```tsx
const arabic: Record<string, string> = { Close: 'إغلاق', 'Sort ascending': 'ترتيب تصاعدي', '{0} records': '{0} سجلات' };

<CgUiTextProvider translate={(english) => arabic[english] ?? english}>
  <App />
</CgUiTextProvider>
```

`translate` receives the English default, which can be a format such as `Page {0} of {1}`; a translation must keep the same placeholders. An empty result falls back to English. `useCgUiText()` returns the nearest translator (identity without a provider) for a host's own components. Components that ship their own Arabic labels for an Arabic `locale` (Calendar, DateEdit, DateRangePicker, TimeEdit, Scheduler, PivotTable) use them unchanged and send only their English set through the provider. The Phase 37 workspace components already take every visible string from required props and do not use the provider. Mirrors Blazor's `ICgUiText`.

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

Editor buttons (`buttons` on TextBox, DateRangePicker and other editors) are `CgEditorButtonDescriptor`s. Besides `onPress`, a descriptor can be a link (`href`, `target`; a disabled link drops its `href` and `target="_blank"` adds `rel="noopener noreferrer"`; unsafe schemes are refused), leave the Tab order (`focusable: false`), submit or reset its form (`type`), and carry its own `className`. `onPress` receives the anchor's click for a link.

`CgRadioGroup` lays out each item with `itemLabelPosition` (`start` or `end`), `itemAlignment` (`start`, `center`, `end`, `stretch`) and `itemLabelWrap={false}` for one-line labels.

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

Remote loading receives a trimmed eligible query, monotonic request ID, opaque `queryContext`, and `AbortSignal`. Debounced work is aborted when superseded, unmounted, or invalidated by a changed context/data version, and stale results cannot replace a newer generation. `onSearchError` receives the raw error for diagnostics while rendered errors remain generic. For local data mutated without changing its array identity, bump `dataVersion` to rebuild the search index.

```tsx
<CgComboBox<Customer>
  loadOptions={(query, { signal }) =>
    fetch(`/customers?q=${encodeURIComponent(query)}`, { signal }).then((response) => response.json())
  }
  minimumSearchLength={2}
  searchDelay={250}
  queryContext={{ branchId }}
  dataVersion={customerRevision}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

The visible input retains focus while the body-portal listbox opens, flips, shifts, and follows nested scrolling or viewport changes. Arabic digits/text and diacritic-insensitive locale matching are supported. Results are marked incomplete when a local match set exceeds `maxVisibleItems` or a remote page reaches that limit; Enter then requires an explicitly highlighted option. IME composition suppresses navigation/commit keys, while clearable editors support Ctrl+Backspace and Ctrl+Delete and expose both shortcuts through ARIA. Duplicate keys, conflicting local/remote sources, negative timing/length values, and invalid result limits throw clear errors.

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

Keys resolve synchronously from `selectedItem` first, then local `options` and the last item selected through the editor. An abortable `itemResolver` can hydrate an off-page key and receives the current `queryContext`. Successful, missing, and failed attempts are cached by key, context, and data version; `actionsRef.current.refreshSelectedItem()` invalidates the current attempt. Resolver key mismatches are failures. Until resolution succeeds, the bound key remains serialized and its safe string form remains visible. `onResolutionError` exposes raw diagnostic details while `resolutionErrorMessage` stays generic. `isValueEqual` customizes key matching; for example, account codes can compare case-insensitively.

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

`CgTagBox<TItem>` binds an object array and renders the selected values as removable tags around an input-focused ARIA combobox. Stable keys reconcile refreshed objects and serialize native form values; selected objects missing from the current option source remain visible. `hideSelectedItems` leaves selected items out of the list, local or loaded.

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

CgTagBox keeps its selected-object contract. CgKeyTagBox supplies scalar-key selection, custom key comparers and abortable resolver hydration when the host stores keys.

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

The shared `CgCalendar` six-week engine includes adjacent-month days plus month and 12-year panels. It uses `Intl` names, locale week starts, integer civil-date arithmetic, physical RTL arrow behavior, and the shared body-portal overlay stack without a focus trap. `minDate`, `maxDate`, and `isDateDisabled` apply equally to typed values, calendar choices, and Today.

`onBeforeValueChange` can synchronously or asynchronously veto a proposal. It receives an `AbortSignal`; a newer attempt or unmount aborts older work, and stale completions cannot commit. A hidden native select submits only the canonical committed value and provides external-form association, reset, required/custom validity, disabled exclusion, and invalid-focus transfer. Invalid external values remain visible verbatim; valid restricted values remain formatted and invalid.

## TimeEdit

`CgTimeEdit` stores only a timezone-free canonical clock string (`HH:mm:ss.SSS`) or `null`; it never creates or exposes a JavaScript `Date`. The normalizer accepts `HH:mm`, optional seconds, and one-to-three fractional digits, then emits fixed-width millisecond precision.

```tsx
<CgTimeEdit
  name="postingTime"
  value={postingTime}
  onValueChange={setPostingTime}
  editFormat="h:mm:ss tt"
  locale="en-US"
  minTime="08:00:00.000"
  maxTime="18:00:00.000"
  minuteStep={15}
  showSeconds
  required
/>
```

Formats use `H`/`HH`, `h`/`hh`, `m`/`mm`, optional `s`/`ss`, and `t`/`tt`; twelve-hour formats require a period token and alphabetic literals must be quoted. `Intl` supplies the default pattern, digits, and day periods. Enter or complete-control blur commits a valid draft, while Escape restores the authoritative value and invalid text remains visible without publishing. Picker minute steps restrict only its choices; typed off-step minutes remain valid, hidden seconds/milliseconds survive minute-only edits, and second edits preserve milliseconds. Bounds, cancellable async proposals, controlled value/popup state, external forms, reset, required validity, custom buttons, localization, RTL, and `actionsRef` follow the DateEdit infrastructure.

## Calendar and DateRangePicker

`CgCalendar` supports controlled or uncontrolled single dates, ranges and readonly multiple-date arrays, one or two month panels, range preview, day templates, deterministic `today`, date restrictions, Today/Clear controls, localized announcements, roving grid focus, day/month/year panels, and complete keyboard navigation. Only a completed second endpoint emits a range, and pointer-selected endpoints are normalized chronologically.

`CgCalendar` also takes Blazor's newer options. `selectionView` (`day`, `month`, `year`) is the starting and finest view and the unit a click selects: `month` selects the first day of a month, `year` selects 1 January, and range lengths count in that unit; Ctrl+ArrowUp and Ctrl+ArrowDown switch views. `showWeekNumbers` adds a week column numbered as .NET's `GetWeekOfYear` does (`weekNumberRule`: `firstDay`, `firstFullWeek` or `firstFourDayWeek`, default from the locale). `loading` (with `renderLoading`) covers the calendar with a polite status. `onVisibleRangeChange` reports the drawn dates, view, month count and a version after every change. `renderHeader`, `renderFooter`, `renderMonth`, `renderYear` and `renderWeekday` customise those parts. `autoCollapseMonths` (default true) shows one month and steps by one below a 48rem viewport. `showOutsideMonthDates`, `allowOutsideMonthSelection` and `fixedSixWeekLayout` (all default true) control the neighbouring months' days and the six-week grid.

`CgDateRangePicker` composes that calendar with the editor and overlay primitives. Its canonical empty value is `null`; partial, all-null-object, reversed, malformed, disabled, and constrained caller values remain observable invalid state.

```tsx
<CgDateRangePicker
  startName="periodStart"
  endName="periodEnd"
  value={period}
  onValueChange={setPeriod}
  editFormat="dd/MM/yyyy"
  displayFormat="d MMM yyyy"
  commitMode="explicit"
  showPresets
  today="2026-08-21"
  minimumRangeDays={2}
  maximumRangeDays={92}
/>
```

Explicit mode snapshots a draft and applies only through Apply; Cancel, Escape, outside/programmatic close, and anchor loss discard it. Immediate mode commits a valid second calendar endpoint or preset. Manual text scans every separator boundary and commits only one exact, unambiguous formatted pair. Two hidden native form proxies submit canonical endpoints and support external forms, reset, required validity, disabled exclusion, custom validity, and invalid-focus transfer.

`allowTextInput={false}` makes the DateRangePicker text read-only, so the range is picked in the calendar (the keyboard still opens it), and `placement` sets where the popup opens (default `bottom-start`).

## Toast and Confirmation providers

Feedback state is provider-local: there are no module singletons. Toasts support six logical positions, visible-item limits with FIFO queues, duplicate suppression, exact remaining-duration pause/resume behavior, stable live regions, and async actions. Use `subscribeToNavigation` to clear a provider from a router callback without importing a router. `regionAriaLabel` names each toast stack (default "Notifications").

```tsx
<CgToastProvider>
  <App />
</CgToastProvider>

const toast = useCgToast();
toast.success('Invoice posted', { title: 'Complete' });
```

`CgConfirmationProvider` resolves FIFO confirmation requests to booleans. Escape, close, and navigation resolve `false`; an `AbortSignal` rejects its queued or active request with `AbortError`, and provider unmount rejects every pending request with a lifecycle error. Confirmations default to a 420px alert dialog focused on Cancel and compose `CgPopup` with `CgButton`.

```tsx
const { confirm } = useCgConfirmation();
const accepted = await confirm({
  title: 'Delete vendor?',
  content: 'This action cannot be undone.',
  confirmLabel: 'Delete',
  confirmIntent: 'danger',
});

const { alert } = useCgConfirmation();
await alert('The import completed successfully.', 'Import complete');
```

Provider alerts return `Promise<void>` and share the same identity-safe FIFO, focus restoration, navigation cleanup, AbortSignal behavior, Strict Mode handling, and unmount rejection. They default to title “Message,” one primary “OK” action focused on open, 420px width, Escape/close-button dismissal, and no outside-click dismissal. Normal dismissal resolves; only explicit abort rejects. `alertDefaults` is independent from confirmation `defaults`.

The standalone controlled/uncontrolled `CgMessageBox` is the declarative alert form. It accepts a message or children, title, action styling, icon rendering, width, dismissal settings, `actionsRef`, and an `onClosed` result that distinguishes accepted OK from dismissal. It intentionally does not add prompts, inputs, arbitrary action sets, or a duplicate confirmation mode.

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

A drop-down button shows a decorative `▾` after its content at the logical end (`dropDownIndicatorVisible`, default true; turn it off when the content already signals a menu, as the toolbar overflow, breadcrumb overflow and pivot field list tools do). `toggleIcon` replaces that glyph, or a split button's toggle chevron, inside an `aria-hidden` wrapper. `menuClassName` goes on the menu surface and every nested level. On the trigger (a split button's toggle), ArrowDown opens on the first item and ArrowUp on the last; inside the menu, Alt+ArrowUp closes every level and returns focus to the trigger. A menu that can no longer be shown (disabled, or every command gone) closes and reports `onOpenChange(false)` once. `CgButton` gains `trailingContent`, drawn after the label and end icon except while busy.

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

## GridLayout

`CgGridLayout` is a validated CSS Grid composition primitive. Immutable row descriptors supply `height` and optional space-separated `areas`; column descriptors supply `width`. Columns default to one `minmax(0, 1fr)` track and are inferred from named areas when omitted. `CgGridLayoutItem` uses either one named `area` or zero-based `row`/`column` with positive spans.

```tsx
<CgGridLayout
  rows={[{ areas: 'header header' }, { areas: 'nav body' }]}
  columns={[{ width: '12rem' }, {}]}
  rowGap="12px"
  columnGap="12px"
>
  <CgGridLayoutItem area="header">Ledger workspace</CgGridLayoutItem>
  <CgGridLayoutItem area="nav">Filters</CgGridLayoutItem>
  <CgGridLayoutItem area="body">Transactions</CgGridLayoutItem>
</CgGridLayout>
```

The layout rejects unsafe track text, inconsistent area widths, column-count disagreement, invalid or disconnected regions, unknown areas, unsafe indexes/spans, and mixed named/indexed placement. Structured templates and placement win over conflicting caller styles. Responsiveness stays caller-owned through descriptor changes, CSS, or `CgLayoutBreakpoint`; no second breakpoint schema is embedded here.

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

`CgFilterBuilder<TItem>` edits that same AST without mutating caller state. Explicit, immediate, and debounced apply modes retain separate draft/applied state; incomplete rows remain visible and block Apply. Stable node IDs support nested/negated groups, collection aggregates, duplicate/remove/reorder/collapse actions, accessible errors and announcements, keyboard reordering, RTL, forced colors, reduced motion, and responsive stacking. Custom field editors and displays take precedence over generated CashGear editors. The row editors' accessible names and placeholder options (`groupLogic`, `allConditions`, `anyCondition`, `aggregate`, `aggregateField`, `selectField`, `selectComparison`, `selectValue`, `selectPeriod`, `selectCollection`, `selectAggregateField`, `yes`, `no`, `cannotApply`) are `labels` entries too.

Persistence and transport use the exact Razor `$type` wire discriminators and pinned numeric ordinals, while React code keeps ergonomic string literals in memory. Legacy `value`/`secondValue` operands and Grid states v1–v9 are accepted only at compatibility boundaries and normalize to the canonical typed AST.

## Pager

`CgPager` owns no data. It exposes zero-based state with one-based display, controlled or uncontrolled page/page-size state, authoritative or derived page counts, overflow-safe arithmetic, numeric/input/status/auto modes, first/previous/next/last controls, page-size selection, first-visible-item preservation, templates, loading/read-only/disabled behavior, Unicode decimal input, roving focus, and chronological keyboard navigation in LTR and RTL. Responsive measurement is SSR-safe and never emits navigation merely because the mode changed.

## Grid

`CgGrid<TItem>` is a descriptor-driven data grid for local arrays or abortable async providers. Columns require stable `fieldId` identities and explicit typed accessors; `keySelector` supplies stable scalar row identity. Version-11 serializable state carries paging, search, sorting, canonical filters and suspension, key selection, focus, column layout, grouping, remote expansion paths, summary identity/visibility, and nullable `tableAppearance`. State migration accepts versions 1–10, assigns `tableAppearance: null` to legacy states, and reconciles renamed fields and changed aggregate keys before a provider request is constructed.

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
  allowTableStyling
/>
```

Table appearance is strictly opt-in. `null` preserves the legacy Grid skin and `stripedRows` behavior byte-for-byte. The internal `CgPopup` gallery offers 18 Blazor-aligned color/intensity presets plus logical banding, borders, 32/40/48px row density, colored headers, first/last data-column emphasis, and total-row emphasis. Decoration excludes selection, command, group, detail, and summary structure, and interaction/editing states take precedence. Appearance changes flow through ordinary controlled state and saved views without changing paging, criteria, columns, selection, focus, edit drafts, or requesting provider data. Use `setTableAppearance()` and `resetTableAppearance()` through `CgGridActions`; the picker itself is not exported.

Local processing is search, validated filter, complete-set summaries, stable sorting, grouping, then paging. Filter-row and builder-owned criteria remain structurally separate; invalid saved criteria retain diagnostics but never execute or reach a provider. The default footer is controlled `CgPager`, while Grid remains the sole paging/data authority. Provider requests use stable field IDs and `rows`, `groupNodes`, and `groupItems` modes with typed group paths, cancellation, sequencing, retained refresh errors, and authoritative summaries. Razor-compatible request helpers encode/decode the wire AST without changing semantic provider callbacks.

`CgGridActions<TItem>` exposes refresh, paging, filter-builder delegation, state, focus, selection, grouping, detail, editing, appearance, layout, and XLSX operations. Popup editing remains the default; inline-row, cell, and atomic batch modes add immutable draft snapshots, active-cell state, dirty navigation policies, validation focus, concurrency metadata, conflict retry/reload, and one complete batch callback. Invalid raw number/date/select drafts remain visible and dirty independently from the last valid model value. Metadata validation and synchronous cross-field `editing.validateEdit` errors merge and survive editor changes. Before a mutation settles, native and custom editor surfaces are disabled/inert, stale callbacks and duplicate commits are ignored, and cancel/reload/navigation/new-edit actions are rejected. Failure or cancellation preserves and unlocks the submitted draft; only the existing generic failure text is rendered. Batch mode validates every non-delete draft before constructing its atomic request. The caller owns persistence and source updates; successful persistence reloads once after its callback completes.

Cell and batch editing use spreadsheet-style type-to-edit by default; set `editing.allowTypeToEdit={false}` to require an explicit edit command. Printable keys replace the selected cell's compatible editor value, while Space remains a selection command and lookup, checkbox, and date-like editors open without an incompatible text seed. Numeric editors select their existing contents when opened explicitly. Set `editing.enterMovesToNextRow` to commit unshifted Enter and focus the same column in the next visible data row. Advancement skips non-data rows, clamps at the final row, and never creates data; validation, conflict, and persistence failures retain the original editor and focus. `Shift+Enter` remains available to multiline editors.

Custom summaries use stable aggregate keys and ordered input field IDs. Built-ins stay synchronous; trusted local custom delegates run through an abortable async path over complete filtered total/group scopes, and remote requests contain only serializable IDs, keys, fields, scope, and query state. Availability, loading, safe error codes, and completeness are explicit.

The React adaptation deliberately does not expose Razor child registration, expressions, SQL/EF/Dapper translation, generic HTTP adapters, server persistence, or Blazor lifecycle concepts. Row/column virtualization and committed export scopes are implemented in Phase 29. Automatic column discovery is intentionally replaced by explicit typed columns.

`rowClassName(item)` adds host classes to data rows (`data-cg-grid-row-custom` marks them). `editing.commitOnFocusOut` commits a Cell or Batch editor when focus leaves its cell, by a click elsewhere or Tab out of the grid; Enter, Tab between editors and Escape keep their own handling. Column moves and resizes are announced in a polite live region (`columnMovedAnnouncement`, `columnResizedAnnouncement`).

Every built-in Grid string is a `labels` entry and goes through `CgUiTextProvider`: the context menu (`sortAscending`, `sortDescending`, `groupByColumn`, `ungroup`, `hideColumn`, `autoFitColumn`, `selectRow`, `deselectRow`, `exportToJson`, `exportToExcel`, `refresh`), the popup titles `createPopupTitle` ("Add row") and `editPopupTitle` ("Edit row"), the column chooser, the group panel's accessible name (`groupPanelAriaLabel`), the filter row and the view manager (`views`, `viewsTitle`, `saveNewView`, `updateView`, `makeDefaultView`, `deleteView`, `resetSystemView`, the scope names and field captions). `editPopupWidth` and `editPopupMaxHeight` size the popup edit form (defaults `min(36rem, 94vw)` and `min(44rem, 92vh)`).

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

Async loaders receive normalized search text, visible searchable field IDs, one sort, immutable column filters, `skip`/`take`, opaque `queryContext`, and an `AbortSignal`. `itemResolver` hydrates an existing key without opening or searching and receives that context. Search and resolution errors have separate safe rendered messages and raw diagnostic callbacks. Successful, missing, and failed resolver attempts are cached by key, context, and data version; mismatched resolver keys fail without replacing the bound key. Fresh callback identities are adopted without resetting state; actual data-version, context, locale/diacritic, comparison, and visible-search-column changes invalidate only the relevant local work.

`null` is the explicit React no-selection value. Blank string keys are also empty for ERP compatibility, while numeric zero remains valid. Strings and numbers serialize to native forms automatically; other named values require `serializeValue`. Object query contexts should be memoized or paired with `isQueryContextEqual`. Context is query input, not an authorization boundary—the server must still enforce tenant, branch, warehouse, and permission scope.

The input retains focus and owns `aria-activedescendant`; paging appends rows, disabled rows stay visible but cannot be selected, IME composition suppresses navigation/commit, and the filter-row Tab path is lookup-specific. Ctrl+Backspace/Delete clear eligible editors. `CgLookUpGridActions` exposes popup, reload, selected-item refresh, paging, sorting, filtering, state inspection, focus, and clear operations. `reload()` invalidates local indexes even while closed and restarts at the first page when open. Multiple selection, grouping, master-detail, column chooser/reordering/resizing/freezing, CRUD, summaries, export, and row virtualization remain intentionally exclusive to `CgGrid`; no ignored or fake virtualization prop is exposed.

Rows are virtualized by default, as in Blazor (`enableVirtualization`, `rowOverscan` 0 to 100, default 5): only the rows near the scroll position render, between spacers, while `aria-rowcount` and `aria-rowindex` keep the full count. `rowHeight` must then be a number or a px, rem or em length (default 2rem). The viewport is measured whenever the flyout opens and while it scrolls, never while it is empty or hidden, keyboard moves scroll an unrendered row into view, and `overflow-anchor: none` keeps recycled rows from jumping the list.

## Splitter

`CgSplitter` renders immutable keyed pane descriptors as flex tracks with adjacent accessible separators. Pane keys are trimmed and unique; numbers become pixels, fixed CSS units remain declarative, and positive `fr` or `*` weights remain flexible until an actual resize commits invariant pixel sizes.

```tsx
import { CgSplitter } from '@cashgear/ui';

<CgSplitter
  aria-label="Accounting workspace"
  panes={[
    {
      key: 'navigation',
      size: '14rem',
      minimumSize: 120,
      collapsible: true,
      renderContent: () => <Navigation />,
      renderCollapsed: () => <span>Navigation</span>,
    },
    { key: 'document', size: '2*', minimumSize: 240, renderContent: () => <InvoiceEditor /> },
    { key: 'summary', size: '18rem', collapsible: true, renderContent: () => <InvoiceSummary /> },
  ]}
  onStateChange={(proposedState) => persistLayout(proposedState)}
/>
```

Pointer capture scopes live or deferred resizing to the owning Splitter. Keyboard separators support arrows, Shift acceleration, Home/End bounds, and Enter collapse; horizontal arrows are physical in RTL. `CgSplitterActions` focuses the group or a pane pair, inspects/resets state, collapses/expands/toggles a pane, and proposes a pane size. Controlled state is authoritative: callbacks receive the frozen proposal, while a rejected proposal is immediately reconciled to the controlled prop.

Persisted Splitter state is untrusted application data. Validate authorization and workspace ownership before loading or saving it; the component validates version, keys, and lengths, ignores unknown panes, and applies descriptor fallbacks, but it is not an access-control boundary. Likewise, `visible`, `disabled`, `readOnly`, and collapsed panes affect presentation and interaction only—never authorization.

## Drawer

`CgDrawer` keeps backdrop, full Drawer, retained mini Drawer, and application content mounted in one inline subtree. Shrink and overlay modes, logical start/end positioning, mini mode, and responsive overlay presentation change accessibility and layout state without remounting form, scroll, or focus nodes.

```tsx
import { CgDrawer } from '@cashgear/ui';

<CgDrawer
  open={navigationOpen}
  onOpenChange={setNavigationOpen}
  mode="shrink"
  position="start"
  miniModeEnabled
  responsiveOverlay
  responsiveBreakpoint={768}
  renderDrawer={({ actions }) => <Navigation onClose={() => void actions.close()} />}
  renderMiniDrawer={({ actions }) => <button onClick={() => void actions.open()}>Menu</button>}
  renderApplicationContent={() => <Routes />}
/>
```

Visible effective-overlay Drawers participate in the same owned-overlay stack as Flyout, ContextMenu, Popup, and Window. The stack arbitrates matched outside pointer pairs and Escape, raises interacted panels, traps focus through owned portal boundaries, reference-counts optional body scroll locking, isolates modal siblings, and restores a connected opener. Responsive `matchMedia` changes only the effective presentation; it does not change the authoritative open intent or emit lifecycle callbacks.

`open`, `close`, and `toggle` actions are asynchronous. Before hooks receive frozen details plus an `AbortSignal`; actions resolve `false` when blocked, cancelled, stale, or rejected. Controlled direct changes bypass before/open-change hooks, still apply while disabled, and receive one terminal callback after the rendered transition. `visible` and `disabled` are UI controls only. Do not render secrets or privileged operations merely because a Drawer is invisible, inert, disabled, or closed; enforce authorization in application and server code.

## FileUploader

`CgFileUploader` owns the browser `File` queue and exposes frozen item snapshots. Exactly one transport is required. Handler mode keeps storage application-owned and does not copy file contents unless `bufferToMemory` is explicitly enabled:

```tsx
<CgFileUploader
  name="attachmentId"
  allowedExtensions={['pdf', 'png']}
  upload={async ({ file, signal, reportProgress, metadata }) => {
    const storedFile = await attachmentStore.put(file, { signal, metadata, reportProgress });
    return { succeeded: true, storedFile };
  }}
  getUploadMetadata={() => ({ module: 'payables' })}
/>
```

Endpoint mode implements the CashGear v2 initiate/status/chunk/complete/delete protocol. JSON/status calls use `fetch`; chunk uploads use XHR for byte progress; SHA-256 chunk hashes and a bounded first/last 64 KiB file fingerprint use Web Crypto. A stable `persistenceKey` enables session-storage recovery after hydration, but the exact browser file must be reselected before upload can resume.

```tsx
<CgFileUploader
  name="attachmentId"
  uploadEndpoint="/api/uploads/v2"
  persistenceKey="vendor-invoice-attachments"
  maxConcurrentUploads={2}
  maxChunkRetries={3}
  deleteRemoteOnRemove
/>
```

The native file input is deliberately unnamed. Only successful durable `storedFile` values produce repeated hidden inputs under `name`; the default serializer submits `storedFile.id`. `required` plus `validationMode="require-all-succeeded"` blocks submission while an accepted file remains incomplete. Form reset aborts transient work, clears resumable state, and restores `defaultStoredFiles`; disabled uploaders submit nothing, while read-only uploaders retain their durable values.

Client extensions, sizes, MIME types, names, hashes, metadata, stored IDs, and resumable tokens are untrusted. The server must independently authorize the caller and upload session, enforce count/size/type/content rules, sanitize names, validate every chunk and final object, constrain metadata, scan content as appropriate, and prevent cross-tenant read/delete access. Session and antiforgery tokens are transport-only and are never exposed in public item snapshots or rendered output.

## Chart

`CgChart<TItem>` renders bar, line, area, scatter, pie, and donut series as dependency-free SVG from immutable descriptors. Accessors retain the original item, argument, and value for callbacks and formatting. Source construction is separate from visibility projection and pixel layout, so ResizeObserver bucket changes do not rerun accessors or `customizePoint`; hiding a series deliberately recalculates stacks, domains, and geometry.

```tsx
import { CgChart } from '@cashgear/ui';

<CgChart
  data={monthlyResults}
  series={[
    {
      type: 'bar',
      name: 'Revenue',
      argument: (item) => item.month,
      value: (item) => item.revenue,
      cornerRadius: 4,
    },
    {
      type: 'line',
      name: 'Margin',
      argument: (item) => item.month,
      value: (item) => item.margin,
      lineStyle: 'monotone',
    },
  ]}
  title="Monthly performance"
  description="Revenue and margin by month"
  selectionMode="multiple"
  legend={{ position: 'top', mode: 'toggle' }}
  dataTableMode="collapsed"
/>
```

Numeric public values are finite `number`, native `bigint`, or normalized `CgDecimalValue`; temporal arguments reuse canonical `CgDateValue`, `CgLocalDateTimeValue`, and `CgInstantValue`. Public values never expose JavaScript `Date`. Set `argumentAxis.valueType` to `numeric` or `date` for branded strings, because automatic inference treats runtime strings as categories. A date axis rejects mixed civil-date, local-date-time, and instant representations. Exact comparison, stacking, domains, and relative distances use BigInt-backed decimal arithmetic; conversion to `number` is limited to bounded pixel ratios.

Selection and series visibility support controlled and uncontrolled state. Controlled props stay authoritative after rejected proposals. `CgChartActions` synchronously focuses, refreshes, serializes or downloads standalone SVG, changes visibility, changes selection, and reports the active point; DOM-unavailable operations return `false` or `null`. Keyboard navigation uses one roving chart-point tab stop, physical RTL arrows, cross-series movement, Enter/Space activation, and Escape dismissal. Disabling keyboard navigation changes the SVG to accessible image semantics. The accessible data table can be hidden, visually hidden, collapsed, or visible and remains available during loading and too-small states.

Label layout follows Blazor's newer engine. A horizontal bar chart plans its category labels by line height, thinning them while keeping the first and last, and shortens names wider than 40% of the chart with an ellipsis (the full text stays in tooltips and the data table). A horizontal value axis starts from one tick per 72px and steps the count down until its labels clear each other; labels an explicit interval still crowds are thinned, keeping the first and last. Columns and bars with outside point labels keep up to 40% of the value axis clear at its end so the labels stay on the plot. A document pie with outside or best-fit labels shrinks until every outside label stays inside the plot, down to a fifth of its size; best-fit labels that fit their slice no longer reserve a ring.

### Document charts

`appearance` draws a chart as a document object, for example a spreadsheet chart, instead of a dashboard card. The host works out every scale, colour and font; the chart draws exactly what it is given. With `appearance` set, the title, legend and axis titles are drawn inside the SVG, the card border, radius and background are dropped, the chart is drawn at the exact pixel size, and the data table defaults to `visuallyHidden`. Unset colours come from the theme tokens, so they follow `data-cg-theme`.

```tsx
<CgChart
  data={rows}
  width={480}
  height={288}
  interactive={false}
  palette={['#4472C4', '#ED7D31', '#A5A5A5']}
  title="Chart Title"
  appearance={{
    fontFamily: 'Calibri, sans-serif',
    chartArea: { fill: '#FFFFFF', border: { color: '#D9D9D9', width: 1 } },
    title: { fontSize: 18.67, color: '#595959' },
    axisLabels: { fontSize: 12, color: '#595959' },
    legend: { fontSize: 12, color: '#595959' },
  }}
  argumentAxis={{ categoryPlacement: 'betweenTicks', axisLineStyle: { color: '#D9D9D9' }, majorTickMarks: 'none' }}
  valueAxes={[{ minimum: 0, maximum: 6, tickInterval: 1, barGapWidth: 219, barOverlap: -27, majorGridLineStyle: { color: '#D9D9D9' } }]}
  series={[{ type: 'bar', name: 'Series 1', argument: (row) => row.category, value: (row) => row.value }]}
/>
```

- `scatter` series take a numeric x per point, keep their own points in data order, and share a chart only with other scatter series. `lineStyle: 'smooth'` draws a Catmull-Rom spline for line, area and scatter series.
- Value axes take `barGapWidth` and `barOverlap` with spreadsheet meaning, explicit `ticks` (`{ value, text }`), `reversed`, `minorTickInterval` and `argumentAxisCrossesAt`. The argument axis takes `reversed`, `labelInterval`, `tickMarkInterval`, `categoryPlacement` and `valueAxisCrossesAt`.
- Bars, areas and slices take separate fill and outline colours; markers take fill and outline colours; `customizePoint` can set `color`, `outlineColor`, `outlineWidth` and `explosion` per point. Point labels take spreadsheet positions and a `pointLabelContent` list.
- `onElementPointerDown` reports the element under the pointer (chart area, plot area, title, legend or entry, axis, axis title, gridlines, series, point or point labels), and `highlightedElement` outlines one with corner handles.

`getSvg` and `exportSvg` clone only the chart SVG, inline computed paint/font properties, and remove hit targets, focus state, and interactive metadata. They do not include surrounding application markup or fetch remote assets. Descriptor callbacks, CSS classes/colors, formatter output, titles, annotations, and data are trusted application inputs: React escapes rendered text, but hosts must not treat charts, hidden series, disabled legends, exported files, or shortened labels as authorization or confidentiality boundaries. Enforce access and tenant isolation before supplying data. Large sources are intentionally bounded by `maxPointsPerSeries` (5,000 by default); pre-aggregate application data when thousands of individually navigable points are not useful.

## TreeList

`indentSize` sets the indentation per level (any CSS length, default `1.1rem`) and `toolbar` renders host content above the tree.

`showColumnManager` adds a Columns disclosure listing every column with a visibility checkbox (the hierarchy column stays visible), move-before and move-after buttons, a width box and a fixed region (`none`, `start`, `end`), plus Reset. `namedViewStore` with `namedViewKey` adds Grid's view manager: named views with personal, role and company scopes (`allowSharedViews`), a default view applied on load, update, delete and back to the system default, which resets the layout. A view keeps the column layout, sorts and filter. `CgTreeListBrowserViewStore` keeps personal views in `localStorage` and writes the state's sets and maps as arrays; `CgTreeListNamedViewStore<TKey>` is the store contract for a server store. `CgGridViewStore`, `CgGridStoredView` and `CgGridViewSaveRequest` take the state type as an optional parameter (Grid's by default).

`CgTreeList<TItem, TKey>` renders hierarchical business records as a true ARIA treegrid. It has three mutually exclusive source modes: flat local parent keys, nested local children, and an abortable bounded provider. Parent absence is explicit, so `0` is a valid key and never an implicit root marker.

```tsx
import { CgTreeList } from '@cashgear/ui';
import type { CgTreeListColumn } from '@cashgear/ui';

const columns: ReadonlyArray<CgTreeListColumn<Account, number>> = [
  {
    type: 'text', fieldId: 'code', title: 'Account', hierarchy: true,
    getValue: (account) => account.code,
  },
  { type: 'text', fieldId: 'name', title: 'Name', getValue: (account) => account.name },
  { type: 'number', fieldId: 'balance', title: 'Balance', getValue: (account) => account.balance },
];

<CgTreeList
  data={accounts}
  columns={columns}
  getKey={(account) => account.id}
  getParentKey={(account) => account.parentId == null
    ? { kind: 'none' }
    : { kind: 'key', key: account.parentId }}
  defaultExpandedKeys={new Set([1000])}
  selectionMode="multiple"
  checkMode="recursive"
/>
```

All hierarchy construction and traversal is iterative. Flat duplicates throw; nested repeats are first-parent-wins; self parents, missing parents, cycles, and depth overflow fail or recover according to explicit rules without recursion. Sorting is sibling-only. Search and the shared Filter AST support match-only, ancestor context, and ancestor/descendant modes without modifying host expansion state. Selection, cell focus, recursive checks, detail expansion, and sibling groups remain independent.

Lazy and provider work uses per-operation abort controllers plus generations, so collapse, reload, removal, replacement, and unmount cannot attach stale results. Editing and add/delete/move handlers receive immutable contexts and remain host-owned; client permissions are presentation only. Providers must enforce tenant/company/user authorization, whitelisted fields and queries, count protection, membership, cycles, and versions.

Root `CgPager`, per-parent loading, fixed-height row and fixed-edge column virtualization, versioned view state, `CgContextMenu`, `CgPopup`, local/authorized summaries, XLSX outlines, hierarchy print layout, and an optional host PDF adapter are integrated. Complete-tree output requires an authorized snapshot provider when loaded data is incomplete. QuestPDF is deliberately not a browser dependency, pointer drag-and-drop and variable-height virtualization remain deferred in both libraries. See [`src/components/TreeList/README.md`](src/components/TreeList/README.md) for the full contract and trust boundary.

## RangeSelector

`CgRangeSelector` uses one immutable `{ start, end }` value and a required `valueKind`. A `null` start resolves to `minimum`; a `null` end resolves to `maximum`. Interaction output canonicalizes those two domain boundaries back to `null`, while explicit external endpoints remain valid and authoritative.

```tsx
import { CgRangeSelector, normalizeCgDecimalValue } from '@cashgear/ui';

<CgRangeSelector
  valueKind="decimal"
  minimum={normalizeCgDecimalValue('0')}
  maximum={normalizeCgDecimalValue('100000000000000000000.01')}
  step={normalizeCgDecimalValue('0.01')}
  value={amountRange}
  onValueChange={setAmountRange}
/>
```

The built-in kinds are finite `number`, native `bigint`, normalized exact `decimal`, canonical civil `date`, normalized `datetime-local`, and normalized offset-bearing `instant`. Decimal strings are exact values, not localized or display-formatted numbers; use `formatValue` only for presentation. `normalizeCgDecimalValue`, `normalizeCgLocalDateTimeValue`, and `normalizeCgInstantValue` construct branded canonical values. Exact kinds use BigInt-backed internal wires, whole-day date intervals, and integer-millisecond date-time/instant intervals without JavaScript `Date`. Instant comparison is UTC-based, and generated values retain the minimum instant's `Z` or explicit offset token.

Both handles are accessible horizontal sliders. Pointer capture supports handle swap, selected-range drag, and track centering; keyboard arrows honor physical RTL, Up/Down stay numeric, Page keys use ten steps, and Home/End respect span bounds. Controlled values are authoritative and are never silently snapped. `CgRangeSelectorActions` focuses a handle, returns the frozen current value, cancels an active preview, and recalculates geometry.

## Tooltip and StatusBadge

`CgTooltip` keeps a stable target wrapper and lazily mounts only its `role="tooltip"` surface through the shared body portal and positioned-overlay engine. Hover/focus, click, and manual triggers support cancellable delays, controlled state, logical placement, viewport flip/shift, optional interactive content, exact `aria-describedby` token ownership, and generation-safe `onShown`/`onHidden` callbacks. Click tooltips share topmost Escape and matched outside-interaction arbitration with other overlays.

Use Tooltip for short contextual descriptions that do not move focus. Use `CgFlyout` when content needs disclosure semantics, richer application structure, focus actions, headers/footers, resizing, or explicit popover lifecycle. Neither component accepts HTML strings or loads data automatically.

```tsx
<CgTooltip text="Uses the posting date from the source document.">
  <button type="button">Posting date help</button>
</CgTooltip>

<CgStatusBadge type="success" appearance="soft" indicator>Posted</CgStatusBadge>
```

`CgStatusBadge` is compact presentation, not authorization, permission, or workflow truth. It has no role by default; opt into `status` or `alert` only for a real live-region update. Icons and indicators are decorative. Dismissal hides immediately, invokes `onDismiss` at most once, observes async rejection, and re-arms only after `visible` changes from false to true. It is not a toast and allocates no listener, observer, portal, or timer.

Consumer formatters, render functions, class names, styles, and safe attributes are trusted developer inputs. Do not pass untrusted user HTML, CSS, or executable values through them; these APIs deliberately do not sanitize application code.

## StatusBar and Slider

`CgStatusBar` is a thin bar for the bottom of an application window, 24 px tall at the default size. It is a polite `role="status"` live region with `aria-atomic="false"`, so a screen reader reads only the item that changed. Pass `aria-live="off"` if updates come too often to announce.

```tsx
<CgStatusBar
  ariaLabel="Workbook status"
  items={[
    { key: 'ready', content: 'Ready', priority: 10 },
    { key: 'caps', content: 'Caps Lock', separator: true, tooltip: 'Toggle Caps Lock', onClick: toggleCaps },
    { key: 'sum', content: `Sum: ${sum}`, align: 'end', 'data-testid': 'status-sum' },
    { key: 'zoom', content: <ZoomSlider />, align: 'end', separator: true, priority: 5 },
  ]}
/>
```

Items never wrap or grow the bar. When space runs out, long text truncates with an ellipsis down to 96 px, then items hide from the lowest `priority` up, the later of two equals first. A lower priority never shows while a higher one is hidden. Content holding a control keeps its whole width until it hides. An item's `data-*` attributes reach its element, which is a button when `onClick` is set.

`CgSlider` is a single-thumb horizontal slider. It is 10rem wide unless `style` or `className` says otherwise.

```tsx
<CgSlider
  ariaLabel="Zoom"
  min={10}
  max={400}
  value={zoom}
  onValueChange={setZoom}
  onValueCommit={saveZoom}
  formatValue={(value) => `${value}%`}
  marks={[100]}
  showSteppers
  stepperStep={10}
  decreaseLabel="Zoom out"
  increaseLabel="Zoom in"
/>
```

`onValueChange` runs on every change. `onValueCommit` runs when a change is finished: on pointer release, on each handled key press, and on a stepper click. A cancelled pointer restores the starting value without a commit. Pressing the thumb never moves it; clicking the track jumps there and can continue as a drag. Arrow keys step, with the horizontal ones mirrored in RTL, PageUp and PageDown move ten steps, and Home and End go to the limits. Values stay authoritative when controlled, and are not snapped to the step until the user moves them. The root takes native attributes such as `data-testid`, the `role="slider"` thumb takes the name and value, and tests can find the parts through `data-cg-slider-thumb`, `data-cg-slider-track`, `data-cg-slider-stepper="decrease"` or `"increase"`, and `data-cg-slider-mark`.

## Ribbon, ColorPicker, Gallery, BorderPicker and spreadsheet icons

These are generic controlled components for an Excel-like command surface. They hold no spreadsheet logic: the host owns the commands, the selection and what each choice does.

`CgRibbon` is tabs and named groups, composed from `CgTabs` and one `CgToolbar` per group. Tab moves between groups and arrow keys move within one, mirrored in RTL.

```tsx
<CgRibbon
  tabs={[{
    key: 'home',
    text: 'Home',
    groups: [
      {
        key: 'clipboard',
        text: 'Clipboard',
        priority: 5,
        onLauncherClick: openPasteDialog,
        items: [
          { name: 'paste', text: 'Paste', icon: 'paste', size: 'large', onClick: paste, children: [{ name: 'values', text: 'Paste values', onClick: pasteValues }] },
          { name: 'cut', text: 'Cut', icon: 'cut', onClick: cut },
          { name: 'copy', text: 'Copy', icon: 'copy', onClick: copy },
        ],
      },
      {
        key: 'font',
        text: 'Font',
        layout: 'rows',
        items: [
          { name: 'font-name', render: () => <FontBox /> },
          { name: 'bold', text: 'Bold', icon: 'text-bold', hideText: true, beginRow: true, checked: bold, onCheckedChange: setBold },
          { name: 'fill', text: 'Fill color', hideText: true, icon: <CgIcon name="fill-color" accentColor={fill.color} />, onClick: applyFill, renderFlyout: ({ close }) => <CgColorPicker value={fill} onValueChange={(next) => { setFill(next); close(); }} /> },
        ],
      },
    ],
  }]}
  collapsed={collapsed}
  onCollapsedChange={setCollapsed}
/>
```

Items take the same options as toolbar items. `layout: 'columns'`, the default, fills columns of three small items beside any `size: 'large'` ones, and `layout: 'rows'` starts a row at each `beginRow`. A `render` item keeps its own tab stop and keyboard, so a font box still takes spaces and caret arrows. It follows the ribbon's direction unless you pass `direction` to the control you render.

As width runs out, every group gives up large buttons, then every group gives up text, and only then do groups collapse one at a time into a single button whose flyout holds the group as declared. Within each round lower `priority` goes first, and among equals the later group does. Measuring ignores a re-render that only changes state, such as a toggled button. If even collapsed groups don't fit, the groups scroll. Call `actionsRef.current.recalculateLayout()` after a change the ribbon can't see, such as a font loading.

With `keyTips`, the ribbon shows Office's key tips. Tapping Alt puts a badge on each tab, and on anything in `startContent` or `endContent` that has a `data-cg-keytip` attribute, such as a File button. Typing a tab's letters opens it and puts badges on its commands, its launchers and any group that has collapsed. Typing a command's letters runs it: a button is clicked and an input takes focus. A tip of two letters waits for the second, Esc goes back a level, and a click or any other key ends them. Holding Alt and typing a tab's letter goes straight to that tab, except for the letters in `reservedAltKeys`, which a browser may keep for its own menus. Give tips with `keyTip` on tabs and items, `keyTip` on a group for its collapsed button and `launcherKeyTip` for its launcher. Anything without one gets one made from its text that neither equals nor starts another, with Z before a group's and F before a launcher's, as in Office. `onKeyTipsChange` reports when they show or go, and `actionsRef` has `showKeyTips()` and `hideKeyTips()`.

The collapse button, Ctrl+F1 while focus is in the ribbon, and double-clicking a tab all collapse it to its tabs. A tab then opens its commands over the content below, closing on that tab, an outside click, Escape or a command. To make the shortcut work everywhere, bind it in the host and call `actionsRef.current.toggleCollapsed()`. Key tips are not built yet. Group and item labels come from the host, and `labels` covers the rest for Arabic.

`CgColorPicker` is a theme palette with shades, standard and recent colors, and optional Automatic, no-color and browser color dialog options. A theme color stays a reference, so the value keeps `key` and `tint` alongside the `color` to display. A tint such as `0.79998` from a file selects the same swatch as `0.8`. Recent colors are newest first without repeats. A picker in a flyout unmounts when it closes, so keep them in the host there.

```tsx
const [last, setLast] = useState<CgColorPickerValue>({ kind: 'rgb', color: '#ffff00' });

<CgSplitButton
  icon={<CgIcon name="fill-color" accentColor={'color' in last ? last.color : 'transparent'} />}
  toggleAriaLabel="Choose fill color"
  menuMaxHeight="none"
  menuMaxWidth="none"
  onClick={() => applyFill(last)}
  renderFlyout={({ close }) => (
    <CgColorPicker
      value={last}
      onValueChange={(next) => { setLast(next); applyFill(next); close(); }}
      themeColors={workbookTheme}
      recentColors={recent}
      onRecentColorsChange={setRecent}
      allowNone
      labels={{ none: 'No fill' }}
    />
  )}
>Fill color</CgSplitButton>
```

The host keeps the last color: the main part reapplies it, the arrow opens the picker and the bar under the icon shows it. `accentColor` works on `text-color`, `fill-color` and `line-color`, the icons with a bar to fill.

`CgGallery` is a dropdown grid of swatches the host draws, through `item.preview` or `renderItem`. Items can sit under named `groups`, and `footer` adds commands below them. Use `display="inline"` to host only the grid in another surface, such as a ribbon item's `renderFlyout`.

```tsx
<CgGallery
  triggerText="Format as table"
  triggerIcon="table-style"
  ariaLabel="Table styles"
  items={styles.map((style) => ({ key: style.id, text: style.name, group: style.weight, preview: <TableSwatch style={style} /> }))}
  groups={[{ key: 'light', text: 'Light' }, { key: 'medium', text: 'Medium' }, { key: 'dark', text: 'Dark' }]}
  value={tableStyle}
  onValueChange={setTableStyle}
/>
```

`CgBorderPicker` offers edge presets, line styles and a line color in a nested `CgColorPicker`. Choosing a preset is a command, so it changes no state and reports what to draw. `edges` holds each edge with its line style, using the chosen style unless the preset fixes one, as `outside-thick` does. `clear` is `true` for the `none` preset. Edges are physical and don't swap in RTL, because they describe the target.

```tsx
<CgBorderPicker
  colorPicker={{ themeColors: workbookTheme }}
  activePreset={lastPreset}
  onApply={({ preset, edges, clear, color }) => {
    setLastPreset(preset);
    applyBorders(clear ? null : edges, color);
  }}
/>
```

`CgIcon` adds 114 spreadsheet and formatting icons by name, for font, alignment, cells, rows and columns, freeze panes, borders, number formats, sort, filter, charts, tables and commands. See `Phase 1–2/Icon` in Storybook for all of them. They work anywhere an `icon` name does, and alignment and border icons stay physical in RTL. They are Fluent System Icons from a pinned `@fluentui/svg-icons`, checked in under `src/vendor/fluent-icons` with their MIT licence, and `vendor-src/fluent-icons` regenerates them. Names can't be tree-shaken, so they add 13 KB gzip to any app that renders an icon by name.

`CgToolbar` gains what the ribbon needs, all opt-in: `layout` and `columnRows`, and items with `stacked`, `iconOnly`, `beginRow`, `renderFlyout`, `menuAriaLabel`, `toggleAriaLabel` and `ownsKeyboard`. `CgTabs` gains `startContent` and `endContent` in its header.

## PivotFieldList

`CgPivotFieldList` is the spreadsheet "PivotTable Fields" pane: a searchable checklist of source fields and the Filters, Columns, Rows and Σ Values areas. It is controlled and holds no pivot logic. The host passes `layout`, and the pane proposes the next one through `onLayoutChange(next, change)`, where `change` is an `add`, `move` or `remove`, or a `batch` of them.

```tsx
<CgPivotFieldList
  fields={[{ key: 'region', caption: 'Region' }, { key: 'sales', caption: 'Sales', defaultArea: 'values' }]}
  layout={layout}
  onLayoutChange={(next) => setLayout(next)}
  getValueCaption={(field) => `Sum of ${field.caption}`}
  onValueFieldSettings={openValueFieldSettings}
/>
```

Fields and items can be dragged with the pointer, with an insertion marker, and every drag has a keyboard path through the field and item menus. The pane enforces the spreadsheet rules: a field sits in one of Filters, Columns and Rows, Values can repeat a field, and the Σ Values item (`fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY`) stays in Columns or Rows. `canDrop` lets the host veto more. `onFieldToggle` hands field checking to the host. Defer Layout Update holds edits until Update, `readOnly` shows without changing, and `labels` covers Arabic. See [its README](src/components/PivotFieldList/README.md) for the rules, generated ids and keyboard. `CgPivotTable` keeps its own popup field list.

## Document workspace components

Phase 37 adds the generic pieces a document workspace (CashGear Workspace) draws with. None of them builds in a visible or accessible English string: every name is a prop. Their stories are under `Phase 37` in Storybook, in Arabic and right to left.

### LiveAnnouncer

`CgLiveAnnouncer` is a visually hidden live region spoken through its ref, never through React state, so a drag or typing announces without drawing. `announce(text)` empties the region and writes the text a frame later, so the same message twice is read twice; `clear()` empties it. `politeness` is `polite` (a `status`) or `assertive` (an `alert`); `clearAfter` empties it after that many milliseconds.

```tsx
const live = useRef<CgLiveAnnouncerHandle>(null);
<CgLiveAnnouncer ref={live} />;
live.current?.announce('نُقلت البطاقة إلى «قيد التنفيذ»');
```

### Avatar and AvatarStack

`CgAvatar` draws a person's initials (one letter for a name in Arabic script, else the first letters of the first and last words) or `src` picture on the `color` the caller gives, with `name` as its accessible name and tooltip. Sizes are `tiny` (16 px), `small`, `medium` and `large` (40 px); `decorative` hides it when the name is written beside it. `CgAvatarStack` overlaps up to `max` avatars along the line and counts the rest in one "+N", named by `overflowLabel(hidden)`. As a `group` (default) each avatar is named; as an `image` the stack is one image named by `label`.

### Document block icons

`CgIcon` adds names for document blocks, views and people: `text`, `paragraph`, `heading-1` to `heading-3`, `list-bullet`, `list-number`, `list-todo`, `todo`, `toggle`, `quote`, `callout`, `code`, `divider`, `file`, `page`, `page-add`, `page-link`, `database`, `toc`, `embed`, `chart`, `board`, `bookmark`, `linked-view`, `sync`, `calendar-month`, `view-list`, `gallery`, `timeline`, `drag-handle`, `emoji`, `emoji-add`, `mention`, `person`, `people`, `tag`, `rename`, `color`, `highlight`, `folder` and `upload` (`image`, `table` and `workbook` were there). The three lists use Fluent's right-to-left drawings inside a right-to-left container, so bullets and numbers stay at the line start; `toggle` and `toc` mirror like the logical chevrons.

### FilePicker

`CgFilePicker` is a button that opens the browser's file dialog and gives the files chosen through `onPick(files, { source })`, and nothing else: it reads, uploads and keeps nothing (`CgFileUploader` uploads). `accept` takes extensions, types and families and is checked for dropped files too, with the rest given to `onReject`. Without `multiple` only the first file is given. `dropZone` makes the button and its `hint` a drop target; the ref's `open()` opens the dialog from elsewhere, and `onCancel` reports a dialog closed without a choice.

### Breadcrumb

`CgBreadcrumb` is a named navigation list from the root to the current page, which is last and marked `aria-current="page"`. A crumb with `href` is a link, one without is text (a section name), and each `text` keeps its own direction. With `maxItems`, a longer trail keeps `itemsBeforeCollapse` and `itemsAfterCollapse` crumbs and puts the rest in a "…" menu named by `overflowLabel`. `onNavigate({ item, source, event })` reports a chosen crumb from the trail or the menu; call `event.preventDefault()` to route in the app.

### InlineTextEditor and InlineNumberEditor

`CgInlineTextEditor` and `CgInlineNumberEditor` keep no React draft: the field is uncontrolled, typing draws nothing, and the text is read once when the edit ends. Enter, Tab, Shift+Tab and leaving the field commit through `onCommit(value, { end, text, changed })`; Escape puts the starting text back and commits nothing; `onDone({ end, committed })` follows every edit, which is where a cell editor unmounts. They focus and select their text on mount (`initialSelection="end"` after a typed first key), keep keys and presses from a grid around them (`isolateEvents`), and an editor that stays mounted starts a new edit at the next key or focus. `multiline` is a text area where Shift+Enter is a new line. The number editor reads the locale's digits and separators, Arabic-Indic ones included, commits `null` for empty text, and marks other text `aria-invalid` with `invalidMessage` on Enter or Tab, staying open; `parse` and `format` replace its reading.

### CommandMenu

`CgCommandMenu` is a filtered, grouped list of commands. In place, with `searchable`, it is a palette whose search box owns the active option. With `anchor` (a point or rectangle in viewport pixels, such as a caret's) it floats there while focus stays in the host: the host forwards keys to the ref's `handleKeyDown(event)` and sets its `aria-activedescendant` from `onActiveDescendantChange`. Items have `label`, `group`, `icon` (a `CgIcon` name, an element or an emoji), `detail`, `shortcut`, `keywords` and `disabled`. The default filter matches word starts in the label and keywords, ignoring case and Arabic marks; `filter={false}` shows the items as given. Arrows, Home, End, PageUp and PageDown move, Enter (and Tab with `selectOnTab`) chooses, Escape calls `onDismiss`. With `loading`, an Enter pressed early acts when the results arrive.

### SelectionToolbar

`CgSelectionToolbar` is a `CgToolbar` in a `CgFlyout` that follows a selection: give it the selection's `rect` (null hides it); it sits above and flips below when there is no room. Presses in it keep focus where it was, so an editor keeps its selection, except in a text field of its `panel` (a row under the toolbar for a link field or colours). `onEscape` returns focus to the editor. `mode="docked"` puts it at the bottom of the visible viewport, above an on-screen keyboard.

### MenuPanel

`CgMenuPanel` is a menu surface that also holds `fields` (such as a name input), switches and nested panels, for a property or view menu inside a `CgFlyout`. Its parts are `CgMenuPanelItem` (`icon`, `hint`, `danger`, `checked` as a radio or check item, `opensPanel`), `CgMenuPanelSwitch`, `CgMenuPanelGroup`, `CgMenuPanelSeparator` and `CgMenuPanelHeader` (a title with a back button). Arrows, Home and End move focus among the items, ArrowDown from a field enters the menu and ArrowUp on the first item returns to it, Escape calls `onEscape`.

### SortableList

`CgSortableList` reorders a short list by a handle on each row: dragged with the pointer, with a drop line, or moved with ArrowUp, ArrowDown, Home and End on the focused handle, which keeps focus. `onMove(key, toIndex)` is called once per move. `isItemFixed` leaves rows without a handle, `canMove` vetoes a move, and `moveAnnouncement` is spoken after each one.

### OptionPicker and ItemPicker

`CgOptionPicker` chooses options of a select or status field and manages them in place: with `canManage` it creates an option from the text typed and opens each option's editor (rename, recolour, regroup, delete); a handle or Alt+arrows reorders. `onOptionsChange(options, change)` reports each change. Options can be grouped (`groups`, as a status's To do, In progress, Done), coloured from the caller's `colours`, single or `multiple`. `manage` only manages. `CgItemPicker` draws chips the caller describes over results the caller finds for the text typed, as for people or related rows. In both, the arrows walk the list, Enter chooses and Backspace in an empty search removes the last chip; every string comes from `labels` or a prop.

### MentionArea

`CgMentionArea` is an editable area that writes text, line breaks and mentions. A trigger (`@` by default) typed at a word start offers the caller's `suggest(query, trigger)` results, grouped, chosen with the arrows and Enter or Tab, or the pointer, while the area keeps focus. A mention is one atom carrying its `kind` and `id`. Pasted content goes in as plain text, Ctrl+Enter (⌘Enter) calls `onSubmit`, and Escape closes the list and then calls `onCancel`. Nothing renders per keystroke: the ref's `getValue()`, `setValue()` and `clear()` read and write the content, `onValueChange` reports each input.

### EmojiPicker

`CgEmojiPicker` is a searchable grid of emoji in named groups, with `recent` ones first and an optional remove button. Arrows walk it along the line (mirrored in right to left), and ArrowUp from the first row returns to the search box. It takes any emoji list; `cgPageIcons('ar' | 'en')` gives the curated page-icon set (about 130 emoji named in Arabic and English, written for this library, so no third-party emoji data is bundled).

### DragDrop

`cgTrackDrag(pointerDown, element, options)` follows a press and, past a 4 px threshold, drags outside React: a copy follows the pointer once a frame, the element is marked `data-cg-dragging`, a `scroller` scrolls near its edges, Escape or a cancelled pointer ends it without a drop, and the click after a drop is swallowed. `onMove(x, y)` and `onDrop(x, y)` get viewport points. `cgStartsDrag` tells a press on the item from one on a control inside it. `CgDragHandle` is the grip (ArrowUp and ArrowDown through `onKeyboardMove`), and `CgDropIndicator` is the drop line, moved through its ref with logical offsets so a drag draws nothing in React.

### KanbanBoard

`CgKanbanBoard` draws `columns` of `cards` with the caller's `renderCard` and reports each move through `onCardMove(cardKey, toColumnKey, toIndex, details)`; it never reorders its own data. A card is dragged with the pointer (a copy, edge scrolling and one drop line, nothing re-rendered while it moves), carried with the keyboard (Space picks it up, the arrows carry it, mirrored in right to left, and Space drops it), or moved from its handle's menu. `canMove` vetoes places and `fixedOrder` allows moves between columns only. Long columns draw only the cards in view; columns can collapse or be hidden. Every string, announcements included, comes from `labels`.

### MonthCalendar

`CgMonthCalendar` is a month grid for items with a `start` and an inclusive `end`: an item with no end, or an end on its start, is one day. Items spanning days are laid in lanes across week rows; a day with more than `maxItemRows` shows "+N more", which lists them all. Dates may be `YYYY-MM-DD`, a date-time without a zone, or an instant placed in `timeZone`. It has no editor: `onItemOpen`, `onCreate` and `onItemMove` (a new start and end, keeping the length and time of day) are the caller's. Days are one tab stop walked by the arrows (mirrored in right to left), PageUp and PageDown change the month, and items move by drag or Alt+arrows. Month and weekday names come from `Intl` in `locale`, and the first day of the week from `firstDayOfWeek` or the locale.

### Timeline

`CgTimeline` draws the caller's items on a time axis, one line each in the order given (the caller sorts), each a bar from its `start` to its inclusive `end` in the month calendar's date forms (`YYYY-MM-DD`, a date-time without a zone, or an instant placed in `timeZone`); an item whose start cannot be read takes no line. `lanes` group the lines under header lines that collapse (`collapsedLanes` or `defaultCollapsedLanes`, `onCollapsedLanesChange`); items of an unlisted lane go under a last one named `labels.noLane`. The `scale` (`day`, `week`, `month`, `quarter`, each a fixed width per day set by `dayWidths`) draws a two-tier header in `locale` with weeks from `firstDayOfWeek`, a today line, and previous, today and next buttons (or `showToolbar={false}` and the handle's `scrollToDate`). Time runs from the inline start: right to left in a right-to-left container. Only the lines in view, and the header and grid lines near the days shown, are drawn, so 50,000 items cost a check of each start; `onRangeChange({ from, to })` reports the days shown once they settle, for fetching a window around them. It has no editor: a click or Enter opens (`onItemOpen`), a double click on an empty spot or Shift+Enter creates (`onCreate(date, lane)`), and dragging a bar's body or an edge, or Alt+ArrowLeft/ArrowRight (move), Alt+Shift with them (end) and Ctrl+Shift or Cmd+Shift with them (start), mirrored in right to left, report `onItemMove(item, { start, end, days, edge, source })` in the item's own date forms, announced through `labels.moved` and `labels.resized`. The lines are one tab stop walked by ArrowUp, ArrowDown, PageUp, PageDown, Home and End. `actionsRef` gives `dateAt` and `laneAt` under a viewport point and `markDropDate` for a drag from outside, `scrollToDate`, `scrollToItem` and `getItemElement`.

### TreeView additions

`CgTreeView` gains, all opt-in: `onNodeMove` with `canDrop` and `moveLabels` (rows dragged before, after or inside another, or moved with Alt+Shift and the arrows), `onNodeRename` with `renameLabel` (F2, a double click or `actions.startRename(key)` opens an inline editor; Enter or leaving commits, Escape reverts), `loadChildren` with `loadLabels` for nodes marked `hasChildren` (loading, error and retry rows; collapsing aborts), `virtualize` with `rowHeight`, `overscan` and `height` (only rows in view are drawn, with their level and position kept), `renderActions` for buttons at a row's end, `actions.showContextMenu`, and `arrowKeys="logical"` to mirror the arrows in right to left. Existing trees render as before; right-to-left toggle chevrons now point the right way.

### Select

`CgSelect` is a single choice from a short list, drawn and labelled as the library's fields (it takes `CgField`'s label, description, required and validation state): the browser's own select underneath, so its keyboard, type-ahead and a phone's picker work as people expect. `options` are `{ value, label, disabled, group }`, grouped as `optgroup`s; `value` or `defaultValue` (`null` shows the `placeholder`), `onValueChange(value, { option, event })`, `size`, `fullWidth`, `readOnly`. `CgComboBox` is the control that filters.

### Later additions for the workspace

- `CgCommandMenu` `handledKeys`: the keys it acts on, so an editor showing it at the caret can keep Home and End for the text. On the active option, the second line and shortcut read at 6.2:1.
- `CgMentionArea` reads an empty line a browser makes of a block as one line, not two.
- `CgFilePicker` `directory`: the dialog asks for a folder and gives every file in it, and folders dropped on a `dropZone` are read through; `details.paths` gives each file's path below the folder (also given, as the names, without `directory`).
- `CgOptionPicker` `normalize(text)` folds the query and each name with the app's own rule (a name that folds to the typed text is not offered as new), or `filter(option, query)` decides the matches. `CgItemPicker` already shows the caller's own results.
- `CgToolbarItem` `expanded` and `controls` set `aria-expanded` and `aria-controls` on an item that opens a panel. An icon-only `CgButton` draws no empty label box beside its icon.
- `CgSelectionToolbar` docked keeps 44 px tools and scrolls along the line when they are wider than the screen.
- `indent-increase` and `indent-decrease` draw Fluent's right-to-left versions inside a right-to-left container.
- `CgKanbanBoard` adds `onColumnMove` (a column moves by its header, its grip's keys or the grip's menu, with a drop line and announcements), `renderColumnFooter`, `onColumnEndReached` for paging, a draft card (`draftColumn`, `renderDraft`) and `renderColumnTitle`. `moveKanbanCard` and `moveKanbanColumn` apply a reported move to the caller's list.
- `CgMonthCalendar` adds an `actionsRef` handle (`dayAt(x, y)` and `markDropDay` for drags from outside, `getDayElement`, and `startCreate(date)`, whose `onCreate` carries the day cell as its anchor) and a controlled `selectedDay`.
- `CgTreeView` rows are named by their title alone; `collapsible: false` makes a section heading that never folds; `current` sets `aria-current`; Ctrl, Cmd and Alt chords the tree does not use reach the app; selected text reads at 5.6:1.
- `CgTreeView` row actions are hidden from assistive technology and the tab order until the row is hovered, focused or selected (Tab from a focused row reaches them).
- `CgToastAction` takes `href` (and `target`) to act by a link, such as opening the page a notice is about; `onAction` also runs if given.
- A notice with "Undo" and "Close" is `useCgToast().show({ content, action: { label, onAction }, showCloseButton: true, closeButtonAriaLabel })`: it pauses while hovered, focused or running its action, and is a polite `status` (an `alert` only for errors and `important`).

### Fixes to existing components

These change no prop's meaning:

- `CgSplitter`: a pane is a column whose content fills it and scrolls on its own under a fixed header (the pane no longer scrolls as a whole). `separatorAriaLabel({ start, end })` names each separator; without it the English template stays.
- `CgButton`: on the dark theme, solid buttons draw `--cg-color-fg-on-accent`, now the page's dark (6.3:1 or more on every intent); `soft` buttons draw their text 25% towards the text colour (5.4:1 for primary on light), and neutral `soft` draws the theme's text on the subtle surface.
- Theme tokens: `--cg-color-text`, `-text-muted`, `-text-disabled`, `-surface`, `-surface-subtle`, `-surface-raised`, `-surface-muted`, `-surface-hover`, `-border`, `-focus`, `-danger` and `-on-primary` are now set on every themed element, so `CgContextMenu`, `CgMenu`, `CgToolbar`, `CgAccordion`, `CgFormLayout` and the PDF viewer follow the dark theme instead of their light fallbacks.
- `CgDrawer`: `openSize` and `miniSize` take a CSS `min()`, `max()`, `clamp()` or `calc()`.
- `CgTabs` with `reorderable`: a click selects the tab (the pointer is captured only once a drag starts), and dragging in right to left drops where the pointer is.
- `CgFlyout`: an explicit `width` survives positioning; `focusFirst()` called while the flyout is still being placed (as from `onAfterOpen` when mounted open) focuses once it is drawn; the new `autoFocus` does that on every open; an element, ref or selector anchor is watched only while open.
- `CgChart`: the "Chart data" toggle is at least 24 px high.

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

`CgSpinEdit` adds accessible buttons and Arrow/Page stepping and steps from the current parseable draft before falling back to the committed/null-start policy. A null increment starts at `min` when supplied, otherwise 0; a null decrement starts at `max`, otherwise 0. Pointer press-and-hold repeats and accelerates by default; set `repeatOnHold={false}` for single pointer steps. Repeat timing is intentionally private. `allowExpressions` accepts locale-aware arithmetic with unary signs, parentheses, precedence, and `+`, `-`, `*`, and `/`; incomplete drafts remain visible and quiet, while invalid, non-finite, overlong, over-nested, and division-by-zero expressions are rejected. `updateValueOnInput` publishes each complete draft immediately without reformatting the expression or duplicating the later blur/Enter change. Expression mode defaults `inputMode` to `text` instead of `decimal`, and `showSpinButtons={false}` hides the buttons without disabling Arrow/Page stepping. The evaluator remains private.

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

`CgLoadingPanel` supports inline, wrapper overlay, and portal-target modes, delayed display, minimum visible time, inert blocking, shading, dismissal, topmost Escape ordering, and target geometry tracking. Focus containment remains off by default; `trapFocus` enables Tab cycling and focus return for blocking overlay/portal modes only. `textAlignment` (`top`, `inlineEnd`, `bottom`, `inlineStart`) places the text around the indicator, `indicatorAreaVisible={false}` drops the indicator card, `size` sets the indicator, padding and gap, and `zIndex` fixes an overlay or portal panel's stacking order.

`CgWaitIndicator` is the standalone visual/status primitive shared with LoadingPanel. It defaults to a visible medium spinner with one polite “Loading” status announcement, supports spinner/dots/pulse animations and small/medium/large sizes, and accepts custom children. Set `decorative` only when adjacent text already communicates the state; it removes live semantics and sets `aria-hidden`. Reduced motion stops indicator animation, and forced-colors mode retains visible system-color geometry.

## Public API

Components:

- `CgIcon`, `CgButton`, `CgButtonGroup`, `CgField`
- `CgTextBox`, `CgMemo`, `CgRichTextEditor`, `CgCheckBox`, `CgSwitch`, `CgComboBox`, `CgKeyComboBox`, `CgLookUpGrid`, `CgListBox`, `CgTagBox`, `CgKeyTagBox`, `CgDropDownBox`, `CgDateEdit`, `CgTimeEdit`, `CgCalendar`, `CgDateRangePicker`, `CgDateRangePresetSelect`, `CgFileUploader`
- `CgColorPicker`, `CgBorderPicker`, `CgGallery`
- `CgFlyout`, `CgPopup`, `CgWindow`, `CgMessageBox`, `CgMaskedInput`
- `CgSplitter`, `CgDrawer`
- `CgChart`, `CgMap`, `CgPdfViewer`, `CgRangeSelector`, `CgSlider`, `CgTooltip`, `CgStatusBadge`, `CgStatusBar`
- `CgMenu`, `CgContextMenu`, `CgDropDownButton`, `CgSplitButton`, `CgToolbar`, `CgRibbon`
- `CgLayoutBreakpoint`, `CgGridLayout`, `CgGridLayoutItem`, `CgTabs`, `CgStepper`, `CgAccordion`, `CgTreeView`, `CgTreeList`, `CgPivotTable`, `CgPivotFieldList`, `CgScheduler`, `CgFilterBuilder`, `CgPager`, `CgGrid`
- `CgFormLayout`, `CgFormLayoutItem`, `CgFormLayoutGroup`, `CgFormLayoutTabs`
- `CgRadio`, `CgRadioGroup`
- `CgNumericEdit`, `CgDecimalEdit`, `CgSpinEdit`, `CgSearchBox`
- `CgLoadingPanel`, `CgWaitIndicator`, `CgProgressBar`
- `CgLiveAnnouncer`, `CgAvatar`, `CgAvatarStack`, `CgFilePicker`, `CgBreadcrumb`, `CgInlineTextEditor`, `CgInlineNumberEditor`
- `CgCommandMenu`, `CgSelectionToolbar`, `CgMenuPanel` (with `CgMenuPanelItem`, `CgMenuPanelSwitch`, `CgMenuPanelGroup`, `CgMenuPanelSeparator`, `CgMenuPanelHeader`), `CgSortableList`, `CgOptionPicker`, `CgItemPicker`, `CgMentionArea`, `CgEmojiPicker` and `cgPageIcons`
- `CgDragHandle`, `CgDropIndicator`, `cgTrackDrag`, `cgStartsDrag`, `cgEdgeScrollStep`, `CG_DRAG_THRESHOLD`, `CgKanbanBoard`, `CgMonthCalendar`, `CgSelect`, `CgTimeline`
- `CgToastProvider`, `CgConfirmationProvider`, `CgEditorCommitProvider`, `CgUiTextProvider`

Focused shared types include `CgSizeMode`, `CgDensity`, `CgIntent`, `CgOrientation`, `CgDirection`, `CgValidationState`, `CgIconName`, `CgIconSource`, `CgEditorButtonDescriptor<T>`, canonical `CgDateValue`/`CgDateRangeValue`/`CgTimeValue`, the Filter Core AST/registry/persistence contracts, the DateEdit/TimeEdit/Calendar/DateRangePicker contracts and CgDateRangePresetKey, Scheduler recurrence/resource/reminder/action/iCalendar contracts, the FileUploader item/transport/event/render/action contracts, the PDF source/state/event/render/action contracts, the Chart descriptor/axis/selection/action/localization contracts, the GridLayout descriptors, the TreeList binding/column/node/provider/mutation/output/state/render/action contracts, the Splitter versioned-state/descriptor/detail contracts, the Drawer lifecycle/render/action contracts, WaitIndicator, MessageBox, Toast and Confirmation APIs, the shared overlay contracts, and each descriptor component's props, actions, lifecycle details, and render/state contexts. Private PDF controller/model modules, chart model/layout/browser modules, endpoint-session tokens, menu, adaptive-layout, TreeView normalization/check/filter engines, and TreeList hierarchy/projection internals are not exported. There is intentionally no universal component-state interface.

The public hooks are `useControllableState`, `useCgId`, `useCgContextMenuTarget`, `useCgToast`, `useCgConfirmation`, `useCgLayoutBreakpoint`, `useCgEditorCommit`, and `useCgUiText`; `cx` is the public class-name utility. All other primitives and hooks are private implementation details.

## Development

Use Node `^22.22.2 || ^24.15.0 || >=26.0.0`; this matches the locked jsdom requirement. The verified local runtime is Node 24.19.

| Command | Purpose |
| --- | --- |
| `npm run storybook` | Run Storybook on port 6006 with theme, density, direction, and a11y controls |
| `npm run build-storybook` | Create the static Storybook build |
| `npm run test:browser` | Build Storybook and run all Playwright browser projects |
| `npm run test:browser:semantic` | Run semantic and Axe checks in Chromium, Firefox, and WebKit |
| `npm run test:browser:visual` | Compare Chromium and WebKit screenshots |
| `npm run test:browser:update` | Regenerate Chromium and WebKit screenshots on the current platform |
| `npm run typecheck` | Strict TypeScript check for source, tests, and Storybook |
| `npm run lint` | Type-aware ESLint and React Hooks rules |
| `npm run test` | Semantic Vitest/Testing Library suite |
| `npm run check:cycles` | Reject relative-import cycles in shipped source |
| `npm run build` | Clean, type-check, and build the ESM library/declarations/styles |
| `npm run verify:package` | Verify exports, declarations/maps, CSS, React externalization, ESM import, and dry-run tarball |
| `npm run verify` | Run all gates, including the static Storybook and package checks |

Install browser binaries once with `npx playwright install chromium firefox webkit`. Storybook's global toolbar switches light/dark, comfortable/compact, and LTR/RTL. Every component has its own story module with applicable controlled/uncontrolled, disabled, read-only, required/invalid, size, long/empty, loading, keyboard, and Arabic RTL scenarios. Each module records its Razor source and known difference. Storybook retains its accessibility panel; Playwright also runs Axe against canonical stories and fails serious or critical findings.

Windows Chromium baselines live in `tests/browser/__snapshots__`; WebKit has a separate `webkit` subdirectory. Playwright snapshots are platform-specific; regenerate them on the same operating system used for comparison. They also depend on installed fonts: `--cg-font-family` starts with Inter, which is not bundled, and the committed images were rendered on a Windows host without it, so expect a host with Inter to fail most of them. Browser tests serve the prebuilt Storybook through a lifecycle-managed Vite preview server. No CI workflow is installed; browser gates run locally through `npm run verify`.

Latest phase (2026-11-04): the ribbon, pickers, gallery, icon set and direction fix pass 963 unit tests, all 312 Chromium and 312 WebKit semantic/Axe cases, all 704 visual cases (352 per engine), typecheck, lint, cycles, both builds and package verification on the recorded Windows host. `npm run verify` as one command still stops there because Firefox cannot launch, so the other gates were run separately in the same order and no Firefox coverage is claimed. See the [acceptance record](docs/parity-implementation-status.md).

Parity acceptance (2026-09-14): scoped parity through Phases 30–33 is complete against Blazor `aea3e622`. Verification covers 755 unit tests with two workers, the full 402-case Chromium/WebKit semantic/Axe suite plus 34 post-fix checks, and all 630 visual cases across the full sweep and reviewed baseline rechecks. Typecheck, lint, cycles, builds and package verification passed. Firefox remains environment-blocked before page creation; no Firefox coverage is claimed for this pass. See the [acceptance record](docs/parity-implementation-status.md) for the exact results, baseline changes and transient navigation failures. The phase notes below are historical.

The Phase 10 Node 24.19 verification completed with 205 Vitest tests, 68 semantic/Axe cases per engine, 108 Chromium visual tests comparing 116 Windows snapshots, and package verification of exactly 33 runtime exports across 648 packed files. Firefox's headless software renderer still cannot start on this host; all 68 cases were covered headed, with one legacy TagBox browser-context teardown flake passing immediately in isolation. See the parity ledger for the exact gate breakdown.

Phase 15 verification on 2026-08-27 passed strict typecheck and lint, 36 Vitest files/351 tests, cycle analysis across 209 source modules, the 204-module library build, the 270-module Storybook build, package verification of 141 runtime exports across 988 packed files, all 163 Windows Chromium visual cases, and the final affected 16-case Chromium/WebKit semantic and Axe matrix. The complete 182-case Chromium/WebKit semantic suite also passed during acceptance; see the parity ledger for command-level detail and the Firefox host limitation.

Phase 16 verification on 2026-08-29 passed strict typecheck and lint, 40 Vitest files/367 tests, cycle analysis across 221 source modules, the 215-module library build, the 282-module Storybook build, package verification of 147 runtime exports across 1,042 packed files, all 96 Chromium and 96 WebKit semantic/Axe cases, and all 172 Chromium visual tests against 180 inspected Windows baselines. Firefox remains blocked before page creation by the host SWGL framebuffer mapping failure; see the parity ledger for the exact classification.

Phase 17 verification on 2026-08-29 passed strict typecheck and lint, 43 Vitest files/393 tests, cycle analysis across 228 source modules, the 222-module library build, the 290-module Storybook build, package verification of 148 runtime exports across 1,076 packed files, all 98 Chromium and 98 WebKit semantic/Axe cases, and all 181 Chromium visual tests against 189 reviewed Windows baselines. Firefox remains blocked before page creation by the same host SWGL framebuffer mapping failure; see the parity ledger for the exact classification.

Phase 18 verification on 2026-08-29 passed strict typecheck and lint, 46 Vitest files/420 tests, cycle analysis across 236 source modules, the 230-module library build, the 298-module Storybook build, package verification of 150 runtime exports across 1,114 packed files, all 105 Chromium and 105 WebKit semantic/Axe cases, and all 193 Chromium visual tests against 201 reviewed Windows baselines. Exactly 12 new `phase-18-*` baselines were added and inspected; every Phase 1–17 comparison remained stable. A single Firefox attempt reproduced the host-only pre-page SWGL framebuffer mapping failure and was not repeated.

Phase 19 verification on 2026-08-29 passed strict typecheck and lint, 50 Vitest files/457 tests, cycle analysis across 246 source modules, the 240-module library build, the 308-module Storybook build, package verification of 156 runtime exports across 1,161 packed files, all 111 Chromium semantic/Axe cases, and all 206 Chromium visual tests against 214 reviewed Windows baselines. The WebKit full run passed 108 cases and exposed two RangeSelector resize-observer warnings plus one transient Phase 13 navigation timeout; after the generation-safe animation-frame fix and rebuild, the affected tests passed 2/2 and 1/1 respectively, giving passing evidence for all 111 cases. Exactly 13 new `phase-19-*` baselines were added and inspected; every Phase 1–18 snapshot remained stable. The single permitted Firefox attempt reproduced the host-only pre-page SWGL framebuffer mapping failure and was not repeated through the aggregate verifier.

Phase 20 verification on 2026-08-31 passed strict typecheck and lint, 52 Vitest files/481 tests, cycle analysis across 263 source modules, the 257-module library build, the 327-module Storybook build, package verification of 158 runtime exports across 1,245 packed files, and all 115 Chromium and 115 WebKit semantic/Axe cases. Chromium produced passing evidence for all 220 visual tests against 228 Windows baselines: the complete run passed 219 cases, one existing remote ComboBox loading capture advanced to results during screenshot stabilization, and that unchanged case passed immediately in isolation. Exactly 14 reviewed `phase-20-chart-*` baselines were added; all 214 prior baseline files remain unchanged. The aggregate verifier passed every gate through Chromium, then reproduced the host-only Firefox pre-page SWGL framebuffer failure; it was terminated when Playwright began replacement-worker launches, so the already-passing package gate was retained from its independent run and Firefox was not invoked again.

Phase 21 verification on 2026-08-31 passed strict typecheck and lint, 53 Vitest files/509 tests, cycle analysis across 270 source modules, the 264-module library build, the 334-module Storybook build, package verification of 168 runtime exports across 1,280 packed files, and all 119 Chromium and 119 WebKit semantic/Axe cases. All 235 Chromium visual tests passed against 243 Windows baselines. Exactly 15 reviewed `phase-21-treelist-*` baselines were added, and all 228 older snapshots passed unchanged. Firefox remains environment-blocked before page creation by the host SWGL framebuffer mapping failure; no TreeList assertion or Axe scan ran in Firefox.

Phase 24.1 verification on 2026-09-06 passed strict typecheck and lint, 67 Vitest files/669 tests, cycle analysis across 317 source modules, the 319-module library build, the 396-module Storybook build, package verification of 198 runtime exports across 1,557 packed files, and all 172 Chromium plus 172 WebKit semantic/Axe cases. Four inspected `phase-24-1-*` Chromium baselines were added; all 275 older visual cases produced passing evidence unchanged, including focused reruns for two transient Map tile captures and restored legacy KeyComboBox story copy. Firefox remains environment-blocked before page creation by the known headless SWGL framebuffer mapping failure. The exact command-level record and intentional exclusions are in the parity ledger.

Phase 25 verification on 2026-09-06 passed strict typecheck and lint, 69 Vitest files/683 tests, cycle analysis across 321 source modules, the 324-module library build, the 401-module Storybook build, and package verification of 199 runtime exports across 2,159 packed files. The real PDF.js worker passed all nine focused interaction/Axe cases in both Chromium and WebKit; six new Windows Chromium baselines passed and were visually inspected. Poppler metadata and page rendering independently verified the 48-page, four-page AcroForm/link, and two-page encrypted fixtures. Firefox remains environment-blocked before page creation by the known headless SWGL framebuffer mapping failure.

## Packaging

The library is ESM-only. Vite preserves modules for tree-shaking, keeps React external, emits declarations and declaration maps, and produces `dist/cashgear-ui.css`, exported only as `@cashgear/ui/styles.css`. Leaflet and the rich-text engine are emitted as lazy chunks. The PDF.js browser distribution is emitted unchanged under `dist/vendor/pdfjs` for host deployment. Their licenses, notices, images, pins, and integrity manifests ship with the package, as do those of the Fluent icons. `npm run verify:package` verifies exact hashes and copied bytes, rejects bare runtime vendor imports, and runs `npm pack --dry-run` so the publish allow-list is checked before release. `.gitattributes` marks `src/vendor` as `-text`, so a Windows checkout with `core.autocrlf` leaves those bytes alone.

See [the parity ledger](docs/cgcomplib-react-parity.md) for the original and current Razor snapshots, source/test/story paths, intentional differences, exact verification results, and capabilities deferred in both libraries.
