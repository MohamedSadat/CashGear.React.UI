import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../Button';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgToastProvider, useCgToast } from './CgToast';

const source = 'CG.CompLib/Components/Feedback/Toast/*; CG.CompLib.Demo/Components/Pages/ToastDemo.razor';
const difference = 'React keeps queues inside the nearest provider and exposes an explicit navigation subscriber instead of importing a router.';
const meta: Meta = { title: 'Phase 16/Toast', component: CgToastProvider, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function ToastControls({ seed = false }: { seed?: boolean }) {
  const toast = useCgToast();
  const seeded = useRef(false);
  useEffect(() => {
    if (!seed || seeded.current) return;
    seeded.current = true;
    toast.success('Invoice INV-2048 was posted.', { title: 'Posting complete', persistent: true, duplicateKey: 'visual-success' });
    toast.warning('Exchange rates are six hours old.', { title: 'Review rates', persistent: true, position: 'bottom-start', duplicateKey: 'visual-warning' });
    toast.error('The approval service is unavailable.', { title: 'Could not approve', persistent: true, important: true, duplicateKey: 'visual-error' });
  }, [seed, toast]);
  return <StoryFrame source={source} difference={difference}><CgButton onClick={() => { toast.success('Journal posted successfully.', { title: 'Success' }); }}>Success toast</CgButton><CgButton onClick={() => { toast.error('Posting failed.', { title: 'Error', important: true }); }}>Error toast</CgButton><CgButton onClick={() => { toast.warning('Five queued notices', { action: { label: 'Retry', onAction: async () => { await new Promise((resolve) => setTimeout(resolve, 700)); }, dismissOnAction: true } }); }}>Async action</CgButton><CgButton onClick={() => { for (let index = 1; index <= 7; index += 1) toast.info(`Queued notice ${index}`, { position: 'bottom-center', persistent: true }); }}>Queue seven</CgButton></StoryFrame>;
}

export const PositionsActionsAndLimits: Story = { render: () => <CgToastProvider maximumVisible={5}><ToastControls /></CgToastProvider> };
export const StableVisualStacks: Story = { render: () => <CgToastProvider><ToastControls seed /></CgToastProvider> };
export const DarkCompact: Story = { render: () => <CgToastProvider direction="ltr"><ToastControls seed /></CgToastProvider>, globals: { theme: 'dark', density: 'compact' } };
export const ArabicRtl: Story = { render: () => <CgToastProvider direction="rtl"><ToastControls seed /></CgToastProvider>, globals: { direction: 'rtl' } };
