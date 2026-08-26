import type {
  CSSProperties,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react';
import type { CgBaseProps, CgDensity, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgLookUpGridAlignment = 'start' | 'center' | 'end';
export type CgLookUpGridSortDirection = 'ascending' | 'descending';
export type CgLookUpGridChangeReason = 'select' | 'clear' | 'reset';
export type CgLookUpGridOpenReason = 'programmatic' | 'editorClick' | 'toggleButton' | 'typing' | 'keyboard';
export type CgLookUpGridCloseReason = 'programmatic' | 'select' | 'escape' | 'outsideClick' | 'reset' | 'viewAll';

export interface CgLookUpGridSort {
  readonly fieldId: string;
  readonly direction: CgLookUpGridSortDirection;
}

export interface CgLookUpGridQuery<TContext = unknown> {
  readonly searchText: string | null;
  readonly searchFields: ReadonlyArray<string>;
  readonly sort: CgLookUpGridSort | null;
  readonly columnFilters?: Readonly<Record<string, string>>;
  readonly skip: number;
  readonly take: number;
  readonly queryContext: TContext;
}

export interface CgLookUpGridResult<TItem> {
  readonly items: ReadonlyArray<TItem | null | undefined>;
  readonly totalCount?: number;
}

export interface CgLookUpGridCellRenderContext<TItem> {
  readonly item: TItem;
  readonly value: unknown;
  readonly text: string;
  readonly rowIndex: number;
  readonly selected: boolean;
  readonly active: boolean;
  readonly disabled: boolean;
}

export interface CgLookUpGridColumnDescriptor<TItem> {
  readonly fieldId: string;
  readonly title: ReactNode;
  readonly accessor?: (item: TItem) => unknown;
  readonly width?: CSSProperties['width'];
  readonly visible?: boolean;
  readonly searchable?: boolean;
  readonly filterable?: boolean;
  readonly sortable?: boolean;
  readonly alignment?: CgLookUpGridAlignment;
  readonly formatValue?: (value: unknown, item: TItem) => string;
  readonly renderCell?: (context: CgLookUpGridCellRenderContext<TItem>) => ReactNode;
}

export interface CgLookUpGridValueChangeDetails<TItem, TValue> {
  readonly reason: CgLookUpGridChangeReason;
  readonly previousValue: TValue | null;
  readonly nextValue: TValue | null;
  readonly previousSelectedItem: TItem | null;
  readonly nextSelectedItem: TItem | null;
  readonly event?: Event | SyntheticEvent;
}

export interface CgLookUpGridItemSelectDetails<TItem, TValue>
  extends CgLookUpGridValueChangeDetails<TItem, TValue> {
  readonly item: TItem;
}

export interface CgLookUpGridOpenChangeDetails {
  readonly reason: CgLookUpGridOpenReason | CgLookUpGridCloseReason;
  readonly event?: Event | SyntheticEvent;
}

export interface CgLookUpGridSortChangeDetails {
  readonly previousSort: CgLookUpGridSort | null;
  readonly nextSort: CgLookUpGridSort | null;
  readonly event?: Event | SyntheticEvent;
}

export interface CgLookUpGridColumnFiltersChangeDetails {
  readonly previousFilters: Readonly<Record<string, string>>;
  readonly nextFilters: Readonly<Record<string, string>>;
  readonly reason: 'input' | 'action' | 'columnRemoved';
  readonly event?: Event | SyntheticEvent;
}

export interface CgLookUpGridRenderState<TItem, TValue> {
  readonly items: ReadonlyArray<TItem>;
  readonly value: TValue | null;
  readonly selectedItem: TItem | null;
  readonly searchText: string | null;
  readonly error: unknown;
  readonly loading: boolean;
  readonly loadingMore: boolean;
  readonly retry: () => Promise<void>;
}

export interface CgLookUpGridSelectedRenderContext<TItem, TValue> {
  readonly item: TItem;
  readonly value: TValue;
  readonly text: string;
}

export interface CgLookUpGridLabels {
  readonly loading: ReactNode;
  readonly empty: ReactNode;
  readonly searchError: ReactNode;
  readonly retry: ReactNode;
  readonly minimumSearchLength: (minimum: number, query: string) => ReactNode;
  readonly loadMore: ReactNode;
  readonly resultCount: (loaded: number, total: number) => ReactNode;
  readonly resultCountUnknown: (loaded: number) => ReactNode;
  readonly viewAll: ReactNode;
  readonly clearSelection: string;
  readonly toggleLookup: string;
  readonly columnFilter: (title: ReactNode, fieldId: string) => string;
  readonly sortAscending: (title: ReactNode, fieldId: string) => string;
  readonly sortDescending: (title: ReactNode, fieldId: string) => string;
  readonly sortCleared: string;
  readonly filterRemoved: (fieldId: string) => string;
}

declare const cgLookUpGridActionsValue: unique symbol;

export interface CgLookUpGridActions<TItem, TValue> {
  readonly [cgLookUpGridActionsValue]?: TValue;
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  focus: () => void;
  clear: () => Promise<void>;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  sortBy: (fieldId?: string, direction?: CgLookUpGridSortDirection) => Promise<void>;
  setColumnFilter: (fieldId: string, value?: string) => Promise<void>;
  clearColumnFilters: () => Promise<void>;
  getCurrentSort: () => CgLookUpGridSort | null;
  getColumnFilters: () => Readonly<Record<string, string>>;
  getLoadedItems: () => ReadonlyArray<TItem>;
  getLoadedRowCount: () => number;
  getTotalCount: () => number | undefined;
  hasMoreRows: () => boolean;
}

export type CgLookUpGridDataLoader<TItem, TContext> = (
  query: CgLookUpGridQuery<TContext>,
  context: { readonly signal: AbortSignal },
) => PromiseLike<CgLookUpGridResult<TItem>>;

export type CgLookUpGridItemResolver<TItem, TValue> = (
  value: TValue,
  context: { readonly signal: AbortSignal },
) => PromiseLike<TItem | null | undefined>;

type NativeLookUpGridProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'children' | 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'onChange'
  | 'readOnly' | 'name' | 'form' | 'required' | 'disabled' | 'onInvalid'
>;

interface CgLookUpGridCommonProps<TItem, TValue, TContext>
  extends NativeLookUpGridProps, CgBaseProps {
  columns: ReadonlyArray<CgLookUpGridColumnDescriptor<TItem>>;
  valueSelector: (item: TItem) => TValue;
  textSelector: (item: TItem) => string;
  value?: TValue | null;
  defaultValue?: TValue | null;
  onValueChange?: (value: TValue | null, details: CgLookUpGridValueChangeDetails<TItem, TValue>) => void;
  selectedItem?: TItem | null;
  onSelectedItemChange?: (item: TItem | null, details: CgLookUpGridValueChangeDetails<TItem, TValue>) => void;
  onItemSelect?: (item: TItem, details: CgLookUpGridItemSelectDetails<TItem, TValue>) => void;
  onClear?: (details: CgLookUpGridValueChangeDetails<TItem, TValue>) => void;
  isValueEqual?: (left: TValue, right: TValue) => boolean;
  itemResolver?: CgLookUpGridItemResolver<TItem, TValue>;

  queryContext?: TContext;
  isQueryContextEqual?: (left: TContext, right: TContext) => boolean;
  pageSize?: number;
  allowPaging?: boolean;
  showHeader?: boolean;
  allowSorting?: boolean;
  initialSort?: string | CgLookUpGridSort | null;
  showFilterRow?: boolean;
  rowDisabledSelector?: (item: TItem) => boolean;
  locale?: string;
  ignoreDiacritics?: boolean;
  minimumSearchLength?: number;
  searchDebounceMilliseconds?: number;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgLookUpGridOpenChangeDetails) => void;
  onSearchTextChange?: (searchText: string | null) => void;
  onSortChange?: (sort: CgLookUpGridSort | null, details: CgLookUpGridSortChangeDetails) => void;
  onColumnFiltersChange?: (
    filters: Readonly<Record<string, string>>,
    details: CgLookUpGridColumnFiltersChangeDetails,
  ) => void;
  onViewAllRequest?: (searchText: string | null, event?: Event | SyntheticEvent) => void;

  renderSelected?: (context: CgLookUpGridSelectedRenderContext<TItem, TValue>) => ReactNode;
  renderLoading?: (state: CgLookUpGridRenderState<TItem, TValue>) => ReactNode;
  renderNoData?: (state: CgLookUpGridRenderState<TItem, TValue>) => ReactNode;
  renderError?: (state: CgLookUpGridRenderState<TItem, TValue>) => ReactNode;
  renderFooter?: (state: CgLookUpGridRenderState<TItem, TValue>, actions: CgLookUpGridActions<TItem, TValue>) => ReactNode;
  labels?: Partial<CgLookUpGridLabels>;

  clearable?: boolean;
  showResultCount?: boolean;
  dropDownWidth?: CSSProperties['width'];
  dropDownHeight?: CSSProperties['height'];
  rowHeight?: CSSProperties['height'];
  actionsRef?: Ref<CgLookUpGridActions<TItem, TValue>>;
  serializeValue?: (value: TValue) => string;
  name?: string;
  form?: string;
  required?: boolean;
  requiredErrorMessage?: string;
  disabled?: boolean;
  readOnly?: boolean;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  size?: CgSizeMode;
  density?: CgDensity;
  direction?: CgDirection;
  validationState?: CgValidationState;
  fullWidth?: boolean;
  className?: string;
  style?: CSSProperties;
  popupClassName?: string;
  popupStyle?: CSSProperties;
}

type CgLookUpGridLocalSource<TItem> = {
  data: ReadonlyArray<TItem | null | undefined>;
  dataLoader?: never;
};

type CgLookUpGridRemoteSource<TItem, TContext> = {
  data?: never;
  dataLoader: CgLookUpGridDataLoader<TItem, TContext>;
};

export type CgLookUpGridProps<TItem, TValue, TContext = unknown> =
  CgLookUpGridCommonProps<TItem, TValue, TContext> &
  (CgLookUpGridLocalSource<TItem> | CgLookUpGridRemoteSource<TItem, TContext>);
