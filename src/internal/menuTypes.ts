import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { CgIconSource, CgIntent } from '../types';

export type MenuRouteMatch = 'exact' | 'prefix';
export type MenuActivationSource = 'pointer' | 'keyboard';

export interface MenuDescriptor<TData = unknown> {
  key: string;
  parentKey?: string;
  text?: string;
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
  href?: string;
  target?: string;
  routeMatch?: MenuRouteMatch;
  checked?: boolean;
  radioGroup?: string;
  data?: TData;
  adaptivePriority?: number;
  children?: ReadonlyArray<MenuDescriptor<TData>>;
  onActivate?: (details: MenuActivationDetails<TData>) => unknown;
}

export interface MenuNode<TData = unknown> {
  readonly key: string;
  readonly parentKey?: string;
  readonly text: string;
  readonly icon?: CgIconSource;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly separator: boolean;
  readonly beginGroup: boolean;
  readonly tooltip?: string;
  readonly className?: string;
  readonly intent: CgIntent;
  readonly badge?: ReactNode;
  readonly shortcut?: ReactNode;
  readonly href?: string;
  readonly target?: string;
  readonly routeMatch: MenuRouteMatch;
  readonly checked?: boolean;
  readonly radioGroup?: string;
  readonly data?: TData;
  readonly adaptivePriority: number;
  readonly sourceIndex: number;
  readonly depth: number;
  readonly children: ReadonlyArray<MenuNode<TData>>;
  readonly onActivate?: (details: MenuActivationDetails<TData>) => unknown;
}

export interface MenuActivationDetails<TData = unknown> {
  item: MenuNode<TData>;
  source: MenuActivationSource;
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface MenuRenderContext<TData = unknown> {
  item: MenuNode<TData>;
  active: boolean;
  expanded: boolean;
  busy: boolean;
  level: number;
  defaultContent: ReactNode;
}

export interface NormalizeMenuOptions {
  componentName: string;
  maxDepth: number;
  allowFlat?: boolean;
  allowBranchAction?: boolean;
  pruneEmptyParents?: boolean;
  requireText?: boolean;
}

