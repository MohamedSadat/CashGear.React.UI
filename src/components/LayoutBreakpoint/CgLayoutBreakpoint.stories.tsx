import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgLayoutBreakpoint } from './CgLayoutBreakpoint';

const source = 'CG.CompLib/Comp/Layout/CgLayoutBreakpoint.*; CG.CompLib.Demo/Components/Pages/LayoutBreakpointDemo.razor';
const difference = 'React uses an SSR-safe hook and render prop around matchMedia instead of Blazor JS interop.';
const meta = { title: 'Phase 11/LayoutBreakpoint', component: CgLayoutBreakpoint, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgLayoutBreakpoint>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NamedBands: Story = {
  args: { size: 'medium', children: () => null },
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 8 }}>
      {(['x-small', 'small', 'medium', 'large', 'x-large'] as const).map((size) => (
        <CgLayoutBreakpoint key={size} size={size}>{(matches) => <output data-testid={`${size}-state`}>{size}: {matches ? 'active' : 'inactive'}</output>}</CgLayoutBreakpoint>
      ))}
      <CgLayoutBreakpoint minWidth={700} maxWidth={900}>{(matches) => <output data-testid="custom-state">Custom: {matches ? 'active' : 'inactive'}</output>}</CgLayoutBreakpoint>
    </div>
  </StoryFrame>,
};
