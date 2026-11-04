import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgIcon } from '../Icon';
import { CgSplitButton } from '../SplitButton';
import { CgColorPicker } from './CgColorPicker';
import type { CgColorPickerLabels, CgColorPickerStandardColor, CgColorPickerThemeColor, CgColorPickerValue } from './CgColorPicker.types';

const source = 'No exact Razor component';
const difference = 'New React implementation: a theme color stays a reference to its entry and tint, so the host can store it as one.';
const meta = { title: 'Phase 34/ColorPicker', component: CgColorPicker, parameters: parityParameters(source, difference) } satisfies Meta<typeof CgColorPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

const officeTheme: ReadonlyArray<CgColorPickerThemeColor> = [
  { key: 'lt1', name: 'White, Background 1', color: '#ffffff' },
  { key: 'dk1', name: 'Black, Text 1', color: '#000000' },
  { key: 'lt2', name: 'Gray, Background 2', color: '#e7e6e6' },
  { key: 'dk2', name: 'Blue-gray, Text 2', color: '#44546a' },
  { key: 'accent1', name: 'Blue, Accent 1', color: '#4472c4' },
  { key: 'accent2', name: 'Orange, Accent 2', color: '#ed7d31' },
  { key: 'accent3', name: 'Gray, Accent 3', color: '#a5a5a5' },
  { key: 'accent4', name: 'Gold, Accent 4', color: '#ffc000' },
  { key: 'accent5', name: 'Blue, Accent 5', color: '#5b9bd5' },
  { key: 'accent6', name: 'Green, Accent 6', color: '#70ad47' },
];

const arabicTheme: ReadonlyArray<CgColorPickerThemeColor> = [
  { key: 'lt1', name: 'أبيض، الخلفية ١', color: '#ffffff' },
  { key: 'dk1', name: 'أسود، النص ١', color: '#000000' },
  { key: 'lt2', name: 'رمادي، الخلفية ٢', color: '#e7e6e6' },
  { key: 'dk2', name: 'أزرق رمادي، النص ٢', color: '#44546a' },
  { key: 'accent1', name: 'أزرق، تمييز ١', color: '#4472c4' },
  { key: 'accent2', name: 'برتقالي، تمييز ٢', color: '#ed7d31' },
  { key: 'accent3', name: 'رمادي، تمييز ٣', color: '#a5a5a5' },
  { key: 'accent4', name: 'ذهبي، تمييز ٤', color: '#ffc000' },
  { key: 'accent5', name: 'أزرق، تمييز ٥', color: '#5b9bd5' },
  { key: 'accent6', name: 'أخضر، تمييز ٦', color: '#70ad47' },
];

const arabicStandard: ReadonlyArray<CgColorPickerStandardColor> = [
  { name: 'أحمر داكن', color: '#c00000' },
  { name: 'أحمر', color: '#ff0000' },
  { name: 'برتقالي', color: '#ffc000' },
  { name: 'أصفر', color: '#ffff00' },
  { name: 'أخضر فاتح', color: '#92d050' },
  { name: 'أخضر', color: '#00b050' },
  { name: 'أزرق فاتح', color: '#00b0f0' },
  { name: 'أزرق', color: '#0070c0' },
  { name: 'أزرق داكن', color: '#002060' },
  { name: 'بنفسجي', color: '#7030a0' },
];

const arabicLabels: Partial<CgColorPickerLabels> = {
  picker: 'منتقي الألوان',
  automatic: 'تلقائي',
  none: 'بلا تعبئة',
  themeColors: 'ألوان السمة',
  standardColors: 'الألوان القياسية',
  recentColors: 'الألوان الأخيرة',
  customColor: 'ألوان أخرى…',
  lighter: (name, percent) => `${name}، أفتح بنسبة ${percent.toLocaleString('ar-EG')}٪`,
  darker: (name, percent) => `${name}، أغمق بنسبة ${percent.toLocaleString('ar-EG')}٪`,
};

const seedRecents: ReadonlyArray<CgColorPickerValue> = [{ kind: 'rgb', color: '#123456' }, { kind: 'theme', key: 'accent2', tint: 0.4, color: '#f4b183' }];

