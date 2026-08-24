import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgIcon } from './CgIcon';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'No exact Razor component';
const difference = 'New React implementation with a deliberately small typed inline-SVG registry.';
const meta = { title: 'Phase 1–2/Icon', component: CgIcon, parameters: parityParameters(source, difference), args: { name: 'search' } } satisfies Meta<typeof CgIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Registry: Story = { render: () => <StoryFrame source={source} difference={difference}>{(['search', 'clear', 'close', 'eye', 'eye-off', 'check', 'minus', 'chevron-up', 'chevron-down'] as const).map((name) => <CgIcon key={name} name={name} label={name} size={28} />)}</StoryFrame> };
export const LogicalRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><span dir="ltr"><CgIcon name="chevron-end" label="LTR next" size={32} /></span><span dir="rtl"><CgIcon name="chevron-end" label="RTL next" size={32} /></span></StoryFrame> };
