import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import type { CgBaseProps, CgEditorButtonDescriptor, CgSizeMode, CgValidationState } from '../../types';
type NativeNumericProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'onChange' | 'type' | 'inputMode' | 'prefix' | 'min' | 'max' | 'step'>;
export type CgNumericChangeReason = 'input' | 'blur' | 'enter' | 'step' | 'reset';
export interface CgNumericValueChange { reason: CgNumericChangeReason; event?: ChangeEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>; }
export interface CgNumericEditProps extends NativeNumericProps, CgBaseProps {
  value?: number | null;
  defaultValue?: number | null;
  onValueChange?: (value: number | null, details: CgNumericValueChange) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onInvalidValue?: (draft: string) => void;
  locale?: string;
  formatStyle?: 'decimal' | 'currency' | 'percent';
  currency?: string;
  precision?: number;
  useGrouping?: boolean;
  min?: number;
  max?: number;
  step?: number;
  allowNegative?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  buttons?: ReadonlyArray<CgEditorButtonDescriptor<number | null>>;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  fullWidth?: boolean;
}