function ControlledExample({ theme = officeTheme, labels, standard, testId = 'picker' }: { theme?: ReadonlyArray<CgColorPickerThemeColor>; labels?: Partial<CgColorPickerLabels>; standard?: ReadonlyArray<CgColorPickerStandardColor>; testId?: string }) {
  const [value, setValue] = useState<CgColorPickerValue | null>({ kind: 'theme', key: 'accent1', tint: 0.4, color: '#8faadc' });
  const [recents, setRecents] = useState(seedRecents);
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <CgColorPicker value={value} onValueChange={setValue} recentColors={recents} onRecentColorsChange={setRecents} themeColors={theme} standardColors={standard} labels={labels} allowAutomatic allowNone allowCustomColor data-testid={testId} />
      <output aria-label="Chosen color" dir="ltr">{JSON.stringify(value)}</output>
    </div>
  );
}

/**
 * The host keeps the last color: the main part reapplies it, the arrow opens the picker,
 * and the bar under the icon shows what the main part will apply.
 */
function FillColorButton({ label = 'Fill color', toggleLabel = 'Choose fill color', menuLabel = 'Fill color', theme = officeTheme, labels, standard, direction }: { label?: string; toggleLabel?: string; menuLabel?: string; theme?: ReadonlyArray<CgColorPickerThemeColor>; labels?: Partial<CgColorPickerLabels>; standard?: ReadonlyArray<CgColorPickerStandardColor>; direction?: 'ltr' | 'rtl' }) {
  const [last, setLast] = useState<CgColorPickerValue>({ kind: 'rgb', color: '#ffff00' });
  const [recents, setRecents] = useState<ReadonlyArray<CgColorPickerValue>>([]);
  const [applied, setApplied] = useState<ReadonlyArray<string>>([]);
  const apply = (color: CgColorPickerValue) => setApplied((list) => [...list, 'color' in color ? color.color : color.kind]);
  return (
    <div style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <CgSplitButton
        appearance="outline"
        direction={direction}
        icon={<CgIcon name="fill-color" size={20} accentColor={'color' in last ? last.color : 'transparent'} />}
        toggleAriaLabel={toggleLabel}
        menuAriaLabel={menuLabel}
        menuMaxHeight="none"
        menuMaxWidth="none"
        data-testid="fill-button"
        onClick={() => apply(last)}
        renderFlyout={({ close }) => (
          <CgColorPicker
            value={last}
            onValueChange={(next) => { setLast(next); apply(next); close(); }}
            recentColors={recents}
            onRecentColorsChange={setRecents}
            themeColors={theme}
            standardColors={standard}
            labels={labels}
            allowNone
          />
        )}
      >{label}</CgSplitButton>
      <output aria-label="Applied colors" dir="ltr" data-testid="applied">{applied.join(' ')}</output>
    </div>
  );
}

export const FullPalette: Story = { render: () => frame(<ControlledExample />) };
export const InsideSplitButton: Story = { render: () => frame(<FillColorButton />) };
export const StandardOnly: Story = { render: () => frame(<CgColorPicker defaultValue={{ kind: 'rgb', color: '#00b050' }} data-testid="picker" />) };
export const CustomShades: Story = { render: () => frame(<CgColorPicker defaultValue={null} standardColors={[]} themeColors={[{ key: 'brand', name: 'Brand', color: '#1769ff', tints: [0.5, -0.5] }, { key: 'ink', name: 'Ink', color: '#172033', tints: [0.9] }]} data-testid="picker" />) };
export const Disabled: Story = { render: () => frame(<CgColorPicker disabled themeColors={officeTheme} allowAutomatic allowNone allowCustomColor data-testid="picker" />) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => frame(<div style={{ display: 'flex', gap: 24, alignItems: 'start' }}><ControlledExample /><FillColorButton /></div>) };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<div style={{ display: 'flex', gap: 24, alignItems: 'start' }}><ControlledExample theme={arabicTheme} standard={arabicStandard} labels={arabicLabels} /><FillColorButton label="لون التعبئة" toggleLabel="اختيار لون التعبئة" menuLabel="لون التعبئة" theme={arabicTheme} standard={arabicStandard} labels={arabicLabels} direction="rtl" /></div>) };
