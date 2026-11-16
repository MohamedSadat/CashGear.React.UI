import type { ReactNode } from 'react';
import type { CgOverlayRectangle } from '../../types';
import type { CgToolbarProps } from '../Toolbar';

export interface CgSelectionToolbarProps<TData = unknown> extends Omit<CgToolbarProps<TData>,
  'ariaLabel' | 'overflowButtonLabel' | 'title' | 'renderTitle' | 'layout' | 'columnRows'> {
  /** The toolbar's accessible name, such as "Formatting". */
  label: string;
  /**
   * `floating` (default) follows `rect`, above it and below when there is no room. `docked`
   * sits at the bottom of the visible viewport, above an on-screen keyboard, as on a phone.
   */
  mode?: 'floating' | 'docked';
  /** The selection's rectangle in viewport pixels. `null` hides a floating toolbar. */
  rect?: CgOverlayRectangle | null;
  /** Shown while true. Default: a floating toolbar while it has a `rect`, a docked one always. */
  open?: boolean;
  /** Above (default) or below the selection; it flips when there is no room. */
  placement?: 'top' | 'bottom';
  /** Drawn under the toolbar's row inside the same surface, such as a link field or a colour list. */
  panel?: ReactNode;
  /** Needed when `autoOverflow` is on: the accessible name of the overflow button. */
  overflowButtonLabel?: string;
  /** Escape pressed inside the toolbar or its panel: return focus to the editor here. */
  onEscape?: () => void;
  /**
   * Presses in the toolbar do not move focus, so the editor keeps its selection; text fields
   * (inputs, text areas, selects) still take focus. Default true.
   */
  keepSelection?: boolean;
  /** Distance in pixels from the selection. Default 8. */
  offset?: number;
  zIndex?: number;
}
