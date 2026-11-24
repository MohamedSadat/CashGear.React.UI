import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgRecurrenceFields } from './CgRecurrenceFields';
import type { CgRecurrenceFieldsLabels, CgRecurrenceFieldsProps, CgRecurrenceRule } from './CgRecurrenceFields.types';

const labels: CgRecurrenceFieldsLabels = {
  legend: 'التكرار',
  frequency: 'يتكرر',
  frequencies: { none: 'لا يتكرر', daily: 'يومياً', weekly: 'أسبوعياً', monthly: 'شهرياً', yearly: 'سنوياً' },
  interval: 'كل',
  intervalUnit: (frequency, interval) => ({ daily: 'يوم', weekly: 'أسبوع', monthly: 'شهر', yearly: 'سنة' }[frequency] + (interval > 1 ? ' (عدة)' : '')),
  weekDays: 'في أيام',
  weekOfMonth: 'في',
  weeksOfMonth: { none: 'يوم من الشهر', first: 'الأسبوع الأول', second: 'الأسبوع الثاني', third: 'الأسبوع الثالث', fourth: 'الأسبوع الرابع', last: 'الأسبوع الأخير' },
  dayOfMonth: 'اليوم',
  month: 'الشهر',
  range: 'ينتهي',
  ranges: { noEndDate: 'أبداً', occurrenceCount: 'بعد عدد', endByDate: 'في تاريخ' },
  occurrenceCount: 'عدد المرات',
  endDate: 'تاريخ الانتهاء',
};

function Controlled({ initial, onRule, ...props }: Omit<CgRecurrenceFieldsProps, 'value' | 'onChange' | 'labels'> & { initial: CgRecurrenceRule; onRule?: (rule: CgRecurrenceRule) => void }) {
  const [rule, setRule] = useState(initial);
  return <CgRecurrenceFields {...props} labels={labels} value={rule} onChange={(next) => { setRule(next); onRule?.(next); }} />;
}

const weekdayNames = () => within(screen.getByRole('group', { name: 'في أيام' })).getAllByRole('checkbox').map((box) => box.closest('label')!.textContent);

