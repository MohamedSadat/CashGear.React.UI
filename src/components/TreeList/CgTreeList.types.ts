import type {
  CSSProperties,
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
  CgContextMenuInvocationKind,
  CgContextMenuItem,
} from '../ContextMenu';
import type {
  CgGridAggregateCompleteness,
  CgGridAggregateValue,
  CgGridEditorMetadata,
  CgGridGroupDescriptor,
  CgGridProviderSummaryDescriptor,
  CgGridSortDescriptor,
  CgGridSummaryDescriptor,
} from '../Grid';
import type { CgFilterNode } from '../../filter';
import type { CgDirection, CgIconSource, CgSizeMode } from '../../types';

/** Stable primitive identity accepted by React and by TreeList persistence contracts. */
export type CgTreeListKey = string | number;

/** Parent absence is explicit so `0` and `""` remain valid keys. */
export type CgTreeListParentKey<TKey extends CgTreeListKey = CgTreeListKey> =
  | { readonly kind: 'none' }
  | { readonly kind: 'key'; readonly key: TKey };

export type CgTreeListSelectionMode = 'none' | 'single' | 'multiple';
export type CgTreeListCheckMode = 'disabled' | 'independent' | 'recursive';
export type CgTreeListCheckState = 'unchecked' | 'checked' | 'mixed';
export type CgTreeListFilterMode = 'match-only' | 'match-with-ancestors' | 'ancestors-and-descendants';
export type CgTreeListOrphanPolicy = 'treat-as-root' | 'hide' | 'throw';
export type CgTreeListEditMode = 'inline' | 'popup';
export type CgTreeListExpansionReason = 'pointer' | 'keyboard' | 'api' | 'search' | 'expandToNode' | 'state-restoration';
export type CgTreeListInteractionReason = 'pointer' | 'keyboard' | 'api' | 'state-restoration' | 'provider';
export type CgTreeListContextMenuArea = 'row' | 'cell' | 'header' | 'empty-area';
export type CgTreeListProviderRequestMode = 'roots' | 'children' | 'resolve-path' | 'group-nodes' | 'group-items' | 'snapshot' | 'summaries';
export type CgTreeListSummaryScope = 'visible-rows' | 'loaded-nodes' | 'direct-children' | 'loaded-descendants' | 'complete-subtree';
export type CgTreeListOutputScope = 'visible-rows' | 'loaded-nodes' | 'complete-tree';
export type CgTreeListDetailMode = 'single' | 'multiple';
export type CgTreeListFixedRegion = 'none' | 'start' | 'end';
export type CgTreeListFilterNode = CgFilterNode;

export interface CgTreeListNode<TItem, TKey extends CgTreeListKey = CgTreeListKey> {
  readonly item: TItem;
  readonly key: TKey;
  readonly parentKey: CgTreeListParentKey<TKey>;
  readonly level: number;
  readonly visibleIndex: number;
  readonly posInSet: number;
  readonly setSize: number;
  readonly siblingIndex: number;
  readonly hasChildren: boolean;
  readonly childrenLoaded: boolean;
  readonly directMatch: boolean;
  readonly retainedAsAncestor: boolean;
}

export interface CgTreeListCellRenderContext<TItem, TKey extends CgTreeListKey, TValue = unknown> {
  readonly item: TItem;
  readonly key: TKey;
  readonly value: TValue;
  readonly node: CgTreeListNode<TItem, TKey>;
  readonly column: CgTreeListColumn<TItem, TKey>;
  readonly selected: boolean;
  readonly focused: boolean;
  readonly editing: boolean;
  readonly actions: CgTreeListActions<TItem, TKey>;
  readonly defaultContent: ReactNode;
}

export interface CgTreeListHeaderRenderContext<TItem, TKey extends CgTreeListKey> {
  readonly column: CgTreeListColumn<TItem, TKey>;
  readonly sort: CgGridSortDescriptor | undefined;
  readonly sortPriority: number;
  readonly actions: CgTreeListActions<TItem, TKey>;
  readonly defaultContent: ReactNode;
}

