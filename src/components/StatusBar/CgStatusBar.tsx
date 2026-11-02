import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMergedRefs, useStableCallback } from '../../hooks';
import { cx } from '../../utils';
import styles from './CgStatusBar.module.css';
import type { CgStatusBarItem, CgStatusBarProps } from './CgStatusBar.types';

/** Plain text gives up its width down to this many pixels, by truncating, before any item hides. */
const MINIMUM_TEXT_WIDTH = 96;
/** Content that can't be cut short with an ellipsis keeps its whole width until it hides. */
const FIXED_WIDTH_CONTENT = 'button, canvas, img, input, select, svg, textarea, video, [role], [tabindex]';
const NOTHING_HIDDEN: ReadonlySet<string> = new Set();

function visibleItems(items: ReadonlyArray<CgStatusBarItem>) {
  const keys = new Set<string>();
  for (const { key } of items) {
    if (!key.trim()) throw new Error('CgStatusBar items require a nonempty key.');
    if (keys.has(key)) throw new Error(`CgStatusBar contains duplicate key '${key}'.`);
    keys.add(key);
  }
  return items.filter((item) => item.visible !== false);
}

function dataAttributes(item: CgStatusBarItem) {
  return Object.fromEntries(Object.entries(item).filter(([name]) => name.startsWith('data-'))) as Record<`data-${string}`, unknown>;
}

function sameKeys(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return left.size === right.size && [...left].every((key) => right.has(key));
}

export const CgStatusBar = forwardRef<HTMLDivElement, CgStatusBarProps>(function CgStatusBar(
  { items, size = 'medium', direction = 'auto', ariaLabel, 'aria-label': nativeAriaLabel, className, ...nativeProps },
  forwardedRef,
) {
  const entries = useMemo(() => visibleItems(items), [items]);
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const elements = useRef(new Map<string, HTMLElement>());
  const [hiddenKeys, setHiddenKeys] = useState(NOTHING_HIDDEN);

  const fitItems = useStableCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    // Measuring lifts every limit for one synchronous layout, so widths don't depend on the last result.
    root.classList.add(styles.measuring!);
    const widths = new Map(entries.map((item) => [item.key, Math.ceil(elements.current.get(item.key)?.getBoundingClientRect().width ?? 0)]));
    root.classList.remove(styles.measuring!);
    const available = root.clientWidth;
    if (available <= 0) {
      setHiddenKeys((current) => (current.size === 0 ? current : NOTHING_HIDDEN));
      return;
    }
    const byImportance = entries
      .map((item, index) => ({ item, index }))
      .sort((left, right) => (right.item.priority ?? 0) - (left.item.priority ?? 0) || left.index - right.index);
    const hidden = new Set(entries.map((item) => item.key));
    let used = 0;
    for (const { item } of byImportance) {
      const element = elements.current.get(item.key);
      const width = widths.get(item.key) ?? 0;
      const minimum = element?.querySelector(FIXED_WIDTH_CONTENT) ? width : Math.min(width, MINIMUM_TEXT_WIDTH);
      if (used > 0 && used + minimum > available) break;
      hidden.delete(item.key);
      if (element) element.style.minInlineSize = minimum > available ? '0' : `${minimum}px`;
      used += minimum;
    }
    setHiddenKeys((current) => (sameKeys(current, hidden) ? current : hidden));
  });

  useLayoutEffect(() => fitItems(), [entries, fitItems, size]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => fitItems());
    observer.observe(root);
    return () => observer.disconnect();
  }, [fitItems]);

  const renderRail = (rail: ReadonlyArray<CgStatusBarItem>) => {
    const firstShown = rail.find((item) => !hiddenKeys.has(item.key))?.key;
    return rail.map((item) => {
      const hidden = hiddenKeys.has(item.key);
      const props = {
        ...dataAttributes(item),
        ref: (element: HTMLElement | null) => {
          if (element) elements.current.set(item.key, element);
          else elements.current.delete(item.key);
        },
        title: item.tooltip,
        hidden: hidden || undefined,
        'data-cg-status-bar-item': item.key,
        'data-separator': (item.separator && !hidden && item.key !== firstShown) || undefined,
      };
      return item.onClick
        ? <button key={item.key} type="button" {...props} className={cx(styles.item, styles.button, item.className)} onClick={item.onClick}>{item.content}</button>
        : <div key={item.key} {...props} className={cx(styles.item, item.className)}>{item.content}</div>;
    });
  };

  // Each item changes on its own, so aria-atomic overrides role="status" and only the changed item is read out.
  return (
    <div
      aria-live="polite"
      aria-atomic={false}
      {...nativeProps}
      ref={mergedRef}
      role="status"
      aria-label={ariaLabel ?? nativeAriaLabel ?? 'Status bar'}
      dir={direction === 'auto' ? undefined : direction}
      className={cx(styles.root, className)}
      data-cg-status-bar=""
      data-size={size}
    >
      {renderRail(entries.filter((item) => item.align !== 'end'))}
      <div className={styles.spacer} />
      {renderRail(entries.filter((item) => item.align === 'end'))}
    </div>
  );
});
