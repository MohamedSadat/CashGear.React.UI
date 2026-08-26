import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from 'react';
import { flattenMenu, MenuSurface, normalizeMenuTree, proposeMenuCheck } from '../../internal';
import type { MenuDescriptor, MenuNode, MenuRenderContext } from '../../internal';
import { CgFlyout } from '../Flyout';
import type { CgFlyoutActions, CgFlyoutPlacement } from '../Flyout';
import type {
  CgButtonFlyoutContext,
  CgButtonMenuActivationResult,
  CgButtonMenuItem,
  CgButtonMenuItemClickDetails,
  CgButtonMenuRenderContext,
} from './CgDropDownButton.types';

interface ButtonMenuProps<TData> {
  id: string;
  anchorRef: RefObject<HTMLElement | null>;
  items?: ReadonlyArray<CgButtonMenuItem<TData>>;
  renderItem?: (context: CgButtonMenuRenderContext<TData>) => ReactNode;
  renderFlyout?: (context: CgButtonFlyoutContext) => ReactNode;
  open: boolean;
  requestOpen: (open: boolean) => void;
  placement: CgFlyoutPlacement;
  flipOnOverflow: boolean;
  shiftOnOverflow: boolean;
  offset: number;
  matchAnchorWidth: boolean;
  minWidth: string | number | undefined;
  maxWidth: string | number | undefined;
  maxHeight: string | number | undefined;
  direction: 'ltr' | 'rtl';
  closeOnItemClick: boolean;
  zIndex?: number;
  ariaLabel: string;
  onItemClick?: (details: CgButtonMenuItemClickDetails<TData>) => void | CgButtonMenuActivationResult | PromiseLike<void | CgButtonMenuActivationResult>;
  onItemError?: (error: unknown, details: CgButtonMenuItemClickDetails<TData>) => void;
}

function descriptor<TData>(item: CgButtonMenuItem<TData>): MenuDescriptor<CgButtonMenuItem<TData>> {
  return {
    key: item.key, text: item.text,
    ...(item.icon !== undefined ? { icon: item.icon } : {}),
    visible: item.visible, disabled: item.disabled, beginGroup: item.beginGroup, separator: item.separator,
    ...(item.tooltip !== undefined ? { tooltip: item.tooltip } : {}),
    ...(item.className !== undefined ? { className: item.className } : {}),
    ...(item.intent !== undefined ? { intent: item.intent } : {}),
    ...(item.badge !== undefined ? { badge: item.badge } : {}),
    ...(item.shortcut !== undefined ? { shortcut: item.shortcut } : {}),
    ...(item.navigateUrl !== undefined ? { href: item.navigateUrl } : {}),
    ...(item.target !== undefined ? { target: item.target } : {}),
    ...(item.checked !== undefined ? { checked: item.checked } : {}),
    ...(item.radioGroup !== undefined ? { radioGroup: item.radioGroup } : {}),
    data: item,
    ...(item.onClick ? { onActivate: () => undefined } : {}),
    ...(item.children !== undefined ? { children: item.children.map(descriptor) } : {}),
  };
}

export function publicButtonMenuItem<TData>(node: MenuNode<CgButtonMenuItem<TData>>): CgButtonMenuItem<TData> {
  return { ...node.data!, key: node.key, text: node.text, checked: node.checked, children: node.children.map(publicButtonMenuItem) };
}

export function normalizeButtonMenu<TData>(items: ReadonlyArray<CgButtonMenuItem<TData>> = []) {
  return normalizeMenuTree(items.map(descriptor), {
    componentName: 'Button menu', maxDepth: 16, allowFlat: false, allowBranchAction: false, pruneEmptyParents: true,
  });
}

function keepOpen(result: void | CgButtonMenuActivationResult): boolean { return result?.keepOpen === true; }

