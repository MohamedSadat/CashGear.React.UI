import type { HTMLAttributes, ReactNode } from 'react';
import type { CgBaseProps, CgSizeMode } from '../../types';
export type CgLoadingPanelMode = 'inline' | 'overlay' | 'portal';
export type CgLoadingIndicator = 'spinner' | 'dots' | 'pulse' | 'custom';
/** Where the text sits relative to the indicator. Blazor `CgLoadingPanelTextAlignment`. */
export type CgLoadingPanelTextAlignment = 'top' | 'inlineEnd' | 'bottom' | 'inlineStart';
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
  /** Text position next to the indicator. Defaults to `inlineEnd`. */
  textAlignment?: CgLoadingPanelTextAlignment;
  /** `false` drops the indicator area's card (background, border, shadow), leaving the indicator and text. Defaults to true. */
  indicatorAreaVisible?: boolean;
  /** Indicator, padding and gap size. Defaults to `medium`. */
  size?: CgSizeMode;
  /** Stacking order of an overlay or portal panel, a positive integer. Defaults to the overlay stack's order. */
  zIndex?: number;
}
