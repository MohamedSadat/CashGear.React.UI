import type { ChangeEvent, SelectHTMLAttributes } from 'react';
import type { CgBaseProps, CgSizeMode, CgValidationState } from '../../types';

export interface CgSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  /** Options with the same group are listed together under it (an `optgroup`). */
  group?: string;
}

export interface CgSelectChangeDetails {
  readonly option: CgSelectOption | null;
  readonly event: ChangeEvent<HTMLSelectElement>;
}

type NativeSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'defaultValue' | 'onChange' | 'multiple' | 'size' | 'children' | 'className' | 'style'>;

export interface CgSelectProps extends NativeSelectProps, CgBaseProps {
  options: readonly CgSelectOption[];
  /** The chosen value; `null` shows the placeholder. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null, details: CgSelectChangeDetails) => void;
  /** The first entry while nothing is chosen, such as "Choose a type". Without it the first option is chosen. */
  placeholder?: string;
  size?: CgSizeMode;
  fullWidth?: boolean;
  /** Shown but not changeable (a native select has no read-only state of its own). */
  readOnly?: boolean;
  validationState?: CgValidationState;
}
