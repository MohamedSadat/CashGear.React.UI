import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, MouseEvent, PointerEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgSizeMode } from '../../types';

export type CgTabsPosition = 'top' | 'bottom' | 'left' | 'right';
export type CgTabsContentMode = 'active-only' | 'all' | 'on-demand';
export type CgTabsScrollMode = 'auto' | 'buttons' | 'native' | 'none';
export type CgTabCloseReason = 'close-button' | 'delete-key';
export type CgTabsChangeSource = 'pointer' | 'keyboard' | 'action' | 'collection';
export type CgTabsCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgTabDescriptor<TData = unknown> {
  key: string;
  text: string;
  visible?: boolean;
  disabled?: boolean;
  closable?: boolean;
  icon?: CgIconSource;
  tooltip?: string;
  content?: ReactNode;
  renderHeader?: (context: CgTabRenderContext<TData>) => ReactNode;
  headerClassName?: string;
  contentClassName?: string;
  headerAttributes?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'disabled' | 'id' | 'role'>;
  contentAttributes?: Omit<HTMLAttributes<HTMLElement>, 'children' | 'id' | 'role'>;
  data?: TData;
}

export interface CgTabRenderContext<TData = unknown> {
  tab: CgTabDescriptor<TData>;
  index: number;
  active: boolean;
  focused: boolean;
  defaultContent: ReactNode;
}

export interface CgTabsActiveKeyChangeDetails<TData = unknown> {
  previousKey: string | null;
  activeKey: string | null;
  previousIndex: number;
  activeIndex: number;
  source: CgTabsChangeSource;
  isUserInitiated: boolean;
  tab?: CgTabDescriptor<TData>;
  event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgTabCloseDetails<TData = unknown> {
  tab: CgTabDescriptor<TData>;
  key: string;
  index: number;
  reason: CgTabCloseReason;
  signal: AbortSignal;
  event?: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>;
}

export interface CgTabReorderDetails<TData = unknown> {
  tab: CgTabDescriptor<TData>;
  key: string;
  fromIndex: number;
  toIndex: number;
  event: PointerEvent<HTMLElement>;
}

export interface CgTabsLabels {
  previousTabs: string;
  nextTabs: string;
  closeTab: (text: string) => string;
}

export interface CgTabsActions {
  focusActive: () => void;
  focusTab: (key: string) => void;
  activateTab: (key: string) => boolean;
  scrollTabIntoView: (key: string) => void;
}

type NativeTabsProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'>;

export interface CgTabsProps<TData = unknown> extends NativeTabsProps {
  tabs: ReadonlyArray<CgTabDescriptor<TData>>;
  activeKey?: string | null;
  defaultActiveKey?: string | null;
  onActiveKeyChange?: (key: string | null, details: CgTabsActiveKeyChangeDetails<TData>) => void;
  position?: CgTabsPosition;
  contentMode?: CgTabsContentMode;
  scrollMode?: CgTabsScrollMode;
  size?: CgSizeMode;
  direction?: CgDirection;
  reorderable?: boolean;
  beforeClose?: (details: CgTabCloseDetails<TData>) => CgTabsCancelableResult;
  onCloseRequest?: (details: CgTabCloseDetails<TData>) => void | PromiseLike<void>;
  onCloseError?: (error: unknown, details: CgTabCloseDetails<TData>) => void;
  onReorder?: (details: CgTabReorderDetails<TData>) => void;
  emptyContent?: ReactNode;
  ariaLabel?: string;
  labels?: Partial<CgTabsLabels>;
  actionsRef?: Ref<CgTabsActions>;
}
