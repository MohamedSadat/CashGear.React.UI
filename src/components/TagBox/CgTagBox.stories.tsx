import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTagBox } from './CgTagBox';

interface Customer {
  id: number;
  code: string;
  name: string;
  city: string;
  disabled?: boolean;
}

const customers: Customer[] = [
  { id: 1, code: 'C-100', name: 'Acme Manufacturing', city: 'Cairo' },
  { id: 2, code: 'C-200', name: 'Contoso Retail', city: 'Alexandria' },
  { id: 3, code: 'C-300', name: 'Northwind Traders', city: 'London' },
  { id: 4, code: 'C-400', name: 'أَحْمَد للتجارة', city: 'القاهرة' },
  { id: 5, code: 'C-500', name: 'Legacy customer — selection disabled', city: 'Giza', disabled: true },
];
const getKey = (item: Customer) => item.id;
const getLabel = (item: Customer) => `${item.code} - ${item.name}`;
const getSearchText = (item: Customer) => `${item.code} ${item.name} ${item.city}`;
const source = 'CG.CompLib/Comp/Inputs/CgTagBox.*; CG.CompLib.Demo/Components/Pages/TagBoxDemo.razor';
const difference = 'React binds selected object arrays by stable key; scalar-key values, custom key comparers, and ResolveValuesAsync hydration remain deferred because selected objects carry their tag labels.';
const meta: Meta = { title: 'Phase 5/TagBox', component: CgTagBox, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ControlledSelection() {
  const [value, setValue] = useState<ReadonlyArray<Customer>>([customers[0]!, customers[2]!]);
  return (
    <>
      <CgField label="Controlled customers" description="Selected objects are reconciled by stable key.">
        <CgTagBox options={customers} value={value} onValueChange={setValue} getOptionKey={getKey} getOptionLabel={getLabel} getOptionSearchText={getSearchText} name="customerIds" fullWidth />
      </CgField>
      <output aria-label="Selected customer codes">{value.map((item) => item.code).join(', ') || 'None'}</output>
    </>
  );
}

function RemoteSelection() {
  return (
    <CgField label="Remote customers" description="Type “co”, “north”, “none”, or “error”.">
      <CgTagBox
        loadOptions={async (query, { signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (signal.aborted) return [];
          if (query === 'error') throw new Error('Demo search failure');
          if (query === 'none') return [];
          return customers.filter((item) => getSearchText(item).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
        }}
        getOptionKey={getKey}
        getOptionLabel={getLabel}
        minimumSearchLength={2}
        searchDelay={250}
        fullWidth
      />
    </CgField>
  );
}

function NativeFormExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      setSubmitted(new FormData(event.currentTarget).getAll('customerIds').map(String).join(', ') || 'None');
    }}>
      <CgField label="Form customers" description="Only selected stable keys are submitted; the search query is excluded.">
        <CgTagBox options={customers} defaultValue={[customers[0]!]} getOptionKey={getKey} getOptionLabel={getLabel} name="customerIds" required fullWidth />
      </CgField>
      <div style={{ display: 'flex', gap: 8, marginBlockStart: 12 }}>
        <button type="submit">Submit selections</button>
        <button type="reset">Reset selections</button>
      </div>
      <output aria-label="Submitted customer keys">{submitted}</output>
    </form>
  );
}

function RejectedSelectionExample() {
  const [attempted, setAttempted] = useState('None');
  return (
    <>
      <CgField label="Authoritative customers">
        <CgTagBox options={customers} value={[customers[0]!]} onValueChange={(next) => setAttempted(next.map((item) => item.name).join(', ') || 'Cleared')} getOptionKey={getKey} getOptionLabel={getLabel} />
      </CgField>
      <output aria-label="Attempted customers">{attempted}</output>
    </>
  );
}

export const Default: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Customers"><CgTagBox options={customers} defaultValue={[customers[0]!, customers[2]!]} getOptionKey={getKey} getOptionLabel={getLabel} fullWidth /></CgField></StoryFrame>,
};

export const ControlledAndUncontrolled: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ControlledSelection /><CgField label="Uncontrolled customers"><CgTagBox options={customers} defaultValue={[customers[1]!]} getOptionKey={getKey} getOptionLabel={getLabel} /></CgField></StoryFrame>,
};

