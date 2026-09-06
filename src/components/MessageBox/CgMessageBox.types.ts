import type { CSSProperties, ReactNode, Ref, SyntheticEvent } from 'react';
import type { CgButtonAppearance } from '../Button';
import type { CgIconSource, CgIntent } from '../../types';

export type CgMessageBoxInitialFocus = 'action' | 'none';
export type CgMessageBoxCloseReason = 'accept' | 'programmatic' | 'escape' | 'outsideClick' | 'closeButton';

export interface CgMessageBoxOptions {
  content: ReactNode;
  title?: ReactNode;
  actionLabel?: ReactNode;
  actionIntent?: Exclude<CgIntent, 'link'>;
  actionAppearance?: CgButtonAppearance;
  icon?: CgIconSource;
  renderIcon?: () => ReactNode;
  width?: CSSProperties['width'];
  className?: string;
  closeOnEscape?: boolean;
  closeOnOutsideClick?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  initialFocus?: CgMessageBoxInitialFocus;
  signal?: AbortSignal;
}

export interface CgMessageBoxAlert {
  (message: ReactNode, title?: ReactNode): Promise<void>;
  (options: CgMessageBoxOptions): Promise<void>;
}

export interface CgMessageBoxOpenChangeDetails {
  reason: 'programmatic' | CgMessageBoxCloseReason;
  event?: Event | SyntheticEvent;
}

export interface CgMessageBoxClosedDetails {
  accepted: boolean;
  reason: CgMessageBoxCloseReason;
  event?: Event | SyntheticEvent;
}

export interface CgMessageBoxActions {
  open: () => Promise<void>;
  close: () => Promise<void>;
  accept: () => Promise<void>;
  focus: () => void;
}

export interface CgMessageBoxProps extends Omit<CgMessageBoxOptions, 'content' | 'signal'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgMessageBoxOpenChangeDetails) => void;
  onClosed?: (accepted: boolean, details: CgMessageBoxClosedDetails) => void;
  message?: ReactNode;
  children?: ReactNode;
  actionsRef?: Ref<CgMessageBoxActions>;
  style?: CSSProperties;
  'data-testid'?: string;
}
