import { forwardRef, useMemo, useRef } from 'react';
import type { CSSProperties, ForwardedRef, MouseEvent, ReactElement, ReactNode, RefAttributes } from 'react';
import { useCgId, useControllableState, useDirection, useMergedRefs } from '../../hooks';
import { useRovingGrid } from '../../internal/rovingGrid';
import { toCssLength } from '../../internal/listBox';
import { cx } from '../../utils';
import { CgDropDownButton } from '../DropDownButton';
import styles from './CgGallery.module.css';
import type { CgGalleryGroup, CgGalleryItem, CgGalleryProps } from './CgGallery.types';

type GalleryStyle = CSSProperties & Record<`--cg-gallery-${string}`, string | number | undefined>;

interface GallerySection<TData> {
  readonly key: string;
  readonly text: string | undefined;
  readonly rows: ReadonlyArray<ReadonlyArray<CgGalleryItem<TData>>>;
}

function buildSections<TData>(items: ReadonlyArray<CgGalleryItem<TData>>, groups: ReadonlyArray<CgGalleryGroup> | undefined, columns: number): ReadonlyArray<GallerySection<TData>> {
  const keys = new Set<string>();
  for (const { key } of items) {
    if (!key.trim()) throw new Error('CgGallery items require a nonempty key.');
    if (keys.has(key)) throw new Error(`CgGallery contains duplicate key '${key}'.`);
    keys.add(key);
  }
  const groupKeys = new Set<string>();
  for (const { key } of groups ?? []) {
    if (groupKeys.has(key)) throw new Error(`CgGallery contains duplicate group '${key}'.`);
    groupKeys.add(key);
  }
  const visible = items.filter((item) => item.visible !== false);
  for (const item of visible) {
    if (item.group !== undefined && !groupKeys.has(item.group)) throw new Error(`CgGallery item '${item.key}' names unknown group '${item.group}'.`);
  }
  const toRows = (list: ReadonlyArray<CgGalleryItem<TData>>) => {
    const rows: Array<ReadonlyArray<CgGalleryItem<TData>>> = [];
    for (let index = 0; index < list.length; index += columns) rows.push(list.slice(index, index + columns));
    return rows;
  };
  const ungrouped = visible.filter((item) => item.group === undefined);
  const sections: Array<GallerySection<TData>> = ungrouped.length > 0 ? [{ key: '', text: undefined, rows: toRows(ungrouped) }] : [];
  for (const group of groups ?? []) {
    const members = visible.filter((item) => item.group === group.key);
    if (members.length > 0) sections.push({ key: group.key, text: group.text, rows: toRows(members) });
  }
  return sections;
}