export function ButtonMenu<TData>({
  id,
  anchorRef,
  items,
  renderItem,
  renderFlyout,
  open,
  requestOpen,
  placement,
  flipOnOverflow,
  shiftOnOverflow,
  offset,
  matchAnchorWidth,
  minWidth,
  maxWidth,
  maxHeight,
  direction,
  closeOnItemClick,
  zIndex,
  ariaLabel,
  onItemClick,
  onItemError,
}: ButtonMenuProps<TData>) {
  if (items !== undefined && renderFlyout !== undefined) throw new Error('Button menu items and arbitrary flyout content are mutually exclusive.');
  const nodes = useMemo(() => normalizeButtonMenu(items), [items]);
  const [snapshotState, setSnapshotState] = useState(() => ({ source: nodes, items: nodes }));
  const snapshot = snapshotState.source === nodes ? snapshotState.items : nodes;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string>();
  const executing = useRef(false);
  const flyout = useRef<CgFlyoutActions>(null);
  const close = useCallback(() => { setExpanded(new Set()); requestOpen(false); }, [requestOpen]);
  const reposition = useCallback(() => flyout.current?.reposition(), []);
  const context = useMemo<CgButtonFlyoutContext>(() => ({ open, close, reposition }), [close, open, reposition]);
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => flyout.current?.focusFirst());
    return () => cancelAnimationFrame(frame);
  }, [open]);
  const activate = async (node: MenuNode<CgButtonMenuItem<TData>>, source: 'pointer' | 'keyboard', event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (executing.current || node.disabled || node.children.length > 0) return;
    executing.current = true;
    const proposed = proposeMenuCheck(snapshot, node.key);
    const proposedNode = flattenMenu(proposed).find((candidate) => candidate.key === node.key) ?? node;
    const details: CgButtonMenuItemClickDetails<TData> = {
      item: publicButtonMenuItem(proposedNode), source, event,
      ...(node.checked !== undefined ? { proposedChecked: proposedNode.checked } : {}),
    };
    setBusyKey(node.key);
    const nativeMouse = 'button' in event;
    const plainNavigation = Boolean(node.href && (!nativeMouse || event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) && !node.target);
    if (plainNavigation) event.preventDefault();
    try {
      setSnapshotState({ source: nodes, items: proposed });
      const itemResult = await node.data?.onClick?.(details);
      await node.data?.onCheckedChange?.(proposedNode.checked ?? false, details);
      const globalResult = await onItemClick?.(details);
      const shouldKeepOpen = keepOpen(itemResult) || keepOpen(globalResult);
      if (plainNavigation && node.href && typeof window !== 'undefined') window.location.assign(node.href);
      if (closeOnItemClick && !shouldKeepOpen) close();
    } catch (error) {
      setSnapshotState({ source: nodes, items: nodes });
      onItemError?.(error, details);
    } finally {
      executing.current = false;
      setBusyKey(undefined);
    }
  };
  const renderContext = (value: MenuRenderContext<CgButtonMenuItem<TData>>): CgButtonMenuRenderContext<TData> => ({
    ...value, item: publicButtonMenuItem(value.item),
  });
  return (
    <CgFlyout
      id={id}
      anchor={anchorRef}
      actionsRef={flyout}
      open={open}
      onOpenChange={requestOpen}
      placement={placement}
      flipOnOverflow={flipOnOverflow}
      shiftOnOverflow={shiftOnOverflow}
      offset={offset}
      matchAnchorWidth={matchAnchorWidth}
      minWidth={minWidth}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      zIndex={zIndex}
      returnFocusOnClose
    >
      {/* The render context intentionally exposes deferred imperative helpers. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {renderFlyout ? <div role="dialog" aria-label={ariaLabel}>{renderFlyout(context)}</div> : (
        <MenuSurface
          items={snapshot}
          ariaLabel={ariaLabel}
          direction={direction}
          expandedKeys={expanded}
          onExpandedKeysChange={setExpanded}
          onActivate={activate}
          renderItem={renderItem ? (value) => renderItem(renderContext(value)) : undefined}
          busyKey={busyKey}
          onCloseRoot={() => close()}
        />
      )}
    </CgFlyout>
  );
}
