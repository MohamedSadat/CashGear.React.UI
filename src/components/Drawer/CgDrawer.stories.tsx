import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgPopup } from '../Popup';
import { CgDrawer } from './CgDrawer';
import type { CgDrawerActions, CgDrawerProps } from './CgDrawer.types';

const source = 'CG.CompLib/Comp/Layout/CgDrawer.*; CG.CompLib/wwwroot/js/cg-drawer.js; CG.CompLib.Tests/CgDrawer*Tests.cs; DrawerDemo.razor';
const difference = 'React keeps one inline subtree mounted, uses matchMedia for responsive presentation, and participates in the shared owned-overlay stack, modal isolation, focus trap, and scroll lock.';
const meta: Meta = { title: 'Phase 18/Drawer', component: CgDrawer, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function Frame({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return <StoryFrame source={source} difference={difference}><div style={{ width: narrow ? 350 : 780, maxWidth: '100%', height: 400, border: '1px solid var(--cg-border)' }}>{children}</div></StoryFrame>;
}

const drawerContent: Pick<CgDrawerProps, 'renderHeader' | 'renderDrawer' | 'renderFooter' | 'renderMiniDrawer' | 'renderApplicationContent'> = {
  renderHeader: (context) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong>CashGear</strong><button type="button" onClick={() => void context.actions.close()} aria-label="Close navigation">×</button></div>,
  renderDrawer: () => <nav style={{ display: 'grid', gap: 10 }}><a href="#dashboard">Dashboard</a><a href="#invoices">Purchase invoices</a><a href="#payments">Payments</a><a href="#vendors">Vendors</a><label>Quick filter <input defaultValue="open" style={{ width: '100%' }} /></label></nav>,
  renderFooter: () => <small>Contoso Trading · FY 2026</small>,
  renderMiniDrawer: (context) => <nav style={{ display: 'grid', placeItems: 'center', gap: 12, paddingBlock: 12 }}><button onClick={() => void context.actions.open()} aria-label="Open navigation">☰</button><button aria-label="Invoices">▤</button><button aria-label="Vendors">♙</button></nav>,
  renderApplicationContent: () => <main style={{ padding: 20 }}><h2>Purchase invoices</h2><p>Review, approve, and post supplier documents without remounting the surrounding application.</p><label>Document reference <input defaultValue="AP-2026-1048" /></label><div style={{ marginTop: 18, padding: 16, border: '1px solid var(--cg-border)', minWidth: 240 }}>Open balance: <strong>$18,420.00</strong></div></main>,
};

function ControlledLifecycleExample() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const actions = useRef<CgDrawerActions>(null);
  const record = (event: string) => setEvents((current) => [...current.slice(-3), event]);
  return <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
    <div style={{ display: 'flex', gap: 8, padding: 8 }}><button onClick={() => void actions.current?.toggle()}>Async toggle</button><output>{events.join(' → ') || 'Ready'}</output></div>
    <CgDrawer {...drawerContent} mode="overlay" open={open} actionsRef={actions} onBeforeOpen={() => record('before open')} onBeforeClose={() => record('before close')} onOpenChange={(next) => { record('change'); setOpen(next); }} onOpened={() => record('opened')} onClosed={() => record('closed')} />
  </div>;
}

function NestedOverlayExample() {
  const [popup, setPopup] = useState(true);
  return <CgDrawer {...drawerContent} mode="overlay" defaultOpen renderDrawer={(context) => <div><p>Drawer boundary: {context.boundaryId}</p><button onClick={() => setPopup(true)}>Open owned popup</button><CgPopup open={popup} onOpenChange={setPopup} title="Owned approval"><p>This popup owns Escape while it is topmost.</p><button onClick={() => setPopup(false)}>Close approval</button></CgPopup></div>} />;
}

export const ShrinkStart: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen /></Frame> };
export const OverlayOpen: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen mode="overlay" /></Frame> };
export const RetainedMini: Story = { render: () => <Frame><CgDrawer {...drawerContent} miniModeEnabled /></Frame> };
export const EndPosition: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen position="end" /></Frame> };
export const ArabicRtlEnd: Story = { globals: { direction: 'rtl' }, render: () => <Frame><div dir="rtl" style={{ height: '100%' }}><CgDrawer {...drawerContent} defaultOpen mode="overlay" position="end" aria-label="درج التنقل" renderHeader={() => <strong>كاش جير</strong>} renderDrawer={() => <nav style={{ padding: 12 }}>لوحة المعلومات<br />الفواتير<br />الموردون</nav>} renderApplicationContent={() => <main style={{ padding: 20 }}><h2>فواتير المشتريات</h2><p>تخطيط عربي طويل في اتجاه من اليمين إلى اليسار.</p></main>} /></div></Frame> };
export const ResponsiveNarrow: Story = { render: () => <Frame narrow><CgDrawer {...drawerContent} defaultOpen responsiveOverlay responsiveBreakpoint={600} /></Frame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <Frame><CgDrawer {...drawerContent} defaultOpen miniModeEnabled openSize="17rem" /></Frame> };
export const ControlledLifecycle: Story = { render: () => <Frame><ControlledLifecycleExample /></Frame> };
export const NestedOverlayOwnership: Story = { render: () => <Frame><NestedOverlayExample /></Frame> };
export const MultipleOverlayDrawers: Story = { render: () => <Frame><div style={{ position: 'relative', height: '100%' }}><CgDrawer {...drawerContent} id="primary-drawer" defaultOpen mode="overlay" aria-label="Primary drawer" style={{ position: 'absolute', inset: 0 }} /><CgDrawer {...drawerContent} id="secondary-drawer" defaultOpen mode="overlay" position="end" openSize="16rem" aria-label="Secondary drawer" style={{ position: 'absolute', inset: 0 }} renderHeader={(context) => <div><strong>Inspector</strong> <button onClick={() => void context.actions.close()} aria-label="Close inspector">×</button></div>} /></div></Frame> };
export const DisabledOpen: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen disabled /></Frame> };
export const Invisible: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen visible={false} /><p style={{ padding: 20 }}>The Drawer subtree is hidden and inert; visibility is not authorization.</p></Frame> };
export const NoShadingOrDismissal: Story = { render: () => <Frame><CgDrawer {...drawerContent} defaultOpen mode="overlay" applyBackgroundShading={false} closeOnOutsideClick={false} closeOnEscape={false} lockBodyScroll={false} trapFocus={false} /></Frame> };
