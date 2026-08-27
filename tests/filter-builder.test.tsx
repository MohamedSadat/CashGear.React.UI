import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  CgFilterBuilder,
  type CgFilterBuilderActions,
  type CgFilterBuilderFieldDescriptor,
  type CgFilterNode,
} from '../src';

interface Row { readonly name: string; readonly amount: number; }
const fields: ReadonlyArray<CgFilterBuilderFieldDescriptor<Row>> = [
  { fieldId: 'name', label: 'Name', kind: 'text', accessor: (row) => row.name },
  { fieldId: 'amount', label: 'Amount', kind: 'number', accessor: (row) => row.amount },
];
const original: CgFilterNode = { kind: 'condition', fieldId: 'name', operator: 'equals', values: [{ kind: 'text', text: 'old' }], source: 'builder' };

describe('CgFilterBuilder', () => {
  it('keeps incomplete rows visible, clears operands on field changes, and applies canonical criteria', async () => {
    const changed = vi.fn();
    render(<CgFilterBuilder fields={fields} onCriteriaChange={changed} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/complete this filter row/iu);
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Field' }), 'name');
    const value = screen.getByRole('textbox', { name: 'Value' });
    await userEvent.type(value, 'gear');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'condition', fieldId: 'name', operator: 'equals', values: [{ kind: 'text', text: 'gear' }], source: 'builder' }), expect.objectContaining({ reason: 'apply', valid: true }));

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Field' }), 'amount');
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('');
  });

  it('preserves an active controlled draft across parent rerenders and restores the committed value on Cancel', async () => {
    const changed = vi.fn();
    const { rerender } = render(<CgFilterBuilder fields={fields} criteria={original} onCriteriaChange={changed} />);
    const value = screen.getByRole('textbox', { name: 'Value' });
    await userEvent.clear(value);
    await userEvent.type(value, 'draft');
    rerender(<CgFilterBuilder fields={fields} criteria={original} onCriteriaChange={changed} labels={{ builder: 'Updated builder label' }} />);
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('draft');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('textbox', { name: 'Value' })).toHaveValue('old');
    expect(changed).not.toHaveBeenCalled();
  });

  it('rejects a stale cancellable apply after an imperative draft change', async () => {
    let resolveApply: ((value: boolean) => void) | undefined;
    const pending = new Promise<boolean>((resolve) => { resolveApply = resolve; });
    const changed = vi.fn();
    const actions = createRef<CgFilterBuilderActions>();
    render(<CgFilterBuilder fields={fields} defaultCriteria={original} actionsRef={actions} onApply={() => pending} onCriteriaChange={changed} />);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Value' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Value' }), 'next');
    let result: Promise<boolean> | undefined;
    act(() => { result = actions.current?.apply(); });
    act(() => { actions.current?.clear(); resolveApply?.(true); });
    await expect(result).resolves.toBe(false);
    expect(changed).not.toHaveBeenCalled();
    expect(actions.current?.getDraftCriteria()).toBeNull();
  });

  it('rejects stale debounce work and announces keyboard reordering', async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const actions = createRef<CgFilterBuilderActions>();
    render(<CgFilterBuilder fields={fields} defaultCriteria={original} actionsRef={actions} applyMode="debounced" debounceMs={100} onCriteriaChange={changed} />);
    const input = screen.getByRole('textbox', { name: 'Value' });
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]?.[0]).toMatchObject({ values: [{ text: 'ab' }] });
    act(() => { actions.current?.addCondition(); });
    const rows = screen.getAllByRole('combobox', { name: 'Field' });
    fireEvent.keyDown(rows[1]!, { key: 'ArrowUp', altKey: true });
    expect(screen.getByText('Filter moved up.')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
