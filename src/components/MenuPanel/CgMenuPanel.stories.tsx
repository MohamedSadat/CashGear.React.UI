import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgFlyout } from '../Flyout';
import { CgMenuPanel, CgMenuPanelGroup, CgMenuPanelHeader, CgMenuPanelItem, CgMenuPanelSeparator, CgMenuPanelSwitch } from './CgMenuPanel';

const source = 'None: React only (Cash Gear Workspace Track U10, the property and view menus)';
const difference = 'A menu that also holds fields, switches and nested panels; it is placed in a CgFlyout by the caller.';
const meta = { title: 'Phase 37/MenuPanel', component: CgMenuPanel, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgMenuPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const TYPES = [['text', 'نص'], ['number', 'رقم'], ['date', 'تاريخ'], ['select', 'اختيار']] as const;

function PropertyMenu({ inFlyout }: { inFlyout: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [panel, setPanel] = useState<'main' | 'type'>('main');
  const [type, setType] = useState('number');
  const [wrap, setWrap] = useState(true);
  const [sort, setSort] = useState<'asc' | 'desc' | null>(null);
  const [log, setLog] = useState('');
  const main = <CgMenuPanel
    label="خصائص العمود «الكمية»"
    fields={<input aria-label="اسم العمود" defaultValue="الكمية" dir="auto" data-cg-initial-focus="" />}
    onEscape={() => setOpen(false)}
  >
    <CgMenuPanelItem icon="number-format" hint={TYPES.find(([key]) => key === type)?.[1]} opensPanel onSelect={() => setPanel('type')}>تغيير النوع</CgMenuPanelItem>
    <CgMenuPanelSwitch icon="text-wrap" checked={wrap} onCheckedChange={setWrap}>التفاف النص</CgMenuPanelSwitch>
    <CgMenuPanelGroup label="الترتيب">
      <CgMenuPanelItem icon="sort-ascending" checked={sort === 'asc'} onSelect={() => setSort('asc')}>تصاعدي</CgMenuPanelItem>
      <CgMenuPanelItem icon="sort-descending" checked={sort === 'desc'} onSelect={() => setSort('desc')}>تنازلي</CgMenuPanelItem>
    </CgMenuPanelGroup>
    <CgMenuPanelSeparator />
    <CgMenuPanelItem icon="copy" onSelect={() => setLog('نُسخ العمود')}>تكرار</CgMenuPanelItem>
    <CgMenuPanelItem icon="delete" danger onSelect={() => setLog('حُذف العمود')}>حذف العمود</CgMenuPanelItem>
  </CgMenuPanel>;
  const types = <CgMenuPanel label="أنواع العمود" header={<CgMenuPanelHeader title="تغيير النوع" onBack={() => setPanel('main')} backLabel="رجوع" />} onEscape={() => setPanel('main')}>
    {TYPES.map(([key, name]) => <CgMenuPanelItem key={key} checked={type === key} initialFocus={type === key} onSelect={() => { setType(key); setPanel('main'); }}>{name}</CgMenuPanelItem>)}
  </CgMenuPanel>;
  const content = panel === 'main' ? main : types;
  return <div style={{ display: 'grid', gap: 12, minBlockSize: 420, alignContent: 'start' }}>
    {inFlyout ? <>
      <CgButton ref={anchor} appearance="outline" onClick={() => setOpen((value) => !value)}>الكمية</CgButton>
      <CgFlyout anchor={anchor} open={open} onOpenChange={setOpen} autoFocus width="16rem" maxHeight="none" scrollable={false} aria-label="خصائص العمود">{content}</CgFlyout>
    </> : <div style={{ inlineSize: '16rem', border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }}>{content}</div>}
    <output data-testid="menu-log">{log}</output>
  </div>;
}

export const PropertyMenuInFlyout: Story = { args: { label: 'x' }, render: () => <StoryFrame source={source} difference={difference}><PropertyMenu inFlyout /></StoryFrame>, globals: { direction: 'rtl' } };
export const InPlace: Story = { args: { label: 'x' }, render: () => <StoryFrame source={source} difference={difference}><PropertyMenu inFlyout={false} /></StoryFrame>, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { label: 'x' }, render: () => <StoryFrame source={source} difference={difference}><PropertyMenu inFlyout={false} /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
