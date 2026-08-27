export const CG_PAGER_DEFAULT_NUMERIC_BUTTONS = 7;
export const CG_PAGER_DEFAULT_AUTO_INPUT_THRESHOLD = 15;

export interface CgPagerWindow { readonly start: number; readonly count: number; readonly endInclusive: number }
export interface CgPagerItemRange { readonly first: number; readonly last: number }

export function normalizePageCount(pageCount: number): number {
  return Number.isFinite(pageCount) ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(pageCount))) : 0;
}

export function normalizePageSize(pageSize: number): number {
  return Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 1;
}

export function normalizeNumericButtonCount(count: number): number {
  return Number.isSafeInteger(count) && count > 0 ? count : 1;
}

export function clampPageIndex(pageIndex: number, pageCount: number): number {
  const pages = normalizePageCount(pageCount);
  if (!pages || !Number.isFinite(pageIndex) || pageIndex <= 0) return 0;
  return Math.min(Math.trunc(pageIndex), pages - 1);
}

export function toDisplayPageNumber(pageIndex: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.trunc(pageIndex)) + 1);
}

export function toPageIndex(displayPageNumber: number): number {
  return Math.max(0, Math.trunc(displayPageNumber) - 1);
}

export function calculatePageCount(totalItemCount: number, pageSize: number): number {
  if (!Number.isFinite(totalItemCount) || totalItemCount <= 0) return 0;
  const size = normalizePageSize(pageSize);
  return Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(totalItemCount)) / size));
}

export function calculatePageSkip(pageIndex: number, pageSize: number): number {
  const index = Math.max(0, Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0);
  const size = normalizePageSize(pageSize);
  return index > Math.floor(Number.MAX_SAFE_INTEGER / size) ? Number.MAX_SAFE_INTEGER : index * size;
}

export function calculatePageSkipChecked(pageIndex: number, pageSize: number): number {
  const skip = calculatePageSkip(pageIndex, pageSize);
  if (skip > 2_147_483_647) throw new RangeError(`Paging offset ${skip} exceeds Int32.MaxValue.`);
  return skip;
}

export function calculateNumericWindow(pageIndex: number, pageCount: number, visibleCount: number): CgPagerWindow {
  const pages = normalizePageCount(pageCount);
  if (!pages) return { start: 0, count: 0, endInclusive: 0 };
  const count = Math.min(pages, normalizeNumericButtonCount(visibleCount));
  const active = clampPageIndex(pageIndex, pages);
  const start = Math.max(0, Math.min(pages - count, active - Math.floor((count - 1) / 2)));
  return { start, count, endInclusive: start + count - 1 };
}

export function calculateVisibleItemRange(pageIndex: number, pageSize: number, totalItemCount?: number): CgPagerItemRange {
  if (totalItemCount !== undefined && (!Number.isFinite(totalItemCount) || totalItemCount <= 0)) return { first: 0, last: 0 };
  const skip = calculatePageSkip(pageIndex, pageSize);
  if (totalItemCount !== undefined && skip >= totalItemCount) return { first: 0, last: 0 };
  return { first: skip + 1, last: totalItemCount === undefined ? Math.min(Number.MAX_SAFE_INTEGER, skip + normalizePageSize(pageSize)) : Math.min(Math.trunc(totalItemCount), skip + normalizePageSize(pageSize)) };
}

export function preserveFirstItemPageIndex(oldPageIndex: number, oldPageSize: number, newPageSize: number): number {
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(calculatePageSkip(oldPageIndex, oldPageSize) / normalizePageSize(newPageSize)));
}

export function normalizePageSizeOptions(options: ReadonlyArray<number> | undefined, currentPageSize: number): ReadonlyArray<number> {
  const values = new Set((options ?? []).filter((value) => Number.isSafeInteger(value) && value > 0));
  values.add(normalizePageSize(currentPageSize));
  return Object.freeze([...values].sort((left, right) => left - right));
}

export function shouldUsePagerInput(pageCount: number, threshold: number): boolean {
  return threshold >= 1 && normalizePageCount(pageCount) >= threshold;
}
