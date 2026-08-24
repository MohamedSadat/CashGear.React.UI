import type { CgNumericEditProps } from '../NumericEdit';
export interface CgSpinEditProps extends Omit<CgNumericEditProps, 'buttons' | 'onValueChange' | 'step'> {
  step?: number;
  pageStep?: number;
  onValueChange?: CgNumericEditProps['onValueChange'];
  incrementAriaLabel?: string;
  decrementAriaLabel?: string;
}
