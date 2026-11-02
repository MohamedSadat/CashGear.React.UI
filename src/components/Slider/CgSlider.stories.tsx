import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgSlider } from './CgSlider';

const source = 'No exact Razor component';
const difference = 'New React implementation: one thumb with pointer capture, steppers and ticks. CgRangeSelector covers two-handle ranges.';
const meta = { title: 'Phase 34/Slider', component: CgSlider, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;
const percent = (value: number) => `${value}%`;

function ControlledExample() {
  const [value, setValue] = useState(40);
  const [committed, setCommitted] = useState(40);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <CgSlider ariaLabel="Controlled" value={value} onValueChange={setValue} onValueCommit={setCommitted} formatValue={percent} data-testid="controlled-slider" />
      <output aria-label="Live value">{value}</output>
      <output aria-label="Committed value">{committed}</output>
    </div>
  );
}

function ZoomExample({ labels = { zoom: 'Zoom', zoomOut: 'Zoom out', zoomIn: 'Zoom in' }, format = percent }: { labels?: { zoom: string; zoomOut: string; zoomIn: string }; format?: (value: number) => string }) {
  const [zoom, setZoom] = useState(100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <CgSlider size="small" ariaLabel={labels.zoom} min={10} max={400} step={1} value={zoom} onValueChange={setZoom} formatValue={format} marks={[100]} showSteppers stepperStep={10} decreaseLabel={labels.zoomOut} increaseLabel={labels.zoomIn} style={{ inlineSize: 180 }} data-testid="zoom-slider" />
      <output aria-label={labels.zoom}>{format(zoom)}</output>
    </div>
  );
}

const arabicPercent = (value: number) => `${value.toLocaleString('ar-EG')}٪`;
const arabicZoom = { zoom: 'التكبير', zoomOut: 'تصغير', zoomIn: 'تكبير' };

export const ControlledAndUncontrolled: Story = { render: () => frame(<><ControlledExample /><CgSlider ariaLabel="Uncontrolled" defaultValue={25} step={5} data-testid="uncontrolled-slider" /></>) };
export const ZoomWithSteppersAndMarks: Story = { render: () => frame(<ZoomExample />) };
export const SizesMarksAndDisabled: Story = { render: () => frame(<div style={{ display: 'grid', gap: 16 }}><CgSlider size="small" ariaLabel="Small" defaultValue={20} /><CgSlider ariaLabel="Medium" defaultValue={50} marks={[0, 25, 50, 75, 100]} /><CgSlider size="large" ariaLabel="Large" defaultValue={80} showSteppers /><CgSlider disabled ariaLabel="Disabled" defaultValue={60} showSteppers /></div>) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => frame(<div style={{ display: 'grid', gap: 16 }}><ZoomExample /><CgSlider ariaLabel="Marks" defaultValue={50} marks={[0, 25, 50, 75, 100]} /><CgSlider disabled ariaLabel="Disabled" defaultValue={60} showSteppers /></div>) };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<div style={{ display: 'grid', gap: 16 }}><ZoomExample labels={arabicZoom} format={arabicPercent} /><CgSlider ariaLabel="مستوى الصوت" defaultValue={30} marks={[0, 50, 100]} data-testid="rtl-slider" /></div>) };
export const ForcedLtrInsideRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<CgSlider direction="ltr" ariaLabel="Left to right" defaultValue={25} data-testid="ltr-slider" />) };
