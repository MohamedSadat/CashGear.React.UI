/* eslint-disable react-hooks/refs -- keyed refs coordinate controlled proposals, focus, and menu ownership. */
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
import type {
  CSSProperties,
  ForwardedRef,
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
  RefAttributes,
} from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { renderIcon } from '../../internal';
import { stableKeyToken } from '../../internal/keyedCollection';
import {
  allTreeViewCheckedKeys,
  proposeTreeViewCheckedKeys,
  reconcileTreeViewCheckedKeys,
  treeViewCheckState,
} from '../../internal/treeViewCheck';
import {
  createTreeViewTextFragments,
  filterTreeViewModel,
} from '../../internal/treeViewFilter';
import type { TreeViewTextFragment } from '../../internal/treeViewFilter';
import { normalizeTreeView } from '../../internal/treeViewModel';
import type { TreeViewModelNode } from '../../internal/treeViewModel';
import { moveRovingKey } from '../../internal/rovingFocus';
import { cx } from '../../utils';
import { CgContextMenu } from '../ContextMenu';
import type { CgContextMenuActions, CgContextMenuInvocationKind, CgContextMenuItem } from '../ContextMenu';
import { CgDropIndicator, cgStartsDrag, cgTrackDrag } from '../DragDrop';
import type { CgDropIndicatorHandle } from '../DragDrop';
import { CgInlineTextEditor } from '../InlineEditor';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import { CgTextBox } from '../TextBox';
import styles from './CgTreeView.module.css';
import type {
  CgTreeViewActions,
  CgTreeViewChangeSource,
  CgTreeViewCheckedChangeDetails,
  CgTreeViewCheckState,
  CgTreeViewContext,
  CgTreeViewDropCandidate,
  CgTreeViewDropPosition,
  CgTreeViewExpansionChangeDetails,
  CgTreeViewLabels,
  CgTreeViewMoveDetails,
  CgTreeViewMoveSource,
  CgTreeViewNodeDescriptor,
  CgTreeViewNodeDetails,
  CgTreeViewNodeRenderContext,
  CgTreeViewProps,
  CgTreeViewSelectionChangeDetails,
} from './CgTreeView.types';
import {
  resolveTreeViewDrop,
  treeViewDropLevel,
  treeViewDropPosition,
  treeViewDropSpots,
  treeViewKeyboardMove,
} from './treeViewDrop';
import type { TreeViewDropPlace, TreeViewDropRow, TreeViewDropSpot } from './treeViewDrop';
import { useTreeViewLoading } from './useTreeViewLoading';
import type { TreeViewLoadState } from './useTreeViewLoading';
import { useTreeViewWindow } from './useTreeViewWindow';

type TreeNode<TItem> = TreeViewModelNode<CgTreeViewNodeDescriptor<TItem>>;
type TreeEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
type StatusState = Exclude<TreeViewLoadState, { status: 'loaded' }>;
/** A drawn row: a node, or the loading or failure row under an expanded lazy node. */
type TreeRow<TItem> =
  | { readonly kind: 'node'; readonly key: string; readonly node: TreeNode<TItem>; readonly position: number; readonly setSize: number }
  | { readonly kind: 'status'; readonly key: string; readonly parent: TreeNode<TItem>; readonly state: StatusState };
interface DropChoice<TItem> { readonly place: TreeViewDropPlace; readonly candidate: CgTreeViewDropCandidate<TItem> }
interface DragState<TItem> {
  readonly key: string;
  readonly indent: number;
  readonly rtl: boolean;
  readonly choices: Map<string, DropChoice<TItem> | null>;
  rows: ReadonlyArray<TreeRow<TItem>> | null;
  dropRows: TreeViewDropRow[];
  dropIndex: Map<string, number>;
  choice: DropChoice<TItem> | null;
  marked: HTMLElement | null;
  stop: () => void;
}

const DEFAULT_LABELS: CgTreeViewLabels = {
  filter: 'Filter tree',
  filterPlaceholder: 'Search…',
  filterMinimumLength: 'Enter at least {0} characters to filter.',
  expand: 'Expand {0}',
  collapse: 'Collapse {0}',
  check: 'Change check state for {0}',
  empty: 'No nodes',
  noMatches: 'No matching nodes',
  openCommand: 'Open',
  expandCommand: 'Expand',
  collapseCommand: 'Collapse',
  checkCommand: 'Check',
  uncheckCommand: 'Uncheck',
  copyKeyCommand: 'Copy key',
  expandAllCommand: 'Expand all',
  collapseAllCommand: 'Collapse all',
  contextMenu: 'Tree view context menu',
};
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const MOVE_SHORTCUTS = 'Alt+Shift+ArrowUp Alt+Shift+ArrowDown Alt+Shift+ArrowLeft Alt+Shift+ArrowRight';
const STATUS_PREFIX = '\u0000status\u0000';
const statusKey = (key: string): string => `${STATUS_PREFIX}${key}`;
const statusParent = (key: string): string | undefined => key.startsWith(STATUS_PREFIX) ? key.slice(STATUS_PREFIX.length) : undefined;

function setSignature(value: ReadonlySet<string>): string {
  return [...value].sort().join('\u0001');
}

function sameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((key) => second.has(key));
}

function formatLabel(template: string, text: ReactNode): string {
  return template.replace('{0}', typeof text === 'string' || typeof text === 'number' ? String(text) : 'node');
}

/** A node that can be expanded: it has children, or says it has children still to load. */
function expandable<TItem>(node: TreeNode<TItem>): boolean {
  return node.children.length > 0 || node.descriptor.hasChildren === true;
}

/** A node that never folds (`collapsible: false`) and has children: always open, with no toggle. */
function alwaysOpen<TItem>(node: TreeNode<TItem>): boolean {
  return node.descriptor.collapsible === false && expandable(node);
}

/**
 * A chord with Ctrl, Cmd or Alt that the tree has no use for, such as an app's Ctrl+K: it goes on
 * bubbling with its default untouched. Alt+Shift with an arrow key moves a node when moving is on.
 */
function passesThrough(event: KeyboardEvent<HTMLElement>, moveEnabled: boolean): boolean {
  if (!event.ctrlKey && !event.metaKey && !event.altKey) return false;
  return !(moveEnabled && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && MOVE_KEYS.has(event.key));
}

/** The box that scrolls the tree during a drag, when it is not the page itself. */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let current = element.parentElement; current && current !== element.ownerDocument.body; current = current.parentElement) {
    const overflow = getComputedStyle(current).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && current.scrollHeight > current.clientHeight) return current;
  }
  return null;
}

/** One indent in pixels, measured from the CSS variable the rows use. */
function measureIndent(root: HTMLElement): number {
  const probe = root.ownerDocument.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:var(--cg-tree-indent);block-size:0';
  root.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 ? width : 20;
}

