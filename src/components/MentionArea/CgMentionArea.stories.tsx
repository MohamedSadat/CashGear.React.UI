import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgMentionArea } from './CgMentionArea';
import type { CgMentionAreaHandle, CgMentionAreaSuggestion, CgMentionAreaValue } from './CgMentionArea.types';

const source = 'None: React only (Cash Gear Workspace Track U17, the comment composer)';
const difference = 'An uncontrolled editable area: "@" suggests people and pages; the value is text and mention atoms.';
const meta = { title: 'Phase 37/MentionArea', component: CgMentionArea, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgMentionArea>;
export default meta;
type Story = StoryObj<typeof meta>;

const everyone: CgMentionAreaSuggestion[] = [
  { key: 'u1', label: 'ليلى حسن', group: 'الأشخاص', icon: 'person', detail: 'layla@example.com', mention: { kind: 'user', id: 'u1' } },
  { key: 'u2', label: 'سامي يوسف', group: 'الأشخاص', icon: 'person', detail: 'sami@example.com', mention: { kind: 'user', id: 'u2' } },
  { key: 'u3', label: 'Ada Lovelace', group: 'الأشخاص', icon: 'person', detail: 'ada@example.com', mention: { kind: 'user', id: 'u3' } },
  { key: 'p1', label: 'خطة الربع الرابع', group: 'الصفحات', icon: '📄', mention: { kind: 'page', id: 'p1' }, text: '📄 خطة الربع الرابع' },
  { key: 'p2', label: 'مراجعة الموردين', group: 'الصفحات', icon: '🧾', mention: { kind: 'page', id: 'p2' }, text: '🧾 مراجعة الموردين' },
];
const suggest = (query: string) => {
  const needle = query.trim().toLowerCase();
  return everyone.filter((item) => item.label.toLowerCase().includes(needle)).slice(0, 6);
};
const describe = (value: CgMentionAreaValue) => value.map((part) => (typeof part === 'string' ? part : `[${part.kind}:${part.id}]`)).join('');

function Composer({ initial }: { initial?: CgMentionAreaValue }) {
  const area = useRef<CgMentionAreaHandle>(null);
  const [sent, setSent] = useState('');
  const [empty, setEmpty] = useState(!initial?.length);
  const send = () => { const value = area.current?.getValue() ?? []; if (!value.length) return; setSent(describe(value)); area.current?.clear(); setEmpty(true); };
  return <div style={{ display: 'grid', gap: 8, inlineSize: 'min(28rem, 100%)', minBlockSize: 360, alignContent: 'start' }}>
    <CgMentionArea
      ref={area}
      label="تعليق جديد"
      placeholder="اكتب تعليقاً، و@ للإشارة إلى شخص أو صفحة"
      listLabel="الإشارات"
      suggest={suggest}
      defaultValue={initial}
      onValueChange={(value) => { const next = value.length === 0; if (next !== empty) setEmpty(next); }}
      onSubmit={send}
      aria-describedby="composer-hint"
    />
    <p id="composer-hint" style={{ margin: 0, color: 'var(--cg-text-secondary)', fontSize: 'var(--cg-font-size-sm)' }}>Ctrl+Enter للإرسال</p>
    <div><CgButton intent="primary" disabled={empty} onClick={send}>إرسال</CgButton></div>
    <output data-testid="sent">{sent}</output>
  </div>;
}

export const CommentComposer: Story = { args: { label: 'x', listLabel: 'x', suggest }, render: () => <StoryFrame source={source} difference={difference}><Composer /></StoryFrame>, globals: { direction: 'rtl' } };
export const WithMentions: Story = { args: { label: 'x', listLabel: 'x', suggest }, render: () => <StoryFrame source={source} difference={difference}><Composer initial={['شكراً ', { kind: 'user', id: 'u1', text: '@ليلى حسن' }, '، راجعي ', { kind: 'page', id: 'p1', text: '📄 خطة الربع الرابع' }, '\nقبل الخميس.']} /></StoryFrame>, globals: { direction: 'rtl' } };
export const Dark: Story = { args: { label: 'x', listLabel: 'x', suggest }, render: () => <StoryFrame source={source} difference={difference}><Composer initial={['مرحباً ', { kind: 'user', id: 'u2', text: '@سامي يوسف' }]} /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
