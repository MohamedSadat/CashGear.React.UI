# CG.CompLib → `@cashgear/ui` Phase 1–5 parity

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
| `CgComboBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgComboBox.*`; `CG.CompLib.Demo/Components/Pages/ComboBoxDemo.razor` | `src/components/ComboBox/*`, `src/internal/PositionedOverlay.tsx` | `tests/combo-box.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/ComboBox/CgComboBox.stories.tsx` | Object-valued selection uses required stable keys for identity and form serialization. Scalar-key adapters remain deferred. |
| `CgListBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgListBox.*`, `CgListBoxTypes.cs`, `CgListBoxColumn.cs`, `CgListBoxAccessors.cs`; `CG.CompLib.Demo/Components/Pages/ListBoxDemo.razor` | `src/components/ListBox/*`, `src/internal/listBox.ts`, `src/internal/useVirtualWindow.ts` | `tests/list-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/ListBox/CgListBox.stories.tsx` | Object-array binding and stable keys replace Razor field accessors. Fixed-row virtualization is dependency-free; remote loading/paging and richer data-grid operations remain deferred. |
| `CgTagBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTagBox.*`; `CG.CompLib.Demo/Components/Pages/TagBoxDemo.razor` | `src/components/TagBox/*`, `src/internal/tagBox.ts`, `src/internal/PositionedOverlay.tsx` | `tests/tag-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/TagBox/CgTagBox.stories.tsx` | Object-array binding replaces Razor scalar keys. Custom comparers and `ResolveValuesAsync` hydration remain deferred because selected objects carry labels. |
| `CgDropDownBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgDropDownBox.*`, `CgDropDownBoxTypes.cs`; `CG.CompLib.Demo/Components/Pages/DropDownBoxDemo.razor` | `src/components/DropDownBox/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts` | `tests/drop-down-box.test.tsx`, `tests/browser/components.browser.spec.ts`, `tests/browser/components.visual.spec.ts` | `src/components/DropDownBox/CgDropDownBox.stories.tsx` | React render contexts host arbitrary content; a native select proxy and explicit object serializer replace Blazor `EditContext` integration. The body portal replaces the browser manual-popover top layer and deliberately adds no focus trap. |
| `CgSwitch` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*` switch mode | `src/components/Switch/*` | `tests/choice-controls.test.tsx` | `src/components/Switch/CgSwitch.stories.tsx` | Extracted as a separate two-state component. The source has no pending state, so React does not add one. |
| `CgRadio` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadio.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/Radio/*` | `tests/choice-controls.test.tsx` | `src/components/Radio/CgRadio.stories.tsx` | Native grouping is preserved for uncontrolled same-name radios; typed string/number values replace C# conversion. |
| `CgRadioGroup` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadioGroup.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/RadioGroup/*` | `tests/choice-controls.test.tsx` | `src/components/RadioGroup/CgRadioGroup.stories.tsx` | Generic React options replace reflection-based field-name mapping. |
| `CgNumericEdit` | New React implementation | No exact source; informed by `CG.CompLib/Comp/Inputs/CgNumberInput.*` and `CgSpinEdit.*` | `src/components/NumericEdit/*`, `src/internal/numeric.ts` | `tests/numeric-editors.test.tsx` | `src/components/NumericEdit/CgNumericEdit.stories.tsx` | `number | null`, strict `Intl.NumberFormat` parsing, and IEEE-754 arithmetic; not arbitrary-precision decimal. |
| `CgSpinEdit` | Mirrored with React extension | `CG.CompLib/Comp/Inputs/CgSpinEdit.*`; `CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor` | `src/components/SpinEdit/*` | `tests/numeric-editors.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/SpinEdit/CgSpinEdit.stories.tsx` | Draft stepping and the Razor null-start policy are implemented; opt-out pointer hold repetition uses private timing. |
| `CgSearchBox` | Mirrored | Working-tree `CG.CompLib/Comp/Inputs/CgSearchBox.*`; `CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor` | `src/components/SearchBox/*` | `tests/search-box.test.tsx` | `src/components/SearchBox/CgSearchBox.stories.tsx` | Does not fetch data; caller receives the raw query, reason, monotonic request ID, and `AbortSignal`. |
| `CgLoadingPanel` | Mirrored with React extension | `CG.CompLib/Comp/Overlays/CgLoadingPanel.*`; `CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor` | `src/components/LoadingPanel/*`, `src/internal/PositionedOverlay.tsx`, `src/internal/overlayStack.ts`, `src/internal/inert.ts` | `tests/loading-progress.test.tsx`, `tests/browser/components.browser.spec.ts` | `src/components/LoadingPanel/CgLoadingPanel.stories.tsx` | Focus containment is opt-in; external targets are covered by body-portal fixed geometry and missing targets still fall back safely. |
| `CgProgressBar` | New React implementation | No exact source | `src/components/ProgressBar/*` | `tests/loading-progress.test.tsx` | `src/components/ProgressBar/CgProgressBar.stories.tsx` | Native React progress semantics, logical RTL fill, and reduced-motion support. |

The shared hook/primitives layer is covered in `tests/foundation.test.tsx`. The exact runtime export allow-list is guarded by `tests/public-api.test.ts`.

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

Verified on 2026-08-25 with Node 24.19 from the uncommitted Phase 6 working tree:

| Command/gate | Result |
| --- | --- |
| `npm run typecheck` | Passed (strict TypeScript 6) |
| `npm run lint` | Passed |
| `npm run test` | Passed: 13 files, 110 tests |
| `npm run check:cycles` | Passed: 89 source modules, no relative-import cycles |
| `npm run build:lib` | Passed: 86 transformed modules; declarations/maps and `dist/cashgear-ui.css` emitted |
| `npm run build-storybook` | Passed with Storybook 10.5.10; 138 transformed modules |
| `npm run test:browser:built` | Passed: 99 semantic/Axe tests (33 each in Chromium, Firefox, and WebKit) plus 59 Chromium visual tests comparing 67 Windows snapshots; 158 total |
| `npm run verify:package` | Passed: 21 runtime exports, 413 packed files, React externalization/declarations/styles/dry-run ESM import verified |
| `npm run verify` | Passed end to end |

## Deferred inventory

These rows are evidence only. No React API or implementation is included in Phase 1–6.

| Planned component | Razor evidence | Status |
| --- | --- | --- |
| Scalar-key ComboBox adapter | No separate Razor component; adapter would sit above `CgComboBox<TItem>` | Deferred |
| ContextMenu | Working-tree `CG.CompLib/Comp/ContextMenu/CgContextMenu.*` | Deferred |
| DateEdit | `CG.CompLib/Comp/Inputs/CgDateEdit.*` | Deferred |
| Calendar | Calendar surface inside `CG.CompLib/Comp/Inputs/CgDateEdit.*`; no standalone `CgCalendar` found | Deferred |
| LookupGrid | `CG.CompLib/Comp/Inputs/CgLookUpGrid.*` | Deferred |
| Grid | Working-tree `CG.CompLib/Comp/Grid/CgGrid.*` | Deferred |
| TreeList | Working-tree `CG.CompLib/Comp/TreeList/CgTreeList.*` | Deferred |
| Scheduler | `CG.CompLib/Comp/Scheduler/CgScheduler.*` | Deferred |
| PivotTable | `CG.CompLib/Comp/Pivot/CgPivotTable.*` | Deferred |
| Chart | `CG.CompLib/Comp/Chart/CgChart.*` | Deferred |

## Remaining gaps

- Decide on a decimal/arbitrary-precision value model before using numeric editors for accounting amounts that cannot tolerate IEEE-754 rounding.
- A scalar-only `CgKeyComboBox`/key adapter is not part of the object-valued Phase 3 API.
- TagBox intentionally binds selected objects; scalar-key adapters, custom key comparers, and selected-key hydration remain deferred.
- DropDownBox intentionally leaves remote data ownership, hosted Grid/TreeView/DateRangePicker implementations, browser top-layer popovers, and focus trapping to callers or later component phases.
- ListBox remote loading/paging, drag/drop, sorting, column resizing, editing, nested groups, summaries, and export are intentionally outside Phase 4.
- Browser gates are local; this phase intentionally adds no GitHub Actions workflow. Chromium snapshots must be compared and regenerated on the same platform.
- Start each deferred advanced control with a fresh Razor working-tree audit because several reference components are currently uncommitted.
