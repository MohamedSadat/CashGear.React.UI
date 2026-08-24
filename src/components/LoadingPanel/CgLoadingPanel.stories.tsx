import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../Button';
import { CgLoadingPanel } from './CgLoadingPanel';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Overlays/CgLoadingPanel.*; CG.CompLib.Demo/Components/Pages/LoadingPanelDemo.razor';
const difference = 'Focus containment is opt-in through trapFocus; external portal geometry is tracked without requiring a positioning context.';
const meta = { title: 'Phase 1–2/LoadingPanel', component: CgLoadingPanel, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgLoadingPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledOverlay() { const [visible, setVisible] = useState(true); return <CgLoadingPanel visible={visible} onVisibleChange={setVisible} mode="overlay" dismissOnClick dismissOnEscape text="Loading orders…"><div style={{ width: 320, height: 120, padding: 16, border: '1px solid var(--cg-border)' }}><CgButton onClick={() => setVisible(true)}>Show</CgButton> Blocked content</div></CgLoadingPanel>; }
function FocusFixture() { const [visible, setVisible] = useState(false); return <><CgButton onClick={() => setVisible(true)}>Show focus panel</CgButton><CgLoadingPanel visible={visible} onVisibleChange={setVisible} mode="overlay" trapFocus dismissOnEscape indicator="custom" customIndicator={<><CgButton>First action</CgButton><CgButton>Last action</CgButton></>} text=""><div style={{ width: 360, minHeight: 140 }}>Focus returns to the opener after Escape.</div></CgLoadingPanel></>; }
export const ControlledBlockingOverlay: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledOverlay /></StoryFrame> };
export const IndicatorsAndInline: Story = { render: () => <StoryFrame source={source} difference={difference}><CgLoadingPanel defaultVisible mode="inline" indicator="spinner" /><CgLoadingPanel defaultVisible mode="inline" indicator="dots" text="Loading inventory" /><CgLoadingPanel defaultVisible mode="inline" indicator="pulse" text="جارٍ التحميل" /></StoryFrame> };
export const NonblockingAndDelayed: Story = { render: () => <StoryFrame source={source} difference={difference}><CgLoadingPanel visible mode="overlay" blocking={false} shading={false} showDelay={300} minimumVisibleDuration={500} text="Nonblocking"><div style={{ width: 320, minHeight: 100 }}>Interactive content remains available.</div></CgLoadingPanel></StoryFrame> };
export const FocusContainment: Story = { render: () => <StoryFrame source={source} difference={difference}><CgLoadingPanel visible mode="overlay" trapFocus indicator="custom" customIndicator={<><CgButton>First action</CgButton><CgButton>Last action</CgButton></>} text=""><div style={{ width: 360, minHeight: 140 }}>Focus is contained while this blocking panel is visible.</div></CgLoadingPanel></StoryFrame> };
export const PortalGeometry: Story = { render: () => <StoryFrame source={source} difference={difference}><div id="loading-story-target" style={{ position: 'relative', width: 360, height: 160, overflow: 'auto', border: '1px solid var(--cg-border)' }}><div style={{ width: 520, height: 260, padding: 16 }}>Scrollable external target</div></div><CgLoadingPanel visible mode="portal" target="#loading-story-target" text="Covering target" /></StoryFrame> };
export const FocusReturnFixture: Story = { render: () => <StoryFrame source={source} difference={difference}><FocusFixture /></StoryFrame> };
