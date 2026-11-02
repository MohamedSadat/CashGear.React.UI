import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';
import type { CgBaseProps, CgDirection, CgSizeMode } from '../../types';

export type CgStatusBarItemAlign = 'start' | 'end';

export interface CgStatusBarItem {
  key: string;
  content: ReactNode;
  /** The end of the bar this item sits at. Defaults to `start`. */
  align?: CgStatusBarItemAlign;
  tooltip?: string;
  /** `false` leaves the item out entirely. Defaults to `true`. */
  visible?: boolean;
  /** Renders the item as a button. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Draws a divider before the item, unless it comes first at its end of the bar. */
  separator?: boolean;
  /** When space runs out, lower priorities hide first, and among equals the later item does. Defaults to `0`. */
  priority?: number;
  className?: string;
  /** Any `data-*` attribute, such as `data-testid`, reaches the item's element. */
  [dataAttribute: `data-${string}`]: string | number | boolean | undefined;
}

type NativeStatusBarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'dir' | 'role' | 'style'>;

export interface CgStatusBarProps extends NativeStatusBarProps, CgBaseProps {
  items: ReadonlyArray<CgStatusBarItem>;
  size?: CgSizeMode;
  direction?: CgDirection;
  /** Accessible name of the bar. Defaults to `Status bar`. */
  ariaLabel?: string;
}
