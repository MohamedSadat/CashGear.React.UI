import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSizeMode, CgValidationState } from '../../types';

export type CgCheckedState = boolean | 'indeterminate';
export type CgLabelPosition = 'start' | 'end';
type NativeCheckBoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'defaultChecked' | 'onChange' | 'size' | 'type' | 'className' | 'style' | 'readOnly'>;
export interface CgCheckBoxProps extends NativeCheckBoxProps, CgBaseProps {
  checked?: CgCheckedState;
  defaultChecked?: CgCheckedState;
  onCheckedChange?: (checked: CgCheckedState, event?: ChangeEvent<HTMLInputElement>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  cycleIndeterminate?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  labelPosition?: CgLabelPosition;
  size?: CgSizeMode;
  readOnly?: boolean;
  validationState?: CgValidationState;
}
