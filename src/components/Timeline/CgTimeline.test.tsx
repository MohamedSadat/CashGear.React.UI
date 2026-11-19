import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { dateOfDay, dayOfDate } from '../MonthCalendar/monthCalendarDates';
import { CgTimeline } from './CgTimeline';
import type { CgTimelineHandle, CgTimelineItem, CgTimelineLabels, CgTimelineMoveDetails } from './CgTimeline.types';

const arabicDate = new Intl.DateTimeFormat('ar', { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' });
const full = (date: string) => arabicDate.format(new Date(`${date}T00:00:00Z`));
const day = (date: string) => dayOfDate(date)!;

const labels: CgTimelineLabels = {
  grid: 'الجدول الزمني للمهام',
  previous: 'أيام سابقة',
  next: 'أيام لاحقة',
  today: 'اليوم',
  scales: { day: 'يوم', week: 'أسبوع', month: 'شهر', quarter: 'ربع' },
  scale: 'المقياس',
  item: (_item, info) => (info.end ? `${info.title}، من ${info.start} إلى ${info.end}` : `${info.title}، ${info.start}`),
  moveHint: 'Alt مع الأسهم ينقله',
  moved: (item, info) => `نُقل «${item.title}» إلى ${info.start}`,
  resized: (item, info) => `«${item.title}» من ${info.start} إلى ${info.end ?? info.start}`,
  noLane: 'بلا مرحلة',
  untitled: 'بلا عنوان',
};

const items: CgTimelineItem[] = [
  { key: 'budget', title: 'مراجعة الميزانية', start: '2026-11-16', lane: 'plan' },
  { key: 'quarter', title: 'إغلاق الربع', start: '2026-11-12', end: '2026-11-18', lane: 'plan', color: '#2e7d32' },
  { key: 'meeting', title: 'اجتماع الفريق', start: '2026-11-03T07:30:00Z', lane: 'run' },
  { key: 'deadline', title: 'موعد التسليم', start: '2026-11-20', end: '2026-11-20', movable: false, resizable: false, lane: 'run' },
  { key: 'undated', title: 'بلا تاريخ', start: '' },
  { key: 'stray', title: ' ', start: '2026-11-25', lane: 'gone' },
];
const lanes = [{ key: 'plan', title: 'التخطيط' }, { key: 'run', title: 'التنفيذ' }];

type HostProps = Partial<ComponentProps<typeof CgTimeline>> & {
  onMove?: (key: string, details: CgTimelineMoveDetails) => void;
  dir?: 'rtl' | 'ltr';
  /** Milliseconds before a move is written, as a caller that saves first; written at once without it. */
  defer?: number;
};

function Host({ onMove, dir = 'rtl', items: initial = items, defer, ...props }: HostProps) {
  const [list, setList] = useState(initial);
  return <div dir={dir}>
    <CgTimeline
      labels={labels}
      locale="ar"
      firstDayOfWeek="saturday"
      today="2026-11-16"
      timeZone="Asia/Riyadh"
      defaultStartDate="2026-11-01"
      onItemMove={(item, details) => {
        onMove?.(item.key, details);
        const write = () => setList((current) => current.map((entry) => (entry.key === item.key
          ? { ...entry, start: details.start, end: details.end, ...(details.lane === undefined ? {} : { lane: details.lane }) }
          : entry)));
        if (defer === undefined) write();
        else setTimeout(write, defer);
      }}
      {...props}
      items={list}
    />
  </div>;
}

const grid = () => screen.getByRole('grid', { name: labels.grid });
const bar = (title: string) => within(grid()).getByRole('button', { name: new RegExp(`^${title}`, 'u') });
const scroller = () => document.querySelector<HTMLElement>('[data-cg-timeline-scroller]')!;
const canvas = () => scroller().firstElementChild as HTMLElement;
const xOf = (element: HTMLElement) => parseFloat(element.style.getPropertyValue('--cg-timeline-x'));
const nextFrame = () => act(() => new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); }));

function pointer(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  return event;
}

const rect = (left: number, top: number, width: number, height: number) => () => DOMRect.fromRect({ x: left, y: top, width, height });

const inline = (dir: 'rtl' | 'ltr') => (dir === 'rtl' ? -scroller().scrollLeft : scroller().scrollLeft);

/**
 * Lays the scroller out at (0, 0), 1000 by 500 pixels, and the canvas under it as it is scrolled, as
 * a browser would: in right to left the canvas's inline start is its right edge.
 */
function layOut(dir: 'rtl' | 'ltr') {
  scroller().getBoundingClientRect = rect(0, 0, 1000, 500);
  canvas().getBoundingClientRect = () => (dir === 'rtl'
    ? DOMRect.fromRect({ x: 1000 + inline(dir) - 40_000, y: -scroller().scrollTop, width: 40_000, height: 5000 })
    : DOMRect.fromRect({ x: -inline(dir), y: -scroller().scrollTop, width: 40_000, height: 5000 }));
}

