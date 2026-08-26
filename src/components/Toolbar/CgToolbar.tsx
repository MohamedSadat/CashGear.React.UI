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
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import {
  planToolbarLayout,
  renderIcon,
  TOOLBAR_FIRST_OVERFLOW_STAGE,
  TOOLBAR_ICON_STAGE,
  validateMenuUrl,
} from '../../internal';
import type { ToolbarLayoutItem, ToolbarPlacement } from '../../internal';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgDropDownButton } from '../DropDownButton';
import type { CgButtonMenuActions, CgButtonMenuItem, CgButtonMenuItemClickDetails, CgButtonMenuRenderContext } from '../DropDownButton';
import { CgSplitButton } from '../SplitButton';
import styles from './CgToolbar.module.css';
import type {
  CgToolbarActions,
  CgToolbarItem,
  CgToolbarItemActivationDetails,
  CgToolbarProps,
} from './CgToolbar.types';

type ToolbarNode<TData> = Omit<CgToolbarItem<TData>, 'children' | 'visible' | 'disabled' | 'alignment' | 'adaptivePriority' | 'overflowBehavior' | 'allowTextCollapse'> & {
  readonly name: string;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly alignment: 'start' | 'end';
  readonly adaptivePriority: number;
  readonly overflowBehavior: 'auto' | 'never' | 'always';
  readonly allowTextCollapse: boolean;
  readonly declarationIndex: number;
  readonly children: ReadonlyArray<ToolbarNode<TData>>;
};

function normalizeToolbarItems<TData>(items: ReadonlyArray<CgToolbarItem<TData>>): ReadonlyArray<ToolbarNode<TData>> {
  const names = new Set<string>();
  const ancestry = new Set<CgToolbarItem<TData>>();
  const all: ToolbarNode<TData>[] = [];
  let declarationIndex = 0;
  const clone = (item: CgToolbarItem<TData>, depth: number): ToolbarNode<TData> => {
    if (depth >= 3) throw new Error(`CgToolbar item '${item.name}' exceeds 3 levels.`);
    if (ancestry.has(item)) throw new Error('CgToolbar contains a cyclic children reference.');
    const name = item.name.trim();
    if (!name) throw new Error('CgToolbar items require a non-empty name.');
    if (names.has(name)) throw new Error(`CgToolbar contains duplicate name '${name}'.`);
    names.add(name);
    if (depth > 0 && item.alignment === 'end') throw new Error(`CgToolbar item '${name}' sets alignment below the root.`);
    if (item.radioGroup?.trim() && item.checked === undefined) throw new Error(`CgToolbar item '${name}' sets radioGroup without checked state.`);
    if (item.render && (item.children?.length || item.icon !== undefined || item.text !== undefined || item.adaptiveText !== undefined)) {
      throw new Error(`CgToolbar custom item '${name}' cannot combine render with text, icon, or children.`);
    }
    ancestry.add(item);
    const children = (item.children ?? []).map((child) => clone(child, depth + 1));
    ancestry.delete(item);
    if (children.length > 0 && item.checked !== undefined) throw new Error(`CgToolbar branch '${name}' cannot be checkable.`);
    if (children.length > 0 && item.navigateUrl !== undefined) throw new Error(`CgToolbar branch '${name}' cannot navigate.`);
    if (depth > 0 && children.length > 0 && item.onClick !== undefined) {
      throw new Error(`CgToolbar nested branch '${name}' cannot define a primary action.`);
    }
    const navigateUrl = validateMenuUrl(item.navigateUrl, 'CgToolbar');
    const node: ToolbarNode<TData> = Object.freeze({
      ...item,
      name,
      visible: item.visible !== false,
      disabled: item.disabled === true,
      alignment: depth === 0 ? item.alignment ?? 'start' : 'start',
      adaptivePriority: item.adaptivePriority ?? 0,
      overflowBehavior: item.overflowBehavior ?? 'auto',
      allowTextCollapse: item.allowTextCollapse !== false,
      ...(navigateUrl !== undefined ? { navigateUrl } : {}),
      declarationIndex: declarationIndex++,
      children: Object.freeze(children),
    });
    all.push(node);
    return node;
  };
  const roots = items.map((item) => clone(item, 0));
  const checkedGroups = new Map<string, number>();
  for (const node of all) {
    const group = node.radioGroup?.trim();
    if (group && node.checked) checkedGroups.set(group, (checkedGroups.get(group) ?? 0) + 1);
  }
  for (const [group, count] of checkedGroups) {
    if (count > 1) throw new Error(`CgToolbar radio group '${group}' has more than one checked item.`);
  }
  return Object.freeze(roots);
}

