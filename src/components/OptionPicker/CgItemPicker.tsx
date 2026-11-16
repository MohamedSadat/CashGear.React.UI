import { forwardRef, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { cx } from '../../utils';
import styles from './CgOptionPicker.module.css';
import type { CgItemPickerProps } from './CgOptionPicker.types';
import { Check, PickerChip, stepIndex } from './pickerParts';

/**
 * Chooses items from results the caller finds for the text typed, the chosen ones drawn as chips
 * the caller describes: people for a person field, rows for a relation, values for a filter.
 */
export const CgItemPicker = forwardRef<HTMLDivElement, CgItemPickerProps>(function CgItemPicker(
  { items, selected, multiple = false, onSelectionChange, chip, query, onQueryChange, searchLabel, listLabel, emptyText, removeLabel, loading = false, loadingText, note, className, ...nativeProps },
  forwardedRef,
) {
  if (!searchLabel.trim() || !listLabel.trim()) throw new Error('CgItemPicker searchLabel and listLabel cannot be empty.');
  const baseId = `cg-${useId().replace(/[^a-zA-Z0-9-]/gu, '')}`;
  const [active, setActive] = useState(0);
  const activeIndex = Math.min(active, Math.max(0, items.length - 1));
  const itemId = (index: number) => `${baseId}-item-${index}`;
  const toggle = (key: string) => {
    if (!multiple) onSelectionChange([key]);
    else onSelectionChange(selected.includes(key) ? selected.filter((value) => value !== key) : [...selected, key]);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(stepIndex(activeIndex, event.key === 'ArrowDown' ? 1 : -1, items.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) toggle(item.key);
    } else if (event.key === 'Backspace' && query === '' && multiple && selected.length) {
      onSelectionChange(selected.slice(0, -1));
    }
  };
  return <div {...nativeProps} ref={forwardedRef} className={cx(styles.picker, className)} data-cg-item-picker="">
    <div className={styles.head}>
      {selected.map((key) => {
        const described = chip(key);
        return <PickerChip key={key} label={described.label} content={described.content} removeLabel={removeLabel(described.label)} onRemove={() => onSelectionChange(selected.filter((value) => value !== key))} />;
      })}
      <input
        className={styles.input}
        data-cg-initial-focus=""
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={`${baseId}-list`}
        aria-activedescendant={items.length ? itemId(activeIndex) : undefined}
        aria-autocomplete="list"
        aria-busy={loading || undefined}
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={query}
        dir="auto"
        autoComplete="off"
        onChange={(event) => { onQueryChange(event.currentTarget.value); setActive(0); }}
        onKeyDown={onKeyDown}
      />
    </div>
    <div id={`${baseId}-list`} role="listbox" aria-label={listLabel} aria-multiselectable={multiple || undefined} aria-busy={loading || undefined} className={styles.list}>
      {items.map((item, index) => {
        const isSelected = selected.includes(item.key);
        return <div
          key={item.key}
          id={itemId(index)}
          role="option"
          aria-selected={isSelected}
          className={cx(styles.option, index === activeIndex && styles.active)}
          onMouseDown={(event) => event.preventDefault()}
          onMouseMove={() => { if (index !== activeIndex) setActive(index); }}
          onClick={() => toggle(item.key)}
        >
          <Check on={isSelected} />
          {item.content ?? <span className={styles.optionText} dir="auto">{item.label}</span>}
        </div>;
      })}
    </div>
    {!items.length ? <div className={styles.empty} role="status">{loading && loadingText !== undefined ? loadingText : emptyText}</div> : null}
    {note !== undefined && note !== null && note !== false ? <div className={styles.note}>{note}</div> : null}
  </div>;
});
