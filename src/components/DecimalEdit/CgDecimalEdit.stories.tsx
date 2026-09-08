import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgDecimalEdit } from './CgDecimalEdit';
import { CgField } from '../Field';
import { normalizeCgDecimalValue } from '../RangeSelector';
import type { CgDecimalValue } from '../RangeSelector';

function Demo() {
  const [value, setValue] = useState<CgDecimalValue | null>(normalizeCgDecimalValue('9007199254740993.01'));
  return <main style={{ display: 'grid', gap: 16, maxWidth: 520, padding: 24 }}>
    <h1 style={{ fontSize: 24, margin: 0 }}>Exact decimal entry</h1>
    <CgField label="Exact amount"><CgDecimalEdit value={value} onValueChange={setValue} allowExpressions precision={2} step={normalizeCgDecimalValue('0.01')} fullWidth /></CgField>
    <output aria-label="Canonical decimal">{value ?? 'Empty'}</output>
    <CgField label="Bounded amount"><CgDecimalEdit rangeBehavior="reject" min={normalizeCgDecimalValue('0')} max={normalizeCgDecimalValue('100')} defaultValue={normalizeCgDecimalValue('50')} fullWidth /></CgField>
    <CgField label="المبلغ"><CgDecimalEdit locale="ar-EG" dir="rtl" formatStyle="currency" currency="EGP" defaultValue={normalizeCgDecimalValue('1234.56')} fullWidth /></CgField>
  </main>;
}
const meta = { title: 'Phase 27/Decimal Edit', component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ExactArithmetic: Story = {};
