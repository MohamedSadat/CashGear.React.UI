import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgLookUpGrid } from '../components/LookUpGrid';
import type { CgLookUpGridColumnDescriptor } from '../components/LookUpGrid';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Components/Editors/CgLookUpGrid.razor.cs (EnableVirtualization, RowOverscan), CgLookUpGrid.razor.js and .css (7db46710 scroll fixes)';
const difference = 'React measures the row viewport with a scroll listener and ResizeObserver on the mounted grid instead of a JS module and .NET callbacks.';
const meta: Meta = { title: 'Blazor parity 2026-11/LookUpGrid virtualization', component: CgLookUpGrid, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

interface Customer { id: number; code: string; name: string; city: string }
const cities = ['Cairo', 'Giza', 'Alexandria', 'Suez', 'Luxor', 'Aswan'];
const customers: ReadonlyArray<Customer> = Array.from({ length: 600 }, (_, index) => ({
  id: index + 1, code: `C-${String(index + 1).padStart(4, '0')}`, name: `Customer ${index + 1}`, city: cities[index % cities.length]!,
}));
const columns: ReadonlyArray<CgLookUpGridColumnDescriptor<Customer>> = [
  { fieldId: 'code', title: 'Code', accessor: (item) => item.code, width: 110 },
  { fieldId: 'name', title: 'Name', accessor: (item) => item.name, width: 200 },
  { fieldId: 'city', title: 'City', accessor: (item) => item.city, width: 120 },
];

export const SixHundredCustomers: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 'min(28rem, 100%)' }}>
      <CgLookUpGrid data={customers} columns={columns} pageSize={600} valueSelector={(item) => item.id} textSelector={(item) => `${item.code} — ${item.name}`} aria-label="Customer" rowOverscan={8} />
    </div>
  </StoryFrame>,
};
