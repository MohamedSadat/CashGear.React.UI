/* eslint-disable react-hooks/refs -- refs intentionally hold keyed lifecycle snapshots without driving renders. */
/* eslint-disable react-hooks/set-state-in-effect -- effects reconcile invalid controlled collections and post-hydration capabilities. */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, PointerEvent, ReactElement, RefAttributes } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { moveRovingKey } from '../../internal/rovingFocus';
import { reconcileAvailableKey, stableKeyToken, validateKeyedItems } from '../../internal/keyedCollection';
import { renderIcon } from '../../internal';
import { cx } from '../../utils';
import styles from './CgTabs.module.css';
import type { CgTabCloseDetails, CgTabCloseReason, CgTabDescriptor, CgTabReorderDetails, CgTabsActions, CgTabsChangeSource, CgTabsProps } from './CgTabs.types';

const DEFAULT_LABELS = {
  previousTabs: 'Previous tabs',
  nextTabs: 'Next tabs',
  closeTab: (text: string) => `Close ${text}`,
};

interface DragState { key: string; pointerId: number; startX: number; startY: number; fromIndex: number; toIndex: number; dragging: boolean }

function CgTabsInner<TData>(
  {
    tabs,
    activeKey,
    defaultActiveKey,
    onActiveKeyChange,
    position = 'top',
    contentMode = 'active-only',
    scrollMode = 'auto',
    size = 'medium',
    direction = 'auto',
    reorderable = false,
    beforeClose,
    onCloseRequest,
    onCloseError,
    onReorder,
    emptyContent,
    ariaLabel = 'Tabs',
    labels,
    actionsRef,
    className,
    onKeyDown,
    ...nativeProps
  }: CgTabsProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  validateKeyedItems(tabs, 'CgTabs');
  const rootId = useCgId(nativeProps.id);
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const available = useMemo(() => tabs.filter((tab) => tab.visible !== false && !tab.disabled), [tabs]);
  const initial = defaultActiveKey ?? available[0]?.key ?? null;
  const [stateKey, setStateKey] = useControllableState(activeKey, initial, 'CgTabs');
  const previousSnapshot = useRef({ key: stateKey, index: Math.max(0, tabs.findIndex((tab) => tab.key === stateKey)) });
  const effectiveKey = reconcileAvailableKey(tabs, stateKey, previousSnapshot.current.index, (tab) => tab.visible !== false && !tab.disabled, 'forward-then-backward');
  const effectiveIndex = tabs.findIndex((tab) => tab.key === effectiveKey);
  const [focusedKey, setFocusedKey] = useState<string | undefined>(effectiveKey ?? undefined);
  const resolvedFocusedKey = focusedKey && available.some((tab) => tab.key === focusedKey) ? focusedKey : effectiveKey ?? available[0]?.key;
  const tabElements = useRef(new Map<string, HTMLButtonElement>());
  const headerElements = useRef(new Map<string, HTMLDivElement>());
  const visited = useRef(new Set<string>());
  const correctionSignature = useRef<string | undefined>(undefined);
  const closeOperation = useAsyncOperation();
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  if (effectiveKey) visited.current.add(effectiveKey);
  for (const key of [...visited.current]) if (!tabs.some((tab) => tab.key === key)) visited.current.delete(key);

  const emitChange = useStableCallback((nextKey: string | null, source: CgTabsChangeSource, event?: CgTabsActiveKeyChangeDetailsEvent) => {
    const previousKey = effectiveKey;
    const previousIndex = tabs.findIndex((tab) => tab.key === previousKey);
    const nextIndex = tabs.findIndex((tab) => tab.key === nextKey);
    if (nextKey === previousKey) return false;
    setStateKey(nextKey);
    onActiveKeyChange?.(nextKey, {
      previousKey,
      activeKey: nextKey,
      previousIndex,
      activeIndex: nextIndex,
      source,
      isUserInitiated: source === 'pointer' || source === 'keyboard',
      ...(nextIndex >= 0 ? { tab: tabs[nextIndex] } : {}),
      ...(event ? { event } : {}),
    });
    return true;
  });

  const emitCorrection = useStableCallback((previousKey: string | null, previousIndex: number, nextKey: string | null) => {
    const nextIndex = tabs.findIndex((tab) => tab.key === nextKey);
    setStateKey(nextKey);
    onActiveKeyChange?.(nextKey, {
      previousKey,
      activeKey: nextKey,
      previousIndex,
      activeIndex: nextIndex,
      source: 'collection',
      isUserInitiated: false,
      ...(nextIndex >= 0 ? { tab: tabs[nextIndex] } : {}),
    });
  });

  useEffect(() => {
    const previous = previousSnapshot.current;
    const requestedIndex = tabs.findIndex((tab) => tab.key === stateKey);
    previousSnapshot.current = { key: effectiveKey, index: effectiveIndex >= 0 ? effectiveIndex : Math.max(0, previous.index) };
    if (stateKey === effectiveKey) { correctionSignature.current = undefined; return; }
    const signature = `${String(stateKey)}>${String(effectiveKey)}@${requestedIndex}:${tabs.map((tab) => `${tab.key}:${tab.visible !== false}:${!tab.disabled}`).join('|')}`;
    if (correctionSignature.current === signature) return;
    correctionSignature.current = signature;
    emitCorrection(stateKey, previous.index, effectiveKey);
  }, [effectiveIndex, effectiveKey, emitCorrection, stateKey, tabs]);

  const focusTab = useStableCallback((key: string) => {
    if (!available.some((tab) => tab.key === key)) return;
    setFocusedKey(key);
    tabElements.current.get(key)?.focus({ preventScroll: true });
  });
  const scrollTabIntoView = useStableCallback((key: string) => {
    headerElements.current.get(key)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  });
  const activateTab = useStableCallback((key: string) => available.some((tab) => tab.key === key) && emitChange(key, 'action'));
  useImperativeHandle(actionsRef, (): CgTabsActions => ({
    focusActive: () => { if (effectiveKey) focusTab(effectiveKey); },
    focusTab,
    activateTab,
    scrollTabIntoView,
  }), [activateTab, effectiveKey, focusTab, scrollTabIntoView]);

  useEffect(() => { if (effectiveKey) scrollTabIntoView(effectiveKey); }, [effectiveKey, scrollTabIntoView]);

  const requestClose = useStableCallback(async (key: string, reason: CgTabCloseReason, event?: CgTabCloseDetails<TData>['event']) => {
    const tab = tabsRef.current.find((candidate) => candidate.key === key);
    if (!tab?.closable || tab.disabled || tab.visible === false) return;
    await closeOperation.run(async ({ signal }) => {
      const index = tabsRef.current.findIndex((candidate) => candidate.key === key);
      const details: CgTabCloseDetails<TData> = { tab, key, index, reason, signal, ...(event ? { event } : {}) };
      try {
        if (await beforeClose?.(details) === false || signal.aborted) return;
        const current = tabsRef.current[index];
        if (!current || current.key !== key || current !== tab) return;
        await onCloseRequest?.(details);
      } catch (error) {
        if (!signal.aborted) onCloseError?.(error, details);
      }
    });
  });

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, key: string) => {
    const vertical = position === 'left' || position === 'right';
    let movement: 'next' | 'previous' | 'first' | 'last' | undefined;
    if (event.key === 'Home') movement = 'first';
    else if (event.key === 'End') movement = 'last';
    else if (vertical && event.key === 'ArrowDown') movement = 'next';
    else if (vertical && event.key === 'ArrowUp') movement = 'previous';
    else if (!vertical && event.key === 'ArrowRight') movement = resolvedDirection === 'rtl' ? 'previous' : 'next';
    else if (!vertical && event.key === 'ArrowLeft') movement = resolvedDirection === 'rtl' ? 'next' : 'previous';
    if (movement) {
      event.preventDefault();
      const next = moveRovingKey(available.map((tab) => tab.key), key, movement);
      if (next) { focusTab(next); scrollTabIntoView(next); }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); emitChange(key, 'keyboard', event); return;
    }
    if (event.key === 'Delete') { event.preventDefault(); void requestClose(key, 'delete-key', event); }
  };

  const dragRef = useRef<DragState | undefined>(undefined);
  const [dragPreview, setDragPreview] = useState<{ key: string; toIndex: number }>();
  const cancelDrag = useCallback(() => { dragRef.current = undefined; setDragPreview(undefined); }, []);
  useEffect(() => cancelDrag, [cancelDrag]);
  const pointerDown = (event: PointerEvent<HTMLDivElement>, tab: CgTabDescriptor<TData>, index: number) => {
    if (!reorderable || tab.disabled || event.button !== 0 || (event.target as Element).closest('[data-cg-tabs-close]')) return;
    dragRef.current = { key: tab.key, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, fromIndex: index, toIndex: index, dragging: false };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.dragging && distance < 4) return;
    drag.dragging = true;
    event.preventDefault();
    const vertical = position === 'left' || position === 'right';
    const coordinate = vertical ? event.clientY : event.clientX;
    let target = drag.fromIndex;
    for (const [key, element] of headerElements.current) {
      const index = tabsRef.current.findIndex((tab) => tab.key === key);
      if (index < 0 || key === drag.key) continue;
      const rect = element.getBoundingClientRect();
      const midpoint = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      if (coordinate >= midpoint) target = index;
      else if (target === drag.fromIndex) { target = index; break; }
    }
    drag.toIndex = target;
    setDragPreview({ key: drag.key, toIndex: target });
  };
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.dragging && drag.toIndex !== drag.fromIndex) {
      const tab = tabsRef.current.find((candidate) => candidate.key === drag.key);
      if (tab) onReorder?.({ tab, key: drag.key, fromIndex: drag.fromIndex, toIndex: drag.toIndex, event } satisfies CgTabReorderDetails<TData>);
    }
    cancelDrag();
  };

  const [resolvedScroll, setResolvedScroll] = useState<'buttons' | 'native' | 'none'>(scrollMode === 'buttons' ? 'buttons' : scrollMode === 'none' ? 'none' : 'native');
  const [scrollState, setScrollState] = useState({ previous: false, next: false });
  useEffect(() => {
    if (scrollMode !== 'auto') { setResolvedScroll(scrollMode === 'buttons' ? 'buttons' : scrollMode === 'none' ? 'none' : 'native'); return; }
    const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    setResolvedScroll(coarse ? 'native' : 'buttons');
  }, [scrollMode]);
  const measureOverflow = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vertical = position === 'left' || position === 'right';
    const offset = vertical ? viewport.scrollTop : viewport.scrollLeft;
    const extent = vertical ? viewport.scrollHeight : viewport.scrollWidth;
    const sizeValue = vertical ? viewport.clientHeight : viewport.clientWidth;
    setScrollState({ previous: Math.abs(offset) > 1, next: Math.abs(offset) + sizeValue < extent - 1 });
  }, [position]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    measureOverflow();
    viewport.addEventListener('scroll', measureOverflow, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measureOverflow);
    observer?.observe(viewport);
    return () => { viewport.removeEventListener('scroll', measureOverflow); observer?.disconnect(); };
  }, [measureOverflow, tabs]);
  const scrollHeaders = (delta: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const vertical = position === 'left' || position === 'right';
    viewport.scrollBy(vertical ? { top: delta * viewport.clientHeight * 0.75, behavior: 'smooth' } : { left: delta * viewport.clientWidth * 0.75, behavior: 'smooth' });
  };

  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const tabId = (key: string) => `${rootId}-tab-${stableKeyToken(key)}`;
  const panelId = (key: string) => `${tabId(key)}-panel`;
  const headers = <div className={styles.headers}>
    {resolvedScroll === 'buttons' ? <button type="button" className={styles.nav} aria-label={mergedLabels.previousTabs} disabled={!scrollState.previous} onClick={() => scrollHeaders(-1)}>‹</button> : null}
    <div ref={viewportRef} className={cx(styles.viewport, resolvedScroll === 'none' && styles.noScroll)}>
      <div role="tablist" aria-label={ariaLabel} aria-orientation={position === 'left' || position === 'right' ? 'vertical' : 'horizontal'} aria-owns={tabs.filter((tab) => tab.visible !== false).map((tab) => tabId(tab.key)).join(' ')} className={styles.semanticTablist} />
      <div className={styles.tablist}>
        {tabs.map((tab, index) => tab.visible === false ? null : <div
          key={tab.key}
          ref={(element) => { if (element) headerElements.current.set(tab.key, element); else headerElements.current.delete(tab.key); }}
          className={cx(styles.headerItem, dragPreview?.key === tab.key && styles.dragging, dragPreview?.toIndex === index && styles.dropTarget)}
          data-tab-key={tab.key}
          data-tab-index={index}
          onPointerDown={(event) => pointerDown(event, tab, index)}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={cancelDrag}
          onLostPointerCapture={cancelDrag}
        >
          <button
            {...tab.headerAttributes}
            ref={(element) => { if (element) tabElements.current.set(tab.key, element); else tabElements.current.delete(tab.key); }}
            type="button"
            id={tabId(tab.key)}
            role="tab"
            disabled={tab.disabled}
            aria-disabled={tab.disabled || undefined}
            aria-selected={effectiveKey === tab.key}
            aria-controls={panelId(tab.key)}
            tabIndex={!tab.disabled && resolvedFocusedKey === tab.key ? 0 : -1}
            title={tab.tooltip}
            className={cx(styles.tab, effectiveKey === tab.key && styles.active, tab.headerClassName, tab.headerAttributes?.className)}
            onFocus={(event) => { setFocusedKey(tab.key); tab.headerAttributes?.onFocus?.(event); }}
            onClick={(event) => { tab.headerAttributes?.onClick?.(event); if (!event.defaultPrevented) emitChange(tab.key, 'pointer', event); }}
            onKeyDown={(event) => { tab.headerAttributes?.onKeyDown?.(event); if (!event.defaultPrevented) handleTabKey(event, tab.key); }}
          >{tab.renderHeader?.({ tab, index, active: effectiveKey === tab.key, focused: resolvedFocusedKey === tab.key, defaultContent: <>{tab.icon ? <span className={styles.icon}>{renderIcon(tab.icon)}</span> : null}<span>{tab.text}</span></> }) ?? <>{tab.icon ? <span className={styles.icon}>{renderIcon(tab.icon)}</span> : null}<span>{tab.text}</span></>}</button>
          {tab.closable ? <button type="button" data-cg-tabs-close="" className={styles.close} tabIndex={-1} disabled={tab.disabled} aria-label={mergedLabels.closeTab(tab.text)} onClick={(event) => { event.stopPropagation(); void requestClose(tab.key, 'close-button', event); }}>×</button> : null}
        </div>)}
      </div>
    </div>
    {resolvedScroll === 'buttons' ? <button type="button" className={styles.nav} aria-label={mergedLabels.nextTabs} disabled={!scrollState.next} onClick={() => scrollHeaders(1)}>›</button> : null}
  </div>;
  const panels = <div className={styles.content}>{tabs.map((tab) => {
    if (tab.visible === false) return null;
    const render = contentMode === 'all' || (contentMode === 'active-only' ? tab.key === effectiveKey : visited.current.has(tab.key));
    if (!render) return null;
    return <section {...tab.contentAttributes} key={tab.key} id={panelId(tab.key)} role="tabpanel" aria-labelledby={tabId(tab.key)} hidden={tab.key !== effectiveKey} className={cx(styles.panel, tab.contentClassName, tab.contentAttributes?.className)}>{tab.content}</section>;
  })}</div>;

  if (tabs.length === 0) return emptyContent === undefined ? null : <>{emptyContent}</>;
  return <div
    {...nativeProps}
    id={rootId}
    ref={mergedRef}
    dir={resolvedDirection}
    className={cx(styles.root, styles[position], styles[size], className)}
    data-position={position}
    data-scroll-mode={resolvedScroll}
    onKeyDown={(event) => { onKeyDown?.(event); if (!event.defaultPrevented && event.key === 'Escape' && dragRef.current) { event.preventDefault(); cancelDrag(); } }}
  >{position === 'bottom' || position === 'right' ? <>{panels}{headers}</> : <>{headers}{panels}</>}</div>;
}

type CgTabsActiveKeyChangeDetailsEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

export const CgTabs = forwardRef(CgTabsInner) as <TData = unknown>(props: CgTabsProps<TData> & RefAttributes<HTMLDivElement>) => ReactElement | null;
