# `@cashgear/ui`

CashGear's React 19 component library: accessible, typed, themeable controls for dense business applications. Phases 1–3 mirror the foundational controls in `CG.CompLib` without Bootstrap or DevExpress runtime dependencies and add browser-verified interaction behavior.

## Install and import

```bash
npm install @cashgear/ui
```

React and React DOM are peer dependencies. Import the one explicit stylesheet once at application startup:

```tsx
import '@cashgear/ui/styles.css';
import { CgButton, CgField, CgTextBox } from '@cashgear/ui';
```

Deep package imports are intentionally blocked. Runtime exports are limited to the documented root API.

## Theme, density, and direction

Theme and density are inherited through data attributes; direction uses native `dir` and logical CSS properties.

```html
<main data-cg-theme="dark" data-cg-density="compact" dir="rtl">
  <!-- CashGear controls -->
</main>
```

- `data-cg-theme`: `light` or `dark`
- `data-cg-density`: `comfortable` or `compact`
- `dir`: `ltr` or `rtl`

The stylesheet exposes the source-aligned `--cg-surface`, `--cg-text`, `--cg-accent`, feedback, typography, spacing, editor-height, focus, and overlay tokens. The earlier `--cg-color-*` names remain aliases. Override tokens on a scoped container; no global reset is installed.

## Fields and controlled state

`CgField` owns labels, descriptions, required indicators, validation messages, generated IDs, and ARIA relationships. It communicates with controls through context and never clones its child.

```tsx
import { useState } from 'react';
import { CgField, CgTextBox } from '@cashgear/ui';

export function AccountEditor() {
  const [code, setCode] = useState('');
  return (
    <CgField
      label="Account code"
      description="General-ledger account"
      required
      errorMessage={code ? undefined : 'Account code is required'}
    >
      <CgTextBox value={code} onValueChange={setCode} clearButton="auto" />
    </CgField>
  );
}
```

Controls accept either `value`/`checked` plus a change callback, or `defaultValue`/`defaultChecked` for uncontrolled use. Do not switch modes during a component's lifetime; development builds warn once when that happens, including under Strict Mode. TextBox and Memo keep a separate draft and can commit on input, blur, or a debounce. Controlled external updates cancel pending debounce work without replacing an active IME composition until composition ends.

## Native forms

Inputs forward refs and native attributes such as `name`, `form`, `required`, `autoComplete`, and `aria-*`. Button supports `button`, `submit`, and `reset`. Uncontrolled controls restore their defaults on native form reset, including controls associated to a non-ancestor form through `form="form-id"`. Standalone uncontrolled radios intentionally rely on native same-name grouping.

```tsx
<form onSubmit={save}>
  <CgField label="Reference" required>
    <CgTextBox name="reference" defaultValue="SO-" />
  </CgField>
  <CgCheckBox name="approved" label="Approved" />
  <CgButton type="submit" intent="primary">Save</CgButton>
  <CgButton type="reset" appearance="ghost">Reset</CgButton>
</form>
```

Read-only checkbox, switch, and radio controls remain focusable but suppress state changes. Disabled controls use native disabled behavior.

## ComboBox

`CgComboBox<TItem>` is object-valued and uses stable keys for identity and native form serialization. The editable query is never submitted. Supply local `options` or remote `loadOptions`, but not both.

```tsx
interface Customer { id: number; name: string; city: string }

<CgComboBox<Customer>
  name="customerId"
  form="order-form"
  options={customers}
  value={customer}
  onValueChange={(next, { reason }) => setCustomer(next)}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
  getOptionSearchText={(item) => `${item.name} ${item.city}`}
  clearable
  required
/>
```

Remote loading receives a trimmed eligible query, monotonic request ID, and `AbortSignal`. Debounced work is aborted when superseded or unmounted, and stale results cannot replace a newer generation.

```tsx
<CgComboBox<Customer>
  loadOptions={(query, { signal }) =>
    fetch(`/customers?q=${encodeURIComponent(query)}`, { signal }).then((response) => response.json())
  }
  minimumSearchLength={2}
  searchDelay={250}
  getOptionKey={(item) => item.id}
  getOptionLabel={(item) => item.name}
/>
```

The visible input retains focus while the body-portal listbox opens, flips, shifts, and follows nested scrolling or viewport changes. Arabic digits/text and diacritic-insensitive locale matching are supported. Duplicate keys, conflicting local/remote sources, negative timing/length values, and invalid result limits throw clear errors. A scalar-key adapter is intentionally outside the current API.

## Numeric editors

`CgNumericEdit` uses a `number | null` committed value. Invalid drafts such as `-` remain visible and internally invalid on blur/Enter without replacing the last committed value; `onInvalidValue` receives the draft. A trailing locale decimal such as `1.` remains visible while focused and commits as `1` on blur/Enter. Parsing strictly recognizes locale digits, separators, signs, and the configured currency/percent literals instead of stripping arbitrary characters. It supports grouping, precision, bounds, prefixes/suffixes, paste, and typed editor commands, and reformats when locale/format options change even when the numeric value is unchanged.

`CgSpinEdit` adds accessible buttons and Arrow/Page stepping and steps from the current parseable draft before falling back to the committed/null-start policy. A null increment starts at `min` when supplied, otherwise 0; a null decrement starts at `max`, otherwise 0. Pointer press-and-hold repeats and accelerates by default; set `repeatOnHold={false}` for single pointer steps. Repeat timing is intentionally private.

