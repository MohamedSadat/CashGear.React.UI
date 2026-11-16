import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgInlineNumberEditor } from './CgInlineNumberEditor';
import { CgInlineTextEditor } from './CgInlineTextEditor';

const source = 'None: React only (Cash Gear Workspace Track U12, the database cells\' editors)';
const difference = 'Uncontrolled: nothing is drawn while typing. Enter, Tab and leaving commit; Escape reverts.';
const meta = { title: 'Phase 37/InlineEditor', component: CgInlineTextEditor, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgInlineTextEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

interface Row { id: string; name: string; quantity: number | null }
const cell = { padding: '0.25rem 0.5rem', borderBlockEnd: '1px solid var(--cg-border)', minInlineSize: '10rem', blockSize: '2.25rem', boxSizing: 'border-box' as const };

function Table() {
  const [rows, setRows] = useState<Row[]>([{ id: 'a', name: 'أقلام', quantity: 120 }, { id: 'b', name: 'دفاتر', quantity: 45.5 }, { id: 'c', name: 'حبر', quantity: null }]);
  const [editing, setEditing] = useState<{ id: string; column: 'name' | 'quantity' } | null>(null);
  const [log, setLog] = useState('');
  const save = (id: string, patch: Partial<Row>) => setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  return <div style={{ display: 'grid', gap: 12 }} data-testid="inline-table">
    <table style={{ borderCollapse: 'collapse' }}>
      <thead><tr><th style={cell} scope="col">الصنف</th><th style={cell} scope="col">الكمية</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.id}>
        <td style={cell}>{editing?.id === row.id && editing.column === 'name'
          ? <CgInlineTextEditor label="الصنف" defaultValue={row.name} onCommit={(name, details) => { save(row.id, { name }); setLog(`حُفظ الاسم (${details.end})`); }} onDone={() => setEditing(null)} />
          : <button type="button" style={{ all: 'unset', cursor: 'text', display: 'block', inlineSize: '100%' }} onClick={() => setEditing({ id: row.id, column: 'name' })}>{row.name}</button>}</td>
        <td style={{ ...cell, textAlign: 'end' }}>{editing?.id === row.id && editing.column === 'quantity'
          ? <CgInlineNumberEditor label="الكمية" defaultValue={row.quantity} locale="ar-EG" invalidMessage="أدخل رقماً" onCommit={(quantity, details) => { save(row.id, { quantity }); setLog(`حُفظت الكمية (${details.end})`); }} onDone={() => setEditing(null)} />
          : <button type="button" style={{ all: 'unset', cursor: 'text', display: 'block', inlineSize: '100%' }} onClick={() => setEditing({ id: row.id, column: 'quantity' })} aria-label={`كمية ${row.name}`}>{row.quantity ?? '—'}</button>}</td>
      </tr>)}</tbody>
    </table>
    <output data-testid="inline-log">{log}</output>
  </div>;
}

function Fields() {
  const [title, setTitle] = useState('خطة الربع الرابع');
  return <div style={{ display: 'grid', gap: 12, inlineSize: 'min(28rem, 100%)' }} data-testid="inline-fields">
    <CgInlineTextEditor label="عنوان الصفحة" defaultValue={title} autoFocus={false} onCommit={(text) => setTitle(text.replace(/\s+/gu, ' ').trim())} />
    <CgInlineTextEditor label="الوصف" multiline rows={2} defaultValue={'سطر أول\nسطر ثانٍ'} autoFocus={false} onCommit={() => undefined} />
    <CgInlineNumberEditor label="المبلغ" defaultValue={1500} autoFocus={false} invalidMessage="أدخل رقماً" onCommit={() => undefined} />
    <CgInlineNumberEditor label="مبلغ غير صالح" defaultValue={null} autoFocus={false} invalidMessage="أدخل رقماً" onCommit={() => undefined} disabled />
    <output>{title}</output>
  </div>;
}

export const CellEditors: Story = { args: { label: 'x', defaultValue: '', onCommit: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><Table /></StoryFrame>, globals: { direction: 'rtl' } };
export const StandingFields: Story = { args: { label: 'x', defaultValue: '', onCommit: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><Fields /></StoryFrame>, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { label: 'x', defaultValue: '', onCommit: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><Fields /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
