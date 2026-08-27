import {
  useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
} from 'react';
import type { KeyboardEvent } from 'react';
import { CgButton } from '../Button';
import styles from './CgPager.module.css';
import type {
  CgPagerActions, CgPagerButtonContext, CgPagerLabels, CgPagerNavigationReason, CgPagerProps,
} from './CgPager.types';
import {
  CG_PAGER_DEFAULT_AUTO_INPUT_THRESHOLD, CG_PAGER_DEFAULT_NUMERIC_BUTTONS, calculateNumericWindow,
  calculatePageCount, calculateVisibleItemRange, clampPageIndex, normalizePageCount, normalizePageSize,
  normalizePageSizeOptions, preserveFirstItemPageIndex, shouldUsePagerInput, toDisplayPageNumber, toPageIndex,
} from './paging';

const DEFAULT_LABELS: CgPagerLabels = Object.freeze({
  navigation: 'Pagination', firstPage: 'Go to first page', previousPage: 'Go to previous page', nextPage: 'Go to next page',
  lastPage: 'Go to last page', goToPage: 'Go to page {0}', currentPage: 'Page {0}, current page', pageOf: 'Page {0} of {1}',
  itemsOf: 'Items {0}-{1} of {2}', pageSize: 'Rows per page', invalidPageNumber: 'Enter a page number between 1 and {0}.',
  noItems: '0 items', page: 'Page', of: 'of', totalRecords: '{0} records',
});

const DECIMAL_ZEROES = [
  0x30, 0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66,
  0xde6, 0xe50, 0xed0, 0xf20, 0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90,
  0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa620, 0xa8d0, 0xa900, 0xa9d0, 0xa9f0, 0xaa50, 0xabf0,
  0xff10, 0x104a0, 0x10d30, 0x11066, 0x110f0, 0x11136, 0x111d0, 0x112f0, 0x11450, 0x114d0,
  0x11650, 0x116c0, 0x11730, 0x118e0, 0x11950, 0x11c50, 0x11d50, 0x11da0, 0x16a60, 0x16ac0,
  0x16b50, 0x1d7ce, 0x1e140, 0x1e2f0, 0x1e950,
];

function format(template: string, ...values: ReadonlyArray<string | number>): string {
  return values.reduce<string>((result, value, index) => result.replaceAll(`{${index}}`, String(value)), template);
}

export function parsePagerDisplayNumber(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let normalized = '';
  for (const character of trimmed) {
    const code = character.codePointAt(0);
    if (code === undefined) return null;
    const zero = DECIMAL_ZEROES.find((candidate) => code >= candidate && code <= candidate + 9);
    if (zero === undefined) return null;
    normalized += String(code - zero);
  }
  const number = Number(normalized);
  return Number.isSafeInteger(number) && number >= 1 ? number : null;
}

function classes(...values: Array<string | undefined | false>): string | undefined {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length ? present.join(' ') : undefined;
}

