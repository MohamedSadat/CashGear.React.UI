import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent, CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDebouncedCallback, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import { assertNonNegative, assertPositiveInteger } from '../../internal/validation';
import { useVirtualWindow } from '../../internal/useVirtualWindow';
import { cx } from '../../utils';
import styles from './CgComboBox.module.css';
import type { CgComboBoxChangeReason, CgComboBoxProps, CgComboBoxValueChangeDetails } from './CgComboBox.types';
import { useCgUiText } from '../UiText';

const VIRTUAL_ROW_HEIGHT = 40;
const VIRTUAL_THRESHOLD = 100;

function keyToken(key: string | number): string {
  if (typeof key === 'number' && !Number.isFinite(key)) {
    throw new RangeError('CgComboBox option keys must be finite strings or numbers.');
  }
  return `${typeof key}:${String(key)}`;
}

function foldSearch(value: string, locale: string | undefined, ignoreDiacritics: boolean): string {
  let result = value;
  if (ignoreDiacritics) {
    result = result.normalize('NFD').replace(/\p{M}/gu, '').replace(/\u0640/gu, '');
  }
  return locale ? result.toLocaleLowerCase(locale) : result.toLocaleLowerCase();
}

function joinIds(...values: Array<string | undefined | false>): string | undefined {
  const ids = values.flatMap((value) => typeof value === 'string' ? value.split(/\s+/u) : []).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)].join(' ') : undefined;
}

