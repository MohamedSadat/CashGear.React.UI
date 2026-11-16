import { forwardRef, useEffect, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, MouseEvent, ReactElement, RefAttributes } from 'react';
import { cx } from '../../utils';
import { CgFlyout } from '../Flyout';
import { CgToolbar } from '../Toolbar';
import styles from './CgSelectionToolbar.module.css';
import type { CgSelectionToolbarProps } from './CgSelectionToolbar.types';

const TAKES_FOCUS = 'input, textarea, select, [contenteditable="true"], [contenteditable=""]';

/** How far an on-screen keyboard covers the layout viewport from its bottom. */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = typeof window === 'undefined' ? undefined : window.visualViewport;
    if (!active || !viewport) return undefined;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, [active]);
  return inset;
}

function CgSelectionToolbarInner<TData>(
  {
    label,
    mode = 'floating',
    rect = null,
    open,
    placement = 'top',
    panel,
    overflowButtonLabel,
    autoOverflow = false,
    onEscape,
    keepSelection = true,
    offset = 8,
    zIndex,
    className,
    style,
    ...toolbarProps
  }: CgSelectionToolbarProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!label.trim()) throw new Error('CgSelectionToolbar label cannot be empty.');
  if (autoOverflow && !overflowButtonLabel?.trim()) throw new Error('CgSelectionToolbar overflowButtonLabel is required with autoOverflow.');
  const docked = mode === 'docked';
  const shown = open ?? (docked || rect !== null);
  const inset = useKeyboardInset(docked && shown);

  const surfaceProps = {
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
      if (keepSelection && !(event.target instanceof Element && event.target.closest(TAKES_FOCUS))) event.preventDefault();
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && onEscape && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation();
        onEscape();
      }
    },
  };
  const content = <>
    <CgToolbar
      {...toolbarProps}
      ariaLabel={label}
      autoOverflow={autoOverflow}
      overflowButtonLabel={overflowButtonLabel ?? label}
      className={styles.toolbar}
    />
    {panel !== undefined && panel !== null && panel !== false ? <div className={styles.panel}>{panel}</div> : null}
  </>;

  if (docked) {
    if (!shown) return null;
    return <div
      ref={forwardedRef}
      className={cx(styles.surface, styles.docked, className)}
      style={{ insetBlockEnd: inset, zIndex: zIndex ?? 'var(--cg-z-popover)', ...style }}
      data-cg-selection-toolbar="docked"
      {...surfaceProps}
    >{content}</div>;
  }
  return <CgFlyout
    ref={forwardedRef}
    anchor={rect ?? { x: 0, y: 0, width: 0, height: 0 }}
    open={shown && rect !== null}
    placement={placement}
    offset={offset}
    closeOnOutsideClick={false}
    closeOnEscape={false}
    scrollable={false}
    maxHeight="none"
    zIndex={zIndex}
    className={cx(styles.surface, className)}
    style={style}
    data-cg-selection-toolbar="floating"
    {...surfaceProps}
  >{content}</CgFlyout>;
}

export const CgSelectionToolbar = forwardRef(CgSelectionToolbarInner) as <TData = unknown>(
  props: CgSelectionToolbarProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
