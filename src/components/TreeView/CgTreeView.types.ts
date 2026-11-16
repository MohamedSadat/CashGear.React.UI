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
/** Where a moved node lands next to another: before it, inside it as its last child, or after it. */
export type CgTreeViewDropPosition = 'before' | 'inside' | 'after';
export type CgTreeViewMoveSource = 'pointer' | 'keyboard';
/** ArrowRight and ArrowLeft: `physical` (the default) expands with ArrowRight in both directions; `logical` follows the reading direction, so ArrowLeft expands in right to left. */
export type CgTreeViewArrowKeys = 'physical' | 'logical';
/** A node's `aria-current`: `true`, or the kind of current item, such as the page open (`page`) or the place in a path (`location`). */
export type CgTreeViewNodeCurrent = boolean | 'page' | 'location';

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
  /** The node has children that `children` does not hold yet: it can be expanded, and expanding it calls `loadChildren`. */
  hasChildren?: boolean;
  /** False: the node cannot be dragged or moved by keys (with `onNodeMove`). */
  allowDrag?: boolean;
  /** False: the node cannot be renamed (with `onNodeRename`). */
  allowRename?: boolean;
  /** The text a rename starts from, when `text` is not that string (rich content, or an empty title shown as a placeholder). */
  renameText?: string;
  /**
   * False: the node never folds, such as a section heading. It draws no toggle and its children always
   * show, whatever `expandedKeys` holds; collapsing it by keys, `actions` or the menu does nothing, and
   * it keeps `aria-expanded="true"` (it is a parent whose group is open). Default true.
   */
  collapsible?: boolean;
  /**
   * Marks the node as the current one, such as the page open, apart from selection: sets `aria-current`
   * on its tree item and draws a bar at the row's start with medium weight text.
   */
  current?: CgTreeViewNodeCurrent;
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
  /** The context menu's accessible name. Default "Tree view context menu". */
  contextMenu?: string;
}

/** A place a node could move to, offered to `canDrop` before its line is shown or a move is made. */
export interface CgTreeViewDropCandidate<TItem = unknown> {
  /** The node being moved. */
  readonly key: string;
  readonly item: TItem | undefined;
  /** The node the place is next to, and where: before it, inside it (as its last child), or after it. */
  readonly targetKey: string;
  readonly targetItem: TItem | undefined;
  readonly position: CgTreeViewDropPosition;
  /** The parent after the move; null at the top level. */
  readonly parentKey: string | null;
  readonly parentItem: TItem | undefined;
  /** The place among the parent's children after the move. Every child in `nodes` counts, hidden or filtered out too. */
  readonly index: number;
  /** The sibling it follows after the move, or null when it comes first. */
  readonly previousKey: string | null;
  /** The sibling that follows it after the move, or null when it comes last. */
  readonly nextKey: string | null;
  readonly source: CgTreeViewMoveSource;
}

/** A move asked for by a drop or by keys. The tree changes nothing: the caller moves the node in `nodes`. */
export interface CgTreeViewMoveDetails<TItem = unknown> extends CgTreeViewDropCandidate<TItem> {
  readonly node: CgTreeViewNodeRenderContext<TItem>;
  readonly oldParentKey: string | null;
  readonly oldIndex: number;
}

/** The words of moving, required with `onNodeMove`. */
export interface CgTreeViewMoveLabels<TItem = unknown> {
  /** Each movable row's description, such as "Drag, or press Alt+Shift with an arrow key, to move". */
  instructions: string;
  /** Spoken after a move, such as "Budget moved into Finance". */
  moved: (details: CgTreeViewMoveDetails<TItem>) => string;
}

/** A rename asked for: Enter, Tab or leaving the field with changed text. The caller renames the node in `nodes`. */
export interface CgTreeViewRenameDetails<TItem = unknown> {
  readonly key: string;
  readonly node: CgTreeViewNodeRenderContext<TItem>;
  /** The text as typed. */
  readonly text: string;
  /** The text the rename started from. */
  readonly previousText: string;
  readonly end: 'enter' | 'tab' | 'shiftTab' | 'blur';
}

