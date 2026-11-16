import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgField } from '../Field';
import { CgSelect } from './CgSelect';
import type { CgSelectOption } from './CgSelect.types';

const types: CgSelectOption[] = [
  { value: 'text', label: 'نص', group: 'أساسي' },
  { value: 'number', label: 'رقم', group: 'أساسي' },
  { value: 'date', label: 'تاريخ', group: 'أساسي' },
  { value: 'relation', label: 'علاقة', group: 'متقدم' },
  { value: 'formula', label: 'معادلة', group: 'متقدم', disabled: true },
];

describe('CgSelect', () => {
  it('is a native select labelled by its field, its options grouped', () => {
    render(<CgField label="نوع الخاصية" description="يحدد ما تحمله الخلايا"><CgSelect options={types} placeholder="اختر نوعاً" /></CgField>);
    const select = screen.getByRole('combobox', { name: 'نوع الخاصية' });
    expect(select.tagName).toBe('SELECT');
    expect(select).toHaveAccessibleDescription('يحدد ما تحمله الخلايا');
    expect(select).toHaveValue('');
    expect(within(select).getAllByRole('group').map((group) => group.getAttribute('label'))).toEqual(['أساسي', 'متقدم']);
    expect(within(select).getByRole('option', { name: 'معادلة' })).toBeDisabled();
  });

  it('reports a choice, null for the placeholder, and stays controlled', async () => {
    const onValueChange = vi.fn();
    function Host() {
      const [value, setValue] = useState<string | null>('number');
      return <CgSelect aria-label="النوع" options={types} placeholder="اختر" value={value} onValueChange={(next, details) => { onValueChange(next, details.option); setValue(next); }} />;
    }
    render(<Host />);
    const select = screen.getByRole('combobox', { name: 'النوع' });
    expect(select).toHaveValue('number');
    await userEvent.selectOptions(select, 'relation');
    expect(onValueChange).toHaveBeenLastCalledWith('relation', types[3]);
    expect(select).toHaveValue('relation');
    await userEvent.selectOptions(select, '');
    expect(onValueChange).toHaveBeenLastCalledWith(null, null);
  });

  it('chooses the first enabled option without a placeholder, and ignores changes while read-only', () => {
    const onValueChange = vi.fn();
    const { rerender } = render(<CgSelect aria-label="النوع" options={types} />);
    expect(screen.getByRole('combobox')).toHaveValue('text');
    rerender(<CgSelect aria-label="النوع" options={types} value="date" readOnly onValueChange={onValueChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'number' } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-readonly', 'true');
  });

  it('marks required, invalid and disabled states from its field', () => {
    render(<CgField label="النوع" required validationState="error" validationMessage="اختر نوعاً"><CgSelect options={types} placeholder="اختر" /></CgField>);
    const select = screen.getByRole('combobox', { name: /النوع/u });
    expect(select).toBeRequired();
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(within(select).getByRole('option', { name: 'اختر' })).toBeDisabled();
  });

  it('refuses repeated values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<CgSelect aria-label="x" options={[{ value: 'a', label: 'أ' }, { value: 'a', label: 'ب' }]} />)).toThrow(/unique/u);
  });
});