export function CgPager({
  pageIndex,
  defaultPageIndex = 0,
  onPageIndexChange,
  pageSize,
  defaultPageSize = 50,
  onPageSizeChange,
  pageCount,
  totalItemCount,
  mode = 'auto',
  visibleNumericButtonCount = CG_PAGER_DEFAULT_NUMERIC_BUTTONS,
  switchToInputBoxPageCount = CG_PAGER_DEFAULT_AUTO_INPUT_THRESHOLD,
  minimumNumericWidth = 480,
  showFirstButton = true,
  showPreviousButton = true,
  showNextButton = true,
  showLastButton = true,
  autoHideNavigationButtons = false,
  showPageSizeSelector = false,
  pageSizeOptions,
  showSummary = true,
  preserveFirstVisibleItemOnPageSizeChange = false,
  disableNavigationWhileLoading = true,
  loading = false,
  disabled = false,
  readOnly = false,
  renderSummary,
  renderNumericButton,
  labels: labelOverrides,
  navigationLabel,
  size = 'medium',
  density = 'comfortable',
  direction = 'auto',
  layout = 'responsive',
  actionsRef,
  onInvalidInput,
  className,
  style,
  'data-testid': testId,
}: CgPagerProps) {
  const labels = useMemo(() => ({ ...DEFAULT_LABELS, ...labelOverrides }), [labelOverrides]);
  const controlledPage = pageIndex !== undefined;
  const controlledSize = pageSize !== undefined;
  const [ownedPageIndex, setOwnedPageIndex] = useState(defaultPageIndex);
  const [ownedPageSize, setOwnedPageSize] = useState(defaultPageSize);
  const requestedPageIndex = controlledPage ? pageIndex : ownedPageIndex;
  const effectivePageSize = normalizePageSize(controlledSize ? pageSize : ownedPageSize);
  const effectivePageCount = pageCount === undefined ? calculatePageCount(totalItemCount ?? 0, effectivePageSize) : normalizePageCount(pageCount);
  const activePageIndex = clampPageIndex(requestedPageIndex, effectivePageCount);
  const [draft, setDraft] = useState<string | null>(null);
  const [inputError, setInputError] = useState('');
  const [responsiveInput, setResponsiveInput] = useState(false);
  const pagerId = useId().replace(/:/gu, '');
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const clampProposal = useRef('');
  const frame = useRef<number | null>(null);
  const window = calculateNumericWindow(activePageIndex, effectivePageCount, visibleNumericButtonCount);
  const range = calculateVisibleItemRange(activePageIndex, effectivePageSize, totalItemCount);
  const options = normalizePageSizeOptions(pageSizeOptions, effectivePageSize);
  const userBlocked = disabled || readOnly || loading && disableNavigationWhileLoading;
  const nativeDisabled = disabled || loading && disableNavigationWhileLoading;
  const resolvedMode = mode === 'auto' ? responsiveInput || shouldUsePagerInput(effectivePageCount, switchToInputBoxPageCount) ? 'inputBox' : 'numericButtons' : mode;
  const showEdges = !autoHideNavigationButtons || resolvedMode !== 'numericButtons' || window.count < effectivePageCount;
  const draftText = draft ?? String(toDisplayPageNumber(activePageIndex));

  const navigate = (requested: number, reason: CgPagerNavigationReason, userInitiated = true): boolean => {
    if (disabled || userInitiated && (readOnly || loading && disableNavigationWhileLoading)) return false;
    const target = clampPageIndex(requested, effectivePageCount);
    if (target === activePageIndex) return false;
    const details = { previousPageIndex: activePageIndex, pageIndex: target, reason };
    if (!controlledPage) setOwnedPageIndex(target);
    onPageIndexChange?.(target, details);
    setDraft(null);
    setInputError('');
    return true;
  };

  useEffect(() => {
    const target = clampPageIndex(requestedPageIndex, effectivePageCount);
    if (target === requestedPageIndex) { clampProposal.current = ''; return; }
    const key = `${effectivePageCount}:${requestedPageIndex}`;
    if (clampProposal.current === key) return;
    clampProposal.current = key;
    if (!controlledPage) queueMicrotask(() => setOwnedPageIndex(target));
    onPageIndexChange?.(target, { previousPageIndex: requestedPageIndex, pageIndex: target, reason: 'pageCountClamp' });
  }, [controlledPage, effectivePageCount, onPageIndexChange, requestedPageIndex]);

  useEffect(() => {
    if (mode !== 'auto' || typeof ResizeObserver === 'undefined' || !rootRef.current) return;
    const element = rootRef.current;
    const update = (width: number) => {
      const commit = () => { frame.current = null; setResponsiveInput(width < minimumNumericWidth); };
      if (typeof requestAnimationFrame === 'function') {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(commit);
      } else commit();
    };
    const observer = new ResizeObserver((entries) => { const entry = entries[0]; if (entry) update(entry.contentRect.width); });
    observer.observe(element);
    update(element.getBoundingClientRect().width);
    return () => { observer.disconnect(); if (frame.current !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame.current); };
  }, [minimumNumericWidth, mode]);

  const setSize = (nextInput: number): boolean => {
    if (disabled || !Number.isSafeInteger(nextInput) || nextInput <= 0) return false;
    const next = normalizePageSize(nextInput);
    if (next === effectivePageSize) return false;
    let target = preserveFirstVisibleItemOnPageSizeChange ? preserveFirstItemPageIndex(activePageIndex, effectivePageSize, next) : 0;
    if (totalItemCount !== undefined) target = clampPageIndex(target, calculatePageCount(totalItemCount, next));
    else target = clampPageIndex(target, effectivePageCount);
    if (!controlledSize) setOwnedPageSize(next);
    if (!controlledPage) setOwnedPageIndex(target);
    onPageSizeChange?.(next, { previousPageSize: effectivePageSize, pageSize: next, previousPageIndex: activePageIndex, pageIndex: target, preserveFirstVisibleItem: preserveFirstVisibleItemOnPageSizeChange });
    setDraft(null);
    setInputError('');
    return true;
  };

  const commitDraft = () => {
    const display = parsePagerDisplayNumber(draftText);
    if (display === null) {
      const message = format(labels.invalidPageNumber, effectivePageCount);
      setInputError(message);
      onInvalidInput?.(draftText);
      return;
    }
    const target = clampPageIndex(toPageIndex(display), effectivePageCount);
    navigate(target, 'inputCommit');
    setDraft(null);
    setInputError('');
  };

  const focusPage = (index: number) => {
    const target = clampPageIndex(index, effectivePageCount);
    const focus = () => rootRef.current?.querySelector<HTMLButtonElement>(`button[data-page-index="${target}"]`)?.focus();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focus); else queueMicrotask(focus);
  };

  const keyboardNavigate = (event: KeyboardEvent<HTMLElement>) => {
    let target: number | undefined;
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') target = activePageIndex - 1;
    else if (event.key === 'ArrowRight' || event.key === 'PageDown') target = activePageIndex + 1;
    else if (event.key === 'Home') target = 0;
    else if (event.key === 'End') target = Math.max(0, effectivePageCount - 1);
    if (target === undefined) return;
    event.preventDefault();
    const clamped = clampPageIndex(target, effectivePageCount);
    if (navigate(clamped, 'keyboard')) focusPage(clamped);
  };

  useImperativeHandle(actionsRef, () => ({
    focus: () => { if (inputRef.current) inputRef.current.focus(); else (rootRef.current?.querySelector<HTMLElement>('button[aria-current="page"], button, select, input'))?.focus(); },
    goToPage: (index) => navigate(index, 'programmatic', false),
    goToFirstPage: () => navigate(0, 'programmatic', false),
    goToLastPage: () => navigate(Math.max(0, effectivePageCount - 1), 'programmatic', false),
    goToPreviousPage: () => navigate(activePageIndex - 1, 'programmatic', false),
    goToNextPage: () => navigate(activePageIndex + 1, 'programmatic', false),
    setPageSize: setSize,
    getPageIndex: () => activePageIndex,
    getPageCount: () => effectivePageCount,
  } satisfies CgPagerActions));

  const navigationButton = (label: string, glyph: string, target: number, reason: CgPagerNavigationReason, unavailable: boolean) => <CgButton size={size} appearance="outline" aria-label={label} aria-disabled={readOnly || undefined} disabled={nativeDisabled || unavailable} onClick={() => { navigate(target, reason); }}>{glyph}</CgButton>;
  const numericButtons = Array.from({ length: window.count }, (_, offset) => window.start + offset).map((index) => {
    const active = index === activePageIndex;
    const label = format(active ? labels.currentPage : labels.goToPage, toDisplayPageNumber(index));
    const context: CgPagerButtonContext = { pageIndex: index, displayPageNumber: toDisplayPageNumber(index), active, disabled: userBlocked, accessibleLabel: label, navigate: () => { navigate(index, 'numericButton'); } };
    if (renderNumericButton) return <span key={index}>{renderNumericButton(context)}</span>;
    return <button key={index} type="button" className={styles.button} data-page-index={index} data-active={active || undefined} aria-current={active ? 'page' : undefined} aria-label={label} aria-disabled={readOnly || undefined} disabled={nativeDisabled} tabIndex={active ? 0 : -1} onKeyDown={keyboardNavigate} onClick={() => navigate(index, 'numericButton')}>{toDisplayPageNumber(index)}</button>;
  });
  const statusId = `${pagerId}-status`;
  const errorId = `${statusId}-error`;
  const navigation = <div className={styles.navigation} data-cg-pager-navigation="">
    {showEdges && showFirstButton ? navigationButton(labels.firstPage, '«', 0, 'firstButton', activePageIndex <= 0) : null}
    {showEdges && showPreviousButton ? navigationButton(labels.previousPage, direction === 'rtl' ? '›' : '‹', activePageIndex - 1, 'previousButton', activePageIndex <= 0) : null}
    {resolvedMode === 'numericButtons' ? <div className={styles.numeric}>{numericButtons}</div> : resolvedMode === 'inputBox' ? <div className={styles.inputGroup}><span>{labels.page}</span><input ref={inputRef} className={styles.input} value={draftText} inputMode="numeric" aria-label={labels.page} aria-invalid={Boolean(inputError) || undefined} aria-describedby={classes(statusId, inputError && errorId)} disabled={nativeDisabled} readOnly={readOnly} onFocus={(event) => event.currentTarget.select()} onChange={(event) => { setDraft(event.currentTarget.value); setInputError(''); }} onBlur={commitDraft} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitDraft(); } else if (event.key === 'Escape') { event.preventDefault(); setDraft(null); setInputError(''); } }} /><span id={statusId}>{labels.of} {effectivePageCount}</span>{inputError ? <span id={errorId} className={styles.error} role="alert">{inputError}</span> : null}</div> : <span id={statusId} data-cg-pager-status="">{format(labels.pageOf, toDisplayPageNumber(activePageIndex), effectivePageCount)}</span>}
    {showEdges && showNextButton ? navigationButton(labels.nextPage, direction === 'rtl' ? '‹' : '›', activePageIndex + 1, 'nextButton', activePageIndex >= effectivePageCount - 1) : null}
    {showEdges && showLastButton ? navigationButton(labels.lastPage, '»', Math.max(0, effectivePageCount - 1), 'lastButton', activePageIndex >= effectivePageCount - 1) : null}
  </div>;
  const summaryContext = { pageIndex: activePageIndex, displayPageNumber: toDisplayPageNumber(activePageIndex), pageCount: effectivePageCount, totalItemCount, range, pageSize: effectivePageSize };
  const summary = totalItemCount === undefined ? format(labels.pageOf, summaryContext.displayPageNumber, effectivePageCount) : totalItemCount <= 0 ? labels.noItems : format(labels.itemsOf, range.first, range.last, totalItemCount);

  if (layout === 'compact' && resolvedMode === 'pageStatus') return <nav ref={rootRef} className={classes(styles.root, className)} style={style} data-testid={testId} data-size={size} data-density={density} dir={direction === 'auto' ? undefined : direction} aria-label={navigationLabel ?? labels.navigation} aria-busy={loading || undefined}>
    {showSummary ? <span className={styles.summary} data-cg-pager-summary="">{renderSummary?.(summaryContext) ?? summary}</span> : null}
    {showPageSizeSelector ? <label>{labels.pageSize} <select value={effectivePageSize} disabled={disabled || loading && disableNavigationWhileLoading} aria-disabled={readOnly || undefined} onChange={(event) => { if (!readOnly) setSize(Number(event.currentTarget.value)); }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : null}
    {showFirstButton ? navigationButton(labels.firstPage, '«', 0, 'firstButton', activePageIndex <= 0) : null}
    {showPreviousButton ? navigationButton(labels.previousPage, '‹', activePageIndex - 1, 'previousButton', activePageIndex <= 0) : null}
    {showNextButton ? navigationButton(labels.nextPage, '›', activePageIndex + 1, 'nextButton', activePageIndex >= effectivePageCount - 1) : null}
    {showLastButton ? navigationButton(labels.lastPage, '»', Math.max(0, effectivePageCount - 1), 'lastButton', activePageIndex >= effectivePageCount - 1) : null}
  </nav>;

  return <nav ref={rootRef} className={classes(styles.root, className)} style={style} data-testid={testId} data-size={size} data-density={density} dir={direction === 'auto' ? undefined : direction} aria-label={navigationLabel ?? labels.navigation} aria-busy={loading || undefined}>
    {navigation}
    {showPageSizeSelector ? <label className={styles.size} data-cg-pager-size="">{labels.pageSize} <select className={styles.select} value={effectivePageSize} disabled={disabled || loading && disableNavigationWhileLoading} aria-disabled={readOnly || undefined} onChange={(event) => { if (!readOnly) setSize(Number(event.currentTarget.value)); }}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label> : null}
    {showSummary ? <div className={styles.summary} data-cg-pager-summary="">{renderSummary?.(summaryContext) ?? summary}</div> : null}
  </nav>;
}
