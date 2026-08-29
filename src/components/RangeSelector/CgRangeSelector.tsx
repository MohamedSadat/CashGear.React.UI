/* eslint-disable react-hooks/refs -- refs coordinate exact preview state, pointer generations, and imperative actions without driving renders. */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  Ref,
  RefAttributes,
} from 'react';
import { useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import styles from './CgRangeSelector.module.css';
import type {
  CgRangeChangeReason,
  CgRangeHandle,
  CgRangeSelectorActions,
  CgRangeSelectorChartRenderContext,
  CgRangeSelectorProps,
  CgRangeSelectorSize,
  CgRangeSelectorValue,
} from './CgRangeSelector.types';
import {
  centerRangeAt,
  createRangeModel,
  moveCompleteRange,
  moveRangeHandle,
  rangeHandleBounds,
  rangeRatio,
  rangeValueFromRatio,
  wireAdd,
  wireCompare,
  wireMultiply,
  wireNegate,
  wireSubtract,
} from './rangeValue';
import type {
  RangeKind,
  RangeModel,
  RangePublicValue,
  RangeWire,
} from './rangeValue';

type RangeStyle = CSSProperties & Record<`--cg-range-selector-${string}`, string | number>;
type OwnedNativeProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML' | 'defaultValue'>;

interface InternalRangeProps extends OwnedNativeProps {
  valueKind: RangeKind;
  value?: CgRangeSelectorValue<RangePublicValue>;
  defaultValue?: CgRangeSelectorValue<RangePublicValue>;
  onValueChange?: (value: CgRangeSelectorValue<RangePublicValue>, details: object) => void;
  minimum: RangePublicValue;
  maximum: RangePublicValue;
  step?: RangePublicValue | number;
  minimumSelectionSpan?: RangePublicValue | number;
  maximumSelectionSpan?: RangePublicValue | number;
  allowHandleSwap?: boolean;
  allowRangeDrag?: boolean;
  moveSelectedRangeByClick?: boolean;
  snapToStep?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: CgRangeSelectorSize;
  showMarkers?: boolean;
  markerCount?: number;
  showLabels?: boolean;
  formatValue?: (value: RangePublicValue, handle: CgRangeHandle) => string;
  startHandleAriaLabel?: string;
  endHandleAriaLabel?: string;
  renderChart?: (context: CgRangeSelectorChartRenderContext<RangePublicValue>) => React.ReactNode;
  onRangeChanging?: (value: CgRangeSelectorValue<RangePublicValue>, details: object) => void;
  onRangeChanged?: (value: CgRangeSelectorValue<RangePublicValue>, details: object) => void;
  actionsRef?: Ref<CgRangeSelectorActions<RangePublicValue>>;
}

interface RangePair { readonly start: RangeWire; readonly end: RangeWire }
interface Gesture {
  readonly type: 'handle' | 'range';
  readonly handle: CgRangeHandle | null;
  readonly pointerId: number;
  readonly origin: RangePair;
  readonly originPointer: RangeWire;
  readonly rect: DOMRect;
  readonly generation: number;
  readonly interactionId: number;
}
interface PendingChanging extends RangePair {
  readonly reason: CgRangeChangeReason;
  readonly handle: CgRangeHandle | null;
  readonly event?: Event;
  readonly generation: number;
}

const SIZES: ReadonlyArray<CgRangeSelectorSize> = ['small', 'medium', 'large'];

function freezeLooseValue(value: CgRangeSelectorValue<RangePublicValue> | undefined): CgRangeSelectorValue<RangePublicValue> {
  return Object.freeze({ start: value?.start ?? null, end: value?.end ?? null });
}

function frame(callback: FrameRequestCallback): number {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 16);
}

function cancelFrame(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else window.clearTimeout(handle);
}

