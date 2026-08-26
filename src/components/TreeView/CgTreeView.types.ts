import type {
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react';
import type {
  CgContextMenuCommandDetails,
  CgContextMenuCommandFailureDetails,
  CgContextMenuCustomizeDetails,
  CgContextMenuItem,
  CgContextMenuInvocationKind,
} from '../ContextMenu';
import type { CgDirection, CgIconSource, CgOverlayRectangle, CgSizeMode } from '../../types';

export type CgTreeViewCheckMode = 'disabled' | 'multiple' | 'recursive';
export type CgTreeViewCheckState = 'none' | 'unchecked' | 'checked' | 'mixed';
export type CgTreeViewContextMenuAreas = 'none' | 'node' | 'empty' | 'all';
export type CgTreeViewContextMenuArea = 'node' | 'empty';
export type CgTreeViewChangeSource = 'pointer' | 'keyboard' | 'action' | 'context-menu' | 'collection';
export type CgTreeViewCancelableResult = void | boolean | PromiseLike<void | boolean>;

export interface CgTreeViewTextFragment { readonly text: string; readonly matched: boolean }

export interface CgTreeViewNodeDescriptor<TItem = unknown> {
  key: string;
  text: ReactNode;
  searchText?: string;
  item?: TItem;
  parentKey?: string | null;
  children?: ReadonlyArray<CgTreeViewNodeDescriptor<TItem>>;
  icon?: CgIconSource;
  visible?: boolean;
  disabled?: boolean;
  allowSelection?: boolean;
  allowCheck?: boolean;
  nodeRenderer?: (context: CgTreeViewNodeRenderContext<TItem>) => ReactNode;
  className?: string;
  data?: unknown;
}

export interface CgTreeViewFilterMatch {
  readonly active: boolean;
  readonly query: string;
  readonly matched: boolean;
  readonly fragments: ReadonlyArray<CgTreeViewTextFragment>;
}

export interface CgTreeViewNodeRenderContext<TItem = unknown> {
  readonly descriptor: CgTreeViewNodeDescriptor<TItem>;
  readonly item: TItem | undefined;
  readonly data: unknown;
  readonly key: string;
  readonly text: ReactNode;
  readonly parentKey: string | null;
  readonly depth: number;
  readonly visibleIndex: number;
  readonly hasChildren: boolean;
  readonly selected: boolean;
  readonly expanded: boolean;
  readonly checkState: CgTreeViewCheckState;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly allowSelection: boolean;
  readonly allowCheck: boolean;
  readonly icon: CgIconSource | undefined;
  readonly filter: CgTreeViewFilterMatch;
  readonly actions: CgTreeViewActions;
  readonly defaultContent: ReactNode;
}

export interface CgTreeViewNodeDetails<TItem = unknown> {
  readonly key: string | null;
  readonly node?: CgTreeViewNodeRenderContext<TItem>;
  readonly source: CgTreeViewChangeSource;
  readonly isUserInitiated: boolean;
  readonly event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgTreeViewSelectionChangeDetails<TItem = unknown> extends CgTreeViewNodeDetails<TItem> {
  readonly oldKey: string | null;
  readonly newKey: string | null;
}

export interface CgTreeViewBeforeSelectionChangeDetails<TItem = unknown> extends CgTreeViewSelectionChangeDetails<TItem> {
  readonly signal: AbortSignal;
}

export interface CgTreeViewExpansionChangeDetails<TItem = unknown> extends CgTreeViewNodeDetails<TItem> {
  readonly expanded: boolean;
  readonly expandedKeys: ReadonlySet<string>;
}

export interface CgTreeViewBeforeExpansionChangeDetails<TItem = unknown> extends CgTreeViewExpansionChangeDetails<TItem> {
  readonly signal: AbortSignal;
}

export interface CgTreeViewCheckedChangeDetails<TItem = unknown> extends CgTreeViewNodeDetails<TItem> {
  readonly checkedKeys: ReadonlySet<string>;
  readonly newlyCheckedKeys: ReadonlySet<string>;
  readonly newlyUncheckedKeys: ReadonlySet<string>;
}

export interface CgTreeViewContextInvocation {
  readonly kind: CgContextMenuInvocationKind;
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface CgTreeViewContext<TItem = unknown> {
  readonly area: CgTreeViewContextMenuArea;
  readonly item: TItem | undefined;
  readonly parentItem: TItem | undefined;
  readonly key: string | null;
  readonly parentKey: string | null;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  readonly checkState: CgTreeViewCheckState;
  readonly disabled: boolean;
  readonly targetRectangle: CgOverlayRectangle;
  readonly invocation: CgTreeViewContextInvocation;
}

export interface CgTreeViewFilterRenderContext {
  readonly filterText: string;
  readonly normalizedQuery: string;
  readonly active: boolean;
  readonly setFilterText: (value: string) => void;
  readonly defaultContent: ReactNode;
}

export interface CgTreeViewLabels {
  filter: string;
  filterPlaceholder: string;
  filterMinimumLength: string;
  expand: string;
  collapse: string;
  check: string;
  empty: string;
  noMatches: string;
  openCommand: string;
  expandCommand: string;
  collapseCommand: string;
  checkCommand: string;
  uncheckCommand: string;
  copyKeyCommand: string;
  expandAllCommand: string;
  collapseAllCommand: string;
}

export interface CgTreeViewActions {
  focus: (key?: string) => Promise<void>;
  select: (key: string) => Promise<boolean>;
  clearSelection: () => Promise<boolean>;
  setNodeExpanded: (key: string, expanded: boolean) => Promise<boolean>;
  expandAll: () => Promise<boolean>;
  collapseAll: () => Promise<boolean>;
  expandToKey: (key: string) => Promise<boolean>;
  setNodeChecked: (key: string, checked: boolean) => Promise<boolean>;
  checkAll: () => Promise<boolean>;
  clearChecks: () => Promise<boolean>;
  scrollToKey: (key: string) => Promise<void>;
}

type NativeTreeViewProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onSelect'>;

export interface CgTreeViewProps<TItem = unknown> extends NativeTreeViewProps {
  nodes: ReadonlyArray<CgTreeViewNodeDescriptor<TItem>>;
  selectedKey?: string | null;
  defaultSelectedKey?: string | null;
  onSelectedKeyChange?: (key: string | null, details: CgTreeViewSelectionChangeDetails<TItem>) => void;
  expandedKeys?: ReadonlySet<string>;
  defaultExpandedKeys?: ReadonlySet<string>;
  onExpandedKeysChange?: (keys: ReadonlySet<string>, details: CgTreeViewExpansionChangeDetails<TItem>) => void;
  checkedKeys?: ReadonlySet<string>;
  defaultCheckedKeys?: ReadonlySet<string>;
  onCheckedKeysChange?: (keys: ReadonlySet<string>, details: CgTreeViewCheckedChangeDetails<TItem>) => void;
  filterText?: string;
  defaultFilterText?: string;
  onFilterTextChange?: (value: string) => void;
  allowSelection?: boolean;
  checkMode?: CgTreeViewCheckMode;
  beforeSelectionChange?: (details: CgTreeViewBeforeSelectionChangeDetails<TItem>) => CgTreeViewCancelableResult;
  afterSelectionChange?: (details: CgTreeViewSelectionChangeDetails<TItem>) => void | PromiseLike<void>;
  beforeExpand?: (details: CgTreeViewBeforeExpansionChangeDetails<TItem>) => CgTreeViewCancelableResult;
  beforeCollapse?: (details: CgTreeViewBeforeExpansionChangeDetails<TItem>) => CgTreeViewCancelableResult;
  afterExpansionChange?: (details: CgTreeViewExpansionChangeDetails<TItem>) => void | PromiseLike<void>;
  onNodeActivate?: (details: CgTreeViewNodeDetails<TItem>) => void;
  onLifecycleError?: (error: unknown, details: CgTreeViewNodeDetails<TItem>) => void;
  showFilterPanel?: boolean;
  filterMinimumLength?: number;
  filterLocale?: string;
  filterPredicate?: (node: CgTreeViewNodeDescriptor<TItem>, normalizedQuery: string) => boolean;
  filterRenderer?: (context: CgTreeViewFilterRenderContext) => ReactNode;
  nodeRenderer?: (context: CgTreeViewNodeRenderContext<TItem>) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderNoMatches?: (query: string) => ReactNode;
  textWrap?: boolean;
  size?: CgSizeMode;
  direction?: CgDirection;
  disabled?: boolean;
  readOnly?: boolean;
  labels?: Partial<CgTreeViewLabels>;
  contextMenuAreas?: CgTreeViewContextMenuAreas;
  customizeContextMenu?: (
    details: CgContextMenuCustomizeDetails<CgTreeViewContext<TItem>>,
  ) => void | ReadonlyArray<CgContextMenuItem<CgTreeViewContext<TItem>>> | PromiseLike<void | ReadonlyArray<CgContextMenuItem<CgTreeViewContext<TItem>>>>;
  onContextMenuItemActivate?: (details: CgContextMenuCommandDetails<CgTreeViewContext<TItem>>) => void | PromiseLike<void>;
  onContextMenuCommandFailure?: (details: CgContextMenuCommandFailureDetails<CgTreeViewContext<TItem>>) => void | PromiseLike<void>;
  actionsRef?: Ref<CgTreeViewActions>;
}