export interface CgTreeListEditorRenderContext<TItem, TKey extends CgTreeListKey, TValue = unknown> {
  readonly item: TItem;
  readonly model: TItem;
  readonly key: TKey | null;
  readonly value: TValue;
  readonly setValue: (value: TValue) => void;
  readonly fieldErrors: ReadonlyArray<string>;
  readonly disabled: boolean;
  readonly readOnly: boolean;
}

interface CgTreeListColumnCommon<TItem, TKey extends CgTreeListKey, TValue = unknown> {
  readonly fieldId: string;
  readonly formerFieldIds?: ReadonlyArray<string>;
  readonly getValue?: (item: TItem) => TValue;
  readonly updateValue?: (model: TItem, value: TValue) => TItem;
  readonly title?: string;
  readonly visible?: boolean;
  readonly hideable?: boolean;
  readonly hierarchy?: boolean;
  readonly width?: number | string;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly alignment?: 'start' | 'center' | 'end';
  readonly formatValue?: (value: TValue, item: TItem) => string;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly searchable?: boolean;
  readonly exportEnabled?: boolean;
  readonly printEnabled?: boolean;
  readonly renderHeader?: (context: CgTreeListHeaderRenderContext<TItem, TKey>) => ReactNode;
  readonly renderCell?: (context: CgTreeListCellRenderContext<TItem, TKey, TValue>) => ReactNode;
  readonly renderEditor?: (context: CgTreeListEditorRenderContext<TItem, TKey, TValue>) => ReactNode;
  readonly editor?: CgGridEditorMetadata<TItem, TValue>;
}

export interface CgTreeListDataColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey> { readonly type: 'data'; readonly getValue: (item: TItem) => unknown }
export interface CgTreeListTextColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey> { readonly type: 'text'; readonly getValue: (item: TItem) => unknown }
export interface CgTreeListNumberColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey, number | null | undefined> { readonly type: 'number'; readonly getValue: (item: TItem) => number | null | undefined }
export interface CgTreeListDateColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey, Date | string | null | undefined> { readonly type: 'date'; readonly getValue: (item: TItem) => Date | string | null | undefined; readonly dateTime?: boolean }
export interface CgTreeListBooleanColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey, boolean | null | undefined> { readonly type: 'boolean'; readonly getValue: (item: TItem) => boolean | null | undefined }
export interface CgTreeListTemplateColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey> { readonly type: 'template'; readonly renderCell: (context: CgTreeListCellRenderContext<TItem, TKey>) => ReactNode }
export interface CgTreeListSelectionColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey, never> { readonly type: 'selection'; readonly hierarchy?: false }
export interface CgTreeListCommandColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> extends CgTreeListColumnCommon<TItem, TKey, never> { readonly type: 'command'; readonly renderCommands?: (context: CgTreeListCellRenderContext<TItem, TKey>) => ReactNode }

export type CgTreeListColumn<TItem, TKey extends CgTreeListKey = CgTreeListKey> =
  | CgTreeListDataColumn<TItem, TKey>
  | CgTreeListTextColumn<TItem, TKey>
  | CgTreeListNumberColumn<TItem, TKey>
  | CgTreeListDateColumn<TItem, TKey>
  | CgTreeListBooleanColumn<TItem, TKey>
  | CgTreeListTemplateColumn<TItem, TKey>
  | CgTreeListSelectionColumn<TItem, TKey>
  | CgTreeListCommandColumn<TItem, TKey>;

export interface CgTreeListProviderNode<TItem, TKey extends CgTreeListKey> {
  readonly item: TItem;
  readonly key: TKey;
  readonly parentKey: CgTreeListParentKey<TKey>;
  readonly hasChildren: boolean;
  readonly projectionComplete?: boolean;
}

export interface CgTreeListProviderRequest<TKey extends CgTreeListKey> {
  readonly mode: CgTreeListProviderRequestMode;
  readonly requestId: string;
  readonly queryId: string;
  readonly generation: number;
  readonly parentKey: CgTreeListParentKey<TKey>;
  readonly targetKey?: TKey;
  readonly skip: number;
  readonly take: number;
  readonly fieldAliases: ReadonlyArray<string>;
  readonly filter: CgTreeListFilterNode | null;
  readonly filterMode: CgTreeListFilterMode;
  readonly searchText: string;
  readonly sorts: ReadonlyArray<CgGridSortDescriptor>;
  readonly groups: ReadonlyArray<CgGridGroupDescriptor>;
  readonly summaries: ReadonlyArray<CgGridProviderSummaryDescriptor>;
  readonly signal: AbortSignal;
}

