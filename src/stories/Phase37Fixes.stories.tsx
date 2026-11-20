import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgButton } from '../components/Button';
import type { CgButtonAppearance } from '../components/Button';
import { CgChart } from '../components/Chart';
import type { CgChartSeriesDescriptor } from '../components/Chart';
import { CgComboBox } from '../components/ComboBox';
import { CgContextMenu, useCgContextMenuTarget } from '../components/ContextMenu';
import type { CgContextMenuActions, CgContextMenuItem } from '../components/ContextMenu';
import { CgDateEdit } from '../components/DateEdit';
import { CgDecimalEdit } from '../components/DecimalEdit';
import { CgDrawer } from '../components/Drawer';
import { CgFlyout } from '../components/Flyout';
import type { CgFlyoutActions } from '../components/Flyout';
import { normalizeCgDecimalValue } from '../components/RangeSelector';
import { CgSpinEdit } from '../components/SpinEdit';
import { CgSplitter } from '../components/Splitter';
import { CgTabs } from '../components/Tabs';
import type { CgTabDescriptor } from '../components/Tabs';
import { CgTagBox } from '../components/TagBox';
import { CgTextBox } from '../components/TextBox';
import { CgTimeEdit } from '../components/TimeEdit';
import type { CgIntent } from '../types';
import { StoryFrame } from './storySupport';

const source = 'Existing components (Cash Gear Workspace Track U, the library defects)';
const difference = 'Each fix is additive: existing props and defaults keep their meaning.';
const meta: Meta = { title: 'Phase 37/Library fixes' };
export default meta;
type Story = StoryObj;

const INTENTS: readonly CgIntent[] = ['neutral', 'primary', 'secondary', 'info', 'success', 'warning', 'danger'];
const NAMES: Record<string, string> = { neutral: 'عادي', primary: 'أساسي', secondary: 'ثانوي', info: 'معلومة', success: 'نجاح', warning: 'تحذير', danger: 'خطر' };

function Buttons() {
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 8 }} data-testid="button-matrix">
      {(['solid', 'soft', 'outline', 'ghost'] as readonly CgButtonAppearance[]).map((appearance) => <div key={appearance} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {INTENTS.map((intent) => <CgButton key={intent} intent={intent} appearance={appearance} data-testid={`${appearance}-${intent}`}>{NAMES[intent]}</CgButton>)}
      </div>)}
    </div>
  </StoryFrame>;
}

export const ButtonContrast: Story = { render: () => <Buttons />, globals: { direction: 'rtl' } };
export const ButtonContrastDark: Story = { render: () => <Buttons />, globals: { theme: 'dark', direction: 'rtl' } };

function SplitterFill() {
  const lines = Array.from({ length: 40 }, (_, index) => <p key={index} style={{ margin: '0 0 8px' }}><a href={`#s${index + 1}`}>القسم {index + 1}</a> من محتوى طويل يتجاوز ارتفاع اللوحة.</p>);
  return <StoryFrame source={source} difference={difference}>
    <CgSplitter
      aria-label="تخطيط الصفحة"
      style={{ inlineSize: 640, blockSize: 280 }}
      separatorAriaLabel={({ start, end }) => `تغيير حجم ${start.ariaLabel ?? ''} و${end.ariaLabel ?? ''}`}
      panes={[
        { key: 'nav', size: '14rem', ariaLabel: 'التنقل', renderHeader: () => 'الصفحات', renderContent: () => <div data-testid="nav-content" style={{ display: 'flex', flexDirection: 'column', blockSize: '100%', background: 'var(--cg-surface-subtle)' }}><span>أعلى</span><span style={{ marginBlockStart: 'auto' }}>أسفل</span></div> },
        { key: 'main', ariaLabel: 'المحتوى', renderHeader: () => 'المستند', renderContent: () => <div data-testid="main-content">{lines}</div> },
      ]}
    />
  </StoryFrame>;
}

export const SplitterHeaderAndFill: Story = { render: () => <SplitterFill />, globals: { direction: 'rtl' } };

export const DrawerMathSize: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 720, blockSize: 260, border: '1px solid var(--cg-border)' }}>
      <CgDrawer
        aria-label="التنقل"
        defaultOpen
        openSize="min(16rem, 40vw)"
        renderDrawer={() => <nav data-testid="drawer-panel" style={{ display: 'grid', gap: 8 }}><a href="#a">لوحة التحكم</a><a href="#b">الفواتير</a></nav>}
        renderApplicationContent={() => <main style={{ padding: 16 }}>المحتوى</main>}
      />
    </div>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};

const baseTabs: ReadonlyArray<CgTabDescriptor> = [
  { key: 'general', text: 'عام', content: <p>اللوحة العامة</p> },
  { key: 'board', text: 'لوحة', content: <p>لوحة المهام</p> },
  { key: 'calendar', text: 'تقويم', content: <p>التقويم</p> },
];

function ReorderableTabs() {
  const [tabs, setTabs] = useState(baseTabs);
  const [active, setActive] = useState<string | null>('general');
  return <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 520 }}>
      <CgTabs aria-label="العروض" tabs={tabs} activeKey={active} onActiveKeyChange={setActive} reorderable onReorder={({ fromIndex, toIndex }) => setTabs((current) => { const next = [...current]; const [item] = next.splice(fromIndex, 1); if (item) next.splice(toIndex, 0, item); return next; })} />
      <output data-testid="tab-order">{tabs.map((tab) => tab.key).join(',')}</output>
    </div>
  </StoryFrame>;
}

export const TabsReorderableClick: Story = { render: () => <ReorderableTabs />, globals: { direction: 'rtl' } };

