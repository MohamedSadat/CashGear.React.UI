import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cgTrackDrag } from '../DragDrop';
import { CgMonthCalendar } from './CgMonthCalendar';
import type { CgMonthCalendarHandle, CgMonthCalendarItem, CgMonthCalendarLabels, CgMonthCalendarMoveDetails, CgMonthCalendarSelectedDayChangeDetails } from './CgMonthCalendar.types';
import { dayOfDate } from './monthCalendarDates';

const arabicDate = new Intl.DateTimeFormat('ar', { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' });
const englishDate = new Intl.DateTimeFormat('en-US', { calendar: 'gregory', timeZone: 'UTC', dateStyle: 'full' });
const full = (date: string) => arabicDate.format(new Date(`${date}T00:00:00Z`));

const labels: CgMonthCalendarLabels = {
  grid: 'تقويم المهام',
  previousMonth: 'الشهر السابق',
  nextMonth: 'الشهر التالي',
  today: 'اليوم',
  more: (count) => `+${count} أخرى`,
  moreLabel: (count, date) => `${count} أخرى في ${date}`,
  dayItems: (date) => `عناصر ${date}`,
  create: (date) => `جديد في ${date}`,
  moved: (item, date) => `نُقل «${item.title}» إلى ${date}`,
  item: (_item, info) => (info.end ? `${info.title}، من ${info.start} إلى ${info.end}` : info.time ? `${info.time} ${info.title}` : info.title),
  moveHint: 'Alt والأسهم تنقله',
  weekItems: (start, end) => `عناصر الأسبوع من ${start} إلى ${end}`,
  untitled: 'بلا عنوان',
};

const busy = [1, 2, 3, 4, 5].map((n): CgMonthCalendarItem => ({ key: `busy${n}`, title: `مهمة ${n}`, start: '2026-11-24' }));
const items: CgMonthCalendarItem[] = [
  { key: 'budget', title: 'مراجعة الميزانية', start: '2026-11-16' },
  { key: 'quarter', title: 'إغلاق الربع', start: '2026-11-12', end: '2026-11-18', color: '#2e7d32' },
  { key: 'meeting', title: 'اجتماع الفريق', start: '2026-11-03T07:30:00Z' },
  { key: 'deadline', title: 'موعد التسليم', start: '2026-11-20', end: '2026-11-20', movable: false },
  { key: 'blank', title: ' ', start: '2026-11-05' },
  ...busy,
];

type HostProps = Partial<ComponentProps<typeof CgMonthCalendar>> & { onMove?: (key: string, details: CgMonthCalendarMoveDetails) => void; dir?: 'rtl' | 'ltr' };

function Host({ onMove, dir = 'rtl', ...props }: HostProps) {
  const [list, setList] = useState(items);
  return <div dir={dir}>
    <CgMonthCalendar
      items={list}
      labels={labels}
      locale="ar"
      firstDayOfWeek="saturday"
      today="2026-11-16"
      timeZone="Asia/Riyadh"
      defaultMonth={props.month === undefined ? '2026-11' : undefined}
      onItemMove={(item, details) => {
        onMove?.(item.key, details);
        setList((current) => current.map((entry) => (entry.key === item.key ? { ...entry, start: details.start, end: details.end } : entry)));
      }}
      {...props}
    />
  </div>;
}

const cell = (date: string) => screen.getByRole('gridcell', { name: full(date) });
const bars = (name: RegExp | string) => within(screen.getByRole('grid')).getAllByRole('button', { name });
const nextFrame = () => act(() => new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); }));

function pointer(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, button: 0 });
  return event;
}

/** Lays the day cells out as 100-pixel squares, a week to a row, as a browser would, in a scroller far larger. */
function layOutDays() {
  const grid = screen.getByRole('grid');
  grid.parentElement!.getBoundingClientRect = () => DOMRect.fromRect({ x: -1000, y: -1000, width: 4000, height: 4000 });
  grid.querySelectorAll<HTMLElement>('[data-cg-month-day]').forEach((element, index) => {
    const left = (index % 7) * 100;
    const top = Math.floor(index / 7) * 100;
    element.getBoundingClientRect = () => ({ x: left, y: top, left, top, right: left + 100, bottom: top + 100, width: 100, height: 100, toJSON: () => ({}) });
  });
}

