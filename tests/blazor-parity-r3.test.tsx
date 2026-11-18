import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgCalendar } from '../src';
import type { CgCalendarVisibleRangeChangeDetails } from '../src';
import { weekOfYear } from '../src/internal/date/dateMath';

const rows = (container: HTMLElement) => [...container.querySelectorAll('[data-calendar-panel="0"] [role="row"]')].slice(1);

describe('week numbers', () => {
  it('computes week numbers the way .NET GetWeekOfYear does', () => {
    expect(weekOfYear({ year: 2025, month: 12, day: 29 }, 'firstFourDayWeek', 1)).toBe(53);
    expect(weekOfYear({ year: 2026, month: 1, day: 5 }, 'firstFourDayWeek', 1)).toBe(2);
    expect(weekOfYear({ year: 2026, month: 1, day: 1 }, 'firstDay', 0)).toBe(1);
    expect(weekOfYear({ year: 2026, month: 1, day: 4 }, 'firstDay', 0)).toBe(2);
    expect(weekOfYear({ year: 2026, month: 1, day: 3 }, 'firstFullWeek', 0)).toBe(52);
    expect(weekOfYear({ year: 2026, month: 1, day: 4 }, 'firstFullWeek', 0)).toBe(1);
  });

  it('draws a week-number row header for each week', () => {
    const { container } = render(<CgCalendar visibleDate="2026-01-01" firstDayOfWeek="monday" showWeekNumbers weekNumberRule="firstFourDayWeek" locale="en-GB" />);
    const numbers = rows(container).map((row) => within(row as HTMLElement).getByRole('rowheader').textContent);
    expect(numbers).toEqual(['53', '2', '3', '4', '5', '6']);
    expect(screen.getAllByRole('rowheader')[1]).toHaveAttribute('aria-label', 'Week 2');
  });
});

describe('month layout', () => {
  it('draws only the weeks a month needs without the fixed six-week layout', () => {
    const { container } = render(<CgCalendar visibleDate="2026-02-01" firstDayOfWeek="sunday" fixedSixWeekLayout={false} />);
    expect(rows(container)).toHaveLength(4);
  });

  it('hides or disables the days of neighbouring months', () => {
    const { container, rerender } = render(<CgCalendar visibleDate="2026-04-01" firstDayOfWeek="sunday" />);
    expect(container.querySelector('[data-date="2026-03-30"]')).not.toBeNull();
    rerender(<CgCalendar visibleDate="2026-04-01" firstDayOfWeek="sunday" showOutsideMonthDates={false} />);
    expect(container.querySelector('[data-date="2026-03-30"]')).toBeNull();
    rerender(<CgCalendar visibleDate="2026-04-01" firstDayOfWeek="sunday" allowOutsideMonthSelection={false} />);
    expect(container.querySelector('[data-date="2026-03-30"]')).toBeDisabled();
    expect(container.querySelector('[data-date="2026-04-02"]')).not.toBeDisabled();
  });
});

