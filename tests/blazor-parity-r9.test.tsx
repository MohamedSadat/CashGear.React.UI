import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgDecimalEdit, CgNumericEdit } from '../src';

describe('numeric editors keep select-all on the focusing click', () => {
  it.each([
    ['NumericEdit', (onMouseUp: () => void) => <CgNumericEdit aria-label="Amount" defaultValue={1250} onMouseUp={onMouseUp} />],
    ['DecimalEdit', (onMouseUp: () => void) => <CgDecimalEdit aria-label="Amount" defaultValue="1250.50" onMouseUp={onMouseUp} />],
  ])('%s cancels only the mouseup of the click that focused it', (_name, renderEditor) => {
    const hostMouseUp = vi.fn();
    render(renderEditor(hostMouseUp));
    const input = screen.getByRole('textbox', { name: 'Amount' }) as HTMLInputElement;
    fireEvent.pointerDown(input);
    input.focus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
    const first = fireEvent.mouseUp(input);
    expect(first).toBe(false);
    fireEvent.pointerDown(input);
    const second = fireEvent.mouseUp(input);
    expect(second).toBe(true);
    expect(hostMouseUp).toHaveBeenCalledTimes(2);
  });
});
