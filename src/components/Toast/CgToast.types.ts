import type { ReactNode } from 'react';
import type { CgDirection } from '../../types';

export type CgToastId = string;
export type CgToastVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';
export type CgToastPosition = 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';

export interface CgToastAction {
  label: ReactNode;
  onAction: () => void | PromiseLike<void>;
  dismissOnAction?: boolean;
}

export interface CgToastOptions {
  content: ReactNode;
  title?: ReactNode;
  variant?: CgToastVariant;
  duration?: number;
  persistent?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  action?: CgToastAction;
  metadata?: unknown;
  className?: string;
  important?: boolean;
  position?: CgToastPosition;
  direction?: CgDirection;
  duplicateKey?: string;
  suppressDuplicates?: boolean;
}

export type CgToastConvenienceOptions = Omit<CgToastOptions, 'content' | 'variant'>;

export interface CgToastApi {
  show: (options: CgToastOptions) => CgToastId;
  success: (content: ReactNode, options?: CgToastConvenienceOptions) => CgToastId;
  error: (content: ReactNode, options?: CgToastConvenienceOptions) => CgToastId;
  warning: (content: ReactNode, options?: CgToastConvenienceOptions) => CgToastId;
  info: (content: ReactNode, options?: CgToastConvenienceOptions) => CgToastId;
  dismiss: (id: CgToastId) => boolean;
  clear: (variant?: CgToastVariant) => number;
}

export type CgNavigationSubscriber = (onNavigate: () => void) => void | (() => void);

export interface CgToastProviderProps {
  children: ReactNode;
  duration?: number;
  persistent?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  position?: CgToastPosition;
  direction?: CgDirection;
  maximumVisible?: number;
  newestFirst?: boolean;
  portalTarget?: Element | string | null;
  subscribeToNavigation?: CgNavigationSubscriber;
  onActionError?: (error: unknown, id: CgToastId, metadata: unknown) => void;
}
