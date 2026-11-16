import { forwardRef, isValidElement, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useCgId, useControllableState } from '../../hooks';
import { cx } from '../../utils';
import { CgFlyout } from '../Flyout';
import type { CgFlyoutOpenChangeDetails } from '../Flyout';
import { CgIcon } from '../Icon';
import type { CgIconName } from '../../types';
import styles from './CgCommandMenu.module.css';
import type { CgCommandMenuHandle, CgCommandMenuItem, CgCommandMenuKey, CgCommandMenuProps } from './CgCommandMenu.types';
import { commandMatches, groupCommands } from './commandFilter';

const ICON_NAME = /^[a-z][a-z0-9-]*$/u;
const PAGE = 8;
const ALL_KEYS: readonly CgCommandMenuKey[] = ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Enter', 'Tab', 'Escape'];

function drawIcon(icon: CgCommandMenuItem['icon']): ReactNode {
  if (icon === undefined || icon === null || icon === false) return null;
  if (typeof icon === 'string' && ICON_NAME.test(icon)) return <CgIcon name={icon as CgIconName} />;
  if (isValidElement(icon) || typeof icon === 'string' || typeof icon === 'number') return icon;
  return null;
}

function CgCommandMenuInner<TData>(
  {
    items,
    label,
    emptyText,
    onSelect,
    query: queryProp,
    defaultQuery = '',
    onQueryChange,
    filter,
    searchable = false,
    searchLabel,
    searchPlaceholder,
    anchor,
    open = true,
    onDismiss,
    loading = false,
    loadingText,
    selectOnTab = false,
    handledKeys = ALL_KEYS,
    onActiveDescendantChange,
    renderItem,
    maxHeight = '20rem',
    width = '20rem',
    locale,
    onOptionMouseDown,
    id,
    className,
    style,
    ...nativeProps
  }: CgCommandMenuProps<TData>,
  forwardedRef: ForwardedRef<CgCommandMenuHandle>,
) {
  if (!label.trim()) throw new Error('CgCommandMenu label cannot be empty.');
  if (searchable && !searchLabel?.trim()) throw new Error('CgCommandMenu searchLabel is required when searchable.');
  const baseId = useCgId(id);
  const listId = `${baseId}-list`;
  const [query, setQuery] = useControllableState(queryProp, defaultQuery, 'CgCommandMenu query');
  const visible = useMemo(() => {
    if (filter === false) return items;
    const matches = filter ?? ((item: CgCommandMenuItem<TData>, text: string) => commandMatches(item, text, locale));
    return items.filter((item) => matches(item, query));
  }, [filter, items, locale, query]);
  const { groups, flat } = useMemo(() => groupCommands(visible), [visible]);

  // The active option, kept for the query it was chosen under: a new query starts at the first.
  const [chosen, setChosen] = useState<{ query: string; key: string } | undefined>(undefined);
  const enabledIndexes = useMemo(() => flat.flatMap((item, index) => (item.disabled ? [] : [index])), [flat]);
  const chosenIndex = chosen && chosen.query === query ? flat.findIndex((item) => item.key === chosen.key && !item.disabled) : -1;
  const activeIndex = chosenIndex >= 0 ? chosenIndex : (enabledIndexes[0] ?? -1);
  const activeItem = activeIndex >= 0 ? flat[activeIndex] : undefined;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const activeId = activeItem ? optionId(activeIndex) : undefined;

  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingEnterRef = useRef(false);
  const stateRef = useRef({ flat, enabledIndexes, activeIndex, activeItem, loading, query });
  useLayoutEffect(() => { stateRef.current = { flat, enabledIndexes, activeIndex, activeItem, loading, query }; });

  useEffect(() => { onActiveDescendantChange?.(open ? activeId : undefined); }, [activeId, onActiveDescendantChange, open]);
  useEffect(() => {
    if (activeId) listRef.current?.querySelector(`#${CSS.escape(activeId)}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const select = (item: CgCommandMenuItem<TData> | undefined, source: 'keyboard' | 'pointer') => {
    if (!item || item.disabled) return;
    pendingEnterRef.current = false;
    onSelect(item, Object.freeze({ source }));
  };
  // Enter pressed while results were coming acts once they are in.
  useEffect(() => {
    if (!loading && pendingEnterRef.current) select(activeItem, 'keyboard');
  });

  const activate = (index: number) => {
    const item = stateRef.current.flat[index];
    if (item) setChosen({ query: stateRef.current.query, key: item.key });
  };
  const move = (delta: number, wrap = true) => {
    const { enabledIndexes: enabled, activeIndex: current } = stateRef.current;
    if (!enabled.length) return;
    const at = Math.max(0, enabled.indexOf(current));
    const count = enabled.length;
    const next = wrap ? (((at + delta) % count) + count) % count : Math.min(count - 1, Math.max(0, at + delta));
    activate(enabled[next]!);
  };

  const handleKeyDown = (event: KeyboardEvent | ReactKeyboardEvent): boolean => {
    const native = 'nativeEvent' in event ? event.nativeEvent : event;
    if (native.isComposing || native.keyCode === 229) return false;
    const { enabledIndexes: enabled, activeItem: item, loading: busy } = stateRef.current;
    let used = true;
    if (!handledKeys.includes(event.key as CgCommandMenuKey)) return false;
    switch (event.key) {
      case 'ArrowDown': move(1); break;
      case 'ArrowUp': move(-1); break;
      case 'Home': if (enabled.length) activate(enabled[0]!); else used = false; break;
      case 'End': if (enabled.length) activate(enabled[enabled.length - 1]!); else used = false; break;
      case 'PageDown': move(PAGE, false); break;
      case 'PageUp': move(-PAGE, false); break;
      case 'Enter':
        if (busy) pendingEnterRef.current = true;
        else if (item) select(item, 'keyboard');
        else used = false;
        break;
      case 'Tab':
        if (selectOnTab && item && !busy && !event.shiftKey) select(item, 'keyboard');
        else used = false;
        break;
      case 'Escape':
        if (onDismiss) onDismiss('escape');
        else used = false;
        break;
      default: used = false;
    }
    if (used) event.preventDefault();
    return used;
  };

  useImperativeHandle(forwardedRef, () => ({
    handleKeyDown,
    get activeDescendantId() {
      const { activeIndex: index } = stateRef.current;
      return index >= 0 ? optionId(index) : undefined;
    },
    move: (delta: number) => move(delta),
    selectActive: () => select(stateRef.current.activeItem, 'keyboard'),
    focus: () => searchRef.current?.focus({ preventScroll: true }),
  }));

  const option = (item: CgCommandMenuItem<TData>, index: number) => {
    const active = index === activeIndex;
    const icon = drawIcon(item.icon);
    const defaultContent = <>
      <span className={styles.icon} aria-hidden="true">{icon}</span>
      <span className={styles.text}>
        <span className={styles.label} dir="auto">{item.label}</span>
        {item.detail ? <span className={styles.detail} dir="auto">{item.detail}</span> : null}
      </span>
      {item.shortcut ? <kbd className={styles.shortcut} dir="ltr">{item.shortcut}</kbd> : null}
    </>;
    return <div
      key={item.key}
      id={optionId(index)}
      role="option"
      aria-selected={active}
      aria-disabled={item.disabled || undefined}
      className={cx(styles.option, active && styles.active)}
      data-cg-command-key={item.key}
      onMouseMove={() => { if (!active && !item.disabled) activate(index); }}
      onMouseDown={(event) => { event.preventDefault(); onOptionMouseDown?.(item, event); }}
      onClick={() => select(item, 'pointer')}
    >{renderItem ? renderItem({ item, active, defaultContent }) : defaultContent}</div>;
  };

  const empty = flat.length === 0;
  const listbox = empty ? null : <div ref={listRef} id={listId} role="listbox" aria-label={label} className={styles.list} style={{ maxBlockSize: maxHeight }} onMouseDown={(event) => event.preventDefault()}>
    {groups.map((group, groupIndex) => group.name === undefined
      ? group.items.map(({ item, index }) => option(item, index))
      : <div key={`group-${groupIndex}`} role="group" aria-labelledby={`${baseId}-group-${groupIndex}`} className={styles.group}>
          <div id={`${baseId}-group-${groupIndex}`} role="presentation" className={styles.groupLabel}>{group.name}</div>
          {group.items.map(({ item, index }) => option(item, index))}
        </div>)}
  </div>;
  const status = empty ? <div className={styles.empty} role="status">{loading && loadingText !== undefined ? loadingText : emptyText}</div> : null;
  const search = searchable ? <input
    ref={searchRef}
    className={styles.search}
    type="text"
    role="combobox"
    aria-label={searchLabel}
    aria-expanded={!empty}
    aria-controls={empty ? undefined : listId}
    aria-activedescendant={activeId}
    aria-autocomplete="list"
    aria-busy={loading || undefined}
    placeholder={searchPlaceholder}
    autoComplete="off"
    spellCheck={false}
    dir="auto"
    value={query}
    onChange={(event) => { const next = event.currentTarget.value; setQuery(next); onQueryChange?.(next); }}
    onKeyDown={(event) => { handleKeyDown(event); }}
  /> : null;

  const body = <div {...nativeProps} className={cx(styles.root, anchor !== undefined && styles.floating, className)} style={style} data-cg-command-menu="">
    {search}
    {listbox}
    {status}
  </div>;

  if (anchor === undefined) return body;
  return <CgFlyout
    anchor={anchor}
    open={open}
    onOpenChange={(next: boolean, details: CgFlyoutOpenChangeDetails) => {
      if (!next && details.reason === 'outsideClick') onDismiss?.('outsideClick');
    }}
    closeOnEscape={false}
    placement="bottom-start"
    width={width}
    maxHeight="none"
    scrollable={false}
    className={styles.flyout}
  >{body}</CgFlyout>;
}

export const CgCommandMenu = forwardRef(CgCommandMenuInner) as <TData = unknown>(
  props: CgCommandMenuProps<TData> & RefAttributes<CgCommandMenuHandle>,
) => ReactElement | null;
