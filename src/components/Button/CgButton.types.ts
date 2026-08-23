import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSize, CgVariant } from '../../types/common';

/**
 * Native button attributes the component owns and therefore does not accept
 * from consumers:
 * - `type` is modelled by the explicit `type` prop with a safe default.
 * - `className`/`style` come from {@link CgBaseProps}.
 */
type CgButtonNativeProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'style' | 'type' | 'children'
>;

export interface CgButtonProps extends CgButtonNativeProps, CgBaseProps {
  /** Button label. Required — an unlabelled button is not accessible. */
  children: ReactNode;
  /**
   * Visual weight.
   * @default 'secondary'
   */
  variant?: CgVariant;
  /**
   * Control height, aligned with every other CashGear control.
   * @default 'md'
   */
  size?: CgSize;
  /**
   * `true` renders a spinner, marks the button `aria-busy` and blocks
   * activation, without collapsing the button's width.
   * @default false
   */
  loading?: boolean;
  /**
   * Disables the button. A disabled button is removed from the tab order and
   * fires no events.
   * @default false
   */
  disabled?: boolean;
  /**
   * Stretches the button to the full width of its container — useful in
   * toolbars, form footers and narrow viewports.
   * @default false
   */
  fullWidth?: boolean;
  /** Decorative element rendered before the label. Hidden from assistive tech. */
  iconBefore?: ReactNode;
  /** Decorative element rendered after the label. Hidden from assistive tech. */
  iconAfter?: ReactNode;
  /**
   * Submit behaviour. Defaults to `'button'` so a button inside a form never
   * submits it by accident — an explicit opt-in is safer in ERP forms.
   * @default 'button'
   */
  type?: 'button' | 'submit' | 'reset';
}