function GalleryPanel<TData>({ items, groups, value, onChoose, renderItem, columns, itemWidth, itemHeight, maxHeight, footer, ariaLabel, disabled, direction }: {
  items: ReadonlyArray<CgGalleryItem<TData>>;
  groups: ReadonlyArray<CgGalleryGroup> | undefined;
  value: string | null;
  onChoose: (item: CgGalleryItem<TData>, event: MouseEvent<HTMLButtonElement>) => void;
  renderItem: CgGalleryProps<TData>['renderItem'];
  columns: number;
  itemWidth: CSSProperties['width'];
  itemHeight: CSSProperties['height'];
  maxHeight: CSSProperties['maxHeight'];
  footer: ReactNode;
  ariaLabel: string;
  disabled: boolean;
  direction: 'ltr' | 'rtl';
}) {
  const baseId = useCgId();
  const sections = useMemo(() => buildSections(items, groups, columns), [columns, groups, items]);
  const keyRows = useMemo(() => sections.flatMap((section) => section.rows.map((row) => row.map((item) => (item.disabled || disabled ? null : item.key)))), [disabled, sections]);
  const selectable = keyRows.flat().includes(value) ? value ?? undefined : undefined;
  const { tabStopKey, register, handleKeyDown, setFocusedKey } = useRovingGrid(keyRows, selectable, direction);
  const style: GalleryStyle = {
    '--cg-gallery-item-width': toCssLength(itemWidth, '4.25rem'),
    '--cg-gallery-item-height': toCssLength(itemHeight, '3rem'),
    '--cg-gallery-max-height': toCssLength(maxHeight, '22rem'),
  };
  return (
    <div className={styles.panel} style={style} data-cg-gallery-panel="">
      <div className={styles.scroller}>
        {sections.map((section) => {
          const headingId = `${baseId}-${section.key}`;
          return (
            <div key={section.key} className={styles.section}>
              {section.text !== undefined ? <div id={headingId} className={styles.heading}>{section.text}</div> : null}
              <div role="grid" aria-label={section.text === undefined ? ariaLabel : undefined} aria-labelledby={section.text === undefined ? undefined : headingId} className={styles.grid}>
                {section.rows.map((row, index) => (
                  <div key={index} role="row" className={styles.row}>
                    {row.map((item) => {
                      const selected = item.key === value;
                      const blocked = disabled || item.disabled === true;
                      return (
                        <button
                          key={item.key}
                          ref={(element) => register(item.key, element)}
                          type="button"
                          role="gridcell"
                          className={styles.item}
                          title={item.text}
                          aria-label={item.text}
                          aria-selected={selected}
                          tabIndex={tabStopKey === item.key ? 0 : -1}
                          disabled={blocked}
                          data-cg-gallery-item={item.key}
                          data-cg-initial-focus={selected && !blocked ? '' : undefined}
                          onFocus={() => setFocusedKey(item.key)}
                          onKeyDown={(event) => handleKeyDown(event, item.key)}
                          onClick={(event) => onChoose(item, event)}
                        >{renderItem?.({ item, selected }) ?? item.preview ?? <span className={styles.itemText}>{item.text}</span>}</button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {footer !== undefined ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}

function CgGalleryInner<TData>(
  { items, groups, value, defaultValue = null, onValueChange, renderItem, columns = 5, itemWidth, itemHeight, maxHeight, footer, display = 'dropdown', ariaLabel = 'Gallery', disabled = false, direction = 'auto', triggerText, triggerIcon, triggerAppearance = 'outline', size, open, defaultOpen, onOpenChange, placement = 'bottom-start', closeOnSelect = true, className, 'aria-label': nativeAriaLabel, ...nativeProps }: CgGalleryProps<TData>,
  forwardedRef: ForwardedRef<HTMLDivElement>,
) {
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('CgGallery columns must be a positive integer.');
  const rootRef = useRef<HTMLDivElement>(null);
  const mergedRef = useMergedRefs(rootRef, forwardedRef);
  const resolvedDirection = useDirection(rootRef, direction);
  const [current, setCurrent] = useControllableState<string | null>(value, defaultValue, 'CgGallery');
  const name = nativeAriaLabel ?? ariaLabel;

  const panel = (close?: () => void) => (
    <GalleryPanel
      items={items}
      groups={groups}
      value={current}
      onChoose={(item, event) => {
        if (disabled || item.disabled) return;
        setCurrent(item.key);
        onValueChange?.(item.key, { item, event });
        if (closeOnSelect) close?.();
      }}
      renderItem={renderItem}
      columns={columns}
      itemWidth={itemWidth}
      itemHeight={itemHeight}
      maxHeight={maxHeight}
      footer={footer}
      ariaLabel={name}
      disabled={disabled}
      direction={resolvedDirection}
    />
  );

  return (
    <div {...nativeProps} ref={mergedRef} dir={direction === 'auto' ? undefined : direction} className={cx(styles.root, className)} data-cg-gallery="" data-display={display}>
      {display === 'inline' ? panel() : (
        <CgDropDownButton
          appearance={triggerAppearance}
          size={size}
          icon={triggerIcon}
          disabled={disabled}
          open={open}
          defaultOpen={defaultOpen}
          onOpenChange={onOpenChange}
          placement={placement}
          direction={resolvedDirection}
          menuAriaLabel={name}
          menuMaxWidth="none"
          menuMaxHeight="none"
          renderFlyout={({ close }) => panel(close)}
        >{triggerText ?? name}</CgDropDownButton>
      )}
    </div>
  );
}

export const CgGallery = forwardRef(CgGalleryInner) as <TData = unknown>(props: CgGalleryProps<TData> & RefAttributes<HTMLDivElement>) => ReactElement | null;