function publicItem<TData>(node: ToolbarNode<TData>): CgToolbarItem<TData> {
  return { ...node, children: node.children.map(publicItem) };
}

function toMenuItem<TData>(node: ToolbarNode<TData>): CgButtonMenuItem<ToolbarNode<TData>> {
  return {
    key: node.name,
    text: node.text ?? node.adaptiveText ?? node.tooltip ?? node.name,
    ...(node.icon !== undefined ? { icon: node.icon } : {}),
    visible: node.visible,
    disabled: node.disabled || node.busy === true,
    beginGroup: node.beginGroup,
    ...(node.tooltip !== undefined ? { tooltip: node.tooltip } : {}),
    ...(node.className !== undefined ? { className: node.className } : {}),
    ...(node.navigateUrl !== undefined ? { navigateUrl: node.navigateUrl } : {}),
    ...(node.target && node.target !== '_self' ? { target: node.target } : {}),
    ...(node.checked !== undefined ? { checked: node.checked } : {}),
    ...(node.radioGroup?.trim() ? { radioGroup: node.radioGroup.trim() } : {}),
    data: node,
    ...(node.children.length > 0 ? { children: node.children.map(toMenuItem) } : {}),
  };
}

function toLayoutItem<TData>(node: ToolbarNode<TData>): ToolbarLayoutItem {
  return {
    name: node.name,
    visible: node.visible,
    alignment: node.alignment,
    adaptivePriority: node.adaptivePriority,
    overflowBehavior: node.overflowBehavior,
    allowTextCollapse: node.allowTextCollapse,
    hasIcon: node.icon !== undefined,
    hasAdaptiveText: Boolean(node.adaptiveText?.trim()),
    custom: node.render !== undefined,
    declarationIndex: node.declarationIndex,
  };
}

