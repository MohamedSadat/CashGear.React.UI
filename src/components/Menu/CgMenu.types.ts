import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgIntent, CgOrientation, CgSizeMode } from '../../types';

export type CgMenuDisplayMode = 'desktop' | 'mobile' | 'automatic';
export type CgMenuSubmenuTrigger = 'click' | 'hover';
export type CgMenuItemAlignment = 'start' | 'center' | 'end';
export type CgMenuSelectionMode = 'route' | 'manual' | 'none';
export type CgMenuSemanticMode = 'navigation' | 'application-menu';
export type CgMenuHamburgerPosition = 'start' | 'end';
export type CgMenuRouteMatch = 'exact' | 'prefix';

export interface CgMenuItem<TData = unknown> {
  key: string;
  parentKey?: string;
  text: string;
  icon?: CgIconSource;
  visible?: boolean;
  disabled?: boolean;
  separator?: boolean;
  beginGroup?: boolean;
  tooltip?: string;
  className?: string;
  intent?: CgIntent;
  badge?: ReactNode;
  shortcut?: ReactNode;
  navigateUrl?: string;
  target?: string;
  routeMatch?: CgMenuRouteMatch;
  checked?: boolean;
  radioGroup?: string;
  data?: TData;
  adaptivePriority?: number;
  children?: ReadonlyArray<CgMenuItem<TData>>;
  onActivate?: (details: CgMenuItemActivationDetails<TData>) => void | PromiseLike<void>;
}

export interface CgMenuItemContext<TData = unknown> {
  item: CgMenuItem<TData>;
  level: number;
  active: boolean;
  expanded: boolean;
  selected: boolean;
  busy: boolean;
  iconOnly: boolean;
  defaultContent: ReactNode;
}

export interface CgMenuSubmenuContext<TData = unknown> {
  parent: CgMenuItem<TData>;
  level: number;
  childContent: ReactNode;
}

export interface CgMenuItemActivationDetails<TData = unknown> {
  item: CgMenuItem<TData>;
  source: 'pointer' | 'keyboard';
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
  proposedChecked?: boolean;
}

export interface CgMenuSelectionChangeDetails<TData = unknown> extends CgMenuItemActivationDetails<TData> {
  previousKey: string | null;
}

export interface CgMenuExpansionChangeDetails<TData = unknown> {
  item: CgMenuItem<TData>;
  expanded: boolean;
  expandedKeys: ReadonlySet<string>;
}

export interface CgMenuNavigateDetails<TData = unknown> {
  item: CgMenuItem<TData>;
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgMenuActions {
  focus: () => void;
  focusItem: (key: string) => void;
  expandItem: (key: string) => void;
  collapseItem: (key: string) => void;
  collapseAll: () => void;
  open: () => void;
  close: () => void;
}

type NativeMenuProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'title' | 'onSelect'>;

export interface CgMenuProps<TData = unknown> extends NativeMenuProps {
  items: ReadonlyArray<CgMenuItem<TData>>;
  orientation?: CgOrientation;
  displayMode?: CgMenuDisplayMode;
  submenuTrigger?: CgMenuSubmenuTrigger;
  itemAlignment?: CgMenuItemAlignment;
  selectionMode?: CgMenuSelectionMode;
  selectedKey?: string | null;
  defaultSelectedKey?: string | null;
  onSelectedKeyChange?: (key: string | null, details: CgMenuSelectionChangeDetails<TData>) => void;
  expandedKeys?: ReadonlySet<string>;
  defaultExpandedKeys?: ReadonlySet<string>;
  onExpandedKeysChange?: (keys: ReadonlySet<string>) => void;
  title?: ReactNode;
  renderTitle?: (title: ReactNode) => ReactNode;
  renderItem?: (context: CgMenuItemContext<TData>) => ReactNode;
  renderItemText?: (context: CgMenuItemContext<TData>) => ReactNode;
  renderSubmenu?: (context: CgMenuSubmenuContext<TData>) => ReactNode;
  collapseCaptionsToIcons?: boolean;
  collapseItemsIntoHamburger?: boolean;
  hamburgerPosition?: CgMenuHamburgerPosition;
  openDelay?: number;
  closeDelay?: number;
  closeOnItemClick?: boolean;
  disabled?: boolean;
  size?: CgSizeMode;
  direction?: CgDirection;
  semanticMode?: CgMenuSemanticMode;
  pruneEmptyParents?: boolean;
  currentLocation?: string;
  locale?: string;
  onItemActivate?: (details: CgMenuItemActivationDetails<TData>) => void | PromiseLike<void>;
  onItemExpansionChange?: (details: CgMenuExpansionChangeDetails<TData>) => void;
  onNavigate?: (details: CgMenuNavigateDetails<TData>) => void;
  onOpen?: () => void;
  onClose?: () => void;
  ariaLabel?: string;
  hamburgerAriaLabel?: string;
  actionsRef?: Ref<CgMenuActions>;
}

