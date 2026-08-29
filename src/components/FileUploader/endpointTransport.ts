import type { CgStoredFile } from './CgFileUploader.types';
import { sha256Hex } from './fileFingerprint';

export interface PersistedUploadSession {
  readonly itemId: string;
  readonly endpoint: string;
  readonly uploadId: string;
  readonly sessionToken: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
  readonly lastModified: string;
  readonly fingerprint: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly chunkSize?: number;
  readonly expiresAtUtc?: string;
  readonly receivedChunks: ReadonlyArray<number>;
  readonly chunkCount?: number;
}

export interface EndpointUploadOptions {
  readonly endpoint: string;
  readonly credentials: RequestCredentials;
  readonly persistenceKey?: string;
  readonly enablePersistence: boolean;
  readonly maxRetries: number;
  readonly baseDelay: number;
  readonly signal: AbortSignal;
  readonly itemId: string;
  readonly file: File;
  readonly fingerprint: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly session?: PersistedUploadSession;
  readonly reportProgress: (progress: number) => void;
  readonly sessionUpdated?: (session: PersistedUploadSession) => void;
}

export interface EndpointUploadResult {
  readonly uploadId: string;
  readonly sessionToken: string;
  readonly storedFile?: CgStoredFile;
}

interface Antiforgery { headerName: string; requestToken: string }
interface InitiateResponse {
  state: string; uploadId: string; sessionToken: string; chunkSize?: number; expiresAtUtc?: string;
  receivedChunks?: number[]; storedFile?: CgStoredFile;
}

class HttpError extends Error {
  readonly status: number;
  readonly retryAfter: number;
  constructor(message: string, status: number, retryAfter = 0) { super(message); this.status = status; this.retryAfter = retryAfter; }
}

const antiforgeryCache = new Map<string, Promise<Antiforgery>>();
const storageKey = (key: string) => `cg-fileuploader:v2:${key}`;

export function normalizeEndpoint(value: string): string { return value.trim().replace(/\/+$/u, ''); }

function abortError(): DOMException { return new DOMException('The operation was aborted.', 'AbortError'); }
function abortReason(signal: AbortSignal): Error { return signal.reason instanceof Error ? signal.reason : abortError(); }
function throwIfAborted(signal: AbortSignal): void { if (signal.aborted) throw signal.reason ?? abortError(); }

function parseRetryAfter(value: string | null): number {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

async function responseMessage(response: Response): Promise<string> {
  const fallback = `Upload request failed (${response.status}).`;
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('json')) return fallback;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object') {
      for (const key of ['detail', 'title', 'errorMessage', 'message'] as const) {
        const candidate = (body as Record<string, unknown>)[key];
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
      }
    }
  } catch { /* Deliberately use the normalized fallback. */ }
  return fallback;
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof HttpError)) return false;
  return error.status === 0 || error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
}

async function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    const abort = () => { window.clearTimeout(timer); reject(abortReason(signal)); };
    const timer = window.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function retry<T>(operation: () => Promise<T>, retries: number, baseDelay: number, signal: AbortSignal): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    throwIfAborted(signal);
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransient(error)) throw error;
      const retryAfter = error instanceof HttpError ? error.retryAfter : 0;
      const jitter = 0.8 + Math.random() * 0.4;
      await abortableDelay(retryAfter || Math.round(baseDelay * 2 ** attempt * jitter), signal);
    }
  }
  throw lastError;
}

function antiforgery(endpoint: string, credentials: RequestCredentials, signal: AbortSignal): Promise<Antiforgery> {
  const key = `${endpoint}\u001f${credentials}`;
  const existing = antiforgeryCache.get(key);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`${endpoint}/antiforgery`, { credentials, signal });
    if (!response.ok) throw new HttpError(await responseMessage(response), response.status, parseRetryAfter(response.headers.get('retry-after')));
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') throw new Error('Upload antiforgery response is invalid.');
    const headerName = (body as Record<string, unknown>).headerName;
    const requestToken = (body as Record<string, unknown>).requestToken;
    if (typeof headerName !== 'string' || !headerName || typeof requestToken !== 'string' || !requestToken) throw new Error('Upload antiforgery response is invalid.');
    return { headerName, requestToken };
  })();
  antiforgeryCache.set(key, request);
  void request.catch(() => antiforgeryCache.delete(key));
  return request;
}

