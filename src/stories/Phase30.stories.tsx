import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton, CgPivotTable, CgTreeList } from '../index';
import type { CgPivotActions, CgPivotField, CgTreeListActions, CgTreeListColumn } from '../index';

interface Record { id: number; parent: number | null; region: string; name: string; amount: number }
const records: readonly Record[] = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, parent: null, region: i % 2 ? 'North' : 'South', name: `Account ${i + 1}`, amount: i + 1 }));
const fields: readonly CgPivotField<Record>[] = [{ key: 'region', area: 'row', valueType: 'text', getValue: row => row.region }, { key: 'name', area: 'row', valueType: 'text', getValue: row => row.name }, { key: 'amount', area: 'data', valueType: 'number', getValue: row => row.amount }];
const columns: readonly CgTreeListColumn<Record, number>[] = [{ fieldId: 'name', title: 'Account', type: 'text', hierarchy: true, getValue: row => row.name, width: 220 }, { fieldId: 'amount', title: 'Amount', type: 'number', getValue: row => row.amount, width: 160 }];
const getKey = (row: Record) => row.id;
const getParentKey = (row: Record) => row.parent === null ? { kind: 'none' as const } : { kind: 'key' as const, key: row.parent };
function Demo({ direction }: { direction?: 'ltr' | 'rtl' }) {
  const pivot = useRef<CgPivotActions>(null); const tree = useRef<CgTreeListActions<Record, number>>(null);
  const [message, setMessage] = useState('Choose an export scope');
  return <main style={{ maxWidth: 1040, display: 'grid', gap: 16 }}>
    <h1 style={{ fontSize: 24, margin: 0 }}>Account analysis</h1>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <CgButton onClick={() => pivot.current?.collapseAll()}>Collapse analysis</CgButton>
      <CgButton onClick={async () => { const result = await pivot.current?.exportCsv({ scope: 'currentLayout' }); setMessage(`Current layout: ${result?.rowCount} rows`); }}>Export current layout</CgButton>
      <CgButton onClick={async () => { const result = await pivot.current?.exportCsv(); setMessage(`All expanded: ${result?.rowCount} rows`); }}>Export all expanded</CgButton>
      <CgButton onClick={() => { void tree.current?.focusNode(190, 'name'); }}>Focus account 190</CgButton>
    </div>
    <output aria-label="Export result">{message}</output>
    <CgPivotTable direction={direction} data={records} fields={fields} actionsRef={pivot} height={260} maximumSourceRows={1000} maximumAggregateOperations={10000} />
    <CgTreeList<Record, number> data={records} columns={columns} getKey={getKey} getParentKey={getParentKey} actionsRef={tree} rowVirtualization height={240} aria-label="Accounts" />
  </main>;
}
export default { title: 'Phase 30/Analysis', component: Demo } satisfies Meta<typeof Demo>;
export const Review: StoryObj<typeof Demo> = {};

export const RtlReview: StoryObj<typeof Demo> = { args: { direction: 'rtl' }, globals: { direction: 'rtl' } };
