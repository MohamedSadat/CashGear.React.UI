import type { SelectHTMLAttributes, SyntheticEvent } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode, CgValidationState } from '../../types';
import type { CgDateRangeValue, CgDateValue } from '../../types/date';
import type { DateRangePresetKey } from '../../internal/date/dateRangePresets';

export type CgDateRangePresetKey = DateRangePresetKey;
export interface CgDateRangePresetSelection {
  readonly preset: CgDateRangePresetKey;
  /** Custom returns null: keep the host's custom date inputs unchanged. */
  readonly range: CgDateRangeValue;
  readonly isClamped: boolean;
}
export interface CgDateRangePresetSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'defaultValue' | 'onChange' | 'size' | 'multiple' | 'children'>, CgBaseProps {
  value?: CgDateRangePresetKey;
  defaultValue?: CgDateRangePresetKey;
  onValueChange?: (value: CgDateRangePresetKey) => void;
  onSelectionChange?: (selection: CgDateRangePresetSelection, event: SyntheticEvent<HTMLSelectElement>) => void;
  presets?: readonly CgDateRangePresetKey[];
  presetText?: (preset: CgDateRangePresetKey) => string | null | undefined;
  anchorDate?: CgDateValue;
  minDate?: CgDateValue;
  maxDate?: CgDateValue;
  locale?: string;
  readOnly?: boolean;
  direction?: CgDirection;
  size?: CgSizeMode;
  validationState?: CgValidationState;
}
