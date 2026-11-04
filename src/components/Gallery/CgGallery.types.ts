import type { CSSProperties, HTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgIconSource, CgSizeMode } from '../../types';
import type { CgButtonAppearance } from '../Button';
import type { CgFlyoutPlacement } from '../Flyout';

export type CgGalleryDisplay = 'dropdown' | 'inline';

export interface CgGalleryItem<TData = unknown> {
  key: string;
  /** Accessible name and tooltip of the swatch. */
  text: string;
  /** The swatch's picture. Without one, the swatch shows `text`. */
  preview?: ReactNode;
  /** Key of the group the swatch belongs to, from the `groups` prop. */
  group?: string;
  disabled?: boolean;
  /** `false` leaves the swatch out entirely. Defaults to `true`. */
  visible?: boolean;
  data?: TData;
}

export interface CgGalleryGroup {
  key: string;
  text: string;
}

export interface CgGalleryItemRenderContext<TData = unknown> {
  item: CgGalleryItem<TData>;
  selected: boolean;
}

export interface CgGalleryChangeDetails<TData = unknown> {
  item: CgGalleryItem<TData>;
  event: MouseEvent<HTMLButtonElement>;
}

type NativeGalleryProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'defaultValue' | 'dir' | 'role' | 'style'>;

export interface CgGalleryProps<TData = unknown> extends NativeGalleryProps, CgBaseProps {
  items: ReadonlyArray<CgGalleryItem<TData>>;
  /** Shown in this order, each under its heading. Every `item.group` must name one of them. */
  groups?: ReadonlyArray<CgGalleryGroup>;
  /** `null` means nothing is selected. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (key: string, details: CgGalleryChangeDetails<TData>) => void;
  /** Draws a swatch. Takes the place of `item.preview`. */
  renderItem?: (context: CgGalleryItemRenderContext<TData>) => ReactNode;
  /** Defaults to `5`. */
  columns?: number;
  /** Width of a swatch. Defaults to `4.25rem`. */
  itemWidth?: CSSProperties['width'];
  /** Height of a swatch. Defaults to `3rem`. */
  itemHeight?: CSSProperties['height'];
  /** Longer galleries scroll past this height. Defaults to `22rem`. */
  maxHeight?: CSSProperties['maxHeight'];
  /** Shown under the swatches, such as a command for a new style. */
  footer?: ReactNode;
  /** `dropdown` adds its own button and flyout. `inline` is only the grid, for hosting in another surface. Defaults to `dropdown`. */
  display?: CgGalleryDisplay;
  /** Accessible name of the grid. Defaults to `Gallery`. */
  ariaLabel?: string;
  disabled?: boolean;
  direction?: CgDirection;
  /** Dropdown only: the button's text. */
  triggerText?: ReactNode;
  /** Dropdown only. */
  triggerIcon?: CgIconSource;
  /** Dropdown only. Defaults to `outline`. */
  triggerAppearance?: CgButtonAppearance;
  /** Dropdown only. */
  size?: CgSizeMode;
  /** Dropdown only. */
  open?: boolean;
  /** Dropdown only. */
  defaultOpen?: boolean;
  /** Dropdown only. */
  onOpenChange?: (open: boolean) => void;
  /** Dropdown only. Defaults to `bottom-start`. */
  placement?: CgFlyoutPlacement;
  /** Dropdown only: whether choosing a swatch closes the flyout. Defaults to `true`. */
  closeOnSelect?: boolean;
}
