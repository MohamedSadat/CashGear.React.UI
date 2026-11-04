import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgButton } from '../Button';
import { CgSplitButton } from '../SplitButton';
import { CgGallery } from './CgGallery';
import type { CgGalleryGroup, CgGalleryItem } from './CgGallery.types';

const source = 'No exact Razor component';
const difference = 'New React implementation: the host draws each swatch, so the gallery knows nothing about table or format rules.';
const meta = { title: 'Phase 34/Gallery', component: CgGallery, parameters: parityParameters(source, difference), args: { items: [] } } satisfies Meta<typeof CgGallery>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

const miniTable: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridTemplateRows: 'repeat(4, 1fr)', gap: 0, inlineSize: '100%', blockSize: '100%' };

function TableSwatch({ header, band, line }: { header: string; band: string; line: string }) {
  return (
    <span aria-hidden="true" style={{ ...miniTable, border: `1px solid ${line}` }}>
      {Array.from({ length: 16 }, (_, index) => {
        const row = Math.floor(index / 4);
        return <span key={index} style={{ background: row === 0 ? header : row % 2 === 1 ? band : 'transparent', borderBlockStart: row > 0 ? `1px solid ${line}` : undefined }} />;
      })}
    </span>
  );
}

const palettes = [
  ['blue', '#4472c4', '#d9e2f3', '#2f5597'],
  ['orange', '#ed7d31', '#fbe5d6', '#c55a11'],
  ['gray', '#7f7f7f', '#ededed', '#595959'],
  ['gold', '#ffc000', '#fff2cc', '#bf9000'],
  ['green', '#70ad47', '#e2f0d9', '#548235'],
] as const;

const tableGroups = (light: string, medium: string, dark: string): ReadonlyArray<CgGalleryGroup> => [{ key: 'light', text: light }, { key: 'medium', text: medium }, { key: 'dark', text: dark }];

const tableItems = (name: (color: string, group: string) => string): ReadonlyArray<CgGalleryItem> => [
  ...palettes.map(([color, , band, line]) => ({ key: `light-${color}`, text: name(color, 'light'), group: 'light', preview: <TableSwatch header="transparent" band={band} line={line} /> })),
  ...palettes.map(([color, header, band, line]) => ({ key: `medium-${color}`, text: name(color, 'medium'), group: 'medium', preview: <TableSwatch header={header} band={band} line={line} /> })),
  ...palettes.map(([color, header, , line]) => ({ key: `dark-${color}`, text: name(color, 'dark'), group: 'dark', preview: <TableSwatch header={line} band={header} line={line} /> })),
];

const english = tableItems((color, group) => `${group} ${color}`);
const arabicColors: Record<string, string> = { blue: 'أزرق', orange: 'برتقالي', gray: 'رمادي', gold: 'ذهبي', green: 'أخضر' };
const arabicGroups: Record<string, string> = { light: 'فاتح', medium: 'متوسط', dark: 'داكن' };
const arabic = tableItems((color, group) => `${arabicColors[color] ?? color} ${arabicGroups[group] ?? group}`);

const bars = (color: string) => <span aria-hidden="true" style={{ display: 'grid', gap: 2, alignContent: 'center', blockSize: '100%' }}>{[90, 55, 30].map((width) => <span key={width} style={{ display: 'block', blockSize: 8, inlineSize: `${width}%`, background: color }} />)}</span>;
const scale = (colors: readonly string[]) => <span aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', blockSize: '100%' }}>{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ background: colors[(index + Math.floor(index / 3)) % colors.length] }} />)}</span>;

const formatItems: ReadonlyArray<CgGalleryItem> = [
  { key: 'bar-blue', text: 'Blue data bar', group: 'bars', preview: bars('#5b9bd5') },
  { key: 'bar-green', text: 'Green data bar', group: 'bars', preview: bars('#63be7b') },
  { key: 'bar-red', text: 'Red data bar', group: 'bars', preview: bars('#f8696b') },
  { key: 'scale-gyr', text: 'Green, yellow, red scale', group: 'scales', preview: scale(['#63be7b', '#ffeb84', '#f8696b']) },
  { key: 'scale-byr', text: 'Blue, white, red scale', group: 'scales', preview: scale(['#5a8ac6', '#fcfcff', '#f8696b']) },
  { key: 'scale-off', text: 'Unavailable scale', group: 'scales', disabled: true, preview: scale(['#bfbfbf', '#7f7f7f']) },
];

