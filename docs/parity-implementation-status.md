# Parity implementation acceptance record

React starting revision: `7791c80d652cdb0c26a57ac6c9846fadcf380842`.
Read-only Blazor reference: `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`.

This record tracks implementation separately from acceptance. An implemented API is not considered verified until its tests and integration gates are recorded.

| Phase | Capability | Implementation | Acceptance |
| --- | --- | --- | --- |
| 26 | Commit scopes, editor flush/reset, protected dialogs, overlay hardening | Implemented | Focused and integration checks passed; see below |
| 27 | Numeric policies, exact decimal editor | Implemented | Focused checks passed; final cross-phase integration pending |
| 28 | ListBox transactions, TagBox context, key adapter | Implemented | Phase checks passed; final cross-phase integration pending |
| 29 | Grid virtualization, export scopes | Pending | Pending |
| 30 | PivotTable and TreeList hardening | Pending | Pending |
| 31 | Calendar multiple selection, preset selector | Pending | Pending |
| 32 | Scheduler recurrence, resources, reminders, templates, iCalendar | Pending | Pending |

## Recent reference commits

| Commit | Areas to reconcile | Status |
| --- | --- | --- |
| `fb523d4c` | TreeList, TagBox, PivotTable | TagBox query/selection ownership implemented in Phase 28; TreeList/Pivot remain Phase 30 |
| `130d8628` | SpinEdit and editor commit integration | Numeric/commit equivalents implemented in Phases 26–27; final reconciliation audit pending |
| `fbf3fcb9` | Overlays, ListBox, TextBox and related integration | Editor/overlay equivalents implemented in Phase 26; ListBox hardening implemented in Phase 28; final reconciliation audit pending |

## Boundaries

Existing React APIs and controlled-state authority are preserved. Parent-driven close and unmount are authoritative; guarded close actions run the optional busy/dirty/discard policy. Backend authorization and persistence remain host-owned. TreeList pointer drag/drop and variable-height virtualization, and ListBox remote paging, are deferred in both libraries and are not counted as missing parity.

## Phase 26 acceptance

TypeScript, scoped ESLint, cycle analysis (325 modules), library and Storybook builds passed. The full unit run passed 688 tests in 70 files; the additional controlled asynchronous echo regression passed in the final six-case commit suite. Chromium and WebKit transaction interaction/Axe scenarios passed. Three new light/dark/RTL-narrow baselines were generated and visually inspected. Package verification passed with 201 runtime exports and 2,178 packed files. Firefox reproduced the existing 30-second framebuffer launch failure before page creation; no component assertion ran.

Existing tooltip Escape handling, visible-only popup/window subscriptions, and flyout internal-scroll exemption were verified in source. This phase adds coalesced surface gestures/position updates, hidden-ancestor focus filtering, and stops outside-dismissal cascades when a new owned confirmation appears. Final cross-phase browser regression remains required.

## Phase 27 acceptance

Added CgDecimalEdit, shared canonical decimal normalization and exact arithmetic, opt-in number range/rounding/delayed publication policies, and Grid/TreeList decimal metadata. Existing number-editor defaults remain intact. TypeScript, scoped ESLint, 85 focused tests across eight suites, and a final 24-case numeric/text rerun passed. Chromium/WebKit arithmetic/rejected-draft/Axe scenarios passed after correcting focus-selection synchronization. Three light/dark/RTL-narrow baselines were inspected. Library/Storybook builds and cycle analysis (329 modules) passed; package verification reported 202 runtime exports and 2,197 packed files. The known Firefox launch limitation was established in Phase 26; final cross-phase gates remain pending.

## Phase 28 acceptance matrix

| Gap / reference behavior | React capability / adaptation | Evidence |
| --- | --- | --- |
| Cancellable selection and imperative actions | Optional guard, immutable array snapshots, latest-request ownership, abortable await, set/clear/select-all/focus/scroll actions | `tests/phase28.test.tsx`; public generic action/proposal types compile in tests |
| Displayed-order ranges, read-only/loading, data processing | Group-order indices and anchors; authoritative controlled updates; programmatic review actions; dataVersion for in-place host data; indexed key membership | Existing ListBox suite and Phase 28 ownership tests |
| Virtual group geometry and accessibility | Fixed clipped rows/group headers, narrow/touch minimum, sticky-header-aware scroll, valid mounted active descendant, option positions and persistent descriptions | Existing ListBox browser geometry/RTL tests; Phase 28 End navigation and Axe |
| Activation and field-path differences | Additive onItemActivate for Enter/pointer; existing onItemClick remains pointer-only. Typed host selectors supply null-safe access instead of reflection | Review-navigation test; ListBox contract documentation |
| TagBox context and recent cache/query fixes | Immutable request context; version/query/IME/close invalidation; immediate pre-debounce abort; stale-result suppression | Existing TagBox suites and cross-context race test |
| Key-valued TagBox and resolver | CgKeyTagBox wraps existing TagBox; cancellable resolution, ownership-scoped outcome cache, missing-key fallback, refresh, equality/hash, native keys/reset | Resolver race, missing-key/cache/refresh/native-form tests; Phase 28 story |
| Incomplete Enter, IME, diagnostics | Explicit active navigation for truncated Enter; composing-key suppression; load/resolution diagnostics | Phase 28 keyboard test; existing remote-error browser scenario |

Typecheck, full ESLint, and cycle analysis (332 source modules) passed. All 703 unit tests in 72 files passed with `--maxWorkers=2`. Earlier high-concurrency runs timed out on an existing RichTextEditor five-second test; reducing worker contention passed without changing that test. The final focused ListBox/TagBox run passed 40 tests after the last clipping/loading corrections.

All 26 selected Chromium/WebKit interaction and accessibility scenarios passed, including existing ListBox, TagBox, DropDownBox selection, and Phases 26–28. Three new Phase 28 light/dark/RTL-narrow baselines were visually inspected. Existing ListBox primary, grouped-column, and virtual-window baselines stayed unchanged. Exactly three existing baselines (Arabic RTL, dark compact, filtered Select All) were reviewed and updated for the corrected single-row checkbox/label alignment. Other component baselines remain unchanged. The final current-build pass passed both Phase 28 browser scenarios and all nine selected visual comparisons without updating snapshots.

Library and Storybook builds passed. Package verification reported 203 runtime exports and 2,213 packed files including the component README additions. The Phase 28 Firefox attempt reproduced the 30-second `RenderCompositorSWGL failed mapping default framebuffer` launch timeout before page creation; no Firefox component assertion ran. No package was published and no consumer or backend repository was edited.

The user requested stopping after this phase. Phases 29–32 remain pending; [resume notes](parity-resume.md) preserve the next steps. Full-library browser integration and final reconciliation of all three reference commits remain required after the remaining phases.
