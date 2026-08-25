import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgListBox } from './CgListBox';
import type { CgListBoxColumn } from './CgListBox.types';

interface Warehouse {
  id: number;
  code: string;
  name: string;
  site: string;
  disabled?: boolean;
}

const warehouses: Warehouse[] = [
  { id: 1, code: 'CAI-01', name: 'Cairo Main Distribution Center', site: 'Cairo' },
  { id: 2, code: 'CAI-02', name: 'Cairo Reserve', site: 'Cairo', disabled: true },
  { id: 3, code: 'GIZ-01', name: 'Giza Main', site: 'Giza' },
  { id: 4, code: 'ALX-01', name: 'Alexandria Port', site: 'Alexandria' },
  { id: 5, code: 'ASW-01', name: 'Aswan South', site: 'Aswan' },
  { id: 6, code: 'AR-01', name: 'أَحْمَد للتجارة', site: 'القاهرة' },
];
const virtualWarehouses: Warehouse[] = Array.from({ length: 1_000 }, (_, index) => ({
  id: index + 1,
  code: `WH-${String(index + 1).padStart(4, '0')}`,
  name: `Warehouse ${index + 1}`,
  site: `Region ${Math.floor(index / 100) + 1}`,
}));
const getKey = (item: Warehouse) => item.id;
const getLabel = (item: Warehouse) => `${item.code} - ${item.name}`;
const getSearchText = (item: Warehouse) => `${item.code} ${item.name} ${item.site}`;
const source = 'CG.CompLib/Comp/Inputs/CgListBox.*; CG.CompLib.Demo/Components/Pages/ListBoxDemo.razor';
const difference = 'React binds object arrays by stable key and uses a dependency-free fixed-row virtualizer; remote loading, nested groups, sorting, resizing, editing, summaries, and export remain deferred.';
const meta: Meta = { title: 'Phase 4/ListBox', component: CgListBox, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const columns: ReadonlyArray<CgListBoxColumn<Warehouse>> = [
  { key: 'code', header: 'Code', getValue: (item) => item.code, width: 110 },
  { key: 'name', header: 'Warehouse', getValue: (item) => item.name, minWidth: 220 },
  { key: 'site', header: 'Site', getValue: (item) => item.site, width: 130, alignment: 'end' },
];

function ControlledSelection() {
  const [value, setValue] = useState<ReadonlyArray<Warehouse>>([warehouses[0]!, warehouses[3]!]);
  return (
    <>
      <CgField label="Controlled warehouses" description="Ctrl/Meta toggles; Shift extends the range.">
        <CgListBox items={warehouses} value={value} onValueChange={setValue} getItemKey={getKey} getItemLabel={getLabel} isItemDisabled={(item) => Boolean(item.disabled)} selectionMode="multiple" height={260} fullWidth />
      </CgField>
      <output aria-label="Selected warehouse codes">{value.map((item) => item.code).join(', ') || 'None'}</output>
    </>
  );
}

function NativeFormExample() {
  const [submitted, setSubmitted] = useState('Not submitted');
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      setSubmitted(new FormData(event.currentTarget).getAll('warehouseIds').map((entry) => typeof entry === 'string' ? entry : entry.name).join(', ') || 'None');
    }}>
      <CgField label="Form warehouses" description="The selected stable keys are submitted through a native multi-select proxy.">
        <CgListBox items={warehouses} defaultValue={[warehouses[0]!]} getItemKey={getKey} getItemLabel={getLabel} name="warehouseIds" selectionMode="multiple" showCheckboxes required height={220} />
      </CgField>
      <div style={{ display: 'flex', gap: 8, marginBlockStart: 12 }}>
        <button type="submit">Submit selection</button>
        <button type="reset">Reset selection</button>
      </div>
      <output aria-label="Submitted warehouse keys">{submitted}</output>
    </form>
  );
}

function RequiredNativeFormExample() {
  return (
    <form>
      <CgField label="Required form warehouses" description="Submitting an empty required list focuses the visible listbox.">
        <CgListBox items={warehouses} getItemKey={getKey} getItemLabel={getLabel} name="requiredWarehouseIds" selectionMode="multiple" required height={220} />
      </CgField>
      <button type="submit">Submit required list</button>
    </form>
  );
}

export const Default: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Warehouse"><CgListBox items={warehouses} defaultValue={[warehouses[0]!]} getItemKey={getKey} getItemLabel={getLabel} height={250} /></CgField></StoryFrame>,
};

export const ControlledAndUncontrolled: Story = {
  render: () => <StoryFrame source={source} difference={difference}><ControlledSelection /><CgField label="Uncontrolled warehouse"><CgListBox items={warehouses} defaultValue={[warehouses[2]!]} getItemKey={getKey} getItemLabel={getLabel} height={260} /></CgField></StoryFrame>,
};

