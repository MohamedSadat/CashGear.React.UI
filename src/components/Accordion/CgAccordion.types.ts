import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgDirection, CgIconSource, CgSizeMode } from '../../types';

export type CgAccordionExpansionMode = 'none' | 'single-sibling' | 'multiple';
export type CgAccordionExpansionTrigger = 'header' | 'button';
export type CgAccordionSelectionMode = 'none' | 'single';
export type CgAccordionContentMode = 'always' | 'expanded-only' | 'on-demand';
export type CgAccordionSemantics = 'auto' | 'tree' | 'disclosure';
export type CgAccordionRouteMatch = 'exact' | 'prefix' | 'ignore-query-and-fragment';
export type CgAccordionExpandButtonPosition = 'start' | 'end';
export type CgAccordionTextOverflow = 'wrap' | 'ellipsis';
export type CgAccordionChangeSource = 'pointer' | 'keyboard' | 'action' | 'route' | 'collection';
export type CgAccordionCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgAccordionItemDescriptor<TData = unknown> {
  key: string;
  text: string;
  parentKey?: string;
  children?: ReadonlyArray<CgAccordionItemDescriptor<TData>>;
  icon?: CgIconSource;
  navigateUrl?: string;
  target?: string;
  routeMatch?: CgAccordionRouteMatch;
  disabled?: boolean;
  visible?: boolean;
  selectable?: boolean;
  expandable?: boolean;
  hasChildren?: boolean;
  searchText?: string;
  content?: ReactNode;
  renderHeader?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderContent?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderIcon?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderExpandButton?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  metadata?: Readonly<Record<string, unknown>>;
  data?: TData;
}

export interface CgAccordionChangeDetails<TData = unknown> {
  key: string | null;
  item?: CgAccordionItemDescriptor<TData>;
  expanded?: boolean;
  previousSelectedKey?: string | null;
  selectedKey?: string | null;
  expandedKeys: ReadonlySet<string>;
  source: CgAccordionChangeSource;
  isUserInitiated: boolean;
  event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgAccordionBeforeChangeDetails<TData = unknown> extends CgAccordionChangeDetails<TData> {
  signal: AbortSignal;
}

export interface CgAccordionItemRenderContext<TData = unknown> {
  item: CgAccordionItemDescriptor<TData>;
  key: string;
  depth: number;
  expanded: boolean;
  selected: boolean;
  disabled: boolean;
  loading: boolean;
  error: unknown;
  matched: boolean;
  defaultContent: ReactNode;
}

export interface CgAccordionLoadChildrenDetails<TData = unknown> {
  item: CgAccordionItemDescriptor<TData>;
  key: string;
  depth: number;
  refresh: boolean;
  signal: AbortSignal;
}

export interface CgAccordionFilterContext<TData = unknown> {
  item: CgAccordionItemDescriptor<TData>;
  key: string;
  depth: number;
  query: string;
  matched: boolean;
  defaultContent: ReactNode;
}

export interface CgAccordionLabels {
  expand: string;
  collapse: string;
  loading: string;
  retry: string;
  loadError: string;
  filter: string;
}

export interface CgAccordionActions {
  setItemExpanded: (key: string, expanded: boolean) => Promise<boolean>;
  expandAll: () => Promise<boolean>;
  collapseAll: () => Promise<boolean>;
  expandToItem: (key: string) => Promise<boolean>;
  isItemExpanded: (key: string) => boolean;
  selectItem: (key: string) => Promise<boolean>;
  clearSelection: () => void;
  focus: (key?: string) => void;
  reloadChildren: (key: string) => Promise<boolean>;
}

type NativeAccordionProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSelect'>;

export interface CgAccordionProps<TData = unknown> extends NativeAccordionProps {
  items: ReadonlyArray<CgAccordionItemDescriptor<TData>>;
  expandedKeys?: ReadonlySet<string>;
  defaultExpandedKeys?: ReadonlySet<string>;
  onExpandedKeysChange?: (keys: ReadonlySet<string>, details: CgAccordionChangeDetails<TData>) => void;
  selectedKey?: string | null;
  defaultSelectedKey?: string | null;
  onSelectedKeyChange?: (key: string | null, details: CgAccordionChangeDetails<TData>) => void;
  filterText?: string;
  defaultFilterText?: string;
  onFilterTextChange?: (value: string) => void;
  expansionMode?: CgAccordionExpansionMode;
  expansionTrigger?: CgAccordionExpansionTrigger;
  selectionMode?: CgAccordionSelectionMode;
  selectOnExpand?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  semantics?: CgAccordionSemantics;
  contentMode?: CgAccordionContentMode;
  currentLocation?: string;
  onNavigate?: (item: CgAccordionItemDescriptor<TData>, event: MouseEvent<HTMLAnchorElement>) => void;
  beforeExpand?: (details: CgAccordionBeforeChangeDetails<TData>) => CgAccordionCancelableResult;
  afterExpand?: (details: CgAccordionChangeDetails<TData>) => void | PromiseLike<void>;
  beforeCollapse?: (details: CgAccordionBeforeChangeDetails<TData>) => CgAccordionCancelableResult;
  afterCollapse?: (details: CgAccordionChangeDetails<TData>) => void | PromiseLike<void>;
  beforeSelectionChange?: (details: CgAccordionBeforeChangeDetails<TData>) => CgAccordionCancelableResult;
  afterSelectionChange?: (details: CgAccordionChangeDetails<TData>) => void | PromiseLike<void>;
  onItemActivate?: (details: CgAccordionChangeDetails<TData>) => void;
  onLifecycleError?: (error: unknown, details: CgAccordionChangeDetails<TData>) => void;
  loadChildren?: (details: CgAccordionLoadChildrenDetails<TData>) => PromiseLike<ReadonlyArray<CgAccordionItemDescriptor<TData>>>;
  onLoadFailure?: (error: unknown, details: CgAccordionLoadChildrenDetails<TData>) => void;
  filterMinLength?: number;
  filterLocale?: string;
  filterPredicate?: (item: CgAccordionItemDescriptor<TData>, normalizedQuery: string) => boolean;
  showMatchingDescendants?: boolean;
  loadChildrenWhileFiltering?: boolean;
  highlightMatches?: boolean;
  renderFilter?: (context: CgAccordionFilterContext<TData>) => ReactNode;
  renderHeader?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderContent?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderIcon?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  renderExpandButton?: (context: CgAccordionItemRenderContext<TData>) => ReactNode;
  expandButtonPosition?: CgAccordionExpandButtonPosition;
  textOverflow?: CgAccordionTextOverflow;
  animated?: boolean;
  animationDuration?: number;
  size?: CgSizeMode;
  direction?: CgDirection;
  labels?: Partial<CgAccordionLabels>;
  emptyContent?: ReactNode;
  noMatchContent?: ReactNode;
  actionsRef?: Ref<CgAccordionActions>;
}
