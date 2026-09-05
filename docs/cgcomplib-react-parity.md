# CG.CompLib → `@cashgear/ui` Phase 1–18 parity

## Core Scheduler port

Reference: `CashGear.Blazor.UI/Components/Data/Scheduler` at `1e327060d65c8ae7e94088b24014cb7ebbd72714`; source working tree read only. The requested light/core scope includes all five views, local/provider items, selected date/view/appointment, working-time and current-time display, month overflow, all-day/multi-day spans, CRUD validation, dedicated drag/resize callbacks, range selection, keyboard/RTL behavior, and render contexts.

React adaptations use generic selectors, offset-bearing ISO strings, IANA timezone names, controlled/uncontrolled state, immutable operation drafts, AbortSignal, native form fields inside CgPopup, and CSS modules/theme tokens. Date and layout engines preserve half-open intervals, exclusive all-day end dates, earlier repeated instants, gap advancement, and real-instant slots across DST. Runtime API adds `CgScheduler`; interfaces are type-only exports. No dependency was added.

Recurrence, resources, reminders, iCalendar, advanced scale/form/tooltip customization, and imperative Blazor methods are explicitly deferred. See [Scheduler contracts](../src/components/Scheduler/README.md).

Validation on 2026-09-05 passed TypeScript, repository ESLint, all 562 Vitest tests in 57 files, cycle analysis across 289 source modules, production library/Storybook builds, and package verification (188 runtime exports; 1,375 packed files). The complete Chromium/WebKit semantic and Chromium visual regression run passed all 512 cases without baseline updates or retries. Six new scheduler baselines were separately generated and visually inspected; existing baselines were preserved.

After the final date precision, stable working-day state, partial Timeline scale, and interaction refinements, the rebuilt scheduler passed all 19 focused unit/public-API checks and all 22 focused browser checks (eight semantic scenarios per Chromium/WebKit plus six unchanged visual comparisons). Accessibility checks cover light, dark, Arabic RTL, and the editor. The port includes 11 stories and 17 scheduler unit cases. Final scoped lint, type checking, cycle checks, library/Storybook builds, and package verification also passed.

Firefox was attempted with fail-fast enabled but could not launch: `RenderCompositorSWGL failed mapping default framebuffer` caused a 30-second timeout before page creation. No Firefox component assertions ran; this matches the existing documented host limitation.

## Reference snapshot

The implementation was compared against the **working tree**, not only the committed revision, at `D:\LiveProjects\CGWebApp`. The reference repository was read only.

- Reference HEAD: `5cc83289`
- Reference captured: 2026-08-24
- Important uncommitted evidence: `CG.CompLib/Comp/Inputs/CgSearchBox.razor` and `.razor.cs` include the stale-render correction that preserves the browser's draft text while a render is pending. The React search box mirrors that generation/cancellation behavior.
- `git status --short` at capture:

```text
 M CG.CompLib.Demo/Components/Pages/Home.razor
 M CG.CompLib.Demo/Components/_Imports.razor
 M CG.CompLib.Tests/CgCompLibServiceCollectionExtensionsTests.cs
 M CG.CompLib.Tests/CgFlyoutTests.cs
 M CG.CompLib.Tests/CgGridTests.cs
 M CG.CompLib.Tests/CgSearchBoxTests.cs
 M CG.CompLib.Tests/CgTreeListTests.cs
 M CG.CompLib/CgCompLibServiceCollectionExtensions.cs
 M CG.CompLib/Comp/Grid/CgGrid.razor
 M CG.CompLib/Comp/Grid/CgGrid.razor.cs
 M CG.CompLib/Comp/Grid/CgGrid.razor.css
 M CG.CompLib/Comp/Grid/CgGrid.razor.js
 M CG.CompLib/Comp/Grid/CgGridColumns.cs
 M CG.CompLib/Comp/Grid/CgGridContracts.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.cs
 M CG.CompLib/Comp/Overlays/CgFlyout.razor.cs
 M CG.CompLib/Comp/Overlays/CgFlyout.razor.js
 M CG.CompLib/Comp/Overlays/CgFlyoutCloseReason.cs
 M CG.CompLib/Comp/Overlays/CgOverlayContracts.cs
 M CG.CompLib/Comp/TreeList/CgTreeList.razor
 M CG.CompLib/Comp/TreeList/CgTreeList.razor.cs
 M CG.CompLib/Comp/TreeList/CgTreeList.razor.js
 M CG.CompLib/Comp/TreeList/CgTreeListContracts.cs
 M CG.CompLib/Comp/TreeView/CgTreeView.razor
 M CG.CompLib/Comp/TreeView/CgTreeView.razor.cs
 M CG.CompLib/Comp/TreeView/CgTreeViewBranch.razor
 M CG.CompLib/Comp/TreeView/CgTreeViewTypes.cs
 M CG.CompLib/_Imports.razor
 M CG.CompLib/wwwroot/js/cg-overlay-stack.js
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
?? .claude/settings.local.json
?? CG.CompLib.Demo/Components/Pages/ContextMenuDemo.razor
?? CG.CompLib.Demo/Components/Pages/ContextMenuDemo.razor.css
?? CG.CompLib.Tests/CgContextMenuBrowserTests.cs
?? CG.CompLib.Tests/CgContextMenuTests.cs
?? CG.CompLib/Comp/ContextMenu/
```

## Phase 3 reference refresh

Phase 3 retained the original `5cc83289` snapshot above and re-audited the same read-only repository before implementing ComboBox behavior. A final read-only audit found concurrent external changes during the pass; the exact completion status below supersedes the earlier Phase 3 status capture. None of the changed paths affects the ComboBox reference evidence.

- Reference HEAD: `759c030706f0e67f0a50305eafaaef8895587830`
- Reference captured: 2026-08-24
- `git status --short` at capture:

```text
 M CashGear.App/Components/Comp/CustomersListExComp.razor
 M CashGear.App/Components/Comp/Sales/SalesAgentsComp.razor
 M CashGear.App/Components/Comp/VendorsListComp.razor
 M CashGear.App/Components/Pages/Accounting/AddLedgerAccountPage.razor
 M CashGear.App/Components/Pages/Accounting/CustPayment/EditCustPaymentComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.cs
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/GLJournalsComp.razor
 M CashGear.App/Components/Pages/Accounting/Reports/AccountBoard.razor
 M CashGear.App/Components/Pages/Accounting/Reports/CustPayments.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/TrialBalancePage.razor
 M CashGear.App/Components/Pages/Accounting/VendPayment/VendPaymentsComp.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor.cs
 M CashGear.App/Components/Pages/CustPages/CustTransPage.razor
 M CashGear.App/Components/Pages/Production/ProdOrder/AddProdOrderPage.razor
 M CashGear.App/Components/Pages/Projects/AddProject.razor
 M CashGear.App/Components/Pages/Retail/RetailOrder/EditRatailOrderPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor.cs
 M CashGear.App/Components/Pages/Sales/Reports/SalesAgentTransPage.razor
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
 D CashGear.App/Components/ProdComp/ProdOrderUpdateComp.razor
 D CashGear.App/Components/SalesComp/CustTransHeaderComp.razor
 D CashGear.App/Components/SalesComp/OrderDetailsComp.razor
 D CashGear.App/Components/SalesComp/OrderHeaderComp.razor
 M CashGear.App/Components/_Imports.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/AccountingPageCgMigrationTests.cs
?? CG.CompLib.Tests/PartnerSelectorMigrationTests.cs
```

## Phase 4 reference refresh

Phase 4 builds on the clean React baseline `db9e9c92e34bfdb0f5a05fb34df0b68723adaf17` and retains both prior Razor snapshots. The ListBox comparison used the current read-only Razor tree at the same Phase 3 HEAD. Its exact status was captured before implementation and was unchanged by the initial post-implementation audit.

- Reference HEAD: `759c030706f0e67f0a50305eafaaef8895587830`
- Reference captured: 2026-08-25
- ListBox evidence: `CG.CompLib/Comp/Inputs/CgListBox.razor`, `.razor.cs`, `.razor.css`, `.razor.js`, `CgListBoxTypes.cs`, `CgListBoxColumn.cs`, `CgListBoxAccessors.cs`, and `CgListBox.md`; `CG.CompLib.Tests/CgListBoxTests.cs` and `CgListBoxBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/ListBoxDemo.razor` and `.razor.css`.
- `git status --short` before implementation and at the initial completion audit:

```text
 M CashGear.App/Components/Comp/CustomersListExComp.razor
 M CashGear.App/Components/Comp/Sales/SalesAgentsComp.razor
 M CashGear.App/Components/Comp/VendorsListComp.razor
 M CashGear.App/Components/Pages/Accounting/AddLedgerAccountPage.razor
 M CashGear.App/Components/Pages/Accounting/CustPayment/EditCustPaymentComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.cs
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/GLJournalsComp.razor
 M CashGear.App/Components/Pages/Accounting/Reports/AccountBoard.razor
 M CashGear.App/Components/Pages/Accounting/Reports/CustPayments.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/TrialBalancePage.razor
 M CashGear.App/Components/Pages/Accounting/VendPayment/VendPaymentsComp.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor.cs
 M CashGear.App/Components/Pages/CustPages/CustTransPage.razor
 M CashGear.App/Components/Pages/Production/ProdOrder/AddProdOrderPage.razor
 M CashGear.App/Components/Pages/Projects/AddProject.razor
 M CashGear.App/Components/Pages/Retail/RetailOrder/EditRatailOrderPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor.cs
 M CashGear.App/Components/Pages/Sales/Reports/SalesAgentTransPage.razor
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
 D CashGear.App/Components/ProdComp/ProdOrderUpdateComp.razor
 D CashGear.App/Components/SalesComp/CustTransHeaderComp.razor
 D CashGear.App/Components/SalesComp/OrderDetailsComp.razor
 D CashGear.App/Components/SalesComp/OrderHeaderComp.razor
 M CashGear.App/Components/_Imports.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/AccountingPageCgMigrationTests.cs
?? CG.CompLib.Tests/PartnerSelectorMigrationTests.cs
```

## Phase 5 reference refresh

Phase 5 builds on the clean React baseline `1bf8aa4c57d73ed01156609b08e17ae92364312f` and retains the original and Phase 3 Razor snapshots. TagBox comparison used the read-only Razor working tree at its pre-implementation committed HEAD; its exact status is below.

- Reference HEAD: `759c030706f0e67f0a50305eafaaef8895587830`
- Reference captured: 2026-08-25
- TagBox evidence: `CG.CompLib/Comp/Inputs/CgTagBox.razor`, `.razor.cs`, `.razor.css`, and `.razor.js`; `CG.CompLib.Tests/CgTagBoxTests.cs` and `CgTagBoxBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/TagBoxDemo.razor`.
- `git status --short` before implementation:

```text
 M CG.CompLib.Tests/InventoryMovementMigrationTests.cs
 M CashGear.App/Components/Comp/CustomersListExComp.razor
 M CashGear.App/Components/Comp/Sales/SalesAgentsComp.razor
 M CashGear.App/Components/Comp/VendorsListComp.razor
 M CashGear.App/Components/Pages/Accounting/AddLedgerAccountPage.razor
 M CashGear.App/Components/Pages/Accounting/CustPayment/EditCustPaymentComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.cs
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/GLJournalsComp.razor
 M CashGear.App/Components/Pages/Accounting/Reports/AccountBoard.razor
 M CashGear.App/Components/Pages/Accounting/Reports/CustPayments.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/TrialBalancePage.razor
 M CashGear.App/Components/Pages/Accounting/VendPayment/VendPaymentsComp.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor
 M CashGear.App/Components/Pages/CMMSPages/CMWorkOrderPage.razor.cs
 M CashGear.App/Components/Pages/CustPages/CustTransPage.razor
 M CashGear.App/Components/Pages/Inventory/InvJournalPages/InvMovementsPage.razor
 M CashGear.App/Components/Pages/Production/ProdOrder/AddProdOrderPage.razor
 M CashGear.App/Components/Pages/Projects/AddProject.razor
 M CashGear.App/Components/Pages/Retail/RetailOrder/EditRatailOrderPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor
 M CashGear.App/Components/Pages/Sales/OrderPlace/AddOrderProducts.razor.cs
 M CashGear.App/Components/Pages/Sales/Reports/SalesAgentTransPage.razor
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
 D CashGear.App/Components/ProdComp/ProdOrderUpdateComp.razor
 D CashGear.App/Components/SalesComp/CustTransHeaderComp.razor
 D CashGear.App/Components/SalesComp/OrderDetailsComp.razor
 D CashGear.App/Components/SalesComp/OrderHeaderComp.razor
 M CashGear.App/Components/_Imports.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/AccountingPageCgMigrationTests.cs
?? CG.CompLib.Tests/PartnerSelectorMigrationTests.cs
```

The post-verification read-only audit observed that the Razor repository had advanced externally during the acceptance run to `6ff10078fecf2d587972006ab39708d18ee4a011` (`CG components Migration`, committed 2026-08-25 09:59:55 +03:00). Its exact post-run `git status --short` was:

```text
?? .claude/settings.local.json
```

No Phase 5 command wrote to, committed in, or reverted `CGWebApp`; the pre-run `759c0307` snapshot above remains the source reference used for implementation.

## Phase 6 reference refresh

Phase 6 builds on the clean React baseline `111a27e5a9e75a9a799672adf4f413ef027e96e5` and retains every earlier snapshot. DropDownBox comparison started against the read-only Razor HEAD below. A path-limited comparison produced no changed DropDownBox source, test, or demo paths between `759c0307` and this reference.

- Reference HEAD at start: `51b2f53b2b47c53e40486710cf4aa113c06ccdc7`
- Reference captured: 2026-08-25
- DropDownBox evidence: `CG.CompLib/Comp/Inputs/CgDropDownBox.razor`, `.razor.cs`, `.razor.css`, `.razor.js`, `CgDropDownBoxTypes.cs`, and `CgDropDownBox.md`; `CG.CompLib.Tests/CgDropDownBoxTests.cs` and `CgDropDownBoxBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/DropDownBoxDemo.razor`.
- `git status --short` before implementation:

