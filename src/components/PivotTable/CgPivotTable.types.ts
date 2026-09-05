import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
export type CgPivotArea = 'hidden' | 'row' | 'column' | 'data' | 'filter';
export type CgPivotSummaryType = 'sum' | 'count' | 'minimum' | 'maximum' | 'average' | 'distinctCount' | 'custom';
export type CgPivotValueType = 'text' | 'number' | 'decimal' | 'boolean' | 'date' | 'dateTime' | 'instant';
/** Decimal and temporal values are canonical strings; no Date objects cross the boundary. */
export type CgPivotValue = string | number | boolean | null;
export type CgPivotGroupInterval = 'none' | 'year' | 'quarter' | 'month' | 'week' | 'day' | 'hour';
export type CgPivotSortOrder = 'none' | 'ascending' | 'descending';
export type CgPivotSortMode = 'displayValue' | 'summaryValue';
export type CgPivotOperationPurpose = 'view' | 'distinctValues' | 'drillDown' | 'export' | 'layout';
export interface CgPivotFieldFilter {
    readonly memberSelectionActive?: boolean;
    readonly includedMemberKeys?: ReadonlyArray<string>;
    /** Exclusions keep unchecked members excluded even when the distinct list is paged. */
    readonly excludedMemberKeys?: ReadonlyArray<string>;
    readonly includedValues?: ReadonlyArray<CgPivotValue>;
    readonly minimum?: CgPivotValue;
    readonly maximum?: CgPivotValue;
    readonly dateFrom?: string;
    readonly dateToExclusive?: string;
}
export interface CgPivotFieldState {
    readonly key: string;
    readonly area: CgPivotArea;
    readonly areaIndex: number;
    readonly visible: boolean;
    readonly summaryType: CgPivotSummaryType;
    readonly sortOrder: CgPivotSortOrder;
    readonly sortMode: CgPivotSortMode;
    readonly sortByMeasureKey?: string;
    readonly nullPlacement: 'first' | 'last';
    readonly filter?: CgPivotFieldFilter;
    readonly width?: number;
}
export interface CgPivotLayout {
    readonly version: 2;
    readonly schemaSignature: string;
    readonly fields: ReadonlyArray<CgPivotFieldState>;
    readonly expandedRowPaths: ReadonlyArray<string>;
    readonly expandedColumnPaths: ReadonlyArray<string>;
    readonly expansionStateInitialized: boolean;
    readonly showRowGrandTotals: boolean;
    readonly showColumnGrandTotals: boolean;
    readonly rowTotalPlacement: 'near' | 'far';
    readonly columnTotalPlacement: 'near' | 'far';
}
export interface CgPivotAggregateState {
    accumulate(value: CgPivotValue): void;
    merge(other: CgPivotAggregateState): void;
    finalizeValue(): CgPivotValue;
    readonly count: number;
}
export interface CgPivotCustomAggregate {
    readonly key: string;
    readonly supportsDistributedMerge: boolean;
    createState(): CgPivotAggregateState;
}
export interface CgPivotCalculatedOperand<TItem> {
    readonly key: string;
    readonly getValue: (item: TItem) => CgPivotValue;
    readonly summaryType?: Exclude<CgPivotSummaryType, 'custom' | 'distinctCount'>;
}
export interface CgPivotCalculatedMeasure<TItem> {
    readonly key: string;
    readonly operation: 'difference' | 'ratio' | 'differenceRatio';
    readonly left: CgPivotCalculatedOperand<TItem>;
    readonly right?: CgPivotCalculatedOperand<TItem>;
    readonly denominator?: CgPivotCalculatedOperand<TItem>;
    readonly scale?: string;
    readonly precision?: number;
}
export interface CgPivotField<TItem> {
    readonly key: string;
    readonly caption?: string;
    readonly valueType: CgPivotValueType;
    readonly getValue?: (item: TItem) => CgPivotValue;
    readonly area?: CgPivotArea;
    readonly areaIndex?: number;
    readonly allowedAreas?: ReadonlyArray<Exclude<CgPivotArea, 'hidden'>>;
    readonly visible?: boolean;
    readonly summaryType?: CgPivotSummaryType;
    readonly sortOrder?: CgPivotSortOrder;
    readonly sortMode?: CgPivotSortMode;
    readonly sortByMeasureKey?: string;
    readonly nullPlacement?: 'first' | 'last';
    readonly groupInterval?: CgPivotGroupInterval;
    readonly showSubtotals?: boolean;
    readonly width?: number;
    readonly filter?: CgPivotFieldFilter;
    readonly customAggregate?: CgPivotCustomAggregate;
    readonly customAggregateKey?: string;
    readonly calculated?: CgPivotCalculatedMeasure<TItem>;
    /** .NET-style N/F/P/C precision formats, or a standard Excel numeric format for export. */
    readonly cellFormat?: string;
    /** ISO currency code used by C formats. Defaults to USD. */
    readonly currency?: string;
    readonly formatValue?: (value: CgPivotValue, locale: string) => string;
    readonly renderHeader?: (field: CgPivotFieldState) => ReactNode;
    readonly renderValue?: (member: CgPivotMemberValue) => ReactNode;
    readonly renderCell?: (context: CgPivotCellContext) => ReactNode;
}
export interface CgPivotQueryField extends Omit<CgPivotFieldState, 'width' | 'visible'> {
    readonly valueType: CgPivotValueType;
    readonly groupInterval: CgPivotGroupInterval;
    readonly customAggregateKey?: string;
}
export interface CgPivotQuery {
    readonly version: 1;
    readonly purpose: 'view' | 'export';
    readonly fields: ReadonlyArray<CgPivotQueryField>;
    readonly showRowGrandTotals: boolean;
    readonly showColumnGrandTotals: boolean;
    readonly maxRows: number;
    readonly maxColumns: number;
    readonly maxCells: number;
    readonly locale: string;
    readonly timeZone?: string;
}
export interface CgPivotMemberValue {
    readonly key: string;
    readonly value: CgPivotValue;
    readonly displayText: string;
    readonly isBlank: boolean;
}
export interface CgPivotAxisNode {
    readonly id: string;
    readonly fieldKey: string;
    readonly member: CgPivotMemberValue;
    readonly path: ReadonlyArray<CgPivotMemberValue>;
    readonly level: number;
    readonly isSubtotal: boolean;
    readonly children: ReadonlyArray<CgPivotAxisNode>;
}
export interface CgPivotCell {
    readonly rowPathKey: string;
    readonly columnPathKey: string;
    readonly dataFieldKey: string;
    readonly summaryType: CgPivotSummaryType;
    readonly value: CgPivotValue;
    readonly sourceCount: number;
}
export interface CgPivotResult {
    readonly rowHierarchy: ReadonlyArray<CgPivotAxisNode>;
    readonly columnHierarchy: ReadonlyArray<CgPivotAxisNode>;
    readonly cells: ReadonlyArray<CgPivotCell>;
    readonly sourceRecordCount: number;
    readonly isPartial?: boolean;
    readonly continuationToken?: string;
}
export interface CgPivotDistinctValuesQuery {
    readonly fieldKey: string;
    readonly pivotQuery: CgPivotQuery;
    readonly searchText: string;
    readonly skip: number;
    readonly take: number;
}
export interface CgPivotDistinctValuesResult {
    readonly values: ReadonlyArray<CgPivotMemberValue>;
    readonly totalCount: number;
    readonly hasMore: boolean;
}
export interface CgPivotDrillDownContext {
    readonly rowPath: ReadonlyArray<CgPivotMemberValue>;
    readonly columnPath: ReadonlyArray<CgPivotMemberValue>;
    readonly dataFieldKey: string;
    readonly summaryType: CgPivotSummaryType;
    readonly aggregatedValue: CgPivotValue;
    readonly coordinates: {
        readonly rowIndex: number;
        readonly columnIndex: number;
    };
    readonly activeFilters: ReadonlyArray<CgPivotQueryField>;
}
export interface CgPivotDrillDownQuery {
    readonly pivotQuery: CgPivotQuery;
    readonly cell: CgPivotDrillDownContext;
    readonly skip: number;
    readonly take: number;
    readonly maximumResultSize: number;
}
export interface CgPivotDrillDownRow {
    readonly key: string;
    readonly values: Readonly<Record<string, CgPivotValue>>;
}
export interface CgPivotDrillDownResult {
    readonly columns: ReadonlyArray<{
        readonly key: string;
        readonly caption: string;
    }>;
    readonly rows: ReadonlyArray<CgPivotDrillDownRow>;
    readonly totalCount: number;
}
export interface CgPivotDataProvider {
    execute(query: CgPivotQuery, signal: AbortSignal): PromiseLike<CgPivotResult>;
    getDistinctValues(query: CgPivotDistinctValuesQuery, signal: AbortSignal): PromiseLike<CgPivotDistinctValuesResult>;
    getDrillDown(query: CgPivotDrillDownQuery, signal: AbortSignal): PromiseLike<CgPivotDrillDownResult>;
}
export type CgPivotExportFormat = 'xlsx' | 'csv';
export interface CgPivotExportOptions {
    readonly fileName?: string;
    readonly download?: boolean;
    readonly signal?: AbortSignal;
}
export interface CgPivotExportFile {
    readonly fileName: string;
    readonly mimeType: string;
    readonly bytes: Uint8Array;
    readonly rowCount: number;
}
export interface CgPivotExportRequest {
    readonly query: CgPivotQuery;
    readonly layout: CgPivotLayout;
    readonly format: CgPivotExportFormat;
    readonly maximumCells: number;
    readonly fields: ReadonlyArray<{
        readonly key: string;
        readonly caption: string;
        readonly cellFormat?: string;
        readonly currency?: string;
    }>;
    readonly rightToLeft: boolean;
}
export interface CgPivotExportProvider {
    export(request: CgPivotExportRequest, signal: AbortSignal): PromiseLike<CgPivotExportFile>;
}
export interface CgPivotLayoutStoreContext {
    readonly layoutKey: string;
    readonly schemaSignature: string;
}
export interface CgPivotLayoutStore {
    load(context: CgPivotLayoutStoreContext, signal: AbortSignal): PromiseLike<unknown>;
    save(context: CgPivotLayoutStoreContext, layout: CgPivotLayout, signal: AbortSignal): PromiseLike<void>;
    delete(context: CgPivotLayoutStoreContext, signal: AbortSignal): PromiseLike<void>;
}
export interface CgPivotLimitDetails {
    readonly limitName: string;
    readonly requested: number;
    readonly maximum: number;
}
export interface CgPivotQueryDiagnostics {
    readonly purpose: CgPivotOperationPurpose;
    readonly outcome: 'succeeded' | 'failed' | 'cancelled' | 'limitExceeded';
    readonly elapsedMs: number;
    readonly authorizedSourceRowCount: number;
    readonly rowNodeCount: number;
    readonly columnNodeCount: number;
    readonly cellCount: number;
    readonly cancellationRequested: boolean;
    readonly limit?: CgPivotLimitDetails;
}
export interface CgPivotCellContext {
    readonly cell: CgPivotCell;
    readonly formattedValue: string;
    readonly isTotal: boolean;
}
export interface CgPivotAxisHeaderContext {
    readonly node: CgPivotAxisNode;
    readonly isRowAxis: boolean;
    readonly isExpanded: boolean;
}
export interface CgPivotActions {
    refresh(signal?: AbortSignal): Promise<void>;
    expandAll(): void;
    collapseAll(): void;
    showFieldList(): void;
    resetLayout(): Promise<void>;
    exportXlsx(options?: CgPivotExportOptions): Promise<CgPivotExportFile | null>;
    exportCsv(options?: CgPivotExportOptions): Promise<CgPivotExportFile | null>;
    getLayout(): CgPivotLayout;
    getResult(): CgPivotResult | null;
}
export interface CgPivotLabels {
    table: string;
    rows: string;
    columns: string;
    data: string;
    filter: string;
    hidden: string;
    fields: string;
    apply: string;
    cancel: string;
    reset: string;
    refresh: string;
    expandAll: string;
    collapseAll: string;
    loading: string;
    empty: string;
    error: string;
    limit: string;
    retry: string;
    blank: string;
    grandTotal: string;
    partial: string;
    search: string;
    selectAll: string;
    clearAll: string;
    more: string;
    minimum: string;
    maximum: string;
    dateFrom: string;
    dateTo: string;
    drillDown: string;
    previous: string;
    next: string;
    exportXlsx: string;
    exportCsv: string;
    moveUp: string;
    moveDown: string;
    area: string;
    sort: string;
    summary: string;
    sortMode: string;
    measure: string;
    totals: string;
}
interface CgPivotCommonProps<TItem> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onError'> {
    readonly fields: ReadonlyArray<CgPivotField<TItem>>;
    readonly layout?: CgPivotLayout;
    readonly defaultLayout?: Partial<CgPivotLayout>;
    readonly onLayoutChange?: (layout: CgPivotLayout) => void;
    readonly onFieldAreaChange?: (details: {
        fieldKey: string;
        oldArea: CgPivotArea;
        newArea: CgPivotArea;
        areaIndex: number;
    }) => void;
    readonly onFieldSortChange?: (field: CgPivotFieldState) => void;
    readonly onFieldFilterChange?: (details: {
        fieldKey: string;
        filter: CgPivotFieldFilter | undefined;
    }) => void;
    readonly layoutKey?: string;
    readonly layoutStore?: CgPivotLayoutStore;
    readonly autoLoadLayout?: boolean;
    readonly autoSaveLayout?: boolean;
    readonly layoutSaveDebounce?: number;
    readonly deferredFieldListChanges?: boolean;
    readonly exportProvider?: CgPivotExportProvider;
    readonly showToolbar?: boolean;
    readonly showFieldPanel?: boolean;
    readonly showFieldListButton?: boolean;
    readonly virtualScrolling?: boolean;
    readonly rowHeight?: number;
    readonly dataCellWidth?: number;
    readonly rowOverscan?: number;
    readonly columnOverscan?: number;
    readonly maximumResultRows?: number;
    readonly maximumResultColumns?: number;
    readonly maximumResultCells?: number;
    readonly maximumDrillDownRows?: number;
    readonly drillDownPageSize?: number;
    readonly maximumExportCells?: number;
    readonly density?: 'compact' | 'comfortable';
    readonly direction?: 'ltr' | 'rtl';
    readonly locale?: string;
    readonly groupingTimeZone?: string;
    readonly height?: CSSProperties['height'];
    readonly labels?: Partial<CgPivotLabels>;
    readonly disabled?: boolean;
    readonly readOnly?: boolean;
    readonly renderRowHeader?: (context: CgPivotAxisHeaderContext) => ReactNode;
    readonly renderColumnHeader?: (context: CgPivotAxisHeaderContext) => ReactNode;
    readonly renderCell?: (context: CgPivotCellContext) => ReactNode;
    readonly renderTotalCell?: (context: CgPivotCellContext) => ReactNode;
    readonly renderEmpty?: () => ReactNode;
    readonly renderLoading?: () => ReactNode;
    readonly renderError?: (context: {
        error: unknown;
        retainedPreviousResult: boolean;
    }) => ReactNode;
    readonly renderDrillDown?: (context: {
        cell: CgPivotDrillDownContext;
        result: CgPivotDrillDownResult;
    }) => ReactNode;
    readonly onCellClick?: (context: CgPivotDrillDownContext) => void;
    readonly onCellDoubleClick?: (context: CgPivotDrillDownContext) => void;
    readonly onDrillDown?: (context: CgPivotDrillDownContext) => void;
    readonly beforeQuery?: (query: CgPivotQuery, signal: AbortSignal) => boolean | void | PromiseLike<boolean | void>;
    readonly onQueryCompleted?: (query: CgPivotQuery, result: CgPivotResult) => void;
    readonly onQueryFailed?: (details: {
        query: CgPivotQuery;
        error: unknown;
        retainedPreviousResult: boolean;
    }) => void;
    readonly onDiagnostics?: (diagnostics: CgPivotQueryDiagnostics) => void;
    readonly beforeExport?: (format: CgPivotExportFormat, signal: AbortSignal) => boolean | void | PromiseLike<boolean | void>;
    readonly onExportCompleted?: (file: CgPivotExportFile) => void;
    readonly onError?: (error: unknown, purpose: CgPivotOperationPurpose) => void;
    readonly actionsRef?: Ref<CgPivotActions>;
}
export type CgPivotTableProps<TItem> = CgPivotCommonProps<TItem> & ({
    readonly data: ReadonlyArray<TItem>;
    readonly dataProvider?: never;
} | {
    readonly data?: never;
    readonly dataProvider: CgPivotDataProvider;
});
