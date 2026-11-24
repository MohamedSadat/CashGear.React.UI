import type { CgDateValue, CgDayOfWeek } from '../../types/date';

/** How often a rule repeats; `none` is no repetition. */
export type CgRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
/** A frequency that repeats. */
export type CgRecurrenceRepeat = Exclude<CgRecurrenceFrequency, 'none'>;
/** How a rule ends: never, after a number of occurrences, or on a date. */
export type CgRecurrenceRange = 'noEndDate' | 'occurrenceCount' | 'endByDate';
/** A monthly or yearly rule's week: `none` repeats on a day of the month (`dayOfMonth`), the others on `weekDays` of that week. */
export type CgRecurrenceWeekOfMonth = 'none' | 'first' | 'second' | 'third' | 'fourth' | 'last';

/**
 * A repeating pattern, the shape `CgSchedulerRecurrenceRule` extends with its exceptions. Missing
 * fields fall back to the series' first date: its weekday, its day of the month and its month.
 */
export interface CgRecurrenceRule {
  readonly frequency: CgRecurrenceFrequency;
  /** Every how many days, weeks, months or years. Default 1. */
  readonly interval?: number;
  /** Default `noEndDate`. */
  readonly range?: CgRecurrenceRange;
  /** With `occurrenceCount`: how many occurrences, the first date's counted. Default 10. */
  readonly occurrenceCount?: number;
  /** With `endByDate`: the last day an occurrence may fall on, inclusive (`YYYY-MM-DD`, on the series' clock). */
  readonly endDate?: CgDateValue;
  /** Weekly: the days of each week. Daily: only these days. Monthly and yearly with a `weekOfMonth`: the days of that week. */
  readonly weekDays?: readonly CgDayOfWeek[];
  /** Monthly and yearly without a `weekOfMonth`: the day, 1 to 31; a shorter month takes its last day. */
  readonly dayOfMonth?: number;
  /** Yearly: the month, 1 to 12. */
  readonly month?: number;
  readonly weekOfMonth?: CgRecurrenceWeekOfMonth;
}

/** What `cgValidateRecurrence` finds wrong with a rule, by the field to correct. */
export type CgRecurrenceProblem =
  /** An unknown `frequency`, `range` or `weekOfMonth`. */
  | 'rule'
  /** `interval` is not a whole number above 0. */
  | 'interval'
  /** With `occurrenceCount`, the count is not a whole number above 0. */
  | 'occurrenceCount'
  /** With `endByDate`, `endDate` is missing or not a `YYYY-MM-DD` date. */
  | 'endDate'
  /** `dayOfMonth` is not 1 to 31. */
  | 'dayOfMonth'
  /** `month` is not 1 to 12. */
  | 'month'
  /** `weekDays` names an unknown day. */
  | 'weekDays'
  /** Given a start: the rule can never fall on a day (daily every 7 days, on weekdays other than the start's). */
  | 'unreachable';

/** A rule from its first occurrence. */
export interface CgRecurrenceSeries {
  readonly rule: CgRecurrenceRule;
  /**
   * The first occurrence's start: a day (`YYYY-MM-DD`), whose occurrences are days, or an instant
   * with an offset (`2026-11-30T07:00:00Z`), whose occurrences are instants (UTC) at the same wall-clock
   * time in `timeZone`.
   */
  readonly start: string;
  /** The IANA zone an instant's series keeps its wall-clock time in, across offset changes. Default `UTC`; days ignore it. */
  readonly timeZone?: string;
}

