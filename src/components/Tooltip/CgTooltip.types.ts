import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from 'react';

export type CgTooltipTrigger = 'hover-focus' | 'click' | 'manual';
export type CgTooltipPosition = 'auto' | 'top' | 'bottom' | 'start' | 'end';
export type CgTooltipVisibilityChangeReason = 'hover' | 'focus' | 'click' | 'escape' | 'outside' | 'manual' | 'disabled' | 'targetLost';

export interface CgTooltipVisibilityChangeDetails {
  readonly visible: boolean;
  readonly previousVisible: boolean;
  readonly reason: CgTooltipVisibilityChangeReason;
  readonly event?: Event;
}

export interface CgTooltipShownDetails {
  readonly reason: CgTooltipVisibilityChangeReason;
  readonly position: Exclude<CgTooltipPosition, 'auto'>;
}

export interface CgTooltipHiddenDetails {
  readonly reason: CgTooltipVisibilityChangeReason;
}

export interface CgTooltipRenderContext {
  readonly visible: boolean;
  readonly id: string;
  readonly position: CgTooltipPosition;
  readonly trigger: CgTooltipTrigger;
}

export interface CgTooltipActions {
  show: () => Promise<boolean>;
  hide: () => Promise<boolean>;
  toggle: () => Promise<boolean>;
  reposition: () => void;
  getVisible: () => boolean;
}

export type CgTooltipSurfaceAttributes = Omit<HTMLAttributes<HTMLDivElement>,
  'children' | 'className' | 'style' | 'id' | 'role' | 'dangerouslySetInnerHTML' | 'aria-label'>;

export interface CgTooltipProps {
  children: ReactNode;
  text?: ReactNode;
  renderContent?: (context: CgTooltipRenderContext) => ReactNode;
  visible?: boolean;
  defaultVisible?: boolean;
  onVisibleChange?: (visible: boolean, details: CgTooltipVisibilityChangeDetails) => void | boolean | PromiseLike<void | boolean>;
  trigger?: CgTooltipTrigger;
  position?: CgTooltipPosition;
  openDelay?: number;
  closeDelay?: number;
  disabled?: boolean;
  interactive?: boolean;
  showArrow?: boolean;
  maxWidth?: CSSProperties['maxWidth'];
  gap?: number;
  accessibleLabel?: string;
  surfaceId?: string;
  surfaceClassName?: string;
  surfaceStyle?: CSSProperties;
  surfaceAttributes?: CgTooltipSurfaceAttributes;
  onShown?: (details: CgTooltipShownDetails) => void;
  onHidden?: (details: CgTooltipHiddenDetails) => void;
  actionsRef?: Ref<CgTooltipActions>;
}
