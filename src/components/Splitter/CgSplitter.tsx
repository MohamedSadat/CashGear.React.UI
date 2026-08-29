import {
  Fragment,
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
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useCgId, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import styles from './CgSplitter.module.css';
import type {
  CgSplitterActions,
  CgSplitterInteractionReason,
  CgSplitterPaneCollapsedDetails,
  CgSplitterPaneExpandedDetails,
  CgSplitterPaneResizedDetails,
  CgSplitterPaneResizingDetails,
  CgSplitterProps,
  CgSplitterState,
  CgSplitterStateChangeDetails,
} from './CgSplitter.types';
import {
  freezeSplitterDetails,
  freezeSplitterState,
  normalizeSplitterPanes,
  normalizeSplitterState,
  parseSplitterLength,
} from './splitterState';
import type { NormalizedSplitterPane } from './splitterState';

interface PairLimits {
  minimumDelta: number;
  maximumDelta: number;
  startMinimum: number;
  startMaximum: number;
}

interface ResizeGesture {
  generation: number;
  pointerId: number;
  separator: HTMLSpanElement;
  startKey: string;
  endKey: string;
  startSize: number;
  endSize: number;
  currentStart: number;
  currentEnd: number;
  origin: number;
  limits: PairLimits;
  frame: number;
  notificationTimer: number;
  lastNotificationAt: number;
}

type TrackStyle = CSSProperties & Record<`--cg-${string}`, string | number>;

function pairToken(startKey: string, endKey: string): string {
  return `${startKey}\u0000${endKey}`;
}

function pixelSize(value: number): string {
  return `${Number(Math.max(0, value).toFixed(3))}px`;
}

function requestFrame(callback: FrameRequestCallback): number {
  return typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(() => callback(performance.now()), 0);
}

function cancelFrame(handle: number): void {
  if (!handle) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
  else window.clearTimeout(handle);
}

function flexibleWeight(value: string): number | null {
  const match = /^(\d+(?:\.\d*)?|\.\d+)fr$/u.exec(value);
  if (!match) return null;
  const weight = Number(match[1]);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function stateSize(state: CgSplitterState, key: string, fallback = '1fr'): string {
  return state.panes.find((pane) => pane.key === key)?.size ?? fallback;
}

function stateSignature(state: CgSplitterState): string {
  return `${state.version}|${state.panes.map((pane) => `${pane.key}=${pane.size}`).join('~')}|${state.collapsedPaneKeys.join('~')}`;
}

function paneSignature(panes: ReadonlyArray<NormalizedSplitterPane>): string {
  return panes.map((pane) => [
    pane.key,
    pane.size,
    pane.minimumSize,
    pane.maximumSize ?? '',
    pane.resizable,
    pane.collapsible,
    pane.defaultCollapsed,
    pane.visible,
    pane.hasCollapsedContent,
  ].join(',')).join('~');
}

export const CgSplitter = forwardRef<HTMLDivElement, CgSplitterProps>(function CgSplitter(
  {
    panes,
    orientation = 'horizontal',
    resizeMode = 'live',
    gutterSize = '0.5rem',
    keyboardStep = 10,
    resizeNotificationInterval = 100,
    state,
    defaultState,
    onStateChange,
    onPaneResizing,
    onPaneResized,
    onPaneCollapsed,
    onPaneExpanded,
    disabled = false,
    readOnly = false,
    direction = 'auto',
    actionsRef,
    id,
    className,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    ...nativeProps
  },
  forwardedRef,
) {
  if (orientation !== 'horizontal' && orientation !== 'vertical') throw new Error(`CgSplitter orientation '${String(orientation)}' is not supported.`);
  if (resizeMode !== 'live' && resizeMode !== 'deferred') throw new Error(`CgSplitter resizeMode '${String(resizeMode)}' is not supported.`);
  if (!Number.isFinite(keyboardStep) || keyboardStep <= 0) throw new Error('CgSplitter keyboardStep must be greater than zero.');
  if (!Number.isFinite(resizeNotificationInterval) || resizeNotificationInterval < 0) {
    throw new Error('CgSplitter resizeNotificationInterval must be a finite nonnegative number.');
  }
  const normalizedGutter = parseSplitterLength(gutterSize, 'gutterSize', false, '0.5rem').css;
  if (!ariaLabelledBy && (ariaLabel === '' || (typeof ariaLabel === 'string' && !ariaLabel.trim()))) {
    throw new Error('CgSplitter requires a nonempty aria-label or aria-labelledby.');
  }

  const normalizedPanes = normalizeSplitterPanes(panes);
  const [uncontrolledState, setUncontrolledState] = useState<CgSplitterState>(() => (
    normalizeSplitterState(normalizedPanes, defaultState)
  ));
  const controlled = state !== undefined;
  const currentState = normalizeSplitterState(normalizedPanes, state ?? uncontrolledState);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRootRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedId = useCgId(id);
  const resolvedDirection = useDirection(rootRef, direction);
  const paneRefs = useRef(new Map<string, HTMLElement>());
  const separatorRefs = useRef(new Map<string, HTMLSpanElement>());
  const previewRef = useRef<HTMLDivElement>(null);
  const generationRef = useRef(1);
  const gestureRef = useRef<ResizeGesture | null>(null);
  const ariaFrameRef = useRef(0);
  const mountedRef = useRef(true);
  const stateRef = useRef(currentState);
  const panesRef = useRef(normalizedPanes);
  const controlledRef = useRef(controlled);
  const disabledRef = useRef(disabled);
  const readOnlyRef = useRef(readOnly);
  stateRef.current = currentState;
  panesRef.current = normalizedPanes;
  controlledRef.current = controlled;
  disabledRef.current = disabled;
  readOnlyRef.current = readOnly;

  const notifyState = useStableCallback(onStateChange);
  const notifyResizing = useStableCallback(onPaneResizing);
  const notifyResized = useStableCallback(onPaneResized);
  const notifyCollapsed = useStableCallback(onPaneCollapsed);
  const notifyExpanded = useStableCallback(onPaneExpanded);

  const applyStateToDom = useStableCallback((nextState: CgSplitterState) => {
    const currentPanes = panesRef.current;
    const collapsed = new Set(nextState.collapsedPaneKeys);
    const expanded = currentPanes.filter((pane) => pane.visible && !collapsed.has(pane.key));
    const hasFlexible = expanded.some((pane) => flexibleWeight(stateSize(nextState, pane.key, pane.size)) !== null);
    const remainderKey = hasFlexible ? undefined : expanded.at(-1)?.key;
    for (const pane of currentPanes) {
      const element = paneRefs.current.get(pane.key);
      if (!element) continue;
      const size = stateSize(nextState, pane.key, pane.size);
      const weight = flexibleWeight(size);
      if (collapsed.has(pane.key)) {
        element.style.setProperty('--cg-splitter-pane-grow', '0');
        element.style.setProperty('--cg-splitter-pane-size', pane.hasCollapsedContent ? 'var(--cg-splitter-collapsed-size)' : '0px');
      } else if (weight !== null) {
        element.style.setProperty('--cg-splitter-pane-grow', String(weight));
        element.style.setProperty('--cg-splitter-pane-size', '0px');
      } else {
        element.style.setProperty('--cg-splitter-pane-grow', pane.key === remainderKey ? '1' : '0');
        element.style.setProperty('--cg-splitter-pane-size', size);
      }
    }
  });

  const publishState = useStableCallback((next: CgSplitterState, details: CgSplitterStateChangeDetails): boolean => {
    if (!mountedRef.current || disabledRef.current || readOnlyRef.current) return false;
    if (!controlledRef.current) {
      stateRef.current = next;
      setUncontrolledState(next);
    }
    notifyState(next, freezeSplitterDetails(details));
    if (controlledRef.current) {
      const generation = generationRef.current;
      queueMicrotask(() => {
        if (mountedRef.current && generationRef.current === generation) applyStateToDom(stateRef.current);
      });
    }
    return true;
  });

  const findPane = useStableCallback((key: string): NormalizedSplitterPane => {
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    if (!normalizedKey) throw new Error('CgSplitter action requires a pane key.');
    const pane = panesRef.current.find((candidate) => candidate.key === normalizedKey);
    if (!pane) throw new Error(`CgSplitter pane '${normalizedKey}' does not exist.`);
    return pane;
  });

  const setCollapsed = useStableCallback((key: string, collapsed: boolean, reason: CgSplitterInteractionReason): boolean => {
    if (!mountedRef.current || disabledRef.current || readOnlyRef.current) return false;
    const pane = findPane(key);
    if (!pane.collapsible) throw new Error(`CgSplitter pane '${pane.key}' is not collapsible.`);
    const current = stateRef.current;
    const collapsedKeys = new Set(current.collapsedPaneKeys);
    if (collapsedKeys.has(pane.key) === collapsed) return true;
    if (collapsed && pane.visible) {
      const expandedVisible = panesRef.current.filter((candidate) => candidate.visible && !collapsedKeys.has(candidate.key));
      if (expandedVisible.length <= 1) throw new Error('CgSplitter requires at least one visible pane to remain expanded.');
    }
    const rememberedSize = stateSize(current, pane.key, pane.size);
    if (collapsed) collapsedKeys.add(pane.key); else collapsedKeys.delete(pane.key);
    const next = freezeSplitterState(
      current.panes,
      panesRef.current.filter((candidate) => collapsedKeys.has(candidate.key)).map((candidate) => candidate.key),
    );
    if (collapsed) {
      const details = freezeSplitterDetails<CgSplitterPaneCollapsedDetails>({ paneKey: pane.key, previousSize: rememberedSize, reason });
      pane.descriptor.onCollapsedChange?.(true, details);
      if (!publishState(next, { operation: 'collapse', reason, paneKey: pane.key })) return false;
      notifyCollapsed(details);
    } else {
      const details = freezeSplitterDetails<CgSplitterPaneExpandedDetails>({ paneKey: pane.key, restoredSize: rememberedSize, reason });
      pane.descriptor.onCollapsedChange?.(false, details);
      if (!publishState(next, { operation: 'expand', reason, paneKey: pane.key })) return false;
      notifyExpanded(details);
    }
    return true;
  });

  const collapsePane = useStableCallback((key: string) => setCollapsed(key, true, 'programmatic'));
  const expandPane = useStableCallback((key: string) => setCollapsed(key, false, 'programmatic'));
  const togglePane = useStableCallback((key: string) => {
    const pane = findPane(key);
    return setCollapsed(pane.key, !stateRef.current.collapsedPaneKeys.includes(pane.key), 'programmatic');
  });
  const reset = useStableCallback(() => {
    if (!mountedRef.current || disabledRef.current || readOnlyRef.current) return false;
    const next = normalizeSplitterState(panesRef.current);
    return publishState(next, { operation: 'reset', reason: 'programmatic' });
  });
  const setPaneSize = useStableCallback((key: string, size: number | string) => {
    if (!mountedRef.current || disabledRef.current || readOnlyRef.current) return false;
    const pane = findPane(key);
    const normalizedSize = parseSplitterLength(size, `pane '${pane.key}' size`, true, '1fr').css;
    const current = stateRef.current;
    const next = freezeSplitterState(
      current.panes.map((item) => item.key === pane.key ? { key: item.key, size: normalizedSize } : item),
      current.collapsedPaneKeys,
    );
    if (!publishState(next, { operation: 'setPaneSize', reason: 'programmatic', paneKey: pane.key })) return false;
    const visible = panesRef.current.filter((candidate) => candidate.visible);
    const index = visible.findIndex((candidate) => candidate.key === pane.key);
    const adjacent = visible[index + 1] ?? visible[index - 1];
    if (adjacent) {
      const start = index > 0 && visible[index + 1] === undefined ? adjacent : pane;
      const end = start === pane ? adjacent : pane;
      notifyResized(freezeSplitterDetails<CgSplitterPaneResizedDetails>({
        startPaneKey: start.key,
        endPaneKey: end.key,
        previousStartPaneSizePixels: null,
        previousEndPaneSizePixels: null,
        startPaneSizePixels: null,
        endPaneSizePixels: null,
        reason: 'programmatic',
      }));
    }
    return true;
  });

  const focusSeparator = useStableCallback((startPaneKey: string, endPaneKey: string): boolean => {
    const start = findPane(startPaneKey);
    const end = findPane(endPaneKey);
    const separator = separatorRefs.current.get(pairToken(start.key, end.key));
    if (!separator) return false;
    separator.focus({ preventScroll: true });
    return true;
  });
  const focus = useStableCallback(() => rootRef.current?.focus({ preventScroll: true }));
  const actions = useMemo<CgSplitterActions>(() => Object.freeze({
    focus,
    focusSeparator,
    getState: () => stateRef.current,
    reset,
    collapsePane,
    expandPane,
    togglePane,
    setPaneSize,
  }), [collapsePane, expandPane, focus, focusSeparator, reset, setPaneSize, togglePane]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const axisSize = useStableCallback((element: HTMLElement): number => {
    const rectangle = element.getBoundingClientRect();
    return orientation === 'horizontal' ? rectangle.width : rectangle.height;
  });
  const resolveLength = useStableCallback((element: HTMLElement, value: string, fallback: number): number => {
    if (!value || value === 'none') return fallback;
    if (/^-?(?:\d+(?:\.\d*)?|\.\d+)px$/u.test(value.trim())) {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    const root = rootRef.current;
    if (!root) return fallback;
    const probe = document.createElement('span');
    const computed = getComputedStyle(element);
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.boxSizing = 'border-box';
    probe.style.font = computed.font;
    if (orientation === 'horizontal') { probe.style.width = value; probe.style.height = '0'; }
    else { probe.style.height = value; probe.style.width = '0'; }
    root.append(probe);
    const resolved = axisSize(probe);
    probe.remove();
    return Number.isFinite(resolved) ? resolved : fallback;
  });
  const calculateLimits = useStableCallback((start: HTMLElement, end: HTMLElement, startSize: number, endSize: number): PairLimits => {
    const startStyle = getComputedStyle(start);
    const endStyle = getComputedStyle(end);
    const startMinimumText = orientation === 'horizontal' ? startStyle.minWidth : startStyle.minHeight;
    const startMaximumText = orientation === 'horizontal' ? startStyle.maxWidth : startStyle.maxHeight;
    const endMinimumText = orientation === 'horizontal' ? endStyle.minWidth : endStyle.minHeight;
    const endMaximumText = orientation === 'horizontal' ? endStyle.maxWidth : endStyle.maxHeight;
    const startMinimum = resolveLength(start, startMinimumText, 0);
    const startMaximum = Math.max(startMinimum, resolveLength(start, startMaximumText, Number.POSITIVE_INFINITY));
    const endMinimum = resolveLength(end, endMinimumText, 0);
    const endMaximum = Math.max(endMinimum, resolveLength(end, endMaximumText, Number.POSITIVE_INFINITY));
    const minimumDelta = Math.max(startMinimum - startSize, endSize - endMaximum);
    const maximumDelta = Math.min(startMaximum - startSize, endSize - endMinimum);
    if (minimumDelta > maximumDelta) {
      return { minimumDelta: 0, maximumDelta: 0, startMinimum: startSize, startMaximum: startSize };
    }
    return {
      minimumDelta,
      maximumDelta,
      startMinimum: startSize + minimumDelta,
      startMaximum: startSize + maximumDelta,
    };
  });

  const updateSeparatorAria = useStableCallback((
    separator: HTMLSpanElement,
    startSize: number,
    endSize: number,
    limits: PairLimits,
  ) => {
    separator.setAttribute('aria-valuemin', String(Math.round(limits.startMinimum)));
    separator.setAttribute('aria-valuemax', String(Math.round(limits.startMaximum)));
    separator.setAttribute('aria-valuenow', String(Math.round(startSize)));
    separator.setAttribute('aria-valuetext', `${Math.round(startSize)} pixels; adjacent pane ${Math.round(endSize)} pixels`);
  });
  const measureAria = useStableCallback(() => {
    for (const [token, separator] of separatorRefs.current) {
      const [startKey = '', endKey = ''] = token.split('\u0000');
      const start = paneRefs.current.get(startKey);
      const end = paneRefs.current.get(endKey);
      if (!start || !end) continue;
      const startSize = axisSize(start);
      const endSize = axisSize(end);
      updateSeparatorAria(separator, startSize, endSize, calculateLimits(start, end, startSize, endSize));
    }
  });
  const scheduleAria = useStableCallback(() => {
    if (ariaFrameRef.current) return;
    ariaFrameRef.current = requestFrame(() => {
      ariaFrameRef.current = 0;
      if (mountedRef.current) measureAria();
    });
  });

  const hidePreview = useStableCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    delete preview.dataset.cgVisible;
    preview.style.removeProperty('inset-inline-start');
    preview.style.removeProperty('inset-block-start');
  });
  const setPixelPair = useStableCallback((gesture: ResizeGesture) => {
    const start = paneRefs.current.get(gesture.startKey);
    const end = paneRefs.current.get(gesture.endKey);
    if (!start || !end) return;
    start.style.setProperty('--cg-splitter-pane-grow', '0');
    start.style.setProperty('--cg-splitter-pane-size', pixelSize(gesture.currentStart));
    end.style.setProperty('--cg-splitter-pane-grow', '0');
    end.style.setProperty('--cg-splitter-pane-size', pixelSize(gesture.currentEnd));
  });
  const clearGestureWork = useStableCallback((gesture: ResizeGesture) => {
    cancelFrame(gesture.frame);
    gesture.frame = 0;
    if (gesture.notificationTimer) window.clearTimeout(gesture.notificationTimer);
    gesture.notificationTimer = 0;
    hidePreview();
    gesture.separator.parentElement?.removeAttribute('data-cg-active');
  });
  const cancelGesture = useStableCallback((restore = true) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    clearGestureWork(gesture);
    try { gesture.separator.releasePointerCapture?.(gesture.pointerId); } catch { /* Already released. */ }
    if (restore) applyStateToDom(stateRef.current);
    scheduleAria();
  });

  const commitResize = useStableCallback((gesture: ResizeGesture, reason: CgSplitterInteractionReason): boolean => {
    if (gesture.generation !== generationRef.current || disabledRef.current || readOnlyRef.current) {
      applyStateToDom(stateRef.current);
      return false;
    }
    setPixelPair(gesture);
    updateSeparatorAria(gesture.separator, gesture.currentStart, gesture.currentEnd, gesture.limits);
    const resizing = freezeSplitterDetails<CgSplitterPaneResizingDetails>({
      startPaneKey: gesture.startKey,
      endPaneKey: gesture.endKey,
      startPaneSizePixels: gesture.currentStart,
      endPaneSizePixels: gesture.currentEnd,
      deltaPixels: gesture.currentStart - gesture.startSize,
      reason,
    });
    notifyResizing(resizing);
    const current = stateRef.current;
    const next = freezeSplitterState(
      current.panes.map((pane) => pane.key === gesture.startKey
        ? { key: pane.key, size: pixelSize(gesture.currentStart) }
        : pane.key === gesture.endKey
          ? { key: pane.key, size: pixelSize(gesture.currentEnd) }
          : pane),
      current.collapsedPaneKeys,
    );
    if (!publishState(next, {
      operation: 'resize',
      reason,
      startPaneKey: gesture.startKey,
      endPaneKey: gesture.endKey,
    })) return false;
    notifyResized(freezeSplitterDetails<CgSplitterPaneResizedDetails>({
      startPaneKey: gesture.startKey,
      endPaneKey: gesture.endKey,
      previousStartPaneSizePixels: gesture.startSize,
      previousEndPaneSizePixels: gesture.endSize,
      startPaneSizePixels: gesture.currentStart,
      endPaneSizePixels: gesture.currentEnd,
      reason,
    }));
    return true;
  });

  const resizeInteractive = useStableCallback((startKey: string, endKey: string): boolean => {
    const currentPanes = panesRef.current;
    const start = currentPanes.find((pane) => pane.key === startKey);
    const end = currentPanes.find((pane) => pane.key === endKey);
    const collapsed = stateRef.current.collapsedPaneKeys;
    return Boolean(start && end && !disabledRef.current && !readOnlyRef.current
      && start.resizable && end.resizable
      && !collapsed.includes(start.key) && !collapsed.includes(end.key));
  });
  const collapseTarget = useStableCallback((startKey: string, endKey: string): NormalizedSplitterPane | undefined => {
    const currentPanes = panesRef.current;
    const start = currentPanes.find((pane) => pane.key === startKey);
    const end = currentPanes.find((pane) => pane.key === endKey);
    const collapsed = stateRef.current.collapsedPaneKeys;
    if (start?.collapsible && collapsed.includes(start.key)) return start;
    if (end?.collapsible && collapsed.includes(end.key)) return end;
    if (start?.collapsible) return start;
    if (end?.collapsible) return end;
    return undefined;
  });

  const onPointerDown = (event: ReactPointerEvent<HTMLSpanElement>, startKey: string, endKey: string) => {
    if (event.button !== 0 || gestureRef.current || !resizeInteractive(startKey, endKey)) return;
    const start = paneRefs.current.get(startKey);
    const end = paneRefs.current.get(endKey);
    if (!start || !end) return;
    const startSize = axisSize(start);
    const endSize = axisSize(end);
    const separator = event.currentTarget;
    const gesture: ResizeGesture = {
      generation: generationRef.current,
      pointerId: event.pointerId,
      separator,
      startKey,
      endKey,
      startSize,
      endSize,
      currentStart: startSize,
      currentEnd: endSize,
      origin: orientation === 'horizontal' ? event.clientX : event.clientY,
      limits: calculateLimits(start, end, startSize, endSize),
      frame: 0,
      notificationTimer: 0,
      lastNotificationAt: 0,
    };
    gestureRef.current = gesture;
    separator.parentElement?.setAttribute('data-cg-active', '');
    try { separator.setPointerCapture?.(event.pointerId); } catch { /* Unsupported capture is nonfatal. */ }
    event.preventDefault();
  };
  const sendIntermediate = useStableCallback((gesture: ResizeGesture) => {
    gesture.lastNotificationAt = performance.now();
    notifyResizing(freezeSplitterDetails<CgSplitterPaneResizingDetails>({
      startPaneKey: gesture.startKey,
      endPaneKey: gesture.endKey,
      startPaneSizePixels: gesture.currentStart,
      endPaneSizePixels: gesture.currentEnd,
      deltaPixels: gesture.currentStart - gesture.startSize,
      reason: 'pointer',
    }));
  });
  const scheduleIntermediate = useStableCallback((gesture: ResizeGesture) => {
    if (!onPaneResizing || resizeNotificationInterval <= 0) return;
    const elapsed = performance.now() - gesture.lastNotificationAt;
    if (elapsed >= resizeNotificationInterval) { sendIntermediate(gesture); return; }
    if (gesture.notificationTimer) return;
    gesture.notificationTimer = window.setTimeout(() => {
      gesture.notificationTimer = 0;
      if (gestureRef.current === gesture && gesture.generation === generationRef.current) sendIntermediate(gesture);
    }, resizeNotificationInterval - elapsed);
  });
  const onPointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const physicalDelta = (orientation === 'horizontal' ? event.clientX : event.clientY) - gesture.origin;
    const logicalDelta = orientation === 'horizontal' && resolvedDirection === 'rtl' ? -physicalDelta : physicalDelta;
    const delta = Math.min(Math.max(logicalDelta, gesture.limits.minimumDelta), gesture.limits.maximumDelta);
    gesture.currentStart = gesture.startSize + delta;
    gesture.currentEnd = gesture.endSize - delta;
    if (resizeMode === 'live') {
      if (!gesture.frame) gesture.frame = requestFrame(() => {
        gesture.frame = 0;
        if (gestureRef.current === gesture && gesture.generation === generationRef.current) {
          setPixelPair(gesture);
          updateSeparatorAria(gesture.separator, gesture.currentStart, gesture.currentEnd, gesture.limits);
        }
      });
    } else {
      const preview = previewRef.current;
      const root = rootRef.current;
      const gutter = gesture.separator.parentElement;
      if (preview && root && gutter) {
        const rootRect = root.getBoundingClientRect();
        const gutterRect = gutter.getBoundingClientRect();
        const physicalClamped = orientation === 'horizontal' && resolvedDirection === 'rtl' ? -delta : delta;
        if (orientation === 'horizontal') preview.style.insetInlineStart = `${gutterRect.left - rootRect.left + physicalClamped}px`;
        else preview.style.insetBlockStart = `${gutterRect.top - rootRect.top + physicalClamped}px`;
        preview.dataset.cgVisible = '';
      }
    }
    scheduleIntermediate(gesture);
    event.preventDefault();
  };
  const endPointer = (event: ReactPointerEvent<HTMLSpanElement>, commit: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    clearGestureWork(gesture);
    try { gesture.separator.releasePointerCapture?.(gesture.pointerId); } catch { /* Already released. */ }
    if (commit) commitResize(gesture, 'pointer');
    else applyStateToDom(stateRef.current);
    scheduleAria();
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLSpanElement>, startKey: string, endKey: string) => {
    if (disabledRef.current || readOnlyRef.current) return;
    if (event.key === 'Enter') {
      const target = collapseTarget(startKey, endKey);
      if (!target) return;
      setCollapsed(target.key, !stateRef.current.collapsedPaneKeys.includes(target.key), 'keyboard');
      event.preventDefault();
      return;
    }
    if (!resizeInteractive(startKey, endKey)) return;
    const start = paneRefs.current.get(startKey);
    const end = paneRefs.current.get(endKey);
    if (!start || !end) return;
    const startSize = axisSize(start);
    const endSize = axisSize(end);
    const limits = calculateLimits(start, end, startSize, endSize);
    const step = keyboardStep * (event.shiftKey ? 10 : 1);
    let logicalDelta: number | null = null;
    if (event.key === 'Home') logicalDelta = limits.minimumDelta;
    else if (event.key === 'End') logicalDelta = limits.maximumDelta;
    else if (orientation === 'horizontal' && event.key === 'ArrowLeft') logicalDelta = resolvedDirection === 'rtl' ? step : -step;
    else if (orientation === 'horizontal' && event.key === 'ArrowRight') logicalDelta = resolvedDirection === 'rtl' ? -step : step;
    else if (orientation === 'vertical' && event.key === 'ArrowUp') logicalDelta = -step;
    else if (orientation === 'vertical' && event.key === 'ArrowDown') logicalDelta = step;
    if (logicalDelta === null) return;
    const delta = Math.min(Math.max(logicalDelta, limits.minimumDelta), limits.maximumDelta);
    commitResize({
      generation: generationRef.current,
      pointerId: -1,
      separator: event.currentTarget,
      startKey,
      endKey,
      startSize,
      endSize,
      currentStart: startSize + delta,
      currentEnd: endSize - delta,
      origin: 0,
      limits,
      frame: 0,
      notificationTimer: 0,
      lastNotificationAt: 0,
    }, 'keyboard');
    event.preventDefault();
  };

  const configurationKey = `${orientation}|${resizeMode}|${keyboardStep}|${resizeNotificationInterval}|${disabled}|${readOnly}|${paneSignature(normalizedPanes)}`;
  const currentStateKey = stateSignature(currentState);
  useLayoutEffect(() => {
    generationRef.current += 1;
    cancelGesture(true);
    applyStateToDom(stateRef.current);
    scheduleAria();
  }, [applyStateToDom, cancelGesture, configurationKey, currentStateKey, scheduleAria]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    let previousWidth = root.clientWidth;
    let previousHeight = root.clientHeight;
    const observer = new ResizeObserver((entries) => {
      const rectangle = entries.find((entry) => entry.target === root)?.contentRect ?? root.getBoundingClientRect();
      const changed = orientation === 'horizontal'
        ? Math.abs(rectangle.width - previousWidth) > 0.5
        : Math.abs(rectangle.height - previousHeight) > 0.5;
      previousWidth = rectangle.width;
      previousHeight = rectangle.height;
      if (changed && gestureRef.current) cancelGesture(true);
      scheduleAria();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [cancelGesture, orientation, scheduleAria]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      cancelGesture(false);
      cancelFrame(ariaFrameRef.current);
      ariaFrameRef.current = 0;
    };
  }, [cancelGesture]);

  const collapsed = new Set(currentState.collapsedPaneKeys);
  const visiblePanes = normalizedPanes.filter((pane) => pane.visible);
  const expandedPanes = visiblePanes.filter((pane) => !collapsed.has(pane.key));
  const hasFlexible = expandedPanes.some((pane) => flexibleWeight(stateSize(currentState, pane.key, pane.size)) !== null);
  const remainderKey = hasFlexible ? undefined : expandedPanes.at(-1)?.key;
  const rootStyle = {
    ...style,
    '--cg-splitter-gutter-size': normalizedGutter,
  } as TrackStyle;

  return (
    <div
      {...nativeProps}
      ref={mergedRootRef}
      id={resolvedId}
      className={cx(styles.root, className)}
      style={rootStyle}
      role="group"
      aria-label={ariaLabelledBy ? ariaLabel : ariaLabel ?? 'Resizable layout'}
      aria-labelledby={ariaLabelledBy}
      aria-disabled={disabled}
      tabIndex={-1}
      dir={direction === 'auto' ? undefined : direction}
      data-cg-splitter=""
      data-orientation={orientation}
      data-resize-mode={resizeMode}
      data-readonly={readOnly ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
    >
      {visiblePanes.map((pane, visibleIndex) => {
        const paneStateSize = stateSize(currentState, pane.key, pane.size);
        const isCollapsed = collapsed.has(pane.key);
        const weight = flexibleWeight(paneStateSize);
        const paneId = pane.descriptor.id?.trim() || `${resolvedId}-pane-${normalizedPanes.indexOf(pane) + 1}`;
        const trackStyle = {
          ...pane.style,
          '--cg-splitter-pane-grow': isCollapsed ? 0 : weight ?? (pane.key === remainderKey ? 1 : 0),
          '--cg-splitter-pane-size': isCollapsed
            ? pane.hasCollapsedContent ? 'var(--cg-splitter-collapsed-size)' : '0px'
            : weight === null ? paneStateSize : '0px',
          '--cg-splitter-pane-min': pane.minimumSize,
          '--cg-splitter-pane-max': pane.maximumSize ?? 'none',
        } as TrackStyle;
        const context = Object.freeze({
          descriptor: pane.descriptor,
          key: pane.key,
          index: normalizedPanes.indexOf(pane),
          size: paneStateSize,
          collapsed: isCollapsed,
          disabled,
          readOnly,
          paneId,
          actions,
        });
        const next = visiblePanes[visibleIndex + 1];
        const canResize = next ? resizeInteractive(pane.key, next.key) : false;
        const canCollapse = next ? Boolean(collapseTarget(pane.key, next.key)) && !disabled && !readOnly : false;
        return (
          <Fragment key={pane.key}>
            <section
              {...pane.dataAttributes}
              ref={(element) => {
                if (element) paneRefs.current.set(pane.key, element);
                else paneRefs.current.delete(pane.key);
              }}
              id={paneId}
              className={cx(styles.pane, isCollapsed && styles.collapsedPane, pane.descriptor.className)}
              style={trackStyle}
              aria-label={pane.descriptor.ariaLabel}
              data-cg-splitter-pane={pane.key}
              data-cg-collapsed={isCollapsed ? 'true' : 'false'}
              data-cg-resizable={pane.resizable ? 'true' : 'false'}
              data-cg-collapsible={pane.collapsible ? 'true' : 'false'}
              data-cg-has-collapsed-content={pane.hasCollapsedContent ? 'true' : 'false'}
            >
              {isCollapsed
                ? pane.hasCollapsedContent && <div className={styles.collapsedContent}>{pane.descriptor.renderCollapsed?.(context)}</div>
                : <>
                    {pane.descriptor.renderHeader && <header className={styles.header}>{pane.descriptor.renderHeader(context)}</header>}
                    <div className={styles.content}>{pane.descriptor.renderContent(context)}</div>
                  </>}
            </section>
            {next && <div className={styles.gutter} data-cg-splitter-gutter="">
              <span
                ref={(element) => {
                  const token = pairToken(pane.key, next.key);
                  if (element) separatorRefs.current.set(token, element);
                  else separatorRefs.current.delete(token);
                }}
                role="separator"
                className={styles.separator}
                tabIndex={canResize || canCollapse ? 0 : -1}
                aria-label={`Resize ${pane.descriptor.ariaLabel ?? pane.key} and ${next.descriptor.ariaLabel ?? next.key}`}
                aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
                aria-controls={`${paneId} ${next.descriptor.id?.trim() || `${resolvedId}-pane-${normalizedPanes.indexOf(next) + 1}`}`}
                aria-disabled={!(canResize || canCollapse)}
                data-cg-start-key={pane.key}
                data-cg-end-key={next.key}
                onPointerDown={(event) => onPointerDown(event, pane.key, next.key)}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endPointer(event, true)}
                onPointerCancel={(event) => endPointer(event, false)}
                onLostPointerCapture={(event) => endPointer(event, false)}
                onKeyDown={(event) => onKeyDown(event, pane.key, next.key)}
              />
            </div>}
          </Fragment>
        );
      })}
      <div ref={previewRef} className={styles.preview} data-cg-splitter-preview="" aria-hidden="true" />
    </div>
  );
});
