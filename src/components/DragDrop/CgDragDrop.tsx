import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import styles from './CgDragDrop.module.css';
import type { CgDragHandleProps, CgDropIndicatorHandle, CgDropIndicatorPlacement, CgDropIndicatorProps } from './CgDragDrop.types';

/**
 * A grip that starts a drag (the caller passes `onPointerDown`, usually into `cgTrackDrag`) and
 * opens a menu on a click. ArrowUp and ArrowDown move with `onKeyboardMove`.
 */
export const CgDragHandle = forwardRef<HTMLButtonElement, CgDragHandleProps>(function CgDragHandle(
  { label, onKeyboardMove, size = 'medium', className, onKeyDown, title, ...nativeProps },
  forwardedRef,
) {
  if (!label.trim()) throw new Error('CgDragHandle label cannot be empty.');
  return <button
    {...nativeProps}
    ref={forwardedRef}
    type="button"
    className={cx(styles.handle, styles[size], className)}
    aria-label={label}
    title={title ?? label}
    aria-keyshortcuts={onKeyboardMove ? 'ArrowUp ArrowDown' : undefined}
    data-cg-drag-handle=""
    onKeyDown={(event) => {
      onKeyDown?.(event);
      if (event.defaultPrevented || !onKeyboardMove || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      onKeyboardMove(event.key === 'ArrowUp' ? -1 : 1);
    }}
  ><CgIcon name="drag-handle" /></button>;
});

function apply(element: HTMLDivElement, placement: CgDropIndicatorPlacement | null | undefined) {
  if (!placement) { element.hidden = true; return; }
  const horizontal = (placement.orientation ?? 'horizontal') === 'horizontal';
  element.hidden = false;
  element.dataset.orientation = horizontal ? 'horizontal' : 'vertical';
  element.style.insetBlockStart = `${placement.block}px`;
  element.style.insetInlineStart = `${placement.inline}px`;
  element.style.inlineSize = horizontal ? `${placement.length}px` : '';
  element.style.blockSize = horizontal ? '' : `${placement.length}px`;
}

/**
 * The line where a dragged item would land, placed in its positioned container. Move it through
 * the ref during a drag; the `placement` prop sets where it starts.
 */
export const CgDropIndicator = forwardRef<CgDropIndicatorHandle, CgDropIndicatorProps>(function CgDropIndicator(
  { placement = null, className, ...nativeProps },
  forwardedRef,
) {
  const lineRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (lineRef.current) apply(lineRef.current, placement); }, [placement]);
  useImperativeHandle(forwardedRef, () => ({
    show: (next) => { if (lineRef.current) apply(lineRef.current, next); },
    hide: () => { if (lineRef.current) apply(lineRef.current, null); },
  }), []);
  return <div {...nativeProps} ref={lineRef} className={cx(styles.indicator, className)} aria-hidden="true" hidden data-cg-drop-indicator="" />;
});
