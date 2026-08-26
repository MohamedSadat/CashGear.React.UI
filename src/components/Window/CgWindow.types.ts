import type { CSSProperties, HTMLAttributes, ReactNode, Ref, SyntheticEvent } from 'react';
import type {
  CgOverlayCancelableResult,
  CgOverlayContentLoadMode,
  CgOverlayDragEndDetails,
  CgOverlayDragStartDetails,
  CgOverlayHorizontalAlignment,
  CgOverlayLifecyclePhase,
  CgOverlayPoint,
  CgOverlayPositionChangeReason,
  CgOverlayResizeEndDetails,
  CgOverlayResizeStartDetails,
  CgOverlayVerticalAlignment,
  CgSizeMode,
} from '../../types';

export type CgWindowCloseReason = 'programmatic' | 'escape' | 'closeButton';
export type CgWindowPositionChangeReason = CgOverlayPositionChangeReason;
export type CgWindowNearTarget = HTMLElement | string;

export interface CgWindowOpenDetails { reason: 'programmatic'; event?: Event | SyntheticEvent; }
export interface CgWindowBeforeOpenDetails extends CgWindowOpenDetails { signal: AbortSignal; }
export type CgWindowAfterOpenDetails = CgWindowOpenDetails;
export interface CgWindowCloseDetails { reason: CgWindowCloseReason; event?: Event | SyntheticEvent; }
export interface CgWindowBeforeCloseDetails extends CgWindowCloseDetails { signal: AbortSignal; }
export type CgWindowAfterCloseDetails = CgWindowCloseDetails;
export interface CgWindowOpenChangeDetails { reason: 'programmatic' | CgWindowCloseReason; event?: Event | SyntheticEvent; }
export interface CgWindowPositionChangeDetails {
  reason: CgWindowPositionChangeReason;
  previousPosition: CgOverlayPoint;
  event?: Event | SyntheticEvent;
}

export interface CgWindowRenderContext {
  close: () => Promise<void>;
  focus: () => void;
  boundaryId: string;
}

export interface CgWindowActions {
  show: () => Promise<void>;
  close: () => Promise<void>;
  showAt: (x: number, y: number) => Promise<void>;
  showAtPoint: (point: CgOverlayPoint) => Promise<void>;
  showNear: (target: CgWindowNearTarget) => Promise<void>;
  moveTo: (x: number, y: number) => void;
  moveToPoint: (point: CgOverlayPoint) => void;
  focus: () => void;
}

type NativeWindowProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'onDragStart' | 'onDragEnd'>;

export interface CgWindowProps extends NativeWindowProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgWindowOpenChangeDetails) => void;
  onBeforeOpen?: (details: CgWindowBeforeOpenDetails) => CgOverlayCancelableResult;
  onAfterOpen?: (details: CgWindowAfterOpenDetails) => void | PromiseLike<void>;
  onBeforeClose?: (details: CgWindowBeforeCloseDetails) => CgOverlayCancelableResult;
  onAfterClose?: (details: CgWindowAfterCloseDetails) => void | PromiseLike<void>;
  onLifecycleError?: (error: unknown, phase: CgOverlayLifecyclePhase) => void;

  children?: ReactNode;
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  renderHeader?: (context: CgWindowRenderContext) => ReactNode;
  renderBody?: (context: CgWindowRenderContext) => ReactNode;
  renderFooter?: (context: CgWindowRenderContext) => ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  contentLoadMode?: CgOverlayContentLoadMode;

  role?: 'dialog' | 'region';
  size?: CgSizeMode;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  minWidth?: CSSProperties['minWidth'];
  maxWidth?: CSSProperties['maxWidth'];
  minHeight?: CSSProperties['minHeight'];
  maxHeight?: CSSProperties['maxHeight'];
  position?: CgOverlayPoint;
  defaultPosition?: CgOverlayPoint;
  onPositionChange?: (position: CgOverlayPoint, details: CgWindowPositionChangeDetails) => void;
  horizontalAlignment?: CgOverlayHorizontalAlignment;
  verticalAlignment?: CgOverlayVerticalAlignment;
  allowDrag?: boolean;
  dragByHeaderOnly?: boolean;
  allowResize?: boolean;
  onDragStart?: (details: CgOverlayDragStartDetails) => void;
  onDragEnd?: (details: CgOverlayDragEndDetails) => void;
  onResizeStart?: (details: CgOverlayResizeStartDetails) => void;
  onResizeEnd?: (details: CgOverlayResizeEndDetails) => void;
  scrollable?: boolean;
  closeOnEscape?: boolean;
  zIndex?: number;
  actionsRef?: Ref<CgWindowActions>;
}
