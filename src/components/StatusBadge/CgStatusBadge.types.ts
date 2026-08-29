import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { CgIconSource } from '../../types';

export type CgStatusBadgeType = 'neutral' | 'info' | 'success' | 'warning' | 'error';
export type CgStatusBadgeAppearance = 'soft' | 'solid' | 'outline';
export type CgStatusBadgeSize = 'small' | 'medium' | 'large';
export type CgStatusBadgeShape = 'rounded' | 'pill';

export interface CgStatusBadgeDismissDetails {
  readonly reason: 'dismissButton';
  readonly event: MouseEvent<HTMLButtonElement>;
}

export interface CgStatusBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>,
  'children' | 'role' | 'dangerouslySetInnerHTML' | 'aria-label'> {
  text?: ReactNode;
  children?: ReactNode;
  type?: CgStatusBadgeType;
  appearance?: CgStatusBadgeAppearance;
  size?: CgStatusBadgeSize;
  shape?: CgStatusBadgeShape;
  icon?: CgIconSource;
  renderIcon?: () => ReactNode;
  indicator?: boolean;
  dismissible?: boolean;
  onDismiss?: (details: CgStatusBadgeDismissDetails) => void | PromiseLike<void>;
  dismissAriaLabel?: string;
  visible?: boolean;
  role?: 'status' | 'alert';
  accessibleLabel?: string;
}
