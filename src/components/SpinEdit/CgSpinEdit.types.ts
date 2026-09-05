import type { InputHTMLAttributes } from 'react';
import type { CgNumericEditProps } from '../NumericEdit';
export interface CgSpinEditProps extends Omit<CgNumericEditProps, 'buttons' | 'onValueChange' | 'step'> {
  step?: number;
  pageStep?: number;
  onValueChange?: CgNumericEditProps['onValueChange'];
  allowExpressions?: boolean;
  updateValueOnInput?: boolean;
  showSpinButtons?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  incrementAriaLabel?: string;
  decrementAriaLabel?: string;
  repeatOnHold?: boolean;
}
