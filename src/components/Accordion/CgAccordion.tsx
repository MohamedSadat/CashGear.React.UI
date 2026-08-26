/* eslint-disable react-hooks/refs -- refs coordinate abortable keyed lifecycles and collection snapshots. */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { renderIcon } from '../../internal';
import { flattenAccordionTree, normalizeAccordionTree } from '../../internal/accordionTree';
import type { AccordionTreeNode } from '../../internal/accordionTree';
import { routeMatchScore } from '../../internal/routeMatch';
import { stableKeyToken } from '../../internal/keyedCollection';
import { cx } from '../../utils';
import styles from './CgAccordion.module.css';
import type {
  CgAccordionActions, CgAccordionChangeDetails, CgAccordionChangeSource,
  CgAccordionItemDescriptor, CgAccordionItemRenderContext, CgAccordionLoadChildrenDetails, CgAccordionProps,
} from './CgAccordion.types';

const DEFAULT_LABELS = { expand: 'Expand', collapse: 'Collapse', loading: 'Loading', retry: 'Retry', loadError: 'Could not load items', filter: 'Filter items' };
type AccordionNode<TData> = AccordionTreeNode<CgAccordionItemDescriptor<TData>>;
type AccordionEvent = MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;

function setSignature(value: ReadonlySet<string>): string { return [...value].sort().join('\u0001'); }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }

function shiftedNodes<TData>(nodes: ReadonlyArray<AccordionNode<TData>>, depthOffset: number, parentKey: string): ReadonlyArray<AccordionNode<TData>> {
  const shift = (node: AccordionNode<TData>, parent: string): AccordionNode<TData> => Object.freeze({
    ...node, parentKey: parent, depth: node.depth + depthOffset,
    children: Object.freeze(node.children.map((child) => shift(child, node.key))),
  });
  return Object.freeze(nodes.map((node) => shift(node, parentKey)));
}

