import type { SyntheticEvent } from 'react';

export interface CgOverlayPoint { x: number; y: number; }
export interface CgOverlayRectangle extends CgOverlayPoint { width: number; height: number; }
export interface CgOverlaySize { width: number; height: number; }

export type CgOverlayContentLoadMode = 'everyOpen' | 'fromMount' | 'firstOpen';
export type CgOverlayHorizontalAlignment = 'left' | 'center' | 'right' | 'start' | 'end';
export type CgOverlayVerticalAlignment = 'top' | 'center' | 'bottom';
export type CgOverlayCancelableResult = void | boolean | PromiseLike<void | boolean>;
export type CgOverlayLifecyclePhase = 'beforeOpen' | 'afterOpen' | 'beforeClose' | 'afterClose';

export interface CgOverlayEventDetails {
  event?: Event | SyntheticEvent;
}

export interface CgOverlayBeforeOpenDetails extends CgOverlayEventDetails {
  reason: 'programmatic';
  signal: AbortSignal;
}

export interface CgOverlayAfterOpenDetails extends CgOverlayEventDetails {
  reason: 'programmatic';
}

export interface CgOverlayDragStartDetails extends CgOverlayEventDetails {
  start: CgOverlayPoint;
}

export interface CgOverlayDragEndDetails extends CgOverlayEventDetails {
  start: CgOverlayPoint;
  end: CgOverlayPoint;
}

export interface CgOverlayResizeStartDetails extends CgOverlayEventDetails {
  startSize: CgOverlaySize;
}

export interface CgOverlayResizeEndDetails extends CgOverlayEventDetails {
  startSize: CgOverlaySize;
  endSize: CgOverlaySize;
}

export type CgOverlayPositionChangeReason = 'drag' | 'move' | 'showAt' | 'showNear';

export interface CgOverlayPositionChangeDetails extends CgOverlayEventDetails {
  reason: CgOverlayPositionChangeReason;
  previousPosition: CgOverlayPoint;
}
