# CgKeyTagBox

Key-based adapter over CgTagBox. Supply `value`/`defaultValue` as readonly string or number arrays, `getOptionKey`, and the existing local `options` or remote `loadOptions` source. The legacy object-valued TagBox API is unchanged.

`itemResolver(key, { signal, queryContext, dataVersion })` resolves selections absent from the current results. Missing, failed, and successful outcomes are cached. Unresolved keys remain selected and use `getFallbackLabel` (default: the key). `actionsRef.refreshSelectedItems()` retries current keys. Ownership changes discard outcomes and cancel pending resolution. A resolver returning another key is rejected through `onResolutionError`. Hosts can supply `isValueEqual` and a consistent `getValueHash`; hash collisions still use equality. Controlled arrays remain authoritative. Native submission contains keys; native reset restores uncontrolled defaults.

TagBox now forwards `queryContext`/`dataVersion` to search callbacks, cancels outstanding work at query change (before debounce), ignores composing selection keys, and requires explicit navigation before Enter selects from truncated results. `onLoadError` exposes host search failures.

ListBox's optional `onBeforeSelectionChange` receives frozen previous/proposed arrays, reason, and AbortSignal. Return false to veto; throw/reject to report `onSelectionError`. Only the latest authorized proposal publishes a change. Item objects themselves retain host ownership. Form reset and forced controlled updates cannot be vetoed. `actionsRef` offers guarded set/clear/select-all and focus/scroll by key. Programmatic selection remains available while read-only or loading, but disabled blocks it. Cancellation releases callers even when the host ignores its signal.

Group range navigation follows display order; virtual active descendants only reference mounted options. Entire rendering exposes named groups. Virtual rendering supplies persistent group descriptions and option positions, clips the fixed window, accounts for sticky headers, and uses a minimum 44px row on narrow/coarse-pointer screens. `dataVersion` refreshes in-place host data and invalidates proposals. `onItemClick` retains its pointer-only contract; the additive `onItemActivate` handles pointer and Enter activation independently of whether selection succeeds. This is the React adaptation of Blazor's combined activation callback. Null-safe computed selectors remain host-owned instead of adding reflective field-path APIs.

See `Phase 28/Selection` for a virtual grouped selection guard and unresolved key example.
