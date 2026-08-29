/* eslint-disable react-hooks/refs -- refs own tooltip generations, ARIA tokens, timers, and imperative visibility snapshots. */
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, FocusEvent as ReactFocusEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useStableCallback } from '../../hooks';
import { useOverlaySurface } from '../../internal/overlayStack';
import { PositionedOverlay } from '../../internal/PositionedOverlay';
import type { PositionedOverlayPlacement, PositionedOverlayPositionDetails } from '../../internal/PositionedOverlay';
import { cx } from '../../utils';
import styles from './CgTooltip.module.css';
import type {
  CgTooltipActions,
  CgTooltipHiddenDetails,
  CgTooltipPosition,
  CgTooltipProps,
  CgTooltipShownDetails,
  CgTooltipVisibilityChangeReason,
} from './CgTooltip.types';

function assertDelay(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`CgTooltip ${name} must be a finite nonnegative number.`);
}

function addToken(element: HTMLElement, attribute: string, token: string): void {
  const tokens = (element.getAttribute(attribute) ?? '').split(/\s+/u).filter(Boolean);
  if (!tokens.includes(token)) element.setAttribute(attribute, [...tokens, token].join(' '));
}

function removeToken(element: HTMLElement, attribute: string, token: string): void {
  const tokens = (element.getAttribute(attribute) ?? '').split(/\s+/u).filter((item) => item && item !== token);
  if (tokens.length) element.setAttribute(attribute, tokens.join(' '));
  else element.removeAttribute(attribute);
}

function logicalPlacements(position: CgTooltipPosition, rtl: boolean): ReadonlyArray<PositionedOverlayPlacement> {
  const end = rtl ? 'left' : 'right';
  const start = rtl ? 'right' : 'left';
  if (position === 'auto') return ['top', 'bottom', end, start];
  if (position === 'start') return [start, end];
  if (position === 'end') return [end, start];
  return position === 'top' ? ['top', 'bottom'] : ['bottom', 'top'];
}