describe('CgRecurrenceFields', () => {
  it('is a group named by its legend, with the caller\'s words and only the frequency until it repeats', () => {
    const onRule = vi.fn();
    render(<Controlled initial={{ frequency: 'none' }} locale="ar" onRule={onRule} />);
    const group = screen.getByRole('group', { name: 'التكرار' });
    const frequency = within(group).getByRole('combobox', { name: 'يتكرر' });
    expect(within(frequency).getAllByRole('option').map((option) => option.textContent)).toEqual(['لا يتكرر', 'يومياً', 'أسبوعياً', 'شهرياً', 'سنوياً']);
    expect(within(group).queryByRole('spinbutton')).toBeNull();
    fireEvent.change(frequency, { target: { value: 'weekly' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'weekly' });
    expect(screen.getByRole('spinbutton', { name: 'كل' })).toHaveValue(1);
    expect(screen.getByRole('spinbutton', { name: 'كل' })).toHaveAccessibleDescription('أسبوع');
  });

  it('starts the weekdays on the locale\'s first day, or the one given', () => {
    const { unmount } = render(<Controlled initial={{ frequency: 'weekly' }} locale="ar" />);
    expect(weekdayNames()[0]).toBe(new Intl.DateTimeFormat('ar', { weekday: 'short', timeZone: 'UTC' }).format(Date.UTC(2026, 8, 12)));
    unmount();
    const { unmount: next } = render(<Controlled initial={{ frequency: 'weekly' }} locale="en-US" />);
    expect(weekdayNames()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    next();
    render(<Controlled initial={{ frequency: 'weekly' }} locale="en-US" firstDayOfWeek="monday" />);
    expect(weekdayNames()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('chooses weekdays and keeps fields it does not know, a scheduler\'s exceptions among them', () => {
    const onRule = vi.fn();
    const exceptions = [{ originalStart: '2026-12-02T09:00:00Z', isDeleted: true }];
    render(<Controlled initial={{ frequency: 'weekly', weekDays: ['monday'], exceptions } as CgRecurrenceRule} locale="en-US" onRule={onRule} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wed' }));
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'weekly', weekDays: ['monday', 'wednesday'], exceptions });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'weekly', weekDays: ['wednesday'], exceptions });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'كل' }), { target: { value: '3' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'weekly', weekDays: ['wednesday'], exceptions, interval: 3 });
    expect(screen.getByRole('spinbutton', { name: 'كل' })).toHaveAccessibleDescription('أسبوع (عدة)');
  });

  it('offers weekdays for a daily rule only when asked', () => {
    const { unmount } = render(<Controlled initial={{ frequency: 'daily' }} />);
    expect(screen.queryByRole('group', { name: 'في أيام' })).toBeNull();
    unmount();
    render(<Controlled initial={{ frequency: 'daily' }} dailyWeekDays />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });

  it('repeats monthly on a day of the month, or on weekdays of a week', () => {
    const onRule = vi.fn();
    render(<Controlled initial={{ frequency: 'monthly' }} start="2026-12-15" onRule={onRule} />);
    expect(screen.getByRole('spinbutton', { name: 'اليوم' })).toHaveValue(15);
    expect(screen.queryByRole('group', { name: 'في أيام' })).toBeNull();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'اليوم' }), { target: { value: '31' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'monthly', dayOfMonth: 31 });
    fireEvent.change(screen.getByRole('combobox', { name: 'في' }), { target: { value: 'last' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'monthly', dayOfMonth: 31, weekOfMonth: 'last' });
    expect(screen.queryByRole('spinbutton', { name: 'اليوم' })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(7);
  });

  it('repeats yearly in a month named in the locale', () => {
    const onRule = vi.fn();
    render(<Controlled initial={{ frequency: 'yearly' }} start="2026-03-15T09:00:00Z" locale="en-US" onRule={onRule} />);
    const month = screen.getByRole('combobox', { name: 'الشهر' });
    expect(month).toHaveValue('3');
    expect(within(month).getAllByRole('option')[0]).toHaveTextContent('January');
    fireEvent.change(month, { target: { value: '11' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'yearly', month: 11 });
  });

  it('ends never, after a count or on a date, or leaves the end out', () => {
    const onRule = vi.fn();
    const { unmount } = render(<Controlled initial={{ frequency: 'daily' }} onRule={onRule} />);
    const range = screen.getByRole('combobox', { name: 'ينتهي' });
    expect(range).toHaveValue('noEndDate');
    fireEvent.change(range, { target: { value: 'occurrenceCount' } });
    expect(screen.getByRole('spinbutton', { name: 'عدد المرات' })).toHaveValue(10);
    fireEvent.change(range, { target: { value: 'endByDate' } });
    fireEvent.change(screen.getByLabelText('تاريخ الانتهاء'), { target: { value: '2026-12-31' } });
    expect(onRule).toHaveBeenLastCalledWith({ frequency: 'daily', range: 'endByDate', endDate: '2026-12-31' });
    unmount();
    render(<Controlled initial={{ frequency: 'daily', range: 'occurrenceCount' }} showEnd={false} />);
    expect(screen.queryByRole('combobox', { name: 'ينتهي' })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: 'عدد المرات' })).toBeNull();
  });

  it('offers only the frequencies given, and the current one if it is not among them', () => {
    render(<Controlled initial={{ frequency: 'none' }} frequencies={['daily', 'weekly']} />);
    const options = within(screen.getByRole('combobox', { name: 'يتكرر' })).getAllByRole('option');
    expect(options.map((option) => option.getAttribute('value'))).toEqual(['none', 'daily', 'weekly']);
  });

  it('disables every field', () => {
    render(<Controlled initial={{ frequency: 'weekly', range: 'occurrenceCount' }} disabled />);
    for (const control of [...screen.getAllByRole('combobox'), ...screen.getAllByRole('spinbutton'), ...screen.getAllByRole('checkbox')]) expect(control).toBeDisabled();
  });
});
