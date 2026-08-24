import { forwardRef, useEffect, useRef } from 'react';
import type { CompositionEvent } from 'react';
import { useAsyncOperation, useControllableState, useDebouncedCallback, useStableCallback } from '../../hooks';
import type { CgEditorButtonDescriptor } from '../../types';
import { CgTextBox } from '../TextBox';
import styles from './CgSearchBox.module.css';
import type { CgSearchBoxProps, CgSearchReason } from './CgSearchBox.types';

export const CgSearchBox = forwardRef<HTMLInputElement, CgSearchBoxProps>(function CgSearchBox(
  { query, defaultQuery = '', onQueryChange, onChange, onSearch, searchMode = 'debounced', searchDelay = 300, minimumLength = 0, escapeClears = false, loading = false, loadingText = 'Searching…', resultStatus, searchAriaLabel = 'Search', commands = [], clearButton = 'auto', onBlur, onKeyDown, onCompositionStart, onCompositionEnd, ...textBoxProps },
  ref,
) {
  const [currentQuery, setCurrentQuery] = useControllableState(query, defaultQuery, 'CgSearchBox');
  const asyncOperation = useAsyncOperation();
  const composingRef = useRef(false);
  const activeQueryRef = useRef<string | undefined>(undefined);
  const pendingRef = useRef(false);
  const search = useStableCallback((next: string, reason: CgSearchReason) => {
    const normalized = next.trim();
    if (normalized.length < minimumLength || !onSearch) { asyncOperation.cancel(); return; }
    if (pendingRef.current && activeQueryRef.current === normalized && reason === 'submit') return;
    activeQueryRef.current = normalized;
    pendingRef.current = true;
    void asyncOperation.run(async ({ signal, generation }) => {
      await onSearch(normalized, { reason, requestId: generation, signal });
    }).finally(() => {
      if (activeQueryRef.current === normalized) pendingRef.current = false;
    }).catch(() => undefined);
  });
  const debounced = useDebouncedCallback((next: string) => search(next, 'debounce'), searchDelay);
  useEffect(() => () => debounced.cancel(), [debounced]);
  const update = (next: string, event?: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentQuery(next);
    onQueryChange?.(next, event);
  };
  const searchButton: CgEditorButtonDescriptor<string> = {
    key: 'search',
    icon: 'search',
    ariaLabel: searchAriaLabel,
    disabled: loading || asyncOperation.pending,
    onPress: ({ value }) => search(value, 'submit'),
  };
  const status = loading || asyncOperation.pending ? loadingText : resultStatus;
  return (
    <div className={styles.root}>
      <CgTextBox
        {...textBoxProps}
        ref={ref}
        type="search"
        value={currentQuery}
        commitMode="input"
        clearButton={clearButton}
        leadingIcon="search"
        buttons={[...commands, searchButton]}
        aria-busy={loading || asyncOperation.pending || undefined}
        onChange={(event) => {
          const next = event.target.value;
          update(next, event);
          onChange?.(event);
          if (!composingRef.current) {
            if (searchMode === 'input') search(next, 'input');
            else if (searchMode === 'debounced') debounced.schedule(next);
          }
        }}
        onValueChange={(next, details) => {
          if (details.reason !== 'clear') return;
          debounced.cancel();
          asyncOperation.cancel();
          update(next);
          search(next, 'clear');
        }}
        onBlur={(event) => { if (searchMode === 'blur') search(event.currentTarget.value, 'blur'); onBlur?.(event); }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); debounced.cancel(); search(event.currentTarget.value, 'submit'); }
          else if (event.key === 'Escape' && escapeClears && event.currentTarget.value) { event.preventDefault(); debounced.cancel(); asyncOperation.cancel(); update(''); }
          onKeyDown?.(event);
        }}
        onCompositionStart={(event: CompositionEvent<HTMLInputElement>) => { composingRef.current = true; onCompositionStart?.(event); }}
        onCompositionEnd={(event: CompositionEvent<HTMLInputElement>) => {
          composingRef.current = false;
          const next = event.currentTarget.value;
          update(next);
          if (searchMode === 'input') search(next, 'input');
          else if (searchMode === 'debounced') debounced.schedule(next);
          onCompositionEnd?.(event);
        }}
      />
      {status ? <div className={styles.status} role="status" aria-live="polite">{status}</div> : null}
    </div>
  );
});
