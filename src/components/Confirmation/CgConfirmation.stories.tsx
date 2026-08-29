import { useCallback, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../Button';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgConfirmationProvider, useCgConfirmation } from './CgConfirmation';

const source = 'CG.CompLib/Components/Feedback/Confirmation/*; CG.CompLib.Demo/Components/Pages/ConfirmationDemo.razor';
const difference = 'React models confirmations as provider-owned promises with AbortSignal cancellation and a FIFO queue.';
const meta: Meta = { title: 'Phase 16/Confirmation', component: CgConfirmationProvider, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ConfirmationControls({ seed = false }: { seed?: boolean }) {
  const confirmation = useCgConfirmation();
  const seeded = useRef(false);
  const [result, setResult] = useState('No decision');
  const ask = useCallback((destructive = false) => (destructive
    ? confirmation.confirm({ title: 'Delete vendor?', content: 'This permanently removes vendor V-1042 and its draft mappings.', confirmLabel: 'Delete vendor', confirmIntent: 'danger', renderIcon: () => '!' })
    : confirmation.confirm('Post journal JRN-2026-0042?')).then((accepted) => setResult(accepted ? 'Confirmed' : 'Cancelled')), [confirmation]);
  useEffect(() => { if (seed && !seeded.current) { seeded.current = true; void ask(seed); } }, [ask, seed]);
  return <StoryFrame source={source} difference={difference}><CgButton onClick={() => { void ask(); }}>Standard confirmation</CgButton><CgButton intent="danger" onClick={() => { void ask(true); }}>Destructive confirmation</CgButton><CgButton onClick={() => { void ask(); void confirmation.confirm({ title: 'Second request', content: 'This request waits in the FIFO queue.' }); }}>Queue two</CgButton><output aria-label="Confirmation result">{result}</output></StoryFrame>;
}

export const VariantsAndQueueing: Story = { render: () => <CgConfirmationProvider><ConfirmationControls /></CgConfirmationProvider> };
export const DestructiveVisual: Story = { render: () => <CgConfirmationProvider><ConfirmationControls seed /></CgConfirmationProvider> };
export const DarkCompact: Story = { render: () => <CgConfirmationProvider><ConfirmationControls seed /></CgConfirmationProvider>, globals: { theme: 'dark', density: 'compact' } };
export const ArabicRtl: Story = { render: () => <div dir="rtl"><CgConfirmationProvider defaults={{ confirmLabel: 'تأكيد', cancelLabel: 'إلغاء', title: 'تأكيد الإجراء' }}><ConfirmationControls seed /></CgConfirmationProvider></div>, globals: { direction: 'rtl' } };
