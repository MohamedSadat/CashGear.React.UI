# CashGear.React.UI

`@cashgear/ui` — the shared React component library for every CashGear front end.

---

## 1. Purpose

CashGear.React.UI is the single place where CashGear's user-interface primitives
live. ERP, POS, Shipping and future business applications consume it so that a
button, a text field or (later) a data grid looks and behaves identically
everywhere, and so that a fix or an accessibility improvement ships once.

It is intended to grow into CashGear's internal UI framework — comparable in
responsibility to a small DevExpress or MUI — optimised for **dense business
screens** rather than marketing sites.

**What belongs here:** generic, strongly typed, accessible, reusable controls.

**What must never be added here:**

| Not allowed | Belongs in |
| --- | --- |
| ERP/POS business rules | the consuming application |
| API endpoints, HTTP clients | the application's data layer |
| Domain models (Customer, Product, Invoice…) | the application |
| Authentication, permissions | the application |
| Zustand stores, TanStack Query queries | the application |
| Routing | the application |
| Application DTOs | the application |

The rule of thumb: the library ships `CgLookUpGrid<T>`; the ERP application
composes `CustomerLookup` on top of it. If a component needs to know what a
customer is, it is in the wrong repository.

---

## 2. Installation

While the package is unpublished, install it from a local path or tarball —
see [§7 Local testing](#7-local-testing-from-another-cashgear-application).
Once it is published to CashGear's private registry:

```bash
npm install @cashgear/ui
```

`react` and `react-dom` are **peer dependencies** (`^19.0.0`) and are not
bundled — the consuming application owns the single React instance.

---

## 3. Basic usage

Import the stylesheet once, as early as possible in the application entry point,
then import components by name:

```tsx
// src/main.tsx
import '@cashgear/ui/styles.css';
```

```tsx
import { useState } from 'react';
import { CgButton, CgTextBox } from '@cashgear/ui';

export function CustomerLookup() {
  const [code, setCode] = useState('');

  return (
    <form onSubmit={handleSubmit}>
      <CgTextBox
        label="Customer code"
        value={code}
        onValueChange={setCode}
        required
        validationState={code ? 'none' : 'error'}
        message={code ? undefined : 'Customer code is required'}
        prefix="#"
      />
      <CgButton type="submit" variant="primary" loading={isSaving}>
        Search
      </CgButton>
    </form>
  );
}
```

### Theming

Every component styles itself exclusively through CSS custom properties defined
in `src/styles/tokens.css`. Override any subset to re-theme the whole library —
no component needs to change:

```css
:root {
  --cg-color-primary: #0b7285;
  --cg-control-height-md: 28px;
  --cg-font-size-md: 0.8125rem;
}
```

A dark palette ships as an opt-in token set:

```html
<html data-cg-theme="dark">
```

Token groups: font family/sizes, spacing, radii, borders, control heights,
foreground/background, primary/accent, hover, selected, disabled, error, focus,
elevation and motion.

---

## 4. Development commands

| Command | What it does |
| --- | --- |
| `npm run build` | Cleans `dist/`, type-checks, then produces the ESM build + `.d.ts` |
| `npm run test` | Runs the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with V8 coverage |
| `npm run lint` | ESLint (type-aware) over the whole repo |
| `npm run lint:fix` | ESLint with autofix |
| `npm run typecheck` | `tsc --noEmit` over `src`, `tests` and configs |
| `npm run verify` | typecheck → lint → test → build (what CI runs) |
| `npm run clean` | Removes `dist/` |

---

## 5. Project structure

```
CashGear.React.UI/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── CgButton.tsx           # implementation
│   │   │   ├── CgButton.types.ts      # public prop types
│   │   │   ├── CgButton.module.css    # scoped styles (tokens only)
│   │   │   ├── CgButton.test.tsx      # colocated tests
│   │   │   └── index.ts               # component-level public surface
│   │   ├── TextBox/                   # same five-file shape
│   │   └── index.ts
│   ├── hooks/                         # useControllableState, useCgId
│   ├── types/                         # CgSize, CgVariant, CgValidationState, CgBaseProps
│   ├── utils/                         # cx (class-name joiner)
│   ├── styles/                        # tokens.css + index.css (the theming contract)
│   ├── vite-env.d.ts
│   └── index.ts                       # THE public API — nothing else is importable
├── tests/
│   ├── setup.ts                       # jest-dom matchers + RTL cleanup
│   └── public-api.test.ts             # guards the exported surface
├── eslint.config.js
├── package.json
├── tsconfig.json                      # type-checking (noEmit)
├── tsconfig.build.json                # declaration emit (src only, no tests)
├── vite.config.ts                     # library mode + Vitest config
└── README.md
```

---

## 6. Component development conventions

Follow these when adding a component; they are what makes the library feel like
one product rather than a folder of widgets.

**File layout.** One directory per component under `src/components/<Name>/`,
containing `Cg<Name>.tsx`, `Cg<Name>.types.ts`, `Cg<Name>.module.css`,
`Cg<Name>.test.tsx` and `index.ts`. Export the component from
`src/components/index.ts` and from `src/index.ts`.

**Naming.** Every public component is prefixed `Cg`. Props interfaces are
`Cg<Name>Props`. Shared vocabulary types are `Cg…` too.

**Props API.**
- Extend the underlying element's native attributes, `Omit`-ing the ones the
  component owns, so consumers keep `form`, `name`, `aria-*` and friends.
- Extend `CgBaseProps` for `className`, `style` and `data-testid`.
- Reuse `CgSize`, `CgVariant`, `CgValidationState` — do not invent parallel
  scales.
- Give every optional prop a default and document it with `@default`.
- Data-entry controls must support both controlled (`value`) and uncontrolled
  (`defaultValue`) usage via `useControllableState`.
- Offer a convenience handler (`onValueChange`) *in addition to* the native one,
  never instead of it.

**DOM composition.** Spread `...nativeProps` first, then apply the props the
component guarantees (`className`, `disabled`, `type`), so consumers cannot
accidentally break the component's contract.

**Refs.** Forward the ref to the element callers actually need — the `<button>`,
the `<input>` — not to a wrapper div.

**Styling.** CSS Modules only, and **only** `var(--cg-*)` tokens. A hard-coded
colour or pixel size in a component stylesheet is a bug: it makes the component
un-themeable. Use `:focus-visible` for focus rings and honour
`prefers-reduced-motion`.

**Accessibility.** Keyboard operable, correct roles, labels wired by id,
`aria-invalid`/`aria-errormessage` for validation, decorative content marked
`aria-hidden`. A component that cannot be operated without a mouse is not done.

**Tests.** Every component needs coverage of rendering, props, events, disabled
behaviour, accessibility and ref forwarding. Query by role and accessible name —
if a test needs a CSS-class selector, the component's accessibility is probably
wrong.

**Public API.** Add the component *and its prop types* to `src/index.ts`, and
update the expected-export list in `tests/public-api.test.ts` in the same
commit. That test is the review gate for API changes.

---

## 7. Local testing from another CashGear application

Assuming the two repositories sit side by side:

```
workspace/
├── CashGear.React.UI/
└── ERPClient/
```

### Recommended: `npm link`

Best for day-to-day work — edits to the library appear in ERPClient after a
rebuild, with no reinstall.

```bash
# 1. in the library
cd CashGear.React.UI
npm install
npm run build
npm link

# 2. in the consuming app
cd ../ERPClient
npm link @cashgear/ui
```

Because React is a peer dependency and `npm link` creates a symlink, the app can
end up with **two copies of React** — which breaks hooks with
`Invalid hook call`. Prevent it by pointing both to the app's copy in
`ERPClient/vite.config.ts`:

```ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: fileURLToPath(new URL('./node_modules/react', import.meta.url)),
      'react-dom': fileURLToPath(new URL('./node_modules/react-dom', import.meta.url)),
    },
  },
  // Symlinked packages are not pre-bundled by default; exclude to avoid stale caches.
  optimizeDeps: { exclude: ['@cashgear/ui'] },
});
```

Then in `ERPClient/src/main.tsx`:

```tsx
import '@cashgear/ui/styles.css';
import { CgButton, CgTextBox } from '@cashgear/ui';
```

Run `npm run build` in the library (or `npx vite build --watch`) to pick up
changes. Unlink with `npm unlink @cashgear/ui` in ERPClient.

### Alternative A: file dependency

Simple and closest to a real install, but requires reinstalling after each
library build.

```jsonc
// ERPClient/package.json
{
  "dependencies": {
    "@cashgear/ui": "file:../CashGear.React.UI"
  }
}
```

### Alternative B: tarball (highest fidelity)

Exercises the exact artifact that would be published — the `files` allow-list,
the `exports` map, everything. Use this before cutting a release.

```bash
cd CashGear.React.UI
npm run build
npm pack                       # -> cashgear-ui-0.1.0.tgz

cd ../ERPClient
npm install ../CashGear.React.UI/cashgear-ui-0.1.0.tgz
```

### Verifying the integration

Inside ERPClient, `npm run typecheck` and `npm run build` should both pass, and
the built bundle should contain only the components you imported. Deep imports
such as `@cashgear/ui/dist/components/Button` are intentionally blocked by the
`exports` map and will fail the build.

---

## 8. Build process

`npm run build` runs three steps:

1. **clean** — removes `dist/`.
2. **typecheck** — `tsc --noEmit`; the build fails on any type error.
3. **vite build** — library mode.

What Vite produces:

- **ESM only.** Every CashGear client is Vite/ESM based; a CJS build would be
  dead weight.
- **One output file per source module** (`preserveModules`). Combined with
  `"sideEffects": ["**/*.css"]`, a consuming bundler drops every component the
  app does not import.
- **`react`, `react-dom` and the JSX runtime are external** — never bundled, so
  the app keeps exactly one React instance.
- **`dist/cashgear-ui.css`** — all component CSS and tokens in one stylesheet,
  exposed as `@cashgear/ui/styles.css` so applications control cascade order.
- **`.d.ts` + `.d.ts.map` per module**, generated by `vite-plugin-dts` from
  `tsconfig.build.json` (tests excluded). `src/` is published alongside `dist/`
  so "go to definition" in a consuming app lands on real source.

The `exports` map exposes exactly three entry points — `.`, `./styles.css` and
`./package.json` — so internal modules cannot be imported, and the public API
stays whatever `src/index.ts` says it is.

---

## 9. Future private package publishing

Nothing is published yet. When CashGear is ready, the intended path:

**Registry.** Either GitHub Packages (`https://npm.pkg.github.com`, scoped to
the CashGear organisation) or a private npm organisation. Both authenticate the
`@cashgear` scope; GitHub Packages reuses existing repository permissions and is
the lower-friction option.

**Consumer configuration** — `.npmrc` in each application:

```ini
@cashgear:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

**Safety rails already in place:**
- `publishConfig.access` is `restricted`, so an accidental `npm publish` cannot
  make the package public.
- `files` is an explicit allow-list — nothing leaks into the tarball by accident.
- `prepublishOnly` runs the full `verify` pipeline, so a broken build cannot be
  published.

**Versioning.** Semantic versioning, starting at `0.x` while the API settles.
Any change to `src/index.ts` is an API change: a removal or a signature change
is a breaking change and must bump the major (or the minor while on `0.x`).

**Release flow (when adopted).**

```bash
npm run verify
npm version <patch|minor|major>
git push --follow-tags
npm publish            # or a CI job triggered by the tag
```

A CI workflow (`.github/workflows/ci.yml`) already runs `verify` on every push
and pull request; publishing would be added as a separate tag-triggered job.
