import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';
import { useCgId, useControllableState, useDirection } from '../../hooks';
import { containsEnabledLeaf } from '../../internal';
import { CgButton } from '../Button';
import { ButtonMenu, normalizeButtonMenu } from '../DropDownButton/ButtonMenu';
import type { CgButtonMenuActions } from '../DropDownButton';
import styles from './CgSplitButton.module.css';
import type { CgSplitButtonProps } from './CgSplitButton.types';

function CgSplitButtonInner<TData>(
  {
    items,
    renderItem,
    renderFlyout,
    open,
    defaultOpen = false,
    onOpenChange,
    placement = 'bottom-start',
    flipOnOverflow = true,
    shiftOnOverflow = true,
    offset = 4,
    matchAnchorWidth = false,
    menuMinWidth = '12rem',
    menuMaxWidth = '24rem',
    menuMaxHeight = '320px',
    direction = 'auto',
    closeOnItemClick = true,
    zIndex,
    menuAriaLabel = 'Button menu',
    onItemClick,
    onItemError,
    actionsRef,
    togglePosition = 'end',
    toggleAriaLabel = 'Open menu',
    toggleTabIndex,
    disabled = false,
    children,
    ...primaryProps
  }: CgSplitButtonProps<TData>,
  forwardedRef: ForwardedRef<HTMLButtonElement>,
) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [actualOpen, setActualOpen] = useControllableState(open, defaultOpen, 'CgSplitButton open');
  const resolvedDirection = useDirection(rootRef, direction);
  const normalized = useMemo(() => normalizeButtonMenu(items), [items]);
  const hasCommands = renderFlyout !== undefined || normalized.some(containsEnabledLeaf);
  const menuId = useCgId();
  const requestOpen = useCallback((value: boolean) => { setActualOpen(value); onOpenChange?.(value); }, [onOpenChange, setActualOpen]);
  useImperativeHandle(actionsRef, (): CgButtonMenuActions => ({
    show: () => requestOpen(true), hide: () => requestOpen(false), toggle: () => requestOpen(!actualOpen), focus: () => primaryRef.current?.focus(),
  }), [actualOpen, requestOpen]);
  const toggle = <CgButton
    ref={toggleRef}
    type="button"
    className={styles.toggle}
    appearance={primaryProps.appearance}
    intent={primaryProps.intent}
    size={primaryProps.size}
    disabled={disabled || !hasCommands}
    aria-label={toggleAriaLabel}
    aria-haspopup={renderFlyout ? 'dialog' : 'menu'}
    aria-expanded={actualOpen}
    aria-controls={menuId}
    tabIndex={toggleTabIndex}
    onClick={() => requestOpen(!actualOpen)}
  >{'▾'}</CgButton>;
  return <span ref={rootRef} className={styles.root} role="group" dir={resolvedDirection}>
    {togglePosition === 'start' ? toggle : null}
    <CgButton
      {...primaryProps}
      ref={(node) => { primaryRef.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      disabled={disabled}
    >{children}</CgButton>
    {togglePosition === 'end' ? toggle : null}
    <ButtonMenu
      id={menuId}
      anchorRef={toggleRef}
      items={items}
      renderItem={renderItem}
      renderFlyout={renderFlyout}
      open={actualOpen}
      requestOpen={requestOpen}
      placement={placement}
      flipOnOverflow={flipOnOverflow}
      shiftOnOverflow={shiftOnOverflow}
      offset={offset}
      matchAnchorWidth={matchAnchorWidth}
      minWidth={menuMinWidth}
      maxWidth={menuMaxWidth}
      maxHeight={menuMaxHeight}
      direction={resolvedDirection}
      closeOnItemClick={closeOnItemClick}
      zIndex={zIndex}
      ariaLabel={menuAriaLabel}
      onItemClick={onItemClick}
      onItemError={onItemError}
    />
  </span>;
}

export const CgSplitButton = forwardRef(CgSplitButtonInner) as <TData = unknown>(
  props: CgSplitButtonProps<TData> & RefAttributes<HTMLButtonElement>,
) => ReactElement | null;
