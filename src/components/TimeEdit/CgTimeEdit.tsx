import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, FocusEvent as ReactFocusEvent, FormEvent, KeyboardEvent, SyntheticEvent } from 'react';
import {
  useCgId,
  useControllableState,
  useDirection,
  useFormReset,
  useMergedRefs,
  useStableCallback,
} from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import type { CgValidationState } from '../../types';
import { cx } from '../../utils';
import type {
  CgTimeEditActions,
  CgTimeEditBeforeValueChangeDetails,
  CgTimeEditChangeReason,
  CgTimeEditLabels,
  CgTimeEditOpenChangeReason,
  CgTimeEditProps,
  CgTimeValue,
} from './CgTimeEdit.types';
import {
  clockTimeText,
  compareClockTimes,
  defaultTimePattern,
  formatClockTime,
  localizedPeriodNames,
  parseCanonicalTime,
  parseFormattedTime,
  parseTimePattern,
  patternUsesTwelveHour,
} from './timeValue';
import type { ClockTimeParts } from './timeValue';
import styles from './CgTimeEdit.module.css';

const ENGLISH_LABELS: CgTimeEditLabels = {
  pickerDialog: 'Choose time', openPicker: 'Open time picker', clearTime: 'Clear time',
  hour: 'Hour', minute: 'Minute', second: 'Second', period: 'Period', apply: 'Apply', cancel: 'Cancel',
};
const ARABIC_LABELS: CgTimeEditLabels = {
  pickerDialog: 'اختيار الوقت', openPicker: 'فتح منتقي الوقت', clearTime: 'مسح الوقت',
  hour: 'الساعة', minute: 'الدقيقة', second: 'الثانية', period: 'الفترة', apply: 'تطبيق', cancel: 'إلغاء',
};
const EMPTY_TIME: ClockTimeParts = { hour: 0, minute: 0, second: 0, millisecond: 0 };

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function') && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function';
}

function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/u) ?? []).filter(Boolean);
  return ids.length ? [...new Set(ids)].join(' ') : undefined;
}

