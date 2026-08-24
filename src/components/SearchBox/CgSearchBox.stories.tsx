import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgField } from '../Field';
import { CgSearchBox } from './CgSearchBox';
import { StoryFrame, parityParameters } from '../../stories/storySupport';

const source = 'Working-tree CG.CompLib/Comp/Inputs/CgSearchBox.*; CG.CompLib.Demo/Components/Pages/SearchBoxDemo.razor';
const difference = 'No data fetching; the caller receives a raw query, reason, monotonic request ID, and AbortSignal.';
const meta = { title: 'Phase 1–2/SearchBox', component: CgSearchBox, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSearchBox>;
export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() { const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); return <CgField label="Controlled async search"><CgSearchBox query={query} onQueryChange={setQuery} resultStatus={status} minimumLength={2} minimumLengthMessage={(minimum) => `Enter at least ${minimum} characters`} onSearch={async (next, { signal }) => { await new Promise((resolve) => setTimeout(resolve, 400)); if (!signal.aborted) setStatus(`${next}: 3 results`); }} /></CgField>; }
export const ControlledLoadingAndMinimum: Story = { render: () => <StoryFrame source={source} difference={difference}><ControlledExample /></StoryFrame> };
export const UncontrolledClearAndSubmit: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSearchBox aria-label="Uncontrolled search" defaultQuery="orders" searchMode="submit" escapeClears searchOnClear clearButton="always" /><CgSearchBox aria-label="Loading" loading loadingText="Searching orders…" /></StoryFrame> };
export const StatesAndArabicRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSearchBox aria-label="Read only" defaultQuery="Locked" readOnly /><CgSearchBox aria-label="Disabled" disabled /><CgSearchBox aria-label="Required invalid" required validationState="error" /><div dir="rtl"><CgSearchBox aria-label="بحث عربي" searchMode="submit" minimumLength={2} minimumLengthMessage="أدخل حرفين على الأقل" placeholder="ابحث" /></div></StoryFrame> };
export const Keyboard: Story = { render: () => <StoryFrame source={source} difference={difference}><CgSearchBox aria-label="Keyboard search" defaultQuery="invoice" searchMode="submit" escapeClears /><small>Press Enter to submit and Escape to clear.</small></StoryFrame> };
