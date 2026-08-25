import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FormEvent, KeyboardEvent, SyntheticEvent } from 'react';
import {
  useCgId,
  useControllableState,
  useDirection,
  useFormReset,
  useMergedRefs,
  useStableCallback,
} from '../../hooks';
import { EditorButton, InputShell, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import { cx } from '../../utils';
import styles from './CgDropDownBox.module.css';
import type {
  CgDropDownBoxActions,
  CgDropDownBoxCloseReason,
  CgDropDownBoxContext,
  CgDropDownBoxOpenReason,
  CgDropDownBoxProps,
  CgDropDownBoxTransitionPhase,
  CgDropDownBoxValueChangeReason,
} from './CgDropDownBox.types';

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (typeof value === 'object' || typeof value === 'function')
    && value !== null
    && typeof (value as PromiseLike<unknown>).then === 'function';
}

function renderContent<TValue>(
  content: CgDropDownBoxProps<TValue>['children'],
  context: CgDropDownBoxContext<TValue>,
) {
  return typeof content === 'function' ? content(context) : content;
}

function defaultSerialize(value: unknown, name: string | undefined): ReadonlyArray<string> {
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'bigint') {
    return [String(value)];
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError('CgDropDownBox form values must be finite.');
    return [String(value)];
  }
  if (name) {
    throw new Error('CgDropDownBox requires serializeValue when a named non-primitive value is not empty.');
  }
  return ['__cg_dropdownbox_value__'];
}

