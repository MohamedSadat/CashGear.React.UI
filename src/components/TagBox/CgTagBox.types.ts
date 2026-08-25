import type { ChangeEvent, FormEvent, InputHTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgTagBoxSearchMode = 'contains' | 'startsWith';
export type CgTagBoxChangeReason = 'select' | 'remove' | 'backspace' | 'clear' | 'reset';

export interface CgTagBoxLoadContext {
  signal: AbortSignal;
  requestId: number;
}

export interface CgTagBoxValueChangeDetails<TItem> {
  reason: CgTagBoxChangeReason;
  previousValue: ReadonlyArray<TItem>;
  addedItems: ReadonlyArray<TItem>;
  removedItems: ReadonlyArray<TItem>;
  event?: Event | MouseEvent<HTMLElement> | KeyboardEvent<HTMLInputElement>;
}

export interface CgTagBoxOptionRenderContext<TItem> {
  option: TItem;
  key: string | number;
  index: number;
  selected: boolean;
  active: boolean;
  disabled: boolean;
}

export interface CgTagBoxTagRenderContext<TItem> {
  item: TItem;
  key: string | number;
  label: string;
  index: number;
  disabled: boolean;
  readOnly: boolean;
}

export type CgTagBoxMinimumLengthMessage = ReactNode | ((minimumLength: number, query: string) => ReactNode);
export type CgTagBoxErrorMessage = ReactNode | ((error: unknown) => ReactNode);

type NativeTagBoxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | 'children'
  | 'className'
  | 'style'
  | 'size'
  | 'value'
  | 'defaultValue'
  | 'onChange'
  | 'onInvalid'
  | 'readOnly'
  | 'name'
  | 'form'
  | 'required'
>;

interface CgTagBoxCommonProps<TItem> extends NativeTagBoxProps, CgBaseProps {
  value?: ReadonlyArray<TItem>;
  defaultValue?: ReadonlyArray<TItem>;
  onValueChange?: (value: ReadonlyArray<TItem>, details: CgTagBoxValueChangeDetails<TItem>) => void;
  getOptionLabel: (item: TItem) => string;
  getOptionKey: (item: TItem) => string | number;
  getOptionSearchText?: (item: TItem) => string;
  isOptionDisabled?: (item: TItem) => boolean;
  renderOption?: (context: CgTagBoxOptionRenderContext<TItem>) => ReactNode;
  renderTag?: (context: CgTagBoxTagRenderContext<TItem>) => ReactNode;
  searchQuery?: string;
  defaultSearchQuery?: string;
  onSearchQueryChange?: (query: string, event?: ChangeEvent<HTMLInputElement>) => void;
  searchMode?: CgTagBoxSearchMode;
  locale?: string;
  ignoreDiacritics?: boolean;
  searchDelay?: number;
  minimumSearchLength?: number;
  maxVisibleItems?: number;
  maxSelectedItems?: number;
  loadingMessage?: ReactNode;
  errorMessage?: CgTagBoxErrorMessage;
  emptyMessage?: ReactNode;
  minimumLengthMessage?: CgTagBoxMinimumLengthMessage;
  selectedCountMessage?: (count: number) => ReactNode;
  resultsCountMessage?: (count: number) => ReactNode;
  clearable?: boolean;
  closeOnSelection?: boolean;
  clearAriaLabel?: string;
  toggleAriaLabel?: string;
  removeAriaLabel?: (item: TItem, label: string) => string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  fullWidth?: boolean;
  direction?: CgDirection;
  name?: string;
  form?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  onInvalid?: (event: FormEvent<HTMLSelectElement>) => void;
  onOptionSelected?: (item: TItem) => void;
  onOptionRemoved?: (item: TItem) => void;
  onCleared?: () => void;
  onOpenChange?: (open: boolean) => void;
}

type CgTagBoxLocalSource<TItem> = {
  options: ReadonlyArray<TItem>;
  loadOptions?: never;
};

type CgTagBoxRemoteSource<TItem> = {
  options?: never;
  loadOptions: (
    query: string,
    context: CgTagBoxLoadContext,
  ) => ReadonlyArray<TItem> | PromiseLike<ReadonlyArray<TItem>>;
};

export type CgTagBoxProps<TItem> = CgTagBoxCommonProps<TItem> &
  (CgTagBoxLocalSource<TItem> | CgTagBoxRemoteSource<TItem>);
