import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { useMergedRefs } from '../../hooks';
import { normalizeListBoxSearch } from '../../internal/listBox';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import styles from './CgEmojiPicker.module.css';
import type { CgEmojiPickerItem, CgEmojiPickerProps } from './CgEmojiPicker.types';

interface Section { key: string; label: string; items: CgEmojiPickerItem[] }

/** Where focus goes from `index` (a place in the flat order) for an arrow key, by section rows. */
export function emojiStep(sections: readonly { items: readonly unknown[] }[], index: number, key: string, columns: number, rtl: boolean): number | 'search' | null {
  const starts: number[] = [];
  let total = 0;
  for (const section of sections) { starts.push(total); total += section.items.length; }
  if (!total) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return total - 1;
  if (key === 'ArrowRight' || key === 'ArrowLeft') {
    const step = (key === 'ArrowRight') !== rtl ? 1 : -1;
    return Math.max(0, Math.min(total - 1, index + step));
  }
  if (key !== 'ArrowDown' && key !== 'ArrowUp') return null;
  let at = 0;
  while (at + 1 < starts.length && starts[at + 1]! <= index) at += 1;
  const offset = index - starts[at]!;
  const row = Math.floor(offset / columns);
  const column = offset % columns;
  const rows = (s: number) => Math.ceil(sections[s]!.items.length / columns);
  const place = (s: number, r: number) => starts[s]! + Math.min(sections[s]!.items.length - 1, r * columns + column);
  if (key === 'ArrowDown') {
    if (row + 1 < rows(at)) return place(at, row + 1);
    for (let next = at + 1; next < sections.length; next += 1) if (sections[next]!.items.length) return place(next, 0);
    return index;
  }
  if (row > 0) return place(at, row - 1);
  for (let previous = at - 1; previous >= 0; previous -= 1) if (sections[previous]!.items.length) return place(previous, rows(previous) - 1);
  return 'search';
}

/** A searchable grid of emoji, grouped, walked with the arrow keys; Enter or a click chooses. */
export const CgEmojiPicker = forwardRef<HTMLDivElement, CgEmojiPickerProps>(function CgEmojiPicker(
  { items, groups, recent, onSelect, onEscape, labels, columns = 8, value, searchable = true, className, style, ...nativeProps },
  forwardedRef,
) {
  if (!labels.search.trim() || !labels.grid.trim()) throw new Error('CgEmojiPicker labels.search and labels.grid cannot be empty.');
  if (recent?.length && !labels.recent?.trim()) throw new Error('CgEmojiPicker labels.recent is required with recent.');
  if (!Number.isInteger(columns) || columns < 1) throw new RangeError('CgEmojiPicker columns must be a positive integer.');
  const baseId = `cg-${useId().replace(/[^a-zA-Z0-9-]/gu, '')}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRefs(rootRef, forwardedRef);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [focusIndex, setFocusIndex] = useState(0);

  const sections = useMemo<Section[]>(() => {
    const needle = normalizeListBoxSearch(query);
    const matches = (item: CgEmojiPickerItem) => !needle || [item.name, ...(item.keywords ?? [])].some((text) => normalizeListBoxSearch(text).includes(needle));
    const found = items.filter(matches);
    if (needle) return found.length ? [{ key: 'results', label: '', items: found }] : [];
    const out: Section[] = [];
    if (recent?.length) out.push({ key: 'recent', label: labels.recent ?? '', items: [...recent] });
    const known = new Set(groups?.map((group) => group.key));
    for (const group of groups ?? []) {
      const inGroup = found.filter((item) => item.group === group.key);
      if (inGroup.length) out.push({ key: group.key, label: group.label, items: inGroup });
    }
    const rest = found.filter((item) => !item.group || !known.has(item.group));
    if (rest.length) out.push({ key: 'other', label: '', items: rest });
    return out;
  }, [groups, items, labels.recent, query, recent]);
  const flat = sections.flatMap((section) => section.items);
  const active = Math.min(focusIndex, Math.max(0, flat.length - 1));

  const focusAt = (index: number) => {
    setFocusIndex(index);
    rootRef.current?.querySelector<HTMLElement>(`[data-cg-emoji-index="${index}"]`)?.focus();
  };
  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const index = Number(target.dataset.cgEmojiIndex);
    if (!Number.isInteger(index)) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const next = emojiStep(sections, index, event.key, columns, rtl);
    if (next === null) return;
    event.preventDefault();
    if (next === 'search') searchRef.current?.focus();
    else focusAt(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && onEscape) { event.preventDefault(); event.stopPropagation(); onEscape(); }
  };

  let index = 0;
  return <div {...nativeProps} ref={ref} className={cx(styles.picker, className)} style={{ '--cg-emoji-columns': columns, ...style } as CSSProperties} onKeyDown={onKeyDown} data-cg-emoji-picker="">
    {searchable || labels.remove ? <div className={styles.top}>
      {searchable ? <input
        ref={searchRef}
        className={styles.search}
        type="search"
        aria-label={labels.search}
        placeholder={labels.search}
        aria-controls={`${baseId}-grid`}
        data-cg-initial-focus=""
        dir="auto"
        autoComplete="off"
        value={query}
        onChange={(event) => { setQuery(event.currentTarget.value); setFocusIndex(0); }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && flat.length) { event.preventDefault(); focusAt(0); }
          else if (event.key === 'Enter' && flat.length) { event.preventDefault(); onSelect(flat[0]!.emoji, flat[0]); }
        }}
      /> : null}
      {labels.remove ? <button type="button" className={styles.remove} onClick={() => onSelect(null)}><CgIcon name="delete" />{labels.remove}</button> : null}
    </div> : null}
    <div id={`${baseId}-grid`} className={styles.grid} role="group" aria-label={labels.grid} onKeyDown={onGridKey}>
      {sections.map((section) => <div key={section.key} className={styles.section} role={section.label ? 'group' : undefined} aria-labelledby={section.label ? `${baseId}-${section.key}` : undefined}>
        {section.label ? <div id={`${baseId}-${section.key}`} className={styles.heading}>{section.label}</div> : null}
        <div className={styles.cells}>
          {section.items.map((item) => {
            const at = index;
            index += 1;
            return <button
              key={`${section.key}-${item.emoji}`}
              type="button"
              className={styles.cell}
              aria-label={item.name}
              aria-pressed={value === undefined ? undefined : value === item.emoji}
              title={item.name}
              tabIndex={at === active ? 0 : -1}
              data-cg-emoji-index={at}
              onFocus={() => setFocusIndex(at)}
              onClick={() => onSelect(item.emoji, item)}
            ><span aria-hidden="true">{item.emoji}</span></button>;
          })}
        </div>
      </div>)}
      {!flat.length ? <div className={styles.empty} role="status">{labels.noMatch}</div> : null}
    </div>
  </div>;
});
