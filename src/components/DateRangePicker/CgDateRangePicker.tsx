import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent, SyntheticEvent } from 'react';
import { useCgId, useControllableState, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import {
  addDays, compareCivilDates, endOfMonth, endOfQuarter, endOfWeek, endOfYear,
  inclusiveDayCount, parseCanonicalDate, startOfMonth, startOfQuarter, startOfWeek, startOfYear,
  todayCivilDate, toCanonicalDate,
} from '../../internal/date/dateMath';
import type { CivilDate } from '../../internal/date/dateMath';
import { dayOfWeekIndex, defaultDatePattern, formatCivilDate, localeFirstDayOfWeek, parseDatePattern, parseFormattedDate } from '../../internal/date/dateFormat';
import type { CgDateRangeValue, CgDateValue, CgDayOfWeek } from '../../types/date';
import type { CgValidationState } from '../../types';
import { cx } from '../../utils';
import { CgCalendar } from '../Calendar';
import styles from './CgDateRangePicker.module.css';
import type {
  CgDateRangePickerActions, CgDateRangePickerBeforeValueChangeDetails, CgDateRangePickerChangeReason,
  CgDateRangePickerLabels, CgDateRangePickerOpenChangeReason, CgDateRangePickerProps, CgDateRangePreset,
  CgDateRangePresetContext,
} from './CgDateRangePicker.types';

const ENGLISH: CgDateRangePickerLabels = {
  calendarDialog: 'Date range calendar', openCalendar: 'Open date range calendar', clearRange: 'Clear date range',
  presets: 'Date range presets', instructions: 'Choose a start date and an end date.', apply: 'Apply', cancel: 'Cancel',
  invalidFormat: 'Enter two valid dates.', required: 'A complete date range is required.', incomplete: 'Choose both a start and end date.',
  reversed: 'The start date must not be later than the end date.', outOfRange: 'The range is outside the allowed dates.',
  disabledEndpoint: 'A range endpoint is unavailable.', tooShort: 'The selected range is too short.', tooLong: 'The selected range is too long.',
  unavailablePreset: 'This preset is unavailable.',
};
const ARABIC: CgDateRangePickerLabels = {
  calendarDialog: 'تقويم نطاق التاريخ', openCalendar: 'فتح تقويم نطاق التاريخ', clearRange: 'مسح نطاق التاريخ',
  presets: 'نطاقات التاريخ الجاهزة', instructions: 'اختر تاريخ البداية وتاريخ النهاية.', apply: 'تطبيق', cancel: 'إلغاء',
  invalidFormat: 'أدخل تاريخين صحيحين.', required: 'نطاق تاريخ كامل مطلوب.', incomplete: 'اختر تاريخ البداية والنهاية.',
  reversed: 'يجب ألا يكون تاريخ البداية بعد تاريخ النهاية.', outOfRange: 'النطاق خارج التواريخ المسموح بها.',
  disabledEndpoint: 'أحد طرفي النطاق غير متاح.', tooShort: 'النطاق المحدد قصير جدًا.', tooLong: 'النطاق المحدد طويل جدًا.',
  unavailablePreset: 'هذا النطاق غير متاح.',
};

type ValidationCode = 'invalid' | 'required' | 'incomplete' | 'reversed' | 'range' | 'disabled' | 'short' | 'long';
interface ResolvedPreset { key: string; label: React.ReactNode; value: CgDateRangeValue; disabled: boolean; reason?: string }

function isPromiseLike(value: unknown): value is PromiseLike<void | boolean> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';
}
function sameRange(left: CgDateRangeValue, right: CgDateRangeValue): boolean {
  return left === right || Boolean(left && right && left.start === right.start && left.end === right.end);
}
function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/u) ?? []).filter(Boolean);
  return ids.length ? [...new Set(ids)].join(' ') : undefined;
}
function weekdayName(index: number): CgDayOfWeek {
  return (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const)[index]!;
}