JavaScript numbers use IEEE-754 floating-point arithmetic. Do not use these editors as an arbitrary-precision accounting representation; keep minor units or a decimal value in the application when exact base-10 arithmetic is required.

## Async search and loading

`CgSearchBox` owns no data fetching. Its callback receives cancellation and ordering metadata:

```tsx
<CgSearchBox
  query={query}
  onQueryChange={setQuery}
  minimumLength={2}
  minimumLengthMessage={(minimum) => `Enter at least ${minimum} characters`}
  searchOnClear
  onSearch={async (text, { reason, requestId, signal }) => {
    const response = await fetch(`/search?q=${encodeURIComponent(text)}`, { signal });
    // requestId is monotonic; aborted/stale generations are not treated as current.
  }}
/>
```

Eligibility uses the trimmed query length, but `onSearch` receives the original query—including surrounding spaces. `searchOnClear` defaults to `true` and applies equally to the clear button and opt-in Escape clearing. Cancellation, below-minimum input, clear, rejection, and completion all release duplicate-submit bookkeeping while request IDs remain monotonic.

`CgLoadingPanel` supports inline, wrapper overlay, and portal-target modes, delayed display, minimum visible time, inert blocking, shading, dismissal, topmost Escape ordering, and target geometry tracking. Focus containment remains off by default; `trapFocus` enables Tab cycling and focus return for blocking overlay/portal modes only.

## Public API

Components:

- `CgIcon`, `CgButton`, `CgField`
- `CgTextBox`, `CgMemo`, `CgCheckBox`, `CgSwitch`, `CgComboBox`
- `CgRadio`, `CgRadioGroup`
- `CgNumericEdit`, `CgSpinEdit`, `CgSearchBox`
- `CgLoadingPanel`, `CgProgressBar`

Focused shared types include `CgSizeMode`, `CgDensity`, `CgIntent`, `CgOrientation`, `CgDirection`, `CgValidationState`, `CgIconName`, `CgIconSource`, and `CgEditorButtonDescriptor<T>`. There is intentionally no universal component-state interface.

The public hooks are `useControllableState` and `useCgId`; `cx` is the public class-name utility. All other primitives and hooks are private implementation details.

## Development

Use Node `^22.22.2 || ^24.15.0 || >=26.0.0`; this matches the locked jsdom requirement. The verified local runtime is Node 24.19.

| Command | Purpose |
| --- | --- |
| `npm run storybook` | Run Storybook on port 6006 with theme, density, direction, and a11y controls |
| `npm run build-storybook` | Create the static Storybook build |
| `npm run test:browser` | Build Storybook and run all Playwright browser projects |
| `npm run test:browser:semantic` | Run semantic and Axe checks in Chromium, Firefox, and WebKit |
| `npm run test:browser:visual` | Compare canonical Chromium screenshots |
| `npm run test:browser:update` | Regenerate Chromium screenshots on the current platform |
| `npm run typecheck` | Strict TypeScript check for source, tests, and Storybook |
| `npm run lint` | Type-aware ESLint and React Hooks rules |
| `npm run test` | Semantic Vitest/Testing Library suite |
| `npm run check:cycles` | Reject relative-import cycles in shipped source |
| `npm run build` | Clean, type-check, and build the ESM library/declarations/styles |
| `npm run verify:package` | Verify exports, declarations/maps, CSS, React externalization, ESM import, and dry-run tarball |
| `npm run verify` | Run all gates, including the static Storybook and package checks |

Install browser binaries once with `npx playwright install chromium firefox webkit`. Storybook's global toolbar switches light/dark, comfortable/compact, and LTR/RTL. Every component has its own story module with applicable controlled/uncontrolled, disabled, read-only, required/invalid, size, long/empty, loading, keyboard, and Arabic RTL scenarios. Each module records its Razor source and known difference. Storybook retains its accessibility panel; Playwright also runs Axe against canonical stories and fails serious or critical findings.

Chromium screenshots in `tests/browser/__snapshots__` are canonical Windows/Node 24.19 baselines. Playwright snapshots are platform-specific; regenerate them on the same operating system used for comparison. Browser tests serve the prebuilt Storybook through a lifecycle-managed Vite preview server. No CI workflow is installed; browser gates run locally through `npm run verify`.

The Phase 3 verification on 2026-08-24 under Node 24.19 passes 62 Vitest tests, 57 semantic/Axe browser tests across Chromium, Firefox, and WebKit, 37 Chromium visual tests comparing 40 snapshots, the 77-module cycle scan, library/declaration and static Storybook builds, and package verification with exactly 18 runtime exports and a successful ESM dry-run import.

## Packaging

The library is ESM-only. Vite preserves modules for tree-shaking, keeps React external, emits declarations and declaration maps, and produces `dist/cashgear-ui.css`, exported only as `@cashgear/ui/styles.css`. `npm run verify:package` also runs `npm pack --dry-run` so the publish allow-list is checked before release.

See [the parity ledger](docs/cgcomplib-react-parity.md) for the original and current Razor snapshots, source/test/story paths, intentional differences, exact verification results, and deferred advanced components.
