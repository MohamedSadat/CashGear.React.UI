import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import type { CgDirection } from '../../types';

export type CgSplitterOrientation = 'horizontal' | 'vertical';
export type CgSplitterResizeMode = 'live' | 'deferred';
export type CgSplitterInteractionReason = 'pointer' | 'keyboard' | 'programmatic';

type CgSplitterLength = number | string;
type CgSplitterDataAttributes = Readonly<Record<`data-${string}`, string | number | boolean | undefined>>;

export interface CgSplitterPaneState {
  readonly key: string;
  readonly size: string;
}

export interface CgSplitterState {
  readonly version: 1;
  readonly panes: ReadonlyArray<CgSplitterPaneState>;
  readonly collapsedPaneKeys: ReadonlyArray<string>;
}

export interface CgSplitterPaneResizingDetails {
  readonly startPaneKey: string;
  readonly endPaneKey: string;
  readonly startPaneSizePixels: number;
  readonly endPaneSizePixels: number;
  readonly deltaPixels: number;
  readonly reason: CgSplitterInteractionReason;
}

export interface CgSplitterPaneResizedDetails {
  readonly startPaneKey: string;
  readonly endPaneKey: string;
  readonly previousStartPaneSizePixels: number | null;
  readonly previousEndPaneSizePixels: number | null;
  readonly startPaneSizePixels: number | null;
  readonly endPaneSizePixels: number | null;
  readonly reason: CgSplitterInteractionReason;
}

export interface CgSplitterPaneCollapsedDetails {
  readonly paneKey: string;
  readonly previousSize: string;
  readonly reason: CgSplitterInteractionReason;
}

export interface CgSplitterPaneExpandedDetails {
  readonly paneKey: string;
  readonly restoredSize: string;
  readonly reason: CgSplitterInteractionReason;
}

export interface CgSplitterStateChangeDetails {
  readonly operation: 'resize' | 'collapse' | 'expand' | 'reset' | 'setPaneSize';
  readonly reason: CgSplitterInteractionReason;
  readonly paneKey?: string;
  readonly startPaneKey?: string;
  readonly endPaneKey?: string;
}

export interface CgSplitterPaneRenderContext {
  readonly descriptor: CgSplitterPaneDescriptor;
  readonly key: string;
  readonly index: number;
  readonly size: string;
  readonly collapsed: boolean;
  readonly disabled: boolean;
  readonly readOnly: boolean;
  readonly paneId: string;
  readonly actions: CgSplitterActions;
}

export interface CgSplitterPaneDescriptor {
  readonly key: string;
  readonly size?: CgSplitterLength;
  readonly minimumSize?: CgSplitterLength;
  readonly maximumSize?: CgSplitterLength;
  readonly resizable?: boolean;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
  readonly visible?: boolean;
  readonly renderContent: (context: CgSplitterPaneRenderContext) => ReactNode;
  readonly renderHeader?: (context: CgSplitterPaneRenderContext) => ReactNode;
  readonly renderCollapsed?: (context: CgSplitterPaneRenderContext) => ReactNode;
  readonly onCollapsedChange?: (
    collapsed: boolean,
    details: CgSplitterPaneCollapsedDetails | CgSplitterPaneExpandedDetails,
  ) => void;
  readonly id?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly ariaLabel?: string;
  readonly dataAttributes?: CgSplitterDataAttributes;
}

export interface CgSplitterActions {
  focus: () => void;
  focusSeparator: (startPaneKey: string, endPaneKey: string) => boolean;
  getState: () => CgSplitterState;
  reset: () => boolean;
  collapsePane: (key: string) => boolean;
  expandPane: (key: string) => boolean;
  togglePane: (key: string) => boolean;
  setPaneSize: (key: string, size: CgSplitterLength) => boolean;
}

type NativeSplitterProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'aria-disabled' | 'onChange'
>;

export interface CgSplitterProps extends NativeSplitterProps {
  panes: ReadonlyArray<CgSplitterPaneDescriptor>;
  orientation?: CgSplitterOrientation;
  resizeMode?: CgSplitterResizeMode;
  gutterSize?: CgSplitterLength;
  keyboardStep?: number;
  resizeNotificationInterval?: number;
  state?: CgSplitterState;
  defaultState?: CgSplitterState;
  onStateChange?: (state: CgSplitterState, details: CgSplitterStateChangeDetails) => void;
  onPaneResizing?: (details: CgSplitterPaneResizingDetails) => void;
  onPaneResized?: (details: CgSplitterPaneResizedDetails) => void;
  onPaneCollapsed?: (details: CgSplitterPaneCollapsedDetails) => void;
  onPaneExpanded?: (details: CgSplitterPaneExpandedDetails) => void;
  disabled?: boolean;
  readOnly?: boolean;
  direction?: CgDirection;
  actionsRef?: Ref<CgSplitterActions>;
}
