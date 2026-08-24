import { forwardRef, useEffect, useRef, useState } from 'react';
import type { CompositionEvent } from 'react';
import { useAsyncOperation, useCgId, useControllableState, useDebouncedCallback, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { assertNonNegative } from '../../internal/validation';
import type { CgEditorButtonDescriptor } from '../../types';
import { CgTextBox } from '../TextBox';
import styles from './CgSearchBox.module.css';
import type { CgSearchBoxProps, CgSearchReason } from './CgSearchBox.types';

export const CgSearchBox = forwardRef<HTMLInputElement, CgSearchBoxProps>(function CgSearchBox(
  { query, defaultQuery = '', onQueryChange, onChange, onSearch, searchMode = 'debounced', searchDelay = 300, minimumLength = 0, minimumLengthMessage, escapeClears = false, searchOnClear = true, loading = false, loadingText = 'Searching…', resultStatus, searchAriaLabel = 'Search', commands = [], clearButton = 'auto', id, 'aria-describedby': ariaDescribedBy, onBlur, onKeyDown, onCompositionStart, onCompositionEnd, ...textBoxProps },
  ref,
) {
  assertNonNegative('searchDelay', searchDelay);
  assertNonNegative('minimumLength', minimumLength);
  const [currentQuery, setCurrentQuery] = useControllableState(query, defaultQuery, 'CgSearchBox');
  const [draftQuery, setDraftQuery] = useState(currentQuery);
  const asyncOperation = useAsyncOperation();
  const composingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mergedRef = useMergedRefs(inputRef, ref);
  const activeQueryRef = useRef<string | undefined>(undefined);
  const activeRequestIdRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef(false);
  const lastDraftRef = useRef(currentQuery);
  const lastInternalQueryRef = useRef<string | undefined>(undefined);
  const controlledQueryRef = useRef(query);
  const cancelSearch = useStableCallback(() => {
    asyncOperation.cancel();
    activeQueryRef.current = undefined;
    activeRequestIdRef.current = undefined;
    pendingRef.current = false;
  });
  const search = useStableCallback((next: string, reason: CgSearchReason) => {
    const eligible = reason === 'clear' || next.trim().length >= minimumLength;
    if (!eligible || !onSearch) {
      cancelSearch();
      return;
    }
    if (pendingRef.current && activeQueryRef.current === next && reason === 'submit') return;
    activeQueryRef.current = next;
    pendingRef.current = true;
    let requestId = 0;
    void asyncOperation.run(async ({ signal, generation }) => {
      requestId = generation;
      activeRequestIdRef.current = generation;
      await onSearch(next, { reason, requestId: generation, signal });
    }).then(
      () => {
        if (activeRequestIdRef.current !== requestId) return;
        activeRequestIdRef.current = undefined;
        activeQueryRef.current = undefined;
        pendingRef.current = false;
      },
      () => {
        if (activeRequestIdRef.current !== requestId) return;
        activeRequestIdRef.current = undefined;
        activeQueryRef.current = undefined;
        pendingRef.current = false;
      },
    );
  });
  const debounced = useDebouncedCallback((next: string) => search(next, 'debounce'), searchDelay);
  useEffect(() => () => debounced.cancel(), [debounced]);
  useFormReset(inputRef, () => {
    debounced.cancel();
    cancelSearch();
    const next = query !== undefined ? query : defaultQuery;
    lastDraftRef.current = next;
    lastInternalQueryRef.current = undefined;
    setDraftQuery(next);
    if (query === undefined) {
      setCurrentQuery(next);
      onQueryChange?.(next);
    }
  });
  useEffect(() => {
    if (query === undefined || Object.is(controlledQueryRef.current, query)) return;
    controlledQueryRef.current = query;
    setDraftQuery(query);
    lastDraftRef.current = query;
    if (lastInternalQueryRef.current === query) {
      lastInternalQueryRef.current = undefined;
      return;
    }
    debounced.cancel();
    cancelSearch();
  }, [cancelSearch, debounced, query]);
  const update = (next: string, event?: React.ChangeEvent<HTMLInputElement>) => {
    lastDraftRef.current = next;
    lastInternalQueryRef.current = next;
    setDraftQuery(next);
    setCurrentQuery(next);
    onQueryChange?.(next, event);
  };
  const clearSearch = useStableCallback(() => {
    debounced.cancel();
    cancelSearch();
    update('');
    if (searchOnClear) search('', 'clear');
  });
  const searchButton: CgEditorButtonDescriptor<string> = {
    key: 'search',
    icon: 'search',
    ariaLabel: searchAriaLabel,
    disabled: loading || asyncOperation.pending,
    onPress: ({ value }) => search(value, 'submit'),
  };
  const status = loading || asyncOperation.pending ? loadingText : resultStatus;
  const inputId = useCgId(id);
  const minimumMessageId = `${inputId}-minimum-length`;
  const belowMinimum = draftQuery.length > 0 && draftQuery.trim().length < minimumLength;
  const minimumMessage = belowMinimum
    ? typeof minimumLengthMessage === 'function'
      ? minimumLengthMessage(minimumLength)
      : minimumLengthMessage
    : undefined;
  const describedBy = [ariaDescribedBy, minimumMessage !== undefined && minimumMessage !== null ? minimumMessageId : undefined]
    .filter(Boolean)
    .join(' ') || undefined;
  return (
    <div className={styles.root}>
      <CgTextBox
        {...textBoxProps}
        ref={mergedRef}
        id={inputId}
        type="search"
        value={draftQuery}
        commitMode="input"
        clearButton={clearButton}
        leadingIcon="search"
        buttons={[...commands, searchButton]}
        aria-busy={loading || asyncOperation.pending || undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const next = event.target.value;
          update(next, event);
          onChange?.(event);
          if (!composingRef.current) {
            if (next.trim().length < minimumLength) {
              debounced.cancel();
              cancelSearch();
            } else if (searchMode === 'input') search(next, 'input');
            else if (searchMode === 'debounced') debounced.schedule(next);
          }
        }}
        onValueChange={(_next, details) => {
          if (details.reason !== 'clear') return;
          clearSearch();
        }}
        onBlur={(event) => { if (searchMode === 'blur') search(event.currentTarget.value, 'blur'); onBlur?.(event); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); debounced.cancel(); search(event.currentTarget.value, 'submit'); }
          else if (event.key === 'Escape' && escapeClears && event.currentTarget.value) { event.preventDefault(); clearSearch(); }
          onKeyDown?.(event);
        }}
        onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => { composingRef.current = true; onCompositionStart?.(event); }}
        onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = false;
          const next = event.currentTarget.value;
          if (lastDraftRef.current !== next) update(next);
          if (next.trim().length < minimumLength) {
            debounced.cancel();
            cancelSearch();
          } else if (searchMode === 'input') search(next, 'input');
          else if (searchMode === 'debounced') debounced.schedule(next);
          onCompositionEnd?.(event);
        }}
      />
      {minimumMessage !== undefined && minimumMessage !== null ? <div id={minimumMessageId} className={styles.minimum}>{minimumMessage}</div> : null}
      {status ? <div className={styles.status} role="status" aria-live="polite">{status}</div> : null}
    </div>
  );
});
