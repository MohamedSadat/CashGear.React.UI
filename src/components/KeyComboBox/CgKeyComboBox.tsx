import { forwardRef, useState } from 'react';
import { CgComboBox } from '../ComboBox';
import type { CgComboBoxValueChangeDetails } from '../ComboBox';
import type {
  CgKeyComboBoxProps,
  CgKeyComboBoxValueChangeDetails,
} from './CgKeyComboBox.types';

function CgKeyComboBoxInner<TItem, TValue extends string | number>(
  {
    value,
    defaultValue,
    onValueChange,
    getOptionKey,
    selectedItem = null,
    isValueEqual = Object.is,
    options,
    loadOptions,
    ...comboBoxProps
  }: CgKeyComboBoxProps<TItem, TValue>,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  if (options !== undefined && loadOptions !== undefined) {
    throw new Error('CgKeyComboBox accepts either options or loadOptions, not both.');
  }

  const [lastSelectedItem, setLastSelectedItem] = useState<TItem | null>(null);

  const resolveItem = (key: TValue | null | undefined): TItem | null => {
    if (key === null || key === undefined) return null;

    const localMatch = options?.find((option) => isValueEqual(getOptionKey(option), key));
    if (localMatch !== undefined) return localMatch;
    if (selectedItem !== null && isValueEqual(getOptionKey(selectedItem), key)) return selectedItem;
    if (lastSelectedItem !== null && isValueEqual(getOptionKey(lastSelectedItem), key)) return lastSelectedItem;
    return null;
  };

  const resolvedValue = value === undefined ? undefined : resolveItem(value);
  const resolvedDefaultValue = resolveItem(defaultValue);

  const handleValueChange = (
    item: TItem | null,
    details: CgComboBoxValueChangeDetails<TItem>,
  ) => {
    setLastSelectedItem(item);
    const nextValue = item === null ? null : getOptionKey(item);
    const previousValue = details.previousValue === null ? null : getOptionKey(details.previousValue);
    onValueChange?.(nextValue, {
      reason: details.reason,
      previousValue,
      selectedItem: item,
      previousSelectedItem: details.previousValue,
      event: details.event,
    } satisfies CgKeyComboBoxValueChangeDetails<TItem, TValue>);
  };

  const sharedProps = {
    ...comboBoxProps,
    value: resolvedValue,
    defaultValue: resolvedDefaultValue,
    onValueChange: handleValueChange,
    getOptionKey,
  };

  if (loadOptions !== undefined) {
    return (
      <CgComboBox
        {...sharedProps}
        ref={forwardedRef}
        loadOptions={loadOptions}
      />
    );
  }

  return (
    <CgComboBox
      {...sharedProps}
      ref={forwardedRef}
      options={options}
    />
  );
}

export const CgKeyComboBox = forwardRef(CgKeyComboBoxInner) as <
  TItem,
  TValue extends string | number,
>(
  props: CgKeyComboBoxProps<TItem, TValue> & React.RefAttributes<HTMLInputElement>,
) => React.ReactElement;