describe('CgMonthCalendar', () => {
  it('draws a named grid of weeks from the first day given, today marked, the other months dimmed, one tab stop', () => {
    render(<Host />);
    const grid = screen.getByRole('grid', { name: 'تقويم المهام' });
    expect(grid).toHaveAccessibleDescription('نوفمبر 2026');
    expect(screen.getByText('نوفمبر 2026')).toHaveAttribute('aria-live', 'polite');
    const headers = within(grid).getAllByRole('columnheader');
    expect(headers.map((header) => header.getAttribute('aria-label'))).toEqual(['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']);
    expect(within(grid).getAllByRole('row')).toHaveLength(6);
    const today = cell('2026-11-16');
    expect(today).toHaveAttribute('aria-current', 'date');
    expect(today).toHaveAttribute('aria-selected', 'true');
    expect(today).toHaveAttribute('tabindex', '0');
    expect(grid.querySelectorAll('[data-cg-month-day][tabindex="0"]')).toHaveLength(1);
    expect(cell('2026-10-31')).toHaveAttribute('data-outside');
    expect(cell('2026-11-01')).not.toHaveAttribute('data-outside');
    expect(within(grid).getByRole('gridcell', { name: `عناصر الأسبوع من ${full('2026-11-14')} إلى ${full('2026-11-20')}` })).toBeInTheDocument();
  });

  it('draws items as bars across their days and weeks, with times, colours and names from the labels', () => {
    render(<Host />);
    const quarter = bars(`إغلاق الربع، من ${full('2026-11-12')} إلى ${full('2026-11-18')}`);
    expect(quarter).toHaveLength(2);
    expect(quarter[0]).toHaveAttribute('data-continues-after');
    expect(quarter[1]).toHaveAttribute('data-continues-before');
    expect(quarter[0]!.style.getPropertyValue('--cg-month-calendar-item-color')).toBe('#2e7d32');
    const meeting = bars(/اجتماع الفريق/u)[0]!;
    expect(meeting.dataset.firstDay).toBe(String(dayOfDate('2026-11-03')));
    expect(meeting).toHaveTextContent('10:30');
    const deadline = bars('موعد التسليم');
    expect(deadline).toHaveLength(1);
    expect(deadline[0]).not.toHaveAttribute('aria-keyshortcuts');
    const budget = bars('مراجعة الميزانية')[0]!;
    expect(budget).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown');
    expect(budget).toHaveAccessibleDescription('Alt والأسهم تنقله');
    expect(bars('بلا عنوان')[0]).toHaveTextContent('بلا عنوان');
    // The items on the selected day follow it in the tab order; the others wait.
    expect(budget).toHaveAttribute('tabindex', '0');
    expect(quarter[1]).toHaveAttribute('tabindex', '0');
    expect(quarter[0]).toHaveAttribute('tabindex', '-1');
  });

  it('shows what fits and a "+N more" that lists every item of the day', async () => {
    const onItemOpen = vi.fn();
    render(<Host onItemOpen={onItemOpen} />);
    expect(screen.queryByRole('button', { name: 'مهمة 4' })).toBeNull();
    const more = screen.getByRole('button', { name: `2 أخرى في ${full('2026-11-24')}` });
    expect(more).toHaveTextContent('+2 أخرى');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    // The list is drawn once it is placed, which needs sizes jsdom does not measure.
    const measured = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 20, y: 20, width: 120, height: 40 }));
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const list = await screen.findByRole('dialog', { name: `عناصر ${full('2026-11-24')}` });
    const choices = within(list).getAllByRole('button');
    expect(choices.map((choice) => choice.textContent)).toEqual(['مهمة 1', 'مهمة 2', 'مهمة 3', 'مهمة 4', 'مهمة 5']);
    await waitFor(() => expect(choices[0]).toHaveFocus());
    fireEvent.click(within(list).getByRole('button', { name: 'مهمة 5' }));
    expect(onItemOpen).toHaveBeenCalledWith(expect.objectContaining({ key: 'busy5' }), expect.objectContaining({ source: 'list', anchor: cell('2026-11-24') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    measured.mockRestore();
  });

  it('walks the days with the arrows mirrored in right to left, Home and End by the week, PageDown by the month', async () => {
    const onMonthChange = vi.fn();
    render(<Host onMonthChange={onMonthChange} />);
    act(() => cell('2026-11-16').focus());
    await userEvent.keyboard('{ArrowLeft}');
    expect(cell('2026-11-17')).toHaveFocus();
    expect(cell('2026-11-17')).toHaveAttribute('tabindex', '0');
    expect(cell('2026-11-16')).toHaveAttribute('tabindex', '-1');
    await userEvent.keyboard('{ArrowRight}{ArrowRight}{ArrowDown}');
    expect(cell('2026-11-22')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(cell('2026-11-21')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(cell('2026-11-27')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(cell('2026-11-20')).toHaveFocus();
    await userEvent.keyboard('{PageDown}');
    expect(screen.getByText('ديسمبر 2026')).toBeInTheDocument();
    expect(cell('2026-12-20')).toHaveFocus();
    expect(onMonthChange).toHaveBeenLastCalledWith('2026-12', { reason: 'keyboard', previousMonth: '2026-11' });
    await userEvent.keyboard('{Shift>}{PageUp}{/Shift}');
    expect(screen.getByText('ديسمبر 2025')).toBeInTheDocument();
    expect(cell('2025-12-20')).toHaveFocus();
  });

  it('walks left to right in English with Sunday first, the right arrow going forward', async () => {
    render(<CgMonthCalendar items={[]} labels={{ ...labels, grid: 'Calendar' }} locale="en-US" firstDayOfWeek="sunday" today="2026-11-16" timeZone="UTC" />);
    const grid = screen.getByRole('grid', { name: 'Calendar' });
    expect(within(grid).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    const day = (date: string) => screen.getByRole('gridcell', { name: englishDate.format(new Date(`${date}T00:00:00Z`)) });
    expect(day('2026-11-01')).not.toHaveAttribute('data-outside');
    act(() => day('2026-11-16').focus());
    await userEvent.keyboard('{ArrowRight}');
    expect(day('2026-11-17')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(day('2026-11-15')).toHaveFocus();
  });

  it('turns the month with its buttons, controlled or not', () => {
    const onMonthChange = vi.fn();
    function Controlled() {
      const [month, setMonth] = useState('2026-11');
      return <><Host month={month} onMonthChange={(next, details) => { onMonthChange(next, details); setMonth(next); }} /><output data-testid="month">{month}</output></>;
    }
    render(<Controlled />);
    fireEvent.click(screen.getByRole('button', { name: 'الشهر التالي' }));
    expect(screen.getByTestId('month')).toHaveTextContent('2026-12');
    expect(screen.getByText('ديسمبر 2026')).toBeInTheDocument();
    expect(cell('2026-12-01')).toHaveAttribute('tabindex', '0');
    fireEvent.click(screen.getByRole('button', { name: 'الشهر السابق' }));
    fireEvent.click(screen.getByRole('button', { name: 'الشهر السابق' }));
    expect(screen.getByTestId('month')).toHaveTextContent('2026-10');
    fireEvent.click(screen.getByRole('button', { name: 'اليوم' }));
    expect(screen.getByTestId('month')).toHaveTextContent('2026-11');
    expect(cell('2026-11-16')).toHaveAttribute('tabindex', '0');
    expect(onMonthChange.mock.calls.map(([, details]) => (details as { reason: string }).reason)).toEqual(['next', 'previous', 'previous', 'today']);
  });

  it('keeps a controlled month the caller does not change', () => {
    const onMonthChange = vi.fn();
    render(<Host month="2026-11" onMonthChange={onMonthChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'الشهر التالي' }));
    expect(onMonthChange).toHaveBeenCalledWith('2026-12', { reason: 'next', previousMonth: '2026-11' });
    expect(screen.getByText('نوفمبر 2026')).toBeInTheDocument();
  });

  it('asks to create on a day from its "+", a double click or Enter, and has no "+" without onCreate', async () => {
    const onCreate = vi.fn();
    const { rerender } = render(<Host onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: `جديد في ${full('2026-11-16')}` }));
    expect(onCreate).toHaveBeenLastCalledWith('2026-11-16', { source: 'button', anchor: cell('2026-11-16') });
    fireEvent.doubleClick(cell('2026-11-09'));
    expect(onCreate).toHaveBeenLastCalledWith('2026-11-09', { source: 'doubleClick', anchor: cell('2026-11-09') });
    fireEvent.doubleClick(screen.getByRole('button', { name: `جديد في ${full('2026-11-16')}` }));
    expect(onCreate).toHaveBeenCalledTimes(2);
    act(() => cell('2026-11-16').focus());
    await userEvent.keyboard('{Enter}');
    expect(onCreate).toHaveBeenLastCalledWith('2026-11-16', { source: 'keyboard', anchor: cell('2026-11-16') });
    rerender(<Host />);
    expect(screen.queryByRole('button', { name: /جديد في/u })).toBeNull();
  });

  it('opens an item on a click, Enter or Space', async () => {
    const onItemOpen = vi.fn();
    render(<Host onItemOpen={onItemOpen} />);
    const budget = bars('مراجعة الميزانية')[0]!;
    fireEvent.click(budget);
    expect(onItemOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'budget' }), { source: 'pointer', anchor: budget });
    act(() => budget.focus());
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onItemOpen).toHaveBeenCalledTimes(3);
    expect(onItemOpen).toHaveBeenLastCalledWith(expect.objectContaining({ key: 'budget' }), { source: 'keyboard', anchor: budget });
  });

  it('moves an item with Alt and the arrows (mirrored in right to left), keeping its length, focus on it, and says so', async () => {
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    act(() => bars('مراجعة الميزانية')[0]!.focus());
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('budget', { start: '2026-11-17', end: null, days: 1, source: 'keyboard' });
    const moved = bars('مراجعة الميزانية')[0]!;
    expect(moved.dataset.firstDay).toBe(String(dayOfDate('2026-11-17')));
    expect(moved).toHaveFocus();
    expect(cell('2026-11-17')).toHaveAttribute('tabindex', '0');
    await nextFrame();
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «مراجعة الميزانية» إلى ${full('2026-11-17')}`);
    const quarter = bars(/إغلاق الربع/u)[1]!;
    act(() => quarter.focus());
    await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onMove).toHaveBeenLastCalledWith('quarter', { start: '2026-11-19', end: '2026-11-25', days: 7, source: 'keyboard' });
    expect(bars(/إغلاق الربع/u).map((bar) => bar.dataset.firstDay)).toEqual([String(dayOfDate('2026-11-19')), String(dayOfDate('2026-11-21'))]);
    expect(document.activeElement).toHaveAttribute('data-cg-month-item', 'quarter');
    act(() => bars('موعد التسليم')[0]!.focus());
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it('moves an item to the day it is dropped on, marking the days it would cover while dragging', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    layOutDays();
    // The grid starts on Saturday 31 October: 16 November is the 17th cell (row 2, column 2).
    const quarter = bars(/إغلاق الربع/u)[1]!;
    fireEvent.pointerDown(quarter, { button: 0, pointerId: 1, clientX: 250, clientY: 250 });
    act(() => { window.dispatchEvent(pointer('pointermove', 350, 350)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(quarter).toHaveAttribute('data-cg-dragging');
    const marked = [...screen.getByRole('grid').querySelectorAll<HTMLElement>('[data-drop]')].map((element) => Number(element.dataset.cgMonthDay));
    expect(marked).toEqual([20, 21, 22, 23, 24, 25, 26].map((date) => dayOfDate(`2026-11-${date}`)));
    act(() => { window.dispatchEvent(pointer('pointerup', 350, 350)); });
    expect(onMove).toHaveBeenCalledWith('quarter', { start: '2026-11-20', end: '2026-11-26', days: 8, source: 'pointer' });
    expect(screen.getByRole('grid').querySelectorAll('[data-drop]')).toHaveLength(0);
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('status')).toHaveTextContent(`نُقل «إغلاق الربع» إلى ${full('2026-11-20')}`);
  });

  it('drops nothing when Escape ends the drag, and drags nothing that cannot move', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const onMove = vi.fn();
    render(<Host onMove={onMove} />);
    layOutDays();
    const budget = bars('مراجعة الميزانية')[0]!;
    fireEvent.pointerDown(budget, { button: 0, pointerId: 1, clientX: 250, clientY: 250 });
    act(() => { window.dispatchEvent(pointer('pointermove', 450, 250)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('grid').querySelectorAll('[data-drop]')).toHaveLength(1);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    act(() => { window.dispatchEvent(pointer('pointerup', 450, 250)); });
    expect(screen.getByRole('grid').querySelectorAll('[data-drop]')).toHaveLength(0);
    const deadline = bars('موعد التسليم')[0]!;
    fireEvent.pointerDown(deadline, { button: 0, pointerId: 1, clientX: 650, clientY: 250 });
    act(() => { window.dispatchEvent(pointer('pointermove', 250, 350)); });
    act(() => { window.dispatchEvent(pointer('pointerup', 250, 350)); });
    expect(deadline).not.toHaveAttribute('data-cg-dragging');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('draws items through renderItem with their context', () => {
    const renderItem = vi.fn((item: CgMonthCalendarItem, context: { time: string | null; continuesBefore: boolean }) => <b>{`${item.key}${context.continuesBefore ? '…' : ''}`}</b>);
    render(<Host renderItem={renderItem} />);
    expect(bars(/إغلاق الربع/u).map((bar) => bar.textContent)).toEqual(['quarter', 'quarter…']);
    expect(renderItem).toHaveBeenCalledWith(expect.objectContaining({ key: 'meeting' }), expect.objectContaining({ time: expect.stringContaining('10:30') as string, placement: 'bar', span: 1 }));
  });

  it('needs its labels, and a sound month, today and row count', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = { items: [], today: '2026-11-16' };
    expect(() => render(<CgMonthCalendar {...base} labels={{ ...labels, grid: ' ' }} />)).toThrow(/labels\.grid/u);
    expect(() => render(<CgMonthCalendar {...base} labels={{ ...labels, today: '' }} />)).toThrow(/labels\.today/u);
    expect(() => render(<CgMonthCalendar {...base} labels={{ ...labels, create: undefined }} onCreate={() => undefined} />)).toThrow(/labels\.create/u);
    expect(() => render(<CgMonthCalendar {...base} labels={{ ...labels, moved: undefined }} onItemMove={() => undefined} />)).toThrow(/labels\.moved/u);
    expect(() => render(<CgMonthCalendar {...base} labels={labels} maxItemRows={0} />)).toThrow(RangeError);
    expect(() => render(<CgMonthCalendar {...base} labels={labels} month="2026-13" />)).toThrow(/2026-13/u);
    expect(() => render(<CgMonthCalendar {...base} labels={labels} today="16/11/2026" />)).toThrow(/today/u);
    expect(() => render(<CgMonthCalendar {...base} labels={labels} timeZone="Mars/Olympus" />)).toThrow(/timeZone/u);
  });
});

describe('CgMonthCalendar from outside the grid', () => {
  it('finds the day under a viewport point, only where the grid is visible', () => {
    const handle = createRef<CgMonthCalendarHandle>();
    render(<Host actionsRef={handle} />);
    layOutDays();
    // The grid starts on Saturday 31 October: 16 November is the 17th cell (row 2, column 2).
    expect(handle.current!.dayAt(250, 250)).toBe('2026-11-16');
    expect(handle.current!.dayAt(50, 50)).toBe('2026-10-31');
    expect(handle.current!.dayAt(699, 499)).toBe('2026-12-04');
    expect(handle.current!.dayAt(250, 520)).toBeNull();
    expect(handle.current!.dayAt(750, 250)).toBeNull();
    expect(handle.current!.dayAt(-5, 250)).toBeNull();
    // A cell scrolled out of the scroller's box is not under the point.
    screen.getByRole('grid').parentElement!.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 700, height: 250 });
    expect(handle.current!.dayAt(250, 240)).toBe('2026-11-16');
    expect(handle.current!.dayAt(250, 260)).toBeNull();
  });

  it('marks one drop day in the DOM without drawing again, and gives a day cell', () => {
    const handle = createRef<CgMonthCalendarHandle>();
    const renderItem = vi.fn((item: CgMonthCalendarItem) => item.title);
    render(<Host actionsRef={handle} renderItem={renderItem} />);
    const drawn = renderItem.mock.calls.length;
    const dropDays = () => [...screen.getByRole('grid').querySelectorAll('[data-drop]')];
    handle.current!.markDropDay('2026-11-16');
    expect(dropDays()).toEqual([cell('2026-11-16')]);
    handle.current!.markDropDay('2026-11-17');
    expect(dropDays()).toEqual([cell('2026-11-17')]);
    handle.current!.markDropDay('2027-03-01');
    expect(dropDays()).toEqual([]);
    handle.current!.markDropDay('2026-12-05');
    handle.current!.markDropDay(null);
    expect(dropDays()).toEqual([]);
    expect(renderItem).toHaveBeenCalledTimes(drawn);
    expect(handle.current!.getDayElement('2026-11-16')).toBe(cell('2026-11-16'));
    expect(handle.current!.getDayElement('2026-10-31')).toBe(cell('2026-10-31'));
    expect(handle.current!.getDayElement('2026-12-25')).toBeNull();
    expect(() => handle.current!.markDropDay('16/11/2026')).toThrow(RangeError);
    expect(() => handle.current!.getDayElement('2026-02-30')).toThrow(/getDayElement '2026-02-30'/u);
    expect(() => handle.current!.startCreate('')).toThrow(RangeError);
  });

  it('marks and finds the day under a drag from a list of its own, as a drag in the grid does', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] });
    const handle = createRef<CgMonthCalendarHandle>();
    const onDrop = vi.fn();
    render(<>
      <Host actionsRef={handle} />
      <button
        type="button"
        onPointerDown={(event) => cgTrackDrag(event, event.currentTarget, {
          ghost: false,
          onMove: (x, y) => handle.current?.markDropDay(handle.current.dayAt(x, y)),
          onDrop: (x, y) => { handle.current?.markDropDay(null); onDrop(handle.current?.dayAt(x, y)); },
          onCancel: () => handle.current?.markDropDay(null),
        })}
      >بلا تاريخ</button>
    </>);
    layOutDays();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'بلا تاريخ' }), { button: 0, pointerId: 1, clientX: 900, clientY: 900 });
    act(() => { window.dispatchEvent(pointer('pointermove', 250, 250)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(cell('2026-11-16')).toHaveAttribute('data-drop');
    act(() => { window.dispatchEvent(pointer('pointermove', 950, 250)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(screen.getByRole('grid').querySelectorAll('[data-drop]')).toHaveLength(0);
    act(() => { window.dispatchEvent(pointer('pointermove', 350, 250)); });
    act(() => { vi.advanceTimersByTime(20); });
    expect(cell('2026-11-17')).toHaveAttribute('data-drop');
    act(() => { window.dispatchEvent(pointer('pointerup', 350, 250)); });
    expect(onDrop).toHaveBeenCalledWith('2026-11-17');
    expect(screen.getByRole('grid').querySelectorAll('[data-drop]')).toHaveLength(0);
  });

  it('lets the caller hold the selected day: keys, clicks, the month buttons and moves report it', async () => {
    const onSelectedDayChange = vi.fn<(date: string, details: CgMonthCalendarSelectedDayChangeDetails) => void>();
    function Controlled() {
      const [day, setDay] = useState('2026-12-05');
      return <>
        <Host defaultMonth={undefined} selectedDay={day} onSelectedDayChange={(date, details) => { onSelectedDayChange(date, details); setDay(date); }} />
        <output data-testid="day">{day}</output>
      </>;
    }
    render(<Controlled />);
    // With no month given, the selected day's is shown.
    expect(screen.getByText('ديسمبر 2026')).toBeInTheDocument();
    expect(cell('2026-12-05')).toHaveAttribute('aria-selected', 'true');
    expect(cell('2026-12-05')).toHaveAttribute('tabindex', '0');
    act(() => cell('2026-12-05').focus());
    expect(onSelectedDayChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2026-12-06', { reason: 'keyboard', previousDay: '2026-12-05' });
    expect(cell('2026-12-06')).toHaveFocus();
    expect(screen.getByTestId('day')).toHaveTextContent('2026-12-06');
    await userEvent.click(cell('2026-12-10'));
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2026-12-10', { reason: 'focus', previousDay: '2026-12-06' });
    expect(cell('2026-12-10')).toHaveAttribute('tabindex', '0');
    fireEvent.click(screen.getByRole('button', { name: 'الشهر التالي' }));
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2027-01-01', { reason: 'next', previousDay: '2026-12-10' });
    fireEvent.click(screen.getByRole('button', { name: 'اليوم' }));
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2026-11-16', { reason: 'today', previousDay: '2027-01-01' });
    expect(screen.getByText('نوفمبر 2026')).toBeInTheDocument();
    act(() => bars('مراجعة الميزانية')[0]!.focus());
    await userEvent.keyboard('{Alt>}{ArrowLeft}{/Alt}');
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2026-11-17', { reason: 'move', previousDay: '2026-11-16' });
    expect(screen.getByTestId('day')).toHaveTextContent('2026-11-17');
    expect(onSelectedDayChange).toHaveBeenCalledTimes(5);
  });

  it('keeps a controlled selected day the caller does not change, and starts uncontrolled on defaultSelectedDay', async () => {
    const onSelectedDayChange = vi.fn();
    const { unmount } = render(<Host selectedDay="2026-11-10" onSelectedDayChange={onSelectedDayChange} />);
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '0');
    act(() => cell('2026-11-10').focus());
    await userEvent.keyboard('{ArrowLeft}');
    expect(onSelectedDayChange).toHaveBeenCalledWith('2026-11-11', { reason: 'keyboard', previousDay: '2026-11-10' });
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '0');
    expect(cell('2026-11-11')).toHaveAttribute('tabindex', '-1');
    unmount();
    render(<Host defaultMonth={undefined} defaultSelectedDay="2027-02-14" />);
    expect(screen.getByText('فبراير 2027')).toBeInTheDocument();
    expect(cell('2027-02-14')).toHaveAttribute('aria-selected', 'true');
    expect(cell('2027-02-14')).toHaveAttribute('tabindex', '0');
  });

  it('needs a sound selected day', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgMonthCalendar items={[]} labels={labels} today="2026-11-16" selectedDay="tomorrow" />)).toThrow(/selectedDay 'tomorrow'/u);
    expect(() => render(<CgMonthCalendar items={[]} labels={labels} today="2026-11-16" defaultSelectedDay="2026-13-01" />)).toThrow(/defaultSelectedDay/u);
  });

  it('starts a create on a day from outside: turns to its month, selects and focuses it, then calls onCreate with its cell', () => {
    const handle = createRef<CgMonthCalendarHandle>();
    const onCreate = vi.fn();
    const onMonthChange = vi.fn();
    const onSelectedDayChange = vi.fn();
    render(<Host actionsRef={handle} onCreate={onCreate} onMonthChange={onMonthChange} onSelectedDayChange={onSelectedDayChange} />);
    act(() => handle.current!.startCreate('2026-11-20'));
    expect(cell('2026-11-20')).toHaveFocus();
    expect(cell('2026-11-20')).toHaveAttribute('tabindex', '0');
    expect(onCreate).toHaveBeenCalledWith('2026-11-20', { source: 'programmatic', anchor: cell('2026-11-20') });
    expect(onSelectedDayChange).toHaveBeenLastCalledWith('2026-11-20', { reason: 'programmatic', previousDay: '2026-11-16' });
    expect(onMonthChange).not.toHaveBeenCalled();
    act(() => handle.current!.startCreate('2027-01-05'));
    expect(onMonthChange).toHaveBeenCalledWith('2027-01', { reason: 'programmatic', previousMonth: '2026-11' });
    expect(screen.getByText('يناير 2027')).toBeInTheDocument();
    expect(cell('2027-01-05')).toHaveFocus();
    expect(onCreate).toHaveBeenLastCalledWith('2027-01-05', { source: 'programmatic', anchor: cell('2027-01-05') });
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it('does not create on a day a controlled month keeps out of view, and only selects without onCreate', () => {
    const handle = createRef<CgMonthCalendarHandle>();
    const onCreate = vi.fn();
    const { unmount } = render(<Host month="2026-11" actionsRef={handle} onCreate={onCreate} />);
    act(() => handle.current!.startCreate('2027-01-05'));
    expect(screen.getByText('نوفمبر 2026')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
    unmount();
    render(<Host actionsRef={handle} />);
    act(() => handle.current!.startCreate('2026-11-09'));
    expect(cell('2026-11-09')).toHaveFocus();
    expect(cell('2026-11-09')).toHaveAttribute('aria-selected', 'true');
  });
});
