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
| `CgIcon` | New React implementation | No exact source | `src/components/Icon/*` | `tests/icon-button-field.test.tsx` | `src/components/Icon/CgIcon.stories.tsx` | Small typed inline-SVG registry; all icons use `currentColor`. |
| `CgButton` | Mirrored | `CG.CompLib/Comp/Buttons/CgButton.*`; `CG.CompLib.Demo/Components/Pages/ButtonDemo.razor` | `src/components/Button/*` | `tests/icon-button-field.test.tsx` | `src/components/Button/CgButton.stories.tsx` | Razor `Visible` is omitted; React callers conditionally render. Async callbacks accept thenables; rejected results are observed. |
| `CgField` | New React implementation | `CG.CompLib/Comp/FormLayout/CgFormLayoutItem.*`; `CG.CompLib/Comp/Inputs/CgInputBase.cs` | `src/components/Field/*`, `src/internal/field/*` | `tests/foundation.test.tsx`, `tests/icon-button-field.test.tsx` | `src/components/Field/CgField.stories.tsx` | Context composes label/message ARIA without cloning children. |
| `CgTextBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgTextBox.*`; `CG.CompLib.Demo/Components/Pages/TextBoxDemo.razor` | `src/components/TextBox/*` | `tests/text-box.test.tsx`, `tests/foundation.test.tsx` | `src/components/TextBox/CgTextBox.stories.tsx` | Labels/messages move to `CgField`; IME drafts and native events/attributes are retained. |
| `CgMemo` | Mirrored | `CG.CompLib/Comp/Inputs/CgMemo.*`; `CG.CompLib.Demo/Components/Pages/MemoDemo.razor` | `src/components/Memo/*` | `tests/memo.test.tsx` | `src/components/Memo/CgMemo.stories.tsx` | Native textarea resizing plus `ResizeObserver` replaces the DevExpress implementation. |
| `CgCheckBox` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*`; `CG.CompLib.Demo/Components/Pages/CheckBoxDemo.razor` | `src/components/CheckBox/*` | `tests/choice-controls.test.tsx` | `src/components/CheckBox/CgCheckBox.stories.tsx` | Boolean/`indeterminate` only; C# numeric/string mappings are intentionally omitted. |
| `CgSwitch` | Mirrored | `CG.CompLib/Comp/Inputs/CgCheckBox.*` switch mode | `src/components/Switch/*` | `tests/choice-controls.test.tsx` | `src/components/Switch/CgSwitch.stories.tsx` | Extracted as a separate two-state component. The source has no pending state, so React does not add one. |
| `CgRadio` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadio.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/Radio/*` | `tests/choice-controls.test.tsx` | `src/components/Radio/CgRadio.stories.tsx` | Native grouping is preserved for uncontrolled same-name radios; typed string/number values replace C# conversion. |
| `CgRadioGroup` | Mirrored | `CG.CompLib/Comp/Inputs/CgRadioGroup.*`; `CG.CompLib.Demo/Components/Pages/RadioDemo.razor` | `src/components/RadioGroup/*` | `tests/choice-controls.test.tsx` | `src/components/RadioGroup/CgRadioGroup.stories.tsx` | Generic React options replace reflection-based field-name mapping. |
| `CgNumericEdit` | New React implementation | No exact source; informed by `CG.CompLib/Comp/Inputs/CgNumberInput.*` and `CgSpinEdit.*` | `src/components/NumericEdit/*`, `src/internal/numeric.ts` | `tests/numeric-editors.test.tsx` | `src/components/NumericEdit/CgNumericEdit.stories.tsx` | `number | null`, strict `Intl.NumberFormat` parsing, and IEEE-754 arithmetic; not arbitrary-precision decimal. |
| `CgSpinEdit` | Partially mirrored | `CG.CompLib/Comp/Inputs/CgSpinEdit.*`; `CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor` | `src/components/SpinEdit/*` | `tests/numeric-editors.test.tsx` | `src/components/SpinEdit/CgSpinEdit.stories.tsx` | Press-and-hold is deferred. Draft stepping and the Razor null-start policy are implemented. |
| `CgSearchBox` | Mirrored | Working-tree `CG.CompLib/Comp/Inputs/CgSearchBox.*`; `CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor` | `src/components/SearchBox/*` | `tests/search-box.test.tsx` | `src/components/SearchBox/CgSearchBox.stories.tsx` | Does not fetch data; caller receives the raw query, reason, monotonic request ID, and `AbortSignal`. |
| `CgLoadingPanel` | Mirrored | `CG.CompLib/Comp/Overlays/CgLoadingPanel.*`; `CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor` | `src/components/LoadingPanel/*`, `src/internal/overlayStack.ts`, `src/internal/inert.ts` | `tests/loading-progress.test.tsx` | `src/components/LoadingPanel/CgLoadingPanel.stories.tsx` | No focus trap. Missing portal targets fall back to `document.body`; targets must establish the desired positioning context. |
| `CgProgressBar` | New React implementation | No exact source | `src/components/ProgressBar/*` | `tests/loading-progress.test.tsx` | `src/components/ProgressBar/CgProgressBar.stories.tsx` | Native React progress semantics, logical RTL fill, and reduced-motion support. |

The shared hook/primitives layer is covered in `tests/foundation.test.tsx`. The exact runtime export allow-list is guarded by `tests/public-api.test.ts`.

## Phase 2 hardening behavior

- Native `form` association is honored for reset and submission even when a control is outside its form. RadioGroup propagates the association to its generated radios.
- Async buttons/editor commands accept promise-like results, guard duplicate activation immediately, observe rejection, and avoid post-unmount state writes.
- TextBox and Memo validate timing/layout inputs, preserve active IME drafts, cancel stale debounces on external updates, and normalize reset behavior.
- Standalone uncontrolled Radio uses native grouping. RadioGroup reset clears selection when no default exists and retains disabled-item skipping plus RTL-aware navigation.
- NumericEdit preserves and marks invalid drafts, strictly parses configured locale/currency/percent syntax, commits a trailing locale decimal, and reformats on formatting-option changes. SpinEdit validates step metadata, resets uncontrolled state, and steps from parseable draft text.
- SearchBox adds `searchOnClear?: boolean` (default `true`) and `minimumLengthMessage?: ReactNode | ((minimumLength: number) => ReactNode)`. Trimmed length controls eligibility while the callback receives the original query. All terminal/cancellation paths release duplicate bookkeeping.
- LoadingPanel validates timing, survives rapid visibility reversals, reference-counts inert restoration, falls back safely for missing portal targets, and orders Escape dismissal by the live overlay stack. ProgressBar rejects invalid finite/range inputs.

## Verification result

Verified on 2026-08-24 with Node 24.19 from the Phase 2 working tree:

| Command/gate | Result |
| --- | --- |
| `npm run typecheck` | Passed (strict TypeScript 6) |
| `npm run lint` | Passed |
| `npm run test` | Passed: 9 files, 45 tests |
| `npm run check:cycles` | Passed: 73 source modules, no relative-import cycles |
| `npm run build:lib` | Passed: 70 transformed modules; declarations/maps and `dist/cashgear-ui.css` emitted |
| `npm run build-storybook` | Passed with Storybook 10.5.10; a sandbox-only warning reported that the user-level Storybook settings file could not be written |
| `npm run verify:package` | Passed: 17 runtime exports, 337 packed files, React externalization/declarations/styles/dry-run ESM import verified |
| `npm run verify` | Passed end to end |

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