/** The viewport x of a point `offset` pixels from the canvas's inline start. */
const screenX = (offset: number, dir: 'rtl' | 'ltr') => (dir === 'rtl' ? 1000 + inline(dir) - offset : offset - inline(dir));

describe('CgTimeline', () => {
  it('is a named grid of lines, one per item with a readable start, the first line the one tab stop', () => {
    render(<Host />);
    expect(grid()).toHaveAttribute('aria-rowcount', '5');
    expect(within(grid()).getAllByRole('row')).toHaveLength(5);
    expect(bar('مراجعة الميزانية')).toHaveAccessibleName(`مراجعة الميزانية، ${full('2026-11-16')}`);
    expect(bar('إغلاق الربع')).toHaveAccessibleName(`إغلاق الربع، من ${full('2026-11-12')} إلى ${full('2026-11-18')}`);
    // 07:30 UTC is 10:30 in Riyadh, still the 3rd.
    expect(bar('اجتماع الفريق')).toHaveAccessibleName(`اجتماع الفريق، ${full('2026-11-03')}`);
    expect(bar('بلا عنوان')).toBeInTheDocument();
    expect(within(grid()).queryByRole('button', { name: /^بلا تاريخ/u })).toBeNull();
    expect(bar('مراجعة الميزانية')).toHaveAttribute('tabindex', '0');
    expect(within(grid()).getAllByRole('button').filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(bar('مراجعة الميزانية')).toHaveAccessibleDescription('Alt مع الأسهم ينقله');
    expect(bar('مراجعة الميزانية')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Control+Shift+ArrowLeft Control+Shift+ArrowRight');
    expect(bar('موعد التسليم')).not.toHaveAttribute('aria-keyshortcuts');
    // A bar's place and length come from its days: a week of 20-pixel days.
    expect(xOf(bar('مراجعة الميزانية')) - xOf(bar('إغلاق الربع'))).toBe(80);
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-w')).toBe('140px');
  });

  it('names an item by its title and days when no item label is given, and reads as read only without moves', () => {
    render(<Host labels={{ ...labels, item: undefined }} onItemMove={undefined} locale="en-US" />);
    expect(grid()).toHaveAttribute('aria-readonly', 'true');
    expect(bar('إغلاق الربع')).toHaveAccessibleName(/^إغلاق الربع November 12\s–\s18, 2026$/u);
    expect(bar('مراجعة الميزانية')).not.toHaveAttribute('aria-describedby');
  });

  it('draws only the lines in view of 50,000 items, and reaches any of them by the keys', async () => {
    const many = Array.from({ length: 50_000 }, (_, index): CgTimelineItem => ({
      key: `k${index}`, title: `مهمة ${index}`, start: dateOfDay(day('2026-01-01') + (index % 700)), end: dateOfDay(day('2026-01-03') + (index % 700)),
    }));
    const started = performance.now();
    render(<Host items={many} />);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(grid()).toHaveAttribute('aria-rowcount', '50000');
    expect(within(grid()).getAllByRole('row').length).toBeLessThan(50);
    act(() => bar('مهمة 0').focus());
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toHaveAccessibleName(/^مهمة 49999،/u);
    expect(within(grid()).getAllByRole('row').length).toBeLessThan(50);
    await userEvent.keyboard('{PageUp}');
    expect(document.activeElement).toHaveAccessibleName(/^مهمة 4998\d،/u);
    await userEvent.keyboard('{Control>}{Home}{/Control}');
    expect(document.activeElement).toHaveAccessibleName(/^مهمة 0،/u);
    // Scrolling draws the lines there.
    act(() => {
      scroller().scrollTop = 36 * 20_000;
      fireEvent.scroll(scroller());
    });
    expect(within(grid()).getAllByRole('row').some((row) => row.getAttribute('aria-rowindex') === '20001')).toBe(true);
    expect(within(grid()).getAllByRole('row').length).toBeLessThan(50);
  });

  it('moves between lines with the arrows, and opens a bar on a click, Enter or Space', async () => {
    const onItemOpen = vi.fn();
    render(<Host onItemOpen={onItemOpen} />);
    act(() => bar('مراجعة الميزانية').focus());
    await userEvent.keyboard('{ArrowDown}');
    expect(bar('إغلاق الربع')).toHaveFocus();
    expect(bar('إغلاق الربع')).toHaveAttribute('tabindex', '0');
    expect(bar('مراجعة الميزانية')).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{End}');
    expect(bar('بلا عنوان')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onItemOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'stray' }), { source: 'keyboard', anchor: bar('بلا عنوان') });
    await userEvent.keyboard(' ');
    expect(onItemOpen).toHaveBeenCalledTimes(2);
    fireEvent.click(bar('اجتماع الفريق'));
    expect(onItemOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'meeting' }), { source: 'pointer', anchor: bar('اجتماع الفريق') });
  });

  it('moves a focused bar a day with Alt and the arrows, mirrored in right to left, keeping focus, and says so', async () => {
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    act(() => bar('مراجعة الميزانية').focus());
    const before = xOf(bar('مراجعة الميزانية'));
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-17', end: null, days: 1, edge: 'move', source: 'keyboard' });
    expect(xOf(bar('مراجعة الميزانية'))).toBe(before + 20);
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    await nextFrame();
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «مراجعة الميزانية» إلى ${full('2026-11-17')}`);
    act(() => bar('اجتماع الفريق').focus());
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('meeting', { start: '2026-11-02T07:30:00Z', end: null, days: -1, edge: 'move', source: 'keyboard' });
    act(() => bar('موعد التسليم').focus());
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('changes an end with Alt+Shift and a start with Ctrl+Shift, never past each other', async () => {
    const onMove = vi.fn();
    render(<Host dir="ltr" onMove={onMove} />);
    act(() => bar('إغلاق الربع').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-12', end: '2026-11-19', days: 1, edge: 'end', source: 'keyboard' });
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-w')).toBe('160px');
    await userEvent.keyboard('{Control>}{Shift>}{ArrowLeft}{/Shift}{/Control}');
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-11', end: '2026-11-19', days: -1, edge: 'start', source: 'keyboard' });
    await nextFrame();
    expect(screen.getByRole('status')).toHaveTextContent(`«إغلاق الربع» من ${full('2026-11-11')} إلى ${full('2026-11-19')}`);
    // A one-day item's start cannot pass its end, but its end can grow, written in the start's form.
    act(() => bar('مراجعة الميزانية').focus());
    await userEvent.keyboard('{Control>}{Shift>}{ArrowRight}{/Shift}{/Control}');
    expect(onMove).toHaveBeenCalledTimes(2);
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{ArrowRight}{/Shift}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-16', end: '2026-11-18', days: 1, edge: 'end', source: 'keyboard' });
    // AltGr (Ctrl with Alt) changes nothing.
    await userEvent.keyboard('{Control>}{Alt>}{ArrowRight}{/Alt}{/Control}');
    expect(onMove).toHaveBeenCalledTimes(4);
  });

  it('keeps a fixed length for an item that is not resizable, and keeps every item still without onItemMove', async () => {
    const onMove = vi.fn();
    render(<Host dir="ltr" onMove={onMove} items={[{ key: 'fixed', title: 'ثابت الطول', start: '2026-11-10', end: '2026-11-12', resizable: false }]} />);
    act(() => bar('ثابت الطول').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowRight}{/Shift}{/Alt}{Control>}{Shift>}{ArrowLeft}{/Shift}{/Control}');
    expect(onMove).not.toHaveBeenCalled();
    expect(bar('ثابت الطول').querySelector('[data-cg-timeline-edge]')).toBeNull();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onMove).toHaveBeenCalledWith('fixed', { start: '2026-11-11', end: '2026-11-13', days: 1, edge: 'move', source: 'keyboard' });
  });

  it('creates on a double-clicked spot of a line, and with Shift+Enter on today when it is shown', async () => {
    const onCreate = vi.fn();
    render(<Host onCreate={onCreate} lanes={lanes} />);
    layOut('rtl');
    const budget = bar('مراجعة الميزانية');
    const line = budget.closest('[role="gridcell"]')!;
    // Right to left: three days after the budget's start is 60 pixels further left.
    fireEvent.doubleClick(line, { clientX: screenX(xOf(budget) + 60 + 10, 'rtl'), clientY: 100 });
    const anchor = document.querySelector<HTMLElement>('[data-cg-timeline-anchor]')!;
    expect(onCreate).toHaveBeenLastCalledWith('2026-11-19', 'plan', { source: 'doubleClick', anchor });
    expect(xOf(anchor)).toBe(xOf(budget) + 60);
    fireEvent.doubleClick(budget, { clientX: screenX(xOf(budget) + 10, 'rtl'), clientY: 100 });
    expect(onCreate).toHaveBeenCalledTimes(1);
    act(() => bar('اجتماع الفريق').focus());
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onCreate).toHaveBeenLastCalledWith('2026-11-16', 'run', { source: 'keyboard', anchor });
    expect(bar('اجتماع الفريق')).toHaveAttribute('aria-keyshortcuts', expect.stringContaining('Shift+Enter'));
  });

  it('groups lines under lanes that collapse, the items of unlisted lanes under the last one', async () => {
    const onCollapsedLanesChange = vi.fn();
    render(<Host lanes={lanes} onCollapsedLanesChange={onCollapsedLanesChange} />);
    const rows = within(grid()).getAllByRole('row');
    expect(rows).toHaveLength(8);
    const plan = within(grid()).getByRole('button', { name: 'التخطيط' });
    expect(plan).toHaveAttribute('aria-expanded', 'true');
    expect(plan).toHaveAttribute('tabindex', '0');
    expect(within(grid()).getByRole('button', { name: 'بلا مرحلة' })).toBeInTheDocument();
    expect(rows.map((row) => row.getAttribute('aria-rowindex'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    await userEvent.click(plan);
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith(['plan']);
    expect(plan).toHaveAttribute('aria-expanded', 'false');
    expect(within(grid()).queryByRole('button', { name: /^مراجعة الميزانية/u })).toBeNull();
    expect(grid()).toHaveAttribute('aria-rowcount', '6');
    await userEvent.keyboard('{ArrowDown}');
    expect(within(grid()).getByRole('button', { name: 'التنفيذ' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith(['plan', 'run']);
  });

  it('names a lane\'s button by labels.lane, and follows controlled collapsed lanes', () => {
    render(<Host lanes={lanes} collapsedLanes={[null]} labels={{ ...labels, lane: (title, count) => `${title} (${count})` }} />);
    expect(within(grid()).getByRole('button', { name: 'بلا مرحلة (1)' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(grid()).queryByRole('button', { name: /^بلا عنوان/u })).toBeNull();
    expect(within(grid()).getByRole('button', { name: 'التخطيط (2)' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('drags a bar by whole days, writing the DOM while it moves and reporting only the drop', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host dir="ltr" onMove={onMove} />);
    layOut('ltr');
    const quarter = bar('إغلاق الربع');
    const x = screenX(xOf(quarter) + 10, 'ltr');
    fireEvent.pointerDown(quarter, { button: 0, pointerId: 1, clientX: x, clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', x + 65, 100)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(quarter).toHaveAttribute('data-cg-dragging');
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-x')).toBe(`${xOf(quarter) + 60}px`);
    expect(onMove).not.toHaveBeenCalled();
    act(() => { window.dispatchEvent(pointer('pointerup', x + 65, 100)); });
    expect(onMove).toHaveBeenCalledWith('quarter', { start: '2026-11-15', end: '2026-11-21', days: 3, edge: 'move', source: 'pointer' });
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-x')).toBe('');
    expect(quarter).not.toHaveAttribute('data-cg-dragging');
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «إغلاق الربع» إلى ${full('2026-11-15')}`);
  });

  it('resizes a bar from an edge, mirrored in right to left, and drops nothing on Escape', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    layOut('rtl');
    const quarter = bar('إغلاق الربع');
    const end = quarter.querySelector<HTMLElement>('[data-cg-timeline-edge="end"]')!;
    // The end edge is at the bar's inline end: in right to left, to its left.
    const x = screenX(xOf(quarter) + 140 - 5, 'rtl');
    fireEvent.pointerDown(end, { button: 0, pointerId: 1, clientX: x, clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', x - 40, 100)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-w')).toBe('180px');
    act(() => { window.dispatchEvent(pointer('pointerup', x - 40, 100)); });
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-12', end: '2026-11-20', days: 2, edge: 'end', source: 'pointer' });

    const start = bar('إغلاق الربع').querySelector<HTMLElement>('[data-cg-timeline-edge="start"]')!;
    const from = screenX(xOf(bar('إغلاق الربع')) + 5, 'rtl');
    fireEvent.pointerDown(start, { button: 0, pointerId: 1, clientX: from, clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', from - 400, 100)); });
    act(() => { vi.advanceTimersByTime(20); });
    // Past its end, the start stops on the end's day.
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-drag-w')).toBe('20px');
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    act(() => { window.dispatchEvent(pointer('pointerup', from - 400, 100)); });
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-drag-w')).toBe('');
    expect(onMove).toHaveBeenCalledTimes(1);

    // Nothing drags an item that cannot move.
    const deadline = bar('موعد التسليم');
    fireEvent.pointerDown(deadline, { button: 0, pointerId: 1, clientX: screenX(xOf(deadline) + 10, 'rtl'), clientY: 100 });
    act(() => { window.dispatchEvent(pointer('pointermove', screenX(xOf(deadline) + 10, 'rtl') - 200, 100)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(deadline).not.toHaveAttribute('data-cg-dragging');
    act(() => { window.dispatchEvent(pointer('pointerup', screenX(xOf(deadline) + 10, 'rtl') - 200, 100)); });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('finds, marks and scrolls to days and items through actionsRef', () => {
    const handle = createRef<CgTimelineHandle>();
    render(<Host actionsRef={handle} lanes={lanes} />);
    layOut('rtl');
    const budget = bar('مراجعة الميزانية');
    // Lines start under the 56-pixel header; the budget is the second line.
    expect(handle.current!.dateAt(screenX(xOf(budget) + 10, 'rtl'), 56 + 36 + 10)).toBe('2026-11-16');
    expect(handle.current!.dateAt(screenX(xOf(budget) + 10, 'rtl'), 20)).toBeNull();
    expect(handle.current!.dateAt(1200, 200)).toBeNull();
    expect(handle.current!.laneAt(500, 56 + 36 + 10)).toEqual({ lane: 'plan' });
    expect(handle.current!.laneAt(500, 56 + 7 * 36 + 10)).toEqual({ lane: null });
    expect(handle.current!.laneAt(500, 56 + 9 * 36 + 10)).toBeNull();
    act(() => handle.current!.markDropDate('2026-11-18'));
    const mark = document.querySelector<HTMLElement>('[data-cg-timeline-drop]')!;
    expect(mark).toHaveAttribute('data-shown');
    expect(xOf(mark)).toBe(xOf(budget) + 40);
    act(() => handle.current!.markDropDate(null));
    expect(mark).not.toHaveAttribute('data-shown');
    expect(handle.current!.getItemElement('budget')).toBe(budget);
    expect(handle.current!.getItemElement('undated')).toBeNull();
    expect(handle.current!.scrollToItem('undated')).toBe(false);
    expect(handle.current!.scrollToItem('stray')).toBe(true);
    act(() => handle.current!.scrollToDate('2026-11-16'));
    expect(-scroller().scrollLeft).toBe(xOf(budget));
    expect(() => handle.current!.scrollToDate('16/11/2026')).toThrow(RangeError);
  });

  it('reports the days shown once they settle, again after a scroll, and keeps the middle day when the scale changes', async () => {
    const onRangeChange = vi.fn();
    const onScaleChange = vi.fn();
    render(<Host onRangeChange={onRangeChange} onScaleChange={onScaleChange} rangeChangeDelay={10} />);
    // Unmeasured, the view is taken as 960 pixels: 48 days of 20 pixels.
    await waitFor(() => expect(onRangeChange).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-12-18' }));
    expect(grid()).toHaveAccessibleDescription(/.+/u);
    act(() => {
      scroller().scrollLeft -= 7 * 20;
      fireEvent.scroll(scroller());
    });
    await waitFor(() => expect(onRangeChange).toHaveBeenLastCalledWith({ from: '2026-11-08', to: '2026-12-25' }));
    const week = screen.getByRole('button', { name: 'أسبوع' });
    expect(week).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'شهر' }));
    expect(onScaleChange).toHaveBeenCalledWith('month', { previousScale: 'week' });
    expect(screen.getByRole('button', { name: 'شهر' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('[data-cg-timeline]')).toHaveAttribute('data-scale', 'month');
    await waitFor(() => expect(onRangeChange.mock.lastCall?.[0].from).not.toBe('2026-11-08'));
    const { from, to } = onRangeChange.mock.lastCall![0] as { from: string; to: string };
    // The day in the middle of the view (2 December) stays in the middle, give or take a day.
    expect(Math.abs((day(from) + day(to)) / 2 - day('2026-12-01'))).toBeLessThanOrEqual(1);
  });

  it('pages earlier and later and goes back to today with its buttons', async () => {
    const onRangeChange = vi.fn();
    render(<Host onRangeChange={onRangeChange} rangeChangeDelay={0} />);
    await waitFor(() => expect(onRangeChange).toHaveBeenCalledTimes(1));
    const first = -scroller().scrollLeft;
    await userEvent.click(screen.getByRole('button', { name: 'أيام لاحقة' }));
    expect(-scroller().scrollLeft).toBeCloseTo(first + 960 * 0.8);
    await userEvent.click(screen.getByRole('button', { name: 'أيام سابقة' }));
    await userEvent.click(screen.getByRole('button', { name: 'أيام سابقة' }));
    expect(-scroller().scrollLeft).toBeCloseTo(first - 960 * 0.8);
    await userEvent.click(screen.getByRole('button', { name: 'اليوم' }));
    // Today sits a fifth of the way in.
    expect(-scroller().scrollLeft).toBeCloseTo(first + 15 * 20 - 960 * 0.2);
  });

  it('writes a two-tier header in the locale, today marked, weeks from the first day of the week', () => {
    const { rerender } = render(<Host scale="day" />);
    const today = document.querySelector<HTMLElement>('[data-today]')!;
    expect(today).toHaveTextContent(new Intl.DateTimeFormat('ar', { day: 'numeric', timeZone: 'UTC' }).format(new Date('2026-11-16T00:00:00Z')));
    expect(document.querySelector('[data-cg-timeline-scroller] [aria-hidden="true"]')).toHaveTextContent(new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date('2026-11-16T00:00:00Z')));
    rerender(<Host scale="week" />);
    // Saturday 14 November starts a week.
    const weekStart = new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date('2026-11-14T00:00:00Z'));
    expect(screen.getAllByText(weekStart).length).toBeGreaterThan(0);
  });

  it('refuses empty labels, missing move labels and bad values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Host labels={{ ...labels, grid: ' ' }} />)).toThrow(/labels\.grid/u);
    expect(() => render(<Host labels={{ ...labels, today: '' }} />)).toThrow(/labels\.today/u);
    expect(() => render(<Host labels={{ ...labels, resized: undefined }} />)).toThrow(/labels\.moved and labels\.resized/u);
    expect(() => render(<Host labels={{ ...labels, scale: undefined }} />)).toThrow(/labels\.scale/u);
    expect(() => render(<Host labels={{ ...labels, noLane: undefined }} lanes={lanes} />)).toThrow(/labels\.noLane/u);
    expect(() => render(<Host lineHeight={20} />)).toThrow(/lineHeight/u);
    expect(() => render(<Host timeZone="Mars/Olympus" />)).toThrow(/timeZone/u);
    expect(() => render(<Host defaultStartDate="soon" />)).toThrow(/defaultStartDate/u);
    // Without the toolbar, its labels are not needed.
    render(<Host showToolbar={false} labels={{ ...labels, previous: '', next: '', today: '' }} />);
    expect(screen.queryByRole('button', { name: 'اليوم' })).toBeNull();
  });
});

const laneLabels: CgTimelineLabels = { ...labels, movedLane: (item, info) => `نُقل «${item.title}» إلى ${info.lane}، ${info.start}` };
const rowOf = (element: Element | null) => element?.closest('[role="row"]')?.getAttribute('aria-rowindex');
/** The middle of a line under the 56-pixel header, the scroller laid out at (0, 0) and not scrolled. */
const lineY = (index: number) => 56 + index * 36 + 18;

/** A drag of `element` pressed at (x, y): `to` moves the pointer and draws a frame, `drop` releases it. */
function press(element: HTMLElement, x: number, y: number) {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1, clientX: x, clientY: y });
  return {
    to: (toX: number, toY: number) => {
      act(() => { window.dispatchEvent(pointer('pointermove', toX, toY)); });
      act(() => { vi.advanceTimersByTime(20); });
    },
    drop: (toX: number, toY: number) => act(() => { window.dispatchEvent(pointer('pointerup', toX, toY)); }),
  };
}

