import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';

export interface CgDragHandleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label' | 'type'> {
  /** The handle's accessible name and tooltip, such as "Drag to move, click for the block menu". */
  label: string;
  /** ArrowUp or ArrowDown on the focused handle: move what it holds by one place. */
  onKeyboardMove?: (delta: -1 | 1) => void;
  /** 16 to 24 pixels. Default `medium` (20). */
  size?: 'small' | 'medium';
}

export type CgDropIndicatorOrientation = 'horizontal' | 'vertical';

export interface CgDropIndicatorPlacement {
  /** Horizontal: a line across, at `block` from the container's block start. Vertical: a line down, at `inline` from its inline start. */
  orientation?: CgDropIndicatorOrientation;
  /** Pixels from the container's block start (top). */
  block: number;
  /** Pixels from the container's inline start (left in LTR, right in RTL). */
  inline: number;
  /** The line's length in pixels. */
  length: number;
}

/** What `ref` gives: the line is moved directly, so a drag draws nothing in React. */
export interface CgDropIndicatorHandle {
  show(placement: CgDropIndicatorPlacement): void;
  hide(): void;
}

export interface CgDropIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'dangerouslySetInnerHTML'> {
  /** Shown from the start at this place; `null` (default) starts hidden. */
  placement?: CgDropIndicatorPlacement | null;
}
