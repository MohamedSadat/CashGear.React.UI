import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CgButtonGroup } from '../src';

describe('CgButtonGroup', () => {
  it('validates stable names and explicit names for custom content', () => {
    expect(() => render(<CgButtonGroup items={[{ name: '', text: 'Empty' }]} />)).toThrow(/non-empty name/);
    expect(() => render(<CgButtonGroup items={[{ name: 'same', text: 'A' }, { name: 'same', text: 'B' }]} />)).toThrow(/duplicate name/);
    expect(() => render(<CgButtonGroup items={[{ name: 'custom', text: 'Visual', render: () => <strong>Visual</strong> }]} />)).toThrow(/accessible/);
  });

  it('runs item and group callbacks before proposing controlled single selection', async () => {
    const order: string[] = [];
    const changed = vi.fn(() => order.push('selection'));
    const items = [{ name: 'list', text: 'List' }, { name: 'map', text: 'Map', onClick: async () => { order.push('item'); } }];
    render(<CgButtonGroup selectionMode="single" selectedName="list" items={items} onItemClick={async () => { order.push('group'); }} onSelectedNameChange={changed} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Map' }));
    expect(order).toEqual(['item', 'group', 'selection']);
    expect(changed).toHaveBeenCalledWith('map', expect.objectContaining({ previousName: 'list', source: 'pointer' }));
    expect(screen.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radiogroup')).not.toHaveAttribute('selectedName');
  });

  it('updates uncontrolled multiple selection immutably', async () => {
    const changes: ReadonlyArray<string>[] = [];
    render(<CgButtonGroup selectionMode="multiple" defaultSelectedNames={['one']} items={[{ name: 'one', text: 'One' }, { name: 'two', text: 'Two' }]} onSelectedNamesChange={(names) => changes.push(names)} />);
    await userEvent.click(screen.getByRole('button', { name: 'Two' }));
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-pressed', 'true');
    expect(changes[0]).toEqual(['one', 'two']);
    expect(Object.isFrozen(changes[0])).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'One' }));
    expect(changes[1]).toEqual(['two']);
    expect(changes[1]).not.toBe(changes[0]);
  });

  it('recovers from errors and suppresses overlapping automatic actions', async () => {
    let release: (() => void) | undefined;
    const action = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const failed = vi.fn();
    const first = render(<CgButtonGroup items={[{ name: 'save', text: 'Save', autoLoading: true, onClick: action }]} onItemError={failed} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    await act(async () => release?.());
    await waitFor(() => expect(screen.getByRole('button')).not.toHaveAttribute('aria-busy'));

    first.unmount();
    render(<CgButtonGroup selectionMode="single" selectedName="one" items={[{ name: 'one', text: 'One' }, { name: 'fail', text: 'Fail', onClick: () => { throw new Error('nope'); } }]} onItemError={failed} onSelectedNameChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Fail' }));
    expect(failed).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ name: 'fail' }));
    expect(screen.getByRole('radio', { name: 'One' })).toHaveAttribute('aria-checked', 'true');
  });

  it('wraps roving focus, skips unavailable items, and selects with RTL arrows', async () => {
    render(<CgButtonGroup selectionMode="single" defaultSelectedName="one" direction="rtl" items={[
      { name: 'one', text: 'One' },
      { name: 'hidden', text: 'Hidden', visible: false },
      { name: 'disabled', text: 'Disabled', disabled: true },
      { name: 'three', text: 'Three' },
    ]} />);
    const one = screen.getByRole('radio', { name: 'One' });
    const three = screen.getByRole('radio', { name: 'Three' });
    one.focus();
    await act(async () => { fireEvent.keyDown(one, { key: 'ArrowLeft' }); });
    expect(three).toHaveFocus();
    await waitFor(() => expect(three).toHaveAttribute('aria-checked', 'true'));
    fireEvent.keyDown(three, { key: 'Home' });
    expect(one).toHaveFocus();
    fireEvent.keyDown(one, { key: 'End' });
    expect(three).toHaveFocus();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });

  it('uses physical vertical navigation and command-button semantics', () => {
    render(<CgButtonGroup orientation="vertical" items={[{ name: 'one', text: 'One' }, { name: 'busy', text: 'Busy', loading: true }, { name: 'three', text: 'Three' }]} />);
    const one = screen.getByRole('button', { name: 'One' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowUp' });
    expect(screen.getByRole('button', { name: 'Three' })).toHaveFocus();
    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
    expect(screen.getByRole('group')).not.toHaveAttribute('aria-orientation');
  });
});
