import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgStepper } from './CgStepper';
import type { CgStepDescriptor } from './CgStepper.types';

const source = 'CG.CompLib/Comp/Stepper/*; CG.CompLib.Demo/Components/Pages/StepperDemo.razor';
const difference = 'Immutable keyed step descriptors replace CgStep declarations and all guard proposals carry AbortSignal.';
const meta: Meta<typeof CgStepper> = { title: 'Phase 11/Stepper', component: CgStepper, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj<typeof meta>;
const steps: ReadonlyArray<CgStepDescriptor> = [
  { key: 'customer', label: 'Customer', description: 'Choose account', validationState: 'success', content: <p>Customer editor</p> },
  { key: 'lines', label: 'Lines', description: 'Add order lines', content: <p>Line editor</p> },
  { key: 'review', label: 'Review', optional: true, content: <p>Review order</p> },
  { key: 'post', label: 'Post', skipped: true },
];
function Controlled() { const [key, setKey] = useState<string | null>('customer'); return <CgStepper steps={steps} selectedKey={key} onSelectedKeyChange={setKey} renderActiveContent />; }
export const ControlledHorizontal: Story = { render: () => <StoryFrame source={source} difference={difference}><div style={{ width: 720 }}><Controlled /></div></StoryFrame> };
export const Vertical: Story = { args: { steps, orientation: 'vertical', defaultSelectedKey: 'lines', renderActiveContent: true } };
export const ValidationOptionalSkipped: Story = { args: { steps: steps.map((step, index) => index === 1 ? { ...step, validationState: 'error' } : step), defaultSelectedKey: 'lines' } };
export const ReadOnly: Story = { args: { steps, readOnly: true, defaultSelectedKey: 'lines' } };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, args: { steps: [{ key: 'عميل', label: 'العميل' }, { key: 'سطور', label: 'السطور' }, { key: 'مراجعة', label: 'المراجعة', optional: true }], direction: 'rtl' } };
export const NarrowScroll: Story = { render: () => <div style={{ width: 320 }}><CgStepper steps={steps} defaultSelectedKey="lines" renderActiveContent /></div> };
export const Empty: Story = { args: { steps: [], emptyContent: <p>No process steps.</p> } };
