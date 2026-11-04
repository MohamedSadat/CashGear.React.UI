import { useRef } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CgAccordion,
  CgCalendar,
  CgComboBox,
  CgContextMenu,
  CgDateEdit,
  CgDateRangePicker,
  CgDateRangePresetSelect,
  CgDropDownBox,
  CgDropDownButton,
  CgFileUploader,
  CgFormLayout,
  CgFormLayoutItem,
  CgGrid,
  CgListBox,
  CgLookUpGrid,
  CgMaskedInput,
  CgMenu,
  CgPdfViewer,
  CgRichTextEditor,
  CgScheduler,
  CgSplitButton,
  CgStepper,
  CgTabs,
  CgTagBox,
  CgTextBox,
  CgTimeEdit,
  CgToolbar,
  CgTreeList,
  CgTreeView,
  useCgContextMenuTarget,
} from '../index';
import type { CgContextMenuActions, CgDirection, CgGridColumnDescriptor, CgLookUpGridColumnDescriptor, CgTreeListColumn } from '../index';

interface Row { id: number; name: string; parent: number | null }
const rows: ReadonlyArray<Row> = [{ id: 1, name: 'الفرع الرئيسي', parent: null }, { id: 2, name: 'فرع الميناء', parent: 1 }];
const rowKey = (row: Row) => row.id;
const rowName = (row: Row) => row.name;
const gridColumns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [{ fieldId: 'name', type: 'text', title: 'الاسم', accessor: rowName, width: 180 }];
const lookUpColumns: ReadonlyArray<CgLookUpGridColumnDescriptor<Row>> = [{ fieldId: 'name', title: 'الاسم', accessor: rowName }];
const treeColumns: ReadonlyArray<CgTreeListColumn<Row, number>> = [{ type: 'text', fieldId: 'name', title: 'الاسم', hierarchy: true, getValue: rowName }];
const commands = [{ key: 'one', text: 'الأول' }, { key: 'two', text: 'الثاني' }];
const steps = [{ key: 'one', label: 'العميل' }, { key: 'two', label: 'السطور' }, { key: 'three', label: 'المراجعة' }];
const tabs = [{ key: 'one', text: 'عام', content: 'عام' }, { key: 'two', text: 'السطور', content: 'السطور' }];
const toolbarItems = [{ name: 'one', text: 'حفظ' }, { name: 'two', text: 'طباعة' }];
const appointment = { id: 1, title: 'اجتماع', start: '2026-09-07T09:00:00Z', end: '2026-09-07T10:00:00Z' };
type Appointment = typeof appointment;

/**
 * Every control that writes its own `dir`. With `direction` omitted, each one
 * has to follow whatever parent it is rendered into.
 */
