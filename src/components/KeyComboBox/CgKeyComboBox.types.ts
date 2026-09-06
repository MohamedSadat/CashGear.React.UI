import type { ReactNode, Ref, SyntheticEvent } from 'react';
import type { CgLookupErrorDetails } from '../../types';
import type {
  CgComboBoxChangeReason,
  CgComboBoxProps,
} from '../ComboBox';

type AdapterPropNames = 'value' | 'defaultValue' | 'onValueChange' | 'getOptionKey';

type CgKeyComboBoxBaseProps<TItem, TContext> = CgComboBoxProps<TItem, TContext> extends infer TProps
  ? TProps extends unknown
    ? Omit<TProps, AdapterPropNames>
    : never
  : never;

export interface CgKeyComboBoxValueChangeDetails<
  TItem,
  TValue extends string | number,
> {
  reason: CgComboBoxChangeReason;
  previousValue: TValue | null;
  selectedItem: TItem | null;
  previousSelectedItem: TItem | null;
  event?: Event | SyntheticEvent;
}

export interface CgKeyComboBoxResolverContext<TContext = unknown> {
  readonly signal: AbortSignal;
  readonly queryContext: TContext;
}

export interface CgKeyComboBoxActions {
  refreshSelectedItem(): Promise<void>;
}

export type CgKeyComboBoxProps<
  TItem,
  TValue extends string | number,
  TContext = unknown,
> = CgKeyComboBoxBaseProps<TItem, TContext> & {
  value?: TValue | null;
  defaultValue?: TValue | null;
  getOptionKey: (item: TItem) => TValue;
  selectedItem?: TItem | null;
  isValueEqual?: (left: TValue, right: TValue) => boolean;
  itemResolver?: (value: TValue, context: CgKeyComboBoxResolverContext<TContext>) => PromiseLike<TItem | null | undefined>;
  actionsRef?: Ref<CgKeyComboBoxActions>;
  resolutionErrorMessage?: ReactNode;
  onResolutionError?: (details: CgLookupErrorDetails<TValue, TContext>) => void;
  onValueChange?: (
    value: TValue | null,
    details: CgKeyComboBoxValueChangeDetails<TItem, TValue>,
  ) => void;
};
