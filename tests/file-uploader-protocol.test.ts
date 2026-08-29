import { afterEach, describe, expect, it, vi } from 'vitest';
import { fingerprintFile } from '../src/components/FileUploader/fileFingerprint';
import { clearSessions, deleteEndpointUpload, normalizeEndpoint, recoverSessions, removeSession, saveSession, uploadEndpointFile } from '../src/components/FileUploader/endpointTransport';
import type { PersistedUploadSession } from '../src/components/FileUploader/endpointTransport';

class FakeXhr {
  static requests: FakeXhr[] = [];
  static statuses: number[] = [];
  upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
  status = 200; url = ''; headers: Record<string, string> = {};
  onload: (() => void) | null = null; onerror: (() => void) | null = null; onabort: (() => void) | null = null;
  open(_method: string, url: string) { this.url = url; FakeXhr.requests.push(this); }
  setRequestHeader(key: string, value: string) { this.headers[key] = value; }
  getResponseHeader() { return null; }
  send(body: ArrayBufferView) { this.status = FakeXhr.statuses.shift() ?? 200; this.upload.onprogress?.({ lengthComputable: true, loaded: body.byteLength } as ProgressEvent); queueMicrotask(() => this.onload?.()); }
  abort() { this.onabort?.(); }
  withCredentials = false;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('FileUploader endpoint protocol', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); FakeXhr.requests = []; FakeXhr.statuses = []; sessionStorage.clear(); });

  it('matches the Blazor bounded fingerprint algorithm', async () => {
    const file = new File(['abcdef'], 'a.txt', { lastModified: 123 });
    const first = await fingerprintFile(file); const second = await fingerprintFile(file);
    expect(first).toHaveLength(64); expect(second).toBe(first);
    expect(await fingerprintFile(new File(['abcdeg'], 'a.txt', { lastModified: 123 }))).not.toBe(first);
  });

  it('normalizes, persists, filters, and removes resumable sessions', () => {
    const session: PersistedUploadSession = { itemId: 'one', endpoint: '/api/upload', uploadId: 'up', sessionToken: 'secret', name: 'a', size: 1, contentType: 'text/plain', lastModified: new Date().toISOString(), fingerprint: 'fp', metadata: {}, receivedChunks: [] };
    expect(normalizeEndpoint(' /api/upload/// ')).toBe('/api/upload');
    saveSession('test', session); expect(recoverSessions('/api/upload', 'test')).toHaveLength(1);
    expect(recoverSessions('/other', 'test')).toHaveLength(0);
    saveSession('test', session); removeSession('test', 'one', 'up'); expect(recoverSessions('/api/upload', 'test')).toEqual([]);
    saveSession('test', session); clearSessions('test'); expect(sessionStorage.getItem('cg-fileuploader:v2:test')).toBeNull();
  });

  it('drops corrupt, expired, and endpoint-incompatible persisted state', () => {
    sessionStorage.setItem('cg-fileuploader:v2:corrupt', '{bad json');
    expect(recoverSessions('/api/upload', 'corrupt')).toEqual([]);
    expect(sessionStorage.getItem('cg-fileuploader:v2:corrupt')).toBeNull();
    saveSession('expired', { itemId: 'old', endpoint: '/api/upload', uploadId: 'old-up', sessionToken: 'old-token', name: 'old.txt', size: 2, contentType: 'text/plain', lastModified: new Date(0).toISOString(), fingerprint: 'old-fp', metadata: {}, expiresAtUtc: new Date(1).toISOString(), receivedChunks: [] });
    expect(recoverSessions('/api/upload', 'expired')).toEqual([]);
    expect(sessionStorage.getItem('cg-fileuploader:v2:expired')).toBeNull();
  });

  it('uploads chunks with antiforgery, checksums, progress, and completion', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-Test-CSRF', requestToken: 'csrf' });
      if (path === '/api/upload' && init?.method === 'POST') return json({ state: 'uploading', uploadId: 'upload-1', sessionToken: 'private-token', chunkSize: 3, receivedChunks: [] });
      if (path.endsWith('/complete')) return json({ storedFile: { id: 'stored-1', location: '/stored/1', name: 'a.txt', size: 4, contentType: 'text/plain', metadata: {} } });
      throw new Error(`Unexpected fetch: ${path}`);
    }));
    const progress = vi.fn();
    const result = await uploadEndpointFile({ endpoint: '/api/upload/', credentials: 'same-origin', enablePersistence: true, persistenceKey: 'run', maxRetries: 0, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'item-1', file: new File(['abcd'], 'a.txt', { type: 'text/plain', lastModified: 100 }), fingerprint: 'fingerprint', metadata: {}, reportProgress: progress });
    expect(FakeXhr.requests).toHaveLength(2);
    expect(FakeXhr.requests[0]?.headers).toMatchObject({ 'X-CG-Upload-Token': 'private-token', 'X-Test-CSRF': 'csrf' });
    expect(FakeXhr.requests[0]?.headers['X-CG-Chunk-SHA256']).toHaveLength(64);
    expect(result.storedFile?.id).toBe('stored-1');
    expect(JSON.stringify(result.storedFile)).not.toContain('private-token');
    expect(progress).toHaveBeenCalled();
    expect(sessionStorage.getItem('cg-fileuploader:v2:run')).toBeNull();
  });

  it('represents an empty file with one zero-length chunk', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      if (path === '/api/empty' && init?.method === 'POST') return json({ state: 'uploading', uploadId: 'empty', sessionToken: 'token', chunkSize: 5, receivedChunks: [] });
      if (path.endsWith('/complete')) return json({});
      throw new Error(path);
    }));
    await uploadEndpointFile({ endpoint: '/api/empty', credentials: 'same-origin', enablePersistence: false, maxRetries: 0, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'empty-item', file: new File([], 'empty.txt'), fingerprint: 'empty-fp', metadata: {}, reportProgress: vi.fn() });
    expect(FakeXhr.requests).toHaveLength(1);
  });

  it('recovers endpoint status and skips chunks already accepted by the server', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path === '/api/resume/up-1' && !init?.method) return json({ state: 'uploading', chunkSize: 3, receivedChunks: [0] });
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      if (path.endsWith('/complete')) return json({ storedFile: { id: 'resumed', location: '/resumed', name: 'resume.txt', size: 6, contentType: 'text/plain', metadata: {} } });
      throw new Error(path);
    }));
    const session: PersistedUploadSession = { itemId: 'resume-item', endpoint: '/api/resume', uploadId: 'up-1', sessionToken: 'resume-token', name: 'resume.txt', size: 6, contentType: 'text/plain', lastModified: new Date(100).toISOString(), fingerprint: 'resume-fp', metadata: {}, chunkSize: 3, chunkCount: 2, receivedChunks: [] };
    const result = await uploadEndpointFile({ endpoint: '/api/resume', credentials: 'same-origin', enablePersistence: true, persistenceKey: 'resume', maxRetries: 0, baseDelay: 0,
      signal: new AbortController().signal, itemId: session.itemId, file: new File(['abcdef'], 'resume.txt', { type: 'text/plain', lastModified: 100 }), fingerprint: session.fingerprint, metadata: {}, session, reportProgress: vi.fn() });
    expect(FakeXhr.requests).toHaveLength(1);
    expect(FakeXhr.requests[0]?.url).toMatch(/chunks\/1$/u);
    expect(result.storedFile?.id).toBe('resumed');
  });

  it('retries transient chunk failures but not permanent failures', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      if (path === '/api/retry' && init?.method === 'POST') return json({ state: 'uploading', uploadId: 'retry-up', sessionToken: 'retry-token', chunkSize: 4, receivedChunks: [] });
      if (path.endsWith('/complete')) return json({});
      throw new Error(path);
    }));
    FakeXhr.statuses = [500, 200];
    await uploadEndpointFile({ endpoint: '/api/retry', credentials: 'same-origin', enablePersistence: false, maxRetries: 1, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'retry-item', file: new File(['body'], 'retry.txt'), fingerprint: 'retry-fp', metadata: {}, reportProgress: vi.fn() });
    expect(FakeXhr.requests).toHaveLength(2);

    FakeXhr.requests = []; FakeXhr.statuses = [400];
    await expect(uploadEndpointFile({ endpoint: '/api/retry', credentials: 'same-origin', enablePersistence: false, maxRetries: 3, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'permanent-item', file: new File(['body'], 'permanent.txt'), fingerprint: 'permanent-fp', metadata: {}, reportProgress: vi.fn() })).rejects.toThrow('Chunk upload failed (400)');
    expect(FakeXhr.requests).toHaveLength(1);
  });

  it('honors Retry-After for transient JSON calls and rejects invalid response shapes', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    let initiation = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      if (path === '/api/json-retry' && init?.method === 'POST') {
        initiation += 1;
        if (initiation === 1) return new Response(JSON.stringify({ detail: 'Please retry.' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '0' } });
        return json({ state: 'uploading', uploadId: 'json-up', sessionToken: 'json-token', chunkSize: 10, receivedChunks: [] });
      }
      if (path.endsWith('/complete')) return json({});
      throw new Error(path);
    }));
    await uploadEndpointFile({ endpoint: '/api/json-retry', credentials: 'same-origin', enablePersistence: false, maxRetries: 1, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'json-item', file: new File(['x'], 'x.txt'), fingerprint: 'x-fp', metadata: {}, reportProgress: vi.fn() });
    expect(initiation).toBe(2);

    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).endsWith('/antiforgery')
      ? json({ headerName: 'X-CSRF', requestToken: 'csrf' }) : json({ state: 'uploading', uploadId: 'missing-token' })));
    await expect(uploadEndpointFile({ endpoint: '/api/invalid-shape', credentials: 'same-origin', enablePersistence: false, maxRetries: 0, baseDelay: 0,
      signal: new AbortController().signal, itemId: 'invalid', file: new File(['x'], 'x.txt'), fingerprint: 'invalid-fp', metadata: {}, reportProgress: vi.fn() })).rejects.toThrow(/initiation response is invalid/u);
  });

  it('deletes with transport-only headers and sends credentials according to mode', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      return new Response(null, { status: 204 });
    }));
    await deleteEndpointUpload({ endpoint: '/api/delete', credentials: 'include', uploadId: 'up/id', sessionToken: 'delete-secret', retries: 0, baseDelay: 0, signal: new AbortController().signal });
    const deletion = calls.find((call) => call.init?.method === 'DELETE');
    expect(deletion?.url).toBe('/api/delete/up%2Fid');
    expect(deletion?.init?.credentials).toBe('include');
    expect(new Headers(deletion?.init?.headers).get('X-CG-Upload-Token')).toBe('delete-secret');
    expect(JSON.stringify(calls)).not.toContain('storedFile');
  });

  it('aborts an active XHR chunk without completing the session', async () => {
    class HangingXhr extends FakeXhr { override send(_body: ArrayBufferView) { /* Wait for AbortSignal. */ } }
    vi.stubGlobal('XMLHttpRequest', HangingXhr);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const path = String(url);
      if (path.endsWith('/antiforgery')) return json({ headerName: 'X-CSRF', requestToken: 'csrf' });
      if (path === '/api/abort' && init?.method === 'POST') return json({ state: 'uploading', uploadId: 'abort-up', sessionToken: 'abort-token', chunkSize: 4, receivedChunks: [] });
      throw new Error(path);
    }));
    const controller = new AbortController();
    const upload = uploadEndpointFile({ endpoint: '/api/abort', credentials: 'same-origin', enablePersistence: true, persistenceKey: 'abort', maxRetries: 0, baseDelay: 0,
      signal: controller.signal, itemId: 'abort-item', file: new File(['body'], 'abort.txt'), fingerprint: 'abort-fp', metadata: {}, reportProgress: vi.fn() });
    await vi.waitFor(() => expect(FakeXhr.requests).toHaveLength(1));
    controller.abort();
    await expect(upload).rejects.toMatchObject({ name: 'AbortError' });
    expect(recoverSessions('/api/abort', 'abort')).toHaveLength(1);
  });
});
