import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CgPager,
  calculateNumericWindow,
  calculatePageCount,
  calculatePageSkip,
  calculatePageSkipChecked,
  calculateVisibleItemRange,
  normalizePageSizeOptions,
  parsePagerDisplayNumber,
  preserveFirstItemPageIndex,
  type CgPagerActions,
} from '../src';

describe('paging arithmetic', () => {
  it('is zero-based, overflow-safe, centered, and preserves the first visible item', () => {
    expect(calculatePageCount(101, 25)).toBe(5);
    expect(calculatePageCount(0, 25)).toBe(0);
    expect(calculatePageSkip(Number.MAX_SAFE_INTEGER, 50)).toBe(Number.MAX_SAFE_INTEGER);
    expect(() => calculatePageSkipChecked(2_147_483_647, 2)).toThrow(RangeError);
    expect(calculateNumericWindow(50, 100, 7)).toEqual({ start: 47, count: 7, endInclusive: 53 });
    expect(calculateVisibleItemRange(2, 25, 63)).toEqual({ first: 51, last: 63 });
    expect(preserveFirstItemPageIndex(4, 25, 40)).toBe(2);
    expect(normalizePageSizeOptions([50, -1, 10, 50], 25)).toEqual([10, 25, 50]);
  });

  it('parses decimal digits from Latin, Arabic-Indic, and extended Arabic-Indic scripts', () => {
    expect(parsePagerDisplayNumber('123')).toBe(123);
    expect(parsePagerDisplayNumber('١٢')).toBe(12);
    expect(parsePagerDisplayNumber('۱۲')).toBe(12);
    expect(parsePagerDisplayNumber('1x')).toBeNull();
  });
});

describe('CgPager', () => {
  it('uses authoritative pageCount and keeps controlled state authoritative', async () => {
    const change = vi.fn();
    render(<CgPager pageIndex={1} pageCount={4} totalItemCount={999} pageSize={10} mode="numericButtons" onPageIndexChange={change} />);
    expect(screen.getAllByRole('button', { name: /page/iu })).toHaveLength(8);
    await userEvent.click(screen.getByRole('button', { name: 'Go to page 4' }));
    expect(change).toHaveBeenCalledWith(3, { previousPageIndex: 1, pageIndex: 3, reason: 'numericButton' });
    expect(screen.getByRole('button', { name: 'Page 2, current page' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps input drafts across rerenders, accepts Arabic digits, clamps ranges, and restores on Escape', async () => {
    const change = vi.fn();
    const { rerender } = render(<CgPager pageIndex={2} pageCount={10} mode="inputBox" onPageIndexChange={change} />);
    const input = screen.getByRole('textbox', { name: 'Page' });
    await userEvent.clear(input);
    await userEvent.type(input, '١٢');
    rerender(<CgPager pageIndex={2} pageCount={10} mode="inputBox" onPageIndexChange={change} className="rerendered" />);
    expect(input).toHaveValue('١٢');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(change).toHaveBeenCalledWith(9, expect.objectContaining({ reason: 'inputCommit' }));
    expect(input).toHaveValue('3');
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(/between 1 and 10/u);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('3');
  });

  it('deduplicates controlled page-count clamp proposals', async () => {
    const change = vi.fn();
    const { rerender } = render(<CgPager pageIndex={9} pageCount={5} onPageIndexChange={change} />);
    await act(async () => { await Promise.resolve(); });
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith(4, expect.objectContaining({ reason: 'pageCountClamp' }));
    rerender(<CgPager pageIndex={9} pageCount={5} onPageIndexChange={change} className="again" />);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('reports one combined page-size transition and preserves the first visible item', async () => {
    const sizeChange = vi.fn();
    render(<CgPager defaultPageIndex={4} defaultPageSize={25} totalItemCount={500} showPageSizeSelector pageSizeOptions={[25, 40]} preserveFirstVisibleItemOnPageSizeChange onPageSizeChange={sizeChange} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /rows per page/i }), '40');
    expect(sizeChange).toHaveBeenCalledWith(40, { previousPageSize: 25, pageSize: 40, previousPageIndex: 4, pageIndex: 2, preserveFirstVisibleItem: true });
    expect(screen.getByText('Items 81-120 of 500')).toBeInTheDocument();
  });

  it('uses chronological keyboard navigation in RTL and permits programmatic read-only navigation', () => {
    const change = vi.fn();
    const actions = createRef<CgPagerActions>();
    render(<CgPager pageIndex={2} pageCount={6} mode="numericButtons" direction="rtl" readOnly actionsRef={actions} onPageIndexChange={change} />);
    const active = screen.getByRole('button', { name: 'Page 3, current page' });
    fireEvent.keyDown(active, { key: 'ArrowRight' });
    expect(change).not.toHaveBeenCalled();
    expect(actions.current?.goToNextPage()).toBe(true);
    expect(change).toHaveBeenCalledWith(3, expect.objectContaining({ reason: 'programmatic' }));
  });

  it('keeps the compact Grid layout on the same controlled paging state machine', async () => {
    const change = vi.fn();
    render(<CgPager layout="compact" mode="pageStatus" pageIndex={1} pageSize={25} pageCount={4} totalItemCount={90} showPageSizeSelector renderSummary={({ displayPageNumber, pageCount }) => `90 records · Page ${displayPageNumber} of ${pageCount}`} onPageIndexChange={change} />);
    expect(screen.getByText('90 records · Page 2 of 4')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(change).toHaveBeenCalledWith(2, expect.objectContaining({ reason: 'nextButton' }));
  });
});
