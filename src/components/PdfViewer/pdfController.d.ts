export interface PdfControllerOptions {
  assetBaseUrl: string;
  minimumZoom: number;
  maximumZoom: number;
  zoom: number;
  zoomMode: string;
  rotation: number;
  currentPage: number;
  continuousScroll: boolean;
  showTextLayer: boolean;
  showAnnotationLayer: boolean;
  allowTextSelection: boolean;
  allowExternalLinks: boolean;
  allowFormFields: boolean;
  openExternalLinksInNewWindow: boolean;
  showPageNumbers: boolean;
  rightToLeft: boolean;
  noOutlineText: string;
}

export interface PdfLoadOptions {
  maximumBytes: number;
  maximumPages: number;
  mimeType: string;
  fileName?: string;
  currentPage: number;
  zoom: number;
  zoomMode: string;
  rotation: number;
  sidebarMode: string;
  continuousScroll: boolean;
}

export interface PdfJsDocumentInfo {
  pageCount: number;
  sizeBytes: number | null;
  pdfFormatVersion: string | null;
  title: string | null;
  author: string | null;
  subject: string | null;
  keywords: string | null;
  creator: string | null;
  producer: string | null;
  language: string | null;
  creationDate: string | null;
  modifiedDate: string | null;
  isEncrypted: boolean;
  hasOutline: boolean;
  hasForms: boolean;
}

export interface PdfLoadResult {
  succeeded: boolean;
  canceled: boolean;
  errorCode?: string;
  errorMessage?: string;
  documentInfo?: PdfJsDocumentInfo;
}

export interface PdfControllerBridge {
  invokeMethodAsync(method: string, ...args: unknown[]): Promise<unknown>;
}

export interface PdfController {
  clear(generation: number): Promise<boolean>;
  loadUrl(value: string, generation: number, options: PdfLoadOptions): Promise<PdfLoadResult>;
  loadStream(stream: { arrayBuffer(): Promise<ArrayBuffer> }, generation: number, options: PdfLoadOptions): Promise<PdfLoadResult>;
  goToPage(pageNumber: number, reason?: string): Promise<boolean>;
  setZoom(zoom: number, reason?: string): Promise<boolean>;
  setZoomMode(mode: string, reason?: string): Promise<boolean>;
  setRotation(rotation: number): Promise<boolean>;
  find(text: string, previous: boolean): Promise<boolean>;
  clearSearch(): Promise<boolean>;
  setSidebarMode(mode: string): Promise<void>;
  submitPassword(password: string): Promise<boolean>;
  cancelPassword(): Promise<boolean>;
  download(fileName: string): Promise<boolean>;
  print(): Promise<boolean>;
  enterFullscreen(): Promise<boolean>;
  exitFullscreen(): Promise<boolean>;
  dispose(): Promise<void>;
}

export function create(
  root: HTMLElement,
  viewport: HTMLElement,
  viewerElement: HTMLElement,
  sidebar: HTMLElement | null,
  bridge: PdfControllerBridge,
  options: PdfControllerOptions,
): Promise<PdfController>;
