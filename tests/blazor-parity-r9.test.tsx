import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgDecimalEdit, CgNumericEdit, normalizeCgDecimalValue } from '../src';
import { PositionedOverlay } from '../src/internal/PositionedOverlay';

describe('numeric editors keep select-all on the focusing click', () => {
  it.each([
    ['NumericEdit', (onMouseUp: () => void) => <CgNumericEdit aria-label="Amount" defaultValue={1250} onMouseUp={onMouseUp} />],
    ['DecimalEdit', (onMouseUp: () => void) => <CgDecimalEdit aria-label="Amount" defaultValue={normalizeCgDecimalValue('1250.50')} onMouseUp={onMouseUp} />],
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

describe('overlay placement measures the capped surface', () => {
  afterEach(() => vi.restoreAllMocks());

  // A 560px list under a 288px cap, below a field with 306px under it and 408px above it (jsdom's window is 768px tall).
  function Probe({ onSide }: { onSide: (side: string) => void }) {
    const anchorRef = useRef<HTMLButtonElement>(null);
    return <>
      <button ref={anchorRef} type="button">Field</button>
      <PositionedOverlay anchorRef={anchorRef} widthMode="content" maxHeight={288} onPositioned={(details) => onSide(details.side)} data-testid="surface">rows</PositionedOverlay>
    </>;
  }

  it('keeps a list below its field when its own cap fits there, as Blazor 0e148f5a does', () => {
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 420, left: 20, top: 420, right: 220, bottom: 450, width: 200, height: 30, toJSON: () => ({}) });
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(560);
    // The surface's box follows whatever max-height is on it at the time of the read.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      const cap = Number.parseFloat(this.style.maxHeight);
      return Number.isFinite(cap) ? Math.min(560, cap) : 560;
    });
    const sides: string[] = [];
    render(<Probe onSide={(side) => sides.push(side)} />);
    expect(sides.at(-1)).toBe('bottom');
    expect(screen.getByTestId('surface').style.top).toBe('450px');
  });
});
