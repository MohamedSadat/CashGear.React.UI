import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { CgIcon } from '../Icon';
import type { CgDirection } from '../../types';
import type { CgDateEditDayRenderContext, CgDateEditLabels } from './CgDateEdit.types';
import {
  addDays,
  addMonths,
  addYears,
  clampCivilDate,
  compareCivilDates,
  createMonthCells,
  daysFromWeekStart,
  decadeGridStart,
  sameCivilDate,
  startOfMonth,
  toCanonicalDate,
} from './dateMath';
import type { CivilDate } from './dateMath';
import { formatLongDate, formatMonthHeading, getMonthNames, getWeekdayNames } from './dateFormat';
import styles from './CgDateEdit.module.css';

type CalendarView = 'day' | 'month' | 'year';

interface DateCalendarProps {
  id: string;
  headingId: string;
  selected: CivilDate | null;
  anchor: CivilDate;
  today: CivilDate;
  minimum: CivilDate | null;
  maximum: CivilDate | null;
  firstDayOfWeek: number;
  locale?: string;
  direction: Exclude<CgDirection, 'auto'>;
  labels: CgDateEditLabels;
  renderDay?: (context: CgDateEditDayRenderContext) => React.ReactNode;
  isDateDisabled: (date: CivilDate) => boolean;
  showTodayButton: boolean;
  showClearButton: boolean;
  canClear: boolean;
  pending: boolean;
  onSelect: (date: CivilDate, event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLElement>) => void;
  onToday: (event: MouseEvent<HTMLButtonElement>) => void;
  onClear: (event: MouseEvent<HTMLButtonElement>) => void;
  onEscape: (event: KeyboardEvent<HTMLElement>) => void;
}

function periodContainsDate(month: CivilDate, date: CivilDate): boolean {
  return month.year === date.year && month.month === date.month;
}

function isUnavailableDate(
  date: CivilDate,
  minimum: CivilDate | null,
  maximum: CivilDate | null,
  isDateDisabled: (date: CivilDate) => boolean,
): boolean {
  return (minimum !== null && compareCivilDates(date, minimum) < 0)
    || (maximum !== null && compareCivilDates(date, maximum) > 0)
    || isDateDisabled(date);
}

function findAvailableDate(
  start: CivilDate,
  direction: number,
  minimum: CivilDate | null,
  maximum: CivilDate | null,
  isDateDisabled: (date: CivilDate) => boolean,
): CivilDate {
  let candidate = clampCivilDate(start, minimum, maximum);
  for (let count = 0; count < 3660; count += 1) {
    if (!isUnavailableDate(candidate, minimum, maximum, isDateDisabled)) return candidate;
    const next = addDays(candidate, direction < 0 ? -1 : 1);
    if (sameCivilDate(next, candidate)) return candidate;
    candidate = clampCivilDate(next, minimum, maximum);
  }
  return clampCivilDate(start, minimum, maximum);
}

function clampPanelFocus(
  target: CivilDate,
  view: Exclude<CalendarView, 'day'>,
  minimum: CivilDate | null,
  maximum: CivilDate | null,
): CivilDate {
  if (view === 'year') {
    const year = Math.min(maximum?.year ?? 9999, Math.max(minimum?.year ?? 1, target.year));
    return { year, month: target.month, day: 1 };
  }
  const month = startOfMonth(target);
  if (minimum && compareCivilDates(month, startOfMonth(minimum)) < 0) return startOfMonth(minimum);
  if (maximum && compareCivilDates(month, startOfMonth(maximum)) > 0) return startOfMonth(maximum);
  return month;
}

