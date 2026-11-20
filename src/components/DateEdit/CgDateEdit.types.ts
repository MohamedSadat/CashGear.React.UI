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
import type { CgDateValue, CgDayOfWeek } from '../../types/date';

export type { CgDateValue, CgDayOfWeek } from '../../types/date';
export type CgDateEditChangeReason = 'manual-input' | 'calendar-selection' | 'today-button' | 'clear-button' | 'scroll-picker' | 'native-picker';
/** The drop-down surface. Blazor `CgDatePickerDisplayMode`. */
export type CgDatePickerDisplayMode = 'auto' | 'calendar' | 'scrollPicker' | 'native';
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
  /** The calendar's heading button's description in the day view; the button is named by the month and year it shows. */
  chooseMonthAndYear: string;
  /** The calendar's heading button's description in the month and year views; the button is named by the year or years it shows. */
  chooseYear: string;
  today: string;
  clear: string;
  selected: string;
  unavailable: string;
  /** Scroll picker column names. */
  day: string;
  month: string;
  year: string;
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
  /** Overrides the calendar's current civil date. Useful for deterministic SSR, previews, and tests. */
  today?: CgDateValue;
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
  /**
   * The drop-down surface: `calendar`, `scrollPicker` (touch-sized wheels), `native` (the operating system's
   * picker on touch devices) or `auto` (the default: wheels on a coarse pointer below a 48rem viewport,
   * otherwise the calendar).
   */
  pickerDisplayMode?: CgDatePickerDisplayMode;
  /** Column order and rendering of the scroll picker; falls back to `editFormat`. `MMM`/`MMMM` show month names. */
  scrollPickerFormat?: string;
  /** Announced when the scroll picker lands on a blocked date; falls back to `disabledDateMessage`. */
  disabledDateNotificationText?: string;
  /** Two-digit years expand to the century ending here. Defaults to 2049, as .NET's Gregorian calendar. */
  twoDigitYearMax?: number;
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
