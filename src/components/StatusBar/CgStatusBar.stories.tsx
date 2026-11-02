import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgSlider } from '../Slider';
import { CgStatusBar } from './CgStatusBar';
import type { CgStatusBarItem } from './CgStatusBar.types';

const source = 'No exact Razor component';
const difference = 'New React implementation: a thin polite live region whose items truncate, then hide by priority.';
const meta = { title: 'Phase 34/StatusBar', component: CgStatusBar, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgStatusBar>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 16, inlineSize: '100%' }}>{content}</div></StoryFrame>;

const sheetItems = (labels: { ready: string; average: string; count: string; sum: string; caps: string }): ReadonlyArray<CgStatusBarItem> => [
  { key: 'ready', content: labels.ready, priority: 10, 'data-testid': 'status-ready' },
  { key: 'caps', content: labels.caps, onClick: () => undefined, tooltip: labels.caps, separator: true, priority: 1, 'data-testid': 'status-caps' },
  { key: 'average', content: labels.average, align: 'end', priority: 2, 'data-testid': 'status-average' },
  { key: 'count', content: labels.count, align: 'end', separator: true, priority: 1, 'data-testid': 'status-count' },
  { key: 'sum', content: labels.sum, align: 'end', separator: true, priority: 3, 'data-testid': 'status-sum' },
];

const english = sheetItems({ ready: 'Ready', caps: 'Caps Lock', average: 'Average: 12.5', count: 'Count: 4', sum: 'Sum: 50' });
const arabic = sheetItems({ ready: 'جاهز', caps: 'الأحرف الكبيرة', average: 'المتوسط: ١٢٫٥', count: 'العدد: ٤', sum: 'المجموع: ٥٠' });
const longText = 'Opening a very large workbook with many sheets, this message is far longer than the bar can show on one line';

function ZoomStatusBar({ ready, zoom, zoomOut, zoomIn, ariaLabel }: { ready: string; zoom: string; zoomOut: string; zoomIn: string; ariaLabel?: string }) {
  const [value, setValue] = useState(100);
  return <CgStatusBar ariaLabel={ariaLabel} items={[
    { key: 'ready', content: ready, priority: 10 },
    { key: 'sum', content: 'Σ 50', align: 'end', priority: 1 },
    { key: 'zoom-slider', align: 'end', separator: true, priority: 5, content: <CgSlider size="small" ariaLabel={zoom} min={10} max={400} value={value} onValueChange={setValue} formatValue={(next) => `${next}%`} marks={[100]} showSteppers stepperStep={10} decreaseLabel={zoomOut} increaseLabel={zoomIn} style={{ inlineSize: 140 }} /> },
    { key: 'zoom-value', content: `${value}%`, align: 'end', priority: 4, 'data-testid': 'zoom-value' },
  ]} />;
}

function PriorityExample() {
  const [width, setWidth] = useState(640);
  return <>
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Bar width<CgSlider ariaLabel="Bar width" min={120} max={760} step={20} value={width} onValueChange={setWidth} style={{ inlineSize: 240 }} /><output>{width}</output></label>
    <div data-testid="priority-frame" style={{ inlineSize: width }}><CgStatusBar items={english} /></div>
  </>;
}

export const Spreadsheet: Story = { args: { items: english }, render: () => frame(<CgStatusBar items={english} data-testid="status-bar" />) };
export const ZoomControl: Story = { args: { items: [] }, render: () => frame(<ZoomStatusBar ready="Ready" zoom="Zoom" zoomOut="Zoom out" zoomIn="Zoom in" />) };
export const LongTextTruncates: Story = { args: { items: [] }, render: () => frame(<div style={{ inlineSize: 420 }}><CgStatusBar data-testid="status-bar" items={[{ key: 'message', content: longText, tooltip: longText, 'data-testid': 'status-message' }, { key: 'sum', content: 'Sum: 50', align: 'end', 'data-testid': 'status-sum' }]} /></div>) };
export const PriorityHiding: Story = { args: { items: english }, render: () => frame(<PriorityExample />) };
export const Sizes: Story = { args: { items: english }, render: () => frame(<>{(['small', 'medium', 'large'] as const).map((size) => <CgStatusBar key={size} size={size} ariaLabel={size} items={english} data-testid={`status-bar-${size}`} />)}</>) };
export const Dark: Story = { args: { items: english }, globals: { theme: 'dark' }, render: () => frame(<><CgStatusBar items={english} /><ZoomStatusBar ready="Ready" zoom="Zoom" zoomOut="Zoom out" zoomIn="Zoom in" ariaLabel="Zoom status bar" /></>) };
export const ArabicRtl: Story = { args: { items: arabic }, globals: { direction: 'rtl' }, render: () => frame(<><CgStatusBar ariaLabel="شريط الحالة" items={arabic} data-testid="status-bar" /><ZoomStatusBar ready="جاهز" zoom="التكبير" zoomOut="تصغير" zoomIn="تكبير" ariaLabel="شريط التكبير" /></>) };
