import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgIntent } from '../../types';
import type { CgButtonProps } from '../Button';
import type { CgFlyoutPlacement } from '../Flyout';

export interface CgButtonMenuActivationResult { keepOpen?: boolean; }

export interface CgButtonMenuItem<TData = unknown> {
  key: string;
  text: string;
  icon?: CgIconSource;
  visible?: boolean;
  disabled?: boolean;
  beginGroup?: boolean;
  separator?: boolean;
  tooltip?: string;
  className?: string;
  intent?: CgIntent;
  badge?: ReactNode;
  shortcut?: ReactNode;
  navigateUrl?: string;
  target?: string;
  checked?: boolean;
  radioGroup?: string;
  data?: TData;
  children?: ReadonlyArray<CgButtonMenuItem<TData>>;
  onClick?: (details: CgButtonMenuItemClickDetails<TData>) => void | CgButtonMenuActivationResult | PromiseLike<void | CgButtonMenuActivationResult>;
  onCheckedChange?: (checked: boolean, details: CgButtonMenuItemClickDetails<TData>) => void | PromiseLike<void>;
}

export interface CgButtonMenuItemClickDetails<TData = unknown> {
  item: CgButtonMenuItem<TData>;
  source: 'pointer' | 'keyboard';
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  proposedChecked?: boolean;
}

export interface CgButtonMenuRenderContext<TData = unknown> {
  item: CgButtonMenuItem<TData>;
  level: number;
  active: boolean;
  expanded: boolean;
  busy: boolean;
  defaultContent: ReactNode;
}

export interface CgButtonFlyoutContext {
  open: boolean;
  close: () => void;
  reposition: () => void;
}

export interface CgButtonMenuActions {
  show: () => void;
  hide: () => void;
  toggle: () => void;
  focus: () => void;
}

export interface CgButtonMenuCommonProps<TData = unknown> {
  items?: ReadonlyArray<CgButtonMenuItem<TData>>;
  renderItem?: (context: CgButtonMenuRenderContext<TData>) => ReactNode;
  renderFlyout?: (context: CgButtonFlyoutContext) => ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: CgFlyoutPlacement;
  flipOnOverflow?: boolean;
  shiftOnOverflow?: boolean;
  offset?: number;
  matchAnchorWidth?: boolean;
  menuMinWidth?: CSSProperties['minWidth'];
  menuMaxWidth?: CSSProperties['maxWidth'];
  menuMaxHeight?: CSSProperties['maxHeight'];
  direction?: CgDirection;
  closeOnItemClick?: boolean;
  zIndex?: number;
  menuAriaLabel?: string;
  onItemClick?: (details: CgButtonMenuItemClickDetails<TData>) => void | CgButtonMenuActivationResult | PromiseLike<void | CgButtonMenuActivationResult>;
  onItemError?: (error: unknown, details: CgButtonMenuItemClickDetails<TData>) => void;
  actionsRef?: Ref<CgButtonMenuActions>;
}

export type CgDropDownButtonProps<TData = unknown> = Omit<CgButtonProps, 'onClick' | 'type'> & CgButtonMenuCommonProps<TData>;

