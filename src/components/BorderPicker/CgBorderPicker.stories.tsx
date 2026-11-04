import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgColorPickerValue } from '../ColorPicker';
import { CgIcon } from '../Icon';
import { CgSplitButton } from '../SplitButton';
import { CgBorderPicker } from './CgBorderPicker';
import type { CgBorderApplyDetails, CgBorderLineStyle, CgBorderPickerLabels, CgBorderPresetKey } from './CgBorderPicker.types';

const source = 'No exact Razor component';
const difference = 'New React implementation: choosing a preset reports the edges, line style and color, and the host applies them.';
const meta = { title: 'Phase 34/BorderPicker', component: CgBorderPicker, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgBorderPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

const theme = [
  { key: 'dk1', name: 'Black', color: '#000000' },
  { key: 'accent1', name: 'Accent 1', color: '#4472c4' },
  { key: 'accent2', name: 'Accent 2', color: '#ed7d31' },
];

const summary = ({ preset, edges, clear, color }: CgBorderApplyDetails) => JSON.stringify({ preset, clear, edges, color });

function ControlledExample({ labels }: { labels?: Partial<CgBorderPickerLabels> }) {
  const [lineStyle, setLineStyle] = useState<CgBorderLineStyle>('thin');
  const [color, setColor] = useState<CgColorPickerValue>({ kind: 'automatic' });
  const [last, setLast] = useState<CgBorderPresetKey | null>('outside');
  const [applied, setApplied] = useState('');
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <CgBorderPicker
        lineStyle={lineStyle}
        onLineStyleChange={setLineStyle}
        color={color}
        onColorChange={setColor}
        activePreset={last}
        onApply={(details) => { setLast(details.preset); setApplied(summary(details)); }}
        colorPicker={{ themeColors: theme, allowNone: false }}
        labels={labels}
        data-testid="border-picker"
      />
      <output aria-label="Applied border" dir="ltr" style={{ overflowWrap: 'anywhere', maxInlineSize: 420 }}>{applied}</output>
    </div>
  );
}

/** The host keeps the last preset, so the main part reapplies it and shows its icon. */
function BorderButton() {
  const [last, setLast] = useState<'none' | 'all' | 'outside' | 'bottom'>('bottom');
  const [applied, setApplied] = useState<ReadonlyArray<string>>([]);
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <CgSplitButton
        appearance="outline"
        icon={<CgIcon name={`border-${last}`} size={20} />}
        toggleAriaLabel="Choose border"
        menuAriaLabel="Borders"
        menuMaxWidth="none"
        menuMaxHeight="none"
        data-testid="border-button"
        onClick={() => setApplied((list) => [...list, last])}
        renderFlyout={({ close }) => (
          <CgBorderPicker
            presets={['none', 'all', 'outside', 'bottom']}
            lineStyles={['thin', 'thick']}
            activePreset={last}
            onApply={({ preset }) => { setLast(preset as typeof last); setApplied((list) => [...list, preset]); close(); }}
          />
        )}
      >Borders</CgSplitButton>
      <output aria-label="Applied presets" data-testid="applied">{applied.join(' ')}</output>
    </div>
  );
}

const arabicLabels: Partial<CgBorderPickerLabels> = {
  picker: 'منتقي الحدود',
  presets: 'الحدود',
  lineStyle: 'نمط الخط',
  lineColor: 'لون الخط',
  presetNames: {
    none: 'بلا حدود', all: 'كل الحدود', outside: 'الحدود الخارجية', inside: 'الحدود الداخلية', 'inside-horizontal': 'حد داخلي أفقي', 'inside-vertical': 'حد داخلي رأسي',
    top: 'الحد العلوي', bottom: 'الحد السفلي', left: 'الحد الأيسر', right: 'الحد الأيمن', 'left-right': 'الحدان الأيسر والأيمن', 'top-bottom': 'الحدان العلوي والسفلي',
    'outside-thick': 'حدود خارجية سميكة', 'bottom-thick': 'حد سفلي سميك', 'bottom-double': 'حد سفلي مزدوج', 'top-bottom-thick': 'حد علوي وسفلي سميك', 'top-bottom-double': 'حد علوي وسفلي مزدوج',
  },
  lineStyleNames: { thin: 'رفيع', medium: 'متوسط', thick: 'سميك', dashed: 'متقطع', dotted: 'منقط', double: 'مزدوج' },
};

export const AllPresets: Story = { render: () => frame(<ControlledExample />) };
export const InsideSplitButton: Story = { render: () => frame(<BorderButton />) };
export const SomePresetsAndStyles: Story = { render: () => frame(<CgBorderPicker presets={['none', 'all', 'outside', 'bottom-double']} lineStyles={['thin', 'dashed']} defaultLineStyle="dashed" data-testid="border-picker" />) };
export const Disabled: Story = { render: () => frame(<CgBorderPicker disabled data-testid="border-picker" />) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => frame(<ControlledExample />) };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<ControlledExample labels={arabicLabels} />) };
