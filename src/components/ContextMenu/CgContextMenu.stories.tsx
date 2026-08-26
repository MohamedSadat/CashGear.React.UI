import { useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgContextMenu } from './CgContextMenu';
import type { CgContextMenuActions, CgContextMenuItem } from './CgContextMenu.types';
import { useCgContextMenuTarget } from './useCgContextMenuTarget';

const source = 'CG.CompLib/Comp/ContextMenu/*; CG.CompLib.Demo/Components/Pages/ContextMenuDemo.razor';
const difference = 'React uses a spread-prop target hook instead of string menu IDs and requires an explicit async confirmation callback.';
const meta: Meta = { title: 'Phase 10/ContextMenu', component: CgContextMenu, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;
type OrderContext = { order: string };

const items: ReadonlyArray<CgContextMenuItem<OrderContext>> = [
  { key: 'open', text: 'Open order', shortcut: 'Enter' },
  { key: 'posted', text: 'Posted only', checked: true },
  { key: 'status', text: 'Status', children: [
    { key: 'open-status', text: 'Open', checked: true, radioGroup: 'status' },
    { key: 'closed-status', text: 'Closed', checked: false, radioGroup: 'status' },
  ] },
  { key: 'delete', text: 'Delete', intent: 'danger', beginGroup: true, confirmation: { message: 'Delete this order?' } },
];

function ContextExample({ rtl = false }: { rtl?: boolean }) {
  const menu = useRef<CgContextMenuActions<OrderContext>>(null);
  const { targetProps } = useCgContextMenuTarget({ menuRef: menu, context: { order: 'SO-1042' } });
  return <div dir={rtl ? 'rtl' : 'ltr'} style={{ minHeight: 280, padding: 48 }}>
    <article {...targetProps} tabIndex={0} style={{ border: '1px solid #94a3b8', borderRadius: 8, padding: 24 }}>Right-click order SO-1042</article>
    <CgContextMenu items={items} actionsRef={menu} direction={rtl ? 'rtl' : 'ltr'} confirm={() => true} />
  </div>;
}

function CancellationExample() {
  const menu = useRef<CgContextMenuActions<OrderContext>>(null);
  const [status, setStatus] = useState('Idle');
  const { targetProps } = useCgContextMenuTarget({ menuRef: menu, context: { order: 'SO-2048' } });
  return <div style={{ minHeight: 260, padding: 48 }}>
    <button {...targetProps}>Protected order</button>
    <output aria-label="Command status">{status}</output>
    <CgContextMenu
      items={[{ key: 'protected', text: 'Protected command' }]}
      actionsRef={menu}
      beforeCommand={() => { setStatus('Cancelled by policy'); return false; }}
    />
  </div>;
}

function LoadingExample() {
  const menu = useRef<CgContextMenuActions<OrderContext>>(null);
  useEffect(() => {
    void menu.current?.showAt(180, 100, { order: 'SO-4096' });
  }, []);
  return <div style={{ minHeight: 280 }}>
    <CgContextMenu
      items={items}
      actionsRef={menu}
      customizeMenu={async ({ items: snapshot }) => { await new Promise((resolve) => setTimeout(resolve, 900)); return snapshot; }}
      confirm={() => true}
    />
  </div>;
}

export const PointerOpened: Story = { render: () => <StoryFrame source={source} difference={difference}><ContextExample /></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><ContextExample /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><ContextExample rtl /></StoryFrame> };
export const CancellationAndFocusReturn: Story = { render: () => <StoryFrame source={source} difference={difference}><CancellationExample /></StoryFrame> };
export const Loading: Story = { render: () => <StoryFrame source={source} difference={difference}><LoadingExample /></StoryFrame> };
