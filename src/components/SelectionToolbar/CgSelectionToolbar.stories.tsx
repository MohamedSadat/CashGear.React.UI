import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgOverlayRectangle } from '../../types';
import type { CgToolbarItem } from '../Toolbar';
import { CgSelectionToolbar } from './CgSelectionToolbar';

const source = 'None: React only (Cash Gear Workspace Track U2, the bubble and touch toolbars)';
const difference = 'A CgToolbar in a CgFlyout that follows the selection rectangle, or docked above an on-screen keyboard.';
const meta = { title: 'Phase 37/SelectionToolbar', component: CgSelectionToolbar, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSelectionToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

function rectOf(range: Range): CgOverlayRectangle {
  const box = range.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}

function Editor({ initialSelection = false }: { initialSelection?: boolean }) {
  const area = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<CgOverlayRectangle | null>(null);
  const [marks, setMarks] = useState({ bold: false, italic: false });
  const [linking, setLinking] = useState(false);
  const [log, setLog] = useState('');
  useEffect(() => {
    const update = () => {
      const selection = document.getSelection();
      const node = area.current;
      if (!selection || !node || selection.isCollapsed || !selection.rangeCount || !node.contains(selection.anchorNode)) { if (!linking) setRect(null); return; }
      setRect(rectOf(selection.getRangeAt(0)));
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, [linking]);
  useEffect(() => {
    if (!initialSelection || !area.current) return;
    const text = area.current.firstChild!;
    const range = document.createRange();
    range.setStart(text, 9);
    range.setEnd(text, 20);
    area.current.focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    setRect(rectOf(range));
  }, [initialSelection]);
  const items: CgToolbarItem[] = [
    { name: 'bold', text: 'غامق', icon: 'text-bold', iconOnly: true, checked: marks.bold, onCheckedChange: (bold) => { setMarks((current) => ({ ...current, bold })); setLog(`غامق: ${bold ? 'نعم' : 'لا'}`); } },
    { name: 'italic', text: 'مائل', icon: 'text-italic', iconOnly: true, checked: marks.italic, onCheckedChange: (italic) => setMarks((current) => ({ ...current, italic })) },
    { name: 'link', text: 'رابط', icon: 'link', iconOnly: true, checked: linking, onCheckedChange: setLinking },
    { name: 'comment', text: 'تعليق', icon: 'comment', iconOnly: true, beginGroup: true, onClick: () => setLog('تعليق على التحديد') },
  ];
  return <div style={{ display: 'grid', gap: 12, inlineSize: 'min(34rem, 100%)', paddingBlockStart: 64 }}>
    <div ref={area} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="نص المستند" tabIndex={0} style={{ padding: 12, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)', lineHeight: 1.8 }}>
      حدّد جزءاً من هذا النص لتظهر أدوات التنسيق فوقه، وتتبع التحديد أينما كان في الصفحة.
    </div>
    <CgSelectionToolbar
      label="التنسيق"
      items={items}
      rect={rect}
      onEscape={() => { setLinking(false); area.current?.focus(); }}
      panel={linking ? <form style={{ display: 'flex', gap: 8 }} onSubmit={(event) => { event.preventDefault(); setLinking(false); setLog('أُضيف الرابط'); area.current?.focus(); }}><input aria-label="عنوان الرابط" dir="ltr" placeholder="https://" style={{ font: 'inherit' }} /></form> : null}
    />
    <output data-testid="toolbar-log">{log}</output>
  </div>;
}

const touchItems: CgToolbarItem[] = [
  { name: 'insert', text: 'إدراج', icon: 'add', iconOnly: true },
  { name: 'bold', text: 'غامق', icon: 'text-bold', iconOnly: true },
  { name: 'italic', text: 'مائل', icon: 'text-italic', iconOnly: true },
  { name: 'up', text: 'نقل لأعلى', icon: 'chevron-up', iconOnly: true, beginGroup: true },
  { name: 'down', text: 'نقل لأسفل', icon: 'chevron-down', iconOnly: true },
  { name: 'indent', text: 'زيادة المسافة', icon: 'indent-increase', iconOnly: true },
  { name: 'more', text: 'المزيد', icon: 'more', iconOnly: true },
];

export const FollowsSelection: Story = { args: { label: 'التنسيق', items: [] }, render: () => <StoryFrame source={source} difference={difference}><Editor initialSelection /></StoryFrame>, globals: { direction: 'rtl' } };
export const FollowsSelectionDark: Story = { args: { label: 'التنسيق', items: [] }, render: () => <StoryFrame source={source} difference={difference}><Editor initialSelection /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
export const DockedTouch: Story = { args: { label: 'أدوات الكتلة', items: [] }, render: () => <StoryFrame source={source} difference={difference}><p>على الهاتف، تبقى أدوات الكتلة فوق لوحة المفاتيح.</p><CgSelectionToolbar mode="docked" label="أدوات الكتلة" items={touchItems} /></StoryFrame>, globals: { direction: 'rtl' } };
