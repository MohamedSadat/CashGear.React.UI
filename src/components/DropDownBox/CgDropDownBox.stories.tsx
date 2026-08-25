import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgListBox } from '../ListBox';
import { CgTagBox } from '../TagBox';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgDropDownBox } from './CgDropDownBox';
import type { CgDropDownBoxActions, CgDropDownBoxContext } from './CgDropDownBox.types';

interface Customer {
  id: number;
  code: string;
  name: string;
  city: string;
}

const customers: Customer[] = [
  { id: 1, code: 'C-100', name: 'Acme Manufacturing', city: 'Cairo' },
  { id: 2, code: 'C-200', name: 'Contoso Retail', city: 'Alexandria' },
  { id: 3, code: 'C-300', name: 'Northwind Traders', city: 'London' },
  { id: 4, code: 'C-400', name: 'أَحْمَد للتجارة', city: 'القاهرة' },
];
const getKey = (customer: Customer) => customer.id;
const getLabel = (customer: Customer) => `${customer.code} - ${customer.name}`;
const getSearchText = (customer: Customer) => `${customer.code} ${customer.name} ${customer.city}`;
const sameCustomer = (left: Customer | null, right: Customer | null) => left?.id === right?.id;
const sameCustomers = (left: ReadonlyArray<Customer> | null, right: ReadonlyArray<Customer> | null) => (
  (left ?? []).map(getKey).join(',') === (right ?? []).map(getKey).join(',')
);
const source = 'CG.CompLib/Comp/Inputs/CgDropDownBox.*; CG.CompLib.Demo/Components/Pages/DropDownBoxDemo.razor';
const difference = 'React hosts arbitrary React content and serializes forms through a native select proxy. Browser top-layer popovers are replaced by an SSR-safe body portal; no focus trap is added.';
const meta: Meta = { title: 'Phase 6/DropDownBox', component: CgDropDownBox, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function CustomerList({ dropDown }: { dropDown: CgDropDownBoxContext<Customer> }) {
  const selected = dropDown.pendingValue ? [dropDown.pendingValue] : [];
  return (
    <CgListBox
      aria-label="Customer choices"
      items={customers}
      value={selected}
      onValueChange={(next, details) => { void dropDown.commitValue(next[0] ?? null, details.event); }}
      getItemKey={getKey}
      getItemLabel={getLabel}
      height={220}
      fullWidth
    />
  );
}

function ControlledCustomer() {
  const [value, setValue] = useState<Customer | null>(customers[0]!);
  const [open, setOpen] = useState(false);
  return (
    <>
      <CgField label="Controlled customer" description="Both the selected object and popup visibility are controlled.">
        <CgDropDownBox
          value={value}
          open={open}
          onOpenChange={setOpen}
          onValueChange={setValue}
          getDisplayText={getLabel}
          isValueEqual={sameCustomer}
          clearable
          fullWidth
        >
          {(dropDown) => <CustomerList dropDown={dropDown} />}
        </CgDropDownBox>
      </CgField>
      <output aria-label="Controlled customer code">{value?.code ?? 'None'}</output>
    </>
  );
}

function ExplicitTags() {
  return (
    <CgField label="Explicit customer set" description="Selections remain pending until Apply is activated.">
      <CgDropDownBox<ReadonlyArray<Customer>>
        defaultValue={[customers[0]!]}
        commitMode="explicit"
        getDisplayText={(value) => value.map((customer) => customer.code).join(', ')}
        isEmptyValue={(value) => !value || value.length === 0}
        isValueEqual={sameCustomers}
        serializeValue={(value) => value.map((customer) => String(customer.id))}
        name="explicitCustomerIds"
        dropDownWidthMode="contentOrEditor"
        minDropDownWidth={420}
        renderHeader={(dropDown) => <strong>{dropDown.hasPendingChanges ? 'Unapplied selection' : 'Customer selection'}</strong>}
        renderFooter={(dropDown) => (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={(event) => { void dropDown.cancel(event); }}>Cancel</button>
            <button type="button" onClick={(event) => { void dropDown.apply(event); }}>Apply</button>
          </div>
        )}
        fullWidth
      >
        {(dropDown) => (
          <CgTagBox
            aria-label="Pending customers"
            options={customers}
            value={dropDown.pendingValue ?? []}
            onValueChange={dropDown.setPendingValue}
            getOptionKey={getKey}
            getOptionLabel={getLabel}
            getOptionSearchText={getSearchText}
            closeOnSelection={false}
            style={{ width: 420, margin: 12 }}
          />
        )}
      </CgDropDownBox>
    </CgField>
  );
}

function CustomTemplates() {
  const [command, setCommand] = useState('No command');
  return (
    <>
      <CgField label="Custom display and commands">
        <CgDropDownBox
          defaultValue={customers[1]}
          getDisplayText={getLabel}
          renderDisplay={({ value }) => value ? <><strong>{value.code}</strong>&nbsp;{value.name}</> : 'No customer'}
          renderHeader={() => <strong>Customer command center</strong>}
          renderFooter={(dropDown) => <button type="button" onClick={() => { void dropDown.close(); }}>Done</button>}
          buttons={[{ key: 'inspect', text: 'Inspect', ariaLabel: 'Inspect selected customer', onPress: ({ value }) => setCommand(value ? `Inspected ${value.code}` : 'Nothing to inspect') }]}
          clearable
        >
          {(dropDown) => <CustomerList dropDown={dropDown} />}
        </CgDropDownBox>
      </CgField>
      <output aria-label="Custom command result">{command}</output>
    </>
  );
}

function AsyncLifecycle() {
  const actions = useRef<CgDropDownBoxActions>(null);
  const [log, setLog] = useState('Ready');
  const [cancelNext, setCancelNext] = useState(true);
  const append = (entry: string) => setLog((current) => `${current} → ${entry}`);
  return (
    <>
      <CgDropDownBox
        actionsRef={actions}
        defaultValue="Approval queue"
        onBeforeOpen={async ({ signal }) => {
          append('before open');
          await new Promise((resolve) => setTimeout(resolve, 180));
          if (signal.aborted) { append('stale open aborted'); return false; }
          if (cancelNext) { setCancelNext(false); append('open cancelled'); return false; }
          return true;
        }}
        onOpenChange={(open) => append(open ? 'open changed' : 'close changed')}
        onAfterOpen={() => append('after open')}
        onBeforeClose={async ({ signal }) => {
          await new Promise((resolve) => setTimeout(resolve, 120));
          return !signal.aborted;
        }}
        onAfterClose={() => append('after close')}
      >
        <button type="button">Lifecycle content</button>
      </CgDropDownBox>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => { void actions.current?.open(); }}>Request open</button>
        <button type="button" onClick={() => { void actions.current?.toggle(); }}>Toggle twice</button>
      </div>
      <output aria-label="Lifecycle log">{log}</output>
    </>
  );
}

