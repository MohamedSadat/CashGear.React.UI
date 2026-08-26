/* eslint-disable react-hooks/refs -- keyed refs coordinate controlled proposals, focus, and menu ownership. */
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ForwardedRef,
  KeyboardEvent,
  MouseEvent,
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
import type { CgContextMenuActions, CgContextMenuItem } from '../ContextMenu';
import { CgTextBox } from '../TextBox';
import styles from './CgTreeView.module.css';
import type {
  CgTreeViewActions,
  CgTreeViewChangeSource,
  CgTreeViewCheckedChangeDetails,
  CgTreeViewCheckState,
  CgTreeViewContext,
  CgTreeViewExpansionChangeDetails,
  CgTreeViewLabels,
  CgTreeViewNodeDescriptor,
  CgTreeViewNodeDetails,
  CgTreeViewNodeRenderContext,
  CgTreeViewProps,
  CgTreeViewSelectionChangeDetails,
} from './CgTreeView.types';

type TreeNode<TItem> = TreeViewModelNode<CgTreeViewNodeDescriptor<TItem>>;
type TreeEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

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
};

function setSignature(value: ReadonlySet<string>): string {
  return [...value].sort().join('\u0001');
}

function sameSet(first: ReadonlySet<string>, second: ReadonlySet<string>): boolean {
  return first.size === second.size && [...first].every((key) => second.has(key));
}

