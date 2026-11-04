import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgGallery } from '../src';
import type { CgGalleryItem } from '../src';

const items: ReadonlyArray<CgGalleryItem<{ id: number }>> = [
  { key: 'a', text: 'Style A', group: 'light', data: { id: 1 }, preview: <span data-testid="preview-a" /> },
  { key: 'b', text: 'Style B', group: 'light' },
  { key: 'c', text: 'Style C', group: 'light' },
  { key: 'd', text: 'Style D', group: 'dark', disabled: true },
  { key: 'e', text: 'Style E', group: 'dark' },
  { key: 'hidden', text: 'Style hidden', group: 'dark', visible: false },
];
const groups = [{ key: 'light', text: 'Light' }, { key: 'dark', text: 'Dark' }];

const cell = (name: string) => screen.getByRole('gridcell', { name });

describe('CgGallery', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}) });
  });
  afterEach(() => vi.restoreAllMocks());

  it('opens from its button as a dialog, reports the choice, and closes', async () => {
    const change = vi.fn();
    render(<CgGallery items={items} groups={groups} triggerText="Styles" ariaLabel="Table styles" onValueChange={change} />);
    const trigger = screen.getByRole('button', { name: 'Styles' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Table styles' })).toBeInTheDocument();
    await userEvent.click(cell('Style B'));
    expect(change.mock.calls[0]![0]).toBe('b');
    expect(change.mock.calls[0]![1].item.key).toBe('b');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('can stay open after a choice, and marks the choice', async () => {
    render(<CgGallery items={items} groups={groups} triggerText="Styles" closeOnSelect={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Styles' }));
    await userEvent.click(await screen.findByRole('gridcell', { name: 'Style C' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(cell('Style C')).toHaveAttribute('aria-selected', 'true');
  });

  it('honours a controlled open state, and starts focus on the selected swatch', async () => {
    const changed = vi.fn();
    const { rerender } = render(<CgGallery items={items} groups={groups} triggerText="Styles" open={false} onOpenChange={changed} defaultValue="c" />);
    await userEvent.click(screen.getByRole('button', { name: 'Styles' }));
    expect(changed).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<CgGallery items={items} groups={groups} triggerText="Styles" open onOpenChange={changed} defaultValue="c" />);
    const selected = await screen.findByRole('gridcell', { name: 'Style C' });
    await waitFor(() => expect(selected).toHaveFocus());
  });

  it('groups swatches under named grids, draws previews, and leaves out invisible items', () => {
    render(<CgGallery display="inline" items={items} groups={groups} />);
    expect(within(screen.getByRole('grid', { name: 'Light' })).getAllByRole('gridcell')).toHaveLength(3);
    expect(within(screen.getByRole('grid', { name: 'Dark' })).getAllByRole('gridcell')).toHaveLength(2);
    expect(screen.queryByRole('gridcell', { name: 'Style hidden' })).toBeNull();
    expect(screen.getByTestId('preview-a')).toBeInTheDocument();
    expect(cell('Style B')).toHaveTextContent('Style B');
    expect(cell('Style B')).toHaveAttribute('title', 'Style B');
  });

  it('names a group whose key contains a space', () => {
    render(<CgGallery display="inline" items={[{ key: 'a', text: 'A', group: 'two words' }]} groups={[{ key: 'two words', text: 'Named' }]} />);
    expect(screen.getByRole('grid', { name: 'Named' })).toBeInTheDocument();
  });

  it('brings the selected swatch into view when it opens', async () => {
    const scrolled = vi.fn();
    // jsdom has no scrollIntoView to spy on.
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrolled });
    render(<CgGallery items={items} groups={groups} triggerText="Styles" defaultValue="e" />);
    await userEvent.click(screen.getByRole('button', { name: 'Styles' }));
    await waitFor(() => expect(cell('Style E')).toHaveFocus());
    expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });

  it('wraps swatches into rows of the column count', () => {
    render(<CgGallery display="inline" columns={2} ariaLabel="Styles" items={items.map(({ key, text }) => ({ key, text }))} />);
    const rows = within(screen.getByRole('grid', { name: 'Styles' })).getAllByRole('row');
    expect(rows.map((row) => within(row).getAllByRole('gridcell').length)).toEqual([2, 2, 2]);
  });

  it('lets renderItem draw swatches and tells it which is selected', () => {
    render(<CgGallery display="inline" ariaLabel="Styles" items={[{ key: 'a', text: 'A' }, { key: 'b', text: 'B' }]} defaultValue="b" renderItem={({ item, selected }) => <i>{`${item.key}:${String(selected)}`}</i>} />);
    expect(cell('A')).toHaveTextContent('a:false');
    expect(cell('B')).toHaveTextContent('b:true');
  });

  it('stays authoritative when controlled', () => {
    const change = vi.fn();
    render(<CgGallery display="inline" items={items} groups={groups} value="a" onValueChange={change} />);
    fireEvent.click(cell('Style B'));
    expect(change).toHaveBeenCalledOnce();
    expect(cell('Style A')).toHaveAttribute('aria-selected', 'true');
    expect(cell('Style B')).toHaveAttribute('aria-selected', 'false');
  });

  it('moves one tab stop with the arrow keys, skipping disabled swatches', () => {
    render(<CgGallery display="inline" items={items} groups={groups} />);
    const tabStops = () => screen.getAllByRole('gridcell').filter((element) => element.tabIndex === 0);
    expect(tabStops()).toEqual([cell('Style A')]);
    act(() => cell('Style A').focus());
    fireEvent.keyDown(cell('Style A'), { key: 'ArrowRight' });
    expect(cell('Style B')).toHaveFocus();
    expect(tabStops()).toEqual([cell('Style B')]);
    fireEvent.keyDown(cell('Style B'), { key: 'ArrowDown' });
    expect(cell('Style E')).toHaveFocus();
    fireEvent.keyDown(cell('Style E'), { key: 'ArrowLeft' });
    expect(cell('Style E')).toHaveFocus();
    fireEvent.keyDown(cell('Style E'), { key: 'ArrowUp' });
    expect(cell('Style B')).toHaveFocus();
  });

  it('mirrors left and right arrows in RTL', () => {
    render(<CgGallery display="inline" direction="rtl" items={items} groups={groups} />);
    act(() => cell('Style B').focus());
    fireEvent.keyDown(cell('Style B'), { key: 'ArrowLeft' });
    expect(cell('Style C')).toHaveFocus();
    fireEvent.keyDown(cell('Style C'), { key: 'ArrowRight' });
    expect(cell('Style B')).toHaveFocus();
  });

  it('blocks a disabled swatch, and everything when disabled', () => {
    const change = vi.fn();
    const { unmount } = render(<CgGallery display="inline" items={items} groups={groups} onValueChange={change} />);
    expect(cell('Style D')).toBeDisabled();
    fireEvent.click(cell('Style D'));
    expect(change).not.toHaveBeenCalled();
    unmount();
    render(<><CgGallery display="inline" disabled items={items} groups={groups} onValueChange={change} /><CgGallery disabled items={items} groups={groups} triggerText="Styles" /></>);
    expect(cell('Style A')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Styles' })).toBeDisabled();
  });

  it('shows a footer, and passes native attributes and a ref to its root', () => {
    render(<CgGallery display="inline" items={[{ key: 'a', text: 'A' }]} footer={<button type="button">New style</button>} data-testid="root" />);
    expect(screen.getByRole('button', { name: 'New style' })).toBeInTheDocument();
    expect(screen.getByTestId('root')).toHaveAttribute('data-cg-gallery');
  });

  it('rejects bad configuration clearly', () => {
    const silence = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgGallery display="inline" items={[{ key: ' ', text: 'A' }]} />)).toThrow(/nonempty key/);
    expect(() => render(<CgGallery display="inline" items={[{ key: 'a', text: 'A' }, { key: 'a', text: 'B' }]} />)).toThrow(/duplicate key/);
    expect(() => render(<CgGallery display="inline" items={[{ key: 'a', text: 'A', group: 'nope' }]} />)).toThrow(/unknown group/);
    expect(() => render(<CgGallery display="inline" items={[]} groups={[{ key: 'x', text: 'X' }, { key: 'x', text: 'Y' }]} />)).toThrow(/duplicate group/);
    expect(() => render(<CgGallery display="inline" items={[]} columns={0} />)).toThrow(/positive integer/);
    silence.mockRestore();
  });
});
