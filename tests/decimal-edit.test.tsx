import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgDecimalEdit, CgSpinEdit, normalizeCgDecimalValue as decimal } from '../src';
import type { CgEditorActions } from '../src';
import { calculateDecimal, decimalParts, decimalText, formatDecimal, parseDecimalExpression, roundDecimal } from '../src/internal/decimal';

describe('exact decimal arithmetic', () => {
  it('preserves decimal sums and values beyond the safe integer boundary', () => {
    expect(decimalText(calculateDecimal(decimalParts('0.1'), decimalParts('0.2'), '+'))).toBe('0.3');
    expect(decimalText(calculateDecimal(decimalParts('9007199254740993.01'), decimalParts('0.01'), '+'))).toBe('9007199254740993.02');
    expect(decimalText(parseDecimalExpression('(0.1+0.2)*10', true, 'toEven')!)).toBe('3');
    expect(decimalText(calculateDecimal(decimalParts('1'), decimalParts('3'), '/', 'toEven'))).toBe('0.3333333333333333333333333333');
  });
  it('rounds negative midpoints and rejects overflow, excessive depth and division by zero', () => {
    expect(decimalText(roundDecimal(decimalParts('-2.5'), 0, 'toEven'))).toBe('-2');
    expect(decimalText(roundDecimal(decimalParts('-2.5'), 0, 'awayFromZero'))).toBe('-3');
    expect(decimalText(roundDecimal(decimalParts('-2.1'), 0, 'floor'))).toBe('-3');
    expect(() => decimalParts('79228162514264337593543950336')).toThrow(/overflow/);
    expect(() => calculateDecimal(decimalParts('79228162514264337593543950335'), decimalParts('1'), '+')).toThrow(/overflow/);
    expect(() => parseDecimalExpression('1/0', true, 'toEven')).toThrow();
    expect(() => parseDecimalExpression('('.repeat(34) + '1' + ')'.repeat(34), true, 'toEven')).toThrow();
    expect(formatDecimal(decimalParts('9007199254740993.12'), { locale: 'en-US', style: 'currency', currency: 'USD' })).toBe('$9,007,199,254,740,993.12');
  });
});

describe('CgDecimalEdit', () => {
  it('commits exact expressions, submits canonical values and resets a native form', async () => {
    const actions = createRef<CgEditorActions>(); const change = vi.fn();
    render(<form><CgDecimalEdit name="amount" aria-label="Exact amount" actionsRef={actions} defaultValue={decimal('0.1')} allowExpressions onValueChange={change} /></form>);
    const input = screen.getByLabelText('Exact amount');
    fireEvent.change(input, { target: { value: '9007199254740993.01+0.01' } });
    await act(async () => { expect(await actions.current!.flush()).toBe(true); });
    expect(change).toHaveBeenLastCalledWith('9007199254740993.02', { reason: 'flush' });
    expect(new FormData(document.querySelector('form')!).get('amount')).toBe('9007199254740993.02');
    fireEvent.reset(document.querySelector('form')!);
    await act(async () => Promise.resolve());
    expect(new FormData(document.querySelector('form')!).get('amount')).toBe('0.1');
  });
  it('retains rejected and composing drafts and leaves untouched precision intact', async () => {
    const actions = createRef<CgEditorActions>(); const change = vi.fn();
    render(<CgDecimalEdit aria-label="Amount" actionsRef={actions} defaultValue={decimal('1.2345')} precision={2} max={decimal('5')} rangeBehavior="reject" onValueChange={change} />);
    const input = screen.getByLabelText('Amount');
    fireEvent.focus(input); expect(input).toHaveValue('1.2345'); fireEvent.blur(input);
    await act(async () => Promise.resolve()); expect(change).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '6' } });
    await act(async () => { expect(await actions.current!.flush()).toBe(false); });
    expect(input).toHaveValue('6'); expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.compositionStart(input); fireEvent.change(input, { target: { value: '3' } });
    await act(async () => { expect(await actions.current!.flush()).toBe(false); });
  });
  it('parses Arabic digits and performs exact spin steps', async () => {
    const actions = createRef<CgEditorActions>(); const change = vi.fn();
    render(<CgDecimalEdit aria-label="Arabic amount" locale="ar-EG" step={decimal('0.1')} actionsRef={actions} onValueChange={change} />);
    fireEvent.change(screen.getByLabelText('Arabic amount'), { target: { value: '١٢٫٣' } });
    await act(async () => { expect(await actions.current!.flush()).toBe(true); });
    expect(change).toHaveBeenLastCalledWith('12.3', { reason: 'flush' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'زيادة القيمة' })); });
    expect(change).toHaveBeenLastCalledWith('12.4', { reason: 'step' });
  });
});

describe('numeric policies', () => {
  it('rejects out-of-range values, preserves untouched precision and supports opt-in rounding', async () => {
    const actions = createRef<CgEditorActions>(); const change = vi.fn();
    render(<CgSpinEdit aria-label="Number" actionsRef={actions} defaultValue={1.2345} precision={2} rangeBehavior="reject" max={5} enableKeyboardStepping={false} onValueChange={change} />);
    const input = screen.getByRole('textbox', { name: 'Number' });
    fireEvent.focus(input); expect(input).toHaveValue('1.2345'); fireEvent.blur(input);
    expect(change).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '8' } });
    await act(async () => { expect(await actions.current!.flush()).toBe(false); });
    expect(change).not.toHaveBeenCalled();
  });
  it('coalesces delayed numeric publication', async () => {
    vi.useFakeTimers(); const change = vi.fn();
    render(<CgSpinEdit aria-label="Delayed" commitMode="debounced" debounceMs={40} onValueChange={change} />);
    fireEvent.change(screen.getByLabelText('Delayed'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Delayed'), { target: { value: '25' } });
    expect(change).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(40); });
    expect(change).toHaveBeenCalledExactlyOnceWith(25, expect.objectContaining({ reason: 'debounce' }));
    vi.useRealTimers();
  });
});
