import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgDateEdit } from '../src';
import { createDateMaskTokens, DateMaskEditor } from '../src/components/DateEdit/dateMask';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((name) => name.slice(0, 3));
const today = { day: 18, month: 11, year: 2026 };
function editor(format = 'dd/MM/yyyy', value: { day: number; month: number; year: number } | null = null) {
  return new DateMaskEditor({ tokens: createDateMaskTokens(format)!, monthNames: MONTHS, shortMonthNames: SHORT, today }, value);
}
function typed(mask: DateMaskEditor, text: string) { for (const character of text) mask.insertText(character); return mask.compose(); }

describe('date mask layout', () => {
  it('edits numeric parts at full width and refuses formats with time', () => {
    expect(createDateMaskTokens('d/M/yyyy')).toEqual([
      { part: 'day', kind: 'numeric', width: 2 }, { literal: '/' }, { part: 'month', kind: 'numeric', width: 2 }, { literal: '/' }, { part: 'year', kind: 'numeric', width: 4 },
    ]);
    expect(createDateMaskTokens('dd MMMM yyyy')?.[2]).toEqual({ part: 'month', kind: 'long', width: 0 });
    expect(createDateMaskTokens('dd/MM/yyyy HH:mm')).toBeNull();
    expect(createDateMaskTokens('dddd dd')).toBeNull();
  });
});

describe('date mask typing', () => {
  it('advances when a part cannot take another digit and restarts on an impossible pair', () => {
    expect(typed(editor(), '4')).toBe('04/__/____');
    const mask = editor();
    expect(typed(mask, '1')).toBe('1_/__/____');
    expect(typed(editor(), '35')).toBe('05/__/____');
    expect(typed(editor(), '15082026')).toBe('15/08/2026');
  });

  it('ignores a separator after a jump and lets one finish a part', () => {
    expect(typed(editor(), '4/8/2026')).toBe('04/08/2026');
    const mask = editor();
    typed(mask, '1/8/26');
    expect(mask.commit(true, null)).toBe('commit');
    expect(mask.snapshot()).toEqual({ day: 1, month: 8, year: 2026 });
  });

  it('spins the highlighted part from today, wraps day and month, and bounds the year', () => {
    const mask = editor();
    mask.spin(1);
    expect(mask.snapshot().day).toBe(18);
    const full = editor('dd/MM/yyyy', { day: 31, month: 1, year: 9999 });
    full.spin(1);
    expect(full.snapshot().day).toBe(1);
    full.last();
    full.spin(1);
    expect(full.snapshot().year).toBe(9999);
    full.activate(1);
    full.spin(-1);
    expect(full.snapshot().month).toBe(12);
  });

  it('corrects an impossible day rather than refusing it', () => {
    expect(typed(editor(), '31022026')).toBe('28/02/2026');
    expect(typed(editor(), '31022028')).toBe('29/02/2028');
  });

  it('takes month names by type-ahead and still accepts digits', () => {
    const mask = editor('dd MMMM yyyy');
    expect(typed(mask, '15au')).toBe('15 August ____');
    expect(typed(editor('dd MMM yyyy'), '1512')).toBe('15 Dec ____');
  });

  it('parses pasted dates in several shapes and Arabic-Indic digits', () => {
    for (const [text, expected] of [['1.8.26', '01/08/2026'], ['15082026', '15/08/2026'], ['2026-08-15', '15/08/2026'], ['15 Aug 2026', '15/08/2026'], ['١٥٠٨٢٠٢٦', '15/08/2026']] as const) {
      const mask = editor();
      mask.paste(text, 0, 10);
      expect(mask.compose()).toBe(expected);
    }
  });

  it('removes the last digit, then the part, then steps back with Backspace', () => {
    const mask = editor('dd/MM/yyyy', { day: 15, month: 8, year: 2026 });
    mask.activate(1);
    mask.insertText('1');
    expect(mask.compose()).toBe('15/1_/2026');
    mask.deleteBackward();
    expect(mask.compose()).toBe('15/__/2026');
    mask.deleteBackward();
    expect(mask.active).toBe(0);
  });

  it('reports an unfinished date on Enter and abandons it on blur', () => {
    const mask = editor('dd/MM/yyyy', { day: 15, month: 8, year: 2026 });
    mask.deleteForward(0, 10);
    typed(mask, '2');
    expect(mask.commit(true, { day: 15, month: 8, year: 2026 })).toBe('incomplete');
    mask.blur(true, { day: 15, month: 8, year: 2026 });
    expect(mask.snapshot()).toEqual({ day: 15, month: 8, year: 2026 });
  });
});

const type = (input: HTMLElement, text: string) => {
  for (const data of text) input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data, bubbles: true, cancelable: true }));
};

