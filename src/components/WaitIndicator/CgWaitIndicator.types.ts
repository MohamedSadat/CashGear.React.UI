import type { HTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSizeMode } from '../../types';

export type CgWaitIndicatorAnimation = 'spinner' | 'dots' | 'pulse';
type NativeWaitIndicatorProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'className' | 'style'>;

export interface CgWaitIndicatorProps extends NativeWaitIndicatorProps, CgBaseProps {
  visible?: boolean;
  animation?: CgWaitIndicatorAnimation;
  size?: CgSizeMode;
  decorative?: boolean;
  ariaLabel?: string;
  children?: ReactNode;
}
