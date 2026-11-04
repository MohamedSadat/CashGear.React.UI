import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgColorPicker, CgIcon, CgSplitButton } from '../src';
import type { CgColorPickerThemeColor, CgColorPickerValue } from '../src';
import { applyTint, defaultTints, normalizeHexColor, sameTint } from '../src/components/ColorPicker/colorTint';
import { moveInRovingGrid } from '../src/internal/rovingGrid';

const theme: ReadonlyArray<CgColorPickerThemeColor> = [
  { key: 'lt1', name: 'White', color: '#ffffff' },
  { key: 'dk1', name: 'Black', color: '#000000' },
  { key: 'accent1', name: 'Accent 1', color: '#4472c4' },
];

/** The palette's swatch. A chosen color also appears later, under Recent colors. */
function swatch(name: string) {
  return screen.getAllByRole('gridcell', { name, hidden: true })[0]!;
}

describe('color tints', () => {
  it('matches the shades spreadsheets show for a theme color', () => {
    expect(applyTint('#4472c4', 0.4)).toBe('#8faadc');
    expect(applyTint('#4472c4', -0.25)).toBe('#2f5597');
    expect(applyTint('#ffffff', -0.5)).toBe('#808080');
    expect(applyTint('#000000', 0.5)).toBe('#808080');
    expect(applyTint('#4472c4', 0)).toBe('#4472c4');
  });

  it('picks shades that stay visible for very dark and very light colors', () => {
    expect(defaultTints('#000000')).toEqual([0.5, 0.35, 0.25, 0.15, 0.05]);
    expect(defaultTints('#ffffff')).toEqual([-0.05, -0.15, -0.25, -0.35, -0.5]);
    expect(defaultTints('#002060')).toEqual([0.9, 0.75, 0.5, 0.25, 0.1]);
    expect(defaultTints('#e7e6e6')).toEqual([-0.1, -0.25, -0.5, -0.75, -0.9]);
    expect(defaultTints('#4472c4')).toEqual([0.8, 0.6, 0.4, -0.25, -0.5]);
  });

  it('normalizes hex colors and rejects anything else', () => {
    expect(normalizeHexColor('#ABC', 'test')).toBe('#aabbcc');
    expect(normalizeHexColor('#AABBCC', 'test')).toBe('#aabbcc');
    expect(() => normalizeHexColor('red', 'test')).toThrow(/needs a #rgb or #rrggbb/);
  });

  it('treats the long tints stored in files as the same shade', () => {
    expect(sameTint(0.79998168889431442, 0.8)).toBe(true);
    expect(sameTint(0.6, 0.8)).toBe(false);
  });
});

describe('roving grid movement', () => {
  const rows = [['a', 'b', 'c'], ['d', null, 'f'], ['g']];

  it('moves along a row, mirrors left and right in RTL, and stops at the edges', () => {
    expect(moveInRovingGrid(rows, 'a', 'ArrowRight', false, 'ltr')).toBe('b');
    expect(moveInRovingGrid(rows, 'c', 'ArrowRight', false, 'ltr')).toBeUndefined();
    expect(moveInRovingGrid(rows, 'b', 'ArrowRight', false, 'rtl')).toBe('a');
    expect(moveInRovingGrid(rows, 'b', 'ArrowLeft', false, 'rtl')).toBe('c');
  });

  it('skips gaps, and moves across rows to the nearest item in a shorter row', () => {
    expect(moveInRovingGrid(rows, 'd', 'ArrowRight', false, 'ltr')).toBe('f');
    expect(moveInRovingGrid(rows, 'b', 'ArrowDown', false, 'ltr')).toBe('d');
    expect(moveInRovingGrid(rows, 'f', 'ArrowDown', false, 'ltr')).toBe('g');
    expect(moveInRovingGrid(rows, 'g', 'ArrowUp', false, 'ltr')).toBe('d');
    expect(moveInRovingGrid(rows, 'a', 'ArrowUp', false, 'ltr')).toBeUndefined();
  });

  it('goes to the row ends with Home and End, and the grid ends with Ctrl', () => {
    expect(moveInRovingGrid(rows, 'b', 'Home', false, 'ltr')).toBe('a');
    expect(moveInRovingGrid(rows, 'd', 'End', false, 'ltr')).toBe('f');
    expect(moveInRovingGrid(rows, 'b', 'End', true, 'ltr')).toBe('g');
    expect(moveInRovingGrid(rows, 'f', 'Home', true, 'ltr')).toBe('a');
    expect(moveInRovingGrid(rows, 'b', 'Enter', false, 'ltr')).toBeUndefined();
  });
});

describe('CgColorPicker', () => {
  it('lays out base colors and their shades in columns, with named sections', () => {
    render(<CgColorPicker themeColors={theme} />);
    expect(screen.getByRole('group', { name: 'Color picker' })).toBeInTheDocument();
    const grid = screen.getByRole('grid', { name: 'Theme colors' });
    const rows = within(grid).getAllByRole('row');
    expect(rows).toHaveLength(6);
    expect(within(rows[0]!).getAllByRole('gridcell').map((cell) => cell.getAttribute('aria-label'))).toEqual(['White', 'Black', 'Accent 1']);
    expect(swatch('Accent 1, lighter 40%')).toHaveAttribute('data-color', '#8faadc');
    expect(swatch('Accent 1, darker 25%')).toHaveAttribute('data-color', '#2f5597');
    expect(within(screen.getByRole('grid', { name: 'Standard colors' })).getAllByRole('gridcell')).toHaveLength(10);
    expect(screen.queryByRole('grid', { name: 'Recent colors' })).toBeNull();
  });

  it('keeps a theme color as a reference to its entry and tint', () => {
    const change = vi.fn();
    render(<CgColorPicker themeColors={theme} onValueChange={change} />);
    fireEvent.click(swatch('Accent 1, lighter 40%'));
    expect(change.mock.calls[0]![0]).toEqual({ kind: 'theme', key: 'accent1', tint: 0.4, color: '#8faadc' });
    expect(change.mock.calls[0]![1]).toMatchObject({ source: 'theme' });
    expect(swatch('Accent 1, lighter 40%')).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(swatch('Red'));
    expect(change.mock.calls[1]![0]).toEqual({ kind: 'rgb', color: '#ff0000' });
    expect(change.mock.calls[1]![1]).toMatchObject({ source: 'standard' });
    expect(swatch('Accent 1, lighter 40%')).toHaveAttribute('aria-selected', 'false');
  });

  it('selects the shade a stored tint names, even with the rounding files use', () => {
    render(<CgColorPicker themeColors={theme} value={{ kind: 'theme', key: 'accent1', tint: 0.79998168889431442, color: '#dae3f3' }} />);
    expect(swatch('Accent 1, lighter 80%')).toHaveAttribute('aria-selected', 'true');
  });

  it('stays authoritative when controlled', () => {
    const change = vi.fn();
    render(<CgColorPicker value={{ kind: 'rgb', color: '#ff0000' }} onValueChange={change} />);
    fireEvent.click(swatch('Blue'));
    expect(change).toHaveBeenCalledOnce();
    expect(swatch('Red')).toHaveAttribute('aria-selected', 'true');
    expect(swatch('Blue')).toHaveAttribute('aria-selected', 'false');
  });

  it('offers automatic and no-color options that say when they are chosen', () => {
    const change = vi.fn();
    render(<CgColorPicker allowAutomatic automaticColor="#000000" allowNone labels={{ none: 'No fill' }} onValueChange={change} />);
    const automatic = screen.getByRole('button', { name: 'Automatic' });
    const none = screen.getByRole('button', { name: 'No fill' });
    fireEvent.click(automatic);
    expect(change.mock.calls[0]![0]).toEqual({ kind: 'automatic' });
    expect(automatic).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(none);
    expect(change.mock.calls[1]![0]).toEqual({ kind: 'none' });
    expect(none).toHaveAttribute('aria-pressed', 'true');
    expect(automatic).toHaveAttribute('aria-pressed', 'false');
  });

  it('hides the options nobody asked for', () => {
    render(<CgColorPicker standardColors={[]} />);
    expect(screen.queryByRole('grid')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText('More colors…')).toBeNull();
  });

  it('remembers chosen colors newest first, without repeats, up to the limit', () => {
    const changed = vi.fn();
    render(<CgColorPicker maxRecentColors={2} onRecentColorsChange={changed} allowNone />);
    fireEvent.click(swatch('Red'));
    fireEvent.click(swatch('Blue'));
    fireEvent.click(swatch('Red'));
    expect(changed).toHaveBeenLastCalledWith([{ kind: 'rgb', color: '#ff0000' }, { kind: 'rgb', color: '#0070c0' }]);
    fireEvent.click(swatch('Green'));
    expect(changed).toHaveBeenLastCalledWith([{ kind: 'rgb', color: '#00b050' }, { kind: 'rgb', color: '#ff0000' }]);
    const recent = screen.getByRole('grid', { name: 'Recent colors' });
    expect(within(recent).getAllByRole('gridcell').map((cell) => cell.getAttribute('aria-label'))).toEqual(['Green', 'Red']);
    const calls = changed.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'No color' }));
    expect(changed).toHaveBeenCalledTimes(calls);
  });

  it('names recent colors from the theme, the standard list, or their hex value', () => {
    render(<CgColorPicker themeColors={theme} recentColors={[{ kind: 'theme', key: 'accent1', tint: -0.25, color: '#2f5597' }, { kind: 'rgb', color: '#ff0000' }, { kind: 'rgb', color: '#123456' }, { kind: 'theme', key: 'gone', tint: 0, color: '#654321' }]} />);
    const recent = screen.getByRole('grid', { name: 'Recent colors' });
    expect(within(recent).getAllByRole('gridcell').map((cell) => cell.getAttribute('aria-label'))).toEqual(['Accent 1, darker 25%', 'Red', '#123456', '#654321']);
  });

  it('shows and reports a recent theme color as the current theme defines it', () => {
    const change = vi.fn();
    render(<CgColorPicker standardColors={[]} themeColors={[{ key: 'accent', name: 'Accent', color: '#222222', tints: [] }]} recentColors={[{ kind: 'theme', key: 'accent', tint: 0, color: '#111111' }]} onValueChange={change} />);
    const recent = within(screen.getByRole('grid', { name: 'Recent colors' })).getByRole('gridcell');
    expect(recent).toHaveAttribute('data-color', '#222222');
    fireEvent.click(recent);
    expect(change.mock.calls[0]![0]).toEqual({ kind: 'theme', key: 'accent', tint: 0, color: '#222222' });
  });

  it('keeps a recent color on its own swatch as choosing reorders them, and shows a repeat once', () => {
    const change = vi.fn();
    const repeated = { kind: 'rgb', color: '#333333' } as const;
    render(<CgColorPicker standardColors={[]} defaultRecentColors={[{ kind: 'rgb', color: '#222222' }, repeated, repeated]} onValueChange={change} />);
    const grid = screen.getByRole('grid', { name: 'Recent colors' });
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(2);
    const swatch333 = within(grid).getByRole('gridcell', { name: '#333333' });
    fireEvent.click(swatch333);
    fireEvent.click(swatch333);
    expect(change.mock.calls.map(([value]) => (value as { color: string }).color)).toEqual(['#333333', '#333333']);
    expect(within(grid).getAllByRole('gridcell')[0]).toBe(swatch333);
  });

  it('commits a custom color when the browser dialog reports its change', () => {
    const change = vi.fn();
    render(<CgColorPicker allowCustomColor defaultValue={{ kind: 'rgb', color: '#123456' }} onValueChange={change} />);
    const input = screen.getByLabelText<HTMLInputElement>('More colors…');
    expect(input).toHaveAttribute('type', 'color');
    expect(input.value).toBe('#123456');
    fireEvent.change(input, { target: { value: '#abcdef' } });
    expect(change.mock.calls[0]![0]).toEqual({ kind: 'rgb', color: '#abcdef' });
    expect(change.mock.calls[0]![1]).toMatchObject({ source: 'custom' });
    expect(screen.getByRole('grid', { name: 'Recent colors' })).toBeInTheDocument();
  });

  it('has one tab stop across its sections, on the selected color, and arrows through them', () => {
    render(<CgColorPicker themeColors={theme} defaultValue={{ kind: 'rgb', color: '#ff0000' }} defaultRecentColors={[{ kind: 'rgb', color: '#123456' }]} />);
    const tabStops = screen.getAllByRole('gridcell').filter((cell) => cell.tabIndex === 0);
    expect(tabStops).toEqual([swatch('Red')]);
    act(() => swatch('Red').focus());
    fireEvent.keyDown(swatch('Red'), { key: 'ArrowRight' });
    expect(swatch('Orange')).toHaveFocus();
    expect(swatch('Orange').tabIndex).toBe(0);
    expect(swatch('Red').tabIndex).toBe(-1);
    fireEvent.keyDown(swatch('Orange'), { key: 'ArrowUp' });
    expect(swatch('Accent 1, darker 50%')).toHaveFocus();
    fireEvent.keyDown(swatch('Accent 1, darker 50%'), { key: 'Home' });
    expect(swatch('White, darker 50%')).toHaveFocus();
    fireEvent.keyDown(swatch('White, darker 50%'), { key: 'End', ctrlKey: true });
    expect(swatch('#123456')).toHaveFocus();
  });

  it('mirrors left and right arrows when the picker is RTL', () => {
    render(<CgColorPicker direction="rtl" />);
    act(() => swatch('Red').focus());
    fireEvent.keyDown(swatch('Red'), { key: 'ArrowLeft' });
    expect(swatch('Orange')).toHaveFocus();
    fireEvent.keyDown(swatch('Orange'), { key: 'ArrowRight' });
    expect(swatch('Red')).toHaveFocus();
  });

  it('blocks every choice when disabled', () => {
    const change = vi.fn();
    render(<CgColorPicker disabled allowAutomatic allowNone allowCustomColor themeColors={theme} onValueChange={change} />);
    expect(swatch('Red')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Automatic' })).toBeDisabled();
    expect(screen.getByLabelText('More colors…')).toBeDisabled();
    fireEvent.click(swatch('Red'));
    expect(change).not.toHaveBeenCalled();
  });

  it('rejects bad configuration clearly', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgColorPicker themeColors={[{ key: 'a', name: 'A', color: 'red' }]} />)).toThrow(/#rgb or #rrggbb/);
    expect(() => render(<CgColorPicker themeColors={[{ key: 'a', name: 'A', color: '#000' }, { key: 'a', name: 'B', color: '#111' }]} />)).toThrow(/duplicate theme color/);
    expect(() => render(<CgColorPicker themeColors={[{ key: ' ', name: 'A', color: '#000' }]} />)).toThrow(/nonempty key/);
    expect(() => render(<CgColorPicker themeColors={[{ key: 'a', name: 'A', color: '#000', tints: [2] }]} />)).toThrow(/outside -1 to 1/);
    expect(() => render(<CgColorPicker maxRecentColors={-1} />)).toThrow(/nonnegative integer/);
    expect(() => render(<CgColorPicker themeColors={[{ key: 'a', name: 'A', color: '#000', tints: [0] }]} />)).toThrow(/repeats a tint/);
    expect(() => render(<CgColorPicker standardColors={[{ name: 'A', color: '#000' }, { name: 'B', color: '#000000' }]} />)).toThrow(/repeats standard color/);
    silence.mockRestore();
  });

  it('reapplies the remembered color from a split button, and only changes it through the picker', async () => {
    const applied: string[] = [];
    function FillButton() {
      const [last, setLast] = useState<CgColorPickerValue>({ kind: 'rgb', color: '#ffff00' });
      return (
        <CgSplitButton
          icon={<CgIcon name="fill-color" accentColor={'color' in last ? last.color : 'transparent'} data-testid="fill-icon" />}
          toggleAriaLabel="Choose fill"
          menuAriaLabel="Fill color"
          onClick={() => { applied.push('color' in last ? last.color : last.kind); }}
          renderFlyout={({ close }) => <CgColorPicker value={last} onValueChange={(next) => { setLast(next); applied.push('color' in next ? next.color : next.kind); close(); }} />}
        >Fill</CgSplitButton>
      );
    }
    // A flyout stays hidden until it has been measured, and jsdom has no layout.
    const measured = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) });
    render(<FillButton />);
    const accent = () => screen.getByTestId('fill-icon').querySelector('[data-cg-icon-accent]');
    await userEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(applied).toEqual(['#ffff00']);
    expect(accent()).toHaveAttribute('fill', '#ffff00');

    await userEvent.click(screen.getByRole('button', { name: 'Choose fill' }));
    await userEvent.click(await screen.findByRole('gridcell', { name: 'Blue' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Fill color' })).toBeNull());
    expect(applied).toEqual(['#ffff00', '#0070c0']);
    expect(accent()).toHaveAttribute('fill', '#0070c0');

    await userEvent.click(screen.getByRole('button', { name: 'Fill' }));
    expect(applied).toEqual(['#ffff00', '#0070c0', '#0070c0']);

    await userEvent.click(screen.getByRole('button', { name: 'Choose fill' }));
    const remembered = await screen.findByRole('gridcell', { name: 'Blue' });
    expect(remembered).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(remembered).toHaveFocus());
    measured.mockRestore();
  });
});
