import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgCalendar, CgDateRangePresetSelect, CgField } from '../src';
import type { CgCalendarMultipleProps, CgDateRangePresetSelection } from '../src';
import { resolveDateRangePreset } from '../src/internal/date/dateRangePresets';

describe('Phase 31 Calendar multiple selection', () => {
  const day = (value: string) => document.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)!;
  it('normalizes dates, toggles with modifiers and replaces or adds Shift ranges', () => {
    const onValueChange = vi.fn<NonNullable<CgCalendarMultipleProps['onValueChange']>>();
    render(<CgCalendar selectionMode="multiple" defaultValue={['2026-09-03', '2026-09-01', '2026-09-03']} today="2026-09-14" onValueChange={onValueChange} isDateDisabled={value => value === '2026-09-05'} showClearButton />);
    expect(day('2026-09-01')).toHaveAttribute('data-selected', 'true');
    fireEvent.click(day('2026-09-03'), { ctrlKey: true });
    expect(onValueChange.mock.lastCall?.[0]).toEqual(['2026-09-01']);
    fireEvent.click(day('2026-09-07'), { shiftKey: true });
    expect(onValueChange.mock.lastCall?.[0]).toEqual(['2026-09-03', '2026-09-04', '2026-09-06', '2026-09-07']);
    fireEvent.click(day('2026-09-01'), { ctrlKey: true });
    expect(onValueChange.mock.lastCall?.[0]).toContain('2026-09-01');
    expect(Object.isFrozen(onValueChange.mock.lastCall?.[0])).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }));
    expect(onValueChange.mock.lastCall?.[0]).toEqual([]);
  });
  it('extends keyboard ranges, respects controlled rejection and stays read-only', () => {
    const change = vi.fn();
    const view = render(<CgCalendar selectionMode="multiple" value={['2026-09-01']} today="2026-09-14" onValueChange={change} />);
    fireEvent.click(day('2026-09-01'));
    fireEvent.keyDown(day('2026-09-01'), { key: 'ArrowRight', shiftKey: true });
    expect(change.mock.lastCall?.[0]).toEqual(['2026-09-01', '2026-09-02']);
    expect(day('2026-09-02')).not.toHaveAttribute('data-selected');
    view.rerender(<CgCalendar selectionMode="multiple" value={['2026-09-01']} today="2026-09-14" onValueChange={change} readOnly />);
    change.mockClear(); fireEvent.click(day('2026-09-03')); expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-multiselectable', 'true');
  });
  it('rejects malformed dates', () => {
    expect(() => render(<CgCalendar selectionMode="multiple" value={['2026-02-30']} />)).toThrow(/canonical/);
  });
});

describe('Phase 31 preset selector', () => {
  it('resolves inclusive windows across leap years and full previous years', () => {
    expect(resolveDateRangePreset('last30Days', '2024-03-01')).toEqual({ start: '2024-02-01', end: '2024-03-01' });
    expect(resolveDateRangePreset('lastMonth', '2024-03-01')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(resolveDateRangePreset('last2Years', '2026-09-14')).toEqual({ start: '2024-01-01', end: '2025-12-31' });
    expect(resolveDateRangePreset('custom', '2026-09-14')).toBeNull();
  });
  it('clamps overlapping starts, disables outside presets and emits one atomic selection', () => {
    const selection = vi.fn<(value: CgDateRangePresetSelection) => void>();
    render(<CgDateRangePresetSelect anchorDate="2026-09-14" minDate="2026-09-05" onSelectionChange={selection} />);
    expect(screen.getByRole('option', { name: 'Last month' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'currentMonth' } });
    expect(selection).toHaveBeenCalledTimes(1);
    expect(selection.mock.lastCall?.[0]).toEqual({ preset: 'currentMonth', range: { start: '2026-09-05', end: '2026-09-14' }, isClamped: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    expect(selection.mock.lastCall?.[0].range).toBeNull();
  });
  it('uses field labels, form association, native reset and read-only submission', async () => {
    const view = render(<><form id="filters" /><CgField label="Period"><CgDateRangePresetSelect form="filters" name="period" anchorDate="2026-09-14" /></CgField></>);
    fireEvent.change(screen.getByLabelText('Period'), { target: { value: 'lastYear' } });
    const form = document.getElementById('filters') as HTMLFormElement;
    expect(new FormData(form).get('period')).toBe('lastYear');
    await act(async () => { form.reset(); });
    expect(new FormData(form).get('period')).toBe('last30Days');
    view.rerender(<><form id="filters" /><CgDateRangePresetSelect form="filters" name="period" value="lastYear" readOnly anchorDate="2026-09-14" /></>);
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(new FormData(form).get('period')).toBe('lastYear');
  });
  it('preserves controlled values, custom ordering, labels and ceiling restrictions', async () => {
    const change = vi.fn();
    render(<form><CgDateRangePresetSelect value="custom" presets={['lastYear', 'lastYear', 'currentMonth']} presetText={preset => preset === 'custom' ? 'Choose dates' : ''} anchorDate="2026-09-14" maxDate="2026-09-01" onValueChange={change} /></form>);
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Choose dates', 'Last year', 'Current month']);
    expect(screen.getByRole('option', { name: 'Current month' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'lastYear' } });
    expect(change).toHaveBeenCalledWith('lastYear'); expect(screen.getByRole('combobox')).toHaveValue('custom');
    await act(async () => { document.querySelector('form')!.reset(); });
    expect(screen.getByRole('combobox')).toHaveValue('custom');
  });
});
