# Parity implementation acceptance record

React starting revision: `7791c80d652cdb0c26a57ac6c9846fadcf380842`.
Read-only Blazor reference: `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`.

This record tracks implementation separately from acceptance. An implemented API is not considered verified until its tests and integration gates are recorded.

| Phase | Capability | Implementation | Acceptance |
| --- | --- | --- | --- |
| 26 | Commit scopes, editor flush/reset, protected dialogs, overlay hardening | Implemented | Focused and integration checks passed; see below |
| 27 | Numeric policies, exact decimal editor | Pending | Pending |
| 28 | ListBox transactions, TagBox context, key adapter | Pending | Pending |
| 29 | Grid virtualization, export scopes | Pending | Pending |
| 30 | PivotTable and TreeList hardening | Pending | Pending |
| 31 | Calendar multiple selection, preset selector | Pending | Pending |
| 32 | Scheduler recurrence, resources, reminders, templates, iCalendar | Pending | Pending |

## Recent reference commits

| Commit | Areas to reconcile | Status |
| --- | --- | --- |
| `fb523d4c` | TreeList, TagBox, PivotTable | Pending |
| `130d8628` | SpinEdit and editor commit integration | Pending |
| `fbf3fcb9` | Overlays, ListBox, TextBox and related integration | In progress |

## Boundaries

Existing React APIs and controlled-state authority are preserved. Parent-driven close and unmount are authoritative; guarded close actions run the optional busy/dirty/discard policy. Backend authorization and persistence remain host-owned. TreeList pointer drag/drop and variable-height virtualization, and ListBox remote paging, are deferred in both libraries and are not counted as missing parity.

## Phase 26 acceptance

TypeScript, scoped ESLint, cycle analysis (325 modules), library and Storybook builds passed. The full unit run passed 688 tests in 70 files; the additional controlled asynchronous echo regression passed in the final six-case commit suite. Chromium and WebKit transaction interaction/Axe scenarios passed. Three new light/dark/RTL-narrow baselines were generated and visually inspected. Package verification passed with 201 runtime exports and 2,178 packed files. Firefox reproduced the existing 30-second framebuffer launch failure before page creation; no component assertion ran.

Existing tooltip Escape handling, visible-only popup/window subscriptions, and flyout internal-scroll exemption were verified in source. This phase adds coalesced surface gestures/position updates, hidden-ancestor focus filtering, and stops outside-dismissal cascades when a new owned confirmation appears. Final cross-phase browser regression remains required.
