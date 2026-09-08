# CgListBox selection transactions

Existing object selection, synchronous callbacks, native forms, search, and controlled ownership remain available. The optional `onBeforeSelectionChange` guard receives frozen previous/proposed arrays, a typed reason, and an AbortSignal. False, rejection, cancellation, and superseded requests publish no selection. `onSelectionError` receives guard failures. A parent value update or native form reset remains authoritative.

`actionsRef` exposes asynchronous `setSelection`, `clearSelection`, and `selectAll`, plus `focusItem` and `scrollToItem` by key. Selection actions still run the guard. Read-only/loading blocks user selection while allowing programmatic selection; disabled blocks both. Focus/scroll do not select. Cancellation releases the awaited action even if the host does not settle its callback.

Groups, keyboard ranges, and visible indices use displayed order. Multiple-mode focus movement preserves the range anchor. Focus starts on an enabled selected item. `onItemClick` preserves its pointer-only API; new `onItemActivate` reports pointer or Enter activation independently of selection acceptance.

Virtual rows/group headers use uniform clipped geometry, at least 44px on narrow or coarse-pointer displays. Scrolling accounts for sticky column headers. Only mounted options are active descendants; persistent group descriptions and option positions retain accessible context. Entire rendering permits variable heights and exposes named groups. `dataVersion` explicitly refreshes in-place data and invalidates pending selection proposals. Typed host selectors replace Blazor's reflective field-path accessors.

See `Phase 28/Selection` in Storybook and [the parity acceptance record](../../../docs/parity-implementation-status.md). Remote ListBox paging and nested groups remain deferred in both implementations.
