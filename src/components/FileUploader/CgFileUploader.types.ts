import type { FormEvent, HTMLAttributes, ReactNode, Ref } from 'react';
import type { CgBaseProps, CgDensity, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgFileUploadStatus =
  | 'pending'
  | 'uploading'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rejected'
  | 'paused'
  | 'awaiting-reselection'
  | 'deleting'
  | 'delete-failed';

export type CgFileUploadValidationMode = 'selection-only' | 'require-all-succeeded';
export type CgFileUploadTransportMode = 'handler' | 'endpoint';
export type CgFileUploadEventReason = 'selection' | 'upload' | 'retry' | 'cancel' | 'pause' | 'resume' | 'remove' | 'delete' | 'clear' | 'reset' | 'recovery';

export interface CgStoredFile {
  readonly id: string;
  readonly location: string;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface CgFileUploadItem {
  readonly id: string;
  readonly file: File | null;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
  readonly lastModified: number;
  readonly status: CgFileUploadStatus;
  readonly progress: number;
  readonly errorMessage?: string;
  readonly storedFile?: CgStoredFile;
  readonly fingerprint?: string;
  readonly uploadId?: string;
  readonly canRetry: boolean;
  readonly canRetryDelete: boolean;
  readonly isRejected: boolean;
}

export type CgFileUploadResult =
  | { readonly succeeded: true; readonly storedFile?: CgStoredFile }
  | { readonly succeeded: false; readonly errorMessage: string };

export interface CgFileUploadContext {
  readonly id: string;
  readonly file: File;
  readonly name: string;
  readonly size: number;
  readonly contentType: string;
  readonly signal: AbortSignal;
  readonly reportProgress: (percent: number) => void;
  readonly index: number;
  readonly count: number;
  readonly metadata: Readonly<Record<string, string>>;
  readonly buffer?: ArrayBuffer;
}

export type CgFileUploadHandler = (context: CgFileUploadContext) => PromiseLike<CgFileUploadResult> | CgFileUploadResult;
export type CgFileUploadMetadataProvider = (item: CgFileUploadItem, signal: AbortSignal) => PromiseLike<Readonly<Record<string, string>>> | Readonly<Record<string, string>>;

export interface CgFileUploaderEventDetails {
  readonly reason: CgFileUploadEventReason;
  readonly item?: CgFileUploadItem;
  readonly items: ReadonlyArray<CgFileUploadItem>;
}

export interface CgFileUploadProgressDetails extends CgFileUploaderEventDetails {
  readonly item: CgFileUploadItem;
  readonly progress: number;
  readonly totalProgress: number;
}

export interface CgFileUploadRunDetails extends CgFileUploaderEventDetails {
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
}

export interface CgFileUploaderLabels {
  dropZone: string;
  dropZoneAriaLabel: string;
  hint: string;
  browse: string;
  upload: string;
  cancelAll: string;
  clear: string;
  retry: string;
  remove: string;
  cancel: string;
  pause: string;
  resume: string;
  empty: string;
  fileList: string;
  pending: string;
  uploading: string;
  succeeded: string;
  failed: string;
  cancelled: string;
  rejected: string;
  paused: string;
  awaitingReselection: string;
  deleting: string;
  deleteFailed: string;
  maxFileSize: string;
  allowedExtensions: string;
  maxFileCount: string;
  uploadFailed: string;
  fileUnavailable: string;
  uploadValidation: string;
  required: string;
  removeFile: string;
  retryFile: string;
  cancelFile: string;
  progress: string;
  completed: string;
}

export interface CgFileUploaderRenderContext {
  readonly items: ReadonlyArray<CgFileUploadItem>;
  readonly isUploading: boolean;
  readonly totalProgress: number;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly actions: CgFileUploaderActions;
}

export interface CgFileUploaderFileRenderContext extends CgFileUploaderRenderContext {
  readonly item: CgFileUploadItem;
}

export interface CgFileUploaderActions {
  focus: () => void;
  browse: () => void;
  upload: () => Promise<void>;
  cancelAll: () => Promise<void>;
  cancel: (id: string) => Promise<void>;
  pause: (id: string) => Promise<void>;
  resume: (id: string) => Promise<void>;
  retry: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  retryDelete: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  getItems: () => ReadonlyArray<CgFileUploadItem>;
}

type NativeRootProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'style' | 'onInvalid'>;

export interface CgFileUploaderCommonProps extends NativeRootProps, CgBaseProps {
  autoUpload?: boolean;
  bufferToMemory?: boolean;
  progressThrottleMilliseconds?: number;
  removeOnSuccess?: boolean;
  maxFileSize?: number;
  maxFileCount?: number;
  allowedExtensions?: ReadonlyArray<string>;
  accept?: string;
  multiple?: boolean;
  showRejectedFiles?: boolean;
  validationMode?: CgFileUploadValidationMode;
  defaultStoredFiles?: ReadonlyArray<CgStoredFile>;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  serializeStoredFile?: (file: CgStoredFile) => string;
  showFileList?: boolean;
  showActions?: boolean;
  showProgress?: boolean;
  labels?: Partial<CgFileUploaderLabels>;
  fileSizeFormatter?: (bytes: number) => string;
  renderDropZone?: (context: CgFileUploaderRenderContext) => ReactNode;
  renderFile?: (context: CgFileUploaderFileRenderContext) => ReactNode;
  renderEmpty?: (context: CgFileUploaderRenderContext) => ReactNode;
  renderActions?: (context: CgFileUploaderRenderContext) => ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  actionsRef?: Ref<CgFileUploaderActions>;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  validationState?: CgValidationState;
  fullWidth?: boolean;
  maxConcurrentUploads?: number;
  getUploadMetadata?: CgFileUploadMetadataProvider;
  onFilesSelected?: (details: CgFileUploaderEventDetails) => void;
  onItemsChange?: (items: ReadonlyArray<CgFileUploadItem>, details: CgFileUploaderEventDetails) => void;
  onFileRejected?: (details: CgFileUploaderEventDetails) => void;
  onUploadStarted?: (details: CgFileUploaderEventDetails) => void;
  onUploadProgress?: (details: CgFileUploadProgressDetails) => void;
  onUploadSucceeded?: (details: CgFileUploaderEventDetails) => void;
  onUploadFailed?: (details: CgFileUploaderEventDetails) => void;
  onUploadCancelled?: (details: CgFileUploaderEventDetails) => void;
  onUploadPaused?: (details: CgFileUploaderEventDetails) => void;
  onResumeAvailable?: (details: CgFileUploaderEventDetails) => void;
  onDeleteStarted?: (details: CgFileUploaderEventDetails) => void;
  onDeleteSucceeded?: (details: CgFileUploaderEventDetails) => void;
  onDeleteFailed?: (details: CgFileUploaderEventDetails) => void;
  onFileRemoved?: (details: CgFileUploaderEventDetails) => void;
  onCleared?: (details: CgFileUploaderEventDetails) => void;
  onUploadCompleted?: (details: CgFileUploadRunDetails) => void;
  onUploadingChange?: (uploading: boolean, details: CgFileUploaderEventDetails) => void;
}

export interface CgFileUploaderHandlerProps extends CgFileUploaderCommonProps {
  upload: CgFileUploadHandler;
  uploadEndpoint?: never;
  endpointCredentials?: never;
  enableResumableUploads?: never;
  persistenceKey?: never;
  maxChunkRetries?: never;
  retryBaseDelayMilliseconds?: never;
  deleteRemoteOnRemove?: never;
}

export interface CgFileUploaderEndpointProps extends CgFileUploaderCommonProps {
  upload?: never;
  uploadEndpoint: string;
  endpointCredentials?: RequestCredentials;
  enableResumableUploads?: boolean;
  persistenceKey?: string;
  maxChunkRetries?: number;
  retryBaseDelayMilliseconds?: number;
  deleteRemoteOnRemove?: boolean;
}

export type CgFileUploaderProps = CgFileUploaderHandlerProps | CgFileUploaderEndpointProps;
