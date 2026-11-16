import type { HTMLAttributes } from 'react';

export type CgAvatarSize = 'tiny' | 'small' | 'medium' | 'large';

export interface CgAvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>,
  'children' | 'role' | 'aria-label' | 'aria-hidden' | 'color' | 'dangerouslySetInnerHTML'> {
  /** The person's name: the avatar's accessible name and tooltip, and where its initials come from. */
  name: string;
  /** Letters drawn instead of those taken from `name`. */
  initials?: string;
  /** The background, any CSS colour (a token such as `var(--app-presence-3)` too). Default: a neutral surface. */
  color?: string;
  /** The letters' colour. Default: the theme's text on the neutral surface, white on a given `color`. */
  textColor?: string;
  /** A picture drawn over the initials; the initials stay if it fails to load. */
  src?: string;
  /** 16, 24, 32 or 40 pixels. Default `small`. */
  size?: CgAvatarSize;
  /** The name is written beside it: hidden from assistive technology and given no tooltip. */
  decorative?: boolean;
}

export interface CgAvatarStackItem {
  /** Stable identity, such as the person's id. */
  key: string;
  name: string;
  initials?: string;
  color?: string;
  textColor?: string;
  src?: string;
}

export interface CgAvatarStackProps extends Omit<HTMLAttributes<HTMLSpanElement>,
  'children' | 'role' | 'aria-label' | 'aria-hidden' | 'dangerouslySetInnerHTML'> {
  items: readonly CgAvatarStackItem[];
  /** The stack's accessible name, such as "3 people on this page". */
  label: string;
  /** At most this many avatars; those after them are counted in one "+N". Default 4. */
  max?: number;
  /** The accessible name and tooltip of "+N", given the people it stands for. */
  overflowLabel: (hidden: readonly CgAvatarStackItem[]) => string;
  size?: CgAvatarSize;
  /**
   * `group` (default): a group whose avatars are each named.
   * `image`: one image named by `label`, its avatars decoration, as beside a sidebar row.
   */
  variant?: 'group' | 'image';
}
