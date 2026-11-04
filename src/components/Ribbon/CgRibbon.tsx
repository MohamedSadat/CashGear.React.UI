import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, RefAttributes, RefObject } from 'react';
import { useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgFlyout } from '../Flyout';
import type { CgFlyoutActions } from '../Flyout';
import { CgTabs } from '../Tabs';
import type { CgTabDescriptor, CgTabsActions } from '../Tabs';
import { CgToolbar } from '../Toolbar';
import type { CgToolbarItem, CgToolbarItemActivationDetails } from '../Toolbar';
import styles from './CgRibbon.module.css';
import type { CgRibbonActions, CgRibbonCollapseSource, CgRibbonGroup, CgRibbonItem, CgRibbonLabels, CgRibbonProps, CgRibbonTab } from './CgRibbon.types';
import { planRibbonLayout, ribbonLayoutSteps } from './ribbonLayout';
import type { RibbonGroupMode, RibbonLayoutGroup } from './ribbonLayout';

const DEFAULT_LABELS: CgRibbonLabels = {
  ribbon: 'Ribbon',
  collapse: 'Collapse the ribbon',
  expand: 'Expand the ribbon',
  launcher: (groupText) => `${groupText}: more options`,
  openMenu: (itemText) => `${itemText}: more options`,
};

interface GroupEvents<TData> {
  readonly direction: 'ltr' | 'rtl';
  readonly labels: CgRibbonLabels;
  readonly onItemClick: CgRibbonProps<TData>['onItemClick'];
  readonly onItemError: CgRibbonProps<TData>['onItemError'];
}

interface TabLayoutCache {
  signature: string;
  /** The width the groups take at each stage, measured when the ribbon was at that stage. */
  readonly widths: Map<number, number>;
}

function visibleGroups<TData>(tab: CgRibbonTab<TData>) {
  const keys = new Set<string>();
  for (const { key } of tab.groups) {
    if (!key.trim()) throw new Error(`CgRibbon tab '${tab.key}' has a group without a key.`);
    if (keys.has(key)) throw new Error(`CgRibbon tab '${tab.key}' contains duplicate group '${key}'.`);
    keys.add(key);
  }
  return tab.groups.filter((group) => group.visible !== false && group.items.some((item) => item.visible !== false));
}

function layoutGroup<TData>(group: CgRibbonGroup<TData>): RibbonLayoutGroup {
  const items = group.items.filter((item) => item.visible !== false && !item.render);
  return {
    key: group.key,
    priority: group.priority ?? 0,
    hasLargeItems: group.layout !== 'rows' && items.some((item) => item.size === 'large'),
    hasHideableText: items.some((item) => item.icon !== undefined && item.text !== undefined && (item.hideText !== true || item.size === 'large')),
  };
}

/** Changes only when the commands' shapes do, so a toggled button or a fresh array doesn't restart measuring. */
function layoutSignature<TData>(groups: ReadonlyArray<CgRibbonGroup<TData>>) {
  return JSON.stringify(groups.map((group) => [group.key, group.text, group.priority, group.layout, Boolean(group.onLauncherClick), group.items.map((item) => [
    item.name, item.text, item.size, item.hideText, item.visible !== false, item.icon !== undefined, Boolean(item.render), Boolean(item.children?.length || item.renderFlyout), Boolean(item.onClick),
  ])]));
}

function toToolbarItem<TData>(item: CgRibbonItem<TData>, mode: RibbonGroupMode, layout: CgRibbonGroup<TData>['layout'], labels: CgRibbonLabels): CgToolbarItem<TData> {
  const { size, hideText, ...rest } = item;
  if (item.render) return { ...rest, ownsKeyboard: item.ownsKeyboard ?? true };
  const name = item.text ?? item.tooltip ?? item.name;
  const stacked = size === 'large' && mode === 'full' && layout !== 'rows';
  return {
    ...rest,
    stacked,
    iconOnly: item.icon !== undefined && !stacked && (hideText === true || mode === 'icons'),
    menuAriaLabel: item.menuAriaLabel ?? name,
    toggleAriaLabel: item.toggleAriaLabel ?? labels.openMenu(name),
  };
}

