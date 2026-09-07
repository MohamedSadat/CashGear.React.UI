import type {
  CgPdfDocumentInfo,
  CgPdfDocumentSource,
  CgPdfError,
  CgPdfErrorCode,
  CgPdfOperationResult,
  CgPdfProviderResult,
  CgPdfRotation,
  CgPdfSidebarMode,
  CgPdfZoomMode,
} from './CgPdfViewer.types';
import type { PdfJsDocumentInfo } from './pdfController.js';

export const DEFAULT_PDF_ASSET_BASE_URL = '/cashgear-ui/pdfjs/';
export const DEFAULT_MAXIMUM_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MAXIMUM_PAGE_COUNT = 2_000;

const MIME_TYPES = new Set(['application/pdf', 'application/octet-stream']);
const ERROR_CODES: Record<string, CgPdfErrorCode> = {
  None: 'none', InvalidSource: 'invalidSource', UnsafeUrl: 'unsafeUrl', EmptyDocument: 'emptyDocument',
  InvalidMimeType: 'invalidMimeType', InvalidSignature: 'invalidSignature', TruncatedDocument: 'truncatedDocument',
  DocumentTooLarge: 'documentTooLarge', PageLimitExceeded: 'pageLimitExceeded', PasswordRequired: 'passwordRequired',
  IncorrectPassword: 'incorrectPassword', UnsupportedEncryption: 'unsupportedEncryption', UnsupportedDocument: 'unsupportedDocument',
  NetworkFailure: 'networkFailure', ProviderFailure: 'providerFailure', InteropFailure: 'interopFailure', NotLoaded: 'notLoaded', Canceled: 'canceled',
};

const SAFE_MESSAGES: Partial<Record<CgPdfErrorCode, string>> = {
  emptyDocument: 'The PDF document is empty.',
  invalidMimeType: 'The supplied media type is not a PDF.',
  invalidSignature: 'The selected file is not a valid PDF document.',
  documentTooLarge: 'The PDF document exceeds the configured size limit.',
  pageLimitExceeded: 'The PDF document exceeds the configured page limit.',
  networkFailure: 'The PDF document could not be downloaded.',
  truncatedDocument: 'The PDF document is incomplete or truncated.',
  unsupportedEncryption: 'The PDF uses unsupported encryption.',
  incorrectPassword: 'The PDF password is incorrect.',
  providerFailure: 'The authorized document provider could not supply the PDF.',
  interopFailure: 'The browser PDF viewer could not be initialized. Verify that its local assets are deployed.',
};

export function successful<T = undefined>(value?: T): CgPdfOperationResult<T> {
  return Object.freeze({ status: 'succeeded', succeeded: true, ...(value === undefined ? {} : { value }) });
}

export function operation<T = undefined>(status: CgPdfOperationResult<T>['status'], error?: CgPdfError): CgPdfOperationResult<T> {
  return Object.freeze({ status, succeeded: false, ...(error ? { error } : {}) });
}

export function pdfError(code: CgPdfErrorCode, message?: string, cause?: unknown): CgPdfError {
  return Object.freeze({ code, message: SAFE_MESSAGES[code] ?? message ?? 'The PDF document could not be opened.', recoverable: code !== 'unsafeUrl', ...(cause === undefined ? {} : { cause }) });
}

export function mapControllerError(code?: string, message?: string): CgPdfError {
  return pdfError((code && ERROR_CODES[code]) || 'unsupportedDocument', message);
}

export function normalizeDownloadFileName(value?: string): string {
  let name = (value ?? '').trim().split(/[\\/]/u).at(-1) ?? '';
  // eslint-disable-next-line no-control-regex -- OS-reserved control characters must not reach download attributes.
  name = name.replace(/[\u0000-\u001f<>:"/\\|?*]/gu, '-').replace(/[ .]+$/u, '');
  if (!name) name = 'document';
  if (name.length > 180) name = name.slice(0, 180).replace(/[ .]+$/u, '');
  while (/\.pdf\.pdf$/iu.test(name)) name = name.slice(0, -4);
  return /\.pdf$/iu.test(name) ? name : `${name}.pdf`;
}

export function isSafeExternalUrl(value: string): boolean {
  try { return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(value).protocol); } catch { return false; }
}

export function validateSource(source: CgPdfDocumentSource): void {
  const isBlob = source.kind === 'data' && typeof Blob !== 'undefined' && source.data instanceof Blob;
  const mime = source.mimeType ?? (isBlob && source.data.type ? source.data.type : 'application/pdf');
  if (!MIME_TYPES.has(mime.toLocaleLowerCase())) throw new Error('CgPdfViewer sources must use application/pdf or application/octet-stream.');
  if (source.kind === 'url') {
    if (!source.url.trim()) throw new Error('CgPdfViewer source URL cannot be empty.');
    try {
      const parsed = new URL(source.url, 'https://cashgear.invalid/');
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('CgPdfViewer source URLs must use HTTP or HTTPS.');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('CgPdfViewer')) throw error;
      throw new Error('CgPdfViewer source URL is invalid.', { cause: error });
    }
  } else if (source.kind === 'provider' && typeof source.load !== 'function') {
    throw new Error('CgPdfViewer provider sources require a load function.');
  }
}

