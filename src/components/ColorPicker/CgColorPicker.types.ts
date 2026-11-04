import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import type { CgBaseProps, CgDirection } from '../../types';

/**
 * A chosen color. A theme color stays a reference to its theme entry and tint, so
 * the host can store the reference and follow later theme changes. `color` is
 * always the lowercase `#rrggbb` to display.
 */
export type CgColorPickerValue =
  | { readonly kind: 'automatic' }
  | { readonly kind: 'none' }
  | { readonly kind: 'theme'; readonly key: string; readonly tint: number; readonly color: string }
  | { readonly kind: 'rgb'; readonly color: string };

export type CgColorPickerSource = 'automatic' | 'none' | 'theme' | 'standard' | 'recent' | 'custom';

export interface CgColorPickerChangeDetails {
  source: CgColorPickerSource;
  event?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement> | Event;
}

export interface CgColorPickerThemeColor {
  key: string;
  /** Accessible name of the color and the start of its shades' names. */
  name: string;
  color: string;
  /** Shades below the base color, from -1 to 1. Defaults to five chosen by how light the color is. */
  tints?: ReadonlyArray<number>;
}

export interface CgColorPickerStandardColor {
  name: string;
  color: string;
}

export interface CgColorPickerLabels {
  picker: string;
  automatic: string;
  none: string;
  themeColors: string;
  standardColors: string;
  recentColors: string;
  customColor: string;
  /** Name of a lighter shade, such as `Accent 1, lighter 40%`. */
  lighter: (name: string, percent: number) => string;
  /** Name of a darker shade, such as `Accent 1, darker 25%`. */
  darker: (name: string, percent: number) => string;
}

type NativeColorPickerProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'defaultValue' | 'dir' | 'role' | 'style'>;

export interface CgColorPickerProps extends NativeColorPickerProps, CgBaseProps {
  /** `null` means nothing is selected, as when a selection holds mixed colors. */
  value?: CgColorPickerValue | null;
  defaultValue?: CgColorPickerValue | null;
  onValueChange?: (value: CgColorPickerValue, details: CgColorPickerChangeDetails) => void;
  /** Columns of the palette, usually one workbook theme's colors. Omit to hide the section. */
  themeColors?: ReadonlyArray<CgColorPickerThemeColor>;
  /** Defaults to ten standard colors with English names. An empty list hides the section. */
  standardColors?: ReadonlyArray<CgColorPickerStandardColor>;
  /** Newest first. The section stays hidden while this is empty. */
  recentColors?: ReadonlyArray<CgColorPickerValue>;
  defaultRecentColors?: ReadonlyArray<CgColorPickerValue>;
  onRecentColorsChange?: (colors: ReadonlyArray<CgColorPickerValue>) => void;
  /** Defaults to `10`. */
  maxRecentColors?: number;
  /** Shows the Automatic option. */
  allowAutomatic?: boolean;
  /** Shown beside the Automatic option. Defaults to the text color. */
  automaticColor?: string;
  /** Shows the option for no color. Set `labels.none` to say what it means, such as `No fill`. */
  allowNone?: boolean;
  /** Shows a More colors option that opens the browser's color dialog. */
  allowCustomColor?: boolean;
  disabled?: boolean;
  direction?: CgDirection;
  labels?: Partial<CgColorPickerLabels>;
}
