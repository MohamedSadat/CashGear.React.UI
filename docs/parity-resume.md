# Resume CashGear parity after Phase 29

The user resumed on 2026-09-09. Phase 29 is complete and work is paused at the requested phase boundary. Start Phase 30 only when the user resumes. No scheduled continuation was created.

React starting revision: `7791c80d652cdb0c26a57ac6c9846fadcf380842`.
Read-only Blazor reference: `79cf0c2bfb0b885641c842a03d88392bdbf2c2c4`, repository `D:/LiveProjects/CGWebApp`.
Phase 26 commit: `699e59d`. Phase 27 commit: `e47c890`. Phase 28 commit: `30832cd`. The Phase 29 commit contains this updated checkpoint.

Current implementation and verification are tracked in [the acceptance record](parity-implementation-status.md). Component contracts are documented under EditorCommit, DecimalEdit, and KeyTagBox. Keep existing React defaults, controlled ownership, saved-state compatibility, host-owned persistence and authorization. Blazor/backend repositories remain read-only. Do not publish or modify consuming applications.

## Next: Phase 30

Start with PivotTable and TreeList hardening. Inspect component/provider/export types and current tests before editing. Both already have commit integration from Phase 26 and exact decimal metadata from Phase 27.

- Pivot: propagate dataVersion/queryContext to views, distinct values, drill-down and exports; invalidate pending/retained work on ownership changes. Add opt-in source/contribution budgets, evaluate measure selectors once, complete hidden/dependent filters and distinct pagination, null/timezone validation, and scoped incremental exports.
- TreeList: forward version/context consistently; tighten root/child/detail/path ownership, overlapping page and total/key checks; finish validation/persistence locking, virtualization diagnostics/focus, and postorder weighted/partial descendant summaries.
- Reconcile Phase 30 against Blazor fb523d4c and the accepted plan. Do not treat features deferred in both libraries as missing parity.

Phase 29 adds private useGridVirtualization/exportRecords helpers, extended public Grid types, optional row/column modes, group footers, and export scopes/limits/cancellation. No stored-state migration or new runtime export was needed. The Grid README and Phase 29 story/tests describe host adapters and fallback semantics. Its commit contains this checkpoint; find the hash in Git history.

## Remaining phases

30: Pivot query ownership, budgets, dependent filters/distinct pagination, scoped incremental exports; TreeList provider ownership, commit validation, virtual diagnostics, and postorder weighted summaries.

31: Calendar multiple selection and standalone date-range preset selector with shared date calculations.

32: Advanced Scheduler recurrence, exceptions, resources, mounted reminders, timeline scales, render contexts, actions, and iCalendar. Reference recurrence expansion has a 500,000-candidate bound. Preserve wall-clock DST recurrence and exclusive all-day ends.

Reconcile every applicable change from Blazor `fb523d4c`, `130d8628`, and `fbf3fcb9` in the matrix before final completion. Backend code, legacy Razor wrappers, and features deferred in both libraries remain outside scope.

## Verification notes

Each phase needs unit and public-type coverage, Storybook, Chromium/WebKit interactions/Axe, inspected new visual baselines, and a separate commit. Run full integration after all phases. The host has a known Firefox framebuffer launch failure; attempt once per acceptance pass and record it without claiming Firefox coverage.

Playwright uses the static Storybook build and one shared port 6006; do not run separate browser invocations concurrently. Root runtime export additions must update both `tests/public-api.test.ts` and `scripts/verify-package.mjs`. Node is at `C:/Program Files/nodejs/node.exe`; Python was unavailable. Use reduced Vitest workers if concurrent heavy builds cause existing five-second tests to time out.
