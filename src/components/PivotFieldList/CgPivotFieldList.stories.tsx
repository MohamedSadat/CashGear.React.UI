import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgPivotFieldList } from './CgPivotFieldList';
import { CG_PIVOT_FIELD_LIST_VALUES_KEY } from './pivotFieldListModel';
import type { CgPivotFieldListField, CgPivotFieldListLabels, CgPivotFieldListLayout, CgPivotFieldListProps } from './CgPivotFieldList.types';

const source = 'No exact Razor component';
const difference = 'New React implementation of the spreadsheet PivotTable Fields pane. The host owns the pivot; the pane only proposes layouts.';
const emptyLayout: CgPivotFieldListLayout = { filters: [], columns: [], rows: [], values: [] };
const meta = {
  title: 'Phase 36/PivotFieldList',
  component: CgPivotFieldList,
  parameters: parityParameters(source, difference),
  args: { fields: [], layout: emptyLayout, onLayoutChange: () => undefined },
} satisfies Meta<typeof CgPivotFieldList>;
export default meta;
type Story = StoryObj<typeof meta>;

const frame = (content: ReactNode) => <StoryFrame source={source} difference={difference}>{content}</StoryFrame>;

const numeric = new Set(['sales', 'units']);
const salesFields: ReadonlyArray<CgPivotFieldListField> = [
  { key: 'region', caption: 'Region' },
  { key: 'product', caption: 'Product' },
  { key: 'date', caption: 'Date' },
  { key: 'sales', caption: 'Sales', defaultArea: 'values' },
  { key: 'units', caption: 'Units', defaultArea: 'values' },
];
const arabicFields: ReadonlyArray<CgPivotFieldListField> = [
  { key: 'region', caption: 'المنطقة' },
  { key: 'product', caption: 'المنتج' },
  { key: 'date', caption: 'التاريخ' },
  { key: 'sales', caption: 'المبيعات', defaultArea: 'values' },
  { key: 'units', caption: 'الوحدات', defaultArea: 'values' },
];

const salesLayout: CgPivotFieldListLayout = {
  filters: [{ id: 'product', fieldKey: 'product' }],
  columns: [{ id: 'values', fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY }],
  rows: [{ id: 'region', fieldKey: 'region' }, { id: 'date', fieldKey: 'date' }],
  values: [{ id: 'sum-sales', fieldKey: 'sales', caption: 'Sum of Sales' }, { id: 'sum-units', fieldKey: 'units', caption: 'Sum of Units' }],
};
const arabicLayout: CgPivotFieldListLayout = {
  ...salesLayout,
  values: [{ id: 'sum-sales', fieldKey: 'sales', caption: 'مجموع المبيعات' }, { id: 'sum-units', fieldKey: 'units', caption: 'مجموع الوحدات' }],
};

const arabicLabels: Partial<CgPivotFieldListLabels> = {
  title: 'حقول PivotTable',
  tools: 'أدوات',
  stacked: 'مقطع الحقول ومقطع المناطق مكدسان',
  sideBySide: 'مقطع الحقول ومقطع المناطق جنبًا إلى جنب',
  sortAscending: 'فرز من أ إلى ي',
  sortSourceOrder: 'فرز حسب ترتيب مصدر البيانات',
  chooseFields: 'اختر الحقول لإضافتها إلى التقرير:',
  search: 'بحث',
  noFields: 'لا توجد حقول مطابقة.',
  dragBetweenAreas: 'اسحب الحقول بين المناطق أدناه:',
  filters: 'عوامل التصفية',
  columns: 'الأعمدة',
  rows: 'الصفوف',
  values: 'القيم',
  valuesItem: 'Σ القيم',
  fieldOptions: (caption) => `خيارات ${caption}`,
  itemOptions: (caption) => `خيارات ${caption}`,
  keyboardHint: 'اضغط Enter أو Shift+F10 لعرض الخيارات.',
  moveUp: 'نقل لأعلى',
  moveDown: 'نقل لأسفل',
  moveToBeginning: 'نقل إلى البداية',
  moveToEnd: 'نقل إلى النهاية',
  moveToFilters: 'نقل إلى عامل تصفية التقرير',
  moveToRows: 'نقل إلى تسميات الصفوف',
  moveToColumns: 'نقل إلى تسميات الأعمدة',
  moveToValues: 'نقل إلى القيم',
  addToFilters: 'إضافة إلى عامل تصفية التقرير',
  addToRows: 'إضافة إلى تسميات الصفوف',
  addToColumns: 'إضافة إلى تسميات الأعمدة',
  addToValues: 'إضافة إلى القيم',
  removeField: 'إزالة الحقل',
  fieldSettings: 'إعدادات الحقل…',
  valueFieldSettings: 'إعدادات حقل القيمة…',
  deferUpdate: 'تأجيل تحديث التخطيط',
  update: 'تحديث',
  readOnly: 'لا يمكن تغيير PivotTable هذا هنا.',
  announceAdd: (caption, area, position) => `تمت إضافة ${caption} إلى ${area}، الموضع ${position}.`,
  announceMove: (caption, area, position) => `تم نقل ${caption} إلى ${area}، الموضع ${position}.`,
  announceRemove: (caption) => `تمت إزالة ${caption}.`,
};

