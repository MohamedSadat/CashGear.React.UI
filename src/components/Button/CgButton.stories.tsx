import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from './CgButton';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Buttons/CgButton.*; CG.CompLib.Demo/Components/Pages/ButtonDemo.razor';
const difference = 'Razor Visible is omitted; React callers conditionally render.';
const meta = { title: 'Phase 1–2/Button', component: CgButton, parameters: parityParameters(source, difference), args: { children: 'Save' } } satisfies Meta<typeof CgButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const IntentAppearanceAndSize: Story = { render: () => <StoryFrame source={source} difference={difference}><CgButton size="small">Small</CgButton><CgButton intent="primary" icon="check">Save</CgButton><CgButton intent="danger" appearance="outline">Delete a very long record name</CgButton><CgButton fullWidth>Full width</CgButton></StoryFrame> };
export const LoadingAndDisabled: Story = { render: () => <StoryFrame source={source} difference={difference}><CgButton loading loadingContent="Saving">Save</CgButton><CgButton disabled>Disabled</CgButton><CgButton type="submit">Native submit</CgButton></StoryFrame> };
export const ArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgButton intent="primary" icon="check">حفظ السجل</CgButton></div></StoryFrame> };
