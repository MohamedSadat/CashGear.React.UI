import { useId, useMemo } from 'react';
import { localeFirstDayOfWeek } from '../../internal/date/dateFormat';
import type { CgDayOfWeek } from '../../types/date';
import { cx } from '../../utils';
import { WEEKDAYS } from '../Scheduler/schedulerDate';
import styles from './CgRecurrenceFields.module.css';
import type { CgRecurrenceFieldsProps, CgRecurrenceFrequency, CgRecurrenceRange, CgRecurrenceRule, CgRecurrenceWeekOfMonth } from './CgRecurrenceFields.types';

const FREQUENCIES: readonly CgRecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const WEEKS: readonly CgRecurrenceWeekOfMonth[] = ['none', 'first', 'second', 'third', 'fourth', 'last'];
const RANGES: readonly CgRecurrenceRange[] = ['noEndDate', 'occurrenceCount', 'endByDate'];

/**
 * A recurrence rule's fields, controlled: how often, every how many, on which weekdays, day or week
 * of the month and month, and (unless `showEnd` is false) how it ends. The browser's own controls,
 * named by the caller's labels; the weekdays start on the locale's first day.
 */
export function CgRecurrenceFields<TRule extends CgRecurrenceRule = CgRecurrenceRule>({
  value,
  onChange,
  labels,
  locale = 'en-US',
  firstDayOfWeek,
  frequencies = FREQUENCIES,
  showEnd = true,
  dailyWeekDays = false,
  start,
  disabled,
  id,
  className,
}: CgRecurrenceFieldsProps<TRule>) {
  const unitId = useId();
  const first = firstDayOfWeek ? WEEKDAYS.indexOf(firstDayOfWeek) : localeFirstDayOfWeek(locale);
  if (first < 0) throw new Error('Invalid CgRecurrenceFields firstDayOfWeek.');
  const names = useMemo(() => {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
    const month = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' });
    // 6 September 2026 is a Sunday.
    return { weekDay: (day: CgDayOfWeek) => weekday.format(Date.UTC(2026, 8, 6 + WEEKDAYS.indexOf(day))), month: (number: number) => month.format(Date.UTC(2026, number - 1, 1)) };
  }, [locale]);
  const patch = (next: Partial<CgRecurrenceRule>) => onChange({ ...value, ...next });
  const { frequency } = value;
  const offered = frequencies.includes(frequency) ? frequencies : [frequency, ...frequencies];
  const onWeek = (frequency === 'monthly' || frequency === 'yearly') && !!value.weekOfMonth && value.weekOfMonth !== 'none';
  const weekDays = frequency === 'weekly' || (frequency === 'daily' && dailyWeekDays) || onWeek;
  const unit = frequency !== 'none' ? labels.intervalUnit?.(frequency, value.interval ?? 1) : undefined;
  const weekDayName = labels.weekDay ?? names.weekDay;
  const monthName = labels.monthName ?? names.month;
  return (
    <fieldset id={id} className={cx(styles.root, className)} disabled={disabled} data-cg-recurrence-fields="">
      <legend>{labels.legend}</legend>
      <label className={styles.field}>
        {labels.frequency}
        <select value={frequency} onChange={(event) => patch({ frequency: event.target.value as CgRecurrenceFrequency })}>
          {offered.map((option) => <option key={option} value={option}>{labels.frequencies[option] ?? option}</option>)}
        </select>
      </label>
      {frequency !== 'none' && <>
        <div className={styles.interval}>
          <label className={styles.field}>
            {labels.interval}
            <input type="number" min={1} step={1} value={value.interval ?? 1} aria-describedby={unit ? unitId : undefined} onChange={(event) => patch({ interval: Number(event.target.value) })} />
          </label>
          {unit && <span id={unitId} className={styles.unit}>{unit}</span>}
        </div>
        {frequency === 'yearly' && <label className={styles.field}>
          {labels.month}
          <select value={value.month ?? (start ? Number(start.slice(5, 7)) : 1)} onChange={(event) => patch({ month: Number(event.target.value) })}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{monthName(index + 1)}</option>)}
          </select>
        </label>}
        {(frequency === 'monthly' || frequency === 'yearly') && <>
          <label className={styles.field}>
            {labels.weekOfMonth}
            <select value={value.weekOfMonth ?? 'none'} onChange={(event) => patch({ weekOfMonth: event.target.value as CgRecurrenceWeekOfMonth })}>
              {WEEKS.map((week) => <option key={week} value={week}>{labels.weeksOfMonth[week]}</option>)}
            </select>
          </label>
          {!onWeek && <label className={styles.field}>
            {labels.dayOfMonth}
            <input type="number" min={1} max={31} step={1} value={value.dayOfMonth ?? (start ? Number(start.slice(8, 10)) : '')} onChange={(event) => patch({ dayOfMonth: Number(event.target.value) })} />
          </label>}
        </>}
        {weekDays && <fieldset className={styles.weekDays}>
          <legend>{labels.weekDays}</legend>
          {Array.from({ length: 7 }, (_, index) => WEEKDAYS[(first + index) % 7]!).map((day) => <label key={day} className={styles.check}>
            <input type="checkbox" checked={value.weekDays?.includes(day) ?? false} onChange={(event) => patch({ weekDays: event.target.checked ? [...(value.weekDays ?? []), day] : value.weekDays?.filter((other) => other !== day) })} />
            {weekDayName(day)}
          </label>)}
        </fieldset>}
        {showEnd && <>
          <label className={styles.field}>
            {labels.range}
            <select value={value.range ?? 'noEndDate'} onChange={(event) => patch({ range: event.target.value as CgRecurrenceRange })}>
              {RANGES.map((range) => <option key={range} value={range}>{labels.ranges[range]}</option>)}
            </select>
          </label>
          {value.range === 'occurrenceCount' && <label className={styles.field}>
            {labels.occurrenceCount}
            <input type="number" min={1} step={1} value={value.occurrenceCount ?? 10} onChange={(event) => patch({ occurrenceCount: Number(event.target.value) })} />
          </label>}
          {value.range === 'endByDate' && <label className={styles.field}>
            {labels.endDate}
            <input type="date" value={value.endDate ?? ''} onChange={(event) => patch({ endDate: event.target.value })} />
          </label>}
        </>}
      </>}
    </fieldset>
  );
}
