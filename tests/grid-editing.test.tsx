import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CgGrid } from '../src';
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
