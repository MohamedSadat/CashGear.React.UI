import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';
import { useCgId, useControllableState, useDirection } from '../../hooks';
import type { CgDateRangeValue, CgDateValue } from '../../types/date';
import { CgIcon } from '../Icon';
import {
  addDays,
  addMonths,
  addYears,
  clampCivilDate,
  compareCivilDates,
  createMonthCells,
  daysFromWeekStart,
  decadeGridStart,
  inclusiveDayCount,
  parseCanonicalDate,
  sameCivilDate,
  startOfMonth,
  todayCivilDate,
  toCanonicalDate,
} from '../../internal/date/dateMath';
import type { CivilDate } from '../../internal/date/dateMath';
import {
  dayOfWeekIndex,
  formatLongDate,
  formatMonthHeading,
  getMonthNames,
  getWeekdayNames,
  localeFirstDayOfWeek,
} from '../../internal/date/dateFormat';
import { cx } from '../../utils';
import styles from './CgCalendar.module.css';
import type {
  CgCalendarChangeReason,
  CgCalendarDayRenderContext,
  CgCalendarLabels,
  CgCalendarProps,
  CgCalendarRangeProps,
  CgCalendarSingleProps,
  CgCalendarView,
} from './CgCalendar.types';

const ENGLISH_LABELS: CgCalendarLabels = {
  calendar: 'Calendar', previousPeriod: 'Previous period', nextPeriod: 'Next period',
  chooseMonthAndYear: 'Choose month and year', chooseYear: 'Choose year', today: 'Today', clear: 'Clear',
  selected: 'Selected', rangeStart: 'Range start', rangeEnd: 'Range end', inRange: 'In selected range',
  previewRange: 'Preview range', unavailable: 'Unavailable', showing: 'Showing',
};
const ARABIC_LABELS: CgCalendarLabels = {
  calendar: 'التقويم', previousPeriod: 'الفترة السابقة', nextPeriod: 'الفترة التالية',
  chooseMonthAndYear: 'اختيار الشهر والسنة', chooseYear: 'اختيار السنة', today: 'اليوم', clear: 'مسح',
  selected: 'محدد', rangeStart: 'بداية النطاق', rangeEnd: 'نهاية النطاق', inRange: 'ضمن النطاق المحدد',
  previewRange: 'معاينة النطاق', unavailable: 'غير متاح', showing: 'عرض',
};

type CalendarValue = CgDateValue | CgDateRangeValue;

function parseProp(name: string, value: CgDateValue | undefined): CivilDate | null {
  if (value === undefined) return null;
  const parsed = parseCanonicalDate(value);
  if (!parsed) throw new Error(`CgCalendar ${name} must be a canonical YYYY-MM-DD date.`);
  return parsed;
}

function unavailable(date: CivilDate, minimum: CivilDate | null, maximum: CivilDate | null, predicate: (date: CgDateValue) => boolean): boolean {
  return Boolean((minimum && compareCivilDates(date, minimum) < 0)
    || (maximum && compareCivilDates(date, maximum) > 0)
    || predicate(toCanonicalDate(date)));
}

function findAvailable(start: CivilDate, direction: number, minimum: CivilDate | null, maximum: CivilDate | null, predicate: (date: CgDateValue) => boolean): CivilDate {
  let candidate = clampCivilDate(start, minimum, maximum);
  for (let index = 0; index < 3660; index += 1) {
    if (!unavailable(candidate, minimum, maximum, predicate)) return candidate;
    const next = addDays(candidate, direction < 0 ? -1 : 1);
    if (sameCivilDate(next, candidate)) break;
    candidate = clampCivilDate(next, minimum, maximum);
  }
  return candidate;
}

function rangeDates(value: CgDateRangeValue): { start: CivilDate | null; end: CivilDate | null } {
  return {
    start: value?.start ? parseCanonicalDate(value.start) : null,
    end: value?.end ? parseCanonicalDate(value.end) : null,
  };
}

