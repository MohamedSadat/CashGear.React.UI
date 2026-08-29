import { createRef } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CgDateEdit, CgField } from '../src';
import type { CgDateEditActions, CgDateEditDayRenderContext } from '../src';
import {
  addDays,
  addMonths,
  createMonthCells,
  decadeGridStart,
  dayOfWeek,
  parseCanonicalDate,
  todayCivilDate,
  toCanonicalDate,
} from '../src/internal/date/dateMath';
import {
  defaultDatePattern,
  formatCivilDate,
  localeFirstDayOfWeek,
  parseDatePattern,
  parseFormattedDate,
} from '../src/internal/date/dateFormat';

describe('CgDateEdit civil-date utilities', () => {
  it('validates canonical values, leap years, saturating arithmetic, and six-week matrices', () => {
    expect(parseCanonicalDate('2028-02-29')).toEqual({ year: 2028, month: 2, day: 29 });
    expect(parseCanonicalDate('2025-02-29')).toBeNull();
    expect(parseCanonicalDate('2026-2-03')).toBeNull();
    expect(toCanonicalDate(addDays({ year: 2026, month: 12, day: 31 }, 1))).toBe('2027-01-01');
    expect(toCanonicalDate(addMonths({ year: 2028, month: 1, day: 31 }, 1))).toBe('2028-02-29');
    expect(dayOfWeek({ year: 2026, month: 8, day: 23 })).toBe(0);
    expect(decadeGridStart(9999)).toBe(9988);
    const cells = createMonthCells({ year: 2026, month: 8, day: 1 }, 6);
    expect(cells).toHaveLength(42);
    expect(cells[0]?.date).toEqual({ year: 2026, month: 8, day: 1 });
  });

  it('formats and strictly parses tokens, localized digits, month names, and locale defaults', () => {
    const value = { year: 2026, month: 12, day: 5 };
    expect(formatCivilDate(value, 'dd/MM/yyyy', 'en-GB')).toBe('05/12/2026');
    expect(formatCivilDate(value, 'd MMMM yyyy', 'fr-FR')).toBe('5 décembre 2026');
    expect(parseFormattedDate('5 décembre 2026', 'd MMMM yyyy', 'fr-FR')).toEqual(value);
    const arabic = formatCivilDate(value, 'dd/MM/yyyy', 'ar-EG');
    expect(parseFormattedDate(arabic, 'dd/MM/yyyy', 'ar-EG')).toEqual(value);
    expect(parseFormattedDate(`\u2067${arabic}\u2069`, 'dd/MM/yyyy', 'ar-EG')).toEqual(value);
    expect(parseFormattedDate('31/02/2026', 'dd/MM/yyyy', 'en-GB')).toBeNull();
    expect(parseFormattedDate(' 05/12/2026 ', 'dd/MM/yyyy', 'en-GB')).toBeNull();
    expect(parseFormattedDate(' 05/12/2026 ', ' dd/MM/yyyy ', 'en-GB')).toEqual(value);
    expect(formatCivilDate(value, "d 'of' MMMM yyyy", 'en-GB')).toBe('5 of December 2026');
    expect(defaultDatePattern('en-US')).toContain('yyyy');
    expect(localeFirstDayOfWeek('ar-EG')).toBe(6);
    expect(() => parseDatePattern('yyyy/MM/MM/dd')).toThrow(/exactly one year, month, and day/u);
    expect(() => parseDatePattern('dd of MMMM yyyy')).toThrow(/Quote alphabetic literals/u);
    expect(() => formatCivilDate(value, 'yyyy-MM', 'en-US')).toThrow(/exactly one year, month, and day/u);
  });
});

