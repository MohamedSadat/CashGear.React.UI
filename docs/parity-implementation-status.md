# Parity implementation acceptance record

Current pass: React starts at `9663863`; read-only Blazor is pinned to `aea3e6222adce68b10ff120d7bee1e43358287d0`. Earlier phase entries retain their historical evidence.

Phases 26–29 began at React `7791c80d652cdb0c26a57ac6c9846fadcf380842` against Blazor `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`.

This record tracks implementation separately from acceptance. An implemented API is not considered verified until its tests and integration gates are recorded.

| Phase | Capability | Implementation | Acceptance |
| --- | --- | --- | --- |
| 26 | Commit scopes, editor flush/reset, protected dialogs, overlay hardening | Implemented | Verified; final integration accepted below |
| 27 | Numeric policies, exact decimal editor | Implemented | Verified; final integration accepted below |
| 28 | ListBox transactions, TagBox context, key adapter | Implemented | Verified; final integration accepted below |
| 29 | Grid virtualization, export scopes | Implemented | Verified; final integration accepted below |
| 30 | PivotTable and TreeList hardening | Implemented | Verified; final integration accepted below |
| 31 | Calendar multiple selection, preset selector | Implemented | Verified; final integration accepted below |
| 32 | Scheduler recurrence, resources, reminders, templates, iCalendar | Implemented in 32A/32B/32C | Verified; final integration accepted below |
| 33 | Grid JSON/width exports and async LookUpGrid selection | Implemented | Verified; final integration accepted below |

## Recent reference commits

| Commit | Areas to reconcile | Status |
| --- | --- | --- |
| `fb523d4c` | TreeList, TagBox, PivotTable | TagBox ownership in Phase 28; TreeList/Pivot ownership, validation, filtering and export reliability in Phase 30 |
| `130d8628` | SpinEdit and editor commit integration | Numeric/commit equivalents implemented in Phases 26–27; reconciled against pinned source |
| `fbf3fcb9` | Overlays, ListBox, TextBox and related integration | Editor/overlay equivalents in Phase 26; ListBox hardening in Phase 28; reconciled against pinned source |

## Boundaries

Existing React APIs and controlled-state authority are preserved. Parent-driven close and unmount are authoritative; guarded close actions run the optional busy/dirty/discard policy. Backend authorization and persistence remain host-owned. TreeList pointer drag/drop and variable-height virtualization, and ListBox remote paging, are deferred in both libraries and are not counted as missing parity.

The following phase notes are chronological records. Later acceptance supersedes their historical pending work and pause instructions. The current outcome is recorded under Final integration.

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

The user requested stopping after Phase 28, then resumed on 2026-09-09 for Phase 29. [Resume notes](parity-resume.md) preserve the next steps. Full-library browser integration and final reconciliation of all three reference commits remain required after the remaining phases.

## Phase 29 acceptance matrix

Phase starting revision: `30832cd` (Phase 28). Blazor comparison remains pinned to `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`; `CgGrid.razor.cs` and `CgGridExportContracts.cs` provide the virtualization/export reference.

| Gap / reference behavior | React capability / adaptation | Evidence |
| --- | --- | --- |
| Row/column virtualization | Independent opt-in fixed windows; page ownership unchanged; numeric bounded widths; frozen and focused cells retained | Phase 29 bounded-window/far-focus unit tests; Chromium/WebKit geometry |
| Group/detail/editing fallback | Complete grouped/detail rows; inline drafts disable both windows; status/action callbacks explain fallback | Unit fallback suite; browser group/edit/cancel scenario |
| Focus, resize/reorder, RTL and frozen boundary | Scroll before focus; preserve offscreen focus; measured logical frozen offsets; inherited RTL; opaque stripe backgrounds; logical row banding | Far-cell navigation, grouped records outside flat pages, resize/reorder checks in both engines |
| Group footers | Opt-in footers using existing summary render/context-menu APIs; provider aggregateStates | Group-footer context unit regression |
| Export scopes and committed source | Full-filtered remains default; current page and selected source records independent of viewport/collapse/drafts | Unit scope, hidden-selection, draft and collapsed-summary checks |
| Limits and cancellation | Opt-in record limit; worksheet dimension cap; abortable incremental local serialization; separate export generation ownership | Local/remote limits, pre-abort, ignored host cancellation, query/replacement cancellation tests |
| Remote adapter | Existing remoteExport gains immutable selection/field/scope/limit context; limited results report rowCount; server authorization remains host-owned | Typed in-memory adapter and consumer story; independent load/export race test |
| Compatibility | No runtime dependency or runtime export added; old three-argument XLSX calls and signal-only remote callbacks remain valid; state version 11 unchanged | Existing Grid/type/public API suites and package checks |

React adaptations: local selected-record export includes selections hidden by filters, as agreed in the resume plan; Blazor describes intersecting selected keys with the authorized filtered view. Remote hosts remain responsible for their authorized scope. Limits are opt-in record limits (headers/summaries excluded), preserving existing unlimited exports; worksheet caps include all rows. Group summary rows are appended in the workbook rather than tied to the viewport. Grouped/detail fallback and disabled virtualization remain complete rendering, not a missing feature. No backend/consumer changes or package publication are included.

Phase 29 verification: all 712 Vitest tests in 73 files passed with two workers. The final nine-case Phase 29 suite also passed after adding the legacy signal-only export adapter fixture and header-focus retention. TypeScript, full ESLint, and cycle analysis (335 source modules) passed. Production and Storybook builds passed; package verification reported 203 runtime exports and 2,227 packed files.

