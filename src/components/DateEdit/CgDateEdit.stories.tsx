import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgDateEdit } from './CgDateEdit';
import type { CgDateEditActions, CgDateEditDayRenderContext, CgDateValue } from './CgDateEdit.types';

const source = 'CG.CompLib/Comp/Inputs/CgDateEdit.*; CG.CompLib/Comp/Inputs/CgDateEditorUtilities.cs; CG.CompLib.Demo/Components/Pages/DateEditDemo.razor';
const difference = 'React commits canonical YYYY-MM-DD strings rather than DateOnly/DateTime values. Formatting uses a documented dependency-free token grammar and Intl; the private body-portal calendar has no focus trap.';
const meta: Meta = { title: 'Phase 8/DateEdit', component: CgDateEdit, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ControlledDate() {
  const [value, setValue] = useState<CgDateValue | null>('2026-08-21');
  const [open, setOpen] = useState(false);
  return (
    <>
      <CgField label="Controlled settlement date" description="Value and popup visibility are controlled.">
        <CgDateEdit value={value} open={open} onOpenChange={setOpen} onValueChange={setValue} editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" />
      </CgField>
      <output aria-label="Controlled canonical date">{value ?? 'None'}</output>
    </>
  );
}

function ExternalForm() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <>
      <form id="date-external-form" onSubmit={(event) => {
        event.preventDefault();
        const submittedValue = new FormData(event.currentTarget).get('invoiceDate');
        setSubmitted(typeof submittedValue === 'string' ? submittedValue : 'None');
      }} />
      <CgField label="External form invoice date" description="Only the canonical civil date is submitted.">
        <CgDateEdit form="date-external-form" name="invoiceDate" defaultValue="2026-08-21" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" required />
      </CgField>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" form="date-external-form">Submit date</button>
        <button type="reset" form="date-external-form">Reset date</button>
      </div>
      <output aria-label="Submitted canonical date">{submitted}</output>
    </>
  );
}

function RejectedControlled() {
  const [attempted, setAttempted] = useState('None');
  return (
    <>
      <CgField label="Authoritative date" description="The parent records but rejects proposed dates.">
        <CgDateEdit value="2026-08-21" editFormat="yyyy-MM-dd" onValueChange={(next) => setAttempted(next ?? 'None')} />
      </CgField>
      <output aria-label="Attempted date">{attempted}</output>
    </>
  );
}

function AsyncBeforeChange() {
  const actions = useRef<CgDateEditActions>(null);
  const [value, setValue] = useState<CgDateValue | null>('2026-08-21');
  const [log, setLog] = useState('Ready');
  return (
    <>
      <CgField label="Approval date">
        <CgDateEdit
          actionsRef={actions}
          value={value}
          onValueChange={setValue}
          editFormat="yyyy-MM-dd"
          onBeforeValueChange={async ({ value: proposed, signal }) => {
            setLog(`Checking ${proposed ?? 'empty'}`);
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (signal.aborted) { setLog('Superseded'); return false; }
            if (proposed === '2026-08-23') { setLog('Cancelled by policy'); return false; }
            setLog('Accepted');
            return true;
          }}
        />
      </CgField>
      <button type="button" onClick={() => { void actions.current?.today(); }}>Select today through actions</button>
      <output aria-label="Async date log">{log}</output>
    </>
  );
}

function TodayFixture() {
  const [value, setValue] = useState<CgDateValue | null>(null);
  return (
    <>
      <CgField label="Today-enabled date"><CgDateEdit value={value} onValueChange={setValue} defaultOpen /></CgField>
      <output aria-label="Today canonical value">{value ?? 'None'}</output>
    </>
  );
}

function RequiredNativeForm() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      const submittedValue = new FormData(event.currentTarget).get('requiredDate');
      setSubmitted(typeof submittedValue === 'string' ? submittedValue : 'None');
    }}>
      <CgField label="Required native date"><CgDateEdit name="requiredDate" required editFormat="yyyy-MM-dd" /></CgField>
      <button type="submit">Submit required date</button>
      <output aria-label="Required submitted date">{submitted}</output>
    </form>
  );
}

function CustomButtonFixture() {
  const [lastCommand, setLastCommand] = useState('None');
  return (
    <>
      <CgField label="Date with custom command">
        <CgDateEdit
          defaultValue="2026-08-21"
          editFormat="yyyy-MM-dd"
          buttons={[{
            key: 'inspect',
            placement: 'start',
            text: 'Inspect',
            ariaLabel: 'Inspect current date',
            onPress: ({ value }) => setLastCommand(value ?? 'Empty'),
          }]}
        />
      </CgField>
      <output aria-label="Custom date command">{lastCommand}</output>
    </>
  );
}