function CgDateRangePickerInner(props: CgDateRangePickerProps, forwardedRef: React.ForwardedRef<HTMLInputElement>) {
  const {
    value, defaultValue = null, onValueChange, onBeforeValueChange, onBeforeValueChangeError,
    open, defaultOpen = false, onOpenChange, commitMode = 'explicit', editFormat, displayFormat,
    rangeSeparator = ' – ', locale, firstDayOfWeek, today: todayValue, minDate, maxDate,
    isDateDisabled = () => false, minimumRangeDays, maximumRangeDays, allowSingleDayRange = true,
    calendarCount = 2, renderDay, showPresets = false, includeBuiltInPresets = true, presets = [], labels,
    allowClear = true, showClearButton = true, showCalendarButton = true, buttons = [], startName, endName,
    form, required = false, disabled, readOnly = false, onInvalid, inputRef: inputRefProp, actionsRef,
    size = 'medium', density = 'compact', direction = 'auto', intent = 'neutral', validationState = 'none', fullWidth = false,
    id, className, style, 'data-testid': testId, placeholder, onChange, onFocus, onBlur, onKeyDown,
    'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy, ...nativeProps
  } = props;
  if (!rangeSeparator) throw new Error('CgDateRangePicker rangeSeparator cannot be empty.');
  if (calendarCount !== 1 && calendarCount !== 2) throw new RangeError('CgDateRangePicker calendarCount must be 1 or 2.');
  if (minimumRangeDays !== undefined && minimumRangeDays < 1) throw new RangeError('CgDateRangePicker minimumRangeDays must be positive.');
  if (maximumRangeDays !== undefined && maximumRangeDays < 1) throw new RangeError('CgDateRangePicker maximumRangeDays must be positive.');
  if (minimumRangeDays !== undefined && maximumRangeDays !== undefined && minimumRangeDays > maximumRangeDays) throw new RangeError('CgDateRangePicker minimumRangeDays must not exceed maximumRangeDays.');
  const customKeys = new Set<string>();
  for (const preset of presets) {
    if (!preset.key.trim() || preset.label === null || preset.label === undefined || typeof preset.getRange !== 'function') throw new Error('CgDateRangePicker presets require a non-empty key, label, and getRange function.');
    if (customKeys.has(preset.key)) throw new Error(`CgDateRangePicker preset key "${preset.key}" is duplicated.`);
    customKeys.add(preset.key);
  }

  const resolvedLocale = useMemo(() => new Intl.DateTimeFormat(locale, { calendar: 'gregory' }).resolvedOptions().locale, [locale]);
  const editingFormat = useMemo(() => editFormat ?? defaultDatePattern(resolvedLocale), [editFormat, resolvedLocale]);
  const viewingFormat = displayFormat ?? editingFormat;
  parseDatePattern(editingFormat); parseDatePattern(viewingFormat);
  const today = todayValue === undefined ? todayCivilDate() : parseCanonicalDate(todayValue);
  const minimum = minDate === undefined ? null : parseCanonicalDate(minDate);
  const maximum = maxDate === undefined ? null : parseCanonicalDate(maxDate);
  if (!today) throw new Error('CgDateRangePicker today must be a canonical YYYY-MM-DD date.');
  if (minDate !== undefined && !minimum) throw new Error('CgDateRangePicker minDate must be a canonical YYYY-MM-DD date.');
  if (maxDate !== undefined && !maximum) throw new Error('CgDateRangePicker maxDate must be a canonical YYYY-MM-DD date.');
  if (minimum && maximum && compareCivilDates(minimum, maximum) > 0) throw new RangeError('CgDateRangePicker minDate must not be later than maxDate.');
  const localeArabic = new Intl.Locale(resolvedLocale).language === 'ar';
  const text = { ...(localeArabic ? ARABIC : ENGLISH), ...labels };
  const effectiveFirstDayIndex = firstDayOfWeek === undefined ? localeFirstDayOfWeek(resolvedLocale) : dayOfWeekIndex(firstDayOfWeek);
  const effectiveFirstDay = weekdayName(effectiveFirstDayIndex);

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputElementRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const startProxyRef = useRef<HTMLSelectElement>(null);
  const endProxyRef = useRef<HTMLSelectElement>(null);
  const mergedInputRef = useMergedRefs(inputElementRef, inputRefProp, forwardedRef);
  const baseId = useCgId(field.id);
  const popupId = `${baseId}-popup`;
  const errorId = `${baseId}-error`;
  const instructionsId = `${baseId}-instructions`;
  const resolvedDirection = useDirection(inputElementRef, direction);
  const [committed, setCommitted] = useControllableState<CgDateRangeValue>(value, defaultValue, 'CgDateRangePicker');
  const [isOpen, setIsOpen] = useControllableState(open, defaultOpen, 'CgDateRangePicker open');
  const isControlled = value !== undefined;
  const openControlled = open !== undefined;
  const committedRef = useRef(committed);
  const controlledRef = useRef(value);
  const openRef = useRef(isOpen);
  const mountedRef = useRef(true);
  const focusedRef = useRef(false);
  const operationRef = useRef<{ generation: number; controller: AbortController } | undefined>(undefined);
  const generationRef = useRef(0);
  const [pending, setPending] = useState(false);
  const [overlayReady, setOverlayReady] = useState(false);
  const [internalError, setInternalError] = useState<string>();
  const [draftRange, setDraftRange] = useState<CgDateRangeValue>(committed);
  const [draftReason, setDraftReason] = useState<CgDateRangePickerChangeReason>('calendar-selection');
  const [presetRevision, setPresetRevision] = useState(0);

  const formatEndpoint = useStableCallback((candidate: CgDateValue | null, focused: boolean): string => {
    if (candidate === null) return '';
    const parsed = parseCanonicalDate(candidate);
    return parsed ? formatCivilDate(parsed, focused ? editingFormat : viewingFormat, resolvedLocale) : candidate;
  });
  const formatRange = useStableCallback((candidate: CgDateRangeValue, focused: boolean): string => {
    if (candidate === null) return '';
    return `${formatEndpoint(candidate.start, focused)}${rangeSeparator}${formatEndpoint(candidate.end, focused)}`;
  });

  const validationCode = useStableCallback((candidate: CgDateRangeValue): ValidationCode | undefined => {
    if (candidate === null) return required ? 'required' : undefined;
    if (candidate.start === null || candidate.end === null) return 'incomplete';
    const start = parseCanonicalDate(candidate.start);
    const end = parseCanonicalDate(candidate.end);
    if (!start || !end) return 'invalid';
    if (compareCivilDates(start, end) > 0) return 'reversed';
    if ((minimum && compareCivilDates(start, minimum) < 0) || (maximum && compareCivilDates(end, maximum) > 0)) return 'range';
    if (isDateDisabled(candidate.start) || isDateDisabled(candidate.end)) return 'disabled';
    const days = inclusiveDayCount(start, end);
    const requiredMinimum = Math.max(allowSingleDayRange ? 1 : 2, minimumRangeDays ?? 1);
    if (days < requiredMinimum) return 'short';
    if (maximumRangeDays !== undefined && days > maximumRangeDays) return 'long';
    return undefined;
  });
  const validationMessage = useStableCallback((code: ValidationCode | undefined): string | undefined => {
    switch (code) {
      case 'invalid': return `${text.invalidFormat} ${editingFormat} ${rangeSeparator.trim()}`;
      case 'required': return text.required;
      case 'incomplete': return text.incomplete;
      case 'reversed': return text.reversed;
      case 'range': return text.outOfRange;
      case 'disabled': return text.disabledEndpoint;
      case 'short': return text.tooShort;
      case 'long': return text.tooLong;
      default: return undefined;
    }
  });
  const externalError = validationMessage(validationCode(committed));
  const effectiveError = internalError ?? externalError;
  const effectiveValidation: CgValidationState = effectiveError ? 'error' : field.validationState;
  const [draftText, setDraftText] = useState(() => formatRange(committed, false));

  useLayoutEffect(() => {
    const changed = !sameRange(committedRef.current, committed);
    committedRef.current = committed;
    controlledRef.current = value;
    openRef.current = isOpen;
    if (changed) {
      setDraftText(formatRange(committed, focusedRef.current));
      setInternalError(undefined);
      if (openRef.current) setDraftRange(committed);
    }
  }, [committed, formatRange, isOpen, value]);

  const restore = useStableCallback((focused: boolean = focusedRef.current) => {
    setDraftText(formatRange(committedRef.current, focused));
    setInternalError(validationMessage(validationCode(committedRef.current)));
  });
  const abortPending = useStableCallback(() => {
    operationRef.current?.controller.abort(); operationRef.current = undefined; generationRef.current += 1;
    if (mountedRef.current) setPending(false);
  });
  const requestValue = useStableCallback(async (next: CgDateRangeValue, reason: CgDateRangePickerChangeReason, event?: Event | SyntheticEvent): Promise<boolean> => {
    if (field.disabled || field.readOnly) return false;
    const error = validationMessage(validationCode(next));
    if (error) { setInternalError(error); return false; }
    const previousValue = committedRef.current;
    if (sameRange(previousValue, next)) { setInternalError(undefined); setDraftText(formatRange(previousValue, focusedRef.current)); return true; }
    operationRef.current?.controller.abort();
    const operation = { generation: ++generationRef.current, controller: new AbortController() };
    operationRef.current = operation; setPending(true);
    const details: CgDateRangePickerBeforeValueChangeDetails = { value: next, previousValue, reason, event, signal: operation.controller.signal };
    try {
      const result = onBeforeValueChange?.(details);
      const accepted = isPromiseLike(result) ? await result : result;
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== generationRef.current) return false;
      if (accepted === false) { restore(); return false; }
    } catch (errorValue) {
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== generationRef.current) return false;
      if (onBeforeValueChangeError) onBeforeValueChangeError(errorValue, details); else console.error('CgDateRangePicker onBeforeValueChange rejected.', errorValue);
      restore(); return false;
    } finally {
      if (mountedRef.current && operation.generation === generationRef.current) { setPending(false); operationRef.current = undefined; }
    }
    if (!isControlled) { committedRef.current = next; setCommitted(next); setDraftText(formatRange(next, focusedRef.current)); }
    setInternalError(undefined); onValueChange?.(next, { value: next, previousValue, reason, event });
    if (isControlled) queueMicrotask(() => { if (mountedRef.current) { committedRef.current = controlledRef.current ?? null; restore(); } });
    return true;
  });

  const parseText = useStableCallback((candidate: string): { value: CgDateRangeValue; error?: string } => {
    if (!candidate.trim()) {
      if (required) return { value: null, error: text.required };
      return allowClear ? { value: null } : { value: null, error: text.incomplete };
    }
    const matches: CgDateRangeValue[] = [];
    let index = 0;
    while (index <= candidate.length - rangeSeparator.length) {
      const boundary = candidate.indexOf(rangeSeparator, index);
      if (boundary < 0) break;
      const start = parseFormattedDate(candidate.slice(0, boundary), editingFormat, resolvedLocale);
      const end = parseFormattedDate(candidate.slice(boundary + rangeSeparator.length), editingFormat, resolvedLocale);
      if (start && end) matches.push({ start: toCanonicalDate(start), end: toCanonicalDate(end) });
      index = boundary + Math.max(1, rangeSeparator.length);
    }
    if (matches.length !== 1) return { value: null, error: `${text.invalidFormat} ${editingFormat} ${rangeSeparator.trim()}` };
    const match = matches[0]!;
    const error = validationMessage(validationCode(match));
    return error ? { value: match, error } : { value: match };
  });
  const commitText = useStableCallback(async (event?: Event | SyntheticEvent) => {
    const parsed = parseText(draftText);
    if (parsed.error) { setInternalError(parsed.error); return false; }
    return requestValue(parsed.value, parsed.value === null ? 'clear' : 'manual-input', event);
  });

  const requestOpen = useStableCallback((reason: CgDateRangePickerOpenChangeReason = 'programmatic', event?: Event | SyntheticEvent) => {
    if (field.disabled || field.readOnly || openRef.current) return Promise.resolve();
    setDraftRange(committedRef.current); setDraftReason('calendar-selection'); setPresetRevision((revision) => revision + 1);
    if (!openControlled) { openRef.current = true; setIsOpen(true); }
    onOpenChange?.(true, { reason, event }); return Promise.resolve();
  });
  const requestClose = useStableCallback((reason: CgDateRangePickerOpenChangeReason = 'programmatic', event?: Event | SyntheticEvent, focus = false) => {
    if (!openRef.current) return Promise.resolve();
    if (!openControlled) { openRef.current = false; setIsOpen(false); }
    onOpenChange?.(false, { reason, event }); setDraftRange(committedRef.current); restore(false);
    if (focus) queueMicrotask(() => inputElementRef.current?.focus({ preventScroll: true }));
    return Promise.resolve();
  });
  const clear = useStableCallback(async (event?: Event | SyntheticEvent) => {
    if (!allowClear || required) return;
    if (await requestValue(null, 'clear', event)) await requestClose('clear', event, true);
  });
  const apply = useStableCallback(async (event?: Event | SyntheticEvent) => {
    if (commitMode !== 'explicit') return;
    if (await requestValue(draftRange, draftReason, event)) await requestClose('apply', event, true);
  });
  const cancel = useStableCallback(async (event?: Event | SyntheticEvent) => { await requestClose('cancel', event, true); });

  useImperativeHandle(actionsRef, (): CgDateRangePickerActions => ({
    focus: () => inputElementRef.current?.focus({ preventScroll: true }), open: () => requestOpen(), close: () => requestClose(),
    toggle: () => openRef.current ? requestClose('programmatic', undefined, true) : requestOpen(), clear: () => clear(), apply: () => apply(), cancel: () => cancel(),
  }), [apply, cancel, clear, requestClose, requestOpen]);

  const reset = useStableCallback(() => {
    abortPending(); const next = isControlled ? committedRef.current : defaultValue;
    if (!isControlled) { committedRef.current = next; setCommitted(next); }
    setDraftRange(next); setDraftReason('calendar-selection'); setDraftText(formatRange(next, false)); setInternalError(undefined);
    if (openRef.current) void requestClose('reset');
  });
  useFormReset(startProxyRef, reset);
  useEffect(() => () => { mountedRef.current = false; operationRef.current?.controller.abort(); generationRef.current += 1; }, []);
  useEffect(() => { if ((field.disabled || field.readOnly) && openRef.current) void requestClose('programmatic'); }, [field.disabled, field.readOnly, requestClose]);
  const overlay = useOverlayStack(isOpen, () => { void requestClose('escape', undefined, true); }, popupRef, () => requestClose('outside-click'), controlRef);

  useEffect(() => {
    const startProxy = startProxyRef.current;
    const endProxy = endProxyRef.current;
    const message = effectiveError ?? (required && committed === null ? text.required : '');
    startProxy?.setCustomValidity(message); endProxy?.setCustomValidity(message);
    return () => { startProxy?.setCustomValidity(''); endProxy?.setCustomValidity(''); };
  }, [committed, effectiveError, required, text.required]);

  const builtIns = useMemo<ReadonlyArray<CgDateRangePreset>>(() => {
    const create = (key: string, label: string, start: CivilDate, end: CivilDate): CgDateRangePreset => ({ key, label, getRange: () => ({ start: toCanonicalDate(start), end: toCanonicalDate(end) }) });
    const thisWeekStart = startOfWeek(today, effectiveFirstDayIndex);
    const previousWeekEnd = addDays(thisWeekStart, -1);
    const previousMonthEnd = addDays(startOfMonth(today), -1);
    const previousQuarterEnd = addDays(startOfQuarter(today), -1);
    const previousYearEnd = addDays(startOfYear(today), -1);
    return [
      create('current-week', 'Current week', thisWeekStart, today), create('prior-week', 'Prior week', startOfWeek(previousWeekEnd, effectiveFirstDayIndex), endOfWeek(previousWeekEnd, effectiveFirstDayIndex)),
      create('current-month', 'Current month', startOfMonth(today), today), create('prior-month', 'Prior month', startOfMonth(previousMonthEnd), endOfMonth(previousMonthEnd)),
      create('current-quarter', 'Current quarter', startOfQuarter(today), today), create('prior-quarter', 'Prior quarter', startOfQuarter(previousQuarterEnd), endOfQuarter(previousQuarterEnd)),
      create('current-year', 'Current year', startOfYear(today), today), create('prior-year', 'Prior year', startOfYear(previousYearEnd), endOfYear(previousYearEnd)),
    ];
  }, [effectiveFirstDayIndex, today]);
  const resolvedPresets = useMemo<ReadonlyArray<ResolvedPreset>>(() => {
    void presetRevision;
    if (!showPresets) return [];
    const definitions = includeBuiltInPresets ? [...builtIns] : [];
    for (const custom of presets) {
      const index = definitions.findIndex((entry) => entry.key === custom.key);
      if (index >= 0) definitions[index] = custom; else definitions.push(custom);
    }
    const context: CgDateRangePresetContext = { today: toCanonicalDate(today), locale: resolvedLocale, firstDayOfWeek: effectiveFirstDay, minDate, maxDate };
    return definitions.map((preset) => {
      try {
        const presetValue = preset.getRange(context);
        const reason = validationMessage(validationCode(presetValue));
        return { key: preset.key, label: preset.label, value: presetValue, disabled: Boolean(reason), reason };
      } catch { return { key: preset.key, label: preset.label, value: null, disabled: true, reason: text.unavailablePreset }; }
    });
  }, [builtIns, effectiveFirstDay, includeBuiltInPresets, maxDate, minDate, presetRevision, presets, resolvedLocale, showPresets, text.unavailablePreset, today, validationCode, validationMessage]);

  const selectPreset = async (preset: ResolvedPreset, event: React.MouseEvent<HTMLButtonElement>) => {
    if (preset.disabled) return;
    if (commitMode === 'immediate') { if (await requestValue(preset.value, 'preset', event)) await requestClose('preset', event, true); }
    else { setDraftRange(preset.value); setDraftReason('preset'); }
  };
  const handleCalendar = async (next: CgDateRangeValue, event?: Event | SyntheticEvent) => {
    setDraftRange(next); setDraftReason('calendar-selection');
    if (commitMode === 'immediate' && next?.start && next.end) {
      if (await requestValue(next, 'calendar-selection', event)) await requestClose('calendar-selection', event, true);
    }
  };
  const customStart = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const customEnd = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (entries: typeof buttons) => entries.map((descriptor) => <EditorButton key={descriptor.key} descriptor={descriptor} value={committed} disabled={field.disabled} />);
  const describedBy = joinIds(field.describedBy, effectiveError ? errorId : undefined);
  const startValues = committed?.start === null || committed?.start === undefined ? [] : [committed.start];
  const endValues = committed?.end === null || committed?.end === undefined ? [] : [committed.end];

  return <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density}>
    <InputShell ref={controlRef} start={renderButtons(customStart)} end={<>
      {renderButtons(customEnd)}
      {showClearButton && allowClear && !required && committed !== null ? <EditorButton descriptor={{ key: 'range-clear', icon: 'clear', ariaLabel: text.clearRange, preventFocusLoss: true, onPress: ({ event }) => clear(event) }} value={committed} disabled={field.disabled} /> : null}
      {showCalendarButton ? <EditorButton descriptor={{ key: 'range-calendar', text: '▣', ariaLabel: text.openCalendar, preventFocusLoss: true, disabled: field.readOnly, onPress: ({ event }) => openRef.current ? requestClose('toggle-button', event, true) : requestOpen('toggle-button', event) }} value={committed} disabled={field.disabled} /> : null}
    </>} size={size} validationState={effectiveValidation} disabled={field.disabled} readOnly={field.readOnly} className={cx(styles.control, className)} style={style} data-testid={testId} data-open={isOpen || undefined} data-intent={intent}>
      <input {...nativeProps} ref={mergedInputRef} id={field.id} className={styles.input} type="text" role="combobox" aria-haspopup="dialog" aria-label={field.ariaLabel} aria-labelledby={field.labelledBy} aria-expanded={isOpen && overlayReady} aria-controls={isOpen && overlayReady ? popupId : undefined} aria-disabled={field.disabled || undefined} aria-readonly={field.readOnly || undefined} aria-required={field.required || undefined} aria-invalid={effectiveValidation === 'error' || undefined} aria-describedby={describedBy} aria-errormessage={effectiveError ? errorId : field.errorMessageId} autoComplete="off" form={form} value={draftText} placeholder={placeholder} disabled={field.disabled} readOnly={field.readOnly} onChange={(event: ChangeEvent<HTMLInputElement>) => { abortPending(); setDraftText(event.target.value); const parsed = parseText(event.target.value); setInternalError(parsed.error); onChange?.(event); }} onFocus={(event) => { focusedRef.current = true; if (!internalError) setDraftText(formatRange(committedRef.current, true)); onFocus?.(event); }} onBlur={(event) => { focusedRef.current = false; queueMicrotask(() => { if (mountedRef.current && !openRef.current && !field.disabled && !field.readOnly) void commitText(event).then((accepted) => { if (accepted) setDraftText(formatRange(committedRef.current, false)); }); }); onBlur?.(event); }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (!field.disabled && !field.readOnly) { if (event.key === 'ArrowDown') { event.preventDefault(); void requestOpen('keyboard', event); } else if (event.key === 'Enter') { event.preventDefault(); void commitText(event); } else if (event.key === 'Escape') { event.preventDefault(); if (openRef.current) void requestClose('escape', event, true); else restore(true); } } onKeyDown?.(event); }} />
    </InputShell>
    {[{ ref: startProxyRef, name: startName, values: startValues }, { ref: endProxyRef, name: endName, values: endValues }].map((proxy, index) => <select key={index} ref={proxy.ref} className={styles.formProxy} name={proxy.name} form={form} multiple required={field.required} disabled={field.disabled} value={proxy.values} tabIndex={-1} aria-hidden="true" onChange={() => undefined} onInvalid={(event: FormEvent<HTMLSelectElement>) => { setInternalError(effectiveError ?? text.required); onInvalid?.(event); event.preventDefault(); inputElementRef.current?.focus({ preventScroll: true }); }}>{proxy.values.map((item) => <option key={item} value={item}>{item}</option>)}</select>)}
    {effectiveError ? <div id={errorId} className={styles.validation} role="alert">{effectiveError}</div> : null}
    {isOpen ? <PositionedOverlay ref={popupRef} anchorRef={controlRef} id={popupId} className={styles.popup} role="dialog" aria-modal="false" aria-label={text.calendarDialog} aria-describedby={instructionsId} placement="bottom-start" widthMode="contentOrEditor" minWidth={336} maxWidth="calc(100vw - 8px)" maxHeight="calc(100vh - 8px)" scrollable onReadyChange={setOverlayReady} onAnchorLost={() => { void requestClose('anchor-lost'); }} style={{ zIndex: overlay.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${overlay.order * 2 + 1})` : `calc(var(--cg-z-popover) + ${overlay.order})` }} data-cg-overlay-id={overlay.id} data-cg-overlay-owner={overlay.ownerId}>
      <OverlayOwnerProvider id={overlay.id}><div className={styles.surface}><p id={instructionsId} className={styles.srOnly}>{text.instructions}</p>
        {resolvedPresets.length ? <aside className={styles.presets} aria-label={text.presets}>{resolvedPresets.map((preset) => <button key={preset.key} type="button" disabled={preset.disabled || pending} title={preset.reason} aria-pressed={sameRange(preset.value, draftRange)} onClick={(event) => { void selectPreset(preset, event); }}>{preset.label}</button>)}</aside> : null}
        <div className={styles.calendarArea}><CgCalendar selectionMode="range" value={draftRange} calendarCount={calendarCount} today={toCanonicalDate(today)} minDate={minDate} maxDate={maxDate} firstDayOfWeek={firstDayOfWeek} locale={resolvedLocale} direction={resolvedDirection} density={density} isDateDisabled={isDateDisabled} minimumRangeDays={minimumRangeDays} maximumRangeDays={maximumRangeDays} allowSingleDayRange={allowSingleDayRange} renderDay={renderDay} showTodayButton={false} showClearButton={false} disabled={field.disabled || pending} readOnly={field.readOnly} onValueChange={(next, details) => { void handleCalendar(next, details.event); }} onEscape={(event) => { void requestClose('escape', event, true); }} /></div>
        {commitMode === 'explicit' ? <div className={styles.footer}><button type="button" onClick={(event) => { void cancel(event); }}>{text.cancel}</button><button type="button" data-primary="" disabled={Boolean(validationCode(draftRange)) || pending} onClick={(event) => { void apply(event); }}>{text.apply}</button></div> : null}
      </div></OverlayOwnerProvider>
    </PositionedOverlay> : null}
  </div>;
}

export const CgDateRangePicker = forwardRef<HTMLInputElement, CgDateRangePickerProps>(CgDateRangePickerInner);