export const CheckboxesAndFilteredSelectAll: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Filtered warehouse selection"><CgListBox items={warehouses} defaultValue={[warehouses[3]!]} getItemKey={getKey} getItemLabel={getLabel} getItemSearchText={getSearchText} isItemDisabled={(item) => Boolean(item.disabled)} selectionMode="multiple" showCheckboxes showSelectAll searchable defaultSearchQuery="Cairo" height={260} fullWidth /></CgField></StoryFrame>,
};

export const SearchAndHighlighting: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgField label="Search warehouses"><CgListBox items={warehouses} getItemKey={getKey} getItemLabel={getLabel} getItemSearchText={getSearchText} searchable defaultSearchQuery="Cairo Main" searchParseMode="allWords" searchCondition="contains" height={250} /></CgField></StoryFrame>,
};

export const ColumnsGroupsAndTemplates: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Warehouse columns and groups" items={warehouses} getItemKey={getKey} getItemLabel={getLabel} columns={columns} getItemGroupKey={(item) => item.site} getGroupLabel={(site) => `Site: ${site}`} renderGroupHeader={({ label, visibleItems }) => <><strong>{label}</strong><span>{visibleItems.length} row(s)</span></>} selectionMode="multiple" showCheckboxes height={360} fullWidth /><CgListBox aria-label="Warehouse row template" items={warehouses.slice(0, 3)} getItemKey={getKey} getItemLabel={getLabel} renderItem={({ item, highlightedLabel }) => <span><strong>{item.code}</strong><br /><small>{highlightedLabel.map((part) => part.text).join('')} · {item.site}</small></span>} renderMode="entire" /></StoryFrame>,
};

export const VirtualLargeData: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Virtual warehouses" items={virtualWarehouses} getItemKey={getKey} getItemLabel={getLabel} columns={columns} renderMode="virtual" itemSize={40} overscanCount={4} height={320} selectionMode="multiple" showCheckboxes fullWidth /></StoryFrame>,
};

export const LoadingEmptyAndNoResults: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Loading warehouses" items={warehouses} getItemKey={getKey} getItemLabel={getLabel} loading /><CgListBox aria-label="Empty warehouses" items={[]} getItemKey={getKey} getItemLabel={getLabel} emptyMessage="No warehouses loaded" /><CgListBox aria-label="No warehouse results" items={warehouses} getItemKey={getKey} getItemLabel={getLabel} searchable searchQuery="not-found" noResultsMessage="No warehouses match this search" /></StoryFrame>,
};

export const StatesSizesAndValidation: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Disabled warehouses" items={warehouses} defaultValue={[warehouses[0]!]} getItemKey={getKey} getItemLabel={getLabel} disabled size="small" /><CgListBox aria-label="Read only warehouses" items={warehouses} defaultValue={[warehouses[2]!]} getItemKey={getKey} getItemLabel={getLabel} readOnly /><CgField label="Required warehouse" errorMessage="Select at least one warehouse."><CgListBox items={warehouses} getItemKey={getKey} getItemLabel={getLabel} required validationState="error" size="large" /></CgField></StoryFrame>,
};

export const KeyboardAndLongContent: Story = {
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Keyboard warehouses" items={[...warehouses, { id: 7, code: 'LONG-01', name: 'A warehouse with an intentionally long legal and operational name for overflow testing', site: 'New Cairo' }]} getItemKey={getKey} getItemLabel={getLabel} selectionMode="multiple" height={260} style={{ width: 420 }} /><small>Use Arrow keys, Page Up/Down, Home/End, Space/Enter, Ctrl/Meta+A, Shift ranges, and Escape.</small></StoryFrame>,
};

export const NativeForms: Story = {
  render: () => <StoryFrame source={source} difference={difference}><NativeFormExample /></StoryFrame>,
};

export const RequiredNativeForm: Story = {
  render: () => <StoryFrame source={source} difference={difference}><RequiredNativeFormExample /></StoryFrame>,
};

export const DarkCompact: Story = {
  globals: { theme: 'dark', density: 'compact' },
  render: () => <StoryFrame source={source} difference={difference}><CgListBox aria-label="Compact warehouse list" items={warehouses} defaultValue={[warehouses[0]!, warehouses[2]!]} getItemKey={getKey} getItemLabel={getLabel} selectionMode="multiple" showCheckboxes size="small" height={220} /></StoryFrame>,
};

export const ArabicRtl: Story = {
  globals: { direction: 'rtl' },
  render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgField label="المستودعات"><CgListBox items={warehouses} defaultValue={[warehouses[5]!]} getItemKey={getKey} getItemLabel={getLabel} getItemSearchText={getSearchText} selectionMode="multiple" showCheckboxes showSelectAll selectAllText="تحديد الكل" selectAllAriaLabel="تحديد كل العناصر الظاهرة" searchable defaultSearchQuery="احمد" searchPlaceholder="ابحث في المستودعات" searchAriaLabel="بحث المستودعات" resultsCountMessage={(count) => `${count} عنصر`} selectedCountMessage={(count) => `${count} محدد`} locale="ar-EG" direction="rtl" height={260} /></CgField></div></StoryFrame>,
};
