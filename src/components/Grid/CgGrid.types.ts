import type { CSSProperties, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgContextMenuCommandDetails, CgContextMenuCommandFailureDetails, CgContextMenuCustomizeDetails, CgContextMenuItem } from '../ContextMenu';
import type { CgDirection, CgSizeMode } from '../../types';

export type CgGridKey = string | number | bigint | boolean | Date;
export type CgGridSortDirection = 'ascending' | 'descending';
export type CgGridLogicalOperator = 'and' | 'or';
export type CgGridFilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'isNull' | 'isNotNull' | 'isBlank' | 'isNotBlank' | 'between';
export type CgGridFilterSource = 'caller' | 'filterRow';
export type CgGridSelectionMode = 'none' | 'single' | 'multiple' | 'checkbox';
export type CgGridColumnAlignment = 'start' | 'center' | 'end';
export type CgGridSummaryType = 'count' | 'sum' | 'average' | 'minimum' | 'maximum';
export type CgGridProviderMode = 'rows' | 'groupNodes' | 'groupItems';
export type CgGridEditorKind = 'text' | 'number' | 'date' | 'dateTime' | 'boolean' | 'enum' | 'lookup';
export type CgGridChangeSource = 'pointer' | 'keyboard' | 'action' | 'state' | 'provider' | 'view' | 'crud';

export interface CgGridFilterGroup { readonly kind: 'group'; readonly operator: CgGridLogicalOperator; readonly children: ReadonlyArray<CgGridFilterNode> }
export interface CgGridFilterCondition { readonly kind: 'condition'; readonly fieldId: string; readonly operator: CgGridFilterOperator; readonly value?: unknown; readonly secondValue?: unknown; readonly source?: CgGridFilterSource }
export type CgGridFilterNode = CgGridFilterGroup | CgGridFilterCondition;
export interface CgGridSortDescriptor { readonly fieldId: string; readonly direction: CgGridSortDirection }
export interface CgGridGroupDescriptor { readonly fieldId: string; readonly direction: CgGridSortDirection }
export interface CgGridGroupPathSegment { readonly fieldId: string; readonly memberKey: string; readonly value?: unknown; readonly displayText?: string }
export interface CgGridGroupPath { readonly segments: ReadonlyArray<CgGridGroupPathSegment> }
export interface CgGridSummaryDescriptor { readonly id: string; readonly type: CgGridSummaryType; readonly fieldId?: string; readonly label?: string; readonly format?: string }
export interface CgGridColumnState { readonly fieldId: string; readonly visible: boolean; readonly frozen?: boolean; readonly measuredWidth?: number; readonly displayOrder?: number; readonly userWidth?: number }
export interface CgGridFocusedCell { readonly rowKey: string; readonly columnId: string }

export interface CgGridState {
  readonly version: number;
  readonly pageIndex: number;
  readonly pageSize: number;
  readonly searchText: string;
  readonly sorts: ReadonlyArray<CgGridSortDescriptor>;
  readonly filter: CgGridFilterNode | null;
  readonly selectedKeys: ReadonlyArray<string>;
  readonly focusedRowKey: string | null;
  readonly focusedColumnId: string | null;
  readonly columns: ReadonlyArray<CgGridColumnState>;
  readonly collapsedGroupKeys: ReadonlyArray<string>;
  readonly groups: ReadonlyArray<CgGridGroupDescriptor>;
  readonly expandedGroupPaths: ReadonlyArray<CgGridGroupPath>;
}

export interface CgGridGroupNode {
  readonly memberKey: string;
  readonly fieldId: string;
  readonly level: number;
  readonly value?: unknown;
  readonly displayText: string;
  readonly childCount: number;
  readonly leafCount: number;
  readonly hasChildren: boolean;
  readonly fullPath: CgGridGroupPath;
  readonly summaries?: Readonly<Record<string, unknown>>;
}