function CgToolbarInner<TData>(
  {
    title,
    renderTitle,
    items,
    startContent,
    endContent,
    onItemClick,
    onItemError,
    size = 'medium',
    defaultItemAppearance = 'ghost',
    autoCollapseText = true,
    autoOverflow = true,
    minimumVisibleItemCount = 0,
    direction = 'auto',
    ariaLabel = 'Toolbar',
    overflowButtonLabel = 'More commands',
    overflowButtonContent = '⋯',
    actionsRef,
    className,
    onKeyDown,
    ...nativeProps
  }: CgToolbarProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!Number.isInteger(minimumVisibleItemCount) || minimumVisibleItemCount < 0) {
    throw new RangeError('CgToolbar minimumVisibleItemCount must be a nonnegative integer.');
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const nodes = useMemo(() => normalizeToolbarItems(items), [items]);
  const byName = useMemo(() => new Map(nodes.map((node) => [node.name, node])), [nodes]);
  const layoutItems = useMemo(() => nodes.map(toLayoutItem), [nodes]);
  const [stage, setStage] = useState(0);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [busyNames, setBusyNames] = useState<ReadonlySet<string>>(new Set());
  const [activeName, setActiveName] = useState<string>();
  const executing = useRef(new Set<string>());
  const itemElements = useRef(new Map<string, HTMLElement>());
  const menuActions = useRef(new Map<string, CgButtonMenuActions>());
  const overflowActions = useRef<CgButtonMenuActions>(null);
  const minimumWidths = useRef(new Map<number, number>());

  const plan = useMemo(() => planToolbarLayout(layoutItems, stage, minimumVisibleItemCount), [layoutItems, minimumVisibleItemCount, stage]);
  const effectivePlan = useMemo(() => {
    const effectiveStage = !autoCollapseText && !autoOverflow
      ? 0
      : !autoOverflow
        ? Math.min(stage, TOOLBAR_ICON_STAGE)
        : !autoCollapseText && stage < TOOLBAR_FIRST_OVERFLOW_STAGE
          ? 0
          : stage;
    return effectiveStage === plan.stage ? plan : planToolbarLayout(layoutItems, effectiveStage, minimumVisibleItemCount);
  }, [autoCollapseText, autoOverflow, layoutItems, minimumVisibleItemCount, plan, stage]);
  const focusOrder = useMemo(() => {
    const order = [...effectivePlan.start, ...effectivePlan.end]
      .map((placement) => placement.name)
      .filter((name) => !byName.get(name)?.disabled && !byName.get(name)?.busy);
    if (effectivePlan.overflow.length > 0) order.push('__overflow');
    return order;
  }, [byName, effectivePlan]);
  const resolvedActiveName = activeName && focusOrder.includes(activeName) ? activeName : focusOrder[0];

  const closeMenus = useStableCallback(() => {
    menuActions.current.forEach((actions) => actions.hide());
    overflowActions.current?.hide();
  });
  const focusControl = useStableCallback((requestedName: string) => {
    const name = effectivePlan.overflow.includes(requestedName) ? '__overflow' : requestedName;
    setActiveName(name);
    if (name === '__overflow') overflowActions.current?.focus();
    else if (menuActions.current.has(name)) menuActions.current.get(name)?.focus();
    else itemElements.current.get(name)?.focus({ preventScroll: true });
  });

  const execute = useStableCallback(async (
    node: ToolbarNode<TData>,
    source: 'pointer' | 'keyboard',
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    isOverflowItem: boolean,
    isMenuItem: boolean,
    navigate: boolean,
  ): Promise<boolean> => {
    if (!node.visible || node.disabled || node.busy || executing.current.has(node.name)) return false;
    if (node.suppressDuplicateClicks !== false) executing.current.add(node.name);
    if (node.autoBusy) setBusyNames((current) => new Set(current).add(node.name));
    const isRadio = Boolean(node.radioGroup?.trim());
    const proposedChecked = node.checked === undefined ? undefined : isRadio ? true : !node.checked;
    const details: CgToolbarItemActivationDetails<TData> = {
      item: publicItem(node), source, event, isOverflowItem, isMenuItem,
      ...(proposedChecked !== undefined ? { proposedChecked } : {}),
    };
    try {
      await node.onClick?.(details);
      await onItemClick?.(details);
      if (proposedChecked !== undefined && !(isRadio && node.checked)) await node.onCheckedChange?.(proposedChecked, details);
      if (navigate && node.navigateUrl && typeof window !== 'undefined') window.location.assign(node.navigateUrl);
      return true;
    } catch (error) {
      onItemError?.(error, details);
      return false;
    } finally {
      executing.current.delete(node.name);
      setBusyNames((current) => {
        if (!current.has(node.name)) return current;
        const next = new Set(current); next.delete(node.name); return next;
      });
      if (isMenuItem) closeMenus();
    }
  });

  const overflowNodes = useMemo(() => effectivePlan.overflow.map((name) => byName.get(name)!).filter(Boolean), [byName, effectivePlan.overflow]);
  const overflowItems = useMemo(() => overflowNodes.map(toMenuItem), [overflowNodes]);
  const menuItems = useMemo(() => new Map(nodes.filter((node) => node.children.length > 0).map((node) => [node.name, node.children.map(toMenuItem)])), [nodes]);
  const activateMenuItem = useStableCallback(async (details: CgButtonMenuItemClickDetails<ToolbarNode<TData>>, isOverflowItem: boolean) => {
    const node = details.item.data;
    if (!node) return;
    await execute(node, details.source, details.event, isOverflowItem, true, false);
  });
  const renderMenuItem = useCallback((context: CgButtonMenuRenderContext<ToolbarNode<TData>>, isOverflowItem: boolean): ReactNode => {
    const node = context.item.data;
    if (!node?.render) return context.defaultContent;
    const eventActivate = async (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
      await execute(node, 'key' in event.nativeEvent ? 'keyboard' : 'pointer', event, isOverflowItem, true, false);
    };
    return node.render({
      item: publicItem(node), displayMode: 'full', isOverflowItem,
      busy: context.busy || node.busy === true || busyNames.has(node.name),
      defaultContent: context.defaultContent,
      activate: eventActivate,
    });
  }, [busyNames, execute]);

  const nextNarrowerStage = useCallback((current: number) => {
    if (autoCollapseText && current < TOOLBAR_ICON_STAGE) return current + 1;
    if (autoOverflow && current < plan.maxStage) return Math.max(TOOLBAR_FIRST_OVERFLOW_STAGE, current + 1);
    return current;
  }, [autoCollapseText, autoOverflow, plan.maxStage]);
  const nextWiderStage = useCallback((current: number) => {
    if (current >= TOOLBAR_FIRST_OVERFLOW_STAGE) return current === TOOLBAR_FIRST_OVERFLOW_STAGE ? (autoCollapseText ? TOOLBAR_ICON_STAGE : 0) : current - 1;
    if (autoCollapseText && current > 0) return current - 1;
    return current;
  }, [autoCollapseText]);
  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root || root.clientWidth <= 0 || (!autoCollapseText && !autoOverflow)) return;
    const required = root.scrollWidth;
    const available = root.clientWidth;
    minimumWidths.current.set(stage, required);
    if (required > available + 1) {
      setStage((current) => nextNarrowerStage(current));
      return;
    }
    const wider = nextWiderStage(stage);
    const widerRequirement = minimumWidths.current.get(wider);
    if (wider !== stage && widerRequirement !== undefined && available >= widerRequirement) setStage(wider);
  }, [autoCollapseText, autoOverflow, nextNarrowerStage, nextWiderStage, stage]);
  useLayoutEffect(() => measure(), [effectivePlan, layoutRevision, measure]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || (!autoCollapseText && !autoOverflow) || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [autoCollapseText, autoOverflow, measure]);

  const recalculateLayout = useStableCallback(() => {
    minimumWidths.current.clear();
    setStage(0);
    setLayoutRevision((revision) => revision + 1);
  });
  useImperativeHandle(actionsRef, (): CgToolbarActions => ({
    focus: () => { if (resolvedActiveName) focusControl(resolvedActiveName); },
    focusItem: focusControl,
    closeMenus,
    recalculateLayout,
  }), [closeMenus, focusControl, recalculateLayout, resolvedActiveName]);

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-cg-toolbar-name]') : null;
    const name = target?.dataset.cgToolbarName;
    if (!name || !focusOrder.includes(name)) return;
    const current = focusOrder.indexOf(name);
    let next: number | undefined;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = focusOrder.length - 1;
    else if (event.key === 'ArrowRight') next = (current + (resolvedDirection === 'rtl' ? -1 : 1) + focusOrder.length) % focusOrder.length;
    else if (event.key === 'ArrowLeft') next = (current + (resolvedDirection === 'rtl' ? 1 : -1) + focusOrder.length) % focusOrder.length;
    else if (event.key === 'ArrowDown') {
      const actions = name === '__overflow' ? overflowActions.current : menuActions.current.get(name);
      if (actions) { event.preventDefault(); actions.show(); }
      return;
    } else if (event.key === 'Escape') {
      closeMenus();
      focusControl(name);
      return;
    }
    if (next !== undefined) {
      event.preventDefault();
      const nextName = focusOrder[next];
      if (nextName) focusControl(nextName);
    }
  };

  const commonControlProps = (node: ToolbarNode<TData>) => ({
    tabIndex: resolvedActiveName === node.name ? 0 : -1,
    'data-cg-toolbar-name': node.name,
    onFocus: () => setActiveName(node.name),
    title: node.tooltip,
    'aria-label': node.text ? undefined : node.tooltip ?? node.name,
  });

  const renderPlacement = (placement: ToolbarPlacement) => {
    const node = byName.get(placement.name)!;
    const displayMode = placement.displayMode;
    const label = displayMode === 'icon-only' ? null : displayMode === 'adaptive' ? node.adaptiveText ?? node.text : node.text;
    const busy = node.busy === true || busyNames.has(node.name);
    const controlProps = {
      ...commonControlProps(node),
      'aria-label': displayMode === 'icon-only' ? node.tooltip ?? node.text ?? node.name : node.text ? undefined : node.tooltip ?? node.name,
    };
    const checkProps = node.checked === undefined ? {} : node.radioGroup?.trim()
      ? { role: 'radio', 'aria-checked': node.checked }
      : { 'aria-pressed': node.checked };
    if (node.render) {
      const defaultContent = <>{node.icon ? <span className={styles.icon}>{renderIcon(node.icon)}</span> : null}{label}</>;
      return <div
        key={node.name}
        {...controlProps}
        className={cx(styles.custom, node.className, busy && styles.busy)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault(); void execute(node, 'keyboard', event, false, false, false);
        }}
      >{node.render({ item: publicItem(node), displayMode, isOverflowItem: false, busy, defaultContent, activate: (event) => execute(node, 'key' in event.nativeEvent ? 'keyboard' : 'pointer', event, false, false, false).then(() => undefined) })}</div>;
    }
    if (node.navigateUrl) {
      return <a
        key={node.name}
        {...controlProps}
        {...checkProps}
        ref={(element) => { if (element) itemElements.current.set(node.name, element); else itemElements.current.delete(node.name); }}
        className={cx(styles.link, node.checked && styles.checked, node.className)}
        href={node.navigateUrl}
        target={node.target}
        aria-disabled={node.disabled || busy || undefined}
        onClick={(event) => {
          if (node.disabled || busy) { event.preventDefault(); return; }
          const plain = event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (!node.target || node.target === '_self');
          if (plain) event.preventDefault();
          void execute(node, event.detail === 0 ? 'keyboard' : 'pointer', event, false, false, plain);
        }}
      >{node.icon ? <span className={styles.icon}>{renderIcon(node.icon)}</span> : null}{label}</a>;
    }
    const children = menuItems.get(node.name);
    if (children && node.onClick) {
      return <CgSplitButton<ToolbarNode<TData>>
        key={node.name}
        {...controlProps}
        {...checkProps}
        ref={(element) => { if (element) itemElements.current.set(node.name, element); else itemElements.current.delete(node.name); }}
        actionsRef={(actions) => { if (actions) menuActions.current.set(node.name, actions); else menuActions.current.delete(node.name); }}
        items={children}
        renderItem={(context) => renderMenuItem(context, false)}
        onItemClick={(details) => activateMenuItem(details, false)}
        appearance={node.appearance ?? defaultItemAppearance}
        intent="neutral"
        size={size}
        icon={node.icon}
        disabled={node.disabled}
        loading={busy}
        autoLoading={false}
        suppressDuplicateClicks={node.suppressDuplicateClicks}
        toggleTabIndex={-1}
        type={node.type}
        className={cx(node.className, node.checked && styles.checked)}
        onClick={(event) => execute(node, event.detail === 0 ? 'keyboard' : 'pointer', event, false, false, false).then(() => undefined)}
      >{label}</CgSplitButton>;
    }
    if (children) {
      return <CgDropDownButton<ToolbarNode<TData>>
        key={node.name}
        {...controlProps}
        ref={(element) => { if (element) itemElements.current.set(node.name, element); else itemElements.current.delete(node.name); }}
        actionsRef={(actions) => { if (actions) menuActions.current.set(node.name, actions); else menuActions.current.delete(node.name); }}
        items={children}
        renderItem={(context) => renderMenuItem(context, false)}
        onItemClick={(details) => activateMenuItem(details, false)}
        appearance={node.appearance ?? defaultItemAppearance}
        size={size}
        icon={node.icon}
        disabled={node.disabled}
        className={node.className}
      >{label}</CgDropDownButton>;
    }
    return <CgButton
      key={node.name}
      {...controlProps}
      {...checkProps}
      ref={(element) => { if (element) itemElements.current.set(node.name, element); else itemElements.current.delete(node.name); }}
      appearance={node.appearance ?? defaultItemAppearance}
      size={size}
      icon={node.icon}
      disabled={node.disabled}
      loading={busy}
      autoLoading={false}
      suppressDuplicateClicks={node.suppressDuplicateClicks}
      type={node.type}
      className={cx(node.className, node.checked && styles.checked)}
      onClick={(event) => execute(node, event.detail === 0 ? 'keyboard' : 'pointer', event, false, false, false).then(() => undefined)}
    >{label}</CgButton>;
  };

  const renderRail = (placements: ReadonlyArray<ToolbarPlacement>, railClass?: string) => <div className={cx(styles.rail, railClass)}>
    {placements.map((placement, index) => {
      const node = byName.get(placement.name)!;
      return <span key={node.name} className={styles.custom}>
        {index > 0 && node.beginGroup ? <span className={styles.separator} role="separator" aria-orientation="vertical" /> : null}
        {renderPlacement(placement)}
      </span>;
    })}
  </div>;

  return <div
    {...nativeProps}
    ref={mergedRef}
    role="toolbar"
    aria-label={ariaLabel}
    dir={resolvedDirection}
    className={cx(styles.root, className)}
    data-cg-toolbar-stage={effectivePlan.stage}
    onKeyDown={handleToolbarKeyDown}
  >
    {renderTitle ? <div className={styles.title}>{renderTitle()}</div> : title !== undefined ? <div className={styles.title}>{title}</div> : null}
    <div className={styles.rails}>
      {startContent !== undefined ? <div className={styles.custom}>{startContent}</div> : null}
      {renderRail(effectivePlan.start)}
      {renderRail(effectivePlan.end, styles.end)}
      {endContent !== undefined ? <div className={styles.custom}>{endContent}</div> : null}
      {overflowItems.length > 0 ? <CgDropDownButton<ToolbarNode<TData>>
        ref={(element) => { if (element) itemElements.current.set('__overflow', element); else itemElements.current.delete('__overflow'); }}
        actionsRef={overflowActions}
        items={overflowItems}
        renderItem={(context) => renderMenuItem(context, true)}
        onItemClick={(details) => activateMenuItem(details, true)}
        appearance={defaultItemAppearance}
        size={size}
        tabIndex={resolvedActiveName === '__overflow' ? 0 : -1}
        data-cg-toolbar-name="__overflow"
        aria-label={overflowButtonLabel}
        onFocus={() => setActiveName('__overflow')}
      >{overflowButtonContent}</CgDropDownButton> : null}
    </div>
  </div>;
}

export const CgToolbar = forwardRef(CgToolbarInner) as <TData = unknown>(
  props: CgToolbarProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
