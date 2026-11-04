import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgBorderPicker } from '../BorderPicker';
import { CgColorPicker } from '../ColorPicker';
import type { CgColorPickerValue } from '../ColorPicker';
import { CgComboBox } from '../ComboBox';
import { CgGallery } from '../Gallery';
import { CgIcon } from '../Icon';
import { CgSlider } from '../Slider';
import { CgRibbon } from './CgRibbon';
import type { CgRibbonLabels, CgRibbonTab } from './CgRibbon.types';

const source = 'No exact Razor component';
const difference = 'New React implementation composed from CgTabs and one CgToolbar per group. Commands are host-owned descriptors; the ribbon holds no spreadsheet logic.';
const meta = { title: 'Phase 34/Ribbon', component: CgRibbon, parameters: parityParameters(source, difference), args: { tabs: [] } } satisfies Meta<typeof CgRibbon>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: React.ReactNode) => <StoryFrame source={source} difference={difference}><div style={{ display: 'grid', gap: 12, inlineSize: '100%' }}>{content}</div></StoryFrame>;

interface Text {
  home: string; insert: string; data: string; contextual: string;
  clipboard: string; paste: string; pasteValues: string; cut: string; copy: string; painter: string;
  font: string; fontName: string; fontSize: string; grow: string; shrink: string; bold: string; italic: string; underline: string; borders: string; fill: string; color: string;
  alignment: string; top: string; middle: string; bottom: string; wrap: string; left: string; center: string; right: string; indentLess: string; indentMore: string; merge: string; unmerge: string;
  number: string; format: string; currency: string; percent: string; thousands: string; moreDecimals: string; fewerDecimals: string;
  styles: string; conditional: string; asTable: string; cellStyles: string;
  cells: string; insertRow: string; deleteRow: string; freeze: string;
  editing: string; sum: string; clear: string; sort: string; filter: string;
  charts: string; column: string; line: string; pie: string; table: string; picture: string; link: string; sortFilter: string; validate: string;
  automatic: string; noFill: string;
}

const english: Text = {
  home: 'Home', insert: 'Insert', data: 'Data', contextual: 'Table Design',
  clipboard: 'Clipboard', paste: 'Paste', pasteValues: 'Paste values', cut: 'Cut', copy: 'Copy', painter: 'Format Painter',
  font: 'Font', fontName: 'Font name', fontSize: 'Font size', grow: 'Increase font size', shrink: 'Decrease font size', bold: 'Bold', italic: 'Italic', underline: 'Underline', borders: 'Borders', fill: 'Fill color', color: 'Font color',
  alignment: 'Alignment', top: 'Align top', middle: 'Align middle', bottom: 'Align bottom', wrap: 'Wrap Text', left: 'Align left', center: 'Center', right: 'Align right', indentLess: 'Decrease indent', indentMore: 'Increase indent', merge: 'Merge & Center', unmerge: 'Unmerge',
  number: 'Number', format: 'Number format', currency: 'Currency', percent: 'Percent', thousands: 'Thousands', moreDecimals: 'Increase decimal', fewerDecimals: 'Decrease decimal',
  styles: 'Styles', conditional: 'Conditional Formatting', asTable: 'Format as Table', cellStyles: 'Cell Styles',
  cells: 'Cells', insertRow: 'Insert', deleteRow: 'Delete', freeze: 'Freeze Panes',
  editing: 'Editing', sum: 'AutoSum', clear: 'Clear', sort: 'Sort', filter: 'Filter',
  charts: 'Charts', column: 'Column', line: 'Line', pie: 'Pie', table: 'Table', picture: 'Picture', link: 'Link', sortFilter: 'Sort & Filter', validate: 'Data Validation',
  automatic: 'Automatic', noFill: 'No fill',
};

