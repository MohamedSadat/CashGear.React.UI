import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgSizeMode } from '../../types';
import type { CgButtonAppearance } from '../Button';
import type { CgButtonFlyoutContext } from '../DropDownButton';

export type CgToolbarItemAlignment = 'start' | 'end';
export type CgToolbarOverflowBehavior = 'auto' | 'never' | 'always';
export type CgToolbarItemDisplayMode = 'full' | 'adaptive' | 'icon-only';
export type CgToolbarActivationSource = 'pointer' | 'keyboard';
/** `inline` is one row. `rows` starts a new row at each `beginRow` item. `columns` fills columns of `columnRows` items. */
export type CgToolbarLayout = 'inline' | 'rows' | 'columns';

export interface CgToolbarItem<TData = unknown> {
  name: string;
  text?: string;
  adaptiveText?: string;
  tooltip?: string;
  icon?: CgIconSource;
  disabled?: boolean;
  visible?: boolean;
  beginGroup?: boolean;
  alignment?: CgToolbarItemAlignment;
  appearance?: CgButtonAppearance;
  adaptivePriority?: number;
  overflowBehavior?: CgToolbarOverflowBehavior;
  allowTextCollapse?: boolean;
  onClick?: (details: CgToolbarItemActivationDetails<TData>) => void | PromiseLike<void>;
  busy?: boolean;
  autoBusy?: boolean;
  suppressDuplicateClicks?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean, details: CgToolbarItemActivationDetails<TData>) => void | PromiseLike<void>;
  radioGroup?: string;
  navigateUrl?: string;
  target?: string;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  data?: TData;
  render?: (context: CgToolbarItemRenderContext<TData>) => ReactNode;
  children?: ReadonlyArray<CgToolbarItem<TData>>;
  /** Starts a new row when the toolbar's `layout` is `rows`. */
  beginRow?: boolean;
  /** Puts the icon above the text. When the toolbar's `layout` is `columns`, the item also fills its column. */
  stacked?: boolean;
  /** Opens this content in a flyout: a split button with `onClick`, otherwise a drop-down button. The item never overflows, because a menu can't host it. */
  renderFlyout?: (context: CgButtonFlyoutContext) => ReactNode;
  /** Accessible name of the item's menu or flyout. */
  menuAriaLabel?: string;
  /** Accessible name of a split button's arrow. */
  toggleAriaLabel?: string;
  /** For a `render` item holding a text box or combo box: its content keeps its own tab stop and arrow keys, and arrow navigation passes over it. */
  ownsKeyboard?: boolean;
}

export interface CgToolbarItemActivationDetails<TData = unknown> {
  item: CgToolbarItem<TData>;
  source: CgToolbarActivationSource;
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  isOverflowItem: boolean;
  isMenuItem: boolean;
  proposedChecked?: boolean;
}

export interface CgToolbarItemRenderContext<TData = unknown> {
  item: CgToolbarItem<TData>;
  displayMode: CgToolbarItemDisplayMode;
  isOverflowItem: boolean;
  busy: boolean;
  defaultContent: ReactNode;
  activate: (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => Promise<void>;
}

export interface CgToolbarActions {
  focus: () => void;
  focusItem: (name: string) => void;
  closeMenus: () => void;
  recalculateLayout: () => void;
}

type NativeToolbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title' | 'onClick'>;

export interface CgToolbarProps<TData = unknown> extends NativeToolbarProps {
  title?: ReactNode;
  renderTitle?: () => ReactNode;
  items: ReadonlyArray<CgToolbarItem<TData>>;
  startContent?: ReactNode;
  endContent?: ReactNode;
  onItemClick?: (details: CgToolbarItemActivationDetails<TData>) => void | PromiseLike<void>;
  onItemError?: (error: unknown, details: CgToolbarItemActivationDetails<TData>) => void;
  size?: CgSizeMode;
  /** Defaults to `inline`. */
  layout?: CgToolbarLayout;
  /** Items per column when `layout` is `columns`. Defaults to `3`. */
  columnRows?: number;
  defaultItemAppearance?: CgButtonAppearance;
  autoCollapseText?: boolean;
  autoOverflow?: boolean;
  minimumVisibleItemCount?: number;
  direction?: CgDirection;
  ariaLabel?: string;
  overflowButtonLabel?: string;
  overflowButtonContent?: ReactNode;
  actionsRef?: Ref<CgToolbarActions>;
}
