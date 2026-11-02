import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CgStatusBar } from '../src';
import type { CgStatusBarItem } from '../src';

let notifyResize: (() => void) | undefined;

/** Lays the bar out by numbers: `barWidth` for the root, and each item's width from its `data-width`. */
function mockLayout(initialWidth: number) {
  let barWidth = initialWidth;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function clientWidth(this: HTMLElement) {
    return this.hasAttribute('data-cg-status-bar') ? barWidth : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: HTMLElement) {
    return { width: Number(this.dataset.width ?? 0) } as DOMRect;
  });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notifyResize = callback; }
    observe() { /* The test drives notifications. */ }
    disconnect() { notifyResize = undefined; }
  });
  return (width: number) => { barWidth = width; act(() => notifyResize?.()); };
}

const shown = () => [...document.querySelectorAll<HTMLElement>('[data-cg-status-bar-item]')].filter((item) => !item.hidden).map((item) => item.dataset.cgStatusBarItem);

describe('CgStatusBar', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is a labelled polite live region that announces only the item that changed', () => {
    const { rerender } = render(<CgStatusBar items={[{ key: 'ready', content: 'Ready' }]} />);
    const bar = screen.getByRole('status', { name: 'Status bar' });
    expect(bar).toHaveAttribute('aria-live', 'polite');
    expect(bar).toHaveAttribute('aria-atomic', 'false');
    rerender(<CgStatusBar ariaLabel="شريط الحالة" items={[]} />);
    expect(screen.getByRole('status', { name: 'شريط الحالة' })).toBe(bar);
    rerender(<CgStatusBar aria-label="Native" items={[]} />);
    expect(screen.getByRole('status', { name: 'Native' })).toBe(bar);
  });

  it('lets the app silence or widen the live region', () => {
    render(<CgStatusBar aria-live="off" aria-atomic items={[]} />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'off');
    expect(screen.getByRole('status')).toHaveAttribute('aria-atomic', 'true');
  });

  it('passes native attributes, size, and direction to the root', () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(<CgStatusBar ref={ref} items={[]} id="bar" className="custom" style={{ color: 'red' }} data-testid="bar" size="small" direction="rtl" />);
    const bar = screen.getByTestId('bar');
    expect(ref.current).toBe(bar);
    expect(bar).toHaveAttribute('id', 'bar');
    expect(bar).toHaveClass('custom');
    expect(bar.style.color).toBe('red');
    expect(bar).toHaveAttribute('data-size', 'small');
    expect(bar).toHaveAttribute('dir', 'rtl');
    rerender(<CgStatusBar items={[]} data-testid="bar" />);
    expect(bar).toHaveAttribute('data-size', 'medium');
    expect(bar).not.toHaveAttribute('dir');
  });

  it('places start items before end items, and leaves out invisible ones', () => {
    render(<CgStatusBar items={[
      { key: 'zoom', content: 'Zoom', align: 'end' },
      { key: 'ready', content: 'Ready' },
      { key: 'gone', content: 'Gone', visible: false },
      { key: 'mode', content: 'Mode', align: 'start', visible: true },
      { key: 'sum', content: 'Sum', align: 'end' },
    ]} />);
    expect(shown()).toEqual(['ready', 'mode', 'zoom', 'sum']);
    expect(screen.queryByText('Gone')).not.toBeInTheDocument();
    const [mode, zoom] = [screen.getByText('Mode'), screen.getByText('Zoom')];
    expect(mode.nextElementSibling).toBe(zoom.previousElementSibling);
  });

  it('renders a button only for items with onClick, and passes data attributes to either element', () => {
    const click = vi.fn();
    render(<CgStatusBar items={[
      { key: 'text', content: 'Text', tooltip: 'Plain', className: 'text-class', 'data-testid': 'text-item', 'data-kind': 'plain' },
      { key: 'action', content: 'Action', tooltip: 'Clickable', className: 'action-class', onClick: click, 'data-testid': 'action-item', 'data-count': 3 },
    ]} />);
    const text = screen.getByTestId('text-item');
    expect(text.tagName).toBe('DIV');
    expect(text).toHaveAttribute('title', 'Plain');
    expect(text).toHaveClass('text-class');
    expect(text).toHaveAttribute('data-kind', 'plain');
    const action = screen.getByRole('button', { name: 'Action' });
    expect(action).toBe(screen.getByTestId('action-item'));
    expect(action).toHaveAttribute('type', 'button');
    expect(action).toHaveAttribute('title', 'Clickable');
    expect(action).toHaveClass('action-class');
    expect(action).toHaveAttribute('data-count', '3');
    fireEvent.click(action);
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.calls[0]![0]).toHaveProperty('currentTarget');
  });

  it('draws a divider before an item unless it comes first at its end of the bar', () => {
    const setWidth = mockLayout(1000);
    const items: ReadonlyArray<CgStatusBarItem> = [
      { key: 'first', content: 'First', separator: true, priority: -1, 'data-width': 500 },
      { key: 'second', content: 'Second', separator: true, 'data-width': 80 },
      { key: 'third', content: 'Third', 'data-width': 80 },
      { key: 'end', content: 'End', align: 'end', separator: true, 'data-width': 80 },
      { key: 'last', content: 'Last', align: 'end', separator: true, 'data-width': 80 },
    ];
    render(<CgStatusBar items={items} />);
    const divided = () => [...document.querySelectorAll<HTMLElement>('[data-separator]')].map((item) => item.dataset.cgStatusBarItem);
    expect(divided()).toEqual(['second', 'last']);
    setWidth(400);
    expect(shown()).toEqual(['second', 'third', 'end', 'last']);
    expect(divided()).toEqual(['last']);
  });

  it('keeps every item when the bar has no measurable width, as on the server', () => {
    const items: ReadonlyArray<CgStatusBarItem> = [{ key: 'a', content: 'A', priority: 1 }, { key: 'b', content: 'B' }];
    expect(renderToString(<CgStatusBar items={items} />)).toContain('role="status"');
    render(<CgStatusBar items={items} />);
    expect(shown()).toEqual(['a', 'b']);
  });

  it('hides lower priorities first, later items among equals, and brings them back as space returns', () => {
    const setWidth = mockLayout(400);
    render(<CgStatusBar items={[
      { key: 'low', content: 'Low', priority: -1, 'data-width': 80 },
      { key: 'first-default', content: 'First', 'data-width': 80 },
      { key: 'later-default', content: 'Later', 'data-width': 80, align: 'end' },
      { key: 'high', content: 'High', priority: 5, 'data-width': 80, align: 'end' },
    ]} />);
    expect(shown()).toEqual(['low', 'first-default', 'later-default', 'high']);
    setWidth(319);
    expect(shown()).toEqual(['first-default', 'later-default', 'high']);
    expect(screen.getByText('Low')).not.toBeVisible();
    setWidth(200);
    expect(shown()).toEqual(['first-default', 'high']);
    setWidth(100);
    expect(shown()).toEqual(['high']);
    setWidth(320);
    expect(shown()).toEqual(['low', 'first-default', 'later-default', 'high']);
  });

  it('never shows a lower priority while a higher one is hidden, even if the lower one would fit', () => {
    mockLayout(150);
    render(<CgStatusBar items={[
      { key: 'high', content: 'High', priority: 3, 'data-width': 90 },
      { key: 'wide', content: <button>Wide</button>, priority: 2, 'data-width': 90 },
      { key: 'small', content: 'Small', priority: 1, 'data-width': 20 },
    ]} />);
    expect(shown()).toEqual(['high']);
  });

  it('truncates long text down to a minimum before anything hides, leaving short items whole', () => {
    const setWidth = mockLayout(400);
    render(<CgStatusBar items={[
      { key: 'message', content: 'A very long message', 'data-width': 900, 'data-testid': 'message' },
      { key: 'sum', content: 'Sum', align: 'end', 'data-width': 60, 'data-testid': 'sum' },
    ]} />);
    expect(shown()).toEqual(['message', 'sum']);
    expect(screen.getByTestId('message').style.minInlineSize).toBe('96px');
    expect(screen.getByTestId('sum').style.minInlineSize).toBe('60px');
    setWidth(156);
    expect(shown()).toEqual(['message', 'sum']);
    setWidth(155);
    expect(shown()).toEqual(['message']);
  });

  it('keeps a control at its whole width, and lets the last item shrink rather than overflow', () => {
    const setWidth = mockLayout(400);
    render(<CgStatusBar items={[
      { key: 'zoom', content: <div role="slider" aria-label="Zoom" aria-valuenow={1} />, 'data-width': 200, 'data-testid': 'zoom', priority: 1 },
      { key: 'text', content: 'Some long text', 'data-width': 300, 'data-testid': 'text' },
    ]} />);
    expect(screen.getByTestId('zoom').style.minInlineSize).toBe('200px');
    expect(shown()).toEqual(['zoom', 'text']);
    setWidth(250);
    expect(shown()).toEqual(['zoom']);
    setWidth(150);
    expect(shown()).toEqual(['zoom']);
    expect(screen.getByTestId('zoom').style.minInlineSize).toBe('0px');
  });

  it('measures again when the items change', () => {
    mockLayout(200);
    const { rerender } = render(<CgStatusBar items={[{ key: 'a', content: 'A', priority: 1, 'data-width': 90 }, { key: 'b', content: 'B', 'data-width': 90 }]} />);
    expect(shown()).toEqual(['a', 'b']);
    rerender(<CgStatusBar items={[{ key: 'a', content: 'A', priority: 1, 'data-width': 90 }, { key: 'b', content: 'B', 'data-width': 90 }, { key: 'c', content: 'C', 'data-width': 90 }]} />);
    expect(shown()).toEqual(['a', 'b']);
    rerender(<CgStatusBar items={[{ key: 'a', content: 'A', priority: 1, 'data-width': 90 }, { key: 'c', content: 'C', 'data-width': 90 }]} />);
    expect(shown()).toEqual(['a', 'c']);
  });

  it('rejects empty and duplicate keys', () => {
    expect(() => render(<CgStatusBar items={[{ key: ' ', content: 'A' }]} />)).toThrow(/nonempty key/);
    expect(() => render(<CgStatusBar items={[{ key: 'a', content: 'A' }, { key: 'a', content: 'B', visible: false }]} />)).toThrow(/duplicate key 'a'/);
  });
});
