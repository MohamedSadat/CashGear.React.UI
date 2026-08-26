import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import type { FormEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgDropDownButton, CgSplitButton } from '../src';
import type { CgButtonMenuActions, CgButtonMenuItem } from '../src';

const items: ReadonlyArray<CgButtonMenuItem<{ id: number }>> = [
  { key: 'open', text: 'Open', data: { id: 1 } },
  { key: 'choice', text: 'Choice', checked: false, data: { id: 2 } },
];

describe('button menu surfaces', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, left: 20, top: 20, right: 140, bottom: 60, width: 120, height: 40, toJSON: () => ({}),
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('keeps controlled open state authoritative and exposes actions', async () => {
    const actions = createRef<CgButtonMenuActions>();
    const changed = vi.fn();
    render(<CgDropDownButton items={items} open={false} onOpenChange={changed} actionsRef={actions}>Actions</CgDropDownButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    expect(changed).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    act(() => actions.current?.focus());
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });

  it('honors keep-open vetoes and observes failures without wedging execution', async () => {
    const error = vi.fn();
    const onItemClick = vi.fn().mockResolvedValueOnce({ keepOpen: true }).mockRejectedValueOnce(new Error('failed')).mockResolvedValue(undefined);
    render(<CgDropDownButton items={items} onItemClick={onItemClick} onItemError={error}>Actions</CgDropDownButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(error).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ item: expect.objectContaining({ key: 'open' }) }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Open' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('isolates split primary form behavior from its menu toggle', async () => {
    const submitted = vi.fn((event: FormEvent) => event.preventDefault());
    const primary = vi.fn();
    const openChanged = vi.fn();
    render(<form onSubmit={submitted}>
      <CgSplitButton items={items} type="submit" onClick={primary} onOpenChange={openChanged}>Save</CgSplitButton>
    </form>);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(openChanged.mock.calls).toEqual([[true]]);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(primary).not.toHaveBeenCalled();
    expect(submitted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(primary).toHaveBeenCalledOnce();
    expect(submitted).toHaveBeenCalledOnce();
  });

  it('uses dialog semantics and focuses arbitrary content', async () => {
    render(<CgDropDownButton renderFlyout={({ close }) => <button onClick={close}>Done</button>}>Filters</CgDropDownButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.getByRole('dialog', { name: 'Button menu' })).toBeInTheDocument();
    expect(done).toHaveFocus();
    await userEvent.click(done);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects mixed item and arbitrary-content modes', () => {
    expect(() => render(<CgDropDownButton items={items} renderFlyout={() => <div />} >Invalid</CgDropDownButton>)).toThrow(/mutually exclusive/);
  });
});
