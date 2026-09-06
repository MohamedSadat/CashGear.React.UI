import { forwardRef, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactElement, RefAttributes } from 'react';
import { useControllableState, useDirection, useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import { CgButton } from '../Button';
import styles from './CgButtonGroup.module.css';
import type {
  CgButtonGroupItem,
  CgButtonGroupItemActivationDetails,
  CgButtonGroupProps,
} from './CgButtonGroup.types';

function normalizeItems<TData>(items: ReadonlyArray<CgButtonGroupItem<TData>>): ReadonlyArray<CgButtonGroupItem<TData>> {
  const names = new Set<string>();
  return Object.freeze(items.map((item) => {
    const name = item.name.trim();
    if (!name) throw new Error('CgButtonGroup items require a non-empty name.');
    if (names.has(name)) throw new Error(`CgButtonGroup contains duplicate name '${name}'.`);
    const hasExplicitName = Boolean(item.ariaLabel?.trim() || item.title?.trim());
    if ((item.render !== undefined && !hasExplicitName) || (item.text == null && !hasExplicitName)) {
      throw new Error(`CgButtonGroup item '${name}' requires an accessible text, ariaLabel, or title.`);
    }
    names.add(name);
    return Object.freeze({ ...item, name });
  }));
}

function CgButtonGroupInner<TData>(props: CgButtonGroupProps<TData>, forwardedRef: React.ForwardedRef<HTMLDivElement>) {
  type SelectionBindings = {
    selectedName?: string | null;
    defaultSelectedName?: string | null;
    onSelectedNameChange?: Extract<CgButtonGroupProps<TData>, { selectionMode: 'single' }>['onSelectedNameChange'];
    selectedNames?: ReadonlyArray<string>;
    defaultSelectedNames?: ReadonlyArray<string>;
    onSelectedNamesChange?: Extract<CgButtonGroupProps<TData>, { selectionMode: 'multiple' }>['onSelectedNamesChange'];
  };
  const {
    items: itemProps,
    selectionMode = 'none',
    selectedName,
    defaultSelectedName,
    onSelectedNameChange,
    selectedNames,
    defaultSelectedNames,
    onSelectedNamesChange,
    orientation = 'horizontal',
    disabled = false,
    size = 'medium',
    defaultItemIntent = 'secondary',
    defaultItemAppearance = 'outline',
    direction = 'auto',
    ariaLabel = 'Actions',
    onItemClick,
    onItemError,
    className,
    onKeyDown,
    ...nativeProps
  } = props as CgButtonGroupProps<TData> & SelectionBindings;
  const items = useMemo(() => normalizeItems(itemProps), [itemProps]);
  const [single, setSingle] = useControllableState(
    selectionMode === 'single' ? selectedName : undefined,
    selectionMode === 'single' ? defaultSelectedName ?? null : null,
    'CgButtonGroup',
  );
  const [multiple, setMultiple] = useControllableState<ReadonlyArray<string>>(
    selectionMode === 'multiple' ? selectedNames : undefined,
    selectionMode === 'multiple' ? Object.freeze([...(defaultSelectedNames ?? [])]) : Object.freeze([]),
    'CgButtonGroup',
  );
  const [automaticBusy, setAutomaticBusy] = useState<ReadonlySet<string>>(() => new Set());
  const running = useRef(new Set<string>());
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const resolvedDirection = useDirection(rootRef, direction);
  const selected = (name: string) => selectionMode === 'single' ? single === name : selectionMode === 'multiple' && multiple.includes(name);
  const eligible = useMemo(
    () => items.filter((item) => item.visible !== false && !disabled && !item.disabled && !item.loading && !automaticBusy.has(item.name)),
    [automaticBusy, disabled, items],
  );
  const preferred = eligible.find((item) => selected(item.name))?.name ?? eligible[0]?.name ?? null;
  const [activeName, setActiveName] = useState<string | null>(preferred);
  const resolvedActiveName = eligible.some((item) => item.name === activeName) ? activeName : preferred;

  const activate = useStableCallback(async (item: CgButtonGroupItem<TData>, event: MouseEvent<HTMLButtonElement>) => {
    if (disabled || item.disabled || item.visible === false || item.loading || automaticBusy.has(item.name)) return;
    if (item.suppressDuplicateClicks !== false && running.current.has(item.name)) return;
    const details: CgButtonGroupItemActivationDetails<TData> = Object.freeze({
      item,
      name: item.name,
      source: event.detail === 0 ? 'keyboard' : 'pointer',
      event,
    });
    running.current.add(item.name);
    if (item.autoLoading) setAutomaticBusy((current) => new Set(current).add(item.name));
    try {
      await item.onClick?.(details);
      await onItemClick?.(details);
      if (selectionMode === 'single' && single !== item.name) {
        setSingle(item.name);
        onSelectedNameChange?.(item.name, Object.freeze({ ...details, previousName: single }));
      } else if (selectionMode === 'multiple') {
        const next = Object.freeze(multiple.includes(item.name)
          ? multiple.filter((name) => name !== item.name)
          : [...multiple, item.name]);
        setMultiple(next);
        onSelectedNamesChange?.(next, Object.freeze({ ...details, previousNames: Object.freeze([...multiple]) }));
      }
    } catch (error) {
      onItemError?.(error, details);
    } finally {
      running.current.delete(item.name);
      if (item.autoLoading) setAutomaticBusy((current) => {
        const next = new Set(current);
        next.delete(item.name);
        return next;
      });
    }
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof HTMLButtonElement ? event.target : null;
    if (!target) return;
    const current = eligible.findIndex((item) => buttons.current.get(item.name) === target);
    if (current < 0) return;
    let next: number | undefined;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = eligible.length - 1;
    else if (orientation === 'vertical' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) next = current + (event.key === 'ArrowDown' ? 1 : -1);
    else if (orientation === 'horizontal' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      next = current + ((event.key === 'ArrowRight') !== (resolvedDirection === 'rtl') ? 1 : -1);
    }
    if (next === undefined || eligible.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const item = eligible[(next + eligible.length) % eligible.length];
    if (!item) return;
    setActiveName(item.name);
    const button = buttons.current.get(item.name);
    button?.focus();
    if (selectionMode === 'single') button?.click();
  };

  return <div
    {...nativeProps}
    ref={mergedRef}
    className={cx(styles.root, className)}
    dir={direction === 'auto' ? undefined : resolvedDirection}
    role={selectionMode === 'single' ? 'radiogroup' : 'group'}
    aria-label={ariaLabel}
    aria-orientation={selectionMode === 'single' ? orientation : undefined}
    data-orientation={orientation}
    data-cg-button-group=""
    onKeyDown={handleKeyDown}
  >
    {items.filter((item) => item.visible !== false).map((item) => {
      const isSelected = selected(item.name);
      const isLoading = item.loading === true || automaticBusy.has(item.name);
      const defaultContent = item.text ?? item.ariaLabel ?? item.title ?? item.name;
      const content = item.render?.({ item, selected: isSelected, loading: isLoading, defaultContent }) ?? defaultContent;
      return <CgButton
        key={item.name}
        ref={(element) => { if (element) buttons.current.set(item.name, element); else buttons.current.delete(item.name); }}
        className={cx(styles.button, isSelected && styles.selected, item.className)}
        intent={item.intent ?? defaultItemIntent}
        appearance={item.appearance ?? defaultItemAppearance}
        size={size}
        icon={item.icon}
        loading={isLoading}
        autoLoading={false}
        suppressDuplicateClicks={item.suppressDuplicateClicks !== false}
        loadingContent={item.loadingContent}
        disabled={disabled || item.disabled}
        type={item.type ?? 'button'}
        title={item.title}
        aria-label={item.ariaLabel}
        role={selectionMode === 'single' ? 'radio' : undefined}
        aria-checked={selectionMode === 'single' ? isSelected : undefined}
        aria-pressed={selectionMode === 'multiple' ? isSelected : undefined}
        tabIndex={resolvedActiveName === item.name ? 0 : -1}
        data-cg-button-group-item={item.name}
        onFocus={() => setActiveName(item.name)}
        onClick={(event) => activate(item, event)}
      >{content}</CgButton>;
    })}
  </div>;
}

export const CgButtonGroup = forwardRef(CgButtonGroupInner) as <TData = unknown>(
  props: CgButtonGroupProps<TData> & RefAttributes<HTMLDivElement>,
) => ReactElement | null;
