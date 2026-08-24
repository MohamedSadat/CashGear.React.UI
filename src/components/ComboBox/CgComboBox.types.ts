import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode, CgValidationState } from '../../types';

export type CgComboBoxSearchMode = 'contains' | 'startsWith';
export type CgComboBoxChangeReason = 'select' | 'clear' | 'reset';

export interface CgComboBoxLoadContext {
  signal: AbortSignal;
  requestId: number;
}

export interface CgComboBoxValueChangeDetails<TItem> {
  reason: CgComboBoxChangeReason;
  previousValue: TItem | null;
  event?: Event | React.SyntheticEvent;
}

export interface CgComboBoxRenderContext<TItem> {
  option: TItem;
  index: number;
  selected: boolean;
  active: boolean;
}

export type CgComboBoxMinimumLengthMessage = ReactNode | ((minimumLength: number, query: string) => ReactNode);
export type CgComboBoxErrorMessage = ReactNode | ((error: unknown) => ReactNode);

type NativeComboBoxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'children' | 'className' | 'style' | 'size' | 'value' | 'defaultValue' | 'onChange' | 'readOnly'
>;

interface CgComboBoxCommonProps<TItem> extends NativeComboBoxProps, CgBaseProps {
  value?: TItem | null;
  defaultValue?: TItem | null;
  onValueChange?: (value: TItem | null, details: CgComboBoxValueChangeDetails<TItem>) => void;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  getOptionLabel: (item: TItem) => string;
  getOptionKey: (item: TItem) => string | number;
  getOptionSearchText?: (item: TItem) => string;
  renderOption?: (context: CgComboBoxRenderContext<TItem>) => ReactNode;
  searchMode?: CgComboBoxSearchMode;
  locale?: string;
  ignoreDiacritics?: boolean;
  searchDelay?: number;
  minimumSearchLength?: number;
  maxVisibleItems?: number;
  loadingMessage?: ReactNode;
  errorMessage?: CgComboBoxErrorMessage;
  emptyMessage?: ReactNode;
  minimumLengthMessage?: CgComboBoxMinimumLengthMessage;
  clearable?: boolean;
  clearAriaLabel?: string;
  toggleAriaLabel?: string;
  readOnly?: boolean;
  size?: CgSizeMode;
  validationState?: CgValidationState;
  fullWidth?: boolean;
  direction?: CgDirection;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}

type CgComboBoxLocalSource<TItem> = {
  options?: ReadonlyArray<TItem>;
  loadOptions?: never;
};

type CgComboBoxRemoteSource<TItem> = {
  options?: never;
  loadOptions: (
    query: string,
    context: CgComboBoxLoadContext,
  ) => ReadonlyArray<TItem> | PromiseLike<ReadonlyArray<TItem>>;
};

export type CgComboBoxProps<TItem> = CgComboBoxCommonProps<TItem> &
  (CgComboBoxLocalSource<TItem> | CgComboBoxRemoteSource<TItem>);