function CgAccordionInner<TData>(
  {
    items, expandedKeys, defaultExpandedKeys = new Set<string>(), onExpandedKeysChange,
    selectedKey, defaultSelectedKey = null, onSelectedKeyChange,
    filterText, defaultFilterText = '', onFilterTextChange,
    expansionMode = 'multiple', expansionTrigger = 'header', selectionMode = 'single', selectOnExpand = false,
    readOnly = false, disabled = false, semantics = 'auto', contentMode = 'on-demand',
    currentLocation, onNavigate, beforeExpand, afterExpand, beforeCollapse, afterCollapse,
    beforeSelectionChange, afterSelectionChange, onItemActivate, onLifecycleError,
    loadChildren, onLoadFailure, filterMinLength = 1, filterLocale, filterPredicate,
    showMatchingDescendants = true, loadChildrenWhileFiltering = false, highlightMatches = true,
    renderFilter, renderHeader, renderContent, renderIcon: renderItemIcon, renderExpandButton,
    expandButtonPosition = 'end', textOverflow = 'wrap', animated = true, animationDuration = 180,
    size = 'medium', direction = 'auto', labels, emptyContent, noMatchContent, actionsRef, className, ...nativeProps
  }: CgAccordionProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!Number.isInteger(filterMinLength) || filterMinLength < 0) throw new RangeError('CgAccordion filterMinLength must be a nonnegative integer.');
  if (!Number.isFinite(animationDuration) || animationDuration < 0) throw new RangeError('CgAccordion animationDuration must be nonnegative.');
  const baseRoots = useMemo(() => normalizeAccordionTree(items, { canLoadChildren: loadChildren !== undefined }), [items, loadChildren]);
  const loadedCache = useRef(new Map<string, ReadonlyArray<CgAccordionItemDescriptor<TData>>>());
  const requests = useRef(new Map<string, { controller: AbortController; promise: Promise<boolean> }>());
  const itemSnapshot = useRef(items);
  const [cacheRevision, setCacheRevision] = useState(0);
  const [loadingKeys, setLoadingKeys] = useState<ReadonlySet<string>>(new Set());
  const [loadErrors, setLoadErrors] = useState<ReadonlyMap<string, unknown>>(new Map());

  useEffect(() => {
    if (itemSnapshot.current === items) return;
    itemSnapshot.current = items;
    for (const request of requests.current.values()) request.controller.abort();
    requests.current.clear(); loadedCache.current.clear();
    setLoadingKeys(new Set()); setLoadErrors(new Map()); setCacheRevision((value) => value + 1);
  }, [items]);
  useEffect(() => () => { for (const request of requests.current.values()) request.controller.abort(); requests.current.clear(); }, []);

  const roots = useMemo(() => {
    void cacheRevision;
    const attach = (nodes: ReadonlyArray<AccordionNode<TData>>): ReadonlyArray<AccordionNode<TData>> => Object.freeze(nodes.map((node) => {
      const staticChildren = attach(node.children);
      const cached = loadedCache.current.get(node.key);
      const loaded = cached ? shiftedNodes(normalizeAccordionTree(cached, { canLoadChildren: loadChildren !== undefined }), node.depth + 1, node.key) : [];
      const children = Object.freeze([...staticChildren, ...loaded]);
      return children.length === node.children.length && loaded.length === 0 && children.every((child, index) => child === node.children[index]) ? node : Object.freeze({ ...node, children });
    }));
    return attach(baseRoots);
  }, [baseRoots, cacheRevision, loadChildren]);
  const flat = useMemo(() => flattenAccordionTree(roots), [roots]);
  const byKey = useMemo(() => new Map(flat.map((node) => [node.key, node])), [flat]);
  const isExpandable = useStableCallback((node: AccordionNode<TData>) => expansionMode !== 'none' && node.descriptor.expandable !== false
    && (node.children.length > 0 || node.descriptor.hasChildren === true || node.descriptor.content !== undefined || node.descriptor.expandable === true));

  const [stateExpanded, setStateExpanded] = useControllableState(expandedKeys, new Set(defaultExpandedKeys), 'CgAccordion expandedKeys');
  const validExpanded = useMemo(() => new Set([...stateExpanded].filter((key) => { const node = byKey.get(key); return node !== undefined && isExpandable(node); })), [byKey, isExpandable, stateExpanded]);
  const [stateSelected, setStateSelected] = useControllableState(selectedKey, defaultSelectedKey, 'CgAccordion selectedKey');
  const validSelected = stateSelected && byKey.has(stateSelected) ? stateSelected : null;
  const [actualFilter, setActualFilter] = useControllableState(filterText, defaultFilterText, 'CgAccordion filterText');
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const rootId = useCgId(nativeProps.id);
  const elements = useRef(new Map<string, HTMLElement>());
  const operation = useAsyncOperation();
  const expandedRef = useRef(validExpanded); expandedRef.current = validExpanded;
  const selectedRef = useRef(validSelected); selectedRef.current = validSelected;
  const nodesRef = useRef(byKey); nodesRef.current = byKey;
  const visitedRef = useRef(new Set<string>(validExpanded));
  for (const key of validExpanded) visitedRef.current.add(key);
  for (const key of [...visitedRef.current]) if (!byKey.has(key)) visitedRef.current.delete(key);
  const correctionRef = useRef('');
  const pendingExpansion = useRef<{ signature: string; details: CgAccordionChangeDetails<TData>[] } | undefined>(undefined);
  const pendingSelection = useRef<{ key: string | null; details: CgAccordionChangeDetails<TData> } | undefined>(undefined);
  const mergedLabels = { ...DEFAULT_LABELS, ...labels };

  const reportError = useStableCallback((error: unknown, details: CgAccordionChangeDetails<TData>) => { try { onLifecycleError?.(error, details); } catch { /* Reporting is terminal. */ } });
  const runExpansionAfter = useStableCallback(async (details: CgAccordionChangeDetails<TData>) => { try { await (details.expanded ? afterExpand?.(details) : afterCollapse?.(details)); } catch (error) { reportError(error, details); } });
  const runSelectionAfter = useStableCallback(async (details: CgAccordionChangeDetails<TData>) => { try { await afterSelectionChange?.(details); } catch (error) { reportError(error, details); } });
  const proposeExpanded = useStableCallback((nextValue: ReadonlySet<string>, details: CgAccordionChangeDetails<TData>[]) => {
    const next = new Set(nextValue); for (const detail of details) detail.expandedKeys = next;
    setStateExpanded(next); if (details[0]) onExpandedKeysChange?.(next, details[0]);
    for (const detail of details) if (detail.expanded && detail.key) visitedRef.current.add(detail.key);
    if (expandedKeys === undefined) for (const detail of details) void runExpansionAfter(detail);
    else pendingExpansion.current = { signature: setSignature(next), details };
  });
  const proposeSelected = useStableCallback((next: string | null, details: CgAccordionChangeDetails<TData>) => {
    setStateSelected(next); onSelectedKeyChange?.(next, details);
    if (selectedKey === undefined) void runSelectionAfter(details); else pendingSelection.current = { key: next, details };
  });

  useEffect(() => {
    const pending = pendingExpansion.current;
    if (pending?.signature === setSignature(validExpanded)) { pendingExpansion.current = undefined; for (const details of pending.details) void runExpansionAfter(details); }
  }, [runExpansionAfter, validExpanded]);
  useEffect(() => {
    const pending = pendingSelection.current;
    if (pending && pending.key === validSelected) { pendingSelection.current = undefined; void runSelectionAfter(pending.details); }
  }, [runSelectionAfter, validSelected]);
  useEffect(() => {
    const expandedMismatch = setSignature(stateExpanded) !== setSignature(validExpanded);
    const selectedMismatch = stateSelected !== validSelected;
    const signature = `${setSignature(stateExpanded)}>${setSignature(validExpanded)}|${String(stateSelected)}>${String(validSelected)}|${[...byKey.keys()].join()}`;
    if ((!expandedMismatch && !selectedMismatch) || correctionRef.current === signature) return;
    correctionRef.current = signature;
    if (expandedMismatch) {
      const removed = [...stateExpanded].find((key) => !validExpanded.has(key)) ?? null;
      proposeExpanded(validExpanded, [{ key: removed, expanded: false, expandedKeys: validExpanded, source: 'collection', isUserInitiated: false }]);
    }
    if (selectedMismatch) proposeSelected(validSelected, { key: validSelected, previousSelectedKey: stateSelected, selectedKey: validSelected, expandedKeys: validExpanded, source: 'collection', isUserInitiated: false });
  }, [byKey, proposeExpanded, proposeSelected, stateExpanded, stateSelected, validExpanded, validSelected]);

  const ensureLoaded = useStableCallback((key: string, refresh: boolean = false): Promise<boolean> => {
    const node = nodesRef.current.get(key);
    if (!node || !node.descriptor.hasChildren || !loadChildren) return Promise.resolve(true);
    if (!refresh && loadedCache.current.has(key)) return Promise.resolve(true);
    const existing = requests.current.get(key); if (existing) return existing.promise;
    const controller = new AbortController(); const snapshot = itemSnapshot.current;
    const details: CgAccordionLoadChildrenDetails<TData> = { item: node.descriptor, key, depth: node.depth, refresh, signal: controller.signal };
    setLoadingKeys((current) => new Set(current).add(key));
    setLoadErrors((current) => { const next = new Map(current); next.delete(key); return next; });
    const promise = Promise.resolve(loadChildren(details)).then((children) => {
      if (controller.signal.aborted || itemSnapshot.current !== snapshot) return false;
      const existingKeys = new Set(nodesRef.current.keys()); existingKeys.delete(key);
      const normalized = normalizeAccordionTree(children, { canLoadChildren: true });
      for (const child of flattenAccordionTree(normalized)) if (existingKeys.has(child.key)) throw new Error(`CgAccordion contains duplicate key '${child.key}' in loaded children.`);
      loadedCache.current.set(key, Object.freeze([...children])); setCacheRevision((value) => value + 1); return true;
    }).catch((error: unknown) => {
      if (controller.signal.aborted || isAbort(error)) return false;
      setLoadErrors((current) => new Map(current).set(key, error));
      try { onLoadFailure?.(error, details); } catch { /* Reporting is terminal. */ } return false;
    }).finally(() => {
      if (requests.current.get(key)?.controller === controller) requests.current.delete(key);
      setLoadingKeys((current) => { const next = new Set(current); next.delete(key); return next; });
    });
    requests.current.set(key, { controller, promise }); return promise;
  });

  const baseDetails = useStableCallback((node: AccordionNode<TData>, source: CgAccordionChangeSource, event?: AccordionEvent): CgAccordionChangeDetails<TData> => ({
    key: node.key, item: node.descriptor, expandedKeys: expandedRef.current, source, isUserInitiated: source === 'pointer' || source === 'keyboard', ...(event ? { event } : {}),
  }));
  const requestExpanded = useStableCallback(async (key: string, expand: boolean, source: CgAccordionChangeSource = 'action', event?: AccordionEvent): Promise<boolean> => {
    const node = nodesRef.current.get(key);
    if (!node || !isExpandable(node) || disabled || node.descriptor.disabled || readOnly || expandedRef.current.has(key) === expand) return false;
    if (expand && !(await ensureLoaded(key))) return false;
    const detail = { ...baseDetails(node, source, event), expanded: expand };
    try {
      return await operation.run(async ({ signal }) => {
        if (await (expand ? beforeExpand?.({ ...detail, signal }) : beforeCollapse?.({ ...detail, signal })) === false || signal.aborted) return false;
        const next = new Set(expandedRef.current); const afterDetails: CgAccordionChangeDetails<TData>[] = [];
        if (expand && expansionMode === 'single-sibling') {
          const siblings = [...nodesRef.current.values()].filter((candidate) => candidate.parentKey === node.parentKey && candidate.key !== key && next.has(candidate.key));
          for (const sibling of siblings) {
            const collapse = { ...baseDetails(sibling, source, event), expanded: false };
            if (await beforeCollapse?.({ ...collapse, signal }) !== false) { next.delete(sibling.key); afterDetails.push(collapse); }
            if (signal.aborted) return false;
          }
        }
        if (expand) next.add(key); else { next.delete(key); requests.current.get(key)?.controller.abort(); requests.current.delete(key); }
        afterDetails.push(detail); proposeExpanded(next, afterDetails); return true;
      });
    } catch (error) { if (!isAbort(error)) reportError(error, detail); return false; }
  });

  const requestSelection = useStableCallback(async (key: string, source: CgAccordionChangeSource = 'action', event?: AccordionEvent): Promise<boolean> => {
    const node = nodesRef.current.get(key);
    if (!node || selectionMode === 'none' || node.descriptor.selectable === false || node.descriptor.disabled || disabled || readOnly || selectedRef.current === key) return false;
    const detail: CgAccordionChangeDetails<TData> = { ...baseDetails(node, source, event), previousSelectedKey: selectedRef.current, selectedKey: key };
    try {
      return await operation.run(async ({ signal }) => {
        if (await beforeSelectionChange?.({ ...detail, signal }) === false || signal.aborted || nodesRef.current.get(key)?.descriptor !== node.descriptor) return false;
        proposeSelected(key, detail); return true;
      });
    } catch (error) { if (!isAbort(error)) reportError(error, detail); return false; }
  });

  const bulkExpanded = useStableCallback(async (targets: ReadonlySet<string>, source: CgAccordionChangeSource): Promise<boolean> => {
    const before = expandedRef.current;
    const changes = [...new Set([...before, ...targets])].filter((key) => before.has(key) !== targets.has(key));
    if (changes.length === 0) return false;
    try {
      return await operation.run(async ({ signal }) => {
        const accepted = new Set(before); const after: CgAccordionChangeDetails<TData>[] = [];
        for (const key of changes) {
          const node = nodesRef.current.get(key); if (!node || node.descriptor.disabled) continue;
          const expand = targets.has(key); if (expand && !(await ensureLoaded(key))) continue;
          const detail = { ...baseDetails(node, source), expanded: expand };
          if (await (expand ? beforeExpand?.({ ...detail, signal }) : beforeCollapse?.({ ...detail, signal })) === false) continue;
          if (signal.aborted) return false;
          if (expand) accepted.add(key); else { accepted.delete(key); requests.current.get(key)?.controller.abort(); }
          after.push(detail);
        }
        if (after.length === 0) return false; proposeExpanded(accepted, after); return true;
      });
    } catch (error) {
      const node = nodesRef.current.get(changes[0]!); if (!isAbort(error) && node) reportError(error, baseDetails(node, source)); return false;
    }
  });
  const focusItem = useStableCallback((key?: string) => {
    const resolved = key ?? selectedRef.current ?? [...elements.current.keys()][0]; if (resolved) elements.current.get(resolved)?.focus({ preventScroll: true });
  });
  useImperativeHandle(actionsRef, (): CgAccordionActions => ({
    setItemExpanded: (key, expand) => requestExpanded(key, expand),
    expandAll: () => {
      const targets = new Set<string>();
      if (expansionMode === 'single-sibling') {
        const seen = new Set<string>();
        for (const node of nodesRef.current.values()) if (isExpandable(node) && !node.descriptor.disabled) { const group = node.parentKey ?? '__root'; if (!seen.has(group)) { seen.add(group); targets.add(node.key); } }
      } else if (expansionMode === 'multiple') for (const node of nodesRef.current.values()) if (isExpandable(node) && !node.descriptor.disabled) targets.add(node.key);
      return bulkExpanded(targets, 'action');
    },
    collapseAll: () => bulkExpanded(new Set(), 'action'),
    expandToItem: (key) => { const targets = new Set(expandedRef.current); let node = nodesRef.current.get(key); while (node?.parentKey) { targets.add(node.parentKey); node = nodesRef.current.get(node.parentKey); } return bulkExpanded(targets, 'action'); },
    isItemExpanded: (key) => expandedRef.current.has(key), selectItem: (key) => requestSelection(key),
    clearSelection: () => proposeSelected(null, { key: null, previousSelectedKey: selectedRef.current, selectedKey: null, expandedKeys: expandedRef.current, source: 'action', isUserInitiated: false }),
    focus: focusItem, reloadChildren: (key) => ensureLoaded(key, true),
  }), [bulkExpanded, ensureLoaded, expansionMode, focusItem, isExpandable, proposeSelected, requestExpanded, requestSelection]);

  const [browserLocation, setBrowserLocation] = useState('');
  useEffect(() => {
    if (currentLocation !== undefined || typeof window === 'undefined') return;
    const update = () => setBrowserLocation(window.location.href); update();
    window.addEventListener('popstate', update); window.addEventListener('hashchange', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update); };
  }, [currentLocation]);
  const location = currentLocation ?? browserLocation;
  const routedLocation = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!location || routedLocation.current === location) return; routedLocation.current = location;
    let best: AccordionNode<TData> | undefined; let score = -1;
    for (const node of nodesRef.current.values()) if (node.navigateUrl) { const candidate = routeMatchScore(node.navigateUrl, location, node.descriptor.routeMatch ?? 'prefix'); if (candidate > score) { score = candidate; best = node; } }
    if (!best) return;
    if (selectionMode !== 'none' && best.descriptor.selectable !== false) proposeSelected(best.key, { ...baseDetails(best, 'route'), previousSelectedKey: selectedRef.current, selectedKey: best.key, isUserInitiated: false });
    const next = new Set(expandedRef.current); let parent = best.parentKey;
    while (parent) { next.add(parent); parent = nodesRef.current.get(parent)?.parentKey; }
    if (setSignature(next) !== setSignature(expandedRef.current)) proposeExpanded(next, [{ ...baseDetails(best, 'route'), expanded: true, isUserInitiated: false }]);
  }, [baseDetails, location, proposeExpanded, proposeSelected, selectionMode]);

  const normalizedQuery = actualFilter.trim().toLocaleLowerCase(filterLocale);
  const filtering = normalizedQuery.length >= filterMinLength && normalizedQuery.length > 0;
  const filterResult = useMemo(() => {
    const matched = new Set<string>(); const transientExpanded = new Set<string>();
    if (!filtering) return { roots, matched, transientExpanded };
    const matches = (node: AccordionNode<TData>) => filterPredicate ? filterPredicate(node.descriptor, normalizedQuery) : `${node.descriptor.text} ${node.descriptor.searchText ?? ''}`.toLocaleLowerCase(filterLocale).includes(normalizedQuery);
    const filterNodes = (nodes: ReadonlyArray<AccordionNode<TData>>, ancestorMatched = false): ReadonlyArray<AccordionNode<TData>> => nodes.flatMap((node) => {
      const own = matches(node); if (own) matched.add(node.key);
      const includeAll = ancestorMatched || (own && showMatchingDescendants);
      const children = includeAll ? node.children : filterNodes(node.children, false);
      if (!own && children.length === 0 && !ancestorMatched) return [];
      if (children.length > 0) transientExpanded.add(node.key);
      return [children === node.children ? node : Object.freeze({ ...node, children: Object.freeze(children) })];
    });
    return { roots: Object.freeze(filterNodes(roots)), matched, transientExpanded };
  }, [filterLocale, filterPredicate, filtering, normalizedQuery, roots, showMatchingDescendants]);
  const filteredRoots = filterResult.roots;
  const matchedKeys = filterResult.matched;
  const effectiveExpanded = useMemo(() => filtering ? new Set([...validExpanded, ...filterResult.transientExpanded]) : validExpanded, [filterResult.transientExpanded, filtering, validExpanded]);
  useEffect(() => { if (filtering && loadChildrenWhileFiltering) for (const node of flat) if (node.descriptor.hasChildren && !loadedCache.current.has(node.key)) void ensureLoaded(node.key); }, [ensureLoaded, filterText, filtering, flat, loadChildrenWhileFiltering]);
  const visibleFlat = useMemo(() => {
    const result: AccordionNode<TData>[] = []; const visit = (nodes: ReadonlyArray<AccordionNode<TData>>) => { for (const node of nodes) { result.push(node); if (effectiveExpanded.has(node.key)) visit(node.children); } }; visit(filteredRoots); return result;
  }, [effectiveExpanded, filteredRoots]);
  const [focusedKey, setFocusedKey] = useState<string | undefined>();
  const rovingKey = focusedKey && visibleFlat.some((node) => node.key === focusedKey) ? focusedKey : validSelected && visibleFlat.some((node) => node.key === validSelected) ? validSelected : visibleFlat[0]?.key;
  const resolvedSemantics = semantics === 'auto' ? (loadChildren || flat.some((node) => node.depth > 0 || node.navigateUrl) ? 'tree' : 'disclosure') : semantics;
  const moveFocus = (key: string, movement: 'next' | 'previous' | 'first' | 'last') => {
    const index = visibleFlat.findIndex((node) => node.key === key);
    const next = movement === 'first' ? visibleFlat[0] : movement === 'last' ? visibleFlat.at(-1) : visibleFlat[(index + (movement === 'next' ? 1 : -1) + visibleFlat.length) % visibleFlat.length];
    if (next) { setFocusedKey(next.key); elements.current.get(next.key)?.focus(); }
  };
  const handleTreeKey = (event: KeyboardEvent<HTMLElement>, node: AccordionNode<TData>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); moveFocus(node.key, 'next'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveFocus(node.key, 'previous'); }
    else if (event.key === 'Home') { event.preventDefault(); moveFocus(node.key, 'first'); }
    else if (event.key === 'End') { event.preventDefault(); moveFocus(node.key, 'last'); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); if (isExpandable(node) && !effectiveExpanded.has(node.key)) void requestExpanded(node.key, true, 'keyboard', event); else if (node.children[0]) focusItem(node.children[0].key); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); if (isExpandable(node) && effectiveExpanded.has(node.key)) void requestExpanded(node.key, false, 'keyboard', event); else if (node.parentKey) focusItem(node.parentKey); }
    else if (event.key === ' ') { event.preventDefault(); void requestSelection(node.key, 'keyboard', event); }
  };
  const highlightedText = (text: string): ReactNode => {
    if (!filtering || !highlightMatches) return text;
    const index = text.toLocaleLowerCase(filterLocale).indexOf(normalizedQuery); if (index < 0) return text;
    return <>{text.slice(0, index)}<mark>{text.slice(index, index + normalizedQuery.length)}</mark>{text.slice(index + normalizedQuery.length)}</>;
  };

  const renderNode = (node: AccordionNode<TData>, position: number, setSize: number): ReactNode => {
    const item = node.descriptor; const expanded = effectiveExpanded.has(node.key); const actual = validExpanded.has(node.key);
    const expandable = isExpandable(node); const selected = validSelected === node.key; const loading = loadingKeys.has(node.key); const error = loadErrors.get(node.key);
    const panelId = `${rootId}-panel-${stableKeyToken(node.key)}`; const headerId = `${rootId}-header-${stableKeyToken(node.key)}`;
    const contentWanted = item.content !== undefined; const retained = contentMode === 'always' || expanded || (contentMode === 'on-demand' && visitedRef.current.has(node.key));
    const renderRegion = (contentWanted && retained) || error !== undefined || loading || (expanded && node.children.length > 0);
    const defaultIcon = item.icon ? renderIcon(item.icon) : null;
    const context: CgAccordionItemRenderContext<TData> = { item, key: node.key, depth: node.depth, expanded, selected, disabled: disabled || Boolean(item.disabled), loading, error, matched: matchedKeys.has(node.key), defaultContent: highlightedText(item.text) };
    const icon = item.renderIcon?.({ ...context, defaultContent: defaultIcon }) ?? renderItemIcon?.({ ...context, defaultContent: defaultIcon }) ?? defaultIcon;
    const caption = item.renderHeader?.(context) ?? renderHeader?.(context) ?? (renderFilter ? renderFilter({ item, key: node.key, depth: node.depth, query: normalizedQuery, matched: matchedKeys.has(node.key), defaultContent: context.defaultContent }) : context.defaultContent);
    const toggle = async (event: MouseEvent<HTMLElement>) => { const changed = expandable ? await requestExpanded(node.key, !actual, 'pointer', event) : false; if ((changed && selectOnExpand) || !expandable) await requestSelection(node.key, 'pointer', event); onItemActivate?.({ ...baseDetails(node, 'pointer', event), expanded: changed ? !actual : actual, selectedKey: node.key }); };
    const register = (element: HTMLElement | null) => { if (element) elements.current.set(node.key, element); else elements.current.delete(node.key); };
    const mainProps = { id: headerId, className: styles.headerAction, 'aria-disabled': disabled || item.disabled || undefined, 'aria-selected': resolvedSemantics === 'tree' && selectionMode !== 'none' ? selected : undefined, 'aria-expanded': expandable && !item.navigateUrl && expansionTrigger === 'header' ? expanded : undefined, 'aria-controls': expandable && !item.navigateUrl && expansionTrigger === 'header' && renderRegion ? panelId : undefined, tabIndex: resolvedSemantics === 'tree' ? (rovingKey === node.key ? 0 : -1) : undefined, onFocus: () => setFocusedKey(node.key), onKeyDown: (event: KeyboardEvent<HTMLElement>) => { if (resolvedSemantics === 'tree') handleTreeKey(event, node); } };
    const headerAction = item.navigateUrl
      ? <a {...mainProps} ref={register} href={disabled || item.disabled ? undefined : item.navigateUrl} target={item.target} onClick={(event) => { if (disabled || item.disabled) { event.preventDefault(); return; } void requestSelection(node.key, 'pointer', event); onItemActivate?.({ ...baseDetails(node, 'pointer', event), selectedKey: node.key }); onNavigate?.(item, event); }}><span className={styles.icon}>{icon}</span><span className={styles.text}>{caption}</span></a>
      : <button {...mainProps} ref={register} type="button" disabled={disabled || item.disabled} onClick={(event) => { if (expansionTrigger === 'header' && expandable) void toggle(event); else { void requestSelection(node.key, 'pointer', event); onItemActivate?.({ ...baseDetails(node, 'pointer', event), selectedKey: node.key }); } }}><span className={styles.icon}>{icon}</span><span className={styles.text}>{caption}</span></button>;
    const showSeparateToggle = expandable && (expansionTrigger === 'button' || Boolean(item.navigateUrl)); const defaultToggle = <span aria-hidden="true">{expanded ? '−' : '+'}</span>;
    const expandControl = showSeparateToggle ? <button type="button" className={styles.expandButton} disabled={disabled || item.disabled || loading} aria-label={expanded ? mergedLabels.collapse : mergedLabels.expand} aria-expanded={expanded} aria-controls={renderRegion ? panelId : undefined} onClick={(event) => { void toggle(event); }}>{item.renderExpandButton?.({ ...context, defaultContent: defaultToggle }) ?? renderExpandButton?.({ ...context, defaultContent: defaultToggle }) ?? defaultToggle}</button> : null;
    const header = <div className={cx(styles.header, item.headerClassName)}>{expandButtonPosition === 'start' && expandControl}{headerAction}{expandButtonPosition === 'end' && expandControl}{loading ? <span className={styles.status} role="status">{mergedLabels.loading}</span> : null}</div>;
    const defaultContent = item.content; const panelContent = item.renderContent?.({ ...context, defaultContent }) ?? renderContent?.({ ...context, defaultContent }) ?? defaultContent;
    const region = renderRegion ? <div id={panelId} role={resolvedSemantics === 'disclosure' && contentWanted ? 'region' : undefined} aria-labelledby={headerId} className={cx(styles.panel, item.contentClassName)} hidden={!expanded && error === undefined && !loading} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); focusItem(node.key); } }}>
      {error ? <div className={styles.error} role="alert">{mergedLabels.loadError} <button type="button" onClick={() => { void ensureLoaded(node.key, true); }}>{mergedLabels.retry}</button></div> : null}
      {contentWanted ? panelContent : null}
      {expanded && node.children.length > 0 ? <div role={resolvedSemantics === 'tree' ? 'group' : undefined} className={styles.children}>{node.children.map((child, index) => renderNode(child, index + 1, node.children.length))}</div> : null}
    </div> : null;
    if (resolvedSemantics === 'tree') return <div key={node.key} role="treeitem" aria-level={node.depth + 1} aria-posinset={position} aria-setsize={setSize} aria-expanded={expandable ? expanded : undefined} aria-selected={selectionMode !== 'none' ? selected : undefined} aria-disabled={disabled || item.disabled || undefined} aria-busy={loading || undefined} className={cx(styles.item, item.className, selected && styles.selected)}>{header}{region}</div>;
    return <div key={node.key} className={cx(styles.item, item.className, selected && styles.selected)}><div role="heading" aria-level={Math.min(6, node.depth + 3)} className={styles.heading}>{header}</div>{region}</div>;
  };

  const hasFilter = filterText !== undefined || defaultFilterText !== '' || onFilterTextChange !== undefined || renderFilter !== undefined;
  if (flat.length === 0 && !hasFilter) return emptyContent === undefined ? null : <>{emptyContent}</>;
  return <div {...nativeProps} id={rootId} ref={mergedRef} dir={resolvedDirection} aria-busy={operation.pending || undefined} className={cx(styles.root, styles[size], styles[textOverflow], !animated && styles.noAnimation, className)} style={{ '--cg-accordion-duration': `${animationDuration}ms`, ...nativeProps.style } as React.CSSProperties}>
    {hasFilter ? <label className={styles.filter}><span>{mergedLabels.filter}</span><input type="search" value={actualFilter} disabled={disabled} onChange={(event) => { setActualFilter(event.currentTarget.value); onFilterTextChange?.(event.currentTarget.value); }} /></label> : null}
    {filteredRoots.length === 0 ? (filtering ? noMatchContent : emptyContent) ?? null : <div role={resolvedSemantics === 'tree' ? 'tree' : undefined} aria-label={resolvedSemantics === 'tree' ? nativeProps['aria-label'] : undefined} className={styles.items}>{filteredRoots.map((node, index) => renderNode(node, index + 1, filteredRoots.length))}</div>}
  </div>;
}

export const CgAccordion = forwardRef(CgAccordionInner) as <TData = unknown>(props: CgAccordionProps<TData> & RefAttributes<HTMLDivElement>) => ReactElement | null;
