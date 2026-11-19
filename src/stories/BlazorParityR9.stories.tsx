import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef } from 'react';
import { CgFlyout } from '../components/Flyout';
import { StoryFrame, parityParameters } from './storySupport';

const source = 'CashGear.Blazor.UI/Infrastructure/Overlays: CgFlyout.razor.js position() (commit 0e148f5a, natural size under the popup\'s own MaxHeight)';
const difference = 'Shared by every PositionedOverlay surface outside the editor drop-downs: CgFlyout, DropDownBox, DateEdit, TimeEdit and tooltips without candidates.';
const meta: Meta = { title: 'Blazor parity 2026-11/Overlay placement', component: CgFlyout, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const accounts = Array.from({ length: 24 }, (_, index) => `${4100 + index * 10} Revenue account ${index + 1}`);

function CappedListNearTheBottom() {
  const anchor = useRef<HTMLButtonElement>(null);
  return <div style={{ paddingBlockStart: 360 }}>
    <button ref={anchor} type="button" data-testid="capped-anchor">Account</button>
    <CgFlyout anchor={anchor} defaultOpen aria-label="Accounts" data-testid="capped-flyout">
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>{accounts.map((name) => <li key={name} style={{ padding: '6px 10px' }}>{name}</li>)}</ul>
    </CgFlyout>
  </div>;
}

/** A 24-row list under the flyout's 20rem cap opens below its field whenever 20rem fits there. */
export const CappedListOpensBelow: Story = { render: () => <StoryFrame source={source} difference={difference}><CappedListNearTheBottom /></StoryFrame> };