```text
 M CG.CompLib.Tests/CgAccordionBrowserTests.cs
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib.Tests/CgComboBoxBrowserTests.cs
 M CG.CompLib.Tests/CgDateEditBrowserTests.cs
 M CG.CompLib.Tests/CgDateRangePickerBrowserTests.cs
 M CG.CompLib.Tests/CgGridBrowserTests.cs
 M CG.CompLib.Tests/CgLookUpGridBrowserTests.cs
 M CG.CompLib.Tests/CgSearchBoxBrowserTests.cs
 M CG.CompLib.Tests/CgSearchBoxTests.cs
 M CG.CompLib.Tests/CgTagBoxBrowserTests.cs
 M CG.CompLib.Tests/CgTextBoxBrowserTests.cs
 M CG.CompLib.Tests/CgTreeViewBrowserTests.cs
 M CG.CompLib/Comp/Accordion/CgAccordion.razor
 M CG.CompLib/Comp/Accordion/CgAccordion.razor.cs
 M CG.CompLib/Comp/Grid/CgGrid.razor
 M CG.CompLib/Comp/Grid/CgGrid.razor.cs
 M CG.CompLib/Comp/Inputs/CgComboBox.razor
 M CG.CompLib/Comp/Inputs/CgComboBox.razor.cs
 M CG.CompLib/Comp/Inputs/CgDateEdit.razor
 M CG.CompLib/Comp/Inputs/CgDateEdit.razor.cs
 M CG.CompLib/Comp/Inputs/CgDateRangePicker.razor
 M CG.CompLib/Comp/Inputs/CgDateRangePicker.razor.cs
 M CG.CompLib/Comp/Inputs/CgInputBase.cs
 M CG.CompLib/Comp/Inputs/CgLookUpGrid.razor
 M CG.CompLib/Comp/Inputs/CgLookUpGrid.razor.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.js
 M CG.CompLib/Comp/Inputs/CgTagBox.razor
 M CG.CompLib/Comp/Inputs/CgTagBox.razor.cs
 M CG.CompLib/Comp/Inputs/CgTextArea.razor
 M CG.CompLib/Comp/Inputs/CgTextBox.razor
 M CG.CompLib/Comp/Inputs/CgTextBox.razor.cs
 M CG.CompLib/Comp/TreeView/CgTreeView.razor
 M CG.CompLib/Comp/TreeView/CgTreeView.razor.cs
?? .claude/settings.local.json
?? CG.CompLib.Tests/CgEditableTextStateTests.cs
?? CG.CompLib/Comp/Inputs/CgEditableTextState.cs
```

The read-only repository advanced externally during Phase 6. The completion audit observed HEAD `34f3248766a39ac66b6f63c9c31821e3f9190681` (`Eliminate stale-render input loss across Cg editors`, committed 2026-08-25 13:54:00 +03:00) and this exact status:

```text
 M CG.CompLib.Tests/CgSearchBoxBrowserTests.cs
 M CG.CompLib.Tests/CgSearchBoxTests.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.md
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.js
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
?? .claude/settings.local.json
```

No Phase 6 command wrote to, committed in, or reverted `CGWebApp`; the `51b2f53` start audit remains the DropDownBox implementation reference and the later `34f3248` audit records external completion state.

## Phase 7 reference refresh

Phase 7 builds on the clean React baseline `a3b88cc1c28721bad741b4ba22e55ef70be2a5c5` and retains every earlier snapshot. The scalar-key adapter comparison used the current read-only Razor tree below; Phase 7 did not modify it.

- Reference HEAD: `34f3248766a39ac66b6f63c9c31821e3f9190681`
- Reference captured: 2026-08-25
- KeyComboBox evidence: `CG.CompLib/Comp/Inputs/CgKeyComboBox.razor` and `.razor.cs`; `CG.CompLib/Comp/Inputs/README.md`; `CG.CompLib.Tests/CgKeyComboBoxTests.cs`; `CG.CompLib.Demo/Components/Pages/Home.razor`.
- `git status --short` at capture:

```text
 M CG.CompLib.Tests/CgSearchBoxBrowserTests.cs
 M CG.CompLib.Tests/CgSearchBoxTests.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.md
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.cs
 M CG.CompLib/Comp/Inputs/CgSearchBox.razor.js
 M CashGear.App/Components/Pages/Sales/SalesOrderSearchPage.razor
?? .claude/settings.local.json
```

The completion audit observed the same reference HEAD. External work had additionally modified `CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor` and `CashGear.App/Components/Pages/Purch/PO/PurchOrdersPage.razor`; no Phase 7 command wrote to, committed in, or reverted `CGWebApp`.

## Phase 8 reference refresh

Phase 8 builds on the clean React baseline `9abb93938a3a17ba6fd1dcc900eb8a72a8a144a8` and retains every earlier snapshot. DateEdit comparison used the read-only Razor tree below. The planning snapshot contained only `?? .claude/settings.local.json`; the mandatory re-audit immediately before React edits observed the additional concurrent changes recorded here. No Phase 8 command wrote to, committed in, or reverted `CGWebApp`.

- Reference HEAD: `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a`
- Reference captured immediately before implementation: 2026-08-26
- DateEdit evidence: `CG.CompLib/Comp/Inputs/CgDateEdit.razor`, `.razor.cs`, `.razor.css`, `.razor.js`, `CgDateEditTypes.cs`, `CgDateEditorUtilities.cs`, and `CgDateEdit.md`; `CG.CompLib.Tests/CgDateEditTests.cs`, `CgDateEditorUtilitiesTests.cs`, `CgDateEditorProductionUsageTests.cs`, and `CgDateEditBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/DateEditDemo.razor` and `.razor.css`.
- `git status --short` immediately before implementation:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
```

The completion audit observed the same reference HEAD and exact status. No React implementation or verification command changed the Razor repository.

## Phase 9 reference refresh

Phase 9 builds on the clean React baseline `2144b2fa41e47c27f58dc158d457c2b8b17c8f29` and retains every earlier snapshot. Flyout, Popup, Window, and MaskedInput comparison uses the read-only Razor tree below. `CgDateRangePicker` and the private DateEdit calendar are explicitly outside this phase. No Phase 9 command may write to, commit in, format, clean, revert, or restore `CGWebApp`.

- Reference HEAD: `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a`
- Reference captured immediately before implementation: 2026-08-26
- Flyout evidence: `CG.CompLib/Comp/Overlays/CgFlyout.*`, `CgFlyoutCloseReason.cs`, `CgPlacement.cs`, `CgOverlayContracts.cs`, and `README.md`; `CG.CompLib.Tests/CgFlyoutTests.cs` and `CgFlyoutBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/FlyoutDemo.razor`.
- Popup and Window evidence: `CG.CompLib/Comp/Overlays/CgPopup.*`, `CgWindow.*`, `CgOverlayBase.cs`, `CgOverlayContracts.cs`, and `CG.CompLib/wwwroot/js/cg-overlay-stack.js`; `CG.CompLib.Tests/CgOverlayTests.cs` and `CgOverlayBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor` and `.razor.css`.
- MaskedInput evidence: `CG.CompLib/Comp/Inputs/CgMaskedInput.*`, `CgMaskedInputTypes.cs`, `CgMaskParser.cs`, and `CgMaskState.cs`; `CG.CompLib.Tests/CgMaskedInputTests.cs` and `CgMaskedInputBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/MaskedInputDemo.razor`.
- `git status --short` immediately before implementation:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
```