function RibbonToolbar<TData>({ group, mode, events, onActivated }: { group: CgRibbonGroup<TData>; mode: RibbonGroupMode; events: GroupEvents<TData>; onActivated: (() => void) | undefined }) {
  const { direction, labels, onItemClick, onItemError } = events;
  const items = useMemo(() => group.items.map((item) => toToolbarItem(item, mode, group.layout, labels)), [group.items, group.layout, labels, mode]);
  return (
    <CgToolbar<TData>
      className={styles.toolbar}
      items={items}
      layout={group.layout === 'rows' ? 'rows' : 'columns'}
      size="small"
      autoCollapseText={false}
      autoOverflow={false}
      direction={direction}
      ariaLabel={group.text}
      onItemClick={(details: CgToolbarItemActivationDetails<TData>) => {
        const result = onItemClick?.(details);
        onActivated?.();
        return result;
      }}
      onItemError={onItemError}
    />
  );
}

function RibbonGroupFrame<TData>({ group, mode, events, onActivated, inFlyout }: { group: CgRibbonGroup<TData>; mode: Exclude<RibbonGroupMode, 'collapsed'>; events: GroupEvents<TData>; onActivated: (() => void) | undefined; inFlyout?: boolean }) {
  const launcherName = group.launcherLabel ?? events.labels.launcher(group.text);
  return (
    <div className={cx(styles.group, inFlyout && styles.flyoutGroup)} data-cg-ribbon-group={group.key} data-mode={mode}>
      <div className={styles.groupBody}><RibbonToolbar group={group} mode={mode} events={events} onActivated={onActivated} /></div>
      <div className={styles.groupFooter}>
        <span className={styles.groupLabel} aria-hidden="true">{group.text}</span>
        {group.onLauncherClick ? (
          <button type="button" className={styles.launcher} aria-label={launcherName} title={launcherName} data-cg-ribbon-launcher={group.key} onClick={(event: MouseEvent<HTMLButtonElement>) => { group.onLauncherClick?.(event); onActivated?.(); }}>
            <svg viewBox="0 0 10 10" aria-hidden="true" focusable="false"><path d="M1.5 4V1.5H4M1.5 1.5l6 6M8.5 5.5v3h-3" /></svg>
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** A group that ran out of room: one button, whose flyout holds the group as declared. */
function RibbonCollapsedGroup<TData>({ group, events, onActivated }: { group: CgRibbonGroup<TData>; events: GroupEvents<TData>; onActivated: (() => void) | undefined }) {
  const icon = group.icon ?? group.items.find((item) => item.visible !== false && item.icon !== undefined)?.icon;
  const items = useMemo((): ReadonlyArray<CgToolbarItem<TData>> => [{
    name: group.key,
    text: group.text,
    ...(icon !== undefined ? { icon } : {}),
    stacked: true,
    menuAriaLabel: group.text,
    renderFlyout: ({ close }) => (
      <div className={styles.scope}>
        <RibbonGroupFrame group={group} mode="full" events={events} inFlyout onActivated={() => { close(); onActivated?.(); }} />
      </div>
    ),
  }], [events, group, icon, onActivated]);
  return (
    <div className={styles.group} data-cg-ribbon-group={group.key} data-mode="collapsed">
      <div className={styles.groupBody}>
        <CgToolbar<TData> className={styles.toolbar} items={items} layout="columns" size="small" autoCollapseText={false} autoOverflow={false} direction={events.direction} ariaLabel={group.text} />
      </div>
    </div>
  );
}

function RibbonPanel<TData>({ tab, stage, layoutRevision, cacheRef, onStageChange, events, onActivated }: {
  tab: CgRibbonTab<TData>;
  stage: number;
  layoutRevision: number;
  cacheRef: RefObject<Map<string, TabLayoutCache>>;
  onStageChange: (tabKey: string, stage: number) => void;
  events: GroupEvents<TData>;
  onActivated: (() => void) | undefined;
}) {
  const groups = useMemo(() => visibleGroups(tab), [tab]);
  const layoutGroups = useMemo(() => groups.map(layoutGroup), [groups]);
  const maxStage = useMemo(() => ribbonLayoutSteps(layoutGroups).length, [layoutGroups]);
  const effectiveStage = Math.min(stage, maxStage);
  const modes = useMemo(() => planRibbonLayout(layoutGroups, effectiveStage), [effectiveStage, layoutGroups]);
  const signature = layoutSignature(groups);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fit = useStableCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    let entry = cacheRef.current.get(tab.key);
    if (entry?.signature !== signature) {
      entry = { signature, widths: new Map() };
      cacheRef.current.set(tab.key, entry);
      if (effectiveStage !== 0) { onStageChange(tab.key, 0); return; }
    }
    const available = viewport.clientWidth;
    if (available <= 0) return;
    const required = Math.ceil(content.getBoundingClientRect().width);
    entry.widths.set(effectiveStage, required);
    if (required > available) {
      if (effectiveStage >= maxStage) return;
      let next = effectiveStage + 1;
      while (next < maxStage && (entry.widths.get(next) ?? 0) > available) next += 1;
      onStageChange(tab.key, next);
      return;
    }
    let wider = effectiveStage;
    while (wider > 0) {
      const width = entry.widths.get(wider - 1);
      if (width === undefined || width > available) break;
      wider -= 1;
    }
    if (wider !== effectiveStage) onStageChange(tab.key, wider);
  });

  useLayoutEffect(() => fit(), [effectiveStage, fit, layoutRevision, signature]);
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => fit());
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <div ref={viewportRef} className={styles.groups} data-cg-ribbon-stage={effectiveStage}>
      <div ref={contentRef} className={styles.groupsContent}>
        {groups.map((group) => {
          const mode = modes.get(group.key) ?? 'full';
          return mode === 'collapsed'
            ? <RibbonCollapsedGroup key={group.key} group={group} events={events} onActivated={onActivated} />
            : <RibbonGroupFrame key={group.key} group={group} mode={mode} events={events} onActivated={onActivated} />;
        })}
      </div>
    </div>
  );
}

