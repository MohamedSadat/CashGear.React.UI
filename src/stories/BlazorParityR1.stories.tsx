import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../components/Button';
import { CgDateRangePicker } from '../components/DateRangePicker';
import { CgGrid } from '../components/Grid';
import type { CgGridColumnDescriptor } from '../components/Grid';
import { CgLoadingPanel } from '../components/LoadingPanel';
import { CgPivotTable } from '../components/PivotTable';
import type { CgPivotField } from '../components/PivotTable';
import { CgRadioGroup } from '../components/RadioGroup';
import { CgTagBox } from '../components/TagBox';
import { CgTextBox } from '../components/TextBox';
import { CgTreeList } from '../components/TreeList';
import type { CgTreeListColumn, CgTreeListParentKey } from '../components/TreeList';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI after aea3e622: CgGrid, CgTreeList, CgLoadingPanel, CgTagBox, CgDateRangePicker, CgRadioGroup, CgEditorButton, CgPivotTable';
const difference = 'Blazor parameters become optional props and descriptor fields with the same defaults.';
const meta: Meta = { title: 'Blazor parity 2026-11/Small additions', parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Invoice { id: number; customer: string; amount: number }
const invoices: ReadonlyArray<Invoice> = [{ id: 1, customer: 'Nile Foods', amount: 1200 }, { id: 2, customer: 'Delta Steel', amount: -340 }, { id: 3, customer: 'Cairo Print', amount: 860 }];
const invoiceColumns: ReadonlyArray<CgGridColumnDescriptor<Invoice>> = [
  { type: 'text', fieldId: 'customer', title: 'Customer', accessor: (row) => row.customer, editor: { kind: 'text', setValue: (row, value) => ({ ...row, customer: String(value) }) } },
  { type: 'number', fieldId: 'amount', title: 'Amount', accessor: (row) => row.amount },
];

export const GridRowClassAndFocusOutCommit: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <style>{'.cg-story-negative td { color: var(--cg-danger-text); }'}</style>
    <CgGrid data={invoices} columns={invoiceColumns} keySelector={(row) => row.id} showFilterRow={false} rowClassName={(row) => row.amount < 0 ? 'cg-story-negative' : undefined}
      editing={{ mode: 'cell', navigationPolicy: 'preserve', update: true, commitOnFocusOut: true, editModelFactory: (row) => ({ ...row }), updateItem: () => Promise.resolve({ succeeded: true }) }} />
  </StoryFrame>,
};

interface Account { id: number; parent: number | null; name: string }
const accounts: ReadonlyArray<Account> = [{ id: 1, parent: null, name: 'Assets' }, { id: 2, parent: 1, name: 'Current assets' }, { id: 3, parent: 2, name: 'Cash' }, { id: 4, parent: null, name: 'Liabilities' }];
const accountColumns: ReadonlyArray<CgTreeListColumn<Account, number>> = [{ type: 'text', fieldId: 'name', title: 'Account', hierarchy: true, getValue: (item) => item.name }];

export const TreeListIndentAndToolbar: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgTreeList data={accounts} columns={accountColumns} getKey={(item) => item.id} getParentKey={(item): CgTreeListParentKey<number> => item.parent === null ? { kind: 'none' } : { kind: 'key', key: item.parent }}
      defaultExpandedKeys={new Set([1, 2])} indentSize="2rem" toolbar={<CgButton size="small">New account</CgButton>} />
  </StoryFrame>,
};

export const LoadingPanelLayouts: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: 16 }}>
      {(['top', 'inlineEnd', 'bottom', 'inlineStart'] as const).map((alignment) => <CgLoadingPanel key={alignment} visible mode="overlay" textAlignment={alignment} size={alignment === 'top' ? 'small' : alignment === 'bottom' ? 'large' : 'medium'} indicatorAreaVisible={alignment !== 'inlineStart'} text={alignment}><div style={{ height: 120 }} /></CgLoadingPanel>)}
    </div>
  </StoryFrame>,
};

export const TagBoxHidesSelected: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgTagBox aria-label="Warehouses" options={['Cairo', 'Alexandria', 'Giza', 'Suez']} getOptionKey={(option) => option} getOptionLabel={(option) => option} defaultValue={['Giza']} hideSelectedItems />
  </StoryFrame>,
};

export const DateRangePickerCalendarOnly: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgDateRangePicker aria-label="Posting period" allowTextInput={false} placement="top-start" defaultValue={{ start: '2026-11-01', end: '2026-11-18' }} />
  </StoryFrame>,
};

export const RadioGroupItemLayout: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 260 }}>
      <CgRadioGroup legend="Delivery" options={[{ value: 'pickup', label: 'Pickup at the branch' }, { value: 'courier', label: 'Courier to a customer address outside the city' }]} itemLabelPosition="start" itemAlignment="stretch" itemLabelWrap={false} />
    </div>
  </StoryFrame>,
};

export const EditorButtonLinksAndTypes: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <form onSubmit={(event) => event.preventDefault()}>
      <CgTextBox aria-label="Invoice number" defaultValue="INV-2048" buttons={[
        { key: 'open', ariaLabel: 'Open invoice', text: 'Open', href: '#invoice-2048' },
        { key: 'copy', ariaLabel: 'Copy', icon: 'copy', focusable: false },
        { key: 'send', ariaLabel: 'Send', text: 'Send', type: 'submit' },
      ]} />
    </form>
  </StoryFrame>,
};

interface Sale { region: string; value: string }
const saleFields: ReadonlyArray<CgPivotField<Sale>> = [
  { key: 'region', caption: 'Region', valueType: 'text', area: 'row', getValue: (row) => row.region },
  { key: 'value', caption: 'Revenue', valueType: 'decimal', area: 'data', getValue: (row) => row.value },
];

export const PivotWithoutColumnFields: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgPivotTable data={[{ region: 'East', value: '120' }, { region: 'West', value: '80' }]} fields={saleFields} height="12rem" />
  </StoryFrame>,
};