export interface CgTreeListProviderResult<TItem, TKey extends CgTreeListKey> {
  readonly nodes: ReadonlyArray<CgTreeListProviderNode<TItem, TKey>>;
  readonly totalCount: number;
  readonly hasMore?: boolean;
  readonly projectionComplete?: boolean;
  readonly resolvedPath?: ReadonlyArray<CgTreeListProviderNode<TItem, TKey>>;
  readonly summaryValues?: Readonly<Record<string, unknown>>;
  readonly continuationToken?: string;
  readonly safeErrorCode?: string;
  readonly safeMessage?: string;
}

export type CgTreeListDataProvider<TItem, TKey extends CgTreeListKey> =
  (request: CgTreeListProviderRequest<TKey>) => PromiseLike<CgTreeListProviderResult<TItem, TKey>>;

export interface CgTreeListLoadChildrenContext<TItem, TKey extends CgTreeListKey> {
  readonly parentItem: TItem;
  readonly parentKey: TKey;
  readonly parentLevel: number;
  readonly sorts: ReadonlyArray<CgGridSortDescriptor>;
  readonly filter: CgTreeListFilterNode | null;
  readonly searchText: string;
  readonly attempt: number;
  readonly generation: number;
  readonly skip: number;
  readonly take: number;
  readonly signal: AbortSignal;
}

export interface CgTreeListLoadChildrenResult<TItem> {
  readonly children: ReadonlyArray<TItem>;
  readonly hasMore?: boolean;
  readonly totalCount?: number;
  readonly hasChildren?: boolean;
}

