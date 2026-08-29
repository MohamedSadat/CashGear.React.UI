import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState,
} from 'react';
import type { ChangeEvent, DragEvent, FormEvent } from 'react';
import { useDirection, useFormReset, useMergedRefs, useStableCallback } from '../../hooks';
import { useFieldControl } from '../../internal/field';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import { CgIcon } from '../Icon';
import { CgProgressBar } from '../ProgressBar';
import {
  clearSessions, deleteEndpointUpload, normalizeEndpoint, recoverSessions, removeSession, uploadEndpointFile,
} from './endpointTransport';
import type { PersistedUploadSession } from './endpointTransport';
import { registerFileDropRoot } from './fileDragGuard';
import { fingerprintFile } from './fileFingerprint';
import {
  clampProgress, createStoredItem, freezeStoredFile, publicItem, publicItems, queueReducer, statusIsIncomplete, totalProgress,
} from './fileUploaderState';
import type { InternalUploadItem, QueueAction } from './fileUploaderState';
import styles from './CgFileUploader.module.css';
import type {
  CgFileUploadEventReason, CgFileUploadRunDetails, CgFileUploaderActions,
  CgFileUploaderEndpointProps, CgFileUploaderEventDetails, CgFileUploaderFileRenderContext,
  CgFileUploaderHandlerProps, CgFileUploaderLabels, CgFileUploaderProps, CgFileUploaderRenderContext,
  CgStoredFile,
} from './CgFileUploader.types';

const ENGLISH: CgFileUploaderLabels = {
  dropZone: 'Drag files here or click to browse', dropZoneAriaLabel: 'Select files to upload', hint: 'Up to {count} files, {size} each.',
  browse: 'Browse', upload: 'Upload', cancelAll: 'Cancel all', clear: 'Clear', retry: 'Retry', remove: 'Remove', cancel: 'Cancel', pause: 'Pause', resume: 'Resume',
  empty: 'No files selected', fileList: 'Selected files', pending: 'Ready', uploading: 'Uploading…', succeeded: 'Uploaded', failed: 'Failed',
  cancelled: 'Cancelled', rejected: 'Not allowed', paused: 'Paused', awaitingReselection: 'Select the same file to resume', deleting: 'Deleting…', deleteFailed: 'Delete failed',
  maxFileSize: 'This file is larger than the {size} limit.', allowedExtensions: 'Only {extensions} files are allowed.', maxFileCount: 'You can upload at most {count} files.',
  uploadFailed: 'Upload failed.', fileUnavailable: 'The browser no longer has this file. Select it again.', uploadValidation: 'All selected files must upload successfully.',
  required: 'Select at least one file.', removeFile: 'Remove {name}', retryFile: 'Retry {name}', cancelFile: 'Cancel {name}', progress: '{name} upload progress',
  completed: '{succeeded} of {count} files uploaded.',
};

const statusLabel: Record<InternalUploadItem['status'], keyof CgFileUploaderLabels> = {
  pending: 'pending', uploading: 'uploading', succeeded: 'succeeded', failed: 'failed', cancelled: 'cancelled', rejected: 'rejected', paused: 'paused',
  'awaiting-reselection': 'awaitingReselection', deleting: 'deleting', 'delete-failed': 'deleteFailed',
};

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([^}]+)\}/gu, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function binarySize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes / 1024; let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function normalizeExtensions(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  if (!values) return [];
  const result = values.map((value) => value.trim().toLowerCase()).filter(Boolean).map((value) => value.startsWith('.') ? value : `.${value}`);
  if (new Set(result).size !== result.length) throw new Error('CgFileUploader allowedExtensions contains duplicate extensions.');
  return result;
}

function immutableMetadata(value: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key.trim() || typeof item !== 'string') throw new Error('CgFileUploader upload metadata requires non-empty string keys and string values.');
    result[key] = item;
  }
  return Object.freeze(result);
}

function isAbortError(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }

interface ActiveOperation { controller: AbortController; generation: number; action?: 'cancel' | 'pause'; done?: Promise<void> }

