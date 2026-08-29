/** A Gregorian civil date in canonical YYYY-MM-DD form. */
export type CgDateValue = string;

export type CgDayOfWeek =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

/**
 * An inclusive civil-date range. `null` is the canonical empty value; nullable
 * endpoints deliberately preserve externally controlled partial/invalid state.
 */
export type CgDateRangeValue = Readonly<{
  start: CgDateValue | null;
  end: CgDateValue | null;
}> | null;