function ControlledExample() {
  const [value, setValue] = useState<string | null>('medium-blue');
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <CgGallery items={english} groups={tableGroups('Light', 'Medium', 'Dark')} value={value} onValueChange={setValue} triggerText="Format as table" triggerIcon="table-style" ariaLabel="Table styles" data-testid="table-gallery" footer={<CgButton appearance="ghost" size="small" icon="add">New table style…</CgButton>} />
      <output aria-label="Chosen style">{value}</output>
    </div>
  );
}

function InsideSplitButton() {
  const [value, setValue] = useState('bar-blue');
  const [applied, setApplied] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
      <CgSplitButton
        appearance="outline"
        icon="conditional-format"
        toggleAriaLabel="Choose format"
        menuAriaLabel="Formats"
        menuMaxWidth="none"
        menuMaxHeight="none"
        onClick={() => setApplied((count) => count + 1)}
        renderFlyout={({ close }) => <CgGallery display="inline" columns={3} ariaLabel="Formats" items={formatItems} groups={[{ key: 'bars', text: 'Data bars' }, { key: 'scales', text: 'Color scales' }]} value={value} onValueChange={(next) => { setValue(next); close(); }} />}
      >Conditional format</CgSplitButton>
      <output aria-label="Applied count">{applied}</output>
      <output aria-label="Chosen format">{value}</output>
    </div>
  );
}

export const TableStyles: Story = { render: () => frame(<ControlledExample />) };
export const OpenOnArrival: Story = { render: () => frame(<CgGallery defaultOpen items={english} groups={tableGroups('Light', 'Medium', 'Dark')} defaultValue="dark-green" triggerText="Format as table" triggerIcon="table-style" ariaLabel="Table styles" data-testid="table-gallery" />) };
export const Inline: Story = { render: () => frame(<CgGallery display="inline" columns={3} ariaLabel="Formats" items={formatItems} groups={[{ key: 'bars', text: 'Data bars' }, { key: 'scales', text: 'Color scales' }]} defaultValue="bar-green" data-testid="inline-gallery" />) };
export const ConditionalFormatInSplitButton: Story = { render: () => frame(<InsideSplitButton />) };
export const TextSwatchesAndScrolling: Story = { render: () => frame(<CgGallery display="inline" columns={4} maxHeight="7rem" itemWidth="6rem" itemHeight="2rem" ariaLabel="Cell styles" items={Array.from({ length: 24 }, (_, index) => ({ key: `style-${index}`, text: `Style ${index + 1}` }))} data-testid="inline-gallery" />) };
export const Disabled: Story = { render: () => frame(<div style={{ display: 'grid', gap: 12 }}><CgGallery disabled items={english} groups={tableGroups('Light', 'Medium', 'Dark')} triggerText="Format as table" ariaLabel="Disabled table styles" /><CgGallery display="inline" disabled columns={3} ariaLabel="Disabled formats" items={formatItems} groups={[{ key: 'bars', text: 'Data bars' }, { key: 'scales', text: 'Color scales' }]} /></div>) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => frame(<CgGallery display="inline" ariaLabel="Table styles" items={english} groups={tableGroups('Light', 'Medium', 'Dark')} defaultValue="medium-blue" data-testid="inline-gallery" />) };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<div style={{ display: 'grid', gap: 16 }}><CgGallery triggerText="التنسيق كجدول" triggerIcon="table-style" ariaLabel="أنماط الجدول" items={arabic} groups={tableGroups('فاتح', 'متوسط', 'داكن')} defaultValue="medium-blue" data-testid="table-gallery" /><CgGallery display="inline" ariaLabel="أنماط الجدول المضمنة" items={arabic} groups={tableGroups('فاتح', 'متوسط', 'داكن')} defaultValue="medium-blue" data-testid="inline-gallery" /></div>) };