function RangeSelectorImplementation(rawProps: CgRangeSelectorProps, forwardedRef: React.ForwardedRef<HTMLDivElement>) {
  const props = rawProps as unknown as InternalRangeProps;
  const {
    valueKind,
    value: controlledValue,
    defaultValue,
    minimum,
    maximum,
    step,
    minimumSelectionSpan,
    maximumSelectionSpan,
    allowHandleSwap = false,
    allowRangeDrag = true,
    moveSelectedRangeByClick = true,
    snapToStep = true,
    disabled = false,
    readOnly = false,
    size = 'medium',
    showMarkers = false,
    markerCount = 5,
    showLabels = true,
    formatValue,
    startHandleAriaLabel = 'Start value',
    endHandleAriaLabel = 'End value',
    renderChart,
    onRangeChanging: _onRangeChanging,
    onValueChange: _onValueChange,
    onRangeChanged: _onRangeChanged,
    actionsRef,
    className,
    style,
    onPointerDown: consumerPointerDown,
    onPointerMove: consumerPointerMove,
    onPointerUp: consumerPointerUp,
    onPointerCancel: consumerPointerCancel,
    onKeyDown: consumerKeyDown,
    ...nativeProps
  } = props;

  if (!SIZES.includes(size)) throw new Error(`CgRangeSelector size "${String(size)}" is invalid.`);
  if (!Number.isInteger(markerCount) || markerCount < 2) throw new RangeError('CgRangeSelector markerCount must be an integer of at least two.');
  if (!startHandleAriaLabel.trim() || !endHandleAriaLabel.trim()) throw new Error('CgRangeSelector requires nonempty accessible labels for both handles.');

  const controlled = controlledValue !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(() => freezeLooseValue(defaultValue));
  const authoritativeInput = controlled ? freezeLooseValue(controlledValue) : uncontrolledValue;
  const model = createRangeModel({
    kind: valueKind,
    minimum,
    maximum,
    value: authoritativeInput,
    step,
    minimumSelectionSpan,
    maximumSelectionSpan,
    snapToStep,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLSpanElement>(null);
  const endRef = useRef<HTMLSpanElement>(null);
  const startLabelRef = useRef<HTMLOutputElement>(null);
  const endLabelRef = useRef<HTMLOutputElement>(null);
  const modelRef = useRef(model);
  const propsRef = useRef(props);
  const mountedRef = useRef(true);
  const generationRef = useRef(1);
  const interactionRef = useRef(0);
  const committedInteractionRef = useRef(0);
  const gestureRef = useRef<Gesture | null>(null);
  const previewRef = useRef<RangePair>({ start: model.start, end: model.end });
  const pendingXRef = useRef(0);
  const pendingEventRef = useRef<Event | undefined>(undefined);
  const previewHandleRef = useRef<CgRangeHandle | null>(null);
  const frameRef = useRef(0);
  const resizeFrameRef = useRef(0);
  const changingTimerRef = useRef(0);
  const changingLastAtRef = useRef(0);
  const changingPendingRef = useRef<PendingChanging | null>(null);
  modelRef.current = model;
  propsRef.current = props;

  const formatWire = useStableCallback((currentModel: RangeModel, wire: RangeWire, handle: CgRangeHandle): string => {
    const publicValue = currentModel.fromWire(wire);
    const result = propsRef.current.formatValue?.(publicValue, handle) ?? String(publicValue);
    return result == null ? '' : String(result);
  });

  const applyPreview = useStableCallback((values: RangePair) => {
    const currentModel = modelRef.current;
    previewRef.current = values;
    const root = rootRef.current;
    if (root) {
      root.style.setProperty('--cg-range-selector-start-percent', `${rangeRatio(currentModel, values.start) * 100}%`);
      root.style.setProperty('--cg-range-selector-end-percent', `${rangeRatio(currentModel, values.end) * 100}%`);
    }
    const startBounds = rangeHandleBounds(currentModel, values, 'start');
    const endBounds = rangeHandleBounds(currentModel, values, 'end');
    const updateHandle = (element: HTMLElement | null, handle: CgRangeHandle, wire: RangeWire, bounds: { minimum: RangeWire; maximum: RangeWire }) => {
      if (!element) return;
      element.setAttribute('aria-valuemin', currentModel.wireText(bounds.minimum));
      element.setAttribute('aria-valuemax', currentModel.wireText(bounds.maximum));
      element.setAttribute('aria-valuenow', currentModel.wireText(wire));
      element.setAttribute('aria-valuetext', formatWire(currentModel, wire, handle));
    };
    updateHandle(startRef.current, 'start', values.start, startBounds);
    updateHandle(endRef.current, 'end', values.end, endBounds);
    if (startLabelRef.current) startLabelRef.current.textContent = formatWire(currentModel, values.start, 'start');
    if (endLabelRef.current) endLabelRef.current.textContent = formatWire(currentModel, values.end, 'end');
  });

  const cancelChanging = useStableCallback(() => {
    if (changingTimerRef.current) window.clearTimeout(changingTimerRef.current);
    changingTimerRef.current = 0;
    changingPendingRef.current = null;
  });

  const releaseGesture = useStableCallback(() => {
    if (frameRef.current) cancelFrame(frameRef.current);
    frameRef.current = 0;
    const gesture = gestureRef.current;
    if (gesture) {
      try { rootRef.current?.releasePointerCapture(gesture.pointerId); } catch { /* Capture cleanup is best effort. */ }
    }
    gestureRef.current = null;
  });

  const cancelPreview = useStableCallback(() => {
    generationRef.current += 1;
    releaseGesture();
    cancelChanging();
    const current = modelRef.current;
    applyPreview({ start: current.start, end: current.end });
  });

  const interactionDetails = useStableCallback((
    next: CgRangeSelectorValue<RangePublicValue>,
    previous: CgRangeSelectorValue<RangePublicValue>,
    reason: CgRangeChangeReason,
    handle: CgRangeHandle | null,
    event?: Event,
  ) => Object.freeze({ value: next, previousValue: previous, reason, handle, ...(event ? { event } : {}) }));

  const publishChanging = useStableCallback((pending?: PendingChanging) => {
    if (changingTimerRef.current) window.clearTimeout(changingTimerRef.current);
    changingTimerRef.current = 0;
    const current = pending ?? changingPendingRef.current;
    changingPendingRef.current = null;
    if (!current || current.generation !== generationRef.current || !propsRef.current.onRangeChanging) return;
    changingLastAtRef.current = performance.now();
    const currentModel = modelRef.current;
    const next = currentModel.proposal(current.start, current.end);
    propsRef.current.onRangeChanging(next, interactionDetails(next, currentModel.value, current.reason, current.handle, current.event));
  });

  const queueChanging = useStableCallback((pending: PendingChanging) => {
    if (!propsRef.current.onRangeChanging) return;
    changingPendingRef.current = pending;
    const remaining = 100 - (performance.now() - changingLastAtRef.current);
    if (remaining <= 0) publishChanging();
    else if (!changingTimerRef.current) changingTimerRef.current = window.setTimeout(() => publishChanging(), remaining);
  });

  const commit = useStableCallback((
    values: RangePair,
    reason: CgRangeChangeReason,
    handle: CgRangeHandle | null,
    interactionId: number,
    generation: number,
    event?: Event,
  ) => {
    if (!mountedRef.current || disabled || readOnly || generation !== generationRef.current || interactionId <= committedInteractionRef.current) return;
    committedInteractionRef.current = interactionId;
    cancelChanging();
    const currentModel = modelRef.current;
    if (wireCompare(values.start, currentModel.start) === 0 && wireCompare(values.end, currentModel.end) === 0) {
      applyPreview({ start: currentModel.start, end: currentModel.end });
      return;
    }
    const next = currentModel.proposal(values.start, values.end);
    const previous = currentModel.value;
    const details = interactionDetails(next, previous, reason, handle, event);
    if (propsRef.current.onRangeChanging) propsRef.current.onRangeChanging(next, details);
    if (!controlled) setUncontrolledValue(next);
    propsRef.current.onValueChange?.(next, details);
    propsRef.current.onRangeChanged?.(next, details);
    applyPreview(values);
    if (controlled) {
      const acceptedGeneration = generationRef.current;
      queueMicrotask(() => {
        if (!mountedRef.current || generationRef.current !== acceptedGeneration) return;
        const authoritative = modelRef.current;
        applyPreview({ start: authoritative.start, end: authoritative.end });
      });
    }
  });

  const valueAt = useStableCallback((rect: DOMRect, clientX: number): RangeWire => {
    const physical = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const rtl = rootRef.current ? getComputedStyle(rootRef.current).direction === 'rtl' : false;
    return rangeValueFromRatio(modelRef.current, rtl ? 1 - physical : physical);
  });

  const updateGesture = useStableCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.generation !== generationRef.current) return;
    const currentModel = modelRef.current;
    const pointer = valueAt(gesture.rect, pendingXRef.current);
    let result: RangePair;
    let reason: CgRangeChangeReason;
    let handle: CgRangeHandle | null;
    if (gesture.type === 'range') {
      result = moveCompleteRange(currentModel, gesture.origin, wireSubtract(pointer, gesture.originPointer), snapToStep);
      reason = 'rangeDrag';
      handle = null;
    } else {
      const moved = moveRangeHandle(currentModel, gesture.origin, gesture.handle!, pointer, allowHandleSwap, snapToStep);
      result = moved;
      handle = moved.handle;
      reason = 'pointer';
    }
    previewHandleRef.current = handle;
    applyPreview(result);
    queueChanging({ ...result, reason, handle, event: pendingEventRef.current, generation: gesture.generation });
  });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    consumerPointerDown?.(event);
    if (event.defaultPrevented || disabled || readOnly || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    const track = target?.closest<HTMLElement>('[data-cg-range-track]');
    if (!track || !event.currentTarget.contains(track)) return;
    const handleElement = target?.closest<HTMLElement>('[data-cg-range-handle]');
    const selection = target?.closest<HTMLElement>('[data-cg-range-selection]');
    const currentModel = modelRef.current;
    const rect = track.getBoundingClientRect();
    const origin = { start: currentModel.start, end: currentModel.end };
    const interactionId = ++interactionRef.current;
    const generation = generationRef.current;
    if (!handleElement && !selection) {
      if (!moveSelectedRangeByClick) return;
      const result = centerRangeAt(currentModel, origin, valueAt(rect, event.clientX), snapToStep);
      applyPreview(result);
      commit(result, 'track', null, interactionId, generation, event.nativeEvent);
      event.preventDefault();
      return;
    }
    if (selection && !handleElement && !allowRangeDrag) return;
    const handle = handleElement?.dataset.cgRangeHandle as CgRangeHandle | undefined;
    gestureRef.current = {
      type: handle ? 'handle' : 'range',
      handle: handle ?? null,
      pointerId: event.pointerId,
      origin,
      originPointer: valueAt(rect, event.clientX),
      rect,
      generation,
      interactionId,
    };
    previewHandleRef.current = handle ?? null;
    pendingXRef.current = event.clientX;
    pendingEventRef.current = event.nativeEvent;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Unsupported capture is nonfatal. */ }
    event.preventDefault();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    consumerPointerMove?.(event);
    const gesture = gestureRef.current;
    if (event.defaultPrevented || !gesture || gesture.pointerId !== event.pointerId) return;
    pendingXRef.current = event.clientX;
    pendingEventRef.current = event.nativeEvent;
    if (!frameRef.current) frameRef.current = frame(() => { frameRef.current = 0; updateGesture(); });
    event.preventDefault();
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    consumerPointerUp?.(event);
    const gesture = gestureRef.current;
    if (event.defaultPrevented || !gesture || gesture.pointerId !== event.pointerId) return;
    if (frameRef.current) cancelFrame(frameRef.current);
    frameRef.current = 0;
    pendingXRef.current = event.clientX;
    pendingEventRef.current = event.nativeEvent;
    updateGesture();
    const values = previewRef.current;
    releaseGesture();
    commit(values, gesture.type === 'range' ? 'rangeDrag' : 'pointer', gesture.type === 'range' ? null : previewHandleRef.current, gesture.interactionId, gesture.generation, event.nativeEvent);
    event.preventDefault();
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    consumerPointerCancel?.(event);
    if (gestureRef.current?.pointerId === event.pointerId) cancelPreview();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    consumerKeyDown?.(event);
    if (event.defaultPrevented || disabled || readOnly) return;
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>('[data-cg-range-handle]') : null;
    if (!target || !event.currentTarget.contains(target)) return;
    const handle = target.dataset.cgRangeHandle as CgRangeHandle;
    const currentModel = modelRef.current;
    const origin = { start: currentModel.start, end: currentModel.end };
    const current = handle === 'start' ? origin.start : origin.end;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    let candidate: RangeWire | undefined;
    let shouldSnap = snapToStep;
    switch (event.key) {
      case 'ArrowRight': candidate = wireAdd(current, rtl ? wireNegate(currentModel.step) : currentModel.step); break;
      case 'ArrowLeft': candidate = wireAdd(current, rtl ? currentModel.step : wireNegate(currentModel.step)); break;
      case 'ArrowUp': candidate = wireAdd(current, currentModel.step); break;
      case 'ArrowDown': candidate = wireAdd(current, wireNegate(currentModel.step)); break;
      case 'PageUp': candidate = wireAdd(current, wireMultiply(currentModel.step, 10)); break;
      case 'PageDown': candidate = wireAdd(current, wireNegate(wireMultiply(currentModel.step, 10))); break;
      case 'Home': candidate = rangeHandleBounds(currentModel, origin, handle).minimum; shouldSnap = false; break;
      case 'End': candidate = rangeHandleBounds(currentModel, origin, handle).maximum; shouldSnap = false; break;
      default: return;
    }
    const moved = moveRangeHandle(currentModel, origin, handle, candidate, allowHandleSwap, shouldSnap);
    const interactionId = ++interactionRef.current;
    applyPreview(moved);
    commit(moved, 'keyboard', moved.handle, interactionId, generationRef.current, event.nativeEvent);
    if (moved.handle !== handle) (moved.handle === 'start' ? startRef.current : endRef.current)?.focus({ preventScroll: true });
    event.preventDefault();
  };

  const actions = useMemo<CgRangeSelectorActions<RangePublicValue>>(() => Object.freeze({
    focusHandle: (handle: CgRangeHandle) => {
      const element = handle === 'start' ? startRef.current : endRef.current;
      if (!element || disabled) return false;
      element.focus({ preventScroll: true });
      return document.activeElement === element;
    },
    getValue: () => modelRef.current.value,
    cancelPreview,
    recalculateGeometry: cancelPreview,
  }), [cancelPreview, disabled]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  useLayoutEffect(() => {
    cancelPreview();
  }, [allowHandleSwap, allowRangeDrag, cancelPreview, disabled, formatValue, model.key, moveSelectedRangeByClick, readOnly, snapToStep]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (resizeFrameRef.current) cancelFrame(resizeFrameRef.current);
      resizeFrameRef.current = frame(() => {
        resizeFrameRef.current = 0;
        cancelPreview();
      });
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      if (resizeFrameRef.current) cancelFrame(resizeFrameRef.current);
      resizeFrameRef.current = 0;
    };
  }, [cancelPreview]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (resizeFrameRef.current) cancelFrame(resizeFrameRef.current);
      resizeFrameRef.current = 0;
      releaseGesture();
      cancelChanging();
    };
  }, [cancelChanging, releaseGesture]);

  const initial = { start: model.start, end: model.end };
  const startBounds = rangeHandleBounds(model, initial, 'start');
  const endBounds = rangeHandleBounds(model, initial, 'end');
  const startPercent = rangeRatio(model, model.start) * 100;
  const endPercent = rangeRatio(model, model.end) * 100;
  const rootStyle: RangeStyle = {
    ...(style ?? {}),
    '--cg-range-selector-start-percent': `${startPercent}%`,
    '--cg-range-selector-end-percent': `${endPercent}%`,
  };
  const chartContext = Object.freeze<CgRangeSelectorChartRenderContext<RangePublicValue>>({
    minimum: model.minimumPublic,
    maximum: model.maximumPublic,
    value: model.value,
    resolvedStart: model.resolvedStartPublic,
    resolvedEnd: model.resolvedEndPublic,
    startRatio: startPercent / 100,
    endRatio: endPercent / 100,
    disabled,
    readOnly,
    actions,
  });

  return (
    <div
      {...nativeProps}
      ref={(element) => {
        rootRef.current = element;
        if (typeof forwardedRef === 'function') forwardedRef(element);
        else if (forwardedRef) forwardedRef.current = element;
      }}
      className={cx(styles.root, styles[size], disabled && styles.disabled, readOnly && styles.readOnly, allowRangeDrag && styles.rangeDrag, className)}
      style={rootStyle}
      data-cg-range-selector=""
      data-value-kind={valueKind}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      {showLabels ? <div className={styles.labels} aria-hidden="true">
        <output ref={startLabelRef} className={cx(styles.label, styles.startLabel)} data-cg-range-label="start">{formatWire(model, model.start, 'start')}</output>
        <output ref={endLabelRef} className={cx(styles.label, styles.endLabel)} data-cg-range-label="end">{formatWire(model, model.end, 'end')}</output>
      </div> : null}
      <div className={styles.track} data-cg-range-track="">
        {renderChart ? <div className={styles.chart} aria-hidden="true" data-cg-range-chart="">{renderChart(chartContext)}</div> : null}
        <div className={styles.rail} aria-hidden="true" />
        <div className={styles.selection} data-cg-range-selection="" aria-hidden="true" />
        <span
          ref={startRef}
          className={cx(styles.handle, styles.startHandle)}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={startHandleAriaLabel}
          aria-orientation="horizontal"
          aria-disabled={disabled || readOnly || undefined}
          aria-valuemin={model.wireText(startBounds.minimum) as unknown as number}
          aria-valuemax={model.wireText(startBounds.maximum) as unknown as number}
          aria-valuenow={model.wireText(model.start) as unknown as number}
          aria-valuetext={formatWire(model, model.start, 'start')}
          data-cg-range-handle="start"
        />
        <span
          ref={endRef}
          className={cx(styles.handle, styles.endHandle)}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={endHandleAriaLabel}
          aria-orientation="horizontal"
          aria-disabled={disabled || readOnly || undefined}
          aria-valuemin={model.wireText(endBounds.minimum) as unknown as number}
          aria-valuemax={model.wireText(endBounds.maximum) as unknown as number}
          aria-valuenow={model.wireText(model.end) as unknown as number}
          aria-valuetext={formatWire(model, model.end, 'end')}
          data-cg-range-handle="end"
        />
      </div>
      {showMarkers ? <div className={styles.markers} aria-hidden="true">{Array.from({ length: markerCount }, (_, index) => (
        <span
          key={index}
          className={styles.marker}
          style={{ '--cg-range-selector-marker-percent': `${index / (markerCount - 1) * 100}%` } as RangeStyle}
        />
      ))}</div> : null}
    </div>
  );
}

export const CgRangeSelector = forwardRef<HTMLDivElement, CgRangeSelectorProps>(RangeSelectorImplementation) as unknown as {
  (props: CgRangeSelectorProps & RefAttributes<HTMLDivElement>): ReactElement;
  displayName?: string;
};

CgRangeSelector.displayName = 'CgRangeSelector';
