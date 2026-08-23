import type { ChangeEvent, ChangeEventHandler, InputHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSize, CgValidationState } from '../../types/common';

/**
 * Native input attributes the component owns:
 * - `value`/`defaultValue`/`onChange` are re-declared with a friendlier signature.
 * - `size` is shadowed by the CashGear size scale (the HTML `size` attribute is
 *   a character count and is not useful here).
 * - `prefix` (an RDFa attribute) is repurposed as in-field content.
 * - `className`/`style` come from {@link CgBaseProps}.
 */
type CgTextBoxNativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'className'
  | 'style'
  | 'size'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'type'
  | 'prefix'
>;

/** Input types this control supports. Structured editors get their own components. */
export type CgTextBoxType = 'text' | 'password' | 'email' | 'tel' | 'url' | 'search';

export interface CgTextBoxProps extends CgTextBoxNativeProps, CgBaseProps {
  /** Visible label. Omit only when `aria-label`/`aria-labelledby` is supplied. */
  label?: ReactNode;
  /**
   * Controlled value. Supplying it makes the control controlled; the consumer
   * must then update it from `onValueChange`/`onChange`.
   */
  value?: string;
  /** Initial value for uncontrolled usage. Ignored when `value` is supplied. */
  defaultValue?: string;
  /**
   * Convenience change handler receiving the string directly — the shape most
   * ERP forms actually want. The native `onChange` is also available.
   */
  onValueChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  /** Native change handler, fired alongside `onValueChange`. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /**
   * Control height, aligned with every other CashGear control.
   * @default 'md'
   */
  size?: CgSize;
  /**
   * Validation state. `'error'` also sets `aria-invalid` on the input.
   * @default 'none'
   */
  validationState?: CgValidationState;
  /**
   * Message rendered under the input. When `validationState` is `'error'` it is
   * exposed via `aria-errormessage`, otherwise via `aria-describedby`.
   */
  message?: ReactNode;
  /** Marks the field required and renders a required indicator next to the label. */
  required?: boolean;
  /** Disables the input entirely (no focus, no events). */
  disabled?: boolean;
  /** Renders the input read-only: focusable and copyable, but not editable. */
  readOnly?: boolean;
  /** Stretches the control to the width of its container. @default false */
  fullWidth?: boolean;
  /** Decorative content rendered inside the field, before the text. */
  prefix?: ReactNode;
  /** Decorative content rendered inside the field, after the text. */
  suffix?: ReactNode;
  /** Input type. @default 'text' */
  type?: CgTextBoxType;
}
