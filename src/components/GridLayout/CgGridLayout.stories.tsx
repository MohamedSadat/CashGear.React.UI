import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgGridLayout, CgGridLayoutItem } from './CgGridLayout';

const source = 'CashGear.Blazor.UI@10006424/CashGear.Blazor.UI/Components/CgGridLayout.razor';
const difference = 'React uses immutable row and column descriptors plus compositional items; responsive descriptor changes remain caller-controlled.';
const meta = { title: 'Phase 24/GridLayout', component: CgGridLayout, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgGridLayout>;
export default meta;
type Story = StoryObj<typeof meta>;
const panel = { padding: 16, border: '1px solid var(--cg-border)', borderRadius: 'var(--cg-radius-md)', background: 'var(--cg-surface-raised)' } as const;

function ResponsiveGrid() {
  const [narrow, setNarrow] = useState(false);
  const rows = narrow ? [{ areas: 'header' }, { areas: 'nav' }, { areas: 'content' }] : [{ areas: 'header header' }, { areas: 'nav content' }];
  return <><button type="button" onClick={() => setNarrow((value) => !value)}>Toggle grid width</button><CgGridLayout rows={rows} columns={narrow ? [{}] : [{ width: '10rem' }, {}]} rowGap="12px" columnGap="12px" data-layout={narrow ? 'narrow' : 'wide'}><CgGridLayoutItem area="header" style={panel}>Invoice workspace</CgGridLayoutItem><CgGridLayoutItem area="nav" style={panel}>Navigation</CgGridLayoutItem><CgGridLayoutItem area="content" style={panel}><label>Notes <input aria-label="Grid notes" defaultValue="Retained draft" /></label></CgGridLayoutItem></CgGridLayout></>;
}

export const NamedAreas: Story = { render: () => <StoryFrame source={source} difference={difference}><CgGridLayout rows={[{ areas: 'header header' }, { height: 'minmax(9rem, auto)', areas: 'side body' }, { areas: 'footer footer' }]} columns={[{ width: '12rem' }, {}]} rowGap="12px" columnGap="12px"><CgGridLayoutItem area="header" style={panel}>CashGear ledger</CgGridLayoutItem><CgGridLayoutItem area="side" style={panel}>Filters</CgGridLayoutItem><CgGridLayoutItem area="body" style={panel}>Transactions</CgGridLayoutItem><CgGridLayoutItem area="footer" style={panel}>42 records</CgGridLayoutItem></CgGridLayout></StoryFrame> };
export const IndexedPlacement: Story = { render: () => <StoryFrame source={source} difference={difference}><CgGridLayout rows={[{}, {}]} columns={[{ width: '1fr' }, { width: '2fr' }, { width: '1fr' }]} rowGap="8px" columnGap="8px"><CgGridLayoutItem row={0} column={0} columnSpan={3} style={panel}>Header spanning three columns</CgGridLayoutItem><CgGridLayoutItem row={1} column={1} style={panel}>Indexed body</CgGridLayoutItem></CgGridLayout></StoryFrame> };
export const ResponsiveDescriptors: Story = { render: () => <StoryFrame source={source} difference={difference}><ResponsiveGrid /></StoryFrame> };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><ResponsiveGrid /></StoryFrame> };
export const RtlNarrow: Story = { globals: { direction: 'rtl' }, parameters: { viewport: { defaultViewport: 'mobile1' } }, render: () => <StoryFrame source={source} difference={difference}><div dir="rtl"><CgGridLayout rows={[{ areas: 'head' }, { areas: 'body' }]} rowGap="10px"><CgGridLayoutItem area="head" style={panel}>تخطيط الشبكة</CgGridLayoutItem><CgGridLayoutItem area="body" style={panel}>المحتوى الرئيسي</CgGridLayoutItem></CgGridLayout></div></StoryFrame> };