The post-verification read-only audit observed the same reference HEAD. Concurrent external work added modifications to `CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor` and `.razor.cs` plus untracked `CG.CompLib.Tests/EditPOsPageMigrationTests.cs`; every pre-implementation status entry above remained. The exact completion `git status --short` was:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/EditPOsPageMigrationTests.cs
```

No Phase 9 command wrote to, committed in, formatted, cleaned, reverted, or restored the Razor repository.

## Phase 10 reference refresh

Phase 10 builds on the clean React baseline `fc6b7139424844f013b94870f141507583da5963` and retains every earlier snapshot. Menu, ContextMenu, DropDownButton, SplitButton, and Toolbar comparison used the read-only Razor tree below. Baseline Node 24.19 checks passed before editing: strict typecheck, lint, 19 Vitest files/178 tests, cycle analysis across 115 source modules, and package verification of 27 runtime exports across 535 packed files.

- Reference HEAD: `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a`
- Reference captured immediately before implementation: 2026-08-26
- Menu evidence: `CG.CompLib/Comp/Menu/*`; `CG.CompLib.Tests/CgMenuTests.cs`, `CgMenuEngineTests.cs`, and `CgMenuBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/MenuDemo.razor` and `MenuRouteTarget.razor`.
- ContextMenu evidence: `CG.CompLib/Comp/ContextMenu/*`; `CG.CompLib.Tests/CgContextMenuTests.cs` and `CgContextMenuBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/ContextMenuDemo.razor`.
- Button-menu evidence: `CG.CompLib/Comp/Buttons/CgDropDownButton.razor`, `CgSplitButton.razor`, `CgButtonMenu*`, and `CgButtonMenus.md`; `CG.CompLib.Tests/CgButtonMenuTests.cs` and `CgButtonMenuBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/ButtonMenusDemo.razor`.
- Toolbar evidence: `CG.CompLib/Comp/Toolbar/*`; `CG.CompLib.Tests/CgToolbarTests.cs`, `CgToolbarLayoutEngineTests.cs`, and `CgToolbarBrowserTests.cs`; the Toolbar, adaptive, filter, grid, list-page, and sales-order demos.
- `git status --short` immediately before implementation:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib.Tests/EditLedgerJournalPageMigrationTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/EditPOsPageMigrationTests.cs
```

The completion audit observed the same `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a` HEAD and the exact same status block above. No Phase 10 command wrote to, committed in, formatted, cleaned, reverted, or restored the Razor repository.

## Phase 11 reference refresh

Phase 11 builds on the clean React baseline `d198cd666834c06fde5d60147b51b52c679678e0` and retains every earlier snapshot. LayoutBreakpoint, Tabs, Stepper, Accordion, and FormLayout comparison used the read-only Razor tree below. Baseline Node 24.19 checks passed immediately before editing: strict typecheck, lint, 23 Vitest files/205 tests, cycle analysis across 138 source modules, library build, and package verification of 33 runtime exports across 648 packed files.

- Reference HEAD: `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a`
- Reference captured immediately before implementation: 2026-08-26
- LayoutBreakpoint evidence: `CG.CompLib/Comp/Layout/CgLayoutBreakpoint.*`; `CG.CompLib.Tests/CgLayoutBreakpointTests.cs` and `CgLayoutBreakpointBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/LayoutBreakpointDemo.razor`.
- Tabs evidence: `CG.CompLib/Comp/Tabs/*`; `CG.CompLib.Tests/CgTabsTests.cs` and `CgTabsBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/TabsDemo.razor*`.
- Stepper evidence: `CG.CompLib/Comp/Stepper/*`; `CG.CompLib.Tests/CgStepperTests.cs` and `CgStepperBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/StepperDemo.razor*`.
- Accordion evidence: `CG.CompLib/Comp/Accordion/*`; `CG.CompLib.Tests/CgAccordionTests.cs` and `CgAccordionBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/AccordionDemo.razor*`.
- FormLayout evidence: `CG.CompLib/Comp/FormLayout/*`; `CG.CompLib.Tests/CgFormLayoutTests.cs` and `CgFormLayoutBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/FormLayoutDemo.razor*`.
- `git status --short` immediately before implementation:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib.Tests/EditLedgerJournalPageMigrationTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/EditPOsPageMigrationTests.cs
```

The completion audit observed the same React `d198cd666834c06fde5d60147b51b52c679678e0` baseline HEAD and the same Razor `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a` HEAD/status block above. No Phase 11 command wrote to, committed in, formatted, cleaned, reverted, or restored the Razor repository. The React worktree remains intentionally uncommitted.

## Phase 12 reference refresh

Phase 12 starts from the same React HEAD `d198cd666834c06fde5d60147b51b52c679678e0` with the entire uncommitted Phase 11 worktree retained in place. Baseline checks immediately before the first Phase 12 edit passed with the bundled Node 24.19 runtime: strict typecheck, lint, 28 Vitest files/246 tests, and cycle analysis across 161 source modules. The standalone TreeView comparison used the read-only Razor tree below.

- Reference HEAD: `517e7eba58cdbcd6ad3f29087837c6ce8895ad2a`
- Reference captured immediately before the first React edit: 2026-08-26
- Source evidence: `CG.CompLib/Comp/TreeView/CgTreeView.razor*`, `CgTreeViewBranch.razor*`, `CgTreeViewNode.razor*`, `CgTreeViewTypes.cs`, `TreeNodeDefinition.cs`, and `README.md`.
- Test/demo evidence: `CG.CompLib.Tests/CgTreeViewTests.cs`, `CgTreeViewBrowserTests.cs`; `CG.CompLib.Demo/Components/Pages/TreeViewDemo.razor*`.
- `git status --short` captured with that HEAD:

```text
 M CG.CompLib.Demo/Components/Pages/MemoDemo.razor
 M CG.CompLib.Tests/CgBasicInputTests.cs
 M CG.CompLib.Tests/EditLedgerJournalPageMigrationTests.cs
 M CG.CompLib/Comp/FormLayout/README.md
 M CG.CompLib/Comp/Inputs/CgMemo.md
 D CG.CompLib/Comp/Inputs/CgTextArea.razor
 D CG.CompLib/Comp/Inputs/CgTextArea.razor.css
 M CashGear.App/Components/Comp/GL/UpdateJournalLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourLineComp.razor
 M CashGear.App/Components/Comp/Inv/UpdateInvJourRevLineComp.razor
 M CashGear.App/Components/Comp/Purch/UpdatePurchLineComp.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/AddLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor
 M CashGear.App/Components/Pages/Accounting/LrdgerJournalPages/EditLedgerJournalPage.razor.css
 M CashGear.App/Components/Pages/Accounting/Reports/LedgertransPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor
 M CashGear.App/Components/Pages/Purch/PO/EditPOsPage.razor.cs
 M CashGear.App/Components/Pages/Sales/OrdersReportPage.razor
?? .claude/settings.local.json
?? CG.CompLib.Tests/EditPOsPageMigrationTests.cs
```

The completion audit observed the same Razor HEAD and exact status block above. No Phase 12 command wrote to, committed in, formatted, cleaned, reverted, or restored `CGWebApp`. The React worktree remains intentionally uncommitted, including all pre-existing Phase 11 modifications and untracked files.

## Phase 13 — CgGrid

Phase 13 is additive on top of the uncommitted Phase 11 and Phase 12 worktree. The read-only reference is `CG.CompLib/Comp/Grid/*`, `CgGrid*Tests.cs`, and `GridDemo.razor`; `ToolbarGridDemo.razor` informs composition only. No Razor source is modified.

- `CgGrid<TItem>` uses immutable typed column descriptors, explicit accessors and immutable editor setters instead of Razor child registration or expression-driven mutation.
- Local processing preserves the Razor order: search, filter, filtered-set summaries, stable multi-sort, grouping, and paging. Nested/source-aware filters, whole-day date rules, typed summaries, local multi-level groups, and state-v8 migration are pure modules.
- The rendered Grid provides semantic row/column metadata, roving cell focus, keyboard activation and selection, paging, search/filter controls, summaries, one active master-detail row, grouping controls, column chooser, resize/reorder/freeze state, and RTL/token-based styling.
- AbortSignal providers support row, group-node, and group-item requests with typed paths, authoritative counts/summaries, stale-response rejection, retained refresh errors, and remote-export delegation.
- Popup CRUD composes existing CashGear controls, keeps original rows isolated, validates explicit editor metadata, rejects update key changes, serializes mutations, and uses caller confirmation/persistence callbacks.
- Context menus reuse Phase 10 `CgContextMenu`. XLSX generation is dependency-free, returns a typed byte result, and performs browser download only through an explicit SSR-safe helper.
- Named views use an injected store. The bundled browser store is personal/localStorage-only; role/company security remains an application/server concern.

Intentional deferrals remain inline/cell/batch editing, row/column virtualization, automatic column discovery, transactional inference, custom aggregates, generic HTTP adapters, TreeList, and DateRangePicker. New visual evidence uses `phase-13-grid-*` names and does not replace Phase 12 TreeView snapshots.

Phase 13 is a broad working implementation, but it is not yet a full-parity claim. Complete frozen-boundary enforcement still needs the Razor edge cases, and context-menu plumbing does not yet render a distinct group-footer surface. Those items remain tracked gaps rather than stubs presented as complete behavior.

## Phase 14 — CgLookUpGrid

Phase 14 mirrors the current read-only `CgLookUpGrid` working implementation, its unit/browser/ERP tests, and both lookup demos as a focused React editor rather than embedding `CgGrid`.

- `CgLookUpGrid<TItem, TValue>` binds only the key while resolving the display row from controlled state, committed cache, local/loaded rows, or an abortable `itemResolver`. `null` is the explicit empty value; blank strings are also empty and numeric zero remains valid.
- Immutable `CgLookUpGridColumnDescriptor<TItem>` values replace child registration. Visible searchable fields drive global OR search; formatted text also drives local column filters, which combine with AND semantics and persist across popup/query operations.
- Local and abortable server modes share normalized queries, single-column sorting, append paging, disabled-row snapshots, query-context comparison, retry, stale-result rejection, and fresh-callback adoption. Callers own transport and server authorization.
- The input-focused combobox/grid pattern uses positional row IDs, lookup-specific filter traversal, disabled-row skipping, immediate close-on-selection, controlled popup state, native form serialization/reset, field validation, live sorting/count announcements, and `CgFlyout` collision handling.
- CSS modules use CashGear tokens, logical properties, RTL-safe numeric cells, dark theme, forced colors, and reduced-motion rules. Phase 14 stories cover local/server, resolver, filters, sort/page, templates, forms, error/minimum, View All, Arabic/RTL, ERP contexts, multiple instances, and narrow flipping.

React adaptations are intentional: descriptors are immutable, async contracts use `AbortSignal`, structural query-context comparison is caller-supplied, and there is no virtualization prop. Multiple selection, grouping, master-detail, column personalization, CRUD, summaries, export, and virtualization remain `CgGrid` responsibilities. New browser and visual evidence uses `phase-14-lookupgrid-*` names.

Phase 14 verification on 2026-08-26 passed strict TypeScript, ESLint, 31 Vitest files/308 tests, import-cycle analysis across 188 source modules, the production library build, the 246-module Storybook build, and package verification of 59 runtime exports across 887 packed files. The complete Chromium/WebKit semantic suite passed 166 tests, followed by final focused Chromium/WebKit interaction and Axe reruns from the rebuilt bundle. Eight `phase-14-lookupgrid-*` Chromium baselines cover local, filters, disabled, error, dark, RTL, narrow flip/overflow, and reduced-motion states; forced-colors behavior is asserted in Chromium. Firefox could not execute because its headless SWGL compositor timed out while launching on this host, so Firefox-specific browser behavior remains an environment-limited verification risk rather than a passing claim.

## Phase 15 — Filter, Pager, and advanced Grid parity

Phase 15 started from clean React revision `c70ba05b5f7efa69b3c046af948a2619c6bf5113`. The Razor reference stayed strictly read-only at `aa0001533f5c4a028c65879dc3346701d9300b08`; its only status entry was the pre-existing untracked `.claude/settings.local.json`.

- The shared Filter Core uses immutable, string-literal React ASTs and exact Razor `$type`/numeric-ordinal codecs at persistence and transport boundaries. It validates limits, fields, authorization, operator/value kinds, relative-date context, and registered accessors before execution. Legacy operands and Grid state versions 1–9 remain accepted at compatibility boundaries; canonical output never emits obsolete shapes.
- `CgFilterBuilder<TItem>` provides stable editable IDs, nested and negated groups, collection aggregate rows, explicit/immediate/debounced application, cancellable async apply, stale debounce rejection, generated and custom editors, draft retention under controlled rejection, and accessible RTL/responsive interaction.
- Grid state v9 reconciles summary identity/visibility; v10 adds typed filters, builder ownership, negation, and persisted suspension. Filter-row and builder criteria remain source-separated, invalid saved criteria retain blocking diagnostics, and provider helpers serialize only validated Razor-compatible requests.
- `CgPager` supplies the standalone zero-based paging state machine and arithmetic. Grid composes it as a controlled footer so one gesture creates one state transition/provider request while generation and abort guards reject stale data.
- Popup editing remains compatible and default. Inline-row, cell, and batch modes require an explicit dirty-navigation policy, preserve immutable originals/drafts, route navigation through one cancellable gate, report stable snapshots/persistence/conflict state, reject key changes, and submit mixed batch operations once with a stable batch ID and deterministic first-change order.
- Custom aggregate descriptors carry stable keys and ordered unique input fields. Built-ins remain synchronous; trusted local custom totals/groups use the async `AbortSignal` path with stale-result rejection. Provider descriptors strip delegates, renderers, labels/formats, exception text, expressions, and authorization logic.

React adaptations remain explicit: accessors/setters replace reflection and expressions; `AbortSignal` replaces cancellation tokens; injected clocks/timezones replace ambient date state; provider and persistence callbacks remain caller-owned. Row/column virtualization, automatic column discovery, generic HTTP adapters, SQL/EF/Dapper translation, server persistence, and unrelated deferred controls remain out of scope.

Phase 15 stories use only new `phase-15-*` identities for FilterBuilder, Pager, typed filters, all editing modes, custom aggregates, dark/compact, Arabic RTL, narrow layouts, forced colors, and reduced motion. New Chromium visual evidence uses only `phase-15-*` filenames; prior snapshots are not regenerated.

Final Phase 15 verification on 2026-08-27 passed strict TypeScript, ESLint, 36 Vitest files/351 tests, import-cycle analysis across 209 source modules, the 204-module production library build, the 270-module Storybook build, and package verification of 141 runtime exports across 988 packed files. All 163 Windows Chromium visual cases passed; exactly six new `phase-15-*` baselines were added, and every earlier baseline remained unchanged. The complete Chromium/WebKit semantic suite passed 182 tests during acceptance, and the final rebuilt bundle then passed all 16 affected Phase 15/legacy Grid interaction and Axe cases across both engines. The monolithic `npm run verify` re-passed its source, build, Storybook, and all 91 Chromium semantic gates, then reproduced the pre-existing Firefox launch failure three consecutive times before page creation and was stopped to avoid repeating the same 30-second renderer timeout across the remaining cases. An isolated Phase 15 launch captured `RenderCompositorSWGL failed mapping default framebuffer`; WebKit, Chromium visuals, and package verification passed independently as recorded above.

### Phase 15 editing parity refresh

The spreadsheet-editing refresh compares the latest paired, read-only CashGear.Blazor.UI working-tree delta at HEAD `1e327060d65c8ae7e94088b24014cb7ebbd72714`. It adds SpinEdit arithmetic expressions and immediate complete-draft publication, plus Grid type-to-edit and optional Enter-to-next-visible-row behavior. The expression evaluator is private and retains JavaScript `number`/IEEE-754 semantics. Grid options remain inside the React `editing` object; type-to-edit defaults on and Enter advancement defaults off. Fast key seeds are buffered until a compatible editor mounts, persistence reads the latest synchronous edit snapshot, and validation/conflict/persistence failures keep the original editor focused. The deterministic `SpreadsheetEditing` story and focused Chromium/WebKit semantics exercise a formula-backed `CgSpinEdit` custom cell editor. Older deferred Grid virtualization, frozen-boundary, group-footer, and server-adapter work remains outside this refresh.

Refresh verification passed strict TypeScript and ESLint, 58 Vitest files/605 tests, cycle analysis across 290 source modules, the 284-module production build, the 358-module Storybook build, and package verification of 188 runtime exports across 1,380 packed files. The focused keyboard workflow passed in Chromium and WebKit. Chromium visual comparison passed 251 cases in the full run; the sole unrelated Phase 10 ContextMenu loading story missed its transient status before capture and passed immediately in isolation, completing all 252 existing comparisons without regenerating baselines. Firefox was not rerun for this focused refresh; the existing host SWGL launch limitation remains documented above.

## Phase 16 — Calendar, Date Range, Toast, and Confirmation

Phase 16 started from clean React revision `f8b7917351dc8bc44482913418319b86dd56a7fe`. The Razor reference remained strictly read-only at `958fee83fa406d0684066d29516f01e19d739a37`; its live snapshot contained 484 pre-existing working-tree entries, including the in-progress `Comp` → `Components` migration and modified Calendar/Confirmation tests. Evidence was taken from the current `Components/Editors/Calendar/*`, `Components/Editors/CgDateRangePicker*`, `Components/Feedback/Toast/*`, `Components/Feedback/Confirmation/*`, their tests, demos, styles, and scripts rather than from the committed tree alone.

- Civil-date math and exact token formatting moved from DateEdit into shared private modules. Inclusive day counts and week/month/quarter/year boundaries serve DateEdit, Calendar, range validation, and deterministic built-in presets without `Date` objects in public state.
- `CgCalendar` is a controlled/uncontrolled public single/range calendar with one/two panels, internal first-click state, normalized pointer ranges, preview context, locale week starts, deterministic Today, restrictions, day/month/year panels, grid semantics, roving focus, physical RTL arrows, and localized announcements. DateEdit now composes it while retaining its guard, draft, form proxy, overlay, focus-return, and existing visual contract.
- `CgDateRangePicker` preserves every invalid external shape, scans every separator boundary for one exact manual pair, validates inclusive limits and endpoint-only disabled predicates, supports explicit/immediate commit modes, generation-safe guards, replaceable built-in presets, controlled parent updates while open, action methods, and two native endpoint proxies.
- `CgToastProvider` owns six logical FIFO stacks and starts duration accounting only for visible items. Hover, focus, document hiding, and async actions retain exact remaining time; stable status/alert live regions exclude progress churn, duplicate actions are suppressed, and navigation clearing uses an explicit subscriber.
- `CgConfirmationProvider` owns one popup and a FIFO request queue with idempotent settlement, AbortSignal cleanup, navigation cancellation, focus restoration, and deferred lifecycle rejection that tolerates Strict Mode effect replay.

React adaptations remain deliberate: immutable descriptors and canonical strings replace mutable .NET date objects; `AbortSignal` replaces cancellation tokens; native proxies replace EditContext field plumbing; context-local providers replace scoped services; and router integration is passed as a callback. Multiple selection, alerts, prompts, and arbitrary dialogs remain deferred.

Final Phase 16 verification on 2026-08-29 passed strict TypeScript and ESLint, 40 Vitest files/367 tests, import-cycle analysis across 221 source modules, the 215-module production library build, the 282-module Storybook build, and package verification of 147 runtime exports across 1,042 packed files. Chromium passed all 96 semantic/Axe cases and all 172 visual tests against 180 Windows baselines. Exactly nine new `phase-16-*` baselines were added and inspected; six DateEdit baselines were deliberately refreshed after review of the shared-calendar extraction, with deterministic story dates and a compatibility skin retaining its established geometry and state treatments. WebKit passed all 96 semantic/Axe cases after its run exposed and verified a click-origin focus-return fix for Confirmation. The aggregate `npm run verify` re-passed its source/build gates and all Chromium cases, then reproduced the host-only Firefox launch timeout before page creation; an isolated launch captured `RenderCompositorSWGL failed mapping default framebuffer`. WebKit, Chromium visuals, the post-fix source suite, and package verification passed independently, so Firefox remains an environment-blocked gate rather than a component failure.

## Phase 17 — FileUploader

Phase 17 started from clean React revision `080b567a9f990979bc5037aae944e65b2ae4716b`. The Razor repository remained strictly read-only and the implementation is pinned to clean reference commit `6fc1e4577fbb2a492150f991945c478fac8a917f`, specifically `Components/Editors/CgFileUploader.*`, `CgFileUpload*`, their endpoint contracts, styles, JavaScript protocol module, and tests.

- `CgFileUploader` owns an immutable ordered queue because browser `FileList` values cannot be reconstructed programmatically. Ten lifecycle states cover pending, active, durable, rejected, resumable, and remote-delete work; public callbacks and actions receive frozen snapshots that omit session and antiforgery tokens.
- Handler mode passes the original `File`, `AbortSignal`, progress reporter, immutable metadata, queue position, and an opt-in memory buffer. Endpoint mode mirrors the v2 initiate/status/chunk/complete/delete protocol with fetch/XHR, Web Crypto hashes, bounded abortable retries, `Retry-After`, credentials-aware antiforgery caching, and the compatible `cg-fileuploader:v2:{persistenceKey}` storage schema.
- Recovery recreates only an `awaiting-reselection` row after hydration. The reference filename/size/last-modified plus first/last 64 KiB SHA-256 fingerprint must match exactly before a browser file can resume; pause keeps uploaded chunks, cancellation clears local staging state and can delete the remote session, and durable deletion failure remains retryable.
- Native form integration uses an unnamed file input, a nameless offscreen constraint proxy, and one repeated hidden input per successful durable file. Selection-only and require-all-succeeded validation, disabled exclusion, invalid-focus transfer, external form association, and reset-to-`defaultStoredFiles` are React/native-DOM adaptations of the Blazor EditContext contract.
- A reference-counted Strict-Mode-safe drag guard blocks file-navigation drops outside mounted uploaders only. Default rendering reuses `CgField` composition, `CgButton`, `CgProgressBar`, `CgIcon`, logical CSS, theme/density tokens, RTL, forced colors, and reduced-motion behavior without a runtime dependency or router coupling.

Browser metadata and client validation remain advisory. Hosts must authorize upload/delete sessions server-side, enforce content/count/size/type rules independently, validate hashes and completion state, constrain metadata and names, scan durable content where required, and treat every durable identifier as tenant-scoped untrusted input.

Final Phase 17 verification on 2026-08-29 passed strict TypeScript and ESLint, 43 Vitest files/393 tests, import-cycle analysis across 228 source modules, the 222-module production library build, the 290-module Storybook build, and package verification of 148 runtime exports across 1,076 packed files. Chromium passed all 98 semantic/Axe cases and all 181 visual tests against 189 reviewed Windows baselines; exactly nine new `phase-17-fileuploader-*` baselines were added and inspected. WebKit passed all 98 semantic/Axe cases, including the real-file handler flow and the reload/reselection/resume/delete endpoint harness. Firefox remains environment-blocked before page creation: the isolated Phase 17 run reproduced the host launch timeout with `RenderCompositorSWGL failed mapping default framebuffer`.

## Phase 18 — Splitter and Drawer

Phase 18 started from clean React revision `5439a7b`. The Blazor repository at `D:\LiveProjects\CGWebApp\CashGear.Blazor.UI` remained strictly read-only, and implementation evidence is pinned to commit `51d7689a7d407713fa18cb6268158b1a4f461fb3` (`#Add CgSplitter and CgDrawer`): the Splitter/Drawer components, contracts, styles, JavaScript modules, demos, and tests.

- `CgSplitter` replaces Razor child registration with immutable keyed descriptors and frozen render snapshots. A pure normalization layer canonicalizes numeric/fixed/flexible sizes, rejects unsafe bounds and unsupported state versions, reconciles untrusted persisted state in descriptor order, and guarantees one visible expanded pane. Flex tracks preserve declarative units until an actual pointer or keyboard resize commits a pixel pair.
- Pointer capture, live animation-frame writes, deferred preview, throttled intermediate callbacks, final-only zero intervals, ResizeObserver cancellation, browser-resolved min/max limits, physical RTL keys, pair-total preservation, owned-root event scoping, and generation cleanup remain dependency-free. Controlled state receives proposals but stays authoritative; direct controlled updates are semantic-only.
- `CgDrawer` is one permanent inline subtree. Full, mini, panel, backdrop, and application regions retain DOM identity across open, mode, position, and responsive changes while inactive regions become inert and hidden from accessibility APIs. SSR starts from caller intent; an effect applies the exact `max-width: breakpoint - 0.02px` presentation query.
- Drawer lifecycle proposals are abortable and generation-safe. Controlled direct changes bypass before/open-change hooks but still receive one transition-terminal callback; refusals, reversals, responsive changes, visibility changes, disposal, and stale work cancel terminal completion. Actions report blocked, cancelled, stale, and controlled-rejected proposals as `false`.
- The shared overlay infrastructure now supports inline modal roots and a reusable reference-counted body scroll lock. Visible open effective-overlay Drawers share ownership, outside-pair/Escape arbitration, raise order, modal isolation, focus trapping through owned portal boundaries, and connected-opener restoration with Flyout, ContextMenu, Popup, and Window.

React adaptations are deliberate: immutable descriptors replace Blazor registration, `AbortSignal` replaces cancellation tokens, inline persistent React regions replace conditional Razor fragments, `matchMedia` replaces the responsive JS handle, and explicit render functions replace fragments. Visibility, disabled/read-only state, and persisted layout state are presentation/data concerns—not authorization controls.

Final Phase 18 verification on 2026-08-29 passed strict TypeScript and ESLint, 46 Vitest files/420 tests, import-cycle analysis across 236 source modules, the 230-module production library build, the 298-module Storybook build, and package verification of 150 runtime exports across 1,114 packed files. Chromium passed all 105 semantic/Axe cases and all 193 visual tests against 201 reviewed Windows baselines; exactly 12 new `phase-18-*` baselines were added and inspected, and every Phase 1–17 comparison remained stable. WebKit passed all 105 semantic/Axe cases. The one permitted Firefox Phase 18 launch attempt reproduced the host-only timeout before page creation with `RenderCompositorSWGL failed mapping default framebuffer`; it was classified as environment-blocked and was not repeated through the aggregate script.

## Phase 19 — RangeSelector, Tooltip, and StatusBadge

Phase 19 evidence is pinned to clean CashGear.Blazor.UI commit `51d7689a7d407713fa18cb6268158b1a4f461fb3`. Read-only `git show` inspection covered `Components/Data/RangeSelector/*`, `Components/Feedback/Tooltip/*`, `Components/Feedback/StatusBadge/*`, and their demo/test counterparts. Those component files are unchanged from their clean introduction at `6fc1e4577fbb2a492150f991945c478fac8a917f`; no Blazor file was changed.

- `CgRangeSelector` replaces C# generic numeric/temporal conversion with a required React `valueKind` union and one frozen `{ start, end }` value. Finite numbers are the only floating-point public kind. Native bigint, normalized arbitrary-scale decimal strings, civil dates, local date-times, and instants use exact BigInt-backed wires. Civil arithmetic never constructs JavaScript `Date`; instant wires compare UTC instants and newly generated values retain the minimum instant's offset token.
- Decimal/local-date-time/instant normalizers are public construction boundaries. Date intervals are positive safe-integer whole days; local-date-time and instant intervals are positive safe-integer milliseconds. Null start/end represent domain boundaries on generated output, while explicit controlled boundary values and unsnapped values remain authoritative. This exact range model does not change NumericEdit or SpinEdit from IEEE-754 numbers.
- Pointer preview uses capture, animation-frame DOM writes, 100 ms changing-event coalescing, exact snapping/span/domain clamps, swap-aware focus, final changing/value-change/changed order, ResizeObserver cancellation, and generation cleanup. Both handles retain meaningful SSR slider semantics; read-only stays focusable with `aria-disabled`, disabled leaves the tab order, and RTL arrows follow physical direction.
- `CgTooltip` retains one target wrapper and lazily portals a sole `role="tooltip"` surface. A backward-compatible optional candidate-placement/details path extends shared `PositionedOverlay`; existing callers keep their old path. Auto/explicit logical placement, visual-viewport shifting, geometry/context observation, theme/density/direction inheritance, exact `aria-describedby` token ownership, cancellable hover/focus boundaries, manual state, and click-only overlay registration are generation-safe.
- `CgStatusBadge` is semantic-free presentation by default. Explicit status/alert roles remain caller-owned, icon and indicator content is decorative, and its native dismiss button is synchronously one-shot. Async rejection is observed once without restoring the badge. It allocates no global listener, observer, portal, or JavaScript timer.
- Consumer renderers, formatters, classes, styles, and safe attributes are trusted developer inputs. No runtime dependency, router coupling, HTML-string API, native range form serialization, DevExpress runtime code, toast behavior, or authorization semantics were introduced.

Phase 19 stories cover every exact value kind, span/swap/range/track interaction, chart/markers, rejection and state, tooltip trigger/placement/interaction/edge/theme cases, and every badge type/appearance/size/shape/semantics/dismissal case. Focused Vitest and Chromium/WebKit browser suites cover exact wires, UTC offset retention, validation, immutable callbacks, SSR/Strict Mode, cleanup, real pointer and keyboard geometry, ARIA ownership, overlay arbitration, forced colors, reduced motion, dark theme, and RTL. Exactly 13 Windows Chromium `phase-19-*` baselines are the acceptance set; older baseline paths are immutable during this phase.

Final Phase 19 verification on 2026-08-29 passed strict TypeScript and ESLint, 50 Vitest files/457 tests, import-cycle analysis across 246 source modules, the 240-module production library build, the 308-module Storybook build, and package verification of 156 runtime exports across 1,161 packed files. Chromium passed all 111 semantic/Axe cases and all 206 visual tests against 214 reviewed Windows baselines. Exactly 13 new `phase-19-*` baselines were added and inspected; every Phase 1–18 snapshot remained stable. WebKit's full run passed 108 cases while exposing two RangeSelector `ResizeObserver` delivery warnings and one transient Phase 13 navigation timeout; after the resize callback was moved to a generation-guarded animation frame and Storybook rebuilt, the affected RangeSelector tests passed 2/2 and the Phase 13 test passed 1/1, giving passing evidence for all 111 cases. The single permitted Firefox launch timed out before page creation with `RenderCompositorSWGL failed mapping default framebuffer`; it was classified as environment-blocked and neither retried nor invoked through the aggregate verifier.

## Phase 20 — Dependency-free React SVG Chart

Phase 20 evidence is pinned to clean CashGear.Blazor.UI commit `51d7689a7d407713fa18cb6268158b1a4f461fb3`. Read-only `git show` inspection covered `Components/Data/Chart/*` and its demo/test counterparts; the separate working tree was not modified.

- `CgChart<TItem>` replaces Razor registration and the DevExpress chart runtime with frozen bar, line, area, pie, and donut descriptors, a pure exact-value source model, a visibility projection, and a separate SVG layout. Resize buckets rebuild only layout. Visibility changes intentionally rebuild stacks, domains, tables, and geometry.
- Finite numbers, bigint, and Phase 19 exact decimal strings share BigInt-backed comparison, stacking, tick, and bounded-ratio operations. Civil dates, local date-times, and instants remain branded strings and never cross the public API as `Date`; explicit date axes reject mixed temporal representations.
- Cartesian category unions preserve declaration order and first duplicates, synthesize gaps, and apply gap/zero/skip policies. Numeric/date scales, indexed 1/2/5/10 ticks, calendar ticks, grouped/horizontal bars, positive/negative/full stacks, monotone paths, area fills, arcs, labels/connectors, constant lines, and annotations are dependency-free pure modules.
- One semantic chart group owns one SVG, one delegated tooltip surface, one live region, and an optional accessible table. Roving graphics-symbol points, physical RTL arrows, cross-series navigation, native legend buttons, accepted-state selection callbacks, responsive measurement, Strict Mode cleanup, and standalone SVG export remain browser-safe and generation-guarded.
- Controlled selection and visibility are proposal-only until the parent reconciles them. Rejected values do not change SVG, legend, or announcements. Export clones inline computed SVG paint/font properties and removes hit targets, focus state, and interactive metadata. Hidden/disabled presentation remains explicitly outside any authorization boundary.

Phase 20 stories cover Cartesian and radial families, grouped/horizontal/positive/negative/full stacking, missing-value policies, exact numeric and all temporal arguments, multiple axes, constants, annotations, labels, selection, legend visibility, tables, loading/empty/too-small states, theme/density/RTL/narrow layouts, dense data, reduced motion, lifecycle/export, and a real resizable Splitter host. Pure Vitest and component suites cover immutable modeling, exact arithmetic, ticks/calendars, geometry/paths, SSR, controlled rejection, callbacks, actions, semantics, and cleanup; Playwright adds delegated pointer/keyboard behavior, resize bucketing, export, forced colors, Axe, and reviewed Phase 20 Windows baselines.

Final Phase 20 verification on 2026-08-31 passed strict TypeScript and ESLint, 52 Vitest files/481 tests, import-cycle analysis across 263 source modules, the 257-module production library build, the 327-module Storybook build, and package verification of 158 runtime exports across 1,245 packed files. Chromium and WebKit each passed all 115 semantic/Axe cases. Chromium produced passing evidence for all 220 visual cases against 228 Windows snapshots: the full run passed 219 while one pre-existing remote ComboBox loading capture resolved to results during screenshot stabilization, and that unchanged test passed 1/1 immediately in isolation. Exactly 14 inspected `phase-20-chart-*` baselines were added, and Git confirms all 214 Phase 1–19 baseline files are unchanged. The aggregate verifier passed through Chromium before Firefox reproduced `RenderCompositorSWGL failed mapping default framebuffer` before page creation; the process tree was stopped as Playwright began replacement workers, no further Firefox command was invoked, and the independently passing package gate was not repeated.

## Phase 21 — React TreeList

Phase 21 is pinned to the clean CashGear.Blazor.UI TreeList at commit `51d7689a7d407713fa18cb6268158b1a4f461fb3`. Read-only `git show` inspection covered the complete `Components/Data/TreeList` implementation, README, contracts, hierarchy/scalability/editing/output/summary/view modules, tests, browser tests, and ERP demos. The separate Blazor working tree was not modified.

- `CgTreeList<TItem, TKey>` is a standalone descriptor-driven React treegrid, not a `CgGrid` subclass or wrapper. Compatible vocabulary is reused for the structured filter AST, sibling sort/group descriptors, aggregate contracts, paging, context menus, popup editing, tokens/icons, and XLSX values; TreeList columns and state remain independently evolvable.
- Flat, nested, node-lazy, and provider sources form a compile-time discriminated union. React keys are intentionally narrower than Blazor keys: non-empty strings and finite numbers only. Parent absence is a tagged union, and root precedence is explicit predicate, explicit absence, then configured sentinel values. JavaScript comparer callbacks are deliberately not exposed.
- Construction, cycle detection, level assignment, projection, descendant walks, check aggregation, and output snapshots are iterative. The default depth is 512 with a hard configurable 10,000 ceiling. Flat duplicates throw; nested repeats are first-parent-wins; missing/self/circular parents route through the explicit orphan policy. Caller data is never mutated.
- Filtering uses the shared safe Filter Core AST and formatted searchable values. Ancestor expansion is transient and never writes controlled expansion state. Highlighting is React `<mark>` text, never raw HTML. Sorting and grouping are sibling-local; namespaced `cg-tl-group:` identities cannot collide with real `string:`/`number:` node tokens.
- Expansion, selection, cell focus, recursive checks, details, and groups are independent. The table uses complete `treegrid` metadata, one roving cell, delegated keyboard handling, physical hierarchy arrows in RTL, visible sibling positions, native mixed checkbox synchronization, and focused-descendant recovery after collapse/filter.
- Root/child/provider/detail/mutation/output operations are abortable and generation-guarded. Stale results cannot reattach removed children, replace newer pages, close newer editors, or restore stale focus. Unknown-key actions return `false`/`null`, and the actions object remains stable for the instance.
- Editing is host-persisted and pessimistic by default; optional optimistic update projections use operation identities so failure, conflict, cancellation, or stale completion cannot roll back a newer edit, and controlled data replacement reconciles the projection. Add/update/delete/move contexts are immutable and carry explicit old/new parent identities, sibling position, attempt/generation/token, signal, and whether loaded data made cycle validation conclusive. Pointer drag-and-drop is deferred; keyboard structural commands and server validation define the Phase 21 move contract.
- Fixed-height row virtualization and fixed-edge/middle column virtualization are implemented; variable-height rows remain intentionally out of scope. Root paging composes `CgPager`; each parent owns its own page/load-more state. Visible/loaded/direct/descendant totals label incomplete loaded trees partial, while complete-subtree values require the authorized batch provider.
- State version 1 persists columns, sibling sorts, filter/mode, groups/collapsed groups, and root/child pages through an explicit host view store. State never confers authorization. Context menus reuse the Phase 10 positioning/dismissal engine and popup editing reuses `CgPopup`.
- XLSX uses safe inline strings, hierarchy indentation, outline levels, RTL, cancellation/snapshot boundaries, and row caps. Complete-tree output fails on incomplete loaded data without an authorized snapshot provider. Browser print has a dedicated hierarchy table. Blazor QuestPDF was adapted to an optional browser-neutral host `pdfExporter`; no PDF or runtime dependency was added.
- SSR render is deterministic and browser-global free; measurement/provider work begins in effects and is cleaned up for Strict Mode and multiple instances. Logical CSS covers sticky/narrow scrolling, dark compact, Arabic RTL, forced colors, reduced motion, and high zoom.

The Phase 21 Storybook group contains 20 deterministic cases: flat accounts, nested BOM, lazy retry/load-more, multiple selection, recursive/incomplete checks, sibling sorting, every filter mode, inline/popup conflict editing, structural operations, provider paging, row/column virtualization, details, grouping/summaries, column personalization, XLSX/print, dark compact, Arabic RTL, narrow mobile, and disabled/permission-limited states. `tests/tree-list.test.tsx` covers the hierarchy, interaction, async, provider, output/action, SSR, Strict Mode, and no-mutation contracts; the verification table records the complete browser semantic/Axe run and all 15 reviewed Windows Chromium TreeList baselines.

## Implemented inventory

“Mirrored” means the user-visible contract is carried across with React/native-DOM adaptations. “Partially mirrored” identifies a deliberate Phase 2 omission. “New React implementation” has no exact Razor component.

| Component | Classification | Razor source/demo | React source | Automated tests | Story | Intentional differences |
| --- | --- | --- | --- | --- | --- | --- |
| `CgIcon` | New React implementation | No exact source | `src/components/Icon/*` | `tests/icon-button-field.test.tsx` | `src/components/Icon/CgIcon.stories.tsx` | Small typed inline-SVG registry; all icons use `currentColor`. |
| `CgButton` | Mirrored | `CG.CompLib/Comp/Buttons/CgButton.*`; `CG.CompLib.Demo/Components/Pages/ButtonDemo.razor` | `src/components/Button/*` | `tests/icon-button-field.test.tsx` | `src/components/Button/CgButton.stories.tsx` | Razor `Visible` is omitted; React callers conditionally render. Async callbacks accept thenables; rejected results are observed. |
| `CgField` | New React implementation | `CG.CompLib/Comp/FormLayout/CgFormLayoutItem.*`; `CG.CompLib/Comp/Inputs/CgInputBase.cs` | `src/components/Field/*`, `src/internal/field/*` | `tests/foundation.test.tsx`, `tests/icon-button-field.test.tsx` | `src/components/Field/CgField.stories.tsx` | Context composes label/message ARIA without cloning children. |
| `CgTextBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTextBox.*`; `CG.CompLib.Demo/Components/Pages/TextBoxDemo.razor` | `src/components/TextBox/*` | `tests/text-box.test.tsx`, `tests/foundation.test.tsx` | `src/components/TextBox/CgTextBox.stories.tsx` | Labels/messages move to `CgField`; IME drafts and native events/attributes are retained. |
| `CgMemo` | Mirrored | `CG.CompLib/Comp/Inputs/CgMemo.*`; `CG.CompLib.Demo/Components/Pages/MemoDemo.razor` | `src/components/Memo/*` | `tests/memo.test.tsx` | `src/components/Memo/CgMemo.stories.tsx` | Native textarea resizing plus `ResizeObserver` replaces the DevExpress implementation. |
| `CgCheckBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*`; `CG.CompLib.Demo/Components/Pages/CheckBoxDemo.razor` | `src/components/CheckBox/*` | `tests/choice-controls.test.tsx` | `src/components/CheckBox/CgCheckBox.stories.tsx` | Boolean/`indeterminate` only; C# numeric/string mappings are intentionally omitted. |
| `CgComboBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgComboBox.*`; `CG.CompLib.Demo/Components/Pages/ComboBoxDemo.razor` | `src/components/ComboBox/*`, `src/internal/PositionedOverlay.tsx` | `tests/combo-box.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/ComboBox/CgComboBox.stories.tsx` | Object-valued selection uses required stable keys for identity and form serialization; `CgKeyComboBox` adapts scalar-key models. |
| `CgKeyComboBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgKeyComboBox.*`; `CG.CompLib.Demo/Components/Pages/Home.razor` | `src/components/KeyComboBox/*` | `tests/key-combo-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/KeyComboBox/CgKeyComboBox.stories.tsx` | React keys are strings or finite numbers, `null` is the explicit empty value, and `selectedItem` provides synchronous off-page hydration. |
| `CgLookUpGrid` | Mirrored with focused lookup descriptors | `CG.CompLib/Comp/Inputs/CgLookUpGrid.*`; `CgLookUpGrid*Tests.cs`; `LookUpGridDemo.razor`; `LookUpGridErpDemo.razor` | `src/components/LookUpGrid/*` | `tests/look-up-grid.test.tsx`, browser semantic/visual coverage | `src/components/LookUpGrid/CgLookUpGrid.stories.tsx` | Immutable descriptors, AbortSignal loaders/resolvers, `null`, caller-owned query-context equality, and a native form proxy replace registration, cancellation tokens, and EditContext. No virtualization prop is exposed. |
| `CgFileUploader` | Mirrored with native file/endpoint adaptation | `CashGear.Blazor.UI@6fc1e4577fbb2a492150f991945c478fac8a917f: Components/Editors/CgFileUploader.*`, `CgFileUpload*` | `src/components/FileUploader/*` | `tests/file-uploader.test.tsx`, `tests/file-uploader-protocol.test.ts`, browser semantic/Axe/visual/protocol-harness coverage | `src/components/FileUploader/CgFileUploader.stories.tsx` | React owns frozen queue snapshots and AbortSignal generations; fetch/XHR implements the compatible v2 endpoint protocol. Native hidden inputs replace EditContext and expose only durable stored-file serialization. |
| `CgSplitter` | Mirrored with immutable pane descriptors | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: CgSplitter.*`, Splitter scripts/tests/demo | `src/components/Splitter/*` | `tests/splitter-state.test.ts`, `tests/splitter.test.tsx`, browser semantic/Axe/geometry/visual coverage | `src/components/Splitter/CgSplitter.stories.tsx` | Frozen descriptor/context snapshots and versioned state replace Razor registration. Flex, pointer capture, ResizeObserver, and physical RTL keyboard input replace the Blazor JS instance. |
| `CgDrawer` | Mirrored with persistent inline regions | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: CgDrawer.*`, Drawer scripts/tests/demo | `src/components/Drawer/*`, shared overlay internals | `tests/drawer.test.tsx`, browser semantic/Axe/overlay/focus/visual coverage | `src/components/Drawer/CgDrawer.stories.tsx` | One mounted subtree and matchMedia replace conditional Razor regions and its responsive JS handle; the shared React overlay stack owns modal isolation, focus, Escape/outside pairs, and scroll locking. |
| `CgRangeSelector` | Mirrored with exact discriminated values | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: Components/Data/RangeSelector/*`, demos/tests | `src/components/RangeSelector/*` | `tests/range-selector-value.test.ts`, `tests/range-selector.test.tsx`, browser semantic/Axe/geometry/visual coverage | `src/components/RangeSelector/CgRangeSelector.stories.tsx` | One frozen atomic value and exact BigInt-backed decimal/temporal wires replace generic C# values and the Blazor JS handle; no `Date`, form serialization, or arbitrary adapter is exposed. |
| `CgChart` | Mirrored with dependency-free SVG descriptors | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: Components/Data/Chart/*`, demos/tests | `src/components/Chart/*` | `tests/chart-engine.test.ts`, `tests/chart.test.tsx`, browser semantic/Axe/interaction/visual coverage | `src/components/Chart/CgChart.stories.tsx` | Frozen descriptors and exact BigInt-backed models replace Razor registration and the DevExpress runtime. Visibility projection, layout, delegated interaction, accessible tables, and sanitized standalone SVG export remain separate. |
| `CgTreeList` | Mirrored with iterative immutable hierarchy engine | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: Components/Data/TreeList/*`, tests/browser tests/demos | `src/components/TreeList/*` | `tests/tree-list.test.tsx`, Phase 21 browser semantic/Axe/interaction/visual coverage | `src/components/TreeList/CgTreeList.stories.tsx` | Typed flat/nested/provider union and primitive keys replace Razor registration/comparers. Shared Filter/Grid vocabulary is composed without public Grid inheritance. QuestPDF becomes a host PDF adapter; pointer DnD and variable-height virtualization are deferred. |
| `CgTooltip` | Mirrored through the shared overlay engine | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: Components/Feedback/Tooltip/*`, demos/tests | `src/components/Tooltip/*`, `src/internal/PositionedOverlay.tsx` | `tests/tooltip.test.tsx`, browser semantic/Axe/placement/visual coverage | `src/components/Tooltip/CgTooltip.stories.tsx` | A stable wrapper, lazy body portal, exact descendant ARIA token ownership, and click-only overlay registration replace Blazor element handles without adding disclosure or focus semantics. |
| `CgStatusBadge` | Mirrored as resource-free presentation | `CashGear.Blazor.UI@51d7689a7d407713fa18cb6268158b1a4f461fb3: Components/Feedback/StatusBadge/*`, demos/tests | `src/components/StatusBadge/*` | `tests/status-badge.test.tsx`, browser semantic/Axe/visual coverage | `src/components/StatusBadge/CgStatusBadge.stories.tsx` | Role remains opt-in, icon/indicator content is decorative, and native one-shot dismissal observes async rejection without becoming a toast or allocating global resources. |
| `CgListBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgListBox.*`, `CgListBoxTypes.cs`, `CgListBoxColumn.cs`, `CgListBoxAccessors.cs`; `CG.CompLib.Demo/Components/Pages/ListBoxDemo.razor` | `src/components/ListBox/*`, `src/internal/listBox.ts`, `src/internal/useVirtualWindow.ts` | `tests/list-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/ListBox/CgListBox.stories.tsx` | Object-array binding and stable keys replace Razor field accessors. Fixed-row virtualization is dependency-free; remote loading/paging and richer data-grid operations remain deferred. |
| `CgTagBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTagBox.*`; `CG.CompLib.Demo/Components/Pages/TagBoxDemo.razor` | `src/components/TagBox/*`, `src/internal/tagBox.ts`, `src/internal/PositionedOverlay.tsx` | `tests/tag-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/TagBox/CgTagBox.stories.tsx` | Object-array binding replaces Razor scalar keys. Custom comparers and `ResolveValuesAsync` hydration remain deferred because selected objects carry labels. |
| `CgDropDownBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgDropDownBox.*`, `CgDropDownBoxTypes.cs`; `CG.CompLib.Demo/Components/Pages/DropDownBoxDemo.razor` | `src/components/DropDownBox/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts` | `tests/drop-down-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/DropDownBox/CgDropDownBox.stories.tsx` | React render contexts host arbitrary content; a native select proxy and explicit object serializer replace Blazor `EditContext` integration. The body portal replaces the browser manual-popover top layer and deliberately adds no focus trap. |
| `CgDateEdit` | Mirrored with canonical React value contract | `Components/Editors/CgDateEdit*`, shared Calendar/date utilities; `DateEditDemo.razor` | `src/components/DateEdit/*`, `src/components/Calendar/*`, `src/internal/date/*` | `tests/date-edit.test.tsx`, browser semantic/visual coverage | `src/components/DateEdit/CgDateEdit.stories.tsx` | React exposes only canonical `YYYY-MM-DD | null` civil dates and composes the shared public Calendar without exposing JavaScript `Date`. |
| `CgCalendar` | Mirrored with canonical single/range contracts | `Components/Editors/Calendar/*`; `CgCalendarTests.cs` | `src/components/Calendar/*`, `src/internal/date/*` | `tests/calendar.test.tsx`, browser semantic/Axe/visual coverage | `src/components/Calendar/CgCalendar.stories.tsx` | Canonical civil strings and immutable ranges replace .NET date types; first-click range state stays private. |
| `CgDateRangePicker` | Mirrored with native form adaptation | `Components/Editors/CgDateRangePicker*`; date-range tests/demos | `src/components/DateRangePicker/*`, shared Calendar/overlay/date internals | `tests/date-range-picker.test.tsx`, browser semantic/Axe/visual coverage | `src/components/DateRangePicker/CgDateRangePicker.stories.tsx` | Two native proxies replace EditContext fields; exact manual parsing preserves invalid drafts and controlled invalid values. |
| `CgToastProvider` | Mirrored as a provider-local React API | `Components/Feedback/Toast/*`; toast tests/demos | `src/components/Toast/*` | `tests/toast.test.tsx`, browser semantic/Axe/visual coverage | `src/components/Toast/CgToast.stories.tsx` | Context-local queues replace scoped services; router integration is an explicit subscriber. |
| `CgConfirmationProvider` | Mirrored as a promise API | `Components/Feedback/Confirmation/*`; `CgConfirmationTests.cs` | `src/components/Confirmation/*`, `src/components/Popup/*` | `tests/confirmation.test.tsx`, browser semantic/Axe/visual coverage | `src/components/Confirmation/CgConfirmation.stories.tsx` | Promise booleans and AbortSignal replace service result objects and cancellation tokens; unmount rejects pending work. |
| `CgFlyout` | Mirrored | `CG.CompLib/Comp/Overlays/CgFlyout.*`, `CgFlyoutCloseReason.cs`, `CgPlacement.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/FlyoutDemo.razor` | `src/components/Flyout/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/flyout.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Flyout/CgFlyout.stories.tsx` | React supports element/ref/selector and virtual anchors through a body portal. Private React context plus DOM owner/boundary IDs replace Blazor cascading ownership and JS module handles. |
| `CgMenu` | Mirrored with React descriptor adaptation | `CG.CompLib/Comp/Menu/*`; `CG.CompLib.Demo/Components/Pages/MenuDemo.razor` | `src/components/Menu/*`, `src/internal/menu*.ts`, `src/internal/MenuSurface.tsx` | `tests/menu.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Menu/CgMenu.stories.tsx` | Immutable nested/flat descriptors replace declaration-only Razor items. Native anchors and optional `currentLocation`/`onNavigate` replace router coupling; automatic SSR begins with the complete desktop tree. |
| `CgContextMenu` | Mirrored with typed target-hook adaptation | `CG.CompLib/Comp/ContextMenu/*`; `CG.CompLib.Demo/Components/Pages/ContextMenuDemo.razor` | `src/components/ContextMenu/*`, shared private menu engine | `tests/context-menu.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/ContextMenu/CgContextMenu.stories.tsx` | `useCgContextMenuTarget` composes refs/handlers without wrapper DOM or string IDs. Every invocation is typed and abortable; confirmation requires an explicit callback instead of a global service. |
| `CgDropDownButton` | Mirrored | `CG.CompLib/Comp/Buttons/CgDropDownButton.razor`, `CgButtonMenu*`; `ButtonMenusDemo.razor` | `src/components/DropDownButton/*`, shared private menu engine | `tests/button-menu.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/DropDownButton/CgDropDownButton.stories.tsx` | Immutable descriptors or a mutually exclusive arbitrary dialog render callback replace Razor fragments. The existing `CgButton` is solely the trigger. |
| `CgSplitButton` | Mirrored | `CG.CompLib/Comp/Buttons/CgSplitButton.razor`, `CgButtonMenu*`; `ButtonMenusDemo.razor` | `src/components/SplitButton/*`, `src/components/DropDownButton/ButtonMenu.tsx` | `tests/button-menu.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/SplitButton/CgSplitButton.stories.tsx` | Primary action/form/busy behavior remains on `CgButton`; the logical toggle is isolated and disabled when no visible enabled leaf exists. |
| `CgToolbar` | Mirrored with pure React layout planner | `CG.CompLib/Comp/Toolbar/*`; Toolbar demo family | `src/components/Toolbar/*`, `src/internal/toolbarLayout.ts` | `tests/toolbar.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Toolbar/CgToolbar.stories.tsx` | A container `ResizeObserver` drives a pure deterministic stage plan; links remain semantic anchors and menu/split branches reuse the Phase 10 button surfaces. |
| `CgLayoutBreakpoint` / `useCgLayoutBreakpoint` | Mirrored with SSR-safe React hook | `CG.CompLib/Comp/Layout/CgLayoutBreakpoint.*`; `LayoutBreakpointDemo.razor` | `src/components/LayoutBreakpoint/*` | `tests/layout-breakpoint.test.tsx`, browser semantic/boundary coverage | `src/components/LayoutBreakpoint/CgLayoutBreakpoint.stories.tsx` | `matchMedia` replaces the Razor JS module; hydration starts from `defaultMatches`, listeners are generation-safe, and exact named boundaries are preserved. |
| `CgTabs` | Mirrored with immutable descriptors | `CG.CompLib/Comp/Tabs/*`; `TabsDemo.razor*` | `src/components/Tabs/*`, `src/internal/keyedCollection.ts`, `src/internal/rovingFocus.ts` | `tests/tabs.test.tsx`, browser semantic/visual coverage | `src/components/Tabs/CgTabs.stories.tsx` | Immutable keyed descriptors replace `CgTabPage` registration. Close is request-only, reordering is pointer-capture based, and on-demand panels retain visited React state. |
| `CgStepper` | Mirrored with immutable descriptors | `CG.CompLib/Comp/Stepper/*`; `StepperDemo.razor*` | `src/components/Stepper/*`, shared keyed/focus helpers | `tests/stepper.test.tsx`, browser semantic/visual coverage | `src/components/Stepper/CgStepper.stories.tsx` | Immutable steps replace `CgStep` declarations. Abortable guards execute current → target → global, and controlled selection remains authoritative. |
| `CgAccordion` | Mirrored with immutable tree descriptors | `CG.CompLib/Comp/Accordion/*`; `AccordionDemo.razor*` | `src/components/Accordion/*`, `src/internal/accordionTree.ts`, `src/internal/routeMatch.ts` | `tests/accordion.test.tsx`, browser semantic/visual coverage | `src/components/Accordion/CgAccordion.stories.tsx` | Nested or flat descriptors replace child registration. Safe route primitives are router-free; filtering and per-key lazy loading remain owned by the component. |
| `CgTreeView` | Mirrored with immutable hierarchy descriptors | `CG.CompLib/Comp/TreeView/*`; `CgTreeViewTests.cs`, `CgTreeViewBrowserTests.cs`; `TreeViewDemo.razor*` | `src/components/TreeView/*`, private `src/internal/treeViewModel.ts`, `treeViewCheck.ts`, `treeViewFilter.ts` | `tests/tree-view.test.tsx`, browser semantic/Axe/visual coverage | `src/components/TreeView/CgTreeView.stories.tsx` | Nested or flat descriptors replace node registration. React owns stable-key state and safe filtering; menus compose the Phase 10 `CgContextMenu`. Lazy loading, virtualization, drag/drop, editing, and TreeList APIs are not included. |
| `CgFilterBuilder` | Mirrored with a shared safe AST | Grid/filter reference contracts and tests | `src/filter/*`, `src/components/FilterBuilder/*` | `tests/filter-core.test.ts`, `tests/filter-builder.test.tsx`, browser semantic/visual coverage | `src/components/FilterBuilder/CgFilterBuilder.stories.tsx` | Explicit accessors, immutable descriptors, typed values, and Razor boundary codecs replace expressions/reflection. |
| `CgPager` | Mirrored as a standalone controlled component | Grid pager reference contracts and tests | `src/components/Pager/*` | `tests/pager.test.tsx`, Grid integration and browser coverage | `src/components/Pager/CgPager.stories.tsx` | Zero-based state/one-based display and SSR-safe measurement replace ambient Grid ownership. |
| `CgGrid` | Advanced parity with typed React descriptors | `CG.CompLib/Comp/Grid/*`; `CgGrid*Tests.cs`; `GridDemo.razor` | `src/components/Grid/*` | `tests/grid*.test.tsx`, browser semantic/visual coverage | `src/components/Grid/CgGrid.stories.tsx`, `CgGridAdvanced.stories.tsx` | Immutable descriptors/actions replace registration; providers receive sanitized requests plus `AbortSignal`; popup/inline/cell/atomic batch editing and custom aggregates are caller-persisted. Cell/batch modes support compatible-editor type-to-edit and optional Enter advancement across visible data rows. The remaining gaps are the explicit Phase 15 out-of-scope items. |
| `CgFormLayout` family | Mirrored with real React composition | `CG.CompLib/Comp/FormLayout/*`; `FormLayoutDemo.razor*` | `src/components/FormLayout/*`, `src/internal/formLayout.ts`, private field caption context | `tests/form-layout.test.tsx`, browser semantic/visual coverage | `src/components/FormLayout/CgFormLayout.stories.tsx` | React context and CSS container queries replace declaration inspection and registration. Descriptor tabs replace tab-page markers; no compatibility alias is exported. |
| `CgPopup` | Mirrored | `CG.CompLib/Comp/Overlays/CgPopup.*`, `CgOverlayBase.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor` | `src/components/Popup/*`, `src/internal/OverlaySurface.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/popup.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Popup/CgPopup.stories.tsx` | A body-portalled backdrop/surface replaces native top-layer APIs. React owns focus isolation, exact scroll-style restoration, and full-region render contexts. |
| `CgWindow` | Mirrored | `CG.CompLib/Comp/Overlays/CgWindow.*`, `CgOverlayBase.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor` | `src/components/Window/*`, `src/internal/OverlaySurface.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/window.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Window/CgWindow.stories.tsx` | React modeless windows use a global paint order below modals, scoped Escape ownership, and DOM/ref/selector positioning actions instead of .NET/JS handles. |
| `CgMaskedInput` | Mirrored with native-form adaptation | `CG.CompLib/Comp/Inputs/CgMaskedInput.*`, `CgMaskedInputTypes.cs`, `CgMaskParser.cs`, `CgMaskState.cs`; `CG.CompLib.Demo/Components/Pages/MaskedInputDemo.razor` | `src/components/MaskedInput/*`, `src/internal/mask.ts` | `tests/masked-input.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/MaskedInput/CgMaskedInput.stories.tsx` | Unicode property matching and UTF-16 caret maps implement the mask without DevExpress. A private native proxy replaces Blazor `EditContext` submission/validation. |
| `CgSwitch` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*` switch mode | `src/components/Switch/*` | `tests/choice-controls.test.tsx` | `src/components/Switch/CgSwitch.stories.tsx` | Extracted as a separate two-state component. The source has no pending state, so React does not add one. |
| `CgRadio` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadio.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/Radio/*` | `tests/choice-controls.test.tsx` | `src/components/Radio/CgRadio.stories.tsx` | Native grouping is preserved for uncontrolled same-name radios; typed string/number values replace C# conversion. |
| `CgRadioGroup` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadioGroup.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/RadioGroup/*` | `tests/choice-controls.test.tsx` | `src/components/RadioGroup/CgRadioGroup.stories.tsx` | Generic React options replace reflection-based field-name mapping. |
| `CgNumericEdit` | New React implementation | No exact source; informed by `CG.CompLib/Comp/Inputs/CgNumberInput.*` and `CgSpinEdit.*` | `src/components/NumericEdit/*`, `src/internal/numeric.ts` | `tests/numeric-editors.test.tsx` | `src/components/NumericEdit/CgNumericEdit.stories.tsx` | `number | null`, strict `Intl.NumberFormat` parsing, and IEEE-754 arithmetic; not arbitrary-precision decimal. |
| `CgSpinEdit` | Mirrored with React extension | `CG.CompLib/Comp/Inputs/CgSpinEdit.*`; `CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor` | `src/components/SpinEdit/*`, private `src/internal/numericExpression.ts` | `tests/numeric-expression.test.ts`, `tests/numeric-editors.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/SpinEdit/CgSpinEdit.stories.tsx`, Grid spreadsheet story | Draft stepping, the Razor null-start policy, locale-aware arithmetic drafts, immediate complete-draft publication, hidden buttons, and input-mode selection are implemented; evaluator and pointer-repeat timing remain private. |
| `CgSearchBox` | Mirrored | Working-tree `CG.CompLib/Comp/Inputs/CgSearchBox.*`; `CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor` | `src/components/SearchBox/*` | `tests/search-box.test.tsx` | `src/components/SearchBox/CgSearchBox.stories.tsx` | Does not fetch data; caller receives the raw query, reason, monotonic request ID, and `AbortSignal`. |
| `CgLoadingPanel` | Mirrored with React extension | `CG.CompLib/Comp/Overlays/CgLoadingPanel.*`; `CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor` | `src/components/LoadingPanel/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts`, `src/internal/inert.ts` | `tests/loading-progress.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/LoadingPanel/CgLoadingPanel.stories.tsx` | Focus containment is opt-in; external targets are covered by body-portal fixed geometry and missing targets still fall back safely. |
| `CgProgressBar` | New React implementation | No exact source | `src/components/ProgressBar/*` | `tests/loading-progress.test.tsx` | `src/components/ProgressBar/CgProgressBar.stories.tsx` | Native React progress semantics, logical RTL fill, and reduced-motion support. |

The shared hook/primitives layer is covered in `tests/foundation.test.tsx`. The exact runtime export allow-list is guarded by `tests/public-api.test.ts`.

## Phase 12 TreeView behavior

- A private pure hierarchy model validates and clones neither descriptors nor their payloads: it records derived nodes separately, trims and validates required unique keys, rejects nested/flat mixtures, missing or self parents, cycles, and depth beyond 64, then builds roots, complete preorder, key/parent/child maps, visible/selectable/checkable subsets, sibling metadata, and descendant check indexes. Hidden ancestors suppress rendering without deleting descendants from the complete model. No engine type is exported.
- `selectedKey`, `expandedKeys`, `checkedKeys`, and `filterText` each support controlled and uncontrolled use. Controlled props remain authoritative; stable-key reconciliation removes unknown or unavailable state, emits deduplicated non-user correction details, preserves reordered nodes, and recovers focus to a selected rendered node or the first enabled rendered node. Caller arrays, sets, descriptors, and payloads are never mutated.
- Row activation, disclosure, and checking are isolated proposal paths. Abortable selection and expansion guards supersede stale work and observe rejection. Recursive checking changes every eligible descendant in the complete model, leaves disabled/non-checkable nodes alone, and derives checked/mixed ancestors; multiple mode changes one key only.
- The optional `CgTextBox` filter retains an IME-safe draft, honors trimmed minimum eligibility, performs locale-aware case-insensitive contains matching across plain text and `searchText`, safely highlights string fragments, preserves ancestors, and transiently expands match paths without touching committed expansion. Rich labels require `searchText` or a predicate.
- React owns the structural `tree`, `treeitem`, and `group` roles, stable instance-scoped IDs, level/position/set-size/selection/expansion/check/disabled ARIA, and exactly one roving tab stop. Down/Up wrap; Home/End bound; physical Right/Left expand, descend, collapse, or ascend unchanged under RTL; Enter activates; Space checks or selects; Shift+F10 and Menu invoke the node menu. Read-only retains focus and navigation while suppressing mutations.
- Node and empty-area commands reuse the Phase 10 `CgContextMenu` lifecycle and target-independent action surface. Opening never changes selection; default commands revalidate the live key before activation, expansion/checking, or copy-key execution. Customization, activation observation, failure handling, focus restoration, and owner cleanup remain authoritative in `CgContextMenu`.
- Public surface is `CgTreeView`, immutable descriptors, render/lifecycle/context details, and `CgTreeViewActions`; there is no `CgTreeViewNode` registration marker and no speculative TreeList API. Stories cover nested/flat, controlled, check modes, filtering, dynamic reconciliation, menus, disabled/read-only, empty, dark compact, Arabic RTL, narrow wrapping, and keyboard focus states.

## Phase 11 descriptor-layout behavior

- Shared private keyed validation, collection reconciliation, stable DOM IDs, roving movement, controlled-proposal acceptance, and safe route matching serve multiple families. Menu URL/route behavior now uses the safe primitives without a public API change; Accordion keeps its specialized tree/filter/load engine private.
- LayoutBreakpoint validates a mutually exclusive named band or inclusive integer bounds and renders SSR/hydration from `defaultMatches`. Query replacement detaches modern or legacy listeners, duplicate notifications are suppressed, and stale listener generations cannot commit.
- Tabs retain caller descriptors, render stable tab/panel relationships, skip disabled tabs for roving focus, and keep close controls outside tab ownership. Manual activation, logical RTL arrows, Delete close, pointer-threshold midpoint reordering, native/button overflow, active-only/all/on-demand content, and imperative focus/activation/scroll actions are covered.
- Stepper reconciles removed selection to the nearest prior available step, then the first available step. Linear forward motion reaches only the next available step; current `canLeave`, target `canEnter`, and global `beforeSelectionChange` are abortable and ordered. Parent selection bypasses guards, controlled rejection restores the authoritative indicator/focus, and accepted transitions alone produce after-events.
- Accordion validates nested or flat trees before pruning, including depth 64, missing/self parents, cycles, hierarchy mixing, unsafe URLs, and lazy configuration. Expansion modes propose one complete key set, routing chooses the longest safe normalized match, filtering preserves ancestors with transient expansion and safe fragments, and one abortable cached lazy request is maintained per key.
- Accordion auto-semantics select tree behavior for hierarchical/navigation/lazy data and disclosure behavior for flat panels. Anchors remain separate from expansion controls; retained on-demand content, reduced motion, forced colors, dark/compact, narrow layout, errors, retry, and busy announcements are included.
- FormLayout uses composition context only. Item spans default to `12/12/6/6/6/6`; groups and tab containers default to all 12. Root, group bodies, and tab panels establish inline-size containers with breakpoints at 576/768/992/1200/1400px; horizontal captions switch to two tracks at 560px.
- FormLayout emits a native label only for `captionFor`; otherwise compatible field controls resolve their accessible name in the order explicit `aria-label`, explicit `aria-labelledby`, `CgField`, then FormLayout caption. Collapsed groups remain mounted and hidden, while descriptor tabs inherit root size/direction, provide a fresh nested container, and default to retained on-demand content.
- Public exports include only the components/hook plus descriptor, props, actions, render-context, lifecycle, reason, and detail types. No dependencies, router coupling, Razor registration mechanism, DevExpress code, or copied asset was added.

## Phase 10 command-surface behavior

- One private engine (`menuTree`, `menuNavigation`, `menuLayout`, and `MenuSurface`) validates and clones caller-owned trees, retains opaque data/functions/renderers by reference, normalizes visibility/groups/separators, proposes check/radio state, rejects dangerous or obfuscated schemes, and owns menu ARIA, roving focus, locale typeahead, logical RTL arrows, timers, and keyed focus across portals. Every floating level is an owned `CgFlyout`; no engine type is exported from the package root.
- `CgMenu` supports navigation and application-menu semantics, controlled/uncontrolled selection and expansion, exact/prefix route selection, native link behavior, and container-based full → adaptive/icon → hamburger planning. Automatic SSR renders one deterministic complete desktop tree; post-hydration movement never creates duplicate interactive commands.
- `CgContextMenu` supersedes and aborts stale invocations, delays its noninteractive busy surface by 150ms, revalidates customized snapshots, enforces explicit confirmation integration, and runs validation → confirmation → transient proposal → cancellable before-command → global activation → item command → success/failure observation. Cancelled or failed work rolls proposals back. Forced navigation/owner-loss/supersession/unmount closes cannot be vetoed.
- The target hook composes existing handlers and refs and implements right-click, Shift+F10/Menu, optional click, and 600ms/10px long press with owner-specific cleanup. Button menus focus their first command/control, restore their trigger, observe async failures, ignore duplicate activation, and honor `{ keepOpen: true }` from either callback.
- Toolbar filters hidden commands before independently planning start/end rails. It dispatches plain commands, menu-only branches, primary-action branches, semantic links, and managed custom content exactly once. Adaptation is full text → adaptive text → icon-only → one-at-a-time overflow; lower priority/later items move first and widening restores the exact reverse order while respecting always/never overflow and minimum-visible rules.
- Phase 9 Flyout gained additive focus-loss dismissal and focus-return switches through the existing overlay registry. Native navigation preserves modifier, middle-click, target, context-menu, and consumer `preventDefault` behavior; same-window Toolbar navigation waits for its async activation pipeline.
- Exactly 21 Phase 10 Windows Chromium baselines were added: five Menu, six ContextMenu, five button-menu, and five Toolbar snapshots. All 95 earlier baselines remained byte-for-byte unchanged.

## Phase 9 shared overlay behavior

- One private registry now owns deterministic transient/window/modal ordering, global Escape, matched pointer-down/up dismissal, parent/child ownership, exclusive root groups, and `data-cg-overlay-boundary` markers. DateEdit, DropDownBox, ComboBox, TagBox, and LoadingPanel retain their public contracts while using that registry.
- Portalled descendants inherit ownership through React context and DOM owner IDs, so nested overlays and third-party boundary-marked portals count as inside ancestors. Outside dismissal proceeds top-down and stops when a child refuses to close; exclusive Flyout opening waits for the incumbent root to accept `superseded`.
- `PositionedOverlay` retains the legacy editor sizing branch while adding point/rectangle anchors, logical RTL placement, configurable offset/flip/shift, CSS constraints, explicit revisions, and visual viewport, zoom, nested-scroll, mutation, and resize observation.
- Body portals copy `data-cg-theme`, `data-cg-density`, and computed direction. They deliberately avoid Popover/top-layer dependencies and copy no Razor or DevExpress assets.
- Flyout, Popup, and Window lifecycle proposals share abortable `onBeforeOpen`/`onBeforeClose` work, rejection observation, stale-completion guards, authoritative controlled props, rendered-transition after-hooks, retained-content modes, and unmount cleanup without a fabricated close.

## Phase 9 Flyout behavior

- Anchors accept connected elements, refs, valid selectors, finite points, and nonnegative finite rectangles. Malformed selectors and invalid geometry throw configuration errors; disappearance of a valid DOM anchor closes with `anchorLost`.
- Flyout is non-modal and non-trapping. It supports all twelve logical placements, offset/flip/shift, anchor-width matching, CSS size constraints, scrolling, resizing, scroll/escape/outside switches, exclusive groups, and open/close/toggle/reposition/focus actions.
- Resize triggers anchored repositioning. Nested owned portals survive ancestor outside gestures, matched pointer pairs prevent a selection begun inside from closing outside, and Escape closes the topmost accepted owner first.

## Phase 9 Popup behavior

- Popup is always modal and renders a body-portalled visible or transparent backdrop without native top-layer APIs. `dialog`/`alertdialog`, `aria-modal`, explicit accessible names, and nonempty standard-header fallback are enforced without referencing an empty replacement header.
- Only the topmost modal traps focus. Entry prefers `[data-cg-autofocus]`, then a usable body control, then the surface; accepted close restores a connected opener. Nested modal isolation recomputes inert body siblings, reference-counts scroll locking, and restores exact body/root styles and scroll coordinates.
- Shared surface composition supports node/text precedence, children-as-body shorthand, inferred footer visibility, full-region render replacements, size/CSS constraints, controlled or default positions, alignment, scrolling, drag, eight-edge resize, 12px viewport reachability, and sub-768px adaptivity.

## Phase 9 Window behavior

- Window reuses surface composition, lifecycle, content retention, portal inheritance, focus entry, drag/resize, computed CSS constraints, and viewport reachability without modal isolation or trapping.
- Global modeless paint order raises on pointer or focus entry while active modals and descendants remain above windows. Escape is scoped to the focused/event-owning window; a background close never steals focus, and an owned close restores focus only when appropriate.
- `position` remains authoritative over alignment and rejected controlled moves snap back. `showAt`, `showAtPoint`, `showNear`, `moveTo`, and `moveToPoint` report `showAt`, `showNear`, or `move`; dragging reports `drag`. Invalid or missing selector targets reject actionably.

## Phase 9 MaskedInput behavior

- The pure private compiler parses Unicode code points and implements required `0`/`L`/`A`/`*`, optional `9`/`l`/`a`/`?`, and backslash literals. It rejects empty masks and trailing escapes; Unicode `Nd`/`L` categories and printable exclusions replace ASCII-only matching.
- External raw or formatted strings normalize into slots while rejected, extra, and misplaced characters remain explicit invalid evidence. Prompt characters never enter bound values; `always`, `onFocus`, and `never` display modes preserve compact literals and interior spacing.
- UTF-16 caret maps cover typing, replacement, Backspace/Delete, paste, cut, Home/End/arrows, pointer/touch selection, fallback input events, and composition. Controlled edits provide immediate caret feedback, then restore authoritative slots and a nearby caret when the parent rejects them.
- InputShell, field context, and a private form proxy compose validation/description IDs and submit only committed raw or formatted values. External forms, reset, required/incomplete/custom validity, disabled exclusion, invalid-focus transfer, SSR, Unicode, RTL, and semantic-only authoritative transition callbacks are covered.
- Exactly 19 Phase 9 Windows Chromium baselines were added: four Flyouts, five Popups, four Windows, and six MaskedInputs. No pre-Phase-9 image was regenerated.

## Phase 8 DateEdit behavior

- The public value is exclusively canonical proleptic-Gregorian `YYYY-MM-DD | null` in the range `0001-01-01` through `9999-12-31`. Invalid external strings remain visible verbatim and invalid; valid values restricted by bounds or `isDateDisabled` remain formatted and invalid without mutation.
- Edit/display patterns accept exactly `yyyy`, `M`, `MM`, `MMM`, `MMMM`, `d`, and `dd`. Punctuation and whitespace are exact literals, alphabetic literals require quotes, locale digits and localized month names parse without heuristics, and bidi marks are ignored. Locale numeric-part order supplies the default edit pattern; display defaults to edit.
- Committed value, focused draft, validation, popup, visible period, day/month/year panel, and roving focus are separate. Enter and valid blur commit; invalid drafts persist; Escape restores authoritative text or closes and returns focus. Controlled value/open rejection remains authoritative.
- Manual input, calendar days, and Today share bounds/disabled enforcement and one cancellable change pipeline. New attempts abort older `onBeforeValueChange` work, stale completions cannot commit, unmount aborts pending work, and non-abort errors use the supplied observer or `console.error` fallback.
- The hidden native multi-select proxy contains only the committed canonical value. It supplies nested/external form association, required/custom validity, disabled exclusion, reset, and invalid-focus transfer while display text is never submitted. Reset restores uncontrolled defaults, closes, aborts pending work, and emits no value change.
- The private six-week calendar retains semantic day buttons inside gridcells, adjacent-month dates, locale headers/week starts, three-column month/year panels, custom day content, logical RTL navigation, and no focus trap. It reuses the SSR-safe positioned portal and live overlay stack for viewport/nested-scroll/zoom/anchor handling and topmost dismissal.
- Exactly eight Phase 8 Windows Chromium baselines cover the default editor, open calendar, invalid input, restrictions, year panel, dark theme, Arabic RTL, and narrow layout. DateRangePicker remains explicitly deferred.

## Phase 7 KeyComboBox behavior

- The adapter binds a `string | number | null` key while reusing ComboBox filtering, remote cancellation, keyboard interaction, ARIA ownership, portal positioning, validation, and form behavior without new CSS or overlay code.
- Controlled and default keys resolve against local options first, `selectedItem` second, and the last accepted user selection third. Local replacement objects refresh the caption without emitting a key change; unmatched keys render empty and remain invalid when required.
- `Object.is` is the default key comparison and `isValueEqual` supports application-specific identity. Zero remains a valid numeric key, clearing emits `null`, and uncontrolled reset emits the default key.
- `onValueChange` reports the scalar key plus the current and previous item/key context. Controlled parent rejection remains authoritative, and an accepted remote selection is retained even when it is absent from a local source.
- Unit, cross-browser semantic/Axe, native form, controlled rejection, and one canonical Windows Chromium primary snapshot cover the adapter-specific contract. Inherited visual states remain covered by ComboBox baselines.

## Phase 6 DropDownBox behavior

- Generic controlled/uncontrolled values treat `null` as empty by default while custom empty/equality policies preserve falsey primitives and application records. Controlled value/open proposals remain authoritative after parent rejection and while an explicit popup is open.
- Immediate hosted content commits through the context. Explicit opening snapshots committed state; Apply commits once, while accepted Cancel/Escape/outside/ancestor-scroll/anchor-loss/programmatic closes restore the committed snapshot. Cancelled closes preserve pending content.
- Callback order is value change, display-text change, committed notification, then automatic close lifecycle. `onBeforeOpen`/`onBeforeClose` receive abort signals; newer work and unmount abort stale thenables, lifecycle rejection is observed, and after callbacks are rejection-safe.
- Primitive form values serialize automatically. Named object/collection values require `serializeValue`; the internal native select proxy supports one or multiple values, nested/external forms, required validity, disabled exclusion, reset, and invalid-focus transfer. Display text is never submitted.
- Input and action refs, typed editor buttons, custom display/header/footer/status templates, status precedence, native attributes, F4/Alt+ArrowDown, focus-on-open/return, and topmost stacked Escape retain hosted controls' keyboard ownership without a focus trap.
- The private SSR-safe positioned overlay supports all twelve logical placements, four width modes, CSS constraints, optional resize/scroll ownership, viewport flip/shift, zoom/resize/nested-scroll tracking, readiness, anchor loss, and ancestor-scroll dismissal. Portal surfaces copy theme, density, and direction while the legacy ComboBox/TagBox geometry path remains pixel-identical.
- Focused Vitest, 99 cross-browser semantic/Axe checks, and twelve Windows Chromium DropDownBox snapshots cover primary/open/explicit/status/custom/nested/narrow/resizable/dark/RTL states. The final live Storybook review found and corrected portal theme inheritance and narrow-editor overflow.

## Phase 5 TagBox behavior

- Object-array selections use stable keys, deduplicate selected values, retain missing objects, and silently adopt key-equivalent replacements in uncontrolled mode. Controlled values remain authoritative after rejected proposals.
- Exactly one local or remote source is required. Local filtering is immediate; contains/starts-with matching supports locale, Arabic, and diacritic folding. Remote requests receive trimmed queries, monotonic IDs, and abort signals with debounce, stale-generation rejection, error recovery, and unmount cleanup.
- Tags, clear, Backspace removal, option toggling, maximum selection, disabled options, close-on-selection, custom option/tag content, active scrolling, Home/End/Arrow/Enter/Escape/Tab, outside clicks, and retained input focus mirror the Razor interaction surface.
- The input owns combobox state while the portal listbox owns only options; minimum/loading/empty/error messages remain outside option ownership and join the accessible description. Required invalid submission focuses the visible input.
- Selected keys use an internal native multi-select form proxy. The editable query is excluded from submission; `name`, nested/external `form`, reset, disabled exclusion, missing selected objects, refs, validation, RTL, dark theme, and density are covered.
- Unit, semantic browser, Axe, and nine canonical Windows Chromium TagBox snapshots live at the exact paths listed above. No dependency was added.

## Phase 4 ListBox behavior

- Object selections preserve stable key identity across refreshed item objects and retain selected objects whose keys are temporarily absent. Uncontrolled selections silently adopt key-equivalent refreshed objects.
- Single/multiple pointer selection, Ctrl/Meta toggles, Shift ranges, additive Ctrl/Meta+Shift ranges, checkbox-row toggles, Ctrl/Meta+A, Home/End/Page and Arrow navigation, and disabled-item skipping mirror the Razor interaction model. Read-only mode retains navigation while suppressing selection.
- Application filtering precedes controlled/uncontrolled debounced local search. Contains/starts-with/equals conditions, all-words/any-word/exact parsing, Arabic/locale and diacritic folding, safe highlight fragments, and searchable columns are supported with IME-safe drafts.
- Filtered tri-state Select All changes only enabled visible items and preserves hidden selections. One non-collapsible group level follows first appearance; group separators never enter option indexes, ranges, or selection.
- Typed column descriptors, row/cell/group templates, loading/empty/no-results content, entire rendering, and a private fixed-row virtual window cover the display contract. Entire mode is the variable-height template path.
- The focusable native `HTMLDivElement` exposes listbox semantics and ARIA active ownership. Selected stable keys use a hidden native multi-select form proxy with `name`, external `form`, required validity, disabled exclusion, missing-key serialization, native reset, and invalid-focus transfer.
- Unit, semantic browser, Axe, and canonical Windows Chromium visual coverage live at the exact test and story paths listed above. No runtime or development dependency was added.

## Phase 3 browser and interaction behavior

- ComboBox uses an input-focused ARIA combobox/listbox, object identity through stable keys, local locale-aware filtering or abortable remote loading, form key serialization, IME-safe drafts, authoritative controlled restoration, and body-portal popup positioning with viewport flip/shift.
- The private positioned-overlay layer follows resize, zoom, visual viewport, nested scroll, and portal-target replacement. Zero-sized external targets remain hidden until usable, and target mutations are restored on retarget or disposal.
- LoadingPanel `trapFocus` is valid only for blocking overlay/portal modes. It saves the origin, focuses the first focusable descendant or panel, cycles Tab, and returns focus when the origin remains connected.
- SpinEdit `repeatOnHold` defaults to `true`: primary pointer-down steps once, pointer capture keeps the gesture coherent, repetition accelerates after the private delay, and every release/cancel/blur/boundary/disable/unmount path cleans up.
- Playwright runs semantic projects in Chromium, Firefox, and WebKit plus Windows Chromium snapshots. Canonical stories receive Axe serious/critical checks; Storybook retains full manual accessibility review.

## Phase 2 hardening behavior

- Native `form` association is honored for reset and submission even when a control is outside its form. RadioGroup propagates the association to its generated radios.
- Async buttons/editor commands accept promise-like results, guard duplicate activation immediately, observe rejection, and avoid post-unmount state writes.
- TextBox and Memo validate timing/layout inputs, preserve active IME drafts, cancel stale debounces on external updates, and normalize reset behavior.
- Standalone uncontrolled Radio uses native grouping. RadioGroup reset clears selection when no default exists and retains disabled-item skipping plus RTL-aware navigation.
- NumericEdit preserves and marks invalid drafts, strictly parses configured locale/currency/percent syntax, commits a trailing locale decimal, and reformats on formatting-option changes. SpinEdit validates step metadata, resets uncontrolled state, and steps from parseable draft text.
- SearchBox adds `searchOnClear?: boolean` (default `true`) and `minimumLengthMessage?: ReactNode | ((minimumLength: number) => ReactNode)`. Trimmed length controls eligibility while the callback receives the original query. All terminal/cancellation paths release duplicate bookkeeping.
- LoadingPanel validates timing, survives rapid visibility reversals, reference-counts inert restoration, falls back safely for missing portal targets, and orders Escape dismissal by the live overlay stack. ProgressBar rejects invalid finite/range inputs.

## Verification result

Verified on 2026-08-31 on Windows with host Node 22.20.0/npm 10.9.3 and the locked dependency tree. The host Node version is below the package's declared supported 22.x floor; the recorded commands nevertheless completed as shown:

| Command/gate | Result |
| --- | --- |
| `npm run typecheck` | Passed (strict TypeScript 6) |
| `npm run lint` | Passed |
| `npm run test` | Passed: 53 files, 509 tests |
| `npm run check:cycles` | Passed: 270 source modules, no relative-import cycles |
| `npm run build:lib` | Passed: 264 transformed modules; declarations/maps and `dist/cashgear-ui.css` emitted |
| `npm run build-storybook` | Passed with Storybook 10.5.10; 334 transformed modules |
| Chromium semantic/Axe | Passed: all 119 tests, including the Phase 21 canonical TreeList story and three interaction/accessibility scenarios. |
| Firefox semantic/Axe | Environment-blocked before page creation by a 30-second `browserType.launch` timeout whose browser log reports `RenderCompositorSWGL failed mapping default framebuffer`. No story, Axe scan, or component assertion ran; the remaining launches were stopped instead of retrying the same host failure. |
| WebKit semantic/Axe | Passed: all 119 tests in the complete run. |
| Chromium visual | Passed: all 235 tests against 243 Windows snapshots. Exactly 15 inspected `phase-21-treelist-*` baselines were added; all 228 older baseline files remained unchanged and passed comparison. |
| `npm run verify:package` | Passed: 168 runtime exports, 1,280 packed files, React externalization/declarations/styles/dry-run ESM import verified |
| `npm run verify` | Re-passed typecheck, lint, 509 Vitest tests, cycles, both builds, and all 119 Chromium semantic/Axe cases. Its first Firefox case then reproduced the known pre-page SWGL launch failure and the replacement worker was stopped. The complete WebKit, Chromium visual, and package gates passed independently from the same final source as recorded above. |

## Deferred inventory

These rows are evidence only. No public React API or implementation is included for these remaining planned controls.

| Planned component | Razor evidence | Status |
| --- | --- | --- |
| Calendar multiple selection | `Components/Editors/Calendar/*` | Intentionally deferred; the public Calendar supports single and range modes only |
| Alert, prompt, and arbitrary dialog APIs | `Components/Feedback/Confirmation/*` defines the accepted confirmation boundary | Intentionally deferred; Phase 16 exports Toast and Confirmation only |
| Scheduler | `CG.CompLib/Comp/Scheduler/CgScheduler.*` | Deferred |

## Remaining gaps

- RangeSelector now has an exact normalized decimal-string value model. NumericEdit and SpinEdit intentionally remain IEEE-754 editors; accounting entry fields that cannot tolerate floating-point rounding still need a future exact-decimal editor rather than borrowing RangeSelector semantics.
- TagBox intentionally binds selected objects; scalar-key adapters, custom key comparers, and selected-key hydration remain deferred.
- DropDownBox intentionally leaves remote data ownership, hosted Grid/DateRangePicker implementations, browser top-layer popovers, and focus trapping to callers or later component phases. The standalone TreeView can be composed by callers but is not coupled into DropDownBox.
- ListBox remote loading/paging, drag/drop, sorting, column resizing, editing, nested groups, summaries, and export are intentionally outside Phase 4.
- Browser gates are local; this phase intentionally adds no GitHub Actions workflow. Chromium snapshots must be compared and regenerated on the same platform.
- TreeList pointer drag-and-drop and variable-height row virtualization remain deferred. Phase 21 uses accessible keyboard reparent/reorder operations, fixed-height rows, and host-authorized persistence instead.
- Start each deferred advanced control with a fresh Razor working-tree audit because several reference components are currently uncommitted.

## Phase 22 — PivotTable

Reference audit: `CashGear.Blazor.UI/Components/Data/Pivot` at `1e327060d65c8ae7e94088b24014cb7ebbd72714`; no local Pivot reference edits were present. React implementation is library + Storybook only, with no live backend changes.

Implemented typed local/provider contracts, checked decimal summaries and mergeable calculated measures, date grouping, hierarchical totals, summary sorting, field-list/drag/keyboard layout editing, member/range filters, two-axis virtualization, drill-down, layout-v2 migration and cancellable persistence, complete logical CSV/XLSX exports, labels/templates, limits and diagnostics. Public runtime API adds 19 deliberate exports (187 total). No dependency was added.

See [PivotTable usage and provider boundary](../src/components/PivotTable/README.md) for default limits, temporal/decimal contracts and intentional differences. Provider authorization, transport, custom aggregate registration and complete export adapters remain the host's responsibility.

### Phase 22 verification

TypeScript, ESLint, all 545 Vitest tests in 55 files, import-cycle checks (282 source modules), the library build, Storybook build, and package verification passed. Package verification reports 187 runtime exports and 1,340 packed files. The port adds 36 unit tests, 15 stories, four cross-browser scenarios and 11 inspected Chromium snapshots. XLSX output was independently opened as ZIP and every workbook part parsed as XML.

Firefox remains environment-blocked before page creation: its 30-second launch timeout reports `RenderCompositorSWGL failed mapping default framebuffer`. The run was stopped after the first failure; no Firefox component assertions ran.

The complete Chromium/WebKit semantic and Chromium visual regression run exercised 492 cases. With two workers it passed 488 and hit four transient failures (two WebKit navigation timeouts, a CSS preload failure, and a ComboBox loading-state screenshot mismatch). All four passed when rerun serially with no baseline changes. All 243 pre-existing visual baseline files were preserved; Phase 22 adds 11 files.

After the final provider-validation, immutable-query and RTL drill-down refinements, the rebuilt PivotTable passed all 19 focused browser checks without snapshot updates and all 38 focused unit/public-API tests. Type checking, scoped lint, and both production builds passed again.
