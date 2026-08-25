import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { useControllableState, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { useFieldControl } from '../../internal';
import { createListBoxTextFragments, listBoxKeyToken, listBoxTextMatches, normalizeListBoxSearch, toCssLength } from '../../internal/listBox';
import { assertNonNegative, assertNonNegativeInteger, assertPositive } from '../../internal/validation';
import { useVirtualWindow } from '../../internal/useVirtualWindow';
import { cx } from '../../utils';
import { CgCheckBox } from '../CheckBox';
import { CgSearchBox } from '../SearchBox';
import styles from './CgListBox.module.css';
import type {
  CgListBoxChangeReason,
  CgListBoxColumn,
  CgListBoxGroupRenderContext,
  CgListBoxItemClickDetails,
  CgListBoxItemRenderContext,
  CgListBoxProps,
  CgListBoxValueChangeDetails,
} from './CgListBox.types';

interface ItemRecord<TItem> {
  item: TItem;
  key: string | number;
  token: string;
  label: string;
  disabled: boolean;
  sourceIndex: number;
  visibleIndex: number;
}

type RenderRow<TItem> =
  | { kind: 'item'; key: string; record: ItemRecord<TItem> }
  | { kind: 'group'; key: string; context: CgListBoxGroupRenderContext<TItem> };

const emptyItems: readonly never[] = [];

function renderContent(content: ReactNode | (() => ReactNode)): ReactNode {
  return typeof content === 'function' ? content() : content;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toLocaleString();
  return '';
}

function accessibleText(value: ReactNode): string | undefined {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' ? String(value) : undefined;
}

function CgListBoxInner<TItem>(
  {
    items,
    value,
    defaultValue = emptyItems,
    onValueChange,
    getItemKey,
    getItemLabel,
    getItemSearchText = getItemLabel,
    isItemDisabled = () => false,
    filterItem = () => true,
    selectionMode = 'single',
    showCheckboxes = false,
    showSelectAll = false,
    selectAllText = 'Select all',
    selectAllAriaLabel = 'Select all visible items',
    searchable = false,
    searchQuery,
    defaultSearchQuery = '',
    onSearchQueryChange,
    searchDelay = 250,
    searchCondition = 'contains',
    searchParseMode = 'allWords',
    highlightSearchText = true,
    searchPlaceholder = 'Search…',
    searchAriaLabel = 'Search list',
    locale,
    ignoreDiacritics = true,
    getItemGroupKey,
    getGroupLabel = String,
    renderGroupHeader,
    columns = [],
    renderItem,
    renderEmpty,
    renderNoResults,
    renderLoading,
    loading = false,
    loadingMessage = 'Loading…',
    emptyMessage = 'No data',
    noResultsMessage = 'No matching items',
    resultsCountMessage = (count) => `${count} items`,
    selectedCountMessage = (count) => `${count} selected`,
    renderMode = 'entire',
    itemSize,
    overscanCount = 3,
    height,
    maxHeight,
    disabled,
    readOnly,
    required,
    size = 'medium',
    validationState = 'none',
    direction = 'auto',
    name,
    form,
    fullWidth = false,
    onItemClick,
    onInvalid,
    id,
    className,
    style,
    'data-testid': testId,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    onKeyDown,
    onFocus,
    ...nativeProps
  }: CgListBoxProps<TItem>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  assertNonNegative('searchDelay', searchDelay);
  assertNonNegativeInteger('overscanCount', overscanCount);
  if (itemSize !== undefined) assertPositive('itemSize', itemSize);
  if (showSelectAll && (selectionMode !== 'multiple' || !showCheckboxes)) {
    throw new Error('CgListBox showSelectAll requires multiple selection and showCheckboxes.');
  }

  const visibleColumns = useMemo(() => {
    const seen = new Set<string>();
    for (const column of columns) {
      if (!column.key.trim()) throw new Error('CgListBox column keys cannot be empty.');
      if (seen.has(column.key)) throw new Error(`CgListBox received duplicate column key ${column.key}.`);
      seen.add(column.key);
    }
    return columns.filter((column) => column.visible !== false);
  }, [columns]);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const listRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const ref = useMergedRefs(listRef, forwardedRef);
  const resolvedDirection = useDirection(listRef, direction);
  const [selected, setSelected] = useControllableState<ReadonlyArray<TItem>>(value, defaultValue, 'CgListBox');
  const [committedSearch, setCommittedSearch] = useControllableState(searchQuery, defaultSearchQuery, 'CgListBox searchQuery');
  const [searchDraft, setSearchDraft] = useState(committedSearch);
  const [activeToken, setActiveToken] = useState<string>();
  const [anchorToken, setAnchorToken] = useState<string>();
  const [internalInvalid, setInternalInvalid] = useState(false);
  const controlledSearchRef = useRef(searchQuery);

  const records = useMemo(() => {
    const seen = new Set<string>();
    return items.map((item, sourceIndex): ItemRecord<TItem> => {
      const key = getItemKey(item);
      const token = listBoxKeyToken(key);
      if (seen.has(token)) throw new Error(`CgListBox received duplicate item key ${String(key)}.`);
      seen.add(token);
      return { item, key, token, label: getItemLabel(item), disabled: isItemDisabled(item), sourceIndex, visibleIndex: -1 };
    });
  }, [getItemKey, getItemLabel, isItemDisabled, items]);
  const recordByToken = useMemo(() => new Map(records.map((record) => [record.token, record])), [records]);

  const normalizedSelection = useMemo(() => {
    const seen = new Set<string>();
    const result: TItem[] = [];
    for (const item of selected) {
      const token = listBoxKeyToken(getItemKey(item));
      if (seen.has(token)) continue;
      seen.add(token);
      result.push(recordByToken.get(token)?.item ?? item);
    }
    if (selectionMode === 'single' && result.length > 1) {
      throw new Error('CgListBox single selection accepts at most one selected item.');
    }
    return result;
  }, [getItemKey, recordByToken, selected, selectionMode]);
  const selectedTokens = useMemo(() => new Set(normalizedSelection.map((item) => listBoxKeyToken(getItemKey(item)))), [getItemKey, normalizedSelection]);

  useEffect(() => {
    if (value !== undefined) return;
    if (normalizedSelection.length !== selected.length || normalizedSelection.some((item, index) => item !== selected[index])) {
      setSelected(normalizedSelection);
    }
  }, [normalizedSelection, selected, setSelected, value]);
  useEffect(() => {
    if (searchQuery === undefined || controlledSearchRef.current === searchQuery) return;
    controlledSearchRef.current = searchQuery;
    setSearchDraft(searchQuery);
  }, [searchQuery]);

  const normalizedQuery = normalizeListBoxSearch(committedSearch, locale, ignoreDiacritics);
  const searchTerms = useMemo(() => normalizedQuery
    ? searchParseMode === 'exact' ? [normalizedQuery] : normalizedQuery.split(' ')
    : [], [normalizedQuery, searchParseMode]);
  const applicationRecords = useMemo(() => records.filter((record) => filterItem(record.item)), [filterItem, records]);
  const visibleRecords = useMemo(() => applicationRecords
    .filter((record) => {
      if (searchTerms.length === 0) return true;
      const texts = visibleColumns.length > 0
        ? visibleColumns.filter((column) => column.searchable !== false).map((column) => {
            const columnValue = column.getValue(record.item);
            return column.formatValue?.(columnValue, record.item) ?? displayValue(columnValue);
          })
        : [getItemSearchText(record.item)];
      const matches = (term: string) => texts.some((text) => listBoxTextMatches(text, term, searchCondition, locale, ignoreDiacritics));
      return searchParseMode === 'anyWord' ? searchTerms.some(matches) : searchTerms.every(matches);
    })
    .map((record, visibleIndex) => ({ ...record, visibleIndex })), [applicationRecords, getItemSearchText, ignoreDiacritics, locale, searchCondition, searchParseMode, searchTerms, visibleColumns]);

  const rows = useMemo((): ReadonlyArray<RenderRow<TItem>> => {
    if (!getItemGroupKey) return visibleRecords.map((record) => ({ kind: 'item', key: record.token, record }));
    const groups = new Map<string, { key: string | number; visible: ItemRecord<TItem>[]; total: ItemRecord<TItem>[] }>();
    for (const record of applicationRecords) {
      const key = getItemGroupKey(record.item);
      const token = listBoxKeyToken(key);
      const group = groups.get(token) ?? { key, visible: [], total: [] };
      group.total.push(record);
      groups.set(token, group);
    }
    for (const record of visibleRecords) groups.get(listBoxKeyToken(getItemGroupKey(record.item)))?.visible.push(record);
    const result: RenderRow<TItem>[] = [];
    for (const [token, group] of groups) {
      if (group.visible.length === 0) continue;
      result.push({
        kind: 'group',
        key: `group:${token}`,
        context: {
          key: group.key,
          label: getGroupLabel(group.key),
          visibleItems: group.visible.map((record) => record.item),
          totalItems: group.total.map((record) => record.item),
        },
      });
      result.push(...group.visible.map((record) => ({ kind: 'item' as const, key: record.token, record })));
    }
    return result;
  }, [applicationRecords, getGroupLabel, getItemGroupKey, visibleRecords]);

  const resolvedItemSize = itemSize ?? (size === 'small' ? 32 : size === 'large' ? 48 : 40);
  const virtual = useVirtualWindow(viewportRef, rows.length, resolvedItemSize, overscanCount, renderMode === 'virtual');
  const renderedRows = rows.slice(virtual.start, virtual.end);
  const activeRecord = activeToken ? visibleRecords.find((record) => record.token === activeToken) : undefined;
  const listboxId = field.id;
  const statusId = `${listboxId}-status`;
  const activeId = activeRecord ? `${listboxId}-option-${activeRecord.sourceIndex}` : undefined;
  const gridTemplate = visibleColumns.length > 0
    ? `${showCheckboxes ? '2rem ' : ''}${visibleColumns.map((column) => toCssLength(column.width, 'minmax(8rem, 1fr)')).join(' ')}`
    : undefined;

  const commitSearch = useStableCallback((next: string) => {
    setCommittedSearch(next);
    onSearchQueryChange?.(next);
    setActiveToken(undefined);
    setAnchorToken(undefined);
  });
  const commitSelection = useStableCallback((requested: ReadonlyArray<TItem>, reason: CgListBoxChangeReason, event?: Event | MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, force = false, emitUnchanged = false) => {
    if (!force && (field.disabled || field.readOnly)) return;
    const seen = new Set<string>();
    const next: TItem[] = [];
    for (const item of requested) {
      const token = listBoxKeyToken(getItemKey(item));
      if (seen.has(token)) continue;
      seen.add(token);
      next.push(recordByToken.get(token)?.item ?? item);
    }
    const normalized = selectionMode === 'single' && next.length > 1 ? [next.at(-1)!] : next;
    const previousTokens = normalizedSelection.map((item) => listBoxKeyToken(getItemKey(item)));
    const nextTokens = normalized.map((item) => listBoxKeyToken(getItemKey(item)));
    if (!emitUnchanged && previousTokens.length === nextTokens.length && previousTokens.every((token, index) => token === nextTokens[index])) return;
    const previousSet = new Set(previousTokens);
    const nextSet = new Set(nextTokens);
    const details: CgListBoxValueChangeDetails<TItem> = {
      reason,
      previousValue: normalizedSelection,
      addedItems: normalized.filter((item) => !previousSet.has(listBoxKeyToken(getItemKey(item)))),
      removedItems: normalizedSelection.filter((item) => !nextSet.has(listBoxKeyToken(getItemKey(item)))),
      event,
    };
    setSelected(normalized);
    setInternalInvalid(false);
    onValueChange?.(normalized, details);
  });

  const toggleRecord = (record: ItemRecord<TItem>) => {
    const next = normalizedSelection.filter((item) => listBoxKeyToken(getItemKey(item)) !== record.token);
    if (!selectedTokens.has(record.token)) next.push(record.item);
    return next;
  };
  const rangeRecords = (target: ItemRecord<TItem>, additive: boolean) => {
    const anchorIndex = anchorToken ? visibleRecords.findIndex((record) => record.token === anchorToken) : target.visibleIndex;
    const safeAnchor = anchorIndex < 0 ? target.visibleIndex : anchorIndex;
    const from = Math.min(safeAnchor, target.visibleIndex);
    const to = Math.max(safeAnchor, target.visibleIndex);
    const next = additive ? [...normalizedSelection] : [];
    const tokens = new Set(next.map((item) => listBoxKeyToken(getItemKey(item))));
    for (let index = from; index <= to; index += 1) {
      const record = visibleRecords[index];
      if (!record || record.disabled || tokens.has(record.token)) continue;
      tokens.add(record.token);
      next.push(record.item);
    }
    return next;
  };

  const selectAll = (event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    const next = [...normalizedSelection];
    const tokens = new Set(next.map((item) => listBoxKeyToken(getItemKey(item))));
    for (const record of visibleRecords) {
      if (!record.disabled && !tokens.has(record.token)) {
        tokens.add(record.token);
        next.push(record.item);
      }
    }
    commitSelection(next, 'selectAll', event);
  };
  const deselectAll = (event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    const visibleEnabled = new Set(visibleRecords.filter((record) => !record.disabled).map((record) => record.token));
    commitSelection(normalizedSelection.filter((item) => !visibleEnabled.has(listBoxKeyToken(getItemKey(item)))), 'deselectAll', event);
  };

  const handleItemClick = (record: ItemRecord<TItem>, event: MouseEvent<HTMLDivElement>) => {
    listRef.current?.focus({ preventScroll: true });
    const details: CgListBoxItemClickDetails<TItem> = {
      item: record.item,
      key: record.key,
      visibleIndex: record.visibleIndex,
      disabled: record.disabled,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      event,
    };
    if (!field.disabled && !record.disabled) {
      const ctrl = event.ctrlKey || event.metaKey;
      const shift = event.shiftKey;
      let next: ReadonlyArray<TItem>;
      if (shift && selectionMode === 'multiple') next = rangeRecords(record, ctrl);
      else if (selectionMode === 'single') next = selectedTokens.has(record.token) ? normalizedSelection : [record.item];
      else if (showCheckboxes || ctrl) next = toggleRecord(record);
      else next = [record.item];
      setActiveToken(record.token);
      if (!shift) setAnchorToken(record.token);
      commitSelection(next, 'pointer', event);
    }
    onItemClick?.(details);
  };

  const scrollRecordIntoView = useStableCallback((record: ItemRecord<TItem>) => {
    const rowIndex = rows.findIndex((row) => row.kind === 'item' && row.record.token === record.token);
    const viewport = viewportRef.current;
    if (renderMode === 'virtual' && viewport && rowIndex >= 0) {
      const top = rowIndex * resolvedItemSize;
      const bottom = top + resolvedItemSize;
      if (top < viewport.scrollTop) viewport.scrollTop = top;
      else if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = bottom - viewport.clientHeight;
      viewport.dispatchEvent(new Event('scroll'));
    }
    requestAnimationFrame(() => document.getElementById(`${listboxId}-option-${record.sourceIndex}`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }));
  });

  const navigate = (delta: number, event: KeyboardEvent<HTMLDivElement>) => {
    const enabledRecords = visibleRecords.filter((record) => !record.disabled);
    if (enabledRecords.length === 0) return;
    const current = activeToken ? enabledRecords.findIndex((record) => record.token === activeToken) : -1;
    let targetIndex: number;
    if (delta === Number.NEGATIVE_INFINITY) targetIndex = 0;
    else if (delta === Number.POSITIVE_INFINITY) targetIndex = enabledRecords.length - 1;
    else if (current < 0) targetIndex = delta < 0 ? enabledRecords.length - 1 : 0;
    else targetIndex = Math.max(0, Math.min(enabledRecords.length - 1, current + delta));
    const target = enabledRecords[targetIndex];
    if (!target) return;
    const extending = event.shiftKey && selectionMode === 'multiple';
    if (extending && !anchorToken && activeRecord) setAnchorToken(activeRecord.token);
    if (!extending) setAnchorToken(target.token);
    setActiveToken(target.token);
    if (selectionMode === 'single') commitSelection([target.item], 'keyboard', event);
    else if (extending) commitSelection(rangeRecords(target, event.ctrlKey || event.metaKey), 'keyboard', event);
    scrollRecordIntoView(target);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!field.disabled) {
      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.key.toLowerCase() === 'a' && selectionMode === 'multiple') {
        event.preventDefault();
        selectAll(event);
      } else if (event.key === 'Escape') {
        if (committedSearch) {
          event.preventDefault();
          setSearchDraft('');
          commitSearch('');
        } else setAnchorToken(undefined);
      } else {
        const pageSize = Math.max(1, Math.floor((viewportRef.current?.clientHeight ?? resolvedItemSize * 10) / resolvedItemSize));
        const delta = event.key === 'ArrowDown' ? 1
          : event.key === 'ArrowUp' ? -1
            : event.key === 'PageDown' ? pageSize
              : event.key === 'PageUp' ? -pageSize
                : event.key === 'Home' ? Number.NEGATIVE_INFINITY
                  : event.key === 'End' ? Number.POSITIVE_INFINITY
                    : 0;
        if (delta !== 0) {
          event.preventDefault();
          navigate(delta, event);
        } else if (event.key === ' ' || event.key === 'Enter') {
          const record = activeRecord;
          if (record && !record.disabled) {
            event.preventDefault();
            let next: ReadonlyArray<TItem>;
            if (selectionMode === 'single') next = selectedTokens.has(record.token) ? normalizedSelection : [record.item];
            else if (showCheckboxes || (ctrl && event.key === ' ')) next = toggleRecord(record);
            else next = [record.item];
            if (!anchorToken) setAnchorToken(record.token);
            commitSelection(next, 'keyboard', event);
          }
        }
      }
    }
    onKeyDown?.(event);
  };

  useFormReset(formProxyRef, () => {
    const nextSelection = value !== undefined ? value : defaultValue;
    const nextSearch = searchQuery !== undefined ? searchQuery : defaultSearchQuery;
    setSearchDraft(nextSearch);
    setCommittedSearch(nextSearch);
    setActiveToken(undefined);
    setAnchorToken(undefined);
    if (value === undefined) commitSelection(nextSelection, 'reset', undefined, true, true);
    if (searchQuery === undefined) onSearchQueryChange?.(nextSearch);
  });
  useLayoutEffect(() => {
    const proxy = formProxyRef.current;
    if (proxy) proxy.setCustomValidity(field.required && normalizedSelection.length === 0 ? 'Please select at least one item.' : '');
  }, [field.required, normalizedSelection.length]);
  const selectableVisible = visibleRecords.filter((record) => !record.disabled);
  const selectedVisibleCount = selectableVisible.filter((record) => selectedTokens.has(record.token)).length;
  const selectAllState = selectedVisibleCount === 0 ? false : selectedVisibleCount === selectableVisible.length ? true : 'indeterminate';
  const rootStyle = {
    ...style,
    '--cg-listbox-height': toCssLength(height, 'auto'),
    '--cg-listbox-max-height': toCssLength(maxHeight, '20rem'),
    '--cg-listbox-item-size': `${resolvedItemSize}px`,
  } as CSSProperties;
  const status = loading
    ? (renderLoading ? renderContent(renderLoading) : <><span className={styles.spinner} aria-hidden="true" />{loadingMessage}</>)
    : records.length === 0
      ? (renderEmpty ? renderContent(renderEmpty) : emptyMessage)
      : visibleRecords.length === 0
        ? (renderNoResults ? typeof renderNoResults === 'function' ? renderNoResults(committedSearch) : renderNoResults : noResultsMessage)
        : null;
  const labelledBy = ariaLabelledBy ?? (ariaLabel ? undefined : field.labelId);
  const renderFragments = (fragments: ReturnType<typeof createListBoxTextFragments>) => fragments.map((fragment, index) => fragment.isMatch
    ? <mark key={index}>{fragment.text}</mark>
    : <span key={index}>{fragment.text}</span>);

  const renderRow = (row: RenderRow<TItem>) => {
    if (row.kind === 'group') {
      return (
        <div key={row.key} className={styles.group} role="separator" aria-label={row.context.label} style={renderMode === 'virtual' ? { height: resolvedItemSize } : undefined}>
          {renderGroupHeader ? renderGroupHeader(row.context) : <><span>{row.context.label}</span><span className={styles.groupCount}>{row.context.visibleItems.length}</span></>}
        </div>
      );
    }
    const { record } = row;
    const selectedRecord = selectedTokens.has(record.token);
    const active = activeToken === record.token;
    const highlightedLabel = highlightSearchText
      ? createListBoxTextFragments(record.label, searchTerms, searchCondition, locale, ignoreDiacritics)
      : [{ text: record.label, isMatch: false }];
    const itemContext: CgListBoxItemRenderContext<TItem> = {
      item: record.item,
      key: record.key,
      label: record.label,
      sourceIndex: record.sourceIndex,
      visibleIndex: record.visibleIndex,
      selected: selectedRecord,
      active,
      disabled: record.disabled,
      searchQuery: committedSearch,
      highlightedLabel,
    };
    return (
      <div
        key={row.key}
        id={`${listboxId}-option-${record.sourceIndex}`}
        className={styles.option}
        role="option"
        aria-label={record.label}
        aria-selected={selectedRecord}
        aria-disabled={record.disabled || undefined}
        data-selected={selectedRecord || undefined}
        data-active={active || undefined}
        data-disabled={record.disabled || undefined}
        data-visible-index={record.visibleIndex}
        style={{ gridTemplateColumns: gridTemplate, ...(renderMode === 'virtual' ? { height: resolvedItemSize } : null) }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => handleItemClick(record, event)}
      >
        {showCheckboxes ? <span className={styles.optionCheck} aria-hidden="true"><CgCheckBox checked={selectedRecord} readOnly tabIndex={-1} aria-hidden="true" /></span> : null}
        {renderItem ? renderItem(itemContext) : visibleColumns.length > 0 ? visibleColumns.map((column: CgListBoxColumn<TItem>) => {
          const cellValue = column.getValue(record.item);
          const text = column.formatValue?.(cellValue, record.item) ?? displayValue(cellValue);
          const fragments = highlightSearchText && column.searchable !== false
            ? createListBoxTextFragments(text, searchTerms, searchCondition, locale, ignoreDiacritics)
            : [{ text, isMatch: false }];
          return (
            <span key={column.key} className={styles.cell} data-align={column.alignment ?? 'start'} style={{ minWidth: toCssLength(column.minWidth, '0') }}>
              {column.renderCell ? column.renderCell({ item: record.item, value: cellValue, displayText: text, sourceIndex: record.sourceIndex, visibleIndex: record.visibleIndex, selected: selectedRecord, active, highlightedText: fragments }) : renderFragments(fragments)}
            </span>
          );
        }) : <span className={styles.label}>{renderFragments(highlightedLabel)}</span>}
      </div>
    );
  };

  return (
    <div className={cx(styles.root, styles[size], fullWidth && styles.fullWidth, className)} style={rootStyle} dir={resolvedDirection} data-disabled={field.disabled || undefined} data-readonly={field.readOnly || undefined} data-validation={field.validationState} data-testid={testId}>
      {searchable ? (
        <CgSearchBox
          query={searchDraft}
          onQueryChange={setSearchDraft}
          onSearch={(next) => commitSearch(next)}
          searchMode="debounced"
          searchDelay={searchDelay}
          escapeClears
          searchOnClear
          disabled={field.disabled}
          readOnly={field.readOnly}
          size={size}
          placeholder={searchPlaceholder}
          searchAriaLabel={searchAriaLabel}
          aria-label={searchAriaLabel}
          resultStatus={accessibleText(resultsCountMessage(visibleRecords.length))}
        />
      ) : null}
      {showSelectAll ? (
        <div className={styles.selectAll}>
          <CgCheckBox
            checked={selectAllState}
            onCheckedChange={(next, event) => { if (next === true) selectAll(event as unknown as MouseEvent<HTMLElement>); else deselectAll(event as unknown as MouseEvent<HTMLElement>); }}
            label={selectAllText}
            aria-label={selectAllAriaLabel}
            disabled={field.disabled || selectableVisible.length === 0}
            readOnly={field.readOnly}
            size={size}
          />
          <span>{selectedCountMessage(normalizedSelection.length)}</span>
        </div>
      ) : null}
      <div ref={viewportRef} className={styles.viewport}>
        {visibleColumns.length > 0 && !loading ? (
          <div className={styles.header} role="presentation" style={{ gridTemplateColumns: gridTemplate }}>
            {showCheckboxes ? <span aria-hidden="true" /> : null}
            {visibleColumns.map((column) => <span key={column.key} className={styles.headerCell} data-align={column.alignment ?? 'start'} style={{ minWidth: toCssLength(column.minWidth, '0') }}>{column.header ?? column.key}</span>)}
          </div>
        ) : null}
        <div
          {...nativeProps}
          ref={ref}
          id={listboxId}
          className={styles.listbox}
          role="listbox"
          tabIndex={field.disabled ? -1 : 0}
          aria-label={ariaLabel ?? (labelledBy ? undefined : 'List box')}
          aria-labelledby={labelledBy}
          aria-describedby={field.describedBy}
          aria-errormessage={field.errorMessageId}
          aria-disabled={field.disabled || undefined}
          aria-readonly={field.readOnly || undefined}
          aria-required={field.required || undefined}
          aria-invalid={field.validationState === 'error' || internalInvalid || undefined}
          aria-multiselectable={selectionMode === 'multiple' || undefined}
          aria-activedescendant={activeId}
          aria-busy={loading || undefined}
          onFocus={(event) => {
            if (!field.disabled && !activeRecord) {
              const first = visibleRecords.find((record) => !record.disabled);
              if (first) setActiveToken(first.token);
            }
            onFocus?.(event);
          }}
          onKeyDown={handleKeyDown}
        >
          {virtual.paddingBefore > 0 ? <div role="presentation" style={{ height: virtual.paddingBefore }} /> : null}
          {!loading ? renderedRows.map(renderRow) : null}
          {virtual.paddingAfter > 0 ? <div role="presentation" style={{ height: virtual.paddingAfter }} /> : null}
        </div>
      </div>
      {status !== null ? <div id={statusId} className={styles.state} role={loading ? 'status' : undefined}>{status}</div> : null}
      <span id={`${statusId}-live`} className={styles.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{resultsCountMessage(visibleRecords.length)}. {selectedCountMessage(normalizedSelection.length)}.</span>
      <select
        ref={formProxyRef}
        className={styles.formProxy}
        name={name}
        form={form}
        multiple
        required={field.required}
        disabled={field.disabled}
        value={normalizedSelection.map((item) => String(getItemKey(item)))}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-cg-listbox-form-proxy=""
        onChange={() => undefined}
        onInvalid={(event) => {
          setInternalInvalid(true);
          onInvalid?.(event);
          event.preventDefault();
          listRef.current?.focus({ preventScroll: true });
        }}
      >
        {normalizedSelection.map((item) => {
          const key = getItemKey(item);
          return <option key={listBoxKeyToken(key)} value={String(key)}>{getItemLabel(item)}</option>;
        })}
      </select>
    </div>
  );
}

export const CgListBox = forwardRef(CgListBoxInner) as <TItem>(
  props: CgListBoxProps<TItem> & React.RefAttributes<HTMLDivElement>,
) => React.ReactElement;