function formatLabel(template: string, text: ReactNode): string {
  return template.replace('{0}', typeof text === 'string' || typeof text === 'number' ? String(text) : 'node');
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
    id,
    className,
    onContextMenu,
    'aria-label': ariaLabel = 'Tree view',
    ...nativeProps
  }: CgTreeViewProps<TItem>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!['disabled', 'multiple', 'recursive'].includes(checkMode)) throw new Error(`CgTreeView contains unknown checkMode '${checkMode}'.`);
  if (!['none', 'node', 'empty', 'all'].includes(contextMenuAreas)) throw new Error(`CgTreeView contains unknown contextMenuAreas '${contextMenuAreas}'.`);
  const model = useMemo(() => normalizeTreeView(nodes), [nodes]);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const rootId = useCgId(id);
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };
  const operation = useAsyncOperation();
  const menuRef = useRef<CgContextMenuActions<CgTreeViewContext<TItem>>>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const actionsValue = useRef<CgTreeViewActions>(null!);
  const mounted = useRef(true);

  const [stateSelected, setStateSelected] = useControllableState(selectedKey, defaultSelectedKey, 'CgTreeView selectedKey');
  const [stateExpanded, setStateExpanded] = useControllableState(expandedKeys, new Set(defaultExpandedKeys), 'CgTreeView expandedKeys');
  const [stateChecked, setStateChecked] = useControllableState(checkedKeys, new Set(defaultCheckedKeys), 'CgTreeView checkedKeys');
  const [actualFilter, setActualFilter] = useControllableState(filterText, defaultFilterText, 'CgTreeView filterText');
  const [focusedKey, setFocusedKey] = useState<string | undefined>();

  const validSelected = useMemo(() => {
    const key = stateSelected?.trim() || null;
    const node = key ? model.byKey.get(key) : undefined;
    return allowSelection && node?.modelVisible && node.descriptor.disabled !== true && node.descriptor.allowSelection !== false
      ? node.key
      : null;
  }, [allowSelection, model, stateSelected]);
  const validExpanded = useMemo(() => new Set(model.visibleNodes
    .filter((node) => node.children.length > 0 && node.descriptor.disabled !== true && stateExpanded.has(node.key))
    .map((node) => node.key)), [model, stateExpanded]);
  const validChecked = useMemo(() => reconcileTreeViewCheckedKeys(model, stateChecked), [model, stateChecked]);
  const filterResult = useMemo(() => filterTreeViewModel(model, actualFilter, {
    minimumLength: filterMinimumLength,
    locale: filterLocale,
    text: (descriptor) => descriptor.text,
    searchText: (descriptor) => descriptor.searchText,
    predicate: filterPredicate,
  }), [actualFilter, filterLocale, filterMinimumLength, filterPredicate, model]);
  const effectiveExpanded = useMemo(() => new Set([
    ...validExpanded,
    ...filterResult.forcedExpandedKeys,
  ]), [filterResult.forcedExpandedKeys, validExpanded]);
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
  const focusableKeys = useMemo(() => disabled ? [] : renderedNodes
    .filter((node) => node.descriptor.disabled !== true)
    .map((node) => node.key), [disabled, renderedNodes]);
  const rovingKey = focusedKey && focusableKeys.includes(focusedKey)
    ? focusedKey
    : validSelected && focusableKeys.includes(validSelected)
      ? validSelected
      : focusableKeys[0];

  const modelRef = useRef(model);
  const selectedRef = useRef(validSelected);
  const expandedRef = useRef<ReadonlySet<string>>(validExpanded);
  const checkedRef = useRef<ReadonlySet<string>>(validChecked);
  const renderedRef = useRef(renderedNodes);
  modelRef.current = model;
  selectedRef.current = validSelected;
  expandedRef.current = validExpanded;
  checkedRef.current = validChecked;
  renderedRef.current = renderedNodes;

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
      hasChildren: node.children.length > 0,
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
    const changed = modelRef.current.visibleNodes.filter((node) => node.children.length > 0
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
    if (!node.modelVisible || node.children.length === 0 || node.descriptor.disabled || disabled || readOnly || expandedRef.current.has(node.key) === expanded) return Promise.resolve(false);
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

  const focusNode = useStableCallback((key?: string): Promise<void> => {
    const requested = key?.trim();
    const selectedRendered = selectedRef.current && renderedRef.current.some((node) => node.key === selectedRef.current)
      ? selectedRef.current
      : undefined;
    const resolved = requested || selectedRendered || rovingKey;
    if (!resolved) throw new Error('CgTreeView has no focusable node.');
    const node = requireNode(resolved);
    if (disabled || node.descriptor.disabled || !renderedRef.current.some((candidate) => candidate.key === node.key)) {
      throw new Error(`CgTreeView node '${node.key}' is not focusable.`);
    }
    setFocusedKey(node.key);
    elements.current.get(node.key)?.focus({ preventScroll: true });
    return Promise.resolve();
  });
  const scrollNode = useStableCallback((key: string): Promise<void> => {
    const node = requireNode(key);
    if (!renderedRef.current.some((candidate) => candidate.key === node.key)) throw new Error(`CgTreeView node '${node.key}' is not rendered.`);
    elements.current.get(node.key)?.scrollIntoView?.({ block: 'nearest' });
    return Promise.resolve();
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
      if (disabled || readOnly || !node.modelVisible || node.descriptor.disabled || node.children.length === 0) throw new Error(`CgTreeView node '${node.key}' is not expandable.`);
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
    if (hadTreeFocus.current && rovingKey) queueMicrotask(() => elements.current.get(rovingKey)?.focus({ preventScroll: true }));
  }, [focusedKey, rovingKey]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- the latest imperative menu owner must be closed.
      void menuRef.current?.hide('ownerLoss', rootId);
    };
  }, [rootId]);

  const moveFocus = (current: string, movement: 'next' | 'previous' | 'first' | 'last'): void => {
    const next = moveRovingKey(focusableKeys, current, movement);
    if (!next) return;
    setFocusedKey(next);
    elements.current.get(next)?.focus({ preventScroll: true });
    elements.current.get(next)?.scrollIntoView?.({ block: 'nearest' });
  };
  const activateNode = (node: TreeNode<TItem>, source: CgTreeViewChangeSource, event?: TreeEvent): void => {
    onNodeActivate?.(nodeDetails(node, source, event));
    void requestSelection(node, source, event);
  };
  const contextAreaEnabled = (area: 'node' | 'empty'): boolean => contextMenuAreas === 'all' || contextMenuAreas === area;
  const contextFor = (
    area: 'node' | 'empty',
    node: TreeNode<TItem> | undefined,
    rectangle: { x: number; y: number; width: number; height: number },
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
    kind: 'pointer' | 'keyboard',
  ): CgTreeViewContext<TItem> => ({
    area,
    item: node?.descriptor.item,
    parentItem: node?.parentKey ? modelRef.current.byKey.get(node.parentKey)?.descriptor.item : undefined,
    key: node?.key ?? null,
    parentKey: node?.parentKey ?? null,
    depth: node?.depth ?? 0,
    hasChildren: Boolean(node?.children.length),
    expanded: node ? effectiveExpanded.has(node.key) : false,
    checkState: node ? checkState(node) : 'none',
    disabled: disabled || readOnly || Boolean(node?.descriptor.disabled),
    targetRectangle: rectangle,
    invocation: {
      kind,
      clientX: 'clientX' in event ? event.clientX : rectangle.x,
      clientY: 'clientY' in event ? event.clientY : rectangle.y,
      button: 'button' in event ? event.button : 0,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
  });
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

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, node: TreeNode<TItem>): void => {
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) { showNodeMenu(node, event, true); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(node.key, 'next'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(node.key, 'previous'); }
    else if (event.key === 'Home') { event.preventDefault(); moveFocus(node.key, 'first'); }
    else if (event.key === 'End') { event.preventDefault(); moveFocus(node.key, 'last'); }
    else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (node.children.length > 0 && !effectiveExpanded.has(node.key)) void requestExpanded(node, true, 'keyboard', event);
      else {
        const child = (filterResult.childrenByKey.get(node.key) ?? []).find((candidate) => !candidate.descriptor.disabled);
        if (child) { setFocusedKey(child.key); elements.current.get(child.key)?.focus({ preventScroll: true }); }
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (node.children.length > 0 && validExpanded.has(node.key)) void requestExpanded(node, false, 'keyboard', event);
      else if (node.parentKey) {
        setFocusedKey(node.parentKey); elements.current.get(node.parentKey)?.focus({ preventScroll: true });
      }
    } else if (event.key === 'Enter') { event.preventDefault(); activateNode(node, 'keyboard', event); }
    else if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (checkMode !== 'disabled' && node.descriptor.allowCheck !== false) requestChecked(node, checkState(node) !== 'checked', 'keyboard', event);
      else activateNode(node, 'keyboard', event);
    }
  };

  const renderNodes = (items: ReadonlyArray<TreeNode<TItem>>): ReactNode => items.map((node, position) => {
    const context = nodeContext(node);
    const children = filterResult.childrenByKey.get(node.key) ?? [];
    const expanded = effectiveExpanded.has(node.key);
    const groupId = `${rootId}-group-${stableKeyToken(node.key)}`;
    const register = (element: HTMLElement | null): void => {
      if (element) elements.current.set(node.key, element); else elements.current.delete(node.key);
    };
    const content = node.descriptor.nodeRenderer?.(context) ?? nodeRenderer?.(context) ?? context.defaultContent;
    const state = context.checkState;
    return <div
      key={node.key}
      ref={register}
      id={`${rootId}-node-${stableKeyToken(node.key)}`}
      role="treeitem"
      tabIndex={rovingKey === node.key ? 0 : -1}
      aria-level={node.depth + 1}
      aria-posinset={position + 1}
      aria-setsize={items.length}
      aria-selected={context.allowSelection ? context.selected : undefined}
      aria-expanded={node.children.length > 0 ? expanded : undefined}
      aria-checked={state === 'none' ? undefined : state === 'mixed' ? 'mixed' : state === 'checked'}
      aria-disabled={context.disabled || undefined}
      aria-controls={node.children.length > 0 && expanded ? groupId : undefined}
      data-node-key={node.key}
      data-visible-index={context.visibleIndex}
      className={cx(styles.node, context.selected && styles.selected, expanded && styles.expanded, context.disabled && styles.nodeDisabled, !textWrap && styles.nowrap, node.descriptor.className)}
      onFocus={(event) => { event.stopPropagation(); hadTreeFocus.current = true; setFocusedKey(node.key); }}
      onBlur={(event) => { event.stopPropagation(); if (!rootRef.current?.contains(event.relatedTarget)) hadTreeFocus.current = false; }}
      onKeyDown={(event) => { event.stopPropagation(); handleKeyDown(event, node); }}
      onContextMenu={(event) => showNodeMenu(node, event, false)}
      onClick={(event) => { event.stopPropagation(); if (!context.disabled && !readOnly) activateNode(node, 'pointer', event); }}
    >
      <div className={styles.row}>
        {node.children.length > 0 ? <button
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
        <span className={styles.content}>{content}</span>
      </div>
      {expanded && children.length > 0 ? <div id={groupId} role="group" className={styles.group}>{renderNodes(children)}</div> : null}
    </div>;
  });

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
    if (current.children.length > 0) items.push({
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

  return <div
    {...nativeProps}
    id={rootId}
    ref={mergedRef}
    dir={resolvedDirection}
    className={cx(styles.root, styles[size], disabled && styles.disabled, readOnly && styles.readOnly, className)}
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
    {filterResult.roots.length === 0 ? emptyContent : <div
      role="tree"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      aria-busy={operation.pending || undefined}
      className={styles.tree}
    >{renderNodes(filterResult.roots)}</div>}
    {contextMenuAreas !== 'none' ? <CgContextMenu
      items={[]}
      actionsRef={menuRef}
      ariaLabel="Tree view context menu"
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
