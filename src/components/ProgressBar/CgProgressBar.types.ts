import type { HTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgIntent, CgSizeMode } from '../../types';
type NativeProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'style' | 'children'>;
export interface CgProgressBarProps extends NativeProgressProps, CgBaseProps {
  value?: number;
  min?: number;
  max?: number;
  label?: ReactNode;
  showLabel?: boolean;
  labelFormatter?: (value: number | undefined, details: { min: number; max: number; percent?: number }) => ReactNode;
  intent?: CgIntent;
  size?: CgSizeMode;
}
