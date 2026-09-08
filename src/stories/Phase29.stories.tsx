import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton, CgGrid } from '../index';
import type { CgGridActions, CgGridColumnDescriptor, CgGridVirtualizationStatus } from '../index';
import { gridRemoteExportExample } from './examples/gridRemoteExport';

interface RecordItem { id: number; name: string; amount: number; region: string }
const records: readonly RecordItem[] = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, name: `Record ${index + 1}`, amount: index + 1, region: index % 2 ? 'North' : 'South' }));
const columns: readonly CgGridColumnDescriptor<RecordItem>[] = [
  { type: 'text', fieldId: 'name', title: 'Name', width: 160, accessor: (row) => row.name, editor: { kind: 'text', required: true, setValue: (row, value) => ({ ...row, name: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', width: 120, accessor: (row) => row.amount },
  { type: 'text', fieldId: 'region', title: 'Region', width: 120, accessor: (row) => row.region },
  ...Array.from({ length: 20 }, (_, index): CgGridColumnDescriptor<RecordItem> => ({ type: 'number', fieldId: `extra${index}`, title: `Metric ${index + 1}`, width: 120, accessor: (row) => row.amount + index })),
];
const key = (row: RecordItem) => row.id;
const summaries = [{ id: 'sum', type: 'sum', fieldId: 'amount' }] as const;

function Demo({ remote = false, arabic = false }: { remote?: boolean; arabic?: boolean }) {
  const actions = useRef<CgGridActions<RecordItem>>(null);
  const [items, setItems] = useState(records);
  const [status, setStatus] = useState<CgGridVirtualizationStatus>();
  const [exported, setExported] = useState('No export yet');
  const [adapter] = useState(() => gridRemoteExportExample(records, columns, key));
  return <main style={{ maxWidth: 1080, minWidth: 0, display: 'grid', gap: 16 }}>
    <h1 style={{ fontSize: 24, margin: 0 }}>{arabic ? 'مراجعة السجلات' : 'Large record review'}</h1>
    <p style={{ margin: 0 }}>{arabic ? 'تصفح ١٬٠٠٠ سجل. يبقى الاسم والمبلغ ظاهرين أثناء التمرير.' : 'Browse 1,000 records. Name and Amount stay frozen while you scroll. Exports use committed records.'}</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <CgButton onClick={() => void actions.current?.focusCell(900, 'extra18')}>Focus record 900</CgButton>
      <CgButton disabled={remote} onClick={() => void actions.current?.groupBy('region')}>Group by region</CgButton>
      <CgButton disabled={remote} onClick={() => void actions.current?.clearGrouping()}>Clear grouping</CgButton>
      <CgButton disabled={remote} onClick={() => void actions.current?.beginEdit(1)}>Edit first record</CgButton>
      <CgButton disabled={remote} onClick={() => void actions.current?.cancelEdits()}>Cancel edit</CgButton>
      <CgButton onClick={() => void actions.current?.exportToXlsx().then((result) => setExported(`Exported ${result.rowCount} records`), (error: Error) => setExported(error.message))}>Export all</CgButton>
      <CgButton onClick={() => void actions.current?.exportToXlsx({ scope: 'selectedRecords', maxRows: 20 }).then((result) => setExported(`Exported ${result.rowCount} selected records`), (error: Error) => setExported(error.message))}>Export selection</CgButton>
    </div>
    <output aria-label="Virtualization status">Rows: {status?.rows ? 'virtual' : status?.rowFallback}; columns: {status?.columns ? 'virtual' : status?.columnFallback}</output>
    <output aria-label="Export result">{exported}</output>
    <CgGrid {...(remote ? { dataProvider: adapter.dataProvider, remoteExport: adapter.remoteExport } : { data: items })}
      columns={columns} keySelector={key} actionsRef={actions} aria-label="Review records" selectionMode="multiple"
      defaultState={{ pageSize: 1000, columns: [{ fieldId: 'name', visible: true, frozen: true }, { fieldId: 'amount', visible: true, frozen: true }] }}
      allowGrouping={!remote} height={360} rowVirtualization={{ rowHeight: 40 }} columnVirtualization={{}} onVirtualizationStatusChange={setStatus}
      labels={arabic ? { searchPlaceholder: 'بحث في السجلات', rowsPerPage: 'صفوف في الصفحة', records: '{0} سجل', columns: 'الأعمدة' } : undefined} showFilterRow={false} showGroupFooters totalSummaries={summaries} groupSummaries={summaries}
      editing={remote ? undefined : { mode: 'inlineRow', navigationPolicy: 'preserve', update: true, editModelFactory: (row) => ({ ...row }), updateItem: ({ editModel }) => {
        setItems((current) => current.map((row) => row.id === editModel.id ? editModel : row)); return Promise.resolve({ succeeded: true });
      } }} />
  </main>;
}
const meta = { title: 'Phase 29/Grid', component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const VirtualReview: Story = {};
export const ArabicReview: Story = { args: { arabic: true }, globals: { direction: 'rtl' } };
export const RemoteAdapter: Story = { args: { remote: true } };