function CgTreeViewInner<TItem>(
  {
    nodes,
    selectedKey,
    defaultSelectedKey = null,
    onSelectedKeyChange,
    expandedKeys,
    defaultExpandedKeys = new Set<string>(),
    onExpandedKeysChange,
    checkedKeys,
    defaultCheckedKeys = new Set<string>(),
    onCheckedKeysChange,
    filterText,
    defaultFilterText = '',
    onFilterTextChange,
    allowSelection = true,
    checkMode = 'disabled',
    beforeSelectionChange,
    afterSelectionChange,
    beforeExpand,
    beforeCollapse,
    afterExpansionChange,
    onNodeActivate,
    onLifecycleError,
    showFilterPanel = false,
    filterMinimumLength = 1,
    filterLocale,
    filterPredicate,
    filterRenderer,
    nodeRenderer,
    renderEmpty,
    renderNoMatches,
    textWrap = true,
    size = 'medium',
    direction = 'auto',
    disabled = false,
    readOnly = false,
    labels,
    contextMenuAreas = 'none',
    customizeContextMenu,
    onContextMenuItemActivate,
    onContextMenuCommandFailure,
    actionsRef,
    onNodeMove,
    canDrop,
    moveLabels,
    onNodeRename,
    renameLabel,
    loadChildren,
    loadLabels,
    renderActions,
    virtualize = false,
    rowHeight,
    overscan = 8,
    height,
    arrowKeys = 'physical',
    id,
    className,
    style,
    onContextMenu,
    'aria-label': ariaLabel = 'Tree view',
    ...nativeProps
  }: CgTreeViewProps<TItem>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!['disabled', 'multiple', 'recursive'].includes(checkMode)) throw new Error(`CgTreeView contains unknown checkMode '${checkMode}'.`);
  if (!['none', 'node', 'empty', 'all'].includes(contextMenuAreas)) throw new Error(`CgTreeView contains unknown contextMenuAreas '${contextMenuAreas}'.`);
  if (!['physical', 'logical'].includes(arrowKeys)) throw new Error(`CgTreeView contains unknown arrowKeys '${arrowKeys}'.`);
  const moveEnabled = onNodeMove !== undefined;
  if (moveEnabled && (!moveLabels?.instructions?.trim() || typeof moveLabels.moved !== 'function')) {
    throw new Error('CgTreeView onNodeMove requires moveLabels with non-empty instructions and a moved announcement.');
  }
  const renameEnabled = onNodeRename !== undefined;
  if (renameEnabled && (renameLabel === undefined || (typeof renameLabel === 'string' && !renameLabel.trim()))) {
    throw new Error('CgTreeView onNodeRename requires a non-empty renameLabel.');
  }
  const lazyEnabled = loadChildren !== undefined;
  if (lazyEnabled && (!loadLabels?.loading?.trim() || !loadLabels.retry?.trim() || loadLabels.loadError === undefined
    || (typeof loadLabels.loadError === 'string' && !loadLabels.loadError.trim()))) {
    throw new Error('CgTreeView loadChildren requires loadLabels with non-empty loading, loadError and retry.');
  }
  const itemHeight = rowHeight ?? (size === 'small' ? 28 : size === 'large' ? 40 : 32);
  if (virtualize && (!Number.isFinite(itemHeight) || itemHeight <= 0)) throw new RangeError('CgTreeView rowHeight must be a positive number of pixels.');
  if (virtualize && (!Number.isInteger(overscan) || overscan < 0)) throw new RangeError('CgTreeView overscan must be a nonnegative integer.');
  const model = useMemo(() => normalizeTreeView(nodes), [nodes]);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const rootId = useCgId(id);
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const operation = useAsyncOperation();
  const menuRef = useRef<CgContextMenuActions<CgTreeViewContext<TItem>>>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const rowElements = useRef(new Map<string, HTMLElement>());
  const actionsValue = useRef<CgTreeViewActions>(null!);
  const mounted = useRef(true);
  const treeRef = useRef<HTMLDivElement | null>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const treeElementRef = useCallback((element: HTMLDivElement | null) => {
    treeRef.current = element;
    setViewport(element);
  }, []);
  const indicatorRef = useRef<CgDropIndicatorHandle>(null);
  const liveRef = useRef<CgLiveAnnouncerHandle>(null);
  const dragRef = useRef<DragState<TItem> | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const pendingExpand = useRef<{ key: string; source: CgTreeViewMoveSource; model: typeof model } | null>(null);

  const [stateSelected, setStateSelected] = useControllableState(selectedKey, defaultSelectedKey, 'CgTreeView selectedKey');
  const [stateExpanded, setStateExpanded] = useControllableState(expandedKeys, new Set(defaultExpandedKeys), 'CgTreeView expandedKeys');
  const [stateChecked, setStateChecked] = useControllableState(checkedKeys, new Set(defaultCheckedKeys), 'CgTreeView checkedKeys');
  const [actualFilter, setActualFilter] = useControllableState(filterText, defaultFilterText, 'CgTreeView filterText');
  const [focusedKey, setFocusedKey] = useState<string | undefined>();
  const [renamingKey, setRenamingKey] = useState<string | null>(null);

  const validSelected = useMemo(() => {
    const key = stateSelected?.trim() || null;
    const node = key ? model.byKey.get(key) : undefined;
    return allowSelection && node?.modelVisible && node.descriptor.disabled !== true && node.descriptor.allowSelection !== false
      ? node.key
      : null;
  }, [allowSelection, model, stateSelected]);
  const validExpanded = useMemo(() => new Set(model.visibleNodes
    .filter((node) => expandable(node) && node.descriptor.disabled !== true && stateExpanded.has(node.key))
    .map((node) => node.key)), [model, stateExpanded]);
  const validChecked = useMemo(() => reconcileTreeViewCheckedKeys(model, stateChecked), [model, stateChecked]);
  const filterResult = useMemo(() => filterTreeViewModel(model, actualFilter, {
    minimumLength: filterMinimumLength,
    locale: filterLocale,
    text: (descriptor) => descriptor.text,
    searchText: (descriptor) => descriptor.searchText,
    predicate: filterPredicate,
  }), [actualFilter, filterLocale, filterMinimumLength, filterPredicate, model]);
  // Open: what the caller expanded, what a filter opens to show matches, and every node that never folds.
  const effectiveExpanded = useMemo(() => new Set([
    ...validExpanded,
    ...filterResult.forcedExpandedKeys,
    ...model.visibleNodes.filter(alwaysOpen).map((node) => node.key),
  ]), [filterResult.forcedExpandedKeys, model, validExpanded]);
  const renderedNodes = useMemo(() => {
    const result: TreeNode<TItem>[] = [];
    const visit = (items: ReadonlyArray<TreeNode<TItem>>): void => {
      for (const node of items) {
        result.push(node);
        if (effectiveExpanded.has(node.key)) visit(filterResult.childrenByKey.get(node.key) ?? []);
      }
    };
    visit(filterResult.roots);
    return result;
  }, [effectiveExpanded, filterResult.childrenByKey, filterResult.roots]);
  const renderedIndex = useMemo(() => new Map(renderedNodes.map((node, index) => [node.key, index])), [renderedNodes]);

  const nodeContextRef = useRef<(node: TreeNode<TItem>) => CgTreeViewNodeRenderContext<TItem>>(null!);
  const needsLoad = useCallback((key: string): boolean => {
    const node = model.byKey.get(key);
    return Boolean(node && node.descriptor.hasChildren === true && node.children.length === 0);
  }, [model]);
  const loading = useTreeViewLoading({
    enabled: lazyEnabled,
    expanded: effectiveExpanded,
    needsLoad,
    load: (key, signal, source) => {
      const node = modelRef.current.byKey.get(key);
      if (!node || !loadChildren) return Promise.resolve();
      return loadChildren(Object.freeze({ key, node: nodeContextRef.current(node), signal, source }));
    },
    onError: (key, error) => {
      const node = modelRef.current.byKey.get(key);
      if (node && mounted.current) liveRef.current?.announce(loadErrorText(node, error));
    },
  });
  const rows = useMemo(() => {
    const result: TreeRow<TItem>[] = [];
    const visit = (items: ReadonlyArray<TreeNode<TItem>>): void => {
      items.forEach((node, index) => {
        result.push({ kind: 'node', key: node.key, node, position: index + 1, setSize: items.length });
        if (!effectiveExpanded.has(node.key)) return;
        const children = filterResult.childrenByKey.get(node.key) ?? [];
        if (children.length > 0) { visit(children); return; }
        const state = lazyEnabled ? loading.states.get(node.key) : undefined;
        if (state && state.status !== 'loaded') result.push({ kind: 'status', key: statusKey(node.key), parent: node, state });
      });
    };
    visit(filterResult.roots);
    return result;
  }, [effectiveExpanded, filterResult.childrenByKey, filterResult.roots, lazyEnabled, loading.states]);
  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
  const focusableKeys = useMemo(() => disabled ? [] : rows
    .filter((row) => row.kind === 'status' || row.node.descriptor.disabled !== true)
    .map((row) => row.key), [disabled, rows]);
  const statusFallback = (key: string): string | undefined => {
    const parentKey = statusParent(key);
    if (parentKey === undefined) return undefined;
    const child = (filterResult.childrenByKey.get(parentKey) ?? []).find((candidate) => focusableKeys.includes(candidate.key));
    return child?.key ?? (focusableKeys.includes(parentKey) ? parentKey : undefined);
  };
  const rovingKey = focusedKey && focusableKeys.includes(focusedKey)
    ? focusedKey
    : (focusedKey ? statusFallback(focusedKey) : undefined) ?? (validSelected && focusableKeys.includes(validSelected)
      ? validSelected
      : focusableKeys[0]);

  const modelRef = useRef(model);
  const selectedRef = useRef(validSelected);
  const expandedRef = useRef<ReadonlySet<string>>(validExpanded);
  const checkedRef = useRef<ReadonlySet<string>>(validChecked);
  const renderedRef = useRef(renderedNodes);
  const rowsRef = useRef(rows);
  const rowIndexRef = useRef(rowIndex);
  modelRef.current = model;
  selectedRef.current = validSelected;
  expandedRef.current = validExpanded;
  checkedRef.current = validChecked;
  renderedRef.current = renderedNodes;
  rowsRef.current = rows;
  rowIndexRef.current = rowIndex;

  const windowRange = useTreeViewWindow(viewport, rows.length, itemHeight, overscan, virtualize);

  const checkState = useStableCallback((node: TreeNode<TItem>): CgTreeViewCheckState =>
    treeViewCheckState(node, checkedRef.current, checkMode));
  const nodeContext = useStableCallback((node: TreeNode<TItem>): CgTreeViewNodeRenderContext<TItem> => {
    const text = node.descriptor.text;
    const fragments: ReadonlyArray<TreeViewTextFragment> = typeof text === 'string'
      ? createTreeViewTextFragments(text, filterResult.query, filterLocale)
      : [];
    const defaultContent = fragments.length > 0
      ? fragments.map((fragment, index) => fragment.matched
        ? <mark key={index}>{fragment.text}</mark>
        : fragment.text)
      : text;
    return {
      descriptor: node.descriptor,
      item: node.descriptor.item,
      data: node.descriptor.data,
      key: node.key,
      text,
      parentKey: node.parentKey,
      depth: node.depth,
      visibleIndex: renderedIndex.get(node.key) ?? -1,
      hasChildren: expandable(node),
      selected: selectedRef.current === node.key,
      expanded: effectiveExpanded.has(node.key),
      checkState: checkState(node),
      visible: node.modelVisible,
      disabled: disabled || node.descriptor.disabled === true,
      allowSelection: allowSelection && node.descriptor.allowSelection !== false,
      allowCheck: checkMode !== 'disabled' && node.descriptor.allowCheck !== false,
      icon: node.descriptor.icon,
      filter: {
        active: filterResult.active,
        query: filterResult.query,
        matched: filterResult.matchedKeys.has(node.key),
        fragments,
      },
      actions: actionsValue.current,
      defaultContent,
    };
  });
  nodeContextRef.current = nodeContext;
  const nodeDetails = useStableCallback((
    node: TreeNode<TItem> | undefined,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
  ): CgTreeViewNodeDetails<TItem> => ({
    key: node?.key ?? null,
    ...(node ? { node: nodeContext(node) } : {}),
    source,
    isUserInitiated: source === 'pointer' || source === 'keyboard' || source === 'context-menu',
    ...(event ? { event } : {}),
  }));
  const loadErrorText = (node: TreeNode<TItem>, error: unknown): string => {
    const label = loadLabels?.loadError;
    return typeof label === 'function' ? label(error, nodeContext(node)) : label ?? '';
  };

  const reportLifecycleError = useStableCallback((error: unknown, details: CgTreeViewNodeDetails<TItem>) => {
    try { onLifecycleError?.(error, details); } catch { /* Reporting is terminal. */ }
  });
  const pendingSelection = useRef<CgTreeViewSelectionChangeDetails<TItem> | undefined>(undefined);
  const pendingExpansion = useRef<{ signature: string; details: CgTreeViewExpansionChangeDetails<TItem>[] } | undefined>(undefined);

  const proposeSelected = useStableCallback((next: string | null, details: CgTreeViewSelectionChangeDetails<TItem>): void => {
    setStateSelected(next);
    onSelectedKeyChange?.(next, details);
    if (selectedKey === undefined) void Promise.resolve(afterSelectionChange?.(details)).catch((error) => reportLifecycleError(error, details));
    else pendingSelection.current = details;
  });
  const proposeExpanded = useStableCallback((next: ReadonlySet<string>, details: CgTreeViewExpansionChangeDetails<TItem>[]): void => {
    const snapshot = new Set(modelRef.current.allNodes.filter((node) => next.has(node.key)).map((node) => node.key));
    setStateExpanded(snapshot);
    const callbackDetail = details.at(-1);
    if (callbackDetail) onExpandedKeysChange?.(snapshot, { ...callbackDetail, expandedKeys: snapshot });
    if (expandedKeys === undefined) {
      for (const detail of details) void Promise.resolve(afterExpansionChange?.({ ...detail, expandedKeys: snapshot }))
        .catch((error) => reportLifecycleError(error, detail));
    } else pendingExpansion.current = { signature: setSignature(snapshot), details: details.map((detail) => ({ ...detail, expandedKeys: snapshot })) };
  });

  useEffect(() => {
    const pending = pendingSelection.current;
    if (!pending) return;
    if (pending.newKey === validSelected) {
      pendingSelection.current = undefined;
      void Promise.resolve(afterSelectionChange?.(pending)).catch((error) => reportLifecycleError(error, pending));
    } else {
      pendingSelection.current = undefined;
      const fallback = validSelected ?? rovingKey;
      if (fallback) elements.current.get(fallback)?.focus({ preventScroll: true });
    }
  }, [afterSelectionChange, reportLifecycleError, rovingKey, validSelected]);
  useEffect(() => {
    const pending = pendingExpansion.current;
    if (!pending) return;
    if (pending.signature === setSignature(validExpanded)) {
      pendingExpansion.current = undefined;
      for (const detail of pending.details) void Promise.resolve(afterExpansionChange?.(detail))
        .catch((error) => reportLifecycleError(error, detail));
    } else pendingExpansion.current = undefined;
  }, [afterExpansionChange, reportLifecycleError, validExpanded]);

  const requireNode = useStableCallback((key: string): TreeNode<TItem> => {
    const normalized = key.trim();
    if (!normalized) throw new Error('CgTreeView action keys must be non-empty.');
    const node = modelRef.current.byKey.get(normalized);
    if (!node) throw new Error(`CgTreeView contains no node with key '${normalized}'.`);
    return node;
  });
  const requestSelection = useStableCallback(async (
    node: TreeNode<TItem>,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
  ): Promise<boolean> => {
    if (!allowSelection || disabled || readOnly || !node.modelVisible || node.descriptor.disabled || node.descriptor.allowSelection === false || selectedRef.current === node.key) return false;
    const details: CgTreeViewSelectionChangeDetails<TItem> = {
      ...nodeDetails(node, source, event), oldKey: selectedRef.current, newKey: node.key,
    };
    try {
      return await operation.run(async ({ signal }) => {
        if (await beforeSelectionChange?.({ ...details, signal }) === false || signal.aborted || modelRef.current.byKey.get(node.key)?.descriptor !== node.descriptor) return false;
        proposeSelected(node.key, details);
        setFocusedKey(node.key);
        return true;
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) reportLifecycleError(error, details);
      return false;
    }
  });
  const requestExpandedBatch = useStableCallback(async (
    target: ReadonlySet<string>,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
  ): Promise<boolean> => {
    const before = expandedRef.current;
    const changed = modelRef.current.visibleNodes.filter((node) => expandable(node) && !alwaysOpen(node)
      && !node.descriptor.disabled && before.has(node.key) !== target.has(node.key));
    if (disabled || readOnly || changed.length === 0) return false;
    const base = changed.map((node): CgTreeViewExpansionChangeDetails<TItem> => ({
      ...nodeDetails(node, source, event), expanded: target.has(node.key), expandedKeys: target,
    }));
    try {
      return await operation.run(async ({ signal }) => {
        const accepted = new Set(before);
        const acceptedDetails: CgTreeViewExpansionChangeDetails<TItem>[] = [];
        for (const details of base) {
          const node = details.key ? modelRef.current.byKey.get(details.key) : undefined;
          if (!node || node.descriptor.disabled) continue;
          const allowed = await (details.expanded ? beforeExpand : beforeCollapse)?.({ ...details, signal });
          if (signal.aborted) return false;
          if (allowed === false) continue;
          if (details.expanded) accepted.add(node.key); else accepted.delete(node.key);
          acceptedDetails.push({ ...details, expandedKeys: accepted });
        }
        if (acceptedDetails.length === 0) return false;
        proposeExpanded(accepted, acceptedDetails);
        return true;
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) reportLifecycleError(error, base[0] ?? nodeDetails(undefined, source));
      return false;
    }
  });
  const requestExpanded = useStableCallback((
    node: TreeNode<TItem>,
    expanded: boolean,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
  ): Promise<boolean> => {
    if (!node.modelVisible || !expandable(node) || alwaysOpen(node) || node.descriptor.disabled || disabled || readOnly || expandedRef.current.has(node.key) === expanded) return Promise.resolve(false);
    const target = new Set(expandedRef.current);
    if (expanded) target.add(node.key); else target.delete(node.key);
    return requestExpandedBatch(target, source, event);
  });

  const emitChecked = useStableCallback((
    next: ReadonlySet<string>,
    node: TreeNode<TItem> | undefined,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
    previous: ReadonlySet<string> = checkedRef.current,
  ): boolean => {
    const before = previous;
    if (sameSet(before, next)) return false;
    const ordered = new Set(modelRef.current.allNodes.filter((candidate) => next.has(candidate.key)).map((candidate) => candidate.key));
    const details: CgTreeViewCheckedChangeDetails<TItem> = {
      ...nodeDetails(node, source, event),
      checkedKeys: ordered,
      newlyCheckedKeys: new Set([...ordered].filter((key) => !before.has(key))),
      newlyUncheckedKeys: new Set([...before].filter((key) => !ordered.has(key))),
    };
    setStateChecked(ordered);
    onCheckedKeysChange?.(ordered, details);
    return true;
  });
  const requestChecked = useStableCallback((
    node: TreeNode<TItem>,
    checked: boolean,
    source: CgTreeViewChangeSource,
    event?: TreeEvent,
  ): boolean => {
    if (disabled || readOnly || checkMode === 'disabled' || !node.modelVisible || node.descriptor.disabled || node.descriptor.allowCheck === false) return false;
    return emitChecked(proposeTreeViewCheckedKeys(modelRef.current, checkedRef.current, node.key, checked, checkMode), node, source, event);
  });

  /** With `virtualize`: scrolls the tree's box so the row of `key` is in view, and draws that window. */
  const revealRow = useStableCallback((key: string): void => {
    const index = rowIndexRef.current.get(key);
    const box = treeRef.current;
    if (!virtualize || index === undefined || !box) return;
    const top = index * itemHeight;
    const bottom = top + itemHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, bottom - box.clientHeight);
    windowRange.measure();
  });
  /** Focuses a row. A virtual row out of the window is drawn first and focused once it is. */
  const focusElement = useStableCallback((key: string, scroll: boolean): void => {
    if (virtualize) {
      revealRow(key);
      const element = elements.current.get(key);
      if (element) element.focus({ preventScroll: true }); else pendingFocus.current = key;
      return;
    }
    elements.current.get(key)?.focus({ preventScroll: true });
    if (scroll) elements.current.get(key)?.scrollIntoView?.({ block: 'nearest' });
  });

  const focusNode = useStableCallback((key?: string): Promise<void> => {
    const requested = key?.trim();
    const selectedRendered = selectedRef.current && renderedRef.current.some((node) => node.key === selectedRef.current)
      ? selectedRef.current
      : undefined;
    const resolved = requested || selectedRendered || rovingKey;
    if (!resolved) throw new Error('CgTreeView has no focusable node.');
    if (!requested && statusParent(resolved) !== undefined) {
      setFocusedKey(resolved);
      focusElement(resolved, false);
      return Promise.resolve();
    }
    const node = requireNode(resolved);
    if (disabled || node.descriptor.disabled || !renderedRef.current.some((candidate) => candidate.key === node.key)) {
      throw new Error(`CgTreeView node '${node.key}' is not focusable.`);
    }
    setFocusedKey(node.key);
    focusElement(node.key, false);
    return Promise.resolve();
  });
  const scrollNode = useStableCallback((key: string): Promise<void> => {
    const node = requireNode(key);
    if (!renderedRef.current.some((candidate) => candidate.key === node.key)) throw new Error(`CgTreeView node '${node.key}' is not rendered.`);
    if (virtualize) revealRow(node.key);
    else elements.current.get(node.key)?.scrollIntoView?.({ block: 'nearest' });
    return Promise.resolve();
  });

  const canDragNode = (node: TreeNode<TItem>): boolean => moveEnabled && !disabled && !readOnly
    && node.descriptor.disabled !== true && node.descriptor.allowDrag !== false && renamingKey !== node.key;
  const canRenameNode = (node: TreeNode<TItem> | undefined): boolean => node !== undefined && renameEnabled && !disabled && !readOnly
    && node.descriptor.disabled !== true && node.descriptor.allowRename !== false;
  // A rename whose node left the drawn rows, or may no longer be renamed, ends.
  if (renamingKey !== null && !(rowIndex.has(renamingKey) && canRenameNode(model.byKey.get(renamingKey)))) setRenamingKey(null);
  const renameStartText = (node: TreeNode<TItem>): string => node.descriptor.renameText
    ?? (typeof node.descriptor.text === 'string' ? node.descriptor.text : node.descriptor.searchText ?? '');
  const startRenaming = useStableCallback((key: string): void => {
    setRenamingKey(key);
    setFocusedKey(key);
    revealRow(key);
  });
  const finishRenaming = (key: string, end: string): void => {
    setRenamingKey((current) => current === key ? null : current);
    if (end !== 'blur') pendingFocus.current = key;
  };

  const contextAreaEnabled = (area: 'node' | 'empty'): boolean => contextMenuAreas === 'all' || contextMenuAreas === area;
  const contextFor = (
    area: 'node' | 'empty',
    node: TreeNode<TItem> | undefined,
    rectangle: { x: number; y: number; width: number; height: number },
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement> | undefined,
    kind: CgContextMenuInvocationKind,
  ): CgTreeViewContext<TItem> => ({
    area,
    item: node?.descriptor.item,
    parentItem: node?.parentKey ? modelRef.current.byKey.get(node.parentKey)?.descriptor.item : undefined,
    key: node?.key ?? null,
    parentKey: node?.parentKey ?? null,
    depth: node?.depth ?? 0,
    hasChildren: node ? expandable(node) : false,
    expanded: node ? effectiveExpanded.has(node.key) : false,
    checkState: node ? checkState(node) : 'none',
    disabled: disabled || readOnly || Boolean(node?.descriptor.disabled),
    targetRectangle: rectangle,
    invocation: {
      kind,
      clientX: event && 'clientX' in event ? event.clientX : rectangle.x,
      clientY: event && 'clientY' in event ? event.clientY : rectangle.y,
      button: event && 'button' in event ? event.button : 0,
      ctrlKey: event?.ctrlKey ?? false,
      shiftKey: event?.shiftKey ?? false,
      altKey: event?.altKey ?? false,
      metaKey: event?.metaKey ?? false,
    },
  });

  const actions: CgTreeViewActions = {
    focus: focusNode,
    select: async (key) => {
      const node = requireNode(key);
      if (disabled || readOnly || !allowSelection || !node.modelVisible || node.descriptor.disabled || node.descriptor.allowSelection === false) throw new Error(`CgTreeView node '${node.key}' is not selectable.`);
      return requestSelection(node, 'action');
    },
    clearSelection: async () => {
      if (disabled || readOnly) throw new Error('CgTreeView selection cannot change while disabled or read-only.');
      if (selectedRef.current === null) return false;
      const old = selectedRef.current ? modelRef.current.byKey.get(selectedRef.current) : undefined;
      const details: CgTreeViewSelectionChangeDetails<TItem> = { ...nodeDetails(old, 'action'), oldKey: selectedRef.current, newKey: null };
      try {
        return await operation.run(async ({ signal }) => {
          if (await beforeSelectionChange?.({ ...details, signal }) === false || signal.aborted) return false;
          proposeSelected(null, details);
          return true;
        });
      } catch (error) { reportLifecycleError(error, details); return false; }
    },
    setNodeExpanded: async (key, expanded) => {
      const node = requireNode(key);
      if (disabled || readOnly || !node.modelVisible || node.descriptor.disabled || !expandable(node)) throw new Error(`CgTreeView node '${node.key}' is not expandable.`);
      return requestExpanded(node, expanded, 'action');
    },
    expandAll: () => requestExpandedBatch(new Set(modelRef.current.visibleNodes
      .filter((node) => node.children.length > 0 && !node.descriptor.disabled).map((node) => node.key)), 'action'),
    collapseAll: () => requestExpandedBatch(new Set(), 'action'),
    expandToKey: async (key) => {
      const node = requireNode(key);
      if (!node.modelVisible || node.descriptor.disabled || disabled || readOnly) throw new Error(`CgTreeView node '${node.key}' is unavailable.`);
      const ancestors: string[] = [];
      let parentKey = node.parentKey;
      while (parentKey) { ancestors.unshift(parentKey); parentKey = modelRef.current.byKey.get(parentKey)?.parentKey ?? null; }
      const target = new Set(expandedRef.current);
      ancestors.forEach((ancestor) => target.add(ancestor));
      return requestExpandedBatch(target, 'action');
    },
    setNodeChecked: (key, checked) => {
      const node = requireNode(key);
      if (disabled || readOnly || checkMode === 'disabled' || !node.modelVisible || node.descriptor.disabled || node.descriptor.allowCheck === false) throw new Error(`CgTreeView node '${node.key}' is not checkable.`);
      return Promise.resolve(requestChecked(node, checked, 'action'));
    },
    checkAll: () => {
      if (disabled || readOnly || checkMode === 'disabled') throw new Error('CgTreeView checking is unavailable.');
      return Promise.resolve(emitChecked(allTreeViewCheckedKeys(modelRef.current), undefined, 'action'));
    },
    clearChecks: () => {
      if (disabled || readOnly || checkMode === 'disabled') throw new Error('CgTreeView checking is unavailable.');
      return Promise.resolve(emitChecked(new Set(), undefined, 'action'));
    },
    scrollToKey: scrollNode,
    startRename: (key) => {
      const node = requireNode(key);
      if (!canRenameNode(node)) throw new Error(`CgTreeView node '${node.key}' cannot be renamed.`);
      if (!rowIndexRef.current.has(node.key)) throw new Error(`CgTreeView node '${node.key}' is not rendered.`);
      startRenaming(node.key);
      return Promise.resolve();
    },
    showContextMenu: async (key, anchor) => {
      const node = requireNode(key);
      if (!contextAreaEnabled('node')) throw new Error('CgTreeView node context menus are off (contextMenuAreas).');
      const box = (anchor ?? rowElements.current.get(node.key) ?? elements.current.get(node.key))?.getBoundingClientRect();
      const rectangle = box ? { x: box.left, y: box.top, width: box.width, height: box.height } : { x: 0, y: 0, width: 0, height: 0 };
      const context = contextFor('node', node, rectangle, undefined, 'programmatic');
      return await menuRef.current?.showAtRectangle(rectangle, context, { kind: 'programmatic', ownerId: rootId }) ?? false;
    },
  };
  actionsValue.current = actions;
  useImperativeHandle(actionsRef, () => actions);

  const correctionSignature = useRef('');
  useEffect(() => {
    const selectedMismatch = stateSelected !== validSelected;
    const expandedMismatch = !sameSet(stateExpanded, validExpanded);
    const checkedMismatch = !sameSet(stateChecked, validChecked);
    const signature = `${String(stateSelected)}>${String(validSelected)}|${setSignature(stateExpanded)}>${setSignature(validExpanded)}|${setSignature(stateChecked)}>${setSignature(validChecked)}|${model.allNodes.map((node) => node.key).join()}`;
    if (!selectedMismatch && !expandedMismatch && !checkedMismatch) {
      correctionSignature.current = '';
      return;
    }
    if (correctionSignature.current === signature) return;
    correctionSignature.current = signature;
    if (selectedMismatch) {
      const details: CgTreeViewSelectionChangeDetails<TItem> = { ...nodeDetails(undefined, 'collection'), oldKey: stateSelected?.trim() || null, newKey: validSelected };
      setStateSelected(validSelected); onSelectedKeyChange?.(validSelected, details);
    }
    if (expandedMismatch) {
      const changed = model.allNodes.find((node) => stateExpanded.has(node.key) !== validExpanded.has(node.key));
      const details: CgTreeViewExpansionChangeDetails<TItem> = { ...nodeDetails(changed, 'collection'), expanded: changed ? validExpanded.has(changed.key) : false, expandedKeys: validExpanded };
      setStateExpanded(validExpanded); onExpandedKeysChange?.(validExpanded, details);
    }
    if (checkedMismatch) emitChecked(validChecked, undefined, 'collection', undefined, stateChecked);
  }, [emitChecked, model, nodeDetails, onExpandedKeysChange, onSelectedKeyChange, setStateChecked, setStateExpanded, setStateSelected, stateChecked, stateExpanded, stateSelected, validChecked, validExpanded, validSelected]);

  const hadTreeFocus = useRef(false);
  useEffect(() => {
    if (focusedKey === rovingKey) return;
    // A row moved or drawn again is refocused by its pending focus, not by the fallback.
    if (pendingFocus.current) return;
    if (hadTreeFocus.current && rovingKey) queueMicrotask(() => elements.current.get(rovingKey)?.focus({ preventScroll: true }));
  }, [focusedKey, rovingKey]);
  // A row waiting for focus (drawn into the virtual window, or moved to a new place) takes it once drawn.
  useLayoutEffect(() => {
    const key = pendingFocus.current;
    const element = key ? elements.current.get(key) : undefined;
    if (!key || !element) return;
    pendingFocus.current = null;
    // Focus that went elsewhere meanwhile, outside the tree, stays there.
    const active = element.ownerDocument.activeElement;
    if (active && active !== element.ownerDocument.body && !rootRef.current?.contains(active)) return;
    if (active !== element) element.focus({ preventScroll: true });
  });
  // A node an inside move went into opens, once the caller's `nodes` gave it the child.
  useEffect(() => {
    const pending = pendingExpand.current;
    if (!pending || pending.model === model) return;
    pendingExpand.current = null;
    const node = model.byKey.get(pending.key);
    if (node && expandable(node) && !expandedRef.current.has(node.key)) void requestExpanded(node, true, pending.source);
  }, [model, requestExpanded]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      dragRef.current?.stop();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the latest imperative menu owner must be closed.
      void menuRef.current?.hide('ownerLoss', rootId);
    };
  }, [rootId]);

  const moveFocus = (current: string, movement: 'next' | 'previous' | 'first' | 'last'): void => {
    const next = moveRovingKey(focusableKeys, current, movement);
    if (!next) return;
    setFocusedKey(next);
    focusElement(next, true);
  };
  const activateNode = (node: TreeNode<TItem>, source: CgTreeViewChangeSource, event?: TreeEvent): void => {
    onNodeActivate?.(nodeDetails(node, source, event));
    void requestSelection(node, source, event);
  };
  const showNodeMenu = (node: TreeNode<TItem>, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, keyboard: boolean): void => {
    if (!contextAreaEnabled('node')) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const rectangle = { x: keyboard ? rect.left : (event as MouseEvent).clientX, y: keyboard ? rect.bottom : (event as MouseEvent).clientY, width: 0, height: 0 };
    const context = contextFor('node', node, rectangle, event, keyboard ? 'keyboard' : 'pointer');
    if (keyboard) void menuRef.current?.showAtRectangle(rectangle, context, { kind: 'keyboard', ownerId: rootId });
    else void menuRef.current?.showFromEvent(event as MouseEvent<HTMLElement>, context, { kind: 'pointer', ownerId: rootId });
  };

  // ---- Moving: the place a drop or a key gives, checked against the tree's rules and the host's.
  const dropChoice = (key: string, targetKey: string, position: CgTreeViewDropPosition, source: CgTreeViewMoveSource): DropChoice<TItem> | null => {
    const current = modelRef.current;
    const place = resolveTreeViewDrop(current, key, targetKey, position);
    if (!place) return null;
    const candidate: CgTreeViewDropCandidate<TItem> = Object.freeze({
      key,
      item: current.byKey.get(key)?.descriptor.item,
      targetKey: place.targetKey,
      targetItem: current.byKey.get(place.targetKey)?.descriptor.item,
      position: place.position,
      parentKey: place.parentKey,
      parentItem: place.parentKey === null ? undefined : current.byKey.get(place.parentKey)?.descriptor.item,
      index: place.index,
      previousKey: place.previousKey,
      nextKey: place.nextKey,
      source,
    });
    try {
      if (canDrop && !canDrop(candidate)) return null;
    } catch {
      return null;
    }
    return { place, candidate };
  };
  const expandAfterMove = (key: string, source: CgTreeViewMoveSource): void => {
    const node = modelRef.current.byKey.get(key);
    if (node && expandable(node)) {
      if (!expandedRef.current.has(node.key)) void requestExpanded(node, true, source);
      return;
    }
    pendingExpand.current = { key, source, model: modelRef.current };
  };
  const commitMove = (choice: DropChoice<TItem>, source: CgTreeViewMoveSource): void => {
    const node = modelRef.current.byKey.get(choice.candidate.key);
    if (!node || !onNodeMove) return;
    const details: CgTreeViewMoveDetails<TItem> = Object.freeze({
      ...choice.candidate,
      node: nodeContext(node),
      oldParentKey: choice.place.oldParentKey,
      oldIndex: choice.place.oldIndex,
    });
    if (source === 'keyboard' || hadTreeFocus.current) pendingFocus.current = node.key;
    onNodeMove(details);
    if (moveLabels) liveRef.current?.announce(moveLabels.moved(details));
    if (details.position === 'inside') expandAfterMove(details.targetKey, source);
  };
  const moveByKeys = (node: TreeNode<TItem>, key: string, forward: string): void => {
    const move = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === forward ? 'indent' : 'outdent';
    const siblings = (node.parentKey === null ? filterResult.roots : filterResult.childrenByKey.get(node.parentKey) ?? []).map((sibling) => sibling.key);
    const target = treeViewKeyboardMove(siblings, node.key, node.parentKey, move);
    const choice = target ? dropChoice(node.key, target.targetKey, target.position, 'keyboard') : null;
    if (choice) commitMove(choice, 'keyboard');
  };

  const clearDropMarks = (state: DragState<TItem>): void => {
    state.marked?.removeAttribute('data-cg-drop-inside');
    state.marked = null;
    indicatorRef.current?.hide();
  };
  const refreshDropRows = (state: DragState<TItem>): void => {
    if (state.rows === rowsRef.current) return;
    state.rows = rowsRef.current;
    state.choices.clear();
    state.dropRows = [];
    state.dropIndex = new Map();
    for (const row of state.rows) {
      if (row.kind !== 'node') continue;
      state.dropIndex.set(row.key, state.dropRows.length);
      state.dropRows.push({ key: row.key, depth: row.node.depth, parentKey: row.node.parentKey, open: effectiveExpanded.has(row.key) });
    }
  };
  /** The node row under a pointer at viewport height `y`, with its box's block start and size. */
  const rowAt = (state: DragState<TItem>, y: number): { index: number; top: number; size: number } | null => {
    if (virtualize) {
      const box = sizerRef.current?.getBoundingClientRect();
      if (!box) return null;
      const at = Math.floor((y - box.top) / itemHeight);
      const row = state.rows?.[at];
      const index = row?.kind === 'node' ? state.dropIndex.get(row.key) : undefined;
      return index === undefined ? null : { index, top: box.top + at * itemHeight, size: itemHeight };
    }
    let low = 0;
    let high = state.dropRows.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      const box = rowElements.current.get(state.dropRows[middle]!.key)?.getBoundingClientRect();
      if (!box) return null;
      if (y < box.top) high = middle - 1;
      else if (y >= box.bottom) low = middle + 1;
      else return { index: middle, top: box.top, size: box.height };
    }
    return null;
  };
  const trackPointer = (state: DragState<TItem>, x: number, y: number): void => {
    refreshDropRows(state);
    const container = virtualize ? sizerRef.current : treeRef.current;
    const box = container?.getBoundingClientRect();
    const hit = box && x >= box.left && x <= box.right ? rowAt(state, y) : null;
    if (!box || !hit) { state.choice = null; clearDropMarks(state); return; }
    const inline = state.rtl ? box.right - x : x - box.left;
    const parentOf = (key: string) => modelRef.current.byKey.get(key)?.parentKey ?? null;
    const spots = treeViewDropSpots(state.dropRows, hit.index, treeViewDropLevel(inline, state.indent, 0, Number.MAX_SAFE_INTEGER), parentOf);
    if (!spots) { state.choice = null; clearDropMarks(state); return; }
    const choose = (spot: TreeViewDropSpot): DropChoice<TItem> | null => {
      const cacheKey = `${spot.position}\u0001${spot.targetKey}`;
      if (!state.choices.has(cacheKey)) state.choices.set(cacheKey, dropChoice(state.key, spot.targetKey, spot.position, 'pointer'));
      return state.choices.get(cacheKey) ?? null;
    };
    const choices = { before: choose(spots.before), inside: choose(spots.inside), after: choose(spots.after) };
    const position = treeViewDropPosition(y - hit.top, hit.size, { before: choices.before !== null, inside: choices.inside !== null, after: choices.after !== null });
    state.choice = position ? choices[position] : null;
    if (!position || !state.choice) { clearDropMarks(state); return; }
    const spot = spots[position];
    if (spot.edge === 'row') {
      const row = rowElements.current.get(state.dropRows[hit.index]!.key) ?? null;
      if (state.marked !== row) { state.marked?.removeAttribute('data-cg-drop-inside'); state.marked = row; }
      row?.setAttribute('data-cg-drop-inside', '');
      indicatorRef.current?.hide();
      return;
    }
    state.marked?.removeAttribute('data-cg-drop-inside');
    state.marked = null;
    const inset = spot.level * state.indent + 4;
    indicatorRef.current?.show({
      block: (spot.edge === 'start' ? hit.top : hit.top + hit.size) - box.top,
      inline: inset,
      length: Math.max(0, box.width - inset - 4),
    });
  };
  const endDrag = (state: DragState<TItem>): void => {
    clearDropMarks(state);
    rootRef.current?.removeAttribute('data-cg-tree-dragging');
    if (dragRef.current === state) dragRef.current = null;
  };
  const buildGhost = (source: HTMLElement): HTMLElement => {
    const ghost = source.ownerDocument.createElement('div');
    ghost.className = cx(styles.root, styles[size], styles.ghost);
    ghost.dir = resolvedDirection;
    const copy = source.cloneNode(true) as HTMLElement;
    copy.removeAttribute('id');
    copy.removeAttribute('data-cg-drop-inside');
    for (const element of copy.querySelectorAll('[id]')) element.removeAttribute('id');
    ghost.style.inlineSize = `${source.getBoundingClientRect().width}px`;
    ghost.append(copy);
    return ghost;
  };
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, node: TreeNode<TItem>): void => {
    if (event.button !== 0 || !canDragNode(node) || !cgStartsDrag(event.target, event.currentTarget)) return;
    const root = rootRef.current;
    if (!root) return;
    dragRef.current?.stop();
    const state: DragState<TItem> = {
      key: node.key,
      indent: measureIndent(root),
      rtl: resolvedDirection === 'rtl',
      choices: new Map(),
      rows: null,
      dropRows: [],
      dropIndex: new Map(),
      choice: null,
      marked: null,
      stop: () => undefined,
    };
    dragRef.current = state;
    state.stop = cgTrackDrag(event, event.currentTarget, {
      scroller: virtualize ? treeRef.current : scrollParent(root),
      ghost: buildGhost,
      onStart: () => { if (dragRef.current === state) root.setAttribute('data-cg-tree-dragging', ''); },
      onMove: (x, y) => { if (dragRef.current === state) trackPointer(state, x, y); },
      onDrop: (x, y) => {
        if (dragRef.current !== state) return;
        trackPointer(state, x, y);
        const choice = state.choice;
        endDrag(state);
        if (choice) commitMove(choice, 'pointer');
      },
      onCancel: () => { if (dragRef.current === state) endDrag(state); },
    });
  };

  const expandKey = arrowKeys === 'logical' && resolvedDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
  const collapseKey = expandKey === 'ArrowRight' ? 'ArrowLeft' : 'ArrowRight';
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, node: TreeNode<TItem>): void => {
    if (moveEnabled && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && MOVE_KEYS.has(event.key)) {
      event.preventDefault();
      if (canDragNode(node)) moveByKeys(node, event.key, expandKey);
      return;
    }
    if (renameEnabled && event.key === 'F2' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault();
      if (canRenameNode(node)) startRenaming(node.key);
      return;
    }
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) { showNodeMenu(node, event, true); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(node.key, 'next'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(node.key, 'previous'); }
    else if (event.key === 'Home') { event.preventDefault(); moveFocus(node.key, 'first'); }
    else if (event.key === 'End') { event.preventDefault(); moveFocus(node.key, 'last'); }
    else if (event.key === expandKey) {
      event.preventDefault();
      if (expandable(node) && !effectiveExpanded.has(node.key)) void requestExpanded(node, true, 'keyboard', event);
      else {
        const child = (filterResult.childrenByKey.get(node.key) ?? []).find((candidate) => !candidate.descriptor.disabled);
        const target = child?.key ?? (focusableKeys.includes(statusKey(node.key)) ? statusKey(node.key) : undefined);
        if (target) { setFocusedKey(target); focusElement(target, false); }
      }
    } else if (event.key === collapseKey) {
      event.preventDefault();
      // A node that never folds is not collapsed: the key goes to its parent, as from an end node.
      if (expandable(node) && !alwaysOpen(node) && validExpanded.has(node.key)) void requestExpanded(node, false, 'keyboard', event);
      else if (node.parentKey) {
        setFocusedKey(node.parentKey); focusElement(node.parentKey, false);
      }
    } else if (event.key === 'Enter') { event.preventDefault(); activateNode(node, 'keyboard', event); }
    else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (checkMode !== 'disabled' && node.descriptor.allowCheck !== false) requestChecked(node, checkState(node) !== 'checked', 'keyboard', event);
      else activateNode(node, 'keyboard', event);
    }
  };
  const handleStatusKeyDown = (event: KeyboardEvent<HTMLElement>, key: string, parent: TreeNode<TItem>, failed: boolean): void => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(key, 'next'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(key, 'previous'); }
    else if (event.key === 'Home') { event.preventDefault(); moveFocus(key, 'first'); }
    else if (event.key === 'End') { event.preventDefault(); moveFocus(key, 'last'); }
    else if (event.key === collapseKey) { event.preventDefault(); setFocusedKey(parent.key); focusElement(parent.key, false); }
    else if (failed && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) { event.preventDefault(); loading.retry(parent.key); }
  };
  const fromRename = (target: EventTarget): boolean => renameEnabled && target instanceof Element && target.closest('[data-cg-tree-rename]') !== null;
  const fromActions = (target: EventTarget): boolean => renderActions !== undefined && target instanceof Element && target.closest('[data-cg-tree-actions]') !== null;
  /**
   * Keys at a row. Rows nest, so a key the tree takes stops here, before an ancestor row would take it
   * too; a chord it has no use for (Ctrl+K) goes on to the app. The rename field keeps all its keys.
   */
  const handleNodeKeyDown = (event: KeyboardEvent<HTMLElement>, node: TreeNode<TItem>): void => {
    if (fromRename(event.target)) { event.stopPropagation(); return; }
    if (passesThrough(event, moveEnabled)) return;
    event.stopPropagation();
    if (fromActions(event.target)) return;
    handleKeyDown(event, node);
  };

  const instructionsId = `${rootId}-move-instructions`;
  const flatStyle = (index: number, depth: number): CSSProperties => ({
    insetBlockStart: index * itemHeight,
    blockSize: itemHeight,
    ['--cg-tree-depth' as string]: depth,
  });
  const renderStatus = (row: Extract<TreeRow<TItem>, { kind: 'status' }>, flatIndex?: number): ReactElement => {
    const { key, parent, state } = row;
    const failed = state.status === 'error';
    const flat = flatIndex !== undefined;
    return <div
      key={key}
      ref={(element) => { if (element) elements.current.set(key, element); else elements.current.delete(key); }}
      role="treeitem"
      tabIndex={rovingKey === key ? 0 : -1}
      aria-level={parent.depth + 2}
      aria-posinset={1}
      aria-setsize={1}
      aria-disabled={failed ? undefined : true}
      data-cg-tree-status={state.status}
      className={cx(styles.node, styles.status, failed && styles.statusError, flat && styles.flatNode)}
      style={flat ? flatStyle(flatIndex, parent.depth + 1) : undefined}
      onFocus={(event) => { event.stopPropagation(); hadTreeFocus.current = true; if (pendingFocus.current !== key) pendingFocus.current = null; setFocusedKey(key); }}
      onBlur={(event) => { event.stopPropagation(); if (!rootRef.current?.contains(event.relatedTarget)) hadTreeFocus.current = false; }}
      onKeyDown={(event) => { if (passesThrough(event, moveEnabled)) return; event.stopPropagation(); handleStatusKeyDown(event, key, parent, failed); }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.row}>
        <span className={styles.controlPlaceholder} aria-hidden="true" />
        {failed ? null : <span className={styles.spinner} aria-hidden="true" />}
        <span className={styles.content}>{failed ? loadErrorText(parent, state.error) : loadLabels?.loading}</span>
        {failed ? <button
          type="button"
          tabIndex={-1}
          className={styles.retry}
          onClick={(event) => { event.stopPropagation(); loading.retry(parent.key); }}
        >{loadLabels?.retry}</button> : null}
      </div>
    </div>;
  };
  const renderNode = (node: TreeNode<TItem>, position: number, setSize: number, flatIndex?: number): ReactElement => {
    const context = nodeContext(node);
    const children = filterResult.childrenByKey.get(node.key) ?? [];
    const expanded = effectiveExpanded.has(node.key);
    const canExpand = expandable(node);
    const foldable = canExpand && !alwaysOpen(node);
    const current = node.descriptor.current || undefined;
    const flat = flatIndex !== undefined;
    const loadState = lazyEnabled && expanded && children.length === 0 ? loading.states.get(node.key) : undefined;
    const statusRow = !flat && loadState && loadState.status !== 'loaded'
      ? { kind: 'status' as const, key: statusKey(node.key), parent: node, state: loadState }
      : undefined;
    const groupId = `${rootId}-group-${stableKeyToken(node.key)}`;
    // The item is named by its text alone: the toggle, check box and row actions inside it are not part of that name.
    const labelId = `${rootId}-label-${stableKeyToken(node.key)}`;
    const register = (element: HTMLElement | null): void => {
      if (element) elements.current.set(node.key, element); else elements.current.delete(node.key);
    };
    const registerRow = (element: HTMLElement | null): void => {
      if (element) rowElements.current.set(node.key, element); else rowElements.current.delete(node.key);
    };
    const renaming = renamingKey === node.key && canRenameNode(node);
    const content = node.descriptor.nodeRenderer?.(context) ?? nodeRenderer?.(context) ?? context.defaultContent;
    const state = context.checkState;
    const movable = canDragNode(node);
    const shortcuts = [movable ? MOVE_SHORTCUTS : '', canRenameNode(node) ? 'F2' : ''].filter(Boolean).join(' ') || undefined;
    const startText = renaming ? renameStartText(node) : '';
    return <div
      key={node.key}
      ref={register}
      id={`${rootId}-node-${stableKeyToken(node.key)}`}
      role="treeitem"
      tabIndex={rovingKey === node.key ? 0 : -1}
      aria-level={node.depth + 1}
      aria-posinset={position}
      aria-setsize={setSize}
      aria-selected={context.allowSelection ? context.selected : undefined}
      aria-labelledby={labelId}
      aria-expanded={canExpand ? expanded : undefined}
      aria-current={current}
      aria-checked={state === 'none' ? undefined : state === 'mixed' ? 'mixed' : state === 'checked'}
      aria-disabled={context.disabled || undefined}
      aria-controls={flat ? undefined : node.children.length > 0 && expanded || statusRow ? groupId : undefined}
      aria-busy={loadState?.status === 'loading' || undefined}
      aria-describedby={movable ? instructionsId : undefined}
      aria-keyshortcuts={shortcuts}
      data-node-key={node.key}
      data-visible-index={context.visibleIndex}
      className={cx(styles.node, flat && styles.flatNode, context.selected && styles.selected, current && styles.current, expanded && styles.expanded, context.disabled && styles.nodeDisabled, !textWrap && styles.nowrap, node.descriptor.className)}
      style={flat ? flatStyle(flatIndex, node.depth) : undefined}
      onFocus={(event) => { event.stopPropagation(); hadTreeFocus.current = true; if (pendingFocus.current !== node.key) pendingFocus.current = null; setFocusedKey(node.key); }}
      onBlur={(event) => { event.stopPropagation(); if (!rootRef.current?.contains(event.relatedTarget)) hadTreeFocus.current = false; }}
      onKeyDown={(event) => handleNodeKeyDown(event, node)}
      onContextMenu={(event) => showNodeMenu(node, event, false)}
      onClick={(event) => { event.stopPropagation(); if (!context.disabled && !readOnly) activateNode(node, 'pointer', event); }}
      onDoubleClick={renameEnabled ? (event) => {
        event.stopPropagation();
        if (event.target instanceof Element && event.target.closest('button, input, [data-cg-tree-actions]')) return;
        if (canRenameNode(node)) startRenaming(node.key);
      } : undefined}
    >
      <div
        ref={registerRow}
        className={styles.row}
        data-cg-tree-row={moveEnabled ? '' : undefined}
        onPointerDown={movable ? (event) => startDrag(event, node) : undefined}
      >
        {foldable ? <button
          type="button"
          tabIndex={-1}
          className={styles.toggle}
          aria-label={formatLabel(expanded ? mergedLabels.collapse : mergedLabels.expand, node.descriptor.text)}
          disabled={context.disabled || readOnly}
          onClick={(event) => { event.stopPropagation(); void requestExpanded(node, !validExpanded.has(node.key), 'pointer', event); }}
        ><span aria-hidden="true" /></button> : <span className={styles.controlPlaceholder} aria-hidden="true" />}
        {checkMode !== 'disabled' ? node.descriptor.allowCheck !== false ? <button
          type="button"
          role="checkbox"
          tabIndex={-1}
          className={cx(styles.check, state === 'checked' && styles.checked, state === 'mixed' && styles.mixed)}
          aria-label={formatLabel(mergedLabels.check, node.descriptor.text)}
          aria-checked={state === 'mixed' ? 'mixed' : state === 'checked'}
          disabled={context.disabled || readOnly}
          onClick={(event) => { event.stopPropagation(); requestChecked(node, state !== 'checked', 'pointer', event); }}
        ><span aria-hidden="true" /></button> : <span className={styles.controlPlaceholder} aria-hidden="true" /> : null}
        {node.descriptor.icon ? <span className={styles.icon} aria-hidden="true">{renderIcon(node.descriptor.icon)}</span> : null}
        {renaming ? <span
          className={styles.rename}
          data-cg-tree-rename=""
          data-cg-no-drag=""
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {/* While the field replaces the text, the item keeps its name from a hidden copy. */}
          <span id={labelId} hidden>{content}</span>
          <CgInlineTextEditor
            label={typeof renameLabel === 'function' ? renameLabel(context) : renameLabel ?? ''}
            defaultValue={startText}
            onCommit={(text, details) => {
              if (!details.changed || !onNodeRename) return;
              onNodeRename(Object.freeze({ key: node.key, node: context, text, previousText: startText, end: details.end }));
            }}
            onDone={(details) => finishRenaming(node.key, details.end)}
          />
        </span> : <span id={labelId} className={styles.content}>{content}</span>}
        {renderActions && !renaming ? <span
          className={styles.actions}
          data-cg-tree-actions=""
          data-cg-no-drag=""
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >{renderActions(context)}</span> : null}
      </div>
      {!flat && expanded && (children.length > 0 || statusRow) ? <div id={groupId} role="group" className={styles.group}>
        {children.map((child, index) => renderNode(child, index + 1, children.length))}
        {statusRow ? renderStatus(statusRow) : null}
      </div> : null}
    </div>;
  };
  const renderFlatRows = (): ReactNode => {
    const indexes = new Set<number>();
    for (let index = windowRange.start; index < windowRange.end; index += 1) indexes.add(index);
    // The focused row and the row being renamed stay drawn, so focus and the field survive a scroll.
    for (const key of [rovingKey, renamingKey]) {
      const index = key ? rowIndex.get(key) : undefined;
      if (index !== undefined) indexes.add(index);
    }
    return [...indexes].sort((first, second) => first - second).map((index) => {
      const row = rows[index]!;
      return row.kind === 'node' ? renderNode(row.node, row.position, row.setSize, index) : renderStatus(row, index);
    });
  };

  const defaultFilter = <label className={styles.filter}>
    <span className={styles.visuallyHidden}>{mergedLabels.filter}</span>
    <CgTextBox
      type="search"
      size={size}
      fullWidth
      value={actualFilter}
      commitMode="input"
      leadingIcon="search"
      clearButton="auto"
      placeholder={mergedLabels.filterPlaceholder}
      aria-label={mergedLabels.filter}
      aria-describedby={filterMinimumLength > 1 ? `${rootId}-filter-description` : undefined}
      disabled={disabled}
      readOnly={readOnly}
      onValueChange={(value) => { setActualFilter(value); onFilterTextChange?.(value); }}
    />
    {filterMinimumLength > 1 ? <span id={`${rootId}-filter-description`} className={styles.visuallyHidden}>
      {formatLabel(mergedLabels.filterMinimumLength, filterMinimumLength)}
    </span> : null}
  </label>;
  const filterPanel = filterRenderer?.({
    filterText: actualFilter,
    normalizedQuery: filterResult.query,
    active: filterResult.active,
    setFilterText: (value) => { if (!disabled && !readOnly) { setActualFilter(value); onFilterTextChange?.(value); } },
    defaultContent: defaultFilter,
  }) ?? defaultFilter;
  const emptyContent = model.allNodes.length === 0
    ? renderEmpty?.() ?? <div className={styles.empty} role="status">{mergedLabels.empty}</div>
    : renderNoMatches?.(filterResult.query) ?? <div className={styles.empty} role="status">{mergedLabels.noMatches}</div>;

  const defaultMenuItems = (context: CgTreeViewContext<TItem>): ReadonlyArray<CgContextMenuItem<CgTreeViewContext<TItem>>> => {
    if (context.area === 'empty') return [
      { key: 'expand-all', text: mergedLabels.expandAllCommand, disabled: disabled || readOnly, command: async () => { await actions.expandAll(); } },
      { key: 'collapse-all', text: mergedLabels.collapseAllCommand, disabled: disabled || readOnly, command: async () => { await actions.collapseAll(); } },
    ];
    const current = context.key ? modelRef.current.byKey.get(context.key) : undefined;
    if (!current) return [];
    const unavailable = disabled || readOnly || Boolean(current.descriptor.disabled);
    const items: CgContextMenuItem<CgTreeViewContext<TItem>>[] = [
      { key: 'open', text: mergedLabels.openCommand, disabled: unavailable || !allowSelection || current.descriptor.allowSelection === false, command: () => { const node = requireNode(current.key); activateNode(node, 'context-menu'); } },
    ];
    if (expandable(current) && !alwaysOpen(current)) items.push({
      key: context.expanded ? 'collapse' : 'expand',
      text: context.expanded ? mergedLabels.collapseCommand : mergedLabels.expandCommand,
      disabled: unavailable,
      command: async () => { const node = requireNode(current.key); await requestExpanded(node, !expandedRef.current.has(node.key), 'context-menu'); },
    });
    if (checkMode !== 'disabled' && current.descriptor.allowCheck !== false) items.push({
      key: context.checkState === 'checked' ? 'uncheck' : 'check',
      text: context.checkState === 'checked' ? mergedLabels.uncheckCommand : mergedLabels.checkCommand,
      disabled: unavailable,
      command: () => { const node = requireNode(current.key); requestChecked(node, treeViewCheckState(node, checkedRef.current, checkMode) !== 'checked', 'context-menu'); },
    });
    items.push({ key: 'copy-key', text: mergedLabels.copyKeyCommand, command: async () => {
      const node = requireNode(current.key);
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard writing is unavailable.');
      await navigator.clipboard.writeText(node.key);
    } });
    return items;
  };

  const rootStyle: CSSProperties | undefined = virtualize ? { ...style, ['--cg-tree-row-height' as string]: `${itemHeight}px` } : style;
  const tree = virtualize ? <div
    ref={treeElementRef}
    role="tree"
    aria-label={ariaLabel}
    aria-disabled={disabled || undefined}
    aria-readonly={readOnly || undefined}
    aria-busy={operation.pending || undefined}
    className={cx(styles.tree, styles.viewport)}
    style={height === undefined ? undefined : { blockSize: typeof height === 'number' ? `${height}px` : height }}
  >
    <div ref={sizerRef} role="none" className={styles.sizer} style={{ blockSize: rows.length * itemHeight }}>
      {renderFlatRows()}
      {moveEnabled ? <CgDropIndicator ref={indicatorRef} /> : null}
    </div>
  </div> : <div
    ref={treeRef}
    role="tree"
    aria-label={ariaLabel}
    aria-disabled={disabled || undefined}
    aria-readonly={readOnly || undefined}
    aria-busy={operation.pending || undefined}
    className={cx(styles.tree, moveEnabled && styles.dropContainer)}
  >
    {filterResult.roots.map((node, index) => renderNode(node, index + 1, filterResult.roots.length))}
    {moveEnabled ? <CgDropIndicator ref={indicatorRef} /> : null}
  </div>;

  return <div
    {...nativeProps}
    style={rootStyle}
    id={rootId}
    ref={mergedRef}
    dir={resolvedDirection}
    className={cx(styles.root, styles[size], virtualize && styles.virtual, (moveEnabled || renameEnabled || lazyEnabled || virtualize || renderActions !== undefined) && styles.extended, disabled && styles.disabled, readOnly && styles.readOnly, className)}
    data-cg-treeview=""
    onContextMenu={(event) => {
      onContextMenu?.(event);
      if (event.defaultPrevented || !contextAreaEnabled('empty')) return;
      event.preventDefault();
      const context = contextFor('empty', undefined, { x: event.clientX, y: event.clientY, width: 0, height: 0 }, event, 'pointer');
      void menuRef.current?.showFromEvent(event, context, { kind: 'pointer', ownerId: rootId });
    }}
  >
    {showFilterPanel ? filterPanel : null}
    {filterResult.roots.length === 0 ? emptyContent : tree}
    {moveEnabled ? <span id={instructionsId} className={styles.visuallyHidden}>{moveLabels?.instructions}</span> : null}
    {moveEnabled || lazyEnabled ? <CgLiveAnnouncer ref={liveRef} /> : null}
    {contextMenuAreas !== 'none' ? <CgContextMenu
      items={[]}
      actionsRef={menuRef}
      ariaLabel={mergedLabels.contextMenu ?? 'Tree view context menu'}
      direction={direction}
      customizeMenu={async (details) => {
        const base = { ...details, items: defaultMenuItems(details.invocation.context) };
        return await customizeContextMenu?.(base) ?? base.items;
      }}
      validateContext={({ invocation }) => invocation.context.area === 'empty'
        || Boolean(invocation.context.key && modelRef.current.byKey.has(invocation.context.key))}
      onItemActivate={onContextMenuItemActivate}
      commandFailure={onContextMenuCommandFailure}
    /> : null}
  </div>;
}

export const CgTreeView = forwardRef(CgTreeViewInner) as <TItem = unknown>(
  props: CgTreeViewProps<TItem> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
