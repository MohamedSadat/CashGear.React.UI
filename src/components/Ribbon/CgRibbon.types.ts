import type { HTMLAttributes, MouseEvent, ReactNode, Ref } from 'react';
import type { CgBaseProps, CgDirection, CgIconSource } from '../../types';
import type { CgTabsActiveKeyChangeDetails } from '../Tabs';
import type { CgToolbarItem, CgToolbarItemActivationDetails } from '../Toolbar';

export type CgRibbonItemSize = 'large' | 'small';
/** `columns` fills columns of three small items beside any large ones. `rows` lays items out in rows, each started by `beginRow`. */
export type CgRibbonGroupLayout = 'columns' | 'rows';
export type CgRibbonCollapseSource = 'button' | 'tab' | 'keyboard' | 'action';

type InheritedItemProps = 'adaptiveText' | 'adaptivePriority' | 'alignment' | 'allowTextCollapse' | 'overflowBehavior' | 'stacked';

/**
 * One command. It takes the same options as a toolbar item, so `onClick`, `checked`,
 * `children`, `renderFlyout` and `render` all work the same way. A `render` item
 * keeps its own keyboard handling unless `ownsKeyboard` is `false`.
 */
export interface CgRibbonItem<TData = unknown> extends Omit<CgToolbarItem<TData>, InheritedItemProps> {
  /** `large` puts the icon above the text and fills a `columns` group's height. Defaults to `small`. */
  size?: CgRibbonItemSize;
  /** Shows only the icon, with `text` as the accessible name and tooltip. */
  hideText?: boolean;
  /** Its key tip, such as `1` for Bold. Without one, it gets one from its text. */
  keyTip?: string;
}

export interface CgRibbonGroup<TData = unknown> {
  key: string;
  /** Shown under the group, and on its button when the group collapses. */
  text: string;
  /** Shown on the group's button when it collapses. Defaults to the first item's icon. */
  icon?: CgIconSource;
  items: ReadonlyArray<CgRibbonItem<TData>>;
  /** When space runs out, lower priorities shrink first, and among equals the later group does. Defaults to `0`. */
  priority?: number;
  /** Defaults to `columns`. */
  layout?: CgRibbonGroupLayout;
  /** Adds a small button beside the group's name, usually to open a dialog with more options. */
  onLauncherClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Accessible name of that button. Defaults to `labels.launcher`. */
  launcherLabel?: string;
  /** `false` leaves the group out entirely. Defaults to `true`. */
  visible?: boolean;
  /** The key tip of the group's button once it collapses. Without one, it gets one from its text. */
  keyTip?: string;
  /** The launcher's key tip. Without one, it gets one from the group's text. */
  launcherKeyTip?: string;
}

export interface CgRibbonTab<TData = unknown> {
  key: string;
  text: string;
  groups: ReadonlyArray<CgRibbonGroup<TData>>;
  tooltip?: string;
  disabled?: boolean;
  /** `false` leaves the tab out entirely, for tabs that only apply sometimes. Defaults to `true`. */
  visible?: boolean;
  /** Its key tip, such as `H` for Home. Without one, it gets one from its text. */
  keyTip?: string;
}

export interface CgRibbonLabels {
  ribbon: string;
  collapse: string;
  expand: string;
  /** Name of a group's launcher button. */
  launcher: (groupText: string) => string;
  /** Name of a split button's arrow. */
  openMenu: (itemText: string) => string;
}

export interface CgRibbonCollapseDetails {
  source: CgRibbonCollapseSource;
}

export type CgRibbonActiveKeyChangeDetails = Pick<CgTabsActiveKeyChangeDetails, 'previousKey' | 'activeKey' | 'source' | 'isUserInitiated' | 'event'>;

export interface CgRibbonActions {
  /** Moves focus to the active tab. */
  focus: () => void;
  focusTab: (key: string) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  /** Measures again from scratch, for a change the ribbon can't see, such as a new font. */
  recalculateLayout: () => void;
  /** Shows the tabs' key tips, as tapping Alt does. */
  showKeyTips: () => void;
  hideKeyTips: () => void;
}

type NativeRibbonProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'className' | 'dangerouslySetInnerHTML' | 'dir' | 'role' | 'style'>;

export interface CgRibbonProps<TData = unknown> extends NativeRibbonProps, CgBaseProps {
  tabs: ReadonlyArray<CgRibbonTab<TData>>;
  activeKey?: string | null;
  defaultActiveKey?: string | null;
  onActiveKeyChange?: (key: string | null, details: CgRibbonActiveKeyChangeDetails) => void;
  /** A collapsed ribbon shows only its tabs, and a tab opens its commands over the content below. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean, details: CgRibbonCollapseDetails) => void;
  /** `false` removes the collapse button, Ctrl+F1 and double-clicking a tab. Defaults to `true`. */
  collapsible?: boolean;
  /** Shown before the tabs, such as a File menu. */
  startContent?: ReactNode;
  /** Shown after the tabs, before the collapse button. */
  endContent?: ReactNode;
  onItemClick?: (details: CgToolbarItemActivationDetails<TData>) => void | PromiseLike<void>;
  onItemError?: (error: unknown, details: CgToolbarItemActivationDetails<TData>) => void;
  direction?: CgDirection;
  /** Accessible name of the ribbon. Defaults to `labels.ribbon`. */
  ariaLabel?: string;
  labels?: Partial<CgRibbonLabels>;
  actionsRef?: Ref<CgRibbonActions>;
  /**
   * Office's key tips. Tapping Alt shows a badge on each tab, and on anything in `startContent` or
   * `endContent` with a `data-cg-keytip` attribute; typing a tab's letters opens it and shows its
   * commands' badges, and typing a command's runs it. Esc goes back a level. Holding Alt and
   * typing a tab's letter goes straight to it. Defaults to `false`.
   */
  keyTips?: boolean;
  /** Letters that Alt plus the letter leaves alone, such as a browser's own menus. Tapping Alt first still reaches them. */
  reservedAltKeys?: ReadonlyArray<string>;
  /** Called when key tips show or go. */
  onKeyTipsChange?: (shown: boolean) => void;
}