function CgDropDownBoxInner<TValue>(
  {
    value,
    defaultValue = null,
    onValueChange,
    onValueCommitted,
    getDisplayText = (item) => String(item),
    displayText,
    onDisplayTextChange,
    emptyDisplayText = '',
    emptyValue = null,
    isEmptyValue,
    isValueEqual = Object.is,
    open,
    defaultOpen = false,
    onOpenChange,
    onBeforeOpen,
    onAfterOpen,
    onBeforeClose,
    onAfterClose,
    onTransitionError,
    commitMode = 'immediate',
    openOnEditorClick = true,
    showToggleButton = true,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeOnScroll = true,
    focusOnOpen = true,
    returnFocusOnClose = true,
    closeOnCommit = true,
    openOnAltArrowDown = true,
    openOnF4 = true,
    children,
    renderDisplay,
    renderHeader,
    renderFooter,
    renderLoading,
    renderEmpty,
    renderError,
    loading = false,
    empty = false,
    error,
    loadingMessage = 'Loading…',
    emptyMessage = 'No content',
    errorMessage = 'Unable to load content.',
    buttons = [],
    clearable = false,
    clearAriaLabel = 'Clear value',
    toggleAriaLabel = 'Toggle dropdown',
    onClear,
    placement = 'bottom-start',
    dropDownWidthMode = 'editor',
    dropDownWidth,
    dropDownHeight,
    minDropDownWidth,
    maxDropDownWidth = 'calc(100vw - 8px)',
    minDropDownHeight,
    maxDropDownHeight = 'min(32rem, calc(100vh - 8px))',
    allowResize = false,
    scrollable = true,
    popupClassName,
    popupStyle,
    popupAriaLabel = 'Dropdown content',
    actionsRef,
    serializeValue,
    name,
    form,
    required,
    requiredErrorMessage = 'Please select a value.',
    disabled,
    readOnly = false,
    placeholder,
    onInvalid,
    size = 'medium',
    density = 'compact',
    direction = 'auto',
    validationState = 'none',
    fullWidth = false,
    id,
    className,
    style,
    'data-testid': testId,
    'aria-describedby': ariaDescribedBy,
    onClick,
    onFocus,
    onBlur,
    onKeyDown,
    ...nativeProps
  }: CgDropDownBoxProps<TValue>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  if (dropDownWidthMode === 'explicit' && dropDownWidth === undefined) {
    throw new Error('CgDropDownBox requires dropDownWidth when dropDownWidthMode is explicit.');
  }
  if (!requiredErrorMessage.trim()) throw new Error('CgDropDownBox requiredErrorMessage cannot be empty.');

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const popupId = `${useCgId(field.id)}-popup`;
  const resolvedDirection = useDirection(inputRef, direction);
  const [committedValue, setCommittedValue] = useControllableState<TValue | null>(value, defaultValue, 'CgDropDownBox');
  const [isOpen, setIsOpen] = useControllableState(open, defaultOpen, 'CgDropDownBox open');
  const [pendingSnapshot, setPendingSnapshot] = useState(() => ({ source: committedValue, value: committedValue }));
  let pendingValue = pendingSnapshot.value;
  if (!Object.is(pendingSnapshot.source, committedValue)) {
    pendingValue = committedValue;
    setPendingSnapshot({ source: committedValue, value: committedValue });
  }
  const setPendingValueState = useCallback((next: TValue | null) => {
    setPendingSnapshot((current) => ({ ...current, value: next }));
  }, []);
  const [overlayReady, setOverlayReady] = useState(false);
  const [reportedLoading, setReportedLoading] = useState(false);
  const [reportedEmpty, setReportedEmpty] = useState(false);
  const [reportedError, setReportedError] = useState<unknown>();
  const [internalInvalid, setInternalInvalid] = useState(false);
  const [positionRevision, setPositionRevision] = useState(0);
  const committedRef = useRef(committedValue);
  const pendingRef = useRef(pendingValue);
  const openRef = useRef(isOpen);
  const controlledValueRef = useRef(value);
  const mountedRef = useRef(true);
  const transitionRef = useRef<{ generation: number; controller: AbortController } | undefined>(undefined);
  const transitionGenerationRef = useRef(0);
  const focusOriginRef = useRef<HTMLElement | null>(null);
  const openedRef = useRef(false);
  const previousOpenRef = useRef(isOpen);
  const openDetailsRef = useRef<{ reason: CgDropDownBoxOpenReason; event?: Event | SyntheticEvent } | undefined>(undefined);
  const closeDetailsRef = useRef<{ reason: CgDropDownBoxCloseReason; event?: Event | SyntheticEvent } | undefined>(undefined);

  useLayoutEffect(() => {
    committedRef.current = committedValue;
    pendingRef.current = pendingValue;
    openRef.current = isOpen;
    controlledValueRef.current = value;
  }, [committedValue, isOpen, pendingValue, value]);

  const valueIsEmpty = useStableCallback((candidate: TValue | null) => (
    isEmptyValue ? isEmptyValue(candidate) : candidate === null || (emptyValue !== null && isValueEqual(candidate, emptyValue))
  ));

  const resolveText = useStableCallback((candidate: TValue | null) => {
    if (valueIsEmpty(candidate)) return emptyDisplayText;
    if (displayText !== undefined) return displayText;
    return getDisplayText(candidate as TValue);
  });

  const display = useMemo<{ text: string; error: unknown }>(() => {
    try {
      return { text: resolveText(committedValue), error: undefined };
    } catch (displayError) {
      return { text: '', error: displayError };
    }
  }, [committedValue, resolveText]);
  const committedEmpty = valueIsEmpty(committedValue);
  const hasPendingChanges = !isValueEqual(pendingValue, committedValue);
  const effectiveLoading = loading || reportedLoading;
  const effectiveEmpty = empty || reportedEmpty || children === undefined;
  const effectiveError = error ?? reportedError ?? display.error;
  const effectiveValidation = internalInvalid ? 'error' : field.validationState;

  const reportTransitionError = useStableCallback((transitionError: unknown, phase: CgDropDownBoxTransitionPhase) => {
    try { onTransitionError?.(transitionError, phase); } catch { /* Consumer error reporting must not escape. */ }
  });

  const beginTransition = useStableCallback(() => {
    transitionRef.current?.controller.abort();
    const next = { generation: ++transitionGenerationRef.current, controller: new AbortController() };
    transitionRef.current = next;
    return next;
  });

  const transitionIsCurrent = useStableCallback((transition: { generation: number; controller: AbortController }) => (
    mountedRef.current && !transition.controller.signal.aborted && transition.generation === transitionGenerationRef.current
  ));

  const requestOpen = useStableCallback(async (
    reason: CgDropDownBoxOpenReason = 'programmatic',
    event?: Event | SyntheticEvent,
  ) => {
    if (field.disabled || field.readOnly || openRef.current) return;
    const transition = beginTransition();
    try {
      const proposal = onBeforeOpen?.({ reason, signal: transition.controller.signal, event });
      const accepted = isPromiseLike(proposal) ? await proposal : proposal;
      if (!transitionIsCurrent(transition) || accepted === false) return;
    } catch (transitionError) {
      if (transitionIsCurrent(transition)) reportTransitionError(transitionError, 'open');
      return;
    }
    focusOriginRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : inputRef.current;
    setPendingValueState(committedRef.current);
    openDetailsRef.current = { reason, event };
    setIsOpen(true);
    onOpenChange?.(true, { reason, event });
  });

  const requestClose = useStableCallback(async (
    reason: CgDropDownBoxCloseReason = 'programmatic',
    event?: Event | SyntheticEvent,
  ) => {
    if (!openRef.current) return;
    const transition = beginTransition();
    try {
      const proposal = onBeforeClose?.({
        reason,
        hasPendingChanges: !isValueEqual(pendingRef.current, committedRef.current),
        signal: transition.controller.signal,
        event,
      });
      const accepted = isPromiseLike(proposal) ? await proposal : proposal;
      if (!transitionIsCurrent(transition) || accepted === false) return;
    } catch (transitionError) {
      if (transitionIsCurrent(transition)) reportTransitionError(transitionError, 'close');
      return;
    }
    closeDetailsRef.current = { reason, event };
    setIsOpen(false);
    onOpenChange?.(false, { reason, event });
  });

  const commitEditorValue = useStableCallback(async (
    next: TValue | null,
    reason: CgDropDownBoxValueChangeReason,
    event: Event | SyntheticEvent | undefined,
    shouldClose: boolean,
  ) => {
    if (field.disabled || field.readOnly) return;
    const previousValue = committedRef.current;
    if (!isValueEqual(previousValue, next)) {
      setPendingValueState(next);
      setCommittedValue(next);
      let nextText = '';
      try {
        nextText = resolveText(next);
      } catch (displayError) {
        setReportedError(displayError);
      }
      onValueChange?.(next, { reason, previousValue, event });
      onDisplayTextChange?.(nextText);
      onValueCommitted?.({ reason, previousValue, value: next, event });
      if (!valueIsEmpty(next)) setInternalInvalid(false);
      if (value !== undefined) {
        queueMicrotask(() => {
          if (!mountedRef.current) return;
          const authoritative = controlledValueRef.current ?? null;
          if (!isValueEqual(authoritative, next)) setPendingValueState(authoritative);
        });
      }
    } else {
      setPendingValueState(previousValue);
    }
    if (shouldClose && openRef.current) await requestClose('commit', event);
  });

  const clear = useStableCallback(async () => {
    if (!clearable || field.required || field.disabled || field.readOnly || valueIsEmpty(committedRef.current)) return;
    await commitEditorValue(emptyValue, 'clear', undefined, false);
    onClear?.();
    inputRef.current?.focus({ preventScroll: true });
  });

  const focus = useStableCallback(() => inputRef.current?.focus({ preventScroll: true }));
  const reposition = useStableCallback(() => setPositionRevision((revision) => revision + 1));
  const getCurrentDisplayText = useStableCallback(() => display.text);
  const toggle = useStableCallback(async () => {
    if (openRef.current) await requestClose('programmatic');
    else await requestOpen('programmatic');
  });

  const actions = useMemo<CgDropDownBoxActions>(() => ({
    open: (reason) => requestOpen(reason),
    close: (reason) => requestClose(reason),
    toggle,
    clear,
    focus,
    reposition,
    getDisplayText: getCurrentDisplayText,
  }), [clear, focus, getCurrentDisplayText, reposition, requestClose, requestOpen, toggle]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const context = useMemo<CgDropDownBoxContext<TValue>>(() => ({
    ...actions,
    value: committedValue,
    pendingValue,
    hasPendingChanges,
    loading: effectiveLoading,
    empty: effectiveEmpty,
    error: effectiveError,
    setPendingValue: (next) => {
      if (!field.disabled && !field.readOnly && !isValueEqual(pendingRef.current, next)) setPendingValueState(next);
    },
    commitValue: (next, event) => commitEditorValue(next, 'commit', event, closeOnCommit),
    apply: async (event) => {
      await commitEditorValue(pendingRef.current, 'apply', event, false);
      if (openRef.current) await requestClose('commit', event);
    },
    cancel: (event) => requestClose('cancel', event),
    reportLoading: (next) => { if (mountedRef.current) setReportedLoading(next); },
    reportEmpty: (next) => { if (mountedRef.current) setReportedEmpty(next); },
    reportError: (next) => { if (mountedRef.current) setReportedError(next); },
  }), [actions, closeOnCommit, commitEditorValue, committedValue, effectiveEmpty, effectiveError, effectiveLoading, field.disabled, field.readOnly, hasPendingChanges, isValueEqual, pendingValue, requestClose, setPendingValueState]);

  useEffect(() => {
    if (isOpen && !previousOpenRef.current && focusOriginRef.current === null) {
      focusOriginRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : inputRef.current;
    }
    if (previousOpenRef.current && !isOpen) {
      const details = closeDetailsRef.current ?? { reason: 'programmatic' as const };
      closeDetailsRef.current = undefined;
      openedRef.current = false;
      setOverlayReady(false);
      if (commitMode === 'explicit' && details.reason !== 'commit') setPendingValueState(committedRef.current);
      if (returnFocusOnClose) {
        const origin = focusOriginRef.current;
        queueMicrotask(() => (origin?.isConnected ? origin : inputRef.current)?.focus({ preventScroll: true }));
      }
      focusOriginRef.current = null;
      try {
        const result = onAfterClose?.(details);
        if (result) void Promise.resolve(result).catch((transitionError: unknown) => reportTransitionError(transitionError, 'afterClose'));
      } catch (transitionError) {
        reportTransitionError(transitionError, 'afterClose');
      }
    }
    previousOpenRef.current = isOpen;
  }, [commitMode, isOpen, onAfterClose, reportTransitionError, returnFocusOnClose, setPendingValueState]);

  useEffect(() => {
    if (!isOpen || !overlayReady || openedRef.current) return;
    openedRef.current = true;
    const details = openDetailsRef.current ?? { reason: 'programmatic' as const };
    openDetailsRef.current = undefined;
    if (focusOnOpen) {
      const popup = popupRef.current;
      const focusable = popup?.querySelector<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
      (focusable ?? popup)?.focus({ preventScroll: true });
    }
    try {
      const result = onAfterOpen?.(details);
      if (result) void Promise.resolve(result).catch((transitionError: unknown) => reportTransitionError(transitionError, 'afterOpen'));
    } catch (transitionError) {
      reportTransitionError(transitionError, 'afterOpen');
    }
  }, [focusOnOpen, isOpen, onAfterOpen, overlayReady, reportTransitionError]);

  useEffect(() => {
    const proxy = formProxyRef.current;
    if (!proxy) return;
    proxy.setCustomValidity(field.required && committedEmpty ? requiredErrorMessage : '');
    return () => proxy.setCustomValidity('');
  }, [committedEmpty, field.required, requiredErrorMessage]);

  const resetFromForm = useStableCallback(() => {
    transitionRef.current?.controller.abort();
    transitionGenerationRef.current += 1;
    const next = value !== undefined ? committedRef.current : defaultValue;
    setPendingValueState(next);
    setInternalInvalid(false);
    if (value === undefined && !isValueEqual(committedRef.current, next)) {
      const previousValue = committedRef.current;
      setCommittedValue(next);
      onValueChange?.(next, { reason: 'reset', previousValue });
      try { onDisplayTextChange?.(resolveText(next)); } catch (displayError) { setReportedError(displayError); }
    }
    if (openRef.current) {
      closeDetailsRef.current = { reason: 'reset' };
      setIsOpen(false);
      onOpenChange?.(false, { reason: 'reset' });
    }
  });
  useFormReset(formProxyRef, resetFromForm);

  useEffect(() => () => {
    mountedRef.current = false;
    transitionRef.current?.controller.abort();
    transitionGenerationRef.current += 1;
  }, []);

  const dismissOnEscape = useStableCallback(() => {
    void requestClose('escape');
  });
  const dismissOnScroll = useStableCallback(() => {
    void requestClose('scroll');
  });
  const overlay = useOverlayStack(
    isOpen,
    closeOnEscape ? dismissOnEscape : undefined,
  );

  const serializedValues = useMemo(() => {
    if (committedEmpty) return [];
    if (serializeValue) {
      const result = serializeValue(committedValue as TValue);
      const values = typeof result === 'string' ? [result] : [...result];
      if (values.length === 0) throw new Error('CgDropDownBox serializeValue must return at least one form value for a nonempty value.');
      if (values.some((item) => typeof item !== 'string')) throw new TypeError('CgDropDownBox serializeValue must return strings.');
      return values;
    }
    return defaultSerialize(committedValue, name);
  }, [committedEmpty, committedValue, name, serializeValue]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!field.disabled && !field.readOnly) {
      if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'ArrowDown' && openOnAltArrowDown) {
        event.preventDefault();
        void requestOpen('keyboard', event);
      } else if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === 'F4' && openOnF4) {
        event.preventDefault();
        if (openRef.current) void requestClose('programmatic', event);
        else void requestOpen('keyboard', event);
      } else if (event.key === 'Escape' && isOpen && closeOnEscape) {
        event.preventDefault();
        void requestClose('escape', event);
      }
    }
    onKeyDown?.(event);
  };

  const customStart = buttons.filter((button) => (button.placement ?? 'end') === 'start');
  const customEnd = buttons.filter((button) => (button.placement ?? 'end') === 'end');
  const renderButtons = (descriptors: typeof buttons) => descriptors.map((descriptor) => (
    <EditorButton key={descriptor.key} descriptor={descriptor} value={committedValue} disabled={field.disabled} />
  ));
  const canClear = clearable && !field.required && !field.disabled && !field.readOnly && !committedEmpty;

  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density}>
      <InputShell
        ref={controlRef}
        start={renderButtons(customStart)}
        end={(
          <>
            {renderButtons(customEnd)}
            {canClear ? <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: clearAriaLabel, preventFocusLoss: true, onPress: () => clear() }} value={committedValue} disabled={field.disabled} /> : null}
            {showToggleButton ? <EditorButton descriptor={{ key: 'toggle', icon: 'chevron-down', ariaLabel: toggleAriaLabel, preventFocusLoss: false, disabled: field.readOnly, onPress: ({ event }) => openRef.current ? requestClose('programmatic', event) : requestOpen('toggleButton', event) }} value={committedValue} disabled={field.disabled} /> : null}
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
      >
        <input
          {...nativeProps}
          ref={ref}
          id={field.id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={isOpen && overlayReady}
          aria-controls={isOpen && overlayReady ? popupId : undefined}
          aria-busy={effectiveLoading || undefined}
          aria-disabled={field.disabled || undefined}
          aria-readonly={field.readOnly || undefined}
          aria-required={field.required || undefined}
          aria-invalid={effectiveValidation === 'error' || undefined}
          aria-describedby={field.describedBy}
          aria-errormessage={field.errorMessageId}
          autoComplete="off"
          form={form}
          value={display.text}
          placeholder={committedEmpty && !display.text ? placeholder : undefined}
          disabled={field.disabled}
          readOnly
          onClick={(event) => {
            onClick?.(event);
            if (openOnEditorClick) void requestOpen('editorClick', event);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
        />
        {renderDisplay ? <span className={styles.displayTemplate} aria-hidden="true">{renderDisplay({ value: committedValue, displayText: display.text, empty: committedEmpty })}</span> : null}
      </InputShell>
      <select
        ref={formProxyRef}
        name={name}
        form={form}
        multiple
        required={field.required}
        disabled={field.disabled}
        value={serializedValues}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-cg-dropdownbox-form-proxy=""
        onChange={() => undefined}
        onInvalid={(event: FormEvent<HTMLSelectElement>) => {
          setInternalInvalid(true);
          onInvalid?.(event);
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        {serializedValues.map((serialized, index) => <option key={`${index}:${serialized}`} value={serialized}>{serialized}</option>)}
      </select>
      {isOpen ? (
        <PositionedOverlay
          ref={popupRef}
          anchorRef={controlRef}
          id={popupId}
          className={cx(styles.popup, popupClassName)}
          role="dialog"
          aria-modal="false"
          aria-label={popupAriaLabel}
          tabIndex={-1}
          placement={placement}
          widthMode={dropDownWidthMode}
          overlayWidth={dropDownWidth}
          overlayHeight={dropDownHeight}
          minWidth={minDropDownWidth}
          maxWidth={maxDropDownWidth}
          minHeight={minDropDownHeight}
          maxHeight={maxDropDownHeight}
          resizable={allowResize}
          scrollable={scrollable}
          revision={positionRevision}
          onReadyChange={setOverlayReady}
          onAnchorLost={() => { void requestClose('anchorLost'); }}
          onAnchorScroll={closeOnScroll && overlay.isTopmost ? dismissOnScroll : undefined}
          onOutsidePointerDown={closeOnOutsideClick && overlay.isTopmost ? () => { void requestClose('outsideClick'); } : undefined}
          style={{ zIndex: `calc(var(--cg-z-popover) + ${overlay.order})`, ...popupStyle }}
          data-cg-dropdownbox-popup=""
        >
          {renderHeader ? <div className={styles.header}>{renderHeader(context)}</div> : null}
          <div className={styles.body} aria-live={effectiveLoading || effectiveError !== undefined ? 'polite' : undefined}>
            {effectiveError !== undefined ? (
              <div className={cx(styles.state, styles.error)} role="alert">{renderError ? renderError({ error: effectiveError, dropDown: context }) : errorMessage}</div>
            ) : effectiveLoading ? (
              <div className={cx(styles.state, styles.loading)} role="status">{renderLoading ? renderLoading(context) : <><span className={styles.spinner} aria-hidden="true" />{loadingMessage}</>}</div>
            ) : effectiveEmpty ? (
              <div className={styles.state} role="status">{renderEmpty ? renderEmpty(context) : emptyMessage}</div>
            ) : renderContent(children, context)}
          </div>
          {renderFooter ? <div className={styles.footer}>{renderFooter(context)}</div> : null}
        </PositionedOverlay>
      ) : null}
    </div>
  );
}

export const CgDropDownBox = forwardRef(CgDropDownBoxInner) as <TValue>(
  props: CgDropDownBoxProps<TValue> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
