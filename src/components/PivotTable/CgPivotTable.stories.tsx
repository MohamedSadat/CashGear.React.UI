import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { parityParameters } from '../../stories/storySupport';
import { CgPivotTable, CgPivotCalculatedMeasures, createPivotExport, getPivotDistinctValues, getPivotDrillDown, normalizePivotLayout, processPivotData } from './index';
import type { CgPivotActions, CgPivotDataProvider, CgPivotField, CgPivotLayout } from './index';
interface Sale {
    region: string;
    product: string;
    date: string;
    revenue: string;
    cost: string;
    units: number;
}
const source = 'CashGear.Blazor.UI/Components/Data/Pivot at 1e327060d65c8ae7e94088b24014cb7ebbd72714';
const difference = 'React typed fields and canonical decimal/date strings; cancellable host-owned providers. No SQL, backend authorization, or .NET dependencies are included.';
const data: ReadonlyArray<Sale> = Array.from({ length: 24 }, (_, i) => ({ region: ['Cairo', 'Alexandria', 'Giza'][i % 3]!, product: ['Hardware', 'Software'][Math.floor(i / 3) % 2]!, date: `2026-${String(i % 4 + 1).padStart(2, '0')}-01`, revenue: String((i + 1) * 125.25), cost: String((i + 1) * 75.15), units: i + 1 }));
const fields: ReadonlyArray<CgPivotField<Sale>> = [
    { key: 'region', caption: 'Region', valueType: 'text', area: 'row', getValue: r => r.region, sortOrder: 'ascending' },
    { key: 'product', caption: 'Product', valueType: 'text', area: 'row', getValue: r => r.product },
    { key: 'date', caption: 'Month', valueType: 'date', area: 'column', groupInterval: 'month', getValue: r => r.date },
    { key: 'revenue', caption: 'Revenue', valueType: 'decimal', area: 'data', getValue: r => r.revenue, cellFormat: 'N2', allowedAreas: ['data', 'filter'] },
    { key: 'cost', caption: 'Cost', valueType: 'decimal', area: 'hidden', getValue: r => r.cost, cellFormat: 'N2', allowedAreas: ['data', 'filter'] },
    { key: 'units', caption: 'Units', valueType: 'number', area: 'hidden', getValue: r => r.units, allowedAreas: ['data', 'filter'] },
    { key: 'margin', caption: 'Margin %', valueType: 'decimal', area: 'data', calculated: CgPivotCalculatedMeasures.grossMarginPercentage<Sale>(r => r.revenue, r => r.cost), cellFormat: 'N2', allowedAreas: ['data'] },
];
const common = { data, fields, height: 360 } as const;
const meta: Meta = { title: 'Phase 22/PivotTable', component: CgPivotTable, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;
const frame = (child: React.ReactNode) => <section data-cg-story-root="" style={{display:'grid',gap:'1rem',width:'min(1100px,100%)',minWidth:0}}><div style={{minWidth:0}}>{child}</div><small style={{color:'var(--cg-text-secondary)'}}><strong>Razor:</strong> {source}<br/><strong>Known difference:</strong> {difference}</small></section>;
export const SalesAnalysis: Story = { render: () => frame(<CgPivotTable {...common}/>) };
export const CalculatedMeasures: Story = { render: () => frame(<CgPivotTable {...common} fields={[...fields, { key: 'price', caption: 'Weighted unit price', valueType: 'decimal', area: 'data', allowedAreas: ['data'], calculated: CgPivotCalculatedMeasures.averageUnitPrice<Sale>(r => r.revenue, r => r.units), cellFormat: 'N2' }]}/>) };
function Controlled() { const [layout, setLayout] = useState(() => normalizePivotLayout(fields)); return frame(<><CgPivotTable {...common} layout={layout} onLayoutChange={setLayout}/><output aria-label="Layout version">Layout v{layout.version}</output></>); }
export const ControlledLayout: Story = { render: () => <Controlled /> };
export const SavedLayout: Story = { render: () => frame(<CgPivotTable {...common} layoutKey="pivot-sales-demo"/>) };
export const ArabicRtl: Story = { render: () => frame(<CgPivotTable {...common} locale="ar-EG" direction="rtl" fields={fields.map(f => ({ ...f, caption: ({ region: 'المنطقة', product: 'المنتج', date: 'الشهر', revenue: 'الإيرادات', margin: 'هامش الربح' } as Record<string, string>)[f.key] ?? f.caption }))}/>) };
export const DarkComfortable: Story = { render: () => frame(<div data-cg-theme="dark"><CgPivotTable {...common} density="comfortable"/></div>) };
export const Empty: Story = { render: () => frame(<CgPivotTable {...common} data={[]}/>) };
export const Limits: Story = { render: () => frame(<CgPivotTable {...common} maximumResultCells={2}/>) };
export const ReadOnly: Story = { render: () => frame(<CgPivotTable {...common} readOnly/>) };
export const Narrow: Story = { render: () => frame(<div style={{ width: 340, maxWidth: '100%' }}><CgPivotTable {...common}/></div>) };
const large = Array.from({ length: 6000 }, (_, i) => ({ ...data[i % data.length]!, region: `Region ${String(i % 200).padStart(3, '0')}`, product: `Product ${i % 17}`, date: `2026-${String(i % 12 + 1).padStart(2, '0')}-01` }));
export const Virtualized: Story = { render: () => frame(<CgPivotTable {...common} data={large} height={320}/>) };
const delay = (signal: AbortSignal) => new Promise<void>((resolve, reject) => { signal.throwIfAborted(); const stop = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); }; const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve(); }, 180); signal.addEventListener('abort', stop, { once: true }); });
const provider: CgPivotDataProvider = {
    execute: async (query, signal) => { await delay(signal); return processPivotData(data, fields, query, signal); },
    getDistinctValues: (query, signal) => getPivotDistinctValues(data, fields, query, signal),
    getDrillDown: (query, signal) => getPivotDrillDown(data, fields, query, signal),
};
export const RemoteProvider: Story = { render: () => frame(<CgPivotTable fields={fields} dataProvider={provider} height={360} exportProvider={{ export: async (request, signal) => createPivotExport(await processPivotData(data, fields, request.query, signal), request.layout, fields, request.format, { signal, rightToLeft: request.rightToLeft }) }}/>) };
const failed: CgPivotDataProvider = { ...provider, execute: () => Promise.reject(new Error('Demo provider failure')) };
export const ProviderError: Story = { render: () => frame(<CgPivotTable fields={fields} dataProvider={failed} height={360}/>) };
function ExportDemo() { const actions = useRef<CgPivotActions>(null); const [message, setMessage] = useState(''); return frame(<><CgPivotTable {...common} actionsRef={actions} onExportCompleted={file => setMessage(`${file.fileName}: ${file.rowCount} logical rows`)}/><output aria-label="Export result">{message}</output></>); }
export const FullExport: Story = { render: () => <ExportDemo /> };
function Deferred() { const [layout, setLayout] = useState<CgPivotLayout>(() => normalizePivotLayout(fields)); return frame(<CgPivotTable {...common} layout={layout} onLayoutChange={setLayout} deferredFieldListChanges/>); }
export const DeferredFieldList: Story = { render: () => <Deferred /> };
