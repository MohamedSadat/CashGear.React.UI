import type { HTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps } from '../../types';
export type CgLoadingPanelMode = 'inline' | 'overlay' | 'portal';
export type CgLoadingIndicator = 'spinner' | 'dots' | 'pulse' | 'custom';
type NativeLoadingProps = Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'>;
export interface CgLoadingPanelProps extends NativeLoadingProps, CgBaseProps {
  children?: ReactNode;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  mode?: CgLoadingPanelMode;
  target?: Element | string | null;
  text?: ReactNode;
  indicator?: CgLoadingIndicator;
  customIndicator?: ReactNode;
  shading?: boolean;
  blocking?: boolean;
  showContent?: boolean;
  showDelay?: number;
  minimumVisibleDuration?: number;
  dismissOnClick?: boolean;
  dismissOnEscape?: boolean;
  trapFocus?: boolean;
}
