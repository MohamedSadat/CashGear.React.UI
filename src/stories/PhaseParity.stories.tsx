import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CgButton,
  CgCheckBox,
  CgField,
  CgIcon,
  CgLoadingPanel,
  CgMemo,
  CgNumericEdit,
  CgProgressBar,
  CgRadio,
  CgRadioGroup,
  CgSearchBox,
  CgSpinEdit,
  CgSwitch,
  CgTextBox,
} from '../index';

const meta: Meta = {
  title: 'Phase 1–2/Razor parity',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

function Frame({ source, difference, children }: { source: string; difference: string; children: ReactNode }) {
  return (
    <section style={{ display: 'grid', gap: '1rem', maxWidth: 780 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'end' }}>{children}</div>
      <small style={{ color: 'var(--cg-text-secondary)' }}><strong>Razor:</strong> {source}<br /><strong>Known difference:</strong> {difference}</small>
    </section>
  );
}
const docs = (source: string, difference: string) => ({ docs: { description: { story: `Razor source/demo: \`${source}\`. Known difference: ${difference}` } } });

export const Icon: Story = {
  parameters: docs('CG.CompLib: no source; React-only', 'A typed, deliberately small inline-SVG registry.'),
  render: () => <Frame source="No Razor component" difference="New React implementation."><CgIcon name="search" label="Search" size={28} /><CgIcon name="check" size={28} /><span dir="rtl"><CgIcon name="chevron-end" label="Logical next" size={28} /></span></Frame>,
};

export const Button: Story = {
  parameters: docs('Comp/Buttons/CgButton.*; CG.CompLib.Demo/Components/Pages/ButtonDemo.razor', 'Visible is omitted; React callers conditionally render.'),
  render: () => <Frame source="Comp/Buttons/CgButton.* → ButtonDemo.razor" difference="Visible is intentionally omitted."><CgButton intent="primary" icon="check">Save</CgButton><CgButton intent="danger" appearance="outline">Delete a very long record name</CgButton><CgButton size="small" disabled>Disabled</CgButton><CgButton loading loadingContent="جارٍ الحفظ">حفظ</CgButton></Frame>,
};

function FieldDemo() { const [value, setValue] = useState(''); return <Frame source="Comp/FormLayout/CgFormLayoutItem.* + Comp/Inputs/CgInputBase.cs" difference="React context supplies ARIA without cloning the child."><CgField label="Account code" description="Used by the general ledger" required errorMessage={value ? undefined : 'Required'}><CgTextBox value={value} onValueChange={setValue} /></CgField><CgField label="Read-only"><CgTextBox value="1000-CASH" readOnly /></CgField></Frame>; }
export const Field: Story = { parameters: docs('Comp/FormLayout/CgFormLayoutItem.* + Comp/Inputs/CgInputBase.cs', 'New React composition foundation.'), render: () => <FieldDemo /> };

function TextBoxDemo() { const [value, setValue] = useState('Controlled'); return <Frame source="Comp/Inputs/CgTextBox.* → TextBoxDemo.razor" difference="Labels and messages are composed with CgField."><CgField label="Controlled"><CgTextBox value={value} onValueChange={setValue} clearButton="auto" buttons={[{ key: 'check', icon: 'check', ariaLabel: 'Validate' }]} /></CgField><CgField label="Uncontrolled password"><CgTextBox defaultValue="secret" type="password" passwordReveal /></CgField><CgField label="بند عربي" errorMessage="القيمة مطلوبة" required><CgTextBox dir="rtl" placeholder="أدخل القيمة" /></CgField></Frame>; }
export const TextBox: Story = { parameters: docs('Comp/Inputs/CgTextBox.*; CG.CompLib.Demo/Components/Pages/TextBoxDemo.razor', 'CgField owns label/message composition.'), render: () => <TextBoxDemo /> };

function MemoDemo() { const [value, setValue] = useState('Line one'); return <Frame source="Comp/Inputs/CgMemo.* → MemoDemo.razor" difference="Native textarea resize replaces DevExpress behavior."><CgField label="Auto memo"><CgMemo value={value} onValueChange={setValue} resizeMode="auto" maxRows={6} maxLength={120} showCounter clearButton="auto" /></CgField><CgField label="Read-only long content"><CgMemo readOnly defaultValue={'A long line of content. '.repeat(8)} /></CgField></Frame>; }
export const Memo: Story = { parameters: docs('Comp/Inputs/CgMemo.*; CG.CompLib.Demo/Components/Pages/MemoDemo.razor', 'Uses native textarea and ResizeObserver.'), render: () => <MemoDemo /> };

function CheckBoxDemo() { const [state, setState] = useState<boolean | 'indeterminate'>('indeterminate'); return <Frame source="Comp/Inputs/CgCheckBox.* → CheckBoxDemo.razor" difference="Numeric/string mappings are omitted."><CgCheckBox checked={state} onCheckedChange={setState} cycleIndeterminate label="Controlled three-state" description="Cycles mixed, checked, unchecked" /><CgCheckBox defaultChecked label="Uncontrolled" /><CgCheckBox label="Invalid required" required validationState="error" /><CgCheckBox label="Disabled" disabled /></Frame>; }
export const CheckBox: Story = { parameters: docs('Comp/Inputs/CgCheckBox.*; CG.CompLib.Demo/Components/Pages/CheckBoxDemo.razor', 'Idiomatic boolean/mixed model only.'), render: () => <CheckBoxDemo /> };

function SwitchDemo() { const [checked, setChecked] = useState(true); return <Frame source="Comp/Inputs/CgCheckBox.* (switch mode) → CheckBoxDemo.razor" difference="Extracted as a separate two-state component; no pending state."><CgSwitch checked={checked} onCheckedChange={setChecked} label="Controlled switch" /><CgSwitch label="Uncontrolled" /><CgSwitch defaultChecked readOnly label="Read-only" /><CgSwitch disabled label="Disabled" /></Frame>; }
export const Switch: Story = { parameters: docs('Comp/Inputs/CgCheckBox.* switch mode', 'Separate React component; source has no pending state.'), render: () => <SwitchDemo /> };

export const Radio: Story = {
  parameters: docs('Comp/Inputs/CgRadio.*; CG.CompLib.Demo/Components/Pages/RadioDemo.razor', 'String/number values are native; read-only suppresses activation.'),
  render: () => <Frame source="Comp/Inputs/CgRadio.* → RadioDemo.razor" difference="React uses typed string/number values."><CgRadio name="demo" value="standard" label="Standard" defaultChecked /><CgRadio name="demo" value="express" label="Express" description="Next working day" /><CgRadio name="demo" value="disabled" label="Disabled" disabled /></Frame>,
};

function RadioGroupDemo() { const [value, setValue] = useState<number | undefined>(1); return <Frame source="Comp/Inputs/CgRadioGroup.* → RadioDemo.razor" difference="Options replace reflection-based field-name mapping."><CgRadioGroup legend="Controlled priority" value={value} onValueChange={setValue} required orientation="horizontal" options={[{ value: 1, label: 'Low' }, { value: 2, label: 'Normal' }, { value: 3, label: 'High', disabled: true }]} /><div dir="rtl"><CgRadioGroup legend="طريقة الشحن" defaultValue="sea" options={[{ value: 'sea', label: 'بحري' }, { value: 'air', label: 'جوي' }]} /></div></Frame>; }
export const RadioGroup: Story = { parameters: docs('Comp/Inputs/CgRadioGroup.*; CG.CompLib.Demo/Components/Pages/RadioDemo.razor', 'React options; no reflection mapping.'), render: () => <RadioGroupDemo /> };

function NumericDemo() { const [value, setValue] = useState<number | null>(1234.5); return <Frame source="Comp/Inputs/CgNumberInput.* + CgSpinEdit.*" difference="New number|null editor; IEEE-754 limits apply."><CgField label="Controlled EGP"><CgNumericEdit value={value} onValueChange={setValue} locale="ar-EG" formatStyle="currency" currency="EGP" precision={2} min={0} /></CgField><CgField label="Empty nullable"><CgNumericEdit defaultValue={null} /></CgField><CgField label="Invalid" errorMessage="Outside approved range"><CgNumericEdit defaultValue={150} max={100} /></CgField></Frame>; }
export const NumericEdit: Story = { parameters: docs('Comp/Inputs/CgNumberInput.* and CgSpinEdit.*', 'New React implementation with number|null and IEEE-754 arithmetic.'), render: () => <NumericDemo /> };

function SpinDemo() { const [value, setValue] = useState<number | null>(null); return <Frame source="Comp/Inputs/CgSpinEdit.* → SpinEditDemo.razor" difference="Press-and-hold is deferred."><CgField label="Controlled quantity"><CgSpinEdit value={value} onValueChange={setValue} min={5} max={50} step={5} pageStep={20} /></CgField><CgField label="Read-only"><CgSpinEdit defaultValue={10} readOnly /></CgField></Frame>; }
export const SpinEdit: Story = { parameters: docs('Comp/Inputs/CgSpinEdit.*; CG.CompLib.Demo/Components/Pages/SpinEditDemo.razor', 'No press-and-hold in Phase 2.'), render: () => <SpinDemo /> };

function SearchDemo() { const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); return <Frame source="Working-tree Comp/Inputs/CgSearchBox.* → SearchBoxDemo.razor" difference="No data fetching; AbortSignal and request ids are passed to the caller."><CgField label="Controlled async search"><CgSearchBox query={query} onQueryChange={setQuery} resultStatus={status} onSearch={async (next, { signal }) => { await new Promise((resolve) => setTimeout(resolve, 400)); if (!signal.aborted) setStatus(`${next}: 3 results`); }} /></CgField><CgField label="بحث عربي"><CgSearchBox dir="rtl" defaultQuery="" searchMode="submit" minimumLength={2} placeholder="ابحث" /></CgField></Frame>; }
export const SearchBox: Story = { parameters: docs('Current working tree Comp/Inputs/CgSearchBox.*; CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor', 'No fetching; includes stale-generation protection from the uncommitted Razor fix.'), render: () => <SearchDemo /> };

function LoadingDemo() { const [visible, setVisible] = useState(true); return <Frame source="Comp/Overlays/CgLoadingPanel.* → LoadingPanelDemo.razor" difference="No focus trap; external targets must provide a positioning context."><CgLoadingPanel visible={visible} onVisibleChange={setVisible} mode="overlay" dismissOnClick dismissOnEscape text="Loading orders…"><div style={{ width: 320, height: 120, padding: 16, border: '1px solid var(--cg-border)' }}>Blocked content</div></CgLoadingPanel><CgLoadingPanel visible mode="inline" indicator="dots" text="جارٍ التحميل" /></Frame>; }
export const LoadingPanel: Story = { parameters: docs('Comp/Overlays/CgLoadingPanel.*; CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor', 'No focus trap by design.'), render: () => <LoadingDemo /> };

export const ProgressBar: Story = {
  parameters: docs('CG.CompLib: no source', 'New React implementation.'),
  render: () => <Frame source="No Razor component" difference="New React implementation."><div style={{ width: 320 }}><CgProgressBar value={68} showLabel /><br /><CgProgressBar intent="success" value={100} label="Complete" /><br /><CgProgressBar label="Loading inventory" /></div></Frame>,
};
