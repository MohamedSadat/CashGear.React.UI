import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgProgressBar } from './CgProgressBar';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'No exact Razor component';
const difference = 'New React implementation with native progressbar semantics and logical RTL fill.';
const meta = { title: 'Phase 1–2/ProgressBar', component: CgProgressBar, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgProgressBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DeterminateSizesAndIntents: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 360, display: 'grid', gap: 16 }}><CgProgressBar size="small" value={20} showLabel /><CgProgressBar value={68} showLabel /><CgProgressBar size="large" intent="success" value={100} label="Complete" /></div></StoryFrame> };
export const IndeterminateAndEmptyLabel: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 360 }}><CgProgressBar label="Loading inventory" /></div></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl" style={{ width: 360 }}><CgProgressBar value={72} label="اكتمل ٧٢٪" /></div></StoryFrame> };
