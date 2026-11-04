import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgBorderPicker } from '../src';
import type { CgBorderApplyDetails, CgBorderPresetKey } from '../src';

const preset = (name: string) => screen.getByRole('gridcell', { name });
const line = (name: string) => screen.getByRole('radio', { name });

function applied(click: string, props?: Parameters<typeof CgBorderPicker>[0]) {
  const apply = vi.fn<(details: CgBorderApplyDetails) => void>();
  render(<CgBorderPicker {...props} onApply={apply} />);
  fireEvent.click(preset(click));
  return apply.mock.calls[0]![0];
}

describe('CgBorderPicker', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) });
  });
  afterEach(() => vi.restoreAllMocks());

  it('offers every preset as a named cell in a grid with an icon', () => {
    render(<CgBorderPicker />);
    expect(screen.getByRole('group', { name: 'Border picker' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'Borders' })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(17);
    expect(preset('All borders').querySelector('svg')).toBeInTheDocument();
    expect(preset('All borders')).toHaveAttribute('title', 'All borders');
  });

  it('reports the edges of a preset with the chosen line style and color', () => {
    const details = applied('Outside borders', { defaultLineStyle: 'dashed', defaultColor: { kind: 'rgb', color: '#ff0000' } });
    expect(details.preset).toBe('outside');
    expect(details.clear).toBe(false);
    expect(details.color).toEqual({ kind: 'rgb', color: '#ff0000' });
    expect(details.edges).toEqual([
      { edge: 'top', lineStyle: 'dashed' },
      { edge: 'bottom', lineStyle: 'dashed' },
      { edge: 'left', lineStyle: 'dashed' },
      { edge: 'right', lineStyle: 'dashed' },
    ]);
  });

  it.each<[string, CgBorderPresetKey, ReadonlyArray<readonly [string, string]>]>([
    ['All borders', 'all', [['top', 'thin'], ['bottom', 'thin'], ['left', 'thin'], ['right', 'thin'], ['inside-horizontal', 'thin'], ['inside-vertical', 'thin']]],
    ['Inside borders', 'inside', [['inside-horizontal', 'thin'], ['inside-vertical', 'thin']]],
    ['Inside horizontal border', 'inside-horizontal', [['inside-horizontal', 'thin']]],
    ['Left and right borders', 'left-right', [['left', 'thin'], ['right', 'thin']]],
    ['Thick outside borders', 'outside-thick', [['top', 'thick'], ['bottom', 'thick'], ['left', 'thick'], ['right', 'thick']]],
    ['Double bottom border', 'bottom-double', [['bottom', 'double']]],
    ['Top and thick bottom borders', 'top-bottom-thick', [['top', 'thin'], ['bottom', 'thick']]],
  ])('%s draws its own edges and fixed line styles', (name, key, edges) => {
    const details = applied(name);
    expect(details.preset).toBe(key);
    expect(details.edges).toEqual(edges.map(([edge, lineStyle]) => ({ edge, lineStyle })));
  });

  it('asks the host to clear every border for the none preset', () => {
    const details = applied('No border');
    expect(details).toMatchObject({ preset: 'none', clear: true, edges: [] });
  });

  it('offers only the presets and line styles asked for, in that order', () => {
    render(<CgBorderPicker presets={['bottom', 'none']} lineStyles={['double', 'thin']} defaultLineStyle="double" />);
    expect(screen.getAllByRole('gridcell').map((cell) => cell.getAttribute('data-cg-border-preset'))).toEqual(['bottom', 'none']);
    expect(screen.getAllByRole('radio').map((radio) => radio.getAttribute('data-cg-border-line-style'))).toEqual(['double', 'thin']);
  });

  it('marks the last used preset without changing it by itself', () => {
    render(<CgBorderPicker activePreset="top" />);
    expect(preset('Top border')).toHaveAttribute('aria-selected', 'true');
    expect(preset('Top border').tabIndex).toBe(0);
    fireEvent.click(preset('Bottom border'));
    expect(preset('Top border')).toHaveAttribute('aria-selected', 'true');
    expect(preset('Bottom border')).toHaveAttribute('aria-selected', 'false');
  });

  it('picks a line style like a radio group, and uses it for the next preset', () => {
    const changed = vi.fn();
    const apply = vi.fn<(details: CgBorderApplyDetails) => void>();
    render(<CgBorderPicker onLineStyleChange={changed} onApply={apply} />);
    expect(screen.getByRole('radiogroup', { name: 'Line style' })).toBeInTheDocument();
    expect(line('Thin')).toHaveAttribute('aria-checked', 'true');
    expect(line('Thin').tabIndex).toBe(0);
    expect(line('Dotted').tabIndex).toBe(-1);
    fireEvent.click(line('Thick'));
    expect(changed).toHaveBeenCalledWith('thick');
    expect(line('Thick')).toHaveAttribute('aria-checked', 'true');
    expect(line('Thin')).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(preset('Top border'));
    expect(apply.mock.calls[0]![0].edges).toEqual([{ edge: 'top', lineStyle: 'thick' }]);
  });

  it('moves the line style with the arrow keys, because focus selects a radio', () => {
    const changed = vi.fn();
    render(<CgBorderPicker onLineStyleChange={changed} />);
    act(() => line('Thin').focus());
    fireEvent.keyDown(line('Thin'), { key: 'ArrowRight' });
    expect(line('Medium')).toHaveFocus();
    expect(changed).toHaveBeenCalledWith('medium');
    fireEvent.keyDown(line('Medium'), { key: 'ArrowDown' });
    expect(line('Dotted')).toHaveFocus();
    expect(line('Dotted')).toHaveAttribute('aria-checked', 'true');
  });

  it('stays authoritative for a controlled line style and color', async () => {
    const changed = vi.fn();
    const colorChanged = vi.fn();
    render(<CgBorderPicker lineStyle="thin" onLineStyleChange={changed} color={{ kind: 'automatic' }} onColorChange={colorChanged} />);
    fireEvent.click(line('Thick'));
    expect(changed).toHaveBeenCalledWith('thick');
    expect(line('Thin')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Line color' }));
    await userEvent.click(await screen.findByRole('gridcell', { name: 'Red' }));
    expect(colorChanged).toHaveBeenCalledWith({ kind: 'rgb', color: '#ff0000' });
  });

  it('keeps the tab stop on the checked line style when the host refuses a change', () => {
    const changed = vi.fn();
    render(<CgBorderPicker lineStyle="thin" onLineStyleChange={changed} />);
    fireEvent.click(line('Thick'));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(line('Thin').tabIndex).toBe(0);
    expect(line('Thick').tabIndex).toBe(-1);
  });

  it('remembers recent line colors each time the nested picker opens', async () => {
    render(<CgBorderPicker />);
    const button = screen.getByRole('button', { name: 'Line color' });
    await userEvent.click(button);
    await userEvent.click(await screen.findByRole('gridcell', { name: 'Red' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(button);
    expect(await screen.findByRole('grid', { name: 'Recent colors' })).toBeInTheDocument();
  });

  it('chooses a line color in a nested picker and keeps the border picker open', async () => {
    const apply = vi.fn<(details: CgBorderApplyDetails) => void>();
    render(<CgBorderPicker colorPicker={{ themeColors: [{ key: 'accent1', name: 'Accent 1', color: '#4472c4' }] }} onApply={apply} />);
    const button = screen.getByRole('button', { name: 'Line color' });
    expect(button.querySelector('[data-cg-icon-accent]')).toHaveAttribute('fill', 'currentColor');
    await userEvent.click(button);
    expect(await screen.findByRole('dialog', { name: 'Line color' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Automatic' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('gridcell', { name: 'Accent 1' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(button.querySelector('[data-cg-icon-accent]')).toHaveAttribute('fill', '#4472c4');
    fireEvent.click(preset('Top border'));
    expect(apply.mock.calls[0]![0].color).toEqual({ kind: 'theme', key: 'accent1', tint: 0, color: '#4472c4' });
  });

  it('keeps physical arrows mirrored in RTL while edges stay physical', () => {
    const apply = vi.fn<(details: CgBorderApplyDetails) => void>();
    render(<CgBorderPicker direction="rtl" onApply={apply} presets={['left', 'right']} />);
    act(() => preset('Left border').focus());
    fireEvent.keyDown(preset('Left border'), { key: 'ArrowLeft' });
    expect(preset('Right border')).toHaveFocus();
    fireEvent.click(preset('Left border'));
    expect(apply.mock.calls[0]![0].edges).toEqual([{ edge: 'left', lineStyle: 'thin' }]);
  });

  it('takes translated names', () => {
    render(<CgBorderPicker labels={{ picker: 'حدود', presets: 'الأنماط', lineStyle: 'الخط', lineColor: 'اللون', presetNames: { all: 'الكل' }, lineStyleNames: { thin: 'رفيع' } }} />);
    expect(screen.getByRole('group', { name: 'حدود' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'الأنماط' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'الخط' })).toBeInTheDocument();
    expect(preset('الكل')).toBeInTheDocument();
    expect(preset('No border')).toBeInTheDocument();
    expect(line('رفيع')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'اللون' })).toBeInTheDocument();
  });

  it('blocks everything when disabled', () => {
    const apply = vi.fn();
    render(<CgBorderPicker disabled onApply={apply} />);
    expect(preset('All borders')).toBeDisabled();
    expect(line('Thin')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Line color' })).toBeDisabled();
    fireEvent.click(preset('All borders'));
    expect(apply).not.toHaveBeenCalled();
  });

  it('rejects unknown and repeated presets', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgBorderPicker presets={['nope' as CgBorderPresetKey]} />)).toThrow(/doesn't know preset/);
    expect(() => render(<CgBorderPicker presets={['all', 'all']} />)).toThrow(/duplicate preset/);
    expect(() => render(<CgBorderPicker lineStyles={['thin', 'thin']} />)).toThrow(/repeats a line style/);
    silence.mockRestore();
  });
});
