/* eslint-disable react-hooks/refs -- refs coordinate controller generations, controlled snapshots, and imperative actions without driving renders. */
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useCgId, useControllableState, useDirection, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgIcon } from '../Icon';
import { CgToolbar } from '../Toolbar';
import type { CgToolbarItem } from '../Toolbar';
import './PdfViewer.css';
import type {
  CgPdfDocumentInfo,
  CgPdfDocumentSource,
  CgPdfError,
  CgPdfOperationResult,
  CgPdfPasswordContext,
  CgPdfPasswordReason,
  CgPdfRotation,
  CgPdfSearchResult,
  CgPdfSidebarMode,
  CgPdfViewerActions,
  CgPdfViewerLabels,
  CgPdfViewerProps,
  CgPdfViewerState,
  CgPdfZoomMode,
} from './CgPdfViewer.types';
import {
  controllerSidebarMode,
  controllerZoomMode,
  DEFAULT_MAXIMUM_DOCUMENT_BYTES,
  DEFAULT_MAXIMUM_PAGE_COUNT,
  DEFAULT_PDF_ASSET_BASE_URL,
  documentInfo,
  fromControllerReason,
  fromControllerZoomMode,
  isSafeExternalUrl,
  mapControllerError,
  normalizeDownloadFileName,
  operation,
  pdfError,
  providerBytes,
  successful,
  validateConfiguration,
  validateSource,
} from './model';
import type { PdfController, PdfControllerBridge, PdfLoadOptions } from './pdfController.js';

const PAGE_REASONS = ['load', 'scroll', 'navigation', 'thumbnail', 'outline', 'search', 'binding'] as const;
const ZOOM_REASONS = ['load', 'command', 'binding', 'resize'] as const;

const ENGLISH_LABELS: CgPdfViewerLabels = {
  toolbarAriaLabel: 'PDF viewer toolbar', toggleSidebar: 'Toggle sidebar', previousPage: 'Previous page', nextPage: 'Next page',
  page: 'Page', of: 'of', zoomMode: 'Zoom mode', zoomOut: 'Zoom out', zoomIn: 'Zoom in', actualSize: 'Actual size',
  fitWidth: 'Fit width', fitPage: 'Fit page', fitVisible: 'Fit visible', rotate: 'Rotate clockwise', search: 'Search document',
  previousResult: 'Previous search result', nextResult: 'Next search result', close: 'Close', print: 'Print', download: 'Download',
  fullscreen: 'Fullscreen', loading: 'Loading PDF document...', empty: 'No PDF document selected.', unableToOpen: 'Unable to open PDF',
  password: 'Password', passwordRequired: 'This document requires a password.', passwordIncorrect: 'The password is incorrect. Try again.',
  open: 'Open document', cancel: 'Cancel', retry: 'Retry', thumbnails: 'Thumbnails', outline: 'Outline', navigation: 'PDF navigation',
  noOutline: 'This document has no outline.', noResults: 'No results', documentLoaded: (count) => `Document loaded. ${count} pages.`,
  pageAnnouncement: (page, count) => `Page ${page} of ${count}.`, resultAnnouncement: (index, count) => count === 0 ? 'No search results.' : `Search result ${index} of ${count}.`,
};

