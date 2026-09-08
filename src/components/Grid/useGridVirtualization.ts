/* eslint-disable react-hooks/immutability -- Imperative scrolling mutates the referenced DOM element, not React props. */
import { useLayoutEffect, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import { flushSync } from 'react-dom';
import { useStableCallback } from '../../hooks';
import type { NormalizedGridColumn } from './columns';
import type { CgGridVirtualizationStatus } from './CgGrid.types';

export type GridColumnSlot<T> = { kind: 'column'; column: NormalizedGridColumn<T>; index: number; width: number }
  | { kind: 'gap'; key: string; width: number };
export function useGridVirtualization<T>(scroller: RefObject<HTMLDivElement | null>, columns: readonly NormalizedGridColumn<T>[], count: number,
  options: { rows: boolean; columns: boolean; rowHeight: number; rowOverscan: number; columnOverscan: number; stickyHeader: boolean; fallback?: CgGridVirtualizationStatus['rowFallback']; focusedRow: number; focusedColumn?: string | null; direction: 'ltr' | 'rtl' }) {
  const [target, setTarget] = useState<{ row: number; column: string } | null>(null);
  const [metrics, setMetrics] = useState({ top: 0, left: 0, height: 0, width: 0, header: 0, focusedColumn: undefined as string | undefined });
  const capture = useStableCallback(() => {
    const node = scroller.current;
    if (node) setMetrics({ top: node.scrollTop, left: Math.abs(node.scrollLeft), height: node.clientHeight, width: node.clientWidth, header: node.querySelector('thead')?.getBoundingClientRect().height ?? 0, focusedColumn: node.contains(document.activeElement) ? document.activeElement?.closest<HTMLElement>('[data-column-id]')?.dataset.columnId : undefined });
  });
  const rowEnabled = options.rows && !options.fallback;
  const fixedColumns = columns.every((column) => column.width === undefined || typeof column.width === 'number' && Number.isFinite(column.width) && column.width > 0);
  const columnEnabled = options.columns && fixedColumns && options.fallback !== 'editing';
  useLayoutEffect(() => {
    if (!options.rows && !options.columns) return;
    const node = scroller.current;
    if (!node) return;
    capture();
    let frame = 0;
    const update = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; capture(); }); };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(node);
    const header = node.querySelector('thead');
    if (header) observer?.observe(header);
    node.addEventListener('scroll', update, { passive: true });
    node.addEventListener('focusin', capture);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); node.removeEventListener('scroll', update); node.removeEventListener('focusin', capture); };
  }, [capture, options.rows, options.columns, scroller]);
  const widths = columns.map((column) => Math.max(column.descriptor.minWidth ?? 1, Math.min(column.descriptor.maxWidth ?? Infinity, typeof column.width === 'number' && column.width > 0 && Number.isFinite(column.width) ? column.width : 160)));
  const offsets = [0];
  widths.forEach((width) => offsets.push(offsets.at(-1)! + width));
  const frozenWidth = columns.reduce((sum, column, index) => sum + (column.frozen ? widths[index]! : 0), 0);
  const visibleCount = Math.max(1, Math.ceil(Math.max(0, metrics.height - (options.stickyHeader ? metrics.header : 0)) / options.rowHeight));
  const start = rowEnabled ? Math.max(0, Math.min(Math.max(0, count - visibleCount), Math.floor(Math.max(0, metrics.top - (options.stickyHeader ? 0 : metrics.header)) / options.rowHeight) - options.rowOverscan)) : 0;
  const end = rowEnabled ? Math.min(count, start + visibleCount + options.rowOverscan * 2) : count;
  const rowIndices = Array.from({ length: end - start }, (_, index) => start + index);
  if (rowEnabled && options.focusedRow >= 0 && options.focusedRow < count && !rowIndices.includes(options.focusedRow)) rowIndices.push(options.focusedRow);
  if (rowEnabled && target && target.row < count && !rowIndices.includes(target.row)) rowIndices.push(target.row);
  rowIndices.sort((a, b) => a - b);
  const columnStart = Math.max(0, columns.findIndex((_, index) => offsets[index + 1]! > metrics.left + frozenWidth) - options.columnOverscan);
  const boundary = columns.findIndex((_, index) => offsets[index]! >= metrics.left + metrics.width);
  const columnEnd = boundary < 0 ? columns.length : Math.min(columns.length, boundary + options.columnOverscan);
  const slots: GridColumnSlot<T>[] = [];
  columns.forEach((column, index) => {
    if (!columnEnabled || column.frozen || column.fieldId === options.focusedColumn || column.fieldId === target?.column || column.fieldId === metrics.focusedColumn || index >= columnStart && index < columnEnd) slots.push({ kind: 'column', column: columnEnabled ? { ...column, width: widths[index]! } : column, index, width: widths[index]! });
    else {
      const previous = slots.at(-1);
      if (previous?.kind === 'gap') previous.width += widths[index]!;
      else slots.push({ kind: 'gap', key: `gap-${index}`, width: widths[index]! });
    }
  });
  const status = useMemo<CgGridVirtualizationStatus>(() => ({ rows: rowEnabled, columns: columnEnabled, rowStart: start, rowEnd: end,
    rowFallback: options.rows ? options.fallback : 'disabled', columnFallback: !options.columns ? 'disabled' : !fixedColumns ? 'nonNumericWidths' : options.fallback === 'editing' ? 'editing' : undefined }),
  [rowEnabled, columnEnabled, start, end, options.rows, options.columns, options.fallback, fixedColumns]);
  const reveal = (row: number, fieldId: string) => {
    const node = scroller.current;
    if (!node || !rowEnabled && !columnEnabled) return;
    const header = node.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    if (rowEnabled) {
      const top = row * options.rowHeight + (options.stickyHeader ? 0 : header);
      const available = node.clientHeight - (options.stickyHeader ? header : 0);
      if (top < node.scrollTop) node.scrollTop = top;
      else if (top + options.rowHeight > node.scrollTop + available) node.scrollTop = Math.max(0, top + options.rowHeight - available);
    }
    const column = columns.findIndex((entry) => entry.fieldId === fieldId);
    if (columnEnabled && column >= 0 && !columns[column]!.frozen) {
      let left = Math.abs(node.scrollLeft);
      if (offsets[column]! < left + frozenWidth) left = Math.max(0, offsets[column]! - frozenWidth);
      else if (offsets[column + 1]! > left + node.clientWidth) left = offsets[column + 1]! - node.clientWidth;
      node.scrollLeft = options.direction === 'rtl' ? -left : left;
    }
    flushSync(() => { setTarget({ row, column: fieldId }); capture(); });
  };
  return { status, slots, rowIndices, reveal, totalWidth: offsets.at(-1)!, rowEnabled, columnEnabled };
}
