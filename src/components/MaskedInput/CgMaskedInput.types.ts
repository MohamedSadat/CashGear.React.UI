import type { InputHTMLAttributes, SyntheticEvent } from 'react';
import type { CgBaseProps, CgDensity, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgMaskedInputShowMask = 'always' | 'onFocus' | 'never';
export type CgMaskedInputChangeReason = 'input' | 'paste' | 'cut' | 'delete' | 'composition' | 'reset';
export type CgMaskedInputCommitReason = 'blur' | 'enter';

export interface CgMaskedInputStateDetails {
  value: string;
  rawValue: string;
  formattedValue: string;
  displayValue: string;
  isEmpty: boolean;
  isComplete: boolean;
  isValid: boolean;
  invalidExternalValue: boolean;
  rejectedCharacters: ReadonlyArray<string>;
}

export interface CgMaskedInputValueChangeDetails extends CgMaskedInputStateDetails {
  reason: CgMaskedInputChangeReason;
  event?: SyntheticEvent<HTMLInputElement>;
}

export interface CgMaskedInputCommitDetails extends CgMaskedInputStateDetails {
  reason: CgMaskedInputCommitReason;
  event: SyntheticEvent<HTMLInputElement>;
}

export interface CgMaskedInputTransitionDetails extends CgMaskedInputStateDetails {
  reason: CgMaskedInputChangeReason;
  event?: SyntheticEvent<HTMLInputElement>;
}

export interface CgMaskedInputFocusDetails extends CgMaskedInputStateDetails {
  reason: 'focus' | 'blur';
  event: SyntheticEvent<HTMLInputElement>;
}

type NativeMaskedInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'type'
>;

export interface CgMaskedInputProps extends NativeMaskedInputProps, CgBaseProps {
  mask: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, details: CgMaskedInputValueChangeDetails) => void;
  onValueCommitted?: (value: string, details: CgMaskedInputCommitDetails) => void;
  onComplete?: (details: CgMaskedInputTransitionDetails) => void;
  onIncomplete?: (details: CgMaskedInputTransitionDetails) => void;
  onMaskedFocus?: (details: CgMaskedInputFocusDetails) => void;
  onMaskedBlur?: (details: CgMaskedInputFocusDetails) => void;
  promptCharacter?: string;
  showMask?: CgMaskedInputShowMask;
  includeLiterals?: boolean;
  allowIncomplete?: boolean;
  requiredMessage?: string;
  incompleteMessage?: string;
  invalidValueMessage?: string;
  validationState?: CgValidationState;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  fullWidth?: boolean;
}
