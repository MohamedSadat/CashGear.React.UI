import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgOrientation, CgSizeMode, CgValidationState } from '../../types';

export interface CgRadioOption<TValue extends string | number> { value: TValue; label: ReactNode; description?: ReactNode; disabled?: boolean; }
export interface CgRadioRenderContext<TValue extends string | number> { option: CgRadioOption<TValue>; checked: boolean; index: number; }
type NativeFieldsetProps = Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, 'className' | 'style' | 'onChange' | 'value'>;
export interface CgRadioGroupProps<TValue extends string | number = string> extends NativeFieldsetProps, CgBaseProps {
  options: ReadonlyArray<CgRadioOption<TValue>>;
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  legend?: ReactNode;
  orientation?: CgOrientation;
  wrap?: boolean;
  size?: CgSizeMode;
  readOnly?: boolean;
  required?: boolean;
  validationState?: CgValidationState;
  direction?: CgDirection;
  renderOption?: (context: CgRadioRenderContext<TValue>) => ReactNode;
}
