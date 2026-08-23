/**
 * Public API of `@cashgear/ui`.
 *
 * This file is the *only* entry point consumers may import from. Anything not
 * re-exported here is an internal implementation detail and may change in any
 * release without notice — the `exports` map in `package.json` enforces that
 * by refusing deep imports such as `@cashgear/ui/dist/components/Button`.
 *
 * Keep this list explicit (no `export *` of internals) so the public surface is
 * reviewable at a glance.
 */

/* Design tokens. Collected into `dist/cashgear-ui.css`, which applications
 * import once via `@cashgear/ui/styles.css`. */
import './styles/index.css';

/* --- Components ---------------------------------------------------------- */
export { CgButton } from './components/Button';
export type { CgButtonProps } from './components/Button';

export { CgTextBox } from './components/TextBox';
export type { CgTextBoxProps, CgTextBoxType } from './components/TextBox';

/* --- Shared types -------------------------------------------------------- */
export type { CgSize, CgVariant, CgValidationState, CgBaseProps } from './types';

/* --- Hooks ---------------------------------------------------------------
 * Exported because consuming applications building their own controls on top
 * of this library need the same controlled/uncontrolled and id semantics. */
export { useControllableState, useCgId } from './hooks';
export type { CgStateUpdater } from './hooks';

/* --- Utilities ------------------------------------------------------------ */
export { cx } from './utils';
export type { CgClassValue } from './utils';
