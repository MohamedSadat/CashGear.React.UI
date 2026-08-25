import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgKeyComboBox } from '../src';
import type { CgKeyComboBoxProps } from '../src';

interface Customer {
  id: number;
  code: string;
  name: string;
}

const customers: Customer[] = [
  { id: 0, code: 'C-000', name: 'Walk-in customer' },
  { id: 1, code: 'C-100', name: 'Acme Manufacturing' },
  { id: 2, code: 'C-200', name: 'Contoso Retail' },
];

const getLabel = (item: Customer) => `${item.code} - ${item.name}`;
const getKey = (item: Customer) => item.id;

describe('CgKeyComboBox', () => {
  it('binds a controlled numeric key and reports scalar and item details', () => {
    const changes = vi.fn();

    function Controlled() {
      const [value, setValue] = useState<number | null>(1);
      return (
        <CgKeyComboBox
          options={customers}
          value={value}
          onValueChange={(next, details) => {
            changes(next, details);
            setValue(next);
          }}
          getOptionLabel={getLabel}
          getOptionKey={getKey}
        />
      );
    }

    render(<Controlled />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Contoso' } });
    fireEvent.click(screen.getByRole('option', { hidden: true }));

    expect(input).toHaveValue(getLabel(customers[2]!));
    expect(changes).toHaveBeenCalledWith(2, expect.objectContaining({
      reason: 'select',
      previousValue: 1,
      selectedItem: customers[2],
      previousSelectedItem: customers[1],
    }));
  });

  it('preserves zero, clears to null, submits the key, and resets uncontrolled state', async () => {
    const changes = vi.fn();
    render(
      <form data-testid="form">
        <CgKeyComboBox
          options={customers}
          defaultValue={0}
          onValueChange={changes}
          getOptionLabel={getLabel}
          getOptionKey={getKey}
          name="customerId"
        />
      </form>,
    );

    const input = screen.getByRole('combobox');
    expect(input).toHaveValue(getLabel(customers[0]!));
    expect(new FormData(screen.getByTestId('form')).get('customerId')).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(input).toHaveValue('');
    expect(changes).toHaveBeenLastCalledWith(null, expect.objectContaining({
      reason: 'clear',
      previousValue: 0,
      selectedItem: null,
      previousSelectedItem: customers[0],
    }));

    fireEvent.reset(screen.getByTestId('form'));
    await act(async () => { await Promise.resolve(); });
    expect(input).toHaveValue(getLabel(customers[0]!));
    expect(changes).toHaveBeenLastCalledWith(0, expect.objectContaining({
      reason: 'reset',
      previousValue: null,
      selectedItem: customers[0],
    }));
  });

  it('supports uncontrolled string keys', () => {
    render(
      <CgKeyComboBox
        options={customers}
        defaultValue="C-200"
        getOptionLabel={getLabel}
        getOptionKey={(item) => item.code}
      />,
    );

    expect(screen.getByRole('combobox')).toHaveValue(getLabel(customers[2]!));
  });

  it('restores a parent-rejected controlled key proposal', async () => {
    const changes = vi.fn();
    render(
      <CgKeyComboBox
        options={customers}
        value={1}
        onValueChange={changes}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
      />,
    );

    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'Contoso' } });
    fireEvent.click(screen.getByRole('option', { hidden: true }));

    expect(changes).toHaveBeenCalledWith(2, expect.objectContaining({ reason: 'select' }));
    await waitFor(() => expect(input).toHaveValue(getLabel(customers[1]!)));
  });

  it('tracks external keys and refreshed local option objects without emitting', async () => {
    const changes = vi.fn();
    const { rerender } = render(
      <CgKeyComboBox options={customers} value={1} onValueChange={changes} getOptionLabel={getLabel} getOptionKey={getKey} />,
    );
    const input = screen.getByRole('combobox');

    rerender(<CgKeyComboBox options={customers} value={2} onValueChange={changes} getOptionLabel={getLabel} getOptionKey={getKey} />);
    await waitFor(() => expect(input).toHaveValue(getLabel(customers[2]!)));

    const refreshed = customers.map((item) => ({ ...item, name: `${item.name} refreshed` }));
    rerender(<CgKeyComboBox options={refreshed} value={2} onValueChange={changes} getOptionLabel={getLabel} getOptionKey={getKey} />);
    await waitFor(() => expect(input).toHaveValue(getLabel(refreshed[2]!)));
    expect(changes).not.toHaveBeenCalled();
  });

  it('uses custom value equality and selectedItem fallback resolution', () => {
    const offPage = { id: 99, code: 'OFF-99', name: 'Off-page customer' };
    const { rerender } = render(
      <CgKeyComboBox
        options={customers}
        value="c-200"
        getOptionLabel={getLabel}
        getOptionKey={(item) => item.code}
        isValueEqual={(left, right) => left.toLocaleLowerCase() === right.toLocaleLowerCase()}
      />,
    );
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue(getLabel(customers[2]!));

    rerender(
      <CgKeyComboBox
        loadOptions={() => []}
        value="OFF-99"
        selectedItem={offPage}
        getOptionLabel={getLabel}
        getOptionKey={(item) => item.code}
      />,
    );
    expect(input).toHaveValue(getLabel(offPage));
  });

  it('renders unresolved and mismatched fallback keys as empty and invalid when required', () => {
    render(
      <CgKeyComboBox
        options={customers}
        value={99}
        selectedItem={customers[1]}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
        name="customerId"
        required
      />,
    );

    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(input).toHaveValue('');
    expect(input.checkValidity()).toBe(false);
    expect(document.querySelector('input[type="hidden"]')).toHaveValue('');
  });

  it('retains a selected remote item after a controlled key accepts it', async () => {
    function RemoteControlled() {
      const [value, setValue] = useState<number | null>(null);
      return (
        <CgKeyComboBox
          loadOptions={(query) => customers.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()))}
          value={value}
          onValueChange={setValue}
          getOptionLabel={getLabel}
          getOptionKey={getKey}
          searchDelay={0}
        />
      );
    }

    render(<RemoteControlled />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'contoso' } });
    fireEvent.click(await screen.findByRole('option', { hidden: true }));
    await waitFor(() => expect(input).toHaveValue(getLabel(customers[2]!)));
  });

  it('inherits external forms, disabled exclusion, and the visible input ref', () => {
    const ref = createRef<HTMLInputElement>();
    const { rerender } = render(
      <>
        <form id="external" />
        <CgKeyComboBox ref={ref} form="external" name="customerId" options={customers} value={1} getOptionLabel={getLabel} getOptionKey={getKey} />
      </>,
    );

    expect(ref.current).toBe(screen.getByRole('combobox'));
    expect(new FormData(document.getElementById('external') as HTMLFormElement).get('customerId')).toBe('1');

    rerender(
      <>
        <form id="external" />
        <CgKeyComboBox ref={ref} form="external" name="customerId" options={customers} value={1} getOptionLabel={getLabel} getOptionKey={getKey} disabled />
      </>,
    );
    expect(new FormData(document.getElementById('external') as HTMLFormElement).has('customerId')).toBe(false);
  });

  it('retains ComboBox source and key validation', () => {
    const conflicting = {
      options: customers,
      loadOptions: () => customers,
      getOptionLabel: getLabel,
      getOptionKey: getKey,
    } as unknown as CgKeyComboBoxProps<Customer, number>;
    expect(() => render(<CgKeyComboBox {...conflicting} />)).toThrow(/either options or loadOptions/u);
    expect(() => render(
      <CgKeyComboBox
        options={[customers[1]!, { ...customers[2]!, id: 1 }]}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
      />,
    )).toThrow(/duplicate option key 1/u);
    expect(() => render(
      <CgKeyComboBox
        options={[{ id: Number.POSITIVE_INFINITY, code: 'INF', name: 'Invalid' }]}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
      />,
    )).toThrow(/finite strings or numbers/u);
  });
});