Chromium/WebKit passed the eight Phase 29 interaction/Axe scenarios and four existing Grid editing/personalization regressions. Fourteen visual comparisons passed: eleven existing Grid baselines remained unchanged and three new light/dark/Arabic-RTL-narrow baselines were visually inspected. Firefox was attempted once for this acceptance pass and reproduced the 30-second `RenderCompositorSWGL failed mapping default framebuffer` launch timeout before page creation; no Firefox component coverage is claimed.

Work stops at this phase boundary. Phases 30–32 and final cross-phase integration/reconciliation remain pending. [Resume checkpoint](parity-resume.md).

## Phase 30 acceptance

Reference: read-only Blazor aea3e6222adce68b10ff120d7bee1e43358287d0; React starts at 9663863. The user authorized completing Phases 30–33 while preserving React defaults. Blazor's uncommitted delayed Grid download URL revocation is recorded separately for Phase 33.

Pivot adds opaque query ownership, context-safe retained results, source/contribution budgets, single-evaluation measure selectors, hidden dependent filtering, stable null placement, scoped exports, and incremental cancellable serialization while preserving the synchronous export helper. TreeList adds ownership propagation, validated pages and paths, snapshot cancellation, editor validation/save locking, virtual focus retention and diagnostics, and iterative weighted descendant summaries. Existing React defaults remain unchanged.

Verification: typecheck, full ESLint, cycle analysis (337 modules), production and Storybook builds passed. The full unit suite passed 721 tests in 74 files with two workers; the final affected Pivot/TreeList run passed 73 tests. Four Phase 30 Chromium/WebKit interaction/Axe cases passed on the rebuilt bundle. Three light/dark/RTL-narrow Chromium baselines were visually inspected and passed a separate unchanged comparison. Package verification passed with 203 runtime exports and 2,237 packed files. One Firefox attempt reproduced the existing 30-second pre-page SWGL framebuffer failure; no Firefox assertion ran.

Phases 31–33 and final cross-phase integration remain pending. No package was published and no consuming or Blazor repository was modified.

## Phase 31 acceptance

Calendar now supports controlled/uncontrolled multiple dates, stable sorted snapshots, modifier toggles, anchored keyboard/pointer ranges, restrictions and clear. The standalone DateRangePresetSelect adds ordered/localized presets, atomic ranges, boundary clamping, native forms/reset, field validation and read-only submission. DateRangePicker reuses pure calculations while retaining its list and defaults. Root exports include the new component/key and the Phase 30 TreeList ownership/virtualization types.

Verification: 17 affected unit/public API tests passed with two workers; typecheck, full lint, cycle analysis (341 modules), production and Storybook builds and package verification passed (204 runtime exports). Four Chromium/WebKit interaction/Axe scenarios passed. Three light/dark/RTL-narrow screenshots were inspected. Final integration remains pending.
Firefox was attempted once for Phase 31: the existing SWGL framebuffer failure prevented page creation after the 30-second launch timeout. No Firefox component coverage is claimed.

## Phase 32A acceptance

Recurrence is opt-in, immutable and bounded, with wall-clock DST patterns, exclusive all-day ends, ordered weekly/monthly/yearly rules, exceptions and occurrence/series operation scopes. Repeated appointments retain host IDs and carry a separate original occurrence start. The editor exposes recurrence patterns and edit scopes, and retains failed drafts. Pointer capture starts after the drag threshold so double-click editing remains available.

Verification: 23 affected unit tests passed with two workers; typecheck, full lint, cycle analysis (343 modules), production/Storybook builds and package verification passed (204 runtime exports). All 20 Scheduler Chromium/WebKit interaction/Axe scenarios passed. The combined runner stalled after the last WebKit test during teardown and was interrupted; all three inspected light/dark/RTL-narrow visual baselines subsequently passed in a separate clean run. Phases 32B, 32C, 33 and final integration remain pending.
The Phase 32A Firefox launch attempt reproduced the 30-second SWGL framebuffer failure before page creation; no Firefox component coverage is claimed.

## Phase 32B acceptance

Scheduler now supports resource/date grouping, visible-resource ownership, cross-resource drag permissions, optional location/labels/statuses/custom fields, advanced Timeline scales, timezone/workday/layout controls, specialized rendering, and cancellable form/tooltip lifecycle. Popup owns sizing/movement/focus lifecycle; persistence remains host-owned. Month retains the source date layout, filtered by visible resources.

Verification: 29 affected unit tests passed with two workers. Typecheck, full lint, cycle analysis (347 modules), production/Storybook builds and package verification passed (204 runtime exports). Six Chromium/WebKit interaction/Axe scenarios cover tooltip lifecycle, metadata save, resource filtering and pointer reassignment. Three new light/dark/RTL-narrow baselines were visually inspected. A vendor-copy collision between concurrent library/Storybook builds was resolved by building sequentially. Firefox reproduced the 30-second pre-page SWGL framebuffer failure; no Firefox component coverage is claimed. Phases 32C/33 and final integration remain pending.

## Phase 32C acceptance

Scheduler adds mounted reminder delivery with occurrence deduplication, deterministic reminder queries, typed actions for navigation/selection/persistence/forms/tooltips, restoration through host-owned updates, and iCalendar text/download. Export includes recurrence/exceptions, resources and metadata, correct escaping, UTF-8 line folding and exclusive all-day boundaries. Controlled navigation remains authoritative; provider actions operate on loaded records.

