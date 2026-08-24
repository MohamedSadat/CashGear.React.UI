import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSizeMode, CgValidationState } from '../../types';
type NativeSwitchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'defaultChecked' | 'onChange' | 'size' | 'type' | 'className' | 'style' | 'readOnly' | 'role'>;
export interface CgSwitchProps extends NativeSwitchProps, CgBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean, event?: ChangeEvent<HTMLInputElement>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  label?: ReactNode;
  description?: ReactNode;
  labelPosition?: 'start' | 'end';
  size?: CgSizeMode;
  readOnly?: boolean;
  validationState?: CgValidationState;
}
