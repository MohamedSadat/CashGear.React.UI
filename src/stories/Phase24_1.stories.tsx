import { useMemo, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../components/Button';
import { CgComboBox } from '../components/ComboBox';
import { CgGrid } from '../components/Grid';
import type { CgGridColumnDescriptor, CgGridTableAppearance } from '../components/Grid';
import { CgKeyComboBox } from '../components/KeyComboBox';
import type { CgKeyComboBoxActions } from '../components/KeyComboBox';
import { CgLookUpGrid } from '../components/LookUpGrid';
import type { CgLookUpGridColumnDescriptor } from '../components/LookUpGrid';
import { CgSearchBox } from '../components/SearchBox';
import { parityParameters } from './storySupport';

interface Account {
  readonly id: number;
  readonly code: string;
  readonly name: string;
  readonly region: string;
  readonly balance: number;
}

const accounts: ReadonlyArray<Account> = [
  { id: 1, code: 'C-100', name: 'Acme Manufacturing', region: 'Cairo', balance: 12400 },
  { id: 2, code: 'C-200', name: 'Contoso Retail', region: 'Alexandria', balance: 8725 },
  { id: 3, code: 'C-300', name: 'Northwind Traders', region: 'Giza', balance: 19100 },
  { id: 4, code: 'C-400', name: 'Fabrikam Services', region: 'Cairo', balance: 6480 },
  { id: 5, code: 'C-500', name: 'Adventure Works', region: 'Alexandria', balance: 14320 },
  { id: 6, code: 'C-600', name: 'Litware Logistics', region: 'Giza', balance: 5310 },
];

const accountColumns: ReadonlyArray<CgGridColumnDescriptor<Account>> = [
  { type: 'text', fieldId: 'code', title: 'Code', accessor: (item) => item.code, width: 104 },
  { type: 'text', fieldId: 'name', title: 'Customer', accessor: (item) => item.name, minWidth: 190 },
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (item) => item.region, width: 120 },
  { type: 'number', fieldId: 'balance', title: 'Balance', accessor: (item) => item.balance, width: 128, format: 'currency' },
  { type: 'command', fieldId: '__commands', title: 'Actions', width: 112, hideable: false },
];

const styledAppearance: CgGridTableAppearance = {
  color: 'teal', intensity: 'medium', banding: 'rows', borders: 'horizontal', density: 'compact',
  coloredHeader: true, emphasizeFirstColumn: true, emphasizeLastColumn: true, emphasizeTotals: true,
};

const source = 'CashGear.Blazor.UI commit c5c03fb9e5bc2f49b7a3af87729cfbb83ab86c1c';
const difference = 'React keeps the picker Grid-internal, uses existing surface/text tokens, and does not add Grid virtualization or asynchronous validation.';
const meta: Meta = {
  title: 'Phase 24.1/Reliability Refresh',
  parameters: parityParameters(source, difference),
};
export default meta;
type Story = StoryObj;

function StorySection({ children }: { readonly children: React.ReactNode }) {
  return <section data-cg-phase-24-1 style={{ display: 'grid', gap: '1rem', maxWidth: 900 }}>{children}</section>;
}

export const TableStyling: Story = {
  render: () => <StorySection>
    <CgGrid
      aria-label="Styled customer balances"
      data={accounts}
      columns={accountColumns}
      keySelector={(item) => item.id}
      allowTableStyling
      allowGrouping
      selectionMode="single"
      defaultState={{ pageSize: 4, tableAppearance: styledAppearance }}
      totalSummaries={[{ id: 'balance-total', type: 'sum', fieldId: 'balance', label: 'Total' }]}
      height={380}
    />
  </StorySection>,
};

const editableColumns: ReadonlyArray<CgGridColumnDescriptor<Account>> = [
  { type: 'text', fieldId: 'code', title: 'Code', accessor: (item) => item.code, width: 104 },
  { type: 'text', fieldId: 'name', title: 'Customer', accessor: (item) => item.name, minWidth: 190, editor: { kind: 'text', required: true, minimumLength: 3, setValue: (item, value) => ({ ...item, name: String(value) }) } },
  { type: 'text', fieldId: 'region', title: 'Region', accessor: (item) => item.region, width: 120, editor: { kind: 'enum', required: true, options: ['Cairo', 'Alexandria', 'Giza'].map((value) => ({ key: value, label: value, value })), setValue: (item, value) => ({ ...item, region: String(value) }) } },
  { type: 'number', fieldId: 'balance', title: 'Balance', accessor: (item) => item.balance, width: 128, editor: { kind: 'number', minimum: 0, maximum: 50000, setValue: (item, value) => ({ ...item, balance: Number(value) }) } },
  { type: 'command', fieldId: '__commands', title: 'Actions', width: 112, hideable: false },
];

function EditingReliabilityExample() {
  const [items, setItems] = useState(accounts.slice(0, 4));
  return <CgGrid
    aria-label="Validated customer balances"
    data={items}
    columns={editableColumns}
    keySelector={(item) => item.id}
    showSearch={false}
    showFilterRow={false}
    height={340}
    editing={{
      mode: 'popup', update: true, editModelFactory: (item) => ({ ...item }),
      validateEdit: ({ model }) => model.name === 'Blocked customer' ? { fieldErrors: { balance: 'Choose a balance for an active customer.' }, generalErrors: 'This customer cannot be saved.' } : undefined,
      updateItem: async ({ rowKey, editModel }, { signal }) => {
        await new Promise<void>((resolve) => setTimeout(resolve, 650));
        if (signal.aborted) return { succeeded: false, outcome: 'rejected' };
        setItems((current) => current.map((item) => `number:${item.id}` === rowKey ? editModel : item));
        return { succeeded: true };
      },
    }}
  />;
}

