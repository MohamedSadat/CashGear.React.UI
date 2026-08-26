import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, FormEvent, KeyboardEvent, SyntheticEvent } from 'react';
import {
  useCgId,
  useControllableState,
  useDirection,
  useFormReset,
  useMergedRefs,
  useStableCallback,
} from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import { cx } from '../../utils';
import type { CgValidationState } from '../../types';
import type {
  CgDateEditActions,
  CgDateEditBeforeValueChangeDetails,
  CgDateEditChangeReason,
  CgDateEditLabels,
  CgDateEditOpenChangeReason,
  CgDateEditProps,
  CgDateValue,
} from './CgDateEdit.types';
import {
  dayOfWeekIndex,
  defaultDatePattern,
  formatCivilDate,
  localeFirstDayOfWeek,
  parseDatePattern,
  parseFormattedDate,
} from './dateFormat';
import {
  clampCivilDate,
  compareCivilDates,
  parseCanonicalDate,
  todayCivilDate,
  toCanonicalDate,
} from './dateMath';
import type { CivilDate } from './dateMath';
import { DateCalendar } from './DateCalendar';
import styles from './CgDateEdit.module.css';

const ENGLISH_LABELS: CgDateEditLabels = {
  calendarDialog: 'Calendar',
  openCalendar: 'Open calendar',
  clearDate: 'Clear date',
  previousPeriod: 'Previous period',
  nextPeriod: 'Next period',
  chooseMonthAndYear: 'Choose month and year',
  chooseYear: 'Choose year',
  today: 'Today',
  clear: 'Clear',
  selected: 'Selected',
  unavailable: 'Unavailable',
};

const ARABIC_LABELS: CgDateEditLabels = {
  calendarDialog: 'التقويم',
  openCalendar: 'فتح التقويم',
  clearDate: 'مسح التاريخ',
  previousPeriod: 'الفترة السابقة',
  nextPeriod: 'الفترة التالية',
  chooseMonthAndYear: 'اختيار الشهر والسنة',
  chooseYear: 'اختيار السنة',
  today: 'اليوم',
  clear: 'مسح',
  selected: 'محدد',
  unavailable: 'غير متاح',
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function';
}

function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/u) ?? []).filter(Boolean);
  return ids.length ? [...new Set(ids)].join(' ') : undefined;
}

function CalendarGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" />
    </svg>
  );
}

