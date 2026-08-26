import type { CSSProperties, HTMLAttributes, ReactNode, Ref, RefObject, SyntheticEvent } from 'react';
import type {
  CgOverlayAfterOpenDetails,
  CgOverlayBeforeOpenDetails,
  CgOverlayCancelableResult,
  CgOverlayContentLoadMode,
  CgOverlayLifecyclePhase,
  CgOverlayPoint,
  CgOverlayRectangle,
} from '../../types';

export type CgFlyoutPlacement =
  | 'bottom-start' | 'bottom' | 'bottom-end'
  | 'top-start' | 'top' | 'top-end'
  | 'right-start' | 'right' | 'right-end'
  | 'left-start' | 'left' | 'left-end';

export type CgFlyoutAnchor = HTMLElement | RefObject<HTMLElement | null> | string | CgOverlayRectangle | CgOverlayPoint;
export type CgFlyoutCloseReason = 'programmatic' | 'outsideClick' | 'escape' | 'scroll' | 'anchorLost' | 'superseded';

export interface CgFlyoutCloseDetails {
  reason: CgFlyoutCloseReason;
  event?: Event | SyntheticEvent;
}

export interface CgFlyoutBeforeCloseDetails extends CgFlyoutCloseDetails { signal: AbortSignal; }
export type CgFlyoutAfterCloseDetails = CgFlyoutCloseDetails;
export interface CgFlyoutOpenChangeDetails { reason: 'programmatic' | CgFlyoutCloseReason; event?: Event | SyntheticEvent; }

export interface CgFlyoutActions {
  open: () => Promise<void>;
  close: () => Promise<void>;
  toggle: () => Promise<void>;
  reposition: () => void;
  focusFirst: () => void;
  focusAnchor: () => void;
}

type NativeFlyoutProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export interface CgFlyoutProps extends NativeFlyoutProps {
  anchor: CgFlyoutAnchor;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgFlyoutOpenChangeDetails) => void;
  onBeforeOpen?: (details: CgOverlayBeforeOpenDetails) => CgOverlayCancelableResult;
  onAfterOpen?: (details: CgOverlayAfterOpenDetails) => void | PromiseLike<void>;
  onBeforeClose?: (details: CgFlyoutBeforeCloseDetails) => CgOverlayCancelableResult;
  onAfterClose?: (details: CgFlyoutAfterCloseDetails) => void | PromiseLike<void>;
  onLifecycleError?: (error: unknown, phase: CgOverlayLifecyclePhase) => void;

  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  contentLoadMode?: CgOverlayContentLoadMode;

  placement?: CgFlyoutPlacement;
  offset?: number;
  flipOnOverflow?: boolean;
  shiftOnOverflow?: boolean;
  matchAnchorWidth?: boolean;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  minWidth?: CSSProperties['minWidth'];
  maxWidth?: CSSProperties['maxWidth'];
  minHeight?: CSSProperties['minHeight'];
  maxHeight?: CSSProperties['maxHeight'];
  resizable?: boolean;
  scrollable?: boolean;

  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  closeOnScroll?: boolean;
  exclusiveGroup?: string;
  zIndex?: number;
  actionsRef?: Ref<CgFlyoutActions>;
}
