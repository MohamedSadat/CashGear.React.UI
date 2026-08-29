import type {
  HTMLAttributes,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react';
import type { CgDateValue } from '../../types';

declare const cgDecimalValueBrand: unique symbol;
declare const cgLocalDateTimeValueBrand: unique symbol;
declare const cgInstantValueBrand: unique symbol;

/** A normalized, arbitrary-scale base-10 value without exponent notation. */
export type CgDecimalValue = string & { readonly [cgDecimalValueBrand]: true };
/** A normalized local civil date-time in YYYY-MM-DDTHH:mm:ss.sss form. */
export type CgLocalDateTimeValue = string & { readonly [cgLocalDateTimeValueBrand]: true };
/** A normalized ISO instant with Z or an explicit offset. */
export type CgInstantValue = string & { readonly [cgInstantValueBrand]: true };

export type CgRangeSelectorSize = 'small' | 'medium' | 'large';
export type CgRangeHandle = 'start' | 'end';
export type CgRangeChangeReason = 'pointer' | 'keyboard' | 'track' | 'rangeDrag';

export interface CgRangeSelectorValue<T> {
  readonly start: T | null;
  readonly end: T | null;
}

interface CgRangeSelectorInteractionDetails<T> {
  readonly value: CgRangeSelectorValue<T>;
  readonly previousValue: CgRangeSelectorValue<T>;
  readonly reason: CgRangeChangeReason;
  readonly handle: CgRangeHandle | null;
  readonly event?: Event | SyntheticEvent;
}

export type CgRangeSelectorChangingDetails<T> = CgRangeSelectorInteractionDetails<T>;
export type CgRangeSelectorValueChangeDetails<T> = CgRangeSelectorInteractionDetails<T>;
export type CgRangeSelectorChangedDetails<T> = CgRangeSelectorInteractionDetails<T>;

export interface CgRangeSelectorActions<T> {
  focusHandle: (handle: CgRangeHandle) => boolean;
  getValue: () => CgRangeSelectorValue<T>;
  cancelPreview: () => void;
  recalculateGeometry: () => void;
}

export interface CgRangeSelectorChartRenderContext<T> {
  readonly minimum: T;
  readonly maximum: T;
  readonly value: CgRangeSelectorValue<T>;
  readonly resolvedStart: T;
  readonly resolvedEnd: T;
  readonly startRatio: number;
  readonly endRatio: number;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly actions: CgRangeSelectorActions<T>;
}

type NativeRangeSelectorProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'dangerouslySetInnerHTML' | 'onChange' | 'defaultValue'
>;

interface CgRangeSelectorCommonProps<T, TInterval, TKind extends string>
  extends NativeRangeSelectorProps {
  valueKind: TKind;
  value?: CgRangeSelectorValue<T>;
  defaultValue?: CgRangeSelectorValue<T>;
  onValueChange?: (value: CgRangeSelectorValue<T>, details: CgRangeSelectorValueChangeDetails<T>) => void;
  minimum: T;
  maximum: T;
  step?: TInterval;
  minimumSelectionSpan?: TInterval;
  maximumSelectionSpan?: TInterval;
  allowHandleSwap?: boolean;
  allowRangeDrag?: boolean;
  moveSelectedRangeByClick?: boolean;
  snapToStep?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: CgRangeSelectorSize;
  showMarkers?: boolean;
  markerCount?: number;
  showLabels?: boolean;
  formatValue?: (value: T, handle: CgRangeHandle) => string;
  startHandleAriaLabel?: string;
  endHandleAriaLabel?: string;
  renderChart?: (context: CgRangeSelectorChartRenderContext<T>) => ReactNode;
  onRangeChanging?: (value: CgRangeSelectorValue<T>, details: CgRangeSelectorChangingDetails<T>) => void;
  onRangeChanged?: (value: CgRangeSelectorValue<T>, details: CgRangeSelectorChangedDetails<T>) => void;
  actionsRef?: Ref<CgRangeSelectorActions<T>>;
}

export type CgRangeSelectorNumberProps = CgRangeSelectorCommonProps<number, number, 'number'>;
export type CgRangeSelectorBigIntProps = CgRangeSelectorCommonProps<bigint, bigint, 'bigint'>;
export type CgRangeSelectorDecimalProps = CgRangeSelectorCommonProps<CgDecimalValue, CgDecimalValue, 'decimal'>;
export type CgRangeSelectorDateProps = CgRangeSelectorCommonProps<CgDateValue, number, 'date'>;
export type CgRangeSelectorLocalDateTimeProps = CgRangeSelectorCommonProps<CgLocalDateTimeValue, number, 'datetime-local'>;
export type CgRangeSelectorInstantProps = CgRangeSelectorCommonProps<CgInstantValue, number, 'instant'>;

export type CgRangeSelectorProps =
  | CgRangeSelectorNumberProps
  | CgRangeSelectorBigIntProps
  | CgRangeSelectorDecimalProps
  | CgRangeSelectorDateProps
  | CgRangeSelectorLocalDateTimeProps
  | CgRangeSelectorInstantProps;
