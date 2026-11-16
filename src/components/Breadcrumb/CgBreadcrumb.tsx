import { forwardRef } from 'react';
import type { ForwardedRef, ReactElement, RefAttributes } from 'react';
import { cx } from '../../utils';
import { CgDropDownButton } from '../DropDownButton';
import type { CgButtonMenuItem } from '../DropDownButton';
import { CgIcon } from '../Icon';
import styles from './CgBreadcrumb.module.css';
import type { CgBreadcrumbItem, CgBreadcrumbProps } from './CgBreadcrumb.types';

function assertCount(name: string, value: number, minimum: number) {
  if (!Number.isInteger(value) || value < minimum) throw new RangeError(`CgBreadcrumb ${name} must be an integer of at least ${minimum}.`);
}

/** The crumbs shown, with `null` where the hidden ones collapse, and the hidden ones. */
export function collapseCrumbs<T>(items: readonly T[], maxItems: number | undefined, before: number, after: number): { shown: Array<T | null>; hidden: T[] } {
  if (maxItems === undefined || items.length <= maxItems || before + after >= items.length) return { shown: [...items], hidden: [] };
  return {
    shown: [...items.slice(0, before), null, ...items.slice(items.length - after)],
    hidden: items.slice(before, items.length - after),
  };
}

function CgBreadcrumbInner<TData>(
  {
    items,
    label,
    maxItems,
    itemsBeforeCollapse = 1,
    itemsAfterCollapse = 2,
    overflowLabel,
    separator,
    onNavigate,
    currentLinked = false,
    className,
    ...nativeProps
  }: CgBreadcrumbProps<TData>,
  forwardedRef: ForwardedRef<HTMLElement>,
) {
  if (!label.trim()) throw new Error('CgBreadcrumb label cannot be empty.');
  if (maxItems !== undefined) assertCount('maxItems', maxItems, 2);
  assertCount('itemsBeforeCollapse', itemsBeforeCollapse, 0);
  assertCount('itemsAfterCollapse', itemsAfterCollapse, 1);
  const { shown, hidden } = collapseCrumbs(items, maxItems, itemsBeforeCollapse, itemsAfterCollapse);
  if (hidden.length && overflowLabel === undefined) throw new Error('CgBreadcrumb overflowLabel is required when crumbs collapse.');
  const overflowName = typeof overflowLabel === 'function' ? overflowLabel(hidden) : overflowLabel ?? '';
  const current = items[items.length - 1];
  const divider = separator ?? <CgIcon name="chevron-end" size="0.875em" />;

  const crumb = (item: CgBreadcrumbItem<TData>) => {
    const isCurrent = item === current;
    const content = <>
      {item.icon !== undefined ? <span className={styles.icon} aria-hidden="true">{item.icon}</span> : null}
      <span className={styles.text} dir="auto">{item.text}</span>
    </>;
    const linked = item.href !== undefined && !item.disabled && (!isCurrent || currentLinked);
    if (linked) {
      return <a
        className={styles.link}
        href={item.href}
        title={item.text}
        aria-current={isCurrent ? 'page' : undefined}
        onClick={(event) => onNavigate?.({ item, source: 'trail', event })}
      >{content}</a>;
    }
    return <span className={cx(styles.plain, isCurrent && styles.current)} title={item.text} aria-current={isCurrent ? 'page' : undefined} aria-disabled={item.disabled || undefined}>{content}</span>;
  };

  const menuItems: CgButtonMenuItem<CgBreadcrumbItem<TData>>[] = hidden.map((item) => ({
    key: item.key,
    text: item.text,
    disabled: item.disabled,
    data: item,
    ...(item.href !== undefined ? { navigateUrl: item.href } : {}),
  }));

  return <nav {...nativeProps} ref={forwardedRef} className={cx(styles.root, className)} aria-label={label} data-cg-breadcrumb="">
    <ol className={styles.list}>
      {shown.map((item, index) => <li key={item?.key ?? '…'} className={cx(styles.item, item === current && styles.currentItem)}>
        {index > 0 ? <span className={styles.separator} aria-hidden="true">{divider}</span> : null}
        {item ? crumb(item) : <CgDropDownButton
          className={styles.overflow}
          appearance="ghost"
          size="small"
          items={menuItems}
          menuAriaLabel={overflowName}
          aria-label={overflowName}
          title={overflowName}
          onItemClick={(details) => {
            const hiddenItem = details.item.data;
            if (hiddenItem) onNavigate?.({ item: hiddenItem, source: 'overflow', event: details.event });
          }}
        >{'…'}</CgDropDownButton>}
      </li>)}
    </ol>
  </nav>;
}

export const CgBreadcrumb = forwardRef(CgBreadcrumbInner) as <TData = unknown>(
  props: CgBreadcrumbProps<TData> & RefAttributes<HTMLElement>,
) => ReactElement | null;
