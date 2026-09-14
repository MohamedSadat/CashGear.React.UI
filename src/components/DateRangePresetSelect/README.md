# DateRangePresetSelect

`CgDateRangePresetSelect` is a native, field-aware select. `value` / `defaultValue` bind a `CgDateRangePresetKey`; the default is `last30Days`. `onSelectionChange` emits an immutable `{ preset, range, isClamped }` snapshot, so a host can apply both dates atomically. Custom emits a null range and leaves host dates unchanged. The existing `CgDateRangePreset` descriptor belongs to DateRangePicker and is unchanged.

`anchorDate`, `minDate`, and `maxDate` are canonical civil dates. Last 30 Days includes the anchor and 29 preceding days. Current Month and Year to Date end at the anchor; Last Month, Last Year, and Last 2 Years cover full preceding periods. An overlapping start is clamped to the minimum. Wholly expired presets and presets ending after the maximum are disabled.

`presets` orders options; duplicates are removed, and the bound value stays visible. `presetText` customizes labels. English and Arabic labels, inherited direction, field validation, native form association/submission/reset, disabled and read-only behavior are supported. Read-only values submit through a hidden input; disabled values do not submit. Controlled state always remains host-owned.