export interface CgGridDataRequest {
  readonly skip: number;
  readonly take: number;
  readonly sorts: ReadonlyArray<CgGridSortDescriptor>;
  readonly filter: CgGridFilterNode | null;
  readonly searchText: string;
  readonly searchableFieldIds: ReadonlyArray<string>;
  readonly totalSummaries: ReadonlyArray<CgGridSummaryDescriptor>;
  readonly mode: CgGridProviderMode;
  readonly groups: ReadonlyArray<CgGridGroupDescriptor>;
  readonly groupPath: CgGridGroupPath;
  readonly groupSummaries: ReadonlyArray<CgGridSummaryDescriptor>;
}
export interface CgGridDataResult<TItem> { readonly rows?: ReadonlyArray<TItem>; readonly groupNodes?: ReadonlyArray<CgGridGroupNode>; readonly totalCount: number; readonly authorizedFilteredRowCount: number; readonly totalSummaries?: Readonly<Record<string, unknown>> }
export type CgGridDataProvider<TItem> = (request: CgGridDataRequest, context: { readonly signal: AbortSignal }) => PromiseLike<CgGridDataResult<TItem>>;

export interface CgGridEditorOption<TValue = unknown> { readonly key: string; readonly label: string; readonly value: TValue; readonly disabled?: boolean }
export interface CgGridEditorMetadata<TItem, TValue = unknown> {
  readonly kind: CgGridEditorKind;
  readonly setValue: (model: TItem, value: TValue) => TItem;
  readonly label?: string;
  readonly required?: boolean;
  readonly readOnly?: boolean;
  readonly disabled?: boolean;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly minimum?: number | Date;
  readonly maximum?: number | Date;
  readonly step?: number;
  readonly placeholder?: string;
  readonly options?: ReadonlyArray<CgGridEditorOption<TValue>>;
  readonly render?: (context: CgGridAutomaticEditorContext<TItem, TValue>) => ReactNode;
}

export interface CgGridCellRenderContext<TItem, TValue = unknown> { readonly item: TItem; readonly value: TValue; readonly rowKey: string; readonly rowIndex: number; readonly column: CgGridColumnDescriptor<TItem>; readonly selected: boolean; readonly focused: boolean }
export interface CgGridHeaderRenderContext<TItem> { readonly column: CgGridColumnDescriptor<TItem>; readonly sort: CgGridSortDescriptor | undefined; readonly sortPriority: number; readonly defaultContent: ReactNode; readonly actions: CgGridActions<TItem> }
export interface CgGridAutomaticEditorContext<TItem, TValue = unknown> { readonly model: TItem; readonly value: TValue; readonly setValue: (value: TValue) => void; readonly error?: string; readonly disabled: boolean; readonly readOnly: boolean }

interface CgGridColumnCommon<TItem, TValue = unknown> {
  readonly fieldId: string;
  readonly formerFieldIds?: ReadonlyArray<string>;
  readonly accessor?: (item: TItem) => TValue;
  readonly title?: string;
  readonly visible?: boolean;
  readonly hideable?: boolean;
  readonly freezable?: boolean;
  readonly autoFit?: boolean;
  readonly width?: number | string;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly alignment?: CgGridColumnAlignment;
  readonly format?: string | ((value: TValue, item: TItem) => string);
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly searchable?: boolean;
  readonly groupable?: boolean;
  readonly exportEnabled?: boolean;
  readonly initialGroupIndex?: number;
  readonly renderHeader?: (context: CgGridHeaderRenderContext<TItem>) => ReactNode;
  readonly renderCell?: (context: CgGridCellRenderContext<TItem, TValue>) => ReactNode;
  readonly editor?: CgGridEditorMetadata<TItem, TValue>;
}
export interface CgGridTextColumn<TItem> extends CgGridColumnCommon<TItem, unknown> { readonly type: 'text' }
export interface CgGridNumberColumn<TItem> extends CgGridColumnCommon<TItem, number | null | undefined> { readonly type: 'number' }
export interface CgGridDateColumn<TItem> extends CgGridColumnCommon<TItem, Date | string | null | undefined> { readonly type: 'date'; readonly dateTime?: boolean }
export interface CgGridBooleanColumn<TItem> extends CgGridColumnCommon<TItem, boolean | null | undefined> { readonly type: 'boolean' }
export interface CgGridTemplateColumn<TItem> extends CgGridColumnCommon<TItem, unknown> { readonly type: 'template'; readonly renderCell: (context: CgGridCellRenderContext<TItem>) => ReactNode }
export interface CgGridSelectionColumn<TItem> extends CgGridColumnCommon<TItem, never> { readonly type: 'selection' }
export interface CgGridCommandColumn<TItem> extends CgGridColumnCommon<TItem, never> { readonly type: 'command'; readonly renderCommands?: (context: CgGridCellRenderContext<TItem>) => ReactNode }
export type CgGridColumnDescriptor<TItem> = CgGridTextColumn<TItem> | CgGridNumberColumn<TItem> | CgGridDateColumn<TItem> | CgGridBooleanColumn<TItem> | CgGridTemplateColumn<TItem> | CgGridSelectionColumn<TItem> | CgGridCommandColumn<TItem>;

