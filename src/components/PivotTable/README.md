# PivotTable — Phase 22

Mirrors `CashGear.Blazor.UI/Components/Data/Pivot` at reference commit `1e327060d65c8ae7e94088b24014cb7ebbd72714`. This is a library component and demonstration suite, not a CashGear backend integration.

## Local data

```tsx
import { CgPivotTable, CgPivotCalculatedMeasures } from '@cashgear/ui';
import type { CgPivotField } from '@cashgear/ui';

interface Sale { region: string; month: string; revenue: string; cost: string }
const fields: ReadonlyArray<CgPivotField<Sale>> = [
  { key: 'region', caption: 'Region', valueType: 'text', area: 'row', getValue: x => x.region },
  { key: 'month', caption: 'Month', valueType: 'date', area: 'column', groupInterval: 'month', getValue: x => x.month },
  { key: 'revenue', caption: 'Revenue', valueType: 'decimal', area: 'data', getValue: x => x.revenue, cellFormat: 'N2' },
  { key: 'margin', caption: 'Margin %', valueType: 'decimal', area: 'data', allowedAreas: ['data'],
    calculated: CgPivotCalculatedMeasures.grossMarginPercentage<Sale>(x => x.revenue, x => x.cost), cellFormat: 'N2' },
];
export function SalesPivot({ sales }: { sales: ReadonlyArray<Sale> }) {
  return <CgPivotTable fields={fields} data={sales} layoutKey="sales-pivot" />;
}
```

Keep fields and data references stable between unrelated renders. Local input is caller-authorized data. The engine never fetches records or performs authorization.

## Values and summaries

- `decimal`: canonical base-10 strings. Sum, average, calculated operations and comparisons use checked 96-bit decimal arithmetic (maximum scale 28), with half-even rounding. Overflow fails the operation rather than silently losing precision. A JavaScript number already rounded by the caller cannot be repaired.
- `date`: `YYYY-MM-DD`; `dateTime`: offset-free ISO civil date/time; `instant`: ISO timestamp with `Z` or explicit offset. No `Date` objects cross the public boundary. Instant grouping uses UTC unless `groupingTimeZone` is supplied.
- Sum, count, minimum, maximum, average, exact distinct count and registered custom aggregates are supported. Nulls are excluded. Empty/whitespace axis members are grouped as blank. Boolean values are ignored by sum/average. Invalid numeric text fails the query.
- Every subtotal and grand total owns aggregate state; averages and calculated ratios are not averages of already summarized cells. `createPivotAggregate` and `createPivotCalculatedState` support compatible partition merges.
- Business builders: gross margin, gross-margin percentage, weighted average unit price, budget variance and percentage, fulfilment percentage, inventory turnover. Zero denominators return null. Percentage builders already multiply by 100: use `N2`, not `P2`.
- `N`, `F`, `P`, `C` display formats accept precision 0–28. `C` uses the field's `currency` (USD by default). Other Excel format strings are export-only; use `formatValue` for a custom screen/CSV representation.

## Layout and interaction

`layout` + `onLayoutChange` are controlled: proposals do not overwrite the supplied layout. `defaultLayout` initializes uncontrolled state. `normalizePivotLayout` migrates schema v1 to v2, restores known fields, enforces allowed areas and calculated-measure restrictions, and falls back from unknown future versions. Layouts and queries are immutable.

Drag the dotted field handle to an area or another field. The field area selector and field-list up/down buttons provide keyboard equivalents. Field-list changes are deferred until Apply by default (`deferredFieldListChanges={false}` applies immediately). Sort by display or a chosen measure; configure grand-total visibility and near/far placement. Field descriptors control subtotal visibility.

The filter popup supports debounced search, paged members, explicit empty selection, numeric inclusive bounds, and `[dateFrom, dateToExclusive)` bounds. `excludedMemberKeys` represents unchecked members without accidentally excluding unloaded distinct-value pages. Member filtering combines with range filters.

