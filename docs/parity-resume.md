# CashGear parity completion checkpoint

The approved Phases 30–33 scope and final integration audit are complete. No in-scope implementation work remains. The phase commits below are followed by the final integration/acceptance commit.

| Phase | Commit | Scope |
| --- | --- | --- |
| 30 | d9050f9 | Pivot/TreeList reliability |
| 31 | 01d2de2 | Calendar multiple dates and preset selector |
| 32A | 578f394 | Scheduler recurrence/occurrence editing |
| 32B | ff6ea94 | Scheduler resources/customization |
| 32C | 2d37b29 | Scheduler reminders/actions/iCalendar |
| 33 | ce81ea4 | Grid JSON/streams/widths and async LookUpGrid |

React started at 9663863. Blazor is read-only at aea3e6222adce68b10ff120d7bee1e43358287d0 in D:/LiveProjects/CGWebApp. Its one pre-existing uncommitted UI change is Grid/CgGrid.razor.js delayed download cleanup; React mirrors the 60-second delay separately. No consumer/backend edits, package publishing or runtime dependencies are authorized by this scope.

Preserve existing React selection modes, numeric semantics, controlled authority and export defaults. TreeList pointer drag/drop, variable-height virtualization and ListBox remote paging remain deferred in both libraries.

Final acceptance: 755 unit tests with two workers; 402 full-suite Chromium/WebKit semantic/Axe cases plus 34 post-fix checks; all 630 visual scenarios covered by the full sweep and reviewed, passing baseline rechecks; type/lint/cycles, both builds and package verification passed (204 runtime exports, 2,309 files). See [acceptance](parity-implementation-status.md) for the five baseline reconciliations and transient navigation failures, and the [ledger](cgcomplib-react-parity.md) for capability classifications.

Firefox remains environment-blocked: the final attempt reproduced the known pre-page SWGL framebuffer launch timeout. No Firefox coverage is claimed. Any future Blazor revision requires a new scoped audit; do not restart the completed phase work.

Build library, Storybook and package checks sequentially to avoid vendor-copy contention. Playwright uses shared port 6006, so browser invocations must be sequential. Node is C:/Program Files/nodejs/node.exe. The ignored playwright-report directory holds current pass logs. No recurring continuation is configured.

Phase 34.1 (2026-11-04) added CgRibbon, CgColorPicker, CgGallery, CgBorderPicker and the spreadsheet icon set: 900 unit tests, 303 Chromium and 302 of 303 WebKit semantic/Axe cases with one transient timeout that passed on rerun, and package verification (210 runtime exports, 2,422 files). `npm run verify` does not pass end to end. Visual baselines depend on the Inter font, which is not bundled: the 630 older images were rendered with it and the 74 Phase 34 and 34.1 images without it, so no single host passes them all until one set is re-rendered. All 650 existing captures match the pre-task code on a host without Inter. Firefox fails to launch with `spawn UNKNOWN`; no Firefox coverage is claimed. See [acceptance](parity-implementation-status.md).

Do not keep a project export under `.claude/` while running lint: `eslint .` scans it.
