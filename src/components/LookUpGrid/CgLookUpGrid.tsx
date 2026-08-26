/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect, @typescript-eslint/require-await -- CgLookUpGrid refs coordinate controlled proposals, abortable generations, paging snapshots, and imperative actions. */
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
import type { ChangeEvent, FormEvent, KeyboardEvent, MouseEvent, SyntheticEvent } from 'react';
import { useCgId, useControllableState, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, useFieldControl } from '../../internal';
import { assertNonNegative, assertPositiveInteger } from '../../internal/validation';
import { cx } from '../../utils';
import { CgFlyout } from '../Flyout';
import type { CgFlyoutOpenChangeDetails } from '../Flyout';
import { filterLookUpItems, formatLookUpCell, normalizeLookUpText } from './filtering';
import { createLookUpQuery, normalizeColumnFilters } from './query';
import { parseLookUpSort, sortLookUpItems } from './sorting';
import styles from './CgLookUpGrid.module.css';
import type {
  CgLookUpGridActions,
  CgLookUpGridCloseReason,
  CgLookUpGridColumnDescriptor,
  CgLookUpGridColumnFiltersChangeDetails,
  CgLookUpGridItemSelectDetails,
  CgLookUpGridLabels,
  CgLookUpGridOpenReason,
  CgLookUpGridProps,
  CgLookUpGridRenderState,
  CgLookUpGridResult,
  CgLookUpGridSort,
  CgLookUpGridSortChangeDetails,
  CgLookUpGridSortDirection,
  CgLookUpGridValueChangeDetails,
} from './CgLookUpGrid.types';

const DEFAULT_LABELS: CgLookUpGridLabels = {
  loading: 'Loading…',
  empty: 'No results found',
  searchError: 'Unable to load results.',
  retry: 'Retry',
  minimumSearchLength: (minimum) => `Type at least ${minimum} characters to search.`,
  loadMore: 'Load more',
  resultCount: (loaded, total) => `${loaded} of ${total}`,
  resultCountUnknown: (loaded) => `${loaded} loaded`,
  viewAll: 'View all',
  clearSelection: 'Clear selection',
  toggleLookup: 'Toggle lookup',
  columnFilter: (_title, fieldId) => `Filter ${fieldId}`,
  sortAscending: (_title, fieldId) => `${fieldId} sorted ascending`,
  sortDescending: (_title, fieldId) => `${fieldId} sorted descending`,
  sortCleared: 'Sorting cleared',
  filterRemoved: (fieldId) => `Filter for ${fieldId} was removed because the column is no longer visible.`,
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim().length === 0);
}

function freezeFilters(filters: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.freeze({ ...filters });
}

function titleText(title: React.ReactNode, fallback: string): string {
  return typeof title === 'string' || typeof title === 'number' ? String(title) : fallback;
}

function cssLength(value: React.CSSProperties['height']): React.CSSProperties['height'] {
  return typeof value === 'number' ? `${value}px` : value;
}

function filtersEqual(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);
  return leftEntries.length === rightEntries.length && leftEntries.every(([key, value]) => right[key] === value);
}

function isArray(value: unknown): boolean {
  return Array.isArray(value);
}

function validateColumns<TItem>(
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>,
  local: boolean,
): ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>> {
  if (!isArray(columns) || columns.length === 0) throw new Error('CgLookUpGrid requires at least one column descriptor.');
  const seen = new Set<string>();
  return columns.map((column, index) => {
    const fieldId = column.fieldId?.trim();
    if (!fieldId) throw new Error(`CgLookUpGrid column at index ${index} requires a nonblank fieldId.`);
    if (seen.has(fieldId)) throw new Error(`CgLookUpGrid received duplicate column fieldId "${fieldId}".`);
    seen.add(fieldId);
    if (column.width !== undefined && typeof column.width === 'number' && (!Number.isFinite(column.width) || column.width < 0)) {
      throw new RangeError(`CgLookUpGrid column "${fieldId}" width must be nonnegative and finite.`);
    }
    const visible = column.visible !== false;
    const needsLocalAccessor = local && visible && (column.searchable !== false || column.filterable !== false || column.sortable !== false);
    const needsDefaultRendering = visible && !column.renderCell;
    if (!column.accessor && (needsLocalAccessor || needsDefaultRendering)) {
      throw new Error(
        `CgLookUpGrid column "${fieldId}" requires an accessor for local operations or default rendering. ` +
        'A server-only column may omit it only when searchable, filterable, and sortable are false and renderCell is supplied.',
      );
    }
    return fieldId === column.fieldId ? column : { ...column, fieldId };
  });
}

function serializeFormValue<TValue>(value: TValue | null, name: string | undefined, serializer?: (value: TValue) => string): string[] {
  if (isEmptyValue(value)) return [];
  if (serializer) {
    const result = serializer(value as TValue);
    if (typeof result !== 'string') throw new TypeError('CgLookUpGrid serializeValue must return a string.');
    return [result];
  }
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (name) throw new Error('CgLookUpGrid requires serializeValue when a named value is not a string or number.');
  return [];
}

function findEnabled(disabled: ReadonlyArray<boolean>, start: number, step: number): number {
  for (let index = start; index >= 0 && index < disabled.length; index += step) {
    if (!disabled[index]) return index;
  }
  return -1;
}