function CgComboBoxInner<TItem, TContext>(
  {
    options,
    loadOptions,
    value,
    defaultValue = null,
    onValueChange,
    onChange,
    getOptionLabel,
    getOptionKey,
    getOptionSearchText = getOptionLabel,
    renderOption,
    searchMode = 'contains',
    locale,
    ignoreDiacritics = true,
    searchDelay = 300,
    minimumSearchLength = 0,
    maxVisibleItems = 50,
    loadingMessage: loadingMessageProp,
    errorMessage: errorMessageProp,
    emptyMessage: emptyMessageProp,
    minimumLengthMessage: minimumLengthMessageProp,
    refineSearchMessage: refineSearchMessageProp,
    customItemFactory,
    customItemText: customItemTextProp,
    queryContext,
    isQueryContextEqual = Object.is,
    dataVersion,
    onSearchError,
    clearable = true,
    clearAriaLabel: clearAriaLabelProp,
    toggleAriaLabel: toggleAriaLabelProp,
    readOnly = false,
    size = 'medium',
    validationState = 'none',
    fullWidth = false,
    direction = 'auto',
    id,
    name,
    form,
    required,
    disabled,
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
    _unresolvedValueText,
    _serializedValue,
    _suppressFormReset,
    ...nativeProps
  }: CgComboBoxProps<TItem, TContext> & { readonly _unresolvedValueText?: string; readonly _serializedValue?: string; readonly _suppressFormReset?: boolean },
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  assertNonNegative('searchDelay', searchDelay);
  assertNonNegative('minimumSearchLength', minimumSearchLength);
  assertPositiveInteger('maxVisibleItems', maxVisibleItems);
  if (options !== undefined && loadOptions !== undefined) {
    throw new Error('CgComboBox accepts either options or loadOptions, not both.');
  }

  const uiText = useCgUiText();
  const loadingMessage = loadingMessageProp ?? uiText.translate('Loading…');
  const errorMessage = errorMessageProp ?? uiText.translate('Unable to load results.');
  const emptyMessage = emptyMessageProp ?? uiText.translate('No results found');
  const minimumLengthMessage = minimumLengthMessageProp ?? ((minimum: number) => uiText.translate('Type at least {0} characters to search.').replace('{0}', String(minimum)));
  const refineSearchMessage = refineSearchMessageProp ?? uiText.translate('Refine your search to see more results.');
  const clearAriaLabel = clearAriaLabelProp ?? uiText.translate('Clear selection');
  const toggleAriaLabel = toggleAriaLabelProp ?? uiText.translate('Toggle options');
  const customItemText = customItemTextProp ?? uiText.translate('Press Enter to use "{0}".');
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const statusContainerRef = useRef<HTMLDivElement>(null);
  const revealFrameRef = useRef<number>(undefined);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const listboxId = `${useCgId(field.id)}-listbox`;
  const statusId = `${listboxId}-status`;
  const resolvedDirection = useDirection(rootRef, direction);
  const [selected, setSelected] = useControllableState<TItem | null>(value, defaultValue, 'CgComboBox');
  const [draft, setDraft] = useState(() => selected === null ? _unresolvedValueText ?? '' : getOptionLabel(selected));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteItems, setRemoteItems] = useState<ReadonlyArray<TItem>>([]);
  const [remoteIncomplete, setRemoteIncomplete] = useState(false);
  const [loadError, setLoadError] = useState<unknown>();
  const composingRef = useRef(false);
  const selectedRef = useRef(selected);
  const controlledValueRef = useRef(value);
  const pendingCommittedTextRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const asyncOperation = useAsyncOperation();
  const queryContextRef = useRef(queryContext);
  const dataVersionRef = useRef(dataVersion);
  const queryContextEqualRef = useRef(isQueryContextEqual);
  const onSearchErrorRef = useRef(onSearchError);

  useLayoutEffect(() => {
    selectedRef.current = selected;
    controlledValueRef.current = value;
  }, [selected, value]);

  useLayoutEffect(() => { queryContextEqualRef.current = isQueryContextEqual; }, [isQueryContextEqual]);
  useLayoutEffect(() => { onSearchErrorRef.current = onSearchError; }, [onSearchError]);

  const reportSearchError = useCallback((error: unknown, searchText: string) => {
    try { onSearchErrorRef.current?.({ error, searchText, queryContext: queryContextRef.current }); } catch { /* diagnostics must not alter control behavior */ }
  }, []);

  const validateItems = useCallback((items: ReadonlyArray<TItem>) => {
    const seen = new Set<string>();
    const result: TItem[] = [];
    for (const item of items) {
      if (item === null || item === undefined) continue;
      const token = keyToken(getOptionKey(item));
      if (seen.has(token)) throw new Error(`CgComboBox received duplicate option key ${String(getOptionKey(item))}.`);
      seen.add(token);
      result.push(item);
    }
    return result;
  }, [getOptionKey]);

  const localItems = useMemo(
    () => {
      void dataVersion;
      return validateItems(options ?? []);
    },
    [dataVersion, options, validateItems],
  );
  const sourceItems = loadOptions ? remoteItems : localItems;
  const selectedToken = selected === null ? undefined : keyToken(getOptionKey(selected));
  const resolvedSelected = useMemo(() => selectedToken === undefined
    ? null
    : sourceItems.find((item) => keyToken(getOptionKey(item)) === selectedToken) ?? selected,
  [getOptionKey, selected, selectedToken, sourceItems]);
  const committedText = resolvedSelected === null ? _unresolvedValueText ?? '' : getOptionLabel(resolvedSelected);

  const localMatches = useMemo(() => {
    if (loadOptions) return sourceItems;
    const query = draft.trim();
    if (query.length < minimumSearchLength) return [];
    if (!query) return sourceItems;
    const foldedQuery = foldSearch(query, locale, ignoreDiacritics);
    return sourceItems.filter((item) => {
      const candidate = foldSearch(getOptionSearchText(item) ?? '', locale, ignoreDiacritics);
      return searchMode === 'startsWith' ? candidate.startsWith(foldedQuery) : candidate.includes(foldedQuery);
    });
  }, [draft, getOptionSearchText, ignoreDiacritics, loadOptions, locale, minimumSearchLength, searchMode, sourceItems]);
  const filteredItems = useMemo(() => loadOptions ? sourceItems : localMatches.slice(0, maxVisibleItems),
    [loadOptions, localMatches, maxVisibleItems, sourceItems]);
  const incomplete = loadOptions ? remoteIncomplete : localMatches.length > maxVisibleItems;
  // Custom renderers can produce rows of different heights.
  const virtualized = renderOption === undefined && filteredItems.length > VIRTUAL_THRESHOLD;
  useLayoutEffect(() => {
    if (popupRef.current) popupRef.current.scrollTop = 0;
  }, [draft, remoteItems]);
  const rows = useVirtualWindow(popupRef, filteredItems.length, VIRTUAL_ROW_HEIGHT, 5, open && virtualized, 0, statusContainerRef);

  const cancelRemote = useStableCallback(() => {
    asyncOperation.cancel();
    setLoadError(undefined);
    setRemoteIncomplete(false);
  });
  const runRemote = useStableCallback((query: string) => {
    if (!loadOptions) return;
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < minimumSearchLength) {
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
      const result = await loadOptions(trimmed, { signal, requestId: generation, queryContext: queryContextRef.current as TContext });
      return { generation, signal, items: result };
    }).then(
      ({ generation, signal, items }) => {
        if (signal.aborted || generation !== asyncOperation.generationRef.current) return;
        try {
          const validated = validateItems(items);
          setRemoteIncomplete(validated.length >= maxVisibleItems);
          setRemoteItems(validated.slice(0, maxVisibleItems));
          setActiveIndex(-1);
        } catch (error) {
          setRemoteItems([]);
          setLoadError(error);
          reportSearchError(error, trimmed);
        }
      },
      (error: unknown) => {
        if (requestSignal?.aborted || requestId !== asyncOperation.generationRef.current) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setRemoteItems([]);
        setLoadError(error);
        reportSearchError(error, trimmed);
      },
    );
  });
  const debouncedRemote = useDebouncedCallback(runRemote, searchDelay);

  const closeAndRestore = useStableCallback(() => {
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setDraft(selectedRef.current === null ? _unresolvedValueText ?? '' : getOptionLabel(selectedRef.current));
    if (loadOptions) setRemoteItems([]);
  });

  useLayoutEffect(() => {
    const contextChanged = !queryContextEqualRef.current(queryContextRef.current as TContext, queryContext as TContext);
    const versionChanged = !Object.is(dataVersionRef.current, dataVersion);
    queryContextRef.current = queryContext;
    dataVersionRef.current = dataVersion;
    if (!contextChanged && !versionChanged) return;
    debouncedRemote.cancel();
    cancelRemote();
    setRemoteItems([]);
    setRemoteIncomplete(false);
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setDraft(selectedRef.current === null ? _unresolvedValueText ?? '' : getOptionLabel(selectedRef.current));
  }, [_unresolvedValueText, cancelRemote, dataVersion, debouncedRemote, getOptionLabel, queryContext]);

  const beginOpen = useStableCallback(() => {
    if (field.disabled || field.readOnly) return;
    setEditing(true);
    setDraft('');
    setActiveIndex(-1);
    setLoadError(undefined);
    if (loadOptions) {
      cancelRemote();
      setRemoteItems([]);
      setOpen(true);
    } else {
      setOpen(minimumSearchLength === 0);
    }
  });

  const emitSelection = useStableCallback((next: TItem | null, reason: CgComboBoxChangeReason, event?: Event | React.SyntheticEvent) => {
    const previousValue = selectedRef.current;
    setSelected(next);
    onValueChange?.(next, { reason, previousValue, event } satisfies CgComboBoxValueChangeDetails<TItem>);
  });

  const selectItem = useStableCallback((item: TItem, event?: React.SyntheticEvent) => {
    if (field.disabled || field.readOnly) return;
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setDraft(getOptionLabel(item));
    emitSelection(item, 'select', event);
    if (value !== undefined) {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        const authoritative = controlledValueRef.current;
        const proposedToken = keyToken(getOptionKey(item));
        const authoritativeToken = authoritative === null || authoritative === undefined
          ? undefined
          : keyToken(getOptionKey(authoritative));
        if (authoritativeToken !== proposedToken) {
          setDraft(authoritative === null || authoritative === undefined ? _unresolvedValueText ?? '' : getOptionLabel(authoritative));
        }
      });
    }
  });

  const clearSelection = useStableCallback((event?: React.SyntheticEvent) => {
    if (field.disabled || field.readOnly || !clearable) return;
    debouncedRemote.cancel();
    cancelRemote();
    setDraft('');
    setActiveIndex(-1);
    setEditing(true);
    setRemoteItems([]);
    setOpen(loadOptions ? true : minimumSearchLength === 0);
    emitSelection(null, 'clear', event);
    inputRef.current?.focus({ preventScroll: true });
  });

  useFormReset(inputRef, () => {
    if (_suppressFormReset) return;
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setRemoteItems([]);
    const next = value !== undefined ? value : defaultValue;
    setDraft(next === null ? _unresolvedValueText ?? '' : getOptionLabel(next));
    if (value === undefined) emitSelection(next, 'reset');
  });

  const selectionSignature = selectedToken === undefined ? '' : `${selectedToken}:${committedText}`;
  const selectionSignatureRef = useRef(selectionSignature);
  useEffect(() => {
    if (selectionSignatureRef.current === selectionSignature) return;
    selectionSignatureRef.current = selectionSignature;
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    if (composingRef.current) pendingCommittedTextRef.current = committedText;
    else setDraft(committedText);
  }, [cancelRemote, committedText, debouncedRemote, selectionSignature]);

  useEffect(() => {
    if (value !== undefined || selected === null || resolvedSelected === selected) return;
    setSelected(resolvedSelected);
  }, [resolvedSelected, selected, setSelected, value]);

  useEffect(() => () => {
    mountedRef.current = false;
    debouncedRemote.cancel();
  }, [debouncedRemote]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(field.required && selected === null ? 'Please select an option.' : '');
    return () => input.setCustomValidity('');
  }, [field.required, selected]);

  const revealOption = useStableCallback((index: number) => {
    const popup = popupRef.current;
    const listbox = listboxRef.current;
    if (!open || activeIndex !== index || !popup || !listbox || index >= filteredItems.length) return;

    const option = virtualized ? undefined : listbox.children[index] as HTMLElement | undefined;
    const top = option ? option.offsetTop : listbox.offsetTop + index * VIRTUAL_ROW_HEIGHT;
    const bottom = top + (option?.offsetHeight ?? VIRTUAL_ROW_HEIGHT);
    if (top < popup.scrollTop) popup.scrollTop = top;
    else if (bottom > popup.scrollTop + popup.clientHeight) popup.scrollTop = bottom - popup.clientHeight;
  });

  useEffect(() => () => {
    if (revealFrameRef.current !== undefined) cancelAnimationFrame(revealFrameRef.current);
  }, []);

  const activateFromKeyboard = (index: number) => {
    setActiveIndex(index);
    if (revealFrameRef.current !== undefined) cancelAnimationFrame(revealFrameRef.current);
    revealFrameRef.current = requestAnimationFrame(() => {
      revealFrameRef.current = undefined;
      revealOption(index);
    });
  };

  const updateQuery = (next: string, event?: ChangeEvent<HTMLInputElement>) => {
    setDraft(next);
    setEditing(true);
    setActiveIndex(-1);
    if (loadOptions) {
      setOpen(true);
      if (next.trim().length < minimumSearchLength || !next.trim()) {
        debouncedRemote.cancel();
        cancelRemote();
        setRemoteItems([]);
      } else {
        debouncedRemote.schedule(next);
      }
    } else {
      setOpen(next.trim().length >= minimumSearchLength);
    }
    if (event) onChange?.(event);
  };

  const moveActive = (delta: number) => {
    if (filteredItems.length === 0) return;
    const lastIndex = filteredItems.length - 1;
    const index = activeIndex < 0 ? (delta > 0 ? 0 : lastIndex) : Math.max(0, Math.min(lastIndex, activeIndex + delta));
    activateFromKeyboard(index);
  };

  const resolveKeyboardSelection = () => {
    const active = filteredItems[activeIndex];
    if (active) return active;
    if (loadOptions || incomplete) return undefined;
    const query = foldSearch(draft.trim(), locale, ignoreDiacritics);
    if (!query) return undefined;
    const exact = filteredItems.filter((item) => foldSearch(getOptionLabel(item), locale, ignoreDiacritics) === query);
    // With free text allowed, one remaining option is not a choice: "A1" may narrow the list to "A10" and still mean A1.
    return exact.length === 1 ? exact[0] : filteredItems.length === 1 && !customItemFactory ? filteredItems[0] : undefined;
  };

  // Blazor CustomItemFactory: free text the user typed, when it may be committed. Not the caption already committed.
  const typedCustomText = (() => {
    if (!customItemFactory || !editing) return undefined;
    const text = draft.trim();
    return text && text !== committedText ? text : undefined;
  })();
  const findByCaption = (text: string): TItem | undefined => {
    const folded = text.toLocaleLowerCase(locale);
    return sourceItems.find((item) => getOptionLabel(item).toLocaleLowerCase(locale) === folded);
  };
  const customItemHint = typedCustomText !== undefined && findByCaption(typedCustomText) === undefined ? customItemText.replace('{0}', typedCustomText) : undefined;
  /** Commits typed text the user is leaving; false when there is nothing to commit, so the caller restores. */
  const commitTypedText = (event?: React.SyntheticEvent): boolean => {
    if (typedCustomText === undefined || !customItemFactory) return false;
    let item: TItem | null | undefined = findByCaption(typedCustomText);
    if (item === undefined) {
      const custom = customItemFactory(typedCustomText);
      // A typed key that is in the list commits the listed item, caption and all.
      item = custom === null || custom === undefined ? null : sourceItems.find((candidate) => keyToken(getOptionKey(candidate)) === keyToken(getOptionKey(custom))) ?? custom;
    }
    if (item === null) return false;
    selectItem(item, event);
    return true;
  };
  // Outside click keeps typed free text (Blazor); Escape still restores.
  const overlay = useOverlayStack(open, closeAndRestore, popupRef, () => { if (!commitTypedText()) closeAndRestore(); }, controlRef);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly) {
      onKeyDown?.(event);
      return;
    }
    if (event.nativeEvent.isComposing || composingRef.current) {
      onKeyDown?.(event);
      return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && (event.key === 'Backspace' || event.key === 'Delete')) {
      if (clearable) {
        event.preventDefault();
        clearSelection(event);
      }
      onKeyDown?.(event);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        beginOpen();
        if (!loadOptions && minimumSearchLength === 0 && sourceItems.length > 0) {
          activateFromKeyboard(event.key === 'ArrowDown' ? 0 : Math.min(sourceItems.length, maxVisibleItems) - 1);
        }
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      if (filteredItems.length > 0) activateFromKeyboard(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      if (filteredItems.length > 0) activateFromKeyboard(filteredItems.length - 1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const item = resolveKeyboardSelection();
      if (item) selectItem(item, event);
      else if (!commitTypedText(event)) closeAndRestore();
    } else if (event.key === 'Escape' && (open || editing)) {
      event.preventDefault();
      closeAndRestore();
    } else if (event.key === 'Tab' && (open || editing)) {
      if (!commitTypedText(event)) closeAndRestore();
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
        : customItemHint !== undefined
          ? customItemHint
          : filteredItems.length === 0
          ? emptyMessage
          : incomplete ? refineSearchMessage : undefined;
  const activeOptionId = open && activeIndex >= rows.start && activeIndex < rows.end ? `${listboxId}-option-${activeIndex}` : undefined;
  const describedBy = joinIds(field.describedBy, open && status !== undefined ? statusId : undefined);
  const serializedValue = _serializedValue ?? (selected === null ? '' : String(getOptionKey(selected)));
  const listboxStyle = virtualized ? {
    '--cg-combobox-row-height': `${VIRTUAL_ROW_HEIGHT}px`,
    paddingBlockStart: rows.paddingBefore,
    paddingBlockEnd: rows.paddingAfter,
  } as CSSProperties : undefined;
  const start = null;
  const end = (
    <>
      {clearable && selected !== null && !field.readOnly ? (
        <EditorButton descriptor={{ key: 'clear', icon: 'clear', ariaLabel: clearAriaLabel, preventFocusLoss: true, onPress: ({ event }) => clearSelection(event) }} value={draft} disabled={field.disabled} />
      ) : null}
      <EditorButton descriptor={{ key: 'toggle', icon: 'chevron-down', ariaLabel: toggleAriaLabel, preventFocusLoss: true, disabled: field.readOnly, onPress: () => { if (open) closeAndRestore(); else beginOpen(); inputRef.current?.focus({ preventScroll: true }); } }} value={draft} disabled={field.disabled} />
    </>
  );

  return (
    <div ref={rootRef} className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection}>
      <InputShell ref={controlRef} start={start} end={end} size={size} validationState={field.validationState} disabled={field.disabled} readOnly={field.readOnly} className={cx(styles.control, className)} style={style} data-testid={testId}>
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
          aria-invalid={field.validationState === 'error' || undefined}
          aria-readonly={field.readOnly || undefined}
          aria-describedby={describedBy}
          aria-errormessage={field.errorMessageId}
          aria-keyshortcuts={clearable && !field.disabled && !field.readOnly ? 'Control+Backspace Control+Delete' : undefined}
          autoComplete={autoComplete}
          form={form}
          value={draft}
          required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          onFocus={(event) => { if (!field.disabled && !field.readOnly) setEditing(true); onFocus?.(event); }}
          onBlur={(event) => {
            queueMicrotask(() => { if (mountedRef.current && document.activeElement !== inputRef.current && !commitTypedText()) closeAndRestore(); });
            onBlur?.(event);
          }}
          onChange={(event) => {
            if (composingRef.current) {
              setDraft(event.target.value);
              setEditing(true);
              onChange?.(event);
              return;
            }
            updateQuery(event.target.value, event);
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => { composingRef.current = true; onCompositionStart?.(event); }}
          onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
            composingRef.current = false;
            if (pendingCommittedTextRef.current !== undefined) {
              setDraft(pendingCommittedTextRef.current);
              pendingCommittedTextRef.current = undefined;
              onCompositionEnd?.(event);
              return;
            }
            updateQuery(event.currentTarget.value);
            onCompositionEnd?.(event);
          }}
        />
      </InputShell>
      {name ? <input type="hidden" name={name} form={form} disabled={field.disabled} value={serializedValue} /> : null}
      {open ? (
        <PositionedOverlay ref={popupRef} anchorRef={controlRef} className={styles.popup} role="presentation" maxHeight={288} style={{ zIndex: overlay.rootKind === 'modal' ? `calc(var(--cg-z-modal) + ${overlay.order * 2 + 1})` : `calc(var(--cg-z-popover) + ${overlay.order})` }} data-cg-overlay-id={overlay.id} data-cg-overlay-owner={overlay.ownerId}>
          <OverlayOwnerProvider id={overlay.id}>
          <div ref={statusContainerRef}>
            {status !== undefined && status !== null ? (
              <div id={statusId} className={cx(styles.status, asyncOperation.pending && styles.loading, loadError !== undefined && styles.error)} role={loadError !== undefined ? 'alert' : 'status'}>{status}</div>
            ) : null}
          </div>
          <div ref={listboxRef} id={listboxId} className={cx(styles.listbox, virtualized && styles.virtualListbox)} style={listboxStyle} role="listbox" aria-busy={asyncOperation.pending || undefined}>
            {filteredItems.slice(rows.start, rows.end).map((item, windowIndex) => {
              const index = rows.start + windowIndex;
              const token = keyToken(getOptionKey(item));
              const isSelected = selectedToken === token;
              const isActive = activeIndex === index;
              return (
                <div
                  key={token}
                  id={`${listboxId}-option-${index}`}
                  className={styles.option}
                  role="option"
                  aria-selected={isSelected}
                  aria-posinset={virtualized ? index + 1 : undefined}
                  aria-setsize={virtualized ? filteredItems.length : undefined}
                  data-selected={isSelected || undefined}
                  data-active={isActive || undefined}
                  onMouseDown={(event: MouseEvent<HTMLDivElement>) => event.preventDefault()}
                  onClick={(event) => selectItem(item, event)}
                  onMouseMove={() => setActiveIndex(index)}
                >
                  {renderOption ? renderOption({ option: item, index, selected: isSelected, active: isActive }) : getOptionLabel(item)}
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

export const CgComboBox = forwardRef(CgComboBoxInner) as <TItem, TContext = unknown>(
  props: CgComboBoxProps<TItem, TContext> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
