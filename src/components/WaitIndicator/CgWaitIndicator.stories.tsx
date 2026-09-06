import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgWaitIndicator } from './CgWaitIndicator';

const source = 'CashGear.Blazor.UI@10006424/CashGear.Blazor.UI/Components/CgWaitIndicator.razor';
const difference = 'React exposes a dependency-free status primitive and shares its private visual with CgLoadingPanel; delay and blocking behavior remain panel responsibilities.';
const meta = { title: 'Phase 24/WaitIndicator', component: CgWaitIndicator, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgWaitIndicator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AnimationsAndSizes: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ display: 'flex', alignItems: 'center', gap: 28 }}><CgWaitIndicator animation="spinner" size="small" ariaLabel="Loading small result" /><CgWaitIndicator animation="dots" size="medium" ariaLabel="Loading result list" /><CgWaitIndicator animation="pulse" size="large" ariaLabel="Loading dashboard" /></div></StoryFrame> };
export const CustomAndDecorative: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWaitIndicator ariaLabel="Importing records"><span aria-hidden="true" style={{ fontSize: 24 }}>↻</span></CgWaitIndicator><span>Custom import visual</span><CgWaitIndicator decorative animation="dots" /><span>Decorative progress beside visible copy</span></StoryFrame> };
export const Hidden: Story = { render: () => <StoryFrame source={source} difference={difference}><CgWaitIndicator visible={false} /><span>No status node is rendered while hidden.</span></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><CgWaitIndicator animation="dots" size="large" ariaLabel="Loading dark dashboard" /></StoryFrame> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgWaitIndicator animation="pulse" ariaLabel="جارٍ التحميل" /></div></StoryFrame> };