function mimeType(source: CgPdfDocumentSource, supplied?: string): string {
  const isBlob = source.kind === 'data' && typeof Blob !== 'undefined' && source.data instanceof Blob;
  return source.mimeType ?? supplied ?? (isBlob && source.data.type ? source.data.type : 'application/pdf');
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function CgPdfViewer(inputProps: CgPdfViewerProps) {
  const {
    source: controlledSource,
    defaultSource = null,
    onSourceChange,
    currentPage: controlledPage,
    defaultCurrentPage = 1,
    onCurrentPageChange: _onCurrentPageChange,
    zoom: controlledZoom,
    defaultZoom = 1,
    zoomMode: controlledZoomMode,
    defaultZoomMode = 'fitWidth',
    onZoomChange: _onZoomChange,
    rotation: controlledRotation,
    defaultRotation = 0,
    onRotationChange,
    sidebarMode: controlledSidebarMode,
    defaultSidebarMode = 'none',
    onSidebarModeChange,
    searchText: controlledSearchText,
    defaultSearchText = '',
    onSearchTextChange,
    fileName,
    width = '100%',
    height = '40rem',
    pageSpacing = '1rem',
    minimumZoom = .25,
    maximumZoom = 5,
    zoomStep = .1,
    maximumDocumentBytes = DEFAULT_MAXIMUM_DOCUMENT_BYTES,
    maximumPageCount = DEFAULT_MAXIMUM_PAGE_COUNT,
    assetBaseUrl = DEFAULT_PDF_ASSET_BASE_URL,
    showToolbar = true,
    showSidebar = true,
    showPageNumbers = true,
    showTextLayer = true,
    showAnnotationLayer = true,
    continuousScroll = true,
    allowSearch = true,
    allowPrint = true,
    allowDownload = true,
    allowFullscreen = true,
    allowTextSelection = true,
    allowExternalLinks = false,
    allowFormFields = false,
    openExternalLinksInNewWindow = true,
    disabled = false,
    direction: directionProp = 'auto',
    ariaLabel = 'PDF viewer',
    labels: labelOverrides,
    actionsRef,
    renderToolbar,
    renderLoading,
    renderEmpty,
    renderError,
    renderPassword,
    renderPageOverlay,
    onDocumentLoading: _onDocumentLoading,
    onDocumentLoaded: _onDocumentLoaded,
    onDocumentLoadError: _onDocumentLoadError,
    onSearchComplete: _onSearchComplete,
    onExternalLinkOpening: _onExternalLinkOpening,
    onPasswordRequested: _onPasswordRequested,
    onPrintRequested,
    onDownloadRequested,
    className,
    style,
    id,
    onKeyDown,
    ...nativeProps
  } = inputProps;

  const labels = { ...ENGLISH_LABELS, ...labelOverrides };
  const rootId = useCgId(id);
  const rootRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const direction = useDirection(rootRef, directionProp);

  const [source, setSource] = useControllableState(controlledSource, defaultSource, 'CgPdfViewer.source');
  const [currentPage, setCurrentPage] = useControllableState(controlledPage, defaultCurrentPage, 'CgPdfViewer.currentPage');
  const [zoom, setZoomState] = useControllableState(controlledZoom, defaultZoom, 'CgPdfViewer.zoom');
  const [zoomMode, setZoomModeState] = useControllableState(controlledZoomMode, defaultZoomMode, 'CgPdfViewer.zoomMode');
  const [rotation, setRotationState] = useControllableState(controlledRotation, defaultRotation, 'CgPdfViewer.rotation');
  const [sidebarMode, setSidebarModeState] = useControllableState(controlledSidebarMode, defaultSidebarMode, 'CgPdfViewer.sidebarMode');
  const [searchText, setSearchTextState] = useControllableState(controlledSearchText, defaultSearchText, 'CgPdfViewer.searchText');
  const [pageCount, setPageCount] = useState(0);
  const [document, setDocument] = useState<CgPdfDocumentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CgPdfError | null>(null);
  const [loadedBytes, setLoadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState<number | null>(null);
  const [searchResultIndex, setSearchResultIndex] = useState(0);
  const [searchResultCount, setSearchResultCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [passwordRequest, setPasswordRequest] = useState<{ reason: CgPdfPasswordReason; attempt: number } | null>(null);
  const [password, setPassword] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [controllerRevision, setControllerRevision] = useState(0);

  validateConfiguration({ minimumZoom, maximumZoom, zoomStep, maximumDocumentBytes, maximumPageCount, zoom, currentPage, rotation, zoomMode, sidebarMode, assetBaseUrl });
  if (source) validateSource(source);

  const controllerRef = useRef<PdfController | null>(null);
  const generationRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const sourceRef = useRef(source);
  const currentPageRef = useRef(currentPage);
  const zoomRef = useRef(zoom);
  const zoomModeRef = useRef(zoomMode);
  const rotationRef = useRef(rotation);
  const sidebarModeRef = useRef(sidebarMode);
  const searchTextRef = useRef(searchText);
  const documentRef = useRef(document);
  const pageCountRef = useRef(pageCount);
  const searchResultIndexRef = useRef(searchResultIndex);
  const searchResultCountRef = useRef(searchResultCount);
  const disabledRef = useRef(disabled);
  const propsRef = useRef(inputProps);
  sourceRef.current = source;
  currentPageRef.current = currentPage;
  zoomRef.current = zoom;
  zoomModeRef.current = zoomMode;
  rotationRef.current = rotation;
  sidebarModeRef.current = sidebarMode;
  searchTextRef.current = searchText;
  documentRef.current = document;
  pageCountRef.current = pageCount;
  searchResultIndexRef.current = searchResultIndex;
  searchResultCountRef.current = searchResultCount;
  disabledRef.current = disabled;
  propsRef.current = inputProps;

  const clearDocumentState = useStableCallback(() => {
    documentRef.current = null; pageCountRef.current = 0; searchResultIndexRef.current = 0; searchResultCountRef.current = 0;
    setDocument(null); setPageCount(0); setError(null); setLoading(false); setLoadedBytes(0); setTotalBytes(null);
    setSearchResultIndex(0); setSearchResultCount(0); setPasswordRequest(null); setPassword(''); setAnnouncement('');
  });

  const invokeBoolean = useStableCallback(async (method: keyof PdfController, args: unknown[] = [], requireDocument = true): Promise<CgPdfOperationResult> => {
    const controller = controllerRef.current;
    if (!controller || disabledRef.current || (requireDocument && pageCountRef.current === 0)) return operation('unavailable', pdfError('notLoaded', 'The requested PDF operation is unavailable.'));
    try {
      const result = await (controller[method] as (...values: unknown[]) => Promise<boolean>)(...args);
      return result ? successful() : operation('unavailable');
    } catch (cause) { return operation('failed', pdfError('interopFailure', 'The browser PDF operation failed.', cause)); }
  });

  const submitPassword = useStableCallback(async (value: string): Promise<CgPdfOperationResult> => {
    const controller = controllerRef.current;
    if (!controller || !passwordRequest) return operation('unavailable', pdfError('notLoaded', 'No password is requested.'));
    setPassword(''); setPasswordRequest(null);
    try { return await controller.submitPassword(value) ? successful() : operation('failed'); }
    catch (cause) { return operation('failed', pdfError('interopFailure', undefined, cause)); }
  });

  const cancelPassword = useStableCallback(async (): Promise<CgPdfOperationResult> => {
    setPassword(''); setPasswordRequest(null);
    return invokeBoolean('cancelPassword', [], false);
  });

  const passwordContext = useStableCallback((reason: CgPdfPasswordReason, attempt: number): CgPdfPasswordContext => Object.freeze({ reason, attempt, submit: submitPassword, cancel: cancelPassword }));

  const loadSource = useStableCallback(async (nextSource: CgPdfDocumentSource): Promise<CgPdfOperationResult> => {
    validateSource(nextSource);
    sourceRef.current = nextSource;
    const controller = controllerRef.current;
    if (!controller) return operation('unavailable', pdfError('notLoaded', 'The PDF viewer is not ready.'));
    loadAbortRef.current?.abort();
    const aborter = new AbortController();
    loadAbortRef.current = aborter;
    const generation = ++generationRef.current;
    clearDocumentState(); setLoading(true);
    try {
      const accepted = await propsRef.current.onDocumentLoading?.(Object.freeze({ source: nextSource, generation }));
      if (accepted === false) {
        if (generation === generationRef.current) { await controller.clear(generation); setLoading(false); }
        return operation('rejected');
      }
      if (generation !== generationRef.current || aborter.signal.aborted) return operation('canceled');
      await controller.clear(generation);
      if (generation !== generationRef.current || aborter.signal.aborted) return operation('canceled');
      let result;
      const loadOptions: PdfLoadOptions = {
        maximumBytes: maximumDocumentBytes, maximumPages: maximumPageCount, mimeType: mimeType(nextSource),
        fileName: fileName ?? nextSource.fileName, currentPage: currentPageRef.current, zoom: zoomRef.current,
        zoomMode: controllerZoomMode(zoomModeRef.current), rotation: rotationRef.current,
        sidebarMode: controllerSidebarMode(sidebarModeRef.current), continuousScroll,
      };
      if (nextSource.kind === 'url') {
        result = await controller.loadUrl(nextSource.url.trim(), generation, loadOptions);
      } else {
        const supplied = nextSource.kind === 'provider'
          ? await nextSource.load(Object.freeze({ signal: aborter.signal, requestId: generation }))
          : nextSource.data;
        const binary = await providerBytes(supplied, aborter.signal, maximumDocumentBytes, (loaded, total) => {
          if (generation === generationRef.current) { setLoadedBytes(loaded); setTotalBytes(total); }
        });
        loadOptions.mimeType = mimeType(nextSource, binary.mimeType);
        result = await controller.loadStream({ arrayBuffer: () => Promise.resolve(binary.bytes.slice().buffer) }, generation, loadOptions);
      }
      if (generation !== generationRef.current || aborter.signal.aborted || result.canceled) return operation('canceled');
      if (!result.succeeded || !result.documentInfo) {
        const nextError = mapControllerError(result.errorCode, result.errorMessage);
        setLoading(false); setError(nextError);
        propsRef.current.onDocumentLoadError?.(Object.freeze({ error: nextError, generation }));
        return operation('failed', nextError);
      }
      const info = documentInfo(result.documentInfo);
      documentRef.current = info; pageCountRef.current = info.pageCount;
      setDocument(info); setPageCount(info.pageCount); setLoading(false); setError(null); setAnnouncement(labels.documentLoaded(info.pageCount));
      propsRef.current.onDocumentLoaded?.(Object.freeze({ documentInfo: info, generation }));
      return successful();
    } catch (cause) {
      if (generation !== generationRef.current || aborter.signal.aborted || isAbort(cause)) return operation('canceled');
      const nextError = cause instanceof RangeError ? pdfError('documentTooLarge', undefined, cause) : pdfError('providerFailure', undefined, cause);
      setLoading(false); setError(nextError);
      propsRef.current.onDocumentLoadError?.(Object.freeze({ error: nextError, generation }));
      return operation('failed', nextError);
    }
  });

  const dispatchBridge = useStableCallback(async (method: string, ...args: unknown[]): Promise<unknown> => {
    if (method === 'OnPageChangedAsync') {
      const [generation, value, reason] = args;
      if (Number(generation) !== generationRef.current || !Number.isInteger(value) || Number(value) < 1) return null;
      const next = Number(value); const previous = currentPageRef.current;
      if (next !== previous) {
        setCurrentPage(next); currentPageRef.current = controlledPage === undefined ? next : previous;
        const details = Object.freeze({ previousPage: previous, currentPage: next, reason: fromControllerReason(reason, PAGE_REASONS, 'scroll') });
        propsRef.current.onCurrentPageChange?.(next, details); setAnnouncement(labels.pageAnnouncement(next, pageCountRef.current));
        if (controlledPage !== undefined && controlledPage !== next) void controllerRef.current?.goToPage(controlledPage, 'Binding');
      }
    } else if (method === 'OnZoomChangedAsync') {
      const [generation, value, mode, reason] = args; const next = Number(value);
      if (Number(generation) !== generationRef.current || !Number.isFinite(next)) return null;
      const previous = zoomRef.current; const nextMode = fromControllerZoomMode(mode);
      setZoomState(next); setZoomModeState(nextMode);
      if (controlledZoom === undefined) zoomRef.current = next;
      if (controlledZoomMode === undefined) zoomModeRef.current = nextMode;
      propsRef.current.onZoomChange?.(next, Object.freeze({ previousZoom: previous, zoom: next, zoomMode: nextMode, reason: fromControllerReason(reason, ZOOM_REASONS, 'command') }));
      if (controlledZoomMode !== undefined && controlledZoomMode !== nextMode) void controllerRef.current?.setZoomMode(controllerZoomMode(controlledZoomMode), 'Binding');
      else if (controlledZoom !== undefined && controlledZoom !== next) void controllerRef.current?.setZoom(controlledZoom, 'Binding');
    } else if (method === 'OnSearchCompletedAsync') {
      const [generation, text, index, count] = args;
      if (Number(generation) !== generationRef.current) return null;
      const nextIndex = Math.max(0, Number(index) || 0); const nextCount = Math.max(0, Number(count) || 0);
      searchResultIndexRef.current = nextIndex; searchResultCountRef.current = nextCount;
      setSearchResultIndex(nextIndex); setSearchResultCount(nextCount); setAnnouncement(labels.resultAnnouncement(nextIndex, nextCount));
      propsRef.current.onSearchComplete?.(Object.freeze({ searchText: typeof text === 'string' ? text : '', resultIndex: nextIndex, resultCount: nextCount, canceled: false }));
    } else if (method === 'OnLoadProgressAsync') {
      const [generation, loaded, total] = args;
      if (Number(generation) === generationRef.current) { setLoadedBytes(Math.max(0, Number(loaded) || 0)); setTotalBytes(Number(total) > 0 ? Number(total) : null); }
    } else if (method === 'OnPasswordRequestedAsync') {
      const [generation, reason] = args;
      if (Number(generation) !== generationRef.current) return null;
      const nextReason: CgPdfPasswordReason = String(reason).toLocaleLowerCase() === 'incorrect' ? 'incorrect' : 'required';
      const attempt = (passwordRequest?.attempt ?? 0) + 1; const request = { reason: nextReason, attempt };
      setPassword(''); setPasswordRequest(request);
      const context = passwordContext(nextReason, attempt); propsRef.current.onPasswordRequested?.(context);
      setTimeout(() => passwordInputRef.current?.focus(), 0);
    } else if (method === 'OnOpenSearchRequestedAsync') {
      if (!disabledRef.current && propsRef.current.allowSearch !== false) { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 0); }
    } else if (method === 'OnExternalLinkOpeningAsync') {
      const [generation, url, page] = args; const target = typeof url === 'string' ? url : '';
      if (Number(generation) !== generationRef.current || propsRef.current.allowExternalLinks !== true || !isSafeExternalUrl(target)) return false;
      const accepted = await propsRef.current.onExternalLinkOpening?.(Object.freeze({ url: target, pageNumber: Number(page) || 1, openInNewWindow: propsRef.current.openExternalLinksInNewWindow !== false }));
      return accepted !== false;
    }
    return null;
  });

  useEffect(() => {
    let disposed = false;
    const bridge: PdfControllerBridge = { invokeMethodAsync: dispatchBridge };
    void import('./pdfController.js').then(async ({ create }) => {
      if (disposed || !rootRef.current || !viewportRef.current || !pagesRef.current) return;
      try {
        const controller = await create(rootRef.current, viewportRef.current, pagesRef.current, sidebarRef.current, bridge, {
          assetBaseUrl, minimumZoom, maximumZoom, zoom: zoomRef.current, zoomMode: controllerZoomMode(zoomModeRef.current),
          rotation: rotationRef.current, currentPage: currentPageRef.current, continuousScroll, showTextLayer, showAnnotationLayer,
          allowTextSelection, allowExternalLinks, allowFormFields, openExternalLinksInNewWindow, showPageNumbers,
          rightToLeft: direction === 'rtl', noOutlineText: labels.noOutline,
        });
        if (disposed) { await controller.dispose(); return; }
        controllerRef.current = controller; setControllerRevision((value) => value + 1);
      } catch (cause) {
        if (disposed) return;
        const nextError = pdfError('interopFailure', undefined, cause); setError(nextError); setLoading(false);
        propsRef.current.onDocumentLoadError?.(Object.freeze({ error: nextError, generation: generationRef.current }));
      }
    }).catch((cause: unknown) => {
      if (!disposed) { const nextError = pdfError('interopFailure', undefined, cause); setError(nextError); setLoading(false); }
    });
    return () => {
      disposed = true; generationRef.current += 1; loadAbortRef.current?.abort();
      const controller = controllerRef.current; controllerRef.current = null; if (controller) void controller.dispose();
    };
  }, [allowExternalLinks, allowFormFields, allowTextSelection, assetBaseUrl, continuousScroll, direction, dispatchBridge, labels.noOutline, maximumZoom, minimumZoom, openExternalLinksInNewWindow, showAnnotationLayer, showPageNumbers, showSidebar, showTextLayer]);

  const lastEffectLoad = useRef<{ controller: PdfController | null; source: CgPdfDocumentSource | null | undefined }>({ controller: null, source: undefined });
  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || controllerRevision === 0 || (lastEffectLoad.current.controller === controller && lastEffectLoad.current.source === source)) return;
    lastEffectLoad.current = { controller, source };
    if (source) void loadSource(source);
    else { generationRef.current += 1; loadAbortRef.current?.abort(); clearDocumentState(); void controller.clear(generationRef.current); }
  }, [clearDocumentState, controllerRevision, loadSource, source]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || controllerRevision === 0 || pageCount === 0) return;
    void (async () => {
      if (controlledRotation !== undefined) await controller.setRotation(controlledRotation);
      if (controlledZoomMode !== undefined) {
        if (controlledZoomMode === 'custom' && controlledZoom !== undefined) await controller.setZoom(controlledZoom, 'Binding');
        else await controller.setZoomMode(controllerZoomMode(controlledZoomMode), 'Binding');
      } else if (controlledZoom !== undefined) await controller.setZoom(controlledZoom, 'Binding');
      if (controlledPage !== undefined) await controller.goToPage(controlledPage, 'Binding');
      if (controlledSidebarMode !== undefined) await controller.setSidebarMode(controllerSidebarMode(controlledSidebarMode));
    })();
  }, [controlledPage, controlledRotation, controlledSidebarMode, controlledZoom, controlledZoomMode, controllerRevision, pageCount]);

  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = disabled;
  }, [disabled]);

  const changeSidebar = async (mode: CgPdfSidebarMode): Promise<CgPdfOperationResult> => {
    if (disabled || !showSidebar || !controllerRef.current) return operation('unavailable');
    try {
      await controllerRef.current.setSidebarMode(controllerSidebarMode(mode)); setSidebarModeState(mode); onSidebarModeChange?.(mode);
      if (controlledSidebarMode !== undefined && controlledSidebarMode !== mode) await controllerRef.current.setSidebarMode(controllerSidebarMode(controlledSidebarMode));
      return successful();
    } catch (cause) { return operation('failed', pdfError('interopFailure', undefined, cause)); }
  };

  const changeRotation = async (next: CgPdfRotation): Promise<CgPdfOperationResult> => {
    const result = await invokeBoolean('setRotation', [next]);
    if (result.succeeded) {
      setRotationState(next); onRotationChange?.(next);
      if (controlledRotation !== undefined && controlledRotation !== next) await controllerRef.current?.setRotation(controlledRotation);
    }
    return result;
  };

  const find = async (text: string, previous = false): Promise<CgPdfSearchResult> => {
    if (!allowSearch || disabled || pageCount === 0) return Object.freeze({ ...operation('unavailable'), searchText: text, resultIndex: 0, resultCount: 0 });
    setSearchTextState(text); onSearchTextChange?.(text);
    const result = await invokeBoolean('find', [text, previous]);
    return Object.freeze({ ...result, searchText: text, resultIndex: searchResultIndexRef.current, resultCount: searchResultCountRef.current });
  };

  const actions: CgPdfViewerActions = {
    load: async (next) => {
      validateSource(next); setSource(next); onSourceChange?.(next);
      lastEffectLoad.current = { controller: controllerRef.current, source: next };
      return loadSource(next);
    },
    reload: async () => sourceRef.current ? loadSource(sourceRef.current) : operation('unavailable', pdfError('notLoaded', 'There is no PDF source to reload.')),
    goToPage: async (page) => Number.isInteger(page) && page >= 1 && page <= pageCountRef.current ? invokeBoolean('goToPage', [page]) : operation('unavailable'),
    nextPage: async () => actions.goToPage(currentPageRef.current + 1), previousPage: async () => actions.goToPage(currentPageRef.current - 1),
    firstPage: async () => actions.goToPage(1), lastPage: async () => actions.goToPage(pageCountRef.current),
    zoomIn: async () => actions.setZoom(zoomRef.current + zoomStep), zoomOut: async () => actions.setZoom(zoomRef.current - zoomStep),
    setZoom: async (value) => Number.isFinite(value) ? invokeBoolean('setZoom', [Math.max(minimumZoom, Math.min(maximumZoom, value))]) : operation('rejected', pdfError('invalidSource', 'Zoom must be finite.')),
    setZoomMode: async (mode) => invokeBoolean('setZoomMode', [controllerZoomMode(mode)]),
    rotateClockwise: async () => changeRotation(((rotationRef.current + 90) % 360) as CgPdfRotation),
    rotateCounterClockwise: async () => changeRotation(((rotationRef.current + 270) % 360) as CgPdfRotation),
    find: async (text) => find(text), findNext: async () => find(searchTextRef.current), findPrevious: async () => find(searchTextRef.current, true),
    clearSearch: async () => { setSearchTextState(''); onSearchTextChange?.(''); setSearchResultIndex(0); setSearchResultCount(0); return invokeBoolean('clearSearch'); },
    print: async () => {
      if (!allowPrint || disabled || pageCountRef.current === 0) return operation('unavailable');
      if (await onPrintRequested?.(Object.freeze({ pageCount: pageCountRef.current })) === false) return operation('rejected');
      return invokeBoolean('print');
    },
    download: async () => {
      if (!allowDownload || disabled || pageCountRef.current === 0) return operation('unavailable');
      let name = normalizeDownloadFileName(fileName ?? sourceRef.current?.fileName);
      const decision = await onDownloadRequested?.(Object.freeze({ fileName: name, sizeBytes: documentRef.current?.sizeBytes ?? null }));
      if (decision === false) return operation('rejected'); if (typeof decision === 'string') name = normalizeDownloadFileName(decision);
      return invokeBoolean('download', [name]);
    },
    enterFullscreen: async () => allowFullscreen ? invokeBoolean('enterFullscreen', [], false) : operation('unavailable'),
    exitFullscreen: async () => invokeBoolean('exitFullscreen', [], false),
    getDocumentInfo: () => documentRef.current ? successful(documentRef.current) : operation('unavailable', pdfError('notLoaded', 'No PDF is loaded.')),
  };
  useImperativeHandle(actionsRef, () => actions);

  const viewerState: CgPdfViewerState = Object.freeze({ currentPage, pageCount, zoom, zoomMode, rotation, sidebarMode, loading, searchResultIndex, searchResultCount });
  const canUseToolbar = !disabled && !loading && pageCount > 0 && !error;
  const toolbarItems: ReadonlyArray<CgToolbarItem> = [
    { name: 'sidebar', text: labels.toggleSidebar, tooltip: labels.toggleSidebar, icon: <CgIcon name="sidebar" />, visible: showSidebar, disabled: !canUseToolbar, adaptivePriority: 1, onClick: async () => { await changeSidebar(sidebarMode === 'none' ? 'thumbnails' : 'none'); } },
    { name: 'previous', text: labels.previousPage, tooltip: labels.previousPage, icon: <CgIcon name="chevron-start" />, disabled: !canUseToolbar || currentPage <= 1, adaptivePriority: 5, onClick: async () => { await actions.previousPage(); } },
    { name: 'page', disabled: !canUseToolbar, overflowBehavior: 'never', render: () => <label className="cg-pdf-viewer__page-control"><span className="cg-pdf-viewer__sr-only">{labels.page}</span><input className="cg-pdf-viewer__page-input" inputMode="numeric" value={currentPage} min={1} max={Math.max(1, pageCount)} disabled={!canUseToolbar} aria-label={labels.page} onChange={(event) => { const page = Number(event.currentTarget.value); if (Number.isInteger(page)) void actions.goToPage(page); }} /><span aria-hidden="true">{labels.of} {pageCount}</span></label> },
    { name: 'next', text: labels.nextPage, tooltip: labels.nextPage, icon: <CgIcon name="chevron-end" />, disabled: !canUseToolbar || currentPage >= pageCount, adaptivePriority: 5, onClick: async () => { await actions.nextPage(); } },
    { name: 'zoom-out', text: labels.zoomOut, tooltip: labels.zoomOut, icon: <CgIcon name="zoom-out" />, disabled: !canUseToolbar || zoom <= minimumZoom, adaptivePriority: 4, onClick: async () => { await actions.zoomOut(); } },
    { name: 'zoom-mode', disabled: !canUseToolbar, adaptivePriority: 3, render: () => <label className="cg-pdf-viewer__zoom-mode"><span className="cg-pdf-viewer__sr-only">{labels.zoomMode}</span><select value={zoomMode} disabled={!canUseToolbar} aria-label={labels.zoomMode} onChange={(event) => { void actions.setZoomMode(event.currentTarget.value as CgPdfZoomMode); }}><option value="custom">{Math.round(zoom * 100)}%</option><option value="actualSize">{labels.actualSize}</option><option value="fitWidth">{labels.fitWidth}</option><option value="fitPage">{labels.fitPage}</option><option value="fitVisible">{labels.fitVisible}</option></select></label> },
    { name: 'zoom-in', text: labels.zoomIn, tooltip: labels.zoomIn, icon: <CgIcon name="zoom-in" />, disabled: !canUseToolbar || zoom >= maximumZoom, adaptivePriority: 4, onClick: async () => { await actions.zoomIn(); } },
    { name: 'rotate', text: labels.rotate, tooltip: labels.rotate, icon: <CgIcon name="rotate" />, disabled: !canUseToolbar, adaptivePriority: 2, onClick: async () => { await actions.rotateClockwise(); } },
    { name: 'search', text: labels.search, tooltip: labels.search, icon: <CgIcon name="search" />, disabled: !canUseToolbar || !allowSearch, adaptivePriority: 2, onClick: () => { setSearchOpen((value) => !value); setTimeout(() => searchInputRef.current?.focus(), 0); } },
    { name: 'print', text: labels.print, tooltip: labels.print, icon: <CgIcon name="print" />, disabled: !canUseToolbar || !allowPrint, adaptivePriority: 0, alignment: 'end', onClick: async () => { await actions.print(); } },
    { name: 'download', text: labels.download, tooltip: labels.download, icon: <CgIcon name="download" />, disabled: !canUseToolbar || !allowDownload, adaptivePriority: 0, alignment: 'end', onClick: async () => { await actions.download(); } },
    { name: 'fullscreen', text: labels.fullscreen, tooltip: labels.fullscreen, icon: <CgIcon name="fullscreen" />, disabled: !canUseToolbar || !allowFullscreen, adaptivePriority: 1, alignment: 'end', onClick: async () => { await actions.enterFullscreen(); } },
  ];

  const loadingContext = Object.freeze({ loadedBytes, totalBytes, percent: totalBytes && totalBytes > 0 ? Math.max(0, Math.min(100, Math.floor(loadedBytes * 100 / totalBytes))) : null });
  const passwordUiContext = passwordRequest ? passwordContext(passwordRequest.reason, passwordRequest.attempt) : null;
  const resolvedStyle = { ...style, width, height, '--cg-pdf-page-spacing': pageSpacing } as CSSProperties;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled || event.key !== 'Escape') return;
    if (passwordRequest) { event.preventDefault(); void cancelPassword(); }
    else if (searchOpen) { event.preventDefault(); setSearchOpen(false); void actions.clearSearch(); }
    else if (sidebarMode !== 'none') { event.preventDefault(); void changeSidebar('none'); }
  };

  const submitSearch = (event: FormEvent) => { event.preventDefault(); void actions.find(searchText); };

  return <section {...nativeProps} ref={rootRef} id={rootId} className={cx('cg-pdf-viewer', disabled && 'cg-pdf-viewer--disabled', direction === 'rtl' && 'cg-pdf-viewer--rtl', className)} style={resolvedStyle} dir={direction} aria-label={ariaLabel} aria-busy={loading} aria-disabled={disabled} data-cg-pdf-viewer="" data-cg-pdf-generation={generationRef.current} onKeyDown={handleKeyDown}>
    {showToolbar ? <div className="cg-pdf-viewer__toolbar-host">{renderToolbar ? renderToolbar({ state: viewerState, actions }) : <CgToolbar ariaLabel={labels.toolbarAriaLabel} autoCollapseText autoOverflow minimumVisibleItemCount={2} direction={direction} items={toolbarItems} />}</div> : null}
    {searchOpen && allowSearch ? <form className="cg-pdf-viewer__search" role="search" onSubmit={submitSearch}><label><span className="cg-pdf-viewer__sr-only">{labels.search}</span><input ref={searchInputRef} value={searchText} onChange={(event) => { setSearchTextState(event.currentTarget.value); onSearchTextChange?.(event.currentTarget.value); }} type="search" autoComplete="off" disabled={disabled} aria-label={labels.search} /></label><span className="cg-pdf-viewer__search-count" aria-live="polite">{searchResultCount === 0 ? labels.noResults : `${searchResultIndex} ${labels.of} ${searchResultCount}`}</span><CgButton disabled={searchResultCount === 0 || disabled} onClick={async () => { await actions.findPrevious(); }}>{labels.previousResult}</CgButton><CgButton disabled={searchResultCount === 0 || disabled} onClick={async () => { await actions.findNext(); }}>{labels.nextResult}</CgButton><CgButton disabled={disabled} onClick={() => { setSearchOpen(false); void actions.clearSearch(); }}>{labels.close}</CgButton></form> : null}
    <div className="cg-pdf-viewer__body">
      {showSidebar ? <aside ref={sidebarRef} className="cg-pdf-viewer__sidebar" hidden={sidebarMode === 'none'} aria-label={labels.navigation} data-cg-pdf-sidebar=""><div className="cg-pdf-viewer__sidebar-tabs" role="tablist" aria-label={labels.navigation}><button id={`${rootId}-thumbnails-tab`} type="button" role="tab" aria-controls={`${rootId}-sidebar-panel`} aria-selected={sidebarMode === 'thumbnails'} tabIndex={sidebarMode === 'thumbnails' ? 0 : -1} disabled={disabled} onClick={() => { void changeSidebar('thumbnails'); }}>{labels.thumbnails}</button><button id={`${rootId}-outline-tab`} type="button" role="tab" aria-controls={`${rootId}-sidebar-panel`} aria-selected={sidebarMode === 'outline'} tabIndex={sidebarMode === 'outline' ? 0 : -1} disabled={disabled} onClick={() => { void changeSidebar('outline'); }}>{labels.outline}</button></div><div id={`${rootId}-sidebar-panel`} className="cg-pdf-viewer__sidebar-content" role="tabpanel" aria-labelledby={`${rootId}-${sidebarMode === 'outline' ? 'outline' : 'thumbnails'}-tab`} data-cg-pdf-sidebar-content="" /></aside> : null}
      <div className="cg-pdf-viewer__viewport"><div ref={viewportRef} className="cg-pdf-viewer__scroll-host" role="group" tabIndex={disabled ? -1 : 0} aria-label={`${ariaLabel} document pages`} data-cg-pdf-viewport=""><div ref={pagesRef} className="cg-pdf-viewer__pages pdfViewer" data-cg-pdf-pages="" /></div>
        {renderPageOverlay && pageCount > 0 ? <div className="cg-pdf-viewer__page-overlay">{renderPageOverlay({ pageNumber: currentPage, pageCount, actions })}</div> : null}
        {!source && !loading && !error ? <div className="cg-pdf-viewer__state cg-pdf-viewer__empty" role="status">{renderEmpty?.() ?? labels.empty}</div> : null}
        {loading ? <div className="cg-pdf-viewer__state cg-pdf-viewer__loading" role="status" aria-live="polite">{renderLoading?.(loadingContext) ?? <><span className="cg-pdf-viewer__spinner" aria-hidden="true" /><span>{labels.loading}</span></>}</div> : null}
        {error && !loading ? <div className="cg-pdf-viewer__state cg-pdf-viewer__error" role="alert">{renderError?.({ error, retry: async () => actions.reload() }) ?? <><strong>{labels.unableToOpen}</strong><span>{error.message}</span>{error.recoverable ? <CgButton disabled={disabled} onClick={async () => { await actions.reload(); }}>{labels.retry}</CgButton> : null}</>}</div> : null}
      </div>
    </div>
    {passwordRequest && passwordUiContext ? <div className="cg-pdf-viewer__password-backdrop"><div className="cg-pdf-viewer__password" role="dialog" aria-modal="true" aria-labelledby={`${rootId}-password-title`}>{renderPassword?.(passwordUiContext) ?? <><h2 id={`${rootId}-password-title`}>{passwordRequest.reason === 'incorrect' ? labels.passwordIncorrect : labels.passwordRequired}</h2><label><span>{labels.password}</span><input ref={passwordInputRef} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} onKeyDown={(event) => { if (event.key === 'Enter' && password) void submitPassword(password); else if (event.key === 'Escape') void cancelPassword(); }} /></label><div className="cg-pdf-viewer__password-actions"><CgButton onClick={async () => { await cancelPassword(); }}>{labels.cancel}</CgButton><CgButton disabled={!password} onClick={async () => { await submitPassword(password); }}>{labels.open}</CgButton></div></>}</div></div> : null}
    <div className="cg-pdf-viewer__announcements" aria-live="polite" aria-atomic="true">{announcement}</div>
  </section>;
}
