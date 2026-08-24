import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgRadio } from './CgRadio';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgRadio.*; CG.CompLib.Demo/Components/Pages/RadioDemo.razor';
const difference = 'Native string/number values replace C# conversion; read-only activation is suppressed.';
const meta = { title: 'Phase 1–2/Radio', component: CgRadio, parameters: parityParameters(source, difference), args: { value: 'standard' } } satisfies Meta<typeof CgRadio>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NativeGroup: Story = { render: () => <StoryFrame source={source} difference={difference}><CgRadio name="shipping" value="standard" label="Standard" defaultChecked /><CgRadio name="shipping" value="express" label="Express" description="Next working day" /><CgRadio name="shipping" value="disabled" label="Disabled" disabled /></StoryFrame> };
export const StatesSizesAndArabic: Story = { render: () => <StoryFrame source={source} difference={difference}><CgRadio name="sizes" value="small" size="small" label="Small" /><CgRadio name="sizes" value="large" size="large" label="Large" /><CgRadio name="readonly" value="locked" defaultChecked readOnly label="Read only" /><CgRadio name="invalid" value="required" required validationState="error" label="Required invalid" /><div dir="rtl"><CgRadio name="arabic" value="sea" label="شحن بحري" /></div></StoryFrame> };
