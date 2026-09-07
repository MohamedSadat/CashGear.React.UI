import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import type { CgDirection } from '../../types';

export type CgPdfZoomMode = 'custom' | 'actualSize' | 'fitWidth' | 'fitPage' | 'fitVisible';
export type CgPdfRotation = 0 | 90 | 180 | 270;
export type CgPdfSidebarMode = 'none' | 'thumbnails' | 'outline';
export type CgPdfOperationStatus = 'succeeded' | 'unavailable' | 'canceled' | 'rejected' | 'failed';
export type CgPdfPasswordReason = 'required' | 'incorrect';
export type CgPdfPageChangeReason = 'load' | 'scroll' | 'navigation' | 'thumbnail' | 'outline' | 'search' | 'binding';
export type CgPdfZoomChangeReason = 'load' | 'command' | 'binding' | 'resize';

export type CgPdfErrorCode =
  | 'none'
  | 'invalidSource'
  | 'unsafeUrl'
  | 'emptyDocument'
  | 'invalidMimeType'
  | 'invalidSignature'
  | 'truncatedDocument'
  | 'documentTooLarge'
  | 'pageLimitExceeded'
  | 'passwordRequired'
  | 'incorrectPassword'
  | 'unsupportedEncryption'
  | 'unsupportedDocument'
  | 'networkFailure'
  | 'providerFailure'
  | 'interopFailure'
  | 'notLoaded'
  | 'canceled';

export interface CgPdfError {
  readonly code: CgPdfErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  /** Diagnostic only. It is never rendered by the default UI. */
  readonly cause?: unknown;
}

export interface CgPdfOperationResult<T = undefined> {
  readonly status: CgPdfOperationStatus;
  readonly succeeded: boolean;
  readonly value?: T;
  readonly error?: CgPdfError;
}

export interface CgPdfSearchResult extends CgPdfOperationResult {
  readonly searchText: string;
  readonly resultIndex: number;
  readonly resultCount: number;
}

export interface CgPdfDocumentInfo {
  readonly pageCount: number;
  readonly sizeBytes: number | null;
  readonly pdfFormatVersion: string | null;
  readonly title: string | null;
  readonly author: string | null;
  readonly subject: string | null;
  readonly keywords: string | null;
  readonly creator: string | null;
  readonly producer: string | null;
  readonly language: string | null;
  readonly creationDate: string | null;
  readonly modifiedDate: string | null;
  readonly isEncrypted: boolean;
  readonly hasOutline: boolean;
  readonly hasForms: boolean;
}

export interface CgPdfLoadContext {
  readonly signal: AbortSignal;
  readonly requestId: number;
}

export type CgPdfProviderResult = Response | Blob | ArrayBuffer | Uint8Array;

interface CgPdfSourceMetadata {
  readonly fileName?: string;
  readonly mimeType?: 'application/pdf' | 'application/octet-stream';
}

export type CgPdfDocumentSource =
  | (CgPdfSourceMetadata & { readonly kind: 'url'; readonly url: string })
  | (CgPdfSourceMetadata & { readonly kind: 'data'; readonly data: Blob | ArrayBuffer | Uint8Array })
  | (CgPdfSourceMetadata & { readonly kind: 'provider'; readonly load: (context: CgPdfLoadContext) => CgPdfProviderResult | PromiseLike<CgPdfProviderResult> });

export interface CgPdfViewerState {
  readonly currentPage: number;
  readonly pageCount: number;
  readonly zoom: number;
  readonly zoomMode: CgPdfZoomMode;
  readonly rotation: CgPdfRotation;
  readonly sidebarMode: CgPdfSidebarMode;
  readonly loading: boolean;
  readonly searchResultIndex: number;
  readonly searchResultCount: number;
}

export interface CgPdfLoadingContext {
  readonly loadedBytes: number;
  readonly totalBytes: number | null;
  readonly percent: number | null;
}

export interface CgPdfPageChangeDetails {
  readonly previousPage: number;
  readonly currentPage: number;
  readonly reason: CgPdfPageChangeReason;
}

