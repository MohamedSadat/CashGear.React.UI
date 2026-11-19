import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgComboBox, CgKeyComboBox, CgUiTextProvider } from '../src';

interface Unit { code: string; name: string; }
const units: Unit[] = [{ code: 'A10', name: 'A10' }, { code: 'BOX', name: 'Box' }, { code: 'PCS', name: 'Pieces' }];
const label = (unit: Unit) => unit.name;
const key = (unit: Unit) => unit.code;
const custom = (text: string): Unit => ({ code: text.toUpperCase(), name: text });
const status = () => document.querySelector('[role="status"]');

function setup(props: { customItemFactory?: ((text: string) => Unit | null) | undefined; defaultValue?: Unit } = {}) {
  const changes = vi.fn();
  render(<><CgComboBox<Unit> aria-label="Unit" options={units} getOptionLabel={label} getOptionKey={key} customItemFactory={custom} onValueChange={changes} {...props} /><button type="button">Elsewhere</button></>);
  const input = screen.getByRole('combobox', { name: 'Unit' });
  fireEvent.focus(input);
  return { changes, input };
}

describe('ComboBox free text (Blazor CustomItemFactory)', () => {
  it('commits typed text on Enter when nothing is highlighted, and shows the hint first', () => {
    const { changes, input } = setup();
    fireEvent.change(input, { target: { value: 'A1' } });
    expect(status()).toHaveTextContent('Press Enter to use "A1".');
    fireEvent.keyDown(input, { key: 'Enter' });
    // "A1" narrows the list to A10 alone; with free text that single match is not a choice.
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenLastCalledWith({ code: 'A1', name: 'A1' }, expect.objectContaining({ reason: 'select' }));
    expect(input).toHaveValue('A1');
  });

  it('lets an exact caption win over the factory, ignoring case', () => {
    const factory = vi.fn(custom);
    const { changes, input } = setup({ customItemFactory: factory });
    fireEvent.change(input, { target: { value: 'box' } });
    expect(status()?.textContent ?? '').not.toContain('Press Enter');
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(factory).not.toHaveBeenCalled();
    expect(changes).toHaveBeenLastCalledWith(units[1], expect.anything());
    expect(input).toHaveValue('Box');
  });

  it('commits the listed item when the factory returns a listed key', () => {
    const { changes, input } = setup({ customItemFactory: (text) => ({ code: text.toUpperCase(), name: `typed ${text}` }) });
    fireEvent.change(input, { target: { value: 'pcs' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(changes).toHaveBeenLastCalledWith(units[2], expect.anything());
    expect(input).toHaveValue('Pieces');
  });

  it('commits on blur and on an outside click, but Escape restores', async () => {
    const { changes, input } = setup({ defaultValue: units[1] });
    fireEvent.change(input, { target: { value: 'Crate' } });
    fireEvent.blur(input);
    await act(async () => Promise.resolve());
    expect(changes).toHaveBeenLastCalledWith({ code: 'CRATE', name: 'Crate' }, expect.anything());

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Pallet' } });
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    fireEvent.pointerDown(elsewhere, { pointerId: 7 });
    fireEvent.pointerUp(elsewhere, { pointerId: 7 });
    await waitFor(() => expect(changes).toHaveBeenLastCalledWith({ code: 'PALLET', name: 'Pallet' }, expect.anything()));

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Drum' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(changes).toHaveBeenCalledTimes(2);
    expect(input).toHaveValue('Pallet');
  });

  it('restores when the factory refuses the text', () => {
    const { changes, input } = setup({ defaultValue: units[1], customItemFactory: () => null });
    fireEvent.change(input, { target: { value: 'Nope' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changes).not.toHaveBeenCalled();
    expect(input).toHaveValue('Box');
  });

  it('keeps the single-match Enter commit without a factory', () => {
    const { changes, input } = setup({ customItemFactory: undefined });
    fireEvent.change(input, { target: { value: 'A1' } });
    expect(status()?.textContent ?? '').not.toContain('Press Enter');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changes).toHaveBeenLastCalledWith(units[0], expect.anything());
  });

  it('takes the hint from customItemText or the text provider', () => {
    render(<CgUiTextProvider translate={(text) => text === 'Press Enter to use "{0}".' ? 'اضغط Enter لاستخدام "{0}".' : text}>
      <CgComboBox<Unit> aria-label="Unit" options={units} getOptionLabel={label} getOptionKey={key} customItemFactory={custom} />
    </CgUiTextProvider>);
    const input = screen.getByRole('combobox', { name: 'Unit' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Crate' } });
    expect(status()).toHaveTextContent('اضغط Enter لاستخدام "Crate".');
  });
});

describe('KeyComboBox free text', () => {
  it('commits a typed key that is not in the list and shows its caption', () => {
    const changes = vi.fn();
    render(<CgKeyComboBox<Unit, string> aria-label="Unit" options={units} getOptionLabel={label} getOptionKey={key} customItemFactory={custom} onValueChange={changes} />);
    const input = screen.getByRole('combobox', { name: 'Unit' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'Crate' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(changes).toHaveBeenLastCalledWith('CRATE', expect.objectContaining({ selectedItem: { code: 'CRATE', name: 'Crate' } }));
    expect(input).toHaveValue('Crate');
  });
});
