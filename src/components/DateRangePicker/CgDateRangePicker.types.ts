import type { FormEvent, InputHTMLAttributes, ReactNode, Ref, SyntheticEvent } from 'react';
import type {
  CgBaseProps,
  CgDensity,
  CgDirection,
  CgEditorButtonDescriptor,
  CgIntent,
  CgSizeMode,
  CgValidationState,
} from '../../types';
import type { CgDateRangeValue, CgDateValue, CgDayOfWeek } from '../../types/date';
import type { CgCalendarDayRenderContext } from '../Calendar';

export type CgDateRangePickerCommitMode = 'immediate' | 'explicit';
export type CgDateRangePickerChangeReason = 'manual-input' | 'calendar-selection' | 'preset' | 'clear';
export type CgDateRangePickerOpenChangeReason =
  | 'programmatic' | 'keyboard' | 'toggle-button' | 'escape' | 'outside-click'
  | 'apply' | 'cancel' | 'calendar-selection' | 'preset' | 'clear' | 'reset' | 'anchor-lost';

export interface CgDateRangePickerValueChangeDetails {
  value: CgDateRangeValue;
  previousValue: CgDateRangeValue;
  reason: CgDateRangePickerChangeReason;
  event?: Event | SyntheticEvent;
}
export interface CgDateRangePickerBeforeValueChangeDetails extends CgDateRangePickerValueChangeDetails { signal: AbortSignal; }
export type CgDateRangePickerCancelableResult = void | boolean | PromiseLike<void | boolean>;
export interface CgDateRangePickerOpenChangeDetails { reason: CgDateRangePickerOpenChangeReason; event?: Event | SyntheticEvent; }

export interface CgDateRangePresetContext {
  today: CgDateValue;
  locale: string;
  firstDayOfWeek: CgDayOfWeek;
  minDate?: CgDateValue;
  maxDate?: CgDateValue;
}
export interface CgDateRangePreset {
  readonly key: string;
  readonly label: ReactNode;
  readonly getRange: (context: Readonly<CgDateRangePresetContext>) => CgDateRangeValue;
}

export interface CgDateRangePickerLabels {
  calendarDialog: string;
  openCalendar: string;
  clearRange: string;
  presets: string;
  instructions: string;
  apply: string;
  cancel: string;
  invalidFormat: string;
  required: string;
  incomplete: string;
  reversed: string;
  outOfRange: string;
  disabledEndpoint: string;
  tooShort: string;
  tooLong: string;
  unavailablePreset: string;
}

export interface CgDateRangePickerActions {
  focus: () => void;
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  clear: () => Promise<void>;
  apply: () => Promise<void>;
  cancel: () => Promise<void>;
}

type NativeRangeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>,
  'children' | 'className' | 'style' | 'size' | 'type' | 'value' | 'defaultValue' | 'name' | 'form' | 'required' | 'disabled' | 'readOnly' | 'onInvalid'>;

export interface CgDateRangePickerProps extends NativeRangeInputProps, CgBaseProps {
  value?: CgDateRangeValue;
  defaultValue?: CgDateRangeValue;
  onValueChange?: (value: CgDateRangeValue, details: CgDateRangePickerValueChangeDetails) => void;
  onBeforeValueChange?: (details: CgDateRangePickerBeforeValueChangeDetails) => CgDateRangePickerCancelableResult;
  onBeforeValueChangeError?: (error: unknown, details: CgDateRangePickerBeforeValueChangeDetails) => void;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgDateRangePickerOpenChangeDetails) => void;

  commitMode?: CgDateRangePickerCommitMode;
  editFormat?: string;
  displayFormat?: string;
  rangeSeparator?: string;
  locale?: string;
  firstDayOfWeek?: CgDayOfWeek;
  today?: CgDateValue;
  minDate?: CgDateValue;
  maxDate?: CgDateValue;
  isDateDisabled?: (date: CgDateValue) => boolean;
  minimumRangeDays?: number;
  maximumRangeDays?: number;
  allowSingleDayRange?: boolean;
  calendarCount?: 1 | 2;
  renderDay?: (context: CgCalendarDayRenderContext) => ReactNode;

  showPresets?: boolean;
  includeBuiltInPresets?: boolean;
  presets?: ReadonlyArray<CgDateRangePreset>;
  labels?: Partial<CgDateRangePickerLabels>;
  allowClear?: boolean;
  showClearButton?: boolean;
  showCalendarButton?: boolean;
  buttons?: ReadonlyArray<CgEditorButtonDescriptor<CgDateRangeValue>>;

  startName?: string;
  endName?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  actionsRef?: Ref<CgDateRangePickerActions>;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  intent?: Exclude<CgIntent, 'link'>;
  validationState?: CgValidationState;
  fullWidth?: boolean;
}