export interface CgGridSummaryRenderContext<TItem> { readonly descriptor: CgGridSummaryDescriptor; readonly value: unknown; readonly formattedValue: string; readonly available: boolean; readonly items?: ReadonlyArray<TItem> }
export interface CgGridDetailRenderContext<TItem> { readonly item: TItem; readonly rowKey: string; readonly prepared: unknown; readonly collapse: () => Promise<boolean> }
export interface CgGridPagerRenderContext { readonly pageIndex: number; readonly pageSize: number; readonly pageCount: number; readonly totalCount: number; readonly goToPage: (index: number) => void; readonly setPageSize: (size: number) => void; readonly defaultContent: ReactNode }
export interface CgGridStateChangeDetails { readonly source: CgGridChangeSource; readonly operation: string }
export interface CgGridSelectionChangeDetails<TItem> { readonly selectedKeys: ReadonlyArray<string>; readonly visibleSelectedItems: ReadonlyArray<TItem>; readonly source: CgGridChangeSource }
export interface CgGridDataErrorDetails { readonly error: unknown; readonly request?: CgGridDataRequest; readonly retainedPreviousData: boolean }

export interface CgGridMutationResult { readonly succeeded: boolean; readonly generalErrors?: ReadonlyArray<string>; readonly fieldErrors?: Readonly<Record<string, ReadonlyArray<string>>> }
export interface CgGridUpdateRequest<TItem> { readonly rowKey: string; readonly originalItem: TItem; readonly editModel: TItem }
export interface CgGridCreateRequest<TItem> { readonly createModel: TItem }
export interface CgGridDeleteRequest<TItem> { readonly rowKey: string; readonly item: TItem }
export interface CgGridEditRenderContext<TItem> { readonly mode: 'create' | 'edit'; readonly model: TItem; readonly originalItem?: TItem; readonly setModel: (model: TItem) => void; readonly fieldErrors: Readonly<Record<string, ReadonlyArray<string>>>; readonly generalErrors: ReadonlyArray<string>; readonly saving: boolean }
export interface CgGridEditingOptions<TItem> { readonly create?: boolean; readonly update?: boolean; readonly delete?: boolean; readonly newItemFactory?: () => TItem; readonly editModelFactory?: (item: TItem) => TItem; readonly createItem?: (request: CgGridCreateRequest<TItem>, context: { signal: AbortSignal }) => PromiseLike<CgGridMutationResult>; readonly updateItem?: (request: CgGridUpdateRequest<TItem>, context: { signal: AbortSignal }) => PromiseLike<CgGridMutationResult>; readonly deleteItem?: (request: CgGridDeleteRequest<TItem>, context: { signal: AbortSignal }) => PromiseLike<CgGridMutationResult>; readonly canDelete?: (item: TItem) => boolean; readonly renderCreate?: (context: CgGridEditRenderContext<TItem>) => ReactNode; readonly renderEdit?: (context: CgGridEditRenderContext<TItem>) => ReactNode; readonly confirmDirtyClose?: (context: CgGridEditRenderContext<TItem>) => PromiseLike<boolean>; readonly confirmDelete?: (request: CgGridDeleteRequest<TItem>) => PromiseLike<boolean> }

