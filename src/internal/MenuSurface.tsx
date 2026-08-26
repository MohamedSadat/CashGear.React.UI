/* eslint-disable react-hooks/refs -- Stable DOM refs are read only inside event callbacks and cleanup. */
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { CgFlyout } from '../components/Flyout/CgFlyout';
import type { CgFlyoutPlacement } from '../components/Flyout/CgFlyout.types';
import { useCgId } from '../hooks';
import { cx } from '../utils';
import { renderIcon } from './icons';
import { enabledMenuItems, findTypeaheadItem } from './menuNavigation';
import type { MenuActivationSource, MenuNode, MenuRenderContext } from './menuTypes';
import styles from './MenuSurface.module.css';

export interface MenuSurfaceProps<TData = unknown> {
  items: ReadonlyArray<MenuNode<TData>>;
  ariaLabel?: string;
  direction?: 'ltr' | 'rtl';
  expandedKeys: ReadonlySet<string>;
  onExpandedKeysChange: (keys: ReadonlySet<string>) => void;
  onActivate: (
    item: MenuNode<TData>,
    source: MenuActivationSource,
    event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>,
  ) => void | PromiseLike<void>;
  renderItem?: (context: MenuRenderContext<TData>) => ReactNode;
  renderText?: (context: MenuRenderContext<TData>) => ReactNode;
  renderSubmenu?: (context: { parent: MenuNode<TData>; level: number; childContent: ReactNode }) => ReactNode;
  submenuTrigger?: 'click' | 'hover';
  openDelay?: number;
  closeDelay?: number;
  busyKey?: string;
  locale?: string;
  typeaheadEnabled?: boolean;
  disabled?: boolean;
  placement?: CgFlyoutPlacement;
  level?: number;
  parentKey?: string;
  onCloseCurrent?: () => void;
  onCloseRoot?: (reason: 'escape' | 'tab') => void;
  onActiveKeyChange?: (key: string) => void;
  className?: string;
  selectedKey?: string;
  iconOnlyKeys?: ReadonlySet<string>;
  semantic?: 'application' | 'navigation';
  rootMenubar?: boolean;
  rootOrientation?: 'horizontal' | 'vertical';
  scopeId?: string;
  onPointerEnterSurface?: () => void;
  onPointerLeaveSurface?: () => void;
}

