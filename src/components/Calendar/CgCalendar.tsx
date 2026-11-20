import { useUiLabels } from '../UiText/uiLabels';
import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
  weekOfYear,
} from '../../internal/date/dateMath';
import type { CivilDate } from '../../internal/date/dateMath';
import {
  dayOfWeekIndex,
  formatLongDate,
  formatMonthHeading,
  getMonthNames,
  getWeekdayNames,
  localeFirstDayOfWeek,
  localeWeekNumberRule,
} from '../../internal/date/dateFormat';
import { cx } from '../../utils';
import styles from './CgCalendar.module.css';
import type {
  CgCalendarChangeReason,
  CgCalendarDayRenderContext,
  CgCalendarLabels,
  CgCalendarMultipleProps,
  CgCalendarProps,
  CgCalendarRangeProps,
  CgCalendarSingleProps,
  CgCalendarView,
  CgCalendarVisibleRangeChangeDetails,
} from './CgCalendar.types';
import type { CgDayOfWeek } from '../../types/date';

const DAY_NAMES: ReadonlyArray<CgDayOfWeek> = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const VIEW_ORDER: ReadonlyArray<CgCalendarView> = ['day', 'month', 'year'];
const COMPACT_QUERY = '(max-width: 47.999rem)';

function compactMedia(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_QUERY) : null;
}

function subscribeCompact(onChange: () => void): () => void {
  const media = compactMedia();
  media?.addEventListener?.('change', onChange);
  return () => media?.removeEventListener?.('change', onChange);
}

function useCompactViewport(enabled: boolean): boolean {
  const compact = useSyncExternalStore(subscribeCompact, () => compactMedia()?.matches ?? false, () => false);
  return enabled && compact;
}

const ENGLISH_LABELS: CgCalendarLabels = {
  calendar: 'Calendar', previousPeriod: 'Previous period', nextPeriod: 'Next period',
  chooseMonthAndYear: 'Choose month and year', chooseYear: 'Choose year', today: 'Today', clear: 'Clear',
  selected: 'Selected', rangeStart: 'Range start', rangeEnd: 'Range end', inRange: 'In selected range',
  previewRange: 'Preview range', unavailable: 'Unavailable', showing: 'Showing',
  loading: 'Loading calendar availability', weekNumber: 'Week {0}',
};
const ARABIC_LABELS: CgCalendarLabels = {
  calendar: 'التقويم', previousPeriod: 'الفترة السابقة', nextPeriod: 'الفترة التالية',
  chooseMonthAndYear: 'اختيار الشهر والسنة', chooseYear: 'اختيار السنة', today: 'اليوم', clear: 'مسح',
  selected: 'محدد', rangeStart: 'بداية النطاق', rangeEnd: 'نهاية النطاق', inRange: 'ضمن النطاق المحدد',
  previewRange: 'معاينة النطاق', unavailable: 'غير متاح', showing: 'عرض',
  loading: 'جارٍ تحميل توفّر التقويم', weekNumber: 'الأسبوع {0}',
};

type CalendarValue = CgDateValue | CgDateRangeValue | readonly CgDateValue[];

