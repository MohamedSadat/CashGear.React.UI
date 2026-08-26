import type {
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  Ref,
  RefObject,
} from 'react';
import type { CgFlyoutAnchor } from '../Flyout';
import type { CgDensity, CgDirection, CgIconSource, CgIntent, CgOverlayPoint, CgOverlayRectangle } from '../../types';

export type CgContextMenuInvocationKind = 'programmatic' | 'pointer' | 'keyboard' | 'longPress' | 'click';
export type CgContextMenuCloseReason =
  | 'item' | 'outsideClick' | 'escape' | 'tab' | 'focusLoss' | 'scroll'
  | 'navigation' | 'ownerLoss' | 'superseded' | 'programmatic' | 'unmount';

export interface CgContextMenuConfirmation {
  message: string;
  title?: string;
}

export interface CgContextMenuItem<TContext, TData = unknown> {
  key: string;
  text: string;
  icon?: CgIconSource;
  visible?: boolean;
  disabled?: boolean;
  separator?: boolean;
  beginGroup?: boolean;
  tooltip?: string;
  className?: string;
  intent?: CgIntent;
  badge?: ReactNode;
  shortcut?: ReactNode;
  checked?: boolean;
  radioGroup?: string;
  data?: TData;
  commandParameter?: unknown;
  confirmation?: CgContextMenuConfirmation;
  children?: ReadonlyArray<CgContextMenuItem<TContext, TData>>;
  command?: (details: CgContextMenuCommandDetails<TContext, TData>) => void | PromiseLike<void>;
}

export interface CgContextMenuInvocation<TContext> {
  id: number;
  kind: CgContextMenuInvocationKind;
  context: TContext;
  anchor: CgFlyoutAnchor;
  ownerId?: string;
  clientX: number;
  clientY: number;
  button: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  signal: AbortSignal;
}

export interface CgContextMenuLifecycleDetails<TContext> {
  invocation: CgContextMenuInvocation<TContext>;
  signal: AbortSignal;
}

export interface CgContextMenuCloseDetails<TContext> extends CgContextMenuLifecycleDetails<TContext> {
  reason: CgContextMenuCloseReason;
  event?: Event;
}

export interface CgContextMenuCustomizeDetails<TContext, TData = unknown> extends CgContextMenuLifecycleDetails<TContext> {
  items: ReadonlyArray<CgContextMenuItem<TContext, TData>>;
}

export interface CgContextMenuCommandDetails<TContext, TData = unknown> extends CgContextMenuLifecycleDetails<TContext> {
  item: CgContextMenuItem<TContext, TData>;
  commandParameter?: unknown;
  source: 'pointer' | 'keyboard';
  event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>;
}

export interface CgContextMenuCommandFailureDetails<TContext, TData = unknown> extends CgContextMenuCommandDetails<TContext, TData> {
  error: unknown;
}

export interface CgContextMenuRenderContext<TContext, TData = unknown> {
  item: CgContextMenuItem<TContext, TData>;
  invocation: CgContextMenuInvocation<TContext>;
  level: number;
  active: boolean;
  expanded: boolean;
  busy: boolean;
  defaultContent: ReactNode;
}

export interface CgContextMenuShowOptions {
  kind?: CgContextMenuInvocationKind;
  ownerId?: string;
}

export interface CgContextMenuActions<TContext> {
  showFromEvent: (event: MouseEvent<HTMLElement>, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  showAt: (x: number, y: number, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  showAtPoint: (point: CgOverlayPoint, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  showAtRectangle: (rectangle: CgOverlayRectangle, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  showNear: (anchor: HTMLElement | RefObject<HTMLElement | null>, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  toggleAtPoint: (point: CgOverlayPoint, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  toggleAtRectangle: (rectangle: CgOverlayRectangle, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  toggleNear: (anchor: HTMLElement | RefObject<HTMLElement | null>, context: TContext, options?: CgContextMenuShowOptions) => Promise<boolean>;
  hide: (reason?: CgContextMenuCloseReason, ownerId?: string) => Promise<boolean>;
  reposition: () => void;
}

type NativeContextMenuProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'>;

export interface CgContextMenuProps<TContext, TData = unknown> extends NativeContextMenuProps {
  items: ReadonlyArray<CgContextMenuItem<TContext, TData>>;
  renderItem?: (context: CgContextMenuRenderContext<TContext, TData>) => ReactNode;
  renderItemText?: (context: CgContextMenuRenderContext<TContext, TData>) => ReactNode;
  renderSubmenu?: (context: { parent: CgContextMenuItem<TContext, TData>; level: number; childContent: ReactNode }) => ReactNode;
  beforeOpen?: (details: CgContextMenuLifecycleDetails<TContext>) => void | boolean | PromiseLike<void | boolean>;
  afterOpen?: (details: CgContextMenuLifecycleDetails<TContext>) => void | PromiseLike<void>;
  customizeMenu?: (details: CgContextMenuCustomizeDetails<TContext, TData>) => void | ReadonlyArray<CgContextMenuItem<TContext, TData>> | PromiseLike<void | ReadonlyArray<CgContextMenuItem<TContext, TData>>>;
  beforeClose?: (details: CgContextMenuCloseDetails<TContext>) => void | boolean | PromiseLike<void | boolean>;
  afterClose?: (details: CgContextMenuCloseDetails<TContext>) => void | PromiseLike<void>;
  validateContext?: (details: CgContextMenuCommandDetails<TContext, TData>) => boolean | PromiseLike<boolean>;
  confirm?: (confirmation: CgContextMenuConfirmation, details: CgContextMenuCommandDetails<TContext, TData>) => boolean | PromiseLike<boolean>;
  beforeCommand?: (details: CgContextMenuCommandDetails<TContext, TData>) => void | boolean | PromiseLike<void | boolean>;
  onItemActivate?: (details: CgContextMenuCommandDetails<TContext, TData>) => void | PromiseLike<void>;
  afterCommand?: (details: CgContextMenuCommandDetails<TContext, TData>) => void | PromiseLike<void>;
  commandFailure?: (details: CgContextMenuCommandFailureDetails<TContext, TData>) => void | PromiseLike<void>;
  closeOnItemClick?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  closeOnFocusLoss?: boolean;
  closeOnScroll?: boolean;
  restoreFocus?: boolean;
  typeahead?: boolean;
  submenuOpenDelay?: number;
  loadingDelay?: number;
  loadingContent?: ReactNode;
  direction?: CgDirection;
  density?: CgDensity;
  ariaLabel?: string;
  minWidth?: string | number;
  maxWidth?: string | number;
  maxHeight?: string | number;
  zIndex?: number;
  actionsRef?: Ref<CgContextMenuActions<TContext>>;
}

export interface UseCgContextMenuTargetOptions<TContext> {
  menuRef: RefObject<CgContextMenuActions<TContext> | null>;
  context: TContext;
  disabled?: boolean;
  openOnContextMenu?: boolean;
  openOnKeyboard?: boolean;
  openOnLongPress?: boolean;
  openOnClick?: boolean;
  longPressDelay?: number;
  longPressMovementThreshold?: number;
  targetRef?: Ref<HTMLElement>;
  existingProps?: Partial<Omit<CgContextMenuTargetProps, 'ref' | 'aria-haspopup'>>;
}

export interface CgContextMenuTargetProps {
  ref: (node: HTMLElement | null) => void;
  'aria-haspopup': 'menu';
  onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

export interface UseCgContextMenuTargetResult {
  targetProps: CgContextMenuTargetProps;
  ownerId: string;
}