export function CgTooltip({
  children,
  text,
  renderContent,
  visible,
  defaultVisible = false,
  onVisibleChange,
  trigger = 'hover-focus',
  position = 'auto',
  openDelay = 400,
  closeDelay = 100,
  disabled = false,
  interactive = false,
  showArrow = true,
  maxWidth = '20rem',
  gap = 8,
  accessibleLabel,
  surfaceId,
  surfaceClassName,
  surfaceStyle,
  surfaceAttributes,
  onShown,
  onHidden,
  actionsRef,
}: CgTooltipProps) {
  assertDelay('openDelay', openDelay);
  assertDelay('closeDelay', closeDelay);
  assertDelay('gap', gap);
  if (accessibleLabel !== undefined && !accessibleLabel.trim()) throw new Error('CgTooltip accessibleLabel cannot be empty.');
  if (surfaceId !== undefined && !surfaceId.trim()) throw new Error('CgTooltip surfaceId cannot be empty.');
  const generatedId = useId();
  const id = surfaceId ?? `cg-tooltip-${generatedId.replace(/:/gu, '')}`;
  const controlled = visible !== undefined;
  const [internalVisible, setInternalVisible] = useState(defaultVisible);
  const authoritative = controlled ? Boolean(visible) : internalVisible;
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const displayed = !disabled && (optimistic ?? authoritative);
  const displayedRef = useRef(displayed);
  displayedRef.current = displayed;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const describedRef = useRef<HTMLElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconcileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generationRef = useRef(0);
  const [revision, setRevision] = useState(0);
  const [rtl, setRtl] = useState(false);
  const [placed, setPlaced] = useState<Exclude<CgTooltipPosition, 'auto'>>('top');
  const shownRef = useRef(false);
  const hiddenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placedRef = useRef<Exclude<CgTooltipPosition, 'auto'>>('top');
  const everMountedRef = useRef(false);
  const reasonRef = useRef<CgTooltipVisibilityChangeReason>('manual');
  const boundaryRefs = useMemo(() => [wrapperRef], []);

  const clearTimer = useStableCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  });

  const associate = useStableCallback((element: HTMLElement | null) => {
    if (describedRef.current === element) return;
    if (describedRef.current) removeToken(describedRef.current, 'aria-describedby', id);
    describedRef.current = element;
    if (element) addToken(element, 'aria-describedby', id);
  });

  const request = useStableCallback(async (next: boolean, reason: CgTooltipVisibilityChangeReason, event?: Event): Promise<boolean> => {
    if (next && disabled) return false;
    const previous = displayedRef.current;
    if (previous === next) return true;
    const generation = ++generationRef.current;
    reasonRef.current = reason;
    const details = Object.freeze({ visible: next, previousVisible: previous, reason, ...(event ? { event } : {}) });
    let callbackResult: void | boolean;
    try { callbackResult = await onVisibleChange?.(next, details); } catch { callbackResult = false; }
    if (generation !== generationRef.current || callbackResult === false) return false;
    if (controlled) {
      setOptimistic(next);
      if (reconcileTimerRef.current !== null) clearTimeout(reconcileTimerRef.current);
      reconcileTimerRef.current = setTimeout(() => {
        reconcileTimerRef.current = null;
        if (generation !== generationRef.current) return;
        setOptimistic(null);
      }, 0);
    } else {
      setInternalVisible(next);
    }
    return true;
  });

  const schedule = useStableCallback((next: boolean, reason: CgTooltipVisibilityChangeReason, event?: Event) => {
    clearTimer();
    const delay = next ? openDelay : closeDelay;
    if (delay === 0) { void request(next, reason, event); return; }
    timerRef.current = setTimeout(() => { timerRef.current = null; void request(next, reason, event); }, delay);
  });

  const selectAnchor = useStableCallback((target: EventTarget | null) => {
    const raw = target instanceof HTMLElement ? target : wrapperRef.current;
    const interactiveTarget = raw?.closest<HTMLElement>('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const element = interactiveTarget && wrapperRef.current?.contains(interactiveTarget) ? interactiveTarget : raw;
    if (!element || !wrapperRef.current?.contains(element)) return;
    anchorRef.current = element;
    if (displayedRef.current) associate(element);
    setRtl(getComputedStyle(element).direction === 'rtl');
    setRevision((value) => value + 1);
  });

  const inInteractiveBoundary = (target: EventTarget | null) => target instanceof Node
    && (wrapperRef.current?.contains(target) || (interactive && surfaceRef.current?.contains(target)));

  const handlePointerOver = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (trigger !== 'hover-focus' || disabled) return;
    selectAnchor(event.target);
    schedule(true, 'hover', event.nativeEvent);
  };
  const handlePointerOut = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (trigger === 'hover-focus' && !inInteractiveBoundary(event.relatedTarget)) schedule(false, 'hover', event.nativeEvent);
  };
  const handleFocus = (event: ReactFocusEvent<HTMLSpanElement>) => {
    if (trigger !== 'hover-focus' || disabled) return;
    selectAnchor(event.target);
    schedule(true, 'focus', event.nativeEvent);
  };
  const handleBlur = (event: ReactFocusEvent<HTMLSpanElement>) => {
    if (trigger === 'hover-focus' && !inInteractiveBoundary(event.relatedTarget)) schedule(false, 'focus', event.nativeEvent);
  };
  const handleClick = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (trigger !== 'click' || disabled) return;
    selectAnchor(event.target);
    void request(!displayedRef.current, 'click', event.nativeEvent);
  };

  const stack = useOverlaySurface({
    active: displayed && trigger === 'click',
    kind: 'transient',
    elementRef: surfaceRef,
    boundaryRefs,
    onEscape: (event) => { void request(false, 'escape', event); },
    onOutside: (event) => { void request(false, 'outside', event); },
  });

  useLayoutEffect(() => {
    if (!displayed) {
      associate(null);
      return;
    }
    everMountedRef.current = true;
    if (!anchorRef.current) {
      anchorRef.current = wrapperRef.current;
      setRevision((value) => value + 1);
    }
    associate(anchorRef.current);
  }, [associate, displayed]);

  useEffect(() => {
    if (!disabled || !displayedRef.current) return;
    clearTimer();
    void request(false, 'disabled');
  }, [clearTimer, disabled, request]);

  useEffect(() => {
    if (hiddenTimerRef.current !== null) clearTimeout(hiddenTimerRef.current);
    hiddenTimerRef.current = null;
    if (displayed || !everMountedRef.current || !shownRef.current) return;
    const generation = generationRef.current;
    hiddenTimerRef.current = setTimeout(() => {
      hiddenTimerRef.current = null;
      if (generation !== generationRef.current || displayedRef.current || !shownRef.current) return;
      shownRef.current = false;
      onHidden?.(Object.freeze<CgTooltipHiddenDetails>({ reason: reasonRef.current }));
      associate(null);
    }, 0);
  }, [associate, displayed, onHidden]);

  useEffect(() => () => {
    generationRef.current += 1;
    clearTimer();
    if (reconcileTimerRef.current !== null) clearTimeout(reconcileTimerRef.current);
    if (hiddenTimerRef.current !== null) clearTimeout(hiddenTimerRef.current);
    associate(null);
  }, [associate, clearTimer]);

  const placements = useMemo(() => logicalPlacements(position, rtl), [position, rtl]);
  const emitShown = useCallback(() => {
    if (shownRef.current || !displayedRef.current) return;
    if (controlled && visible !== true) return;
    shownRef.current = true;
    onShown?.(Object.freeze<CgTooltipShownDetails>({ reason: reasonRef.current, position: placedRef.current }));
  }, [controlled, onShown, visible]);
  const handlePositioned = useCallback((details: PositionedOverlayPositionDetails) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const x = Math.max(8, Math.min(details.width - 8, details.anchor.left + details.anchor.width / 2 - details.left));
    const y = Math.max(8, Math.min(details.height - 8, details.anchor.top + details.anchor.height / 2 - details.top));
    surface.style.setProperty('--cg-tooltip-arrow-x', `${x}px`);
    surface.style.setProperty('--cg-tooltip-arrow-y', `${y}px`);
    const logical = details.side === 'left' ? (rtl ? 'end' : 'start') : details.side === 'right' ? (rtl ? 'start' : 'end') : details.side;
    placedRef.current = logical;
    setPlaced((current) => current === logical ? current : logical);
    emitShown();
  }, [emitShown, rtl]);
  const handleReady = useCallback((ready: boolean) => {
    if (ready) emitShown();
  }, [emitShown]);
  const reposition = useStableCallback(() => setRevision((value) => value + 1));
  const actions = useMemo<CgTooltipActions>(() => Object.freeze({
    show: () => request(true, 'manual'),
    hide: () => request(false, 'manual'),
    toggle: () => request(!displayedRef.current, 'manual'),
    reposition,
    getVisible: () => displayedRef.current,
  }), [reposition, request]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const renderContext = Object.freeze({ visible: displayed, id, position, trigger });
  const content = renderContent ? renderContent(renderContext) : text;
  const { onPointerEnter: _ownedEnter, onPointerLeave: _ownedLeave, onFocus: _ownedFocus, onBlur: _ownedBlur, ...safeSurfaceAttributes } = surfaceAttributes ?? {};
  const computedStyle = { ...surfaceStyle, maxWidth } as CSSProperties;

  return <>
    <span
      ref={wrapperRef}
      className={styles.target}
      data-cg-tooltip-target=""
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onClick={handleClick}
    >{children}</span>
    {displayed ? <PositionedOverlay
      {...safeSurfaceAttributes}
      ref={surfaceRef}
      anchorRef={anchorRef}
      contextRef={wrapperRef}
      id={id}
      role="tooltip"
      aria-label={accessibleLabel}
      className={cx(styles.surface, interactive && styles.interactive, surfaceClassName)}
      style={computedStyle}
      placement={placements[0]}
      placementCandidates={placements}
      widthMode="content"
      maxWidth={maxWidth}
      maxHeight="calc(100vh - 8px)"
      offset={gap}
      revision={revision}
      scrollable={false}
      data-cg-tooltip-surface=""
      data-side={placed === 'start' ? (rtl ? 'right' : 'left') : placed === 'end' ? (rtl ? 'left' : 'right') : placed}
      data-cg-overlay-id={trigger === 'click' ? stack.id : undefined}
      onPositioned={handlePositioned}
      onReadyChange={handleReady}
      onAnchorLost={() => { void request(false, 'targetLost'); }}
      onPointerEnter={interactive && trigger === 'hover-focus' ? () => clearTimer() : undefined}
      onPointerLeave={interactive && trigger === 'hover-focus' ? (event) => { if (!inInteractiveBoundary(event.relatedTarget)) schedule(false, 'hover', event.nativeEvent); } : undefined}
      onFocus={interactive && trigger === 'hover-focus' ? () => clearTimer() : undefined}
      onBlur={interactive && trigger === 'hover-focus' ? (event) => { if (!inInteractiveBoundary(event.relatedTarget)) schedule(false, 'focus', event.nativeEvent); } : undefined}
    >
      {content}
      {showArrow ? <span className={styles.arrow} aria-hidden="true" /> : null}
    </PositionedOverlay> : null}
  </>;
}
