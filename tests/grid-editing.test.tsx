import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid, CgSpinEdit } from '../src';
import type { CgGridActions, CgGridBatchMutationRequest, CgGridColumnDescriptor, CgGridEditState, CgGridUpdateRequest } from '../src';

interface Row { readonly id: number; readonly name: string; readonly amount: number }
const source: ReadonlyArray<Row> = [
  { id: 1, name: 'Alpha', amount: 10 },
  { id: 2, name: 'Beta', amount: 20 },
  { id: 3, name: 'Gamma', amount: 30 },
];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
  { type: 'text', fieldId: 'name', title: 'Name', accessor: (row) => row.name, editor: { kind: 'text', required: true, memo: 'Public display name', setValue: (row, value) => ({ ...row, name: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount, editor: { kind: 'number', minimum: 0, setValue: (row, value) => ({ ...row, amount: Number(value) }) } },
];

describe('CgGrid advanced editing', () => {
  it('opens the requested cell from rapid printable typing and drops refused seeds', async () => {
    const editableColumns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
      { type: 'number', fieldId: 'id', title: 'Id', accessor: (row) => row.id },
      { type: 'date', fieldId: 'issued', title: 'Issued', accessor: () => '2026-01-01', editor: { kind: 'date', setValue: (row) => row } },
      ...columns,
    ];
    const { container } = render(<CgGrid data={source} columns={editableColumns} keySelector={(row) => row.id} selectionMode="multiple" showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: async () => ({ succeeded: true }) }} />);
    const id = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="id"]')!;
    id.focus(); fireEvent.keyDown(id, { key: 'Q' });
    await act(async () => Promise.resolve());
    expect(id.querySelector('input')).toBeNull();

    const name = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
    name.focus();
    for (const key of ['1', '2', '3']) fireEvent.keyDown(name, { key });
    await waitFor(() => expect(name.querySelector('input')).toHaveValue('123'));
    fireEvent.keyDown(name.querySelector('input')!, { key: 'Escape' });

    const issued = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="issued"]')!;
    issued.focus(); fireEvent.keyDown(issued, { key: 'X' });
    await waitFor(() => expect(issued.querySelector('input')).not.toBeNull());
    expect(issued.querySelector('input')).not.toHaveValue('X');
    fireEvent.keyDown(issued.querySelector('input')!, { key: 'Escape' });

    const amount = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="amount"]')!;
    amount.focus(); fireEvent.keyDown(amount, { key: ' ' });
    expect(amount.closest('tr')).toHaveAttribute('aria-selected', 'true');
    expect(amount.querySelector('input')).toBeNull();
  });

  it('selects numeric editor content and commits the latest value before advancing down the column', async () => {
    const update = vi.fn(async () => ({ succeeded: true as const }));
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, enterMovesToNextRow: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    const first = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="amount"]')!;
    first.focus(); fireEvent.keyDown(first, { key: 'F2' });
    await waitFor(() => expect(first.querySelector('input')).not.toBeNull());
    const editor = first.querySelector<HTMLInputElement>('input')!;
    await waitFor(() => expect([editor.selectionStart, editor.selectionEnd]).toEqual([0, editor.value.length]));
    await userEvent.keyboard('7');
    fireEvent.keyDown(editor, { key: 'Enter' });
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ editModel: expect.objectContaining({ amount: 7 }) }), expect.anything()));
    const second = container.querySelector<HTMLElement>('[data-row-key="number:2"] [data-column-id="amount"]')!;
    await waitFor(() => expect(document.activeElement).toBe(second));
    expect(second.querySelector('input')).toBeNull();
  });

  it('commits SpinEdit expressions through the Grid and keeps invalid formulas open', async () => {
    const expressionColumns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [{
      type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount,
      editor: {
        kind: 'number', setValue: (row, value) => ({ ...row, amount: Number(value) }),
        render: ({ value, setValue }) => <CgSpinEdit aria-label="Amount formula" value={typeof value === 'number' ? value : null} onValueChange={setValue} allowExpressions updateValueOnInput showSpinButtons={false} />,
      },
    }];
    const update = vi.fn(async () => ({ succeeded: true as const }));
    const { container } = render(<CgGrid data={source} columns={expressionColumns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    const cell = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="amount"]')!;
    cell.focus();
    for (const key of ['2', '*', '3']) fireEvent.keyDown(cell, { key });
    const editor = await screen.findByRole('spinbutton', { name: 'Amount formula' });
    await waitFor(() => expect(editor).toHaveValue('2*3'));
    fireEvent.keyDown(editor, { key: 'Enter' });
    await waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ editModel: expect.objectContaining({ amount: 6 }) }), expect.anything()));

    update.mockClear();
    cell.focus(); fireEvent.keyDown(cell, { key: 'F2' });
    const reopened = await screen.findByRole('spinbutton', { name: 'Amount formula' });
    fireEvent.change(reopened, { target: { value: '2+' } });
    fireEvent.keyDown(reopened, { key: 'Enter' });
    await waitFor(() => expect(reopened).toHaveAttribute('aria-invalid', 'true'));
    expect(update).not.toHaveBeenCalled();
  });

  it('clamps Enter advancement at the last row and stays on validation failure', async () => {
    const update = vi.fn()
      .mockResolvedValueOnce({ succeeded: false as const, outcome: 'rejected' as const, generalErrors: ['Nope'] })
      .mockResolvedValueOnce({ succeeded: true as const });
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, enterMovesToNextRow: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    const first = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
    first.focus(); fireEvent.keyDown(first, { key: 'Z' });
    await waitFor(() => expect(first.querySelector('input')).not.toBeNull());
    const editor = first.querySelector<HTMLInputElement>('input')!;
    fireEvent.keyDown(editor, { key: 'Enter' });
    await waitFor(() => expect(update).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(editor));

    fireEvent.keyDown(editor, { key: 'Escape' });
    const last = container.querySelector<HTMLElement>('[data-row-key="number:3"] [data-column-id="name"]')!;
    last.focus(); fireEvent.keyDown(last, { key: 'F2' });
    await waitFor(() => expect(last.querySelector('input')).not.toBeNull());
    const lastEditor = last.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(lastEditor, 'X');
    fireEvent.keyDown(lastEditor, { key: 'Enter' });
    await waitFor(() => expect(last.querySelector('input')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(last));
    expect(container.querySelectorAll('[data-cg-grid-row]')).toHaveLength(3);
  });

  it('queues type-to-edit behind an asynchronous Enter commit', async () => {
    let resolveUpdate: ((result: { readonly succeeded: true }) => void) | undefined;
    const update = vi.fn(() => new Promise<{ readonly succeeded: true }>((resolve) => { resolveUpdate = resolve; }));
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, enterMovesToNextRow: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    const first = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
    first.focus(); fireEvent.keyDown(first, { key: 'A' });
    await waitFor(() => expect(first.querySelector('input')).toHaveValue('A'));
    fireEvent.keyDown(first.querySelector('input')!, { key: 'Enter' });
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));

    const second = container.querySelector<HTMLElement>('[data-row-key="number:2"] [data-column-id="name"]')!;
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(second, { key: 'B' });
    expect(second.querySelector('input')).toBeNull();
    await act(async () => { resolveUpdate?.({ succeeded: true }); await Promise.resolve(); });
    await waitFor(() => expect(second.querySelector('input')).toHaveValue('B'));
  });

  it('retains spreadsheet edits across rows until an atomic batch commit', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const commitBatch = vi.fn(async (_request: CgGridBatchMutationRequest<Row>) => ({ succeeded: true as const }));
    const { container } = render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} actionsRef={actions} showSearch={false} showFilterRow={false} editing={{ mode: 'batch', navigationPolicy: 'preserve', update: true, enterMovesToNextRow: true, editModelFactory: (row) => ({ ...row }), commitBatch }} />);
    const first = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
    first.focus(); fireEvent.keyDown(first, { key: 'C' });
    await waitFor(() => expect(first.querySelector('input')).toHaveValue('C'));
    fireEvent.keyDown(first.querySelector('input')!, { key: 'Enter' });

    const second = container.querySelector<HTMLElement>('[data-row-key="number:2"] [data-column-id="name"]')!;
    await waitFor(() => expect(document.activeElement).toBe(second));
    fireEvent.keyDown(second, { key: 'D' });
    await waitFor(() => expect(second.querySelector('input')).toHaveValue('D'));
    fireEvent.keyDown(second.querySelector('input')!, { key: 'Enter' });
    await act(async () => { expect(await actions.current?.commitEdits()).toBe(true); });

    const request = commitBatch.mock.calls[0]?.[0];
    expect(request?.operations).toEqual(expect.arrayContaining([
      expect.objectContaining({ rowKey: 'number:1', editModel: expect.objectContaining({ name: 'C' }) }),
      expect.objectContaining({ rowKey: 'number:2', editModel: expect.objectContaining({ name: 'D' }) }),
    ]));
  });

  it('keeps Shift+Enter inside multiline custom editors', async () => {
    const update = vi.fn(async () => ({ succeeded: true as const }));
    const memoColumns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [{
      type: 'text', fieldId: 'name', title: 'Name', accessor: (row) => row.name,
      editor: {
        kind: 'text', setValue: (row, value) => ({ ...row, name: String(value) }),
        render: ({ value, setValue }) => <textarea aria-label="Name memo" value={String(value)} onChange={(event) => setValue(event.target.value)} />,
      },
    }];
    const { container } = render(<CgGrid data={source} columns={memoColumns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    const cell = container.querySelector<HTMLElement>('[data-row-key="number:1"] [data-column-id="name"]')!;
    cell.focus(); fireEvent.keyDown(cell, { key: 'F2' });
    const editor = await screen.findByRole('textbox', { name: 'Name memo' });
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: true });
    expect(update).not.toHaveBeenCalled();
    expect(editor).toBeInTheDocument();
  });

  it('edits a cell immutably and sends structured update metadata', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const update = vi.fn(async () => ({ succeeded: true as const, outcome: 'succeeded' as const, concurrencyToken: 'v2' }));
    render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} actionsRef={actions} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), concurrencyToken: () => 'v1', updateItem: update }} />);

    await act(async () => { expect(await actions.current?.beginEdit(1)).toBe(true); });
    const input = screen.getByRole('textbox', { name: /Name/u });
    await userEvent.clear(input); await userEvent.type(input, 'Changed');
    await waitFor(() => expect(actions.current?.getEditState()).toMatchObject({ dirtyRowCount: 1, changeCount: 1, activeCell: { rowKey: 'number:1', columnId: 'name' } }));
    await act(async () => { expect(await actions.current?.commitEdits()).toBe(true); });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ rowKey: 'number:1', changedFieldIds: ['name'], concurrencyToken: 'v1', attemptNumber: 1, editModel: expect.objectContaining({ name: 'Changed' }) }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(source[0]?.name).toBe('Alpha');
  });

  it('blocks dirty navigation and exposes an external router guard', async () => {
    const actions = createRef<CgGridActions<Row>>();
    render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} defaultState={{ pageSize: 1 }} actionsRef={actions} editing={{ mode: 'inlineRow', navigationPolicy: 'block', update: true, editModelFactory: (row) => ({ ...row }), updateItem: async () => ({ succeeded: true }) }} />);
    await act(async () => { await actions.current?.beginEdit(1); });
    const input = screen.getByRole('textbox', { name: /Name/u }); await userEvent.type(input, '!');
    await act(async () => { await actions.current?.goToPage(1); });
    expect(actions.current?.getState().pageIndex).toBe(0);
    await expect(actions.current?.requestNavigation('external')).resolves.toBe(false);
    expect(actions.current?.hasPendingEdits()).toBe(true);
  });

  it('uses one stable atomic batch for mixed operations and never invokes row handlers', async () => {
    const actions = createRef<CgGridActions<Row>>(); const editStates: Array<CgGridEditState<Row>> = [];
    const updateItem = vi.fn(async () => ({ succeeded: true })); const createItem = vi.fn(async () => ({ succeeded: true })); const deleteItem = vi.fn(async () => ({ succeeded: true }));
    const commitBatch = vi.fn(async (_request: CgGridBatchMutationRequest<Row>) => ({ succeeded: true as const, outcome: 'succeeded' as const }));
    render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} actionsRef={actions} editing={{ mode: 'batch', navigationPolicy: 'preserve', create: true, update: true, delete: true, newItemFactory: () => ({ id: 99, name: '', amount: 0 }), editModelFactory: (row) => ({ ...row }), createItem, updateItem, deleteItem, commitBatch, onEditStateChange: (state) => editStates.push(state) }} />);

    await act(async () => { await actions.current?.beginEdit(1); });
    const alpha = screen.getByDisplayValue('Alpha'); await userEvent.clear(alpha); await userEvent.type(alpha, 'A1');
    await act(async () => { await actions.current?.beginCreate(); });
    const created = screen.getByDisplayValue(''); await userEvent.type(created, 'New');
    await act(async () => { await actions.current?.beginEdit(2); });
    const beta = screen.getByDisplayValue('Beta'); await userEvent.clear(beta); await userEvent.type(beta, 'B2');
    await act(async () => { expect(await actions.current?.requestDelete(3)).toBe(true); });
    await waitFor(() => expect(actions.current?.getEditState().dirtyRowCount).toBe(4));
    const before = actions.current?.getEditState().batchId;
    await act(async () => { expect(await actions.current?.commitEdits()).toBe(true); });

    expect(commitBatch).toHaveBeenCalledTimes(1);
    const request = commitBatch.mock.calls[0]?.[0]; if (!request) throw new Error('Expected an atomic batch request.');
    expect(request.batchId).toBe(before);
    expect(request.operations.map((operation: { operation: string }) => operation.operation)).toEqual(['update', 'create', 'update', 'delete']);
    expect(request.operations.map((operation: { firstChangeSequence: number }) => operation.firstChangeSequence)).toEqual([...request.operations.map((operation: { firstChangeSequence: number }) => operation.firstChangeSequence)].sort((left: number, right: number) => left - right));
    expect(updateItem).not.toHaveBeenCalled(); expect(createItem).not.toHaveBeenCalled(); expect(deleteItem).not.toHaveBeenCalled();
    expect(editStates.some((state) => state.dirtyRowCount === 4)).toBe(true);
  });

  it('retains conflict drafts and retries with the next attempt number', async () => {
    const actions = createRef<CgGridActions<Row>>();
    const update = vi.fn()
      .mockResolvedValueOnce({ succeeded: false, outcome: 'conflict', conflict: { code: 'stale', message: 'The row changed.', concurrencyToken: 'v2' } })
      .mockResolvedValueOnce({ succeeded: true, outcome: 'succeeded' });
    render(<CgGrid data={source} columns={columns} keySelector={(row) => row.id} showSearch={false} showFilterRow={false} actionsRef={actions} editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: update }} />);
    await act(async () => { await actions.current?.beginEdit(1); });
    await userEvent.type(screen.getByRole('textbox', { name: /Name/u }), '!');
    await act(async () => { expect(await actions.current?.commitEdits()).toBe(false); });
    expect(actions.current?.getEditState()).toMatchObject({ persistenceState: 'conflict', dirtyRowCount: 1 });
    expect(actions.current?.getEditState().snapshots[0]?.conflict?.code).toBe('stale');
    expect(screen.getByRole('textbox', { name: /Name/u })).toHaveValue('Alpha!');
    await act(async () => { expect(await actions.current?.retryConflict(1)).toBe(true); });
    expect(update.mock.calls.map((call) => (call[0] as CgGridUpdateRequest<Row>).attemptNumber)).toEqual([1, 2]);
  });
});
