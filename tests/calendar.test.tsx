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

  it('names its heading by what it shows and describes what it does (WCAG 2.5.3)', () => {
    const { unmount } = render(<CgCalendar defaultVisibleDate="2026-10-01" />);
    const heading = screen.getByRole('button', { name: 'October 2026' });
    expect(heading).not.toHaveAttribute('aria-label');
    expect(heading).toHaveAccessibleDescription('Choose month and year');
    fireEvent.click(heading);
    const year = screen.getByRole('button', { name: '2026' });
    expect(year).toHaveAccessibleDescription('Choose year');
    fireEvent.click(year);
    expect(screen.getByRole('button', { name: /^\d{4}–\d{4}$/u })).toHaveAccessibleDescription('Choose year');
    unmount();

    // A caller's words are still the description, in any language, and a custom header names it.
    const { unmount: unmountArabic } = render(<CgCalendar defaultVisibleDate="2026-10-01" locale="ar-EG" labels={{ chooseMonthAndYear: 'اختر الشهر' }} />);
    const arabic = screen.getByRole('button', { description: 'اختر الشهر' });
    expect(arabic.textContent).not.toBe('');
    expect(arabic).toHaveAccessibleName(arabic.textContent!);
    unmountArabic();
    render(<CgCalendar defaultVisibleDate="2026-10-01" renderHeader={({ heading: text }) => <span>Period: {text}</span>} />);
    expect(screen.getByRole('button', { name: 'Period: October 2026' })).toHaveAccessibleDescription('Choose month and year');
  });

  it('rejects impossible range configuration early', () => {
    expect(() => render(<CgCalendar selectionMode="range" minimumRangeDays={5} maximumRangeDays={2} />)).toThrow(/must not exceed/u);
  });
});
