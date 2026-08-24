import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgField, CgNumericEdit, CgSpinEdit } from '../src';

describe('CgNumericEdit', () => {
  it('preserves invalid drafts, marks them invalid, and retains the committed value', () => {
    const changed = vi.fn();
    const invalid = vi.fn();
    render(<CgField label="Amount"><CgNumericEdit defaultValue={12} onValueChange={changed} onInvalidValue={invalid} /></CgField>);
    const input = screen.getByLabelText('Amount');
    fireEvent.change(input, { target: { value: '-' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('-');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(invalid).toHaveBeenCalledWith('-');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '13' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changed).toHaveBeenLastCalledWith(13, expect.objectContaining({ reason: 'enter' }));
  });

  it('commits trailing locale decimals and parses Arabic digits, currency, percent, and paste input strictly', () => {
    const changed = vi.fn();
    const { rerender } = render(<CgNumericEdit aria-label="Number" locale="en-US" defaultValue={null} onValueChange={changed} />);
    const input = screen.getByRole('textbox', { name: 'Number' });
    fireEvent.change(input, { target: { value: '1.' } });
    expect(input).toHaveValue('1.');
    fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith(1, expect.anything());

    rerender(<CgNumericEdit aria-label="Number" locale="ar-EG" defaultValue={null} precision={1} onValueChange={changed} />);
    fireEvent.change(input, { target: { value: '١٢٫٥' } });
    fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith(12.5, expect.anything());

    rerender(<CgNumericEdit aria-label="Number" locale="en-US" formatStyle="currency" currency="USD" defaultValue={null} precision={2} onValueChange={changed} />);
    fireEvent.paste(input, { clipboardData: { getData: () => '$1,234.50' } });
    fireEvent.change(input, { target: { value: '$1,234.50' } });
    fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith(1234.5, expect.anything());

    rerender(<CgNumericEdit aria-label="Number" locale="en-US" formatStyle="percent" defaultValue={null} onValueChange={changed} />);
    fireEvent.change(input, { target: { value: '50%' } });
    fireEvent.blur(input);
    expect(changed).toHaveBeenLastCalledWith(0.5, expect.anything());
  });

  it('rejects arbitrary characters and reformats unchanged values when format options change', () => {
    const invalid = vi.fn();
    const { rerender } = render(<CgNumericEdit aria-label="Localized" value={1234.5} locale="en-US" precision={1} onInvalidValue={invalid} />);
    const input = screen.getByRole('textbox', { name: 'Localized' });
    expect(input).toHaveValue('1,234.5');
    rerender(<CgNumericEdit aria-label="Localized" value={1234.5} locale="de-DE" precision={1} onInvalidValue={invalid} />);
    expect(input).toHaveValue('1.234,5');
    fireEvent.change(input, { target: { value: 'abc123' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('abc123');
    expect(invalid).toHaveBeenCalledWith('abc123');
  });

  it('validates numeric configuration', () => {
    expect(() => render(<CgNumericEdit value={Number.NaN} />)).toThrow(/value/);
    expect(() => render(<CgNumericEdit min={2} max={1} />)).toThrow(/min/);
    expect(() => render(<CgNumericEdit precision={-1} />)).toThrow(/precision/);
    expect(() => render(<CgNumericEdit step={0} />)).toThrow(/step/);
    expect(() => render(<CgNumericEdit formatStyle="currency" />)).toThrow(/currency/);
  });

  it('submits and resets through an externally associated native form', async () => {
    const changed = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<><form id="number-form" /><CgNumericEdit ref={ref} form="number-form" name="amount" defaultValue={5} onValueChange={changed} /></>);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.blur(input);
    expect(new FormData(document.querySelector('form')!).get('amount')).toBe('8');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(input).toHaveValue('5');
    expect(ref.current).toBe(input);
  });
});

describe('CgSpinEdit', () => {
  it('steps from the parseable draft, clamps boundaries, supports page keys, and resets uncontrolled state', async () => {
    const changed = vi.fn();
    render(<><form id="spin-form" /><CgSpinEdit aria-label="Quantity" form="spin-form" name="quantity" defaultValue={2} step={2} pageStep={5} min={0} max={20} onValueChange={changed} /></>);
    const input = screen.getByRole('spinbutton', { name: 'Quantity' });
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Increase value' }));
    expect(changed).toHaveBeenLastCalledWith(9, expect.objectContaining({ reason: 'step' }));
    expect(input).toHaveValue('9');
    fireEvent.keyDown(input, { key: 'PageUp' });
    expect(input).toHaveValue('14');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(input).toHaveValue('2');
  });

  it('validates positive step metadata and honors disabled/read-only boundaries', () => {
    expect(() => render(<CgSpinEdit step={0} />)).toThrow(/step/);
    expect(() => render(<CgSpinEdit pageStep={-1} />)).toThrow(/pageStep/);
    render(<><CgSpinEdit aria-label="Maximum" defaultValue={10} max={10} /><CgSpinEdit aria-label="Read only" defaultValue={2} readOnly /></>);
    expect(screen.getAllByRole('button', { name: 'Increase value' })[0]).toBeDisabled();
    const readOnly = screen.getByRole('spinbutton', { name: 'Read only' });
    fireEvent.keyDown(readOnly, { key: 'ArrowUp' });
    expect(readOnly).toHaveValue('2');
  });

  it('repeats pointer holds, accelerates, and suppresses the generated click', () => {
    vi.useFakeTimers();
    render(<CgSpinEdit aria-label="Held quantity" defaultValue={0} max={100} />);
    const input = screen.getByRole('spinbutton', { name: 'Held quantity' });
    const increase = screen.getByRole('button', { name: 'Increase value' });
    Object.defineProperty(increase, 'setPointerCapture', { configurable: true, value: vi.fn() });
    fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
    expect(input).toHaveValue('1');
    act(() => vi.advanceTimersByTime(400));
    expect(input).toHaveValue('2');
    act(() => vi.advanceTimersByTime(360));
    expect(input).toHaveValue('5');
    fireEvent.pointerUp(increase, { pointerId: 1 });
    fireEvent.click(increase);
    expect(input).toHaveValue('5');
    act(() => vi.advanceTimersByTime(1_000));
    expect(input).toHaveValue('5');
  });

  it('can disable hold repetition while preserving single pointer and keyboard steps', () => {
    vi.useFakeTimers();
    render(<CgSpinEdit aria-label="Single quantity" defaultValue={0} repeatOnHold={false} />);
    const input = screen.getByRole('spinbutton', { name: 'Single quantity' });
    const increase = screen.getByRole('button', { name: 'Increase value' });
    fireEvent.pointerDown(increase, { button: 0, pointerId: 1 });
    act(() => vi.advanceTimersByTime(2_000));
    fireEvent.pointerUp(increase, { pointerId: 1 });
    fireEvent.click(increase);
    expect(input).toHaveValue('1');
    act(() => vi.advanceTimersByTime(0));
    fireEvent.click(increase);
    expect(input).toHaveValue('2');
  });
});
