import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgCalendar } from '../src/components/Calendar';

describe('CgCalendar', () => {
  it('supports uncontrolled single selection and semantic keyboard movement', () => {
    const changed = vi.fn();
    render(<CgCalendar today="2026-08-21" defaultVisibleDate="2026-08-01" onValueChange={changed} />);
    const day = document.querySelector<HTMLButtonElement>('[data-date="2026-08-24"]')!;
    fireEvent.click(day);
    expect(changed).toHaveBeenCalledWith('2026-08-24', expect.objectContaining({ reason: 'selection' }));
    fireEvent.focus(day);
    fireEvent.keyDown(day, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-date', '2026-08-25');
    expect(screen.getByRole('grid')).toHaveAccessibleName(/August 2026/u);
  });

  it('keeps controlled values authoritative and uses physical RTL arrows', () => {
    const changed = vi.fn();
    render(<CgCalendar value="2026-08-21" today="2026-08-21" defaultVisibleDate="2026-08-01" direction="rtl" onValueChange={changed} />);
    const selected = document.querySelector<HTMLButtonElement>('[data-date="2026-08-21"]')!;
    fireEvent.click(document.querySelector('[data-date="2026-08-23"]')!);
    expect(changed).toHaveBeenCalled();
    expect(selected).toHaveAttribute('data-selected');
    selected.focus(); fireEvent.keyDown(selected, { key: 'ArrowRight' });
    expect(document.activeElement).toHaveAttribute('data-date', '2026-08-20');
  });

  it('selects normalized ranges and exposes preview states without scanning interiors', () => {
    const changed = vi.fn();
    render(<CgCalendar selectionMode="range" today="2026-08-21" defaultVisibleDate="2026-08-01" onValueChange={changed} />);
    fireEvent.click(document.querySelector('[data-date="2026-08-20"]')!);
    fireEvent.pointerEnter(document.querySelector('[data-date="2026-08-15"]')!);
    expect(document.querySelector('[data-date="2026-08-17"]')).toHaveAttribute('data-preview');
    fireEvent.click(document.querySelector('[data-date="2026-08-15"]')!);
    expect(changed).toHaveBeenCalledWith({ start: '2026-08-15', end: '2026-08-20' }, expect.objectContaining({ reason: 'selection' }));
  });

  it('rejects impossible range configuration early', () => {
    expect(() => render(<CgCalendar selectionMode="range" minimumRangeDays={5} maximumRangeDays={2} />)).toThrow(/must not exceed/u);
  });
});