export function DateCalendar({
  id,
  headingId,
  selected,
  anchor,
  today,
  minimum,
  maximum,
  firstDayOfWeek,
  locale,
  direction,
  labels,
  renderDay,
  isDateDisabled,
  showTodayButton,
  showClearButton,
  canClear,
  pending,
  onSelect,
  onToday,
  onClear,
  onEscape,
}: DateCalendarProps) {
  const [view, setView] = useState<CalendarView>('day');
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(anchor));
  const [focusedDate, setFocusedDate] = useState(() => findAvailableDate(anchor, 1, minimum, maximum, isDateDisabled));
  const rootRef = useRef<HTMLDivElement>(null);
  const isUnavailable = (date: CivilDate) => isUnavailableDate(date, minimum, maximum, isDateDisabled);

  useLayoutEffect(() => {
    const focusTarget = view === 'day' && isUnavailableDate(focusedDate, minimum, maximum, isDateDisabled)
      ? findAvailableDate(focusedDate, 1, minimum, maximum, isDateDisabled)
      : focusedDate;
    const target = rootRef.current?.querySelector<HTMLElement>(`[data-focus-value="${view === 'day' ? toCanonicalDate(focusTarget) : view === 'month' ? `month-${focusTarget.month}` : `year-${focusTarget.year}`}"]`);
    target?.focus({ preventScroll: true });
  }, [focusedDate, isDateDisabled, maximum, minimum, view, visibleMonth]);

  const monthCells = useMemo(
    () => createMonthCells(visibleMonth, firstDayOfWeek),
    [firstDayOfWeek, visibleMonth],
  );
  const weekdays = useMemo(() => getWeekdayNames(locale, firstDayOfWeek), [firstDayOfWeek, locale]);
  const monthNames = useMemo(() => getMonthNames(locale), [locale]);
  const decadeStart = decadeGridStart(visibleMonth.year);

  const moveDayFocus = (target: CivilDate, directionValue: number) => {
    const available = findAvailableDate(target, directionValue, minimum, maximum, isDateDisabled);
    setFocusedDate(available);
    if (!periodContainsDate(visibleMonth, available)) setVisibleMonth(startOfMonth(available));
  };

  const handleDayKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape(event);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isUnavailable(focusedDate)) onSelect(focusedDate, event);
      return;
    }
    const horizontal = direction === 'rtl' ? -1 : 1;
    let target = focusedDate;
    switch (event.key) {
      case 'ArrowLeft': target = addDays(target, -horizontal); break;
      case 'ArrowRight': target = addDays(target, horizontal); break;
      case 'ArrowUp': target = addDays(target, -7); break;
      case 'ArrowDown': target = addDays(target, 7); break;
      case 'Home': target = addDays(target, -daysFromWeekStart(target, firstDayOfWeek)); break;
      case 'End': target = addDays(target, 6 - daysFromWeekStart(target, firstDayOfWeek)); break;
      case 'PageUp': target = event.shiftKey ? addYears(target, -1) : addMonths(target, -1); break;
      case 'PageDown': target = event.shiftKey ? addYears(target, 1) : addMonths(target, 1); break;
      default: return;
    }
    event.preventDefault();
    moveDayFocus(target, compareCivilDates(target, focusedDate) < 0 ? -1 : 1);
  };

  const handlePanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape(event);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (view === 'month') {
        setVisibleMonth({ year: focusedDate.year, month: focusedDate.month, day: 1 });
        setView('day');
      } else {
        setVisibleMonth({ year: focusedDate.year, month: visibleMonth.month, day: 1 });
        setView('month');
      }
      return;
    }
    const horizontal = direction === 'rtl' ? -1 : 1;
    let target = focusedDate;
    if (view === 'month') {
      switch (event.key) {
        case 'ArrowLeft': target = addMonths(target, -horizontal); break;
        case 'ArrowRight': target = addMonths(target, horizontal); break;
        case 'ArrowUp': target = addMonths(target, -3); break;
        case 'ArrowDown': target = addMonths(target, 3); break;
        case 'Home': target = { year: target.year, month: 1, day: 1 }; break;
        case 'End': target = { year: target.year, month: 12, day: 1 }; break;
        case 'PageUp': target = addYears(target, -1); break;
        case 'PageDown': target = addYears(target, 1); break;
        default: return;
      }
      target = clampPanelFocus(target, 'month', minimum, maximum);
      setVisibleMonth({ year: target.year, month: visibleMonth.month, day: 1 });
    } else {
      switch (event.key) {
        case 'ArrowLeft': target = addYears(target, -horizontal); break;
        case 'ArrowRight': target = addYears(target, horizontal); break;
        case 'ArrowUp': target = addYears(target, -3); break;
        case 'ArrowDown': target = addYears(target, 3); break;
        case 'Home': target = { year: decadeStart, month: 1, day: 1 }; break;
        case 'End': target = { year: Math.min(9999, decadeStart + 11), month: 1, day: 1 }; break;
        case 'PageUp': target = addYears(target, -10); break;
        case 'PageDown': target = addYears(target, 10); break;
        default: return;
      }
      target = clampPanelFocus(target, 'year', minimum, maximum);
      setVisibleMonth({ year: target.year, month: visibleMonth.month, day: 1 });
    }
    event.preventDefault();
    setFocusedDate(target);
  };

  const navigatePeriod = (amount: number) => {
    if (view === 'day') {
      const available = findAvailableDate(addMonths(focusedDate, amount), amount, minimum, maximum, isDateDisabled);
      setVisibleMonth(startOfMonth(available));
      setFocusedDate(available);
    } else if (view === 'month') {
      const next = clampPanelFocus(addYears(visibleMonth, amount), 'month', minimum, maximum);
      setVisibleMonth(startOfMonth(next));
      setFocusedDate(clampPanelFocus(addYears(focusedDate, amount), 'month', minimum, maximum));
    } else {
      const next = clampPanelFocus(addYears(visibleMonth, amount * 10), 'year', minimum, maximum);
      setVisibleMonth(startOfMonth(next));
      setFocusedDate(clampPanelFocus(addYears(focusedDate, amount * 10), 'year', minimum, maximum));
    }
  };

  const heading = view === 'day'
    ? formatMonthHeading(visibleMonth, locale)
    : view === 'month'
      ? String(visibleMonth.year)
      : `${decadeStart}–${Math.min(9999, decadeStart + 11)}`;

  return (
    <div ref={rootRef} id={id} className={styles.calendar} aria-busy={pending || undefined}>
      <div className={styles.calendarHeader}>
        <button type="button" className={styles.navigationButton} aria-label={labels.previousPeriod} onClick={() => navigatePeriod(-1)}>
          <CgIcon name="chevron-start" />
        </button>
        <button
          type="button"
          id={headingId}
          className={styles.headingButton}
          aria-label={view === 'day' ? labels.chooseMonthAndYear : labels.chooseYear}
          onClick={() => setView((current) => current === 'day' ? 'month' : 'year')}
        >
          {heading}
        </button>
        <button type="button" className={styles.navigationButton} aria-label={labels.nextPeriod} onClick={() => navigatePeriod(1)}>
          <CgIcon name="chevron-end" />
        </button>
      </div>

      {view === 'day' ? (
        <div className={styles.dayGrid} role="grid" aria-labelledby={headingId} onKeyDown={handleDayKey}>
          <div className={styles.weekRow} role="row">
            {weekdays.map((weekday) => (
              <div key={weekday.long} className={styles.weekday} role="columnheader" aria-label={weekday.long}>{weekday.short}</div>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, rowIndex) => (
            <div key={rowIndex} className={styles.weekRow} role="row">
              {monthCells.slice(rowIndex * 7, rowIndex * 7 + 7).map((cell) => {
                const canonical = toCanonicalDate(cell.date);
                const disabled = isUnavailable(cell.date);
                const selectedValue = sameCivilDate(cell.date, selected);
                const focused = sameCivilDate(cell.date, focusedDate);
                const todayValue = sameCivilDate(cell.date, today);
                const context: CgDateEditDayRenderContext = {
                  date: canonical,
                  isCurrentMonth: cell.isCurrentMonth,
                  isToday: todayValue,
                  isSelected: selectedValue,
                  isFocused: focused,
                  isDisabled: disabled,
                };
                const states = [todayValue ? labels.today : '', selectedValue ? labels.selected : '', disabled ? labels.unavailable : ''].filter(Boolean);
                return (
                  <div
                    key={canonical}
                    className={styles.dayCell}
                    role="gridcell"
                    aria-selected={selectedValue}
                    aria-disabled={disabled || undefined}
                  >
                    <button
                      type="button"
                      className={styles.dayButton}
                      disabled={disabled || pending}
                      tabIndex={focused ? 0 : -1}
                      data-focus-value={canonical}
                      data-date={canonical}
                      data-outside={!cell.isCurrentMonth || undefined}
                      data-selected={selectedValue || undefined}
                      data-today={todayValue || undefined}
                      aria-current={todayValue ? 'date' : undefined}
                      aria-label={`${formatLongDate(cell.date, locale)}${states.length ? `, ${states.join(', ')}` : ''}`}
                      onClick={(event) => onSelect(cell.date, event)}
                      onFocus={() => setFocusedDate(cell.date)}
                    >
                      {renderDay ? renderDay(context) : cell.date.day}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : view === 'month' ? (
        <div className={styles.periodGrid} role="grid" aria-labelledby={headingId} onKeyDown={handlePanelKey}>
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div key={rowIndex} className={styles.periodRow} role="row">
              {monthNames.slice(rowIndex * 3, rowIndex * 3 + 3).map((name, index) => {
                const month = rowIndex * 3 + index + 1;
                const unavailable = (minimum !== null && visibleMonth.year === minimum.year && month < minimum.month)
                  || (maximum !== null && visibleMonth.year === maximum.year && month > maximum.month)
                  || (minimum !== null && visibleMonth.year < minimum.year)
                  || (maximum !== null && visibleMonth.year > maximum.year);
                const selectedMonth = selected?.year === visibleMonth.year && selected.month === month;
                const focused = focusedDate.year === visibleMonth.year && focusedDate.month === month;
                return (
                  <div key={name} role="gridcell" aria-selected={selectedMonth} aria-disabled={unavailable || undefined}>
                    <button
                      type="button"
                      className={styles.periodButton}
                      disabled={unavailable || pending}
                      tabIndex={focused ? 0 : -1}
                      data-focus-value={`month-${month}`}
                      data-selected={selectedMonth || undefined}
                      onFocus={() => setFocusedDate({ year: visibleMonth.year, month, day: 1 })}
                      onClick={() => {
                        setFocusedDate({ year: visibleMonth.year, month, day: 1 });
                        setVisibleMonth({ year: visibleMonth.year, month, day: 1 });
                        setView('day');
                      }}
                    >{name}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.periodGrid} role="grid" aria-labelledby={headingId} onKeyDown={handlePanelKey}>
          {Array.from({ length: 4 }, (_, rowIndex) => (
            <div key={rowIndex} className={styles.periodRow} role="row">
              {Array.from({ length: 3 }, (_, index) => decadeStart + rowIndex * 3 + index).filter((year) => year <= 9999).map((year) => {
                const unavailable = (minimum !== null && year < minimum.year) || (maximum !== null && year > maximum.year);
                const selectedYear = selected?.year === year;
                const focused = focusedDate.year === year;
                return (
                  <div key={year} role="gridcell" aria-selected={selectedYear} aria-disabled={unavailable || undefined}>
                    <button
                      type="button"
                      className={styles.periodButton}
                      disabled={unavailable || pending}
                      tabIndex={focused ? 0 : -1}
                      data-focus-value={`year-${year}`}
                      data-selected={selectedYear || undefined}
                      data-outside={year === decadeStart || year === decadeStart + 11 || undefined}
                      onFocus={() => setFocusedDate({ year, month: visibleMonth.month, day: 1 })}
                      onClick={() => {
                        setFocusedDate({ year, month: visibleMonth.month, day: 1 });
                        setVisibleMonth({ year, month: visibleMonth.month, day: 1 });
                        setView('month');
                      }}
                    >{year}</button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {showTodayButton || showClearButton ? (
        <div className={styles.calendarFooter}>
          {showTodayButton ? <button type="button" disabled={isUnavailable(today) || pending} onClick={onToday}>{labels.today}</button> : null}
          {showClearButton ? <button type="button" disabled={!canClear || pending} onClick={onClear}>{labels.clear}</button> : null}
        </div>
      ) : null}
    </div>
  );
}
