import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgSplitter } from './CgSplitter';
import type { CgSplitterActions, CgSplitterPaneDescriptor, CgSplitterState } from './CgSplitter.types';

const source = 'CG.CompLib/Comp/Layout/CgSplitter.*; CG.CompLib/wwwroot/js/cg-splitter.js; CG.CompLib.Tests/CgSplitter*Tests.cs; SplitterDemo.razor';
const difference = 'React uses immutable descriptor/render snapshots, Abort-free synchronous proposals, flex tracks, pointer capture, ResizeObserver, and controlled state that remains authoritative.';
const meta: Meta = { title: 'Phase 18/Splitter', component: CgSplitter, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function PaneCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ minHeight: '100%', padding: 12 }}><strong>{title}</strong><div style={{ marginTop: 8 }}>{children}</div></div>;
}

const standardPanes: ReadonlyArray<CgSplitterPaneDescriptor> = [
  {
    key: 'navigation', size: '13rem', minimumSize: 120, maximumSize: 320, collapsible: true, ariaLabel: 'Navigation',
    renderContent: () => <PaneCard title="Navigation"><nav><a href="#orders">Orders</a><br /><a href="#vendors">Vendors</a><br /><a href="#ledger">General ledger</a></nav></PaneCard>,
    renderCollapsed: () => <span aria-label="Navigation collapsed">Navigation</span>,
  },
  {
    key: 'work', size: '2*', minimumSize: 180, ariaLabel: 'Document workspace',
    renderHeader: () => <div>Purchase invoice · AP-2026-1048</div>,
    renderContent: () => <PaneCard title="Invoice lines"><p>Long-lived form controls remain usable while adjacent panes resize.</p><label>Reference <input defaultValue="PO-1842" /></label></PaneCard>,
  },
  {
    key: 'summary', size: '15rem', minimumSize: 140, maximumSize: 360, collapsible: true, ariaLabel: 'Summary',
    renderContent: () => <PaneCard title="Summary"><dl><dt>Subtotal</dt><dd>$18,420.00</dd><dt>Tax</dt><dd>$920.00</dd></dl></PaneCard>,
    renderCollapsed: () => <span aria-label="Summary collapsed">Summary</span>,
  },
];

function Frame({ children }: { children: React.ReactNode }) {
  return <StoryFrame source={source} difference={difference}><div style={{ width: 'min(780px, calc(100vw - 32px))', height: 360 }}>{children}</div></StoryFrame>;
}

function ControlledPersistenceExample() {
  const [state, setState] = useState<CgSplitterState>();
  const actions = useRef<CgSplitterActions>(null);
  return <div style={{ display: 'grid', gap: 8, width: '100%', height: '100%', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={() => actions.current?.togglePane('navigation')}>Toggle navigation</button>
      <button type="button" onClick={() => actions.current?.reset()}>Reset</button>
      <output aria-label="Persisted state">{state ? JSON.stringify(state) : 'Descriptor defaults'}</output>
    </div>
    <CgSplitter panes={standardPanes} state={state} onStateChange={setState} actionsRef={actions} aria-label="Controlled persisted splitter" />
  </div>;
}

const verticalPanes: ReadonlyArray<CgSplitterPaneDescriptor> = [
  { key: 'editor', size: '65%', minimumSize: 120, renderContent: () => <PaneCard title="Journal editor"><textarea defaultValue="Accrual review notes" style={{ width: '100%', minHeight: 90 }} /></PaneCard> },
  { key: 'activity', size: '*', minimumSize: 80, collapsible: true, renderContent: () => <PaneCard title="Activity"><p>Validated · Posted · Synced</p></PaneCard>, renderCollapsed: () => 'Activity' },
];

export const HorizontalLive: Story = { render: () => <Frame><CgSplitter panes={standardPanes} aria-label="ERP workspace" /></Frame> };
export const VerticalDeferred: Story = { render: () => <Frame><CgSplitter panes={verticalPanes} orientation="vertical" resizeMode="deferred" aria-label="Editor and activity" /></Frame> };
export const CollapsedRails: Story = { render: () => <Frame><CgSplitter panes={standardPanes} defaultState={{ version: 1, panes: [{ key: 'navigation', size: '13rem' }, { key: 'work', size: '2fr' }, { key: 'summary', size: '15rem' }], collapsedPaneKeys: ['navigation', 'summary'] }} aria-label="Collapsed splitter rails" /></Frame> };
export const ControlledPersistence: Story = { render: () => <Frame><ControlledPersistenceExample /></Frame> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <Frame><div dir="rtl" style={{ height: '100%' }}><CgSplitter direction="rtl" panes={[
  { key: 'nav', size: '9rem', minimumSize: 80, collapsible: true, renderContent: () => <PaneCard title="التنقل">الموردون<br />الفواتير<br />دفتر الأستاذ</PaneCard>, renderCollapsed: () => 'التنقل' },
  { key: 'work', size: '*', minimumSize: 140, renderContent: () => <PaneCard title="مساحة العمل">نموذج طويل يدعم اتجاه الكتابة من اليمين إلى اليسار.</PaneCard> },
]} aria-label="تقسيم مساحة العمل" /></div></Frame> };
export const DarkCompactStates: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <Frame><div style={{ display: 'grid', gap: 12, height: '100%', gridTemplateRows: '1fr 1fr' }}><CgSplitter panes={standardPanes.slice(0, 2)} disabled aria-label="Disabled splitter" /><CgSplitter panes={standardPanes.slice(1)} readOnly aria-label="Read only splitter" /></div></Frame> };
export const FixedRemainder: Story = { render: () => <Frame><CgSplitter panes={standardPanes.map((pane, index) => ({ ...pane, size: `${180 + index * 20}px` }))} aria-label="Fixed pane remainder" /></Frame> };
export const ZeroSizeCollapse: Story = { render: () => <Frame><CgSplitter panes={[
  { key: 'zero', size: 160, collapsible: true, defaultCollapsed: true, renderContent: () => 'Unmounted without collapsed content' },
  { key: 'main', size: '*', renderContent: () => <PaneCard title="Main pane">The collapsed pane occupies zero space.</PaneCard> },
]} aria-label="Zero size collapse" /></Frame> };
export const LongNarrowContent: Story = { render: () => <Frame><CgSplitter panes={standardPanes} style={{ width: 310 }} aria-label="Narrow long content" /></Frame> };
export const InvisibleDescriptor: Story = { render: () => <Frame><CgSplitter panes={[...standardPanes, { key: 'authorization', visible: false, renderContent: () => 'Visibility is not authorization' }]} aria-label="Invisible descriptor" /></Frame> };
export const NestedSplitters: Story = { render: () => <Frame><CgSplitter panes={[
  standardPanes[0]!,
  { key: 'nested', size: '*', renderContent: () => <div style={{ height: 250, padding: 8 }}><CgSplitter orientation="vertical" panes={verticalPanes} aria-label="Nested activity splitter" style={{ height: '100%' }} /></div> },
]} aria-label="Outer workspace splitter" /></Frame> };
