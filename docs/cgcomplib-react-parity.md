# CG.CompLib → `@cashgear/ui` Phase 1–9 parity

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
| `CgListBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgListBox.*`, `CgListBoxTypes.cs`, `CgListBoxColumn.cs`, `CgListBoxAccessors.cs`; `CG.CompLib.Demo/Components/Pages/ListBoxDemo.razor` | `src/components/ListBox/*`, `src/internal/listBox.ts`, `src/internal/useVirtualWindow.ts` | `tests/list-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/ListBox/CgListBox.stories.tsx` | Object-array binding and stable keys replace Razor field accessors. Fixed-row virtualization is dependency-free; remote loading/paging and richer data-grid operations remain deferred. |
| `CgTagBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTagBox.*`; `CG.CompLib.Demo/Components/Pages/TagBoxDemo.razor` | `src/components/TagBox/*`, `src/internal/tagBox.ts`, `src/internal/PositionedOverlay.tsx` | `tests/tag-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/TagBox/CgTagBox.stories.tsx` | Object-array binding replaces Razor scalar keys. Custom comparers and `ResolveValuesAsync` hydration remain deferred because selected objects carry labels. |
| `CgDropDownBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgDropDownBox.*`, `CgDropDownBoxTypes.cs`; `CG.CompLib.Demo/Components/Pages/DropDownBoxDemo.razor` | `src/components/DropDownBox/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts` | `tests/drop-down-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/DropDownBox/CgDropDownBox.stories.tsx` | React render contexts host arbitrary content; a native select proxy and explicit object serializer replace Blazor `EditContext` integration. The body portal replaces the browser manual-popover top layer and deliberately adds no focus trap. |
| `CgDateEdit` | Mirrored with canonical React value contract | `CG.CompLib/Comp/Inputs/CgDateEdit.*`, `CgDateEditTypes.cs`, `CgDateEditorUtilities.cs`; `CG.CompLib.Demo/Components/Pages/DateEditDemo.razor` | `src/components/DateEdit/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts` | `tests/date-edit.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/DateEdit/CgDateEdit.stories.tsx` | React exposes only canonical `YYYY-MM-DD | null` civil dates, exact documented token formats, and a private dependency-free calendar. It does not expose `Date`, DateRangePicker, or a public Calendar. |
| `CgFlyout` | Mirrored | `CG.CompLib/Comp/Overlays/CgFlyout.*`, `CgFlyoutCloseReason.cs`, `CgPlacement.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/FlyoutDemo.razor` | `src/components/Flyout/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/flyout.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Flyout/CgFlyout.stories.tsx` | React supports element/ref/selector and virtual anchors through a body portal. Private React context plus DOM owner/boundary IDs replace Blazor cascading ownership and JS module handles. |
| `CgPopup` | Mirrored | `CG.CompLib/Comp/Overlays/CgPopup.*`, `CgOverlayBase.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor` | `src/components/Popup/*`, `src/internal/OverlaySurface.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/popup.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Popup/CgPopup.stories.tsx` | A body-portalled backdrop/surface replaces native top-layer APIs. React owns focus isolation, exact scroll-style restoration, and full-region render contexts. |
| `CgWindow` | Mirrored | `CG.CompLib/Comp/Overlays/CgWindow.*`, `CgOverlayBase.cs`, `CgOverlayContracts.cs`; `CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor` | `src/components/Window/*`, `src/internal/OverlaySurface.tsx`, `src/internal/overlayStack.ts`, `src/internal/overlayDom.ts` | `tests/window.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/Window/CgWindow.stories.tsx` | React modeless windows use a global paint order below modals, scoped Escape ownership, and DOM/ref/selector positioning actions instead of .NET/JS handles. |
| `CgMaskedInput` | Mirrored with native-form adaptation | `CG.CompLib/Comp/Inputs/CgMaskedInput.*`, `CgMaskedInputTypes.cs`, `CgMaskParser.cs`, `CgMaskState.cs`; `CG.CompLib.Demo/Components/Pages/MaskedInputDemo.razor` | `src/components/MaskedInput/*`, `src/internal/mask.ts` | `tests/masked-input.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/MaskedInput/CgMaskedInput.stories.tsx` | Unicode property matching and UTF-16 caret maps implement the mask without DevExpress. A private native proxy replaces Blazor `EditContext` submission/validation. |
| `CgSwitch` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*` switch mode | `src/components/Switch/*` | `tests/choice-controls.test.tsx` | `src/components/Switch/CgSwitch.stories.tsx` | Extracted as a separate two-state component. The source has no pending state, so React does not add one. |
| `CgRadio` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadio.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/Radio/*` | `tests/choice-controls.test.tsx` | `src/components/Radio/CgRadio.stories.tsx` | Native grouping is preserved for uncontrolled same-name radios; typed string/number values replace C# conversion. |
| `CgRadioGroup` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadioGroup.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/RadioGroup/*` | `tests/choice-controls.test.tsx` | `src/components/RadioGroup/CgRadioGroup.stories.tsx` | Generic React options replace reflection-based field-name mapping. |
| `CgNumericEdit` | New React implementation | No exact source; informed by `CG.CompLib/Comp/Inputs/CgNumberInput.*` and `CgSpinEdit.*` | `src/components/NumericEdit/*`, `src/internal/numeric.ts` | `tests/numeric-editors.test.tsx` | `src/components/NumericEdit/CgNumericEdit.stories.tsx` | `number | null`, strict `Intl.NumberFormat` parsing, and IEEE-754 arithmetic; not arbitrary-precision decimal. |
| `CgSpinEdit` | Mirrored with React extension | `CG.CompLib/Comp/Inputs/CgSpinEdit.*`; `CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor` | `src/components/SpinEdit/*` | `tests/numeric-editors.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/SpinEdit/CgSpinEdit.stories.tsx` | Draft stepping and the Razor null-start policy are implemented; opt-out pointer hold repetition uses private timing. |
| `CgSearchBox` | Mirrored | Working-tree `CG.CompLib/Comp/Inputs/CgSearchBox.*`; `CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor` | `src/components/SearchBox/*` | `tests/search-box.test.tsx` | `src/components/SearchBox/CgSearchBox.stories.tsx` | Does not fetch data; caller receives the raw query, reason, monotonic request ID, and `AbortSignal`. |
| `CgLoadingPanel` | Mirrored with React extension | `CG.CompLib/Comp/Overlays/CgLoadingPanel.*`; `CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor` | `src/components/LoadingPanel/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts`, `src/internal/inert.ts` | `tests/loading-progress.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/LoadingPanel/CgLoadingPanel.stories.tsx` | Focus containment is opt-in; external targets are covered by body-portal fixed geometry and missing targets still fall back safely. |
| `CgProgressBar` | New React implementation | No exact source | `src/components/ProgressBar/*` | `tests/loading-progress.test.tsx` | `src/components/ProgressBar/CgProgressBar.stories.tsx` | Native React progress semantics, logical RTL fill, and reduced-motion support. |

The shared hook/primitives layer is covered in `tests/foundation.test.tsx`. The exact runtime export allow-list is guarded by `tests/public-api.test.ts`.

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

Verified on 2026-08-26 with the bundled supported Node 24.19 runtime from the uncommitted Phase 9 working tree:

| Command/gate | Result |
| --- | --- |
| `npm run typecheck` | Passed (strict TypeScript 6) |
| `npm run lint` | Passed |
| `npm run test` | Passed: 19 files, 178 tests |
| `npm run check:cycles` | Passed: 115 source modules, no relative-import cycles |
| `npm run build:lib` | Passed: 111 transformed modules; declarations/maps and `dist/cashgear-ui.css` emitted |
| `npm run build-storybook` | Passed with Storybook 10.5.10; 165 transformed modules |
| Chromium semantic/Axe | Passed: 55 tests |
| Firefox semantic/Axe | Passed: 55 tests with `--headed`; the supported-Node headless launch failed before tests with Mozilla `RenderCompositorSWGL failed mapping default framebuffer` and three 30-second browser-launch timeouts |
| WebKit semantic/Axe | Passed: 55 tests |
| Chromium visual | Passed: 87 tests comparing 95 Windows snapshots; exactly 19 Phase 9 snapshots were added (four Flyouts, five Popups, four Windows, and six MaskedInputs) and no pre-Phase-9 baseline was regenerated |
| `npm run verify:package` | Passed: 27 runtime exports, 535 packed files, React externalization/declarations/styles/dry-run ESM import verified |
| `npm run verify` | Not run as one monolithic command because its required headless Firefox project is unsupported on this host. Every constituent source/build/package gate and the equivalent complete headed Firefox plus headless Chromium/WebKit/visual projects passed under Node 24.19. |

## Deferred inventory

These rows are evidence only. No public React API or implementation is included in Phase 1–9.

| Planned component | Razor evidence | Status |
| --- | --- | --- |
| ContextMenu | Working-tree `CG.CompLib/Comp/ContextMenu/CgContextMenu.*` | Deferred |
| DateRangePicker | `CG.CompLib/Comp/Inputs/CgDateRangePicker.*` | Explicitly deferred after Phase 8 |
| Calendar | Calendar surface inside `CG.CompLib/Comp/Inputs/CgDateEdit.*`; Phase 8 calendar is private | Standalone public component deferred |
| LookupGrid | `CG.CompLib/Comp/Inputs/CgLookUpGrid.*` | Deferred |
| Grid | Working-tree `CG.CompLib/Comp/Grid/CgGrid.*` | Deferred |
| TreeList | Working-tree `CG.CompLib/Comp/TreeList/CgTreeList.*` | Deferred |
| Scheduler | `CG.CompLib/Comp/Scheduler/CgScheduler.*` | Deferred |
| PivotTable | `CG.CompLib/Comp/Pivot/CgPivotTable.*` | Deferred |
| Chart | `CG.CompLib/Comp/Chart/CgChart.*` | Deferred |

## Remaining gaps

- Decide on a decimal/arbitrary-precision value model before using numeric editors for accounting amounts that cannot tolerate IEEE-754 rounding.
- TagBox intentionally binds selected objects; scalar-key adapters, custom key comparers, and selected-key hydration remain deferred.
- DropDownBox intentionally leaves remote data ownership, hosted Grid/TreeView/DateRangePicker implementations, browser top-layer popovers, and focus trapping to callers or later component phases.
- ListBox remote loading/paging, drag/drop, sorting, column resizing, editing, nested groups, summaries, and export are intentionally outside Phase 4.
- Browser gates are local; this phase intentionally adds no GitHub Actions workflow. Chromium snapshots must be compared and regenerated on the same platform.
- Start each deferred advanced control with a fresh Razor working-tree audit because several reference components are currently uncommitted.
