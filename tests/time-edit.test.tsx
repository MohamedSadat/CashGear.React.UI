import { createRef, StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CgField, CgTimeEdit, normalizeCgTimeValue } from '../src';
import type { CgTimeEditActions, CgTimeEditBeforeValueChangeDetails } from '../src';
import { defaultTimePattern, formatClockTime, parseFormattedTime, parseTimePattern } from '../src/components/TimeEdit/timeValue';

describe('CgTimeEdit value and format utilities', () => {
  it('normalizes supported clock strings at fixed millisecond precision', () => {
    expect(normalizeCgTimeValue('08:05')).toBe('08:05:00.000');
    expect(normalizeCgTimeValue('23:59:58.7')).toBe('23:59:58.700');
    expect(() => normalizeCgTimeValue('24:00')).toThrow(/outside/u);
    expect(() => normalizeCgTimeValue('8:05')).toThrow(/HH:mm/u);
  });

  it('strictly formats and parses 24-hour, 12-hour, quoted, and localized patterns', () => {
    const value = { hour: 13, minute: 5, second: 9, millisecond: 123 };
    expect(formatClockTime(value, 'HH:mm:ss', 'en-US')).toBe('13:05:09');
    expect(formatClockTime(value, "h:mm tt 'shift'", 'en-US')).toBe('1:05 PM shift');
    expect(parseFormattedTime('1:05 PM', 'h:mm tt', 'en-US', value)).toEqual(value);
    const arabic = formatClockTime(value, 'HH:mm', 'ar-EG');
    expect(parseFormattedTime(arabic, 'HH:mm', 'ar-EG', value)).toEqual(value);
    expect(defaultTimePattern('en-US', true)).toMatch(/s/u);
    expect(() => parseTimePattern('h:mm')).toThrow(/period/u);
    expect(() => parseTimePattern('HH:mm tt')).toThrow(/forbid/u);
    expect(() => parseTimePattern('HH:mm shift')).toThrow(/Quote/u);
  });
});

describe('CgTimeEdit', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 20, y: 20, width: 288, height: 40 }));
  });

  it('supports forms, focus/display formats, hidden precision, and exact commits', async () => {
    const changed = vi.fn();
    render(<form data-testid="form"><CgField label="Shift start"><CgTimeEdit name="shift" defaultValue="08:17:23.456" editFormat="HH:mm" displayFormat="H:mm" onValueChange={changed} /></CgField></form>);
    const input = screen.getByRole('combobox', { name: 'Shift start' });
    expect(input).toHaveValue('8:17');
    fireEvent.focus(input);
    expect(input).toHaveValue('08:17');
    fireEvent.change(input, { target: { value: '09:31' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('09:31:23.456', expect.objectContaining({ reason: 'manual-input' })));
    expect(new FormData(screen.getByTestId('form')).get('shift')).toBe('09:31:23.456');
  });

  it('retains invalid drafts, enforces bounds, and restores on Escape', () => {
    const changed = vi.fn();
    render(<CgTimeEdit defaultValue="08:00:00.000" editFormat="HH:mm" minTime="06:00:00.000" maxTime="22:00:00.000" outOfRangeMessage="Outside shift" onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25:10' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/valid time/u);
    fireEvent.change(input, { target: { value: '23:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Outside shift');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('08:00');
    expect(changed).not.toHaveBeenCalled();
  });

  it('keeps a controlled parent authoritative after a proposal', async () => {
    const changed = vi.fn();
    render(<CgTimeEdit value="08:00:00.000" editFormat="HH:mm" onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '09:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('09:00:00.000', expect.anything()));
    await waitFor(() => expect(input).toHaveValue('08:00'));
  });

  it('applies picker changes, retains off-step minutes, and cancels without publishing', async () => {
    const changed = vi.fn();
    render(<CgTimeEdit defaultValue="13:17:23.456" editFormat="h:mm tt" showSeconds minuteStep={15} onValueChange={changed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));
    expect(screen.getByRole('combobox', { name: 'Minute' }).querySelector('option[value="17"]')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Hour' }), '2');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Period' }), 'pm');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Second' }), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith('14:17:40.456', expect.objectContaining({ reason: 'picker-apply' })));
    await userEvent.click(screen.getByRole('button', { name: 'Open time picker' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Minute' }), '30');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(changed).toHaveBeenCalledOnce();
  });

  it('clears, resets external forms, transfers invalid focus, and exposes actions', async () => {
    const actions = createRef<CgTimeEditActions>();
    render(<><form id="time-form"><button type="reset">Reset</button><button type="submit">Submit</button></form><CgTimeEdit actionsRef={actions} form="time-form" name="time" defaultValue="08:00:00.000" editFormat="HH:mm" /><CgTimeEdit aria-label="Required time" form="time-form" name="required" required /></>);
    await act(async () => actions.current?.clear());
    expect(new FormData(document.querySelector('form')!).get('time')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(new FormData(document.querySelector('form')!).get('time')).toBe('08:00:00.000');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByRole('combobox', { name: 'Required time' })).toHaveFocus();
    await act(async () => actions.current?.open());
    expect(screen.getByRole('dialog', { name: 'Choose time' })).toBeInTheDocument();
    await act(async () => actions.current?.close());
  });

  it('aborts stale before-change work and observes rejection', async () => {
    const changed = vi.fn();
    const errors = vi.fn();
    let releaseFirst!: () => void;
    const before = vi.fn(({ value, signal }: CgTimeEditBeforeValueChangeDetails) => value === '09:00:00.000'
      ? new Promise<void>((resolve) => { releaseFirst = resolve; signal.addEventListener('abort', () => resolve()); })
      : Promise.reject(new Error('denied')));
    render(<CgTimeEdit defaultValue="08:00:00.000" editFormat="HH:mm" onBeforeValueChange={before} onBeforeValueChangeError={errors} onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '09:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: '10:00' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    releaseFirst();
    await waitFor(() => expect(errors).toHaveBeenCalledOnce());
    expect(changed).not.toHaveBeenCalled();
  });

  it('commits only when focus leaves the complete control and survives Strict Mode replay', async () => {
    const changed = vi.fn();
    render(<StrictMode><CgTimeEdit defaultValue="08:00:00.000" editFormat="HH:mm" showClearButton={false} showPickerButton={false} buttons={[{ key: 'inspect', text: 'Inspect', ariaLabel: 'Inspect', preventFocusLoss: false }]} onValueChange={changed} /><button type="button">Outside</button></StrictMode>);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '09:45');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Inspect' })).toHaveFocus();
    expect(changed).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
    await waitFor(() => expect(changed).toHaveBeenCalledWith('09:45:00.000', expect.objectContaining({ reason: 'manual-input' })));
  });

  it('renders deterministically during SSR and validates configuration', () => {
    expect(renderToString(<CgTimeEdit defaultValue="08:00:00.000" editFormat="HH:mm" />)).toContain('08:00');
    expect(() => render(<CgTimeEdit minuteStep={0} />)).toThrow(/minuteStep/u);
    expect(() => render(<CgTimeEdit minTime="bad" />)).toThrow(/canonical/u);
    expect(() => render(<CgTimeEdit minTime="10:00:00.000" maxTime="09:00:00.000" />)).toThrow(/later/u);
  });
});
