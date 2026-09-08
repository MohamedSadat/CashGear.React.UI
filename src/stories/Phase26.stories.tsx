import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton, CgEditorCommitProvider, CgField, CgPopup, CgTextBox, useCgEditorCommit } from '../index';
import type { CgPopupActions } from '../index';

function Transaction() {
  const commit = useCgEditorCommit();
  const popup = useRef<CgPopupActions>(null);
  const [value, setValue] = useState('Invoice 1042');
  const valueRef = useRef(value);
  const [saved, setSaved] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fail, setFail] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const resolve = useRef<((value: boolean) => void) | undefined>(undefined);
  const save = async () => {
    if (busy) return;
    setError('');
    if (!await commit.commit(() => Boolean(valueRef.current.trim()))) { setError('Enter a reference.'); return; }
    setBusy(true);
    await new Promise((done) => setTimeout(done, 150));
    setBusy(false);
    if (fail) { setError('Unable to save. Your changes are still available.'); return; }
    setSaved(valueRef.current);
  };
  return <section style={{ padding: 24 }}>
    <CgButton onClick={() => { void popup.current?.open(); }}>Edit transaction</CgButton>
    <p>Saved reference: <output aria-label="Saved reference">{saved}</output></p>
    <CgPopup actionsRef={popup} headerText="Edit transaction" width={480} closePolicy={{
      isBusy: () => busy,
      hasUnsavedChangesAsync: async () => !await commit.flush() || valueRef.current !== saved,
      confirmDiscard: () => new Promise<boolean>((done) => { resolve.current = done; setConfirm(true); }),
    }} footer={<><CgButton onClick={() => { void popup.current?.close(); }}>Cancel</CgButton><CgButton disabled={busy} onClick={() => { void save(); }}>Save</CgButton></>}>
      <CgField label="Reference" required><CgTextBox value={value} commitMode="debounced" debounceMs={3000} disabled={busy} onValueChange={(next) => { valueRef.current = next; setValue(next); }} /></CgField>
      <label><input type="checkbox" checked={fail} onChange={(event) => setFail(event.currentTarget.checked)} /> Simulate save failure</label>
      {error ? <p role="alert">{error}</p> : null}
      {confirm ? <CgPopup defaultOpen headerText="Discard changes?" closeOnEscape={false} showCloseButton={false} footer={<>
        <CgButton onClick={() => { resolve.current?.(false); setConfirm(false); }}>Keep editing</CgButton>
        <CgButton onClick={() => { commit.resetDrafts(); valueRef.current = saved; setValue(saved); resolve.current?.(true); setConfirm(false); }}>Discard</CgButton>
      </>}>The reference has unsaved changes.</CgPopup> : null}
    </CgPopup>
  </section>;
}
const meta = { title: 'Phase 26/Editor Commit', component: Transaction } satisfies Meta<typeof Transaction>;
export default meta;
type Story = StoryObj<typeof meta>;
export const TransactionEditing: Story = { render: () => <CgEditorCommitProvider><Transaction /></CgEditorCommitProvider> };
