import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, SyntheticEvent } from 'react';
import { compareCivilDates, daysInMonth, toCanonicalDate } from '../../internal/date/dateMath';
import type { CivilDate } from '../../internal/date/dateMath';
import { getMonthNames, getShortMonthNames } from '../../internal/date/dateFormat';
import { cx } from '../../utils';
import { createDateMaskTokens } from './dateMask';
import type { DateMaskPart } from './dateMask';
import styles from './DateWheel.module.css';

const ITEM_HEIGHT = 40;
const SETTLE_DELAY = 120;
const PARTS: ReadonlyArray<DateMaskPart> = ['day', 'month', 'year'];

export interface DateWheelLabels {
  readonly day: string;
  readonly month: string;
  readonly year: string;
  readonly today: string;
  readonly clear: string;
  readonly dialog: string;
}

export interface DateWheelProps {
  readonly id: string;
  readonly value: CivilDate | null;
  readonly today: CivilDate;
  readonly minimum: CivilDate | null;
  readonly maximum: CivilDate | null;
  readonly isDateDisabled?: (date: CivilDate) => boolean;
  readonly format: string;
  readonly locale: string;
  readonly direction: 'ltr' | 'rtl';
  readonly labels: DateWheelLabels;
  readonly disabledNotification: string;
  readonly disabled: boolean;
  readonly showToday: boolean;
  readonly showClear: boolean;
  readonly canClear: boolean;
  /** Commits a settled date; resolves false when the editor refused it. */
  readonly onSelect: (date: CivilDate, event?: Event | SyntheticEvent) => Promise<boolean>;
  readonly onToday: (event: SyntheticEvent) => void;
  readonly onClear: (event: SyntheticEvent) => void;
  readonly onClose: (event: SyntheticEvent | undefined, returnFocus: boolean) => void;
}

interface WheelOption { readonly value: number; readonly text: string; readonly disabled: boolean }

/** Column order from the scroll picker format; every part is offered, missing ones appended. */
function wheelLayout(format: string): { parts: ReadonlyArray<DateMaskPart>; monthKind: 'numeric' | 'short' | 'long'; twoDigitYear: boolean } {
  const tokens = createDateMaskTokens(format) ?? [];
  const parts = tokens.flatMap((token) => token.part ? [token.part] : []);
  const month = tokens.find((token) => token.part === 'month');
  const year = tokens.find((token) => token.part === 'year');
  return { parts: [...parts, ...PARTS.filter((part) => !parts.includes(part))], monthKind: month?.kind ?? 'numeric', twoDigitYear: year?.width === 2 };
}

/**
 * The date scroll picker (Blazor `CgDatePickerDisplayMode.ScrollPicker`): a listbox column per part with
 * CSS scroll-snap. A settled column commits at once and leaves the picker open; spinning onto a shorter
 * month shortens the day. Only the day column evaluates `isDateDisabled`; landing on a blocked date
 * announces `disabledNotification` and leaves the value untouched.
 */