function CgLookUpGridInner<TItem, TValue, TContext = unknown>(
  {
    data,
    dataLoader,
    columns: columnProps,
    valueSelector,
    textSelector,
    value,
    defaultValue = null,
    onValueChange,
    selectedItem: controlledSelectedItem,
    onSelectedItemChange,
    onItemSelect,
    onClear,
    isValueEqual = Object.is,
    itemResolver,
    queryContext,
    isQueryContextEqual = Object.is,
    pageSize = 50,
    allowPaging = true,
    showHeader = true,
    allowSorting = true,
    initialSort,
    showFilterRow = false,
    rowDisabledSelector,
    locale,
    ignoreDiacritics = true,
    minimumSearchLength = 0,
    searchDebounceMilliseconds = 300,
    open,
    defaultOpen = false,
    onOpenChange,
    onSearchTextChange,
    onSortChange,
    onColumnFiltersChange,
    onViewAllRequest,
    renderSelected,
    renderLoading,
    renderNoData,
    renderError,
    renderFooter,
    labels: labelOverrides,
    clearable = true,
    showResultCount = true,
    dropDownWidth,
    dropDownHeight = '360px',
    rowHeight,
    actionsRef,
    serializeValue,
    name,
    form,
    required,
    requiredErrorMessage = 'Please select a value.',
    disabled,
    readOnly,
    onInvalid,
    size = 'medium',
    density = 'comfortable',
    direction = 'auto',
    validationState = 'none',
    fullWidth = false,
    className,
    style,
    popupClassName,
    popupStyle,
    id,
    placeholder,
    'data-testid': testId,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onFocus,
    onBlur,
    onKeyDown,
    onClick,
    autoComplete = 'off',
    ...nativeProps
  }: CgLookUpGridProps<TItem, TValue, TContext>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const hasLocal = data !== undefined;
  const hasRemote = dataLoader !== undefined;
  if (hasLocal === hasRemote) throw new Error('CgLookUpGrid requires exactly one data source: data or dataLoader.');
  if (hasLocal && !isArray(data)) throw new TypeError('CgLookUpGrid data must be an array when local data mode is used.');
  assertPositiveInteger('pageSize', pageSize);
  assertNonNegative('minimumSearchLength', minimumSearchLength);
  assertNonNegative('searchDebounceMilliseconds', searchDebounceMilliseconds);
  if (typeof rowHeight === 'number') assertNonNegative('rowHeight', rowHeight);
  if (typeof dropDownHeight === 'number') assertNonNegative('dropDownHeight', dropDownHeight);
  if (typeof dropDownWidth === 'number') assertNonNegative('dropDownWidth', dropDownWidth);

  const columns = useMemo(() => validateColumns(columnProps, hasLocal), [columnProps, hasLocal]);
  const visibleColumns = useMemo(() => columns.filter((column) => column.visible !== false), [columns]);
  const filterableColumns = useMemo(() => visibleColumns.filter((column) => column.filterable !== false), [visibleColumns]);
  const sortableColumns = useMemo(() => visibleColumns.filter((column) => column.sortable !== false), [visibleColumns]);
  const initialSortRef = useRef<CgLookUpGridSort | null | undefined>(undefined);
  if (initialSortRef.current === undefined) initialSortRef.current = parseLookUpSort(initialSort, columns);

  const labels = useMemo<CgLookUpGridLabels>(() => ({ ...DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const resolvedDirection = useDirection(inputRef, direction);
  const baseId = useCgId(field.id);
  const gridId = `${baseId}-grid`;
  const liveId = `${baseId}-live`;

  const [committedValue, setCommittedValue] = useControllableState<TValue | null>(value, defaultValue, 'CgLookUpGrid');
  const [isOpen, setIsOpen] = useControllableState(open, defaultOpen, 'CgLookUpGrid.open');
  const [internalSelectedItem, setInternalSelectedItem] = useState<TItem | null>(null);
  const [resolvedItem, setResolvedItem] = useState<TItem | null>(null);
  const [draft, setDraft] = useState('');
  const [searchDirty, setSearchDirty] = useState(false);
  const [rows, setRows] = useState<ReadonlyArray<TItem>>([]);
  const [rowDisabled, setRowDisabled] = useState<ReadonlyArray<boolean>>([]);
  const [totalCount, setTotalCount] = useState<number>();
  const [lastPageFull, setLastPageFull] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>();
  const [activeIndex, setActiveIndex] = useState(-1);
  const [sort, setSort] = useState<CgLookUpGridSort | null>(initialSortRef.current);
  const [rawFilters, setRawFilters] = useState<Readonly<Record<string, string>>>({});
  const [liveMessage, setLiveMessage] = useState('');
  const [internalInvalid, setInternalInvalid] = useState(false);
  const [resolverRevision, setResolverRevision] = useState(0);
  const mountedRef = useRef(true);
  const rowsRef = useRef(rows);
  const disabledRef = useRef(rowDisabled);
  const valueRef = useRef(committedValue);
  const controlledValueRef = useRef(value);
  const selectedRef = useRef<TItem | null>(null);
  const sortRef = useRef(sort);
  const filtersRef = useRef(rawFilters);
  const openRef = useRef(isOpen);
  const draftRef = useRef(draft);
  const searchDirtyRef = useRef(searchDirty);
  const errorRef = useRef(error);
  const totalRef = useRef(totalCount);
  const lastPageFullRef = useRef(lastPageFull);
  const cacheRef = useRef<TItem | null>(null);
  const queryControllerRef = useRef<AbortController | undefined>(undefined);
  const queryGenerationRef = useRef(0);
  const loadMorePendingRef = useRef(false);
  const resolverControllerRef = useRef<AbortController | undefined>(undefined);
  const resolverGenerationRef = useRef(0);
  const resolverAttemptsRef = useRef<TValue[]>([]);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousContextRef = useRef(queryContext as TContext);
  const previousDataRef = useRef(data);
  const previousColumnCapabilitiesRef = useRef([String(allowSorting), ...visibleColumns.map((column) => `${column.fieldId}:${column.searchable !== false}:${column.filterable !== false}:${column.sortable !== false}`)]);
  const queryStartedForOpenRef = useRef(false);
  const debounceOnNextOpenRef = useRef(false);
  const previousRenderedOpenRef = useRef(false);
  const dataLoaderStable = useStableCallback(dataLoader);
  const resolverStable = useStableCallback(itemResolver);
  const resolverAvailable = itemResolver !== undefined;
  const valueSelectorStable = useStableCallback(valueSelector);
  const textSelectorStable = useStableCallback(textSelector);
  const disabledSelectorStable = useStableCallback(rowDisabledSelector);

  const effectiveSearch = searchDirty ? normalizeLookUpText(draft) : '';
  const belowMinimum = searchDirty && effectiveSearch.length > 0 && effectiveSearch.length < minimumSearchLength;
  const selectedItem = controlledSelectedItem !== undefined ? controlledSelectedItem : internalSelectedItem;
  const actualSelectedItem = controlledSelectedItem !== undefined ? controlledSelectedItem : resolvedItem ?? selectedItem;
  const committedText = isEmptyValue(committedValue)
    ? ''
    : actualSelectedItem !== null
      ? textSelector(actualSelectedItem)
      : String(committedValue);
  const inputText = isOpen ? draft : committedText;
  const effectiveValidation = internalInvalid && field.validationState === 'none' ? 'error' : field.validationState;

  useLayoutEffect(() => {
    rowsRef.current = rows;
    disabledRef.current = rowDisabled;
    valueRef.current = committedValue;
    controlledValueRef.current = value;
    selectedRef.current = actualSelectedItem;
    sortRef.current = sort;
    filtersRef.current = rawFilters;
    openRef.current = isOpen;
    draftRef.current = draft;
    searchDirtyRef.current = searchDirty;
    errorRef.current = error;
    totalRef.current = totalCount;
    lastPageFullRef.current = lastPageFull;
  });

  const valueMatches = useCallback((item: TItem, candidate: TValue | null): boolean => (
    !isEmptyValue(candidate) && isValueEqual(valueSelector(item), candidate as TValue)
  ), [isValueEqual, valueSelector]);

  const cancelDebounce = useCallback(() => {
    if (debounceTimerRef.current !== undefined) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = undefined;
  }, []);

  const cancelQuery = useCallback(() => {
    cancelDebounce();
    queryControllerRef.current?.abort();
    queryControllerRef.current = undefined;
    queryGenerationRef.current += 1;
    loadMorePendingRef.current = false;
    if (mountedRef.current) {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cancelDebounce]);

  const applyRows = useStableCallback((nextRows: ReadonlyArray<TItem>, nextTotal: number | undefined, append: boolean) => {
    const disabledFlags = nextRows.map((item) => Boolean(disabledSelectorStable(item)));
    const combinedRows = append ? [...rowsRef.current, ...nextRows] : [...nextRows];
    const combinedDisabled = append ? [...disabledRef.current, ...disabledFlags] : disabledFlags;
    rowsRef.current = combinedRows;
    disabledRef.current = combinedDisabled;
    setRows(combinedRows);
    setRowDisabled(combinedDisabled);
    setTotalCount(nextTotal);
    totalRef.current = nextTotal;
    const full = nextRows.length === pageSize;
    setLastPageFull(full);
    lastPageFullRef.current = full;
    const currentValue = valueRef.current;
    const currentItem = !isEmptyValue(currentValue)
      ? combinedRows.find((item) => isValueEqual(valueSelectorStable(item), currentValue as TValue)) ?? null
      : null;
    if (currentItem) {
      cacheRef.current = currentItem;
      setResolvedItem(currentItem);
      if (controlledSelectedItem === undefined) setInternalSelectedItem(currentItem);
      if (openRef.current && !searchDirtyRef.current) {
        const text = textSelectorStable(currentItem);
        setDraft(text);
        draftRef.current = text;
        queueMicrotask(() => inputRef.current?.select());
      }
    }
    setActiveIndex((current) => {
      if (append && current >= 0 && !combinedDisabled[current]) return current;
      if (current >= 0 && current < combinedRows.length && !combinedDisabled[current]) return current;
      return findEnabled(combinedDisabled, 0, 1);
    });
  });

  const validateResult = useCallback((result: CgLookUpGridResult<TItem>): { items: TItem[]; total?: number } => {
    if (!result || typeof result !== 'object' || !Array.isArray(result.items)) {
      throw new TypeError('CgLookUpGrid dataLoader must resolve to an object with an items array.');
    }
    if (result.totalCount !== undefined && (!Number.isInteger(result.totalCount) || result.totalCount < 0)) {
      throw new RangeError('CgLookUpGrid result totalCount must be a nonnegative integer when supplied.');
    }
    return { items: result.items.filter((item): item is TItem => item !== null && item !== undefined), total: result.totalCount };
  }, []);

  const runQuery = useStableCallback(async (append: boolean = false) => {
    if (!openRef.current || (searchDirtyRef.current && normalizeLookUpText(draftRef.current).length > 0 && normalizeLookUpText(draftRef.current).length < minimumSearchLength)) return;
    if (append && (loadMorePendingRef.current || queryControllerRef.current !== undefined)) return;
    loadMorePendingRef.current = append;
    cancelDebounce();
    queryControllerRef.current?.abort();
    const controller = new AbortController();
    queryControllerRef.current = controller;
    const generation = ++queryGenerationRef.current;
    if (append) setLoadingMore(true);
    else {
      setLoading(true);
      setError(undefined);
    }
    const currentSearch = searchDirtyRef.current ? normalizeLookUpText(draftRef.current) : '';
    const currentFilters = normalizeColumnFilters(filtersRef.current);
    const skip = append ? rowsRef.current.length : 0;
    try {
      if (hasLocal) {
        const source = (data ?? []).filter((item): item is TItem => item !== null && item !== undefined);
        const filtered = filterLookUpItems(source, visibleColumns, currentSearch, currentFilters, locale, ignoreDiacritics);
        const sorted = allowSorting ? sortLookUpItems(filtered, visibleColumns, sortRef.current, locale) : filtered;
        const take = allowPaging ? skip + pageSize : pageSize;
        const page = append ? sorted.slice(skip, take) : sorted.slice(0, take);
        if (controller.signal.aborted || generation !== queryGenerationRef.current) return;
        applyRows(page, sorted.length, append);
      } else {
        const query = createLookUpQuery({ columns: visibleColumns, searchText: currentSearch, sort: allowSorting ? sortRef.current : null, columnFilters: currentFilters, skip, take: pageSize, queryContext: queryContext as TContext });
        const result = await dataLoaderStable(query, { signal: controller.signal }) as CgLookUpGridResult<TItem>;
        if (controller.signal.aborted || generation !== queryGenerationRef.current) return;
        const validated = validateResult(result);
        applyRows(validated.items, validated.total, append);
      }
    } catch (nextError) {
      if (controller.signal.aborted || generation !== queryGenerationRef.current || isAbortError(nextError)) return;
      if (!append) {
        setRows([]);
        setRowDisabled([]);
        rowsRef.current = [];
        disabledRef.current = [];
      }
      setError(nextError);
    } finally {
      if (generation === queryGenerationRef.current && mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
        if (queryControllerRef.current === controller) queryControllerRef.current = undefined;
      }
      if (append && queryControllerRef.current !== controller) loadMorePendingRef.current = false;
    }
  });

  const scheduleQuery = useStableCallback(() => {
    cancelDebounce();
    queryControllerRef.current?.abort();
    queryControllerRef.current = undefined;
    queryGenerationRef.current += 1;
    const scheduledSearch = searchDirtyRef.current ? normalizeLookUpText(draftRef.current) : '';
    if (searchDirtyRef.current && scheduledSearch.length > 0 && scheduledSearch.length < minimumSearchLength) {
      setLoading(false);
      setLoadingMore(false);
      setRows([]);
      setRowDisabled([]);
      rowsRef.current = [];
      disabledRef.current = [];
      setActiveIndex(-1);
      return;
    }
    setLoading(true);
    setError(undefined);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = undefined;
      void runQuery(false);
    }, searchDebounceMilliseconds);
  });

  const requestOpen = useStableCallback(async (reason: CgLookUpGridOpenReason, event?: Event | SyntheticEvent) => {
    if (field.disabled || field.readOnly || openRef.current) return;
    setSearchDirty(false);
    searchDirtyRef.current = false;
    setDraft(committedText);
    draftRef.current = committedText;
    setError(undefined);
    debounceOnNextOpenRef.current = false;
    setIsOpen(true);
    onOpenChange?.(true, { reason, event });
    queueMicrotask(() => {
      inputRef.current?.focus({ preventScroll: true });
      inputRef.current?.select();
    });
    if (open !== undefined) return;
    openRef.current = true;
    queryStartedForOpenRef.current = true;
    await runQuery(false);
  });

  const requestClose = useStableCallback(async (reason: CgLookUpGridCloseReason, event?: Event | SyntheticEvent, restore = true) => {
    if (!openRef.current) return;
    setIsOpen(false);
    onOpenChange?.(false, { reason, event });
    if (open !== undefined) return;
    cancelQuery();
    openRef.current = false;
    queryStartedForOpenRef.current = false;
    setSearchDirty(false);
    searchDirtyRef.current = false;
    if (restore) {
      setDraft(committedText);
      draftRef.current = committedText;
    }
    setActiveIndex(-1);
  });

  const emitValue = useStableCallback((
    nextValue: TValue | null,
    nextItem: TItem | null,
    reason: 'select' | 'clear' | 'reset',
    event?: Event | SyntheticEvent,
  ) => {
    const previousValue = valueRef.current;
    const previousItem = selectedRef.current;
    const details: CgLookUpGridValueChangeDetails<TItem, TValue> = {
      reason,
      previousValue,
      nextValue,
      previousSelectedItem: previousItem,
      nextSelectedItem: nextItem,
      event,
    };
    try {
      setCommittedValue(nextValue);
      valueRef.current = nextValue;
      if (!isEmptyValue(nextValue)) setInternalInvalid(false);
      if (controlledSelectedItem === undefined) setInternalSelectedItem(nextItem);
      setResolvedItem(nextItem);
      cacheRef.current = nextItem;
      onValueChange?.(nextValue, details);
      onSelectedItemChange?.(nextItem, details);
      if (reason === 'select' && nextItem !== null) onItemSelect?.(nextItem, { ...details, item: nextItem } satisfies CgLookUpGridItemSelectDetails<TItem, TValue>);
      if (reason === 'clear') onClear?.(details);
      if (value !== undefined) {
        queueMicrotask(() => {
          if (!mountedRef.current) return;
          const authoritative = controlledValueRef.current ?? null;
          const accepted = isEmptyValue(authoritative) === isEmptyValue(nextValue) && (
            isEmptyValue(authoritative) || isValueEqual(authoritative as TValue, nextValue as TValue)
          );
          if (accepted) return;
          valueRef.current = authoritative;
          const authoritativeItem = rowsRef.current.find((item) => valueMatches(item, authoritative))
            ?? (cacheRef.current && valueMatches(cacheRef.current, authoritative) ? cacheRef.current : null);
          cacheRef.current = authoritativeItem;
          setResolvedItem(authoritativeItem);
          if (controlledSelectedItem === undefined) setInternalSelectedItem(authoritativeItem);
          setDraft(authoritativeItem ? textSelectorStable(authoritativeItem) : isEmptyValue(authoritative) ? '' : String(authoritative));
        });
      }
    } catch (callbackError) {
      setCommittedValue(previousValue);
      valueRef.current = previousValue;
      if (controlledSelectedItem === undefined) setInternalSelectedItem(previousItem);
      setResolvedItem(previousItem);
      cacheRef.current = previousItem;
      setDraft(previousItem === null ? (isEmptyValue(previousValue) ? '' : String(previousValue)) : textSelectorStable(previousItem));
      console.error('CgLookUpGrid change callback failed; the proposed selection was rolled back.', callbackError);
    }
  });

  const selectRow = useStableCallback(async (index: number, event?: MouseEvent | KeyboardEvent, restoreFocus = true) => {
    const item = rowsRef.current[index];
    if (!item || disabledRef.current[index] || field.disabled || field.readOnly) return;
    await requestClose('select', event, false);
    const nextValue = valueSelectorStable(item);
    cacheRef.current = item;
    setDraft(textSelectorStable(item));
    emitValue(nextValue, item, 'select', event);
    if (restoreFocus) queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }));
  });

  const clear = useStableCallback(async (event?: Event | SyntheticEvent, reason: 'clear' | 'reset' = 'clear') => {
    if (reason === 'clear' && (field.disabled || field.readOnly || !clearable)) return;
    if (openRef.current) await requestClose('programmatic', event, false);
    resolverControllerRef.current?.abort();
    resolverAttemptsRef.current = [];
    cacheRef.current = null;
    setDraft('');
    emitValue(null, null, reason, event);
  });

  const setColumnFilter = useStableCallback(async (fieldId: string, nextValue?: string, reason: 'input' | 'action' = 'action', event?: Event | SyntheticEvent) => {
    const column = visibleColumns.find((candidate) => candidate.fieldId === fieldId && candidate.filterable !== false);
    if (!column) throw new Error(`CgLookUpGrid cannot filter unknown, hidden, or non-filterable field "${fieldId}".`);
    const previous = normalizeColumnFilters(filtersRef.current);
    const nextRaw = { ...filtersRef.current };
    if (nextValue === undefined || nextValue.trim() === '') delete nextRaw[fieldId];
    else nextRaw[fieldId] = nextValue;
    const next = normalizeColumnFilters(nextRaw);
    if (filtersEqual(previous, next)) {
      if (nextValue !== undefined && nextValue !== nextRaw[fieldId]) setRawFilters(nextRaw);
      return;
    }
    filtersRef.current = nextRaw;
    setRawFilters(nextRaw);
    onColumnFiltersChange?.(freezeFilters(next), {
      previousFilters: freezeFilters(previous),
      nextFilters: freezeFilters(next),
      reason,
      event,
    } satisfies CgLookUpGridColumnFiltersChangeDetails);
    if (openRef.current) scheduleQuery();
  });

  const clearColumnFilters = useStableCallback(async () => {
    const previous = normalizeColumnFilters(filtersRef.current);
    if (Object.keys(previous).length === 0) return;
    filtersRef.current = {};
    setRawFilters({});
    onColumnFiltersChange?.(Object.freeze({}), {
      previousFilters: freezeFilters(previous),
      nextFilters: Object.freeze({}),
      reason: 'action',
    });
    if (openRef.current) scheduleQuery();
  });

  const sortBy = useStableCallback(async (fieldId?: string, direction?: CgLookUpGridSortDirection, event?: Event | SyntheticEvent) => {
    let next: CgLookUpGridSort | null = null;
    if (fieldId !== undefined) {
      const column = sortableColumns.find((candidate) => candidate.fieldId === fieldId);
      if (!column || !allowSorting) throw new Error(`CgLookUpGrid cannot sort unknown, hidden, or non-sortable field "${fieldId}".`);
      if (direction !== undefined && direction !== 'ascending' && direction !== 'descending') {
        throw new Error('CgLookUpGrid sort direction must be "ascending" or "descending".');
      }
      next = Object.freeze({ fieldId, direction: direction ?? 'ascending' });
    }
    const previous = sortRef.current;
    if (previous?.fieldId === next?.fieldId && previous?.direction === next?.direction) return;
    sortRef.current = next;
    setSort(next);
    const column = next ? sortableColumns.find((candidate) => candidate.fieldId === next.fieldId) : undefined;
    setLiveMessage(next
      ? next.direction === 'ascending'
        ? labels.sortAscending(column?.title, next.fieldId)
        : labels.sortDescending(column?.title, next.fieldId)
      : labels.sortCleared);
    onSortChange?.(next, { previousSort: previous, nextSort: next, event } satisfies CgLookUpGridSortChangeDetails);
    if (openRef.current) await runQuery(false);
  });

  const cycleHeaderSort = useStableCallback(async (column: CgLookUpGridColumnDescriptor<TItem>, event: MouseEvent) => {
    const current = sortRef.current;
    if (current?.fieldId !== column.fieldId) await sortBy(column.fieldId, 'ascending', event);
    else if (current.direction === 'ascending') await sortBy(column.fieldId, 'descending', event);
    else await sortBy(undefined, undefined, event);
  });

  const cycleKeyboardSort = useStableCallback(async (forward: boolean, event: KeyboardEvent) => {
    if (!allowSorting || sortableColumns.length === 0) return;
    const states: Array<CgLookUpGridSort | null> = [null];
    for (const column of sortableColumns) {
      states.push({ fieldId: column.fieldId, direction: 'ascending' });
      states.push({ fieldId: column.fieldId, direction: 'descending' });
    }
    const current = sortRef.current;
    const index = states.findIndex((state) => state?.fieldId === current?.fieldId && state?.direction === current?.direction);
    const nextIndex = (Math.max(index, 0) + (forward ? 1 : states.length - 1)) % states.length;
    const next = states[nextIndex];
    await sortBy(next?.fieldId, next?.direction, event);
  });

  const hasMore = useCallback(() => {
    if (!allowPaging || loading || loadingMore) return false;
    const knownTotal = totalRef.current;
    return knownTotal !== undefined ? rowsRef.current.length < knownTotal : lastPageFullRef.current;
  }, [allowPaging, loading, loadingMore]);

  const reload = useStableCallback(async () => {
    resolverAttemptsRef.current = [];
    setResolverRevision((revision) => revision + 1);
    if (openRef.current) await runQuery(false);
  });

  const actions = useMemo<CgLookUpGridActions<TItem, TValue>>(() => ({
    open: () => requestOpen('programmatic'),
    close: () => requestClose('programmatic'),
    toggle: () => openRef.current ? requestClose('programmatic') : requestOpen('programmatic'),
    focus: () => inputRef.current?.focus({ preventScroll: true }),
    clear: () => clear(),
    reload,
    loadMore: async () => { if (hasMore()) await runQuery(true); },
    sortBy: (fieldId, direction) => sortBy(fieldId, direction),
    setColumnFilter: (fieldId, nextValue) => setColumnFilter(fieldId, nextValue),
    clearColumnFilters,
    getCurrentSort: () => sortRef.current,
    getColumnFilters: () => freezeFilters(normalizeColumnFilters(filtersRef.current)),
    getLoadedItems: () => [...rowsRef.current],
    getLoadedRowCount: () => rowsRef.current.length,
    getTotalCount: () => totalRef.current,
    hasMoreRows: hasMore,
  }), [clear, clearColumnFilters, hasMore, reload, requestClose, requestOpen, runQuery, setColumnFilter, sortBy]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  useEffect(() => {
    resolverControllerRef.current?.abort();
    const nextValue = committedValue;
    if (isEmptyValue(nextValue)) {
      setResolvedItem(null);
      if (controlledSelectedItem === undefined) setInternalSelectedItem(null);
      return;
    }
    const key = nextValue as TValue;
    const controlledMatch = controlledSelectedItem !== undefined && controlledSelectedItem !== null && valueMatches(controlledSelectedItem, nextValue)
      ? controlledSelectedItem
      : null;
    const cached = cacheRef.current && valueMatches(cacheRef.current, nextValue) ? cacheRef.current : null;
    const local = data?.find((item): item is TItem => item !== null && item !== undefined && valueMatches(item, nextValue)) ?? null;
    const loaded = rowsRef.current.find((item) => valueMatches(item, nextValue)) ?? null;
    const synchronous = controlledMatch ?? cached ?? local ?? loaded;
    if (synchronous) {
      setResolvedItem(synchronous);
      if (controlledSelectedItem === undefined) setInternalSelectedItem(synchronous);
      return;
    }
    setResolvedItem(null);
    if (controlledSelectedItem === undefined) setInternalSelectedItem(null);
    if (!resolverAvailable || resolverAttemptsRef.current.some((attempt) => isValueEqual(attempt, key))) return;
    resolverAttemptsRef.current.push(key);
    const controller = new AbortController();
    resolverControllerRef.current = controller;
    const generation = ++resolverGenerationRef.current;
    void Promise.resolve(resolverStable(key, { signal: controller.signal })).then(
      (item) => {
        if (!mountedRef.current || controller.signal.aborted || generation !== resolverGenerationRef.current || !isValueEqual(valueRef.current as TValue, key)) return;
        if (item !== null && item !== undefined && isValueEqual(valueSelectorStable(item), key)) {
          cacheRef.current = item;
          setResolvedItem(item);
          if (controlledSelectedItem === undefined) setInternalSelectedItem(item);
        }
      },
      (resolveError: unknown) => {
        if (!controller.signal.aborted && !isAbortError(resolveError)) {
          // Resolver failures intentionally retain the key and its string fallback.
        }
      },
    );
  }, [committedValue, controlledSelectedItem, data, isValueEqual, resolverAvailable, resolverRevision, valueMatches, resolverStable, valueSelectorStable]);

  useEffect(() => {
    const wasOpen = previousRenderedOpenRef.current;
    previousRenderedOpenRef.current = isOpen;
    openRef.current = isOpen;
    if (!isOpen) {
      queryStartedForOpenRef.current = false;
      debounceOnNextOpenRef.current = false;
      if (wasOpen) cancelQuery();
      if (wasOpen || searchDirtyRef.current) {
        setSearchDirty(false);
        searchDirtyRef.current = false;
        setDraft(committedText);
        draftRef.current = committedText;
        setActiveIndex(-1);
      }
      return;
    }
    if (!wasOpen && !searchDirtyRef.current) {
      setDraft(committedText);
      draftRef.current = committedText;
      queueMicrotask(() => inputRef.current?.select());
    }
    if (queryStartedForOpenRef.current) return;
    queryStartedForOpenRef.current = true;
    if (debounceOnNextOpenRef.current) {
      debounceOnNextOpenRef.current = false;
      scheduleQuery();
    } else {
      void runQuery(false);
    }
  }, [cancelQuery, committedText, isOpen, runQuery, scheduleQuery]);

  useEffect(() => {
    if (previousDataRef.current === data) return;
    previousDataRef.current = data;
    if (openRef.current) void runQuery(false);
  }, [data, runQuery]);

  useEffect(() => {
    const previous = previousContextRef.current;
    const next = queryContext as TContext;
    if (isQueryContextEqual(previous, next)) return;
    previousContextRef.current = next;
    if (openRef.current) void runQuery(false);
  }, [isQueryContextEqual, queryContext, runQuery]);

  useEffect(() => {
    const currentCapabilities = [String(allowSorting), ...visibleColumns.map((column) => `${column.fieldId}:${column.searchable !== false}:${column.filterable !== false}:${column.sortable !== false}`)];
    const previousCapabilities = previousColumnCapabilitiesRef.current;
    previousColumnCapabilitiesRef.current = currentCapabilities;
    if (previousCapabilities.length === currentCapabilities.length && previousCapabilities.every((signature, index) => signature === currentCapabilities[index])) return;
    const current = normalizeColumnFilters(filtersRef.current);
    const filterable = new Set(visibleColumns.filter((column) => column.filterable !== false).map((column) => column.fieldId));
    const removed = Object.keys(current).filter((fieldId) => !filterable.has(fieldId));
    if (removed.length > 0) {
      const next = { ...filtersRef.current };
      for (const fieldId of removed) delete next[fieldId];
      filtersRef.current = next;
      setRawFilters(next);
      const normalizedNext = normalizeColumnFilters(next);
      setLiveMessage(removed.map(labels.filterRemoved).join(' '));
      onColumnFiltersChange?.(freezeFilters(normalizedNext), {
        previousFilters: freezeFilters(current),
        nextFilters: freezeFilters(normalizedNext),
        reason: 'columnRemoved',
      });
    }
    const currentSort = sortRef.current;
    if (currentSort && (!allowSorting || !visibleColumns.some((column) => column.fieldId === currentSort.fieldId && column.sortable !== false))) {
      sortRef.current = null;
      setSort(null);
      setLiveMessage(labels.sortCleared);
      onSortChange?.(null, { previousSort: currentSort, nextSort: null });
    }
    if (openRef.current) void runQuery(false);
  }, [allowSorting, labels, onColumnFiltersChange, onSortChange, runQuery, visibleColumns]);

  useEffect(() => {
    const active = activeIndex >= 0 ? document.getElementById(`${baseId}-row-${activeIndex}`) : null;
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, baseId]);

  useEffect(() => {
    const proxy = formProxyRef.current;
    if (!proxy) return;
    proxy.setCustomValidity(field.required && isEmptyValue(committedValue) ? requiredErrorMessage : '');
    return () => proxy.setCustomValidity('');
  }, [committedValue, field.required, requiredErrorMessage]);

  const resetFromForm = useStableCallback(() => {
    setInternalInvalid(false);
    if (value === undefined) {
      const next = defaultValue;
      const item = data?.find((candidate): candidate is TItem => candidate !== null && candidate !== undefined && !isEmptyValue(next) && isValueEqual(valueSelectorStable(candidate), next as TValue)) ?? null;
      emitValue(next, item, 'reset');
    }
    if (openRef.current) void requestClose('reset');
  });
  useFormReset(formProxyRef, resetFromForm);

  useEffect(() => () => {
    mountedRef.current = false;
    cancelQuery();
    resolverControllerRef.current?.abort();
    resolverGenerationRef.current += 1;
  }, [cancelQuery]);

  const moveActive = (delta: number) => {
    if (rowsRef.current.length === 0) return;
    const requested = activeIndex < 0 ? (delta > 0 ? 0 : rowsRef.current.length - 1) : activeIndex + delta;
    const start = Math.max(0, Math.min(rowsRef.current.length - 1, requested));
    const found = findEnabled(disabledRef.current, start, delta > 0 ? 1 : -1);
    if (found >= 0) setActiveIndex(found);
  };

  const moveBoundary = (last: boolean) => setActiveIndex(findEnabled(disabledRef.current, last ? rowsRef.current.length - 1 : 0, last ? -1 : 1));

  const focusFirstFilter = () => {
    const input = popupRef.current?.querySelector<HTMLInputElement>('[data-cg-lookupgrid-filter]');
    input?.focus({ preventScroll: true });
    input?.select();
  };

  const focusAfterLookup = () => {
    if (typeof document === 'undefined') return;
    const focusable = [...document.querySelectorAll<HTMLElement>('button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
      .filter((element) => !popupRef.current?.contains(element) && element.offsetParent !== null);
    const index = focusable.indexOf(inputRef.current as HTMLElement);
    focusable[index + 1]?.focus({ preventScroll: true });
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly) return;
    const next = event.target.value;
    setDraft(next);
    draftRef.current = next;
    setSearchDirty(true);
    searchDirtyRef.current = true;
    const normalized = normalizeLookUpText(next);
    onSearchTextChange?.(normalized || null);
    if (!openRef.current) {
      setIsOpen(true);
      onOpenChange?.(true, { reason: 'typing', event });
      if (open !== undefined) {
        debounceOnNextOpenRef.current = true;
        return;
      }
      openRef.current = true;
      queryStartedForOpenRef.current = true;
    }
    scheduleQuery();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!field.disabled && !field.readOnly && openRef.current && activeIndex >= 0) void selectRow(activeIndex, event);
      onKeyDown?.(event);
      return;
    }
    if (!field.disabled && !field.readOnly) {
      if (event.ctrlKey && !event.altKey && !event.metaKey && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        void cycleKeyboardSort(event.key === 'ArrowDown', event);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (!openRef.current) void requestOpen('keyboard', event);
        else moveActive(1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (!openRef.current) void requestOpen('keyboard', event).then(() => moveBoundary(true));
        else moveActive(-1);
      } else if (openRef.current && event.key === 'PageDown') {
        event.preventDefault();
        moveActive(Math.min(pageSize, 10));
      } else if (openRef.current && event.key === 'PageUp') {
        event.preventDefault();
        moveActive(-Math.min(pageSize, 10));
      } else if (openRef.current && event.key === 'Home') {
        event.preventDefault();
        moveBoundary(false);
      } else if (openRef.current && event.key === 'End') {
        event.preventDefault();
        moveBoundary(true);
      } else if (openRef.current && event.key === 'Escape') {
        event.preventDefault();
        void requestClose('escape', event);
      } else if (openRef.current && event.key === 'Tab') {
        if (showFilterRow && filterableColumns.length > 0 && !event.shiftKey) {
          event.preventDefault();
          focusFirstFilter();
        } else if (activeIndex >= 0 && !disabledRef.current[activeIndex]) {
          void selectRow(activeIndex, event, false);
        } else {
          void requestClose('programmatic', event);
        }
      } else if (event.key === 'Backspace' && clearable && !isEmptyValue(valueRef.current) && (!searchDirtyRef.current || draftRef.current.length === 0)) {
        event.preventDefault();
        void clear(event);
      }
    }
    onKeyDown?.(event);
  };

  const handleFilterKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Enter') {
      event.preventDefault();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      void requestClose('escape', event).then(() => inputRef.current?.focus({ preventScroll: true }));
    } else if (event.key === 'Tab') {
      const inputs = [...(popupRef.current?.querySelectorAll<HTMLInputElement>('[data-cg-lookupgrid-filter]') ?? [])];
      if (event.shiftKey && index === 0) {
        event.preventDefault();
        inputRef.current?.focus({ preventScroll: true });
      } else if (!event.shiftKey && index === inputs.length - 1) {
        event.preventDefault();
        focusAfterLookup();
        void requestClose('programmatic', event, true);
      }
    }
  };

  const handleFlyoutOpenChange = (nextOpen: boolean, details: CgFlyoutOpenChangeDetails) => {
    if (!nextOpen && openRef.current) void requestClose(details.reason === 'outsideClick' ? 'outsideClick' : 'programmatic', details.event);
  };

  const formValues = useMemo(() => serializeFormValue(committedValue, name, serializeValue), [committedValue, name, serializeValue]);
  const nonDataRows = (showHeader ? 1 : 0) + (showFilterRow && filterableColumns.length > 0 ? 1 : 0);
  const ariaRowCount = (totalCount ?? rows.length) + nonDataRows;
  const activeRowId = isOpen && activeIndex >= 0 && !rowDisabled[activeIndex] ? `${baseId}-row-${activeIndex}` : undefined;
  const state: CgLookUpGridRenderState<TItem, TValue> = {
    items: rows,
    value: committedValue,
    selectedItem: actualSelectedItem,
    searchText: effectiveSearch || null,
    error,
    loading,
    loadingMore,
    retry: reload,
  };
  const popupMinWidth = controlRef.current?.offsetWidth;
  const canClear = clearable && !field.disabled && !field.readOnly && !isEmptyValue(committedValue);

  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection} data-density={density}>
      <InputShell
        ref={controlRef}
        end={(
          <>
            {canClear ? <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: labels.clearSelection, preventFocusLoss: true, onPress: ({ event }) => clear(event) }} value={committedValue} disabled={field.disabled} /> : null}
            <EditorButton descriptor={{ key: 'toggle', icon: 'chevron-down', ariaLabel: labels.toggleLookup, preventFocusLoss: true, disabled: field.readOnly, onPress: ({ event }) => openRef.current ? requestClose('programmatic', event) : requestOpen('toggleButton', event) }} value={committedValue} disabled={field.disabled} />
          </>
        )}
        size={size}
        validationState={effectiveValidation}
        disabled={field.disabled}
        readOnly={field.readOnly}
        className={cx(styles.control, className)}
        style={style}
        data-testid={testId}
        data-open={isOpen || undefined}
      >
        <input
          {...nativeProps}
          ref={ref}
          id={field.id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="grid"
          aria-expanded={isOpen}
          aria-controls={isOpen ? gridId : undefined}
          aria-activedescendant={activeRowId}
          aria-busy={loading || loadingMore || undefined}
          aria-disabled={field.disabled || undefined}
          aria-readonly={field.readOnly || undefined}
          aria-required={field.required || undefined}
          aria-invalid={effectiveValidation === 'error' || undefined}
          aria-label={field.ariaLabel}
          aria-labelledby={field.labelledBy}
          aria-describedby={field.describedBy}
          aria-errormessage={field.errorMessageId}
          autoComplete={autoComplete}
          form={form}
          value={inputText}
          placeholder={placeholder}
          disabled={field.disabled}
          readOnly={field.readOnly}
          onChange={handleInputChange}
          onClick={(event) => {
            onClick?.(event);
            if (!openRef.current) void requestOpen('editorClick', event);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={handleInputKeyDown}
        />
        {renderSelected && !isOpen && actualSelectedItem !== null && !isEmptyValue(committedValue) ? (
          <span className={styles.selectedTemplate} aria-hidden="true">
            {renderSelected({ item: actualSelectedItem, value: committedValue as TValue, text: committedText })}
          </span>
        ) : null}
      </InputShell>
      <select
        ref={formProxyRef}
        name={name}
        form={form}
        multiple
        hidden
        tabIndex={-1}
        aria-hidden="true"
        required={field.required}
        disabled={field.disabled}
        value={formValues}
        data-cg-lookupgrid-form-proxy=""
        onChange={() => undefined}
        onInvalid={(event: FormEvent<HTMLSelectElement>) => {
          setInternalInvalid(true);
          onInvalid?.(event);
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        {formValues.map((serialized) => <option key={serialized} value={serialized}>{serialized}</option>)}
      </select>
      <CgFlyout
        ref={popupRef}
        anchor={controlRef}
        open={isOpen}
        onOpenChange={handleFlyoutOpenChange}
        closeOnEscape={false}
        closeOnOutsideClick
        closeOnFocusLoss={false}
        returnFocusOnClose={false}
        matchAnchorWidth={false}
        width={dropDownWidth}
        height={dropDownHeight}
        minWidth={popupMinWidth}
        scrollable
        className={cx(styles.popup, popupClassName)}
        style={popupStyle}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            void requestClose('escape', event).then(() => inputRef.current?.focus({ preventScroll: true }));
          }
        }}
      >
        {belowMinimum ? (
          <div className={styles.status} role="status">{labels.minimumSearchLength(minimumSearchLength, effectiveSearch)}</div>
        ) : loading ? (
          renderLoading ? renderLoading(state) : <div className={cx(styles.status, styles.loading)} role="status">{labels.loading}</div>
        ) : error !== undefined ? (
          renderError ? renderError(state) : (
            <div className={cx(styles.status, styles.error)} role="alert">
              <span>{labels.searchError}</span>
              <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => void reload()}>{labels.retry}</button>
            </div>
          )
        ) : rows.length === 0 ? (
          renderNoData ? renderNoData(state) : <div className={styles.status} role="status">{labels.empty}</div>
        ) : null}

        <div
          id={gridId}
          className={styles.grid}
          role="grid"
          aria-busy={loading || loadingMore || undefined}
          aria-rowcount={ariaRowCount}
          style={{ '--cg-lookup-row-height': cssLength(rowHeight) } as React.CSSProperties}
        >
          {showHeader && visibleColumns.length > 0 ? (
            <div className={styles.header} role="row" aria-rowindex={1}>
              {visibleColumns.map((column) => {
                const current = sort?.fieldId === column.fieldId ? sort : null;
                const sortable = allowSorting && column.sortable !== false;
                return (
                  <div
                    key={column.fieldId}
                    className={styles.headerCell}
                    data-align={column.alignment ?? 'start'}
                    role="columnheader"
                    aria-label={titleText(column.title, column.fieldId)}
                    aria-sort={current?.direction ?? (sortable ? 'none' : undefined)}
                    style={{ width: column.width, minWidth: column.width }}
                  >
                    {sortable ? (
                      <button type="button" className={styles.sortButton} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={(event) => void cycleHeaderSort(column, event)}>
                        <span>{column.title}</span><span aria-hidden="true">{current?.direction === 'ascending' ? '▲' : current?.direction === 'descending' ? '▼' : ''}</span>
                      </button>
                    ) : column.title}
                  </div>
                );
              })}
            </div>
          ) : null}
          {showFilterRow && filterableColumns.length > 0 ? (
            <div className={styles.filterRow} role="row" aria-rowindex={showHeader ? 2 : 1}>
              {visibleColumns.map((column) => (
                <div key={column.fieldId} className={styles.filterCell} data-align={column.alignment ?? 'start'} role="gridcell" style={{ width: column.width, minWidth: column.width }}>
                  {column.filterable !== false ? (
                    <input
                      className={styles.filterInput}
                      type="text"
                      autoComplete="off"
                      aria-label={labels.columnFilter(column.title, column.fieldId)}
                      data-cg-lookupgrid-filter={column.fieldId}
                      value={rawFilters[column.fieldId] ?? ''}
                      onChange={(event) => void setColumnFilter(column.fieldId, event.target.value, 'input', event)}
                      onKeyDown={(event) => handleFilterKeyDown(event, filterableColumns.findIndex((candidate) => candidate.fieldId === column.fieldId))}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className={styles.body} role="rowgroup">
            {rows.map((item, rowIndex) => {
              const disabledRow = rowDisabled[rowIndex] ?? false;
              const selected = !isEmptyValue(committedValue) && valueMatches(item, committedValue);
              const active = activeIndex === rowIndex && !disabledRow;
              return (
                <div
                  key={rowIndex}
                  id={`${baseId}-row-${rowIndex}`}
                  className={styles.row}
                  data-active={active || undefined}
                  data-selected={selected || undefined}
                  data-disabled={disabledRow || undefined}
                  role="row"
                  aria-rowindex={rowIndex + nonDataRows + 1}
                  aria-selected={selected}
                  aria-disabled={disabledRow || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => { if (!disabledRow) void selectRow(rowIndex, event); }}
                >
                  {visibleColumns.map((column) => {
                    const cellValue = column.accessor?.(item);
                    const text = formatLookUpCell(column, item);
                    return (
                      <div key={column.fieldId} className={styles.cell} data-align={column.alignment ?? 'start'} role="gridcell" style={{ width: column.width, minWidth: column.width }}>
                        {column.renderCell ? column.renderCell({ item, value: cellValue, text, rowIndex, selected, active, disabled: disabledRow }) : text}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {(showResultCount && rows.length > 0) || hasMore() || onViewAllRequest || renderFooter ? (
          <div className={styles.footer}>
            {showResultCount && rows.length > 0 ? (
              <span className={styles.count} role="status">{totalCount === undefined ? labels.resultCountUnknown(rows.length) : labels.resultCount(rows.length, totalCount)}</span>
            ) : null}
            {hasMore() ? (
              <button type="button" tabIndex={-1} disabled={loadingMore} onMouseDown={(event) => event.preventDefault()} onClick={() => void runQuery(true)}>
                {loadingMore ? <span className={styles.spinner} aria-hidden="true" /> : null}{labels.loadMore}
              </button>
            ) : null}
            {onViewAllRequest ? (
              <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={(event) => {
                const searchText = effectiveSearch || null;
                void requestClose('viewAll', event).then(() => {
                  try {
                    onViewAllRequest(searchText, event);
                  } catch (callbackError) {
                    console.error('CgLookUpGrid onViewAllRequest callback failed.', callbackError);
                  }
                });
              }}>{labels.viewAll}</button>
            ) : null}
            {renderFooter?.(state, actions)}
          </div>
        ) : null}
      </CgFlyout>
      <div id={liveId} className={styles.visuallyHidden} role="status" aria-live="polite">{liveMessage}</div>
    </div>
  );
}

export const CgLookUpGrid = forwardRef(CgLookUpGridInner) as <TItem, TValue, TContext = unknown>(
  props: CgLookUpGridProps<TItem, TValue, TContext> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