export interface CgTreeListExpansionEventDetail<TItem, TKey extends CgTreeListKey> {
  readonly item: TItem;
  readonly key: TKey;
  readonly level: number;
  readonly expanded: boolean;
  readonly reason: CgTreeListExpansionReason;
  readonly childrenLoaded: boolean;
  readonly expandedKeys: ReadonlySet<TKey>;
  readonly signal?: AbortSignal;
  readonly event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgTreeListSelectionChangeDetail<TItem, TKey extends CgTreeListKey> {
  readonly selectedKeys: ReadonlySet<TKey>;
  readonly selectedItems: ReadonlyArray<TItem>;
  readonly changedKey: TKey | null;
  readonly reason: CgTreeListInteractionReason;
}

export interface CgTreeListFocusChangeDetail<TKey extends CgTreeListKey> {
  readonly focusedKey: TKey | null;
  readonly focusedColumnId: string | null;
  readonly reason: CgTreeListInteractionReason;
}

export interface CgTreeListCheckedChangeDetail<TItem, TKey extends CgTreeListKey> {
  readonly checkedKeys: ReadonlySet<TKey>;
  readonly changedKey: TKey | null;
  readonly checked: boolean;
  readonly changedItems: ReadonlyArray<TItem>;
  readonly reason: CgTreeListInteractionReason;
}

export type CgTreeListMutationOutcome = 'success' | 'validation-failure' | 'failure' | 'conflict' | 'transient-failure' | 'permanent-failure';
export interface CgTreeListMutationResult<TItem = unknown> {
  readonly outcome: CgTreeListMutationOutcome;
  readonly item?: TItem;
  readonly concurrencyToken?: string;
  readonly fieldErrors?: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly generalErrors?: ReadonlyArray<string>;
  readonly safeErrorCode?: string;
  readonly safeMessage?: string;
}

interface CgTreeListMutationContextBase<TItem, TKey extends CgTreeListKey> {
  readonly item: TItem;
  readonly key: TKey;
  readonly attempt: number;
  readonly generation: number;
  readonly concurrencyToken?: string;
  readonly signal: AbortSignal;
}
export interface CgTreeListCreateContext<TItem, TKey extends CgTreeListKey> { readonly draft: TItem; readonly parentKey: CgTreeListParentKey<TKey>; readonly siblingPosition: number; readonly attempt: number; readonly generation: number; readonly clientValidationConclusive: boolean; readonly signal: AbortSignal }
export interface CgTreeListUpdateContext<TItem, TKey extends CgTreeListKey> extends CgTreeListMutationContextBase<TItem, TKey> { readonly draft: TItem; readonly changedFieldIds: ReadonlyArray<string> }
export interface CgTreeListDeleteContext<TItem, TKey extends CgTreeListKey> extends CgTreeListMutationContextBase<TItem, TKey> { readonly parentKey: CgTreeListParentKey<TKey> }
export interface CgTreeListMoveContext<TItem, TKey extends CgTreeListKey> extends CgTreeListMutationContextBase<TItem, TKey> { readonly oldParentKey: CgTreeListParentKey<TKey>; readonly proposedParentKey: CgTreeListParentKey<TKey>; readonly proposedSiblingPosition: number; readonly clientValidationConclusive: boolean }

export interface CgTreeListDetailLoadContext<TItem, TKey extends CgTreeListKey> { readonly item: TItem; readonly key: TKey; readonly attempt: number; readonly generation: number; readonly signal: AbortSignal }
export interface CgTreeListDetailResult { readonly detail?: unknown; readonly safeErrorCode?: string; readonly safeMessage?: string }
export interface CgTreeListDetailRenderContext<TItem, TKey extends CgTreeListKey> { readonly item: TItem; readonly key: TKey; readonly detail: unknown; readonly loading: boolean; readonly errorCode?: string; readonly retry: () => Promise<boolean>; readonly collapse: () => Promise<boolean> }

export interface CgTreeListSummary<TItem = unknown> extends CgGridSummaryDescriptor<TItem> { readonly scope: CgTreeListSummaryScope; readonly nodeKey?: CgTreeListKey }
export interface CgTreeListSummaryProviderRequest<TKey extends CgTreeListKey> { readonly queryId: string; readonly generation: number; readonly items: ReadonlyArray<{ readonly nodeKey: TKey; readonly summaryId: string; readonly scope: 'complete-subtree' }>; readonly signal: AbortSignal }
export interface CgTreeListSummaryProviderResult<TKey extends CgTreeListKey> { readonly values: ReadonlyArray<{ readonly nodeKey: TKey; readonly summaryId: string; readonly value: unknown; readonly completeness: CgGridAggregateCompleteness; readonly safeErrorCode?: string }> }

export interface CgTreeListSnapshotRow<TItem, TKey extends CgTreeListKey> { readonly item: TItem; readonly key: TKey; readonly parentKey: CgTreeListParentKey<TKey>; readonly level: number; readonly summaryValues?: Readonly<Record<string, CgGridAggregateValue>>; readonly detailText?: string }
export interface CgTreeListSnapshot<TItem, TKey extends CgTreeListKey> { readonly rows: ReadonlyArray<CgTreeListSnapshotRow<TItem, TKey>>; readonly complete: boolean; readonly totalSummaries: Readonly<Record<string, CgGridAggregateValue>> }
export interface CgTreeListSnapshotRequest { readonly scope: CgTreeListOutputScope; readonly columnIds: ReadonlyArray<string>; readonly includeSummaries: boolean; readonly includeDetails: boolean; readonly signal: AbortSignal }

export interface CgTreeListExportOptions { readonly scope?: CgTreeListOutputScope; readonly fileName?: string; readonly download?: boolean; readonly columnIds?: ReadonlyArray<string>; readonly includeSummaries?: boolean; readonly maximumRows?: number; readonly rightToLeft?: boolean; readonly signal?: AbortSignal }
export interface CgTreeListExportResult { readonly fileName: string; readonly mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; readonly bytes: Uint8Array; readonly rowCount: number }
export interface CgTreeListPrintOptions { readonly scope?: CgTreeListOutputScope; readonly title?: string; readonly columnIds?: ReadonlyArray<string>; readonly includeSummaries?: boolean; readonly openPrintDialog?: boolean; readonly signal?: AbortSignal }
export interface CgTreeListPrintResult { readonly title: string; readonly html: string; readonly rowCount: number }
export interface CgTreeListPdfDocument<TItem, TKey extends CgTreeListKey> { readonly title?: string; readonly columns: ReadonlyArray<{ readonly fieldId: string; readonly title: string; readonly alignment: 'start' | 'center' | 'end' }>; readonly snapshot: CgTreeListSnapshot<TItem, TKey>; readonly rightToLeft: boolean }
export interface CgTreeListPdfResult { readonly fileName: string; readonly mimeType: 'application/pdf'; readonly bytes: Uint8Array }

export interface CgTreeListColumnState { readonly fieldId: string; readonly visible: boolean; readonly displayOrder: number; readonly width?: number; readonly fixed: CgTreeListFixedRegion }
export interface CgTreeListPageState { readonly pageIndex: number; readonly pageSize: number; readonly totalCount?: number }
export interface CgTreeListState<TKey extends CgTreeListKey> { readonly version: 1; readonly columns: ReadonlyArray<CgTreeListColumnState>; readonly sorts: ReadonlyArray<CgGridSortDescriptor>; readonly filter: CgTreeListFilterNode | null; readonly filterMode: CgTreeListFilterMode; readonly groups: ReadonlyArray<CgGridGroupDescriptor>; readonly collapsedGroupKeys: ReadonlySet<string>; readonly rootPage: CgTreeListPageState; readonly childPages: ReadonlyMap<TKey, CgTreeListPageState> }
export interface CgTreeListStateChangeDetail { readonly operation: string; readonly reason: CgTreeListInteractionReason }
export interface CgTreeListViewContext { readonly companyId?: string; readonly userId?: string; readonly roleIds: ReadonlyArray<string>; readonly viewId: string }
export interface CgTreeListViewStore<TKey extends CgTreeListKey> { load(context: CgTreeListViewContext, signal: AbortSignal): PromiseLike<CgTreeListState<TKey> | null>; save(context: CgTreeListViewContext, state: CgTreeListState<TKey>, signal: AbortSignal): PromiseLike<void> }

export interface CgTreeListContext<TItem, TKey extends CgTreeListKey> {
  readonly area: CgTreeListContextMenuArea;
  readonly item?: TItem;
  readonly node?: CgTreeListNode<TItem, TKey>;
  readonly key?: TKey;
  readonly column?: CgTreeListColumn<TItem, TKey>;
  readonly invocationKind: CgContextMenuInvocationKind;
  readonly actions: CgTreeListActions<TItem, TKey>;
}

export interface CgTreeListLabels { searchPlaceholder: string; empty: string; loading: string; retry: string; expand: string; collapse: string; loadMore: string; edit: string; save: string; cancel: string; delete: string; addRoot: string; addChild: string; columns: string; noMatches: string; detail: string }

export interface CgTreeListActions<TItem, TKey extends CgTreeListKey> {
  focus(): Promise<boolean>;
  focusNode(key: TKey, fieldId?: string): Promise<boolean>;
  scrollToNode(key: TKey): Promise<boolean>;
  ensureNodeVisible(key: TKey, options?: { readonly focus?: boolean; readonly signal?: AbortSignal }): Promise<boolean>;
  expandNode(key: TKey): Promise<boolean>;
  collapseNode(key: TKey): Promise<boolean>;
  toggleNode(key: TKey): Promise<boolean>;
  expandToNode(key: TKey): Promise<boolean>;
  expandAll(options?: { readonly loadChildren?: boolean; readonly signal?: AbortSignal }): Promise<boolean>;
  collapseAll(): Promise<boolean>;
  isExpanded(key: TKey): boolean;
  selectNode(key: TKey, options?: { readonly add?: boolean; readonly range?: boolean }): Promise<boolean>;
  clearSelection(): Promise<boolean>;
  checkNode(key: TKey, checked?: boolean): Promise<boolean>;
  clearChecks(): Promise<boolean>;
  reloadNode(key: TKey): Promise<boolean>;
  removeLoadedChildren(key: TKey): Promise<boolean>;
  loadMoreChildren(key: TKey): Promise<boolean>;
  goToRootPage(pageIndex: number): Promise<boolean>;
  addRoot(draft?: TItem): Promise<boolean>;
  addChild(parentKey: TKey, draft?: TItem): Promise<boolean>;
  editNode(key: TKey): Promise<boolean>;
  deleteNode(key: TKey): Promise<boolean>;
  moveNode(key: TKey, parentKey: CgTreeListParentKey<TKey>, siblingPosition?: number): Promise<boolean>;
  saveEdit(): Promise<boolean>;
  cancelEdit(): Promise<boolean>;
  retryConflict(): Promise<boolean>;
  reloadConflict(): Promise<boolean>;
  applyFilter(filter: CgTreeListFilterNode | null, mode?: CgTreeListFilterMode): Promise<boolean>;
  groupBy(fieldId: string): Promise<boolean>;
  setColumnVisibility(fieldId: string, visible: boolean): Promise<boolean>;
  moveColumn(fieldId: string, displayIndex: number): Promise<boolean>;
  resizeColumn(fieldId: string, width: number): Promise<boolean>;
  fixColumn(fieldId: string, region: CgTreeListFixedRegion): Promise<boolean>;
  toggleDetail(key: TKey): Promise<boolean>;
  exportXlsx(options?: CgTreeListExportOptions): Promise<CgTreeListExportResult>;
  print(options?: CgTreeListPrintOptions): Promise<CgTreeListPrintResult>;
  exportPdf(options?: CgTreeListPrintOptions): Promise<CgTreeListPdfResult | null>;
  refresh(): Promise<void>;
  beginUpdate(): () => void;
  getItem(key: TKey): TItem | null;
  getVisibleKeys(): ReadonlyArray<TKey>;
  getVisibleItems(): ReadonlyArray<TItem>;
  getSnapshot(scope?: CgTreeListOutputScope): CgTreeListSnapshot<TItem, TKey>;
  getState(): CgTreeListState<TKey>;
}

type NativeTreeListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onError' | 'onSelect'>;

interface CgTreeListCommonProps<TItem, TKey extends CgTreeListKey> extends NativeTreeListProps {
  readonly columns: ReadonlyArray<CgTreeListColumn<TItem, TKey>>;
  readonly hasChildren?: (item: TItem) => boolean;
  readonly loadChildren?: (context: CgTreeListLoadChildrenContext<TItem, TKey>) => PromiseLike<CgTreeListLoadChildrenResult<TItem>>;
  readonly maximumDepth?: number;
  readonly maximumProviderTake?: number;
  readonly rootPageSize?: number;
  readonly childPageSize?: number;
  readonly queryId?: string;
  readonly expandedKeys?: ReadonlySet<TKey>;
  readonly defaultExpandedKeys?: ReadonlySet<TKey>;
  readonly onExpandedKeysChange?: (keys: ReadonlySet<TKey>, detail: CgTreeListExpansionEventDetail<TItem, TKey>) => void;
  readonly beforeExpand?: (detail: CgTreeListExpansionEventDetail<TItem, TKey> & { readonly signal: AbortSignal }) => void | boolean | PromiseLike<void | boolean>;
  readonly beforeCollapse?: (detail: CgTreeListExpansionEventDetail<TItem, TKey> & { readonly signal: AbortSignal }) => void | boolean | PromiseLike<void | boolean>;
  readonly onExpanded?: (detail: CgTreeListExpansionEventDetail<TItem, TKey>) => void;
  readonly onCollapsed?: (detail: CgTreeListExpansionEventDetail<TItem, TKey>) => void;
  readonly selectionMode?: CgTreeListSelectionMode;
  readonly selectedKeys?: ReadonlySet<TKey>;
  readonly defaultSelectedKeys?: ReadonlySet<TKey>;
  readonly onSelectedKeysChange?: (keys: ReadonlySet<TKey>, detail: CgTreeListSelectionChangeDetail<TItem, TKey>) => void;
  readonly focusedKey?: TKey | null;
  readonly defaultFocusedKey?: TKey | null;
  readonly focusedColumnId?: string | null;
  readonly defaultFocusedColumnId?: string | null;
  readonly onFocusChange?: (detail: CgTreeListFocusChangeDetail<TKey>) => void;
  readonly checkMode?: CgTreeListCheckMode;
  readonly checkedKeys?: ReadonlySet<TKey>;
  readonly defaultCheckedKeys?: ReadonlySet<TKey>;
  readonly onCheckedKeysChange?: (keys: ReadonlySet<TKey>, detail: CgTreeListCheckedChangeDetail<TItem, TKey>) => void;
  readonly canSelect?: (item: TItem) => boolean;
  readonly canCheck?: (item: TItem) => boolean;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly sorts?: ReadonlyArray<CgGridSortDescriptor>;
  readonly defaultSorts?: ReadonlyArray<CgGridSortDescriptor>;
  readonly onSortsChange?: (sorts: ReadonlyArray<CgGridSortDescriptor>) => void;
  readonly allowMultiSort?: boolean;
  readonly filter?: CgTreeListFilterNode | null;
  readonly defaultFilter?: CgTreeListFilterNode | null;
  readonly onFilterChange?: (filter: CgTreeListFilterNode | null) => void;
  readonly filterMode?: CgTreeListFilterMode;
  readonly defaultFilterMode?: CgTreeListFilterMode;
  readonly onFilterModeChange?: (mode: CgTreeListFilterMode) => void;
  readonly searchText?: string;
  readonly defaultSearchText?: string;
  readonly onSearchTextChange?: (text: string) => void;
  readonly showSearch?: boolean;
  readonly highlightSearchMatches?: boolean;
  readonly locale?: string;
  readonly allowAddRoot?: boolean;
  readonly allowAddChild?: boolean;
  readonly allowEdit?: boolean;
  readonly allowDelete?: boolean;
  readonly allowMove?: boolean;
  readonly canAddChild?: (item: TItem) => boolean;
  readonly canEdit?: (item: TItem) => boolean;
  readonly canDelete?: (item: TItem) => boolean;
  readonly canMove?: (item: TItem) => boolean;
  readonly editMode?: CgTreeListEditMode;
  readonly editModelFactory?: (item: TItem) => TItem;
  readonly newItemFactory?: (parentKey: CgTreeListParentKey<TKey>) => TItem;
  readonly getConcurrencyToken?: (item: TItem) => string | undefined;
  readonly onCreate?: (context: CgTreeListCreateContext<TItem, TKey>) => PromiseLike<CgTreeListMutationResult<TItem>>;
  readonly onUpdate?: (context: CgTreeListUpdateContext<TItem, TKey>) => PromiseLike<CgTreeListMutationResult<TItem>>;
  readonly onDelete?: (context: CgTreeListDeleteContext<TItem, TKey>) => PromiseLike<CgTreeListMutationResult<TItem>>;
  readonly onMove?: (context: CgTreeListMoveContext<TItem, TKey>) => PromiseLike<CgTreeListMutationResult<TItem>>;
  readonly optimistic?: boolean;
  readonly renderDetail?: (context: CgTreeListDetailRenderContext<TItem, TKey>) => ReactNode;
  readonly canShowDetail?: (item: TItem) => boolean;
  readonly detailLoader?: (context: CgTreeListDetailLoadContext<TItem, TKey>) => PromiseLike<CgTreeListDetailResult>;
  readonly detailMode?: CgTreeListDetailMode;
  readonly expandedDetailKeys?: ReadonlySet<TKey>;
  readonly defaultExpandedDetailKeys?: ReadonlySet<TKey>;
  readonly onExpandedDetailKeysChange?: (keys: ReadonlySet<TKey>) => void;
  readonly groups?: ReadonlyArray<CgGridGroupDescriptor>;
  readonly summaries?: ReadonlyArray<CgTreeListSummary<TItem>>;
  readonly summaryProvider?: (request: CgTreeListSummaryProviderRequest<TKey>) => PromiseLike<CgTreeListSummaryProviderResult<TKey>>;
  readonly snapshotProvider?: (request: CgTreeListSnapshotRequest) => PromiseLike<CgTreeListSnapshot<TItem, TKey>>;
  readonly pdfExporter?: (document: CgTreeListPdfDocument<TItem, TKey>, signal: AbortSignal) => PromiseLike<CgTreeListPdfResult>;
  readonly state?: CgTreeListState<TKey>;
  readonly defaultState?: Partial<CgTreeListState<TKey>>;
  readonly onStateChange?: (state: CgTreeListState<TKey>, detail: CgTreeListStateChangeDetail) => void;
  readonly viewStore?: CgTreeListViewStore<TKey>;
  readonly viewContext?: CgTreeListViewContext;
  readonly showPager?: boolean;
  readonly rowVirtualization?: boolean;
  readonly rowHeight?: number;
  readonly overscan?: number;
  readonly columnVirtualization?: boolean;
  readonly columnOverscan?: number;
  readonly height?: CSSProperties['height'];
  readonly stickyHeader?: boolean;
  readonly contextMenuAreas?: ReadonlyArray<CgTreeListContextMenuArea>;
  readonly customizeContextMenu?: (details: CgContextMenuCustomizeDetails<CgTreeListContext<TItem, TKey>>) => void | ReadonlyArray<CgContextMenuItem<CgTreeListContext<TItem, TKey>>> | PromiseLike<void | ReadonlyArray<CgContextMenuItem<CgTreeListContext<TItem, TKey>>>>;
  readonly onContextMenuItemActivate?: (details: CgContextMenuCommandDetails<CgTreeListContext<TItem, TKey>>) => void | PromiseLike<void>;
  readonly onContextMenuCommandFailure?: (details: CgContextMenuCommandFailureDetails<CgTreeListContext<TItem, TKey>>) => void | PromiseLike<void>;
  readonly renderIcon?: (item: TItem, node: CgTreeListNode<TItem, TKey>) => ReactNode;
  readonly getIcon?: (item: TItem) => CgIconSource | undefined;
  readonly renderEmpty?: () => ReactNode;
  readonly renderLoading?: () => ReactNode;
  readonly labels?: Partial<CgTreeListLabels>;
  readonly size?: CgSizeMode;
  readonly direction?: CgDirection;
  readonly actionsRef?: Ref<CgTreeListActions<TItem, TKey>>;
}

export interface CgTreeListFlatBinding<TItem, TKey extends CgTreeListKey> {
  readonly data: ReadonlyArray<TItem>;
  readonly getKey: (item: TItem) => TKey;
  readonly getParentKey: (item: TItem) => CgTreeListParentKey<TKey>;
  readonly getChildren?: never;
  readonly dataProvider?: never;
  readonly isRoot?: (item: TItem) => boolean;
  readonly rootParentKeys?: ReadonlySet<TKey> | ReadonlyArray<TKey>;
  readonly orphanPolicy?: CgTreeListOrphanPolicy;
}

export interface CgTreeListNestedBinding<TItem, TKey extends CgTreeListKey> {
  readonly data: ReadonlyArray<TItem>;
  readonly getKey: (item: TItem) => TKey;
  readonly getChildren: (item: TItem) => ReadonlyArray<TItem> | null | undefined;
  readonly getParentKey?: never;
  readonly dataProvider?: never;
  readonly isRoot?: never;
  readonly rootParentKeys?: never;
  readonly orphanPolicy?: never;
}

export interface CgTreeListProviderBinding<TItem, TKey extends CgTreeListKey> {
  readonly dataProvider: CgTreeListDataProvider<TItem, TKey>;
  readonly data?: never;
  readonly getKey?: never;
  readonly getParentKey?: never;
  readonly getChildren?: never;
  readonly isRoot?: never;
  readonly rootParentKeys?: never;
  readonly orphanPolicy?: never;
}

/** Exactly one binding source is accepted: flat local, nested local, or provider. */
export type CgTreeListProps<TItem, TKey extends CgTreeListKey = CgTreeListKey> =
  CgTreeListCommonProps<TItem, TKey> &
  (CgTreeListFlatBinding<TItem, TKey> | CgTreeListNestedBinding<TItem, TKey> | CgTreeListProviderBinding<TItem, TKey>);