async function jsonRequest<T>(
  url: string, method: string, body: unknown, endpoint: string, credentials: RequestCredentials,
  sessionToken: string | undefined, retries: number, baseDelay: number, signal: AbortSignal,
): Promise<T> {
  return retry(async () => {
    const anti = await antiforgery(endpoint, credentials, signal);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', [anti.headerName]: anti.requestToken };
    if (sessionToken) headers['X-CG-Upload-Token'] = sessionToken;
    let response: Response;
    try { response = await fetch(url, { method, credentials, headers, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
    catch (error) { if (signal.aborted) throw signal.reason ?? abortError(); throw new HttpError(error instanceof Error ? error.message : 'Network error.', 0); }
    if (!response.ok) throw new HttpError(await responseMessage(response), response.status, parseRetryAfter(response.headers.get('retry-after')));
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  }, retries, baseDelay, signal);
}

function validStoredFile(value: unknown): value is CgStoredFile {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' && Boolean(item.id) && typeof item.location === 'string' && typeof item.name === 'string'
    && typeof item.size === 'number' && Number.isFinite(item.size) && item.size >= 0 && typeof item.contentType === 'string'
    && validMetadata(item.metadata);
}

function validMetadata(value: unknown): value is Readonly<Record<string, string>> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value as Record<string, unknown>).every(([key, item]) => Boolean(key.trim()) && typeof item === 'string');
}

function validChunks(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0);
}

function validateInitiate(value: unknown): InitiateResponse {
  if (!value || typeof value !== 'object') throw new Error('Upload initiation response is invalid.');
  const item = value as Record<string, unknown>;
  if ((item.state !== 'uploading' && item.state !== 'succeeded') || typeof item.uploadId !== 'string' || !item.uploadId
    || typeof item.sessionToken !== 'string' || !item.sessionToken
    || (item.chunkSize !== undefined && (!Number.isInteger(item.chunkSize) || (item.chunkSize as number) <= 0))
    || (item.receivedChunks !== undefined && !validChunks(item.receivedChunks))
    || (item.expiresAtUtc !== undefined && (typeof item.expiresAtUtc !== 'string' || !Number.isFinite(Date.parse(item.expiresAtUtc))))) throw new Error('Upload initiation response is invalid.');
  if (item.storedFile !== undefined && !validStoredFile(item.storedFile)) throw new Error('Upload initiation stored-file response is invalid.');
  return item as unknown as InitiateResponse;
}

function validateStatus(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') throw new Error('Upload status response is invalid.');
  const item = value as Record<string, unknown>;
  if ((item.state !== 'uploading' && item.state !== 'succeeded')
    || (item.chunkSize !== undefined && (!Number.isInteger(item.chunkSize) || (item.chunkSize as number) <= 0))
    || (item.receivedChunks !== undefined && !validChunks(item.receivedChunks))
    || (item.storedFile !== undefined && !validStoredFile(item.storedFile))) throw new Error('Upload status response is invalid.');
  return item;
}

function parseSessions(key: string): PersistedUploadSession[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey(key)) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is PersistedUploadSession => {
      if (!value || typeof value !== 'object') return false;
      const item = value as Record<string, unknown>;
      return typeof item.itemId === 'string' && Boolean(item.itemId) && typeof item.endpoint === 'string' && Boolean(item.endpoint)
        && typeof item.uploadId === 'string' && Boolean(item.uploadId) && typeof item.sessionToken === 'string' && Boolean(item.sessionToken)
        && typeof item.name === 'string' && typeof item.size === 'number' && Number.isFinite(item.size) && item.size >= 0
        && typeof item.contentType === 'string' && typeof item.lastModified === 'string' && Number.isFinite(Date.parse(item.lastModified))
        && typeof item.fingerprint === 'string' && Boolean(item.fingerprint) && validMetadata(item.metadata) && validChunks(item.receivedChunks)
        && (item.chunkSize === undefined || (Number.isInteger(item.chunkSize) && (item.chunkSize as number) > 0))
        && (item.chunkCount === undefined || (Number.isInteger(item.chunkCount) && (item.chunkCount as number) > 0))
        && (item.expiresAtUtc === undefined || (typeof item.expiresAtUtc === 'string' && Number.isFinite(Date.parse(item.expiresAtUtc))));
    });
  } catch { return []; }
}

