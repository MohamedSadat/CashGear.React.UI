import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButtonGroup } from './CgButtonGroup';

const source = 'CashGear.Blazor.UI/Components/Actions/ButtonGroup/* @ 10006424';
const difference = 'React uses immutable item descriptors and discriminated selection props in place of Razor declaration children.';
const meta: Meta = { title: 'Phase 23/ButtonGroup', component: CgButtonGroup, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

function SelectionFixture() {
  const [view, setView] = useState<string | null>('list');
  const [tools, setTools] = useState<ReadonlyArray<string>>(['labels']);
  return <StoryFrame source={source} difference={difference}>
    <CgButtonGroup selectionMode="single" selectedName={view} onSelectedNameChange={setView} ariaLabel="Invoice view" items={[
      { name: 'list', text: 'List' }, { name: 'board', text: 'Board' }, { name: 'map', text: 'Map' },
    ]} />
    <CgButtonGroup selectionMode="multiple" selectedNames={tools} onSelectedNamesChange={setTools} ariaLabel="Display options" items={[
      { name: 'labels', text: 'Labels' }, { name: 'totals', text: 'Totals' }, { name: 'alerts', text: 'Alerts' },
    ]} />
    <output aria-label="Button group selection">{view}; {tools.join(', ')}</output>
  </StoryFrame>;
}

export const SelectionModes: Story = { render: () => <SelectionFixture /> };
export const States: Story = { render: () => <StoryFrame source={source} difference={difference}>
  <CgButtonGroup ariaLabel="Document commands" items={[{ name: 'save', text: 'Save', intent: 'primary', appearance: 'solid' }, { name: 'send', text: 'Send' }, { name: 'busy', text: 'Posting', loading: true }, { name: 'disabled', text: 'Delete', disabled: true, intent: 'danger' }]} />
  <CgButtonGroup orientation="vertical" ariaLabel="Vertical commands" items={[{ name: 'first', text: 'First' }, { name: 'second', text: 'Second' }, { name: 'third', text: 'Third' }]} />
</StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <SelectionFixture /> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><CgButtonGroup selectionMode="single" defaultSelectedName="list" direction="rtl" ariaLabel="طريقة العرض" items={[{ name: 'list', text: 'قائمة' }, { name: 'board', text: 'لوحة' }, { name: 'map', text: 'خريطة' }]} /></StoryFrame> };
