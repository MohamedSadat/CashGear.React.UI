import { forwardRef, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { normalizeListBoxSearch } from '../../internal/listBox';
import { cx } from '../../utils';
import { CgIcon } from '../Icon';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import styles from './CgOptionPicker.module.css';
import type { CgOptionPickerChange, CgOptionPickerColour, CgOptionPickerGroup, CgOptionPickerLabels, CgOptionPickerOption, CgOptionPickerProps } from './CgOptionPicker.types';
import { Check, PickerChip, stepIndex } from './pickerParts';

/** The colour used least so far, in palette order: what a new option gets. */
export function leastUsedColour(options: readonly CgOptionPickerOption[], colours: readonly CgOptionPickerColour[]): string | undefined {
  const counts = new Map<string, number>();
  for (const option of options) if (option.colour) counts.set(option.colour, (counts.get(option.colour) ?? 0) + 1);
  let best: string | undefined;
  for (const colour of colours) if (best === undefined || (counts.get(colour.key) ?? 0) < (counts.get(best) ?? 0)) best = colour.key;
  return best;
}

/** `keys` with `key` moved to `to`, counted in the list after the move. */
export function moveKey(keys: readonly string[], key: string, to: number): string[] {
  if (!keys.includes(key)) return [...keys];
  const out = keys.filter((value) => value !== key);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, key);
  return out;
}

