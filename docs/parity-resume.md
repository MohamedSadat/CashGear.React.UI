# Resume CashGear parity after Phase 28

The user requested stopping after Phase 28 on 2026-09-08. Do not start Phase 29 until they resume the work. No scheduled continuation was created.

React starting revision: `7791c80d652cdb0c26a57ac6c9846fadcf380842`.
Read-only Blazor reference: `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`, repository `D:/LiveProjects/CGWebApp`.
Phase 26 commit: `699e59d`. Phase 27 commit: `e47c890`. The Phase 28 commit contains this document; use Git history for its full revision.

Current implementation and verification are tracked in [the acceptance record](parity-implementation-status.md). Component contracts are documented under EditorCommit, DecimalEdit, and KeyTagBox. Keep existing React defaults, controlled ownership, saved-state compatibility, host-owned persistence and authorization. Blazor/backend repositories remain read-only. Do not publish or modify consuming applications.

## Next: Phase 29

Implement opt-in fixed-row and column virtualization, status/fallback diagnostics, and Grid export scopes/limits/cancellation using the existing remoteExport callback. Inspect `src/components/Grid/CgGrid.tsx`, `CgGrid.types.ts`, `columns.ts`, `exportXlsx.ts`, `provider.ts`, and `summaries.ts` first.

Read-only reconnaissance found:

- Grid currently renders all page rows and all visible columns. Preserve pager ownership and use full rendered rows for grouped/detail layouts. Ensure focus actions mount and scroll targets and retain active editing across windows.
- Frozen CSS uses `--cg-grid-frozen-offset`, but the Grid currently does not assign it. Multiple frozen columns need verified offsets across headers, filters, body, and totals.
- Local export already reads `local.filteredSortedItems`, independent of the viewport. Keep this default. Add currentPage and selectedRecords, including hidden local selections; keep committed records separate from edit drafts.
- Remote export currently borrows the data request coordinator, which can cancel ordinary loading. Give exports their own cancellation ownership while extending the same callback with scope, selection, allowed field IDs, and limits.
- Group summaries currently appear in local group headers; group footer rendering requires completion. Existing XLSX helper exports header plus flat data; scope-aware totals/summaries require explicit handling.

No Phase 29 source changes were made.

## Remaining phases

30: Pivot query ownership, budgets, dependent filters/distinct pagination, scoped incremental exports; TreeList provider ownership, commit validation, virtual diagnostics, and postorder weighted summaries.

31: Calendar multiple selection and standalone date-range preset selector with shared date calculations.

32: Advanced Scheduler recurrence, exceptions, resources, mounted reminders, timeline scales, render contexts, actions, and iCalendar. Reference recurrence expansion has a 500,000-candidate bound. Preserve wall-clock DST recurrence and exclusive all-day ends.

Reconcile every applicable change from Blazor `fb523d4c`, `130d8628`, and `fbf3fcb9` in the matrix before final completion. Backend code, legacy Razor wrappers, and features deferred in both libraries remain outside scope.

## Verification notes

Each phase needs unit and public-type coverage, Storybook, Chromium/WebKit interactions/Axe, inspected new visual baselines, and a separate commit. Run full integration after all phases. The host has a known Firefox framebuffer launch failure; attempt once per acceptance pass and record it without claiming Firefox coverage.

Playwright uses the static Storybook build and one shared port 6006; do not run separate browser invocations concurrently. Root runtime export additions must update both `tests/public-api.test.ts` and `scripts/verify-package.mjs`. Node is at `C:/Program Files/nodejs/node.exe`; Python was unavailable. Use reduced Vitest workers if concurrent heavy builds cause existing five-second tests to time out.
