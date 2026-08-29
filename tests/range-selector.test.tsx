import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CgRangeSelector } from '../src/components/RangeSelector';
import type { CgRangeSelectorActions } from '../src/components/RangeSelector';

describe('CgRangeSelector', () => {
  it('renders meaningful SSR sliders, labels, chart, and markers without browser globals', () => {
    const html = renderToString(<CgRangeSelector valueKind="number" minimum={0} maximum={100} value={{ start: 20, end: 80 }} showMarkers markerCount={3} renderChart={() => <svg data-chart="" />} />);
    expect(html.match(/role="slider"/gu)).toHaveLength(2);
    expect(html).toContain('aria-valuenow="20"');
    expect(html).toContain('data-chart');
    expect(html.match(/cg-range-selector-marker-percent/gu)).toHaveLength(3);
  });

  it('commits keyboard updates in changing, value-change, changed order with frozen values', () => {
    const calls: string[] = [];
    const changing = vi.fn((value: object) => { calls.push('changing'); expect(Object.isFrozen(value)).toBe(true); });
    const change = vi.fn((value: object, details: object) => { calls.push('change'); expect(Object.isFrozen(value)).toBe(true); expect(Object.isFrozen(details)).toBe(true); });
    const changed = vi.fn(() => calls.push('changed'));
    render(<CgRangeSelector valueKind="number" minimum={0} maximum={100} defaultValue={{ start: 20, end: 80 }} step={5} onRangeChanging={changing} onValueChange={change} onRangeChanged={changed} />);
    const start = screen.getByRole('slider', { name: 'Start value' });
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    expect(calls).toEqual(['changing', 'change', 'changed']);
    expect(change).toHaveBeenCalledWith({ start: 25, end: 80 }, expect.objectContaining({ reason: 'keyboard', handle: 'start' }));
    expect(start).toHaveAttribute('aria-valuenow', '25');
  });

  it('keeps controlled unsnapped values authoritative after a rejected change', async () => {
    const change = vi.fn();
    render(<CgRangeSelector valueKind="number" minimum={0} maximum={10} value={{ start: 1.25, end: 8.75 }} step={1} onValueChange={change} />);
    const start = screen.getByRole('slider', { name: 'Start value' });
    expect(start).toHaveAttribute('aria-valuenow', '1.25');
    fireEvent.keyDown(start, { key: 'ArrowRight' });
    await Promise.resolve();
    expect(change).toHaveBeenCalledWith({ start: 2, end: 8.75 }, expect.any(Object));
    expect(start).toHaveAttribute('aria-valuenow', '1.25');
  });

  it('uses physical RTL arrows and preserves numeric up/down behavior', () => {
    const change = vi.fn();
    const { rerender } = render(<div dir="rtl"><CgRangeSelector valueKind="number" minimum={0} maximum={10} defaultValue={{ start: 3, end: 8 }} onValueChange={change} /></div>);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Start value' }), { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith({ start: 2, end: 8 }, expect.any(Object));
    rerender(<div dir="rtl"><CgRangeSelector key="fresh" valueKind="number" minimum={0} maximum={10} defaultValue={{ start: 3, end: 8 }} onValueChange={change} /></div>);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Start value' }), { key: 'ArrowUp' });
    expect(change).toHaveBeenLastCalledWith({ start: 4, end: 8 }, expect.any(Object));
  });

  it('exposes actions and applies disabled/read-only slider semantics', () => {
    const actions = createRef<CgRangeSelectorActions<number>>();
    const { rerender } = render(<CgRangeSelector valueKind="number" minimum={0} maximum={10} actionsRef={actions} disabled />);
    const disabled = screen.getAllByRole('slider')[0]!;
    expect(disabled).toHaveAttribute('tabindex', '-1');
    expect(actions.current?.focusHandle('start')).toBe(false);
    expect(Object.isFrozen(actions.current?.getValue())).toBe(true);
    rerender(<CgRangeSelector valueKind="number" minimum={0} maximum={10} actionsRef={actions} readOnly />);
    const readonly = screen.getAllByRole('slider')[0]!;
    expect(readonly).toHaveAttribute('tabindex', '0');
    expect(readonly).toHaveAttribute('aria-disabled', 'true');
  });

  it('validates marker and accessible-label configuration during render', () => {
    expect(() => render(<CgRangeSelector valueKind="number" minimum={0} maximum={10} markerCount={1} />)).toThrow(/at least two/);
    expect(() => render(<CgRangeSelector valueKind="number" minimum={0} maximum={10} startHandleAriaLabel="" />)).toThrow(/nonempty accessible labels/);
  });

  it('survives Strict Mode replay without duplicate keyboard commits', () => {
    const change = vi.fn();
    render(<StrictMode><CgRangeSelector valueKind="number" minimum={0} maximum={10} defaultValue={{ start: 2, end: 8 }} onValueChange={change} /></StrictMode>);
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Start value' }), { key: 'ArrowUp' });
    expect(change).toHaveBeenCalledOnce();
  });
});
