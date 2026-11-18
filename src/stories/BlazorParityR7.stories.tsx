import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgDateEdit } from '../components/DateEdit';
import { CgField } from '../components/Field';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Editors: CgDateEdit.razor.js (DateMaskEditor), CgDateMaskLayout.cs, CgDateEdit.md "Typing", "Native picker", "Scroll picker", CgDateEditTypes.cs';
const difference = 'The mask engine runs in the component; PickerDisplayMode becomes pickerDisplayMode, ScrollPickerFormat scrollPickerFormat.';
const meta: Meta = { title: 'Blazor parity 2026-11/DateEdit typing and pickers', component: CgDateEdit, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

export const TypingMask: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 12, maxInlineSize: '22rem' }}>
      <CgField label="Posting date (type 15082026, or paste 2026-08-15)"><CgDateEdit editFormat="dd/MM/yyyy" displayFormat="d MMMM yyyy" locale="en-GB" today="2026-11-18" /></CgField>
      <CgField label="Month name mask (type 15 then au)"><CgDateEdit editFormat="dd MMMM yyyy" locale="en-GB" today="2026-11-18" /></CgField>
    </div>
  </StoryFrame>,
};

export const ScrollPicker: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ maxInlineSize: '22rem' }}>
      <CgField label="Visit date"><CgDateEdit pickerDisplayMode="scrollPicker" scrollPickerFormat="dd MMMM yyyy" editFormat="dd/MM/yyyy" locale="en-GB" defaultValue="2026-11-18" today="2026-11-18"
        isDateDisabled={(date) => new Date(`${date}T00:00:00Z`).getUTCDay() === 5} disabledDateNotificationText="Closed on Fridays." /></CgField>
    </div>
  </StoryFrame>,
};

export const NativePickerOnTouch: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ maxInlineSize: '22rem' }}>
      <CgField label="Birthday (the OS picker opens on touch devices)"><CgDateEdit pickerDisplayMode="native" editFormat="dd/MM/yyyy" minDate="1940-01-01" maxDate="2026-11-18" /></CgField>
    </div>
  </StoryFrame>,
};

export const ArabicTyping: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div dir="rtl" style={{ maxInlineSize: '22rem' }}>
      <CgField label="تاريخ القيد"><CgDateEdit locale="ar-EG" editFormat="dd/MM/yyyy" today="2026-11-18" /></CgField>
    </div>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