export const CgFileUploader = forwardRef<HTMLDivElement, CgFileUploaderProps>(function CgFileUploader(props, forwardedRef) {
  const {
    autoUpload = true, bufferToMemory = false, progressThrottleMilliseconds = 150, removeOnSuccess = false,
    maxFileSize = 10 * 1024 * 1024, maxFileCount = 10, allowedExtensions, accept, multiple = maxFileCount > 1,
    showRejectedFiles = true, validationMode = 'selection-only', defaultStoredFiles = [], name, form, required = false,
    disabled = false, readOnly = false, onInvalid, serializeStoredFile = (file: CgStoredFile) => file.id,
    showFileList = true, showActions = true, showProgress = true, labels, fileSizeFormatter = binarySize,
    renderDropZone, renderFile, renderEmpty, renderActions, inputRef: inputRefProp, actionsRef,
    size = 'medium', density = 'comfortable', direction = 'auto', validationState = 'none', fullWidth = false,
    maxConcurrentUploads = 1, getUploadMetadata,
    onFilesSelected, onItemsChange, onFileRejected, onUploadStarted, onUploadProgress, onUploadSucceeded, onUploadFailed,
    onUploadCancelled, onUploadPaused, onResumeAvailable, onDeleteStarted, onDeleteSucceeded, onDeleteFailed,
    onFileRemoved, onCleared, onUploadCompleted, onUploadingChange,
    className, style, id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy, 'aria-describedby': ariaDescribedBy,
    'data-testid': testId, ...rootProps
  } = props;

  const handler = (props as CgFileUploaderHandlerProps).upload;
  const endpointValue = (props as CgFileUploaderEndpointProps).uploadEndpoint;
  const hasHandler = typeof handler === 'function';
  const hasEndpoint = typeof endpointValue === 'string' && endpointValue.trim().length > 0;
  if (hasHandler === hasEndpoint) throw new Error('CgFileUploader requires exactly one of upload or uploadEndpoint.');
  if (!Number.isFinite(maxFileSize) || maxFileSize <= 0) throw new RangeError('CgFileUploader maxFileSize must be greater than zero.');
  if (!Number.isInteger(maxFileCount) || maxFileCount <= 0) throw new RangeError('CgFileUploader maxFileCount must be a positive integer.');
  if (defaultStoredFiles.length > maxFileCount) throw new RangeError('CgFileUploader defaultStoredFiles exceeds maxFileCount.');
  if (!Number.isInteger(maxConcurrentUploads) || maxConcurrentUploads <= 0) throw new RangeError('CgFileUploader maxConcurrentUploads must be a positive integer.');
  if (!Number.isFinite(progressThrottleMilliseconds) || progressThrottleMilliseconds < 0) throw new RangeError('CgFileUploader progressThrottleMilliseconds must be non-negative.');
  if (validationMode !== 'selection-only' && validationMode !== 'require-all-succeeded') throw new Error('CgFileUploader validationMode is invalid.');
  const endpointProps = props as CgFileUploaderEndpointProps;
  const endpoint = hasEndpoint ? normalizeEndpoint(endpointValue) : undefined;
  const credentials = endpointProps.endpointCredentials ?? 'same-origin';
  const enableResumableUploads = endpointProps.enableResumableUploads ?? true;
  const persistenceKey = endpointProps.persistenceKey?.trim() || undefined;
  const maxChunkRetries = endpointProps.maxChunkRetries ?? 3;
  const retryBaseDelayMilliseconds = endpointProps.retryBaseDelayMilliseconds ?? 500;
  const deleteRemoteOnRemove = endpointProps.deleteRemoteOnRemove ?? true;
  if (hasEndpoint && (!Number.isInteger(maxChunkRetries) || maxChunkRetries < 0)) throw new RangeError('CgFileUploader maxChunkRetries must be a non-negative integer.');
  if (hasEndpoint && (!Number.isFinite(retryBaseDelayMilliseconds) || retryBaseDelayMilliseconds < 0)) throw new RangeError('CgFileUploader retryBaseDelayMilliseconds must be non-negative.');
  if (hasEndpoint && !['omit', 'same-origin', 'include'].includes(credentials)) throw new Error('CgFileUploader endpointCredentials is invalid.');

  const text = useMemo(() => ({ ...ENGLISH, ...labels }), [labels]);
  const extensions = useMemo(() => normalizeExtensions(allowedExtensions), [allowedExtensions]);
  const resolvedAccept = accept ?? (extensions.length > 0 ? extensions.join(',') : undefined);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputElementRef = useRef<HTMLInputElement>(null);
  const proxyRef = useRef<HTMLSelectElement>(null);
  const mergedRootRef = useMergedRefs(rootRef, forwardedRef);
  const mergedInputRef = useMergedRefs(inputElementRef, inputRefProp);
  const field = useFieldControl({ id, required, disabled, readOnly, validationState, describedBy: ariaDescribedBy, ariaLabel, labelledBy: ariaLabelledBy });
  const resolvedDirection = useDirection(rootRef, direction);
  const defaultItemsRef = useRef<ReadonlyArray<InternalUploadItem> | undefined>(undefined);
  if (!defaultItemsRef.current) defaultItemsRef.current = defaultStoredFiles.map((file, index) => createStoredItem(`${field.id}-stored-${index}`, file));
  const [items, dispatch] = useReducer(queueReducer, defaultItemsRef.current);
  const itemsRef = useRef(items);
  const mountedRef = useRef(true);
  const counterRef = useRef(0);
  const operationsRef = useRef(new Map<string, ActiveOperation>());
  const runPromiseRef = useRef<Promise<void> | undefined>(undefined);
  const selectionControllerRef = useRef<AbortController | undefined>(undefined);
  const progressTimesRef = useRef(new Map<string, number>());
  const [message, setMessage] = useState<string>();
  const [liveMessage, setLiveMessage] = useState('');
  const [dragging, setDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const snapshot = useMemo(() => publicItems(items), [items]);
  const aggregateProgress = totalProgress(items);
  const isUploading = items.some((item) => item.status === 'uploading' || item.status === 'deleting');
  const hasPending = items.some((item) => item.status === 'pending');
  const blocked = field.disabled || field.readOnly;

  const makeDetails = useStableCallback((reason: CgFileUploadEventReason, itemId?: string): CgFileUploaderEventDetails => {
    const current = publicItems(itemsRef.current);
    return Object.freeze({ reason, item: itemId ? current.find((item) => item.id === itemId) : undefined, items: current });
  });

  const apply = useStableCallback((action: QueueAction, reason: CgFileUploadEventReason, itemId?: string): CgFileUploaderEventDetails => {
    const next = queueReducer(itemsRef.current, action);
    itemsRef.current = next;
    if (mountedRef.current) dispatch({ type: 'replace', items: next });
    const details = makeDetails(reason, itemId);
    onItemsChange?.(details.items, details);
    return details;
  });

  const reportProgress = useStableCallback((id: string, generation: number, raw: number) => {
    const value = clampProgress(raw); const now = Date.now(); const previous = progressTimesRef.current.get(id) ?? 0;
    if (value < 100 && progressThrottleMilliseconds > 0 && now - previous < progressThrottleMilliseconds) return;
    progressTimesRef.current.set(id, now);
    const details = apply({ type: 'patch', id, generation, patch: { progress: value } }, 'upload', id);
    if (details.item) onUploadProgress?.(Object.freeze({ ...details, item: details.item, progress: value, totalProgress: totalProgress(itemsRef.current) }));
  });

  const uploadOne = useStableCallback(async (id: string, index: number, count: number, reason: 'upload' | 'retry' | 'resume'): Promise<InternalUploadItem['status'] | undefined> => {
    const initial = itemsRef.current.find((item) => item.id === id);
    if (!initial || initial.status !== 'pending' || !initial.file || blocked) return;
    const operation: ActiveOperation = { controller: new AbortController(), generation: initial.generation };
    let outcome: InternalUploadItem['status'] | undefined;
    operationsRef.current.set(id, operation);
    const work = (async () => {
      let details = apply({ type: 'patch', id, generation: initial.generation, patch: { status: 'uploading', progress: initial.progress, errorMessage: undefined } }, reason, id);
      onUploadStarted?.(details);
      try {
        const safeItem = publicItem(itemsRef.current.find((item) => item.id === id)!);
        const metadata = immutableMetadata(await Promise.resolve(getUploadMetadata?.(safeItem, operation.controller.signal) ?? {}));
        operation.controller.signal.throwIfAborted();
        if (hasHandler) {
          const buffer = bufferToMemory ? await initial.file!.arrayBuffer() : undefined;
          operation.controller.signal.throwIfAborted();
          const result = await Promise.resolve(handler({
            id, file: initial.file!, name: initial.name, size: initial.size, contentType: initial.contentType,
            signal: operation.controller.signal, reportProgress: (value) => reportProgress(id, initial.generation, value), index, count, metadata, buffer,
          }));
          operation.controller.signal.throwIfAborted();
          if (!result || typeof result.succeeded !== 'boolean') throw new Error('CgFileUploader upload returned an invalid result.');
          if (!result.succeeded) throw new Error(result.errorMessage || text.uploadFailed);
          details = apply({ type: 'patch', id, generation: initial.generation, patch: { status: 'succeeded', progress: 100, storedFile: result.storedFile ? freezeStoredFile(result.storedFile) : undefined, metadata } }, reason, id);
        } else {
          const endpointResult = await uploadEndpointFile({
            endpoint: endpoint!, credentials, persistenceKey, enablePersistence: enableResumableUploads, maxRetries: maxChunkRetries,
            baseDelay: retryBaseDelayMilliseconds, signal: operation.controller.signal, itemId: id, file: initial.file!,
            fingerprint: initial.fingerprint!, metadata, session: initial.session, reportProgress: (value) => reportProgress(id, initial.generation, value),
            sessionUpdated: (session) => { apply({ type: 'patch', id, generation: initial.generation, patch: { session, uploadId: session.uploadId, sessionToken: session.sessionToken } }, reason, id); },
          });
          details = apply({ type: 'patch', id, generation: initial.generation, patch: {
            status: 'succeeded', progress: 100, storedFile: endpointResult.storedFile ? freezeStoredFile(endpointResult.storedFile) : undefined,
            uploadId: endpointResult.uploadId, sessionToken: endpointResult.sessionToken, session: undefined, metadata,
          } }, reason, id);
        }
        outcome = 'succeeded';
        onUploadSucceeded?.(details);
        setLiveMessage(format(text.completed, { succeeded: 1, count: 1 }));
        if (removeOnSuccess) await removeItem(id);
      } catch (error) {
        const current = itemsRef.current.find((item) => item.id === id);
        if (!mountedRef.current || !current || current.generation !== initial.generation) return;
        if (operation.action === 'pause' && hasEndpoint) {
          details = apply({ type: 'patch', id, generation: initial.generation, patch: { status: 'paused' } }, 'pause', id);
          outcome = 'paused';
          onUploadPaused?.(details); setLiveMessage(`${initial.name}: ${text.paused}`);
        } else if (operation.action === 'cancel' || isAbortError(error) || operation.controller.signal.aborted) {
          details = apply({ type: 'patch', id, generation: initial.generation, patch: { status: 'cancelled', errorMessage: undefined } }, 'cancel', id);
          outcome = 'cancelled';
          onUploadCancelled?.(details); setLiveMessage(`${initial.name}: ${text.cancelled}`);
        } else {
          const errorMessage = error instanceof Error && error.message ? error.message : text.uploadFailed;
          details = apply({ type: 'patch', id, generation: initial.generation, patch: { status: 'failed', errorMessage } }, reason, id);
          outcome = 'failed';
          onUploadFailed?.(details); setLiveMessage(showFileList ? '' : `${initial.name}: ${errorMessage}`);
        }
      } finally {
        if (operationsRef.current.get(id) === operation) operationsRef.current.delete(id);
      }
    })();
    operation.done = work; await work; return outcome;
  });

  const runQueue = useStableCallback(async (): Promise<void> => {
    if (blocked) return;
    if (runPromiseRef.current) return runPromiseRef.current;
    if (!itemsRef.current.some((item) => item.status === 'pending' && item.file)) return;
    const before = makeDetails('upload'); onUploadingChange?.(true, before);
    const promise = (async () => {
      const attempted = new Set<string>();
      const outcomes: Array<InternalUploadItem['status'] | undefined> = [];
      while (true) {
        const queue = itemsRef.current
          .filter((item) => item.status === 'pending' && item.file && !attempted.has(`${item.id}\u001f${item.generation}`))
          .map((item) => ({ id: item.id, key: `${item.id}\u001f${item.generation}` }));
        if (queue.length === 0) break;
        for (const item of queue) attempted.add(item.key);
        let cursor = 0;
        const worker = async () => {
          while (cursor < queue.length) {
            const current = cursor; cursor += 1;
            outcomes.push(await uploadOne(queue[current]!.id, current, queue.length, 'upload'));
          }
        };
        await Promise.all(Array.from({ length: Math.min(maxConcurrentUploads, queue.length) }, worker));
      }
      const current = publicItems(itemsRef.current);
      const details: CgFileUploadRunDetails = Object.freeze({
        reason: 'upload', items: current, attempted: outcomes.length,
        succeeded: outcomes.filter((status) => status === 'succeeded').length,
        failed: outcomes.filter((status) => status === 'failed').length,
        cancelled: outcomes.filter((status) => status === 'cancelled').length,
      });
      if (mountedRef.current) onUploadCompleted?.(details);
    })().finally(() => {
      runPromiseRef.current = undefined;
      if (mountedRef.current) onUploadingChange?.(false, makeDetails('upload'));
    });
    runPromiseRef.current = promise; return promise;
  });

  const cancelItem = useStableCallback(async (id: string): Promise<void> => {
    const item = itemsRef.current.find((candidate) => candidate.id === id); if (!item || blocked) return;
    const operation = operationsRef.current.get(id);
    if (operation) { operation.action = 'cancel'; operation.controller.abort(new DOMException('Upload cancelled.', 'AbortError')); await operation.done; }
    else if (item.status === 'pending' || item.status === 'paused' || item.status === 'awaiting-reselection') {
      const details = apply({ type: 'patch', id, patch: { status: 'cancelled', generation: item.generation + 1 } }, 'cancel', id); onUploadCancelled?.(details);
    }
    const latest = itemsRef.current.find((candidate) => candidate.id === id);
    if (hasEndpoint && latest) {
      removeSession(persistenceKey, id, latest.uploadId ?? latest.session?.uploadId);
      const uploadId = latest.uploadId ?? latest.session?.uploadId; const token = latest.sessionToken ?? latest.session?.sessionToken;
      if (deleteRemoteOnRemove && uploadId && token) {
        const controller = new AbortController();
        try { await deleteEndpointUpload({ endpoint: endpoint!, credentials, uploadId, sessionToken: token, retries: 1, baseDelay: 250, signal: controller.signal }); } catch { /* Cancellation remains successful locally. */ }
      }
    }
  });

  const pauseItem = useStableCallback(async (id: string): Promise<void> => {
    if (!hasEndpoint || blocked) return;
    const operation = operationsRef.current.get(id); if (!operation) return;
    operation.action = 'pause'; operation.controller.abort(new DOMException('Upload paused.', 'AbortError')); await operation.done;
  });

  const retryItem = useStableCallback(async (id: string, reason: 'retry' | 'resume' = 'retry'): Promise<void> => {
    const item = itemsRef.current.find((candidate) => candidate.id === id); if (!item || !item.file || blocked) return;
    if (!['failed', 'cancelled', 'paused'].includes(item.status)) return;
    apply({ type: 'patch', id, patch: { status: 'pending', errorMessage: undefined, generation: item.generation + 1 } }, reason, id);
    await runQueue();
  });

  const deleteRemote = useStableCallback(async (id: string): Promise<boolean> => {
    const item = itemsRef.current.find((candidate) => candidate.id === id); if (!item || !hasEndpoint) return true;
    const uploadId = item.uploadId ?? item.session?.uploadId; const token = item.sessionToken ?? item.session?.sessionToken;
    if (!deleteRemoteOnRemove || !uploadId || !token) return true;
    let details = apply({ type: 'patch', id, patch: { status: 'deleting', errorMessage: undefined } }, 'delete', id); onDeleteStarted?.(details);
    const controller = new AbortController();
    try {
      await deleteEndpointUpload({ endpoint: endpoint!, credentials, uploadId, sessionToken: token, retries: maxChunkRetries, baseDelay: retryBaseDelayMilliseconds, signal: controller.signal });
      removeSession(persistenceKey, id, uploadId); details = makeDetails('delete', id); onDeleteSucceeded?.(details); return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : text.uploadFailed;
      details = apply({ type: 'patch', id, patch: { status: 'delete-failed', errorMessage } }, 'delete', id); onDeleteFailed?.(details); return false;
    }
  });

  const removeItem = useStableCallback(async (id: string): Promise<void> => {
    if (blocked) return;
    const item = itemsRef.current.find((candidate) => candidate.id === id); if (!item) return;
    const hasStagedEndpoint = hasEndpoint && item.status !== 'succeeded' && item.status !== 'rejected'
      && Boolean(item.uploadId ?? item.session?.uploadId) && Boolean(item.sessionToken ?? item.session?.sessionToken);
    if (operationsRef.current.has(id) || hasStagedEndpoint) await cancelItem(id);
    const latest = itemsRef.current.find((candidate) => candidate.id === id); if (!latest) return;
    if (latest.status === 'succeeded' && !(await deleteRemote(id))) return;
    removeSession(persistenceKey, id, latest.uploadId ?? latest.session?.uploadId);
    const details = apply({ type: 'remove', id }, 'remove'); onFileRemoved?.(Object.freeze({ ...details, item: publicItem(latest) }));
    queueMicrotask(() => rootRef.current?.querySelector<HTMLElement>('button:not(:disabled), input:not(:disabled)')?.focus({ preventScroll: true }));
  });

  const retryDelete = useStableCallback(async (id: string): Promise<void> => { if (await deleteRemote(id)) { const item = itemsRef.current.find((candidate) => candidate.id === id); if (item) { const details = apply({ type: 'remove', id }, 'delete'); onFileRemoved?.(Object.freeze({ ...details, item: publicItem(item) })); } } });
  const cancelAll = useStableCallback(async (): Promise<void> => { await Promise.all(itemsRef.current.map((item) => cancelItem(item.id))); });
  const clearAll = useStableCallback(async (): Promise<void> => {
    if (blocked) return;
    for (const item of [...itemsRef.current]) await removeItem(item.id);
    if (itemsRef.current.length === 0) { const details = makeDetails('clear'); onCleared?.(details); setLiveMessage(text.empty); }
  });

  const processFiles = useStableCallback(async (files: ReadonlyArray<File>): Promise<void> => {
    if (blocked || files.length === 0) return;
    selectionControllerRef.current?.abort(); const controller = new AbortController(); selectionControllerRef.current = controller;
    const acceptedCount = itemsRef.current.filter((item) => item.status !== 'rejected').length;
    let remaining = Math.max(0, maxFileCount - acceptedCount);
    const additions: InternalUploadItem[] = []; const rejected: InternalUploadItem[] = [];
    try {
      for (const file of files) {
        controller.signal.throwIfAborted();
        const idValue = `${field.id}-file-${++counterRef.current}`;
        const contentType = file.type || 'application/octet-stream';
        const fingerprint = await fingerprintFile(file, controller.signal);
        const recovered = itemsRef.current.find((item) => item.status === 'awaiting-reselection' && item.fingerprint === fingerprint);
        if (recovered) {
          apply({ type: 'patch', id: recovered.id, patch: { file, status: 'paused', generation: recovered.generation + 1, errorMessage: undefined } }, 'recovery', recovered.id);
          onResumeAvailable?.(makeDetails('recovery', recovered.id));
          if (autoUpload) void retryItem(recovered.id, 'resume');
          continue;
        }
        let error: string | undefined;
        if (remaining <= 0) error = format(text.maxFileCount, { count: maxFileCount });
        else if (file.size > maxFileSize) error = format(text.maxFileSize, { size: fileSizeFormatter(maxFileSize) });
        else if (extensions.length > 0 && !extensions.some((extension) => file.name.toLowerCase().endsWith(extension))) error = format(text.allowedExtensions, { extensions: extensions.join(', ') });
        if (error) {
          const item: InternalUploadItem = { id: idValue, file, name: file.name, size: file.size, contentType, lastModified: file.lastModified, status: 'rejected', progress: 0, errorMessage: error, generation: 0 };
          rejected.push(item); if (showRejectedFiles) additions.push(item); continue;
        }
        remaining -= 1;
        additions.push({ id: idValue, file, name: file.name, size: file.size, contentType, lastModified: file.lastModified, status: 'pending', progress: 0, fingerprint, generation: 0 });
      }
    } catch (error) {
      if (isAbortError(error) || controller.signal.aborted) return;
      const errorMessage = error instanceof Error ? error.message : text.uploadFailed;
      setMessage(errorMessage); setLiveMessage(errorMessage); return;
    }
    if (additions.length > 0) {
      const details = apply({ type: 'add', items: additions }, 'selection'); onFilesSelected?.(details);
      setMessage(showRejectedFiles ? undefined : rejected[0]?.errorMessage);
      setLiveMessage(rejected.length > 0 && showRejectedFiles ? '' : rejected[0]?.errorMessage ?? `${additions.length} file${additions.length === 1 ? '' : 's'} selected.`);
      if (autoUpload && additions.some((item) => item.status === 'pending')) await runQueue();
    }
    for (const item of rejected) onFileRejected?.(Object.freeze({ ...makeDetails('selection'), item: publicItem(item) }));
    if (additions.length === 0 && rejected.length > 0) {
      setMessage(showRejectedFiles ? undefined : rejected[0]?.errorMessage);
      setLiveMessage(showRejectedFiles ? '' : rejected[0]?.errorMessage ?? text.rejected);
    }
  });

  const actions = useMemo<CgFileUploaderActions>(() => ({
    focus: () => inputElementRef.current?.focus({ preventScroll: true }),
    browse: () => { if (!blocked) inputElementRef.current?.click(); },
    upload: async () => { await runQueue(); },
    cancelAll: async () => { await cancelAll(); },
    cancel: async (idValue) => { await cancelItem(idValue); },
    pause: async (idValue) => { await pauseItem(idValue); },
    resume: async (idValue) => { await retryItem(idValue, 'resume'); },
    retry: async (idValue) => { await retryItem(idValue); },
    remove: async (idValue) => { await removeItem(idValue); },
    retryDelete: async (idValue) => { await retryDelete(idValue); },
    clear: async () => { await clearAll(); },
    getItems: () => publicItems(itemsRef.current),
  }), [blocked, cancelAll, cancelItem, clearAll, pauseItem, removeItem, retryDelete, retryItem, runQueue]);
  useImperativeHandle(actionsRef, () => actions, [actions]);

  const reset = useStableCallback(() => {
    selectionControllerRef.current?.abort();
    for (const operation of operationsRef.current.values()) { operation.action = 'cancel'; operation.controller.abort(new DOMException('Form reset.', 'AbortError')); }
    clearSessions(persistenceKey); if (inputElementRef.current) inputElementRef.current.value = '';
    const defaults = defaultItemsRef.current ?? []; apply({ type: 'clear', items: defaults }, 'reset'); setMessage(undefined); setLiveMessage('');
  });
  useFormReset(proxyRef, reset);

  useEffect(() => {
    const root = rootRef.current; if (!root) return;
    return registerFileDropRoot(root);
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    const operations = operationsRef.current;
    return () => {
      mountedRef.current = false; selectionControllerRef.current?.abort();
      for (const operation of operations.values()) operation.controller.abort(new DOMException('CgFileUploader unmounted.', 'AbortError'));
      operations.clear();
    };
  }, []);
  useEffect(() => {
    if (!hasEndpoint || !enableResumableUploads || !persistenceKey) return;
    const recovered = recoverSessions(endpoint!, persistenceKey).filter((session) => !itemsRef.current.some((item) => item.fingerprint === session.fingerprint));
    if (recovered.length === 0) return;
    const restored = recovered.map((session: PersistedUploadSession): InternalUploadItem => ({
      id: session.itemId, file: null, name: session.name, size: session.size, contentType: session.contentType,
      lastModified: Date.parse(session.lastModified) || 0, status: 'awaiting-reselection', progress: session.chunkCount ? Math.floor(session.receivedChunks.length * 100 / session.chunkCount) : 0,
      fingerprint: session.fingerprint, uploadId: session.uploadId, sessionToken: session.sessionToken, session, metadata: session.metadata, generation: 0,
    }));
    apply({ type: 'add', items: restored }, 'recovery');
    for (const item of restored) onResumeAvailable?.(makeDetails('recovery', item.id));
  }, [apply, enableResumableUploads, endpoint, hasEndpoint, makeDetails, onResumeAvailable, persistenceKey]);

  const accepted = items.filter((item) => item.status !== 'rejected');
  const validationMessage = field.required && accepted.length === 0 ? text.required
    : validationMode === 'require-all-succeeded' && accepted.some((item) => statusIsIncomplete(item.status)) ? text.uploadValidation : '';
  useEffect(() => { const proxy = proxyRef.current; if (proxy) proxy.setCustomValidity(validationMessage); return () => proxy?.setCustomValidity(''); }, [validationMessage]);

  const context: CgFileUploaderRenderContext = { items: snapshot, isUploading, totalProgress: aggregateProgress, disabled: field.disabled, readOnly: field.readOnly, actions };
  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ''; void processFiles(files); };
  const beginDrag = (event: DragEvent<HTMLDivElement>) => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; dragDepthRef.current += 1; setDragging(true); };
  const leaveDrag = () => { dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (dragDepthRef.current === 0) setDragging(false); };
  const overDrag = (event: DragEvent<HTMLDivElement>) => { if (Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } };
  const dropFiles = (event: DragEvent<HTMLDivElement>) => { if (!Array.from(event.dataTransfer.types).includes('Files')) return; event.preventDefault(); dragDepthRef.current = 0; setDragging(false); void processFiles(Array.from(event.dataTransfer.files)); };

  return (
    <div {...rootProps} ref={mergedRootRef} id={field.id} className={cx(styles.root, fullWidth && styles.fullWidth, className)} style={style}
      dir={resolvedDirection} data-size={size} data-density={density} data-validation={validationMessage || field.validationState === 'error' ? 'error' : field.validationState}
      data-disabled={field.disabled || undefined} data-readonly={field.readOnly || undefined} data-testid={testId}>
      <div className={styles.dropZone} data-dragging={dragging || undefined} onDragEnter={beginDrag} onDragLeave={leaveDrag} onDragOver={overDrag} onDrop={dropFiles}>
        <input ref={mergedInputRef} className={styles.fileInput} type="file" accept={resolvedAccept} multiple={multiple && maxFileCount > 1}
          disabled={blocked} aria-label={field.ariaLabel ?? text.dropZoneAriaLabel} aria-labelledby={field.labelledBy} aria-describedby={field.describedBy}
          aria-invalid={Boolean(validationMessage) || field.validationState === 'error' || undefined} onChange={onInputChange} />
        <div className={styles.prompt} aria-hidden="true">
          {renderDropZone ? renderDropZone(context) : <><span className={styles.uploadIcon}><CgIcon name="chevron-up" size="2rem" /></span><strong>{text.dropZone}</strong><span className={styles.browse}>{text.browse}</span><small>{format(text.hint, { count: maxFileCount, size: fileSizeFormatter(maxFileSize) })}</small></>}
        </div>
      </div>
      {message ? <div className={styles.message} role="alert">{message}</div> : null}
      {showFileList ? (
        snapshot.length === 0 ? (renderEmpty?.(context) ?? <div className={styles.empty}>{text.empty}</div>) : (
          <ul className={styles.list} aria-label={text.fileList}>
            {snapshot.map((item) => {
              const fileContext: CgFileUploaderFileRenderContext = { ...context, item };
              if (renderFile) return <li key={item.id} className={styles.item} data-status={item.status}>{renderFile(fileContext)}</li>;
              return <li key={item.id} className={styles.item} data-status={item.status}>
                <div className={styles.fileHeader}><span className={styles.fileName} title={item.name}>{item.name}</span><span className={styles.fileSize}>{fileSizeFormatter(item.size)}</span><span className={styles.status}>{text[statusLabel[item.status]]}</span></div>
                {showProgress && (item.status === 'uploading' || item.status === 'paused' || item.progress > 0) ? <CgProgressBar value={item.progress} size="small" intent={item.status === 'failed' || item.status === 'delete-failed' ? 'danger' : item.status === 'succeeded' ? 'success' : 'primary'} aria-label={format(text.progress, { name: item.name })} /> : null}
                {item.errorMessage ? <div className={styles.fileError} role="alert">{item.errorMessage}</div> : null}
                {!blocked ? <div className={styles.fileActions}>
                  {item.status === 'uploading' && hasEndpoint ? <CgButton size="small" appearance="ghost" onClick={() => actions.pause(item.id)}>{text.pause}</CgButton> : null}
                  {item.status === 'uploading' ? <CgButton size="small" appearance="ghost" intent="danger" aria-label={format(text.cancelFile, { name: item.name })} onClick={() => actions.cancel(item.id)}>{text.cancel}</CgButton> : null}
                  {item.canRetry ? <CgButton size="small" appearance="ghost" aria-label={format(text.retryFile, { name: item.name })} onClick={() => actions.retry(item.id)}>{text.retry}</CgButton> : null}
                  {item.status === 'paused' ? <CgButton size="small" appearance="ghost" onClick={() => actions.resume(item.id)}>{text.resume}</CgButton> : null}
                  {item.canRetryDelete ? <CgButton size="small" appearance="ghost" onClick={() => actions.retryDelete(item.id)}>{text.retry}</CgButton> : null}
                  {item.status !== 'deleting' ? <CgButton size="small" appearance="ghost" aria-label={format(text.removeFile, { name: item.name })} onClick={() => actions.remove(item.id)}>{text.remove}</CgButton> : null}
                </div> : null}
              </li>;
            })}
          </ul>
        )
      ) : null}
      {showActions && !blocked ? (renderActions?.(context) ?? <div className={styles.actions}>
        {!autoUpload && hasPending ? <CgButton size={size} onClick={actions.upload}>{text.upload}</CgButton> : null}
        {isUploading ? <CgButton size={size} appearance="outline" intent="danger" onClick={actions.cancelAll}>{text.cancelAll}</CgButton> : null}
        {snapshot.length > 0 ? <CgButton size={size} appearance="ghost" onClick={actions.clear}>{text.clear}</CgButton> : null}
      </div>) : null}
      <select ref={proxyRef} className={styles.formProxy} form={form} multiple required disabled={field.disabled} value={validationMessage ? [] : ['valid']}
        aria-hidden="true" tabIndex={-1} onChange={() => undefined} onInvalid={(event: FormEvent<HTMLSelectElement>) => { setMessage(validationMessage); onInvalid?.(event); event.preventDefault(); inputElementRef.current?.focus({ preventScroll: true }); }}>
        <option value="valid">valid</option>
      </select>
      {name && !field.disabled ? snapshot.filter((item) => item.status === 'succeeded' && item.storedFile).map((item) => <input key={item.id} type="hidden" name={name} form={form} value={serializeStoredFile(item.storedFile!)} />) : null}
      <div className={styles.live} role="status" aria-live="polite" aria-atomic="true">{liveMessage}</div>
    </div>
  );
});