function writeSessions(key: string, sessions: ReadonlyArray<PersistedUploadSession>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (sessions.length === 0) sessionStorage.removeItem(storageKey(key));
    else sessionStorage.setItem(storageKey(key), JSON.stringify(sessions));
  } catch { /* Persistence is a progressive enhancement. */ }
}

export function recoverSessions(endpoint: string, key: string | undefined): PersistedUploadSession[] {
  if (!key) return [];
  const now = Date.now();
  const sessions = parseSessions(key).filter((session) => session.endpoint === endpoint && (!session.expiresAtUtc || Date.parse(session.expiresAtUtc) > now));
  writeSessions(key, sessions);
  return sessions;
}

export function saveSession(key: string | undefined, session: PersistedUploadSession): void {
  if (!key) return;
  const sessions = parseSessions(key).filter((item) => item.itemId !== session.itemId && item.fingerprint !== session.fingerprint);
  writeSessions(key, [...sessions, session]);
}

export function removeSession(key: string | undefined, itemId: string, uploadId?: string): void {
  if (!key) return;
  writeSessions(key, parseSessions(key).filter((item) => item.itemId !== itemId && item.uploadId !== uploadId));
}

export function clearSessions(key: string | undefined): void { if (key) writeSessions(key, []); }

async function uploadChunk(
  url: string, bytes: ArrayBuffer, hash: string, endpoint: string, credentials: RequestCredentials,
  sessionToken: string, retries: number, baseDelay: number, signal: AbortSignal, onProgress: (loaded: number) => void,
): Promise<void> {
  return retry(async () => {
    const anti = await antiforgery(endpoint, credentials, signal);
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      signal.addEventListener('abort', abort, { once: true });
      xhr.open('PUT', url, true);
      xhr.withCredentials = credentials === 'include';
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.setRequestHeader('X-CG-Chunk-SHA256', hash);
      xhr.setRequestHeader('X-CG-Upload-Token', sessionToken);
      xhr.setRequestHeader(anti.headerName, anti.requestToken);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded); };
      xhr.onload = () => {
        signal.removeEventListener('abort', abort);
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new HttpError(`Chunk upload failed (${xhr.status}).`, xhr.status, parseRetryAfter(xhr.getResponseHeader('Retry-After'))));
      };
      xhr.onerror = () => { signal.removeEventListener('abort', abort); reject(new HttpError('Network error while uploading a chunk.', 0)); };
      xhr.onabort = () => { signal.removeEventListener('abort', abort); reject(signal.aborted ? abortReason(signal) : new HttpError('Upload was interrupted.', 0)); };
      xhr.send(new Uint8Array(bytes));
    });
  }, retries, baseDelay, signal);
}

