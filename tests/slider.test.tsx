import { fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgField, CgSlider } from '../src';
import type { CgSliderProps } from '../src';

function track(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-cg-slider-track]')!;
}

/** Gives the track 100 px starting at x = 100, so a pointer's x maps directly onto a 0 to 100 slider. */
function mockTrackRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 0, left: 100, top: 0, right: 200, bottom: 16, width: 100, height: 16, toJSON: () => ({}) });
}

function Controlled(props: CgSliderProps) {
  const [value, setValue] = useState(props.value ?? 50);
  return <CgSlider {...props} value={value} onValueChange={(next) => { setValue(next); props.onValueChange?.(next); }} />;
}

describe('CgSlider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exposes slider semantics on the thumb and renders on the server', () => {
    const html = renderToString(<CgSlider ariaLabel="Zoom" min={10} max={400} value={100} />);
    expect(html).toContain('role="slider"');
    expect(html).toContain('aria-valuenow="100"');

    render(<CgSlider ariaLabel="Zoom" min={10} max={400} value={100} formatValue={(value) => `${value}%`} />);
    const thumb = screen.getByRole('slider', { name: 'Zoom' });
    expect(thumb).toHaveAttribute('aria-valuemin', '10');
    expect(thumb).toHaveAttribute('aria-valuemax', '400');
    expect(thumb).toHaveAttribute('aria-valuenow', '100');
    expect(thumb).toHaveAttribute('aria-valuetext', '100%');
    expect(thumb).toHaveAttribute('aria-orientation', 'horizontal');
    expect(thumb).toHaveAttribute('tabindex', '0');
    expect(thumb).toHaveAttribute('data-cg-slider-thumb');
  });

  it('defaults to the minimum, clamps out-of-range values, and keeps in-range controlled values unsnapped', () => {
    const { rerender } = render(<CgSlider min={5} max={10} />);
    expect(screen.getByRole('slider', { name: 'Value' })).toHaveAttribute('aria-valuenow', '5');
    rerender(<CgSlider key="high" min={5} max={10} value={99} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '10');
    rerender(<CgSlider key="off-grid" min={0} max={10} step={2} value={3.5} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '3.5');
  });

  it('positions by a logical percentage and passes native attributes to the root', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(<CgSlider ref={ref} min={0} max={200} defaultValue={50} size="small" className="custom" style={{ inlineSize: 180 }} id="zoom" data-testid="zoom-slider" title="Zoom level" direction="rtl" />);
    const root = screen.getByTestId('zoom-slider');
    expect(ref.current).toBe(root);
    expect(root).toHaveClass('custom');
    expect(root).toHaveAttribute('id', 'zoom');
    expect(root).toHaveAttribute('title', 'Zoom level');
    expect(root).toHaveAttribute('data-size', 'small');
    expect(root).toHaveAttribute('dir', 'rtl');
    expect(root.style.getPropertyValue('--cg-slider-percent')).toBe('25%');
    expect(root.style.inlineSize).toBe('180px');
    expect(container.querySelector('[data-cg-slider-track]')).toContainElement(screen.getByRole('slider'));
  });

  it('steps with arrows, pages by ten steps, and goes to the limits, committing each change', () => {
    const change = vi.fn();
    const commit = vi.fn();
    render(<CgSlider min={0} max={200} defaultValue={100} step={2} onValueChange={change} onValueCommit={commit} />);
    const thumb = screen.getByRole('slider');
    const press = (key: string, expected: number) => {
      fireEvent.keyDown(thumb, { key });
      expect(thumb).toHaveAttribute('aria-valuenow', String(expected));
      expect(change).toHaveBeenLastCalledWith(expected);
      expect(commit).toHaveBeenLastCalledWith(expected);
    };
    press('ArrowRight', 102);
    press('ArrowUp', 104);
    press('ArrowLeft', 102);
    press('ArrowDown', 100);
    press('PageUp', 120);
    press('PageDown', 100);
    press('End', 200);
    press('Home', 0);
  });

  it('ignores unrelated and modified keys, and swallows handled keys at the limit without a change', () => {
    const change = vi.fn();
    render(<CgSlider max={10} defaultValue={10} onValueChange={change} />);
    const thumb = screen.getByRole('slider');
    expect(fireEvent.keyDown(thumb, { key: 'a' })).toBe(true);
    expect(fireEvent.keyDown(thumb, { key: 'ArrowLeft', altKey: true })).toBe(true);
    expect(fireEvent.keyDown(thumb, { key: 'ArrowLeft', ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(thumb, { key: 'ArrowRight' })).toBe(false);
    expect(change).not.toHaveBeenCalled();
  });

  it('mirrors horizontal arrows and pointer positions in RTL, inherited or explicit', () => {
    const change = vi.fn();
    const { container, rerender } = render(<div dir="rtl"><CgSlider defaultValue={50} onValueChange={change} /></div>);
    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(49);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(change).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(thumb, { key: 'ArrowUp' });
    expect(change).toHaveBeenLastCalledWith(51);
    mockTrackRect(track(container));
    fireEvent.pointerDown(track(container), { pointerId: 1, button: 0, clientX: 125 });
    expect(change).toHaveBeenLastCalledWith(75);
    fireEvent.pointerUp(track(container), { pointerId: 1, button: 0, clientX: 125 });

    rerender(<div dir="rtl"><CgSlider key="forced" direction="ltr" defaultValue={50} onValueChange={change} /></div>);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(51);
  });

  it('stays exact with decimal steps', () => {
    const change = vi.fn();
    render(<CgSlider min={0} max={1} step={0.1} defaultValue={0.2} onValueChange={change} />);
    const thumb = screen.getByRole('slider');
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(0.3);
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(0.4);
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    fireEvent.keyDown(thumb, { key: 'ArrowLeft' });
    expect(change).toHaveBeenLastCalledWith(0.2);
  });

  it('moves an off-grid value to its neighbouring step and keeps an off-grid maximum reachable', () => {
    const change = vi.fn();
    render(<CgSlider min={0} max={10} step={4} value={5} onValueChange={change} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(change).toHaveBeenLastCalledWith(8);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(change).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'End' });
    expect(change).toHaveBeenLastCalledWith(10);
  });

  it('jumps on a track click, follows the drag, and commits once on release', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<Controlled onValueChange={change} onValueCommit={commit} step={5} />);
    const element = track(container);
    mockTrackRect(element);
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 120 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '20');
    expect(screen.getByRole('slider')).toHaveFocus();
    expect(change).toHaveBeenLastCalledWith(20);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 141 });
    expect(change).toHaveBeenLastCalledWith(40);
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 142 });
    expect(change).toHaveBeenCalledTimes(2);
    fireEvent.pointerMove(element, { pointerId: 2, buttons: 1, clientX: 170 });
    expect(change).toHaveBeenCalledTimes(2);
    fireEvent.pointerUp(element, { pointerId: 1, button: 0, clientX: 300 });
    expect(change).toHaveBeenLastCalledWith(100);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(100);
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 110 });
    expect(change).toHaveBeenCalledTimes(3);
    fireEvent.lostPointerCapture(element, { pointerId: 1 });
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('ends a drag whose release never arrived, at its last position, rather than following the hover', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueChange={change} onValueCommit={commit} />);
    const element = track(container);
    mockTrackRect(element);
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 120 });
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 130 });
    expect(change).toHaveBeenLastCalledWith(30);
    fireEvent.pointerMove(element, { pointerId: 2, buttons: 0, clientX: 190 });
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 0, clientX: 190 });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(30);
    expect(change).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 190 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '30');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('ignores pointer events with no gesture in progress', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueChange={change} onValueCommit={commit} />);
    mockTrackRect(track(container));
    for (const type of ['pointerMove', 'pointerUp', 'pointerCancel', 'lostPointerCapture'] as const) fireEvent[type](track(container), { pointerId: 1, clientX: 180 });
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
  });

  it('does not move or commit when the thumb is pressed and released in place, off its centre', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueChange={change} onValueCommit={commit} />);
    const element = track(container);
    const thumb = screen.getByRole('slider');
    mockTrackRect(element);
    vi.spyOn(thumb, 'getBoundingClientRect').mockReturnValue({ x: 142, y: 0, left: 142, top: 0, right: 158, bottom: 16, width: 16, height: 16, toJSON: () => ({}) });
    fireEvent.pointerDown(thumb, { pointerId: 1, button: 0, clientX: 155 });
    fireEvent.pointerUp(thumb, { pointerId: 1, button: 0, clientX: 155 });
    expect(change).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    fireEvent.pointerDown(thumb, { pointerId: 1, button: 0, clientX: 155 });
    fireEvent.pointerMove(thumb, { pointerId: 1, buttons: 1, clientX: 165 });
    expect(change).toHaveBeenLastCalledWith(60);
    fireEvent.pointerUp(thumb, { pointerId: 1, button: 0, clientX: 165 });
    expect(commit).toHaveBeenCalledWith(60);
  });

  it('restores the starting value without a commit when the pointer is cancelled', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueChange={change} onValueCommit={commit} />);
    const element = track(container);
    mockTrackRect(element);
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 180 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '80');
    fireEvent.pointerCancel(element, { pointerId: 1 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    expect(change).toHaveBeenLastCalledWith(50);
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits a gesture that loses pointer capture before release', () => {
    const commit = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueCommit={commit} />);
    const element = track(container);
    mockTrackRect(element);
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 180 });
    fireEvent.lostPointerCapture(element, { pointerId: 1 });
    expect(commit).toHaveBeenCalledWith(80);
    fireEvent.pointerMove(element, { pointerId: 1, buttons: 1, clientX: 110 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '80');
  });

  it('keeps a rejected controlled value authoritative across a drag and later keys', () => {
    const change = vi.fn();
    const commit = vi.fn();
    const { container } = render(<CgSlider value={50} onValueChange={change} onValueCommit={commit} />);
    const element = track(container);
    mockTrackRect(element);
    fireEvent.pointerDown(element, { pointerId: 1, button: 0, clientX: 170 });
    fireEvent.pointerUp(element, { pointerId: 1, button: 0, clientX: 170 });
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
    expect(commit).toHaveBeenCalledWith(70);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    expect(change).toHaveBeenLastCalledWith(51);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '50');
  });

  it('ignores secondary pointer buttons', () => {
    const change = vi.fn();
    const { container } = render(<CgSlider defaultValue={50} onValueChange={change} />);
    mockTrackRect(track(container));
    fireEvent.pointerDown(track(container), { pointerId: 1, button: 2, clientX: 170 });
    fireEvent.pointerMove(track(container), { pointerId: 1, buttons: 2, clientX: 180 });
    expect(change).not.toHaveBeenCalled();
  });

  it('renders steppers with labels and a custom amount, disabling each at its limit', () => {
    const change = vi.fn();
    const commit = vi.fn();
    render(<CgSlider min={10} max={120} defaultValue={100} stepperStep={10} showSteppers decreaseLabel="Zoom out" increaseLabel="Zoom in" onValueChange={change} onValueCommit={commit} />);
    const decrease = screen.getByRole('button', { name: 'Zoom out' });
    const increase = screen.getByRole('button', { name: 'Zoom in' });
    expect(decrease).toHaveAttribute('data-cg-slider-stepper', 'decrease');
    expect(increase).toHaveAttribute('data-cg-slider-stepper', 'increase');
    fireEvent.click(increase);
    expect(change).toHaveBeenLastCalledWith(110);
    expect(commit).toHaveBeenLastCalledWith(110);
    fireEvent.click(increase);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '120');
    expect(increase).toBeDisabled();
    expect(decrease).toBeEnabled();
    fireEvent.click(decrease);
    expect(change).toHaveBeenLastCalledWith(110);
    expect(increase).toBeEnabled();
  });

  it('moves focus to the thumb when a focused stepper reaches its limit, and hides steppers by default', () => {
    const { rerender } = render(<CgSlider max={10} defaultValue={9} showSteppers />);
    const increase = screen.getByRole('button', { name: 'Increase' });
    increase.focus();
    fireEvent.click(increase);
    expect(screen.getByRole('slider')).toHaveFocus();
    rerender(<CgSlider key="plain" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses the larger of the step and stepper amounts so a stepper always moves', () => {
    render(<CgSlider max={100} step={10} stepperStep={1} defaultValue={50} showSteppers />);
    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '60');
  });

  it('blocks every interaction when disabled', () => {
    const change = vi.fn();
    const { container } = render(<CgSlider disabled defaultValue={50} showSteppers onValueChange={change} data-testid="root" />);
    const thumb = screen.getByRole('slider');
    expect(thumb).toHaveAttribute('aria-disabled', 'true');
    expect(thumb).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('root')).toHaveAttribute('data-disabled', 'true');
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    mockTrackRect(track(container));
    fireEvent.pointerDown(track(container), { pointerId: 1, button: 0, clientX: 170 });
    fireEvent.pointerUp(track(container), { pointerId: 1, button: 0, clientX: 170 });
    expect(change).not.toHaveBeenCalled();
    expect(thumb).toHaveAttribute('aria-valuenow', '50');
  });

  it('draws one tick per distinct in-range mark at its logical position', () => {
    const { container } = render(<CgSlider min={0} max={200} marks={[100, 100, 50, -1, 201]} />);
    const marks = [...container.querySelectorAll<HTMLElement>('[data-cg-slider-mark]')];
    expect(marks.map((mark) => mark.dataset.cgSliderMark)).toEqual(['100', '50']);
    expect(marks[1]!.style.getPropertyValue('--cg-slider-mark-position')).toBe('25%');
    expect(marks[0]).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes its name from ariaLabel, native ARIA, or CgField', () => {
    const { rerender } = render(<CgSlider ariaLabel="Zoom" aria-label="Ignored" aria-describedby="help" />);
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveAttribute('aria-describedby', 'help');
    rerender(<CgSlider aria-label="Native" />);
    expect(screen.getByRole('slider', { name: 'Native' })).toBeInTheDocument();
    rerender(<><span id="caption">Caption</span><CgSlider aria-labelledby="caption" /></>);
    expect(screen.getByRole('slider', { name: 'Caption' })).not.toHaveAttribute('aria-label');
    rerender(<CgField label="Volume" disabled><CgSlider /></CgField>);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('rejects invalid configuration', () => {
    expect(() => render(<CgSlider min={5} max={5} />)).toThrow(/max must be greater/);
    expect(() => render(<CgSlider step={0} />)).toThrow(/step/);
    expect(() => render(<CgSlider stepperStep={-1} />)).toThrow(/stepperStep/);
    expect(() => render(<CgSlider value={Number.NaN} />)).toThrow(/value/);
    expect(() => render(<CgSlider min={Number.POSITIVE_INFINITY} />)).toThrow(/min/);
  });
});
