import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgDateRangePicker } from '../src/components/DateRangePicker';

describe('CgDateRangePicker', () => {
  const mockEditorGeometry = () => vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 20, y: 20, width: 320, height: 40 }));

  it('commits exact manual input and submits two canonical form values', async () => {
    const submitted = vi.fn();
    render(<form onSubmit={(event) => { event.preventDefault(); submitted(Object.fromEntries(new FormData(event.currentTarget))); }}>
      <CgDateRangePicker startName="from" endName="to" editFormat="dd-MM-yyyy" rangeSeparator=" - " defaultValue={{ start: '2026-08-01', end: '2026-08-10' }} />
      <button type="submit">Submit</button>
    </form>);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input); fireEvent.change(input, { target: { value: '12-08-2026 - 20-08-2026' } }); fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(input).toHaveValue('12-08-2026 - 20-08-2026'));
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(submitted).toHaveBeenCalledWith({ from: '2026-08-12', to: '2026-08-20' });
  });

  it('retains invalid drafts and transfers required invalid focus', async () => {
    render(<form><CgDateRangePicker required startName="from" endName="to" editFormat="yyyy-MM-dd" /><button type="submit">Submit</button></form>);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'not a range' } }); fireEvent.blur(input);
    await waitFor(() => expect(input).toHaveValue('not a range'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(input).toHaveFocus();
  });

  it('keeps explicit calendar changes draft-only until Apply and replaces built-in presets', async () => {
    mockEditorGeometry();
    const changed = vi.fn();
    render(<CgDateRangePicker defaultValue={{ start: '2026-08-01', end: '2026-08-02' }} today="2026-08-21" defaultOpen showPresets presets={[{ key: 'current-week', label: 'Posting week', getRange: () => ({ start: '2026-08-10', end: '2026-08-14' }) }]} onValueChange={changed} />);
    await userEvent.click(screen.getByRole('button', { name: 'Posting week' }));
    expect(changed).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(changed).toHaveBeenCalledWith({ start: '2026-08-10', end: '2026-08-14' }, expect.objectContaining({ reason: 'preset' }));
  });

  it('supports immediate commits and abortable guard races', async () => {
    mockEditorGeometry();
    let release: (() => void) | undefined;
    const changed = vi.fn();
    render(<CgDateRangePicker commitMode="immediate" today="2026-08-21" defaultOpen onBeforeValueChange={({ signal }) => new Promise<boolean>((resolve) => { release = () => resolve(!signal.aborted); })} onValueChange={changed} />);
    fireEvent.click(document.querySelector('[data-date="2026-08-10"]')!);
    fireEvent.click(document.querySelector('[data-date="2026-08-12"]')!);
    expect(changed).not.toHaveBeenCalled(); release?.();
    await waitFor(() => expect(changed).toHaveBeenCalledWith({ start: '2026-08-10', end: '2026-08-12' }, expect.objectContaining({ reason: 'calendar-selection' })));
  });
});
