import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgFlyout } from '../Flyout';
import { CgEmojiPicker } from './CgEmojiPicker';
import { cgPageIcons } from './pageIcons';

const source = 'None: React only (Cash Gear Workspace Track U6, the page icon picker)';
const difference = 'Any emoji list the caller passes; the library ships a curated page-icon set named in Arabic and English, with no third-party emoji data.';
const meta = { title: 'Phase 37/EmojiPicker', component: CgEmojiPicker, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgEmojiPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const arabic = cgPageIcons('ar');
const english = cgPageIcons('en');

function PageIcon({ language }: { language: 'ar' | 'en' }) {
  const set = language === 'ar' ? arabic : english;
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);
  const [icon, setIcon] = useState<string | null>('📄');
  const [recent, setRecent] = useState(() => set.items.filter((item) => ['🚀', '💡', '📊'].includes(item.emoji)));
  const ar = language === 'ar';
  return <div style={{ minBlockSize: 440 }}>
    <CgButton ref={anchor} appearance="ghost" aria-label={ar ? 'تغيير رمز الصفحة' : 'Change page icon'} onClick={() => setOpen((value) => !value)} style={{ fontSize: '2rem' }}>{icon ?? (ar ? 'إضافة رمز' : 'Add icon')}</CgButton>
    <CgFlyout anchor={anchor} open={open} onOpenChange={setOpen} autoFocus maxHeight="none" scrollable={false} aria-label={ar ? 'اختر رمزاً' : 'Choose an icon'}>
      <CgEmojiPicker
        items={set.items}
        groups={set.groups}
        recent={recent}
        value={icon}
        labels={ar
          ? { search: 'ابحث عن رمز', grid: 'الرموز', noMatch: 'لا رمز مطابق', recent: 'المستخدمة مؤخراً', remove: 'إزالة' }
          : { search: 'Search icons', grid: 'Icons', noMatch: 'No matching icon', recent: 'Recent', remove: 'Remove' }}
        onEscape={() => setOpen(false)}
        onSelect={(emoji, item) => {
          setIcon(emoji);
          if (item) setRecent((current) => [item, ...current.filter((entry) => entry.emoji !== item.emoji)].slice(0, 8));
          setOpen(false);
        }}
      />
    </CgFlyout>
  </div>;
}

export const PageIconPicker: Story = { args: { items: [], labels: { search: 'x', grid: 'x', noMatch: 'x' }, onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><PageIcon language="ar" /></StoryFrame>, globals: { direction: 'rtl' } };
export const PageIconPickerDark: Story = { args: { items: [], labels: { search: 'x', grid: 'x', noMatch: 'x' }, onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><PageIcon language="ar" /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const English: Story = { args: { items: [], labels: { search: 'x', grid: 'x', noMatch: 'x' }, onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><PageIcon language="en" /></StoryFrame> };