function multipleDates(value: CalendarValue | undefined): readonly CgDateValue[] {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.some(date => typeof date !== 'string' || !parseCanonicalDate(date))) throw new Error('CgCalendar multiple values must be canonical YYYY-MM-DD dates.');
  return Object.freeze([...new Set(value as CgDateValue[])].sort());
}

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
  if (Array.isArray(value)) return value.length ? parseCanonicalDate(value[0] as string) : null;
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
    maximumRangeDays, allowSingleDayRange = true, autoFocus = false, onEscape, selectionView = 'day',
    showWeekNumbers = false, weekNumberRule, loading = false, renderLoading, onVisibleRangeChange,
    renderHeader, renderFooter, renderMonth, renderYear, renderWeekday, autoCollapseMonths = true,
    showOutsideMonthDates = true, allowOutsideMonthSelection = true, fixedSixWeekLayout = true, id, className, style, onKeyDown,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, ...nativeProps
  } = props;
  if (calendarCount !== 1 && calendarCount !== 2) throw new RangeError('CgCalendar calendarCount must be 1 or 2.');
  if (!VIEW_ORDER.includes(selectionView)) throw new RangeError(`CgCalendar selectionView "${String(selectionView)}" is invalid.`);
  if (weekNumberRule !== undefined && !['firstDay', 'firstFullWeek', 'firstFourDayWeek'].includes(weekNumberRule)) throw new RangeError(`CgCalendar weekNumberRule "${String(weekNumberRule)}" is invalid.`);
  if (minimumRangeDays !== undefined && minimumRangeDays < 1) throw new RangeError('CgCalendar minimumRangeDays must be positive.');
  if (maximumRangeDays !== undefined && maximumRangeDays < 1) throw new RangeError('CgCalendar maximumRangeDays must be positive.');
  if (minimumRangeDays !== undefined && maximumRangeDays !== undefined && minimumRangeDays > maximumRangeDays) {
    throw new RangeError('CgCalendar minimumRangeDays must not exceed maximumRangeDays.');
  }
  const minimum = parseProp('minDate', minDate);
  const maximum = parseProp('maxDate', maxDate);
  if (minimum && maximum && compareCivilDates(minimum, maximum) > 0) throw new RangeError('CgCalendar minDate must not be later than maxDate.');
  const today = todayValue === undefined ? todayCivilDate() : parseProp('today', todayValue)!;
  const initialValue: CalendarValue = _defaultValue ?? (selectionMode === 'multiple' ? [] : null);
  const [stateValue, setActualValue] = useControllableState<CalendarValue>(_value, initialValue, 'CgCalendar');
  const actualValue = useMemo(() => selectionMode === 'multiple' ? multipleDates(stateValue) : stateValue, [selectionMode, stateValue]);
  const multipleSelection = new Set(selectionMode === 'multiple' ? actualValue as readonly CgDateValue[] : []);
  const selectionAnchor = useRef<CivilDate | null>(null);
  const initialAnchor = selectedDate(actualValue, selectionMode === 'range') ?? today;
  const toUnit = (date: CivilDate): CivilDate => selectionView === 'year' ? { year: date.year, month: 1, day: 1 } : selectionView === 'month' ? { year: date.year, month: date.month, day: 1 } : date;
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
  const text = useUiLabels(localeArabic ? ARABIC_LABELS : ENGLISH_LABELS, labels, !localeArabic);
  const firstDay = firstDayOfWeek === undefined ? localeFirstDayOfWeek(resolvedLocale) : dayOfWeekIndex(firstDayOfWeek);
  const [view, setActiveView] = useState<CgCalendarView>(selectionView);
  const setView = (next: CgCalendarView) => setActiveView(VIEW_ORDER.indexOf(next) < VIEW_ORDER.indexOf(selectionView) ? selectionView : next);
  const compactViewport = useCompactViewport(autoCollapseMonths && calendarCount === 2);
  const monthCount = autoCollapseMonths && compactViewport ? 1 : calendarCount;
  const weekRule = weekNumberRule ?? localeWeekNumberRule(resolvedLocale);
  const [focusedDate, setFocusedDate] = useState(() => findAvailable(initialAnchor, 1, minimum, maximum, isDateDisabled));
  const [pendingRangeStart, setPendingRangeStart] = useState<CivilDate | null>(null);
  const [hoveredDate, setHoveredDate] = useState<CivilDate | null>(null);
  const baseMonth = parseCanonicalDate(actualVisible) ?? startOfMonth(today);
  const months = useMemo(() => Array.from({ length: monthCount }, (_, index) => addMonths(baseMonth, index)), [baseMonth, monthCount]);
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
    if (selectionMode === 'multiple') {
      const callback = _onValueChange as CgCalendarMultipleProps['onValueChange'];
      const dates = multipleDates(next);
      callback?.(dates, { value: dates, previousValue: previousValue as readonly CgDateValue[], reason, event });
    } else if (selectionMode === 'range') {
      const callback = _onValueChange as CgCalendarRangeProps['onValueChange'];
      callback?.(next as CgDateRangeValue, { value: next as CgDateRangeValue, previousValue: previousValue as CgDateRangeValue, reason, event });
    } else {
      const single = next as CgDateValue | null;
      const callback = _onValueChange as CgCalendarSingleProps['onValueChange'];
      callback?.(single, { value: single, previousValue: previousValue as CgDateValue | null, reason, event });
    }
  };

  const rangeValid = (start: CivilDate, end: CivilDate): boolean => {
    const days = selectionView === 'year' ? end.year - start.year + 1
      : selectionView === 'month' ? (end.year - start.year) * 12 + end.month - start.month + 1
        : inclusiveDayCount(start, end);
    const minimumDays = Math.max(allowSingleDayRange ? 1 : 2, minimumRangeDays ?? 1);
    return days >= minimumDays && (maximumRangeDays === undefined || days <= maximumRangeDays);
  };

  const choose = (requested: CivilDate, reason: CgCalendarChangeReason, event?: Event | SyntheticEvent) => {
    const date = toUnit(requested);
    if (disabled || readOnly || unavailable(date, minimum, maximum, isDateDisabled)) return;
    if (selectionMode === 'single') {
      emit(toCanonicalDate(date), reason, event);
      return;
    }
    if (selectionMode === 'multiple') {
      const modifiers = event as MouseEvent | KeyboardEvent | undefined;
      const control = modifiers?.ctrlKey || modifiers?.metaKey;
      const next = new Set<CgDateValue>(control ? multipleSelection : []);
      if (modifiers?.shiftKey && selectionAnchor.current) {
        const start = compareCivilDates(selectionAnchor.current, date) <= 0 ? selectionAnchor.current : date;
        const end = compareCivilDates(selectionAnchor.current, date) <= 0 ? date : selectionAnchor.current;
        let current = start;
        while (compareCivilDates(current, end) <= 0) {
          if (!unavailable(current, minimum, maximum, isDateDisabled)) next.add(toCanonicalDate(current));
          const following = selectionView === 'year' ? addYears(current, 1) : selectionView === 'month' ? addMonths(current, 1) : addDays(current, 1);
          if (sameCivilDate(current, following)) break;
          current = following;
        }
      } else {
        const canonical = toCanonicalDate(date);
        if (!control || !next.delete(canonical)) next.add(canonical);
      }
      if (!modifiers?.shiftKey) selectionAnchor.current = date;
      const normalized = Object.freeze([...next].sort());
      if (normalized.length !== multipleSelection.size || normalized.some(value => !multipleSelection.has(value))) emit(normalized, reason, event);
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
    const lastMonth = addMonths(baseMonth, monthCount - 1);
    if (compareCivilDates(targetMonth, baseMonth) < 0) changeVisible(targetMonth);
    else if (compareCivilDates(targetMonth, lastMonth) > 0) changeVisible(addMonths(targetMonth, -(monthCount - 1)));
    return next;
  };

  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (pendingRangeStart) { setPendingRangeStart(null); setHoveredDate(null); }
      else onEscape?.(event);
      return;
    }
    if (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const index = VIEW_ORDER.indexOf(view) + (event.key === 'ArrowUp' ? 1 : -1);
      if (index >= VIEW_ORDER.indexOf(selectionView) && index < VIEW_ORDER.length) { focusRequestedRef.current = true; setView(VIEW_ORDER[index]!); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (view === 'day' || view === selectionView) choose(focusedDate, 'selection', event);
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
      const next = moveFocus(target, compareCivilDates(target, focusedDate) < 0 ? -1 : 1);
      if (selectionMode === 'multiple' && event.shiftKey) choose(next, 'selection', event);
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

  const renderedRange = useMemo((): { start: CivilDate; end: CivilDate } => {
    if (view === 'month') return { start: { year: baseMonth.year, month: 1, day: 1 }, end: { year: baseMonth.year, month: 12, day: 31 } };
    if (view === 'year') { const decade = decadeGridStart(baseMonth.year); return { start: { year: decade, month: 1, day: 1 }, end: { year: Math.min(9999, decade + 11), month: 12, day: 31 } }; }
    const first = createMonthCells(baseMonth, firstDay)[0]!.date;
    const lastMonth = addMonths(baseMonth, monthCount - 1);
    const lastCells = createMonthCells(lastMonth, firstDay);
    const lastWeeks = fixedSixWeekLayout ? 6 : Math.min(6, Math.max(4, Math.ceil((daysFromWeekStart(lastMonth, firstDay) + lastCells.filter((cell) => cell.isCurrentMonth).length) / 7)));
    return { start: first, end: lastCells[lastWeeks * 7 - 1]!.date };
  }, [baseMonth, firstDay, fixedSixWeekLayout, monthCount, view]);
  const visibleRangeRef = useRef<{ key: string; version: number }>({ key: '', version: 0 });
  const visibleRangeCallback = useRef(onVisibleRangeChange);
  useLayoutEffect(() => { visibleRangeCallback.current = onVisibleRangeChange; });
  useEffect(() => {
    const key = `${toCanonicalDate(renderedRange.start)}|${toCanonicalDate(renderedRange.end)}|${view}|${monthCount}`;
    if (visibleRangeRef.current.key === key) return;
    const version = visibleRangeRef.current.version + 1;
    visibleRangeRef.current = { key, version };
    const details: CgCalendarVisibleRangeChangeDetails = { startDate: toCanonicalDate(renderedRange.start), endDate: toCanonicalDate(renderedRange.end), visibleDate: actualVisible, view, monthCount, version };
    visibleRangeCallback.current?.(details);
  }, [actualVisible, monthCount, renderedRange, view]);

  const heading = view === 'day'
    ? monthCount === 1 ? formatMonthHeading(baseMonth, resolvedLocale) : `${formatMonthHeading(baseMonth, resolvedLocale)} – ${formatMonthHeading(addMonths(baseMonth, 1), resolvedLocale)}`
    : view === 'month' ? String(baseMonth.year) : `${decadeGridStart(baseMonth.year)}–${Math.min(9999, decadeGridStart(baseMonth.year) + 11)}`;
  const canClear = allowClear && (selectionMode === 'multiple' ? multipleSelection.size > 0 : actualValue !== null) && !disabled && !readOnly;
  const canSelectToday = !disabled && !readOnly && !unavailable(toUnit(today), minimum, maximum, isDateDisabled);
  const unitSelected = (date: CivilDate): boolean => {
    const unit = toUnit(date);
    if (selectionMode === 'multiple') return multipleSelection.has(toCanonicalDate(unit));
    if (selectionMode === 'single') return Boolean(singleValue && sameCivilDate(toUnit(singleValue), unit));
    if (!rangeValue.start) return false;
    const end = rangeValue.end ?? rangeValue.start;
    return compareCivilDates(toUnit(rangeValue.start), unit) <= 0 && compareCivilDates(unit, toUnit(end)) <= 0;
  };

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
      data-month-count={monthCount}
      data-auto-collapse={autoCollapseMonths ? undefined : 'false'}
      data-week-numbers={showWeekNumbers || undefined}
      data-loading={loading || undefined}
      role="group"
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : text.calendar)}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      aria-busy={loading || undefined}
      onKeyDown={handleKeys}
      onPointerLeave={() => setHoveredDate(null)}
    >
      <div className={styles.header}>
        <button type="button" className={styles.nav} aria-label={text.previousPeriod} disabled={disabled} onClick={() => {
          const next = view === 'day' ? addMonths(baseMonth, -monthCount) : addYears(baseMonth, view === 'month' ? -1 : -10);
          focusRequestedRef.current = true; changeVisible(next); setFocusedDate(next);
        }}><CgIcon name="chevron-start" /></button>
        {/* Named by what it shows (WCAG 2.5.3); what it does is its description. */}
        <button type="button" className={styles.heading} aria-describedby={`${calendarId}-heading-hint`} disabled={disabled} onClick={() => { focusRequestedRef.current = true; setView(view === 'day' ? 'month' : 'year'); }}>
          {renderHeader ? renderHeader({ visibleDate: actualVisible, view, selectionView, heading }) : view === 'day' && monthCount === 2 ? <><span className={styles.rangeHeading}>{heading}</span><span className={styles.singleHeading}>{formatMonthHeading(baseMonth, resolvedLocale)}</span></> : heading}
        </button>
        <button type="button" className={styles.nav} aria-label={text.nextPeriod} disabled={disabled} onClick={() => {
          const next = view === 'day' ? addMonths(baseMonth, monthCount) : addYears(baseMonth, view === 'month' ? 1 : 10);
          focusRequestedRef.current = true; changeVisible(next); setFocusedDate(next);
        }}><CgIcon name="chevron-end" /></button>
      </div>
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{text.showing} {heading}</div>
      <span id={`${calendarId}-heading-hint`} hidden>{view === 'day' ? text.chooseMonthAndYear : text.chooseYear}</span>

      {view === 'day' ? <div className={styles.months}>
        {months.map((month, panelIndex) => {
          const allCells = createMonthCells(month, firstDay);
          const weekCount = fixedSixWeekLayout ? 6 : Math.min(6, Math.max(4, Math.ceil((daysFromWeekStart(month, firstDay) + allCells.filter((cell) => cell.isCurrentMonth).length) / 7)));
          const cells = allCells.slice(0, weekCount * 7);
          const panelHeading = `${calendarId}-month-${panelIndex}`;
          return <section key={toCanonicalDate(month)} className={styles.month} data-calendar-panel={panelIndex}>
            <h3 id={panelHeading} className={cx(styles.monthHeading, monthCount === 1 && styles.srOnly)}>{formatMonthHeading(month, resolvedLocale)}</h3>
            <div className={styles.grid} role="grid" aria-labelledby={panelHeading} aria-multiselectable={selectionMode !== 'single' || undefined}>
              <div className={styles.week} role="row">{showWeekNumbers ? <div className={cx(styles.weekday, styles.weekNumber)} role="columnheader" aria-hidden="true">#</div> : null}{weekdays.map((weekday, index) => <div key={weekday.long} className={styles.weekday} role="columnheader" aria-label={weekday.long} title={weekday.long}>{renderWeekday ? renderWeekday({ dayOfWeek: DAY_NAMES[(firstDay + index) % 7]!, shortName: weekday.short, fullName: weekday.long }) : weekday.short}</div>)}</div>
              {Array.from({ length: weekCount }, (_, row) => <div key={row} className={styles.week} role="row">
                {showWeekNumbers ? (() => { const week = weekOfYear(cells[row * 7]!.date, weekRule, firstDay); return <div className={styles.weekNumber} role="rowheader" aria-label={text.weekNumber.replace('{0}', String(week))} data-week-number={week}>{week}</div>; })() : null}
                {cells.slice(row * 7, row * 7 + 7).map((cell) => {
                  const canonical = toCanonicalDate(cell.date);
                  const blocked = unavailable(cell.date, minimum, maximum, isDateDisabled) || (!cell.isCurrentMonth && !allowOutsideMonthSelection);
                  const isFocused = sameCivilDate(cell.date, focusedDate);
                  const isToday = sameCivilDate(cell.date, today);
                  const inRange = Boolean(visualStart && visualEnd && compareCivilDates(cell.date, visualStart) >= 0 && compareCivilDates(cell.date, visualEnd) <= 0);
                  const isStart = sameCivilDate(cell.date, visualStart);
                  const isEnd = sameCivilDate(cell.date, visualEnd);
                  const isSelected = selectionMode === 'multiple' ? multipleSelection.has(canonical) : selectionMode === 'single' ? sameCivilDate(cell.date, singleValue) : inRange && !preview;
                  const context: CgCalendarDayRenderContext = { date: canonical, isCurrentMonth: cell.isCurrentMonth, isToday, isSelected, isFocused, isDisabled: blocked, isRangeStart: isStart, isRangeEnd: isEnd, isInRange: inRange, isRangePreview: inRange && preview };
                  const states = [isToday ? text.today : '', isSelected ? text.selected : '', isStart ? text.rangeStart : '', isEnd ? text.rangeEnd : '', inRange && !isStart && !isEnd ? preview ? text.previewRange : text.inRange : '', blocked ? text.unavailable : ''].filter(Boolean);
                  const hideDuplicate = (monthCount === 2 || !showOutsideMonthDates) && !cell.isCurrentMonth;
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
                      data-selected={selectionMode !== 'range' && isSelected || undefined}
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
          const selected = selectionView === 'month' ? unitSelected(date) : singleValue?.year === date.year && singleValue.month === month
            || rangeValue.start?.year === date.year && rangeValue.start.month === month;
          const monthBlocked = selectionView === 'month' && unavailable(date, minimum, maximum, isDateDisabled);
          return <div key={name} role="gridcell" aria-selected={selected} aria-disabled={monthBlocked || undefined}><button type="button" className={styles.period} tabIndex={focused ? 0 : -1} disabled={disabled || monthBlocked} data-period="month" data-selected={selected || undefined} data-focus-value={`month-${month}`} onFocus={() => setFocusedDate(date)} onClick={(event) => { focusRequestedRef.current = true; setFocusedDate(date); if (selectionView === 'month') { choose(date, 'selection', event); return; } changeVisible(date); setView('day'); }}>{renderMonth ? renderMonth({ date: toCanonicalDate(date), name, isSelected: selected, isFocused: focused, isDisabled: monthBlocked }) : name}</button></div>;
        })}
      </div> : <div className={styles.periodGrid} role="grid" aria-label={heading}>
        {Array.from({ length: 12 }, (_, index) => decadeGridStart(baseMonth.year) + index).filter((year) => year <= 9999).map((year) => {
          const date = { year, month: baseMonth.month, day: 1 };
          const focused = focusedDate.year === year;
          const selected = selectionView === 'year' ? unitSelected({ year, month: 1, day: 1 }) : singleValue?.year === year || rangeValue.start?.year === year;
          const outside = year === decadeGridStart(baseMonth.year) || year === decadeGridStart(baseMonth.year) + 11;
          const yearBlocked = selectionView === 'year' && unavailable({ year, month: 1, day: 1 }, minimum, maximum, isDateDisabled);
          return <div key={year} role="gridcell" aria-selected={selected} aria-disabled={yearBlocked || undefined}><button type="button" className={styles.period} tabIndex={focused ? 0 : -1} disabled={disabled || yearBlocked} data-period="year" data-selected={selected || undefined} data-focus-value={`year-${year}`} data-outside={outside || undefined} onFocus={() => setFocusedDate(date)} onClick={(event) => { focusRequestedRef.current = true; setFocusedDate(date); if (selectionView === 'year') { choose({ year, month: 1, day: 1 }, 'selection', event); return; } changeVisible(date); setView('month'); }}>{renderYear ? renderYear({ year, isSelected: selected, isFocused: focused, isDisabled: yearBlocked, isOutsideDecade: outside }) : year}</button></div>;
        })}
      </div>}

      {showTodayButton || showClearButton || renderFooter ? <div className={styles.footer}>
        {showTodayButton ? <button type="button" disabled={!canSelectToday} onClick={(event) => { moveFocus(today, 1); choose(today, 'today', event); }}>{text.today}</button> : null}
        {showClearButton ? <button type="button" disabled={!canClear} onClick={(event) => { selectionAnchor.current = null; setPendingRangeStart(null); setHoveredDate(null); emit(selectionMode === 'multiple' ? Object.freeze([]) : null, 'clear', event); }}>{text.clear}</button> : null}
        {renderFooter ? <div className={styles.footerContent}>{renderFooter({ today: toCanonicalDate(today), canSelectToday, canClear, readOnly, disabled })}</div> : null}
      </div> : null}
      {loading ? <div className={styles.loading} role="status" aria-live="polite" data-cg-calendar-loading="">{renderLoading ? renderLoading() : <><span className={styles.spinner} aria-hidden="true" /><span>{text.loading}</span></>}</div> : null}
    </div>
  );
});
