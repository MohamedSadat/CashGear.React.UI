import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';
import { useCgId, useControllableState, useDirection, useMergedRefs } from '../../hooks';
import {
  buildMenuAdaptivePlan,
  findRouteMenuItem,
  flattenMenu,
  MenuSurface,
  normalizeMenuTree,
} from '../../internal';
import type { MenuDescriptor, MenuNode, MenuRenderContext } from '../../internal';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgFlyout } from '../Flyout';
import styles from './CgMenu.module.css';
import type {
  CgMenuActions,
  CgMenuItem,
  CgMenuItemActivationDetails,
  CgMenuItemContext,
  CgMenuProps,
} from './CgMenu.types';

function publicItem<TData>(node: MenuNode<TData>): CgMenuItem<TData> {
  return {
    key: node.key,
    ...(node.parentKey ? { parentKey: node.parentKey } : {}),
    text: node.text,
    ...(node.icon ? { icon: node.icon } : {}),
    visible: node.visible,
    disabled: node.disabled,
    separator: node.separator,
    beginGroup: node.beginGroup,
    ...(node.tooltip ? { tooltip: node.tooltip } : {}),
    ...(node.className ? { className: node.className } : {}),
    intent: node.intent,
    ...(node.badge !== undefined ? { badge: node.badge } : {}),
    ...(node.shortcut !== undefined ? { shortcut: node.shortcut } : {}),
    ...(node.href ? { navigateUrl: node.href } : {}),
    ...(node.target ? { target: node.target } : {}),
    routeMatch: node.routeMatch,
    ...(node.checked !== undefined ? { checked: node.checked } : {}),
    ...(node.radioGroup ? { radioGroup: node.radioGroup } : {}),
    ...(node.data !== undefined ? { data: node.data } : {}),
    adaptivePriority: node.adaptivePriority,
    children: node.children.map(publicItem),
  };
}

function toDescriptor<TData>(item: CgMenuItem<TData>): MenuDescriptor<TData> {
  return {
    key: item.key,
    ...(item.parentKey !== undefined ? { parentKey: item.parentKey } : {}),
    text: item.text,
    ...(item.icon !== undefined ? { icon: item.icon } : {}),
    visible: item.visible,
    disabled: item.disabled,
    separator: item.separator,
    beginGroup: item.beginGroup,
    ...(item.tooltip !== undefined ? { tooltip: item.tooltip } : {}),
    ...(item.className !== undefined ? { className: item.className } : {}),
    ...(item.intent !== undefined ? { intent: item.intent } : {}),
    ...(item.badge !== undefined ? { badge: item.badge } : {}),
    ...(item.shortcut !== undefined ? { shortcut: item.shortcut } : {}),
    ...(item.navigateUrl !== undefined ? { href: item.navigateUrl } : {}),
    ...(item.target !== undefined ? { target: item.target } : {}),
    ...(item.routeMatch !== undefined ? { routeMatch: item.routeMatch } : {}),
    ...(item.checked !== undefined ? { checked: item.checked } : {}),
    ...(item.radioGroup !== undefined ? { radioGroup: item.radioGroup } : {}),
    ...(item.data !== undefined ? { data: item.data } : {}),
    ...(item.adaptivePriority !== undefined ? { adaptivePriority: item.adaptivePriority } : {}),
    ...(item.children !== undefined ? { children: item.children.map(toDescriptor) } : {}),
    ...(item.onActivate !== undefined ? { onActivate: () => undefined } : {}),
  };
}

