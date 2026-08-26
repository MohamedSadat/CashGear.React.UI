import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react';
import type {
  CgBaseProps,
  CgDensity,
  CgDirection,
  CgEditorButtonDescriptor,
  CgIntent,
  CgSizeMode,
  CgValidationState,
} from '../../types';

/** A Gregorian civil date in canonical YYYY-MM-DD form. */
export type CgDateValue = string;
export type CgDayOfWeek = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
export type CgDateEditChangeReason = 'manual-input' | 'calendar-selection' | 'today-button' | 'clear-button';
export type CgDateEditOpenChangeReason =
  | 'programmatic'
  | 'keyboard'
  | 'toggle-button'
  | 'escape'
  | 'outside-click'
  | 'calendar-selection'
  | 'today-button'
  | 'clear-button'
  | 'reset'
  | 'anchor-lost';

export interface CgDateEditValueChangeDetails {
  value: CgDateValue | null;
  previousValue: CgDateValue | null;
  reason: CgDateEditChangeReason;
  event?: Event | SyntheticEvent;
}

export interface CgDateEditBeforeValueChangeDetails extends CgDateEditValueChangeDetails {
  signal: AbortSignal;
}

export type CgDateEditCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgDateEditOpenChangeDetails {
  reason: CgDateEditOpenChangeReason;
  event?: Event | SyntheticEvent;
}

export interface CgDateEditDayRenderContext {
  date: CgDateValue;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
}

export interface CgDateEditLabels {
  calendarDialog: string;
  openCalendar: string;
  clearDate: string;
  previousPeriod: string;
  nextPeriod: string;
  chooseMonthAndYear: string;
  chooseYear: string;
  today: string;
  clear: string;
  selected: string;
  unavailable: string;
}

export interface CgDateEditActions {
  focus: () => void;
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  clear: () => Promise<void>;
  today: () => Promise<void>;
}

type NativeDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'children' | 'className' | 'style' | 'size' | 'type' | 'value' | 'defaultValue'
  | 'name' | 'form' | 'required' | 'disabled' | 'readOnly' | 'onInvalid'
>;

export interface CgDateEditProps extends NativeDateInputProps, CgBaseProps {
  value?: CgDateValue | null;
  defaultValue?: CgDateValue | null;
  onValueChange?: (value: CgDateValue | null, details: CgDateEditValueChangeDetails) => void;
  onBeforeValueChange?: (details: CgDateEditBeforeValueChangeDetails) => CgDateEditCancelableResult;
  onBeforeValueChangeError?: (error: unknown, details: CgDateEditBeforeValueChangeDetails) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgDateEditOpenChangeDetails) => void;

  editFormat?: string;
  displayFormat?: string;
  locale?: string;
  firstDayOfWeek?: CgDayOfWeek;
  minDate?: CgDateValue;
  maxDate?: CgDateValue;
  isDateDisabled?: (date: CgDateValue) => boolean;
  renderDay?: (context: CgDateEditDayRenderContext) => ReactNode;

  allowClear?: boolean;
  showClearButton?: boolean;
  showTodayButton?: boolean;
  showCalendarButton?: boolean;
  labels?: Partial<CgDateEditLabels>;
  invalidFormatMessage?: string;
  outOfRangeMessage?: string;
  disabledDateMessage?: string;
  requiredMessage?: string;

  buttons?: ReadonlyArray<CgEditorButtonDescriptor<CgDateValue | null>>;
  inputRef?: Ref<HTMLInputElement>;
  actionsRef?: Ref<CgDateEditActions>;
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