export function validateConfiguration(options: {
  minimumZoom: number; maximumZoom: number; zoomStep: number; maximumDocumentBytes: number; maximumPageCount: number;
  zoom: number; currentPage: number; rotation: CgPdfRotation; zoomMode: CgPdfZoomMode; sidebarMode: CgPdfSidebarMode; assetBaseUrl: string;
}): void {
  if (!Number.isFinite(options.minimumZoom) || !Number.isFinite(options.maximumZoom) || options.minimumZoom <= 0 || options.maximumZoom < options.minimumZoom) throw new Error('CgPdfViewer zoom limits are invalid.');
  if (!Number.isFinite(options.zoomStep) || options.zoomStep <= 0) throw new Error('CgPdfViewer zoomStep must be positive and finite.');
  if (!Number.isFinite(options.zoom) || options.zoom <= 0) throw new Error('CgPdfViewer zoom must be positive and finite.');
  if (!Number.isInteger(options.currentPage) || options.currentPage < 1) throw new Error('CgPdfViewer currentPage must be a positive integer.');
  if (!Number.isSafeInteger(options.maximumDocumentBytes) || options.maximumDocumentBytes <= 0 || !Number.isSafeInteger(options.maximumPageCount) || options.maximumPageCount <= 0) throw new Error('CgPdfViewer document limits must be positive integers.');
  if (![0, 90, 180, 270].includes(options.rotation)) throw new Error('CgPdfViewer rotation is invalid.');
  if (!['custom', 'actualSize', 'fitWidth', 'fitPage', 'fitVisible'].includes(options.zoomMode)) throw new Error('CgPdfViewer zoomMode is invalid.');
  if (!['none', 'thumbnails', 'outline'].includes(options.sidebarMode)) throw new Error('CgPdfViewer sidebarMode is invalid.');
  if (!options.assetBaseUrl.trim()) throw new Error('CgPdfViewer assetBaseUrl cannot be empty.');
}

export function controllerZoomMode(mode: CgPdfZoomMode): string {
  return ({ custom: 'Custom', actualSize: 'ActualSize', fitWidth: 'FitWidth', fitPage: 'FitPage', fitVisible: 'FitVisible' } as const)[mode];
}

export function controllerSidebarMode(mode: CgPdfSidebarMode): string {
  return ({ none: 'None', thumbnails: 'Thumbnails', outline: 'Outline' } as const)[mode];
}

export function fromControllerZoomMode(mode: unknown): CgPdfZoomMode {
  return ({ Custom: 'custom', ActualSize: 'actualSize', FitWidth: 'fitWidth', FitPage: 'fitPage', FitVisible: 'fitVisible' } as const)[String(mode) as 'Custom'] ?? 'custom';
}

export function fromControllerReason<T extends string>(value: unknown, allowed: ReadonlyArray<T>, fallback: T): T {
  const normalized = (typeof value === 'string' ? value : '').replace(/^./u, (letter) => letter.toLocaleLowerCase()) as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function documentInfo(value: PdfJsDocumentInfo): CgPdfDocumentInfo {
  return Object.freeze({ ...value });
}

export async function providerBytes(
  value: CgPdfProviderResult,
  signal: AbortSignal,
  maximumBytes: number,
  progress: (loaded: number, total: number | null) => void,
): Promise<{ bytes: Uint8Array; mimeType?: string }> {
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  if (typeof Response !== 'undefined' && value instanceof Response) {
    if (!value.ok) throw new Error(`PDF provider returned HTTP ${value.status}.`);
    const totalHeader = Number(value.headers.get('content-length'));
    const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
    if (total !== null && total > maximumBytes) throw new RangeError('PDF document exceeds the configured size limit.');
    const mimeType = value.headers.get('content-type')?.split(';', 1)[0]?.trim();
    if (!value.body) {
      const bytes = new Uint8Array(await value.arrayBuffer());
      if (bytes.byteLength > maximumBytes) throw new RangeError('PDF document exceeds the configured size limit.');
      progress(bytes.byteLength, bytes.byteLength);
      return { bytes, mimeType };
    }
    const reader = value.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    const abort = () => { void reader.cancel(); };
    signal.addEventListener('abort', abort, { once: true });
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        loaded += next.value.byteLength;
        if (loaded > maximumBytes) throw new RangeError('PDF document exceeds the configured size limit.');
        chunks.push(next.value);
        progress(loaded, total);
      }
    } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const bytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    progress(loaded, total ?? loaded);
    return { bytes, mimeType };
  }
  const isBlob = typeof Blob !== 'undefined' && value instanceof Blob;
  const buffer = isBlob ? await value.arrayBuffer() : value instanceof Uint8Array ? value.slice().buffer : (value as ArrayBuffer).slice(0);
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > maximumBytes) throw new RangeError('PDF document exceeds the configured size limit.');
  progress(bytes.byteLength, bytes.byteLength);
  return { bytes, mimeType: isBlob && value.type ? value.type : undefined };
}