function CgMenuInner<TData>(
  {
    items,
    orientation = 'horizontal',
    displayMode = 'automatic',
    submenuTrigger = 'click',
    itemAlignment = 'start',
    selectionMode = 'route',
    selectedKey,
    defaultSelectedKey = null,
    onSelectedKeyChange,
    expandedKeys,
    defaultExpandedKeys = new Set<string>(),
    onExpandedKeysChange,
    title,
    renderTitle,
    renderItem,
    renderItemText,
    renderSubmenu,
    collapseCaptionsToIcons = true,
    collapseItemsIntoHamburger = true,
    hamburgerPosition = 'end',
    openDelay = 150,
    closeDelay = 250,
    closeOnItemClick = true,
    disabled = false,
    size = 'medium',
    direction = 'auto',
    semanticMode = 'navigation',
    pruneEmptyParents = true,
    currentLocation,
    locale,
    onItemActivate,
    onItemExpansionChange,
    onNavigate,
    onOpen,
    onClose,
    ariaLabel = semanticMode === 'navigation' ? 'Main navigation' : 'Application menu',
    hamburgerAriaLabel = 'Open menu',
    actionsRef,
    className,
    ...nativeProps
  }: CgMenuProps<TData>,
  forwardedRef: ForwardedRef<HTMLElement>,
) {
  if (openDelay < 0 || closeDelay < 0) throw new RangeError('CgMenu delays cannot be negative.');
  const rootRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const menuScopeId = useCgId();
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const normalized = useMemo(() => normalizeMenuTree(items.map(toDescriptor), {
    componentName: 'CgMenu', maxDepth: 16, allowFlat: true, allowBranchAction: true, pruneEmptyParents,
  }), [items, pruneEmptyParents]);
  const byKey = useMemo(() => new Map(flattenMenu(normalized).map((node) => [node.key, node])), [normalized]);
  const [manualSelection, setManualSelection] = useControllableState(selectedKey, defaultSelectedKey, 'CgMenu selectedKey');
  const [actualExpanded, setActualExpanded] = useControllableState(expandedKeys, defaultExpandedKeys, 'CgMenu expandedKeys');
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [stage, setStage] = useState(0);
  const minimumWidths = useRef(new Map<number, number>());
  const [browserLocation, setBrowserLocation] = useState(() => typeof window === 'undefined' ? '/' : window.location.href);
  useEffect(() => {
    if (currentLocation !== undefined) return undefined;
    const update = () => setBrowserLocation(window.location.href);
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); };
  }, [currentLocation]);
  const routeSelection = selectionMode === 'route'
    ? findRouteMenuItem(normalized, currentLocation ?? browserLocation)?.key ?? null
    : null;
  const effectiveSelected = selectionMode === 'manual' ? manualSelection : selectionMode === 'route' ? routeSelection : null;
  const basePlan = useMemo(
    () => buildMenuAdaptivePlan(normalized, stage, collapseCaptionsToIcons, collapseItemsIntoHamburger),
    [collapseCaptionsToIcons, collapseItemsIntoHamburger, normalized, stage],
  );
  const plan = useMemo(() => displayMode === 'mobile'
    ? { ...basePlan, visible: [], overflow: normalized, iconOnlyKeys: new Set<string>() }
    : displayMode === 'desktop'
      ? buildMenuAdaptivePlan(normalized, 0, false, false)
      : basePlan, [basePlan, displayMode, normalized]);
  const reconcileLayout = useCallback(() => {
    if (displayMode !== 'automatic' || orientation !== 'horizontal') return;
    const rail = railRef.current;
    if (!rail || rail.clientWidth <= 0) return;
    const required = rail.scrollWidth;
    const available = rail.clientWidth;
    minimumWidths.current.set(stage, required);
    if (required > available + 1) {
      setStage((value) => Math.min(value + 1, basePlan.maxStage));
      return;
    }
    const previousRequirement = minimumWidths.current.get(stage - 1);
    if (stage > 0 && previousRequirement !== undefined && available >= previousRequirement) setStage((value) => Math.max(0, value - 1));
  }, [basePlan.maxStage, displayMode, orientation, stage]);
  useLayoutEffect(() => reconcileLayout(), [plan, reconcileLayout]);
  useEffect(() => {
    if (displayMode !== 'automatic' || orientation !== 'horizontal' || typeof ResizeObserver === 'undefined') return undefined;
    const element = rootRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(reconcileLayout);
    observer.observe(element);
    return () => observer.disconnect();
  }, [displayMode, orientation, reconcileLayout]);
  const previousOpen = useRef(false);
  const isOpen = hamburgerOpen || actualExpanded.size > 0;
  useEffect(() => {
    if (isOpen === previousOpen.current) return;
    previousOpen.current = isOpen;
    if (isOpen) onOpen?.(); else onClose?.();
  }, [isOpen, onClose, onOpen]);
  const proposeExpansion = useCallback((next: ReadonlySet<string>) => {
    const valid = new Set([...next].filter((key) => byKey.get(key)?.children.length));
    const changed = [...new Set([...actualExpanded, ...valid])].filter((key) => actualExpanded.has(key) !== valid.has(key));
    setActualExpanded(valid);
    onExpandedKeysChange?.(valid);
    for (const key of changed) {
      const node = byKey.get(key);
      if (node) onItemExpansionChange?.({ item: publicItem(node), expanded: valid.has(key), expandedKeys: valid });
    }
  }, [actualExpanded, byKey, onExpandedKeysChange, onItemExpansionChange, setActualExpanded]);
  const handleActivate = async (node: MenuNode<TData>, source: 'pointer' | 'keyboard', event: CgMenuItemActivationDetails<TData>['event']) => {
    const details: CgMenuItemActivationDetails<TData> = {
      item: publicItem(node), source, event,
      ...(node.checked !== undefined ? { proposedChecked: node.radioGroup ? true : !node.checked } : {}),
    };
    if (selectionMode === 'manual') {
      const previousKey = manualSelection;
      setManualSelection(node.key);
      onSelectedKeyChange?.(node.key, { ...details, previousKey });
    }
    if (node.href) onNavigate?.({ item: details.item, event });
    const sourceItem = flattenPublicMenu(items).find((item) => item.key.trim() === node.key);
    await sourceItem?.onActivate?.(details);
    await onItemActivate?.(details);
    if (closeOnItemClick && node.children.length === 0) {
      proposeExpansion(new Set());
      setHamburgerOpen(false);
    }
  };
  useImperativeHandle(actionsRef, (): CgMenuActions => ({
    focus: () => document.querySelector<HTMLElement>(`[data-cg-menu-scope="${menuScopeId}"][data-cg-menu-key]`)?.focus(),
    focusItem: (key) => {
      const focusExisting = () => {
        const element = Array.from(document.querySelectorAll<HTMLElement>('[data-cg-menu-key]'))
          .find((candidate) => candidate.dataset.cgMenuScope === menuScopeId && candidate.dataset.cgMenuKey === key);
        element?.focus({ preventScroll: true });
        return Boolean(element);
      };
      if (focusExisting()) return;
      const ancestors: string[] = [];
      let owningRoot: MenuNode<TData> | undefined;
      const visit = (source: ReadonlyArray<MenuNode<TData>>, path: string[]): boolean => {
        for (const node of source) {
          if (node.key === key) { ancestors.push(...path); owningRoot = source === normalized ? node : normalized.find((root) => root.key === path[0]); return true; }
          if (visit(node.children, [...path, node.key])) return true;
        }
        return false;
      };
      visit(normalized, []);
      if (owningRoot && plan.overflow.some((node) => node.key === owningRoot?.key)) setHamburgerOpen(true);
      if (ancestors.length > 0) proposeExpansion(new Set([...actualExpanded, ...ancestors]));
      queueMicrotask(focusExisting);
    },
    expandItem: (key) => { if (byKey.get(key)?.children.length) proposeExpansion(new Set([...actualExpanded, key])); },
    collapseItem: (key) => { const next = new Set(actualExpanded); next.delete(key); proposeExpansion(next); },
    collapseAll: () => proposeExpansion(new Set()),
    open: () => {
      if (plan.overflow.length > 0) setHamburgerOpen(true);
      else {
        const branch = normalized.find((node) => node.children.length > 0);
        if (branch) proposeExpansion(new Set([branch.key]));
      }
    },
    close: () => { proposeExpansion(new Set()); setHamburgerOpen(false); },
  }), [actualExpanded, byKey, menuScopeId, normalized, plan.overflow, proposeExpansion]);
  const renderContext = (context: MenuRenderContext<TData>): CgMenuItemContext<TData> => ({
    ...context,
    item: publicItem(context.item),
    selected: effectiveSelected === context.item.key,
    iconOnly: plan.iconOnlyKeys.has(context.item.key),
  });
  const surface = (surfaceItems: ReadonlyArray<MenuNode<TData>>, level = 0) => (
    <MenuSurface
      items={surfaceItems}
      ariaLabel={ariaLabel}
      direction={resolvedDirection}
      expandedKeys={actualExpanded}
      onExpandedKeysChange={proposeExpansion}
      onActivate={handleActivate}
      renderItem={renderItem ? (context) => renderItem(renderContext(context)) : undefined}
      renderText={renderItemText ? (context) => renderItemText(renderContext(context)) : undefined}
      renderSubmenu={renderSubmenu ? ({ parent, level: childLevel, childContent }) => renderSubmenu({ parent: publicItem(parent), level: childLevel, childContent }) : undefined}
      submenuTrigger={submenuTrigger}
      openDelay={openDelay}
      closeDelay={closeDelay}
      locale={locale}
      disabled={disabled}
      level={level}
      onCloseRoot={() => { proposeExpansion(new Set()); setHamburgerOpen(false); }}
      selectedKey={effectiveSelected ?? undefined}
      iconOnlyKeys={plan.iconOnlyKeys}
      semantic={semanticMode === 'navigation' ? 'navigation' : 'application'}
      rootMenubar={semanticMode === 'application-menu' && orientation === 'horizontal'}
      rootOrientation={orientation}
      scopeId={menuScopeId}
    />
  );
  const rootContent = <>
    {title !== undefined ? <div className={styles.title}>{renderTitle?.(title) ?? title}</div> : null}
    {hamburgerPosition === 'start' && plan.overflow.length > 0 ? <CgButton ref={hamburgerRef} className={cx(styles.hamburger, styles.hamburgerStart)} appearance="ghost" aria-label={hamburgerAriaLabel} aria-haspopup="menu" aria-expanded={hamburgerOpen} onClick={() => setHamburgerOpen((value) => !value)}>{'☰'}</CgButton> : null}
    <div ref={railRef} className={styles.rail} data-orientation={orientation} data-align={itemAlignment}>{surface(plan.visible)}</div>
    {hamburgerPosition === 'end' && plan.overflow.length > 0 ? <CgButton ref={hamburgerRef} className={styles.hamburger} appearance="ghost" aria-label={hamburgerAriaLabel} aria-haspopup="menu" aria-expanded={hamburgerOpen} onClick={() => setHamburgerOpen((value) => !value)}>{'☰'}</CgButton> : null}
    {plan.overflow.length > 0 ? <CgFlyout anchor={hamburgerRef} open={hamburgerOpen} onOpenChange={setHamburgerOpen} returnFocusOnClose placement="bottom-end">{surface(plan.overflow)}</CgFlyout> : null}
  </>;
  const common = {
    ...nativeProps,
    className: cx(styles.root, className),
    dir: resolvedDirection,
    'data-size': size,
    'data-disabled': disabled || undefined,
    'data-orientation': orientation,
  };
  return semanticMode === 'navigation'
    ? <nav {...common} ref={mergedRef} aria-label={ariaLabel}>{rootContent}</nav>
    : <div {...common} ref={mergedRef as ForwardedRef<HTMLDivElement>}>{rootContent}</div>;
}

function flattenPublicMenu<TData>(items: ReadonlyArray<CgMenuItem<TData>>): ReadonlyArray<CgMenuItem<TData>> {
  return items.flatMap((item) => [item, ...flattenPublicMenu(item.children ?? [])]);
}

export const CgMenu = forwardRef(CgMenuInner) as <TData = unknown>(
  props: CgMenuProps<TData> & RefAttributes<HTMLElement>,
) => ReactElement | null;