const arabic: Text = {
  home: 'الصفحة الرئيسية', insert: 'إدراج', data: 'البيانات', contextual: 'تصميم الجدول',
  clipboard: 'الحافظة', paste: 'لصق', pasteValues: 'لصق القيم', cut: 'قص', copy: 'نسخ', painter: 'نسخ التنسيق',
  font: 'الخط', fontName: 'اسم الخط', fontSize: 'حجم الخط', grow: 'تكبير الخط', shrink: 'تصغير الخط', bold: 'غامق', italic: 'مائل', underline: 'تسطير', borders: 'الحدود', fill: 'لون التعبئة', color: 'لون الخط',
  alignment: 'المحاذاة', top: 'محاذاة لأعلى', middle: 'محاذاة للوسط', bottom: 'محاذاة لأسفل', wrap: 'التفاف النص', left: 'محاذاة لليسار', center: 'توسيط', right: 'محاذاة لليمين', indentLess: 'إنقاص المسافة', indentMore: 'زيادة المسافة', merge: 'دمج وتوسيط', unmerge: 'إلغاء الدمج',
  number: 'الرقم', format: 'تنسيق الأرقام', currency: 'عملة', percent: 'نسبة مئوية', thousands: 'الآلاف', moreDecimals: 'زيادة المنازل العشرية', fewerDecimals: 'إنقاص المنازل العشرية',
  styles: 'الأنماط', conditional: 'التنسيق الشرطي', asTable: 'التنسيق كجدول', cellStyles: 'أنماط الخلايا',
  cells: 'الخلايا', insertRow: 'إدراج', deleteRow: 'حذف', freeze: 'تجميد الأجزاء',
  editing: 'التحرير', sum: 'جمع تلقائي', clear: 'مسح', sort: 'فرز', filter: 'تصفية',
  charts: 'المخططات', column: 'عمودي', line: 'خطي', pie: 'دائري', table: 'جدول', picture: 'صورة', link: 'ارتباط', sortFilter: 'فرز وتصفية', validate: 'التحقق من البيانات',
  automatic: 'تلقائي', noFill: 'بلا تعبئة',
};

const arabicLabels: Partial<CgRibbonLabels> = {
  ribbon: 'الشريط',
  collapse: 'طي الشريط',
  expand: 'توسيع الشريط',
  launcher: (group) => `${group}: خيارات أخرى`,
  openMenu: (item) => `${item}: خيارات أخرى`,
};

const FONTS = ['Calibri', 'Arial', 'Tahoma', 'Times New Roman'];
const SIZES = ['9', '10', '11', '12', '14', '18', '24'];

interface Host {
  bold: boolean; setBold: (next: boolean) => void;
  italic: boolean; setItalic: (next: boolean) => void;
  wrap: boolean; setWrap: (next: boolean) => void;
  fill: CgColorPickerValue; setFill: (next: CgColorPickerValue) => void;
  font: string; setFont: (next: string) => void;
  log: (entry: string) => void;
}