function ExternalForm() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <>
      <form id="dropdown-external-form" onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(new FormData(event.currentTarget).getAll('customer').map(String).join(', ') || 'None');
      }} />
      <CgField label="External form customer" description="The object is serialized as its stable key; display text is not submitted.">
        <CgDropDownBox
          form="dropdown-external-form"
          name="customer"
          defaultValue={customers[0]}
          serializeValue={(customer) => String(customer.id)}
          getDisplayText={getLabel}
          isValueEqual={sameCustomer}
          required
        >
          {(dropDown) => <CustomerList dropDown={dropDown} />}
        </CgDropDownBox>
      </CgField>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" form="dropdown-external-form">Submit customer</button>
        <button type="reset" form="dropdown-external-form">Reset customer</button>
      </div>
      <output aria-label="Submitted customer key">{submitted}</output>
    </>
  );
}

function RequiredForm() {
  return (
    <form>
      <CgField label="Required dropdown customer" errorMessage="Choose a customer before submission.">
        <CgDropDownBox<Customer>
          name="requiredCustomer"
          getDisplayText={getLabel}
          serializeValue={(customer) => String(customer.id)}
          required
          validationState="error"
        >
          {(dropDown) => <CustomerList dropDown={dropDown} />}
        </CgDropDownBox>
      </CgField>
      <button type="submit">Submit required dropdown</button>
    </form>
  );
}

function NestedPopups() {
  return (
    <CgField label="Nested dropdowns">
      <CgDropDownBox defaultValue="Outer selection" popupAriaLabel="Outer dropdown content" dropDownWidth={440} dropDownWidthMode="explicit">
        <div style={{ display: 'grid', gap: 12, padding: 12 }}>
          <span>Outer hosted content remains independent.</span>
          <CgDropDownBox defaultValue="Nested selection" popupAriaLabel="Nested dropdown content" placement="right-start" dropDownWidth={260} dropDownWidthMode="explicit">
            <div style={{ padding: 16 }}>Nested hosted content</div>
          </CgDropDownBox>
        </div>
      </CgDropDownBox>
    </CgField>
  );
}