/** The words `CgRecurrenceFields` writes; every one is the caller's. */
export interface CgRecurrenceFieldsLabels {
  /** The group's legend. */
  legend: string;
  frequency: string;
  /** Each frequency's option; `none` only when `frequencies` offers it. */
  frequencies: Readonly<Record<CgRecurrenceRepeat, string>> & { readonly none?: string };
  interval: string;
  /** Written after the interval, for example "weeks"; it describes the field. */
  intervalUnit?: (frequency: CgRecurrenceRepeat, interval: number) => string;
  /** The legend of the weekdays' checkboxes. */
  weekDays: string;
  weekOfMonth: string;
  /** Each week's option; `none` is "on a day of the month". */
  weeksOfMonth: Readonly<Record<CgRecurrenceWeekOfMonth, string>>;
  dayOfMonth: string;
  month: string;
  /** How the rule ends, with `showEnd`. */
  range: string;
  ranges: Readonly<Record<CgRecurrenceRange, string>>;
  occurrenceCount: string;
  endDate: string;
  /** A weekday's name on its checkbox. Default: the short name in `locale`. */
  weekDay?: (day: CgDayOfWeek) => string;
  /** A month's name in the month list. Default: the long name in `locale`. */
  monthName?: (month: number) => string;
}

export interface CgRecurrenceFieldsProps<TRule extends CgRecurrenceRule = CgRecurrenceRule> {
  /** The rule shown. Fields it has and the component does not know (a scheduler's exceptions) are kept in every change. */
  value: TRule;
  /** Each edit, as the whole rule. Choosing `none` keeps the other fields. */
  onChange: (rule: TRule) => void;
  labels: CgRecurrenceFieldsLabels;
  /** For the weekday and month names and the week's first day. Default `en-US`. */
  locale?: string;
  /** The weekdays' order. Default: the locale's first day (Saturday in Arabic, Sunday in American English). */
  firstDayOfWeek?: CgDayOfWeek;
  /** The frequencies offered, in this order. Default `none`, `daily`, `weekly`, `monthly`, `yearly`. */
  frequencies?: readonly CgRecurrenceFrequency[];
  /** `false` leaves out how the rule ends (the range, count and end date). Default true. */
  showEnd?: boolean;
  /** Offers weekdays for a daily rule too ("every day, on weekdays only"). Default false: weekdays for weekly rules, and monthly or yearly ones on a week. */
  dailyWeekDays?: boolean;
  /** The series' first date (a day or an instant), whose day of the month and month the fields show until the rule sets them. */
  start?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** The pieces of a summary, for `CgRecurrenceSummaryWords.sentence`. */
export interface CgRecurrenceSummaryParts {
  /** "Every 2 weeks". */
  readonly every: string;
  /** "on Monday and Wednesday", "on day 31", "on the last Friday", "on 15 March". */
  readonly on?: string;
  /** A yearly rule on a week: "of March". */
  readonly month?: string;
  /** "5 times", "until 31 Dec 2026". */
  readonly end?: string;
}

/** The words `cgSummarizeRecurrence` writes a rule in. Names of days and months, lists and dates come from `Intl` in the locale. */
export interface CgRecurrenceSummaryWords {
  /** A rule that does not repeat. */
  none: string;
  /** "Every day", "Every 2 weeks". */
  every: (frequency: CgRecurrenceRepeat, interval: number) => string;
  /** Weekly, or daily on some days: "on Monday and Wednesday". */
  onWeekDays: (days: string) => string;
  /** Monthly on a day: "on day 15". */
  onDayOfMonth: (day: number) => string;
  /** Yearly on a day: "on 15 March". */
  onDate: (month: string, day: number) => string;
  /** Monthly or yearly on a week: "on the first Monday". */
  onWeekOfMonth: (week: Exclude<CgRecurrenceWeekOfMonth, 'none'>, days: string) => string;
  /** Yearly on a week: "of March". */
  ofMonth: (month: string) => string;
  /** "5 times". */
  times: (count: number) => string;
  /** "until 31 Dec 2026". */
  until: (date: string) => string;
  /** Joins the pieces. Default: `every`, `on` and `month` with spaces, then a comma and `end`. */
  sentence?: (parts: CgRecurrenceSummaryParts) => string;
}

export interface CgRecurrenceSummaryOptions {
  /** Default `en-US`. */
  locale?: string;
  /** The series' first date (a day or an instant): the weekday, day and month a rule falls back to. */
  start?: string;
  /** The order weekdays are listed in. Default: the locale's first day. */
  firstDayOfWeek?: CgDayOfWeek;
  /** The IANA zone `start`, when an instant, is read in. Default `UTC`. */
  timeZone?: string;
}
