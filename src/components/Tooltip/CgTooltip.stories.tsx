import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../Button';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgTooltip } from './CgTooltip';

const source = 'CashGear.Blazor.UI/Components/Feedback/Tooltip/* @ 51d7689a7d407713fa18cb6268158b1a4f461fb3';
const difference = 'React lazily portals one role=tooltip surface through the shared positioned-overlay and overlay registry.';
const meta: Meta = { title: 'Phase 19/Tooltip', component: CgTooltip, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;
const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

export const HoverFocus: Story = { render: () => frame(<CgTooltip text="Reconciles the selected ledger account." openDelay={120}><CgButton>Account help</CgButton></CgTooltip>) };
export const Click: Story = { render: () => frame(<CgTooltip trigger="click" text="Press Escape or click elsewhere to close."><CgButton>Click for details</CgButton></CgTooltip>) };
function ManualFixture() { const [visible, setVisible] = useState(false); return frame(<><CgButton onClick={() => setVisible((value) => !value)}>Toggle manual tooltip</CgButton><CgTooltip trigger="manual" visible={visible} onVisibleChange={setVisible} text="Controlled by application state."><span style={{ borderBlockEnd: '1px dotted currentColor' }}>Monthly close</span></CgTooltip></>); }
export const ManualControlled: Story = { render: () => <ManualFixture /> };
export const InteractiveContent: Story = { render: () => frame(<CgTooltip interactive trigger="click" renderContent={() => <span>Invoice is overdue. <a href="#invoice">Open invoice</a></span>}><CgButton>Invoice status</CgButton></CgTooltip>) };
export const ExplicitPlacements: Story = { render: () => frame(<div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, max-content)', gap: '4rem 7rem', padding: '4rem 7rem' }}>{(['top', 'bottom', 'start', 'end'] as const).map((position) => <CgTooltip key={position} position={position} defaultVisible text={`${position} placement`}><CgButton>{position}</CgButton></CgTooltip>)}</div>) };
export const EdgeFlipAndShift: Story = { render: () => <div style={{ minBlockSize: 440, display: 'grid', gridTemplateColumns: '1fr 1fr', alignContent: 'space-between', justifyItems: 'stretch' }}><CgTooltip defaultVisible position="top" text="Shifted inside the visual viewport"><span>Top start edge</span></CgTooltip><CgTooltip defaultVisible position="end" text="Flips when logical end cannot fit"><span style={{ justifySelf: 'end' }}>Logical end edge</span></CgTooltip></div> };
export const LongWrappingContent: Story = { render: () => frame(<CgTooltip defaultVisible maxWidth="16rem" text="A deliberately long tooltip explains that posted entries cannot be edited until the accounting period is reopened by an authorized operator."><CgButton>Posting policy</CgButton></CgTooltip>) };
export const Disabled: Story = { render: () => frame(<CgTooltip disabled defaultVisible text="This remains suppressed"><CgButton>Disabled tooltip</CgButton></CgTooltip>) };
export const MultipleIndependentInstances: Story = { render: () => frame(<>{['Customer', 'Invoice', 'Payment'].map((label) => <CgTooltip key={label} trigger="click" text={`${label} guidance`}><CgButton>{label}</CgButton></CgTooltip>)}</>) };
export const DarkCompact: Story = { render: () => frame(<CgTooltip defaultVisible text="Compact dark tooltip"><CgButton>Dark target</CgButton></CgTooltip>), globals: { theme: 'dark', density: 'compact' } };
export const ArabicRtl: Story = { render: () => <div dir="rtl">{frame(<CgTooltip defaultVisible position="end" text="معلومة إضافية عن حالة الفاتورة"><CgButton>تفاصيل الحالة</CgButton></CgTooltip>)}</div>, globals: { direction: 'rtl' } };
export const ReducedMotion: Story = { render: () => frame(<CgTooltip defaultVisible text="No motion is required to understand this content."><CgButton>Reduced motion</CgButton></CgTooltip>), parameters: { backgrounds: { default: 'light' } } };
