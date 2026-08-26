import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent, KeyboardEvent, MouseEvent } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDebouncedCallback, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, normalizeTagBoxSearch, tagBoxKeyToken, tagBoxTextMatches, useFieldControl, useOverlayStack } from '../../internal';
import { assertNonNegative, assertPositiveInteger } from '../../internal/validation';
import { cx } from '../../utils';
import styles from './CgTagBox.module.css';
import type { CgTagBoxChangeReason, CgTagBoxProps, CgTagBoxValueChangeDetails } from './CgTagBox.types';

function joinIds(...values: Array<string | undefined | false>): string | undefined {
  const ids = values.flatMap((value) => typeof value === 'string' ? value.split(/\s+/u) : []).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)].join(' ') : undefined;
}

function sameItems<TItem>(left: ReadonlyArray<TItem>, right: ReadonlyArray<TItem>): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function CgTagBoxInner<TItem>(
  {
    options,
    loadOptions,
    value,
    defaultValue = [],
    onValueChange,
    getOptionLabel,
    getOptionKey,
    getOptionSearchText = getOptionLabel,
    isOptionDisabled,
    renderOption,
    renderTag,
    searchQuery,
    defaultSearchQuery = '',
    onSearchQueryChange,
    searchMode = 'contains',
    locale,
    ignoreDiacritics = true,
    searchDelay = 250,
    minimumSearchLength = 0,
    maxVisibleItems = 50,
    maxSelectedItems,
    loadingMessage = 'Loading…',
    errorMessage = 'Unable to load results.',
    emptyMessage = 'No results found',
    minimumLengthMessage = (minimum) => `Type at least ${minimum} characters to search.`,
    selectedCountMessage = (count) => `${count} selected`,
    resultsCountMessage = (count) => `${count} result${count === 1 ? '' : 's'}`,
    clearable = true,
    closeOnSelection = false,
    clearAriaLabel = 'Clear all selections',
    toggleAriaLabel = 'Toggle options',
    removeAriaLabel = (_item, label) => `Remove ${label}`,
    disabled,
    readOnly = false,
    required,
    size = 'medium',
    validationState = 'none',
    fullWidth = false,
    direction = 'auto',
    name,
    form,
    onChange,
    onInvalid,
    onOptionSelected,
    onOptionRemoved,
    onCleared,
    onOpenChange,
    id,
    className,
    style,
    'data-testid': testId,
    'aria-describedby': ariaDescribedBy,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    onFocus,
    onBlur,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    autoComplete = 'off',
    placeholder = 'Select…',
    ...nativeProps
  }: CgTagBoxProps<TItem>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  assertNonNegative('searchDelay', searchDelay);
  assertNonNegative('minimumSearchLength', minimumSearchLength);
  assertPositiveInteger('maxVisibleItems', maxVisibleItems);
  if (maxSelectedItems !== undefined) assertPositiveInteger('maxSelectedItems', maxSelectedItems);
  if ((options === undefined) === (loadOptions === undefined)) {
    throw new Error('CgTagBox requires exactly one of options or loadOptions.');
  }

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const formProxyRef = useRef<HTMLSelectElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const listboxId = `${useCgId(field.id)}-listbox`;
  const statusId = `${listboxId}-status`;
  const liveId = `${listboxId}-live`;
  const resolvedDirection = useDirection(inputRef, direction);
  const [selected, setSelected] = useControllableState<ReadonlyArray<TItem>>(value, defaultValue, 'CgTagBox');
  const [query, setQuery] = useControllableState(searchQuery, defaultSearchQuery, 'CgTagBox searchQuery');
  const [draft, setDraft] = useState(query);
  const [open, setOpenState] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteItems, setRemoteItems] = useState<ReadonlyArray<TItem>>([]);
  const [loadError, setLoadError] = useState<unknown>();
  const [internalInvalid, setInternalInvalid] = useState(false);
  const selectedRef = useRef<ReadonlyArray<TItem>>(selected);
  const controlledValueRef = useRef(value);
  const queryRef = useRef(query);
  const openRef = useRef(false);
  const composingRef = useRef(false);
  const pendingQueryRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const asyncOperation = useAsyncOperation();

  const validateSourceItems = useCallback((items: ReadonlyArray<TItem>) => {
    const seen = new Set<string>();
    const result: TItem[] = [];
    for (const item of items) {
      if (item === null || item === undefined) continue;
      const key = getOptionKey(item);
      const token = tagBoxKeyToken(key);
      if (seen.has(token)) throw new Error(`CgTagBox received duplicate option key ${String(key)}.`);
      seen.add(token);
      result.push(item);
    }
    return result;
  }, [getOptionKey]);

  const localItems = useMemo(() => validateSourceItems(options ?? []), [options, validateSourceItems]);
  const sourceItems = loadOptions ? remoteItems : localItems;
  const sourceByToken = useMemo(() => new Map(sourceItems.map((item) => [tagBoxKeyToken(getOptionKey(item)), item])), [getOptionKey, sourceItems]);
  const normalizedSelection = useMemo(() => {
    const seen = new Set<string>();
    const result: TItem[] = [];
    for (const item of selected) {
      if (item === null || item === undefined) continue;
      const token = tagBoxKeyToken(getOptionKey(item));
      if (seen.has(token)) continue;
      seen.add(token);
      result.push(sourceByToken.get(token) ?? item);
    }
    return result;
  }, [getOptionKey, selected, sourceByToken]);
  const selectedTokens = useMemo(() => new Set(normalizedSelection.map((item) => tagBoxKeyToken(getOptionKey(item)))), [getOptionKey, normalizedSelection]);

  useLayoutEffect(() => {
    selectedRef.current = normalizedSelection;
    controlledValueRef.current = value;
    queryRef.current = query;
  }, [normalizedSelection, query, value]);

  useEffect(() => {
    if (value !== undefined || sameItems(selected, normalizedSelection)) return;
    setSelected(normalizedSelection);
  }, [normalizedSelection, selected, setSelected, value]);

  useEffect(() => {
    if (composingRef.current) pendingQueryRef.current = query;
    else setDraft(query);
  }, [query]);

  const filteredItems = useMemo(() => {
    if (loadOptions) return sourceItems.slice(0, maxVisibleItems);
    const normalizedQuery = normalizeTagBoxSearch(draft, locale, ignoreDiacritics);
    if (!normalizedQuery) return sourceItems.slice(0, maxVisibleItems);
    return sourceItems
      .filter((item) => tagBoxTextMatches(getOptionSearchText(item) ?? '', normalizedQuery, searchMode, locale, ignoreDiacritics))
      .slice(0, maxVisibleItems);
  }, [draft, getOptionSearchText, ignoreDiacritics, loadOptions, locale, maxVisibleItems, searchMode, sourceItems]);

  const optionIsDisabled = useCallback((item: TItem) => {
    if (isOptionDisabled?.(item)) return true;
    const selectedOption = selectedTokens.has(tagBoxKeyToken(getOptionKey(item)));
    return !selectedOption && maxSelectedItems !== undefined && normalizedSelection.length >= maxSelectedItems;
  }, [getOptionKey, isOptionDisabled, maxSelectedItems, normalizedSelection.length, selectedTokens]);

  const firstEnabledIndex = useCallback((fromEnd = false) => {
    if (fromEnd) {
      for (let index = filteredItems.length - 1; index >= 0; index -= 1) {
        if (!optionIsDisabled(filteredItems[index]!)) return index;
      }
      return -1;
    }
    return filteredItems.findIndex((item) => !optionIsDisabled(item));
  }, [filteredItems, optionIsDisabled]);

  const setPopupOpen = useStableCallback((next: boolean) => {
    if (openRef.current === next) return;
    openRef.current = next;
    setOpenState(next);
    onOpenChange?.(next);
  });

  const cancelRemote = useStableCallback(() => {
    asyncOperation.cancel();
    setLoadError(undefined);
  });

  const runRemote = useStableCallback((rawQuery: string) => {
    if (!loadOptions) return;
    const trimmed = rawQuery.trim();
    if (trimmed.length < minimumSearchLength) {
      cancelRemote();
      setRemoteItems([]);
      return;
    }
    setLoadError(undefined);
    let requestId = 0;
    let requestSignal: AbortSignal | undefined;
    void asyncOperation.run(async ({ signal, generation }) => {
      requestId = generation;
      requestSignal = signal;
      const items = await loadOptions(trimmed, { signal, requestId: generation });
      return { generation, signal, items };
    }).then(
      ({ generation, signal, items }) => {
        if (signal.aborted || generation !== asyncOperation.generationRef.current) return;
        try {
          setRemoteItems(validateSourceItems(items).slice(0, maxVisibleItems));
          setLoadError(undefined);
          setActiveIndex(-1);
        } catch (error) {
          setRemoteItems([]);
          setLoadError(error);
        }
      },
      (error: unknown) => {
        if (requestSignal?.aborted || requestId !== asyncOperation.generationRef.current) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRemoteItems([]);
        setLoadError(error);
      },
    );
  });
  const debouncedRemote = useDebouncedCallback(runRemote, searchDelay);

  const scheduleRemote = useStableCallback((rawQuery: string) => {
    if (!loadOptions) return;
    if (rawQuery.trim().length < minimumSearchLength) {
      debouncedRemote.cancel();
      cancelRemote();
      setRemoteItems([]);
      return;
    }
    debouncedRemote.schedule(rawQuery);
  });

  const closePopup = useStableCallback(() => {
    debouncedRemote.cancel();
    cancelRemote();
    setPopupOpen(false);
    setActiveIndex(-1);
    if (loadOptions) setRemoteItems([]);
  });
  const overlay = useOverlayStack(open, closePopup, popupRef, closePopup, controlRef);

  const beginOpen = useStableCallback((fromEnd = false) => {
    if (field.disabled || field.readOnly) return;
    setLoadError(undefined);
    setActiveIndex(fromEnd ? firstEnabledIndex(true) : firstEnabledIndex());
    setPopupOpen(true);
    if (loadOptions) scheduleRemote(draft);
  });

  const commitQuery = useStableCallback((next: string, event?: ChangeEvent<HTMLInputElement>, notify = true) => {
    const previous = queryRef.current;
    setDraft(next);
    setQuery(next);
    if (searchQuery === undefined) queryRef.current = next;
    if (notify && previous !== next) onSearchQueryChange?.(next, event);
  });

  const handleQueryChange = useStableCallback((next: string, event?: ChangeEvent<HTMLInputElement>) => {
    commitQuery(next, event);
    setActiveIndex(-1);
    setLoadError(undefined);
    setPopupOpen(true);
    if (loadOptions) scheduleRemote(next);
  });

  const commitSelection = useStableCallback((
    proposed: ReadonlyArray<TItem>,
    reason: CgTagBoxChangeReason,
    event?: Event | MouseEvent<HTMLElement> | KeyboardEvent<HTMLInputElement>,
  ) => {
    const previous = selectedRef.current;
    const seen = new Set<string>();
    const next: TItem[] = [];
    for (const item of proposed) {
      const token = tagBoxKeyToken(getOptionKey(item));
      if (seen.has(token)) continue;
      seen.add(token);
      next.push(sourceByToken.get(token) ?? item);
    }
    const previousTokens = new Set(previous.map((item) => tagBoxKeyToken(getOptionKey(item))));
    const nextTokens = new Set(next.map((item) => tagBoxKeyToken(getOptionKey(item))));
    const addedItems = next.filter((item) => !previousTokens.has(tagBoxKeyToken(getOptionKey(item))));
    const removedItems = previous.filter((item) => !nextTokens.has(tagBoxKeyToken(getOptionKey(item))));
    if (addedItems.length === 0 && removedItems.length === 0) return undefined;
    setSelected(next);
    if (value === undefined) selectedRef.current = next;
    if (next.length > 0) setInternalInvalid(false);
    onValueChange?.(next, { reason, previousValue: previous, addedItems, removedItems, event } satisfies CgTagBoxValueChangeDetails<TItem>);
    return { next, addedItems, removedItems } as const;
  });

  const restoreRejectedSelection = useStableCallback((proposed: ReadonlyArray<TItem>, previousQuery: string) => {
    if (value === undefined) return;
    const proposedSignature = JSON.stringify(proposed.map((item) => tagBoxKeyToken(getOptionKey(item))));
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      const authoritative = controlledValueRef.current ?? [];
      const authoritativeSignature = JSON.stringify(authoritative.map((item) => tagBoxKeyToken(getOptionKey(item))));
      if (authoritativeSignature === proposedSignature) return;
      setDraft(previousQuery);
      if (searchQuery === undefined) {
        setQuery(previousQuery);
        queryRef.current = previousQuery;
      }
      if (openRef.current && loadOptions) scheduleRemote(previousQuery);
    });
  });

  const refreshAfterOptionToggle = useStableCallback((previousQuery: string, proposed: ReadonlyArray<TItem>) => {
    commitQuery('');
    if (closeOnSelection) closePopup();
    else {
      setPopupOpen(true);
      setActiveIndex(-1);
      if (loadOptions) {
        setRemoteItems([]);
        scheduleRemote('');
      }
    }
    restoreRejectedSelection(proposed, previousQuery);
    inputRef.current?.focus({ preventScroll: true });
  });

  const toggleOption = useStableCallback((item: TItem, event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly || optionIsDisabled(item)) return;
    const token = tagBoxKeyToken(getOptionKey(item));
    const selectedOption = selectedTokens.has(token);
    const proposed = selectedOption
      ? selectedRef.current.filter((current) => tagBoxKeyToken(getOptionKey(current)) !== token)
      : [...selectedRef.current, item];
    const result = commitSelection(proposed, selectedOption ? 'remove' : 'select', event);
    if (!result) return;
    if (selectedOption) onOptionRemoved?.(item);
    else onOptionSelected?.(item);
    refreshAfterOptionToggle(draft, result.next);
  });

  const removeItem = useStableCallback((item: TItem, reason: 'remove' | 'backspace', event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly) return;
    const token = tagBoxKeyToken(getOptionKey(item));
    const result = commitSelection(selectedRef.current.filter((current) => tagBoxKeyToken(getOptionKey(current)) !== token), reason, event);
    if (!result) return;
    onOptionRemoved?.(item);
    inputRef.current?.focus({ preventScroll: true });
  });

  const clearSelection = useStableCallback((event?: MouseEvent<HTMLElement>) => {
    if (field.disabled || field.readOnly || !clearable || selectedRef.current.length === 0) return;
    const previousQuery = draft;
    const result = commitSelection([], 'clear', event);
    if (!result) return;
    commitQuery('');
    onCleared?.();
    setActiveIndex(-1);
    setPopupOpen(true);
    if (loadOptions) {
      setRemoteItems([]);
      scheduleRemote('');
    }
    restoreRejectedSelection([], previousQuery);
    inputRef.current?.focus({ preventScroll: true });
  });

  useFormReset(formProxyRef, () => {
    debouncedRemote.cancel();
    cancelRemote();
    setPopupOpen(false);
    setActiveIndex(-1);
    setRemoteItems([]);
    setLoadError(undefined);
    setInternalInvalid(false);
    const nextSelection = value !== undefined ? value : defaultValue;
    if (value === undefined) commitSelection(nextSelection, 'reset');
    const nextQuery = searchQuery !== undefined ? searchQuery : defaultSearchQuery;
    commitQuery(nextQuery, undefined, searchQuery === undefined && queryRef.current !== nextQuery);
  });

  useEffect(() => {
    if (!field.disabled && !field.readOnly) return;
    closePopup();
  }, [closePopup, field.disabled, field.readOnly]);

  const activeItem = filteredItems[activeIndex];
  const effectiveActiveIndex = open && activeItem && !optionIsDisabled(activeItem)
    ? activeIndex
    : (open ? firstEnabledIndex() : -1);

  useEffect(() => {
    if (!open || effectiveActiveIndex < 0) return;
    document.getElementById(`${listboxId}-option-${effectiveActiveIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [effectiveActiveIndex, listboxId, open]);

  useEffect(() => {
    const proxy = formProxyRef.current;
    if (!proxy) return;
    proxy.setCustomValidity(field.required && normalizedSelection.length === 0 ? 'Please select at least one item.' : '');
    return () => proxy.setCustomValidity('');
  }, [field.required, normalizedSelection.length]);

  useEffect(() => () => {
    mountedRef.current = false;
    debouncedRemote.cancel();
  }, [debouncedRemote]);

  const moveActive = (delta: 1 | -1) => {
    if (filteredItems.length === 0) return;
    let index = effectiveActiveIndex;
    for (let attempts = 0; attempts < filteredItems.length; attempts += 1) {
      index = index < 0
        ? (delta > 0 ? 0 : filteredItems.length - 1)
        : Math.max(0, Math.min(filteredItems.length - 1, index + delta));
      const item = filteredItems[index];
      if (item && !optionIsDisabled(item)) {
        setActiveIndex(index);
        return;
      }
      if (index === 0 && delta < 0) return;
      if (index === filteredItems.length - 1 && delta > 0) return;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly) {
      onKeyDown?.(event);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) beginOpen(event.key === 'ArrowUp');
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex());
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(firstEnabledIndex(true));
    } else if (event.key === 'Enter' && open) {
      const item = filteredItems[effectiveActiveIndex];
      if (item && !optionIsDisabled(item)) {
        event.preventDefault();
        toggleOption(item, event);
      }
    } else if (event.key === 'Backspace' && draft.length === 0 && normalizedSelection.length > 0) {
      event.preventDefault();
      removeItem(normalizedSelection.at(-1)!, 'backspace', event);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closePopup();
    } else if (event.key === 'Tab' && open) {
      closePopup();
    }
    onKeyDown?.(event);
  };

  const belowMinimum = Boolean(loadOptions && draft.trim().length < minimumSearchLength);
  const status = belowMinimum
    ? typeof minimumLengthMessage === 'function' ? minimumLengthMessage(minimumSearchLength, draft) : minimumLengthMessage
    : asyncOperation.pending
      ? loadingMessage
      : loadError !== undefined
        ? typeof errorMessage === 'function' ? errorMessage(loadError) : errorMessage
        : filteredItems.length === 0
          ? emptyMessage
          : undefined;
  const activeOptionId = open && effectiveActiveIndex >= 0 ? `${listboxId}-option-${effectiveActiveIndex}` : undefined;
  const describedBy = joinIds(field.describedBy, open && status !== undefined ? statusId : undefined, liveId);
  const invalid = field.validationState === 'error' || (internalInvalid && normalizedSelection.length === 0);

  const end = (
    <>
      {clearable && normalizedSelection.length > 0 && !field.readOnly ? (
        <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: clearAriaLabel, preventFocusLoss: true, onPress: ({ event }) => clearSelection(event) }} value={draft} disabled={field.disabled} />
      ) : null}
      <EditorButton descriptor={{ key: 'toggle', icon: 'chevron-down', ariaLabel: toggleAriaLabel, preventFocusLoss: true, disabled: field.readOnly, onPress: () => { if (open) closePopup(); else beginOpen(); inputRef.current?.focus({ preventScroll: true }); } }} value={draft} disabled={field.disabled} />
    </>
  );

  return (
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection}>
      <InputShell ref={controlRef} end={end} size={size} validationState={invalid ? 'error' : field.validationState} disabled={field.disabled} readOnly={field.readOnly} className={cx(styles.control, className)} style={style} data-testid={testId}>
        <div className={styles.editor}>
          {normalizedSelection.map((item, index) => {
            const key = getOptionKey(item);
            const label = getOptionLabel(item);
            return (
              <span key={tagBoxKeyToken(key)} className={styles.tag} data-cg-tagbox-tag="">
                <span className={styles.tagContent}>{renderTag ? renderTag({ item, key, label, index, disabled: field.disabled, readOnly: field.readOnly }) : label}</span>
                {!field.readOnly && !field.disabled ? (
                  <button type="button" className={styles.remove} aria-label={removeAriaLabel(item, label)} onMouseDown={(event) => event.preventDefault()} onClick={(event) => removeItem(item, 'remove', event)}>×</button>
                ) : null}
              </span>
            );
          })}
          <input
            {...nativeProps}
            ref={ref}
            id={field.id}
            className={styles.input}
            role="combobox"
            aria-autocomplete="list"
            aria-label={field.ariaLabel}
            aria-labelledby={field.labelledBy}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={open ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-busy={asyncOperation.pending || undefined}
            aria-disabled={field.disabled || undefined}
            aria-required={field.required || undefined}
            aria-invalid={invalid || undefined}
            aria-readonly={field.readOnly || undefined}
            aria-describedby={describedBy}
            aria-errormessage={field.errorMessageId}
            autoComplete={autoComplete}
            form={form}
            value={draft}
            placeholder={normalizedSelection.length === 0 ? placeholder : undefined}
            disabled={field.disabled}
            readOnly={field.readOnly}
            onFocus={(event) => { onFocus?.(event); }}
            onBlur={(event) => {
              queueMicrotask(() => {
                if (!mountedRef.current || controlRef.current?.contains(document.activeElement)) return;
                closePopup();
              });
              onBlur?.(event);
            }}
            onChange={(event) => {
              setDraft(event.target.value);
              onChange?.(event);
              if (!composingRef.current) handleQueryChange(event.target.value, event);
            }}
            onKeyDown={handleKeyDown}
            onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => { composingRef.current = true; onCompositionStart?.(event); }}
            onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
              composingRef.current = false;
              if (pendingQueryRef.current !== undefined) {
                setDraft(pendingQueryRef.current);
                pendingQueryRef.current = undefined;
              } else {
                handleQueryChange(event.currentTarget.value);
              }
              onCompositionEnd?.(event);
            }}
          />
        </div>
      </InputShell>
      <span id={liveId} className={styles.visuallyHidden} role="status" aria-live="polite" aria-atomic="true">{resultsCountMessage(filteredItems.length)}. {selectedCountMessage(normalizedSelection.length)}.</span>
      <select
        ref={formProxyRef}
        className={styles.formProxy}
        name={name}
        form={form}
        multiple
        required={field.required}
        disabled={field.disabled}
        value={normalizedSelection.map((item) => String(getOptionKey(item)))}
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-cg-tagbox-form-proxy=""
        onChange={() => undefined}
        onInvalid={(event) => {
          setInternalInvalid(true);
          onInvalid?.(event);
          event.preventDefault();
          inputRef.current?.focus({ preventScroll: true });
        }}
      >
        {normalizedSelection.map((item) => {
          const key = getOptionKey(item);
          return <option key={tagBoxKeyToken(key)} value={String(key)}>{getOptionLabel(item)}</option>;
        })}
      </select>
      {open ? (
        <PositionedOverlay ref={popupRef} anchorRef={controlRef} className={styles.popup} role="presentation" maxHeight={288} style={{ zIndex: overlay.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${overlay.order * 2 + 1})` : `calc(var(--cg-z-popover) + ${overlay.order})` }} data-cg-overlay-id={overlay.id} data-cg-overlay-owner={overlay.ownerId}>
          <OverlayOwnerProvider id={overlay.id}>
          {status !== undefined && status !== null ? (
            <div id={statusId} className={cx(styles.status, asyncOperation.pending && styles.loading, loadError !== undefined && styles.error)} role={loadError !== undefined ? 'alert' : 'status'}>{status}</div>
          ) : null}
          <div id={listboxId} className={styles.listbox} role="listbox" aria-multiselectable="true" aria-busy={asyncOperation.pending || undefined}>
            {filteredItems.map((item, index) => {
              const key = getOptionKey(item);
              const token = tagBoxKeyToken(key);
              const selectedOption = selectedTokens.has(token);
              const active = effectiveActiveIndex === index;
              const optionDisabled = optionIsDisabled(item);
              return (
                <div
                  key={token}
                  id={`${listboxId}-option-${index}`}
                  className={styles.option}
                  role="option"
                  aria-selected={selectedOption}
                  aria-disabled={optionDisabled || undefined}
                  data-selected={selectedOption || undefined}
                  data-active={active || undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={(event) => toggleOption(item, event)}
                  onMouseMove={() => { if (!optionDisabled) setActiveIndex(index); }}
                >
                  {renderOption ? renderOption({ option: item, key, index, selected: selectedOption, active, disabled: optionDisabled }) : getOptionLabel(item)}
                </div>
              );
            })}
          </div>
          </OverlayOwnerProvider>
        </PositionedOverlay>
      ) : null}
    </div>
  );
}

export const CgTagBox = forwardRef(CgTagBoxInner) as <TItem>(
  props: CgTagBoxProps<TItem> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
