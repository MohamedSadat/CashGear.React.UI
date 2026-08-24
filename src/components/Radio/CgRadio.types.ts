import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSizeMode, CgValidationState } from '../../types';
type NativeRadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'defaultChecked' | 'onChange' | 'size' | 'type' | 'className' | 'style' | 'readOnly' | 'value'>;
export interface CgRadioProps<TValue extends string | number = string> extends NativeRadioProps, CgBaseProps {
  value: TValue;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (value: TValue, event: ChangeEvent<HTMLInputElement>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  description?: ReactNode;
  labelPosition?: 'start' | 'end';
  size?: CgSizeMode;
  readOnly?: boolean;
  validationState?: CgValidationState;
}