export function DateWheel({ id, value, today, minimum, maximum, isDateDisabled, format, locale, direction, labels, disabledNotification, disabled, showToday, showClear, canClear, onSelect, onToday, onClear, onClose }: DateWheelProps) {
  const layout = useMemo(() => wheelLayout(format), [format]);
  const monthNames = useMemo(() => layout.monthKind === 'long' ? getMonthNames(locale) : layout.monthKind === 'short' ? getShortMonthNames(locale) : null, [layout.monthKind, locale]);
  const [selected, setSelected] = useState<CivilDate>(() => value ?? today);
  const [notification, setNotification] = useState('');
  const columns = useRef(new Map<DateMaskPart, HTMLDivElement>());
  const settleTimers = useRef(new Map<DateMaskPart, ReturnType<typeof setTimeout>>());
  const programmatic = useRef(new Set<DateMaskPart>());
  useEffect(() => { if (value) setSelected(value); }, [value]); // eslint-disable-line react-hooks/set-state-in-effect -- the committed value re-centres the wheel.

  const blocked = (date: CivilDate) => Boolean((minimum && compareCivilDates(date, minimum) < 0) || (maximum && compareCivilDates(date, maximum) > 0) || isDateDisabled?.(date));
  const firstYear = Math.max(1, minimum?.year ?? selected.year - 100);
  const lastYear = Math.min(9999, maximum?.year ?? selected.year + 100);
  const options = (part: DateMaskPart): ReadonlyArray<WheelOption> => {
    if (part === 'day') return Array.from({ length: daysInMonth(selected.year, selected.month) }, (_, index) => ({ value: index + 1, text: String(index + 1).padStart(2, '0'), disabled: blocked({ ...selected, day: index + 1 }) }));
    if (part === 'month') return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, text: monthNames?.[index] ?? String(index + 1).padStart(2, '0'), disabled: false }));
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => ({ value: firstYear + index, text: layout.twoDigitYear ? String((firstYear + index) % 100).padStart(2, '0') : String(firstYear + index), disabled: false }));
  };
  const partValue = (part: DateMaskPart, date: CivilDate) => part === 'day' ? date.day : part === 'month' ? date.month : date.year;

  const centre = (part: DateMaskPart, smooth = false) => {
    const column = columns.current.get(part);
    const index = options(part).findIndex((option) => option.value === partValue(part, selected));
    if (!column || index < 0) return;
    programmatic.current.add(part);
    const reduced = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof column.scrollTo === 'function') column.scrollTo({ top: index * ITEM_HEIGHT, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    else column.scrollTop = index * ITEM_HEIGHT;
    setTimeout(() => programmatic.current.delete(part), SETTLE_DELAY * 2);
  };
  useLayoutEffect(() => { for (const part of layout.parts) centre(part); }, [selected.day, selected.month, selected.year]); // eslint-disable-line react-hooks/exhaustive-deps

  const propose = async (part: DateMaskPart, next: number, event?: SyntheticEvent) => {
    const year = part === 'year' ? next : selected.year;
    const month = part === 'month' ? next : selected.month;
    const day = Math.min(part === 'day' ? next : selected.day, daysInMonth(year, month));
    const date: CivilDate = { year, month, day };
    if (date.year === selected.year && date.month === selected.month && date.day === selected.day) return;
    if (blocked(date)) { setNotification(''); queueMicrotask(() => setNotification(disabledNotification)); centre(part, true); return; }
    setNotification('');
    setSelected(date);
    if (!await onSelect(date, event)) setSelected(value ?? today);
  };

  const settle = (part: DateMaskPart) => {
    const column = columns.current.get(part);
    if (!column || programmatic.current.has(part)) return;
    const list = options(part);
    const option = list[Math.max(0, Math.min(list.length - 1, Math.round(column.scrollTop / ITEM_HEIGHT)))];
    if (option) void propose(part, option.value);
  };

  const step = (from: number, delta: number, list: ReadonlyArray<WheelOption>): number | undefined => {
    let index = from;
    for (let guard = 0; guard < list.length; guard++) {
      index = Math.max(0, Math.min(list.length - 1, index + delta));
      if (!list[index]!.disabled) return list[index]!.value;
      if (index === 0 || index === list.length - 1) break;
    }
    return undefined;
  };

  const onColumnKeyDown = (part: DateMaskPart, event: KeyboardEvent<HTMLDivElement>) => {
    const list = options(part);
    const current = list.findIndex((option) => option.value === partValue(part, selected));
    let target: number | undefined;
    switch (event.key) {
      case 'ArrowUp': target = step(current, -1, list); break;
      case 'ArrowDown': target = step(current, 1, list); break;
      case 'PageUp': target = step(current, -10, list); break;
      case 'PageDown': target = step(current, 10, list); break;
      case 'Home': target = step(-1, 1, list); break;
      case 'End': target = step(list.length, -1, list); break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault();
        const order = layout.parts.indexOf(part) + ((event.key === 'ArrowRight') === (direction === 'ltr') ? 1 : -1);
        const next = layout.parts[order];
        if (next) columns.current.get(next)?.focus({ preventScroll: true });
        return;
      }
      case 'Enter':
      case ' ':
        event.preventDefault(); onClose(event, true); return;
      case 'Escape':
        event.preventDefault(); event.stopPropagation(); onClose(event, true); return;
      default: return;
    }
    event.preventDefault();
    if (target !== undefined) void propose(part, target, event);
  };

  useEffect(() => () => { for (const timer of settleTimers.current.values()) clearTimeout(timer); }, []);

  return <div className={styles.root} dir={direction} data-cg-date-wheel="">
    <div className={styles.columns}>
      {layout.parts.map((part) => {
        const list = options(part);
        const activeIndex = list.findIndex((option) => option.value === partValue(part, selected));
        const optionId = (index: number) => `${id}-${part}-${index}`;
        return <div key={part} className={styles.columnFrame}>
          <div
            ref={(node) => { if (node) columns.current.set(part, node); else columns.current.delete(part); }}
            className={cx(styles.column, part === 'month' && monthNames && styles.wide)}
            role="listbox"
            tabIndex={disabled ? -1 : 0}
            aria-label={labels[part]}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-disabled={disabled || undefined}
            data-cg-date-wheel-part={part}
            onKeyDown={(event) => { if (!disabled) onColumnKeyDown(part, event); }}
            onScroll={() => {
              const timers = settleTimers.current;
              clearTimeout(timers.get(part));
              timers.set(part, setTimeout(() => settle(part), SETTLE_DELAY));
            }}
          >
            <div className={styles.pad} aria-hidden="true" />
            {list.map((option, index) => <div
              key={option.value}
              id={optionId(index)}
              className={styles.option}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={option.disabled || undefined}
              data-value={option.value}
              onClick={(event) => { if (!disabled) void propose(part, option.value, event); }}
            >{option.text}</div>)}
            <div className={styles.pad} aria-hidden="true" />
          </div>
        </div>;
      })}
      <div className={styles.highlight} aria-hidden="true" />
    </div>
    {showToday || showClear ? <div className={styles.footer}>
      {showToday ? <button type="button" disabled={disabled || blocked(today)} onClick={onToday}>{labels.today}</button> : null}
      {showClear ? <button type="button" disabled={disabled || !canClear} onClick={onClear}>{labels.clear}</button> : null}
    </div> : null}
    <div className={styles.status} role="status" aria-live="polite" aria-atomic="true">{notification}</div>
  </div>;
}

export function wheelDateText(date: CivilDate): string { return toCanonicalDate(date); }
