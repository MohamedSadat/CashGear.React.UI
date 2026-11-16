import { forwardRef, isValidElement, useId, useLayoutEffect, useRef } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { useMergedRefs } from '../../hooks';
import type { CgIconName } from '../../types';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import styles from './CgMenuPanel.module.css';
import type { CgMenuPanelGroupProps, CgMenuPanelHeaderProps, CgMenuPanelItemProps, CgMenuPanelProps, CgMenuPanelSwitchProps } from './CgMenuPanel.types';

const ITEMS = '[role="menuitem"]:not(:disabled),[role="menuitemradio"]:not(:disabled),[role="menuitemcheckbox"]:not(:disabled)';
const FIELDS = 'input:not(:disabled):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),select:not(:disabled)';
const ICON_NAME = /^[a-z][a-z0-9-]*$/u;

function drawIcon(icon: unknown): ReactNode {
  if (icon === undefined || icon === null || icon === false) return null;
  if (typeof icon === 'string' && ICON_NAME.test(icon)) return <CgIcon name={icon as CgIconName} />;
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') return icon;
  return null;
}

/** Gives the focused item, else the first, the menu's one tab stop. */
function rove(menu: HTMLElement, current?: HTMLElement) {
  const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)];
  const stop = current && items.includes(current) ? current : items[0];
  for (const item of items) item.tabIndex = item === stop ? 0 : -1;
}

/**
 * A menu surface that also holds fields, switches and panels, as a property or view menu does.
 * Focus moves with the arrows, Home and End; Enter or Space activates the focused item.
 */
export const CgMenuPanel = forwardRef<HTMLDivElement, CgMenuPanelProps>(function CgMenuPanel(
  { label, children, header, fields, footer, onEscape, className, onKeyDown, ...nativeProps },
  forwardedRef,
) {
  if (!label.trim()) throw new Error('CgMenuPanel label cannot be empty.');
  const panelRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(panelRef, forwardedRef);
  useLayoutEffect(() => { if (menuRef.current) rove(menuRef.current, document.activeElement as HTMLElement); });

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape' && onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(); return; }
    const menu = menuRef.current;
    const panel = panelRef.current;
    if (!menu || !panel || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...menu.querySelectorAll<HTMLElement>(ITEMS)];
    const target = event.target as HTMLElement;
    const fieldList = [...panel.querySelectorAll<HTMLElement>(FIELDS)].filter((field) => !menu.contains(field));
    if (fieldList.includes(target)) {
      if (event.key !== 'ArrowDown' || !items.length) return;
      event.preventDefault();
      items[0]!.focus();
      return;
    }
    const at = items.indexOf(target);
    if (at < 0 || !items.length) return;
    event.preventDefault();
    if (event.key === 'ArrowUp' && at === 0 && fieldList.length) { fieldList[fieldList.length - 1]!.focus(); return; }
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (at + 1) % items.length
          : (at - 1 + items.length) % items.length;
    items[next]!.focus();
  };

  return <div {...nativeProps} ref={ref} className={cx(styles.panel, className)} onKeyDown={keys} data-cg-menu-panel="">
    {header}
    {fields !== undefined && fields !== null && fields !== false ? <div className={styles.fields}>{fields}</div> : null}
    <div ref={menuRef} role="menu" aria-label={label} className={styles.menu} onFocus={(event: FocusEvent<HTMLDivElement>) => rove(event.currentTarget, event.target)}>{children}</div>
    {footer}
  </div>;
});

export const CgMenuPanelItem = forwardRef<HTMLButtonElement, CgMenuPanelItemProps>(function CgMenuPanelItem(
  { children, onSelect, icon, hint, danger = false, disabled = false, checked, checkable = 'radio', opensPanel = false, initialFocus = false, className, ...nativeProps },
  forwardedRef,
) {
  const role = checked === undefined ? 'menuitem' : checkable === 'checkbox' ? 'menuitemcheckbox' : 'menuitemradio';
  return <button
    {...nativeProps}
    ref={forwardedRef}
    type="button"
    role={role}
    aria-checked={checked}
    aria-haspopup={opensPanel ? 'menu' : undefined}
    tabIndex={-1}
    disabled={disabled}
    data-cg-initial-focus={initialFocus ? '' : undefined}
    className={cx(styles.item, danger && styles.danger, className)}
    onClick={onSelect}
  >
    <span className={styles.icon} aria-hidden="true">{checked ? <CgIcon name="check" /> : drawIcon(icon)}</span>
    <span className={styles.text}>{children}</span>
    {hint !== undefined ? <span className={styles.hint}>{hint}</span> : null}
    {opensPanel ? <span className={styles.chevron} aria-hidden="true"><CgIcon name="chevron-end" /></span> : null}
  </button>;
});

export const CgMenuPanelSwitch = forwardRef<HTMLButtonElement, CgMenuPanelSwitchProps>(function CgMenuPanelSwitch(
  { children, checked, onCheckedChange, icon, disabled = false, initialFocus = false, className, ...nativeProps },
  forwardedRef,
) {
  return <button
    {...nativeProps}
    ref={forwardedRef}
    type="button"
    role="menuitemcheckbox"
    aria-checked={checked}
    tabIndex={-1}
    disabled={disabled}
    data-cg-initial-focus={initialFocus ? '' : undefined}
    className={cx(styles.item, className)}
    onClick={(event) => onCheckedChange(!checked, event)}
  >
    <span className={styles.icon} aria-hidden="true">{drawIcon(icon)}</span>
    <span className={styles.text}>{children}</span>
    <span className={styles.switch} data-checked={checked ? '' : undefined} aria-hidden="true"><span className={styles.thumb} /></span>
  </button>;
});

export function CgMenuPanelSeparator() {
  return <div role="separator" className={styles.separator} />;
}

export function CgMenuPanelGroup({ label, children }: CgMenuPanelGroupProps) {
  const id = useId();
  return <div role="group" aria-labelledby={id} className={styles.group}>
    <div id={id} role="presentation" className={styles.groupLabel}>{label}</div>
    {children}
  </div>;
}

export function CgMenuPanelHeader({ title, onBack, backLabel }: CgMenuPanelHeaderProps) {
  if (onBack && !backLabel?.trim()) throw new Error('CgMenuPanelHeader backLabel is required with onBack.');
  return <div className={styles.header}>
    {onBack ? <button type="button" className={styles.back} aria-label={backLabel} title={backLabel} onClick={onBack}><CgIcon name="chevron-start" /></button> : null}
    <span className={styles.title}>{title}</span>
  </div>;
}