export interface CgPdfZoomChangeDetails {
  readonly previousZoom: number;
  readonly zoom: number;
  readonly zoomMode: CgPdfZoomMode;
  readonly reason: CgPdfZoomChangeReason;
}

export interface CgPdfSearchCompleteDetails {
  readonly searchText: string;
  readonly resultIndex: number;
  readonly resultCount: number;
  readonly canceled: boolean;
}

export interface CgPdfDocumentLoadingDetails {
  readonly source: CgPdfDocumentSource;
  readonly generation: number;
}

export interface CgPdfDocumentLoadedDetails {
  readonly documentInfo: CgPdfDocumentInfo;
  readonly generation: number;
}

export interface CgPdfDocumentLoadErrorDetails {
  readonly error: CgPdfError;
  readonly generation: number;
}

export interface CgPdfExternalLinkDetails {
  readonly url: string;
  readonly pageNumber: number;
  readonly openInNewWindow: boolean;
}

export interface CgPdfPrintDetails { readonly pageCount: number }
export interface CgPdfDownloadDetails { readonly fileName: string; readonly sizeBytes: number | null }
export type CgPdfCancelableResult = void | boolean | PromiseLike<void | boolean>;
export type CgPdfDownloadDecision = void | boolean | string | PromiseLike<void | boolean | string>;

export interface CgPdfPasswordContext {
  readonly reason: CgPdfPasswordReason;
  readonly attempt: number;
  readonly submit: (password: string) => Promise<CgPdfOperationResult>;
  readonly cancel: () => Promise<CgPdfOperationResult>;
}

export interface CgPdfErrorContext {
  readonly error: CgPdfError;
  readonly retry: () => Promise<CgPdfOperationResult>;
}

export interface CgPdfPageOverlayContext {
  readonly pageNumber: number;
  readonly pageCount: number;
  readonly actions: CgPdfViewerActions;
}

export interface CgPdfToolbarContext {
  readonly state: CgPdfViewerState;
  readonly actions: CgPdfViewerActions;
}

export interface CgPdfViewerLabels {
  toolbarAriaLabel: string;
  toggleSidebar: string;
  previousPage: string;
  nextPage: string;
  page: string;
  of: string;
  zoomMode: string;
  zoomOut: string;
  zoomIn: string;
  actualSize: string;
  fitWidth: string;
  fitPage: string;
  fitVisible: string;
  rotate: string;
  search: string;
  previousResult: string;
  nextResult: string;
  close: string;
  print: string;
  download: string;
  fullscreen: string;
  loading: string;
  empty: string;
  unableToOpen: string;
  password: string;
  passwordRequired: string;
  passwordIncorrect: string;
  open: string;
  cancel: string;
  retry: string;
  thumbnails: string;
  outline: string;
  navigation: string;
  noOutline: string;
  noResults: string;
  documentLoaded: (pageCount: number) => string;
  pageAnnouncement: (page: number, pageCount: number) => string;
  resultAnnouncement: (index: number, count: number) => string;
}

export interface CgPdfViewerActions {
  load(source: CgPdfDocumentSource): Promise<CgPdfOperationResult>;
  reload(): Promise<CgPdfOperationResult>;
  goToPage(pageNumber: number): Promise<CgPdfOperationResult>;
  nextPage(): Promise<CgPdfOperationResult>;
  previousPage(): Promise<CgPdfOperationResult>;
  firstPage(): Promise<CgPdfOperationResult>;
  lastPage(): Promise<CgPdfOperationResult>;
  zoomIn(): Promise<CgPdfOperationResult>;
  zoomOut(): Promise<CgPdfOperationResult>;
  setZoom(zoom: number): Promise<CgPdfOperationResult>;
  setZoomMode(mode: CgPdfZoomMode): Promise<CgPdfOperationResult>;
  rotateClockwise(): Promise<CgPdfOperationResult>;
  rotateCounterClockwise(): Promise<CgPdfOperationResult>;
  find(text: string): Promise<CgPdfSearchResult>;
  findNext(): Promise<CgPdfSearchResult>;
  findPrevious(): Promise<CgPdfSearchResult>;
  clearSearch(): Promise<CgPdfOperationResult>;
  print(): Promise<CgPdfOperationResult>;
  download(): Promise<CgPdfOperationResult>;
  enterFullscreen(): Promise<CgPdfOperationResult>;
  exitFullscreen(): Promise<CgPdfOperationResult>;
  getDocumentInfo(): CgPdfOperationResult<CgPdfDocumentInfo>;
}

type NativePdfViewerProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'defaultValue' | 'onError'>;

export interface CgPdfViewerProps extends NativePdfViewerProps {
  source?: CgPdfDocumentSource | null;
  defaultSource?: CgPdfDocumentSource | null;
  onSourceChange?: (source: CgPdfDocumentSource | null) => void;
  currentPage?: number;
  defaultCurrentPage?: number;
  onCurrentPageChange?: (page: number, details: CgPdfPageChangeDetails) => void;
  zoom?: number;
  defaultZoom?: number;
  zoomMode?: CgPdfZoomMode;
  defaultZoomMode?: CgPdfZoomMode;
  onZoomChange?: (zoom: number, details: CgPdfZoomChangeDetails) => void;
  rotation?: CgPdfRotation;
  defaultRotation?: CgPdfRotation;
  onRotationChange?: (rotation: CgPdfRotation) => void;
  sidebarMode?: CgPdfSidebarMode;
  defaultSidebarMode?: CgPdfSidebarMode;
  onSidebarModeChange?: (mode: CgPdfSidebarMode) => void;
  searchText?: string;
  defaultSearchText?: string;
  onSearchTextChange?: (text: string) => void;
  fileName?: string;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  pageSpacing?: CSSProperties['gap'];
  minimumZoom?: number;
  maximumZoom?: number;
  zoomStep?: number;
  maximumDocumentBytes?: number;
  maximumPageCount?: number;
  assetBaseUrl?: string;
  showToolbar?: boolean;
  showSidebar?: boolean;
  showPageNumbers?: boolean;
  showTextLayer?: boolean;
  showAnnotationLayer?: boolean;
  continuousScroll?: boolean;
  allowSearch?: boolean;
  allowPrint?: boolean;
  allowDownload?: boolean;
  allowFullscreen?: boolean;
  allowTextSelection?: boolean;
  allowExternalLinks?: boolean;
  allowFormFields?: boolean;
  openExternalLinksInNewWindow?: boolean;
  disabled?: boolean;
  direction?: CgDirection;
  ariaLabel?: string;
  labels?: Partial<CgPdfViewerLabels>;
  actionsRef?: Ref<CgPdfViewerActions>;
  renderToolbar?: (context: CgPdfToolbarContext) => ReactNode;
  renderLoading?: (context: CgPdfLoadingContext) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderError?: (context: CgPdfErrorContext) => ReactNode;
  renderPassword?: (context: CgPdfPasswordContext) => ReactNode;
  renderPageOverlay?: (context: CgPdfPageOverlayContext) => ReactNode;
  onDocumentLoading?: (details: CgPdfDocumentLoadingDetails) => CgPdfCancelableResult;
  onDocumentLoaded?: (details: CgPdfDocumentLoadedDetails) => void;
  onDocumentLoadError?: (details: CgPdfDocumentLoadErrorDetails) => void;
  onSearchComplete?: (details: CgPdfSearchCompleteDetails) => void;
  onExternalLinkOpening?: (details: CgPdfExternalLinkDetails) => CgPdfCancelableResult;
  onPasswordRequested?: (context: CgPdfPasswordContext) => void;
  onPrintRequested?: (details: CgPdfPrintDetails) => CgPdfCancelableResult;
  onDownloadRequested?: (details: CgPdfDownloadDetails) => CgPdfDownloadDecision;
}
