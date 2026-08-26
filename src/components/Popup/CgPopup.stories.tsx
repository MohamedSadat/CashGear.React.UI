import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createPortal } from 'react-dom';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgFlyout } from '../Flyout';
import { CgPopup } from './CgPopup';
import type { CgPopupActions } from './CgPopup.types';

const source = 'CG.CompLib/Comp/Overlays/CgPopup.*; CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor';
const difference = 'React composes a body-portalled modal surface rather than a native top-layer element; owned third-party portals use the exposed boundary ID. Focus isolation and lifecycle cancellation are managed in React.';
const meta: Meta = { title: 'Phase 9/Popup', component: CgPopup, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function StandardPopup({ transparent = false }: { transparent?: boolean }) {
  return (
    <CgPopup defaultOpen headerText="Approve journal" footer={<><button type="button">Cancel</button><button type="button">Approve</button></>} shading={transparent ? 'transparent' : 'visible'}>
      <p>Review journal JRN-2026-0042 before posting.</p><label>Comment <input data-cg-autofocus defaultValue="Ready for approval" /></label>
    </CgPopup>
  );
}

function ControlledPopup() {
  const actions = useRef<CgPopupActions>(null);
  const [open, setOpen] = useState(false);
  const [cancelClose, setCancelClose] = useState(true);
  return (
    <>
      <button type="button" onClick={() => { void actions.current?.open(); }}>Open controlled Popup</button>
      <CgPopup open={open} actionsRef={actions} onOpenChange={setOpen} onBeforeClose={async ({ signal }) => {
        await new Promise((resolve) => setTimeout(resolve, 120));
        if (signal.aborted) return false;
        if (!cancelClose) return true;
        setCancelClose(false);
        return false;
      }} headerText="Controlled lifecycle">The first close proposal is cancelled.</CgPopup>
    </>
  );
}

function NestedFlyout() {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <CgPopup defaultOpen closeOnOutsideClick headerText="Customer details" footerText="Nested portals share ownership">
      <button ref={anchor} type="button">More customer actions</button>
      <CgFlyout anchor={anchor} defaultOpen header="Customer actions" placement="bottom-start"><button type="button" data-cg-autofocus>Open ledger</button></CgFlyout>
    </CgPopup>
  );
}

function ContentModes() {
  return <><CgPopup contentLoadMode="fromMount" headerText="From mount">Retained from mount</CgPopup><CgPopup contentLoadMode="firstOpen" headerText="First open">Retained after first open</CgPopup><CgPopup contentLoadMode="everyOpen" headerText="Every open">Created per open</CgPopup></>;
}

function FocusTrapAndReturnFixture() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Launch focus Popup</button>
      <CgPopup open={open} onOpenChange={setOpen} headerText="Focus contract">
        <button type="button" data-cg-autofocus>First modal action</button>
        <button type="button">Last modal action</button>
      </CgPopup>
    </>
  );
}

function ThirdPartyBoundaryPortal() {
  return (
    <CgPopup
      defaultOpen
      closeOnOutsideClick
      headerText="Boundary ownership"
      renderBody={({ boundaryId }) => (
        <>
          <button type="button" data-cg-autofocus>Inside modal</button>
          {typeof document === 'undefined' ? null : createPortal(
            <button
              type="button"
              data-cg-overlay-boundary={boundaryId}
              style={{ position: 'fixed', insetBlockEnd: 32, insetInlineEnd: 32, zIndex: 'calc(var(--cg-z-modal) + 1000)' }}
            >External owned action</button>,
            document.body,
          )}
        </>
      )}
    />
  );
}

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><StandardPopup /></StoryFrame> };
export const ControlledAndCancellation: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledPopup /></StoryFrame> };
export const NestedFlyoutOwnership: Story = { render: () => <StoryFrame source={source} difference={difference}><NestedFlyout /></StoryFrame> };
export const DragAndResize: Story = { render: () => <StoryFrame source={source} difference={difference}><CgPopup defaultOpen headerText="Resizable posting dialog" defaultPosition={{ x: 180, y: 100 }} width={460} height={300} allowDrag allowResize><p>Drag the header or any of the eight resize edges.</p><button type="button" data-cg-autofocus>Focusable action</button></CgPopup></StoryFrame> };
export const TransparentDark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><StandardPopup transparent /></StoryFrame> };
export const AdaptiveNarrow: Story = { parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <StoryFrame source={source} difference={difference}><CgPopup defaultOpen headerText="Adaptive approval" adaptive width={620}><p>The modal keeps a 12px viewport reachability margin.</p><button type="button">Continue</button></CgPopup></StoryFrame> };
export const ContentLoadModes: Story = { render: () => <StoryFrame source={source} difference={difference}><ContentModes /></StoryFrame> };
export const FocusTrapAndReturn: Story = { render: () => <StoryFrame source={source} difference={difference}><FocusTrapAndReturnFixture /></StoryFrame> };
export const ThirdPartyBoundary: Story = { render: () => <StoryFrame source={source} difference={difference}><ThirdPartyBoundaryPortal /></StoryFrame> };
