import { createRef, StrictMode, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CgEditorCommitProvider, CgGrid, CgNumericEdit, CgPopup, CgTextBox, useCgEditorCommit } from '../src';
import type { CgEditorActions, CgEditorCommitApi, CgGridActions, CgPopupActions } from '../src';

describe('editor commit boundaries', () => {
  it('keeps a newer controlled draft when an older async callback publishes its echo', async () => {
    const actions = createRef<CgEditorActions>(); let release!: () => void;
    const events: string[] = [];
    function Editor() {
      const [value, setValue] = useState('');
      return <CgTextBox aria-label="Ordered controlled" value={value} actionsRef={actions} onValueChange={async (next) => {
        if (next === 'first') await new Promise<void>((done) => { release = done; });
        events.push(next); setValue(next);
      }} />;
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Ordered controlled'), { target: { value: 'first' } });
    fireEvent.change(screen.getByLabelText('Ordered controlled'), { target: { value: 'second' } });
    await act(async () => { release(); await actions.current!.flush(); });
    expect(events).toEqual(['first', 'second']);
    expect(screen.getByLabelText('Ordered controlled')).toHaveValue('second');
  });
  it('persists a custom Grid editor draft before blur', async () => {
    type Row = { id: number; name: string };
    const actions = createRef<CgGridActions<Row>>();
    const update = vi.fn(async () => ({ succeeded: true as const }));
    render(<CgGrid data={[{ id: 1, name: 'Original' }]} columns={[{ type: 'text', fieldId: 'name', accessor: (row) => row.name, editor: { kind: 'text', setValue: (row, value) => ({ ...row, name: String(value) }) } }]} keySelector={(row) => row.id} actionsRef={actions} editing={{
      update: true, editModelFactory: (row) => ({ ...row }), updateItem: update,
      renderEdit: ({ model, setModel }) => <CgTextBox aria-label="Custom name" value={model.name} commitMode="blur" onValueChange={(name) => setModel({ ...model, name })} />,
    }} />);
    await act(async () => { await actions.current!.beginEdit(1); });
    fireEvent.change(screen.getByLabelText('Custom name'), { target: { value: 'Pending draft' } });
    await act(async () => { expect(await actions.current!.commitEdits()).toBe(true); });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ editModel: { id: 1, name: 'Pending draft' } }), expect.anything());
  });
  it('flushes pending text before validation, isolates nested scopes, and blocks IME', async () => {
    let outer!: CgEditorCommitApi; let inner!: CgEditorCommitApi;
    function Capture({ nested = false }) { const scope = useCgEditorCommit(); if (nested) inner = scope; else outer = scope; return null; }
    const change = vi.fn(); const other = vi.fn();
    render(<StrictMode><CgEditorCommitProvider><Capture /><CgTextBox aria-label="Outer" commitMode="blur" onValueChange={change} /><CgEditorCommitProvider><Capture nested /><CgTextBox aria-label="Inner" commitMode="blur" onValueChange={other} /></CgEditorCommitProvider></CgEditorCommitProvider></StrictMode>);
    fireEvent.change(screen.getByLabelText('Outer'), { target: { value: 'new' } });
    fireEvent.change(screen.getByLabelText('Inner'), { target: { value: 'nested' } });
    await act(async () => { expect(await outer.commit(() => change.mock.calls.length === 1)).toBe(true); });
    expect(other).not.toHaveBeenCalled();
    fireEvent.compositionStart(screen.getByLabelText('Inner'));
    await act(async () => { expect(await inner.commit()).toBe(false); });
    act(() => inner.resetDrafts());
    expect(screen.getByLabelText('Inner')).toHaveValue('');
  });

  it('awaits ordered asynchronous publications and invalidates queued drafts on reset', async () => {
    const actions = createRef<CgEditorActions>();
    let release!: () => void;
    const values: string[] = [];
    const callback = vi.fn((value: string) => { values.push(value); return value === 'first' ? new Promise<void>((resolve) => { release = resolve; }) : undefined; });
    render(<CgTextBox aria-label="Value" actionsRef={actions} onValueChange={callback} />);
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'first' } });
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'second' } });
    expect(values).toEqual(['first']);
    expect(screen.getByLabelText('Value')).toHaveValue('second');
    await act(async () => { release(); expect(await actions.current!.flush()).toBe(true); });
    expect(values).toEqual(['first', 'second']);
  });

  it('retains failed drafts for retry and blocks invalid numeric drafts', async () => {
    const actions = createRef<CgEditorActions>();
    const change = vi.fn().mockRejectedValueOnce(new Error('failure')).mockResolvedValue(undefined);
    render(<CgTextBox aria-label="Retry" actionsRef={actions} commitMode="blur" onValueChange={change} />);
    fireEvent.change(screen.getByLabelText('Retry'), { target: { value: 'draft' } });
    await act(async () => { await expect(actions.current!.flush()).rejects.toThrow('failure'); });
    expect(screen.getByLabelText('Retry')).toHaveValue('draft');
    await act(async () => { expect(await actions.current!.flush()).toBe(true); });
    const numeric = createRef<CgEditorActions>();
    render(<CgNumericEdit aria-label="Amount" actionsRef={numeric} />);
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: 'invalid' } });
    await act(async () => { expect(await numeric.current!.flush()).toBe(false); });
    expect(screen.getByLabelText('Amount')).toHaveValue('invalid');
  });

  it('coalesces protected close requests and requires an explicit discard decision', async () => {
    const actions = createRef<CgPopupActions>(); let resolve!: (accepted: boolean) => void;
    const confirm = vi.fn(() => new Promise<boolean>((done) => { resolve = done; }));
    render(<CgPopup defaultOpen headerText="Edit" actionsRef={actions} closePolicy={{ hasUnsavedChanges: () => true, confirmDiscard: confirm }}>Draft</CgPopup>);
    let first!: Promise<void>; let second!: Promise<void>;
    await act(async () => { first = actions.current!.close(); second = actions.current!.close(); await Promise.resolve(); });
    expect(confirm).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(false); await Promise.all([first, second]); });
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
