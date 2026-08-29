import type {
  AriaRole,
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  Ref,
  SyntheticEvent,
} from 'react';

export type CgDrawerMode = 'shrink' | 'overlay';
export type CgDrawerPosition = 'start' | 'end';
export type CgDrawerOpenReason = 'programmatic' | 'toggle';
export type CgDrawerCloseReason = 'programmatic' | 'toggle' | 'escape' | 'outsideInteraction' | 'responsiveChange';
export type CgDrawerLifecyclePhase = 'beforeOpen' | 'opened' | 'beforeClose' | 'closed';
export type CgDrawerCancelableResult = void | boolean | PromiseLike<void | boolean>;

interface CgDrawerEventDetails {
  readonly event?: Event | SyntheticEvent;
}

export interface CgDrawerBeforeOpenDetails extends CgDrawerEventDetails {
  readonly reason: CgDrawerOpenReason;
  readonly signal: AbortSignal;
}

export interface CgDrawerOpenedDetails extends CgDrawerEventDetails {
  readonly reason: CgDrawerOpenReason;
}

export interface CgDrawerBeforeCloseDetails extends CgDrawerEventDetails {
  readonly reason: CgDrawerCloseReason;
  readonly signal: AbortSignal;
}

export interface CgDrawerClosedDetails extends CgDrawerEventDetails {
  readonly reason: CgDrawerCloseReason;
}

export type CgDrawerOpenChangeDetails = CgDrawerOpenedDetails | CgDrawerClosedDetails;

export interface CgDrawerRenderContext {
  readonly open: boolean;
  readonly mode: CgDrawerMode;
  readonly effectiveMode: CgDrawerMode;
  readonly position: CgDrawerPosition;
  readonly mini: boolean;
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly boundaryId: string;
  readonly actions: CgDrawerActions;
}

export interface CgDrawerActions {
  focus: () => void;
  focusDrawer: () => void;
  open: () => Promise<boolean>;
  close: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
  getState: () => boolean;
}

type NativeDrawerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  'children' | 'role' | 'hidden' | 'inert' | 'aria-hidden' | 'aria-modal' | 'onChange'
>;
type DrawerPanelAttributes = Omit<
  HTMLAttributes<HTMLElement>,
  'children' | 'id' | 'className' | 'style' | 'role' | 'hidden' | 'inert' |
  'aria-label' | 'aria-labelledby' | 'aria-hidden' | 'aria-modal'
>;

export interface CgDrawerProps extends NativeDrawerProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: CgDrawerOpenChangeDetails) => void;
  onBeforeOpen?: (details: CgDrawerBeforeOpenDetails) => CgDrawerCancelableResult;
  onBeforeClose?: (details: CgDrawerBeforeCloseDetails) => CgDrawerCancelableResult;
  onOpened?: (details: CgDrawerOpenedDetails) => void | PromiseLike<void>;
  onClosed?: (details: CgDrawerClosedDetails) => void | PromiseLike<void>;
  onLifecycleError?: (error: unknown, phase: CgDrawerLifecyclePhase) => void;

  mode?: CgDrawerMode;
  position?: CgDrawerPosition;
  openSize?: number | string;
  miniModeEnabled?: boolean;
  miniSize?: number | string;
  responsiveOverlay?: boolean;
  responsiveBreakpoint?: number;
  applyBackgroundShading?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  lockBodyScroll?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  disabled?: boolean;
  visible?: boolean;

  renderDrawer?: (context: CgDrawerRenderContext) => ReactNode;
  renderMiniDrawer?: (context: CgDrawerRenderContext) => ReactNode;
  renderHeader?: (context: CgDrawerRenderContext) => ReactNode;
  renderFooter?: (context: CgDrawerRenderContext) => ReactNode;
  renderApplicationContent?: (context: CgDrawerRenderContext) => ReactNode;

  role?: AriaRole;
  panelId?: string;
  panelClassName?: string;
  panelStyle?: CSSProperties;
  panelAttributes?: DrawerPanelAttributes;
  actionsRef?: Ref<CgDrawerActions>;
}