Verification: 35 affected Scheduler tests passed with two workers, including root public-type fixtures and parsed iCalendar records. Typecheck, lint, cycle analysis (349 modules), sequential production/Storybook builds and package verification passed (204 runtime exports). Four Chromium/WebKit interaction/Axe scenarios passed. Three light/dark/RTL-narrow baselines were inspected and passed an unchanged comparison. Firefox was attempted once and failed before page creation with the existing 30-second SWGL framebuffer timeout; no Firefox assertions ran. Phase 33 and final integration remain pending.

## Phase 33 acceptance

Grid adds separate JSON result/remote adapter types, UTF-8 streaming to caller-owned destinations, committed-record scopes, opt-in data-cell limits for both formats, actual XLSX column widths and delayed browser download cleanup. LookUpGrid awaits callbacks in order and reconciles authoritative values after settlement with generation guards. Existing checkbox/multiple selection behavior, filtered-out selected exports and XLSX contracts remain compatible.

Verification: 81 affected Grid/LookUpGrid tests passed with two workers, including public types, standard JSON values, circular/unsupported records, failed/aborted streams, remote ownership, actual workbook width XML and async selection races. Typecheck, full lint plus final scoped lint, cycle analysis (351 modules), sequential production/Storybook builds and package verification passed (204 runtime exports; 2,309 files). Four Chromium/WebKit interaction/Axe cases passed; three light/dark/RTL-narrow baselines were inspected and passed unchanged comparison. Final integration remains pending.

Reference reconciliation: b732d80a JSON/async lookup maps to these APIs; efd85c96 widths and checkbox-driven multiple map to width resolution and React checkbox mode; 238cbc3f disposal fixes map to existing React effect cleanup, request generations and null DOM refs, supplemented by unmounted export guards. The separately uncommitted Blazor Grid JS cleanup delays URL revocation by 60 seconds; React now mirrors it without editing the source repository.

The Phase 33 Firefox attempt reproduced the existing 30-second SWGL framebuffer timeout before page creation. No Firefox assertions ran.

## Final integration — accepted (2026-09-14)

All six requested phase commits are accepted. Final source reconciliation added Month weekday-header decoration and precise timed placement when snapping is disabled, with a regression test. Existing default Month layout remains unchanged. The new geometry assertions use numeric tolerances for browser CSS serialization.

Completed gates: 755 unit tests in 79 files passed with two workers; all 402 Chromium/WebKit semantic and accessibility scenarios passed (201 per engine). Typecheck, full lint with a final clean focused check, cycle analysis (351 source modules), production/Storybook builds and package verification passed (204 runtime exports; 2,309 packed files). The post-fix full unit run again passed all 755 tests, and 34 affected Chromium/WebKit interaction/Axe checks passed. Visual acceptance is complete with the full-sweep and focused results below. The final Firefox attempt reproduced the 30-second pre-page SWGL framebuffer launch failure; no Firefox assertion ran.

The visual integration sweep exposed a stylesheet-order dependency between Grid and Pager. Grid now scopes its existing compact footer rule so alignment and spacing remain stable across lazy chunk order. It also reproduced a Map resize defect in both engines: the marker at the controlled center drifted 139 pixels after a host resize. Leaflet size invalidation now preserves the center; the added browser assertion passes in both engines and existing Map baselines remain valid. The Accordion disclosure story now has a definite width inside its flex host. ContextMenu loading and Calendar dates use controlled clocks; DropDownBox capture waits for the selected active row. The old Pivot drill pager baseline was inspected and reconciled. The Pivot drill screenshot now targets the dialog directly to avoid full-page capture resizing the vh-sized Storybook host. Eighteen repeated Map, DropDownBox and Pivot visual comparisons passed without updates. Final post-fix gates are recorded below.

Recorded host: Windows, Node 22.20.0 and npm 10.9.3.


| Final gate | Recorded result |
| --- | --- |
| Full unit suite | 755 tests in 79 files passed with two workers, including the final source audit changes. |
| Full Chromium/WebKit semantic and Axe suite | 402 passed, 201 per engine; all 34 post-fix Grid/Accordion/Map and related interaction/Axe checks also passed. |
| Full visual sweep | All 630 cases ran, 315 per engine: 625 passed and five captures required inspected baseline updates. Four were Phase 33 footer spacing/alignment captures; one old Phase 24.1 RTL baseline incorrectly showed LTR. |
| Visual rechecks | The RTL baseline comparison passed 12 repeated checks. Phase 33's repeated comparison passed 16/18, with two Storybook navigation timeouts before capture; the subsequent serial six-case Chromium/WebKit comparison passed unchanged. All five full-sweep mismatches are resolved. Eighteen earlier Pivot/Map/DropDownBox stability checks also passed. |
| Baseline inspection | Added and inspected 323 Windows WebKit images, including full-size light/dark/RTL coverage for every new phase. Reviewed all changed Chromium captures and all corrected WebKit footer captures. Separate engine baseline directories are now part of the visual scripts. |
| Typecheck, lint, cycles | Passed, including final fixture checks; 351 source modules have no relative-import cycles. |
| Production and Storybook builds | Passed sequentially; the final package check rebuilt the current production source. |
| Package verification | Passed: 204 runtime exports and 2,309 packed files. |
| Firefox | One final attempt reproduced the 30-second RenderCompositorSWGL framebuffer launch failure before page creation. Environment-blocked; no component, Axe or visual coverage claimed. |

The accepted scope is complete. Every audited capability is implemented and verified, intentionally adapted, or deferred in both libraries in the current parity ledger. Existing React selection, numeric and export defaults remain intact. The Blazor reference and its separately recorded Grid download-cleanup working-tree change remain read-only. No runtime dependency, consuming-application/backend change, package publication or remote push was made.

## Phase 34.1 — ribbon, pickers, gallery and icons (2026-11-04)

