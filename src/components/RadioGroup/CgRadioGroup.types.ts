import type { FieldsetHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgOrientation, CgSizeMode, CgValidationState } from '../../types';

export type CgRadioItemAlignment = 'start' | 'center' | 'end' | 'stretch';
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
  /** Side of each item's label relative to its radio. Defaults to `end`. Blazor `ItemLabelPosition`. */
  itemLabelPosition?: 'start' | 'end';
  /** Alignment of each item in its row. Defaults to `start`. Blazor `ItemAlignment`. */
  itemAlignment?: CgRadioItemAlignment;
  /** `false` keeps each label on one line. Defaults to true. Blazor `ItemLabelWrapMode`. */
  itemLabelWrap?: boolean;
  size?: CgSizeMode;
  readOnly?: boolean;
  required?: boolean;
  validationState?: CgValidationState;
  direction?: CgDirection;
  renderOption?: (context: CgRadioRenderContext<TValue>) => ReactNode;
}
