import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';
import type { CgDirection, CgSizeMode } from '../../types';
import type { CgTabDescriptor, CgTabsActions, CgTabsActiveKeyChangeDetails, CgTabsContentMode } from '../Tabs';

export type CgFormLayoutCaptionPosition = 'horizontal' | 'vertical';
export type CgFormLayoutGroupChangeSource = 'pointer' | 'collection';
export type CgFormLayoutSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface CgFormLayoutResponsiveProps {
  xs?: CgFormLayoutSpan;
  sm?: CgFormLayoutSpan;
  md?: CgFormLayoutSpan;
  lg?: CgFormLayoutSpan;
  xl?: CgFormLayoutSpan;
  xxl?: CgFormLayoutSpan;
  visible?: boolean;
  beginRow?: boolean;
}

export interface CgFormLayoutItemRenderContext {
  caption: ReactNode;
  content: ReactNode;
  captionPosition: CgFormLayoutCaptionPosition;
  captionId?: string;
  controlId?: string;
}

export interface CgFormLayoutGroupRenderContext {
  caption: ReactNode;
  expanded: boolean;
  collapsible: boolean;
  contentId: string;
}

export interface CgFormLayoutGroupExpansionDetails {
  expanded: boolean;
  previousExpanded: boolean;
  source: CgFormLayoutGroupChangeSource;
  isUserInitiated: boolean;
}

export interface CgFormLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  children?: ReactNode;
  captionPosition?: CgFormLayoutCaptionPosition;
  captionWidth?: CSSProperties['inlineSize'];
  size?: CgSizeMode;
  direction?: CgDirection;
}

export interface CgFormLayoutItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'>, CgFormLayoutResponsiveProps {
  caption?: ReactNode;
  renderCaption?: (context: CgFormLayoutItemRenderContext) => ReactNode;
  renderItem?: (context: CgFormLayoutItemRenderContext) => ReactNode;
  captionPosition?: CgFormLayoutCaptionPosition;
  captionFor?: string;
  captionClassName?: string;
  children?: ReactNode;
}

export interface CgFormLayoutGroupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'>, CgFormLayoutResponsiveProps {
  caption?: ReactNode;
  captionAriaLabel?: string;
  renderCaption?: (context: CgFormLayoutGroupRenderContext) => ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean, details: CgFormLayoutGroupExpansionDetails) => void;
  afterExpandedChange?: (details: CgFormLayoutGroupExpansionDetails) => void;
}

export interface CgFormLayoutTabDescriptor<TData = unknown> extends Omit<CgTabDescriptor<TData>, 'content'> {
  content?: ReactNode;
  captionPosition?: CgFormLayoutCaptionPosition;
}

export interface CgFormLayoutTabsProps<TData = unknown> extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'>, CgFormLayoutResponsiveProps {
  tabs: ReadonlyArray<CgFormLayoutTabDescriptor<TData>>;
  activeKey?: string | null;
  defaultActiveKey?: string | null;
  onActiveKeyChange?: (key: string | null, details: CgTabsActiveKeyChangeDetails<TData>) => void;
  contentMode?: CgTabsContentMode;
  emptyContent?: ReactNode;
  actionsRef?: Ref<CgTabsActions>;
}
