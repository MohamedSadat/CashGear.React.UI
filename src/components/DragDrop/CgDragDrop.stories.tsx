import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgLiveAnnouncer } from '../LiveAnnouncer';
import type { CgLiveAnnouncerHandle } from '../LiveAnnouncer';
import { CgDragHandle, CgDropIndicator } from './CgDragDrop';
import type { CgDropIndicatorHandle } from './CgDragDrop.types';
import { cgTrackDrag } from './dragTracking';

const source = 'None: React only (Cash Gear Workspace Track U3, the block handle and the board drag)';
const difference = 'A pointer drag outside React (a copy follows, edge scroll, Escape cancels), a handle, and a drop line moved through a ref.';
const meta = { title: 'Phase 37/DragDrop', component: CgDragHandle, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgDragHandle>;
export default meta;
type Story = StoryObj<typeof meta>;

const initial = ['مقدمة المشروع', 'الأهداف', 'الجدول الزمني', 'الميزانية', 'المخاطر', 'الخطوات التالية', 'ملحق أ', 'ملحق ب'];

function Blocks() {
  const [blocks, setBlocks] = useState(initial);
  const list = useRef<HTMLDivElement>(null);
  const line = useRef<CgDropIndicatorHandle>(null);
  const live = useRef<CgLiveAnnouncerHandle>(null);
  const gapRef = useRef<number | null>(null);
  const gapAt = (y: number): number | null => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-block]') ?? [])];
    if (!rows.length) return null;
    for (let index = 0; index < rows.length; index += 1) {
      const box = rows[index]!.getBoundingClientRect();
      if (y < box.top + box.height / 2) return index;
    }
    return rows.length;
  };
  const showLine = (gap: number | null) => {
    const container = list.current;
    const rows = [...(container?.querySelectorAll<HTMLElement>('[data-block]') ?? [])];
    if (gap === null || !container || !rows.length) { line.current?.hide(); return; }
    const box = container.getBoundingClientRect();
    const edge = gap < rows.length ? rows[gap]!.getBoundingClientRect().top : rows[rows.length - 1]!.getBoundingClientRect().bottom;
    line.current?.show({ block: edge - box.top + container.scrollTop, inline: 8, length: box.width - 16 });
  };
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    if (event.button !== 0) return;
    const row = event.currentTarget.closest<HTMLElement>('[data-block]')!;
    cgTrackDrag(event, row, {
      scroller: list.current,
      onMove: (_x, y) => { gapRef.current = gapAt(y); showLine(gapRef.current); },
      onDrop: () => {
        line.current?.hide();
        const gap = gapRef.current;
        if (gap === null) return;
        const to = gap > index ? gap - 1 : gap;
        if (to === index) return;
        setBlocks((current) => { const next = [...current]; const [moved] = next.splice(index, 1); next.splice(to, 0, moved!); return next; });
        live.current?.announce(`نُقلت «${blocks[index]!}» إلى ${to + 1} من ${blocks.length}`);
      },
      onCancel: () => line.current?.hide(),
    });
  };
  const move = (index: number, delta: -1 | 1) => {
    const to = index + delta;
    if (to < 0 || to >= blocks.length) return;
    setBlocks((current) => { const next = [...current]; const [moved] = next.splice(index, 1); next.splice(to, 0, moved!); return next; });
    requestAnimationFrame(() => list.current?.querySelectorAll<HTMLElement>('[data-cg-drag-handle]')[to]?.focus());
  };
  return <div style={{ display: 'grid', gap: 8, inlineSize: 'min(26rem, 100%)' }}>
    <div ref={list} style={{ position: 'relative', blockSize: 240, overflow: 'auto', padding: 8, border: '1px solid var(--cg-border)', borderRadius: 8, background: 'var(--cg-surface)' }} data-testid="blocks">
      {blocks.map((text, index) => <div key={text} data-block="" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', borderRadius: 4, background: 'var(--cg-surface)' }}>
        <CgDragHandle label={`نقل «${text}»`} onPointerDown={(event) => startDrag(event, index)} onKeyboardMove={(delta) => move(index, delta)} />
        <span>{text}</span>
      </div>)}
      <CgDropIndicator ref={line} />
    </div>
    <output data-testid="block-order">{blocks.join('، ')}</output>
    <CgLiveAnnouncer ref={live} />
  </div>;
}

export const BlockHandles: Story = { args: { label: 'x' }, render: () => <StoryFrame source={source} difference={difference}><Blocks /></StoryFrame>, globals: { direction: 'rtl' } };
export const BlockHandlesDark: Story = { args: { label: 'x' }, render: () => <StoryFrame source={source} difference={difference}><Blocks /></StoryFrame>, globals: { theme: 'dark', direction: 'rtl' } };