function FlyoutFixes() {
  const anchor = useRef<HTMLButtonElement>(null);
  const actions = useRef<CgFlyoutActions>(null);
  const [open, setOpen] = useState(true);
  return <StoryFrame source={source} difference={difference}>
    <div style={{ minBlockSize: 260 }}>
      <CgButton ref={anchor} appearance="outline" onClick={() => setOpen((value) => !value)}>خصائص الخلية</CgButton>
      <CgFlyout
        anchor={anchor}
        open={open}
        onOpenChange={setOpen}
        width={300}
        actionsRef={actions}
        onAfterOpen={() => actions.current?.focusFirst()}
        aria-label="خصائص الخلية"
        data-testid="width-flyout"
      >
        <div style={{ display: 'grid', gap: 8, padding: 12 }}>
          <label>الاسم <input defaultValue="الكمية" /></label>
          <CgButton intent="primary">حفظ</CgButton>
        </div>
      </CgFlyout>
    </div>
  </StoryFrame>;
}

export const FlyoutWidthAndFocus: Story = { render: () => <FlyoutFixes />, globals: { direction: 'rtl' } };

interface RowContext { row: string }
const menuItems: ReadonlyArray<CgContextMenuItem<RowContext>> = [
  { key: 'open', text: 'فتح', shortcut: 'Enter' },
  { key: 'copy', text: 'نسخ الرابط' },
  { key: 'separator', separator: true, text: '' },
  { key: 'delete', text: 'حذف', intent: 'danger' },
];

function ContextMenuFixture() {
  const menu = useRef<CgContextMenuActions<RowContext>>(null);
  const { targetProps } = useCgContextMenuTarget({ menuRef: menu, context: { row: 'r1' } });
  return <StoryFrame source={source} difference={difference}>
    <div style={{ minBlockSize: 260 }}>
      <button type="button" {...targetProps} data-testid="menu-target">صف الميزانية</button>
      <CgContextMenu items={menuItems} actionsRef={menu} confirm={() => true} />
    </div>
  </StoryFrame>;
}

export const ContextMenuDark: Story = { render: () => <ContextMenuFixture />, globals: { theme: 'dark', direction: 'rtl' } };

interface Month { month: string; sales: number }
const months: ReadonlyArray<Month> = [{ month: 'يناير', sales: 12 }, { month: 'فبراير', sales: 18 }, { month: 'مارس', sales: 9 }];
const series: ReadonlyArray<CgChartSeriesDescriptor<Month>> = [{ type: 'bar', name: 'المبيعات', argument: (item) => item.month, value: (item) => item.sales }];

export const ChartDataToggle: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <div style={{ inlineSize: 520 }}>
      <CgChart data={months} series={series} title="المبيعات" description="المبيعات حسب الشهر" dataTableMode="collapsed" />
    </div>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};

interface Choice { key: string; name: string }
const choices: ReadonlyArray<Choice> = [{ key: 'north', name: 'North' }, { key: 'south', name: 'South' }];
const arabicChoices: ReadonlyArray<Choice> = [{ key: 'north', name: 'الشمال' }, { key: 'south', name: 'الجنوب' }];

/** Every input whose buttons sit in the field, small and medium, in one density: "default" leaves it to the page. */
function InputTargetGroup({ density, arabic }: { density: 'default' | 'compact' | 'comfortable'; arabic: boolean }) {
  const locale = arabic ? 'ar-EG' : 'en-US';
  const options = arabic ? arabicChoices : choices;
  const name = (english: string, translated: string) => `${arabic ? translated : english} (${density})`;
  return <section data-testid={`targets-${density}`} data-cg-density={density === 'default' ? undefined : density} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
    <CgDateEdit aria-label={name('Small date', 'تاريخ صغير')} data-testid={`date-small-${density}`} size="small" locale={locale} defaultValue="2026-10-14" today="2026-10-14" />
    <CgDateEdit aria-label={name('Medium date', 'تاريخ متوسط')} data-testid={`date-medium-${density}`} locale={locale} defaultValue="2026-10-14" today="2026-10-14" />
    <CgTimeEdit aria-label={name('Small time', 'وقت صغير')} size="small" locale={locale} defaultValue="09:30:00" />
    <CgComboBox aria-label={name('Small region', 'منطقة صغيرة')} size="small" options={options} defaultValue={options[0]} getOptionLabel={(item) => item.name} getOptionKey={(item) => item.key} clearable />
    <CgTagBox aria-label={name('Small regions', 'مناطق صغيرة')} size="small" options={options} defaultValue={[options[1]!]} getOptionLabel={(item) => item.name} getOptionKey={(item) => item.key} clearable />
    <CgSpinEdit aria-label={name('Small quantity', 'كمية صغيرة')} size="small" locale={locale} defaultValue={3} />
    <CgDecimalEdit aria-label={name('Small amount', 'مبلغ صغير')} size="small" locale={locale} defaultValue={normalizeCgDecimalValue('12.5')} />
    <CgTextBox aria-label={name('Small note', 'ملاحظة صغيرة')} size="small" defaultValue={arabic ? 'نص' : 'Text'} clearButton="always" />
  </section>;
}

function InputTargets({ arabic }: { arabic: boolean }) {
  return <StoryFrame source={source} difference={difference}>
    <div style={{ display: 'grid', gap: 16, inlineSize: 1100, minBlockSize: 520 }}>
      {(['default', 'compact', 'comfortable'] as const).map((density) => <InputTargetGroup key={density} density={density} arabic={arabic} />)}
    </div>
  </StoryFrame>;
}

/** WCAG 2.2: every button in a field is at least 24 px high, and the calendar's heading is named by what it shows. */
export const InputTargetSize: Story = { render: () => <InputTargets arabic={false} /> };
export const InputTargetSizeArabicDark: Story = { render: () => <InputTargets arabic />, globals: { theme: 'dark', direction: 'rtl' } };
