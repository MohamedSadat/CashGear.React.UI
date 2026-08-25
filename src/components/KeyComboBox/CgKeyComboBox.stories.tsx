import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgKeyComboBox } from './CgKeyComboBox';

interface Customer {
  id: number;
  code: string;
  name: string;
  city: string;
}

const customers: Customer[] = [
  { id: 0, code: 'C-000', name: 'Walk-in customer', city: 'Cairo' },
  { id: 1, code: 'C-100', name: 'Acme Manufacturing', city: 'Cairo' },
  { id: 2, code: 'C-200', name: 'Contoso Retail', city: 'Alexandria' },
  { id: 3, code: 'C-300', name: 'Northwind Traders', city: 'London' },
  { id: 4, code: 'C-400', name: 'أَحْمَد للتجارة', city: 'القاهرة' },
];

const getLabel = (item: Customer) => `${item.code} - ${item.name}`;
const getKey = (item: Customer) => item.id;
const source = 'CG.CompLib/Comp/Inputs/CgKeyComboBox.*; CG.CompLib.Tests/CgKeyComboBoxTests.cs; CG.CompLib.Demo/Components/Pages/Home.razor';
const difference = 'React keys are finite numbers or strings, null is the explicit empty value, and selectedItem provides synchronous off-page hydration; no async key resolver is added.';

const meta: Meta = {
  title: 'Phase 7/KeyComboBox',
  component: CgKeyComboBox,
  parameters: parityParameters(source, difference),
};

export default meta;
type Story = StoryObj;

function ControlledNumericKey() {
  const [value, setValue] = useState<number | null>(2);
  return (
    <CgField label="Customer id" description={<>Bound key: <output aria-label="Bound customer id">{value ?? 'none'}</output></>}>
      <CgKeyComboBox
        options={customers}
        value={value}
        onValueChange={setValue}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
        getOptionSearchText={(item) => `${item.code} ${item.name} ${item.city}`}
      />
    </CgField>
  );
}

function NativeFormExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const submittedKey = new FormData(event.currentTarget).get('customerId');
      setSubmitted(typeof submittedKey === 'string' ? submittedKey : 'Not submitted');
    }}>
      <CgField label="Form customer key">
        <CgKeyComboBox
          options={customers}
          defaultValue={1}
          getOptionLabel={getLabel}
          getOptionKey={getKey}
          name="customerId"
          required
        />
      </CgField>
      <button type="submit">Submit customer key</button>
      <button type="reset">Reset customer key</button>
      <output aria-label="Submitted customer id">{submitted}</output>
    </form>
  );
}

function RejectedSelectionExample() {
  const [attempted, setAttempted] = useState('None');
  return (
    <CgField label="Authoritative customer key" description={<>Attempted key: <output aria-label="Attempted customer id">{attempted}</output></>}>
      <CgKeyComboBox
        options={customers}
        value={1}
        onValueChange={(next) => setAttempted(next === null ? 'Cleared' : String(next))}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
      />
    </CgField>
  );
}

function RemoteOffPageExample() {
  const offPage = { id: 99, code: 'C-999', name: 'Off-page customer', city: 'Aswan' };
  const [value, setValue] = useState<number | null>(99);
  return (
    <CgField label="Remote customer key" description={<>Bound key: <output aria-label="Remote customer id">{value ?? 'none'}</output></>}>
      <CgKeyComboBox
        loadOptions={async (query, { signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 350));
          if (signal.aborted) return [];
          return customers.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
        }}
        value={value}
        selectedItem={offPage}
        onValueChange={setValue}
        getOptionLabel={getLabel}
        getOptionKey={getKey}
        minimumSearchLength={2}
        searchDelay={150}
      />
    </CgField>
  );
}

export const Default: Story = {
  render: () => (
    <StoryFrame source={source} difference={difference}>
      <ControlledNumericKey />
      <CgField label="Account code">
        <CgKeyComboBox
          options={customers}
          defaultValue="C-000"
          getOptionLabel={getLabel}
          getOptionKey={(item) => item.code}
        />
      </CgField>
    </StoryFrame>
  ),
};

export const RemoteOffPageSelection: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RemoteOffPageExample /></StoryFrame>,
};

export const NativeForm: Story = {
  render: () => <StoryFrame source={source} difference={difference}><NativeFormExample /></StoryFrame>,
};

export const RejectedControlledFixture: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RejectedSelectionExample /></StoryFrame>,
};