function buildTabs(text: Text, host: Host): ReadonlyArray<CgRibbonTab> {
  return [
    {
      key: 'home',
      text: text.home,
      groups: [
        {
          key: 'clipboard', text: text.clipboard, priority: 5, icon: 'paste',
          onLauncherClick: () => host.log('clipboard-dialog'),
          items: [
            { name: 'paste', text: text.paste, icon: 'paste', size: 'large', onClick: () => host.log('paste'), children: [{ name: 'paste-values', text: text.pasteValues, onClick: () => host.log('paste-values') }] },
            { name: 'cut', text: text.cut, icon: 'cut', onClick: () => host.log('cut') },
            { name: 'copy', text: text.copy, icon: 'copy', onClick: () => host.log('copy') },
            { name: 'painter', text: text.painter, icon: 'format-painter', onClick: () => host.log('painter') },
          ],
        },
        {
          key: 'font', text: text.font, layout: 'rows', priority: 4, icon: 'text-font',
          onLauncherClick: () => host.log('font-dialog'),
          items: [
            { name: 'font-name', ownsKeyboard: true, render: () => <div style={{ inlineSize: '8.5rem' }}><CgComboBox<string> aria-label={text.fontName} size="small" fullWidth clearable={false} options={FONTS} value={host.font} onValueChange={(next) => { if (next) host.setFont(next); }} getOptionKey={(item) => item} getOptionLabel={(item) => item} /></div> },
            { name: 'font-size', ownsKeyboard: true, render: () => <div style={{ inlineSize: '4.75rem' }}><CgComboBox<string> aria-label={text.fontSize} size="small" fullWidth clearable={false} options={SIZES} defaultValue="11" getOptionKey={(item) => item} getOptionLabel={(item) => item} /></div> },
            { name: 'grow', text: text.grow, icon: 'font-size-increase', hideText: true, onClick: () => host.log('grow') },
            { name: 'shrink', text: text.shrink, icon: 'font-size-decrease', hideText: true, onClick: () => host.log('shrink') },
            { name: 'bold', text: text.bold, icon: 'text-bold', hideText: true, beginRow: true, checked: host.bold, onCheckedChange: host.setBold },
            { name: 'italic', text: text.italic, icon: 'text-italic', hideText: true, checked: host.italic, onCheckedChange: host.setItalic },
            { name: 'underline', text: text.underline, icon: 'text-underline', hideText: true, onClick: () => host.log('underline'), children: [{ name: 'underline-double', text: text.underline, icon: 'text-underline-double', onClick: () => host.log('underline-double') }] },
            { name: 'borders', text: text.borders, icon: 'border-all', hideText: true, beginGroup: true, onClick: () => host.log('borders'), renderFlyout: ({ close }) => <CgBorderPicker presets={['none', 'all', 'outside', 'inside', 'top', 'bottom']} lineStyles={['thin', 'thick']} onApply={({ preset }) => { host.log(`border-${preset}`); close(); }} /> },
            {
              name: 'fill', text: text.fill, hideText: true, beginGroup: true,
              icon: <CgIcon name="fill-color" accentColor={'color' in host.fill ? host.fill.color : 'transparent'} />,
              onClick: () => host.log(`fill-${'color' in host.fill ? host.fill.color : host.fill.kind}`),
              renderFlyout: ({ close }) => <CgColorPicker value={host.fill} labels={{ none: text.noFill }} allowNone onValueChange={(next) => { host.setFill(next); host.log(`fill-${'color' in next ? next.color : next.kind}`); close(); }} />,
            },
            { name: 'color', text: text.color, icon: <CgIcon name="text-color" accentColor="#c00000" />, hideText: true, onClick: () => host.log('font-color'), renderFlyout: ({ close }) => <CgColorPicker allowAutomatic labels={{ automatic: text.automatic }} onValueChange={() => close()} /> },
          ],
        },
        {
          key: 'alignment', text: text.alignment, layout: 'rows', priority: 3, icon: 'align-center',
          items: [
            { name: 'top', text: text.top, icon: 'align-top', hideText: true, onClick: () => host.log('top') },
            { name: 'middle', text: text.middle, icon: 'align-middle', hideText: true, onClick: () => host.log('middle') },
            { name: 'bottom', text: text.bottom, icon: 'align-bottom', hideText: true, onClick: () => host.log('bottom') },
            { name: 'wrap', text: text.wrap, icon: 'text-wrap', beginGroup: true, checked: host.wrap, onCheckedChange: host.setWrap },
            { name: 'left', text: text.left, icon: 'align-left', hideText: true, beginRow: true, onClick: () => host.log('left') },
            { name: 'center', text: text.center, icon: 'align-center', hideText: true, onClick: () => host.log('center') },
            { name: 'right', text: text.right, icon: 'align-right', hideText: true, onClick: () => host.log('right') },
            { name: 'merge', text: text.merge, icon: 'cells-merge', beginGroup: true, onClick: () => host.log('merge'), children: [{ name: 'unmerge', text: text.unmerge, icon: 'cells-split', onClick: () => host.log('unmerge') }] },
          ],
        },
        {
          key: 'number', text: text.number, layout: 'rows', priority: 2, icon: 'number-format',
          onLauncherClick: () => host.log('number-dialog'),
          items: [
            { name: 'currency', text: text.currency, icon: 'number-currency', hideText: true, onClick: () => host.log('currency') },
            { name: 'percent', text: text.percent, icon: 'number-percent', hideText: true, onClick: () => host.log('percent') },
            { name: 'thousands', text: text.thousands, icon: 'number-thousands', hideText: true, onClick: () => host.log('thousands') },
            { name: 'more-decimals', text: text.moreDecimals, icon: 'decimal-increase', hideText: true, beginRow: true, onClick: () => host.log('more-decimals') },
            { name: 'fewer-decimals', text: text.fewerDecimals, icon: 'decimal-decrease', hideText: true, onClick: () => host.log('fewer-decimals') },
          ],
        },
        {
          key: 'styles', text: text.styles, priority: 1, icon: 'cell-style',
          items: [
            { name: 'conditional', text: text.conditional, icon: 'conditional-format', menuAriaLabel: text.conditional, children: [{ name: 'rules', text: text.conditional, onClick: () => host.log('rules') }] },
            { name: 'as-table', text: text.asTable, icon: 'table-style', renderFlyout: ({ close }) => <CgGallery display="inline" columns={3} ariaLabel={text.asTable} items={[{ key: 'one', text: `${text.asTable} 1` }, { key: 'two', text: `${text.asTable} 2` }, { key: 'three', text: `${text.asTable} 3` }]} onValueChange={(key) => { host.log(`table-${key}`); close(); }} /> },
            { name: 'cell-styles', text: text.cellStyles, icon: 'cell-style', onClick: () => host.log('cell-styles') },
          ],
        },
        {
          key: 'cells', text: text.cells, priority: 1, icon: 'row-insert',
          items: [
            { name: 'insert-row', text: text.insertRow, icon: 'row-insert', size: 'large', onClick: () => host.log('insert-row') },
            { name: 'delete-row', text: text.deleteRow, icon: 'row-delete', size: 'large', onClick: () => host.log('delete-row') },
            { name: 'freeze', text: text.freeze, icon: 'freeze-panes', size: 'large', children: [{ name: 'freeze-top', text: text.freeze, icon: 'freeze-top-row', onClick: () => host.log('freeze-top') }] },
          ],
        },
        {
          key: 'editing', text: text.editing, icon: 'autosum',
          items: [
            { name: 'sum', text: text.sum, icon: 'autosum', onClick: () => host.log('sum') },
            { name: 'clear', text: text.clear, icon: 'eraser', onClick: () => host.log('clear') },
            { name: 'sort', text: text.sort, icon: 'sort-ascending', onClick: () => host.log('sort') },
            { name: 'filter', text: text.filter, icon: 'filter', size: 'large', onClick: () => host.log('filter') },
          ],
        },
      ],
    },
    {
      key: 'insert',
      text: text.insert,
      groups: [
        { key: 'tables', text: text.table, items: [{ name: 'table', text: text.table, icon: 'table-add', size: 'large', onClick: () => host.log('table') }] },
        { key: 'charts', text: text.charts, items: [
          { name: 'column', text: text.column, icon: 'chart-column', size: 'large', onClick: () => host.log('column') },
          { name: 'line', text: text.line, icon: 'chart-line', size: 'large', onClick: () => host.log('line') },
          { name: 'pie', text: text.pie, icon: 'chart-pie', size: 'large', onClick: () => host.log('pie') },
        ] },
        { key: 'links', text: text.link, items: [
          { name: 'picture', text: text.picture, icon: 'image', onClick: () => host.log('picture') },
          { name: 'link', text: text.link, icon: 'link', onClick: () => host.log('link') },
        ] },
      ],
    },
    {
      key: 'data',
      text: text.data,
      groups: [
        { key: 'sort-filter', text: text.sortFilter, items: [
          { name: 'ascending', text: text.sort, icon: 'sort-ascending', onClick: () => host.log('ascending') },
          { name: 'descending', text: text.sort, icon: 'sort-descending', onClick: () => host.log('descending') },
          { name: 'data-filter', text: text.filter, icon: 'filter', size: 'large', onClick: () => host.log('data-filter') },
        ] },
        { key: 'tools', text: text.validate, items: [{ name: 'validate', text: text.validate, icon: 'data-validation', size: 'large', onClick: () => host.log('validate') }] },
      ],
    },
    { key: 'table-design', text: text.contextual, visible: false, groups: [] },
    { key: 'off', text: `${text.contextual} 2`, disabled: true, groups: [] },
  ];
}

