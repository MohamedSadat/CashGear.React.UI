import { useCgUiText } from '../UiText';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, ReactElement, RefAttributes } from 'react';
import { useCgId, useControllableState, useDirection } from '../../hooks';
import { containsEnabledLeaf } from '../../internal';
import { CgButton } from '../Button';
import { ButtonMenu, normalizeButtonMenu } from './ButtonMenu';
import styles from './CgDropDownButton.module.css';
import type { CgButtonMenuActions, CgDropDownButtonProps } from './CgDropDownButton.types';

function CgDropDownButtonInner<TData>(
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
    menuAriaLabel: menuAriaLabelProp,
    menuClassName,
    toggleIcon,
    dropDownIndicatorVisible = true,
    onItemClick,
    onItemError,
    actionsRef,
    disabled = false,
    children,
    ...buttonProps
  }: CgDropDownButtonProps<TData>,
  forwardedRef: ForwardedRef<HTMLButtonElement>,
) {
  const uiText = useCgUiText();
  const menuAriaLabel = menuAriaLabelProp ?? uiText.translate('Button menu');
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [actualOpen, setActualOpen] = useControllableState(open, defaultOpen, 'CgDropDownButton open');
  const resolvedDirection = useDirection(rootRef, direction);
  const normalized = useMemo(() => normalizeButtonMenu(items), [items]);
  const hasCommands = renderFlyout !== undefined || normalized.some(containsEnabledLeaf);
  const menuId = useCgId();
  const requestOpen = useCallback((value: boolean) => { setActualOpen(value); onOpenChange?.(value); }, [onOpenChange, setActualOpen]);
  const [openFocus, setOpenFocus] = useState<'first' | 'last'>('first');
  const canShow = !disabled && hasCommands;
  // A menu that can no longer be shown closes and reports it once, so a controlled `open` never stays true.
  useEffect(() => { if (actualOpen && !canShow) requestOpen(false); }, [actualOpen, canShow]); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(actionsRef, (): CgButtonMenuActions => ({
    show: () => { setOpenFocus('first'); requestOpen(true); }, hide: () => requestOpen(false), toggle: () => { setOpenFocus('first'); requestOpen(!actualOpen); }, focus: () => triggerRef.current?.focus(),
  }), [actualOpen, requestOpen]);
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    buttonProps.onKeyDown?.(event);
    if (event.defaultPrevented || !canShow || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    setOpenFocus(event.key === 'ArrowUp' ? 'last' : 'first');
    if (!actualOpen) requestOpen(true);
  };
  return <span ref={rootRef} className={styles.root} dir={resolvedDirection}>
    <CgButton
      {...buttonProps}
      ref={(node) => { triggerRef.current = node; if (typeof forwardedRef === 'function') forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }}
      type="button"
      disabled={disabled || !hasCommands}
      aria-haspopup={renderFlyout ? 'dialog' : 'menu'}
      aria-expanded={actualOpen}
      aria-controls={menuId}
      onClick={() => { setOpenFocus('first'); requestOpen(!actualOpen); }}
      onKeyDown={onTriggerKeyDown}
      trailingContent={dropDownIndicatorVisible ? <span className={styles.indicator} aria-hidden="true" data-cg-dropdown-indicator="">{toggleIcon ?? '▾'}</span> : undefined}
    >{children}</CgButton>
    <ButtonMenu
      id={menuId}
      anchorRef={triggerRef}
      items={items}
      renderItem={renderItem}
      renderFlyout={renderFlyout}
      open={actualOpen && canShow}
      requestOpen={requestOpen}
      initialFocus={openFocus}
      className={menuClassName}
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

export const CgDropDownButton = forwardRef(CgDropDownButtonInner) as <TData = unknown>(
  props: CgDropDownButtonProps<TData> & RefAttributes<HTMLButtonElement>,
) => ReactElement | null;
