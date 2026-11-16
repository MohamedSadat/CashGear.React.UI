import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgAvatar } from '../Avatar';
import { CgItemPicker } from './CgItemPicker';
import { CgOptionPicker } from './CgOptionPicker';
import type { CgOptionPickerColour, CgOptionPickerLabels, CgOptionPickerOption } from './CgOptionPicker.types';

const source = 'None: React only (Cash Gear Workspace Track U9, the option and list pickers)';
const difference = 'Tag boxes for a document database: creatable options managed in place, and chips over results the caller finds.';
const meta = { title: 'Phase 37/OptionPicker', component: CgOptionPicker, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgOptionPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const labels: CgOptionPickerLabels = {
  search: 'ابحث أو أنشئ خياراً',
  searchOnly: 'ابحث في الخيارات',
  list: 'الخيارات',
  create: (name) => `إنشاء «${name}»`,
  noMatch: 'لا خيار مطابق',
  none: 'لا خيارات بعد',
  optionMenu: (name) => `خيارات «${name}»`,
  drag: (name) => `نقل «${name}»`,
  remove: (name) => `إزالة «${name}»`,
  back: 'رجوع',
  name: 'اسم الخيار',
  colour: 'اللون',
  group: 'المجموعة',
  delete: 'حذف الخيار',
  moved: (name, to, count) => `نُقل «${name}» إلى ${to + 1} من ${count}`,
};
const colours: CgOptionPickerColour[] = [
  { key: 'gray', label: 'رمادي', background: 'color-mix(in srgb, var(--cg-text-secondary) 18%, var(--cg-surface))' },
  { key: 'blue', label: 'أزرق', background: 'var(--cg-info-soft)', text: 'var(--cg-info-text)' },
  { key: 'green', label: 'أخضر', background: 'var(--cg-success-soft)', text: 'var(--cg-success-text)' },
  { key: 'yellow', label: 'أصفر', background: 'var(--cg-warning-soft)', text: 'var(--cg-warning-text)' },
  { key: 'red', label: 'أحمر', background: 'var(--cg-danger-soft)', text: 'var(--cg-danger-text)' },
];
const statusGroups = [{ key: 'todo', label: 'للتنفيذ' }, { key: 'doing', label: 'قيد التنفيذ' }, { key: 'done', label: 'مكتمل' }];

function Picker({ grouped, multiple, initial }: { grouped: boolean; multiple: boolean; initial: CgOptionPickerOption[] }) {
  const [options, setOptions] = useState(initial);
  const [selected, setSelected] = useState<string[]>([initial[1]!.key]);
  return <div style={{ inlineSize: '20rem', border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>
    <CgOptionPicker options={options} selected={selected} multiple={multiple} canManage colours={colours} groups={grouped ? statusGroups : undefined} labels={labels} onSelectionChange={setSelected} onOptionsChange={setOptions} />
    <output data-testid="picked" style={{ display: 'block', padding: 8 }}>{selected.map((key) => options.find((option) => option.key === key)?.name).join('، ')}</output>
  </div>;
}

const tags: CgOptionPickerOption[] = [
  { key: 't1', name: 'عاجل', colour: 'red' },
  { key: 't2', name: 'مالية', colour: 'blue' },
  { key: 't3', name: 'مراجعة', colour: 'yellow' },
  { key: 't4', name: 'Design', colour: 'green' },
];
const statuses: CgOptionPickerOption[] = [
  { key: 's1', name: 'لم يبدأ', colour: 'gray', group: 'todo' },
  { key: 's2', name: 'قيد العمل', colour: 'blue', group: 'doing' },
  { key: 's3', name: 'بانتظار المراجعة', colour: 'yellow', group: 'doing' },
  { key: 's4', name: 'تم', colour: 'green', group: 'done' },
];

const people = [{ key: 'u1', label: 'ليلى حسن', color: '#1d4ed8' }, { key: 'u2', label: 'سامي يوسف', color: '#067647' }, { key: 'u3', label: 'نور الهدى', color: '#7c3aed' }, { key: 'u4', label: 'Ada Lovelace', color: '#b42318' }];
function People() {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(['u1']);
  const results = people.filter((person) => person.label.toLowerCase().includes(query.trim().toLowerCase()));
  const face = (key: string) => people.find((person) => person.key === key);
  return <div style={{ inlineSize: '20rem', border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>
    <CgItemPicker
      items={results.map((person) => ({ key: person.key, label: person.label, content: <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}><CgAvatar name={person.label} color={person.color} size="tiny" decorative /><span dir="auto">{person.label}</span></span> }))}
      selected={selected}
      multiple
      onSelectionChange={setSelected}
      chip={(key) => ({ label: face(key)?.label ?? 'عضو سابق', content: <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}><CgAvatar name={face(key)?.label ?? 'عضو سابق'} color={face(key)?.color} size="tiny" decorative /><span dir="auto">{face(key)?.label ?? 'عضو سابق'}</span></span> })}
      query={query}
      onQueryChange={setQuery}
      searchLabel="ابحث عن شخص"
      listLabel="الأعضاء"
      emptyText="لا أحد بهذا الاسم"
      removeLabel={(label) => `إزالة ${label}`}
      note="يظهر أعضاء مساحة العمل فقط"
    />
  </div>;
}

export const Tags: Story = { args: { options: [], selected: [], labels }, render: () => <StoryFrame source={source} difference={difference}><Picker grouped={false} multiple initial={tags} /></StoryFrame>, globals: { direction: 'rtl' } };
export const StatusGroups: Story = { args: { options: [], selected: [], labels }, render: () => <StoryFrame source={source} difference={difference}><Picker grouped multiple={false} initial={statuses} /></StoryFrame>, globals: { direction: 'rtl' } };
export const StatusGroupsDark: Story = { args: { options: [], selected: [], labels }, render: () => <StoryFrame source={source} difference={difference}><Picker grouped multiple={false} initial={statuses} /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const PeopleResults: Story = { args: { options: [], selected: [], labels }, render: () => <StoryFrame source={source} difference={difference}><People /></StoryFrame>, globals: { direction: 'rtl' } };
