import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { CgComboBox } from '../components/ComboBox';
import { CgField } from '../components/Field';
import { CgKeyComboBox } from '../components/KeyComboBox';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Editors: CgComboBox.razor.cs (CustomItemFactory, CustomItemText, TryCommitTypedText, ResolveUnambiguousMatch)';
const difference = 'CustomItemFactory becomes customItemFactory and returns null to refuse; CustomItemText becomes customItemText or the text provider.';
const meta: Meta = { title: 'Blazor parity 2026-11/ComboBox free text', component: CgComboBox, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Unit { code: string; name: string }
const units: Unit[] = [{ code: 'A10', name: 'A10' }, { code: 'BOX', name: 'Box' }, { code: 'PCS', name: 'Pieces' }, { code: 'KG', name: 'Kilogram' }];
const toUnit = (text: string): Unit => ({ code: text.toUpperCase(), name: text });

function FreeTextDemo() {
  const [unit, setUnit] = useState<Unit | null>(null);
  const [code, setCode] = useState<string | null>('KG');
  return <div style={{ display: 'grid', gap: 12, maxInlineSize: '22rem' }}>
    <CgField label="Unit (type A1, then Enter)" description={`Committed: ${unit ? `${unit.code} / ${unit.name}` : 'none'}`}>
      <CgComboBox<Unit> options={units} getOptionKey={(item) => item.code} getOptionLabel={(item) => item.name} value={unit} onValueChange={setUnit} customItemFactory={toUnit} clearable />
    </CgField>
    <CgField label="Unit code (key editor)" description={`Key: ${code ?? 'none'}`}>
      <CgKeyComboBox<Unit, string> options={units} getOptionKey={(item) => item.code} getOptionLabel={(item) => item.name} value={code} onValueChange={setCode} customItemFactory={toUnit} />
    </CgField>
  </div>;
}

export const FreeText: Story = { render: () => <StoryFrame source={source} difference={difference}><FreeTextDemo /></StoryFrame> };

export const ArabicHint: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div dir="rtl" style={{ maxInlineSize: '22rem' }}>
      <CgField label="الوحدة"><CgComboBox<Unit> options={units} getOptionKey={(item) => item.code} getOptionLabel={(item) => item.name} customItemFactory={toUnit} customItemText={'اضغط Enter لاستخدام "{0}".'} /></CgField>
    </div>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};
