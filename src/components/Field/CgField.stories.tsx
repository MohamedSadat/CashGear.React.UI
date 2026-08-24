import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgTextBox } from '../TextBox';
import { CgField } from './CgField';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/FormLayout/CgFormLayoutItem.* + CG.CompLib/Comp/Inputs/CgInputBase.cs';
const difference = 'New React context foundation composes ARIA without cloning the control.';
const meta = { title: 'Phase 1–2/Field', component: CgField, parameters: parityParameters(source, difference), args: { children: <CgTextBox /> } } satisfies Meta<typeof CgField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Account code" description="Used by the general ledger"><CgTextBox defaultValue="1000-CASH" /></CgField></StoryFrame> };
export const RequiredInvalid: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Reference" required errorMessage="Reference is required"><CgTextBox /></CgField></StoryFrame> };
export const DisabledReadOnlyAndArabic: Story = { render: () => <StoryFrame source={source} difference={difference}><CgField label="Disabled" disabled><CgTextBox defaultValue="Locked" /></CgField><CgField label="Read-only" readOnly><CgTextBox defaultValue="1000" /></CgField><div dir="rtl"><CgField label="رمز الحساب" description="رمز دفتر الأستاذ"><CgTextBox /></CgField></div></StoryFrame> };