export const MaximumAndCustomTags: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Approval recipients" description="At most two active customers can be selected."><CgTagBox options={customers} defaultValue={[customers[0]!, customers[1]!]} getOptionKey={getKey} getOptionLabel={getLabel} isOptionDisabled={(item) => Boolean(item.disabled)} maxSelectedItems={2} renderTag={({ item }) => <><strong>{item.code}</strong>&nbsp;{item.name}</>} renderOption={({ option, selected, disabled }) => <span><strong>{option.name}</strong><br /><small>{option.city} · {selected ? 'Selected' : disabled ? 'Unavailable' : 'Available'}</small></span>} fullWidth /></CgField></StoryFrame>,
};

export const LocalSearchAndKeyboard: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Search customers"><CgTagBox options={customers} getOptionKey={getKey} getOptionLabel={getLabel} getOptionSearchText={getSearchText} isOptionDisabled={(item) => Boolean(item.disabled)} placeholder="Search by code, name, or city" style={{ width: 440 }} /></CgField><small>Use Arrow Up/Down, Home/End, Enter, Backspace, Escape, and Tab.</small></StoryFrame>,
};

export const RemoteLoadingMinimumAndError: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RemoteSelection /></StoryFrame>,
};

export const EmptyAndLongContent: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgTagBox aria-label="Empty customers" options={[]} getOptionKey={getKey} getOptionLabel={getLabel} emptyMessage="No customers loaded" /><CgTagBox aria-label="Long customer tags" options={[...customers, { id: 6, code: 'C-600', name: 'An intentionally long registered customer name for wrapping and overflow review', city: 'New Cairo' }]} defaultValue={[customers[0]!, { id: 6, code: 'C-600', name: 'An intentionally long registered customer name for wrapping and overflow review', city: 'New Cairo' }]} getOptionKey={getKey} getOptionLabel={getLabel} style={{ width: 420 }} /></StoryFrame>,
};

export const StatesAndValidation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgTagBox aria-label="Disabled customers" options={customers} defaultValue={[customers[0]!]} getOptionKey={getKey} getOptionLabel={getLabel} disabled size="small" /><CgTagBox aria-label="Read only customers" options={customers} defaultValue={[customers[1]!]} getOptionKey={getKey} getOptionLabel={getLabel} readOnly /><CgField label="Required customers" errorMessage="Select at least one customer."><CgTagBox options={customers} getOptionKey={getKey} getOptionLabel={getLabel} required validationState="error" size="large" /></CgField></StoryFrame>,
};

export const NativeForms: Story = {
  render: () => <StoryFrame source={source} difference={difference}><NativeFormExample /></StoryFrame>,
};

export const RequiredNativeForm: Story = {
  render: () => <StoryFrame source={source} difference={difference}><form><CgField label="Required form customers"><CgTagBox options={customers} getOptionKey={getKey} getOptionLabel={getLabel} name="requiredCustomerIds" required /></CgField><button type="submit">Submit required tags</button></form></StoryFrame>,
};

export const RejectedControlledFixture: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RejectedSelectionExample /></StoryFrame>,
};

export const DarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <StoryFrame source={source} difference={difference}><CgTagBox aria-label="Compact customer tags" options={customers} defaultValue={[customers[0]!, customers[1]!, customers[2]!]} getOptionKey={getKey} getOptionLabel={getLabel} size="small" style={{ width: 460 }} /></StoryFrame>,
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="العملاء"><CgTagBox options={customers} defaultValue={[customers[3]!]} getOptionKey={getKey} getOptionLabel={getLabel} getOptionSearchText={getSearchText} locale="ar-EG" direction="rtl" placeholder="ابحث عن عميل" clearAriaLabel="مسح كل العملاء" toggleAriaLabel="عرض الخيارات" removeAriaLabel={(_item, tagLabel) => `إزالة ${tagLabel}`} selectedCountMessage={(count) => `${count} محدد`} resultsCountMessage={(count) => `${count} نتيجة`} fullWidth /></CgField></div></StoryFrame>,
};
