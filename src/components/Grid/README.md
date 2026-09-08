# CgGrid

Typed local/provider Grid with controlled state, saved views, editing, filtering, grouping, summaries and XLSX export. Existing saved layouts remain version 11; virtualization and export limits are runtime options.

## Virtualization

Enable `rowVirtualization={{ rowHeight: 40, overscan: 3 }}` and/or `columnVirtualization={{ overscan: 1 }}`. Both are off by default. Row virtualization uses the current page and a fixed clipped content height. Give the Grid a `height`; the opt-in row mode otherwise uses 320px. Paging, selection and `getVisibleItems()` retain their existing ownership and return the complete loaded page.

Numeric column widths (160px when omitted, subject to descriptor bounds) support column virtualization. Frozen columns and the focused cell remain mounted. `focusCell`/`focusRow` reveal loaded-page records before focusing them. Offscreen rows remain available to keyboard movement, exports and selection; scroll gestures do not discard focus. RTL uses logical frozen offsets and horizontal navigation.

`actionsRef.current.getVirtualizationStatus()` and `onVirtualizationStatusChange` report effective row/column modes and `[rowStart, rowEnd)` page indices. A focused row outside the window can also be mounted. Row fallback reasons are `disabled`, `grouped`, `details`, and `editing`. Grouping and expanded details render complete rows because fixed spacers cannot represent their geometry. Inline/cell/batch drafts disable both modes until editing ends, keeping editors mounted. Column fallback reasons are `disabled`, `nonNumericWidths` (including invalid numeric widths), and `editing`. Popup editing does not disable virtualization.

`showGroupFooters` adds opt-in local/provider group footers with existing summary rendering and `groupFooter` context-menu callbacks. Provider nodes can supply `aggregateStates` alongside `summaries`.

## Export scopes and cancellation

```tsx
const result = await actions.current.exportToXlsx({
  scope: 'selectedRecords', // 'fullFiltered' (default), 'currentPage'
  maxRows: 100_000,
  signal: controller.signal,
});
```

Exports use committed source records, independent of virtual windows and collapsed groups. Local `selectedRecords` includes keys hidden by filtering or paging and preserves current sorting. This is an intentional React adaptation for explicit hidden-selection export; hosts may further restrict remote exports to their authorized filtered view. `currentPage` uses the full loaded page. Visible/export-enabled fields, authorized fields, group summaries, total summaries, native numeric/date values, formula-safe text and RTL sheet direction are preserved.

`maxRows` is an opt-in **record** limit, excluding header/summary rows. Exceeding it rejects instead of truncating. XLSX worksheet dimensions also have hard limits including summary rows. The byte-array API remains unchanged; local row serialization yields periodically so cancellation can run. Only one export per Grid owns publication: a replacement export, query/selection/layout/source change, or unmount aborts earlier work. Data loading uses an independent cancellation scope.

The existing `remoteExport(request, options, context)` callback now receives immutable `scope`, `selectedKeys` (existing Grid string tokens), `authorizedFieldIds` and `maxRows`, plus `signal`. Older callbacks that only use `signal` continue to compile and run. A limited remote export must return a valid `rowCount`; absent or excessive counts reject. `isExportFieldAuthorized(column)` optionally narrows fields before export. The host must independently enforce row/field authorization and server limits; client identifiers are not credentials. No database or authorization service runs inside the library.

See [the in-memory host adapter](../../stories/examples/gridRemoteExport.ts) and [Phase 29 consumer stories](../../stories/Phase29.stories.tsx). These use the existing provider/export callbacks. Applications can replace them with their typed HTTP adapters without changing the Grid API.

`createGridXlsx` also accepts optional `CgGridXlsxSettings` with cancellation, row limits, summary rows and direction. Existing three-argument calls remain valid.