export async function uploadEndpointFile(options: EndpointUploadOptions): Promise<EndpointUploadResult> {
  const endpoint = normalizeEndpoint(options.endpoint);
  let session = options.session;
  if (!session) {
    const initiated = validateInitiate(await jsonRequest<unknown>(endpoint, 'POST', {
      clientUploadId: options.itemId, name: options.file.name, size: options.file.size,
      contentType: options.file.type || 'application/octet-stream', lastModified: new Date(options.file.lastModified).toISOString(),
      fingerprint: options.fingerprint, metadata: options.metadata,
    }, endpoint, options.credentials, undefined, options.maxRetries, options.baseDelay, options.signal));
    if (initiated.state === 'succeeded') return { uploadId: initiated.uploadId, sessionToken: initiated.sessionToken, storedFile: initiated.storedFile };
    if (!initiated.chunkSize || initiated.chunkSize <= 0) throw new Error('Upload initiation response has an invalid chunk size.');
    session = {
      itemId: options.itemId, endpoint, uploadId: initiated.uploadId, sessionToken: initiated.sessionToken,
      name: options.file.name, size: options.file.size, contentType: options.file.type || 'application/octet-stream',
      lastModified: new Date(options.file.lastModified).toISOString(), fingerprint: options.fingerprint, metadata: options.metadata,
      chunkSize: initiated.chunkSize, expiresAtUtc: initiated.expiresAtUtc, receivedChunks: initiated.receivedChunks ?? [],
      chunkCount: Math.max(1, Math.ceil(options.file.size / initiated.chunkSize)),
    };
    if (options.enablePersistence) saveSession(options.persistenceKey, session);
    options.sessionUpdated?.(session);
  } else {
    const status = await retry(async () => {
      let response: Response;
      try { response = await fetch(`${endpoint}/${encodeURIComponent(session!.uploadId)}`, { credentials: options.credentials, headers: { 'X-CG-Upload-Token': session!.sessionToken }, signal: options.signal }); }
      catch (error) { if (options.signal.aborted) throw options.signal.reason ?? abortError(); throw new HttpError(error instanceof Error ? error.message : 'Network error.', 0); }
      if (!response.ok) throw new HttpError(await responseMessage(response), response.status, parseRetryAfter(response.headers.get('retry-after')));
      return validateStatus(await response.json());
    }, options.maxRetries, options.baseDelay, options.signal);
    if (status.state === 'succeeded') {
      if (status.storedFile !== undefined && !validStoredFile(status.storedFile)) throw new Error('Upload status stored-file response is invalid.');
      removeSession(options.persistenceKey, session.itemId, session.uploadId);
      return { uploadId: session.uploadId, sessionToken: session.sessionToken, storedFile: status.storedFile };
    }
    const chunkSize = typeof status.chunkSize === 'number' && status.chunkSize > 0 ? status.chunkSize : session.chunkSize;
    if (!chunkSize) throw new Error('Upload status response has no valid chunk size.');
    session = { ...session, chunkSize, receivedChunks: Array.isArray(status.receivedChunks) ? status.receivedChunks.filter(Number.isInteger) as number[] : [], chunkCount: Math.max(1, Math.ceil(options.file.size / chunkSize)) };
    if (options.enablePersistence) saveSession(options.persistenceKey, session);
    options.sessionUpdated?.(session);
  }

  const chunkSize = session.chunkSize!;
  const chunkCount = Math.max(1, Math.ceil(options.file.size / chunkSize));
  const received = new Set(session.receivedChunks);
  const receivedBytes = () => [...received].reduce((total, index) => total + Math.max(0, Math.min(chunkSize, options.file.size - index * chunkSize)), 0);
  for (let index = 0; index < chunkCount; index += 1) {
    throwIfAborted(options.signal);
    if (received.has(index)) continue;
    const start = index * chunkSize;
    const bytes = await options.file.slice(start, Math.min(options.file.size, start + chunkSize)).arrayBuffer();
    const hash = await sha256Hex(bytes);
    const completed = receivedBytes();
    await uploadChunk(`${endpoint}/${encodeURIComponent(session.uploadId)}/chunks/${index}`, bytes, hash, endpoint, options.credentials,
      session.sessionToken, options.maxRetries, options.baseDelay, options.signal,
      (loaded) => options.reportProgress(Math.min(99, Math.floor((completed + loaded) * 100 / Math.max(1, options.file.size)))));
    received.add(index);
    session = { ...session, receivedChunks: [...received].sort((a, b) => a - b), chunkCount };
    if (options.enablePersistence) saveSession(options.persistenceKey, session);
    options.sessionUpdated?.(session);
    options.reportProgress(Math.min(99, Math.floor(receivedBytes() * 100 / Math.max(1, options.file.size))));
  }
  const completion = await jsonRequest<Record<string, unknown>>(`${endpoint}/${encodeURIComponent(session.uploadId)}/complete`, 'POST', { chunkCount }, endpoint,
    options.credentials, session.sessionToken, options.maxRetries, options.baseDelay, options.signal);
  if (!completion || typeof completion !== 'object' || Array.isArray(completion)) throw new Error('Upload completion response is invalid.');
  if (completion?.storedFile !== undefined && !validStoredFile(completion.storedFile)) throw new Error('Upload completion stored-file response is invalid.');
  removeSession(options.persistenceKey, session.itemId, session.uploadId);
  return { uploadId: session.uploadId, sessionToken: session.sessionToken, storedFile: completion?.storedFile };
}

export async function deleteEndpointUpload(options: {
  endpoint: string; credentials: RequestCredentials; uploadId: string; sessionToken: string;
  retries: number; baseDelay: number; signal: AbortSignal;
}): Promise<void> {
  const endpoint = normalizeEndpoint(options.endpoint);
  await jsonRequest<unknown>(`${endpoint}/${encodeURIComponent(options.uploadId)}`, 'DELETE', undefined, endpoint, options.credentials,
    options.sessionToken, options.retries, options.baseDelay, options.signal);
}
