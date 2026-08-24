import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgMemo } from './CgMemo';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'CG.CompLib/Comp/Inputs/CgMemo.*; CG.CompLib.Demo/Components/Pages/MemoDemo.razor';
const difference = 'Uses a native textarea plus ResizeObserver instead of DevExpress resizing.';
const meta = { title: 'Phase 1–2/Memo', component: CgMemo, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgMemo>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [value, setValue] = useState('Line one'); return <CgField label="Controlled memo"><CgMemo value={value} onValueChange={setValue} maxLength={120} showCounter clearButton="auto" resizeMode="auto" maxRows={6} /></CgField>; }
export const Controlled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /></StoryFrame> };
export const UncontrolledAndLong: Story = { render: () => <StoryFrame source={source} difference={difference}><CgMemo aria-label="Empty memo" /><CgMemo aria-label="Long memo" defaultValue={'A long line of content. '.repeat(10)} rows={5} /></StoryFrame> };
export const StatesAndArabic: Story = { render: () => <StoryFrame source={source} difference={difference}><CgMemo aria-label="Read only" readOnly defaultValue="Locked" /><CgMemo aria-label="Disabled" disabled /><CgMemo aria-label="Invalid required" required validationState="error" /><div dir="rtl"><CgMemo aria-label="ملاحظات" placeholder="أدخل الملاحظات" /></div></StoryFrame> };
