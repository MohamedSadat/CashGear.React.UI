import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgComboBox } from './CgComboBox';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

interface Customer { id: number; code: string; name: string; city: string; }
const customers: Customer[] = [
  { id: 1, code: 'C-100', name: 'Acme Manufacturing', city: 'Cairo' },
  { id: 2, code: 'C-200', name: 'Contoso Retail', city: 'Alexandria' },
  { id: 3, code: 'C-300', name: 'Northwind Traders', city: 'London' },
  { id: 4, code: 'C-400', name: 'أَحْمَد للتجارة', city: 'القاهرة' },
];
const getLabel = (item: Customer) => `${item.code} - ${item.name}`;
const getKey = (item: Customer) => item.id;
const source = 'CG.CompLib/Comp/Inputs/CgComboBox.*; CG.CompLib.Demo/Components/Pages/ComboBoxDemo.razor';
const difference = 'Object-valued selection uses required stable keys for identity and native form serialization; the scalar CgKeyComboBox adapter remains deferred.';
const meta: Meta = { title: 'Phase 3/ComboBox', component: CgComboBox, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ControlledLocal() {
  const [value, setValue] = useState<Customer | null>(customers[1]!);
  return <CgField label="Customer"><CgComboBox options={customers} value={value} onValueChange={setValue} getOptionLabel={getLabel} getOptionKey={getKey} getOptionSearchText={(item) => `${item.code} ${item.name} ${item.city}`} name="customerId" clearable /></CgField>;
}

function RemoteExample() {
  return <CgField label="Remote customer"><CgComboBox loadOptions={async (query, { signal }) => { await new Promise((resolve) => setTimeout(resolve, 500)); if (signal.aborted) return []; if (query === 'error') throw new Error('Demo search failure'); return customers.filter((item) => item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())); }} getOptionLabel={getLabel} getOptionKey={getKey} minimumSearchLength={2} searchDelay={250} /></CgField>;
}

function NativeFormExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return <form onSubmit={(event) => { event.preventDefault(); const submittedKey = new FormData(event.currentTarget).get('customerId'); setSubmitted(typeof submittedKey === 'string' ? submittedKey : 'Not submitted'); }}><CgField label="Form customer"><CgComboBox options={customers} defaultValue={customers[0]} getOptionLabel={getLabel} getOptionKey={getKey} name="customerId" required /></CgField><button type="submit">Submit selection</button><button type="reset">Reset selection</button><output aria-label="Submitted key">{submitted}</output></form>;
}

function RejectedSelectionExample() {
  const [attempted, setAttempted] = useState('None');
  return <><CgField label="Authoritative customer"><CgComboBox options={customers} value={customers[0]} onValueChange={(next) => setAttempted(next?.name ?? 'Cleared')} getOptionLabel={getLabel} getOptionKey={getKey} /></CgField><output aria-label="Attempted selection">{attempted}</output></>;
}

export const ControlledLocalSelection: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledLocal /></StoryFrame> };
export const UncontrolledAndEmpty: Story = { render: () => <StoryFrame source={source} difference={difference}><CgComboBox aria-label="Uncontrolled customer" options={customers} defaultValue={customers[0]} getOptionLabel={getLabel} getOptionKey={getKey} /><CgComboBox aria-label="Empty customer list" options={[]} getOptionLabel={getLabel} getOptionKey={getKey} placeholder="No customers loaded" /></StoryFrame> };
export const RemoteLoadingMinimumAndError: Story = { render: () => <StoryFrame source={source} difference={difference}><RemoteExample /><small>Type “no”, “contoso”, or “error”.</small></StoryFrame> };
export const StatesAndValidation: Story = { render: () => <StoryFrame source={source} difference={difference}><CgComboBox aria-label="Disabled customer" options={customers} defaultValue={customers[0]} getOptionLabel={getLabel} getOptionKey={getKey} disabled /><CgComboBox aria-label="Read only customer" options={customers} defaultValue={customers[1]} getOptionLabel={getLabel} getOptionKey={getKey} readOnly /><CgComboBox aria-label="Required customer" options={customers} getOptionLabel={getLabel} getOptionKey={getKey} required validationState="error" /><CgComboBox aria-label="Large customer" options={customers} getOptionLabel={getLabel} getOptionKey={getKey} size="large" /></StoryFrame> };
export const KeyboardAndLongContent: Story = { render: () => <StoryFrame source={source} difference={difference}><CgComboBox aria-label="Keyboard customer" options={[...customers, { id: 5, code: 'C-500', name: 'A customer with an intentionally long legal company name for overflow testing', city: 'Giza' }]} getOptionLabel={getLabel} getOptionKey={getKey} style={{ width: 360 }} /><small>Use Arrow Up/Down, Home/End, Enter, Escape, and Tab.</small></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="العميل"><CgComboBox options={customers} getOptionLabel={getLabel} getOptionKey={getKey} getOptionSearchText={(item) => item.name} locale="ar-EG" placeholder="اختر العميل" /></CgField></div></StoryFrame> };
export const PopupViewportFixture: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ minHeight: 460, display: 'flex', alignItems: 'end' }}><CgComboBox aria-label="Viewport customer" options={customers} getOptionLabel={getLabel} getOptionKey={getKey} /></div></StoryFrame> };
export const NativeFormFixture: Story = { render: () => <StoryFrame source={source} difference={difference}><NativeFormExample /></StoryFrame> };
export const RejectedControlledFixture: Story = { render: () => <StoryFrame source={source} difference={difference}><RejectedSelectionExample /></StoryFrame> };
