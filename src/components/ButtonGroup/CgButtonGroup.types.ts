import type { ButtonHTMLAttributes, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { CgButtonAppearance } from '../Button';
import type { CgDirection, CgIconSource, CgIntent, CgOrientation, CgSizeMode } from '../../types';

export type CgButtonGroupSelectionMode = 'none' | 'single' | 'multiple';
export type CgButtonGroupActivationSource = 'pointer' | 'keyboard';

export interface CgButtonGroupItem<TData = unknown> {
  name: string;
  text?: ReactNode;
  ariaLabel?: string;
  title?: string;
  icon?: CgIconSource;
  disabled?: boolean;
  visible?: boolean;
  intent?: CgIntent;
  appearance?: CgButtonAppearance;
  loading?: boolean;
  autoLoading?: boolean;
  loadingContent?: ReactNode;
  suppressDuplicateClicks?: boolean;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
  className?: string;
  data?: TData;
  render?: (context: CgButtonGroupItemRenderContext<TData>) => ReactNode;
  onClick?: (details: CgButtonGroupItemActivationDetails<TData>) => void | PromiseLike<void>;
}

export interface CgButtonGroupItemActivationDetails<TData = unknown> {
  item: CgButtonGroupItem<TData>;
  name: string;
  source: CgButtonGroupActivationSource;
  event: MouseEvent<HTMLButtonElement>;
}

export interface CgButtonGroupItemRenderContext<TData = unknown> {
  item: CgButtonGroupItem<TData>;
  selected: boolean;
  loading: boolean;
  defaultContent: ReactNode;
}

export interface CgButtonGroupSelectionDetails<TData = unknown> extends CgButtonGroupItemActivationDetails<TData> {
  previousName?: string | null;
  previousNames?: ReadonlyArray<string>;
}

type NativeGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'>;

interface CgButtonGroupCommonProps<TData> extends NativeGroupProps {
  items: ReadonlyArray<CgButtonGroupItem<TData>>;
  orientation?: CgOrientation;
  disabled?: boolean;
  size?: CgSizeMode;
  defaultItemIntent?: CgIntent;
  defaultItemAppearance?: CgButtonAppearance;
  direction?: CgDirection;
  ariaLabel?: string;
  onItemClick?: (details: CgButtonGroupItemActivationDetails<TData>) => void | PromiseLike<void>;
  onItemError?: (error: unknown, details: CgButtonGroupItemActivationDetails<TData>) => void;
}

export interface CgButtonGroupNoneProps<TData = unknown> extends CgButtonGroupCommonProps<TData> {
  selectionMode?: 'none';
  selectedName?: never;
  defaultSelectedName?: never;
  onSelectedNameChange?: never;
  selectedNames?: never;
  defaultSelectedNames?: never;
  onSelectedNamesChange?: never;
}

export interface CgButtonGroupSingleProps<TData = unknown> extends CgButtonGroupCommonProps<TData> {
  selectionMode: 'single';
  selectedName?: string | null;
  defaultSelectedName?: string | null;
  onSelectedNameChange?: (name: string, details: CgButtonGroupSelectionDetails<TData>) => void;
  selectedNames?: never;
  defaultSelectedNames?: never;
  onSelectedNamesChange?: never;
}

export interface CgButtonGroupMultipleProps<TData = unknown> extends CgButtonGroupCommonProps<TData> {
  selectionMode: 'multiple';
  selectedName?: never;
  defaultSelectedName?: never;
  onSelectedNameChange?: never;
  selectedNames?: ReadonlyArray<string>;
  defaultSelectedNames?: ReadonlyArray<string>;
  onSelectedNamesChange?: (names: ReadonlyArray<string>, details: CgButtonGroupSelectionDetails<TData>) => void;
}

export type CgButtonGroupProps<TData = unknown> =
  | CgButtonGroupNoneProps<TData>
  | CgButtonGroupSingleProps<TData>
  | CgButtonGroupMultipleProps<TData>;