const renderMarkedDay = (context: CgDateEditDayRenderContext) => (
  <span style={{ display: 'inline-grid', placeItems: 'center', gap: 1 }}>
    <span>{Number(context.date.slice(-2))}</span>
    {context.date.endsWith('-15') ? <span aria-hidden="true" style={{ inlineSize: 4, blockSize: 4, borderRadius: '50%', background: 'currentColor' }} /> : null}
  </span>
);

export const Default: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Posting date"><CgDateEdit defaultValue="2026-08-21" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" /></CgField></StoryFrame>,
};

export const ControlledAndUncontrolled: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ControlledDate /><CgField label="Uncontrolled delivery date"><CgDateEdit defaultValue="2026-09-03" editFormat="yyyy-MM-dd" /></CgField></StoryFrame>,
};

export const EmptyRequiredInvalid: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Optional empty date"><CgDateEdit placeholder="Select a date" /></CgField><CgField label="Required date" errorMessage="A date is required." required><CgDateEdit required validationState="error" /></CgField><CgField label="Invalid external date"><CgDateEdit value="2026-02-30" editFormat="yyyy-MM-dd" /></CgField></StoryFrame>,
};

export const MinMaxDisabledDates: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Restricted accounting date"><CgDateEdit defaultValue="2026-08-14" minDate="2026-08-10" maxDate="2026-08-25" isDateDisabled={(date) => date.endsWith('-15') || date.endsWith('-16')} editFormat="yyyy-MM-dd" defaultOpen /></CgField></StoryFrame>,
};

export const CustomDayContent: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Milestone date"><CgDateEdit defaultValue="2026-08-21" renderDay={renderMarkedDay} defaultOpen /></CgField></StoryFrame>,
};

export const FormatsAndLocalization: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="US locale default"><CgDateEdit defaultValue="2026-12-05" locale="en-US" /></CgField><CgField label="French month name"><CgDateEdit defaultValue="2026-12-05" locale="fr-FR" editFormat="d MMMM yyyy" /></CgField><CgField label="Quoted format literal"><CgDateEdit defaultValue="2026-12-05" locale="en-GB" editFormat="d 'of' MMMM yyyy" firstDayOfWeek="monday" /></CgField></StoryFrame>,
};

export const StatesAndCustomButtons: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CustomButtonFixture /><CgField label="Required without clear"><CgDateEdit defaultValue="2026-08-21" required /></CgField><CgField label="Clear disabled by policy"><CgDateEdit defaultValue="2026-08-21" allowClear={false} /></CgField><CgField label="Read-only date"><CgDateEdit defaultValue="2026-08-21" readOnly /></CgField><CgField label="Disabled date"><CgDateEdit defaultValue="2026-08-21" disabled /></CgField></StoryFrame>,
};

export const OpenCalendar: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Open calendar date"><CgDateEdit defaultValue="2026-08-21" editFormat="yyyy-MM-dd" defaultOpen /></CgField></StoryFrame>,
};

export const MonthYearNavigation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Calendar navigation"><CgDateEdit defaultValue="2026-08-21" defaultOpen /></CgField><small>Use the calendar heading to open the month and year panels.</small></StoryFrame>,
};

export const TodayBehavior: Story = {
  render: () => <StoryFrame source={source} difference={difference}><TodayFixture /></StoryFrame>,
};

export const DarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Compact close date"><CgDateEdit defaultValue="2026-08-21" size="small" density="compact" defaultOpen /></CgField></StoryFrame>,
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="تاريخ القيد"><CgDateEdit aria-label="تاريخ القيد" defaultValue="2026-08-21" locale="ar-EG" direction="rtl" editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" defaultOpen /></CgField></div></StoryFrame>,
};

export const NarrowLayout: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 280, maxWidth: '100%' }}><CgField label="Narrow date"><CgDateEdit defaultValue="2026-08-21" today="2026-08-26" defaultOpen fullWidth /></CgField></div></StoryFrame>,
};

export const ExternalFormBehavior: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ExternalForm /></StoryFrame>,
};

export const RequiredNativeFormValidation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RequiredNativeForm /></StoryFrame>,
};

export const RejectedControlledFixture: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RejectedControlled /></StoryFrame>,
};

export const AsyncBeforeChangeCancellation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><AsyncBeforeChange /></StoryFrame>,
};
