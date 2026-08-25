import type { SyntheticEvent } from 'react';
import type {
  CgComboBoxChangeReason,
  CgComboBoxProps,
} from '../ComboBox';

type AdapterPropNames = 'value' | 'defaultValue' | 'onValueChange' | 'getOptionKey';

type CgKeyComboBoxBaseProps<TItem> = CgComboBoxProps<TItem> extends infer TProps
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

export type CgKeyComboBoxProps<
  TItem,
  TValue extends string | number,
> = CgKeyComboBoxBaseProps<TItem> & {
  value?: TValue | null;
  defaultValue?: TValue | null;
  getOptionKey: (item: TItem) => TValue;
  selectedItem?: TItem | null;
  isValueEqual?: (left: TValue, right: TValue) => boolean;
  onValueChange?: (
    value: TValue | null,
    details: CgKeyComboBoxValueChangeDetails<TItem, TValue>,
  ) => void;
};