describe('DateEdit typing mask', () => {
  it('shows the mask on focus, commits on Enter only, and asks for the numeric keypad', async () => {
    const changed = vi.fn();
    render(<CgDateEdit aria-label="Posting date" editFormat="dd/MM/yyyy" locale="en-GB" today="2026-11-18" onValueChange={changed} />);
    const input = screen.getByRole('combobox', { name: 'Posting date' });
    expect(input).toHaveAttribute('inputmode', 'numeric');
    fireEvent.focus(input);
    expect(input).toHaveValue('__/__/____');
    act(() => type(input, '15082026'));
    await waitFor(() => expect(input).toHaveValue('15/08/2026'));
    expect(changed).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2026-08-15', expect.objectContaining({ reason: 'manual-input' })));
  });

  it('opens with Alt+ArrowDown and F4 while a plain ArrowDown changes the part', async () => {
    const opened = vi.fn();
    render(<CgDateEdit aria-label="Due" editFormat="dd/MM/yyyy" defaultValue="2026-08-15" onOpenChange={opened} />);
    const input = screen.getByRole('combobox', { name: 'Due' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await waitFor(() => expect(input).toHaveValue('14/08/2026'));
    expect(opened).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    expect(opened).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'keyboard' }));
  });

  it('abandons an unfinished date on blur without an error', async () => {
    const changed = vi.fn();
    render(<CgDateEdit aria-label="Due" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" defaultValue="2026-08-15" onValueChange={changed} />);
    const input = screen.getByRole('combobox', { name: 'Due' });
    fireEvent.focus(input);
    (input as HTMLInputElement).setSelectionRange(0, 10);
    act(() => { input.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true })); });
    act(() => type(input, '2'));
    fireEvent.blur(input);
    await act(async () => Promise.resolve());
    expect(changed).not.toHaveBeenCalled();
    expect(input).toHaveValue('15 August 2026');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('does not ask for the numeric keypad when the mask has month names', () => {
    render(<CgDateEdit aria-label="Month name" editFormat="dd MMMM yyyy" />);
    expect(screen.getByRole('combobox', { name: 'Month name' })).not.toHaveAttribute('inputmode', 'numeric');
  });
});

describe('DateEdit scroll picker', () => {
  it('spins a column, commits with the scroll-picker reason, and announces blocked dates', async () => {
    const changed = vi.fn();
    render(<CgDateEdit aria-label="Visit" editFormat="dd/MM/yyyy" defaultValue="2026-08-15" pickerDisplayMode="scrollPicker" isDateDisabled={(date) => date === '2026-08-17'} disabledDateNotificationText="Closed for posting." onValueChange={changed} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Visit' }), { key: 'ArrowDown', altKey: true });
    const column = (name: string) => document.querySelector<HTMLElement>(`[role="listbox"][aria-label="${name}"]`);
    await waitFor(() => expect(column('Day')).not.toBeNull());
    const day = column('Day')!;
    expect(column('Month')).not.toBeNull();
    expect(column('Year')).not.toBeNull();
    fireEvent.keyDown(day, { key: 'ArrowDown' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2026-08-16', expect.objectContaining({ reason: 'scroll-picker' })));
    // The next entry is blocked, so the column skips it.
    fireEvent.keyDown(day, { key: 'ArrowDown' });
    await waitFor(() => expect(changed).toHaveBeenLastCalledWith('2026-08-18', expect.anything()));
    fireEvent.click([...day.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent === '17')!);
    await waitFor(() => expect(document.querySelector('[data-cg-date-wheel] [role="status"]')).toHaveTextContent('Closed for posting.'));
    expect(changed).toHaveBeenCalledTimes(2);
  });

  it('shortens the day when the month changes', async () => {
    const changed = vi.fn();
    render(<CgDateEdit aria-label="Visit" editFormat="dd MMMM yyyy" locale="en-GB" defaultValue="2026-01-31" pickerDisplayMode="scrollPicker" onValueChange={changed} />);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Visit' }), { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(document.querySelector('[role="listbox"][aria-label="Month"]')).not.toBeNull());
    const month = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Month"]')!;
    fireEvent.keyDown(month, { key: 'ArrowDown' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2026-02-28', expect.anything()));
  });
});

describe('DateEdit native picker', () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- restored as it was, unbound, after each test
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  it('lays a native date input over the field on a coarse pointer and commits its picks', async () => {
    window.matchMedia = ((query: string) => ({ matches: query === '(pointer: coarse)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    const changed = vi.fn();
    const { container } = render(<CgDateEdit aria-label="Birthday" minDate="2026-01-01" maxDate="2026-12-31" pickerDisplayMode="native" onValueChange={changed} />);
    const native = container.querySelector<HTMLInputElement>('[data-cg-date-edit-native]')!;
    expect(native).toHaveAttribute('type', 'date');
    expect(native).toHaveAttribute('min', '2026-01-01');
    expect(native).toHaveAttribute('max', '2026-12-31');
    fireEvent.change(native, { target: { value: '2026-05-04' } });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2026-05-04', expect.objectContaining({ reason: 'native-picker' })));
  });

  it('keeps the calendar on a fine pointer', () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    const { container } = render(<CgDateEdit aria-label="Birthday" pickerDisplayMode="native" />);
    expect(container.querySelector('[data-cg-date-edit-native]')).toBeNull();
  });
});
