import type { FormEvent, InputHTMLAttributes, Ref, SyntheticEvent } from 'react';
import type {
  CgBaseProps,
  CgDensity,
  CgDirection,
  CgEditorButtonDescriptor,
  CgIntent,
  CgSizeMode,
  CgValidationState,
} from '../../types';

/** A timezone-free clock time in canonical HH:mm:ss.SSS form. */
export type CgTimeValue = string;

export type CgTimeEditChangeReason = 'manual-input' | 'picker-apply' | 'clear-button';
export type CgTimeEditOpenChangeReason =
  | 'programmatic'
  | 'keyboard'
  | 'toggle-button'
  | 'escape'
  | 'outside-click'
  | 'picker-apply'
  | 'clear-button'
  | 'reset'
  | 'anchor-lost';

export interface CgTimeEditValueChangeDetails {
  value: CgTimeValue | null;
  previousValue: CgTimeValue | null;
  reason: CgTimeEditChangeReason;
  event?: Event | SyntheticEvent;
}

export interface CgTimeEditBeforeValueChangeDetails extends CgTimeEditValueChangeDetails {
  signal: AbortSignal;
}

export type CgTimeEditCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgTimeEditOpenChangeDetails {
  reason: CgTimeEditOpenChangeReason;
  event?: Event | SyntheticEvent;
}

export interface CgTimeEditLabels {
  pickerDialog: string;
  openPicker: string;
  clearTime: string;
  hour: string;
  minute: string;
  second: string;
  period: string;
  apply: string;
  cancel: string;
}

export interface CgTimeEditActions {
  focus: () => void;
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  clear: () => Promise<void>;
}

type NativeTimeInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'children' | 'className' | 'style' | 'size' | 'type' | 'value' | 'defaultValue'
  | 'name' | 'form' | 'required' | 'disabled' | 'readOnly' | 'onInvalid'
>;

export interface CgTimeEditProps extends NativeTimeInputProps, CgBaseProps {
  value?: CgTimeValue | null;
  defaultValue?: CgTimeValue | null;
  onValueChange?: (value: CgTimeValue | null, details: CgTimeEditValueChangeDetails) => void;
  onBeforeValueChange?: (details: CgTimeEditBeforeValueChangeDetails) => CgTimeEditCancelableResult;
  onBeforeValueChangeError?: (error: unknown, details: CgTimeEditBeforeValueChangeDetails) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgTimeEditOpenChangeDetails) => void;

  editFormat?: string;
  displayFormat?: string;
  locale?: string;
  minTime?: CgTimeValue;
  maxTime?: CgTimeValue;
  minuteStep?: number;
  showSeconds?: boolean;
  allowClear?: boolean;
  showClearButton?: boolean;
  showPickerButton?: boolean;
  labels?: Partial<CgTimeEditLabels>;
  invalidFormatMessage?: string;
  outOfRangeMessage?: string;
  requiredMessage?: string;

  buttons?: ReadonlyArray<CgEditorButtonDescriptor<CgTimeValue | null>>;
  inputRef?: Ref<HTMLInputElement>;
  actionsRef?: Ref<CgTimeEditActions>;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  intent?: Exclude<CgIntent, 'link'>;
  validationState?: CgValidationState;
  fullWidth?: boolean;
}
