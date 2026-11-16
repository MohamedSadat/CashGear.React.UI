import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgCommandMenu } from './CgCommandMenu';
import type { CgCommandMenuHandle, CgCommandMenuItem } from './CgCommandMenu.types';

const source = 'None: React only (Cash Gear Workspace Track U1, the slash menu and the search palette)';
const difference = 'One listbox: anchored at a caret with keys forwarded from the editor, or in place with its own search box.';
const meta = { title: 'Phase 37/CommandMenu', component: CgCommandMenu, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgCommandMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

const blocks: CgCommandMenuItem[] = [
  { key: 'text', label: 'نص', group: 'كتل أساسية', icon: 'text', keywords: ['text', 'paragraph'] },
  { key: 'h1', label: 'عنوان 1', group: 'كتل أساسية', icon: 'heading-1', keywords: ['h1'], shortcut: 'Ctrl+Alt+1' },
  { key: 'h2', label: 'عنوان 2', group: 'كتل أساسية', icon: 'heading-2', keywords: ['h2'], shortcut: 'Ctrl+Alt+2' },
  { key: 'bullets', label: 'قائمة نقطية', group: 'كتل أساسية', icon: 'list-bullet', keywords: ['list'] },
  { key: 'todo', label: 'قائمة مهام', group: 'كتل أساسية', icon: 'todo', keywords: ['todo'] },
  { key: 'quote', label: 'اقتباس', group: 'كتل أساسية', icon: 'quote' },
  { key: 'image', label: 'صورة', group: 'وسائط', icon: 'image', detail: 'ارفع صورة أو الصق رابطاً' },
  { key: 'file', label: 'ملف', group: 'وسائط', icon: 'file', disabled: true, detail: 'غير متاح دون اتصال' },
  { key: 'database', label: 'قاعدة بيانات', group: 'متقدم', icon: 'database' },
  { key: 'toc', label: 'جدول المحتويات', group: 'متقدم', icon: 'toc' },
];

function SlashEditor() {
  const input = useRef<HTMLInputElement>(null);
  const menu = useRef<CgCommandMenuHandle>(null);
  const [slash, setSlash] = useState<{ at: number; rect: DOMRect } | null>(null);
  const [text, setText] = useState('');
  const [activeId, setActiveId] = useState<string>();
  const [chosen, setChosen] = useState('');
  const query = slash ? text.slice(slash.at + 1) : '';
  return <div style={{ display: 'grid', gap: 12, inlineSize: 'min(32rem, 100%)', minBlockSize: 380 }}>
    <input
      ref={input}
      aria-label="محرر المستند"
      role="combobox"
      aria-expanded={slash !== null}
      aria-controls={slash ? 'slash-menu-list' : undefined}
      aria-activedescendant={slash ? activeId : undefined}
      aria-autocomplete="list"
      placeholder="اكتب / لإدراج كتلة"
      value={text}
      style={{ font: 'inherit', padding: 8, border: '1px solid var(--cg-border-strong)', borderRadius: 6, background: 'var(--cg-surface)', color: 'inherit' }}
      onChange={(event) => {
        const value = event.currentTarget.value;
        setText(value);
        if (value.endsWith('/') && !slash) setSlash({ at: value.length - 1, rect: event.currentTarget.getBoundingClientRect() });
        else if (slash && value.length <= slash.at) setSlash(null);
      }}
      onKeyDown={(event) => { if (slash) menu.current?.handleKeyDown(event); }}
    />
    {slash ? <CgCommandMenu
      ref={menu}
      id="slash-menu"
      anchor={{ x: slash.rect.x, y: slash.rect.y, width: slash.rect.width, height: slash.rect.height }}
      items={blocks}
      query={query}
      label="الكتل"
      emptyText="لا توجد كتلة مطابقة"
      selectOnTab
      onActiveDescendantChange={setActiveId}
      onSelect={(item) => { setChosen(item.label); setText(text.slice(0, slash.at)); setSlash(null); input.current?.focus(); }}
      onDismiss={() => setSlash(null)}
      maxHeight="16rem"
    /> : null}
    <output data-testid="chosen">{chosen}</output>
  </div>;
}

const pages: CgCommandMenuItem[] = [
  { key: 'p1', label: 'خطة الربع الرابع', group: 'الصفحات', icon: '📄', detail: 'المالية / الميزانيات' },
  { key: 'p2', label: 'مراجعة الموردين', group: 'الصفحات', icon: '🧾', detail: 'المشتريات' },
  { key: 'p3', label: 'Quarterly plan (English)', group: 'الصفحات', icon: 'page' },
  { key: 'c1', label: 'صفحة جديدة', group: 'الأوامر', icon: 'page-add', shortcut: 'Ctrl+N' },
  { key: 'c2', label: 'إظهار الشريط الجانبي', group: 'الأوامر', icon: 'sidebar', shortcut: 'Ctrl+\\' },
  { key: 'c3', label: 'الإعدادات', group: 'الأوامر', icon: 'settings' },
];

function Palette() {
  const [chosen, setChosen] = useState('');
  return <div style={{ display: 'grid', gap: 12, inlineSize: 'min(32rem, 100%)' }}>
    <div style={{ padding: 12, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)', boxShadow: 'var(--cg-shadow)' }}>
      <CgCommandMenu items={pages} searchable searchLabel="ابحث في الصفحات والأوامر" searchPlaceholder="ابحث أو نفّذ أمراً…" label="النتائج" emptyText="لا توجد نتائج" onSelect={(item) => setChosen(item.label)} maxHeight="18rem" />
    </div>
    <output data-testid="chosen">{chosen}</output>
  </div>;
}

export const SlashMenu: Story = { args: { items: blocks, label: 'الكتل', emptyText: '', onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><SlashEditor /></StoryFrame>, globals: { direction: 'rtl' } };
export const SearchPalette: Story = { args: { items: pages, label: 'النتائج', emptyText: '', onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><Palette /></StoryFrame>, globals: { direction: 'rtl' } };
export const SearchPaletteDark: Story = { args: { items: pages, label: 'النتائج', emptyText: '', onSelect: () => undefined }, render: () => <StoryFrame source={source} difference={difference}><Palette /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const OpenList: Story = {
  args: { items: blocks, label: 'الكتل', emptyText: '', onSelect: () => undefined },
  render: () => <StoryFrame source={source} difference={difference}><div style={{ inlineSize: '20rem', padding: 8, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }} data-testid="open-list"><CgCommandMenu items={blocks} label="الكتل" emptyText="لا توجد كتلة مطابقة" onSelect={() => undefined} maxHeight="none" /></div></StoryFrame>,
  globals: { direction: 'rtl' },
};