function useHost() {
  const [bold, setBold] = useState(true);
  const [italic, setItalic] = useState(false);
  const [wrap, setWrap] = useState(false);
  const [fill, setFill] = useState<CgColorPickerValue>({ kind: 'rgb', color: '#ffff00' });
  const [font, setFont] = useState('Calibri');
  const [entries, setEntries] = useState<ReadonlyArray<string>>([]);
  const host = useMemo<Host>(() => ({ bold, setBold, italic, setItalic, wrap, setWrap, fill, setFill, font, setFont, log: (entry) => setEntries((list) => [...list, entry]) }), [bold, fill, font, italic, wrap]);
  return { host, entries };
}

function RibbonExample({ text = english, labels, defaultCollapsed, width }: { text?: Text; labels?: Partial<CgRibbonLabels>; defaultCollapsed?: boolean; width?: number }) {
  const { host, entries } = useHost();
  const tabs = useMemo(() => buildTabs(text, host), [host, text]);
  return (
    <>
      <div style={{ inlineSize: width ?? '100%', maxInlineSize: '100%' }} data-testid="ribbon-frame">
        <CgRibbon tabs={tabs} labels={labels} defaultCollapsed={defaultCollapsed} data-testid="ribbon" />
      </div>
      <output aria-label="Activity log" dir="ltr" data-testid="log">{entries.join(' ')}</output>
    </>
  );
}

