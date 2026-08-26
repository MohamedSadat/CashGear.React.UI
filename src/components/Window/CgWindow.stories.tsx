import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgWindow } from './CgWindow';
import type { CgWindowActions } from './CgWindow.types';

const source = 'CG.CompLib/Comp/Overlays/CgWindow.*; CG.CompLib.Demo/Components/Pages/PopupWindowDemo.razor';
const difference = 'React windows are modeless body portals with a shared paint-order registry. Focus entry raises only the owning modeless root and never crosses an active modal layer.';
const meta: Meta = { title: 'Phase 9/Window', component: CgWindow, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function WindowActions() {
  const actions = useRef<CgWindowActions>(null);
  const [position, setPosition] = useState({ x: 180, y: 110 });
  return (
    <>
      <button type="button" id="window-near-anchor" onClick={() => { void actions.current?.showNear('#window-near-anchor'); }}>Show nearby</button>
      <button type="button" onClick={() => actions.current?.moveTo(360, 160)}>Move window</button>
      <CgWindow actionsRef={actions} defaultOpen position={position} onPositionChange={setPosition} headerText="Controlled position">Position: {position.x}, {position.y}</CgWindow>
    </>
  );
}

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWindow defaultOpen headerText="Inventory inspector" defaultPosition={{ x: 180, y: 100 }} footerText="Modeless workspace"><p>Inspect stock while continuing work behind this window.</p><button type="button">Refresh</button></CgWindow></StoryFrame> };
export const MultipleWindows: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWindow defaultOpen headerText="Journal lines" defaultPosition={{ x: 90, y: 80 }} width={360}><button type="button">Add line</button></CgWindow><CgWindow defaultOpen headerText="Account lookup" defaultPosition={{ x: 390, y: 180 }} width={340}><button type="button" data-cg-autofocus>Select account</button></CgWindow><CgWindow defaultOpen headerText="Posting notes" defaultPosition={{ x: 660, y: 90 }} width={300}>Notes remain modeless.</CgWindow></StoryFrame> };
export const ControlledActions: Story = { render: () => <StoryFrame source={source} difference={difference}><WindowActions /></StoryFrame> };
export const DragAndResize: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWindow defaultOpen headerText="Resizable analysis" defaultPosition={{ x: 220, y: 100 }} width={500} height={320} allowResize><p>Eight physical resize edges retain RTL-correct cursors.</p><button type="button">Analyze</button></CgWindow></StoryFrame> };
export const DarkRtl: Story = { globals: { theme: 'dark', density: 'compact', direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgWindow defaultOpen headerText="نافذة الحساب" defaultPosition={{ x: 320, y: 100 }} width={400} allowResize><button type="button">تحديث</button></CgWindow></div></StoryFrame> };
export const ContentLoadModes: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWindow contentLoadMode="fromMount" headerText="From mount">Retained hidden content</CgWindow><CgWindow contentLoadMode="firstOpen" headerText="First open">Retained after opening</CgWindow><CgWindow contentLoadMode="everyOpen" headerText="Every open">Recreated content</CgWindow></StoryFrame> };