export const directionControls: ReadonlyArray<{ readonly name: string; readonly render: (direction?: CgDirection) => ReactElement }> = [
  { name: 'Accordion', render: (direction) => <CgAccordion direction={direction} items={[{ key: 'one', text: 'المبيعات', children: [{ key: 'two', text: 'الفواتير' }] }]} /> },
  { name: 'Calendar', render: (direction) => <CgCalendar direction={direction} locale="ar-EG" defaultVisibleDate="2026-09-01" today="2026-09-14" aria-label="التقويم" /> },
  { name: 'ComboBox', render: (direction) => <CgComboBox direction={direction} aria-label="العميل" options={rows} getOptionKey={rowKey} getOptionLabel={rowName} /> },
  { name: 'DateEdit', render: (direction) => <CgDateEdit direction={direction} aria-label="التاريخ" locale="ar-EG" defaultValue="2026-09-14" today="2026-09-14" /> },
  { name: 'DateRangePicker', render: (direction) => <CgDateRangePicker direction={direction} aria-label="الفترة" locale="ar-EG" today="2026-09-14" /> },
  { name: 'DateRangePresetSelect', render: (direction) => <CgDateRangePresetSelect direction={direction} aria-label="الفترة المحددة" locale="ar-EG" anchorDate="2026-09-14" /> },
  { name: 'DropDownBox', render: (direction) => <CgDropDownBox direction={direction} aria-label="المستودع" popupAriaLabel="محتوى القائمة" toggleAriaLabel="فتح القائمة" defaultValue="الرئيسي" getDisplayText={(value) => value ?? ''}>محتوى</CgDropDownBox> },
  { name: 'DropDownButton', render: (direction) => <CgDropDownButton direction={direction} items={commands}>الإجراءات</CgDropDownButton> },
  { name: 'FileUploader', render: (direction) => <CgFileUploader direction={direction} aria-label="المرفقات" upload={() => ({ succeeded: true })} /> },
  { name: 'FormLayout', render: (direction) => <CgFormLayout direction={direction} captionPosition="horizontal"><CgFormLayoutItem caption="الاسم"><CgTextBox fullWidth /></CgFormLayoutItem></CgFormLayout> },
  { name: 'Grid', render: (direction) => <CgGrid direction={direction} aria-label="الفروع" data={rows} columns={gridColumns} keySelector={rowKey} /> },
  { name: 'ListBox', render: (direction) => <CgListBox direction={direction} aria-label="المستودعات" items={rows} getItemKey={rowKey} getItemLabel={rowName} /> },
  { name: 'LookUpGrid', render: (direction) => <CgLookUpGrid direction={direction} aria-label="الصنف" data={rows} columns={lookUpColumns} valueSelector={rowKey} textSelector={rowName} /> },
  { name: 'MaskedInput', render: (direction) => <CgMaskedInput direction={direction} aria-label="الرمز" mask="LL-00" /> },
  { name: 'Menu', render: (direction) => <CgMenu direction={direction} aria-label="القائمة" items={commands} /> },
  { name: 'PdfViewer', render: (direction) => <CgPdfViewer direction={direction} aria-label="المستند" /> },
  { name: 'RichTextEditor', render: (direction) => <CgRichTextEditor direction={direction} ariaLabel="الوصف" defaultValue="<p>نص</p>" /> },
  { name: 'Scheduler', render: (direction) => <CgScheduler<Appointment> direction={direction} items={[appointment]} idSelector={(item) => item.id} titleSelector={(item) => item.title} startSelector={(item) => item.start} endSelector={(item) => item.end} defaultSelectedDate="2026-09-07" defaultCurrentView="day" visibleDayStart="08:00" visibleDayEnd="10:00" height="16rem" now={() => '2026-09-07T08:00:00Z'} /> },
  { name: 'SplitButton', render: (direction) => <CgSplitButton direction={direction} items={commands}>حفظ</CgSplitButton> },
  { name: 'Stepper', render: (direction) => <CgStepper direction={direction} steps={steps} linear={false} /> },
  { name: 'Tabs', render: (direction) => <CgTabs direction={direction} tabs={tabs} /> },
  { name: 'TagBox', render: (direction) => <CgTagBox direction={direction} aria-label="العملاء" options={rows} getOptionKey={rowKey} getOptionLabel={rowName} /> },
  { name: 'TimeEdit', render: (direction) => <CgTimeEdit direction={direction} aria-label="الوقت" locale="ar-EG" defaultValue="13:17:00.000" /> },
  { name: 'Toolbar', render: (direction) => <CgToolbar direction={direction} ariaLabel="الأوامر" items={toolbarItems} /> },
  { name: 'TreeList', render: (direction) => <CgTreeList<Row, number> direction={direction} aria-label="شجرة الفروع" data={rows} columns={treeColumns} getKey={rowKey} getParentKey={(row) => row.parent === null ? { kind: 'none' } : { kind: 'key', key: row.parent }} /> },
  { name: 'TreeView', render: (direction) => <CgTreeView direction={direction} aria-label="الأقسام" defaultExpandedKeys={new Set(['one'])} nodes={[{ key: 'one', text: 'المبيعات', children: [{ key: 'two', text: 'الفواتير' }] }]} /> },
];

function ContextMenuExample() {
  const menu = useRef<CgContextMenuActions<string>>(null);
  const { targetProps } = useCgContextMenuTarget({ menuRef: menu, context: 'order' });
  return <>
    <button type="button" {...targetProps}>قائمة السياق</button>
    <CgContextMenu<string> items={commands} actionsRef={menu} ariaLabel="قائمة السياق" />
  </>;
}

function Inherited({ parentDirection, controlDirection }: { parentDirection?: 'ltr' | 'rtl'; controlDirection?: 'ltr' | 'rtl' }) {
  return <main dir={parentDirection} style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
    {directionControls.map(({ name, render }) => <section key={name} aria-label={name} data-direction-control={name} style={{ display: 'grid', gap: 4 }}>
      <h2 style={{ margin: 0, fontSize: 12 }}>{name}</h2>
      <div data-direction-parent="">{render(controlDirection)}</div>
    </section>)}
    <section aria-label="ContextMenu" data-direction-control="ContextMenu"><ContextMenuExample /></section>
  </main>;
}

const meta = {
  title: 'Foundation/Direction',
  component: Inherited,
  excludeStories: ['directionControls'],
  globals: { direction: 'rtl' },
} satisfies Meta<typeof Inherited>;
export default meta;

/** No control below passes `direction`, and the page around them is RTL. */
export const InheritsRtl: StoryObj<typeof Inherited> = {};
/** The same controls on an LTR island inside the RTL page. */
export const InheritsLtrIsland: StoryObj<typeof Inherited> = { args: { parentDirection: 'ltr' } };
/** The same controls passing `direction="rtl"`, which `InheritsRtl` should match exactly. */
export const ExplicitRtl: StoryObj<typeof Inherited> = { args: { controlDirection: 'rtl' } };
