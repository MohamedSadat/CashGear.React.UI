import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgFlyout } from './CgFlyout';
import type { CgFlyoutActions } from './CgFlyout.types';

const source = 'CG.CompLib/Comp/Overlays/CgFlyout.*; CG.CompLib.Demo/Components/Pages/FlyoutDemo.razor';
const difference = 'React uses an SSR-safe body portal and private ownership registry instead of the browser Popover API. Async lifecycle proposals are abortable and controlled props remain authoritative.';
const meta: Meta = { title: 'Phase 9/Flyout', component: CgFlyout, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function AnchoredFlyout({ rtl = false }: { rtl?: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} style={{ minWidth: 520, minHeight: 220, padding: 60 }}>
      <button ref={anchor} type="button">Account actions</button>
      <CgFlyout anchor={anchor} defaultOpen header="Account actions" footer={<button type="button">Done</button>} placement={rtl ? 'bottom-end' : 'bottom-start'}>
        <div style={{ display: 'grid', gap: 8, minWidth: 220 }}><button type="button">View statement</button><button type="button">Export balance</button></div>
      </CgFlyout>
    </div>
  );
}

function ControlledLifecycle() {
  const actions = useRef<CgFlyoutActions>(null);
  const [open, setOpen] = useState(false);
  const [cancel, setCancel] = useState(true);
  const [log, setLog] = useState('Ready');
  return (
    <>
      <button type="button" onClick={() => { void actions.current?.open(); }}>Request Flyout</button>
      <CgFlyout
        anchor={{ x: 220, y: 100 }}
        open={open}
        actionsRef={actions}
        onOpenChange={setOpen}
        onBeforeOpen={async ({ signal }) => {
          setLog('Checking');
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (signal.aborted || cancel) { setCancel(false); setLog('Cancelled'); return false; }
          setLog('Accepted');
          return true;
        }}
      >Controlled content</CgFlyout>
      <output aria-label="Flyout lifecycle log">{log}</output>
    </>
  );
}

function ContentModes() {
  const every = useRef<CgFlyoutActions>(null);
  const first = useRef<CgFlyoutActions>(null);
  const mounted = useRef<CgFlyoutActions>(null);
  return (
    <>
      <button type="button" onClick={() => { void every.current?.toggle(); }}>Toggle every-open</button>
      <button type="button" onClick={() => { void first.current?.toggle(); }}>Toggle first-open</button>
      <button type="button" onClick={() => { void mounted.current?.toggle(); }}>Toggle from-mount</button>
      <CgFlyout anchor={{ x: 100, y: 140 }} actionsRef={every} contentLoadMode="everyOpen">Every-open body</CgFlyout>
      <CgFlyout anchor={{ x: 280, y: 140 }} actionsRef={first} contentLoadMode="firstOpen">First-open body</CgFlyout>
      <CgFlyout anchor={{ x: 460, y: 140 }} actionsRef={mounted} contentLoadMode="fromMount">From-mount body</CgFlyout>
    </>
  );
}

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><AnchoredFlyout /></StoryFrame> };

export const Placements: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ width: 700, height: 360 }}>
      <CgFlyout anchor={{ x: 170, y: 120 }} defaultOpen placement="bottom-start" header="Bottom start">Logical placement</CgFlyout>
      <CgFlyout anchor={{ x: 480, y: 260 }} defaultOpen placement="top-end" header="Top end">Flips and shifts</CgFlyout>
      <CgFlyout anchor={{ x: 90, y: 250 }} defaultOpen placement="right" header="Right">Virtual point</CgFlyout>
      <CgFlyout anchor={{ x: 650, y: 120 }} defaultOpen placement="left" header="Left">Viewport-safe</CgFlyout>
    </div>
  </StoryFrame>,
};

export const ControlledCancellation: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledLifecycle /></StoryFrame> };
export const ContentLoadModes: Story = { render: () => <StoryFrame source={source} difference={difference}><ContentModes /></StoryFrame> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <StoryFrame source={source} difference={difference}><AnchoredFlyout /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><AnchoredFlyout rtl /></StoryFrame> };
