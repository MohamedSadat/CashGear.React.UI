import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import type { ForwardedRef, KeyboardEvent, PointerEvent, ReactElement, RefAttributes } from 'react';
import { useMergedRefs } from '../../hooks';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import styles from './CgSortableList.module.css';
import type { CgSortableListProps } from './CgSortableList.types';

/** The place an item at `from` takes when dropped in the gap before `gap` (0 to length). */
export function gapToIndex(from: number, gap: number): number {
  return gap > from ? gap - 1 : gap;
}

interface Drag { key: string; pointerId: number; startY: number; moved: boolean; gap: number | null }

function CgSortableListInner<T>(
  { items, getKey, renderItem, onMove, label, handleLabel, moveAnnouncement, isItemFixed, canMove, disabled = false, className, ...nativeProps }: CgSortableListProps<T>,
  forwardedRef: ForwardedRef<HTMLUListElement>,
) {
  if (!label.trim()) throw new Error('CgSortableList label cannot be empty.');
  const listRef = useRef<HTMLUListElement>(null);
  const ref = useMergedRefs(listRef, forwardedRef);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<{ key: string; gap: number | null } | null>(null);
  const refocusRef = useRef<string | null>(null);
  const keys = items.map(getKey);

  // A handle moved by keyboard is a new place in the DOM: focus follows it there.
  useLayoutEffect(() => {
    const key = refocusRef.current;
    if (key === null) return;
    refocusRef.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-cg-sortable-handle="${CSS.escape(key)}"]`)?.focus();
  });

  const allowed = (key: string, from: number, to: number) => to !== from && to >= 0 && to < items.length && (!canMove || canMove(key, to));
  const move = (key: string, from: number, to: number, source: 'pointer' | 'keyboard') => {
    if (!allowed(key, from, to)) return;
    if (source === 'keyboard') refocusRef.current = key;
    onMove(key, to, Object.freeze({ fromIndex: from, source }));
    const item = items[from];
    if (item !== undefined && moveAnnouncement) live.current?.announce(moveAnnouncement(item, to, items.length));
  };

  const gapAt = (event: PointerEvent<HTMLElement>): number | null => {
    const row = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cg-sortable-key]');
    if (!row || !listRef.current?.contains(row)) return null;
    const index = keys.indexOf(row.dataset.cgSortableKey ?? '');
    if (index < 0) return null;
    const box = row.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2 ? index + 1 : index;
  };

  const handleProps = (key: string, index: number) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { key, pointerId: event.pointerId, startY: event.clientY, moved: false, gap: null };
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.moved && Math.abs(event.clientY - current.startY) < 4) return;
      current.moved = true;
      event.preventDefault();
      const gap = gapAt(event);
      current.gap = gap !== null && allowed(key, index, gapToIndex(index, gap)) ? gap : null;
      setDrag((state) => (state?.key === key && state.gap === current.gap ? state : { key, gap: current.gap }));
    },
    onPointerUp(event: PointerEvent<HTMLButtonElement>) {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || current.pointerId !== event.pointerId || !current.moved || current.gap === null) return;
      move(key, index, gapToIndex(index, current.gap), 'pointer');
    },
    onPointerCancel() { dragRef.current = null; setDrag(null); },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      const target = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      move(key, index, target, 'keyboard');
    },
  });

  return <>
    <ul {...nativeProps} ref={ref} className={cx(styles.list, className)} aria-label={label} data-cg-sortable-list="">
      {items.map((item, index) => {
        const key = keys[index]!;
        const fixed = isItemFixed?.(item) ?? false;
        const dragging = drag?.key === key;
        const dropBefore = drag !== null && drag.gap === index && drag.gap !== keys.indexOf(drag.key) && drag.gap !== keys.indexOf(drag.key) + 1;
        const dropAfter = drag !== null && index === items.length - 1 && drag.gap === items.length && keys.indexOf(drag.key) !== items.length - 1;
        return <li
          key={key}
          className={styles.item}
          data-cg-sortable-key={key}
          data-dragging={dragging ? '' : undefined}
          data-drop={dropBefore ? 'before' : dropAfter ? 'after' : undefined}
        >
          {disabled ? null : fixed
            ? <span className={styles.handleSpace} aria-hidden="true" />
            : <button
              type="button"
              className={styles.handle}
              aria-label={handleLabel(item, index)}
              aria-keyshortcuts="ArrowUp ArrowDown Home End"
              data-cg-sortable-handle={key}
              {...handleProps(key, index)}
            ><CgIcon name="drag-handle" /></button>}
          <div className={styles.content}>{renderItem(item, { index, dragging, fixed })}</div>
        </li>;
      })}
    </ul>
    {moveAnnouncement ? <CgLiveAnnouncer ref={live} /> : null}
  </>;
}

export const CgSortableList = forwardRef(CgSortableListInner) as <T>(
  props: CgSortableListProps<T> & RefAttributes<HTMLUListElement>,
) => ReactElement | null;
