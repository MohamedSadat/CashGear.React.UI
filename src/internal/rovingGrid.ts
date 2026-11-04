import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

/** Rows of item keys. `null` holds a place in a column for an item that can't take focus. */
export type RovingGridRows = ReadonlyArray<ReadonlyArray<string | null>>;
export type RovingGridDirection = 'ltr' | 'rtl';

function position(rows: RovingGridRows, key: string | undefined): { row: number; column: number } | undefined {
  if (key === undefined) return undefined;
  for (let row = 0; row < rows.length; row += 1) {
    const column = rows[row]!.indexOf(key);
    if (column >= 0) return { row, column };
  }
  return undefined;
}

function nearestInRow(row: ReadonlyArray<string | null>, column: number): string | undefined {
  for (let distance = 0; distance <= Math.max(column, row.length); distance += 1) {
    const key = row[column - distance] ?? row[column + distance];
    if (key) return key;
  }
  return undefined;
}

function firstKey(rows: RovingGridRows, fromEnd: boolean): string | undefined {
  const keys = rows.flat().filter((key): key is string => key !== null);
  return fromEnd ? keys.at(-1) : keys[0];
}

/** The key an arrow, Home or End press moves to, or `undefined` when the key isn't a movement or there's nowhere to go. */
export function moveInRovingGrid(rows: RovingGridRows, currentKey: string | undefined, key: string, ctrlKey: boolean, direction: RovingGridDirection): string | undefined {
  if (ctrlKey && (key === 'Home' || key === 'End')) return firstKey(rows, key === 'End');
  const current = position(rows, currentKey);
  if (!current) return undefined;
  const row = rows[current.row]!;
  const forward = direction === 'rtl' ? -1 : 1;
  const alongRow = (step: number) => {
    for (let column = current.column + step; column >= 0 && column < row.length; column += step) {
      const next = row[column];
      if (next) return next;
    }
    return undefined;
  };
  const acrossRows = (step: number) => {
    for (let index = current.row + step; index >= 0 && index < rows.length; index += step) {
      const next = nearestInRow(rows[index]!, current.column);
      if (next) return next;
    }
    return undefined;
  };
  switch (key) {
    case 'ArrowRight': return alongRow(forward);
    case 'ArrowLeft': return alongRow(-forward);
    case 'ArrowDown': return acrossRows(1);
    case 'ArrowUp': return acrossRows(-1);
    case 'Home': return row.find((item) => item !== null) ?? undefined;
    case 'End': return row.filter((item) => item !== null).at(-1);
    default: return undefined;
  }
}

/**
 * One tab stop across a grid of buttons. The stop stays on the last focused item,
 * and until then sits on `preferredKey`, usually the selected item.
 */
export function useRovingGrid(rows: RovingGridRows, preferredKey: string | undefined, direction: RovingGridDirection) {
  const [focusedKey, setFocusedKey] = useState<string>();
  const elements = useRef(new Map<string, HTMLElement>());
  const tabStopKey = position(rows, focusedKey) ? focusedKey : position(rows, preferredKey) ? preferredKey : firstKey(rows, false);
  const register = useCallback((key: string, element: HTMLElement | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  }, []);
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, key: string) => {
    if (event.altKey || event.metaKey) return;
    const next = moveInRovingGrid(rows, key, event.key, event.ctrlKey, direction);
    const isMovementKey = event.key.startsWith('Arrow') || event.key === 'Home' || event.key === 'End';
    if (isMovementKey) event.preventDefault();
    if (next) elements.current.get(next)?.focus();
  };
  return { tabStopKey, register, handleKeyDown, setFocusedKey };
}