Grid navigation: arrows, Home/End, Control+Home/End and PageUp/PageDown; Enter/Space activates a cell, Control/Command+Enter or double-click opens paged drill-down. Rows and columns are virtualized together using fixed dimensions and overscan; active-cell focus is retained. `virtualScrolling={false}` disables windowing. Expansion does not requery. Full exports ignore expansion and viewport clipping.

`actionsRef` exposes stable refresh, expansion, field-list, reset, export and snapshot methods. `renderRowHeader`, `renderColumnHeader`, `renderCell`, `renderTotalCell`, field templates, state templates and `renderDrillDown` customize rendering. English and Arabic labels are built in; `labels` overrides them. Logical CSS supports RTL, dark tokens, narrow layouts and forced colors.

## Providers, cancellation and diagnostics

Supply **exactly one** of `data` or `dataProvider`. A `CgPivotDataProvider` implements:

1. `execute(query, signal)` — complete hierarchy and sparse aggregate cells; optional explicit `isPartial`/continuation metadata.
2. `getDistinctValues(request, signal)` — apply every active filter except the requested field's own filter, then search/page authorized members.
3. `getDrillDown(request, signal)` — apply filters and the selected row/column prefixes, enforce the maximum and return only permitted detail columns.

Queries contain serializable field metadata and stable custom/calculated keys, never getters or functions. The host must whitelist field IDs, areas, summaries and aggregate keys, enforce tenant/user authorization on **every operation**, and implement the same canonical member keys/decimal rules. Client validation is not an authorization boundary. Use `createPivotMember`, `pivotValueKey` and `pivotPathKey` when constructing compatible responses.

Source/query replacement and unmount abort pending work; late responses are ignored even if a provider ignores cancellation. `beforeQuery`/`beforeExport` may cancel. The last successful view is retained when a later query fails. `onQueryCompleted`, `onQueryFailed`, `onError` and payload-free `onDiagnostics` report outcomes. `CgPivotLimitError.limit` identifies the exceeded bound. Do not put sensitive rows in diagnostic callbacks.

Default limits: 10,000 row nodes, 2,000 column nodes, 2,000,000 aggregate cells; 5,000 drill-down rows in pages of 50; 2,000,000 exported data cells. Defaults for virtualization: 34px rows, 132px cells, overscan 6 rows/3 columns. A query can hit the cell limit before the node limit because all hierarchy prefixes are aggregated.

## Persistence and export

With `layoutKey`, the default `CgPivotBrowserLayoutStore` safely reads browser storage and debounces saves by 500ms. Supply a `CgPivotLayoutStore` for remote persistence. Stores must honor cancellation to prevent obsolete writes. Keys must be scoped by the host to tenant/user/report; browser storage is not secure storage. `autoLoadLayout` and `autoSaveLayout` independently disable automation. Reset deletes stored state and restores descriptor defaults.

Local export recomputes the complete logical result. Provider-backed pivots require an explicit `CgPivotExportProvider`; their view payload is never treated as a complete dataset. The request includes the query, layout, permitted field metadata, limits and RTL direction. Apply the same authorization and export limits on the server.

`exportXlsx`/`exportCsv` return bytes without downloading unless `{ download: true }` is requested; toolbar export downloads explicitly. `createPivotExport` is DOM-free; `downloadPivotExport` is browser-only. XLSX contains hierarchical headers/merges, row outlines, totals, numeric formats and frozen panes; decimal values beyond Excel's 15-digit precision are preserved as text. CSV is UTF-8 with BOM, quoted/escaped fields, and formula-prefix protection. There is no new runtime dependency.

## Deliberate differences

Typed React descriptors replace Razor children and .NET reflection. Custom aggregation and provider transport remain host-owned; no SQL adapters, distributed execution service, ClosedXML, or server authorization is bundled. Canonical strings replace CLR Decimal/DateOnly/DateTime. Native field-setting selects retain technical summary/sort identifiers even with translated surrounding labels. PivotTable is read-only analysis: it does not edit source records, and variable-height rows are unsupported.

Storybook: `Phase 22/PivotTable`. Regression coverage: `pivot.test.ts`, `CgPivotTable.test.tsx`, `tests/browser/pivot.browser.spec.ts`, and `tests/browser/pivot.visual.spec.ts`.
