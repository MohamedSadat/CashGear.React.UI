import { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent, KeyboardEvent, MouseEvent } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDebouncedCallback, useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { EditorButton, InputShell, OverlayOwnerProvider, PositionedOverlay, useFieldControl, useOverlayStack } from '../../internal';
import { assertNonNegative, assertPositiveInteger } from '../../internal/validation';
import { cx } from '../../utils';
import styles from './CgComboBox.module.css';
import type { CgComboBoxChangeReason, CgComboBoxProps, CgComboBoxValueChangeDetails } from './CgComboBox.types';

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

function CgComboBoxInner<TItem>(
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
    loadingMessage = 'Loading…',
    errorMessage = 'Unable to load results.',
    emptyMessage = 'No results found',
    minimumLengthMessage = (minimum) => `Type at least ${minimum} characters to search.`,
    clearable = true,
    clearAriaLabel = 'Clear selection',
    toggleAriaLabel = 'Toggle options',
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
    onFocus,
    onBlur,
    onKeyDown,
    onCompositionStart,
    onCompositionEnd,
    autoComplete = 'off',
    ...nativeProps
  }: CgComboBoxProps<TItem>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  assertNonNegative('searchDelay', searchDelay);
  assertNonNegative('minimumSearchLength', minimumSearchLength);
  assertPositiveInteger('maxVisibleItems', maxVisibleItems);
  if (options !== undefined && loadOptions !== undefined) {
    throw new Error('CgComboBox accepts either options or loadOptions, not both.');
  }

  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy });
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(inputRef, forwardedRef);
  const listboxId = `${useCgId(field.id)}-listbox`;
  const statusId = `${listboxId}-status`;
  const resolvedDirection = useDirection(inputRef, direction);
  const [selected, setSelected] = useControllableState<TItem | null>(value, defaultValue, 'CgComboBox');
  const [draft, setDraft] = useState(() => selected === null ? '' : getOptionLabel(selected));
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteItems, setRemoteItems] = useState<ReadonlyArray<TItem>>([]);
  const [loadError, setLoadError] = useState<unknown>();
  const composingRef = useRef(false);
  const selectedRef = useRef(selected);
  const controlledValueRef = useRef(value);
  const pendingCommittedTextRef = useRef<string | undefined>(undefined);
  const mountedRef = useRef(true);
  const asyncOperation = useAsyncOperation();

  useLayoutEffect(() => {
    selectedRef.current = selected;
    controlledValueRef.current = value;
  }, [selected, value]);

  const validateItems = useCallback((items: ReadonlyArray<TItem>) => {
    const seen = new Set<string>();
    const result: TItem[] = [];
    for (const item of items) {
      if (item === null || item === undefined) continue;
      const token = keyToken(getOptionKey(item));
      if (seen.has(token)) throw new Error(`CgComboBox received duplicate option key ${String(getOptionKey(item))}.`);
      seen.add(token);
      if (result.length < maxVisibleItems) result.push(item);
    }
    return result;
  }, [getOptionKey, maxVisibleItems]);

  const localItems = useMemo(
    () => validateItems(options ?? []),
    [options, validateItems],
  );
  const sourceItems = loadOptions ? remoteItems : localItems;
  const selectedToken = selected === null ? undefined : keyToken(getOptionKey(selected));
  const resolvedSelected = selectedToken === undefined
    ? null
    : sourceItems.find((item) => keyToken(getOptionKey(item)) === selectedToken) ?? selected;
  const committedText = resolvedSelected === null ? '' : getOptionLabel(resolvedSelected);

  const filteredItems = useMemo(() => {
    if (loadOptions) return sourceItems;
    const query = draft.trim();
    if (query.length < minimumSearchLength) return [];
    if (!query) return sourceItems;
    const foldedQuery = foldSearch(query, locale, ignoreDiacritics);
    return sourceItems.filter((item) => {
      const candidate = foldSearch(getOptionSearchText(item) ?? '', locale, ignoreDiacritics);
      return searchMode === 'startsWith' ? candidate.startsWith(foldedQuery) : candidate.includes(foldedQuery);
    }).slice(0, maxVisibleItems);
  }, [draft, getOptionSearchText, ignoreDiacritics, loadOptions, locale, maxVisibleItems, minimumSearchLength, searchMode, sourceItems]);

  const cancelRemote = useStableCallback(() => {
    asyncOperation.cancel();
    setLoadError(undefined);
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
      const result = await loadOptions(trimmed, { signal, requestId: generation });
      return { generation, signal, items: result };
    }).then(
      ({ generation, signal, items }) => {
        if (signal.aborted || generation !== asyncOperation.generationRef.current) return;
        try {
          setRemoteItems(validateItems(items));
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

  const closeAndRestore = useStableCallback(() => {
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setDraft(selectedRef.current === null ? '' : getOptionLabel(selectedRef.current));
    if (loadOptions) setRemoteItems([]);
  });
  const overlay = useOverlayStack(open, closeAndRestore, popupRef, closeAndRestore, controlRef);

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
          setDraft(authoritative === null || authoritative === undefined ? '' : getOptionLabel(authoritative));
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
    debouncedRemote.cancel();
    cancelRemote();
    setOpen(false);
    setEditing(false);
    setActiveIndex(-1);
    setRemoteItems([]);
    const next = value !== undefined ? value : defaultValue;
    setDraft(next === null ? '' : getOptionLabel(next));
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

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, listboxId, open]);

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
    setActiveIndex((current) => {
      if (current < 0) return delta > 0 ? 0 : filteredItems.length - 1;
      return Math.max(0, Math.min(filteredItems.length - 1, current + delta));
    });
  };

  const resolveKeyboardSelection = () => {
    const active = filteredItems[activeIndex];
    if (active) return active;
    const query = foldSearch(draft.trim(), locale, ignoreDiacritics);
    if (!query) return undefined;
    const exact = filteredItems.filter((item) => foldSearch(getOptionLabel(item), locale, ignoreDiacritics) === query);
    return exact.length === 1 ? exact[0] : filteredItems.length === 1 ? filteredItems[0] : undefined;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (field.disabled || field.readOnly) {
      onKeyDown?.(event);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        beginOpen();
        if (!loadOptions && minimumSearchLength === 0 && sourceItems.length > 0) {
          setActiveIndex(event.key === 'ArrowDown' ? 0 : sourceItems.length - 1);
        }
      } else {
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      }
    } else if (event.key === 'Home' && open) {
      event.preventDefault();
      if (filteredItems.length > 0) setActiveIndex(0);
    } else if (event.key === 'End' && open) {
      event.preventDefault();
      if (filteredItems.length > 0) setActiveIndex(filteredItems.length - 1);
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      const item = resolveKeyboardSelection();
      if (item) selectItem(item, event);
      else closeAndRestore();
    } else if (event.key === 'Escape' && (open || editing)) {
      event.preventDefault();
      closeAndRestore();
    } else if (event.key === 'Tab' && (open || editing)) {
      closeAndRestore();
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
  const activeOptionId = open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const describedBy = joinIds(field.describedBy, open && status !== undefined ? statusId : undefined);
  const serializedValue = selected === null ? '' : String(getOptionKey(selected));
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
    <div className={cx(styles.root, fullWidth && styles.fullWidth)} dir={resolvedDirection}>
      <InputShell ref={controlRef} start={start} end={end} size={size} validationState={field.validationState} disabled={field.disabled} readOnly={field.readOnly} className={cx(styles.control, className)} style={style} data-testid={testId}>
        <input
          {...nativeProps}
          ref={ref}
          id={field.id}
          className={styles.input}
          role="combobox"
          aria-autocomplete="list"
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
          autoComplete={autoComplete}
          form={form}
          value={draft}
          required={field.required}
          disabled={field.disabled}
          readOnly={field.readOnly}
          onFocus={(event) => { if (!field.disabled && !field.readOnly) setEditing(true); onFocus?.(event); }}
          onBlur={(event) => {
            queueMicrotask(() => { if (mountedRef.current && document.activeElement !== inputRef.current) closeAndRestore(); });
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
          {status !== undefined && status !== null ? (
            <div id={statusId} className={cx(styles.status, asyncOperation.pending && styles.loading, loadError !== undefined && styles.error)} role={loadError !== undefined ? 'alert' : 'status'}>{status}</div>
          ) : null}
          <div id={listboxId} className={styles.listbox} role="listbox" aria-busy={asyncOperation.pending || undefined}>
            {filteredItems.map((item, index) => {
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

export const CgComboBox = forwardRef(CgComboBoxInner) as <TItem>(
  props: CgComboBoxProps<TItem> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
