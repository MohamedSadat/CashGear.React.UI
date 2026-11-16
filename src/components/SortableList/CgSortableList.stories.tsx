import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgIcon } from '../Icon';
import { CgSwitch } from '../Switch';
import { CgSortableList } from './CgSortableList';
import type { CgIconName } from '../../types';

const source = 'None: React only (Cash Gear Workspace Track U11, the options, sorts and properties lists)';
const difference = 'A handle drags a row with a drop line, or moves it with the arrows, Home and End; one call per move.';
const meta = { title: 'Phase 37/SortableList', component: CgSortableList, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSortableList>;
export default meta;
type Story = StoryObj<typeof meta>;

interface Prop { id: string; name: string; icon: CgIconName; shown: boolean }
const initial: Prop[] = [
  { id: 'title', name: 'العنوان', icon: 'text', shown: true },
  { id: 'status', name: 'الحالة', icon: 'tag', shown: true },
  { id: 'owner', name: 'المسؤول', icon: 'person', shown: true },
  { id: 'due', name: 'تاريخ الاستحقاق', icon: 'calendar', shown: false },
  { id: 'budget', name: 'الميزانية', icon: 'number-format', shown: true },
];

function Properties() {
  const [items, setItems] = useState(initial);
  return <div style={{ inlineSize: '18rem', padding: 8, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>
    <CgSortableList
      items={items}
      getKey={(item) => item.id}
      label="خصائص العرض"
      handleLabel={(item) => `نقل ${item.name}`}
      moveAnnouncement={(item, to, count) => `نُقلت ${item.name} إلى ${to + 1} من ${count}`}
      isItemFixed={(item) => item.id === 'title'}
      canMove={(_key, to) => to > 0}
      onMove={(key, to) => setItems((current) => { const moved = current.find((item) => item.id === key)!; const next = current.filter((item) => item.id !== key); next.splice(to, 0, moved); return next; })}
      renderItem={(item) => <>
        <CgIcon name={item.icon} />
        <span style={{ flex: 1 }} dir="auto">{item.name}</span>
        <CgSwitch aria-label={`إظهار ${item.name}`} checked={item.shown} disabled={item.id === 'title'} onCheckedChange={(shown) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, shown } : entry)))} />
      </>}
    />
    <output data-testid="order">{items.map((item) => item.id).join(',')}</output>
  </div>;
}

export const PropertiesList: Story = { args: { items: [], label: 'x' } as never, render: () => <StoryFrame source={source} difference={difference}><Properties /></StoryFrame>, globals: { direction: 'rtl' } };
export const PropertiesListDark: Story = { args: { items: [], label: 'x' } as never, render: () => <StoryFrame source={source} difference={difference}><Properties /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
