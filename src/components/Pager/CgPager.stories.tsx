import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgPager } from './CgPager';
import type { CgPagerMode } from './CgPager.types';

const meta: Meta = { title: 'Phase 15/Pager', component: CgPager };
export default meta;
type Story = StoryObj;

function PagerExample({ mode = 'numericButtons', direction = 'ltr' }: { readonly mode?: CgPagerMode; readonly direction?: 'ltr' | 'rtl' }) {
  const [pageIndex, setPageIndex] = useState(5); const [pageSize, setPageSize] = useState(25);
  return <CgPager pageIndex={pageIndex} onPageIndexChange={setPageIndex} pageSize={pageSize} onPageSizeChange={setPageSize} pageCount={24} totalItemCount={587} mode={mode} showPageSizeSelector showSummary preserveFirstVisibleItemOnPageSizeChange direction={direction} />;
}
export const NumericButtons: Story = { render: () => <PagerExample /> };
export const InputBox: Story = { render: () => <PagerExample mode="inputBox" /> };
export const PageStatus: Story = { render: () => <PagerExample mode="pageStatus" /> };
export const AutoResponsive: Story = { render: () => <div style={{ width: 430 }}><PagerExample mode="auto" /></div> };
export const LoadingReadOnlyDisabled: Story = { render: () => <div style={{ display: 'grid', gap: 16 }}><CgPager pageIndex={2} pageSize={25} pageCount={12} loading /><CgPager pageIndex={2} pageSize={25} pageCount={12} readOnly /><CgPager pageIndex={2} pageSize={25} pageCount={12} disabled /></div> };
export const CustomTemplates: Story = { render: () => <CgPager pageIndex={2} pageSize={20} pageCount={8} totalItemCount={153} mode="numericButtons" showSummary renderSummary={({ range, totalItemCount }) => `Invoices ${range.first}–${range.last} of ${String(totalItemCount)}`} renderNumericButton={({ displayPageNumber, active }) => <span>{active ? `[${displayPageNumber}]` : displayPageNumber}</span>} /> };
export const DarkCompact: Story = { globals: { theme: 'dark', density: 'compact' }, render: () => <PagerExample /> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => <div style={{ width: 410 }}><PagerExample mode="auto" direction="rtl" /></div> };
export const ReducedMotion: Story = { render: () => <PagerExample mode="auto" /> };
