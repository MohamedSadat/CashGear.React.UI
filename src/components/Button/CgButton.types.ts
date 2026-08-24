import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { CgBaseProps, CgIconSource, CgIntent, CgSizeMode } from '../../types';

export type CgButtonAppearance = 'solid' | 'outline' | 'soft' | 'ghost' | 'link';
export type CgButtonIconPosition = 'start' | 'end';
type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className' | 'style' | 'onClick' | 'type'>;

export interface CgButtonProps extends NativeButtonProps, CgBaseProps {
  children: ReactNode;
  intent?: CgIntent;
  appearance?: CgButtonAppearance;
  size?: CgSizeMode;
  icon?: CgIconSource;
  iconPosition?: CgButtonIconPosition;
  loading?: boolean;
  autoLoading?: boolean;
  suppressDuplicateClicks?: boolean;
  loadingContent?: ReactNode;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void | Promise<void>;
}