describe('CgTimeline moving between lanes', () => {
  // Lines: التخطيط, budget, quarter, التنفيذ, meeting, deadline, بلا مرحلة, stray.

  it('moves a focused bar to the lane above or below with Alt+ArrowUp and Alt+ArrowDown, never mirrored, its days kept and the focus on it', async () => {
    const onMove = vi.fn();
    const { rerender } = render(<Host onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} />);
    expect(bar('مراجعة الميزانية')).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowLeft Alt+Shift+ArrowRight Control+Shift+ArrowLeft Control+Shift+ArrowRight');
    expect(bar('موعد التسليم')).not.toHaveAttribute('aria-keyshortcuts');
    act(() => bar('مراجعة الميزانية').focus());
    // The first lane has none above it.
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(onMove).not.toHaveBeenCalled();
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-16', end: null, days: 0, edge: 'move', source: 'keyboard', lane: 'run' });
    // Under التنفيذ now, first there as it is first in the caller's order, and still focused.
    expect(rowOf(bar('مراجعة الميزانية'))).toBe('4');
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    await nextFrame();
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «مراجعة الميزانية» إلى التنفيذ، ${full('2026-11-16')}`);
    // The last lane, of unlisted items, is no lane.
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-16', end: null, days: 0, edge: 'move', source: 'keyboard', lane: null });
    expect(rowOf(bar('مراجعة الميزانية'))).toBe('7');
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    await nextFrame();
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «مراجعة الميزانية» إلى بلا مرحلة، ${full('2026-11-16')}`);
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(2);

    // Left to right the same keys go the same way, and the day keys are as they were.
    rerender(<Host dir="ltr" onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} />);
    act(() => bar('مراجعة الميزانية').focus());
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-16', end: null, days: 0, edge: 'move', source: 'keyboard', lane: 'run' });
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-17', end: null, days: 1, edge: 'move', source: 'keyboard' });
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    // An item that cannot move keeps its lane, and Shift with the lane keys does nothing.
    act(() => bar('موعد التسليم').focus());
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}{Control>}{Alt>}{ArrowUp}{/Alt}{/Control}');
    act(() => bar('اجتماع الفريق').focus());
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(4);
    expect(bar('اجتماع الفريق')).toHaveFocus();
  });

  it('moves a bar into a collapsed lane by keys, the focus going to that lane\'s header', async () => {
    const onMove = vi.fn();
    render(<Host onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} defaultCollapsedLanes={['run']} />);
    act(() => bar('إغلاق الربع').focus());
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-12', end: '2026-11-18', days: 0, edge: 'move', source: 'keyboard', lane: 'run' });
    expect(within(grid()).queryByRole('button', { name: /^إغلاق الربع/u })).toBeNull();
    const run = within(grid()).getByRole('button', { name: 'التنفيذ' });
    expect(run).toHaveFocus();
    expect(run).toHaveAttribute('tabindex', '0');
    expect(run).toHaveAttribute('aria-expanded', 'false');
  });

  it('follows a bar to its new lane once a caller that saves first has moved it there, unless the focus has moved on', async () => {
    const onMove = vi.fn();
    // Long enough that the keys are pressed before the caller writes, however busy the machine.
    render(<Host onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} defer={250} />);
    act(() => bar('مراجعة الميزانية').focus());
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(rowOf(bar('مراجعة الميزانية'))).toBe('2');
    await waitFor(() => expect(rowOf(bar('مراجعة الميزانية'))).toBe('4'));
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    // Moved back up, then the focus goes to the next line before the caller writes it: it stays there.
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}{ArrowDown}');
    expect(bar('اجتماع الفريق')).toHaveFocus();
    await waitFor(() => expect(rowOf(bar('مراجعة الميزانية'))).toBe('2'));
    expect(bar('اجتماع الفريق')).toHaveFocus();
  });

  it('drags a bar onto another lane\'s lines while it moves by whole days, marking that lane, and reports both in one call', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host dir="ltr" onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} />);
    layOut('ltr');
    // Its height too, so following a dropped bar to a line in view does not scroll.
    Object.defineProperty(scroller(), 'clientHeight', { configurable: true, value: 500 });
    const quarter = bar('إغلاق الربع');
    const mark = document.querySelector<HTMLElement>('[data-cg-timeline-lane-drop]')!;
    expect(mark).not.toHaveAttribute('data-shown');
    const x = screenX(xOf(quarter) + 10, 'ltr');
    const drag = press(quarter, x, lineY(2));
    // Two days later, over meeting's line in التنفيذ: drawn there, the lane's three lines marked.
    drag.to(x + 45, lineY(4));
    expect(quarter).toHaveAttribute('data-cg-dragging');
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-x')).toBe(`${xOf(quarter) + 40}px`);
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-y')).toBe('72px');
    expect(mark).toHaveAttribute('data-shown');
    expect(mark).toHaveAttribute('data-lane', 'run');
    expect(mark.style.getPropertyValue('--cg-timeline-y')).toBe('108px');
    expect(mark.style.getPropertyValue('--cg-timeline-h')).toBe('108px');
    // Over its own lane again: back on its own line, nothing marked.
    drag.to(x + 45, lineY(1));
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    expect(mark).not.toHaveAttribute('data-shown');
    // The last lane's header line is no lane.
    drag.to(x + 45, lineY(6));
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-y')).toBe('144px');
    expect(mark).toHaveAttribute('data-lane', '');
    expect(mark.style.getPropertyValue('--cg-timeline-h')).toBe('72px');
    drag.to(x + 45, lineY(4));
    expect(onMove).not.toHaveBeenCalled();
    drag.drop(x + 45, lineY(4));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('quarter', { start: '2026-11-14', end: '2026-11-20', days: 2, edge: 'move', source: 'pointer', lane: 'run' });
    expect(mark).not.toHaveAttribute('data-shown');
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    expect(bar('إغلاق الربع')).not.toHaveAttribute('data-cg-dragging');
    expect(rowOf(bar('إغلاق الربع'))).toBe('4');
    // The focus follows the dropped bar to its new line, which is in view.
    expect(bar('إغلاق الربع')).toHaveFocus();
    expect(scroller().scrollTop).toBe(0);
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «إغلاق الربع» إلى التنفيذ، ${full('2026-11-14')}`);

    // Dragged only up and down within its lane, nothing changes.
    const budget = bar('مراجعة الميزانية');
    const from = screenX(xOf(budget) + 10, 'ltr');
    const still = press(budget, from, lineY(1));
    still.to(from, lineY(0));
    still.drop(from, lineY(0));
    expect(onMove).toHaveBeenCalledTimes(1);

    // An edge changes its days only, wherever the pointer is.
    const end = bar('إغلاق الربع').querySelector<HTMLElement>('[data-cg-timeline-edge="end"]')!;
    const edgeX = screenX(xOf(bar('إغلاق الربع')) + 140 - 5, 'ltr');
    const resize = press(end, edgeX, lineY(3));
    resize.to(edgeX + 40, lineY(1));
    expect(bar('إغلاق الربع').style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    expect(mark).not.toHaveAttribute('data-shown');
    resize.drop(edgeX + 40, lineY(1));
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-14', end: '2026-11-22', days: 2, edge: 'end', source: 'pointer' });
  });

  it('takes a drop on a collapsed lane\'s header, keeps a pointer over the header or past the lines on the lines shown, and drops nothing on Escape', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host onMove={onMove} lanes={lanes} moveBetweenLanes labels={laneLabels} defaultCollapsedLanes={['run']} />);
    // Lines: التخطيط, budget, quarter, التنفيذ (collapsed), بلا مرحلة, stray.
    layOut('rtl');
    // Near the scroller's edges the drag scrolls it; jsdom has no scrolling of its own.
    const scrollBy = vi.fn();
    scroller().scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
    const mark = document.querySelector<HTMLElement>('[data-cg-timeline-lane-drop]')!;
    const budget = bar('مراجعة الميزانية');
    const x = screenX(xOf(budget) + 10, 'rtl');
    const drag = press(budget, x, lineY(1));
    drag.to(x, lineY(3));
    expect(budget.style.getPropertyValue('--cg-timeline-drag-y')).toBe('72px');
    expect(mark).toHaveAttribute('data-lane', 'run');
    expect(mark.style.getPropertyValue('--cg-timeline-h')).toBe('36px');
    // Over the header: the first line shown, its own lane, and the lines scroll up.
    drag.to(x, 20);
    expect(budget.style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    expect(mark).not.toHaveAttribute('data-shown');
    expect(scrollBy).toHaveBeenLastCalledWith(0, expect.any(Number));
    expect(scrollBy.mock.lastCall![1]).toBeLessThan(0);
    // Past the last line, near the bottom: the last line, and the lines scroll down.
    drag.to(x, 480);
    expect(budget.style.getPropertyValue('--cg-timeline-drag-y')).toBe(`${4 * 36}px`);
    expect(mark).toHaveAttribute('data-lane', '');
    expect(scrollBy.mock.lastCall![1]).toBeGreaterThan(0);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(budget.style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    expect(budget).not.toHaveAttribute('data-cg-dragging');
    expect(mark).not.toHaveAttribute('data-shown');
    drag.drop(x, 480);
    expect(onMove).not.toHaveBeenCalled();

    // A day later (further left in right to left), onto the collapsed lane's header.
    const into = press(budget, x, lineY(1));
    into.to(x - 25, lineY(3));
    into.drop(x - 25, lineY(3));
    expect(onMove).toHaveBeenCalledWith('budget', { start: '2026-11-17', end: null, days: 1, edge: 'move', source: 'pointer', lane: 'run' });
    expect(within(grid()).queryByRole('button', { name: /^مراجعة الميزانية/u })).toBeNull();
  });

  it('moves a bar between lanes of 50,000 items, drawing only the lines in view, its new line scrolled into view', async () => {
    const many = Array.from({ length: 50_000 }, (_, index): CgTimelineItem => ({
      key: `k${index}`, title: `مهمة ${index}`, start: dateOfDay(day('2026-11-01') + (index % 30)), lane: index % 2 ? 'run' : 'plan',
    }));
    render(<Host items={many} lanes={lanes} moveBetweenLanes labels={laneLabels} />);
    act(() => bar('مهمة 0').focus());
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    // التخطيط and its other 24,999 items, then التنفيذ: k0 is first there.
    expect(document.activeElement).toHaveAccessibleName(/^مهمة 0،/u);
    expect(rowOf(document.activeElement)).toBe('25002');
    expect(scroller().scrollTop).toBe(25_001 * 36);
    expect(within(grid()).getAllByRole('row').length).toBeLessThan(50);
  });

  it('changes no lane without moveBetweenLanes, and needs labels.movedLane with it', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    const { unmount } = render(<Host dir="ltr" onMove={onMove} lanes={lanes} />);
    expect(document.querySelector('[data-cg-timeline-lane-drop]')).toBeNull();
    expect(bar('مراجعة الميزانية')).not.toHaveAttribute('aria-keyshortcuts', expect.stringContaining('ArrowUp'));
    layOut('ltr');
    const quarter = bar('إغلاق الربع');
    const x = screenX(xOf(quarter) + 10, 'ltr');
    const drag = press(quarter, x, lineY(2));
    drag.to(x + 45, lineY(4));
    expect(quarter.style.getPropertyValue('--cg-timeline-drag-y')).toBe('');
    drag.drop(x + 45, lineY(4));
    expect(onMove).toHaveBeenCalledWith('quarter', { start: '2026-11-14', end: '2026-11-20', days: 2, edge: 'move', source: 'pointer' });
    expect(onMove.mock.lastCall![1]).not.toHaveProperty('lane');
    act(() => bar('مراجعة الميزانية').focus());
    fireEvent.keyDown(bar('مراجعة الميزانية'), { key: 'ArrowDown', altKey: true });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(bar('مراجعة الميزانية')).toHaveFocus();
    unmount();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Host moveBetweenLanes lanes={lanes} />)).toThrow(/labels\.movedLane/u);
    // Without onItemMove nothing moves, so it is not needed.
    render(<Host moveBetweenLanes lanes={lanes} onItemMove={undefined} />);
    expect(document.querySelector('[data-cg-timeline-lane-drop]')).toBeNull();
  });
});