function CgDateEditInner(
  {
    value,
    defaultValue = null,
    onValueChange,
    onBeforeValueChange,
    onBeforeValueChangeError,
    open,
    defaultOpen = false,
    onOpenChange,
    editFormat,
    displayFormat,
    locale,
    firstDayOfWeek,
    minDate,
    maxDate,
    isDateDisabled,
    renderDay,
    allowClear = true,
    showClearButton = true,
    showTodayButton = true,
    showCalendarButton = true,
    labels,
    invalidFormatMessage,
    outOfRangeMessage,
    disabledDateMessage,
    requiredMessage,
    buttons = [],
    inputRef: inputRefProp,
    actionsRef,
    name,
    form,
    required,
    disabled,
    readOnly = false,
    onInvalid,
    size = 'medium',
    density = 'compact',
    direction = 'auto',
    intent = 'neutral',
    validationState = 'none',
    fullWidth = false,
    id,
    className,
    style,
    'data-testid': testId,
    placeholder,
    onChange,
    onFocus,
    onBlur,
    onKeyDown,
    'aria-describedby': ariaDescribedBy,
    ...nativeProps
  }: CgDateEditProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const resolvedLocale = useMemo(() => new Intl.DateTimeFormat(locale, { calendar: 'gregory' }).resolvedOptions().locale, [locale]);
  const resolvedEditFormat = useMemo(() => editFormat ?? defaultDatePattern(resolvedLocale), [editFormat, resolvedLocale]);
  const resolvedDisplayFormat = displayFormat ?? resolvedEditFormat;
  parseDatePattern(resolvedEditFormat);
  parseDatePattern(resolvedDisplayFormat);

  const minimum = minDate === undefined ? null : parseCanonicalDate(minDate);
  const maximum = maxDate === undefined ? null : parseCanonicalDate(maxDate);
  if (minDate !== undefined && minimum === null) throw new Error('CgDateEdit minDate must be a valid canonical YYYY-MM-DD date.');
  if (maxDate !== undefined && maximum === null) throw new Error('CgDateEdit maxDate must be a valid canonical YYYY-MM-DD date.');
  if (minimum && maximum && compareCivilDates(minimum, maximum) > 0) throw new Error('CgDateEdit minDate must not be later than maxDate.');

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const inputElementRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const mergedInputRef = useMergedRefs(inputElementRef, inputRefProp, forwardedRef);
  const baseId = useCgId(field.id);
  const popupId = `${baseId}-calendar-popup`;
  const calendarId = `${baseId}-calendar`;
  const headingId = `${baseId}-calendar-heading`;
  const errorId = `${baseId}-date-error`;
  const resolvedDirection = useDirection(inputElementRef, direction);
  const [committedValue, setCommittedValue] = useControllableState<CgDateValue | null>(value, defaultValue, 'CgDateEdit');
  const [isOpen, setIsOpen] = useControllableState(open, defaultOpen, 'CgDateEdit open');
  const isControlled = value !== undefined;
  const openControlled = open !== undefined;
  const localeIsArabic = new Intl.Locale(resolvedLocale).language === 'ar';
  const resolvedLabels = { ...(localeIsArabic ? ARABIC_LABELS : ENGLISH_LABELS), ...labels };
  const effectiveFirstDay = firstDayOfWeek === undefined ? localeFirstDayOfWeek(resolvedLocale) : dayOfWeekIndex(firstDayOfWeek);
  if (effectiveFirstDay < 0) throw new Error('CgDateEdit firstDayOfWeek must be a valid day name.');

  const inputFocusedRef = useRef(false);
  const committedRef = useRef(committedValue);
  const controlledValueRef = useRef(value);
  const openRef = useRef(isOpen);
  const mountedRef = useRef(true);
  const changeGenerationRef = useRef(0);
  const changeRef = useRef<{ generation: number; controller: AbortController } | undefined>(undefined);
  const presentationKeyRef = useRef('');
  const [overlayReady, setOverlayReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [internalError, setInternalError] = useState<string>();

  const defaultInvalidMessage = localeIsArabic
    ? `أدخل تاريخًا صحيحًا بالتنسيق ${resolvedEditFormat}.`
    : `Enter a valid date in the format ${resolvedEditFormat}.`;
  const resolvedInvalidMessage = invalidFormatMessage ?? defaultInvalidMessage;
  const resolvedDisabledMessage = disabledDateMessage ?? (localeIsArabic ? 'هذا التاريخ غير متاح.' : 'This date is unavailable.');
  const resolvedRequiredMessage = requiredMessage ?? (localeIsArabic ? 'التاريخ مطلوب.' : 'A date is required.');

  const formatValue = useStableCallback((candidate: CgDateValue | null, focused: boolean): string => {
    if (candidate === null) return '';
    const date = parseCanonicalDate(candidate);
    if (!date) return candidate;
    return formatCivilDate(date, focused ? resolvedEditFormat : resolvedDisplayFormat, resolvedLocale);
  });

  const buildOutOfRangeMessage = (): string => {
    if (outOfRangeMessage) return outOfRangeMessage;
    if (minimum && maximum) {
      const minText = formatCivilDate(minimum, resolvedEditFormat, resolvedLocale);
      const maxText = formatCivilDate(maximum, resolvedEditFormat, resolvedLocale);
      return localeIsArabic ? `يجب أن يكون التاريخ بين ${minText} و${maxText}.` : `Date must be between ${minText} and ${maxText}.`;
    }
    if (minimum) {
      const text = formatCivilDate(minimum, resolvedEditFormat, resolvedLocale);
      return localeIsArabic ? `يجب أن يكون التاريخ في أو بعد ${text}.` : `Date must be on or after ${text}.`;
    }
    const text = maximum ? formatCivilDate(maximum, resolvedEditFormat, resolvedLocale) : '';
    return localeIsArabic ? `يجب أن يكون التاريخ في أو قبل ${text}.` : `Date must be on or before ${text}.`;
  };

  const restrictionError = (date: CivilDate): string | undefined => {
    if ((minimum && compareCivilDates(date, minimum) < 0) || (maximum && compareCivilDates(date, maximum) > 0)) return buildOutOfRangeMessage();
    return isDateDisabled?.(toCanonicalDate(date)) ? resolvedDisabledMessage : undefined;
  };

  const externalError = (() => {
    if (committedValue === null) return undefined;
    const date = parseCanonicalDate(committedValue);
    return date ? restrictionError(date) : resolvedInvalidMessage;
  })();
  const [draft, setDraft] = useState(() => formatValue(committedValue, false));
  const effectiveError = internalError ?? externalError;
  const effectiveValidation: CgValidationState = effectiveError ? 'error' : field.validationState;

  const restoreAuthoritativeText = useStableCallback((focused: boolean = inputFocusedRef.current) => {
    setDraft(formatValue(committedRef.current, focused));
    const authoritative = committedRef.current;
    const parsed = authoritative === null ? null : parseCanonicalDate(authoritative);
    setInternalError(authoritative !== null && parsed === null ? resolvedInvalidMessage : parsed ? restrictionError(parsed) : undefined);
  });

  useLayoutEffect(() => {
    committedRef.current = committedValue;
    controlledValueRef.current = value;
    openRef.current = isOpen;
    const presentationKey = `${committedValue ?? '<null>'}|${resolvedLocale}|${resolvedEditFormat}|${resolvedDisplayFormat}`;
    if (presentationKeyRef.current !== presentationKey) {
      presentationKeyRef.current = presentationKey;
      setDraft(formatValue(committedValue, inputFocusedRef.current));
      setInternalError(undefined);
    }
  }, [committedValue, formatValue, isOpen, resolvedDisplayFormat, resolvedEditFormat, resolvedLocale, value]);

  const abortPendingChange = useStableCallback(() => {
    changeRef.current?.controller.abort();
    changeGenerationRef.current += 1;
    changeRef.current = undefined;
    if (mountedRef.current) setPending(false);
  });

  const parseDraft = useStableCallback((): { value: CgDateValue | null; error?: string } => {
    if (!draft.trim()) {
      if (field.required || !allowClear) return { value: null, error: resolvedRequiredMessage };
      return { value: null };
    }
    const parsed = parseFormattedDate(draft, resolvedEditFormat, resolvedLocale);
    if (!parsed) return { value: null, error: resolvedInvalidMessage };
    const error = restrictionError(parsed);
    return { value: toCanonicalDate(parsed), error };
  });

  const requestValueChange = useStableCallback(async (
    nextValue: CgDateValue | null,
    reason: CgDateEditChangeReason,
    event?: Event | SyntheticEvent,
  ): Promise<boolean> => {
    if (field.disabled || field.readOnly) return false;
    if (nextValue === null && (field.required || !allowClear)) {
      setInternalError(resolvedRequiredMessage);
      return false;
    }
    const parsed = nextValue === null ? null : parseCanonicalDate(nextValue);
    if (nextValue !== null && !parsed) {
      setInternalError(resolvedInvalidMessage);
      return false;
    }
    if (parsed) {
      const error = restrictionError(parsed);
      if (error) {
        setInternalError(error);
        return false;
      }
    }
    const previousValue = committedRef.current;
    if (Object.is(previousValue, nextValue)) {
      setInternalError(undefined);
      setDraft(formatValue(previousValue, inputFocusedRef.current));
      return true;
    }

    changeRef.current?.controller.abort();
    const operation = { generation: ++changeGenerationRef.current, controller: new AbortController() };
    changeRef.current = operation;
    setPending(true);
    const details: CgDateEditBeforeValueChangeDetails = {
      value: nextValue,
      previousValue,
      reason,
      event,
      signal: operation.controller.signal,
    };
    try {
      const proposal = onBeforeValueChange?.(details);
      const accepted = isPromiseLike(proposal) ? await proposal : proposal;
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== changeGenerationRef.current) return false;
      if (accepted === false) {
        restoreAuthoritativeText();
        return false;
      }
    } catch (error) {
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== changeGenerationRef.current) return false;
      if (onBeforeValueChangeError) onBeforeValueChangeError(error, details);
      else console.error('CgDateEdit onBeforeValueChange rejected.', error);
      restoreAuthoritativeText();
      return false;
    } finally {
      if (mountedRef.current && operation.generation === changeGenerationRef.current) {
        setPending(false);
        changeRef.current = undefined;
      }
    }

    if (!isControlled) {
      committedRef.current = nextValue;
      setCommittedValue(nextValue);
      setDraft(formatValue(nextValue, inputFocusedRef.current));
    }
    setInternalError(undefined);
    onValueChange?.(nextValue, { value: nextValue, previousValue, reason, event });
    if (isControlled) {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        const authoritative = controlledValueRef.current ?? null;
        committedRef.current = authoritative;
        restoreAuthoritativeText();
      });
    }
    return true;
  });

  const requestOpen = useStableCallback((
    reason: CgDateEditOpenChangeReason = 'programmatic',
    event?: Event | SyntheticEvent,
  ): Promise<void> => {
    if (field.disabled || field.readOnly || openRef.current) return Promise.resolve();
    if (!openControlled) {
      openRef.current = true;
      setIsOpen(true);
    }
    onOpenChange?.(true, { reason, event });
    return Promise.resolve();
  });

  const requestClose = useStableCallback((
    reason: CgDateEditOpenChangeReason = 'programmatic',
    event?: Event | SyntheticEvent,
    returnFocus = false,
  ): Promise<void> => {
    if (!openRef.current) return Promise.resolve();
    if (!openControlled) {
      openRef.current = false;
      setIsOpen(false);
    }
    onOpenChange?.(false, { reason, event });
    restoreAuthoritativeText(false);
    if (returnFocus) queueMicrotask(() => inputElementRef.current?.focus({ preventScroll: true }));
    return Promise.resolve();
  });

  const commitDraft = useStableCallback(async (event?: Event | SyntheticEvent) => {
    const parsed = parseDraft();
    if (parsed.error) {
      setInternalError(parsed.error);
      return false;
    }
    return requestValueChange(parsed.value, 'manual-input', event);
  });

  const clearValue = useStableCallback(async (event?: Event | SyntheticEvent) => {
    if (!allowClear || field.required) return;
    const accepted = await requestValueChange(null, 'clear-button', event);
    if (accepted && openRef.current) await requestClose('clear-button', event, true);
    else if (accepted) inputElementRef.current?.focus({ preventScroll: true });
  });

  const selectToday = useStableCallback(async (event?: Event | SyntheticEvent) => {
    const today = todayCivilDate();
    const accepted = await requestValueChange(toCanonicalDate(today), 'today-button', event);
    if (accepted && openRef.current) await requestClose('today-button', event, true);
  });

  useImperativeHandle(actionsRef, (): CgDateEditActions => ({
    focus: () => inputElementRef.current?.focus({ preventScroll: true }),
    open: () => requestOpen(),
    close: () => requestClose('programmatic', undefined, true),
    toggle: () => openRef.current ? requestClose('programmatic', undefined, true) : requestOpen(),
    clear: () => clearValue(),
    today: () => selectToday(),
  }), [clearValue, requestClose, requestOpen, selectToday]);

  const resetFromForm = useStableCallback(() => {
    abortPendingChange();
    const next = isControlled ? committedRef.current : defaultValue;
    if (!isControlled) {
      committedRef.current = next;
      setCommittedValue(next);
    }
    setInternalError(undefined);
    setDraft(formatValue(next, false));
    if (openRef.current) void requestClose('reset');
  });
  useFormReset(formProxyRef, resetFromForm);

  useEffect(() => () => {
    mountedRef.current = false;
    changeRef.current?.controller.abort();
    changeGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    if ((field.disabled || field.readOnly) && openRef.current) void requestClose('programmatic');
  }, [field.disabled, field.readOnly, requestClose]);

  const dismissOnEscape = useStableCallback(() => { void requestClose('escape', undefined, true); });
  const dismissOnOutside = useStableCallback(() => requestClose('outside-click'));
  const overlay = useOverlayStack(isOpen, dismissOnEscape, popupRef, dismissOnOutside, controlRef);
  const selectedDate = committedValue === null ? null : parseCanonicalDate(committedValue);
  const today = todayCivilDate();
  const anchor = clampCivilDate(selectedDate ?? today, minimum, maximum);
  const canClear = allowClear && !field.required && committedValue !== null && !field.disabled && !field.readOnly;
  const serializedValues = selectedDate ? [toCanonicalDate(selectedDate)] : [];
  const customStart = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const customEnd = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (descriptors: typeof buttons) => descriptors.map((descriptor) => (
    <EditorButton key={descriptor.key} descriptor={descriptor} value={committedValue} disabled={field.disabled} />
  ));

  useEffect(() => {
    const proxy = formProxyRef.current;
    if (!proxy) return;
    const validity = effectiveError ?? (field.required && committedValue === null ? resolvedRequiredMessage : '');
    proxy.setCustomValidity(validity);
    return () => proxy.setCustomValidity('');
  }, [committedValue, effectiveError, field.required, resolvedRequiredMessage]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    abortPendingChange();
    const nextDraft = event.target.value;
    setDraft(nextDraft);
    if (!nextDraft.trim()) setInternalError(field.required || !allowClear ? resolvedRequiredMessage : undefined);
    else {
      const parsed = parseFormattedDate(nextDraft, resolvedEditFormat, resolvedLocale);
      setInternalError(parsed ? restrictionError(parsed) : resolvedInvalidMessage);
    }
    onChange?.(event);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!field.disabled && !field.readOnly) {
      if (event.key === 'ArrowDown' && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        void requestOpen('keyboard', event);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void commitDraft(event);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (openRef.current) void requestClose('escape', event, true);
        else restoreAuthoritativeText(true);
      }
    }
    onKeyDown?.(event);
  };

  const describedBy = joinIds(field.describedBy, effectiveError ? errorId : undefined);

  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density}>
      <InputShell
        ref={controlRef}
        start={renderButtons(customStart)}
        end={(
          <>
            {renderButtons(customEnd)}
            {showClearButton && canClear ? (
              <EditorButton descriptor={{ key: 'date-clear', icon: 'clear', ariaLabel: resolvedLabels.clearDate, preventFocusLoss: true, onPress: ({ event }) => clearValue(event) }} value={committedValue} disabled={field.disabled} />
            ) : null}
            {showCalendarButton ? (
              <EditorButton descriptor={{ key: 'date-calendar', icon: <CalendarGlyph />, ariaLabel: resolvedLabels.openCalendar, preventFocusLoss: true, disabled: field.readOnly, onPress: ({ event }) => openRef.current ? requestClose('toggle-button', event, true) : requestOpen('toggle-button', event) }} value={committedValue} disabled={field.disabled} />
            ) : null}
          </>
        )}
        size={size}
        validationState={effectiveValidation}
        disabled={field.disabled}
        readOnly={field.readOnly}
        className={cx(styles.control, className)}
        style={style}
        data-testid={testId}
        data-open={isOpen || undefined}
        data-intent={intent}
      >
        <input
          {...nativeProps}
          ref={mergedInputRef}
          id={field.id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={isOpen && overlayReady}
          aria-controls={isOpen && overlayReady ? popupId : undefined}
          aria-disabled={field.disabled || undefined}
          aria-readonly={field.readOnly || undefined}
          aria-required={field.required || undefined}
          aria-invalid={effectiveValidation === 'error' || undefined}
          aria-describedby={describedBy}
          aria-errormessage={effectiveError ? errorId : field.errorMessageId}
          autoComplete="off"
          form={form}
          value={draft}
          placeholder={placeholder}
          disabled={field.disabled}
          readOnly={field.readOnly}
          onChange={handleChange}
          onFocus={(event) => {
            inputFocusedRef.current = true;
            if (!internalError) setDraft(formatValue(committedRef.current, true));
            onFocus?.(event);
          }}
          onBlur={(event) => {
            inputFocusedRef.current = false;
            queueMicrotask(() => {
              if (!mountedRef.current || openRef.current || field.disabled || field.readOnly) return;
              void commitDraft(event).then((accepted) => {
                if (accepted) setDraft(formatValue(committedRef.current, false));
              });
            });
            onBlur?.(event);
          }}
          onKeyDown={handleKeyDown}
        />
      </InputShell>
      <select
        ref={formProxyRef}
        className={styles.formProxy}
        name={name}
        form={form}
        multiple
        required={field.required}
        disabled={field.disabled}
        value={serializedValues}
        tabIndex={-1}
        aria-hidden="true"
        data-cg-date-edit-form-proxy=""
        onChange={() => undefined}
        onInvalid={(event: FormEvent<HTMLSelectElement>) => {
          setInternalError(effectiveError ?? resolvedRequiredMessage);
          onInvalid?.(event);
          event.preventDefault();
          inputElementRef.current?.focus({ preventScroll: true });
        }}
      >
        {serializedValues.map((serialized) => <option key={serialized} value={serialized}>{serialized}</option>)}
      </select>
      {effectiveError ? <div id={errorId} className={styles.validationMessage} role="alert">{effectiveError}</div> : null}
      {isOpen ? (
        <PositionedOverlay
          ref={popupRef}
          anchorRef={controlRef}
          id={popupId}
          className={styles.popup}
          role="dialog"
          aria-modal="false"
          aria-label={resolvedLabels.calendarDialog}
          placement="bottom-start"
          widthMode="contentOrEditor"
          minWidth={280}
          maxWidth="calc(100vw - 8px)"
          maxHeight="calc(100vh - 8px)"
          scrollable={false}
          onReadyChange={setOverlayReady}
          onAnchorLost={() => { void requestClose('anchor-lost'); }}
          style={{ zIndex: overlay.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${overlay.order * 2 + 1})` : `calc(var(--cg-z-popover) + ${overlay.order})` }}
          data-cg-overlay-id={overlay.id}
          data-cg-overlay-owner={overlay.ownerId}
          data-cg-date-edit-popup=""
        >
          <OverlayOwnerProvider id={overlay.id}><DateCalendar
            id={calendarId}
            headingId={headingId}
            selected={selectedDate}
            anchor={anchor}
            today={today}
            minimum={minimum}
            maximum={maximum}
            firstDayOfWeek={effectiveFirstDay}
            locale={resolvedLocale}
            direction={resolvedDirection}
            labels={resolvedLabels}
            renderDay={renderDay}
            isDateDisabled={(date) => Boolean(isDateDisabled?.(toCanonicalDate(date)))}
            showTodayButton={showTodayButton}
            showClearButton={showClearButton && allowClear && !field.required}
            canClear={canClear}
            pending={pending}
            onSelect={(date, event) => {
              void requestValueChange(toCanonicalDate(date), 'calendar-selection', event).then((accepted) => {
                if (accepted) void requestClose('calendar-selection', event, true);
              });
            }}
            onToday={(event) => { void selectToday(event); }}
            onClear={(event) => { void clearValue(event); }}
            onEscape={(event) => { void requestClose('escape', event, true); }}
          /></OverlayOwnerProvider>
        </PositionedOverlay>
      ) : null}
    </div>
  );
}

export const CgDateEdit = forwardRef<HTMLInputElement, CgDateEditProps>(CgDateEditInner);
