import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgLiveAnnouncer } from './CgLiveAnnouncer';
import type { CgLiveAnnouncerHandle, CgLiveAnnouncerPoliteness } from './CgLiveAnnouncer.types';

const source = 'None: React only (Cash Gear Workspace Track U13, the views\' live region)';
const difference = 'Written through a ref handle, never React state, so a drag or typing announces without drawing.';
const meta = { title: 'Phase 37/LiveAnnouncer', component: CgLiveAnnouncer, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgLiveAnnouncer>;
export default meta;
type Story = StoryObj<typeof meta>;

function Fixture({ politeness, messages }: { politeness: CgLiveAnnouncerPoliteness; messages: readonly string[] }) {
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const [last, setLast] = useState('');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 12 }} data-testid="announcer-demo">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {messages.map((message) => <CgButton key={message} appearance="outline" onClick={() => { live.current?.announce(message); setLast(message); }}>{message}</CgButton>)}
        <CgButton appearance="ghost" onClick={() => { live.current?.clear(); setLast(''); }}>{politeness === 'assertive' ? 'مسح التنبيه' : 'مسح'}</CgButton>
      </div>
      <output data-testid="last-message">{last}</output>
      <CgLiveAnnouncer ref={live} politeness={politeness} data-testid="live-region" />
    </div>
  </StoryFrame>;
}

export const Polite: Story = { render: () => <div dir="rtl"><Fixture politeness="polite" messages={['نُقلت البطاقة إلى «قيد التنفيذ»', 'أُضيف صف جديد']} /></div>, globals: { direction: 'rtl' } };
export const Assertive: Story = { render: () => <div dir="rtl"><Fixture politeness="assertive" messages={['تعذّر الحفظ']} /></div>, globals: { direction: 'rtl' } };
export const Dark: Story = { render: () => <div dir="rtl"><Fixture politeness="polite" messages={['اكتمل الاستيراد']} /></div>, globals: { theme: 'dark', direction: 'rtl' } };
