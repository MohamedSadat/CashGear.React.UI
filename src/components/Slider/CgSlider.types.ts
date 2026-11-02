import type { HTMLAttributes } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode } from '../../types';

type NativeSliderProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'defaultValue' | 'dir' | 'onChange' | 'role' | 'style'>;

export interface CgSliderProps extends NativeSliderProps, CgBaseProps {
  value?: number;
  /** Starting value when uncontrolled. Defaults to `min`. */
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  /** Runs on every change, including each move of a drag. */
  onValueChange?: (value: number) => void;
  /** Runs when a change is finished: on pointer release, on a handled key press, and on a stepper click. */
  onValueCommit?: (value: number) => void;
  disabled?: boolean;
  size?: CgSizeMode;
  direction?: CgDirection;
  /** Accessible name of the thumb. Defaults to `Value` when nothing else labels it. */
  ariaLabel?: string;
  /** Text for `aria-valuetext`, such as `100%`. */
  formatValue?: (value: number) => string;
  /** Values to draw as small ticks. Values outside `min` and `max` are left out. */
  marks?: ReadonlyArray<number>;
  showSteppers?: boolean;
  /** Amount each stepper moves the value. Defaults to `step`. */
  stepperStep?: number;
  decreaseLabel?: string;
  increaseLabel?: string;
}