export const EditValidationAndLocking: Story = { render: () => <StorySection><EditingReliabilityExample /></StorySection> };

export const IncompleteComboResults: Story = {
  render: () => <StorySection>
    <label style={{ display: 'grid', gap: 6 }}>Customer
      <CgComboBox
        options={accounts}
        getOptionKey={(item) => item.id}
        getOptionLabel={(item) => item.name}
        getOptionSearchText={(item) => `${item.code} ${item.name} ${item.region}`}
        maxVisibleItems={3}
        refineSearchMessage="Refine the search to choose a specific customer."
        aria-label="Incomplete customer results"
      />
    </label>
    <small>Enter is intentionally ignored until a result is explicitly highlighted.</small>
  </StorySection>,
};

function KeyResolutionExample() {
  const actions = useRef<CgKeyComboBoxActions>(null);
  const attempts = useRef(0);
  const [diagnostic, setDiagnostic] = useState('Waiting for resolver');
  return <StorySection>
    <CgKeyComboBox
      options={[]}
      value={404}
      actionsRef={actions}
      getOptionKey={(item: Account) => item.id}
      getOptionLabel={(item) => `${item.code} — ${item.name}`}
      itemResolver={async (_value, { signal }) => {
        const attempt = ++attempts.current;
        await new Promise<void>((resolve) => setTimeout(resolve, 180));
        if (signal.aborted) return null;
        if (attempt === 1) throw new Error('Private resolver failure');
        return { id: 404, code: 'C-404', name: 'Recovered customer', region: 'Cairo', balance: 0 };
      }}
      resolutionErrorMessage="Customer details are temporarily unavailable."
      onResolutionError={({ value }) => setDiagnostic(`Resolver diagnostic captured for key ${String(value)}`)}
      aria-label="Resolved customer key"
    />
    <CgButton onClick={async () => actions.current?.refreshSelectedItem()}>Refresh selected customer</CgButton>
    <output aria-label="Resolution diagnostic">{diagnostic}</output>
  </StorySection>;
}

export const KeyedResolutionRefreshAndFailure: Story = { render: () => <KeyResolutionExample /> };

const lookupColumns: ReadonlyArray<CgLookUpGridColumnDescriptor<Account>> = [
  { fieldId: 'code', title: 'Code', accessor: (item) => item.code, width: 100 },
  { fieldId: 'name', title: 'Customer', accessor: (item) => item.name, width: 220 },
  { fieldId: 'region', title: 'Region', accessor: (item) => item.region, width: 120 },
];
const mutableVersionAccounts: Account[] = [...accounts];

function ContextAndVersionExample() {
  const [dataVersion, setDataVersion] = useState(0);
  const [region, setRegion] = useState('Cairo');
  const context = useMemo(() => ({ region }), [region]);
  return <StorySection>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <CgButton onClick={() => setRegion((value) => value === 'Cairo' ? 'Giza' : 'Cairo')}>Change query context</CgButton>
      <CgButton onClick={() => {
        if (!mutableVersionAccounts.some((item) => item.id === 7)) mutableVersionAccounts.push({ id: 7, code: 'C-700', name: 'New same-reference customer', region, balance: 7700 });
        setDataVersion((version) => version + 1);
      }}>Mutate data and bump version</CgButton>
      <output aria-label="Lookup context">{region} / v{dataVersion}</output>
    </div>
    <CgComboBox
      options={mutableVersionAccounts}
      dataVersion={dataVersion}
      queryContext={context}
      isQueryContextEqual={(left, right) => left?.region === right?.region}
      getOptionKey={(item) => item.id}
      getOptionLabel={(item) => item.name}
      getOptionSearchText={(item) => `${item.name} ${item.region}`}
      aria-label="Versioned customer combo"
    />
    <CgLookUpGrid
      data={mutableVersionAccounts}
      dataVersion={dataVersion}
      queryContext={context}
      isQueryContextEqual={(left, right) => left?.region === right?.region}
      columns={lookupColumns}
      valueSelector={(item) => item.id}
      textSelector={(item) => `${item.code} — ${item.name}`}
      searchDebounceMilliseconds={0}
      aria-label="Versioned customer lookup"
    />
  </StorySection>;
}

export const ContextAndDataVersionInvalidation: Story = { render: () => <ContextAndVersionExample /> };

function SearchBoxImeExample() {
  const [calls, setCalls] = useState(0);
  const [lastQuery, setLastQuery] = useState('None');
  return <StorySection>
    <CgSearchBox
      aria-label="IME search probe"
      searchMode="input"
      onSearch={(query) => { setCalls((count) => count + 1); setLastQuery(query); }}
    />
    <output aria-label="IME search count">{calls}</output>
    <output aria-label="IME last query">{lastQuery}</output>
  </StorySection>;
}

export const SearchBoxImeRegression: Story = { render: () => <SearchBoxImeExample /> };