Added `CgRibbon`, `CgColorPicker`, `CgGallery`, `CgBorderPicker` and 114 spreadsheet and formatting icons for `CgIcon`, requested by the CashGear Sheet application. All are generic controlled components with no spreadsheet logic and no Razor source. Ribbon key tips were deliberately left out. The icons are checked-in Fluent System Icons 1.1.345 (MIT), measured at 13.4 KB gzip and 47 KB raw; no production dependency was added.

Shared additions: `CgFlyout` leaves focus where a click outside put it and honours `data-cg-initial-focus`; an overlay limit of `none` stays inside the viewport; `CgToolbar` gains `layout`, `columnRows` and the item options `iconOnly`, `beginRow`, `stacked`, `renderFlyout`, `menuAriaLabel`, `toggleAriaLabel` and `ownsKeyboard`; `CgTabs` gains `startContent` and `endContent`; `CgComboBox` `fullWidth` drops its 12rem minimum.

When this phase was recorded, `npm run verify` did not pass end to end on this host: the visual gate failed on existing baselines for an environment reason described below, and Firefox could not launch. Every other gate passed. The baselines were re-rendered afterwards. See [Baseline re-render](#baseline-re-render-acceptance).

Recorded host: Windows, without the Inter font installed.

| Gate | Recorded result |
| --- | --- |
| Full unit suite | 900 tests in 87 files passed with two workers. |
| Typecheck, lint, cycles | Passed; 374 source modules have no relative-import cycles. |
| Production and Storybook builds | Passed sequentially. |
| Chromium semantic and Axe suite | 303 of 303 passed. |
| WebKit semantic and Axe suite | 302 of 303 passed. Phase 29 grouping and editing timed out once clicking Cancel edit, then passed three of three reruns. |
| New visual cases | 54 cases, 27 per engine, passed against baselines generated and inspected on this host. |
| Visual cases against committed baselines | **Failed.** 304 of 352 Chromium and 303 of 352 WebKit captures differ. |
| Existing visual cases against the pre-task code | 650 of 650 passed: 325 per engine, comparing the final build with images rendered from `d9296d5` on this host. |
| Package verification | Passed: 210 runtime exports and 2,422 packed files. |
| Firefox | One attempt failed before page creation with `browserType.launch: spawn UNKNOWN`. Environment-blocked; no component, Axe or visual coverage claimed. |

The semantic suites and the comparison against committed baselines ran at `44ac3f2`. The only source change after that restores a Storybook note on two Icon stories, and the fast gates and the 650-case comparison were rerun with it in place.

The committed baselines fail because `--cg-font-family` starts with Inter, which the library does not bundle. An inspected Phase 26 capture shows Inter in the baseline and Segoe UI on this host, with only text and text-sized boxes differing, and the code from before this phase fails that capture by the same 2,308 pixels. Only that one capture was inspected this way, so the font is the likely cause for the rest rather than a proven one. What the 650-case comparison does prove is that this phase changed no existing capture on this host. No existing baseline was updated.

That left the baselines mixed. The 646 images from before November were rendered with Inter, while the 20 Phase 34 and 54 Phase 34.1 images were rendered without it, so no single host could pass all of them. An earlier version of this record said 630 images, which is the number of older test cases.

The first gate run also found that `verify:package` failed before any of this work: `core.autocrlf=true` rewrote vendored text files, breaking their integrity hashes. `.gitattributes` now keeps `src/vendor/**` byte-exact, and three Leaflet files were restored from `leaflet-1.9.4.tgz`.

This phase shipped with a known limitation in `useDirection`, since fixed. See [Direction inheritance](#direction-inheritance-acceptance).

## Direction inheritance acceptance

`useDirection` looked up `dir` starting from the element itself, so a control that wrote its own `dir` read that value back and stayed LTR inside an RTL parent. It now resolves `auto` from the element's parent, and an explicit `direction` still wins. Hosts no longer need to pass `direction` in RTL.

Starting from the parent was not enough on its own, so these controls changed too:

- `CgComboBox`, `CgDateEdit`, `CgDateRangePicker`, `CgDropDownBox`, `CgListBox`, `CgLookUpGrid`, `CgMaskedInput`, `CgTagBox` and `CgTimeEdit` passed a ref to an inner element, so their own root's `dir` was still the nearest. They now pass their root.
- `CgGrid` passed its parent, its own workaround for this bug, which would now have skipped that parent's `dir`. It now passes its root.
- `CgContextMenu` is portaled to the body and keeps its anchor's direction in its own `dir`, so it now resolves from inside that surface.
- `CgRadioGroup` has no `dir` of its own to write, so a native `dir` passed to it is now read directly.
- `CgFormLayoutGroup` outside a form layout wrote `dir="auto"`, which reads as LTR to the controls inside it. It now leaves `dir` unset.

The hook now uses a layout effect, so a control that writes `dir` doesn't paint LTR before it settles. The same bug also affected `CgMenu`, `CgTreeList`, `CgPdfViewer`, `CgScheduler` and `CgDateRangePresetSelect`, which the fix covers. `CgRibbon` and `CgToolbar` still pass their direction down, because their children then get it in the same render instead of a moment later. `CgPivotTable` is unchanged: without `direction`, it takes its direction from `locale`.

| Gate | Recorded result |
| --- | --- |
| Full unit suite | 963 tests in 88 files passed with two workers. |
| Typecheck, lint, cycles | Passed; 374 source modules have no relative-import cycles. |
| Chromium semantic and Axe suite | 312 of 312 passed. |
| WebKit semantic and Axe suite | 306 of 312 passed on the full run, while another session rendered on the same machine. Five failures were 30-second timeouts and one was a LookUpGrid click that landed on the wrong row in an LTR story, a race in that test. All six then passed three of three reruns, the LookUpGrid one with a wait for the filter that was added to the test separately. |
| Inherited against explicit RTL | 27 story sections per engine were pixel-identical between `direction` omitted and `direction="rtl"`. |
| Visual cases against the pre-fix code | 704 cases, 352 per engine, compared with images rendered from `7e43699` on this host: 694 passed and 10 exceeded the tolerance. |
| Exact pixel comparison | 12 images changed, six captures per engine, all RTL and all inspected. Two LTR toast images also differed by about 40 pixels, but the same build alternates between both versions across runs, so that is rendering noise. |
| Production build and package verification | Not rerun. The fix adds no public export. |
| Firefox | Not attempted. It could not launch on this host in the previous phase, so no Firefox coverage is claimed. |

These captures changed, and each now shows the control mirrored:

| Capture | What changed |
| --- | --- |
| `combo-box-arabic-rtl` | Placeholder and chevron swap sides. This stays within the 0.1% visual tolerance, so only the exact comparison shows it. |
| `drop-down-box-arabic-rtl` | The list inside the popup aligns right. |
| `phase-14-lookupgrid-rtl` | Columns reverse and the popup aligns to the control's right edge. |
| `phase-23-editor-rtl-narrow` | The editor's tabs and toolbar mirror. |
| `phase-28-selection-rtl` | The TagBox and ListBox mirror. |
| `phase-30-analysis-rtl` | The tree list header mirrors. |

This work did not update their baselines; the [baseline re-render](#baseline-re-render-acceptance) below did. Most other RTL stories pass `direction` explicitly, so they did not change. `src/stories/Direction.stories.tsx` renders all 26 controls without `direction`, and `tests/browser/direction.browser.spec.ts` covers them in both engines.

## Baseline re-render acceptance

The older visual baselines were re-rendered with the maintainer's approval, on a Windows host without Inter, so the visual gate can pass there. The committed images now match a host without Inter, so expect a host with Inter to fail most of them.

This rewrote 623 of the 720 images: 312 Chromium and 311 WebKit. The other 97 were kept: all 74 from Phases 34 and 34.1, and 23 older images that still pass as they were.

- **611 images** came from `7e43699`. The 650-case comparison above shows that build renders the same as the code from before Phase 34.1, so these record the same code in a different font, not new behaviour.
- **12 images** are the six captures per engine that the direction fix changed, rendered from `0bc9722` with every one rewritten, because `combo-box-arabic-rtl` stays inside the visual tolerance and would otherwise have kept its old image.

Six of the largest changes were inspected side by side, and they show only Segoe UI replacing Inter and the text wrapping that follows. The six direction captures were inspected in one engine each, and each shows the control mirrored. The other images were not opened individually. Among images that kept their size, the median change is 1.56% of pixels and the largest is 12.47%; 28 images changed size.

The gates ran on `0bc9722` plus these baselines, in a clean export under the ignored `playwright-report` folder on port 6016, because another session was editing the shared checkout. Apart from that port and line endings, the export's `src`, `tests`, `.storybook`, `scripts` and configuration match the commit. Only images and documentation follow it.

| Gate | Recorded result |
| --- | --- |
| Full unit suite | 963 tests in 88 files passed with two workers. |
| Typecheck, lint, cycles | Passed; 374 source modules have no relative-import cycles. |
| Production and Storybook builds | Passed sequentially. |
| Chromium semantic and Axe suite | 312 of 312 passed. |
| WebKit semantic and Axe suite | 312 of 312 passed. |
| Visual cases against committed baselines | 704 of 704 passed, 352 per engine, on a fresh Storybook build. |
| Package verification | Passed: 210 runtime exports and 2,422 packed files. |
| Firefox | One attempt failed before page creation with `browserType.launch: spawn UNKNOWN`. Environment-blocked; no component, Axe or visual coverage claimed. |

`npm run verify` as a single command still stops on this host, because its browser step includes Firefox. Every other gate above was run separately, in the same order.

An earlier run of these gates on `7e43699` found a race in the Phase 14 LookUpGrid browser test. `ITM-0002` is also in the unfiltered list, so the test could click before the 300 ms debounced filter moved the rows. The unchanged test failed 5 of 8 WebKit runs on `d9296d5` and 5 of 8 on `7e43699`: eight of those failures landed on `ITM-0022`, one left the typed text in the field, and one was a page timeout. It now waits for the filter, and passed 12 of 12 runs before the full suite above.

## Chart document layout (2026-11-06)

`CgChart` gains a document layout for spreadsheet charts (CashGear Sheet). The host works out every scale, colour and font, and the chart draws exactly what it is given. Every new prop is optional, and charts that don't use them draw as before.

- `appearance` draws the title, legend and axis titles inside the SVG at the exact pixel size, with chart and plot area fill and border, a manual plot rectangle and per-element fonts. Unset colours come from the theme tokens.
- `scatter` series, `lineStyle: 'smooth'` (Catmull-Rom), per-axis `barGapWidth` and `barOverlap`, explicit ticks, reversed axes, minor ticks and gridlines, tick-mark styles, crossings, category placement and label and tick intervals.
- Separate fill and outline colours, slice explosion, spreadsheet point-label positions and composed label content.
- `interactive={false}`, `onElementPointerDown` and `highlightedElement` for editors.
- Intl number formatters are now reused across points: 20 series of 5,000 points model in about 1 s instead of 13 s.

Stories are under `Phase 35/Chart document`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint, cycles | Passed; 379 source modules have no relative-import cycles. |
| Full unit suite | 984 tests in 89 files passed with two workers. |
| Production and Storybook builds | Passed sequentially. |
| Chromium semantic and Axe suite | 330 of 330 passed, including 18 new chart cases. |
| Chromium visual suite | 366 of 366 passed against committed baselines, including 14 new `phase-35-chart-*` images. All 14 existing `phase-20-chart-*` images match unchanged. |
| WebKit | The 18 new semantic cases, the three Phase 20 chart cases, the 14 `phase-20-chart-*` visual cases and the 14 new visual cases passed. The rest of the WebKit suite was not rerun. |
| Firefox | Not attempted; it cannot launch on this host. |

Only the 28 new `phase-35-chart-*` images (14 per engine) were added; no existing baseline changed. WebKit has no `OffscreenCanvas` here, so text widths there come from the estimate and spacing differs slightly from Chromium.

## Pivot field list (2026-11-07)

Added `CgPivotFieldList`, the spreadsheet PivotTable Fields pane, for CashGear Sheet, and the runtime export `CG_PIVOT_FIELD_LIST_VALUES_KEY`. It is a new controlled component with no Razor source and no new dependency. `CgPivotTable` keeps its own popup field list; switching it to the new pane was left out to avoid changing its behaviour and baselines.

Stories are under `Phase 36/PivotFieldList`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint, cycles | Passed; 383 source modules have no relative-import cycles. |
| Full unit suite | 1,013 tests in 91 files passed with two workers. With default parallelism, the first run timed out once in a long new menu test and once in the existing rich-text editor test; the new pane's longer tests now allow 20 s. |
| Production and Storybook builds | Passed. |
| New semantic and Axe cases | 14 of 14 passed in Chromium and in WebKit. |
| New visual cases | 16 cases, 8 per engine, against baselines generated and inspected on this host. |
| Package verification | Passed: 212 runtime exports and 2,465 packed files. |
| Existing browser suites | Not rerun. The change adds files and exports and touches no existing component. |
| Firefox | Not attempted; it cannot launch on this host. |

## Ribbon key tips (2026-11-09)

Added Office's key tips to `CgRibbon` for CashGear Sheet, left out of Phase 34.1: `keyTips`, `reservedAltKeys` and `onKeyTipsChange` on the ribbon, `keyTip` on tabs and items, `keyTip` and `launcherKeyTip` on groups, and `showKeyTips()` and `hideKeyTips()` on its actions. They are off unless asked for, so existing ribbons behave as before. No new dependency.

| Gate | Recorded result |
| --- | --- |
| Ribbon unit suite | 41 tests passed, 6 of them new: tip assignment, a tap of Alt through a tab to a command, two-letter tips, Esc and a click, Alt chords and reserved letters, a rendered input taking focus, and nothing without the prop. |
| Toolbar | A rendered item is now marked `data-cg-toolbar-item` with its name, even when it keeps its own keyboard, so a key tip can find it. Toolbar suites pass. |
| Full unit suite | 1,019 tests in 91 files passed with two workers. |

## Phase 37: document workspace components and fixes (2026-11-16)

Built for CashGear Workspace's Track U on `claude/cashgear-react-ui-library-xq8tsz`, in pushed commits `699b136` (U13, U7, U8, U16, U5, U12), `0ab6883` (the eleven defects), `e20f701` (U1, U2, U10, U11, U9, U17, U6, U3), `bffe090` (docs), `fca2da4` (follow-up fixes), `25c861b` (U14, U15) and `cc62c8b` (U4). Every new component takes its visible and accessible strings from props; stories are under `Phase 37` in Arabic and right to left, plus dark and left-to-right ones. The defect fixes change no prop's meaning.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint, cycles | Passed; 447 source modules have no relative-import cycles. |
| Full unit suite | 1,213 tests in 109 files with two workers. One existing PDF viewer test (external links) timed out once under load and passed alone three times out of three; with default parallelism the existing rich-text editor test can time out the same way and passes alone. |
| Production and Storybook builds | Passed. |
| Package verification | Passed: 241 runtime exports and 2,770 packed files. |
| New semantic and Axe cases | 104 per engine (Axe on every Phase 37 story, plus keyboard, pointer and RTL behaviour), all passed in Chromium and in WebKit. |
| Existing semantic and Axe suites | Chromium 448 of 448 passed. WebKit: 446 of 448 passed; the two failures were load timing (the Phase 13 Grid test's navigation timeout, and preload warnings on the narrow Arabic ribbon story), and both passed when rerun alone. |
| Visual | 16 existing cases per engine changed with the fixes and were reviewed and re-recorded: dark menus, toolbars, accordion, PDF viewer and analysis views now follow the dark tokens, and the charts' data toggle is 24 px high. 29 new Phase 37 cases per engine, recorded and inspected on this host. Final full runs after every change below: Chromium 402 of 403 before re-recording the narrow PDF viewer, WebKit 403 of 403. |
| Firefox | Not attempted; it cannot launch on this host. |

The defect fixes: `CgSplitter` content fills its pane and scrolls under a fixed header, and `separatorAriaLabel` names separators; dark-theme solid buttons draw dark text (6.3:1 or more) and soft buttons read at 4.5:1 or more; the `--cg-color-*` names menus and toolbars read are set on every themed element; `CgDrawer` sizes take CSS math functions; a reorderable `CgTabs` selects on click and drops right-to-left drags where the pointer is; `CgFlyout` keeps an explicit width, focuses from `onAfterOpen` once drawn (and gains `autoFocus`), and watches its anchor only while open; `CgChart`'s data toggle is 24 px high. Found and fixed on the way: right-to-left `CgTreeView` chevrons pointed the wrong way, hovering a nested tree row lit its ancestors, and `focusFirst()` before placement scrolled the page.

### Follow-ups from Workspace's swaps (2026-11-16)

Pushed in `ab467b7` and `f66cb07`: `CgSelect`; `CgFilePicker` `directory`; `CgOptionPicker` `normalize` and `filter`; `CgCommandMenu` `handledKeys` and a 6.2:1 active option; `CgMentionArea` empty lines; `CgToolbarItem` `expanded` and `controls`; no empty label box in icon-only buttons (the narrow PDF viewer baseline changes in both engines); a docked selection toolbar that scrolls with 44 px tools; right-to-left indent icons; `CgTreeView` names, `collapsible`, `current`, modifier chords and selected-text contrast; `CgMonthCalendar` handle and selected day; `CgKanbanBoard` column moves, footers, paging, drafts and titles.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint, cycles | Passed; 451 source modules have no relative-import cycles. |
| Unit suite | 1,220 tests in 109 files with two workers before the kanban additions; the kanban suite then 39 of 39 and the public API test passed. |
| New semantic and Axe cases | Follow-ups 10, sidebar and calendar 8, kanban columns 5, per engine: all passed in Chromium and WebKit, as did the earlier kanban, tree and calendar specs rerun with them. |
| Package verification | Passed: 244 runtime exports and 2,789 packed files. |


## Blazor-only features (2026-11-18)

A research pass on 2026-11-18 compared Blazor `CashGear.Blazor.UI` (assistoWebApp, after `7db46710`) with this library and found 25 features Blazor gained after the `aea3e622` pin, or that were never ported. No component was missing. Each phase below ports one group in React idioms and is one commit on `claude/cashgear-react-ui-library-xq8tsz`.

### R0: built-in text provider

Blazor `Foundation/Localization/ICgUiText.cs` and `CgUiLabels.cs`. Added `CgUiTextProvider` (`translate(english) => string`) and `useCgUiText()`; without a provider text is unchanged. Every component with built-in English now sends its defaults through it: the label objects of Accordion, BorderPicker, Calendar, Chart, ColorPicker, DateEdit, DateRangePicker, FileUploader, FilterBuilder, Grid (and its table style picker), LookUpGrid, Map, Pager, PdfViewer, PivotFieldList, PivotTable, Ribbon, RichTextEditor, Scheduler, Stepper, Tabs, TimeEdit, TreeList and TreeView, the single-string defaults of 27 more (Popup and Window close buttons, ListBox, TagBox, DropDownBox, SearchBox, TextBox, Toolbar, Toast and others), Confirmation and MessageBox defaults, and Grid's editor validation messages. Labels passed as props are never translated, even when they equal the English text. Locale-driven Arabic label sets are used unchanged. ComboBox is left out until R8 because its files carry another session's uncommitted work; Phase 37 components keep their required labels.

Hard-coded English became label props with the old text as default: Grid's context menu, `createPopupTitle`/`editPopupTitle`, the column chooser, filter row, legacy pager summary (`pageStatus`), `groupPanelAriaLabel` and the whole view manager; Grid `editPopupWidth`/`editPopupMaxHeight`; FilterBuilder's row editor names and placeholder options; TreeList `retryConflict`/`printTitle`; Toast provider `regionAriaLabel`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint | Passed. |
| Full unit suite | 1,293 of 1,294 passed with two workers; the one failure was the public API list, edited while the run was in progress, and passed on rerun with the new `tests/ui-text.test.tsx` (10 cases) and the Grid suite. |

### R1: small additions

- Grid (`CgGrid.razor.cs`): `rowClassName(item)` (Blazor `RowCssClassSelector`, rows marked `data-cg-grid-row-custom`); `editing.commitOnFocusOut` (Blazor `CommitOnFocusOut`): a Cell or Batch editor commits when focus leaves its cell, deferred one task so Enter's commit gate and Tab's next editor win; column move and resize announcements in a polite live region (`columnMovedAnnouncement`, `columnResizedAnnouncement`, plus `resizeColumnAriaLabel`).
- TreeList: `indentSize` (CSS length, default stays `1.1rem`, Blazor's default is `1.25rem`) and a `toolbar` slot (Blazor `ToolbarTemplate`).
- LoadingPanel: `textAlignment` (`top`, `inlineEnd`, `bottom`, `inlineStart`), `indicatorAreaVisible={false}` for a frameless indicator, `size`, and a positive `zIndex` for overlay and portal panels.
- TagBox `hideSelectedItems`, local and loaded.
- DateRangePicker `allowTextInput={false}` (read-only text, typing and Enter commit ignored, keyboard opening kept) and `placement`.
- RadioGroup `itemLabelPosition`, `itemAlignment` (`start`, `center`, `end`, `stretch`) and `itemLabelWrap`.
- Editor button descriptors (`CgEditorButton.razor`): `href`/`target` links (a disabled link drops `href`; unsafe schemes are refused; `_blank` gets `rel="noopener noreferrer"`), `focusable: false`, `type: 'submit' | 'reset'`, `className`. `CgEditorButtonContext.event` widens to `MouseEvent<HTMLButtonElement | HTMLAnchorElement>`.
- PivotTable: with no column fields the data column header shows only the measure caption (Blazor `e4878750`). Existing Pivot stories without column fields lose their "Grand Total" header line.

Stories are under `Blazor parity 2026-11/Small additions`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint | Passed. |
| Full unit suite | 1,316 tests in 114 files passed with two workers, including 12 new cases in `tests/blazor-parity-r1.test.tsx`. |

### R2: button menus

Blazor `CgButtonMenuBase.cs`, `CgDropDownButton.razor`, `CgSplitButton.razor`, `CgButton.razor.cs`, `CgButtonMenus.md` (commit `b76e6487`). `CgDropDownButton` draws a decorative `▾` indicator by default (`dropDownIndicatorVisible`); `toggleIcon` replaces it or a split button's chevron; `menuClassName` applies to every menu level; `CgButton` gains `trailingContent`. The trigger (or split toggle) opens on the first item with ArrowDown and on the last with ArrowUp; Alt+ArrowUp inside the menu closes every level and returns focus to the trigger; an open menu that loses its commands or becomes disabled closes and reports `onOpenChange(false)` once. As in Blazor, the toolbar overflow, breadcrumb overflow and pivot field list tool buttons turn the indicator off; toolbar menu items, BorderPicker line colour and Gallery triggers show it.

Stories are under `Blazor parity 2026-11/Button menus`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint | Passed. |
| Full unit suite | 1,333 tests in 116 files passed with two workers (R3's Calendar work was in the tree too), including `tests/blazor-parity-r2.test.tsx` (6 cases). |
| Storybook build | Passed. |
| Visual, Chromium | Full suite: 396 of 403 passed; the 7 failures were five Ribbon cases, where the new indicator doubled the Ribbon's own arrow (fixed: `CgToolbar` gains `dropDownIndicatorVisible`, which the Ribbon turns off), and two Pivot cases changed by R1's header (`phase-30-analysis-rtl`, `pivot-empty`). After the fix the Ribbon, calendar and date cases passed (28 of 28). |
| Visual baselines | The indicator stays under the 0.1% pixel tolerance, so the 21 cases showing drop-down or split triggers (Phase 10 drop-down, split and toolbar, Phase 25 PDF viewer toolbar, Phase 34.1 BorderPicker and Gallery) plus the two Pivot cases were re-recorded with `--update-snapshots=all` in Chromium and WebKit and inspected: 23 files per engine. |
| WebKit | The same 28 checks and 31 re-recorded cases passed. |
| Chromium semantic and Axe | 148 of 148 passed for the menu, toolbar, ribbon, button, calendar and date specs. |
| Firefox | Not attempted; it cannot launch on this host. |

### R3: Calendar

Blazor `CgCalendar.razor.cs`, `CgCalendarTypes.cs`, `CgCalendarCore.cs`. Added to `CgCalendar`: `selectionView` (Blazor `ViewMode`: starting and finest view and the selection unit, with unit-counted range limits and Ctrl+ArrowUp/Down view switching); `showWeekNumbers` and `weekNumberRule`, numbered like .NET `Calendar.GetWeekOfYear` (so a late-December row of a `firstFourDayWeek` January can read 53, as in Blazor) with the default rule from `Intl.Locale` week info; `loading` and `renderLoading`; `onVisibleRangeChange` with start, end, visible date, view, month count and version; `renderHeader`, `renderFooter`, `renderMonth`, `renderYear`, `renderWeekday`; `autoCollapseMonths` (Blazor's 47.999rem media query, read through `useSyncExternalStore`); `showOutsideMonthDates`, `allowOutsideMonthSelection`, `fixedSixWeekLayout`. New labels `loading` and `weekNumber`. With `autoCollapseMonths={false}` the existing narrow-container CSS no longer hides the second month. The root keeps `data-calendar-count` for its width and adds `data-month-count`, so collapsed DateRangePicker popups keep their width.

Stories are under `Blazor parity 2026-11/Calendar`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint | Passed. |
| Full unit suite | 1,333 tests in 116 files passed with two workers, including `tests/blazor-parity-r3.test.tsx` (11 cases: .NET week numbers, layout options, loading, templates, visible range, month and year selection, Ctrl+Arrow views, auto-collapse). |
| Visual | Calendar, DateEdit, DateRangePicker, TimeEdit, month calendar and Ribbon cases: 28 of 28 in Chromium and in WebKit against the existing baselines, so the defaults draw as before. |
| Semantic and Axe | Included in the 148 Chromium calendar, date, menu and button cases above. |

### R4: TreeList column UI and named views

Blazor `CgTreeList.razor` layout tools, `CgTreeList.Views.cs`, `CgTreeListViewStore.cs`. `CgTreeList` gains `showColumnManager` (per column: visibility, move before or after, width, fixed region, and Reset) and named views through `namedViewStore`, `namedViewKey` and `allowSharedViews`, shown by Grid's view manager, now the generic `CgViewManager<TState>` in `Grid/viewManager.tsx` (Grid passes its schema signature and `savedViewState`). Grid's browser store became a generic `BrowserViewStore<TState>` with unchanged Grid keys and messages; `CgTreeListBrowserViewStore` uses it with the `cg.treelist.views:` prefix and writes sets and maps as arrays. `CgGridViewStore`, `CgGridStoredView` and `CgGridViewSaveRequest` take an optional state type parameter defaulting to Grid state, so existing stores compile unchanged. New runtime export `CgTreeListBrowserViewStore`; new type `CgTreeListNamedViewStore`. The view and column texts are TreeList `labels` with Blazor's English defaults.

Stories are under `Blazor parity 2026-11/TreeList layout and views`.

| Gate | Recorded result |
| --- | --- |
| Typecheck, lint | Passed. |
| Full unit suite | 1,337 tests in 117 files passed with two workers, including `tests/blazor-parity-r4.test.tsx` (4 cases) and the unchanged Grid view and TreeList suites. |
| Browser | Not run separately for this phase: no existing story changes; the new story is covered by the Storybook build in R5. |
