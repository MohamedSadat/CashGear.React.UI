# CG.CompLib → `@cashgear/ui` Phase 1–2 parity

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

## Implemented inventory

“Mirrored” means the user-visible contract is carried across with React/native-DOM adaptations. “Partially mirrored” identifies a deliberate Phase 2 omission. “New React implementation” has no exact Razor component.

| Component | Classification | Razor source/demo | React source | Automated tests | Story | Intentional differences |
| --- | --- | --- | --- | --- | --- | --- |
| `CgIcon` | New React implementation | No exact source | `src/components/Icon/*` | `tests/components.test.tsx` | `src/stories/PhaseParity.stories.tsx` (`Icon`) | Small typed inline-SVG registry; all icons use `currentColor`. |
| `CgButton` | Mirrored | `CG.CompLib/Comp/Buttons/CgButton.*`; `CG.CompLib.Demo/Components/Pages/ButtonDemo.razor` | `src/components/Button/*` | `tests/components.test.tsx` | `Button` | Razor `Visible` is omitted; React callers conditionally render. |
| `CgField` | New React implementation | `CG.CompLib/Comp/FormLayout/CgFormLayoutItem.*`; `CG.CompLib/Comp/Inputs/CgInputBase.cs` | `src/components/Field/*`, `src/internal/field/*` | `tests/foundation.test.tsx` | `Field` | Context composes label/message ARIA without cloning children. |
| `CgTextBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTextBox.*`; `CG.CompLib.Demo/Components/Pages/TextBoxDemo.razor` | `src/components/TextBox/*` | `tests/components.test.tsx`, `tests/foundation.test.tsx` | `TextBox` | Labels/messages move to `CgField`; native input events/attributes are retained. |
| `CgMemo` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgMemo.*`; `CG.CompLib.Demo/Components/Pages/MemoDemo.razor` | `src/components/Memo/*` | `tests/components.test.tsx` | `Memo` | Uses native textarea resizing plus `ResizeObserver`; no DevExpress dependency. |
| `CgCheckBox` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*`; `CG.CompLib.Demo/Components/Pages/CheckBoxDemo.razor` | `src/components/CheckBox/*` | `tests/components.test.tsx` | `CheckBox` | Boolean/`indeterminate` only; C# numeric/string mappings are omitted. |
| `CgSwitch` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*` switch mode | `src/components/Switch/*` | `tests/components.test.tsx` | `Switch` | Extracted as a separate two-state component. The source has no pending state, so React does not add one. |
| `CgRadio` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadio.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/Radio/*` | `tests/components.test.tsx` | `Radio` | Native typed string/number values replace C# conversion. |
| `CgRadioGroup` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgRadioGroup.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/RadioGroup/*` | `tests/components.test.tsx` | `RadioGroup` | Generic React options replace reflection-based field-name mapping. |
| `CgNumericEdit` | New React implementation | No exact source; informed by `CG.CompLib/Comp/Inputs/CgNumberInput.*` and `CgSpinEdit.*` | `src/components/NumericEdit/*`, `src/internal/numeric.ts` | `tests/numeric-search-loading.test.tsx` | `NumericEdit` | `number | null`, `Intl.NumberFormat`, and IEEE-754 arithmetic; not arbitrary-precision decimal. |
| `CgSpinEdit` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgSpinEdit.*`; `CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor` | `src/components/SpinEdit/*` | `tests/numeric-search-loading.test.tsx` | `SpinEdit` | Native numeric model only; press-and-hold is deferred. Null stepping matches Razor: increment starts at `min` or 0, decrement at `max` or 0. |
| `CgSearchBox` | Mirrored | Working-tree `CG.CompLib/Comp/Inputs/CgSearchBox.*`; `CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor` | `src/components/SearchBox/*` | `tests/numeric-search-loading.test.tsx` | `SearchBox` | Does not fetch data; caller receives query, reason, monotonic request id, and `AbortSignal`. |
| `CgLoadingPanel` | Mirrored | `CG.CompLib/Comp/Overlays/CgLoadingPanel.*`; `CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor` | `src/components/LoadingPanel/*`, `src/internal/overlayStack.ts` | `tests/numeric-search-loading.test.tsx` | `LoadingPanel` | No focus trap. Portal targets must establish the desired positioning context. |
| `CgProgressBar` | New React implementation | No exact source | `src/components/ProgressBar/*` | `tests/components.test.tsx` | `ProgressBar` | Native React progress semantics, logical RTL fill, and reduced-motion support. |

The shared hook/primitives layer is covered in `tests/foundation.test.tsx`. The exact runtime export allow-list is guarded by `tests/public-api.test.ts`.

## Deferred inventory

These rows are evidence only. No React API or implementation is included in Phase 1–2.

| Planned component | Razor evidence | Status |
| --- | --- | --- |
| ComboBox | `CG.CompLib/Comp/Inputs/CgComboBox.*` | Deferred |
| ListBox | `CG.CompLib/Comp/Inputs/CgListBox.*` | Deferred |
| TagBox | `CG.CompLib/Comp/Inputs/CgTagBox.*` | Deferred |
| DropDownBox | `CG.CompLib/Comp/Inputs/CgDropDownBox.*` | Deferred |
| ContextMenu | Working-tree `CG.CompLib/Comp/ContextMenu/CgContextMenu.*` | Deferred |
| DateEdit | `CG.CompLib/Comp/Inputs/CgDateEdit.*` | Deferred |
| Calendar | Calendar surface inside `CG.CompLib/Comp/Inputs/CgDateEdit.*`; no standalone `CgCalendar` found | Deferred |
| LookupGrid | `CG.CompLib/Comp/Inputs/CgLookUpGrid.*` | Deferred |
| Grid | Working-tree `CG.CompLib/Comp/Grid/CgGrid.*` | Deferred |
| TreeList | Working-tree `CG.CompLib/Comp/TreeList/CgTreeList.*` | Deferred |
| Scheduler | `CG.CompLib/Comp/Scheduler/CgScheduler.*` | Deferred |
| PivotTable | `CG.CompLib/Comp/Pivot/CgPivotTable.*` | Deferred |
| Chart | `CG.CompLib/Comp/Chart/CgChart.*` | Deferred |

## Phase 3 prerequisites and remaining gaps

- Add browser-test infrastructure before automated screenshots or cross-browser visual regression; Phase 2 intentionally stops at Vitest plus Storybook/a11y panel.
- Decide whether SpinEdit press-and-hold is required before adding it; pointer capture, acceleration, and cleanup need browser tests.
- Decide on a decimal/arbitrary-precision value model before using numeric editors for accounting amounts that cannot tolerate IEEE-754 rounding.
- Add browser validation of external loading-panel geometry for positioned, transformed, and scrolling portal targets.
- Start each deferred advanced control with a fresh Razor working-tree audit because several reference components are currently uncommitted.