function ShrinkingExample() {
  const [width, setWidth] = useState(1100);
  const { host, entries } = useHost();
  const tabs = useMemo(() => buildTabs(english, host), [host]);
  return (
    <>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Ribbon width<CgSlider ariaLabel="Ribbon width" min={280} max={1200} step={20} value={width} onValueChange={setWidth} style={{ inlineSize: 320 }} /><output data-testid="width">{width}</output></label>
      <div style={{ inlineSize: width, maxInlineSize: '100%' }} data-testid="ribbon-frame"><CgRibbon tabs={tabs} data-testid="ribbon" /></div>
      <output aria-label="Activity log" data-testid="log">{entries.join(' ')}</output>
    </>
  );
}

function ControlledExample() {
  const { host } = useHost();
  const tabs = useMemo(() => buildTabs(english, host), [host]);
  const [active, setActive] = useState<string | null>('insert');
  const [collapsed, setCollapsed] = useState(false);
  return (
    <>
      <CgRibbon tabs={tabs} activeKey={active} onActiveKeyChange={setActive} collapsed={collapsed} onCollapsedChange={setCollapsed} startContent={<strong style={{ paddingInline: 8 }}>File</strong>} endContent={<span style={{ color: 'var(--cg-text-secondary)' }}>Saved</span>} data-testid="ribbon" />
      <output aria-label="Active tab">{active}</output>
      <output aria-label="Collapsed state">{String(collapsed)}</output>
    </>
  );
}

const stageFrame = { maxWidth: 'none' } as const;

export const Spreadsheet: Story = { parameters: { layout: 'fullscreen' }, render: () => <section data-cg-story-root="" style={stageFrame}><RibbonExample /></section> };
export const ShrinkingByGroup: Story = { render: () => <section data-cg-story-root="" style={{ display: 'grid', gap: 12 }}><ShrinkingExample /></section> };
export const Narrow: Story = { render: () => frame(<RibbonExample width={520} />) };
export const VeryNarrow: Story = { render: () => frame(<RibbonExample width={300} />) };
export const Collapsed: Story = { render: () => frame(<RibbonExample defaultCollapsed width={760} />) };
export const ControlledTabsAndSlots: Story = { render: () => frame(<ControlledExample />) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => <section data-cg-story-root="" style={stageFrame}><RibbonExample /></section> };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => <section data-cg-story-root="" style={stageFrame}><RibbonExample text={arabic} labels={arabicLabels} /></section> };
export const ArabicRtlNarrow: Story = { globals: { direction: 'rtl' }, render: () => frame(<RibbonExample text={arabic} labels={arabicLabels} width={520} />) };