describe('loading and templates', () => {
  it('covers the calendar with a loading status', () => {
    const { rerender } = render(<CgCalendar loading visibleDate="2026-03-01" />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Loading calendar availability')).toBeInTheDocument();
    rerender(<CgCalendar loading renderLoading={() => <span>Fetching holidays</span>} visibleDate="2026-03-01" />);
    expect(screen.getByText('Fetching holidays')).toBeInTheDocument();
  });

  it('renders host header, footer and weekday content', () => {
    render(<CgCalendar visibleDate="2026-03-01" firstDayOfWeek="sunday" today="2026-03-10"
      renderHeader={({ heading, view }) => <span data-testid="heading">{view}: {heading}</span>}
      renderFooter={({ today, canSelectToday }) => <span data-testid="footer">{today} {String(canSelectToday)}</span>}
      renderWeekday={({ dayOfWeek, shortName }) => <abbr title={dayOfWeek}>{shortName.slice(0, 1)}</abbr>} />);
    expect(screen.getByTestId('heading')).toHaveTextContent('day: March 2026');
    expect(screen.getByTestId('footer')).toHaveTextContent('2026-03-10 true');
    expect(screen.getAllByRole('columnheader')[0]!.querySelector('abbr')).toHaveAttribute('title', 'sunday');
  });
});

describe('visible range', () => {
  it('reports the drawn dates after mount and after navigation', () => {
    const changes: CgCalendarVisibleRangeChangeDetails[] = [];
    render(<CgCalendar visibleDate={undefined} defaultVisibleDate="2026-03-01" firstDayOfWeek="sunday" onVisibleRangeChange={(details) => changes.push(details)} />);
    expect(changes[0]).toMatchObject({ startDate: '2026-03-01', endDate: '2026-04-11', view: 'day', monthCount: 1, version: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
    expect(changes.at(-1)).toMatchObject({ startDate: '2026-03-29', endDate: '2026-05-09', visibleDate: '2026-04-01', version: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Choose month and year' }));
    expect(changes.at(-1)).toMatchObject({ startDate: '2026-01-01', endDate: '2026-12-31', view: 'month' });
  });
});

describe('selection view', () => {
  it('starts in the month view and selects the first day of a month', () => {
    const change = vi.fn();
    render(<CgCalendar selectionView="month" defaultVisibleDate="2026-01-01" onValueChange={change} renderMonth={({ name, isSelected }) => <span>{name}{isSelected ? ' ✓' : ''}</span>} />);
    fireEvent.click(screen.getByRole('button', { name: /March/ }));
    expect(change).toHaveBeenCalledWith('2026-03-01', expect.objectContaining({ reason: 'selection' }));
    expect(screen.getByRole('button', { name: /March ✓/ })).toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: /March 2026/ })).toBeNull();
  });

  it('selects a year in the year view and never drills below it', () => {
    const change = vi.fn();
    render(<CgCalendar selectionView="year" defaultVisibleDate="2026-01-01" onValueChange={change} renderYear={({ year, isOutsideDecade }) => <span>{year}{isOutsideDecade ? '*' : ''}</span>} />);
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    expect(change).toHaveBeenCalledWith('2027-01-01', expect.anything());
    expect(screen.getByRole('button', { name: '2019*' })).toBeInTheDocument();
  });

  it('switches views with Ctrl+ArrowUp and Ctrl+ArrowDown', () => {
    const { container } = render(<CgCalendar defaultVisibleDate="2026-03-01" />);
    const day = container.querySelector<HTMLElement>('[data-date="2026-03-01"]')!;
    fireEvent.keyDown(day, { key: 'ArrowUp', ctrlKey: true });
    expect(container.querySelector('[data-period="month"]')).not.toBeNull();
    fireEvent.keyDown(container.querySelector('[data-period="month"]')!, { key: 'ArrowDown', ctrlKey: true });
    expect(container.querySelector('[data-date="2026-03-01"]')).not.toBeNull();
  });
});

describe('auto-collapse', () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- restored as it was, unbound, after the test
  const original = window.matchMedia;
  afterEach(() => { window.matchMedia = original; });

  it('shows one month and steps by one on a narrow viewport unless turned off', () => {
    window.matchMedia = ((query: string) => ({ matches: query.includes('47.999rem'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined })) as unknown as typeof window.matchMedia;
    const { container, rerender } = render(<CgCalendar calendarCount={2} defaultVisibleDate="2026-03-01" />);
    expect(container.querySelectorAll('[data-calendar-panel]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next period' }));
    expect(container.querySelector('[data-date="2026-04-15"]')).not.toBeNull();
    rerender(<CgCalendar calendarCount={2} autoCollapseMonths={false} defaultVisibleDate="2026-03-01" />);
    expect(container.querySelectorAll('[data-calendar-panel]')).toHaveLength(2);
  });
});
