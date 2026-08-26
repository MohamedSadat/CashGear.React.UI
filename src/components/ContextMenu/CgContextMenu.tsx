import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, RefAttributes } from 'react';
import { useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { flattenMenu, MenuSurface, normalizeMenuTree, proposeMenuCheck } from '../../internal';
import type { MenuDescriptor, MenuNode, MenuRenderContext } from '../../internal';
import type { CgFlyoutCloseReason } from '../Flyout';
import { CgFlyout } from '../Flyout';
import type { CgFlyoutActions, CgFlyoutAnchor } from '../Flyout';
import styles from './CgContextMenu.module.css';
import type {
  CgContextMenuActions,
  CgContextMenuCloseDetails,
  CgContextMenuCloseReason,
  CgContextMenuCommandDetails,
  CgContextMenuInvocation,
  CgContextMenuItem,
  CgContextMenuProps,
  CgContextMenuRenderContext,
  CgContextMenuShowOptions,
} from './CgContextMenu.types';

type ContextNodeData<TContext, TData> = CgContextMenuItem<TContext, TData>;

function descriptor<TContext, TData>(item: CgContextMenuItem<TContext, TData>): MenuDescriptor<ContextNodeData<TContext, TData>> {
  return {
    key: item.key,
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
    ...(item.checked !== undefined ? { checked: item.checked } : {}),
    ...(item.radioGroup !== undefined ? { radioGroup: item.radioGroup } : {}),
    data: item,
    ...(item.command ? { onActivate: () => undefined } : {}),
    ...(item.children !== undefined ? { children: item.children.map(descriptor) } : {}),
  };
}

function publicItems<TContext, TData>(nodes: ReadonlyArray<MenuNode<ContextNodeData<TContext, TData>>>): ReadonlyArray<CgContextMenuItem<TContext, TData>> {
  return nodes.filter((node) => node.data !== undefined).map(publicItem);
}

function publicItem<TContext, TData>(node: MenuNode<ContextNodeData<TContext, TData>>): CgContextMenuItem<TContext, TData> {
  const source = node.data!;
  return {
    ...source,
    key: node.key,
    text: node.text,
    checked: node.checked,
    children: publicItems(node.children),
  };
}

function normalize<TContext, TData>(items: ReadonlyArray<CgContextMenuItem<TContext, TData>>, confirm: CgContextMenuProps<TContext, TData>['confirm']) {
  const nodes = normalizeMenuTree(items.map(descriptor), {
    componentName: 'CgContextMenu', maxDepth: 32, allowFlat: false, allowBranchAction: false, pruneEmptyParents: true,
  });
  const confirmation = flattenMenu(nodes).find((node) => node.data?.confirmation);
  if (confirmation && !confirm) throw new Error(`CgContextMenu item '${confirmation.key}' requires the confirm callback.`);
  return nodes;
}

const FORCED_CLOSE = new Set<CgContextMenuCloseReason>(['navigation', 'ownerLoss', 'superseded', 'unmount']);

function CgContextMenuInner<TContext, TData>(
  {
    items,
    renderItem,
    renderItemText,
    renderSubmenu,
    beforeOpen,
    afterOpen,
    customizeMenu,
    beforeClose,
    afterClose,
    validateContext,
    confirm,
    beforeCommand,
    onItemActivate,
    afterCommand,
    commandFailure,
    closeOnItemClick = true,
    closeOnOutsideClick = true,
    closeOnEscape = true,
    closeOnFocusLoss = true,
    closeOnScroll = true,
    restoreFocus = true,
    typeahead = true,
    submenuOpenDelay = 150,
    loadingDelay = 150,
    loadingContent = 'Loading…',
    direction = 'auto',
    density = 'compact',
    ariaLabel = 'Context menu',
    minWidth = '190px',
    maxWidth = '360px',
    maxHeight = 'min(480px, calc(100vh - 8px))',
    zIndex,
    actionsRef,
    className,
    ...nativeProps
  }: CgContextMenuProps<TContext, TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (submenuOpenDelay < 0 || loadingDelay < 0) throw new RangeError('CgContextMenu delays cannot be negative.');
  const sourceNodes = useMemo(() => normalize(items, confirm), [confirm, items]);
  const [nodes, setNodes] = useState(sourceNodes);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [invocation, setInvocation] = useState<CgContextMenuInvocation<TContext>>();
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string>();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(surfaceRef, forwardedRef);
  const flyoutActions = useRef<CgFlyoutActions>(null);
  const generation = useRef(0);
  const invocationRef = useRef<CgContextMenuInvocation<TContext> | undefined>(undefined);
  const invocationController = useRef<AbortController | undefined>(undefined);
  const closingInvocation = useRef<CgContextMenuInvocation<TContext> | undefined>(undefined);
  const finalizedInvocations = useRef(new Set<number>());
  const pendingReason = useRef<CgContextMenuCloseReason>('programmatic');
  const pendingEvent = useRef<Event | undefined>(undefined);
  const mounted = useRef(true);
  const actualOpen = useRef(false);
  const executing = useRef(false);
  const resolvedDirection = useDirection(surfaceRef, direction);

  const setCurrentInvocation = useStableCallback((value: CgContextMenuInvocation<TContext> | undefined) => {
    invocationRef.current = value;
    setInvocation(value);
  });
  const closeDetails = useStableCallback((reason: CgContextMenuCloseReason, current: CgContextMenuInvocation<TContext> | undefined = invocationRef.current): CgContextMenuCloseDetails<TContext> | undefined => current ? {
    invocation: current, signal: current.signal, reason, ...(pendingEvent.current ? { event: pendingEvent.current } : {}),
  } : undefined);
  const finalizeClose = useStableCallback(async (current: CgContextMenuInvocation<TContext>, reason: CgContextMenuCloseReason) => {
    if (finalizedInvocations.current.has(current.id)) return;
    finalizedInvocations.current.add(current.id);
    if (invocationController.current?.signal === current.signal) invocationController.current.abort();
    if (invocationRef.current?.id === current.id) {
      setCurrentInvocation(undefined);
      setLoading(false);
      setExpanded(new Set());
      setBusyKey(undefined);
    }
    const details = closeDetails(reason, current);
    if (details) await afterClose?.(details);
  });
  const requestHide = useStableCallback(async (reason: CgContextMenuCloseReason = 'programmatic', ownerId?: string): Promise<boolean> => {
    const current = invocationRef.current;
    if (!current || ownerId && current.ownerId !== ownerId) return false;
    pendingReason.current = reason;
    closingInvocation.current = current;
    if (FORCED_CLOSE.has(reason) && invocationController.current?.signal === current.signal) invocationController.current.abort();
    if (!actualOpen.current) {
      if (invocationController.current?.signal === current.signal) invocationController.current.abort();
      await finalizeClose(current, reason);
      return true;
    }
    await flyoutActions.current?.close();
    if (actualOpen.current) return false;
    await finalizeClose(current, reason);
    return true;
  });
  const show = useStableCallback(async (
    anchor: CgFlyoutAnchor,
    context: TContext,
    options: CgContextMenuShowOptions = {},
    event?: MouseEvent<HTMLElement>,
  ): Promise<boolean> => {
    if (actualOpen.current || invocationRef.current) await requestHide('superseded');
    invocationController.current?.abort();
    const controller = new AbortController();
    invocationController.current = controller;
    const id = ++generation.current;
    const point = typeof anchor === 'object' && anchor !== null && 'x' in anchor
      ? anchor
      : { x: event?.clientX ?? 0, y: event?.clientY ?? 0 };
    const nextInvocation: CgContextMenuInvocation<TContext> = {
      id,
      kind: options.kind ?? 'programmatic',
      context,
      anchor,
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
      clientX: point.x,
      clientY: point.y,
      button: event?.button ?? 0,
      ctrlKey: event?.ctrlKey ?? false,
      shiftKey: event?.shiftKey ?? false,
      altKey: event?.altKey ?? false,
      metaKey: event?.metaKey ?? false,
      signal: controller.signal,
    };
    setCurrentInvocation(nextInvocation);
    setExpanded(new Set());
    setBusyKey(undefined);
    let loadingTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
      if (generation.current !== id || controller.signal.aborted) return;
      setLoading(true);
      void flyoutActions.current?.open();
    }, loadingDelay);
    try {
      const accepted = await beforeOpen?.({ invocation: nextInvocation, signal: controller.signal });
      if (accepted === false || controller.signal.aborted || generation.current !== id) {
        controller.abort();
        if (invocationRef.current?.id === id) setCurrentInvocation(undefined);
        setLoading(false);
        return false;
      }
      const snapshot = publicItems(sourceNodes);
      const customized = await customizeMenu?.({ invocation: nextInvocation, signal: controller.signal, items: snapshot });
      if (controller.signal.aborted || generation.current !== id) return false;
      const nextNodes = normalize(customized ?? snapshot, confirm);
      if (nextNodes.length === 0) {
        controller.abort();
        if (invocationRef.current?.id === id) setCurrentInvocation(undefined);
        setLoading(false);
        return false;
      }
      if (loadingTimer) { clearTimeout(loadingTimer); loadingTimer = undefined; }
      setNodes(nextNodes);
      setLoading(false);
      await flyoutActions.current?.open();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!controller.signal.aborted && generation.current === id) {
        flyoutActions.current?.focusFirst();
        await afterOpen?.({ invocation: nextInvocation, signal: controller.signal });
      }
      return true;
    } catch (error) {
      if (!controller.signal.aborted) {
        controller.abort();
        if (invocationRef.current?.id === id) {
          if (actualOpen.current) await requestHide('superseded');
          else setCurrentInvocation(undefined);
          setLoading(false);
        }
        throw error;
      }
      return false;
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
    }
  });
  useImperativeHandle(actionsRef, (): CgContextMenuActions<TContext> => ({
    showFromEvent: (event, context, options) => { event.preventDefault(); return show({ x: event.clientX, y: event.clientY }, context, { kind: options?.kind ?? 'pointer', ...options }, event); },
    showAt: (x, y, context, options) => show({ x, y }, context, options),
    showAtPoint: (point, context, options) => show(point, context, options),
    showAtRectangle: (rectangle, context, options) => show(rectangle, context, options),
    showNear: (anchor, context, options) => show(anchor, context, options),
    toggleAtPoint: async (point, context, options) => actualOpen.current ? requestHide() : show(point, context, options),
    toggleAtRectangle: async (rectangle, context, options) => actualOpen.current ? requestHide() : show(rectangle, context, options),
    toggleNear: async (anchor, context, options) => actualOpen.current ? requestHide() : show(anchor, context, options),
    hide: requestHide,
    reposition: () => flyoutActions.current?.reposition(),
  }), [requestHide, show]);
  useEffect(() => () => {
    mounted.current = false;
    const current = invocationRef.current;
    const details = closeDetails('unmount', current);
    invocationController.current?.abort();
    if (details && actualOpen.current) void Promise.resolve(afterClose?.(details)).catch(() => undefined);
  }, [afterClose, closeDetails]);

  const activate = async (node: MenuNode<ContextNodeData<TContext, TData>>, source: 'pointer' | 'keyboard', event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (!invocation || executing.current || node.disabled || node.children.length > 0) return;
    executing.current = true;
    const snapshot = nodes;
    const proposed = proposeMenuCheck(nodes, node.key);
    const proposedNode = flattenMenu(proposed).find((candidate) => candidate.key === node.key) ?? node;
    const details: CgContextMenuCommandDetails<TContext, TData> = {
      invocation,
      signal: invocation.signal,
      item: publicItem(proposedNode),
      ...(node.data?.commandParameter !== undefined ? { commandParameter: node.data.commandParameter } : {}),
      source,
      event,
    };
    setBusyKey(node.key);
    try {
      if (validateContext && !await validateContext(details)) return;
      if (node.data?.confirmation && !await confirm!(node.data.confirmation, details)) return;
      setNodes(proposed);
      if (await beforeCommand?.(details) === false) { setNodes(snapshot); return; }
      await onItemActivate?.(details);
      await node.data?.command?.(details);
      await afterCommand?.(details);
      if (closeOnItemClick) await requestHide('item');
    } catch (error) {
      setNodes(snapshot);
      try { await commandFailure?.({ ...details, error }); } catch { /* Failure observers are terminal. */ }
    } finally {
      executing.current = false;
      if (mounted.current) setBusyKey(undefined);
    }
  };
  const mapReason = (reason: CgFlyoutCloseReason): CgContextMenuCloseReason => {
    switch (reason) {
      case 'outsideClick': return 'outsideClick';
      case 'escape': return 'escape';
      case 'scroll': return 'scroll';
      case 'focusLoss': return 'focusLoss';
      case 'superseded': return 'superseded';
      case 'anchorLost': return 'ownerLoss';
      default: return pendingReason.current;
    }
  };
  const renderContext = (context: MenuRenderContext<ContextNodeData<TContext, TData>>): CgContextMenuRenderContext<TContext, TData> => ({
    ...context,
    item: publicItem(context.item),
    invocation: invocation!,
  });
  const anchor = invocation?.anchor ?? { x: 0, y: 0 };
  return (
    <CgFlyout
      ref={mergedRef}
      {...nativeProps}
      anchor={anchor}
      actionsRef={flyoutActions}
      className={className}
      placement="bottom-start"
      minWidth={minWidth}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      closeOnOutsideClick={closeOnOutsideClick}
      closeOnEscape={closeOnEscape}
      closeOnScroll={closeOnScroll}
      closeOnFocusLoss={closeOnFocusLoss}
      returnFocusOnClose={restoreFocus}
      exclusiveGroup="cg-context-menu-root"
      zIndex={zIndex}
      onBeforeClose={async (details) => {
        const reason = mapReason(details.reason);
        pendingEvent.current = details.event instanceof Event ? details.event : undefined;
        const contextDetails = closeDetails(reason);
        if (!contextDetails || FORCED_CLOSE.has(reason)) return;
        return beforeClose?.(contextDetails);
      }}
      onOpenChange={(open) => { actualOpen.current = open; }}
      onAfterClose={async (details) => {
        actualOpen.current = false;
        const reason = mapReason(details.reason);
        const closed = closingInvocation.current ?? invocationRef.current;
        closingInvocation.current = undefined;
        if (closed) await finalizeClose(closed, reason);
      }}
      data-density={density}
    >
      {loading ? <div className={styles.loading} role="status" aria-busy="true"><span className={styles.spinner} aria-hidden="true" />{loadingContent}</div> : invocation ? (
        <div className={styles.surface}>
          <MenuSurface
            items={nodes}
            ariaLabel={ariaLabel}
            direction={resolvedDirection}
            expandedKeys={expanded}
            onExpandedKeysChange={setExpanded}
            onActivate={activate}
            renderItem={renderItem ? (context) => renderItem(renderContext(context)) : undefined}
            renderText={renderItemText ? (context) => renderItemText(renderContext(context)) : undefined}
            renderSubmenu={renderSubmenu ? ({ parent, level, childContent }) => renderSubmenu({ parent: publicItem(parent), level, childContent }) : undefined}
            submenuTrigger="hover"
            openDelay={submenuOpenDelay}
            closeDelay={250}
            busyKey={busyKey}
            typeaheadEnabled={typeahead}
            onCloseRoot={(reason) => { void requestHide(reason); }}
          />
        </div>
      ) : null}
    </CgFlyout>
  );
}

export const CgContextMenu = forwardRef(CgContextMenuInner) as <TContext, TData = unknown>(
  props: CgContextMenuProps<TContext, TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