/** What a host does with a proposal: keep Σ Values only while there are two or more value items. */
function withValuesItem(layout: CgPivotFieldListLayout): CgPivotFieldListLayout {
  const has = [...layout.columns, ...layout.rows].some((item) => item.fieldKey === CG_PIVOT_FIELD_LIST_VALUES_KEY);
  if (layout.values.length >= 2 && !has) return { ...layout, columns: [...layout.columns, { id: 'values', fieldKey: CG_PIVOT_FIELD_LIST_VALUES_KEY }] };
  if (layout.values.length < 2 && has) {
    const keep = (items: CgPivotFieldListLayout['rows']) => items.filter((item) => item.fieldKey !== CG_PIVOT_FIELD_LIST_VALUES_KEY);
    return { ...layout, columns: keep(layout.columns), rows: keep(layout.rows) };
  }
  return layout;
}

type HostProps = Omit<CgPivotFieldListProps, 'layout' | 'onLayoutChange'> & { initial: CgPivotFieldListLayout; sumOf?: (caption: string) => string; frameStyle?: CSSProperties };

function Host({ initial, sumOf = (caption) => `Sum of ${caption}`, frameStyle, ...props }: HostProps) {
  const [layout, setLayout] = useState(initial);
  const [log, setLog] = useState('');
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'start', flexWrap: 'wrap' }}>
      <div style={{ inlineSize: 320, blockSize: 640, ...frameStyle }}>
        <CgPivotFieldList
          data-testid="field-list"
          layout={layout}
          onLayoutChange={(next, change) => { setLayout(withValuesItem(next)); setLog(change.kind === 'batch' ? `batch of ${change.changes.length}` : `${change.kind} ${change.fieldKey}`); }}
          getValueCaption={(field) => (numeric.has(field.key) ? sumOf(field.caption) : undefined)}
          onFieldSettings={(item) => setLog(`field settings ${item.fieldKey}`)}
          onValueFieldSettings={(item) => setLog(`value field settings ${item.fieldKey}`)}
          {...props}
        />
      </div>
      <output aria-label="Last change" style={{ fontSize: 12, color: 'var(--cg-text-secondary)' }}>{log}</output>
    </div>
  );
}

export const SalesExample: Story = { render: () => frame(<Host fields={salesFields} initial={salesLayout} />) };
export const Empty: Story = { render: () => frame(<Host fields={salesFields} initial={emptyLayout} />) };
export const SideBySide: Story = { render: () => frame(<Host fields={salesFields} initial={salesLayout} defaultSectionLayout="sideBySide" frameStyle={{ inlineSize: 520, blockSize: 520 }} />) };
export const Deferred: Story = { render: () => frame(<Host fields={salesFields} initial={salesLayout} defaultDeferUpdate />) };
export const ReadOnly: Story = { render: () => frame(<Host fields={salesFields} initial={salesLayout} readOnly />) };
export const DisabledField: Story = { render: () => frame(<Host fields={salesFields.map((field) => (field.key === 'date' ? { ...field, disabled: true } : field))} initial={salesLayout} />) };
export const Dark: Story = { globals: { theme: 'dark' }, render: () => frame(<Host fields={salesFields} initial={salesLayout} />) };
export const ArabicRtl: Story = { globals: { direction: 'rtl' }, render: () => frame(<Host fields={arabicFields} initial={arabicLayout} labels={arabicLabels} sumOf={(caption) => `مجموع ${caption}`} />) };
export const ArabicRtlReadOnly: Story = { globals: { direction: 'rtl' }, render: () => frame(<Host fields={arabicFields} initial={arabicLayout} labels={arabicLabels} sumOf={(caption) => `مجموع ${caption}`} readOnly />) };
