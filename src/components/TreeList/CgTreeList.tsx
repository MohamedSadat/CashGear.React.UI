/* eslint-disable @typescript-eslint/no-base-to-string, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/require-await, react-hooks/exhaustive-deps -- Unknown values are formatted at descriptor boundaries; promise-shaped actions may settle synchronously; stable runtime refs intentionally read the latest render state. */
import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ChangeEvent, CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useCgId, useControllableState, useDirection } from '../../hooks';
import { renderIcon } from '../../internal';
import { cx } from '../../utils';
import { CgContextMenu } from '../ContextMenu';
import type { CgContextMenuActions, CgContextMenuItem } from '../ContextMenu';
import { CgPager } from '../Pager';
import { CgPopup } from '../Popup';
import { clampTreeListColumnWidth, normalizeTreeListColumns, validateTreeListColumns } from './columns';
import { createTreeListXlsx, downloadTreeListExport } from './exportXlsx';
import {
  attachLoadedChildren,
  buildFlatHierarchy,
  buildNestedHierarchy,
  buildProviderHierarchy,
  formatTreeListValue,
  hierarchyAncestors,
  hierarchyDescendants,
  projectHierarchy,
  treeListKeyToken,
} from './hierarchy';
import type { TreeListHierarchy, TreeListHierarchyNode, TreeListProjectionNode } from './hierarchy';
import { createTreeListState, normalizeTreeListState } from './state';
import styles from './CgTreeList.module.css';
import type {
  CgTreeListActions,
  CgTreeListCheckState,
  CgTreeListColumn,
  CgTreeListContext,
  CgTreeListExpansionEventDetail,
  CgTreeListExportOptions,
  CgTreeListExportResult,
  CgTreeListFilterMode,
  CgTreeListKey,
  CgTreeListLabels,
  CgTreeListMutationResult,
  CgTreeListParentKey,
  CgTreeListPdfResult,
  CgTreeListPrintOptions,
  CgTreeListPrintResult,
  CgTreeListProps,
  CgTreeListProviderNode,
  CgTreeListProviderRequest,
  CgTreeListProviderRequestMode,
  CgTreeListSnapshot,
  CgTreeListSnapshotRow,
  CgTreeListSummary,
} from './CgTreeList.types';

const DEFAULT_LABELS: CgTreeListLabels = {
  searchPlaceholder: 'Search hierarchy', empty: 'No records', loading: 'Loading…', retry: 'Retry',
  expand: 'Expand {0}', collapse: 'Collapse {0}', loadMore: 'Load more', edit: 'Edit', save: 'Save',
  cancel: 'Cancel', delete: 'Delete', addRoot: 'Add root', addChild: 'Add child', columns: 'Columns',
  noMatches: 'No matching records', detail: 'Details',
};

interface LazyPage<TItem> { readonly items: ReadonlyArray<TItem>; readonly hasMore: boolean; readonly totalCount?: number; readonly nextSkip: number }
interface LoadStatus { readonly state: 'loading' | 'error'; readonly errorCode?: string }
interface DetailStatus { readonly loading: boolean; readonly detail?: unknown; readonly errorCode?: string; readonly attempt: number }
interface SummaryStatus { readonly value?: unknown; readonly completeness: 'complete' | 'partial' | 'unknown'; readonly errorCode?: string }
interface OptimisticUpdate<TItem> { readonly operationId: number; readonly item: TItem }
interface EditSession<TItem, TKey extends CgTreeListKey> { readonly sessionId: number; readonly kind: 'create' | 'update'; readonly key: TKey | null; readonly parentKey: CgTreeListParentKey<TKey>; readonly original?: TItem; readonly draft: TItem; readonly attempt: number; readonly saving: boolean; readonly result?: CgTreeListMutationResult<TItem> }

function immutableSet<T>(items: Iterable<T>): ReadonlySet<T> { return Object.freeze(new Set(items)); }
function immutableArray<T>(items: Iterable<T>): ReadonlyArray<T> { return Object.freeze([...items]); }
function label(template: string, value: string): string { return template.replace('{0}', value); }
function escapeHtml(value: unknown): string { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
function tokenOrNull(key: CgTreeListKey): string | null { try { return treeListKeyToken(key); } catch { return null; } }

function calculateSummary<TItem, TKey extends CgTreeListKey>(summary: CgTreeListSummary<TItem>, items: ReadonlyArray<TItem>, columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>): unknown {
  if (summary.type === 'count') return items.length;
  const column = columns.find((candidate) => candidate.fieldId === summary.fieldId); if (!column?.getValue) return undefined;
  const values = items.map((item) => column.getValue!(item)).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return undefined;
  if (summary.type === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (summary.type === 'average') return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (summary.type === 'minimum') return Math.min(...values);
  if (summary.type === 'maximum') return Math.max(...values);
  return undefined;
}

function IndeterminateCheckbox(props: { readonly checked: boolean; readonly mixed: boolean; readonly disabled: boolean; readonly label: string; readonly onChange: (checked: boolean) => void }): ReactNode {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = props.mixed; }, [props.mixed]);
  return <input ref={ref} className={styles.checkbox} type="checkbox" checked={props.checked} disabled={props.disabled} aria-label={props.label} aria-checked={props.mixed ? 'mixed' : props.checked} onChange={(event) => props.onChange(event.currentTarget.checked)} onClick={(event) => event.stopPropagation()} />;
}

function highlightedText(text: string, query: string): ReactNode {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return text;
  const source = text.toLocaleLowerCase();
  const result: ReactNode[] = [];
  let cursor = 0;
  let index = source.indexOf(normalized);
  while (index >= 0) {
    if (index > cursor) result.push(text.slice(cursor, index));
    result.push(<mark key={`${index}-${cursor}`}>{text.slice(index, index + normalized.length)}</mark>);
    cursor = index + normalized.length;
    index = source.indexOf(normalized, cursor);
  }
  if (cursor < text.length) result.push(text.slice(cursor));
  return result.length ? result : text;
}

