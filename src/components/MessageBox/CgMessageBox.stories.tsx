import { useCallback, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../Button';
import { CgConfirmationProvider, useCgConfirmation } from '../Confirmation';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgMessageBox } from './CgMessageBox';

const source = 'CashGear.Blazor.UI@f8e7235b/CashGear.Blazor.UI/Components/CgMessageBox.razor';
const difference = 'React offers an alert-only declarative Popup composition and a Promise<void> alert method on the existing identity-safe confirmation FIFO.';
const meta = { title: 'Phase 24/MessageBox', component: CgMessageBox, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgMessageBox>;
export default meta;
type Story = StoryObj<typeof meta>;

function MixedQueue({ seed = false }: { seed?: boolean }) {
  const api = useCgConfirmation();
  const seeded = useRef(false);
  const [result, setResult] = useState('Ready');
  const queue = useCallback(() => { void api.alert('The import completed successfully.', 'Import complete').then(() => setResult('Alert closed')); void api.confirm({ title: 'Post imported batch?', content: 'This confirmation waits behind the alert.' }).then((accepted) => setResult(accepted ? 'Batch posted' : 'Post cancelled')); }, [api]);
  useEffect(() => { if (seed && !seeded.current) { seeded.current = true; queue(); } }, [queue, seed]);
  return <><CgButton onClick={queue}>Queue alert and confirmation</CgButton><output aria-label="Dialog queue result">{result}</output></>;
}

function ControlledMessage() {
  const [open, setOpen] = useState(true);
  return <><CgButton onClick={() => setOpen(true)}>Show controlled message</CgButton><CgMessageBox open={open} onOpenChange={setOpen} title="Controlled alert" message="The parent owns visibility." renderIcon={() => 'i'} /></>;
}

export const Declarative: Story = { render: () => <StoryFrame source={source} difference={difference}><CgMessageBox defaultOpen title="Import complete" message="Twelve vendor records were imported." renderIcon={() => '✓'} /></StoryFrame> };
export const Controlled: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledMessage /></StoryFrame> };
export const MixedAlertConfirmationQueue: Story = { render: () => <StoryFrame source={source} difference={difference}><CgConfirmationProvider alertDefaults={{ actionLabel: 'Acknowledge' }}><MixedQueue /></CgConfirmationProvider></StoryFrame> };
export const SeededQueue: Story = { render: () => <StoryFrame source={source} difference={difference}><CgConfirmationProvider><MixedQueue seed /></CgConfirmationProvider></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><CgMessageBox defaultOpen title="Nightly close" message="The ledger close finished without errors." renderIcon={() => '✓'} /></StoryFrame> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgMessageBox defaultOpen title="رسالة" message="اكتمل ترحيل القيود بنجاح." actionLabel="حسنًا" closeButtonAriaLabel="إغلاق" renderIcon={() => '✓'} width="min(420px, calc(100vw - 24px))" /></div></StoryFrame> };
