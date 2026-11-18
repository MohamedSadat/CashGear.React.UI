import { useCgUiText } from '../UiText';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, ReactElement, RefAttributes } from 'react';
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
    menuAriaLabel: menuAriaLabelProp,
    menuClassName,
    toggleIcon,
    onItemClick,
    onItemError,
    actionsRef,
    togglePosition = 'end',
    toggleAriaLabel: toggleAriaLabelProp,
    toggleTabIndex,
    disabled = false,
    children,
    ...primaryProps
  }: CgSplitButtonProps<TData>,
  forwardedRef: ForwardedRef<HTMLButtonElement>,
) {
  const uiText = useCgUiText();
  const menuAriaLabel = menuAriaLabelProp ?? uiText.translate('Button menu');
  const toggleAriaLabel = toggleAriaLabelProp ?? uiText.translate('Open menu');
  const rootRef = useRef<HTMLSpanElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [actualOpen, setActualOpen] = useControllableState(open, defaultOpen, 'CgSplitButton open');
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
    show: () => { setOpenFocus('first'); requestOpen(true); }, hide: () => requestOpen(false), toggle: () => { setOpenFocus('first'); requestOpen(!actualOpen); }, focus: () => primaryRef.current?.focus(),
  }), [actualOpen, requestOpen]);
  const onToggleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!canShow || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    setOpenFocus(event.key === 'ArrowUp' ? 'last' : 'first');
    if (!actualOpen) requestOpen(true);
  };
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
    onClick={() => { setOpenFocus('first'); requestOpen(!actualOpen); }}
    onKeyDown={onToggleKeyDown}
  >{toggleIcon !== undefined ? <span className={styles.chevron} aria-hidden="true">{toggleIcon}</span> : '▾'}</CgButton>;
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

export const CgSplitButton = forwardRef(CgSplitButtonInner) as <TData = unknown>(
  props: CgSplitButtonProps<TData> & RefAttributes<HTMLButtonElement>,
) => ReactElement | null;
