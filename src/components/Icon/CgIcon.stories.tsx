import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgIcon } from './CgIcon';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import type { CgIconName } from '../../types';

const source = 'No exact Razor component';
const difference = 'New React implementation with a typed inline-SVG registry. Spreadsheet and formatting icons are checked-in Fluent System Icons (MIT).';
const meta = { title: 'Phase 1–2/Icon', component: CgIcon, parameters: parityParameters(source, difference), args: { name: 'search' } } satisfies Meta<typeof CgIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

const spreadsheetIcons: ReadonlyArray<readonly [string, ReadonlyArray<CgIconName>]> = [
  ['Font', ['text-bold', 'text-italic', 'text-underline', 'text-underline-double', 'text-strikethrough', 'text-subscript', 'text-superscript', 'text-font', 'text-font-size', 'font-size-increase', 'font-size-decrease', 'text-color', 'fill-color', 'line-color', 'clear-formatting', 'format-painter']],
  ['Alignment', ['align-left', 'align-center', 'align-right', 'align-justify', 'align-top', 'align-middle', 'align-bottom', 'text-wrap', 'text-rotate', 'indent-increase', 'indent-decrease']],
  ['Cells', ['cells-merge', 'cells-split', 'row-insert', 'row-delete', 'row-height', 'column-insert', 'column-delete', 'column-width', 'autofit-height', 'autofit-width', 'freeze-panes', 'freeze-top-row', 'freeze-first-column', 'freeze-off', 'gridlines']],
  ['Borders', ['border-all', 'border-outside', 'border-outside-thick', 'border-inside', 'border-inside-horizontal', 'border-inside-vertical', 'border-none', 'border-top', 'border-bottom', 'border-bottom-thick', 'border-bottom-double', 'border-left', 'border-right', 'border-left-right', 'border-top-bottom', 'border-top-bottom-thick', 'border-top-bottom-double']],
  ['Number formats', ['number-format', 'number-currency', 'number-percent', 'number-thousands', 'decimal-increase', 'decimal-decrease', 'calendar', 'clock']],
  ['Sort and filter', ['sort', 'sort-ascending', 'sort-descending', 'filter', 'filter-clear']],
  ['Charts', ['chart-column', 'chart-bar', 'chart-line', 'chart-area', 'chart-pie', 'chart-donut', 'chart-scatter', 'chart-histogram', 'chart-waterfall', 'chart-funnel', 'chart-treemap', 'chart-sunburst', 'chart-box-whisker', 'chart-sparkline', 'chart-combo']],
  ['Tables and styles', ['table', 'table-add', 'table-style', 'cell-style', 'conditional-format', 'data-validation']],
  ['Commands', ['paste', 'cut', 'copy', 'undo', 'redo', 'eraser', 'autosum', 'formula', 'fill-down', 'add', 'delete', 'replace', 'save', 'open', 'workbook', 'image', 'link', 'comment', 'calculator', 'settings', 'more']],
];

const Sheet = () => <div style={{ display: 'grid', gap: 12, inlineSize: '100%' }} data-testid="icon-sheet">
  {spreadsheetIcons.map(([title, names]) => <section key={title} style={{ display: 'grid', gap: 4 }}>
    <h3 style={{ margin: 0, fontSize: 13 }}>{title}</h3>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{names.map((name) => <CgIcon key={name} name={name} label={name} size={24} />)}</div>
  </section>)}
  <section style={{ display: 'flex', gap: 12, alignItems: 'center' }} data-testid="accent-icons">
    <CgIcon name="text-color" label="Font colour, red" accentColor="#c00000" size={32} />
    <CgIcon name="fill-color" label="Fill colour, yellow" accentColor="#ffc000" size={32} />
    <CgIcon name="line-color" label="Line colour, blue" accentColor="#0070c0" size={32} />
    <CgIcon name="text-color" label="Font colour, none chosen" size={32} />
  </section>
</div>;

export const Registry: Story = { render: () => <StoryFrame source={source} difference={difference}>{(['search', 'clear', 'close', 'eye', 'eye-off', 'check', 'minus', 'chevron-up', 'chevron-down'] as const).map((name) => <CgIcon key={name} name={name} label={name} size={28} />)}</StoryFrame> };
export const LogicalRtl: Story = { render: () => <StoryFrame source={source} difference={difference}><span dir="ltr"><CgIcon name="chevron-end" label="LTR next" size={32} /></span><span dir="rtl"><CgIcon name="chevron-end" label="RTL next" size={32} /></span></StoryFrame> };
export const Spreadsheet: Story = { render: () => <StoryFrame source={source} difference={difference}><Sheet /></StoryFrame> };
export const SpreadsheetDark: Story = { globals: { theme: 'dark' }, render: () => <StoryFrame source={source} difference={difference}><Sheet /></StoryFrame> };
export const SpreadsheetRtl: Story = { globals: { direction: 'rtl' }, render: () => <StoryFrame source={source} difference={difference}><Sheet /></StoryFrame> };