function CgRibbonInner<TData>(
  { tabs, activeKey, defaultActiveKey, onActiveKeyChange, collapsed, defaultCollapsed = false, onCollapsedChange, collapsible = true, startContent, endContent, onItemClick, onItemError, direction = 'auto', ariaLabel, labels, actionsRef, className, onKeyDown, 'aria-label': nativeAriaLabel, ...nativeProps }: CgRibbonProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const text = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const initialKey = defaultActiveKey ?? tabs.find((tab) => tab.visible !== false && !tab.disabled)?.key ?? null;
  const [currentKey, setCurrentKey] = useControllableState<string | null>(activeKey, initialKey, 'CgRibbon');
  const [isCollapsed, setIsCollapsed] = useControllableState(collapsed, defaultCollapsed, 'CgRibbon collapsed');
  const [peeking, setPeeking] = useState(false);
  const [stages, setStages] = useState<Readonly<Record<string, number>>>({});
  const [layoutRevision, setLayoutRevision] = useState(0);
  const cacheRef = useRef(new Map<string, TabLayoutCache>());
  const tabsActions = useRef<CgTabsActions>(null);
  const peekActions = useRef<CgFlyoutActions>(null);
  const peekOpen = isCollapsed && peeking && currentKey !== null;
  // Expanding ends a peek, so collapsing again later doesn't bring it back.
  if (!isCollapsed && peeking) setPeeking(false);

  const requestCollapsed = useStableCallback((next: boolean, source: CgRibbonCollapseSource) => {
    setPeeking(false);
    if (next === isCollapsed) return;
    // The commands are about to unmount, and focus falling to the page would take Ctrl+F1 with it.
    if (next && rootRef.current?.querySelector('[data-cg-ribbon-stage]')?.contains(document.activeElement)) tabsActions.current?.focusActive();
    setIsCollapsed(next);
    onCollapsedChange?.(next, { source });
  });
  // Called from a child's layout effect, before this component's own effects have run in that commit,
  // so it can't go through useStableCallback, whose ref is empty at that point.
  const handleStageChange = useCallback((tabKey: string, stage: number) => {
    setStages((current) => (current[tabKey] === stage ? current : { ...current, [tabKey]: stage }));
  }, []);
  const closePeek = useStableCallback(() => setPeeking(false));
  const events = useMemo<GroupEvents<TData>>(() => ({ direction: resolvedDirection, labels: text, onItemClick, onItemError }), [onItemClick, onItemError, resolvedDirection, text]);

  useImperativeHandle(actionsRef, (): CgRibbonActions => ({
    focus: () => tabsActions.current?.focusActive(),
    focusTab: (key) => tabsActions.current?.focusTab(key),
    setCollapsed: (next) => requestCollapsed(next, 'action'),
    toggleCollapsed: () => requestCollapsed(!isCollapsed, 'action'),
    recalculateLayout: () => {
      cacheRef.current.clear();
      setStages({});
      setLayoutRevision((revision) => revision + 1);
    },
  }), [isCollapsed, requestCollapsed]);

  useEffect(() => {
    if (!peekOpen) return undefined;
    const frame = requestAnimationFrame(() => peekActions.current?.focusFirst());
    return () => cancelAnimationFrame(frame);
  }, [peekOpen, currentKey]);

  const panelFor = (tab: CgRibbonTab<TData>, onActivated: (() => void) | undefined) => (
    <RibbonPanel tab={tab} stage={stages[tab.key] ?? 0} layoutRevision={layoutRevision} cacheRef={cacheRef} onStageChange={handleStageChange} events={events} onActivated={onActivated} />
  );

  const descriptors: ReadonlyArray<CgTabDescriptor<never>> = tabs.map((tab) => ({
    key: tab.key,
    text: tab.text,
    ...(tab.tooltip !== undefined ? { tooltip: tab.tooltip } : {}),
    ...(tab.disabled !== undefined ? { disabled: tab.disabled } : {}),
    ...(tab.visible !== undefined ? { visible: tab.visible } : {}),
    contentClassName: isCollapsed ? styles.emptyPanel : styles.panel,
    ...(isCollapsed ? {} : { content: panelFor(tab, undefined) }),
    headerAttributes: {
      onClick: () => { if (isCollapsed) setPeeking((open) => (tab.key === currentKey ? !open : true)); },
      onDoubleClick: () => { if (collapsible) requestCollapsed(!isCollapsed, 'tab'); },
      onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
        if (!isCollapsed || (event.key !== 'Enter' && event.key !== ' ')) return;
        setPeeking((open) => (tab.key === currentKey ? !open : true));
      },
    },
  }));

  const activeTab = tabs.find((tab) => tab.key === currentKey);

  return (
    <div
      {...nativeProps}
      ref={mergedRef}
      role="region"
      aria-label={ariaLabel ?? nativeAriaLabel ?? text.ribbon}
      dir={direction === 'auto' ? undefined : direction}
      className={cx(styles.root, styles.scope, className)}
      data-cg-ribbon=""
      data-collapsed={isCollapsed || undefined}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !collapsible || event.key !== 'F1' || !event.ctrlKey) return;
        event.preventDefault();
        requestCollapsed(!isCollapsed, 'keyboard');
      }}
    >
      <CgTabs
        actionsRef={tabsActions}
        className={styles.tabs}
        tabs={descriptors}
        activeKey={currentKey}
        onActiveKeyChange={(key, details) => {
          setCurrentKey(key);
          onActiveKeyChange?.(key, details);
        }}
        scrollMode="native"
        size="small"
        direction={resolvedDirection}
        ariaLabel={ariaLabel ?? nativeAriaLabel ?? text.ribbon}
        startContent={startContent}
        endContent={endContent !== undefined || collapsible ? <>
          {endContent}
          {collapsible ? (
            <CgButton
              appearance="ghost"
              size="small"
              icon={isCollapsed ? 'chevron-down' : 'chevron-up'}
              aria-label={isCollapsed ? text.expand : text.collapse}
              aria-expanded={!isCollapsed}
              title={isCollapsed ? text.expand : text.collapse}
              className={styles.collapseButton}
              data-cg-ribbon-collapse=""
              onClick={() => requestCollapsed(!isCollapsed, 'button')}
            >{null}</CgButton>
          ) : null}
        </> : undefined}
      />
      {/* Mounted only while open: the root's ref isn't attached yet when a flyout mounted with it resolves its anchor. */}
      {peekOpen && activeTab ? (
        <CgFlyout
          key={activeTab.key}
          actionsRef={peekActions}
          anchor={rootRef}
          open
          onOpenChange={setPeeking}
          placement="bottom-start"
          offset={0}
          matchAnchorWidth
          maxHeight="none"
          returnFocusOnClose
          className={cx(styles.scope, styles.peek)}
          data-cg-ribbon-peek=""
        ><div role="group" aria-label={activeTab.text}>{panelFor(activeTab, closePeek)}</div></CgFlyout>
      ) : null}
    </div>
  );
}

export const CgRibbon = forwardRef(CgRibbonInner) as <TData = unknown>(props: CgRibbonProps<TData> & RefAttributes<HTMLDivElement>) => ReactElement | null;
