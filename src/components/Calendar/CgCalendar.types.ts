import type { HTMLAttributes, KeyboardEvent, ReactNode, SyntheticEvent } from 'react';
import type { CgBaseProps, CgDensity, CgDirection } from '../../types';
import type { CgDateRangeValue, CgDateValue, CgDayOfWeek } from '../../types/date';

export type CgCalendarSelectionMode = 'single' | 'range' | 'multiple';
export type CgCalendarView = 'day' | 'month' | 'year';
export type CgCalendarChangeReason = 'selection' | 'today' | 'clear';
/** How week 1 of a year is chosen, as .NET `CalendarWeekRule`. */
export type CgCalendarWeekNumberRule = 'firstDay' | 'firstFullWeek' | 'firstFourDayWeek';

export interface CgCalendarLabels {
  calendar: string;
  previousPeriod: string;
  nextPeriod: string;
  /** The day view's heading button's description; the button is named by the month and year it shows. */
  chooseMonthAndYear: string;
  /** The month and year views' heading button's description; the button is named by the year or years it shows. */
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
  /** Shown while `loading` is true. */
  loading: string;
  /** Accessible name of a week-number cell; `{0}` is the number. */
  weekNumber: string;
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

/** The dates the calendar currently draws, reported after each change. Blazor `VisibleRangeChanged`. */
export interface CgCalendarVisibleRangeChangeDetails {
  /** First drawn date: the first cell of the first month, or the first day of the drawn year or years. */
  startDate: CgDateValue;
  /** Last drawn date. */
  endDate: CgDateValue;
  visibleDate: CgDateValue;
  view: CgCalendarView;
  monthCount: number;
  /** Increases with every report, so a host can drop answers to an older range. */
  version: number;
}

export interface CgCalendarHeaderRenderContext {
  visibleDate: CgDateValue;
  view: CgCalendarView;
  /** The finest view, where a click selects. */
  selectionView: CgCalendarView;
  /** The default heading text. */
  heading: string;
}

export interface CgCalendarFooterRenderContext {
  today: CgDateValue;
  canSelectToday: boolean;
  canClear: boolean;
  readOnly: boolean;
  disabled: boolean;
}

export interface CgCalendarMonthRenderContext {
  /** First day of the month. */
  date: CgDateValue;
  name: string;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
}

export interface CgCalendarYearRenderContext {
  year: number;
  isSelected: boolean;
  isFocused: boolean;
  isDisabled: boolean;
  /** The first and last years of the twelve-year grid lie outside its decade. */
  isOutsideDecade: boolean;
}

export interface CgCalendarWeekdayRenderContext {
  dayOfWeek: CgDayOfWeek;
  shortName: string;
  fullName: string;
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
  /**
   * The calendar's starting and finest view, and the unit it selects. `month` selects the first day of a
   * month, `year` selects 1 January. Defaults to `day`. Blazor `ViewMode`.
   */
  selectionView?: CgCalendarView;
  /** Draws a week-number column. Defaults to false. */
  showWeekNumbers?: boolean;
  /** Week-numbering rule. Defaults to the locale's. */
  weekNumberRule?: CgCalendarWeekNumberRule;
  /** Covers the calendar with a polite loading status, for example while availability loads. */
  loading?: boolean;
  /** Replaces the loading spinner and text. */
  renderLoading?: () => ReactNode;
  onVisibleRangeChange?: (details: CgCalendarVisibleRangeChangeDetails) => void;
  /** Content of the heading button. */
  renderHeader?: (context: CgCalendarHeaderRenderContext) => ReactNode;
  /** Extra footer content after the Today and Clear buttons; its presence shows the footer. */
  renderFooter?: (context: CgCalendarFooterRenderContext) => ReactNode;
  renderMonth?: (context: CgCalendarMonthRenderContext) => ReactNode;
  renderYear?: (context: CgCalendarYearRenderContext) => ReactNode;
  renderWeekday?: (context: CgCalendarWeekdayRenderContext) => ReactNode;
  /** Shows one month instead of two below a 48rem viewport, navigating by one month. Defaults to true. */
  autoCollapseMonths?: boolean;
  /** Draws the days of neighbouring months in the grid. Defaults to true. */
  showOutsideMonthDates?: boolean;
  /** Lets the days of neighbouring months be selected. Defaults to true. */
  allowOutsideMonthSelection?: boolean;
  /** Always draws six weeks; `false` draws four to six as the month needs. Defaults to true. */
  fixedSixWeekLayout?: boolean;
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

export interface CgCalendarMultipleProps extends CgCalendarCommonProps {
  selectionMode: 'multiple';
  value?: readonly CgDateValue[];
  defaultValue?: readonly CgDateValue[];
  onValueChange?: (value: readonly CgDateValue[], details: CgCalendarValueChangeDetails<readonly CgDateValue[]>) => void;
}

export type CgCalendarProps = CgCalendarSingleProps | CgCalendarRangeProps | CgCalendarMultipleProps;
