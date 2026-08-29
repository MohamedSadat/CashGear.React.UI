import type { CSSProperties, ReactNode } from 'react';
import type { CgButtonAppearance } from '../Button';
import type { CgIconSource, CgIntent } from '../../types';

export type CgConfirmationInitialFocus = 'cancel' | 'confirm' | 'none';

export interface CgConfirmationOptions {
  content: ReactNode;
  title?: ReactNode;
  confirmLabel?: ReactNode;
  cancelLabel?: ReactNode;
  confirmIntent?: Exclude<CgIntent, 'link'>;
  cancelIntent?: Exclude<CgIntent, 'link'>;
  confirmAppearance?: CgButtonAppearance;
  cancelAppearance?: CgButtonAppearance;
  icon?: CgIconSource;
  renderIcon?: () => ReactNode;
  width?: CSSProperties['width'];
  className?: string;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
  initialFocus?: CgConfirmationInitialFocus;
  signal?: AbortSignal;
}

export interface CgConfirmationConfirm {
  (message: ReactNode): Promise<boolean>;
  (options: CgConfirmationOptions): Promise<boolean>;
}

export interface CgConfirmationApi { confirm: CgConfirmationConfirm }

export interface CgConfirmationProviderProps {
  children: ReactNode;
  defaults?: Partial<Omit<CgConfirmationOptions, 'content' | 'signal'>>;
  subscribeToNavigation?: (onNavigate: () => void) => void | (() => void);
}
