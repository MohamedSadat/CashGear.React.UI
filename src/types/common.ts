import type { CSSProperties } from 'react';

/**
 * Cross-cutting types shared by every CashGear control.
 *
 * These exist so that the library's public API stays *consistent*: a size is
 * always a `CgSize`, a validation state is always a `CgValidationState`, and
 * every component accepts the same small set of base props. New components
 * should reuse these rather than inventing parallel vocabularies.
 */

/** Control height scale. `md` is the default for dense business screens. */
export type CgSize = 'sm' | 'md' | 'lg';

/** Visual weight of an interactive control. */
export type CgVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Validation / feedback state of a data-entry control. */
export type CgValidationState = 'none' | 'error' | 'warning' | 'success';

/**
 * Props every CashGear component accepts.
 *
 * `className` and `style` are intentionally passed through: applications need
 * an escape hatch for layout (grid placement, widths) without the library
 * having to model every layout concern.
 */
export interface CgBaseProps {
  /** Extra class name(s) merged after the component's own classes. */
  className?: string;
  /** Inline styles merged onto the root element. Prefer tokens over ad-hoc CSS. */
  style?: CSSProperties;
  /** Test hook, forwarded to the root element as `data-testid`. */
  'data-testid'?: string;
}
