import type { ChangeEvent, InputHTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgClearButtonDisplayMode, CgEditorButtonDescriptor, CgIconSource, CgSizeMode, CgTextCommitMode, CgValidationState } from '../../types';

type NativeTextBoxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'onChange' | 'type' | 'prefix'>;
export type CgTextBoxType = 'text' | 'password' | 'email' | 'tel' | 'url' | 'search';
export type CgTextChangeReason = 'input' | 'blur' | 'debounce' | 'clear' | 'reset';
export interface CgTextValueChange { reason: CgTextChangeReason; event?: ChangeEvent<HTMLInputElement>; }

export interface CgTextBoxProps extends NativeTextBoxProps, CgBaseProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: CgTextValueChange) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  commitMode?: CgTextCommitMode;
  debounceMs?: number;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  fullWidth?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  leadingIcon?: CgIconSource;
  trailingIcon?: CgIconSource;
  buttons?: ReadonlyArray<CgEditorButtonDescriptor<string>>;
  clearButton?: CgClearButtonDisplayMode;
  clearAriaLabel?: string;
  passwordReveal?: boolean;
  revealAriaLabel?: string;
  type?: CgTextBoxType;
}
