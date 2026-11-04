import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import type { CgBaseProps, CgDirection } from '../../types';
import type { CgColorPickerProps, CgColorPickerValue } from '../ColorPicker';

/** Physical sides of the target. They don't swap in RTL, because they describe the target and not the reader. */
export type CgBorderEdge = 'top' | 'bottom' | 'left' | 'right' | 'inside-horizontal' | 'inside-vertical';

export type CgBorderLineStyle = 'thin' | 'medium' | 'thick' | 'dashed' | 'dotted' | 'double';

export type CgBorderPresetKey =
  | 'none'
  | 'all'
  | 'outside'
  | 'inside'
  | 'inside-horizontal'
  | 'inside-vertical'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'left-right'
  | 'top-bottom'
  | 'outside-thick'
  | 'bottom-thick'
  | 'bottom-double'
  | 'top-bottom-thick'
  | 'top-bottom-double';

export interface CgBorderEdgeStyle {
  edge: CgBorderEdge;
  lineStyle: CgBorderLineStyle;
}

export interface CgBorderApplyDetails {
  preset: CgBorderPresetKey;
  /** The edges to draw. Each takes the chosen line style, unless the preset fixes it, as `outside-thick` does. */
  edges: ReadonlyArray<CgBorderEdgeStyle>;
  /** `true` for the `none` preset: remove every border from the target. */
  clear: boolean;
  color: CgColorPickerValue;
  event: MouseEvent<HTMLButtonElement> | KeyboardEvent<HTMLButtonElement>;
}

export interface CgBorderPickerLabels {
  picker: string;
  presets: string;
  lineStyle: string;
  lineColor: string;
  presetNames: Partial<Record<CgBorderPresetKey, string>>;
  lineStyleNames: Partial<Record<CgBorderLineStyle, string>>;
}

type NativeBorderPickerProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'color' | 'dangerouslySetInnerHTML' | 'defaultValue' | 'dir' | 'role' | 'style'>;

export interface CgBorderPickerProps extends NativeBorderPickerProps, CgBaseProps {
  /** Called when a preset is chosen. Choosing one is a command, so it changes no state here. */
  onApply?: (details: CgBorderApplyDetails) => void;
  /** Which presets to offer, in order. Defaults to all of them. */
  presets?: ReadonlyArray<CgBorderPresetKey>;
  /** Marks the preset last used. */
  activePreset?: CgBorderPresetKey | null;
  lineStyle?: CgBorderLineStyle;
  defaultLineStyle?: CgBorderLineStyle;
  onLineStyleChange?: (lineStyle: CgBorderLineStyle) => void;
  /** Which line styles to offer, in order. Defaults to all of them. */
  lineStyles?: ReadonlyArray<CgBorderLineStyle>;
  color?: CgColorPickerValue;
  defaultColor?: CgColorPickerValue;
  onColorChange?: (color: CgColorPickerValue) => void;
  /** Passed to the line color picker, such as its theme colors and recent colors. */
  colorPicker?: Omit<CgColorPickerProps, 'value' | 'defaultValue' | 'onValueChange' | 'direction'>;
  disabled?: boolean;
  direction?: CgDirection;
  labels?: Partial<CgBorderPickerLabels>;
}
