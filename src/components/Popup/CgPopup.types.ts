import type { CSSProperties, HTMLAttributes, ReactNode, Ref, SyntheticEvent } from 'react';
import type {
  CgOverlayCancelableResult,
  CgOverlayContentLoadMode,
  CgOverlayDragEndDetails,
  CgOverlayDragStartDetails,
  CgOverlayHorizontalAlignment,
  CgOverlayLifecyclePhase,
  CgOverlayPoint,
  CgOverlayResizeEndDetails,
  CgOverlayResizeStartDetails,
  CgOverlayVerticalAlignment,
  CgSizeMode,
} from '../../types';

export type CgPopupCloseReason = 'programmatic' | 'escape' | 'outsideClick' | 'closeButton';
export type CgPopupShading = 'visible' | 'transparent';

export interface CgPopupOpenDetails { reason: 'programmatic'; event?: Event | SyntheticEvent; }
export interface CgPopupBeforeOpenDetails extends CgPopupOpenDetails { signal: AbortSignal; }
export type CgPopupAfterOpenDetails = CgPopupOpenDetails;
export interface CgPopupCloseDetails { reason: CgPopupCloseReason; event?: Event | SyntheticEvent; }
export interface CgPopupBeforeCloseDetails extends CgPopupCloseDetails { signal: AbortSignal; }
export type CgPopupAfterCloseDetails = CgPopupCloseDetails;
export interface CgPopupOpenChangeDetails { reason: 'programmatic' | CgPopupCloseReason; event?: Event | SyntheticEvent; }
export interface CgPopupPositionChangeDetails {
  reason: 'drag';
  previousPosition: CgOverlayPoint;
  event?: Event | SyntheticEvent;
}

export interface CgPopupRenderContext {
  close: () => Promise<void>;
  focus: () => void;
  boundaryId: string;
}

export interface CgPopupActions {
  open: () => Promise<void>;
  close: () => Promise<void>;
  focus: () => void;
}

type NativePopupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'role' | 'onDragStart' | 'onDragEnd'>;

export interface CgPopupProps extends NativePopupProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgPopupOpenChangeDetails) => void;
  onBeforeOpen?: (details: CgPopupBeforeOpenDetails) => CgOverlayCancelableResult;
  onAfterOpen?: (details: CgPopupAfterOpenDetails) => void | PromiseLike<void>;
  onBeforeClose?: (details: CgPopupBeforeCloseDetails) => CgOverlayCancelableResult;
  onAfterClose?: (details: CgPopupAfterCloseDetails) => void | PromiseLike<void>;
  onLifecycleError?: (error: unknown, phase: CgOverlayLifecyclePhase) => void;

  children?: ReactNode;
  header?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  renderHeader?: (context: CgPopupRenderContext) => ReactNode;
  renderBody?: (context: CgPopupRenderContext) => ReactNode;
  renderFooter?: (context: CgPopupRenderContext) => ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showCloseButton?: boolean;
  closeButtonAriaLabel?: string;
  contentLoadMode?: CgOverlayContentLoadMode;

  role?: 'dialog' | 'alertdialog';
  size?: CgSizeMode;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  minWidth?: CSSProperties['minWidth'];
  maxWidth?: CSSProperties['maxWidth'];
  minHeight?: CSSProperties['minHeight'];
  maxHeight?: CSSProperties['maxHeight'];
  position?: CgOverlayPoint;
  defaultPosition?: CgOverlayPoint;
  onPositionChange?: (position: CgOverlayPoint, details: CgPopupPositionChangeDetails) => void;
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
  adaptive?: boolean;
  shading?: CgPopupShading;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  zIndex?: number;
  actionsRef?: Ref<CgPopupActions>;
}
