import type { CSSProperties, FormEvent, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgListBoxSelectionMode = 'single' | 'multiple';
export type CgListBoxRenderMode = 'entire' | 'virtual';
export type CgListBoxSearchCondition = 'contains' | 'startsWith' | 'equals';
export type CgListBoxSearchParseMode = 'allWords' | 'anyWord' | 'exact';
export type CgListBoxChangeReason = 'pointer' | 'keyboard' | 'selectAll' | 'deselectAll' | 'clear' | 'reset' | 'programmatic';
export type CgListBoxColumnAlignment = 'start' | 'center' | 'end';

export interface CgListBoxTextFragment {
  text: string;
  isMatch: boolean;
}

export interface CgListBoxValueChangeDetails<TItem> {
  reason: CgListBoxChangeReason;
  previousValue: ReadonlyArray<TItem>;
  addedItems: ReadonlyArray<TItem>;
  removedItems: ReadonlyArray<TItem>;
  event?: Event | MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgListBoxItemRenderContext<TItem> {
  item: TItem;
  key: string | number;
  label: string;
  sourceIndex: number;
  visibleIndex: number;
  selected: boolean;
  active: boolean;
  disabled: boolean;
  searchQuery: string;
  highlightedLabel: ReadonlyArray<CgListBoxTextFragment>;
}

export interface CgListBoxCellRenderContext<TItem> {
  item: TItem;
  value: unknown;
  displayText: string;
  sourceIndex: number;
  visibleIndex: number;
  selected: boolean;
  active: boolean;
  highlightedText: ReadonlyArray<CgListBoxTextFragment>;
}

export interface CgListBoxGroupRenderContext<TItem> {
  key: string | number;
  label: string;
  visibleItems: ReadonlyArray<TItem>;
  totalItems: ReadonlyArray<TItem>;
}

export interface CgListBoxColumn<TItem> {
  key: string;
  header?: ReactNode;
  getValue: (item: TItem) => unknown;
  formatValue?: (value: unknown, item: TItem) => string;
  renderCell?: (context: CgListBoxCellRenderContext<TItem>) => ReactNode;
  width?: string | number;
  minWidth?: string | number;
  alignment?: CgListBoxColumnAlignment;
  searchable?: boolean;
  visible?: boolean;
}

export interface CgListBoxItemClickDetails<TItem> {
  item: TItem;
  key: string | number;
  visibleIndex: number;
  disabled: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  event: MouseEvent<HTMLElement>;
}

export interface CgListBoxItemActivationDetails<TItem> extends Omit<CgListBoxItemClickDetails<TItem>, 'event'> {
  reason: 'pointer' | 'keyboard';
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

type NativeListBoxProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'className' | 'style' | 'defaultValue' | 'onChange' | 'onInvalid' | 'role'
>;

export interface CgListBoxSelectionProposal<TItem> {
  readonly previousValue: ReadonlyArray<TItem>;
  readonly proposedValue: ReadonlyArray<TItem>;
  readonly reason: CgListBoxChangeReason;
  readonly signal: AbortSignal;
}

export interface CgListBoxActions<TItem> {
  setSelection(value: ReadonlyArray<TItem>): Promise<boolean>;
  clearSelection(): Promise<boolean>;
  selectAll(): Promise<boolean>;
  focusItem(key: string | number): boolean;
  scrollToItem(key: string | number): boolean;
}

export interface CgListBoxProps<TItem> extends NativeListBoxProps, CgBaseProps {
  items: ReadonlyArray<TItem>;
  dataVersion?: string | number;
  actionsRef?: Ref<CgListBoxActions<TItem>>;
  onBeforeSelectionChange?: (proposal: CgListBoxSelectionProposal<TItem>) => boolean | void | PromiseLike<boolean | void>;
  onSelectionError?: (error: unknown) => void;
  value?: ReadonlyArray<TItem>;
  defaultValue?: ReadonlyArray<TItem>;
  onValueChange?: (value: ReadonlyArray<TItem>, details: CgListBoxValueChangeDetails<TItem>) => void;
  getItemKey: (item: TItem) => string | number;
  getItemLabel: (item: TItem) => string;
  getItemSearchText?: (item: TItem) => string;
  isItemDisabled?: (item: TItem) => boolean;
  filterItem?: (item: TItem) => boolean;
  selectionMode?: CgListBoxSelectionMode;
  showCheckboxes?: boolean;
  showSelectAll?: boolean;
  selectAllText?: ReactNode;
  selectAllAriaLabel?: string;
  searchable?: boolean;
  searchQuery?: string;
  defaultSearchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  searchDelay?: number;
  searchCondition?: CgListBoxSearchCondition;
  searchParseMode?: CgListBoxSearchParseMode;
  highlightSearchText?: boolean;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  locale?: string;
  ignoreDiacritics?: boolean;
  getItemGroupKey?: (item: TItem) => string | number;
  getGroupLabel?: (key: string | number) => string;
  renderGroupHeader?: (context: CgListBoxGroupRenderContext<TItem>) => ReactNode;
  columns?: ReadonlyArray<CgListBoxColumn<TItem>>;
  renderItem?: (context: CgListBoxItemRenderContext<TItem>) => ReactNode;
  renderEmpty?: ReactNode | (() => ReactNode);
  renderNoResults?: ReactNode | ((query: string) => ReactNode);
  renderLoading?: ReactNode | (() => ReactNode);
  loading?: boolean;
  loadingMessage?: ReactNode;
  emptyMessage?: ReactNode;
  noResultsMessage?: ReactNode;
  resultsCountMessage?: (count: number) => ReactNode;
  selectedCountMessage?: (count: number) => ReactNode;
  renderMode?: CgListBoxRenderMode;
  itemSize?: number;
  overscanCount?: number;
  height?: CSSProperties['height'];
  maxHeight?: CSSProperties['maxHeight'];
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  direction?: CgDirection;
  name?: string;
  form?: string;
  fullWidth?: boolean;
  onItemActivate?: (details: CgListBoxItemActivationDetails<TItem>) => void;
  onItemClick?: (details: CgListBoxItemClickDetails<TItem>) => void;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
}
