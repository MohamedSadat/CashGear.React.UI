import type { CgFileUploadItem, CgFileUploadStatus, CgStoredFile } from './CgFileUploader.types';
import type { PersistedUploadSession } from './endpointTransport';

export interface InternalUploadItem extends Omit<CgFileUploadItem, 'canRetry' | 'canRetryDelete' | 'isRejected'> {
  readonly generation: number;
  readonly sessionToken?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly session?: PersistedUploadSession;
  readonly defaultItem?: boolean;
}

export type QueueAction =
  | { type: 'replace'; items: ReadonlyArray<InternalUploadItem> }
  | { type: 'add'; items: ReadonlyArray<InternalUploadItem> }
  | { type: 'patch'; id: string; generation?: number; patch: Partial<InternalUploadItem> }
  | { type: 'remove'; id: string }
  | { type: 'clear'; items?: ReadonlyArray<InternalUploadItem> };

export function queueReducer(state: ReadonlyArray<InternalUploadItem>, action: QueueAction): ReadonlyArray<InternalUploadItem> {
  switch (action.type) {
    case 'replace': return action.items;
    case 'add': return [...state, ...action.items];
    case 'patch': return state.map((item) => item.id === action.id && (action.generation === undefined || item.generation === action.generation) ? { ...item, ...action.patch } : item);
    case 'remove': return state.filter((item) => item.id !== action.id);
    case 'clear': return action.items ?? [];
  }
}

export function createStoredItem(id: string, storedFile: CgStoredFile): InternalUploadItem {
  return {
    id, file: null, name: storedFile.name, size: storedFile.size, contentType: storedFile.contentType,
    lastModified: 0, status: 'succeeded', progress: 100, storedFile: freezeStoredFile(storedFile), generation: 0, defaultItem: true,
  };
}

export function publicItem(item: InternalUploadItem): CgFileUploadItem {
  const status = item.status;
  return Object.freeze({
    id: item.id, file: item.file, name: item.name, size: item.size, contentType: item.contentType,
    lastModified: item.lastModified, status, progress: item.progress, errorMessage: item.errorMessage,
    storedFile: item.storedFile, fingerprint: item.fingerprint, uploadId: item.uploadId,
    canRetry: (status === 'failed' || status === 'cancelled') && item.file !== null,
    canRetryDelete: status === 'delete-failed' && Boolean(item.uploadId),
    isRejected: status === 'rejected',
  });
}

export function publicItems(items: ReadonlyArray<InternalUploadItem>): ReadonlyArray<CgFileUploadItem> {
  return Object.freeze(items.map(publicItem));
}

export function freezeStoredFile(file: CgStoredFile): CgStoredFile {
  if (!file || typeof file !== 'object' || typeof file.id !== 'string' || !file.id || typeof file.location !== 'string'
    || typeof file.name !== 'string' || typeof file.size !== 'number' || !Number.isFinite(file.size) || file.size < 0
    || typeof file.contentType !== 'string' || !file.metadata || typeof file.metadata !== 'object' || Array.isArray(file.metadata)
    || Object.entries(file.metadata).some(([key, value]) => !key.trim() || typeof value !== 'string')) {
    throw new Error('CgFileUploader received an invalid stored file.');
  }
  return Object.freeze({ ...file, metadata: Object.freeze({ ...file.metadata }) });
}

export function clampProgress(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

export function totalProgress(items: ReadonlyArray<InternalUploadItem>): number {
  let total = 0; let completed = 0;
  for (const item of items) {
    if (item.status === 'rejected') continue;
    const weight = Math.max(1, item.size);
    total += weight; completed += weight * item.progress / 100;
  }
  return total === 0 ? 0 : Math.floor(completed * 100 / total);
}

export function statusIsIncomplete(status: CgFileUploadStatus): boolean {
  return status !== 'succeeded' && status !== 'rejected';
}
