import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField, CgKeyTagBox, CgListBox } from '../index';

const accounts = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, name: `Account ${index + 1}`, group: index % 2 ? 'Expense' : 'Revenue' }));
const key = (item: typeof accounts[number]) => item.id;
const label = (item: typeof accounts[number]) => item.name;
const resolve = (id: number) => Promise.resolve(accounts.find((item) => item.id === id));
function Demo() {
  const [keys, setKeys] = useState<readonly number[]>([1, 2001]);
  const [selection, setSelection] = useState<readonly typeof accounts[number][]>([]);
  return <main style={{ maxWidth: 640, display: 'grid', gap: 16, padding: 24 }}>
    <h1 style={{ fontSize: 24, margin: 0 }}>Guarded account selection</h1>
    <p>Account 2 is protected. Missing keys retain their labels until resolved.</p>
    <CgField label="Account keys"><CgKeyTagBox options={accounts} value={keys} onValueChange={setKeys} getOptionKey={key} getOptionLabel={label} itemResolver={resolve} getFallbackLabel={(id) => `Unavailable ${id}`} fullWidth /></CgField>
    <output aria-label="Selected keys">{keys.join(', ') || 'None'}</output>
    <CgListBox aria-label="Accounts" items={accounts} value={selection} onValueChange={setSelection} getItemKey={key} getItemLabel={label}
      selectionMode="multiple" showCheckboxes searchable searchCondition="equals" searchParseMode="exact" getItemGroupKey={(item) => item.group}
      renderMode="virtual" height={240} itemSize={40} fullWidth
      onBeforeSelectionChange={async ({ proposedValue, signal }) => {
        await new Promise((done) => setTimeout(done, 80));
        return !signal.aborted && !proposedValue.some((item) => item.id === 2);
      }} />
    <output aria-label="Guarded selection">{selection.map(label).join(', ') || 'None'}</output>
  </main>;
}
const meta = { title: 'Phase 28/Selection', component: Demo } satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;
export const GuardedSelection: Story = {};