export const Default: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Customer"><CgDropDownBox defaultValue={customers[0]} getDisplayText={getLabel}>{(dropDown) => <CustomerList dropDown={dropDown} />}</CgDropDownBox></CgField></StoryFrame>,
};

export const ControlledValues: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ControlledCustomer /><CgField label="Uncontrolled numeric value"><CgDropDownBox defaultValue={0} clearable><div style={{ padding: 16 }}>Zero remains a nonempty value.</div></CgDropDownBox></CgField></StoryFrame>,
};

export const ImmediateListBoxSelection: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Immediate customer"><CgDropDownBox defaultValue={customers[0]} getDisplayText={getLabel} isValueEqual={sameCustomer} clearable fullWidth>{(dropDown) => <CustomerList dropDown={dropDown} />}</CgDropDownBox></CgField></StoryFrame>,
};

export const ExplicitTagBoxSelection: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ExplicitTags /></StoryFrame>,
};

export const CustomDisplayHeaderFooterAndButtons: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CustomTemplates /></StoryFrame>,
};

export const AsyncLifecycleCancellation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><AsyncLifecycle /></StoryFrame>,
};

export const LoadingState: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgDropDownBox aria-label="Loading dropdown" defaultOpen loading loadingMessage="Loading customer workspace…"><span>Content</span></CgDropDownBox></StoryFrame>,
};

export const EmptyState: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgDropDownBox aria-label="Empty dropdown" defaultOpen empty emptyMessage="No customer workspace is available"><span>Content</span></CgDropDownBox></StoryFrame>,
};

export const ErrorState: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgDropDownBox aria-label="Error dropdown" defaultOpen error={new Error('Demo failure')} renderError={({ error }) => <span>Unable to load: {error instanceof Error ? error.message : 'Unknown failure'}</span>}><span>Content</span></CgDropDownBox></StoryFrame>,
};

export const ExternalNativeForm: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ExternalForm /></StoryFrame>,
};

export const RequiredInvalid: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RequiredForm /></StoryFrame>,
};

export const DisabledReadOnlyAndLongContent: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgDropDownBox aria-label="Disabled dropdown" defaultValue="Disabled value" disabled>Content</CgDropDownBox><CgDropDownBox aria-label="Read only dropdown" defaultValue="Read-only value" readOnly>Content</CgDropDownBox><CgDropDownBox aria-label="Long dropdown value" defaultValue="An intentionally long legal and operational customer description that must truncate safely" style={{ width: 360 }}>Long hosted content</CgDropDownBox></StoryFrame>,
};

export const WidthResizeAndPlacement: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgDropDownBox aria-label="Content width dropdown" defaultValue="Content or editor" defaultOpen dropDownWidthMode="contentOrEditor" maxDropDownWidth={620} placement="bottom-end" allowResize minDropDownHeight={140}><div style={{ width: 480, padding: 16 }}>Resizable content-or-editor popup with a logical end placement.</div></CgDropDownBox></StoryFrame>,
};

export const NestedPopup: Story = {
  render: () => <StoryFrame source={source} difference={difference}><NestedPopups /></StoryFrame>,
};

export const NarrowViewport: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 280, maxWidth: '100%' }}><CgDropDownBox aria-label="Narrow viewport dropdown" defaultValue="Collision-aware content" defaultOpen placement="bottom-end" dropDownWidthMode="explicit" dropDownWidth={520} maxDropDownWidth="calc(100vw - 8px)" fullWidth><div style={{ padding: 20 }}>The popup flips and shifts inside a narrow visual viewport.</div></CgDropDownBox></div></StoryFrame>,
};

export const DarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Compact customer"><CgDropDownBox defaultValue={customers[1]} getDisplayText={getLabel} size="small" density="compact" defaultOpen><div style={{ padding: 16 }}>Dark compact hosted content</div></CgDropDownBox></CgField></StoryFrame>,
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="العميل"><CgDropDownBox defaultValue={customers[3]} getDisplayText={getLabel} direction="rtl" placement="bottom-start" popupAriaLabel="محتوى القائمة" clearAriaLabel="مسح العميل" toggleAriaLabel="فتح القائمة" defaultOpen>{(dropDown) => <CustomerList dropDown={dropDown} />}</CgDropDownBox></CgField></div></StoryFrame>,
};
