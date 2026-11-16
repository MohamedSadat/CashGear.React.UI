import type { HTMLAttributes, MouseEvent, ReactNode } from 'react';

export interface CgMenuPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'aria-label' | 'dangerouslySetInnerHTML'> {
  /** The menu's accessible name. */
  label: string;
  /** The menu's items: `CgMenuPanelItem`, `CgMenuPanelSwitch`, `CgMenuPanelGroup`, `CgMenuPanelSeparator`. */
  children?: ReactNode;
  /** Above everything, such as a `CgMenuPanelHeader` with a back button. */
  header?: ReactNode;
  /**
   * Fields above the menu, such as a name input. ArrowDown in a single-line field moves to the
   * first item, and ArrowUp on the first item comes back to the last field.
   */
  fields?: ReactNode;
  /** Under the menu. */
  footer?: ReactNode;
  /** Escape pressed inside the panel. */
  onEscape?: () => void;
}

export interface CgMenuPanelItemProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children' | 'onSelect' | 'role' | 'aria-checked' | 'dangerouslySetInnerHTML'> {
  children: ReactNode;
  onSelect: (event: MouseEvent<HTMLButtonElement>) => void;
  /** A `CgIcon` name, an element, or text such as an emoji. Replaced by a check while `checked`. */
  icon?: ReactNode;
  /** Secondary text at the line end, such as the current value. */
  hint?: ReactNode;
  /** Draws the item as destructive. */
  danger?: boolean;
  disabled?: boolean;
  /** Makes it a radio (default) or check item. */
  checked?: boolean;
  checkable?: 'radio' | 'checkbox';
  /** Opens another panel: drawn with a chevron and `aria-haspopup`. */
  opensPanel?: boolean;
  /** Takes focus when the panel opens in a `CgFlyout` (its `data-cg-initial-focus`). */
  initialFocus?: boolean;
}

export interface CgMenuPanelSwitchProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'role' | 'aria-checked' | 'dangerouslySetInnerHTML'> {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  icon?: ReactNode;
  disabled?: boolean;
  initialFocus?: boolean;
}

export interface CgMenuPanelGroupProps {
  /** The group's visible and accessible name. */
  label: string;
  children: ReactNode;
}

export interface CgMenuPanelHeaderProps {
  title: ReactNode;
  /** Draws a back button when given. */
  onBack?: () => void;
  /** The back button's accessible name. Needed with `onBack`. */
  backLabel?: string;
}