function randomKey(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `option-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function chipStyle(option: CgOptionPickerOption, colours: readonly CgOptionPickerColour[] | undefined): CSSProperties | undefined {
  const colour = colours?.find((entry) => entry.key === option.colour);
  return colour ? { background: colour.background, color: colour.text } : undefined;
}

interface EditorProps {
  option: CgOptionPickerOption;
  colours?: readonly CgOptionPickerColour[];
  groups?: readonly CgOptionPickerGroup[];
  labels: CgOptionPickerLabels;
  onChange: (option: CgOptionPickerOption, kind: 'rename' | 'recolour' | 'regroup') => void;
  onDelete: () => void;
  onBack: () => void;
}

/** One option's name, colour and group, and deleting it. */
function OptionEditor({ option, colours, groups, labels, onChange, onDelete, onBack }: EditorProps) {
  const radioName = `cg-option-${useId().replace(/[^a-zA-Z0-9-]/gu, '')}`;
  const rename = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== option.name) onChange({ ...option, name: trimmed }, 'rename');
  };
  return <div className={cx(styles.picker, styles.editor)} role="group" aria-label={labels.optionMenu(option.name)} data-cg-option-editor="">
    <div className={styles.editorHead}>
      <button type="button" className={styles.iconButton} aria-label={labels.back} title={labels.back} onClick={onBack}><CgIcon name="chevron-start" /></button>
      <input
        className={styles.input}
        data-cg-initial-focus=""
        autoFocus
        aria-label={labels.name}
        defaultValue={option.name}
        dir="auto"
        onBlur={(event) => rename(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); rename(event.currentTarget.value); onBack(); }
          else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onBack(); }
        }}
      />
    </div>
    {groups?.length ? <fieldset className={styles.fieldset}>
      <legend>{labels.group}</legend>
      {groups.map((group) => <label key={group.key} className={styles.radioRow}>
        <input type="radio" name={`${radioName}-group`} checked={(option.group ?? groups[0]!.key) === group.key} onChange={() => onChange({ ...option, group: group.key }, 'regroup')} />
        {group.label}
      </label>)}
    </fieldset> : null}
    {colours?.length ? <fieldset className={styles.fieldset}>
      <legend>{labels.colour}</legend>
      {colours.map((colour) => <label key={colour.key} className={styles.radioRow}>
        <input type="radio" name={`${radioName}-colour`} checked={option.colour === colour.key} onChange={() => onChange({ ...option, colour: colour.key }, 'recolour')} />
        <span className={styles.swatch} style={{ background: colour.background }} aria-hidden="true" />
        {colour.label}
      </label>)}
    </fieldset> : null}
    <button type="button" className={styles.deleteButton} onClick={onDelete}><CgIcon name="delete" />{labels.delete}</button>
  </div>;
}

/**
 * Chooses options of a select or status field, and manages them on the way: create one from the
 * text typed, rename, recolour, regroup, reorder (a handle, or Alt+arrows) and delete.
 */
export const CgOptionPicker = forwardRef<HTMLDivElement, CgOptionPickerProps>(function CgOptionPicker(
  { options, selected, multiple = false, onSelectionChange, canManage = false, onOptionsChange, createOption, colours, groups, manage = false, defaultQuery = '', labels, renderChip, className, ...nativeProps },
  forwardedRef,
) {
  const baseId = `cg-${useId().replace(/[^a-zA-Z0-9-]/gu, '')}`;
  const [query, setQuery] = useState(defaultQuery);
  const [active, setActive] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ key: string; gap: number | null } | null>(null);
  const dragRef = useRef<{ key: string; pointerId: number; startY: number; moved: boolean; gap: number | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const trimmed = query.trim();
  const groupOf = (option: CgOptionPickerOption) => option.group ?? groups?.[0]?.key;

  const matches = useMemo(() => {
    const needle = normalizeListBoxSearch(query);
    return needle ? options.filter((option) => normalizeListBoxSearch(option.name).includes(needle)) : [...options];
  }, [options, query]);
  // Grouped options are listed, and walked by the keyboard, group by group.
  const listed = useMemo(() => (groups?.length ? groups.flatMap((group) => matches.filter((option) => (option.group ?? groups[0]!.key) === group.key)) : matches), [groups, matches]);
  const canCreate = canManage && trimmed !== '' && !options.some((option) => option.name === trimmed);
  const total = listed.length + (canCreate ? 1 : 0);
  const activeIndex = Math.min(active, Math.max(0, total - 1));
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const reorderable = canManage && !trimmed && onOptionsChange !== undefined;

  const change = (next: CgOptionPickerOption[], detail: CgOptionPickerChange) => onOptionsChange?.(next, Object.freeze(detail));
  const toggle = (key: string) => {
    if (!multiple) onSelectionChange?.([key]);
    else onSelectionChange?.(selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key]);
  };
  const create = () => {
    if (!canCreate) return;
    const option = createOption?.(trimmed) ?? { key: randomKey(), name: trimmed, colour: leastUsedColour(options, colours ?? []), ...(groups?.length ? { group: groups[0]!.key } : {}) };
    change([...options, option], { kind: 'create', key: option.key });
    setQuery('');
    if (!manage) toggle(option.key);
  };
  const pick = (index: number) => {
    const option = listed[index];
    if (!option) create();
    else if (manage) setEditing(option.key);
    else toggle(option.key);
  };
  const moveOption = (key: string, to: number) => {
    const order = moveKey(options.map((option) => option.key), key, to);
    const byKey = new Map(options.map((option) => [option.key, option]));
    change(order.map((value) => byKey.get(value)!), { kind: 'reorder', key, toIndex: to });
    const moved = byKey.get(key);
    if (moved && labels.moved) live.current?.announce(labels.moved(moved.name, to, options.length));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const option = listed[activeIndex];
      if (event.altKey && reorderable && option) {
        const at = options.indexOf(option);
        if (at + step >= 0 && at + step < options.length) { moveOption(option.key, at + step); setActive(activeIndex + step); }
        return;
      }
      setActive(stepIndex(activeIndex, step, total));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (total) pick(activeIndex);
    } else if (event.key === 'F2' && canManage && onOptionsChange && listed[activeIndex]) {
      event.preventDefault();
      setEditing(listed[activeIndex].key);
    } else if (event.key === 'Backspace' && query === '' && multiple && selected.length) {
      onSelectionChange?.(selected.slice(0, -1));
    }
  };

  const gapAt = (event: PointerEvent<HTMLElement>): number | null => {
    const row = document.elementFromPoint?.(event.clientX, event.clientY)?.closest<HTMLElement>('[data-cg-option-key]');
    if (!row || !listRef.current?.contains(row)) return null;
    const index = options.findIndex((option) => option.key === row.dataset.cgOptionKey);
    if (index < 0) return null;
    const box = row.getBoundingClientRect();
    return event.clientY > box.top + box.height / 2 ? index + 1 : index;
  };
  const handleProps = (key: string) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      dragRef.current = { key, pointerId: event.pointerId, startY: event.clientY, moved: false, gap: null };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const current = dragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (!current.moved && Math.abs(event.clientY - current.startY) < 4) return;
      current.moved = true;
      current.gap = gapAt(event);
      setDrag((state) => (state?.key === key && state.gap === current.gap ? state : { key, gap: current.gap }));
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const current = dragRef.current;
      dragRef.current = null;
      setDrag(null);
      if (!current || current.pointerId !== event.pointerId || !current.moved || current.gap === null) return;
      const from = options.findIndex((option) => option.key === key);
      const to = current.gap > from ? current.gap - 1 : current.gap;
      if (to !== from) moveOption(key, to);
    },
    onPointerCancel() { dragRef.current = null; setDrag(null); },
    onClick(event: { stopPropagation(): void }) { event.stopPropagation(); },
  });

  const editingOption = editing === null ? undefined : options.find((option) => option.key === editing);
  if (editingOption) {
    return <div {...nativeProps} ref={forwardedRef} className={className}>
      <OptionEditor
        option={editingOption}
        colours={colours}
        groups={groups}
        labels={labels}
        onChange={(next, kind) => change(options.map((option) => (option.key === next.key ? next : option)), { kind, key: next.key })}
        onDelete={() => {
          change(options.filter((option) => option.key !== editingOption.key), { kind: 'delete', key: editingOption.key });
          if (selected.includes(editingOption.key)) onSelectionChange?.(selected.filter((key) => key !== editingOption.key));
          setEditing(null);
        }}
        onBack={() => { setEditing(null); requestAnimationFrame(() => inputRef.current?.focus()); }}
      />
    </div>;
  }

  const drawChip = (option: CgOptionPickerOption): ReactNode => renderChip?.(option);
  const renderOption = (option: CgOptionPickerOption) => {
    const index = listed.indexOf(option);
    const isSelected = selected.includes(option.key);
    const fromIndex = options.indexOf(option);
    const dropBefore = drag !== null && drag.gap === fromIndex;
    const dropAfter = drag !== null && drag.gap === options.length && fromIndex === options.length - 1;
    return <div
      key={option.key}
      id={optionId(index)}
      role="option"
      aria-selected={manage ? undefined : isSelected}
      className={cx(styles.option, index === activeIndex && styles.active)}
      data-cg-option-key={option.key}
      data-dragging={drag?.key === option.key ? '' : undefined}
      data-drop={dropBefore ? 'before' : dropAfter ? 'after' : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onMouseMove={() => { if (index !== activeIndex) setActive(index); }}
      onClick={() => pick(index)}
    >
      {reorderable ? <span className={styles.handle} title={labels.drag(option.name)} aria-hidden="true" data-cg-option-handle="" {...handleProps(option.key)}><CgIcon name="drag-handle" /></span> : null}
      {manage ? null : <Check on={isSelected} />}
      <span className={styles.optionChip}>{drawChip(option) ?? <PickerChip label={option.name} style={chipStyle(option, colours)} />}</span>
      {canManage && onOptionsChange ? <span
        className={styles.iconButton}
        title={labels.optionMenu(option.name)}
        aria-hidden="true"
        data-cg-option-menu=""
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => { event.stopPropagation(); setEditing(option.key); }}
      ><CgIcon name="more" /></span> : null}
    </div>;
  };

  const chosen = selected.map((key) => options.find((option) => option.key === key)).filter((option): option is CgOptionPickerOption => option !== undefined);
  const searchName = canManage ? labels.search : (labels.searchOnly ?? labels.search);
  return <div {...nativeProps} ref={forwardedRef} className={cx(styles.picker, className)} data-cg-option-picker="">
    <div className={styles.head}>
      {chosen.map((option) => <PickerChip
        key={option.key}
        label={option.name}
        content={drawChip(option)}
        style={chipStyle(option, colours)}
        removeLabel={labels.remove(option.name)}
        onRemove={() => onSelectionChange?.(selected.filter((key) => key !== option.key))}
      />)}
      <input
        ref={inputRef}
        className={styles.input}
        data-cg-initial-focus=""
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${baseId}-list`}
        aria-activedescendant={total ? optionId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-keyshortcuts={reorderable ? 'Alt+ArrowUp Alt+ArrowDown F2' : canManage && onOptionsChange ? 'F2' : undefined}
        aria-label={searchName}
        placeholder={searchName}
        value={query}
        dir="auto"
        autoComplete="off"
        onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); }}
        onKeyDown={onKeyDown}
      />
    </div>
    <div ref={listRef} id={`${baseId}-list`} role="listbox" aria-label={labels.list} aria-multiselectable={multiple || undefined} className={styles.list}>
      {groups?.length
        ? groups.map((group) => {
          const inGroup = listed.filter((option) => groupOf(option) === group.key);
          if (!inGroup.length) return null;
          return <div key={group.key} role="group" aria-labelledby={`${baseId}-group-${group.key}`} className={styles.group}>
            <div id={`${baseId}-group-${group.key}`} role="presentation" className={styles.groupLabel}>{group.label}</div>
            {inGroup.map(renderOption)}
          </div>;
        })
        : listed.map(renderOption)}
      {canCreate ? <div
        id={optionId(listed.length)}
        role="option"
        aria-selected={false}
        className={cx(styles.option, styles.create, activeIndex === listed.length && styles.active)}
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => { if (activeIndex !== listed.length) setActive(listed.length); }}
        onClick={create}
      ><CgIcon name="add" /><span className={styles.optionText} dir="auto">{labels.create(trimmed)}</span></div> : null}
    </div>
    {!listed.length && !canCreate ? <div className={styles.empty} role="status">{options.length ? labels.noMatch : labels.none}</div> : null}
    {labels.moved ? <CgLiveAnnouncer ref={live} /> : null}
  </div>;
});