export function MenuSurface<TData>({
  items,
  ariaLabel,
  direction = 'ltr',
  expandedKeys,
  onExpandedKeysChange,
  onActivate,
  renderItem,
  renderText,
  renderSubmenu,
  submenuTrigger = 'click',
  openDelay = 150,
  closeDelay = 250,
  busyKey,
  locale,
  typeaheadEnabled = true,
  disabled = false,
  placement,
  level = 0,
  parentKey,
  onCloseCurrent,
  onCloseRoot,
  onActiveKeyChange,
  className,
  selectedKey,
  iconOnlyKeys,
  semantic = 'application',
  rootMenubar = false,
  rootOrientation = 'vertical',
  scopeId,
  onPointerEnterSurface,
  onPointerLeaveSurface,
}: MenuSurfaceProps<TData>) {
  const usable = enabledMenuItems(items);
  const [activeKey, setActiveKey] = useState<string | undefined>(usable[0]?.key);
  const surfaceRef = useRef<HTMLUListElement>(null);
  const surfaceId = useCgId();
  const generatedScopeId = useCgId();
  const resolvedScopeId = scopeId ?? generatedScopeId;
  const typeahead = useRef<{ value: string; timer?: ReturnType<typeof setTimeout> }>({ value: '' });
  const hoverTimers = useRef(new Map<string, Partial<Record<'open' | 'close', ReturnType<typeof setTimeout>>>>());
  const effectiveActiveKey = usable.some((node) => node.key === activeKey) ? activeKey : usable[0]?.key;
  useEffect(() => () => {
    hoverTimers.current.forEach((entry) => {
      if (entry.open) clearTimeout(entry.open);
      if (entry.close) clearTimeout(entry.close);
    });
    if (typeahead.current.timer) clearTimeout(typeahead.current.timer);
  }, []);

  const focus = (key: string | undefined) => {
    if (!key) return;
    setActiveKey(key);
    onActiveKeyChange?.(key);
    const target = Array.from(surfaceRef.current?.querySelectorAll<HTMLElement>('[data-cg-menu-key]') ?? [])
      .find((element) => element.dataset.cgMenuKey === key);
    target?.focus({ preventScroll: true });
  };
  const setExpanded = (key: string, value: boolean) => {
    const next = new Set(expandedKeys);
    if (value) next.add(key);
    else {
      next.delete(key);
      const removeDescendants = (nodes: ReadonlyArray<MenuNode<TData>>, removing: boolean) => {
        for (const node of nodes) {
          const childRemoving = removing || node.key === key;
          if (childRemoving) next.delete(node.key);
          removeDescendants(node.children, childRemoving);
        }
      };
      removeDescendants(items, false);
    }
    onExpandedKeysChange(next);
  };
  const cancelHover = (key: string, kind: 'open' | 'close') => {
    const entry = hoverTimers.current.get(key);
    const timer = entry?.[kind];
    if (timer) clearTimeout(timer);
    if (!entry) return;
    delete entry[kind];
    if (!entry.open && !entry.close) hoverTimers.current.delete(key);
  };
  const delayed = (key: string, kind: 'open' | 'close', callback: () => void, milliseconds: number) => {
    cancelHover(key, kind);
    const entry = hoverTimers.current.get(key) ?? {};
    entry[kind] = setTimeout(() => {
      const current = hoverTimers.current.get(key);
      if (current) {
        delete current[kind];
        if (!current.open && !current.close) hoverTimers.current.delete(key);
      }
      callback();
    }, milliseconds);
    hoverTimers.current.set(key, entry);
  };
  const activate = (node: MenuNode<TData>, source: MenuActivationSource, event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (disabled || node.disabled || node.separator || busyKey !== undefined) return;
    if (node.children.length > 0 && !node.href && !node.onActivate) {
      setExpanded(node.key, !expandedKeys.has(node.key));
      return;
    }
    void onActivate(node, source, event);
  };
  const move = (amount: number) => {
    if (usable.length === 0) return;
    const index = usable.findIndex((node) => node.key === effectiveActiveKey);
    focus(usable[(Math.max(0, index) + amount + usable.length) % usable.length]?.key);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, node: MenuNode<TData>) => {
    const openKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const closeKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    const nextRootKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const previousRootKey = direction === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    if (rootMenubar && event.key === nextRootKey) { event.preventDefault(); move(1); }
    else if (rootMenubar && event.key === previousRootKey) { event.preventDefault(); move(-1); }
    else if (rootMenubar && event.key === 'ArrowDown' && node.children.length > 0) {
      event.preventDefault(); setExpanded(node.key, true);
      queueMicrotask(() => {
        const child = Array.from(document.querySelectorAll<HTMLElement>('[data-cg-menu-parent]'))
          .find((element) => element.dataset.cgMenuScope === resolvedScopeId && element.dataset.cgMenuParent === node.key);
        child?.querySelector<HTMLElement>('[role^="menuitem"],a,button')?.focus();
      });
    } else if (!rootMenubar && event.key === 'ArrowDown') { event.preventDefault(); move(1); }
    else if (!rootMenubar && event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
    else if (event.key === 'Home') { event.preventDefault(); focus(usable[0]?.key); }
    else if (event.key === 'End') { event.preventDefault(); focus(usable.at(-1)?.key); }
    else if (!rootMenubar && event.key === openKey && node.children.length > 0) {
      event.preventDefault(); setExpanded(node.key, true);
      queueMicrotask(() => {
        const child = Array.from(document.querySelectorAll<HTMLElement>('[data-cg-menu-parent]'))
          .find((element) => element.dataset.cgMenuScope === resolvedScopeId && element.dataset.cgMenuParent === node.key);
        child?.querySelector<HTMLElement>('[role^="menuitem"],a,button')?.focus();
      });
    } else if (event.key === closeKey && onCloseCurrent) {
      event.preventDefault(); onCloseCurrent();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); activate(node, 'keyboard', event);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const open = items.find((item) => expandedKeys.has(item.key));
      if (open) setExpanded(open.key, false);
      else if (onCloseCurrent) onCloseCurrent();
      else onCloseRoot?.('escape');
    } else if (event.key === 'Tab') {
      onCloseRoot?.('tab');
    } else if (typeaheadEnabled && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeahead.current.value += event.key;
      if (typeahead.current.timer) clearTimeout(typeahead.current.timer);
      typeahead.current.timer = setTimeout(() => { typeahead.current.value = ''; }, 700);
      const match = findTypeaheadItem(items, typeahead.current.value, locale, effectiveActiveKey);
      if (match) { event.preventDefault(); focus(match.key); }
    }
  };

  return (
    <ul
      ref={surfaceRef}
      role={semantic === 'navigation' ? undefined : level === 0 && rootMenubar ? 'menubar' : 'menu'}
      aria-label={ariaLabel}
      aria-orientation={semantic === 'navigation' ? undefined : rootMenubar ? rootOrientation : 'vertical'}
      data-cg-menu-parent={parentKey}
      data-cg-menu-scope={resolvedScopeId}
      className={cx(styles.menu, className)}
      dir={direction}
      onPointerEnter={onPointerEnterSurface}
      onPointerLeave={onPointerLeaveSurface}
    >
      {items.map((node) => {
        if (node.separator) return <li key={node.key} role={semantic === 'navigation' ? undefined : 'separator'} aria-hidden={semantic === 'navigation' || undefined} className={styles.separator} />;
        const expanded = expandedKeys.has(node.key);
        const active = effectiveActiveKey === node.key;
        const busy = busyKey === node.key;
        const selected = selectedKey === node.key;
        const iconOnly = iconOnlyKeys?.has(node.key) === true;
        const anchorId = `${surfaceId}-${node.sourceIndex}`;
        const role = node.radioGroup ? 'menuitemradio' : node.checked !== undefined ? 'menuitemcheckbox' : 'menuitem';
        const textContext: MenuRenderContext<TData> = { item: node, active, expanded, busy, level, defaultContent: node.text };
        const defaultContent = <>
          <span className={styles.check} aria-hidden="true">{node.checked ? '✓' : node.icon ? <span className={styles.icon}>{renderIcon(node.icon)}</span> : ''}</span>
          <span className={cx(styles.text, iconOnly && styles.srOnly)}>{renderText?.(textContext) ?? node.text}</span>
          <span className={styles.meta}>{node.shortcut}{node.badge !== undefined ? <span className={styles.badge}>{node.badge}</span> : null}</span>
          {node.children.length > 0 ? <span className={styles.arrow} aria-hidden="true">{direction === 'rtl' ? '‹' : '›'}</span> : null}
        </>;
        const common = {
          id: anchorId,
          role: semantic === 'navigation' ? undefined : role,
          tabIndex: active ? 0 : -1,
          title: node.tooltip,
          'aria-disabled': node.disabled || disabled || undefined,
          'aria-busy': busy || undefined,
          'aria-haspopup': node.children.length > 0 ? 'menu' as const : undefined,
          'aria-expanded': node.children.length > 0 ? expanded : undefined,
          'aria-controls': node.children.length > 0 ? `${anchorId}-submenu` : undefined,
          'aria-checked': node.checked,
          'aria-current': semantic === 'navigation' && selected ? 'page' as const : undefined,
          'data-selected': selected || undefined,
          'data-cg-menu-key': node.key,
          'data-cg-menu-scope': resolvedScopeId,
          className: cx(styles.item, active && styles.active, selected && styles.selected, node.disabled && styles.disabled, busy && styles.busy, node.intent === 'danger' && styles.danger, node.className),
          onFocus: () => { setActiveKey(node.key); onActiveKeyChange?.(node.key); },
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => handleKeyDown(event, node),
          onPointerEnter: () => {
            setActiveKey(node.key);
            if (submenuTrigger === 'hover' && node.children.length > 0) {
              cancelHover(node.key, 'close');
              delayed(node.key, 'open', () => setExpanded(node.key, true), openDelay);
            }
          },
          onPointerLeave: () => {
            if (submenuTrigger === 'hover' && node.children.length > 0) {
              cancelHover(node.key, 'open');
              delayed(node.key, 'close', () => setExpanded(node.key, false), closeDelay);
            }
          },
        };
        const content = renderItem?.({ item: node, active, expanded, busy, level, defaultContent }) ?? defaultContent;
        const childContent = node.children.length > 0 ? (
          <MenuSurface
            items={node.children}
            direction={direction}
            expandedKeys={expandedKeys}
            onExpandedKeysChange={onExpandedKeysChange}
            onActivate={onActivate}
            renderItem={renderItem}
            renderText={renderText}
            renderSubmenu={renderSubmenu}
            submenuTrigger={submenuTrigger}
            openDelay={openDelay}
            closeDelay={closeDelay}
            busyKey={busyKey}
            locale={locale}
            typeaheadEnabled={typeaheadEnabled}
            disabled={disabled}
            level={level + 1}
            parentKey={node.key}
            onCloseCurrent={() => { setExpanded(node.key, false); focus(node.key); }}
            onCloseRoot={onCloseRoot}
            selectedKey={selectedKey}
            iconOnlyKeys={iconOnlyKeys}
            semantic={semantic}
            scopeId={resolvedScopeId}
            onPointerEnterSurface={() => cancelHover(node.key, 'close')}
            onPointerLeaveSurface={() => delayed(node.key, 'close', () => setExpanded(node.key, false), closeDelay)}
          />
        ) : null;
        return <li key={node.key} role={semantic === 'navigation' ? undefined : 'none'}>
          {node.href ? (
            <a
              {...common}
              className={cx(common.className, styles.link)}
              href={node.href}
              target={node.target}
              onClick={(event) => { if (node.disabled || disabled) event.preventDefault(); else activate(node, 'pointer', event); }}
            >{content}</a>
          ) : (
            <button
              {...common}
              type="button"
              disabled={node.disabled || disabled}
              onClick={(event) => activate(node, 'pointer', event)}
            >{content}</button>
          )}
              {node.children.length > 0 ? (
            <CgFlyout
              id={`${anchorId}-submenu`}
              anchor={`#${anchorId}`}
              open={expanded}
              onOpenChange={(open) => { if (!open && expanded) setExpanded(node.key, false); }}
              placement={placement ?? (direction === 'rtl' ? 'left-start' : 'right-start')}
              closeOnOutsideClick={false}
              closeOnEscape={false}
              closeOnScroll={false}
              minWidth="12rem"
              maxWidth="24rem"
              maxHeight="min(24rem, calc(100vh - 8px))"
            >
              {renderSubmenu?.({ parent: node, level: level + 1, childContent }) ?? childContent}
            </CgFlyout>
          ) : null}
        </li>;
      })}
    </ul>
  );
}
