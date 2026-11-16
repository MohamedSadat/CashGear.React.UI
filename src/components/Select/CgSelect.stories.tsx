import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgField } from '../Field';
import { CgSelect } from './CgSelect';
import type { CgSelectOption } from './CgSelect.types';

const source = 'None: React only (Cash Gear Workspace, a single choice without filtering)';
const difference = 'The browser\'s select, drawn and labelled as the library\'s fields; CgComboBox is the control that filters.';
const meta = { title: 'Phase 37/Select', component: CgSelect, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

const types: CgSelectOption[] = [
  { value: 'text', label: 'نص', group: 'أساسي' },
  { value: 'number', label: 'رقم', group: 'أساسي' },
  { value: 'date', label: 'تاريخ', group: 'أساسي' },
  { value: 'select', label: 'اختيار', group: 'أساسي' },
  { value: 'relation', label: 'علاقة', group: 'متقدم' },
  { value: 'formula', label: 'معادلة (قريباً)', group: 'متقدم', disabled: true },
];

function Fields() {
  const [value, setValue] = useState<string | null>(null);
  return <div style={{ display: 'grid', gap: 16, inlineSize: 'min(22rem, 100%)' }} data-testid="select-demo">
    <CgField label="نوع الخاصية" description="يحدد ما تحمله الخلايا" required validationState={value === null ? 'error' : 'none'} validationMessage={value === null ? 'اختر نوعاً' : undefined}>
      <CgSelect options={types} placeholder="اختر نوعاً" value={value} onValueChange={setValue} fullWidth />
    </CgField>
    <CgField label="الحجم الصغير"><CgSelect options={types} defaultValue="date" size="small" /></CgField>
    <CgField label="للقراءة فقط"><CgSelect options={types} defaultValue="number" readOnly /></CgField>
    <CgField label="معطّل"><CgSelect options={types} defaultValue="text" disabled /></CgField>
    <output data-testid="select-value">{value ?? 'لا شيء'}</output>
  </div>;
}

export const Default: Story = { args: { options: types }, render: () => <StoryFrame source={source} difference={difference}><Fields /></StoryFrame>, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { options: types }, render: () => <StoryFrame source={source} difference={difference}><Fields /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const LeftToRight: Story = {
  args: { options: types },
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Property type"><CgSelect options={[{ value: 'text', label: 'Text' }, { value: 'number', label: 'Number' }, { value: 'date', label: 'Date' }]} placeholder="Choose a type" /></CgField></StoryFrame>,
};