function PickerGlyph() {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

function CgTimeEditInner(
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
    minTime,
    maxTime,
    minuteStep = 1,
    showSeconds = false,
    allowClear = true,
    showClearButton = true,
    showPickerButton = true,
    labels,
    invalidFormatMessage,
    outOfRangeMessage,
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
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  }: CgTimeEditProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  if (!Number.isSafeInteger(minuteStep) || minuteStep < 1 || minuteStep > 60) throw new RangeError('CgTimeEdit minuteStep must be an integer from 1 through 60.');
  const resolvedLocale = useMemo(() => new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().locale, [locale]);
  const resolvedEditFormat = useMemo(() => editFormat ?? defaultTimePattern(resolvedLocale, showSeconds), [editFormat, resolvedLocale, showSeconds]);
  const resolvedDisplayFormat = displayFormat ?? resolvedEditFormat;
  parseTimePattern(resolvedEditFormat);
  parseTimePattern(resolvedDisplayFormat);
  const minimum = minTime === undefined ? null : parseCanonicalTime(minTime);
  const maximum = maxTime === undefined ? null : parseCanonicalTime(maxTime);
  if (minTime !== undefined && !minimum) throw new Error('CgTimeEdit minTime must be canonical HH:mm:ss.SSS.');
  if (maxTime !== undefined && !maximum) throw new Error('CgTimeEdit maxTime must be canonical HH:mm:ss.SSS.');
  if (minimum && maximum && compareClockTimes(minimum, maximum) > 0) throw new Error('CgTimeEdit minTime must not be later than maxTime.');

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputElementRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const mergedInputRef = useMergedRefs(inputElementRef, inputRefProp, forwardedRef);
  const baseId = useCgId(field.id);
  const popupId = `${baseId}-time-popup`;
  const errorId = `${baseId}-time-error`;
  const resolvedDirection = useDirection(inputElementRef, direction);
  const [committedValue, setCommittedValue] = useControllableState<CgTimeValue | null>(value, defaultValue, 'CgTimeEdit');
  const [isOpen, setIsOpen] = useControllableState(open, defaultOpen, 'CgTimeEdit open');
  const isControlled = value !== undefined;
  const openControlled = open !== undefined;
  const localeIsArabic = new Intl.Locale(resolvedLocale).language === 'ar';
  const resolvedLabels = { ...(localeIsArabic ? ARABIC_LABELS : ENGLISH_LABELS), ...labels };
  const resolvedInvalidMessage = invalidFormatMessage ?? (localeIsArabic ? `أدخل وقتًا صحيحًا بالتنسيق ${resolvedEditFormat}.` : `Enter a valid time in the format ${resolvedEditFormat}.`);
  const resolvedRequiredMessage = requiredMessage ?? (localeIsArabic ? 'الوقت مطلوب.' : 'A time is required.');

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
  const [picker, setPicker] = useState<ClockTimeParts>(EMPTY_TIME);
  const usesTwelveHour = patternUsesTwelveHour(resolvedEditFormat);

  const formatValue = useStableCallback((candidate: CgTimeValue | null, focused: boolean): string => {
    if (candidate === null) return '';
    const parsed = parseCanonicalTime(candidate);
    return parsed ? formatClockTime(parsed, focused ? resolvedEditFormat : resolvedDisplayFormat, resolvedLocale) : candidate;
  });
  const restrictionError = useStableCallback((candidate: ClockTimeParts): string | undefined => {
    if ((!minimum || compareClockTimes(candidate, minimum) >= 0) && (!maximum || compareClockTimes(candidate, maximum) <= 0)) return undefined;
    if (outOfRangeMessage) return outOfRangeMessage;
    const format = resolvedEditFormat;
    if (minimum && maximum) return localeIsArabic
      ? `يجب أن يكون الوقت بين ${formatClockTime(minimum, format, resolvedLocale)} و${formatClockTime(maximum, format, resolvedLocale)}.`
      : `Time must be between ${formatClockTime(minimum, format, resolvedLocale)} and ${formatClockTime(maximum, format, resolvedLocale)}.`;
    const bound = minimum ?? maximum!;
    const text = formatClockTime(bound, format, resolvedLocale);
    return minimum ? (localeIsArabic ? `يجب أن يكون الوقت ${text} أو بعده.` : `Time must be at or after ${text}.`)
      : (localeIsArabic ? `يجب أن يكون الوقت ${text} أو قبله.` : `Time must be at or before ${text}.`);
  });
  const externalError = (() => {
    if (committedValue === null) return undefined;
    const parsed = parseCanonicalTime(committedValue);
    return parsed ? restrictionError(parsed) : resolvedInvalidMessage;
  })();
  const [draft, setDraft] = useState(() => formatValue(committedValue, false));
  const effectiveError = internalError ?? externalError;
  const effectiveValidation: CgValidationState = effectiveError ? 'error' : field.validationState;

  const restoreAuthoritativeText = useStableCallback((focused: boolean = inputFocusedRef.current) => {
    setDraft(formatValue(committedRef.current, focused));
    const authoritative = committedRef.current;
    const parsed = authoritative === null ? null : parseCanonicalTime(authoritative);
    setInternalError(authoritative !== null && !parsed ? resolvedInvalidMessage : parsed ? restrictionError(parsed) : undefined);
  });
  const resetPicker = useStableCallback(() => {
    setPicker(parseCanonicalTime(committedRef.current ?? '') ?? minimum ?? EMPTY_TIME);
  });

  useLayoutEffect(() => {
    committedRef.current = committedValue;
    controlledValueRef.current = value;
    openRef.current = isOpen;
    const key = `${committedValue ?? '<null>'}|${resolvedLocale}|${resolvedEditFormat}|${resolvedDisplayFormat}`;
    if (presentationKeyRef.current !== key) {
      presentationKeyRef.current = key;
      setDraft(formatValue(committedValue, inputFocusedRef.current));
      setInternalError(undefined);
    }
  }, [committedValue, formatValue, isOpen, resolvedDisplayFormat, resolvedEditFormat, resolvedLocale, value]);
  useEffect(() => { if (isOpen) resetPicker(); }, [isOpen, resetPicker]);
  useEffect(() => {
    if (!isOpen || !overlayReady) return;
    popupRef.current?.querySelector<HTMLSelectElement>('select')?.focus({ preventScroll: true });
  }, [isOpen, overlayReady]);

  const abortPendingChange = useStableCallback(() => {
    changeRef.current?.controller.abort();
    changeGenerationRef.current += 1;
    changeRef.current = undefined;
    if (mountedRef.current) setPending(false);
  });
  const parseDraft = useStableCallback((): { value: CgTimeValue | null; error?: string } => {
    if (!draft.trim()) return field.required || !allowClear ? { value: null, error: resolvedRequiredMessage } : { value: null };
    const base = parseCanonicalTime(committedRef.current ?? '') ?? EMPTY_TIME;
    const parsed = parseFormattedTime(draft, resolvedEditFormat, resolvedLocale, base);
    if (!parsed) return { value: null, error: resolvedInvalidMessage };
    return { value: clockTimeText(parsed), error: restrictionError(parsed) };
  });
  const requestValueChange = useStableCallback(async (
    nextValue: CgTimeValue | null,
    reason: CgTimeEditChangeReason,
    event?: Event | SyntheticEvent,
  ): Promise<boolean> => {
    if (field.disabled || field.readOnly) return false;
    if (nextValue === null && (field.required || !allowClear)) { setInternalError(resolvedRequiredMessage); return false; }
    const parsed = nextValue === null ? null : parseCanonicalTime(nextValue);
    if (nextValue !== null && !parsed) { setInternalError(resolvedInvalidMessage); return false; }
    if (parsed) { const error = restrictionError(parsed); if (error) { setInternalError(error); return false; } }
    const previousValue = committedRef.current;
    if (Object.is(previousValue, nextValue)) { setInternalError(undefined); setDraft(formatValue(previousValue, inputFocusedRef.current)); return true; }
    changeRef.current?.controller.abort();
    const operation = { generation: ++changeGenerationRef.current, controller: new AbortController() };
    changeRef.current = operation;
    setPending(true);
    const details: CgTimeEditBeforeValueChangeDetails = { value: nextValue, previousValue, reason, event, signal: operation.controller.signal };
    try {
      const proposed = onBeforeValueChange?.(details);
      const accepted = isPromiseLike(proposed) ? await proposed : proposed;
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== changeGenerationRef.current) return false;
      if (accepted === false) { restoreAuthoritativeText(); return false; }
    } catch (error) {
      if (!mountedRef.current || operation.controller.signal.aborted || operation.generation !== changeGenerationRef.current) return false;
      if (onBeforeValueChangeError) onBeforeValueChangeError(error, details);
      else console.error('CgTimeEdit onBeforeValueChange rejected.', error);
      restoreAuthoritativeText();
      return false;
    } finally {
      if (mountedRef.current && operation.generation === changeGenerationRef.current) { setPending(false); changeRef.current = undefined; }
    }
    if (!isControlled) { committedRef.current = nextValue; setCommittedValue(nextValue); setDraft(formatValue(nextValue, inputFocusedRef.current)); }
    setInternalError(undefined);
    onValueChange?.(nextValue, { value: nextValue, previousValue, reason, event });
    if (isControlled) queueMicrotask(() => {
      if (!mountedRef.current) return;
      committedRef.current = controlledValueRef.current ?? null;
      restoreAuthoritativeText();
    });
    return true;
  });

  const requestOpen = useStableCallback((reason: CgTimeEditOpenChangeReason = 'programmatic', event?: Event | SyntheticEvent): Promise<void> => {
    if (field.disabled || field.readOnly || openRef.current) return Promise.resolve();
    resetPicker();
    if (!openControlled) { openRef.current = true; setIsOpen(true); }
    onOpenChange?.(true, { reason, event });
    return Promise.resolve();
  });
  const requestClose = useStableCallback((reason: CgTimeEditOpenChangeReason = 'programmatic', event?: Event | SyntheticEvent, returnFocus = false): Promise<void> => {
    if (!openRef.current) return Promise.resolve();
    if (!openControlled) { openRef.current = false; setIsOpen(false); }
    onOpenChange?.(false, { reason, event });
    restoreAuthoritativeText(false);
    if (returnFocus) queueMicrotask(() => inputElementRef.current?.focus({ preventScroll: true }));
    return Promise.resolve();
  });
  const commitDraft = useStableCallback(async (event?: Event | SyntheticEvent) => {
    const parsed = parseDraft();
    if (parsed.error) { setInternalError(parsed.error); return false; }
    return requestValueChange(parsed.value, 'manual-input', event);
  });
  const clearValue = useStableCallback(async (event?: Event | SyntheticEvent) => {
    if (!allowClear || field.required) return;
    const accepted = await requestValueChange(null, 'clear-button', event);
    if (accepted && openRef.current) await requestClose('clear-button', event, true);
    else if (accepted) inputElementRef.current?.focus({ preventScroll: true });
  });
  const applyPicker = useStableCallback(async (event?: Event | SyntheticEvent) => {
    const accepted = await requestValueChange(clockTimeText(picker), 'picker-apply', event);
    if (accepted) await requestClose('picker-apply', event, true);
  });

  useImperativeHandle(actionsRef, (): CgTimeEditActions => ({
    focus: () => inputElementRef.current?.focus({ preventScroll: true }),
    open: () => requestOpen(),
    close: () => requestClose('programmatic', undefined, true),
    toggle: () => openRef.current ? requestClose('programmatic', undefined, true) : requestOpen(),
    clear: () => clearValue(),
  }), [clearValue, requestClose, requestOpen]);

  const resetFromForm = useStableCallback(() => {
    abortPendingChange();
    const next = isControlled ? committedRef.current : defaultValue;
    if (!isControlled) { committedRef.current = next; setCommittedValue(next); }
    setInternalError(undefined);
    setDraft(formatValue(next, false));
    if (openRef.current) void requestClose('reset');
  });
  useFormReset(formProxyRef, resetFromForm);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; changeRef.current?.controller.abort(); changeGenerationRef.current += 1; };
  }, []);
  useEffect(() => { if ((field.disabled || field.readOnly) && openRef.current) void requestClose(); }, [field.disabled, field.readOnly, requestClose]);

  const dismissOnEscape = useStableCallback(() => { void requestClose('escape', undefined, true); });
  const dismissOnOutside = useStableCallback(() => requestClose('outside-click'));
  const overlay = useOverlayStack(isOpen, dismissOnEscape, popupRef, dismissOnOutside, controlRef);
  const parsedCommitted = committedValue === null ? null : parseCanonicalTime(committedValue);
  const canClear = allowClear && !field.required && committedValue !== null && !field.disabled && !field.readOnly;
  const serializedValues = parsedCommitted ? [clockTimeText(parsedCommitted)] : [];
  const customStart = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const customEnd = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (descriptors: typeof buttons) => descriptors.map((descriptor) => <EditorButton key={descriptor.key} descriptor={descriptor} value={committedValue} disabled={field.disabled} />);

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
      const base = parseCanonicalTime(committedRef.current ?? '') ?? EMPTY_TIME;
      const parsed = parseFormattedTime(nextDraft, resolvedEditFormat, resolvedLocale, base);
      setInternalError(parsed ? restrictionError(parsed) : resolvedInvalidMessage);
    }
    onChange?.(event);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!field.disabled && !field.readOnly) {
      if (event.key === 'F4' || event.key === 'ArrowDown' && event.altKey) { event.preventDefault(); void requestOpen('keyboard', event); }
      else if (event.key === 'Enter') { event.preventDefault(); void commitDraft(event); }
      else if (event.key === 'Escape') { event.preventDefault(); if (openRef.current) void requestClose('escape', event, true); else restoreAuthoritativeText(true); }
    }
    onKeyDown?.(event);
  };
  const handleControlBlur = (event: ReactFocusEvent<HTMLElement>) => {
    queueMicrotask(() => {
      if (!mountedRef.current || openRef.current || field.disabled || field.readOnly) return;
      const active = typeof document === 'undefined' ? null : document.activeElement;
      if (active && (controlRef.current?.contains(active) || popupRef.current?.contains(active))) return;
      void commitDraft(event).then((accepted) => { if (accepted) setDraft(formatValue(committedRef.current, false)); });
    });
  };

  const hours = usesTwelveHour ? Array.from({ length: 12 }, (_, index) => index + 1) : Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 60 }, (_, index) => index).filter((minute) => minute % minuteStep === 0 || minute === picker.minute);
  const seconds = Array.from({ length: 60 }, (_, index) => index);
  const pickerHour = usesTwelveHour ? picker.hour % 12 || 12 : picker.hour;
  const pickerPeriod = picker.hour >= 12 ? 'pm' : 'am';
  const [amLabel, pmLabel] = localizedPeriodNames(resolvedLocale);
  const pickerNumber = new Intl.NumberFormat(resolvedLocale, { useGrouping: false, minimumIntegerDigits: 2, maximumFractionDigits: 0 });
  const describedBy = joinIds(field.describedBy, effectiveError ? errorId : undefined);

  return <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density} onBlurCapture={handleControlBlur}>
    <InputShell
      ref={controlRef}
      start={renderButtons(customStart)}
      end={<>{renderButtons(customEnd)}{showClearButton && canClear ? <EditorButton descriptor={{ key: 'time-clear', icon: 'clear', ariaLabel: resolvedLabels.clearTime, preventFocusLoss: true, onPress: ({ event }) => clearValue(event) }} value={committedValue} disabled={field.disabled} /> : null}{showPickerButton ? <EditorButton descriptor={{ key: 'time-picker', icon: <PickerGlyph />, ariaLabel: resolvedLabels.openPicker, preventFocusLoss: true, disabled: field.readOnly, onPress: ({ event }) => openRef.current ? requestClose('toggle-button', event, true) : requestOpen('toggle-button', event) }} value={committedValue} disabled={field.disabled} /> : null}</>}
      size={size} validationState={effectiveValidation} disabled={field.disabled} readOnly={field.readOnly}
      className={cx(styles.control, className)} style={style} data-testid={testId} data-open={isOpen || undefined} data-intent={intent}
    >
      <input
        {...nativeProps} ref={mergedInputRef} id={field.id} className={styles.input} type="text" role="combobox" aria-haspopup="dialog"
        aria-label={field.ariaLabel} aria-labelledby={field.labelledBy} aria-expanded={isOpen && overlayReady}
        aria-controls={isOpen && overlayReady ? popupId : undefined} aria-disabled={field.disabled || undefined}
        aria-readonly={field.readOnly || undefined} aria-required={field.required || undefined}
        aria-invalid={effectiveValidation === 'error' || undefined} aria-describedby={describedBy}
        aria-errormessage={effectiveError ? errorId : field.errorMessageId} autoComplete="off" form={form}
        value={draft} placeholder={placeholder} disabled={field.disabled} readOnly={field.readOnly}
        onChange={handleChange}
        onFocus={(event) => { inputFocusedRef.current = true; if (!internalError) setDraft(formatValue(committedRef.current, true)); onFocus?.(event); }}
        onBlur={(event) => { inputFocusedRef.current = false; onBlur?.(event); }}
        onKeyDown={handleKeyDown}
      />
    </InputShell>
    <select ref={formProxyRef} className={styles.formProxy} name={name} form={form} multiple required={field.required} disabled={field.disabled}
      value={serializedValues} tabIndex={-1} aria-hidden="true" data-cg-time-edit-form-proxy="" onChange={() => undefined}
      onInvalid={(event: FormEvent<HTMLSelectElement>) => { setInternalError(effectiveError ?? resolvedRequiredMessage); onInvalid?.(event); event.preventDefault(); inputElementRef.current?.focus({ preventScroll: true }); }}>
      {serializedValues.map((serialized) => <option key={serialized} value={serialized}>{serialized}</option>)}
    </select>
    {effectiveError ? <div id={errorId} className={styles.validationMessage} role="alert">{effectiveError}</div> : null}
    {isOpen ? <PositionedOverlay
      ref={popupRef} anchorRef={controlRef} id={popupId} className={styles.popup} role="dialog" aria-modal="false" aria-label={resolvedLabels.pickerDialog}
      placement="bottom-start" widthMode="contentOrEditor" minWidth={280} maxWidth="calc(100vw - 8px)" maxHeight="calc(100vh - 8px)" scrollable={false}
      onReadyChange={setOverlayReady} onAnchorLost={() => { void requestClose('anchor-lost'); }}
      style={{ zIndex: overlay.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${overlay.order * 2 + 1})` : `calc(var(--cg-z-popover) + ${overlay.order})` }}
      data-cg-overlay-id={overlay.id} data-cg-overlay-owner={overlay.ownerId} data-cg-time-edit-popup=""
    ><OverlayOwnerProvider id={overlay.id}><div className={styles.picker} aria-busy={pending || undefined}>
      <div className={styles.fields}>
        <label>{resolvedLabels.hour}<select aria-label={resolvedLabels.hour} value={pickerHour} disabled={pending} onChange={(event) => { const displayed = Number(event.target.value); setPicker((current) => ({ ...current, hour: usesTwelveHour ? displayed % 12 + (pickerPeriod === 'pm' ? 12 : 0) : displayed })); }}>{hours.map((hour) => <option key={hour} value={hour}>{pickerNumber.format(hour)}</option>)}</select></label>
        <label>{resolvedLabels.minute}<select aria-label={resolvedLabels.minute} value={picker.minute} disabled={pending} onChange={(event) => setPicker((current) => ({ ...current, minute: Number(event.target.value) }))}>{minutes.map((minute) => <option key={minute} value={minute}>{pickerNumber.format(minute)}</option>)}</select></label>
        {showSeconds ? <label>{resolvedLabels.second}<select aria-label={resolvedLabels.second} value={picker.second} disabled={pending} onChange={(event) => setPicker((current) => ({ ...current, second: Number(event.target.value) }))}>{seconds.map((second) => <option key={second} value={second}>{pickerNumber.format(second)}</option>)}</select></label> : null}
        {usesTwelveHour ? <label>{resolvedLabels.period}<select aria-label={resolvedLabels.period} value={pickerPeriod} disabled={pending} onChange={(event) => setPicker((current) => ({ ...current, hour: current.hour % 12 + (event.target.value === 'pm' ? 12 : 0) }))}><option value="am">{amLabel}</option><option value="pm">{pmLabel}</option></select></label> : null}
      </div>
      {effectiveError ? <div className={styles.pickerError} role="alert">{effectiveError}</div> : null}
      <div className={styles.actions}><button type="button" disabled={pending} onClick={(event) => { void requestClose('escape', event, true); }}>{resolvedLabels.cancel}</button><button type="button" disabled={pending} onClick={(event) => { void applyPicker(event); }}>{resolvedLabels.apply}</button></div>
    </div></OverlayOwnerProvider></PositionedOverlay> : null}
  </div>;
}

export const CgTimeEdit = forwardRef<HTMLInputElement, CgTimeEditProps>(CgTimeEditInner);