describe('CgDateEdit', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 20, y: 20, width: 288, height: 40 }));
  });

  it('supports controlled and uncontrolled values, focus formats, canonical serialization, and exact commits', async () => {
    const changed = vi.fn();
    render(
      <form data-testid="form">
        <CgField label="Invoice date">
          <CgDateEdit
            name="invoiceDate"
            defaultValue="2026-12-05"
            editFormat="dd/MM/yyyy"
            displayFormat="d MMMM yyyy"
            locale="en-GB"
            onValueChange={changed}
          />
        </CgField>
      </form>,
    );
    const input = screen.getByRole('combobox', { name: 'Invoice date' });
    expect(input).toHaveValue('5 December 2026');
    fireEvent.focus(input);
    expect(input).toHaveValue('05/12/2026');
    fireEvent.change(input, { target: { value: '29/02/2028' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2028-02-29', expect.objectContaining({ value: '2028-02-29', previousValue: '2026-12-05', reason: 'manual-input' })));
    expect(new FormData(screen.getByTestId('form')).get('invoiceDate')).toBe('2028-02-29');
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => Promise.resolve());
    expect(changed).toHaveBeenCalledOnce();
  });

  it('preserves invalid and partial drafts across rerenders, commits valid blur, and restores on Escape', async () => {
    const changed = vi.fn();
    const view = render(<CgDateEdit value="2026-08-21" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '29/' } });
    view.rerender(<CgDateEdit value="2026-08-21" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" onValueChange={changed} />);
    expect(input).toHaveValue('29/');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('21/08/2026');
    fireEvent.change(input, { target: { value: '22/08/2026' } });
    fireEvent.blur(input);
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2026-08-22', expect.objectContaining({ reason: 'manual-input' })));
  });

  it('keeps controlled parents authoritative and displays invalid external values without normalization', async () => {
    const changed = vi.fn();
    const view = render(<CgDateEdit value="2026-08-21" editFormat="yyyy-MM-dd" onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2026-08-22' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input).toHaveValue('2026-08-21'));
    expect(changed).toHaveBeenCalledWith('2026-08-22', expect.anything());
    view.rerender(<CgDateEdit value="2026-02-30" editFormat="yyyy-MM-dd" />);
    expect(input).toHaveValue('2026-02-30');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid date');
  });

  it('applies min, max, disabled, required, and clear policies consistently', async () => {
    const changed = vi.fn();
    render(
      <CgDateEdit
        defaultValue="2026-08-21"
        editFormat="yyyy-MM-dd"
        minDate="2026-08-10"
        maxDate="2026-08-25"
        isDateDisabled={(date) => date === '2026-08-22'}
        outOfRangeMessage="Outside policy"
        disabledDateMessage="Blackout date"
        onValueChange={changed}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2026-08-09' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('Outside policy');
    fireEvent.change(input, { target: { value: '2026-08-22' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert')).toHaveTextContent('Blackout date');
    expect(changed).not.toHaveBeenCalled();
    expect(() => render(<CgDateEdit minDate="2026-09-01" maxDate="2026-08-01" />)).toThrow(/minDate/u);
    expect(() => render(<CgDateEdit minDate="bad" />)).toThrow(/canonical/u);
  });

  it('clears once, blocks disallowed empty values, resets external forms, and transfers invalid focus', async () => {
    const changed = vi.fn();
    render(<>
      <form id="date-form" data-testid="date-form"><button type="reset">Reset date</button></form>
      <CgField label="Payment date">
        <CgDateEdit form="date-form" name="paymentDate" defaultValue="2026-08-21" editFormat="yyyy-MM-dd" onValueChange={changed} />
      </CgField>
      <CgDateEdit aria-label="Required date" form="date-form" name="requiredDate" required />
      <CgDateEdit aria-label="Disabled date" form="date-form" name="disabledDate" defaultValue="2026-01-01" disabled />
    </>);
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
    await waitFor(() => expect(changed).toHaveBeenCalledWith(null, expect.objectContaining({ reason: 'clear-button' })));
    expect(new FormData(screen.getByTestId('date-form')).has('paymentDate')).toBe(false);
    expect(new FormData(screen.getByTestId('date-form')).has('disabledDate')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Reset date' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Payment date' })).toHaveValue('2026-08-21'));
    expect(changed).toHaveBeenCalledOnce();
    const requiredProxy = document.querySelectorAll<HTMLSelectElement>('[data-cg-date-edit-form-proxy]')[1]!;
    fireEvent.invalid(requiredProxy);
    expect(screen.getByRole('combobox', { name: 'Required date' })).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent('A date is required');
  });

  it('opens an accessible calendar, supports RTL keyboard navigation, panels, custom days, selection, and focus return', async () => {
    const renderDay = vi.fn((context: CgDateEditDayRenderContext) => <span data-custom-day={context.date}>{Number(context.date.slice(-2))}</span>);
    const changed = vi.fn();
    render(<CgDateEdit defaultValue="2026-08-21" editFormat="yyyy-MM-dd" direction="rtl" firstDayOfWeek="saturday" renderDay={renderDay} onValueChange={changed} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const dialog = await screen.findByRole('dialog', { name: 'Calendar' });
    expect(input).toHaveAttribute('aria-controls', dialog.id);
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getAllByRole('columnheader')).toHaveLength(7);
    expect(renderDay).toHaveBeenCalled();
    const grid = screen.getByRole('grid');
    fireEvent.keyDown(grid, { key: 'ArrowLeft' });
    await waitFor(() => expect(document.querySelector('[data-focus-value="2026-08-22"]')).toHaveFocus());
    fireEvent.keyDown(grid, { key: 'ArrowRight' });
    await waitFor(() => expect(document.querySelector('[data-focus-value="2026-08-21"]')).toHaveFocus());
    fireEvent.click(screen.getByRole('button', { name: 'Choose month and year' }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Choose year' }));
    expect(screen.getAllByRole('gridcell')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    fireEvent.click(screen.getByRole('button', { name: /August/u }));
    const target = document.querySelector<HTMLButtonElement>('[data-date="2027-08-24"]')!;
    fireEvent.click(target);
    await waitFor(() => expect(changed).toHaveBeenCalledWith('2027-08-24', expect.objectContaining({ reason: 'calendar-selection' })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(input).toHaveFocus();
  });

  it('keeps popup control authoritative and closes on Escape or outside interaction without changing value', async () => {
    const openChanged = vi.fn();
    const view = render(<CgDateEdit value="2026-08-21" open={false} onOpenChange={openChanged} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(openChanged).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'keyboard' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<CgDateEdit value="2026-08-21" open onOpenChange={openChanged} />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(screen.getByRole('grid'), { key: 'Escape' });
    expect(openChanged).toHaveBeenLastCalledWith(false, expect.objectContaining({ reason: 'escape' }));
  });

  it('aborts stale before-change work, observes rejection, and aborts on unmount', async () => {
    const pending = new Map<string, { signal: AbortSignal; resolve: (value: boolean) => void; reject: (error: Error) => void }>();
    const changed = vi.fn();
    const errors = vi.fn();
    const view = render(
      <CgDateEdit
        defaultValue="2026-08-20"
        editFormat="yyyy-MM-dd"
        onValueChange={changed}
        onBeforeValueChange={({ value, signal }) => new Promise<boolean>((resolve, reject) => {
          if (value === '2026-08-23') reject(new Error('policy failed'));
          else pending.set(value ?? 'null', { signal, resolve, reject });
        })}
        onBeforeValueChangeError={errors}
      />,
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2026-08-21' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(pending.has('2026-08-21')).toBe(true));
    fireEvent.change(input, { target: { value: '2026-08-22' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(pending.get('2026-08-21')?.signal.aborted).toBe(true));
    await act(async () => pending.get('2026-08-21')?.reject(new Error('stale policy failure')));
    expect(input).toHaveValue('2026-08-22');
    expect(errors).not.toHaveBeenCalled();
    await act(async () => pending.get('2026-08-22')?.resolve(true));
    expect(changed).toHaveBeenCalledWith('2026-08-22', expect.anything());
    expect(changed).toHaveBeenCalledOnce();
    fireEvent.change(input, { target: { value: '2026-08-23' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: 'policy failed' }), expect.anything()));
    fireEvent.change(input, { target: { value: '2026-08-24' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(pending.has('2026-08-24')).toBe(true));
    view.unmount();
    expect(pending.get('2026-08-24')?.signal.aborted).toBe(true);
  });

  it('exposes input and action refs and renders safely on the server', async () => {
    const inputRef = createRef<HTMLInputElement>();
    const actionsRef = createRef<CgDateEditActions>();
    render(<CgDateEdit ref={inputRef} inputRef={inputRef} actionsRef={actionsRef} defaultValue="2026-08-21" />);
    expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
    actionsRef.current?.focus();
    expect(inputRef.current).toHaveFocus();
    await act(() => actionsRef.current!.open());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(() => renderToString(<CgDateEdit defaultOpen defaultValue="2026-08-21" />)).not.toThrow();
  });

  it('selects Today through the shared change pipeline and supports custom editor buttons', async () => {
    const actionsRef = createRef<CgDateEditActions>();
    const changed = vi.fn();
    const customAction = vi.fn();
    render(
      <CgDateEdit
        actionsRef={actionsRef}
        defaultValue="0001-01-01"
        editFormat="yyyy-MM-dd"
        onValueChange={changed}
        buttons={[{ key: 'inspect', text: 'Inspect', ariaLabel: 'Inspect date', onPress: customAction }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Inspect date' }));
    expect(customAction).toHaveBeenCalledWith(expect.objectContaining({ value: '0001-01-01' }));
    await act(() => actionsRef.current!.today());
    const today = toCanonicalDate(todayCivilDate());
    expect(changed).toHaveBeenCalledWith(today, expect.objectContaining({ value: today, reason: 'today-button' }));
    expect(screen.getByRole('combobox')).toHaveValue(today);
  });
});
