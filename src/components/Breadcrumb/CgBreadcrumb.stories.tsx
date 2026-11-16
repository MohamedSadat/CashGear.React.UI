import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgIcon } from '../Icon';
import { CgBreadcrumb } from './CgBreadcrumb';
import type { CgBreadcrumbItem } from './CgBreadcrumb.types';

const source = 'None: React only (Cash Gear Workspace Track U5, the page header\'s trail)';
const difference = 'Collapses by count into a "…" menu of the hidden crumbs; the caller routes through onNavigate.';
const meta = { title: 'Phase 37/Breadcrumb', component: CgBreadcrumb, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgBreadcrumb>;
export default meta;
type Story = StoryObj<typeof meta>;

const trail: CgBreadcrumbItem[] = [
  { key: 'section', text: 'خاص' },
  { key: 'p1', text: 'المالية', href: '#p1', icon: '💰' },
  { key: 'p2', text: 'الميزانيات', href: '#p2' },
  { key: 'p3', text: '2026', href: '#p3' },
  { key: 'p4', text: 'الربع الرابع', href: '#p4', icon: <CgIcon name="page" /> },
  { key: 'p5', text: 'مراجعة نوفمبر مع فريق المبيعات والمشتريات', href: '#p5', icon: '📄' },
];

function Fixture({ items, collapse }: { items: CgBreadcrumbItem[]; collapse: boolean }) {
  const [last, setLast] = useState('');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 12, inlineSize: 'min(40rem, 100%)' }} data-testid="breadcrumb-demo">
      <CgBreadcrumb
        items={items}
        label="مسار التنقل"
        {...(collapse ? { maxItems: 5, itemsBeforeCollapse: 1, itemsAfterCollapse: 3, overflowLabel: (hidden: readonly CgBreadcrumbItem[]) => `${hidden.length} صفحات أخرى` } : {})}
        onNavigate={({ item, event }) => { event.preventDefault(); setLast(item.text); }}
      />
      <output data-testid="navigated">{last}</output>
    </div>
  </StoryFrame>;
}

export const Collapsed: Story = { args: { items: trail, label: 'مسار التنقل' }, render: () => <Fixture items={trail} collapse />, globals: { direction: 'rtl' } };
export const Full: Story = { args: { items: trail, label: 'مسار التنقل' }, render: () => <Fixture items={trail.slice(0, 4)} collapse={false} />, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { items: trail, label: 'مسار التنقل' }, render: () => <Fixture items={trail} collapse />, globals: { theme: 'dark', direction: 'rtl' } };
export const LeftToRight: Story = {
  args: { items: trail, label: 'Breadcrumbs' },
  render: () => <Fixture items={[{ key: 's', text: 'Private' }, { key: 'a', text: 'Finance', href: '#a', icon: '💰' }, { key: 'b', text: 'Budgets', href: '#b' }, { key: 'c', text: '2026', href: '#c' }, { key: 'd', text: 'Q4', href: '#d' }, { key: 'e', text: 'November review', href: '#e' }]} collapse />,
};
