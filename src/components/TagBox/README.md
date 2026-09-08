# CgTagBox search ownership

The existing local `options`, remote `loadOptions`, object-valued selections, defaults, and native-form API remain unchanged.

`dataVersion` and `queryContext` are optional ownership inputs. They are forwarded to `loadOptions(query, { signal, requestId, dataVersion, queryContext })`. Changing either invalidates results and pending work. Query changes cancel the previous request immediately, before the debounce delay; disabled/read-only, close, composition, and unmount also release pending work. Late results never replace a newer query or context. `onLoadError` reports remote search failures.

IME selection keys are ignored while composing. When local/remote results exceed `maxVisibleItems`, Enter requires explicit active-item navigation; it does not silently choose a default from truncated results. The minimum search length applies consistently to local and remote sources.

Use [CgKeyTagBox](../KeyTagBox/README.md) for selected key arrays, missing-key fallback labels, abortable item resolution, cached outcomes, explicit refresh, and host equality/hash comparison.
