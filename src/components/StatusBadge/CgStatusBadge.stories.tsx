import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgStatusBadge } from './CgStatusBadge';

const source = 'CashGear.Blazor.UI/Components/Feedback/StatusBadge/* @ 51d7689a7d407713fa18cb6268158b1a4f461fb3';
const difference = 'React badges are presentation-only inline spans with optional explicit live-region roles and native one-shot dismissal.';
const meta = { title: 'Phase 19/StatusBadge', component: CgStatusBadge, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;
const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

export const TypesAndAppearances: Story = { render: () => frame(<div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, max-content)', gap: 12 }}>{(['soft', 'solid', 'outline'] as const).flatMap((appearance) => (['neutral', 'info', 'success', 'warning', 'error'] as const).map((type) => <CgStatusBadge key={`${appearance}-${type}`} type={type} appearance={appearance}>{type}</CgStatusBadge>))}</div>) };
export const SizesAndShapes: Story = { render: () => frame(<>{(['small', 'medium', 'large'] as const).flatMap((size) => (['rounded', 'pill'] as const).map((shape) => <CgStatusBadge key={`${size}-${shape}`} size={size} shape={shape} type="info">{size} {shape}</CgStatusBadge>))}</>) };
export const IndicatorsAndIcons: Story = { render: () => frame(<><CgStatusBadge type="success" indicator>Connected</CgStatusBadge><CgStatusBadge type="info" icon="check">Verified</CgStatusBadge><CgStatusBadge type="warning" renderIcon={() => <span>!</span>}>Review</CgStatusBadge></>) };
export const RichContent: Story = { render: () => frame(<CgStatusBadge type="info"><strong>12</strong><span> pending approvals</span></CgStatusBadge>) };
function DismissFixture() { const [visible, setVisible] = useState(true); const [message, setMessage] = useState('Ready'); return frame(<div style={{ display: 'grid', gap: 12 }}><CgStatusBadge visible={visible} dismissible type="warning" onDismiss={async () => { await new Promise((resolve) => setTimeout(resolve, 250)); setMessage('Dismissed once'); }}>Needs review</CgStatusBadge><button type="button" onClick={() => { setVisible(false); queueMicrotask(() => setVisible(true)); }}>Re-arm badge</button><output>{message}</output></div>); }
export const DismissibleAndAsync: Story = { render: () => <DismissFixture /> };
export const StatusAndAlertRoles: Story = { render: () => frame(<><CgStatusBadge role="status" accessibleLabel="Synchronization complete" type="success">Synchronized</CgStatusBadge><CgStatusBadge role="alert" accessibleLabel="Payment failed" type="error">Payment failed</CgStatusBadge></>) };
export const DarkCompact: Story = { render: () => frame(<><CgStatusBadge type="success" appearance="solid" indicator>Posted</CgStatusBadge><CgStatusBadge type="warning" appearance="outline" dismissible>Pending</CgStatusBadge></>), globals: { theme: 'dark', density: 'compact' } };
export const ArabicRtl: Story = { render: () => <div dir="rtl">{frame(<><CgStatusBadge type="success" indicator shape="pill">تم الترحيل</CgStatusBadge><CgStatusBadge type="warning" icon="check" dismissible dismissAriaLabel="إخفاء الحالة">قيد المراجعة</CgStatusBadge></>)}</div>, globals: { direction: 'rtl' } };
export const ForcedColors: Story = { render: () => frame(<><CgStatusBadge type="info" appearance="soft">Information</CgStatusBadge><CgStatusBadge type="error" appearance="solid" dismissible>Error</CgStatusBadge></>) };