export function CgTreeList<TItem, TKey extends CgTreeListKey = CgTreeListKey>(props: CgTreeListProps<TItem, TKey>): ReactNode {
  const {
    columns,
    maximumDepth,
    expandedKeys: controlledExpandedKeys,
    defaultExpandedKeys = new Set<TKey>(),
    selectedKeys: controlledSelectedKeys,
    defaultSelectedKeys = new Set<TKey>(),
    checkedKeys: controlledCheckedKeys,
    defaultCheckedKeys = new Set<TKey>(),
    focusedKey: controlledFocusedKey,
    defaultFocusedKey = null,
    focusedColumnId: controlledFocusedColumnId,
    defaultFocusedColumnId = null,
    sorts: controlledSorts,
    defaultSorts = [],
    filter: controlledFilter,
    defaultFilter = null,
    filterMode: controlledFilterMode,
    defaultFilterMode = 'match-with-ancestors',
    searchText: controlledSearchText,
    defaultSearchText = '',
    state: controlledState,
    defaultState,
    expandedDetailKeys: controlledDetailKeys,
    defaultExpandedDetailKeys = new Set<TKey>(),
    selectionMode = 'single',
    checkMode = 'disabled',
    rowHeight = 40,
    overscan = 4,
    columnOverscan = 1,
    rootPageSize = 50,
    childPageSize = 50,
    maximumProviderTake = 500,
    queryId = 'default',
    direction = 'auto',
    size = 'medium',
    stickyHeader = true,
    labels,
    actionsRef,
    id,
    className,
    style,
    height,
    'aria-label': ariaLabel = 'Hierarchical data',
    ...nativeProps
  } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const directionValue = useDirection(rootRef, direction);
  const rootId = useCgId(id);
  const mergedLabels = useMemo(() => ({ ...DEFAULT_LABELS, ...labels }), [labels]);
  const hierarchyFieldId = useMemo(() => validateTreeListColumns(columns), [columns]);
  const initialState = useMemo(() => normalizeTreeListState(columns, { ...defaultState, sorts: defaultState?.sorts ?? defaultSorts, filter: defaultState?.filter ?? defaultFilter, filterMode: defaultState?.filterMode ?? defaultFilterMode, groups: defaultState?.groups ?? props.groups ?? [], rootPage: defaultState?.rootPage ?? { pageIndex: 0, pageSize: rootPageSize } }, hierarchyFieldId), []); // initial-only defaults
  const normalizedControlledState = useMemo(() => controlledState ? normalizeTreeListState(columns, controlledState, hierarchyFieldId) : undefined, [columns, controlledState, hierarchyFieldId]);
  const [viewState, setViewState] = useControllableState(normalizedControlledState, initialState, 'CgTreeList');
  const [expandedKeys, setExpandedKeys] = useControllableState(controlledExpandedKeys, immutableSet(defaultExpandedKeys), 'CgTreeList');
  const [selectedKeys, setSelectedKeys] = useControllableState(controlledSelectedKeys, immutableSet(defaultSelectedKeys), 'CgTreeList');
  const [checkedKeys, setCheckedKeys] = useControllableState(controlledCheckedKeys, immutableSet(defaultCheckedKeys), 'CgTreeList');
  const [focusedKey, setFocusedKey] = useControllableState<TKey | null>(controlledFocusedKey, defaultFocusedKey, 'CgTreeList');
  const [focusedColumnId, setFocusedColumnId] = useControllableState<string | null>(controlledFocusedColumnId, defaultFocusedColumnId, 'CgTreeList');
  const [sorts, setSorts] = useControllableState(controlledSorts, initialState.sorts, 'CgTreeList');
  const [filter, setFilter] = useControllableState(controlledFilter === undefined ? undefined : controlledFilter, initialState.filter, 'CgTreeList');
  const [filterMode, setFilterMode] = useControllableState<CgTreeListFilterMode>(controlledFilterMode, initialState.filterMode, 'CgTreeList');
  const [searchText, setSearchText] = useControllableState(controlledSearchText, defaultSearchText, 'CgTreeList');
  const [detailKeys, setDetailKeys] = useControllableState(controlledDetailKeys, immutableSet(defaultExpandedDetailKeys), 'CgTreeList');
  const [lazyPages, setLazyPages] = useState<ReadonlyMap<string, LazyPage<TItem>>>(() => new Map());
  const [providerRecords, setProviderRecords] = useState<ReadonlyArray<CgTreeListProviderNode<TItem, TKey>>>([]);
  const [providerTotal, setProviderTotal] = useState(0);
  const [providerLoading, setProviderLoading] = useState('dataProvider' in props);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [loadStatuses, setLoadStatuses] = useState<ReadonlyMap<string, LoadStatus>>(() => new Map());
  const [detailStatuses, setDetailStatuses] = useState<ReadonlyMap<string, DetailStatus>>(() => new Map());
  const [summaryStatuses, setSummaryStatuses] = useState<ReadonlyMap<string, SummaryStatus>>(() => new Map());
  const [editSession, setEditSession] = useState<EditSession<TItem, TKey> | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(480);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [renderGeneration, setRenderGeneration] = useState(0);
  const [optimisticUpdates, setOptimisticUpdates] = useState<ReadonlyMap<string, OptimisticUpdate<TItem>>>(() => new Map());
  const generationRef = useRef(1);
  const requestSequence = useRef(0);
  const loadControllers = useRef(new Map<string, AbortController>());
  const detailControllers = useRef(new Map<string, AbortController>());
  const summaryController = useRef<AbortController | null>(null);
  const mutationController = useRef<AbortController | null>(null);
  const providerRootController = useRef<AbortController | null>(null);
  const attempts = useRef(new Map<string, number>());
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const menuActionsRef = useRef<CgContextMenuActions<CgTreeListContext<TItem, TKey>>>(null);
  const selectionAnchor = useRef<string | null>(null);
  const batching = useRef(0);
  const pendingRefresh = useRef(false);
  const mounted = useRef(true);
  const viewStoreReady = useRef(false);
  const optimisticSequence = useRef(0);
  const editSequence = useRef(0);
  const activeOptimisticUpdate = useRef<{ readonly token: string; readonly operationId: number } | null>(null);

  const isProvider = 'dataProvider' in props;
  const dataProvider = isProvider ? props.dataProvider : undefined;
  const expandedTokens = useMemo(() => new Set([...expandedKeys].map(treeListKeyToken)), [expandedKeys]);
  const checkedTokens = useMemo(() => new Set([...checkedKeys].map(treeListKeyToken)), [checkedKeys]);
  const selectedTokens = useMemo(() => new Set([...selectedKeys].map(treeListKeyToken)), [selectedKeys]);

  const hierarchy = useMemo<TreeListHierarchy<TItem, TKey>>(() => {
    if (isProvider) {
      const result = buildProviderHierarchy({ records: providerRecords, maximumDepth });
      for (const [token, update] of optimisticUpdates) { const node = result.byToken.get(token); if (node) node.item = update.item; }
      return result;
    }
    if ('getChildren' in props && props.getChildren) {
      const result = buildNestedHierarchy({ data: props.data, getKey: props.getKey, getChildren: props.getChildren, hasChildren: props.hasChildren, maximumDepth });
      attachLoadedChildren(result, new Map([...lazyPages].map(([token, page]) => [token, page.items])), props.getKey, props.hasChildren, maximumDepth);
      for (const [token, update] of optimisticUpdates) { const node = result.byToken.get(token); if (node) node.item = update.item; }
      return result;
    }
    const flat = props as CgTreeListProps<TItem, TKey> & { data: ReadonlyArray<TItem>; getKey: (item: TItem) => TKey; getParentKey: (item: TItem) => CgTreeListParentKey<TKey> };
    const result = buildFlatHierarchy({ data: flat.data, getKey: flat.getKey, getParentKey: flat.getParentKey, isRoot: flat.isRoot, rootParentKeys: flat.rootParentKeys, orphanPolicy: flat.orphanPolicy, hasChildren: props.hasChildren, maximumDepth });
    attachLoadedChildren(result, new Map([...lazyPages].map(([token, page]) => [token, page.items])), flat.getKey, props.hasChildren, maximumDepth);
    for (const [token, update] of optimisticUpdates) { const node = result.byToken.get(token); if (node) node.item = update.item; }
    return result;
  }, [isProvider, providerRecords, props, lazyPages, maximumDepth, optimisticUpdates]);

  const normalizedColumns = useMemo(() => normalizeTreeListColumns(columns, viewState.columns, hierarchyFieldId), [columns, viewState.columns, hierarchyFieldId]);
  const visibleColumns = useMemo(() => normalizedColumns.filter((column) => column.visible), [normalizedColumns]);
  const effectiveSorts = useMemo(() => [...viewState.groups, ...sorts.filter((sort) => !viewState.groups.some((group) => group.fieldId === sort.fieldId))], [sorts, viewState.groups]);
  const fullProjection = useMemo(() => projectHierarchy({ hierarchy, columns, expandedTokens, sorts: effectiveSorts, searchText, filter, filterMode, locale: props.locale }), [hierarchy, columns, expandedTokens, effectiveSorts, searchText, filter, filterMode, props.locale]);
  const projectionRootTokens = useMemo(() => {
    const rootByToken = new Map<string, string>();
    for (const root of hierarchy.roots) {
      const stack = [root];
      while (stack.length) { const node = stack.pop()!; rootByToken.set(node.token, root.token); stack.push(...node.children); }
    }
    const ordered = new Set<string>();
    for (const entry of fullProjection.visible) { const rootToken = rootByToken.get(entry.internal.token); if (rootToken) ordered.add(rootToken); }
    return [...ordered];
  }, [fullProjection.visible, hierarchy.roots]);
  const localProjectedRootCount = projectionRootTokens.length;
  const projection = useMemo(() => {
    if (isProvider || !props.showPager) return fullProjection;
    const start = Math.max(0, viewState.rootPage.pageIndex) * viewState.rootPage.pageSize;
    const pageRoots = new Set(projectionRootTokens.slice(start, start + viewState.rootPage.pageSize));
    const rootByToken = new Map<string, string>();
    for (const root of hierarchy.roots) { const stack = [root]; while (stack.length) { const node = stack.pop()!; rootByToken.set(node.token, root.token); stack.push(...node.children); } }
    return { ...fullProjection, visible: Object.freeze(fullProjection.visible.filter((entry) => pageRoots.has(rootByToken.get(entry.internal.token) ?? ''))) };
  }, [fullProjection, hierarchy.roots, isProvider, projectionRootTokens, props.showPager, viewState.rootPage.pageIndex, viewState.rootPage.pageSize]);
  const groupKeyFor = useCallback((entry: TreeListProjectionNode<TItem, TKey>): string | null => {
    if (!viewState.groups.length) return null;
    const identity = viewState.groups.map((group) => `${encodeURIComponent(group.fieldId)}=${encodeURIComponent(String(columns.find((column) => column.fieldId === group.fieldId)?.getValue?.(entry.internal.item) ?? ''))}`).join('|');
    return `cg-tl-group:${encodeURIComponent(entry.internal.parent?.token ?? '__root__')}:${identity}`;
  }, [columns, viewState.groups]);
  const hiddenByCollapsedGroup = useMemo(() => {
    const hidden = new Set<string>();
    for (const entry of projection.visible) {
      const groupKey = groupKeyFor(entry);
      if (groupKey && viewState.collapsedGroupKeys.has(groupKey)) { hidden.add(entry.internal.token); for (const descendant of hierarchyDescendants(entry.internal)) hidden.add(descendant.token); }
    }
    return hidden;
  }, [groupKeyFor, projection.visible, viewState.collapsedGroupKeys]);
  const visible = useMemo(() => projection.visible.filter((entry) => !hiddenByCollapsedGroup.has(entry.internal.token)), [hiddenByCollapsedGroup, projection.visible]);
  const groupRepresentatives = useMemo(() => {
    const result = new Map<string, string>();
    for (const entry of projection.visible) { const key = groupKeyFor(entry); if (key && !result.has(key)) result.set(key, entry.internal.token); }
    return result;
  }, [groupKeyFor, projection.visible]);
  const rowsForRendering = useMemo(() => projection.visible.filter((entry) => !hiddenByCollapsedGroup.has(entry.internal.token) || groupRepresentatives.get(groupKeyFor(entry) ?? '') === entry.internal.token), [groupKeyFor, groupRepresentatives, hiddenByCollapsedGroup, projection.visible]);

  const providerRequest = useCallback((mode: CgTreeListProviderRequestMode, options: { parentKey?: CgTreeListParentKey<TKey>; targetKey?: TKey; skip?: number; take?: number; signal: AbortSignal }): CgTreeListProviderRequest<TKey> => Object.freeze({
    mode,
    requestId: `${rootId}-${++requestSequence.current}`,
    queryId,
    generation: generationRef.current,
    parentKey: options.parentKey ?? ({ kind: 'none' } as const),
    ...(options.targetKey === undefined ? {} : { targetKey: options.targetKey }),
    skip: Math.max(0, options.skip ?? 0),
    take: Math.min(maximumProviderTake, Math.max(1, options.take ?? rootPageSize)),
    fieldAliases: immutableArray(columns.map((column) => column.fieldId)),
    filter,
    filterMode,
    searchText,
    sorts: immutableArray(sorts),
    groups: immutableArray(viewState.groups),
    summaries: immutableArray((props.summaries ?? []).map((summary) => Object.freeze({ id: summary.id, type: summary.type, fieldId: summary.fieldId, aggregateKey: summary.aggregateKey, inputFieldIds: summary.inputFieldIds, visible: summary.visible !== false, scope: 'total' as const }))),
    signal: options.signal,
  }), [columns, filter, filterMode, maximumProviderTake, props.summaries, queryId, rootId, rootPageSize, searchText, sorts, viewState.groups]);

  const loadProviderRoots = useCallback(async (pageIndex: number): Promise<boolean> => {
    if (!dataProvider) return false;
    providerRootController.current?.abort();
    const controller = new AbortController(); providerRootController.current = controller;
    const generation = generationRef.current;
    setProviderLoading(true); setProviderError(null);
    try {
      const result = await dataProvider(providerRequest('roots', { skip: pageIndex * viewState.rootPage.pageSize, take: viewState.rootPage.pageSize, signal: controller.signal }));
      if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) return false;
      if (result.safeErrorCode) { setProviderError(result.safeMessage ?? result.safeErrorCode); return false; }
      setProviderRecords(immutableArray(result.nodes)); setProviderTotal(Math.max(0, result.totalCount));
      const nextState = createTreeListState(columns, { ...viewState, rootPage: { pageIndex, pageSize: viewState.rootPage.pageSize, totalCount: result.totalCount } });
      setViewState(nextState); props.onStateChange?.(nextState, Object.freeze({ operation: 'root-page', reason: 'provider' }));
      return true;
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) setProviderError(error instanceof Error ? error.message : 'Provider request failed.');
      return false;
    } finally { if (!controller.signal.aborted && mounted.current) setProviderLoading(false); }
  }, [columns, dataProvider, props, providerRequest, setViewState, viewState]);

  useEffect(() => {
    if (!isProvider) return;
    generationRef.current++;
    mutationController.current?.abort();
    for (const controller of loadControllers.current.values()) controller.abort();
    for (const controller of detailControllers.current.values()) controller.abort();
    loadControllers.current.clear(); detailControllers.current.clear();
    setLazyPages(new Map()); setOptimisticUpdates(new Map()); activeOptimisticUpdate.current = null;
    setProviderRecords([]);
    void loadProviderRoots(viewState.rootPage.pageIndex);
    return () => providerRootController.current?.abort();
  }, [isProvider, props.dataProvider, queryId, filter, filterMode, searchText, sorts]); // query replacement owns a new generation

  const localDataIdentity = 'data' in props ? props.data : null;
  const localDataIdentityRef = useRef(localDataIdentity);
  useEffect(() => {
    if (isProvider || Object.is(localDataIdentityRef.current, localDataIdentity)) return;
    localDataIdentityRef.current = localDataIdentity;
    generationRef.current++;
    mutationController.current?.abort();
    for (const controller of loadControllers.current.values()) controller.abort();
    for (const controller of detailControllers.current.values()) controller.abort();
    loadControllers.current.clear(); detailControllers.current.clear();
    setLazyPages(new Map()); setOptimisticUpdates(new Map()); activeOptimisticUpdate.current = null;
  }, [isProvider, localDataIdentity]);

  useEffect(() => {
    viewStoreReady.current = false;
    if (!props.viewStore || !props.viewContext) return;
    const controller = new AbortController();
    void Promise.resolve(props.viewStore.load(props.viewContext, controller.signal)).then((stored) => {
      if (controller.signal.aborted) return;
      if (stored) {
        const next = normalizeTreeListState(columns, stored, hierarchyFieldId);
        setViewState(next); setSorts(next.sorts); setFilter(next.filter); setFilterMode(next.filterMode); props.onStateChange?.(next, Object.freeze({ operation: 'restore-view', reason: 'state-restoration' }));
      }
      viewStoreReady.current = true;
    }).catch(() => { if (!controller.signal.aborted) viewStoreReady.current = true; });
    return () => controller.abort();
  }, [props.viewStore, props.viewContext, columns, hierarchyFieldId, setFilter, setFilterMode, setSorts, setViewState]);

  useEffect(() => {
    if (!props.viewStore || !props.viewContext || !viewStoreReady.current) return;
    const controller = new AbortController();
    void Promise.resolve(props.viewStore.save(props.viewContext, viewState, controller.signal)).catch(() => undefined);
    return () => controller.abort();
  }, [props.viewContext, props.viewStore, viewState]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; generationRef.current++;
      providerRootController.current?.abort(); mutationController.current?.abort();
      summaryController.current?.abort();
      for (const controller of loadControllers.current.values()) controller.abort();
      for (const controller of detailControllers.current.values()) controller.abort();
    };
  }, []);

  useEffect(() => {
    const requests = (props.summaries ?? []).flatMap((summary) => {
      if (summary.scope !== 'complete-subtree' || summary.nodeKey === undefined) return [];
      const key = summary.nodeKey as TKey;
      return hierarchy.byToken.has(treeListKeyToken(key)) ? [{ nodeKey: key, summaryId: summary.id, scope: 'complete-subtree' as const }] : [];
    });
    summaryController.current?.abort();
    if (!props.summaryProvider || !requests.length) { setSummaryStatuses(new Map()); return; }
    const controller = new AbortController(); summaryController.current = controller;
    const generation = generationRef.current;
    void Promise.resolve(props.summaryProvider(Object.freeze({ queryId, generation, items: immutableArray(requests), signal: controller.signal }))).then((result) => {
      if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) return;
      const next = new Map<string, SummaryStatus>();
      for (const value of result.values) next.set(`${treeListKeyToken(value.nodeKey)}|${value.summaryId}`, { value: value.value, completeness: value.completeness, ...(value.safeErrorCode ? { errorCode: value.safeErrorCode } : {}) });
      setSummaryStatuses(next);
    }).catch((error) => {
      if (controller.signal.aborted || !mounted.current) return;
      const errorCode = error instanceof Error ? error.message : 'SUMMARY_FAILED';
      setSummaryStatuses(new Map(requests.map((request) => [`${treeListKeyToken(request.nodeKey)}|${request.summaryId}`, { completeness: 'unknown', errorCode }])));
    });
    return () => controller.abort();
  }, [hierarchy.byToken, props.summaries, props.summaryProvider, queryId]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => { setViewportHeight(scroller.clientHeight || 480); setViewportWidth(scroller.clientWidth || 1024); };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update); observer.observe(scroller); return () => observer.disconnect();
  }, []);

  const keyForItem = useCallback((item: TItem): TKey | null => {
    if (isProvider) {
      const record = providerRecords.find((candidate) => candidate.item === item);
      return record?.key ?? null;
    }
    return props.getKey(item);
  }, [isProvider, props, providerRecords]);

  const checkState = useCallback((node: TreeListHierarchyNode<TItem, TKey>): CgTreeListCheckState => {
    const own = checkedTokens.has(node.token);
    if (checkMode === 'independent') return own ? 'checked' : 'unchecked';
    if (checkMode === 'disabled') return 'unchecked';
    let checked = own ? 1 : 0; let unchecked = own ? 0 : 1; let incomplete = node.hasUnloadedChildren || !node.projectionComplete;
    const stack = [...node.children];
    while (stack.length) {
      const child = stack.pop()!;
      if (props.canCheck?.(child.item) === false) continue;
      if (checkedTokens.has(child.token)) checked++; else unchecked++;
      incomplete ||= child.hasUnloadedChildren || !child.projectionComplete;
      stack.push(...child.children);
    }
    if (incomplete && checked > 0) return 'mixed';
    if (checked > 0 && unchecked === 0) return 'checked';
    if (checked > 0) return 'mixed';
    return 'unchecked';
  }, [checkMode, checkedTokens, props]);

  const loadNode = useCallback(async (key: TKey, more = false, force = false): Promise<boolean> => {
    const token = tokenOrNull(key); if (!token) return false;
    const node = hierarchy.byToken.get(token); if (!node) return false;
    if (loadControllers.current.has(token)) return false;
    const localPage = lazyPages.get(token);
    if (!force && !more && node.childrenLoaded && !localPage?.hasMore) return true;
    const controller = new AbortController(); loadControllers.current.set(token, controller);
    const attempt = (attempts.current.get(`load:${token}`) ?? 0) + 1; attempts.current.set(`load:${token}`, attempt);
    const generation = generationRef.current;
    setLoadStatuses((current) => new Map(current).set(token, { state: 'loading' }));
    try {
      if (dataProvider) {
        const skip = more ? node.children.length : 0;
        const result = await dataProvider(providerRequest('children', { parentKey: { kind: 'key', key }, skip, take: childPageSize, signal: controller.signal }));
        if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) return false;
        if (result.safeErrorCode) throw new Error(result.safeMessage ?? result.safeErrorCode);
        const pageKnown = new Set((more ? node.children : []).map((child) => child.token));
        const pageRecords = result.nodes.filter((record) => { const recordToken = treeListKeyToken(record.key); if (pageKnown.has(recordToken)) return false; pageKnown.add(recordToken); return true; });
        setProviderRecords((current) => {
          const known = new Set(current.map((record) => treeListKeyToken(record.key)));
          const addedRecords = result.nodes.filter((record) => { const recordToken = treeListKeyToken(record.key); if (known.has(recordToken)) return false; known.add(recordToken); return true; });
          const updated = current.map((record) => Object.is(record.key, key) ? { ...record, hasChildren: (more ? node.children.length : 0) + result.nodes.length > 0 || result.hasMore === true, projectionComplete: result.projectionComplete ?? result.hasMore !== true } : record);
          return immutableArray([...updated, ...addedRecords]);
        });
        const previousItems = more ? localPage?.items ?? [] : [];
        setLazyPages((current) => new Map(current).set(token, { items: immutableArray([...previousItems, ...pageRecords.map((record) => record.item)]), hasMore: result.hasMore ?? false, nextSkip: skip + result.nodes.length, ...(result.totalCount === undefined ? {} : { totalCount: result.totalCount }) }));
        if (checkedTokens.has(token) && checkMode === 'recursive') {
          const inherited = new Set(checkedKeys);
          for (const record of pageRecords) if (props.canCheck?.(record.item) !== false) inherited.add(record.key);
          const checkedSnapshot = immutableSet(inherited); setCheckedKeys(checkedSnapshot);
          props.onCheckedKeysChange?.(checkedSnapshot, Object.freeze({ checkedKeys: checkedSnapshot, changedKey: key, checked: true, changedItems: immutableArray(pageRecords.map((record) => record.item)), reason: 'provider' }));
        }
      } else if (props.loadChildren) {
        const skip = more ? localPage?.nextSkip ?? node.children.length : 0;
        const result = await props.loadChildren(Object.freeze({ parentItem: node.item, parentKey: key, parentLevel: node.level, sorts: immutableArray(sorts), filter, searchText, attempt, generation, skip, take: childPageSize, signal: controller.signal }));
        if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) return false;
        const existing = more ? localPage?.items ?? [] : [];
        const known = new Set(existing.map((item) => { const itemKey = keyForItem(item); return itemKey === null ? '' : treeListKeyToken(itemKey); }));
        const added = result.children.filter((item) => { const itemKey = keyForItem(item); if (itemKey === null) return false; const itemToken = treeListKeyToken(itemKey); if (known.has(itemToken)) return false; known.add(itemToken); return true; });
        const page: LazyPage<TItem> = { items: immutableArray([...existing, ...added]), hasMore: result.hasMore ?? false, nextSkip: skip + result.children.length, ...(result.totalCount === undefined ? {} : { totalCount: result.totalCount }) };
        setLazyPages((current) => new Map(current).set(token, page));
        if (checkedTokens.has(token) && checkMode === 'recursive') {
          const inherited = new Set(checkedKeys);
          for (const item of added) { const itemKey = keyForItem(item); if (itemKey !== null && props.canCheck?.(item) !== false) inherited.add(itemKey); }
          const snapshot = immutableSet(inherited); setCheckedKeys(snapshot);
          props.onCheckedKeysChange?.(snapshot, Object.freeze({ checkedKeys: snapshot, changedKey: key, checked: true, changedItems: immutableArray(added), reason: 'provider' }));
        }
      } else return false;
      setLoadStatuses((current) => { const next = new Map(current); next.delete(token); return next; });
      return true;
    } catch (error) {
      if (!controller.signal.aborted && mounted.current) setLoadStatuses((current) => new Map(current).set(token, { state: 'error', errorCode: error instanceof Error ? error.message : 'LOAD_FAILED' }));
      return false;
    } finally { loadControllers.current.delete(token); }
  }, [checkMode, checkedKeys, checkedTokens, childPageSize, dataProvider, filter, hierarchy, keyForItem, lazyPages, props, providerRequest, searchText, setCheckedKeys, sorts]);

  const performExpansion = useCallback(async (key: TKey, expand: boolean, reason: CgTreeListExpansionEventDetail<TItem, TKey>['reason'], event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>): Promise<boolean> => {
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node) return false;
    const currentlyExpanded = expandedTokens.has(token); if (currentlyExpanded === expand) return true;
    const next = new Set(expandedKeys); if (expand) next.add(key); else next.delete(key);
    const controller = new AbortController();
    const base = { item: node.item, key, level: node.level, expanded: expand, reason, childrenLoaded: node.childrenLoaded, expandedKeys: immutableSet(next), event };
    const before = expand ? props.beforeExpand : props.beforeCollapse;
    try { if (await before?.(Object.freeze({ ...base, signal: controller.signal })) === false) return false; } catch { return false; }
    if (!expand) { loadControllers.current.get(token)?.abort(); loadControllers.current.delete(token); }
    const snapshot = immutableSet(next); setExpandedKeys(snapshot);
    props.onExpandedKeysChange?.(snapshot, Object.freeze(base));
    if (expand && (node.hasUnloadedChildren || lazyPages.get(token)?.hasMore) && !node.childrenLoaded) await loadNode(key);
    (expand ? props.onExpanded : props.onCollapsed)?.(Object.freeze(base));
    return true;
  }, [expandedKeys, expandedTokens, hierarchy, lazyPages, loadNode, props, setExpandedKeys]);

  const selectNode = useCallback(async (key: TKey, options: { add?: boolean; range?: boolean } = {}): Promise<boolean> => {
    if (selectionMode === 'none' || props.disabled) return false;
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node || props.canSelect?.(node.item) === false) return false;
    const next = new Set<TKey>(options.add ? selectedKeys : []);
    if (options.range && selectionAnchor.current) {
      const from = visible.findIndex((entry) => entry.internal.token === selectionAnchor.current); const to = visible.findIndex((entry) => entry.internal.token === token);
      if (from >= 0 && to >= 0) for (let index = Math.min(from, to); index <= Math.max(from, to); index++) if (props.canSelect?.(visible[index]!.internal.item) !== false) next.add(visible[index]!.internal.key);
    } else if (selectionMode === 'multiple' && options.add && selectedTokens.has(token)) next.delete(key); else next.add(key);
    if (selectionMode === 'single') { next.clear(); next.add(key); }
    selectionAnchor.current = token;
    const snapshot = immutableSet(next); setSelectedKeys(snapshot);
    props.onSelectedKeysChange?.(snapshot, Object.freeze({ selectedKeys: snapshot, selectedItems: immutableArray([...next].map((selected) => hierarchy.byToken.get(treeListKeyToken(selected))?.item).filter((item): item is TItem => item !== undefined)), changedKey: key, reason: 'api' }));
    return true;
  }, [hierarchy, props, selectedKeys, selectedTokens, selectionMode, setSelectedKeys, visible]);

  const setFocus = useCallback((key: TKey | null, fieldId: string | null, reason: 'pointer' | 'keyboard' | 'api' | 'state-restoration' | 'provider', focusDom: boolean): boolean => {
    if (key !== null && !hierarchy.byToken.has(treeListKeyToken(key))) return false;
    const actualColumn = fieldId && visibleColumns.some((column) => column.fieldId === fieldId) ? fieldId : visibleColumns[0]?.fieldId ?? null;
    setFocusedKey(key); setFocusedColumnId(actualColumn); props.onFocusChange?.(Object.freeze({ focusedKey: key, focusedColumnId: actualColumn, reason }));
    if (focusDom && key !== null && actualColumn) queueMicrotask(() => cellRefs.current.get(`${treeListKeyToken(key)}|${actualColumn}`)?.focus());
    return true;
  }, [hierarchy.byToken, props, setFocusedColumnId, setFocusedKey, visibleColumns]);

  const changeCheck = useCallback(async (key: TKey, checked?: boolean): Promise<boolean> => {
    if (checkMode === 'disabled' || props.disabled || props.readOnly) return false;
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node || props.canCheck?.(node.item) === false) return false;
    const target = checked ?? checkState(node) !== 'checked'; const next = new Set(checkedKeys); const changed: TItem[] = [];
    const candidates = checkMode === 'recursive' ? [node, ...hierarchyDescendants(node)] : [node];
    for (const candidate of candidates) if (props.canCheck?.(candidate.item) !== false) { if (target) next.add(candidate.key); else next.delete(candidate.key); changed.push(candidate.item); }
    const snapshot = immutableSet(next); setCheckedKeys(snapshot); props.onCheckedKeysChange?.(snapshot, Object.freeze({ checkedKeys: snapshot, changedKey: key, checked: target, changedItems: immutableArray(changed), reason: 'api' })); return true;
  }, [checkMode, checkState, checkedKeys, hierarchy, props, setCheckedKeys]);

  const loadDetail = useCallback(async (key: TKey): Promise<boolean> => {
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined;
    if (!token || !node || !props.detailLoader) return false;
    const controller = new AbortController(); detailControllers.current.get(token)?.abort(); detailControllers.current.set(token, controller);
    const generation = generationRef.current; const attempt = (detailStatuses.get(token)?.attempt ?? 0) + 1;
    setDetailStatuses((current) => new Map(current).set(token, { loading: true, attempt }));
    try {
      const result = await props.detailLoader(Object.freeze({ item: node.item, key, attempt, generation, signal: controller.signal }));
      if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) return false;
      setDetailStatuses((current) => new Map(current).set(token, { loading: false, detail: result.detail, errorCode: result.safeErrorCode, attempt })); return !result.safeErrorCode;
    } catch (error) {
      if (!controller.signal.aborted && generation === generationRef.current && mounted.current) setDetailStatuses((current) => new Map(current).set(token, { loading: false, errorCode: error instanceof Error ? error.message : 'DETAIL_FAILED', attempt }));
      return false;
    } finally { if (detailControllers.current.get(token) === controller) detailControllers.current.delete(token); }
  }, [detailStatuses, hierarchy.byToken, props.detailLoader]);

  const toggleDetail = useCallback(async (key: TKey): Promise<boolean> => {
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node || !props.renderDetail || props.canShowDetail?.(node.item) === false) return false;
    const next = new Set(props.detailMode === 'single' ? [] : detailKeys);
    if (detailKeys.has(key)) { next.delete(key); detailControllers.current.get(token)?.abort(); }
    else {
      next.add(key);
      if (props.detailLoader && !detailStatuses.get(token)?.detail) void loadDetail(key);
    }
    const snapshot = immutableSet(next); setDetailKeys(snapshot); props.onExpandedDetailKeysChange?.(snapshot); return true;
  }, [detailKeys, detailStatuses, hierarchy, loadDetail, props, setDetailKeys]);

  const rollbackOptimisticUpdate = useCallback((operation = activeOptimisticUpdate.current) => {
    if (!operation) return;
    setOptimisticUpdates((current) => {
      if (current.get(operation.token)?.operationId !== operation.operationId) return current;
      const next = new Map(current); next.delete(operation.token); return next;
    });
    if (activeOptimisticUpdate.current?.operationId === operation.operationId) activeOptimisticUpdate.current = null;
  }, []);

  const beginEdit = useCallback((key: TKey): boolean => {
    const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node || !props.allowEdit || props.canEdit?.(node.item) === false) return false;
    if (props.disabled || props.readOnly) return false;
    mutationController.current?.abort(); rollbackOptimisticUpdate();
    setEditSession({ sessionId: ++editSequence.current, kind: 'update', key, parentKey: node.parent ? { kind: 'key', key: node.parent.key } : { kind: 'none' }, original: node.item, draft: props.editModelFactory?.(node.item) ?? node.item, attempt: 1, saving: false }); return true;
  }, [hierarchy, props, rollbackOptimisticUpdate]);

  const beginCreate = useCallback((parentKey: CgTreeListParentKey<TKey>, supplied?: TItem): boolean => {
    if (props.disabled || props.readOnly) return false;
    if ((parentKey.kind === 'none' && !props.allowAddRoot) || (parentKey.kind === 'key' && !props.allowAddChild)) return false;
    if (parentKey.kind === 'key') { const parent = hierarchy.byToken.get(treeListKeyToken(parentKey.key)); if (!parent || props.canAddChild?.(parent.item) === false) return false; }
    const draft = supplied ?? props.newItemFactory?.(parentKey); if (draft === undefined) return false;
    mutationController.current?.abort(); rollbackOptimisticUpdate();
    setEditSession({ sessionId: ++editSequence.current, kind: 'create', key: null, parentKey, draft, attempt: 1, saving: false }); return true;
  }, [hierarchy.byToken, props, rollbackOptimisticUpdate]);

  const saveEdit = useCallback(async (): Promise<boolean> => {
    if (!editSession || editSession.saving) return false;
    if (editSession.kind === 'create' ? !props.onCreate : !props.onUpdate || editSession.key === null || !editSession.original) return false;
    mutationController.current?.abort(); const controller = new AbortController(); mutationController.current = controller;
    const session = editSession; const generation = generationRef.current;
    let optimisticOperation: { readonly token: string; readonly operationId: number } | null = null;
    if (props.optimistic && session.kind === 'update' && session.key !== null) {
      optimisticOperation = { token: treeListKeyToken(session.key), operationId: ++optimisticSequence.current };
      activeOptimisticUpdate.current = optimisticOperation;
      setOptimisticUpdates((current) => new Map(current).set(optimisticOperation!.token, { operationId: optimisticOperation!.operationId, item: session.draft }));
    }
    setEditSession((current) => current?.sessionId === session.sessionId ? { ...session, saving: true } : current);
    try {
      let result: CgTreeListMutationResult<TItem>;
      if (session.kind === 'create') {
        result = await props.onCreate!(Object.freeze({ draft: session.draft, parentKey: session.parentKey, siblingPosition: session.parentKey.kind === 'none' ? hierarchy.roots.length : hierarchy.byToken.get(treeListKeyToken(session.parentKey.key))?.children.length ?? 0, attempt: session.attempt, generation, clientValidationConclusive: true, signal: controller.signal }));
      } else {
        result = await props.onUpdate!(Object.freeze({ item: session.original!, key: session.key!, draft: session.draft, changedFieldIds: immutableArray(columns.filter((column) => column.getValue && !Object.is(column.getValue(session.original!), column.getValue(session.draft))).map((column) => column.fieldId)), attempt: session.attempt, generation, concurrencyToken: props.getConcurrencyToken?.(session.original!), signal: controller.signal }));
      }
      if (controller.signal.aborted || generation !== generationRef.current || !mounted.current) { rollbackOptimisticUpdate(optimisticOperation); return false; }
      if (result.outcome === 'success') {
        if (optimisticOperation && result.item) setOptimisticUpdates((current) => current.get(optimisticOperation!.token)?.operationId === optimisticOperation!.operationId ? new Map(current).set(optimisticOperation!.token, { operationId: optimisticOperation!.operationId, item: result.item! }) : current);
        activeOptimisticUpdate.current = null;
        setEditSession((current) => current?.sessionId === session.sessionId ? null : current); return true;
      }
      rollbackOptimisticUpdate(optimisticOperation);
      setEditSession((current) => current?.sessionId === session.sessionId ? { ...session, saving: false, result } : current); return false;
    } catch (error) {
      rollbackOptimisticUpdate(optimisticOperation);
      if (!controller.signal.aborted) setEditSession((current) => current?.sessionId === session.sessionId ? { ...session, saving: false, result: { outcome: 'failure', generalErrors: [error instanceof Error ? error.message : 'Save failed.'] } } : current); return false;
    }
  }, [columns, editSession, hierarchy, props, rollbackOptimisticUpdate]);

  const snapshot = useCallback((scope: 'visible-rows' | 'loaded-nodes' | 'complete-tree' = 'visible-rows'): CgTreeListSnapshot<TItem, TKey> => {
    const source = scope === 'visible-rows' ? visible.map((entry) => entry.internal) : hierarchy.nodes;
    const rows = source.map((node): CgTreeListSnapshotRow<TItem, TKey> => Object.freeze({ item: node.item, key: node.key, parentKey: node.parent ? { kind: 'key', key: node.parent.key } : { kind: 'none' }, level: node.level }));
    const complete = hierarchy.nodes.every((node) => !node.hasUnloadedChildren && node.projectionComplete);
    return Object.freeze({ rows: immutableArray(rows), complete, totalSummaries: Object.freeze({}) });
  }, [hierarchy.nodes, visible]);

  const exportXlsx = useCallback(async (options: CgTreeListExportOptions = {}): Promise<CgTreeListExportResult> => {
    if (options.signal?.aborted) throw new Error('CgTreeList XLSX export was aborted.');
    let current = snapshot(options.scope);
    if (options.scope === 'complete-tree' && !current.complete) {
      if (!props.snapshotProvider) throw new Error('CgTreeList complete-tree export requires an authorized snapshotProvider when the loaded projection is incomplete.');
      const controller = new AbortController(); options.signal?.addEventListener('abort', () => controller.abort(), { once: true }); current = await props.snapshotProvider(Object.freeze({ scope: 'complete-tree', columnIds: immutableArray(options.columnIds ?? []), includeSummaries: options.includeSummaries ?? true, includeDetails: false, signal: controller.signal }));
      if (controller.signal.aborted) throw new Error('CgTreeList XLSX export was aborted.');
      if (!current.complete) throw new Error('CgTreeList snapshotProvider returned an incomplete complete-tree export.');
    }
    const maximum = options.maximumRows ?? 250_000; if (current.rows.length > maximum) throw new Error(`CgTreeList export exceeds the maximum row count of ${maximum}.`);
    const exportable = columns.filter((column) => normalizedColumns.find((entry) => entry.fieldId === column.fieldId)?.visible || column.exportEnabled === true);
    const selected = options.columnIds?.length ? exportable.filter((column) => options.columnIds!.includes(column.fieldId)) : exportable;
    const result = createTreeListXlsx({ rows: current.rows, columns: selected, hierarchyFieldId, fileName: options.fileName, rightToLeft: options.rightToLeft ?? directionValue === 'rtl', locale: props.locale, signal: options.signal });
    if (options.download) downloadTreeListExport(result); return result;
  }, [columns, directionValue, hierarchyFieldId, normalizedColumns, props, snapshot]);

  const printTree = useCallback(async (options: CgTreeListPrintOptions = {}): Promise<CgTreeListPrintResult> => {
    if (options.signal?.aborted) throw new Error('CgTreeList print preparation was aborted.');
    let current = snapshot(options.scope); if (options.scope === 'complete-tree' && !current.complete) { if (!props.snapshotProvider) throw new Error('CgTreeList complete-tree print requires an authorized snapshotProvider.'); const controller = new AbortController(); options.signal?.addEventListener('abort', () => controller.abort(), { once: true }); current = await props.snapshotProvider(Object.freeze({ scope: 'complete-tree', columnIds: immutableArray(options.columnIds ?? []), includeSummaries: options.includeSummaries ?? true, includeDetails: false, signal: controller.signal })); if (controller.signal.aborted) throw new Error('CgTreeList print preparation was aborted.'); }
    const printColumns = columns.filter((column) => column.printEnabled !== false && column.getValue && (!options.columnIds?.length || options.columnIds.includes(column.fieldId)));
    const title = options.title ?? 'Tree list';
    const html = `<section dir="${directionValue}"><h1>${escapeHtml(title)}</h1><table><thead><tr>${printColumns.map((column) => `<th>${escapeHtml(column.title ?? column.fieldId)}</th>`).join('')}</tr></thead><tbody>${current.rows.map((row) => `<tr>${printColumns.map((column) => `<td>${column.fieldId === hierarchyFieldId ? '&nbsp;'.repeat(Math.min(64, (row.level - 1) * 2)) : ''}${escapeHtml(formatTreeListValue(column, row.item, props.locale))}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
    if (options.openPrintDialog && typeof window !== 'undefined' && typeof window.print === 'function') window.print();
    return Object.freeze({ title, html, rowCount: current.rows.length });
  }, [columns, directionValue, hierarchyFieldId, props, snapshot]);

  const runtimeRef = useRef<Record<string, (...args: unknown[]) => unknown>>({});
  runtimeRef.current = {
    focus: async () => { const first = visible[0]; return first ? setFocus(first.internal.key, visibleColumns[0]?.fieldId ?? null, 'api', true) : false; },
    focusNode: async (key: TKey, fieldId?: string) => setFocus(key, fieldId ?? hierarchyFieldId, 'api', true),
    scrollToNode: async (key: TKey) => { const token = tokenOrNull(key); const row = token ? rowRefs.current.get(token) : undefined; if (!row) return false; row.scrollIntoView({ block: 'nearest' }); return true; },
    ensureNodeVisible: async (key: TKey, options?: { focus?: boolean; signal?: AbortSignal }) => {
      const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined;
      if (!node && dataProvider) { const controller = new AbortController(); options?.signal?.addEventListener('abort', () => controller.abort(), { once: true }); const result = await dataProvider(providerRequest('resolve-path', { targetKey: key, signal: controller.signal })); if (controller.signal.aborted) return false; setProviderRecords((current) => immutableArray([...current, ...(result.resolvedPath ?? result.nodes)])); const keys = result.resolvedPath ?? result.nodes; const next = new Set(expandedKeys); for (const record of keys.slice(0, -1)) next.add(record.key); setExpandedKeys(immutableSet(next)); if (options?.focus) queueMicrotask(() => { void (runtimeRef.current.focusNode?.(key, hierarchyFieldId) as Promise<boolean>); }); return keys.some((record) => Object.is(record.key, key)); }
      if (!node || !token) return false; const next = new Set(expandedKeys); for (const ancestor of hierarchyAncestors(node)) next.add(ancestor.key); const frozen = immutableSet(next); setExpandedKeys(frozen); if (next.size !== expandedKeys.size) props.onExpandedKeysChange?.(frozen, Object.freeze({ item: node.item, key, level: node.level, expanded: true, reason: 'expandToNode', childrenLoaded: node.childrenLoaded, expandedKeys: frozen })); queueMicrotask(() => { const row = rowRefs.current.get(token!); row?.scrollIntoView({ block: 'nearest' }); if (options?.focus) setFocus(key, hierarchyFieldId, 'api', true); }); return true;
    },
    expandNode: async (key: TKey) => performExpansion(key, true, 'api'), collapseNode: async (key: TKey) => performExpansion(key, false, 'api'), toggleNode: async (key: TKey) => { const token = tokenOrNull(key); return token ? performExpansion(key, !expandedTokens.has(token), 'api') : false; },
    expandToNode: async (key: TKey) => runtimeRef.current.ensureNodeVisible?.(key, {}) as Promise<boolean>,
    expandAll: async (options?: { loadChildren?: boolean; signal?: AbortSignal }) => { const next = new Set(expandedKeys); const queue = [...hierarchy.roots]; while (queue.length) { if (options?.signal?.aborted) return false; const node = queue.shift()!; if (node.children.length || node.hasUnloadedChildren) next.add(node.key); if (options?.loadChildren && node.hasUnloadedChildren) await loadNode(node.key); queue.push(...node.children); } const frozen = immutableSet(next); setExpandedKeys(frozen); return true; },
    collapseAll: async () => { const frozen = immutableSet<TKey>([]); setExpandedKeys(frozen); return true; }, isExpanded: (key: TKey) => { const token = tokenOrNull(key); return !!token && expandedTokens.has(token); },
    selectNode, clearSelection: async () => { const frozen = immutableSet<TKey>([]); setSelectedKeys(frozen); props.onSelectedKeysChange?.(frozen, Object.freeze({ selectedKeys: frozen, selectedItems: immutableArray([]), changedKey: null, reason: 'api' })); return true; },
    checkNode: changeCheck, clearChecks: async () => { const frozen = immutableSet<TKey>([]); setCheckedKeys(frozen); props.onCheckedKeysChange?.(frozen, Object.freeze({ checkedKeys: frozen, changedKey: null, checked: false, changedItems: immutableArray([]), reason: 'api' })); return true; },
    reloadNode: async (key: TKey) => { const token = tokenOrNull(key); if (!token || !hierarchy.byToken.has(token)) return false; loadControllers.current.get(token)?.abort(); setLazyPages((current) => { const next = new Map(current); next.delete(token); return next; }); if (isProvider) setProviderRecords((current) => { const descendants = new Set(hierarchyDescendants(hierarchy.byToken.get(token)!).map((node) => node.token)); return immutableArray(current.filter((record) => !descendants.has(treeListKeyToken(record.key)))); }); return loadNode(key, false, true); },
    removeLoadedChildren: async (key: TKey) => { const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!token || !node) return false; loadControllers.current.get(token)?.abort(); setLazyPages((current) => { const next = new Map(current); next.delete(token); return next; }); if (isProvider) { const descendants = new Set(hierarchyDescendants(node).map((child) => child.token)); setProviderRecords((current) => immutableArray(current.filter((record) => !descendants.has(treeListKeyToken(record.key))))); } return true; },
    loadMoreChildren: async (key: TKey) => loadNode(key, true), goToRootPage: async (pageIndex: number) => {
      const normalizedPage = Math.max(0, pageIndex);
      if (isProvider) return loadProviderRoots(normalizedPage);
      const pageCount = Math.max(1, Math.ceil(localProjectedRootCount / viewState.rootPage.pageSize));
      if (normalizedPage >= pageCount) return false;
      const next = createTreeListState(columns, { ...viewState, rootPage: { pageIndex: normalizedPage, pageSize: viewState.rootPage.pageSize, totalCount: localProjectedRootCount } });
      setViewState(next); props.onStateChange?.(next, Object.freeze({ operation: 'root-page', reason: 'api' }));
      if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
      return true;
    },
    addRoot: async (draft?: TItem) => beginCreate({ kind: 'none' }, draft), addChild: async (parentKey: TKey, draft?: TItem) => beginCreate({ kind: 'key', key: parentKey }, draft), editNode: async (key: TKey) => beginEdit(key),
    deleteNode: async (key: TKey) => { const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!node || props.disabled || props.readOnly || !props.allowDelete || !props.onDelete || props.canDelete?.(node.item) === false) return false; mutationController.current?.abort(); const controller = new AbortController(); mutationController.current = controller; const generation = generationRef.current; const result = await props.onDelete(Object.freeze({ item: node.item, key, parentKey: node.parent ? { kind: 'key', key: node.parent.key } : { kind: 'none' }, attempt: 1, generation, concurrencyToken: props.getConcurrencyToken?.(node.item), signal: controller.signal })); return !controller.signal.aborted && generation === generationRef.current && result.outcome === 'success'; },
    moveNode: async (key: TKey, parentKey: CgTreeListParentKey<TKey>, siblingPosition = 0) => { const token = tokenOrNull(key); const node = token ? hierarchy.byToken.get(token) : undefined; if (!node || props.disabled || props.readOnly || !props.allowMove || !props.onMove || props.canMove?.(node.item) === false) return false; if (parentKey.kind === 'key') { const parentToken = treeListKeyToken(parentKey.key); if (parentToken === token || hierarchyDescendants(node).some((child) => child.token === parentToken)) return false; } mutationController.current?.abort(); const controller = new AbortController(); mutationController.current = controller; const generation = generationRef.current; const result = await props.onMove(Object.freeze({ item: node.item, key, oldParentKey: node.parent ? { kind: 'key', key: node.parent.key } : { kind: 'none' }, proposedParentKey: parentKey, proposedSiblingPosition: Math.max(0, siblingPosition), clientValidationConclusive: hierarchy.nodes.every((entry) => !entry.hasUnloadedChildren && entry.projectionComplete), attempt: 1, generation, concurrencyToken: props.getConcurrencyToken?.(node.item), signal: controller.signal })); return !controller.signal.aborted && generation === generationRef.current && result.outcome === 'success'; },
    saveEdit, cancelEdit: async () => { mutationController.current?.abort(); rollbackOptimisticUpdate(); setEditSession(null); return true; }, retryConflict: async () => { if (!editSession || editSession.result?.outcome !== 'conflict') return false; setEditSession({ ...editSession, attempt: editSession.attempt + 1, result: undefined }); await new Promise((resolve) => setTimeout(resolve, 0)); return runtimeRef.current.saveEdit?.() as Promise<boolean>; }, reloadConflict: async () => { if (!editSession) return false; mutationController.current?.abort(); rollbackOptimisticUpdate(); setEditSession(null); return true; },
    applyFilter: async (nextFilter: typeof filter, mode?: CgTreeListFilterMode) => { const nextMode = mode ?? filterMode; setFilter(nextFilter); props.onFilterChange?.(nextFilter); if (mode) { setFilterMode(mode); props.onFilterModeChange?.(mode); } const nextState = createTreeListState(columns, { ...viewState, filter: nextFilter, filterMode: nextMode }); setViewState(nextState); props.onStateChange?.(nextState, Object.freeze({ operation: 'filter', reason: 'api' })); return true; },
    groupBy: async (fieldId: string) => { if (!columns.some((column) => column.fieldId === fieldId)) return false; const next = createTreeListState(columns, { ...viewState, groups: [...viewState.groups.filter((group) => group.fieldId !== fieldId), { fieldId, direction: 'ascending' }] }); setViewState(next); props.onStateChange?.(next, Object.freeze({ operation: 'group', reason: 'api' })); return true; },
    setColumnVisibility: async (fieldId: string, value: boolean) => { if (fieldId === hierarchyFieldId && !value) return false; const target = columns.find((column) => column.fieldId === fieldId); if (!target || target.hideable === false) return false; const next = createTreeListState(columns, { ...viewState, columns: viewState.columns.map((column) => column.fieldId === fieldId ? { ...column, visible: value } : column) }); setViewState(next); props.onStateChange?.(next, Object.freeze({ operation: 'column-visibility', reason: 'api' })); return true; },
    moveColumn: async (fieldId: string, index: number) => { const target = viewState.columns.find((column) => column.fieldId === fieldId); if (!target) return false; const ordered = viewState.columns.filter((column) => column.fieldId !== fieldId); ordered.splice(Math.max(0, Math.min(index, ordered.length)), 0, target); const next = createTreeListState(columns, { ...viewState, columns: ordered.map((column, displayOrder) => ({ ...column, displayOrder })) }); setViewState(next); return true; },
    resizeColumn: async (fieldId: string, width: number) => { const descriptor = columns.find((column) => column.fieldId === fieldId); if (!descriptor || !Number.isFinite(width)) return false; const clamped = clampTreeListColumnWidth(descriptor, width); const next = createTreeListState(columns, { ...viewState, columns: viewState.columns.map((column) => column.fieldId === fieldId ? { ...column, width: clamped } : column) }); setViewState(next); return true; },
    fixColumn: async (fieldId: string, fixed: 'none' | 'start' | 'end') => { if (!columns.some((column) => column.fieldId === fieldId)) return false; const next = createTreeListState(columns, { ...viewState, columns: viewState.columns.map((column) => column.fieldId === fieldId ? { ...column, fixed } : column) }); setViewState(next); return true; },
    toggleDetail, exportXlsx, print: printTree, exportPdf: async (options?: CgTreeListPrintOptions): Promise<CgTreeListPdfResult | null> => { if (!props.pdfExporter) return null; const controller = new AbortController(); options?.signal?.addEventListener('abort', () => controller.abort(), { once: true }); if (controller.signal.aborted) throw new Error('CgTreeList PDF export was aborted.'); const current = snapshot(options?.scope); return props.pdfExporter(Object.freeze({ title: options?.title, columns: immutableArray(columns.filter((column) => column.printEnabled !== false).map((column) => ({ fieldId: column.fieldId, title: column.title ?? column.fieldId, alignment: column.alignment ?? 'start' }))), snapshot: current, rightToLeft: directionValue === 'rtl' }), controller.signal); },
    refresh: async () => { generationRef.current++; if (batching.current) { pendingRefresh.current = true; return; } setRenderGeneration((value) => value + 1); if (isProvider) await loadProviderRoots(viewState.rootPage.pageIndex); }, beginUpdate: () => { batching.current++; let ended = false; return () => { if (ended) return; ended = true; batching.current = Math.max(0, batching.current - 1); if (!batching.current && pendingRefresh.current) { pendingRefresh.current = false; setRenderGeneration((value) => value + 1); } }; },
    getItem: (key: TKey) => { const token = tokenOrNull(key); return token ? hierarchy.byToken.get(token)?.item ?? null : null; }, getVisibleKeys: () => immutableArray(visible.map((entry) => entry.internal.key)), getVisibleItems: () => immutableArray(visible.map((entry) => entry.internal.item)), getSnapshot: snapshot, getState: () => viewState,
  } as unknown as Record<string, (...args: unknown[]) => unknown>;
  void renderGeneration;

  const stableActions = useRef<CgTreeListActions<TItem, TKey> | null>(null);
  if (!stableActions.current) {
    stableActions.current = new Proxy({}, { get: (_target, property) => (...args: unknown[]) => (runtimeRef.current[property as string] as (...values: unknown[]) => unknown)(...args) }) as CgTreeListActions<TItem, TKey>;
  }
  const actions = stableActions.current;
  useImperativeHandle(actionsRef, () => actions, [actions]);

  // A hidden focused descendant recovers to its nearest visible ancestor without stealing DOM focus.
  useEffect(() => {
    if (focusedKey === null) return;
    const token = tokenOrNull(focusedKey); if (!token || visible.some((entry) => entry.internal.token === token)) return;
    const node = hierarchy.byToken.get(token); if (!node) { setFocus(null, null, 'state-restoration', false); return; }
    const ancestor = hierarchyAncestors(node).find((candidate) => visible.some((entry) => entry.internal.token === candidate.token));
    setFocus(ancestor?.key ?? null, focusedColumnId, 'state-restoration', false);
  }, [focusedColumnId, focusedKey, hierarchy, setFocus, visible]);

  const columnRenderSet = useMemo(() => {
    if (!props.columnVirtualization || visibleColumns.length <= 4) return new Set(visibleColumns.map((column) => column.fieldId));
    const fixed = visibleColumns.filter((column) => column.fixed !== 'none'); const middle = visibleColumns.filter((column) => column.fixed === 'none');
    const average = middle.reduce((sum, column) => sum + (typeof column.width === 'number' ? column.width : 160), 0) / Math.max(1, middle.length);
    const start = Math.max(0, Math.floor(scrollLeft / average) - columnOverscan); const count = Math.ceil(viewportWidth / average) + columnOverscan * 2;
    return new Set([...fixed, ...middle.slice(start, start + count)].map((column) => column.fieldId));
  }, [columnOverscan, props.columnVirtualization, scrollLeft, viewportWidth, visibleColumns]);
  const renderedColumns = visibleColumns.filter((column) => columnRenderSet.has(column.fieldId));
  const rowWindow = useMemo(() => {
    if (!props.rowVirtualization) return { start: 0, end: rowsForRendering.length, top: 0, bottom: 0 };
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan); const end = Math.min(rowsForRendering.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
    return { start, end, top: start * rowHeight, bottom: (rowsForRendering.length - end) * rowHeight };
  }, [overscan, props.rowVirtualization, rowHeight, rowsForRendering.length, scrollTop, viewportHeight]);
  const renderedRows = rowsForRendering.slice(rowWindow.start, rowWindow.end);

  const toggleGroup = (groupKey: string) => {
    const collapsed = new Set(viewState.collapsedGroupKeys); if (collapsed.has(groupKey)) collapsed.delete(groupKey); else collapsed.add(groupKey);
    const next = createTreeListState(columns, { ...viewState, collapsedGroupKeys: collapsed }); setViewState(next); props.onStateChange?.(next, Object.freeze({ operation: 'group-expansion', reason: 'pointer' }));
  };

  const groupLabel = (entry: TreeListProjectionNode<TItem, TKey>): string => viewState.groups.map((group) => {
    const column = columns.find((candidate) => candidate.fieldId === group.fieldId); return `${column?.title ?? group.fieldId}: ${formatTreeListValue(column!, entry.internal.item, props.locale)}`;
  }).join(' · ');
  const globalSummaryValues = useMemo(() => (props.summaries ?? []).filter((summary) => summary.scope === 'visible-rows' || summary.scope === 'loaded-nodes').map((summary) => Object.freeze({ summary, value: calculateSummary(summary, summary.scope === 'visible-rows' ? visible.map((entry) => entry.internal.item) : hierarchy.nodes.map((node) => node.item), columns) })), [columns, hierarchy.nodes, props.summaries, visible]);
  const nodeSummaryValues = (entry: TreeListProjectionNode<TItem, TKey>) => (props.summaries ?? []).filter((summary) => summary.scope !== 'visible-rows' && summary.scope !== 'loaded-nodes' && summary.nodeKey !== undefined && Object.is(summary.nodeKey, entry.internal.key)).map((summary) => {
    const nodes = summary.scope === 'direct-children' ? entry.internal.children : hierarchyDescendants(entry.internal);
    const remote = summary.scope === 'complete-subtree' ? summaryStatuses.get(`${entry.internal.token}|${summary.id}`) : undefined;
    const incomplete = summary.scope === 'complete-subtree' ? remote?.completeness !== 'complete' : entry.internal.hasUnloadedChildren || nodes.some((node) => node.hasUnloadedChildren);
    return { summary, value: summary.scope === 'complete-subtree' ? remote?.value : calculateSummary(summary, nodes.map((node) => node.item), columns), incomplete, loading: summary.scope === 'complete-subtree' && !remote, errorCode: remote?.errorCode };
  });

  const cycleSort = (column: CgTreeListColumn<TItem, TKey>, event: MouseEvent<HTMLButtonElement>) => {
    if (column.sortable === false || !column.getValue || props.disabled) return;
    const current = sorts.find((sort) => sort.fieldId === column.fieldId); const preserved = (props.allowMultiSort && (event.ctrlKey || event.metaKey)) ? sorts.filter((sort) => sort.fieldId !== column.fieldId) : [];
    const next = current?.direction === 'ascending' ? [...preserved, { fieldId: column.fieldId, direction: 'descending' as const }] : current?.direction === 'descending' ? preserved : [...preserved, { fieldId: column.fieldId, direction: 'ascending' as const }];
    const frozen = immutableArray(next); setSorts(frozen); props.onSortsChange?.(frozen);
    const nextState = createTreeListState(columns, { ...viewState, sorts: frozen }); setViewState(nextState); props.onStateChange?.(nextState, Object.freeze({ operation: 'sort', reason: 'pointer' }));
  };

  const cellKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-row-token][data-column-id]'); if (!target) return;
    const rowToken = target.dataset.rowToken!; const columnId = target.dataset.columnId!; const rowIndex = visible.findIndex((entry) => entry.internal.token === rowToken); const columnIndex = visibleColumns.findIndex((column) => column.fieldId === columnId); if (rowIndex < 0 || columnIndex < 0) return;
    const entry = visible[rowIndex]!; const hierarchyCell = columnId === hierarchyFieldId; let nextRow = rowIndex; let nextColumn = columnIndex; let handled = true;
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      const area = props.contextMenuAreas?.includes('cell') ? 'cell' : props.contextMenuAreas?.includes('row') ? 'row' : null;
      if (area) void menuActionsRef.current?.showNear(target, Object.freeze({ area, item: entry.internal.item, node: entry.publicNode, key: entry.internal.key, column: visibleColumns[columnIndex]!.descriptor, invocationKind: 'keyboard', actions }), { kind: 'keyboard' });
      else handled = false;
    }
    else if (event.ctrlKey && event.shiftKey && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      if (!props.disabled && !props.readOnly && props.allowMove) {
        const siblings = entry.internal.parent?.children ?? hierarchy.roots;
        const siblingIndex = siblings.indexOf(entry.internal);
        if (event.key === 'ArrowUp' && siblingIndex > 0) void actions.moveNode(entry.internal.key, entry.internal.parent ? { kind: 'key', key: entry.internal.parent.key } : { kind: 'none' }, siblingIndex - 1);
        else if (event.key === 'ArrowDown' && siblingIndex >= 0 && siblingIndex < siblings.length - 1) void actions.moveNode(entry.internal.key, entry.internal.parent ? { kind: 'key', key: entry.internal.parent.key } : { kind: 'none' }, siblingIndex + 1);
        else if (event.key === 'ArrowLeft' && entry.internal.parent) {
          const parent = entry.internal.parent;
          const parentSiblings = parent.parent?.children ?? hierarchy.roots;
          void actions.moveNode(entry.internal.key, parent.parent ? { kind: 'key', key: parent.parent.key } : { kind: 'none' }, parentSiblings.indexOf(parent) + 1);
        } else if (event.key === 'ArrowRight' && siblingIndex > 0) {
          const previousSibling = siblings[siblingIndex - 1]!;
          void actions.moveNode(entry.internal.key, { kind: 'key', key: previousSibling.key }, previousSibling.children.length);
        }
      }
    }
    else if (event.key === 'ArrowDown') nextRow = Math.min(visible.length - 1, rowIndex + 1);
    else if (event.key === 'ArrowUp') nextRow = Math.max(0, rowIndex - 1);
    else if (event.key === 'PageDown') nextRow = visible.length - 1;
    else if (event.key === 'PageUp') nextRow = 0;
    else if (event.key === 'Home') nextColumn = 0;
    else if (event.key === 'End') nextColumn = visibleColumns.length - 1;
    else if (event.key === 'ArrowRight' && hierarchyCell) { if (!expandedTokens.has(rowToken) && entry.publicNode.hasChildren) void performExpansion(entry.internal.key, true, 'keyboard', event); else { const child = visible[rowIndex + 1]; if (child?.internal.parent === entry.internal) nextRow = rowIndex + 1; } }
    else if (event.key === 'ArrowLeft' && hierarchyCell) { if (expandedTokens.has(rowToken)) void performExpansion(entry.internal.key, false, 'keyboard', event); else if (entry.internal.parent) { const parentIndex = visible.findIndex((candidate) => candidate.internal === entry.internal.parent); if (parentIndex >= 0) nextRow = parentIndex; } }
    else if (event.key === 'ArrowRight') nextColumn = Math.min(visibleColumns.length - 1, columnIndex + 1);
    else if (event.key === 'ArrowLeft') nextColumn = Math.max(0, columnIndex - 1);
    else if (event.key === ' ' || event.key === 'Spacebar') { if (checkMode !== 'disabled') void changeCheck(entry.internal.key); else void selectNode(entry.internal.key, { add: event.ctrlKey || event.metaKey, range: event.shiftKey }); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && selectionMode === 'multiple') { const next = immutableSet(visible.filter((candidate) => props.canSelect?.(candidate.internal.item) !== false).map((candidate) => candidate.internal.key)); setSelectedKeys(next); props.onSelectedKeysChange?.(next, Object.freeze({ selectedKeys: next, selectedItems: immutableArray(visible.map((candidate) => candidate.internal.item)), changedKey: null, reason: 'keyboard' })); }
    else if (event.key === 'F2') void beginEdit(entry.internal.key);
    else if (event.key === 'Escape') { if (editSession) void actions.cancelEdit(); else handled = false; }
    else if (event.key === 'Enter') { if (editSession) void saveEdit(); else void selectNode(entry.internal.key); }
    else handled = false;
    if (handled) { event.preventDefault(); event.stopPropagation(); if (nextRow !== rowIndex || nextColumn !== columnIndex) setFocus(visible[nextRow]!.internal.key, visibleColumns[nextColumn]!.fieldId, 'keyboard', true); }
  };

  const showContextMenu = (event: MouseEvent<HTMLElement>, area: CgTreeListContext<TItem, TKey>['area'], entry?: TreeListProjectionNode<TItem, TKey>, column?: CgTreeListColumn<TItem, TKey>) => {
    if (!props.contextMenuAreas?.includes(area)) return;
    event.preventDefault(); void menuActionsRef.current?.showFromEvent(event, Object.freeze({ area, item: entry?.internal.item, node: entry?.publicNode, key: entry?.internal.key, column, invocationKind: 'pointer', actions }));
  };

  const renderEditor = (entry: TreeListProjectionNode<TItem, TKey> | null, column: CgTreeListColumn<TItem, TKey>): ReactNode => {
    if (!editSession || !column.getValue) return null;
    if (editSession.kind === 'update' && (!entry || editSession.key !== entry.internal.key)) return null;
    const value = column.getValue(editSession.draft); const fieldErrors = editSession.result?.fieldErrors?.[column.fieldId] ?? [];
    const setValue = (next: unknown) => { const updated = column.updateValue?.(editSession.draft, next as never) ?? column.editor?.setValue(editSession.draft, next as never); if (updated) setEditSession({ ...editSession, draft: updated }); };
    const context = Object.freeze({ item: entry?.internal.item ?? editSession.original ?? editSession.draft, model: editSession.draft, key: editSession.key, value, setValue, fieldErrors, disabled: !!props.disabled, readOnly: !!props.readOnly });
    if (column.renderEditor) return column.renderEditor(context as never);
    if (!column.updateValue && !column.editor) return null;
    if (column.type === 'boolean') return <input type="checkbox" checked={Boolean(value)} onChange={(event) => setValue(event.currentTarget.checked)} />;
    return <input className={styles.editor} type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={value === null || value === undefined ? '' : String(value)} onChange={(event) => setValue(column.type === 'number' ? event.currentTarget.valueAsNumber : event.currentTarget.value)} />;
  };

  const renderCell = (entry: TreeListProjectionNode<TItem, TKey>, normalized: (typeof normalizedColumns)[number]): ReactNode => {
    const column = normalized.descriptor; const value = column.getValue?.(entry.internal.item); const selected = selectedTokens.has(entry.internal.token); const focused = focusedKey !== null && treeListKeyToken(focusedKey) === entry.internal.token && focusedColumnId === column.fieldId; const editing = editSession?.kind === 'update' && editSession.key === entry.internal.key;
    const formatted = formatTreeListValue(column, entry.internal.item, props.locale); const defaultContent = column.type === 'selection' ? null : column.type === 'command' ? column.renderCommands?.({ item: entry.internal.item, key: entry.internal.key, value: undefined as never, node: entry.publicNode, column, selected, focused, editing, actions, defaultContent: null }) : formatted;
    const context = Object.freeze({ item: entry.internal.item, key: entry.internal.key, value, node: entry.publicNode, column, selected, focused, editing, actions, defaultContent });
    let content: ReactNode = column.renderCell?.(context as never) ?? defaultContent;
    if (editing && column.getValue) content = renderEditor(entry, column) ?? content;
    if (column.fieldId === hierarchyFieldId) {
      const state = checkState(entry.internal); const loading = loadStatuses.get(entry.internal.token)?.state === 'loading'; const error = loadStatuses.get(entry.internal.token)?.state === 'error'; const icon = props.renderIcon?.(entry.internal.item, entry.publicNode) ?? renderIcon(props.getIcon?.(entry.internal.item));
      content = <div className={styles.hierarchyCell}>
        <span className={styles.indent} style={{ '--cg-tree-list-level': Math.max(0, entry.publicNode.level - 1) } as CSSProperties} aria-hidden="true" />
        {entry.publicNode.hasChildren ? <button className={styles.expander} type="button" aria-label={label(expandedTokens.has(entry.internal.token) ? mergedLabels.collapse : mergedLabels.expand, formatted)} disabled={props.disabled} onClick={(event) => { event.stopPropagation(); void performExpansion(entry.internal.key, !expandedTokens.has(entry.internal.token), 'pointer', event); }}><span aria-hidden="true">{loading ? '…' : expandedTokens.has(entry.internal.token) ? '▾' : directionValue === 'rtl' ? '◂' : '▸'}</span></button> : <span className={styles.controlPlaceholder} aria-hidden="true" />}
        {checkMode !== 'disabled' ? <IndeterminateCheckbox checked={state === 'checked'} mixed={state === 'mixed'} disabled={!!props.disabled || !!props.readOnly || props.canCheck?.(entry.internal.item) === false} label={`Check ${formatted}`} onChange={(next) => { void changeCheck(entry.internal.key, next); }} /> : null}
        {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
        <span className={styles.cellText}>{props.highlightSearchMatches !== false && entry.publicNode.directMatch && typeof content === 'string' ? highlightedText(content, searchText) : content}</span>
        {error ? <button className={styles.retry} type="button" onClick={(event) => { event.stopPropagation(); void loadNode(entry.internal.key); }}>{mergedLabels.retry}</button> : null}
      </div>;
    }
    if (column.type === 'selection') content = <IndeterminateCheckbox checked={selected} mixed={false} disabled={selectionMode === 'none' || props.canSelect?.(entry.internal.item) === false} label={`Select ${formatTreeListValue(columns.find((candidate) => candidate.fieldId === hierarchyFieldId)!, entry.internal.item, props.locale)}`} onChange={() => { void selectNode(entry.internal.key, { add: selectionMode === 'multiple' }); }} />;
    return content;
  };

  const editErrors = editSession?.result?.generalErrors ?? [];
  const popupEditor = editSession && (editSession.kind === 'create' || props.editMode === 'popup') ? <CgPopup open headerText={editSession.kind === 'create' ? editSession.parentKey.kind === 'key' ? mergedLabels.addChild : mergedLabels.addRoot : mergedLabels.edit} closeOnEscape={false} closeOnOutsideClick={false} onOpenChange={(open) => { if (!open) void actions.cancelEdit(); }} body={<div className={styles.popupEditor}>{columns.filter((column) => column.getValue && (column.updateValue || column.editor || column.renderEditor)).map((column) => <label key={column.fieldId}>{column.title ?? column.fieldId}<span>{editSession.kind === 'update' && editSession.key !== null ? renderEditor({ internal: hierarchy.byToken.get(treeListKeyToken(editSession.key))!, publicNode: visible.find((entry) => entry.internal.key === editSession.key)?.publicNode ?? { item: editSession.original!, key: editSession.key, parentKey: editSession.parentKey, level: 1, visibleIndex: 0, posInSet: 1, setSize: 1, siblingIndex: 0, hasChildren: false, childrenLoaded: true, directMatch: false, retainedAsAncestor: false } }, column) : renderEditor(null, column)}</span></label>)}{editErrors.length ? <div className={styles.errors} role="alert">{editErrors.join(' ')}</div> : null}</div>} footer={<div className={styles.editorActions}><button type="button" onClick={() => { void actions.cancelEdit(); }}>{mergedLabels.cancel}</button>{editSession.result?.outcome === 'conflict' ? <button type="button" disabled={editSession.saving} onClick={() => { void actions.retryConflict(); }}>Retry conflict</button> : null}<button type="button" disabled={editSession.saving} onClick={() => { void saveEdit(); }}>{mergedLabels.save}</button></div>} /> : null;

  const nativeRootAttributes = Object.fromEntries(Object.entries(nativeProps).filter(([name]) => name.startsWith('data-') || name.startsWith('aria-') || ['title', 'hidden', 'tabIndex', 'lang', 'translate', 'accessKey', 'draggable', 'contentEditable', 'spellCheck', 'onFocus', 'onBlur', 'onPointerDown', 'onPointerUp', 'onPointerMove', 'onMouseEnter', 'onMouseLeave'].includes(name)));

  return <div {...nativeRootAttributes} id={rootId} ref={rootRef} className={cx(styles.root, styles[size], className)} style={{ ...style, height }} dir={directionValue} data-cg-tree-list data-size={size}>
    {props.showSearch ? <div className={styles.toolbar}><input type="search" value={searchText} placeholder={mergedLabels.searchPlaceholder} aria-label={mergedLabels.searchPlaceholder} disabled={props.disabled} onChange={(event: ChangeEvent<HTMLInputElement>) => { setSearchText(event.currentTarget.value); props.onSearchTextChange?.(event.currentTarget.value); }} /></div> : null}
    {providerError ? <div className={styles.error} role="alert">{providerError} <button type="button" onClick={() => { void loadProviderRoots(viewState.rootPage.pageIndex); }}>{mergedLabels.retry}</button></div> : null}
    <div ref={scrollerRef} className={styles.scroller} onScroll={(event) => { setScrollTop(event.currentTarget.scrollTop); setScrollLeft(event.currentTarget.scrollLeft); }} onKeyDown={cellKeyDown} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('[data-row-token]')) showContextMenu(event, 'empty-area'); }}>
      <table role="treegrid" aria-label={ariaLabel} aria-rowcount={visible.length + groupRepresentatives.size} aria-colcount={visibleColumns.length} aria-multiselectable={selectionMode === 'multiple' || undefined} aria-busy={providerLoading || undefined} aria-disabled={props.disabled || undefined} aria-readonly={props.readOnly || undefined} className={cx(styles.table, stickyHeader && styles.sticky)}>
        <thead><tr role="row">{renderedColumns.map((normalized) => { const column = normalized.descriptor; const sort = sorts.find((entry) => entry.fieldId === column.fieldId); const defaultContent = normalized.title; const context = Object.freeze({ column, sort, sortPriority: sorts.findIndex((entry) => entry.fieldId === column.fieldId) + 1, actions, defaultContent }); return <th key={column.fieldId} role="columnheader" aria-sort={sort?.direction ?? 'none'} className={styles.headerCell} style={{ width: normalized.width, minWidth: column.minWidth, maxWidth: column.maxWidth }} onContextMenu={(event) => showContextMenu(event, 'header', undefined, column)}>{column.sortable !== false && column.getValue ? <button type="button" className={styles.headerButton} onClick={(event) => cycleSort(column, event)}>{column.renderHeader?.(context) ?? defaultContent}<span aria-hidden="true">{sort?.direction === 'ascending' ? '▲' : sort?.direction === 'descending' ? '▼' : ''}</span></button> : column.renderHeader?.(context) ?? defaultContent}</th>; })}</tr></thead>
        <tbody>
          {rowWindow.top ? <tr aria-hidden="true" role="presentation"><td colSpan={renderedColumns.length} style={{ height: rowWindow.top, padding: 0, border: 0 }} /></tr> : null}
          {renderedRows.map((entry) => {
            const groupKey = groupKeyFor(entry); const firstInGroup = !!groupKey && groupRepresentatives.get(groupKey) === entry.internal.token; const rowHidden = hiddenByCollapsedGroup.has(entry.internal.token); const selected = selectedTokens.has(entry.internal.token); const disabledRow = props.canSelect?.(entry.internal.item) === false; const status = loadStatuses.get(entry.internal.token); return <Fragment key={entry.internal.token}>
              {firstInGroup ? <tr role="row" className={styles.groupRow} aria-level={entry.publicNode.level} aria-expanded={!viewState.collapsedGroupKeys.has(groupKey!)} data-group-key={groupKey}><td role="gridcell" colSpan={renderedColumns.length}><button type="button" className={styles.groupToggle} aria-label={`${viewState.collapsedGroupKeys.has(groupKey!) ? 'Expand' : 'Collapse'} ${groupLabel(entry)}`} onClick={() => toggleGroup(groupKey!)}><span aria-hidden="true">{viewState.collapsedGroupKeys.has(groupKey!) ? directionValue === 'rtl' ? '◂' : '▸' : '▾'}</span> {groupLabel(entry)}</button></td></tr> : null}
              {rowHidden ? null : <>
              <tr ref={(element) => { if (element) rowRefs.current.set(entry.internal.token, element); else rowRefs.current.delete(entry.internal.token); }} role="row" data-row-token={entry.internal.token} data-key={String(entry.internal.key)} data-match={entry.publicNode.directMatch || undefined} data-ancestor-match={entry.publicNode.retainedAsAncestor || undefined} className={cx(styles.row, selected && styles.selected, disabledRow && styles.disabledRow, editSession?.key === entry.internal.key && styles.editing)} aria-level={entry.publicNode.level} aria-posinset={entry.publicNode.posInSet} aria-setsize={entry.publicNode.setSize} aria-rowindex={entry.publicNode.visibleIndex + 2} aria-expanded={entry.publicNode.hasChildren ? expandedTokens.has(entry.internal.token) : undefined} aria-selected={selectionMode === 'none' ? undefined : selected} aria-busy={status?.state === 'loading' || undefined} aria-disabled={disabledRow || undefined} onClick={(event) => { if ((event.target as HTMLElement).closest('button,input,a')) return; setFocus(entry.internal.key, hierarchyFieldId, 'pointer', false); void selectNode(entry.internal.key, { add: selectionMode === 'multiple' && (event.ctrlKey || event.metaKey), range: selectionMode === 'multiple' && event.shiftKey }); }} onDoubleClick={() => { if (props.renderDetail) void toggleDetail(entry.internal.key); }} onContextMenu={(event) => showContextMenu(event, (event.target as HTMLElement).closest('[data-column-id]') ? 'cell' : 'row', entry, columns.find((column) => column.fieldId === (event.target as HTMLElement).closest<HTMLElement>('[data-column-id]')?.dataset.columnId))}>
                {renderedColumns.map((normalized) => { const column = normalized.descriptor; const focused = focusedKey !== null && treeListKeyToken(focusedKey) === entry.internal.token && (focusedColumnId ?? visibleColumns[0]?.fieldId) === column.fieldId; return <td key={column.fieldId} ref={(element) => { const key = `${entry.internal.token}|${column.fieldId}`; if (element) cellRefs.current.set(key, element); else cellRefs.current.delete(key); }} role="gridcell" data-row-token={entry.internal.token} data-column-id={column.fieldId} data-align={column.alignment ?? 'start'} tabIndex={focused || (focusedKey === null && entry.publicNode.visibleIndex === 0 && column.fieldId === visibleColumns[0]?.fieldId) ? 0 : -1} className={styles.cell} style={{ width: normalized.width, minWidth: column.minWidth, maxWidth: column.maxWidth }} onFocus={() => setFocus(entry.internal.key, column.fieldId, 'keyboard', false)}>{renderCell(entry, normalized)}</td>; })}
              </tr>
              {detailKeys.has(entry.internal.key) && props.renderDetail ? <tr role="row" className={styles.detailRow}><td role="gridcell" colSpan={renderedColumns.length} className={styles.detailCell}>{props.renderDetail(Object.freeze({ item: entry.internal.item, key: entry.internal.key, detail: detailStatuses.get(entry.internal.token)?.detail, loading: detailStatuses.get(entry.internal.token)?.loading ?? false, errorCode: detailStatuses.get(entry.internal.token)?.errorCode, retry: () => loadDetail(entry.internal.key), collapse: () => toggleDetail(entry.internal.key) }))}</td></tr> : null}
              {nodeSummaryValues(entry).map(({ summary, value, incomplete, loading, errorCode }) => <tr role="row" className={styles.nodeSummaryRow} key={`${entry.internal.token}:${summary.id}`}><td role="gridcell" colSpan={renderedColumns.length}>{summary.label ?? summary.id}: {loading ? mergedLabels.loading : errorCode ?? (value === undefined ? 'Unavailable' : String(value))}{incomplete && !loading ? ' (partial)' : ''}</td></tr>)}
              {lazyPages.get(entry.internal.token)?.hasMore ? <tr role="row" className={styles.loadMoreRow}><td role="gridcell" colSpan={renderedColumns.length}><button type="button" disabled={status?.state === 'loading'} onClick={() => { void loadNode(entry.internal.key, true); }}>{mergedLabels.loadMore}</button></td></tr> : null}
              </>}
            </Fragment>;
          })}
          {rowWindow.bottom ? <tr aria-hidden="true" role="presentation"><td colSpan={renderedColumns.length} style={{ height: rowWindow.bottom, padding: 0, border: 0 }} /></tr> : null}
        </tbody>
        {globalSummaryValues.length ? <tfoot><tr role="row" className={styles.summaryRow}>{renderedColumns.map((column) => { const summaries = globalSummaryValues.filter((entry) => entry.summary.fieldId === column.fieldId || (entry.summary.type === 'count' && column.fieldId === hierarchyFieldId)); return <td key={column.fieldId} role="gridcell" className={styles.summaryCell}>{summaries.map(({ summary, value }) => <div key={summary.id}>{summary.label ?? summary.id}: {value === undefined ? 'Unavailable' : String(value)}</div>)}</td>; })}</tr></tfoot> : null}
      </table>
      {!providerLoading && visible.length === 0 ? <div className={styles.empty} role="status">{(searchText || filter) ? mergedLabels.noMatches : props.renderEmpty?.() ?? mergedLabels.empty}</div> : null}
      {providerLoading && visible.length === 0 ? <div className={styles.empty} role="status">{props.renderLoading?.() ?? mergedLabels.loading}</div> : null}
    </div>
    {props.showPager ? <div className={styles.pager}><CgPager pageIndex={viewState.rootPage.pageIndex} pageSize={viewState.rootPage.pageSize} totalItemCount={isProvider ? providerTotal : localProjectedRootCount} pageCount={Math.max(1, Math.ceil((isProvider ? providerTotal : localProjectedRootCount) / viewState.rootPage.pageSize))} loading={providerLoading} direction={directionValue} onPageIndexChange={(pageIndex) => { void actions.goToRootPage(pageIndex); }} /></div> : null}
    {editSession?.kind === 'update' && props.editMode !== 'popup' ? <div className={styles.inlineEditBar} role="group" aria-label={mergedLabels.edit}>{editErrors.length ? <span className={styles.errors} role="alert">{editErrors.join(' ')}</span> : null}<button type="button" onClick={() => { void actions.cancelEdit(); }}>{mergedLabels.cancel}</button><button type="button" disabled={editSession.saving} onClick={() => { void saveEdit(); }}>{mergedLabels.save}</button></div> : null}
    {popupEditor}
    {props.customizeContextMenu ? <CgContextMenu<CgTreeListContext<TItem, TKey>> items={[] as ReadonlyArray<CgContextMenuItem<CgTreeListContext<TItem, TKey>>>} customizeMenu={props.customizeContextMenu} onItemActivate={props.onContextMenuItemActivate} commandFailure={props.onContextMenuCommandFailure} actionsRef={menuActionsRef} direction={directionValue} /> : null}
  </div>;
}
