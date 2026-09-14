import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton, CgGrid, CgLookUpGrid } from '../index';
import type { CgGridActions, CgGridColumnDescriptor } from '../index';
const data = [{ id: 1, name: 'Alpha', amount: '9007199254740993.12' }, { id: 2, name: 'Beta', amount: '2.00' }, { id: 3, name: 'Gamma', amount: '3.00' }];
type Row = typeof data[number];
const columns: readonly CgGridColumnDescriptor<Row>[] = [{ fieldId: 'name', type: 'text', title: 'Name', accessor: row => row.name, width: 180 }, { fieldId: 'amount', type: 'text', title: 'Amount', accessor: row => row.amount, exportWidth: 210, width: 240 }];
const key = (row: Row) => row.id;
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const actions = useRef<CgGridActions<Row>>(null); const [text, setText] = useState(''); const [value, setValue] = useState<number | null>(1); const [reject, setReject] = useState(false); const [status, setStatus] = useState('Ready');
  return <main style={{ maxWidth: 1000, display: 'grid', gap: 16 }}><h1>Grid exports and asynchronous selection</h1>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><CgButton onClick={async () => setText((await actions.current!.exportToJson()).text)}>Preview JSON</CgButton><CgButton onClick={async () => { await actions.current!.exportToJson({ download: true, fileName: 'records.json' }); }}>Download JSON</CgButton><CgButton onClick={async () => { const chunks: Uint8Array[] = []; await actions.current!.writeJson(new WritableStream({ write(chunk) { chunks.push(chunk); } })); setText(chunks.map(chunk => new TextDecoder().decode(chunk)).join('')); }}>Stream JSON</CgButton><CgButton onClick={async () => { await actions.current!.exportToXlsx({ download: true, fileName: 'records.xlsx' }); }}>Download workbook</CgButton></div>
    <CgGrid data={data} columns={columns} keySelector={key} actionsRef={actions} selectionMode="checkbox" contextMenuAreas={['row', 'header']} direction={direction} showFilterRow={false} />
    <label>JSON text<textarea aria-label="JSON text" readOnly value={text} placeholder="Preview or stream the committed records" style={{ display: 'block', width: '100%', height: 120, boxSizing: 'border-box', color: 'var(--cg-text)', background: 'var(--cg-surface)', border: '1px solid var(--cg-border)' }} /></label>
    <h2>Delayed parent selection</h2><label><input type="checkbox" checked={reject} onChange={event => setReject(event.currentTarget.checked)} /> Keep the previous selection</label>
    <CgLookUpGrid aria-label="Choose record" data={data} columns={columns.map(column => ({ fieldId: column.fieldId, title: column.title ?? column.fieldId, accessor: column.accessor }))} valueSelector={key} textSelector={row => row.name} value={value} direction={direction} onValueChange={async next => { setStatus('Pending'); await new Promise<void>(resolve => setTimeout(resolve, 250)); if (!reject) setValue(next); setStatus(reject ? 'Rejected' : 'Accepted'); }} /><output aria-label="Selection status">{status}</output>
  </main>;
}
export default { title: 'Phase 33/Exports', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};
export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