function selectedDate(value: CalendarValue, range: boolean): CivilDate | null {
  if (range) return rangeDates(value as CgDateRangeValue).start;
  return typeof value === 'string' ? parseCanonicalDate(value) : null;
}

export const CgCalendar = forwardRef<HTMLDivElement, CgCalendarProps>(function CgCalendar(props, forwardedRef) {
  const {
    selectionMode = 'single', value: _value, defaultValue: _defaultValue, onValueChange: _onValueChange,
    visibleDate, defaultVisibleDate, onVisibleDateChange, calendarCount = 1,
    locale, firstDayOfWeek, today: todayValue, minDate, maxDate, isDateDisabled = () => false,
    renderDay, labels, direction = 'auto', density = 'compact', disabled = false, readOnly = false,
    showTodayButton = true, showClearButton = false, allowClear = true, minimumRangeDays,
    maximumRangeDays, allowSingleDayRange = true, autoFocus = false, onEscape, id, className, style, onKeyDown,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...nativeProps
  } = props;
  if (calendarCount !== 1 && calendarCount !== 2) throw new RangeError('CgCalendar calendarCount must be 1 or 2.');
  if (minimumRangeDays !== undefined && minimumRangeDays < 1) throw new RangeError('CgCalendar minimumRangeDays must be positive.');
  if (maximumRangeDays !== undefined && maximumRangeDays < 1) throw new RangeError('CgCalendar maximumRangeDays must be positive.');
  if (minimumRangeDays !== undefined && maximumRangeDays !== undefined && minimumRangeDays > maximumRangeDays) {
    throw new RangeError('CgCalendar minimumRangeDays must not exceed maximumRangeDays.');
  }
  const minimum = parseProp('minDate', minDate);
  const maximum = parseProp('maxDate', maxDate);
  if (minimum && maximum && compareCivilDates(minimum, maximum) > 0) throw new RangeError('CgCalendar minDate must not be later than maxDate.');
  const today = todayValue === undefined ? todayCivilDate() : parseProp('today', todayValue)!;
  const initialValue: CalendarValue = _defaultValue ?? null;
  const [actualValue, setActualValue] = useControllableState<CalendarValue>(_value, initialValue, 'CgCalendar');
  const initialAnchor = selectedDate(actualValue, selectionMode === 'range') ?? today;
  const requestedVisible = parseProp('visibleDate', visibleDate);
  const requestedDefaultVisible = parseProp('defaultVisibleDate', defaultVisibleDate);
  const [actualVisible, setActualVisible] = useControllableState<CgDateValue>(
    requestedVisible ? toCanonicalDate(startOfMonth(requestedVisible)) : undefined,
    toCanonicalDate(startOfMonth(requestedDefaultVisible ?? initialAnchor)),
    'CgCalendar visibleDate',
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const focusRequestedRef = useRef(autoFocus);
  const calendarId = useCgId(id);
  const resolvedDirection = useDirection(rootRef, direction);
  const resolvedLocale = useMemo(() => new Intl.DateTimeFormat(locale, { calendar: 'gregory' }).resolvedOptions().locale, [locale]);
  const localeArabic = new Intl.Locale(resolvedLocale).language === 'ar';
  const text = { ...(localeArabic ? ARABIC_LABELS : ENGLISH_LABELS), ...labels };
  const firstDay = firstDayOfWeek === undefined ? localeFirstDayOfWeek(resolvedLocale) : dayOfWeekIndex(firstDayOfWeek);
  const [view, setView] = useState<CgCalendarView>('day');
  const [focusedDate, setFocusedDate] = useState(() => findAvailable(initialAnchor, 1, minimum, maximum, isDateDisabled));
  const [pendingRangeStart, setPendingRangeStart] = useState<CivilDate | null>(null);
  const [hoveredDate, setHoveredDate] = useState<CivilDate | null>(null);
  const baseMonth = parseCanonicalDate(actualVisible) ?? startOfMonth(today);
  const months = useMemo(() => Array.from({ length: calendarCount }, (_, index) => addMonths(baseMonth, index)), [baseMonth, calendarCount]);
  const weekdays = useMemo(() => getWeekdayNames(resolvedLocale, firstDay), [firstDay, resolvedLocale]);
  const monthNames = useMemo(() => getMonthNames(resolvedLocale), [resolvedLocale]);
  const rangeValue = selectionMode === 'range' ? rangeDates(actualValue as CgDateRangeValue) : { start: null, end: null };
  const singleValue = selectionMode === 'single' && typeof actualValue === 'string' ? parseCanonicalDate(actualValue) : null;
  const visualStart = pendingRangeStart && (hoveredDate ?? focusedDate)
    ? compareCivilDates(pendingRangeStart, hoveredDate ?? focusedDate) <= 0 ? pendingRangeStart : hoveredDate ?? focusedDate
    : rangeValue.start;
  const visualEnd = pendingRangeStart && (hoveredDate ?? focusedDate)
    ? compareCivilDates(pendingRangeStart, hoveredDate ?? focusedDate) <= 0 ? hoveredDate ?? focusedDate : pendingRangeStart
    : rangeValue.end;
  const preview = pendingRangeStart !== null;

  const changeVisible = (next: CivilDate) => {
    const canonical = toCanonicalDate(startOfMonth(next));
    const previousValue = actualVisible;
    setActualVisible(canonical);
    if (canonical !== previousValue) onVisibleDateChange?.(canonical, { previousValue, value: canonical, view });
  };

  const emit = (next: CalendarValue, reason: CgCalendarChangeReason, event?: Event | SyntheticEvent) => {
    const previousValue = actualValue;
    setActualValue(next);
    if (selectionMode === 'range') {
      const callback = _onValueChange as CgCalendarRangeProps['onValueChange'];
      callback?.(next as CgDateRangeValue, { value: next as CgDateRangeValue, previousValue: previousValue as CgDateRangeValue, reason, event });
    } else {
      const single = next as CgDateValue | null;
      const callback = _onValueChange as CgCalendarSingleProps['onValueChange'];
      callback?.(single, { value: single, previousValue: previousValue as CgDateValue | null, reason, event });
    }
  };

  const rangeValid = (start: CivilDate, end: CivilDate): boolean => {
    const days = inclusiveDayCount(start, end);
    const minimumDays = Math.max(allowSingleDayRange ? 1 : 2, minimumRangeDays ?? 1);
    return days >= minimumDays && (maximumRangeDays === undefined || days <= maximumRangeDays);
  };

  const choose = (date: CivilDate, reason: CgCalendarChangeReason, event?: Event | SyntheticEvent) => {
    if (disabled || readOnly || unavailable(date, minimum, maximum, isDateDisabled)) return;
    if (selectionMode === 'single') {
      emit(toCanonicalDate(date), reason, event);
      return;
    }
    if (!pendingRangeStart) {
      setPendingRangeStart(date);
      setHoveredDate(date);
      return;
    }
    const start = compareCivilDates(pendingRangeStart, date) <= 0 ? pendingRangeStart : date;
    const end = compareCivilDates(pendingRangeStart, date) <= 0 ? date : pendingRangeStart;
    if (!rangeValid(start, end)) return;
    setPendingRangeStart(null);
    setHoveredDate(null);
    emit({ start: toCanonicalDate(start), end: toCanonicalDate(end) }, reason, event);
  };

  const moveFocus = (target: CivilDate, movement: number) => {
    const next = findAvailable(target, movement, minimum, maximum, isDateDisabled);
    focusRequestedRef.current = true;
    setFocusedDate(next);
    const targetMonth = startOfMonth(next);
    const lastMonth = addMonths(baseMonth, calendarCount - 1);
    if (compareCivilDates(targetMonth, baseMonth) < 0) changeVisible(targetMonth);
    else if (compareCivilDates(targetMonth, lastMonth) > 0) changeVisible(addMonths(targetMonth, -(calendarCount - 1)));
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (pendingRangeStart) { setPendingRangeStart(null); setHoveredDate(null); }
      else onEscape?.(event);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (view === 'day') choose(focusedDate, 'selection', event);
      else if (view === 'month') { focusRequestedRef.current = true; changeVisible(focusedDate); setView('day'); }
      else { focusRequestedRef.current = true; changeVisible(focusedDate); setView('month'); }
      return;
    }
    const horizontal = resolvedDirection === 'rtl' ? -1 : 1;
    let target = focusedDate;
    if (view === 'day') {
      switch (event.key) {
        case 'ArrowLeft': target = addDays(target, -horizontal); break;
        case 'ArrowRight': target = addDays(target, horizontal); break;
        case 'ArrowUp': target = addDays(target, -7); break;
        case 'ArrowDown': target = addDays(target, 7); break;
        case 'Home': target = addDays(target, -daysFromWeekStart(target, firstDay)); break;
        case 'End': target = addDays(target, 6 - daysFromWeekStart(target, firstDay)); break;
        case 'PageUp': target = event.shiftKey ? addYears(target, -1) : addMonths(target, -1); break;
        case 'PageDown': target = event.shiftKey ? addYears(target, 1) : addMonths(target, 1); break;
        default: onKeyDown?.(event); return;
      }
      moveFocus(target, compareCivilDates(target, focusedDate) < 0 ? -1 : 1);
    } else if (view === 'month') {
      switch (event.key) {
        case 'ArrowLeft': target = addMonths(target, -horizontal); break;
        case 'ArrowRight': target = addMonths(target, horizontal); break;
        case 'ArrowUp': target = addMonths(target, -3); break;
        case 'ArrowDown': target = addMonths(target, 3); break;
        case 'Home': target = { year: target.year, month: 1, day: 1 }; break;
        case 'End': target = { year: target.year, month: 12, day: 1 }; break;
        case 'PageUp': target = addYears(target, -1); break;
        case 'PageDown': target = addYears(target, 1); break;
        default: onKeyDown?.(event); return;
      }
      focusRequestedRef.current = true; setFocusedDate(clampCivilDate(target, minimum, maximum));
      changeVisible({ year: target.year, month: baseMonth.month, day: 1 });
    } else {
      const decade = decadeGridStart(baseMonth.year);
      switch (event.key) {
        case 'ArrowLeft': target = addYears(target, -horizontal); break;
        case 'ArrowRight': target = addYears(target, horizontal); break;
        case 'ArrowUp': target = addYears(target, -3); break;
        case 'ArrowDown': target = addYears(target, 3); break;
        case 'Home': target = { year: decade, month: 1, day: 1 }; break;
        case 'End': target = { year: Math.min(9999, decade + 11), month: 1, day: 1 }; break;
        case 'PageUp': target = addYears(target, -10); break;
        case 'PageDown': target = addYears(target, 10); break;
        default: onKeyDown?.(event); return;
      }
      focusRequestedRef.current = true; setFocusedDate(clampCivilDate(target, minimum, maximum));
      changeVisible({ year: target.year, month: baseMonth.month, day: 1 });
    }
    event.preventDefault();
    onKeyDown?.(event);
  };

  useLayoutEffect(() => {
    if (!focusRequestedRef.current) return;
    focusRequestedRef.current = false;
    const selector = view === 'day' ? toCanonicalDate(focusedDate) : view === 'month' ? `month-${focusedDate.month}` : `year-${focusedDate.year}`;
    rootRef.current?.querySelector<HTMLElement>(`[data-focus-value="${selector}"]`)?.focus({ preventScroll: true });
  }, [actualVisible, focusedDate, view]);

  const heading = view === 'day'
    ? calendarCount === 1 ? formatMonthHeading(baseMonth, resolvedLocale) : `${formatMonthHeading(baseMonth, resolvedLocale)} – ${formatMonthHeading(addMonths(baseMonth, 1), resolvedLocale)}`
    : view === 'month' ? String(baseMonth.year) : `${decadeGridStart(baseMonth.year)}–${Math.min(9999, decadeGridStart(baseMonth.year) + 11)}`;
  const canClear = allowClear && actualValue !== null && !disabled && !readOnly;

  return (
    <div
      {...nativeProps}
      ref={(node) => { rootRef.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      id={calendarId}
      className={cx(styles.root, className)}
      style={style}
      dir={resolvedDirection}
      data-density={density}
      data-selection-mode={selectionMode}
      data-calendar-count={calendarCount}
      role="group"
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : text.calendar)}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      onKeyDown={handleKeys}
      onPointerLeave={() => setHoveredDate(null)}
    >
      <div className={styles.header}>
        <button type="button" className={styles.nav} aria-label={text.previousPeriod} disabled={disabled} onClick={() => {
          const next = view === 'day' ? addMonths(baseMonth, -calendarCount) : addYears(baseMonth, view === 'month' ? -1 : -10);
          focusRequestedRef.current = true; changeVisible(next); setFocusedDate(next);
        }}><CgIcon name="chevron-start" /></button>
        <button type="button" className={styles.heading} aria-label={view === 'day' ? text.chooseMonthAndYear : text.chooseYear} disabled={disabled} onClick={() => { focusRequestedRef.current = true; setView(view === 'day' ? 'month' : 'year'); }}>
          {view === 'day' && calendarCount === 2 ? <><span className={styles.rangeHeading}>{heading}</span><span className={styles.singleHeading}>{formatMonthHeading(baseMonth, resolvedLocale)}</span></> : heading}
        </button>
        <button type="button" className={styles.nav} aria-label={text.nextPeriod} disabled={disabled} onClick={() => {
          const next = view === 'day' ? addMonths(baseMonth, calendarCount) : addYears(baseMonth, view === 'month' ? 1 : 10);
          focusRequestedRef.current = true; changeVisible(next); setFocusedDate(next);
        }}><CgIcon name="chevron-end" /></button>
      </div>
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{text.showing} {heading}</div>

      {view === 'day' ? <div className={styles.months}>
        {months.map((month, panelIndex) => {
          const cells = createMonthCells(month, firstDay);
          const panelHeading = `${calendarId}-month-${panelIndex}`;
          return <section key={toCanonicalDate(month)} className={styles.month} data-calendar-panel={panelIndex}>
            <h3 id={panelHeading} className={cx(styles.monthHeading, calendarCount === 1 && styles.srOnly)}>{formatMonthHeading(month, resolvedLocale)}</h3>
            <div className={styles.grid} role="grid" aria-labelledby={panelHeading} aria-multiselectable={selectionMode === 'range' || undefined}>
              <div className={styles.week} role="row">{weekdays.map((weekday) => <div key={weekday.long} className={styles.weekday} role="columnheader" aria-label={weekday.long}>{weekday.short}</div>)}</div>
              {Array.from({ length: 6 }, (_, row) => <div key={row} className={styles.week} role="row">
                {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                  const canonical = toCanonicalDate(cell.date);
                  const blocked = unavailable(cell.date, minimum, maximum, isDateDisabled);
                  const isFocused = sameCivilDate(cell.date, focusedDate);
                  const isToday = sameCivilDate(cell.date, today);
                  const inRange = Boolean(visualStart && visualEnd && compareCivilDates(cell.date, visualStart) >= 0 && compareCivilDates(cell.date, visualEnd) <= 0);
                  const isStart = sameCivilDate(cell.date, visualStart);
                  const isEnd = sameCivilDate(cell.date, visualEnd);
                  const isSelected = selectionMode === 'single' ? sameCivilDate(cell.date, singleValue) : inRange && !preview;
                  const context: CgCalendarDayRenderContext = { date: canonical, isCurrentMonth: cell.isCurrentMonth, isToday, isSelected, isFocused, isDisabled: blocked, isRangeStart: isStart, isRangeEnd: isEnd, isInRange: inRange, isRangePreview: inRange && preview };
                  const states = [isToday ? text.today : '', isSelected ? text.selected : '', isStart ? text.rangeStart : '', isEnd ? text.rangeEnd : '', inRange && !isStart && !isEnd ? preview ? text.previewRange : text.inRange : '', blocked ? text.unavailable : ''].filter(Boolean);
                  const hideDuplicate = calendarCount === 2 && !cell.isCurrentMonth;
                  return <div key={canonical} className={styles.cell} role="gridcell" aria-selected={isSelected} aria-disabled={blocked || undefined}>
                    {hideDuplicate ? <span className={styles.empty} /> : <button
                      type="button"
                      className={styles.day}
                      disabled={disabled || blocked}
                      tabIndex={isFocused ? 0 : -1}
                      data-focus-value={canonical}
                      data-date={canonical}
                      data-outside={!cell.isCurrentMonth || undefined}
                      data-today={isToday || undefined}
                      data-selected={selectionMode === 'single' && isSelected || undefined}
                      data-range-start={isStart || undefined}
                      data-range-end={isEnd || undefined}
                      data-in-range={inRange || undefined}
                      data-preview={inRange && preview || undefined}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${formatLongDate(cell.date, resolvedLocale)}${states.length ? `, ${states.join(', ')}` : ''}`}
                      onFocus={() => setFocusedDate(cell.date)}
                      onPointerEnter={() => { if (pendingRangeStart && !blocked) setHoveredDate(cell.date); }}
                      onClick={(event: MouseEvent<HTMLButtonElement>) => choose(cell.date, 'selection', event)}
                    >{renderDay ? renderDay(context) : cell.date.day}</button>}
                  </div>;
                })}
              </div>)}
            </div>
          </section>;
        })}
      </div> : view === 'month' ? <div className={styles.periodGrid} role="grid" aria-label={heading}>
        {monthNames.map((name, index) => {
          const month = index + 1;
          const date = { year: baseMonth.year, month, day: 1 };
          const focused = focusedDate.year === date.year && focusedDate.month === month;
          const selected = singleValue?.year === date.year && singleValue.month === month
            || rangeValue.start?.year === date.year && rangeValue.start.month === month;
          return <div key={name} role="gridcell" aria-selected={selected}><button type="button" className={styles.period} tabIndex={focused ? 0 : -1} data-period="month" data-selected={selected || undefined} data-focus-value={`month-${month}`} onFocus={() => setFocusedDate(date)} onClick={() => { focusRequestedRef.current = true; changeVisible(date); setFocusedDate(date); setView('day'); }}>{name}</button></div>;
        })}
      </div> : <div className={styles.periodGrid} role="grid" aria-label={heading}>
        {Array.from({ length: 12 }, (_, index) => decadeGridStart(baseMonth.year) + index).filter((year) => year <= 9999).map((year) => {
          const date = { year, month: baseMonth.month, day: 1 };
          const focused = focusedDate.year === year;
          const selected = singleValue?.year === year || rangeValue.start?.year === year;
          return <div key={year} role="gridcell" aria-selected={selected}><button type="button" className={styles.period} tabIndex={focused ? 0 : -1} data-period="year" data-selected={selected || undefined} data-focus-value={`year-${year}`} data-outside={year === decadeGridStart(baseMonth.year) || year === decadeGridStart(baseMonth.year) + 11 || undefined} onFocus={() => setFocusedDate(date)} onClick={() => { focusRequestedRef.current = true; changeVisible(date); setFocusedDate(date); setView('month'); }}>{year}</button></div>;
        })}
      </div>}

      {showTodayButton || showClearButton ? <div className={styles.footer}>
        {showTodayButton ? <button type="button" disabled={disabled || readOnly || unavailable(today, minimum, maximum, isDateDisabled)} onClick={(event) => { moveFocus(today, 1); choose(today, 'today', event); }}>{text.today}</button> : null}
        {showClearButton ? <button type="button" disabled={!canClear} onClick={(event) => { setPendingRangeStart(null); setHoveredDate(null); emit(null, 'clear', event); }}>{text.clear}</button> : null}
      </div> : null}
    </div>
  );
});