export interface CgTreeViewLoadChildrenDetails<TItem = unknown> {
  readonly key: string;
  readonly node: CgTreeViewNodeRenderContext<TItem>;
  /** Aborted when the node is collapsed, retried, or the tree unmounts. */
  readonly signal: AbortSignal;
  readonly source: 'expand' | 'retry';
}

/** The words of lazy children, required with `loadChildren`. */
export interface CgTreeViewLoadLabels<TItem = unknown> {
  /** The row shown under a node while its children load. */
  loading: string;
  /** The row shown, and spoken, when a load failed. */
  loadError: string | ((error: unknown, node: CgTreeViewNodeRenderContext<TItem>) => string);
  /** The button on that row that loads again. */
  retry: string;
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
  /** Opens the rename field on a drawn node (with `onNodeRename`), as F2 does: for a menu's Rename command. */
  startRename: (key: string) => Promise<void>;
  /** Opens the node's context menu (with `contextMenuAreas` 'node' or 'all') near `anchor`, such as a row's More button, or at the row. */
  showContextMenu: (key: string, anchor?: HTMLElement) => Promise<boolean>;
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
  /**
   * Turns moving on: a row dragged before, after or inside another (the pointer's place in the row,
   * and its distance from the inline start below the end of a branch, decide which), or moved by
   * Alt+Shift with an arrow key. Reports the move; the caller changes `nodes`. Needs `moveLabels`.
   */
  onNodeMove?: (details: CgTreeViewMoveDetails<TItem>) => void;
  /** Vetoes a place before its line shows. A node never goes inside itself or its descendants. */
  canDrop?: (candidate: CgTreeViewDropCandidate<TItem>) => boolean;
  /** Required with `onNodeMove`. */
  moveLabels?: CgTreeViewMoveLabels<TItem>;
  /**
   * Turns inline rename on: F2, a double click or `actions.startRename` opens a field in the row;
   * Enter, Tab or leaving it reports changed text, Escape puts the text back. Needs `renameLabel`.
   */
  onNodeRename?: (details: CgTreeViewRenameDetails<TItem>) => void;
  /** The rename field's accessible name, such as "Page title". Required with `onNodeRename`. */
  renameLabel?: string | ((node: CgTreeViewNodeRenderContext<TItem>) => string);
  /**
   * Loads a `hasChildren` node's children when it is expanded: the caller adds them to `nodes` and
   * resolves. A loading row shows meanwhile, and a failure shows a row with a retry button.
   * Collapsing aborts the signal. Needs `loadLabels`.
   */
  loadChildren?: (details: CgTreeViewLoadChildrenDetails<TItem>) => PromiseLike<void>;
  /** Required with `loadChildren`. */
  loadLabels?: CgTreeViewLoadLabels<TItem>;
  /**
   * Buttons at each row's end, such as Add inside and More, shown on hover, focus and selection. Clicks
   * there do not select the row, and they are not part of the row's accessible name (its text alone is).
   */
  renderActions?: (context: CgTreeViewNodeRenderContext<TItem>) => ReactNode;
  /**
   * Draws only the rows in view, for thousands of nodes: rows get one height (`rowHeight`) and do
   * not wrap, and the tree scrolls in its own box. Give it a height (`height`, or a sized root).
   */
  virtualize?: boolean;
  /** Pixels per row with `virtualize`. Default 28, 32 or 40 by `size`. */
  rowHeight?: number;
  /** Rows drawn beyond each end of the view with `virtualize`. Default 8. */
  overscan?: number;
  /** The scrolling box's block size with `virtualize`, in pixels or a CSS length. Default: what the root leaves it. */
  height?: number | string;
  /** How ArrowRight and ArrowLeft read in right to left. Default `physical`. */
  arrowKeys?: CgTreeViewArrowKeys;
}
