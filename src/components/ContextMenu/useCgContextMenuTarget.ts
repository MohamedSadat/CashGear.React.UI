import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCgId, useMergedRefs } from '../../hooks';
import type { CgContextMenuTargetProps, UseCgContextMenuTargetOptions, UseCgContextMenuTargetResult } from './CgContextMenu.types';

export function useCgContextMenuTarget<TContext>({
  menuRef,
  context,
  disabled = false,
  openOnContextMenu = true,
  openOnKeyboard = true,
  openOnLongPress = true,
  openOnClick = false,
  longPressDelay = 600,
  longPressMovementThreshold = 10,
  targetRef,
  existingProps,
}: UseCgContextMenuTargetOptions<TContext>): UseCgContextMenuTargetResult {
  if (longPressDelay < 0 || !Number.isFinite(longPressMovementThreshold) || longPressMovementThreshold < 0) {
    throw new RangeError('Context-menu long-press timing and movement threshold must be non-negative.');
  }
  const ownerId = useCgId();
  const elementRef = useRef<HTMLElement>(null);
  const mergedRef = useMergedRefs(elementRef, targetRef);
  const gesture = useRef<{ pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined>(undefined);
  const cancelGesture = () => {
    if (!gesture.current) return;
    clearTimeout(gesture.current.timer);
    gesture.current = undefined;
  };
  useEffect(() => () => {
    cancelGesture();
    void menuRef.current?.hide('ownerLoss', ownerId);
  }, [menuRef, ownerId]);
  const showLongPress = (event: ReactPointerEvent<HTMLElement>) => {
    void menuRef.current?.showAt(event.clientX, event.clientY, context, { kind: 'longPress', ownerId });
  };
  const targetProps: CgContextMenuTargetProps = {
    ref: mergedRef as (node: HTMLElement | null) => void,
    'aria-haspopup': 'menu',
    onContextMenu: (event) => {
      existingProps?.onContextMenu?.(event);
      if (event.defaultPrevented) return;
      if (disabled || !openOnContextMenu) return;
      event.preventDefault();
      void menuRef.current?.showFromEvent(event, context, { kind: 'pointer', ownerId });
    },
    onKeyDown: (event) => {
      existingProps?.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (disabled || !openOnKeyboard || !(event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey)) return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      void menuRef.current?.showAtRectangle({ x: rect.left, y: rect.bottom, width: 0, height: 0 }, context, { kind: 'keyboard', ownerId });
    },
    onPointerDown: (event) => {
      existingProps?.onPointerDown?.(event);
      if (event.defaultPrevented) return;
      if (disabled || !openOnLongPress || event.pointerType === 'mouse') return;
      cancelGesture();
      const saved = event;
      gesture.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        timer: setTimeout(() => { gesture.current = undefined; showLongPress(saved); }, longPressDelay),
      };
    },
    onPointerMove: (event) => {
      existingProps?.onPointerMove?.(event);
      if (event.defaultPrevented) return;
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - current.x, event.clientY - current.y) > longPressMovementThreshold) cancelGesture();
    },
    onPointerUp: (event) => { existingProps?.onPointerUp?.(event); cancelGesture(); },
    onPointerCancel: (event) => { existingProps?.onPointerCancel?.(event); cancelGesture(); },
    onClick: (event) => {
      existingProps?.onClick?.(event);
      if (event.defaultPrevented) return;
      if (disabled || !openOnClick) return;
      void menuRef.current?.showFromEvent(event, context, { kind: 'click', ownerId });
    },
  };
  return { targetProps, ownerId };
}
