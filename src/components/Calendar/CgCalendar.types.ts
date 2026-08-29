import type { HTMLAttributes, KeyboardEvent, ReactNode, SyntheticEvent } from 'react';
import type { CgBaseProps, CgDensity, CgDirection } from '../../types';
import type { CgDateRangeValue, CgDateValue, CgDayOfWeek } from '../../types/date';

export type CgCalendarSelectionMode = 'single' | 'range';
export type CgCalendarView = 'day' | 'month' | 'year';
export type CgCalendarChangeReason = 'selection' | 'today' | 'clear';

export interface CgCalendarLabels {
  calendar: string;
  previousPeriod: string;
  nextPeriod: string;
  chooseMonthAndYear: string;
  chooseYear: string;
  today: string;
  clear: string;
  selected: string;
  rangeStart: string;
  rangeEnd: string;
  inRange: string;
  previewRange: string;
  unavailable: string;
  showing: string;
}

export interface CgCalendarDayRenderContext {
  date: CgDateValue;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isInRange: boolean;
  isRangePreview: boolean;
}

export interface CgCalendarValueChangeDetails<TValue> {
  value: TValue;
  previousValue: TValue;
  reason: CgCalendarChangeReason;
  event?: Event | SyntheticEvent;
}

export interface CgCalendarVisibleDateChangeDetails {
  previousValue: CgDateValue;
  value: CgDateValue;
  view: CgCalendarView;
}

type NativeCalendarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'defaultValue'>;

export interface CgCalendarCommonProps extends NativeCalendarProps, CgBaseProps {
  visibleDate?: CgDateValue;
  defaultVisibleDate?: CgDateValue;
  onVisibleDateChange?: (value: CgDateValue, details: CgCalendarVisibleDateChangeDetails) => void;
  calendarCount?: 1 | 2;
  locale?: string;
  firstDayOfWeek?: CgDayOfWeek;
  today?: CgDateValue;
  minDate?: CgDateValue;
  maxDate?: CgDateValue;
  isDateDisabled?: (date: CgDateValue) => boolean;
  renderDay?: (context: CgCalendarDayRenderContext) => ReactNode;
  labels?: Partial<CgCalendarLabels>;
  direction?: CgDirection;
  density?: CgDensity;
  disabled?: boolean;
  readOnly?: boolean;
  showTodayButton?: boolean;
  showClearButton?: boolean;
  allowClear?: boolean;
  minimumRangeDays?: number;
  maximumRangeDays?: number;
  allowSingleDayRange?: boolean;
  autoFocus?: boolean;
  onEscape?: (event: KeyboardEvent<HTMLElement>) => void;
}

export interface CgCalendarSingleProps extends CgCalendarCommonProps {
  selectionMode?: 'single';
  value?: CgDateValue | null;
  defaultValue?: CgDateValue | null;
  onValueChange?: (value: CgDateValue | null, details: CgCalendarValueChangeDetails<CgDateValue | null>) => void;
}

export interface CgCalendarRangeProps extends CgCalendarCommonProps {
  selectionMode: 'range';
  value?: CgDateRangeValue;
  defaultValue?: CgDateRangeValue;
  onValueChange?: (value: CgDateRangeValue, details: CgCalendarValueChangeDetails<CgDateRangeValue>) => void;
}

export type CgCalendarProps = CgCalendarSingleProps | CgCalendarRangeProps;
