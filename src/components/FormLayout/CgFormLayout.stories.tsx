import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgMemo } from '../Memo';
import { CgPopup } from '../Popup';
import { CgTextBox } from '../TextBox';
import { CgWindow } from '../Window';
import { CgFormLayout, CgFormLayoutGroup, CgFormLayoutItem, CgFormLayoutTabs } from './CgFormLayout';
import type { CgFormLayoutTabDescriptor } from './CgFormLayout.types';

const source = 'CG.CompLib/Comp/FormLayout/*; CG.CompLib.Demo/Components/Pages/FormLayoutDemo.razor';
const difference = 'React uses context composition and descriptor tabs; nested CSS containers replace Razor declaration registration and viewport assumptions.';
const meta: Meta<typeof CgFormLayout> = { title: 'Phase 11/FormLayout', component: CgFormLayout, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj<typeof meta>;

function BasicFields() {
  return <>
    <CgFormLayoutItem caption="Customer"><CgTextBox defaultValue="Northwind Traders" fullWidth /></CgFormLayoutItem>
    <CgFormLayoutItem caption="Account"><CgTextBox defaultValue="110100" fullWidth /></CgFormLayoutItem>
    <CgFormLayoutItem caption="Reference" md={4}><CgTextBox fullWidth /></CgFormLayoutItem>
    <CgFormLayoutItem caption="Posting date" md={4}><input type="date" aria-label="Posting date" /></CgFormLayoutItem>
    <CgFormLayoutItem caption="Currency" md={4}><CgTextBox defaultValue="EGP" fullWidth /></CgFormLayoutItem>
    <CgFormLayoutItem caption="Notes" md={12}><CgMemo fullWidth /></CgFormLayoutItem>
  </>;
}

export const StandardResponsive: Story = { render: () => <StoryFrame source={source} difference={difference}><CgFormLayout><BasicFields /></CgFormLayout></StoryFrame> };
export const HorizontalCaptions: Story = { render: () => <CgFormLayout captionPosition="horizontal" captionWidth="8rem"><BasicFields /></CgFormLayout> };
export const NarrowStacked: Story = { render: () => <div style={{ width: 420, border: '1px dashed currentColor', padding: 12 }}><CgFormLayout captionPosition="horizontal"><BasicFields /></CgFormLayout></div> };
export const ExactContainerBoundaries: Story = { render: () => <CgFormLayout captionPosition="horizontal" data-testid="boundary-layout"><CgFormLayoutItem data-testid="boundary-item" caption="Boundary field" xs={12} sm={11} md={9} lg={7} xl={5} xxl={3}><CgTextBox fullWidth /></CgFormLayoutItem></CgFormLayout> };
export const NestedCollapsibleGroup: Story = { render: () => <CgFormLayout><CgFormLayoutGroup caption="Address" collapsible defaultExpanded><CgFormLayoutItem caption="Street"><CgTextBox fullWidth /></CgFormLayoutItem><CgFormLayoutItem caption="City"><CgTextBox fullWidth /></CgFormLayoutItem></CgFormLayoutGroup></CgFormLayout> };

const tabs: ReadonlyArray<CgFormLayoutTabDescriptor> = [
  { key: 'general', text: 'General', content: <><CgFormLayoutItem caption="Name"><CgTextBox fullWidth /></CgFormLayoutItem><CgFormLayoutItem caption="Description"><CgMemo fullWidth /></CgFormLayoutItem></> },
  { key: 'posting', text: 'Posting', captionPosition: 'horizontal', content: <CgFormLayoutItem caption="Ledger account"><CgTextBox fullWidth /></CgFormLayoutItem> },
];
export const TabbedSections: Story = { render: () => <CgFormLayout><CgFormLayoutTabs tabs={tabs} /></CgFormLayout> };

function ControlledGroup() { const [expanded, setExpanded] = useState(true); return <CgFormLayout><CgFormLayoutGroup caption="Controlled group" collapsible expanded={expanded} onExpandedChange={setExpanded}><BasicFields /></CgFormLayoutGroup></CgFormLayout>; }
export const Controlled: Story = { render: () => <ControlledGroup /> };
export const PopupContainer: Story = { render: () => <CgPopup defaultOpen headerText="Narrow form" width={460}><CgFormLayout captionPosition="horizontal"><BasicFields /></CgFormLayout></CgPopup> };
export const WindowContainer: Story = { render: () => <CgWindow defaultOpen headerText="Modeless form" width={500} defaultPosition={{ x: 120, y: 90 }}><CgFormLayout captionPosition="horizontal"><BasicFields /></CgFormLayout></CgWindow> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <CgFormLayout size="small"><BasicFields /></CgFormLayout> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <div dir="rtl"><CgFormLayout direction="rtl" captionPosition="horizontal"><CgFormLayoutItem caption="اسم العميل"><CgTextBox fullWidth /></CgFormLayoutItem><CgFormLayoutItem caption="ملاحظات"><CgMemo fullWidth /></CgFormLayoutItem></CgFormLayout></div> };