export type CgGridViewScope = 'personal' | 'role' | 'company';
export interface CgGridViewContext { readonly viewKey: string; readonly schemaSignature: string }
export interface CgGridViewEntry { readonly viewId: string; readonly name: string; readonly scope: CgGridViewScope; readonly roleName?: string; readonly canEdit: boolean; readonly concurrencyToken: string }
export interface CgGridViewCatalog { readonly views: ReadonlyArray<CgGridViewEntry>; readonly defaultViewId?: string; readonly canManageSharedViews?: boolean; readonly shareableRoles?: ReadonlyArray<string> }
export interface CgGridStoredView { readonly view: CgGridViewEntry; readonly state: CgGridState }
export interface CgGridViewSaveRequest { readonly viewId?: string; readonly name: string; readonly scope: CgGridViewScope; readonly roleName?: string; readonly state: CgGridState; readonly concurrencyToken?: string }
export interface CgGridViewStore { getCatalog(context: CgGridViewContext, signal: AbortSignal): PromiseLike<CgGridViewCatalog>; load(context: CgGridViewContext, viewId: string, signal: AbortSignal): PromiseLike<CgGridStoredView | null>; save(context: CgGridViewContext, request: CgGridViewSaveRequest, signal: AbortSignal): PromiseLike<CgGridStoredView>; delete(context: CgGridViewContext, viewId: string, concurrencyToken: string | undefined, signal: AbortSignal): PromiseLike<void>; setDefault(context: CgGridViewContext, viewId: string | undefined, signal: AbortSignal): PromiseLike<void>; resetDefault(context: CgGridViewContext, signal: AbortSignal): PromiseLike<void> }

export interface CgGridExportResult { readonly fileName: string; readonly mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; readonly bytes: Uint8Array }
export interface CgGridExportOptions { readonly fileName?: string; readonly download?: boolean }

export type CgGridContextMenuArea = 'row' | 'cell' | 'header' | 'footer' | 'groupRow' | 'groupFooter' | 'groupPanel' | 'emptyArea';
export type CgGridContextMenuSelectionBehavior = 'preserve' | 'focus' | 'selectIfNeeded' | 'replace';
export interface CgGridContext<TItem> { readonly area: CgGridContextMenuArea; readonly item?: TItem; readonly rowKey?: string; readonly column?: CgGridColumnDescriptor<TItem>; readonly value?: unknown; readonly groupKey?: string; readonly actions: CgGridActions<TItem> }

export interface CgGridLabels { searchPlaceholder: string; loading: string; empty: string; loadError: string; refreshError: string; retry: string; rowsPerPage: string; records: string; add: string; edit: string; delete: string; save: string; cancel: string; columns: string; groupPanel: string; loadMore: string; summaryUnavailable: string }

export interface CgGridActions<TItem> {
  refresh(): Promise<void>; reload(): Promise<void>;
  getVisibleItems(): ReadonlyArray<TItem>;
  getState(): CgGridState; applyState(state: Partial<CgGridState>): Promise<void>; resetState(): Promise<void>;
  focusRow(key: CgGridKey): Promise<boolean>; focusCell(key: CgGridKey, fieldId: string): Promise<boolean>;
  clearSelection(): Promise<void>; selectRowsByKey(keys: ReadonlyArray<CgGridKey>, replace?: boolean): Promise<void>;
  beginCreate(): Promise<boolean>; beginEdit(key: CgGridKey): Promise<boolean>; requestDelete(key: CgGridKey): Promise<boolean>;
  expandDetail(key: CgGridKey): Promise<boolean>; collapseDetail(): Promise<boolean>;
  autoFitColumn(fieldId: string): Promise<void>; exportToXlsx(options?: CgGridExportOptions): Promise<CgGridExportResult>;
  setColumnVisible(fieldId: string, visible: boolean): Promise<void>; freezeColumn(fieldId: string, frozen?: boolean): Promise<void>; moveColumn(fieldId: string, displayIndex: number): Promise<void>; resizeColumn(fieldId: string, width: number): Promise<void>;
  clearFilters(): Promise<void>; clearSorting(): Promise<void>; groupBy(fieldId: string, direction?: CgGridSortDirection): Promise<void>; ungroup(fieldId: string): Promise<void>; clearGrouping(): Promise<void>;
}

type NativeGridProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange' | 'onError'>;
interface CgGridCommonProps<TItem> extends NativeGridProps {
  columns: ReadonlyArray<CgGridColumnDescriptor<TItem>>;
  keySelector: (item: TItem) => CgGridKey;
  state?: CgGridState;
  defaultState?: Partial<CgGridState>;
  onStateChange?: (state: CgGridState, details: CgGridStateChangeDetails) => void;
  selectionMode?: CgGridSelectionMode;
  onSelectionChange?: (details: CgGridSelectionChangeDetails<TItem>) => void;
  onRowActivate?: (item: TItem, event?: MouseEvent | KeyboardEvent) => void;
  pageSizeOptions?: ReadonlyArray<number>;
  showPager?: boolean;
  renderPager?: (context: CgGridPagerRenderContext) => ReactNode;
  showSearch?: boolean;
  searchDebounce?: number;
  showFilterRow?: boolean;
  allowSorting?: boolean;
  allowMultiSort?: boolean;
  allowGrouping?: boolean;
  showGroupPanelWhenEmpty?: boolean;
  maxGroupLevels?: number;
  totalSummaries?: ReadonlyArray<CgGridSummaryDescriptor>;
  groupSummaries?: ReadonlyArray<CgGridSummaryDescriptor>;
  renderSummary?: (context: CgGridSummaryRenderContext<TItem>) => ReactNode;
  renderDetail?: (context: CgGridDetailRenderContext<TItem>) => ReactNode;
  canExpandDetail?: (item: TItem) => boolean;
  prepareDetail?: (item: TItem, context: { readonly rowKey: string; readonly signal: AbortSignal }) => unknown;
  editing?: CgGridEditingOptions<TItem>;
  allowColumnChooser?: boolean;
  allowColumnReordering?: boolean;
  allowColumnResizing?: boolean;
  viewKey?: string;
  viewStore?: CgGridViewStore;
  allowSharedViews?: boolean;
  contextMenuAreas?: ReadonlyArray<CgGridContextMenuArea>;
  contextMenuSelectionBehavior?: CgGridContextMenuSelectionBehavior;
  customizeContextMenu?: (details: CgContextMenuCustomizeDetails<CgGridContext<TItem>>) => void | ReadonlyArray<CgContextMenuItem<CgGridContext<TItem>>> | PromiseLike<void | ReadonlyArray<CgContextMenuItem<CgGridContext<TItem>>>>;
  onContextMenuItemActivate?: (details: CgContextMenuCommandDetails<CgGridContext<TItem>>) => void | PromiseLike<void>;
  onContextMenuCommandFailure?: (details: CgContextMenuCommandFailureDetails<CgGridContext<TItem>>) => void | PromiseLike<void>;
  onDataError?: (details: CgGridDataErrorDetails) => void;
  remoteExport?: (request: CgGridDataRequest, options: CgGridExportOptions, context: { signal: AbortSignal }) => PromiseLike<CgGridExportResult>;
  toolbar?: ReactNode | ((actions: CgGridActions<TItem>) => ReactNode);
  renderLoading?: () => ReactNode; renderEmpty?: () => ReactNode; renderError?: (details: CgGridDataErrorDetails) => ReactNode;
  stickyHeader?: boolean; stripedRows?: boolean; height?: CSSProperties['height']; size?: CgSizeMode; direction?: CgDirection; labels?: Partial<CgGridLabels>; actionsRef?: Ref<CgGridActions<TItem>>;
}
export type CgGridProps<TItem> = CgGridCommonProps<TItem> & ({ readonly data: ReadonlyArray<TItem>; readonly dataProvider?: never } | { readonly data?: never; readonly dataProvider: CgGridDataProvider<TItem> });
