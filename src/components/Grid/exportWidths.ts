import type { CgGridColumnDescriptor, CgGridColumnState } from './CgGrid.types';
function pixels(value: unknown): number | undefined {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.\d+)?(?:px)?$/.test(value.trim()) ? Number.parseFloat(value) : undefined;
  return number !== undefined && Number.isFinite(number) && number > 0 ? number : undefined;
}
export function gridExportWidth<T>(column: CgGridColumnDescriptor<T> & { readonly exportWidth?: number }, state?: CgGridColumnState, root?: HTMLElement | null): number | undefined {
  if (column.exportWidth !== undefined) {
    const width = pixels(column.exportWidth); if (width === undefined) throw new RangeError(`Grid exportWidth for "${column.fieldId}" must be positive and finite.`); return width;
  }
  const displayed = root?.querySelector<HTMLElement>(`th[data-column-id="${CSS.escape(column.fieldId)}"]`)?.getBoundingClientRect().width;
  return pixels(displayed) ?? pixels(state?.userWidth) ?? pixels(state?.measuredWidth) ?? pixels(column.width);
}
export function excelColumnWidth(pixels: number): number { return Math.round(Math.max(1 / 256, Math.min(255, pixels < 12 ? pixels / 12 : (pixels - 5) / 7)) * 256) / 256; }
