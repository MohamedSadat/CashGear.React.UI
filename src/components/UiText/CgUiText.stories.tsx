import type { Meta, StoryObj } from '@storybook/react-vite';
import { CgFilterBuilder } from '../FilterBuilder';
import type { CgFilterBuilderFieldDescriptor } from '../FilterBuilder';
import { CgGrid } from '../Grid';
import type { CgGridColumnDescriptor } from '../Grid';
import { StoryFrame, parityParameters } from '../../stories/storySupport';
import { CgUiTextProvider } from './CgUiText';

const source = 'CashGear.Blazor.UI/Foundation/Localization/ICgUiText.cs; CgUiLabels.cs';
const difference = 'Blazor reads an optional ICgUiText service from DI; React reads the nearest CgUiTextProvider. Labels passed as props are never translated in either library.';
const meta: Meta = { title: 'Blazor parity 2026-11/UI text', component: CgUiTextProvider, parameters: parityParameters(source, difference) };
export default meta;
type Story = StoryObj;

const ARABIC: Readonly<Record<string, string>> = {
  'Search…': 'بحث…', 'Data grid': 'جدول البيانات', 'Grouping levels': 'مستويات التجميع', 'Drag a column header here to group by that column': 'اسحب رأس عمود هنا للتجميع حسبه',
  '{0} records': '{0} سجلات', 'Rows per page': 'صفوف في الصفحة', Columns: 'الأعمدة', Views: 'طرق العرض', Add: 'إضافة',
  'Sort ascending': 'ترتيب تصاعدي', 'Sort descending': 'ترتيب تنازلي', 'Group by this column': 'التجميع حسب هذا العمود', 'Hide column': 'إخفاء العمود',
  'Auto-fit': 'ملاءمة تلقائية', Export: 'تصدير', 'Export to JSON': 'تصدير إلى JSON', Refresh: 'تحديث',
  'Filter builder': 'منشئ عوامل التصفية', 'Group logic': 'منطق المجموعة', 'All conditions': 'كل الشروط', 'Any condition': 'أي شرط',
  'Add condition': 'إضافة شرط', 'Add group': 'إضافة مجموعة', Apply: 'تطبيق', Cancel: 'إلغاء', Clear: 'مسح', Reset: 'إعادة تعيين',
  'Select field': 'اختر حقلاً', 'Select comparison': 'اختر المقارنة', Remove: 'إزالة', Duplicate: 'تكرار', 'Move up': 'نقل لأعلى', 'Move down': 'نقل لأسفل',
};
const translate = (text: string) => ARABIC[text] ?? text;

interface Row { id: number; account: string; amount: number }
const rows: ReadonlyArray<Row> = [{ id: 1, account: 'النقدية', amount: 1200 }, { id: 2, account: 'البنك', amount: 5400 }, { id: 3, account: 'العملاء', amount: 860 }];
const columns: ReadonlyArray<CgGridColumnDescriptor<Row>> = [
  { type: 'text', fieldId: 'account', title: 'الحساب', accessor: (row) => row.account },
  { type: 'number', fieldId: 'amount', title: 'المبلغ', accessor: (row) => row.amount },
];
const fields: ReadonlyArray<CgFilterBuilderFieldDescriptor> = [{ fieldId: 'account', label: 'الحساب', kind: 'text' }, { fieldId: 'amount', label: 'المبلغ', kind: 'number' }];

export const ArabicBuiltInText: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgUiTextProvider translate={translate}>
      <div dir="rtl" style={{ display: 'grid', gap: 16 }}>
        <CgGrid data={rows} columns={columns} keySelector={(row) => row.id} allowGrouping allowColumnChooser contextMenuAreas={['header', 'row']} showFilterRow={false} />
        <CgFilterBuilder fields={fields} />
      </div>
    </CgUiTextProvider>
  </StoryFrame>,
  globals: { direction: 'rtl' },
};

export const PageLabelsWin: Story = {
  render: () => <StoryFrame source={source} difference={difference}>
    <CgUiTextProvider translate={translate}>
      <CgGrid data={rows} columns={columns} keySelector={(row) => row.id} contextMenuAreas={['header']} showFilterRow={false}
        labels={{ searchPlaceholder: 'Find an account…', sortAscending: 'Sort A to Z', sortDescending: 'Sort Z to A' }} />
    </CgUiTextProvider>
  </StoryFrame>,
};
